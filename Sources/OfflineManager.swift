import Foundation
import SwiftUI
import Combine
import AVKit

/// Model đại diện cho một video đã tải về máy để xem offline
struct OfflineVideo: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let author: String
    let quality: String
    let duration: Double
    let localVideoFileName: String
    let localThumbnailFileName: String?
    let dateAdded: Date
    
    var videoURL: URL {
        OfflineManager.videosDirectory.appendingPathComponent(localVideoFileName)
    }
    
    var thumbnailURL: URL? {
        guard let name = localThumbnailFileName else { return nil }
        return OfflineManager.videosDirectory.appendingPathComponent(name)
    }
}

/// Trình quản lý tải và phát video offline độ phân giải cao (1080p, 1440p, 4K)
@MainActor
final class OfflineManager: NSObject, ObservableObject {
    static let shared = OfflineManager()
    
    @Published var downloadedVideos: [OfflineVideo] = []
    @Published var activeDownloadProgress: [String: Double] = [:] // videoId -> 0.0 ... 1.0
    @Published var activeDownloadTitles: [String: String] = [:]
    @Published var activeDownloadStatus: [String: String] = [:] // "Đang tải video...", "Đang ghép âm thanh..."
    
    static let videosDirectory: URL = {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("OfflineVideos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()
    
    private static let metadataURL = videosDirectory.appendingPathComponent("offline_metadata.json")
    
    override init() {
        super.init()
        loadSavedVideos()
    }
    
    private func loadSavedVideos() {
        guard let data = try? Data(contentsOf: Self.metadataURL),
              let list = try? JSONDecoder().decode([OfflineVideo].self, from: data) else {
            downloadedVideos = []
            return
        }
        downloadedVideos = list.filter { FileManager.default.fileExists(atPath: $0.videoURL.path) }
    }
    
    private func saveVideos() {
        if let data = try? JSONEncoder().encode(downloadedVideos) {
            try? data.write(to: Self.metadataURL)
        }
    }
    
    /// Bắt đầu tải video (hỗ trợ cả luồng đơn 720p lẫn luồng ghép 1080p/1440p)
    func startDownload(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        streamURLString: String,
        audioURLString: String?,
        thumbnailURLString: String?
    ) {
        guard let videoStreamURL = URL(string: streamURLString) else { return }
        
        let videoFileName = "\(videoId).mp4"
        let destURL = Self.videosDirectory.appendingPathComponent(videoFileName)
        
        if downloadedVideos.contains(where: { $0.id == videoId }) {
            return
        }
        
        activeDownloadProgress[videoId] = 0.1
        activeDownloadTitles[videoId] = title
        activeDownloadStatus[videoId] = audioURLString != nil ? "Đang tải video \(quality)..." : "Đang tải..."
        
        // Tải ảnh thumbnail ngầm
        var thumbFileName: String? = nil
        if let thumbStr = thumbnailURLString, let thumbURL = URL(string: thumbStr) {
            thumbFileName = "\(videoId).jpg"
            let localThumbURL = Self.videosDirectory.appendingPathComponent(thumbFileName!)
            Task.detached(priority: .background) {
                if let data = try? Data(contentsOf: thumbURL) {
                    try? data.write(to: localThumbURL)
                }
            }
        }
        
        // Trường hợp 1: Luồng Progressive (đã có sẵn tiếng, thường là 720p)
        guard let audioURLStr = audioURLString, let audioStreamURL = URL(string: audioURLStr) else {
            downloadSingleFile(
                videoId: videoId,
                title: title,
                author: author,
                quality: quality,
                duration: duration,
                streamURL: videoStreamURL,
                destURL: destURL,
                videoFileName: videoFileName,
                thumbFileName: thumbFileName
            )
            return
        }
        
        // Trường hợp 2: Luồng Adaptive độ phân giải cao (1080p, 1440p 2K, 4K) -> Tải 2 file và ghép native
        downloadAndMuxDualStreams(
            videoId: videoId,
            title: title,
            author: author,
            quality: quality,
            duration: duration,
            videoStreamURL: videoStreamURL,
            audioStreamURL: audioStreamURL,
            destURL: destURL,
            videoFileName: videoFileName,
            thumbFileName: thumbFileName
        )
    }
    
    // Tải đơn luồng (720p có sẵn âm thanh)
    private func downloadSingleFile(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        streamURL: URL,
        destURL: URL,
        videoFileName: String,
        thumbFileName: String?
    ) {
        let session = URLSession(configuration: .default)
        let task = session.downloadTask(with: streamURL) { [weak self] tempURL, _, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.cleanupTask(videoId: videoId)
                
                guard let tempURL = tempURL, error == nil else {
                    NSLog("Aether: Lỗi tải file: %@", error?.localizedDescription ?? "unknown")
                    return
                }
                
                try? FileManager.default.removeItem(at: destURL)
                do {
                    try FileManager.default.moveItem(at: tempURL, to: destURL)
                    self.registerCompletedVideo(
                        videoId: videoId,
                        title: title,
                        author: author,
                        quality: quality,
                        duration: duration,
                        fileName: videoFileName,
                        thumbName: thumbFileName
                    )
                } catch {
                    NSLog("Aether: Không thể lưu video: %@", error.localizedDescription)
                }
            }
        }
        task.resume()
    }
    
    // Tải song song 2 luồng (Hình 1080p/1440p + Tiếng) rồi ghép passthrough bằng AVFoundation
    private func downloadAndMuxDualStreams(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        videoStreamURL: URL,
        audioStreamURL: URL,
        destURL: URL,
        videoFileName: String,
        thumbFileName: String?
    ) {
        let tempVideoURL = Self.videosDirectory.appendingPathComponent("temp_v_\(videoId).mp4")
        let tempAudioURL = Self.videosDirectory.appendingPathComponent("temp_a_\(videoId).m4a")
        
        Task.detached(priority: .userInitiated) {
            do {
                let session = URLSession.shared
                
                // Tải song song 2 luồng
                async let videoDownload = session.download(from: videoStreamURL)
                async let audioDownload = session.download(from: audioStreamURL)
                
                let (vTemp, _) = try await videoDownload
                let (aTemp, _) = try await audioDownload
                
                try? FileManager.default.removeItem(at: tempVideoURL)
                try? FileManager.default.removeItem(at: tempAudioURL)
                
                try FileManager.default.moveItem(at: vTemp, to: tempVideoURL)
                try FileManager.default.moveItem(at: aTemp, to: tempAudioURL)
                
                await MainActor.run {
                    self.activeDownloadStatus[videoId] = "Đang tối ưu & ghép âm thanh..."
                    self.activeDownloadProgress[videoId] = 0.85
                }
                
                // Ghép nối passthrough native
                try await self.muxVideoAndAudio(videoURL: tempVideoURL, audioURL: tempAudioURL, outputURL: destURL)
                
                // Xoá file tạm
                try? FileManager.default.removeItem(at: tempVideoURL)
                try? FileManager.default.removeItem(at: tempAudioURL)
                
                await MainActor.run {
                    self.cleanupTask(videoId: videoId)
                    self.registerCompletedVideo(
                        videoId: videoId,
                        title: title,
                        author: author,
                        quality: quality,
                        duration: duration,
                        fileName: videoFileName,
                        thumbName: thumbFileName
                    )
                }
            } catch {
                NSLog("Aether: Lỗi tải/ghép video độ phân giải cao: %@", error.localizedDescription)
                try? FileManager.default.removeItem(at: tempVideoURL)
                try? FileManager.default.removeItem(at: tempAudioURL)
                await MainActor.run {
                    self.cleanupTask(videoId: videoId)
                }
            }
        }
    }
    
    // Ghép luồng hình và luồng tiếng native tốc độ cao (0.5s - 1s, không tốn pin)
    private func muxVideoAndAudio(videoURL: URL, audioURL: URL, outputURL: URL) async throws {
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: videoURL)
        let audioAsset = AVURLAsset(url: audioURL)
        
        let videoTracks = try await videoAsset.loadTracks(withMediaType: .video)
        let audioTracks = try await audioAsset.loadTracks(withMediaType: .audio)
        
        guard let videoTrack = videoTracks.first, let audioTrack = audioTracks.first else {
            throw NSError(domain: "AetherMux", code: -1, userInfo: [NSLocalizedDescriptionKey: "Thiếu track video hoặc audio"])
        }
        
        let videoDuration = try await videoAsset.load(.duration)
        let audioDuration = try await audioAsset.load(.duration)
        let minDuration = CMTimeMinimum(videoDuration, audioDuration)
        let timeRange = CMTimeRange(start: .zero, duration: minDuration)
        
        let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
        try compVideoTrack?.insertTimeRange(timeRange, of: videoTrack, at: .zero)
        
        let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        try compAudioTrack?.insertTimeRange(timeRange, of: audioTrack, at: .zero)
        
        guard let exportSession = AVAssetExportSession(composition: composition, presetName: AVAssetExportPresetPassthrough) else {
            throw NSError(domain: "AetherMux", code: -2, userInfo: [NSLocalizedDescriptionKey: "Không thể tạo AVAssetExportSession"])
        }
        
        try? FileManager.default.removeItem(at: outputURL)
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        
        await withCheckedContinuation { continuation in
            exportSession.exportAsynchronously {
                continuation.resume()
            }
        }
        
        if exportSession.status != .completed {
            throw exportSession.error ?? NSError(domain: "AetherMux", code: -3, userInfo: [NSLocalizedDescriptionKey: "Lỗi xuất file ghép"])
        }
    }
    
    private func registerCompletedVideo(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        fileName: String,
        thumbName: String?
    ) {
        let video = OfflineVideo(
            id: videoId,
            title: title,
            author: author,
            quality: quality,
            duration: duration,
            localVideoFileName: fileName,
            localThumbnailFileName: thumbName,
            dateAdded: Date()
        )
        downloadedVideos.insert(video, at: 0)
        saveVideos()
    }
    
    private func cleanupTask(videoId: String) {
        activeDownloadProgress.removeValue(forKey: videoId)
        activeDownloadTitles.removeValue(forKey: videoId)
        activeDownloadStatus.removeValue(forKey: videoId)
    }
    
    func deleteVideo(_ video: OfflineVideo) {
        try? FileManager.default.removeItem(at: video.videoURL)
        if let thumbURL = video.thumbnailURL {
            try? FileManager.default.removeItem(at: thumbURL)
        }
        downloadedVideos.removeAll { $0.id == video.id }
        saveVideos()
    }
}
