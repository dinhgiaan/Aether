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

/// Trình quản lý tải và phát video offline độ phân giải cao với tiến trình thời gian thực
@MainActor
final class OfflineManager: NSObject, ObservableObject {
    static let shared = OfflineManager()
    
    @Published var downloadedVideos: [OfflineVideo] = []
    @Published var activeDownloadProgress: [String: Double] = [:] // videoId -> 0.0 ... 1.0
    @Published var activeDownloadTitles: [String: String] = [:]
    @Published var activeDownloadStatus: [String: String] = [:] // "12.4 MB / 45.0 MB (28%)"
    @Published var latestCompletedVideoTitle: String? = nil
    
    nonisolated static let videosDirectory: URL = {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("OfflineVideos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()
    
    private nonisolated static let metadataURL = videosDirectory.appendingPathComponent("offline_metadata.json")
    
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
        // Tự động dọn dẹp các file rỗng hoặc bị lỗi từ các phiên bản trước
        var validVideos: [OfflineVideo] = []
        for video in list {
            guard FileManager.default.fileExists(atPath: video.videoURL.path) else { continue }
            if let attrs = try? FileManager.default.attributesOfItem(atPath: video.videoURL.path),
               let size = attrs[.size] as? Int64, size > 10_000 {
                validVideos.append(video)
            } else {
                try? FileManager.default.removeItem(at: video.videoURL)
                if let thumb = video.thumbnailURL { try? FileManager.default.removeItem(at: thumb) }
            }
        }
        downloadedVideos = validVideos
    }
    
    private func saveVideos() {
        if let data = try? JSONEncoder().encode(downloadedVideos) {
            try? data.write(to: Self.metadataURL)
        }
    }
    
    /// Bắt đầu tải video với cập nhật tiến trình % thực tế
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
        
        activeDownloadProgress[videoId] = 0.02
        activeDownloadTitles[videoId] = title
        activeDownloadStatus[videoId] = "Đang kết nối..."
        
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
        
        // Luồng đơn (Progressive có sẵn âm thanh) hoặc Luồng kép (Adaptive)
        if let audioURLStr = audioURLString, let audioStreamURL = URL(string: audioURLStr) {
            startDualDownload(
                videoId: videoId,
                title: title,
                author: author,
                quality: quality,
                duration: duration,
                videoURL: videoStreamURL,
                audioURL: audioStreamURL,
                destURL: destURL,
                videoFileName: videoFileName,
                thumbFileName: thumbFileName
            )
        } else {
            startSingleDownload(
                videoId: videoId,
                title: title,
                author: author,
                quality: quality,
                duration: duration,
                videoURL: videoStreamURL,
                destURL: destURL,
                videoFileName: videoFileName,
                thumbFileName: thumbFileName
            )
        }
    }
    
    // MARK: – Tải dữ liệu từng chunk 1MB với Range Header (Bypass 100% 403 Forbidden của googlevideo)
    private func downloadStreamChunked(
        streamURL: URL,
        fileExtension: String,
        onProgress: @escaping (Double, Int64, Int64) -> Void
    ) async throws -> URL {
        let destTempURL = FileManager.default.temporaryDirectory.appendingPathComponent("ae_dl_\(UUID().uuidString).\(fileExtension)")
        try? FileManager.default.removeItem(at: destTempURL)
        FileManager.default.createFile(atPath: destTempURL.path, contents: nil)
        guard let fileHandle = FileHandle(forWritingAtPath: destTempURL.path) else {
            throw NSError(domain: "AetherDownload", code: -1, userInfo: [NSLocalizedDescriptionKey: "Không thể khởi tạo file đệm"])
        }
        defer { try? fileHandle.close() }
        
        var clen: Int64 = 0
        if let comps = URLComponents(url: streamURL, resolvingAgainstBaseURL: false),
           let clenStr = comps.queryItems?.first(where: { $0.name == "clen" })?.value,
           let parsed = Int64(clenStr) {
            clen = parsed
        }
        
        let chunkSize: Int64 = 1024 * 1024 // 1 MB per chunk (được YouTube CDN chấp thuận 100%)
        var startByte: Int64 = 0
        let session = URLSession(configuration: .default)
        
        while clen == 0 || startByte < clen {
            let endByte = (clen > 0) ? min(startByte + chunkSize - 1, clen - 1) : (startByte + chunkSize - 1)
            var req = URLRequest(url: streamURL)
            req.setValue("com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", forHTTPHeaderField: "User-Agent")
            req.setValue("bytes=\(startByte)-\(endByte)", forHTTPHeaderField: "Range")
            
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse, (http.statusCode == 206 || http.statusCode == 200) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                throw NSError(domain: "AetherDownload", code: -2, userInfo: [NSLocalizedDescriptionKey: "Máy chủ từ chối kết nối (HTTP \(code))"])
            }
            
            if clen == 0 {
                if let contentRange = http.value(forHTTPHeaderField: "Content-Range"),
                   let totalStr = contentRange.components(separatedBy: "/").last,
                   let total = Int64(totalStr) {
                    clen = total
                } else if let lengthStr = http.value(forHTTPHeaderField: "Content-Length"),
                          let len = Int64(lengthStr) {
                    clen = len
                }
            }
            
            guard !data.isEmpty else { break }
            try fileHandle.write(contentsOf: data)
            startByte += Int64(data.count)
            
            let progress = (clen > 0) ? Double(startByte) / Double(clen) : 0.5
            onProgress(min(1.0, progress), startByte, clen)
            
            if clen > 0 && startByte >= clen { break }
        }
        
        return destTempURL
    }

    // MARK: – Tải đơn luồng (Progressive)
    private func startSingleDownload(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        videoURL: URL,
        destURL: URL,
        videoFileName: String,
        thumbFileName: String?
    ) {
        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self = self else { return }
            do {
                let safeTemp = try await self.downloadStreamChunked(streamURL: videoURL, fileExtension: "mp4") { progress, written, expected in
                    Task { @MainActor in
                        self.activeDownloadProgress[videoId] = progress
                        let writtenStr = self.formatBytes(written)
                        let totalStr = expected > 0 ? self.formatBytes(expected) : "..."
                        self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(progress * 100))%)"
                    }
                }
                
                try? FileManager.default.createDirectory(at: Self.videosDirectory, withIntermediateDirectories: true, attributes: nil)
                try? FileManager.default.removeItem(at: destURL)
                try FileManager.default.moveItem(at: safeTemp, to: destURL)
                
                await MainActor.run {
                    self.finishDownload(
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
                NSLog("Aether single download error: %@", error.localizedDescription)
                try? FileManager.default.removeItem(at: destURL)
                await MainActor.run {
                    self.failDownload(videoId: videoId, message: "Lỗi tải video: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // MARK: – Tải song song 2 luồng (Hình + Tiếng) với % cập nhật đồng thời
    private func startDualDownload(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        videoURL: URL,
        audioURL: URL,
        destURL: URL,
        videoFileName: String,
        thumbFileName: String?
    ) {
        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self = self else { return }
            
            var vProgress: Double = 0.0
            var aProgress: Double = 0.0
            var vWritten: Int64 = 0
            var vTotal: Int64 = 0
            var aWritten: Int64 = 0
            var aTotal: Int64 = 0
            
            let updateProgress: () -> Void = {
                let combined = (vProgress * 0.88) + (aProgress * 0.12)
                let writtenTotal = vWritten + aWritten
                let totalTotal = vTotal + aTotal
                let writtenStr = self.formatBytes(writtenTotal)
                let totalStr = totalTotal > 0 ? self.formatBytes(totalTotal) : "..."
                Task { @MainActor in
                    self.activeDownloadProgress[videoId] = max(0.02, min(0.94, combined))
                    self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(combined * 100))%)"
                }
            }
            
            do {
                async let vTask = self.downloadStreamChunked(streamURL: videoURL, fileExtension: "mp4") { p, w, t in
                    vProgress = p; vWritten = w; vTotal = t; updateProgress()
                }
                async let aTask = self.downloadStreamChunked(streamURL: audioURL, fileExtension: "m4a") { p, w, t in
                    aProgress = p; aWritten = w; aTotal = t; updateProgress()
                }
                
                let (vTemp, aTemp) = try await (vTask, aTask)
                
                await MainActor.run {
                    self.activeDownloadProgress[videoId] = 0.95
                    self.activeDownloadStatus[videoId] = "Đang ghép nối & lưu video..."
                }
                
                try await self.muxVideoAndAudio(videoURL: vTemp, audioURL: aTemp, outputURL: destURL)
                try? FileManager.default.removeItem(at: vTemp)
                try? FileManager.default.removeItem(at: aTemp)
                
                await MainActor.run {
                    self.finishDownload(
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
                NSLog("Aether dual download error: %@", error.localizedDescription)
                try? FileManager.default.removeItem(at: destURL)
                await MainActor.run {
                    self.failDownload(videoId: videoId, message: "Lỗi tải video: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func finishDownload(
        videoId: String,
        title: String,
        author: String,
        quality: String,
        duration: Double,
        fileName: String,
        thumbName: String?
    ) {
        let destURL = Self.videosDirectory.appendingPathComponent(fileName)
        // Kiểm tra kích thước file thật trước khi xác nhận lưu
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: destURL.path),
              let size = attrs[.size] as? Int64, size > 10_000 else {
            failDownload(videoId: videoId, message: "File tải về không hợp lệ hoặc bị lỗi")
            return
        }

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
        
        activeDownloadProgress[videoId] = 1.0
        activeDownloadStatus[videoId] = "Hoàn tất!"
        latestCompletedVideoTitle = title
        
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            await MainActor.run {
                self.cleanupTask(videoId: videoId)
            }
        }
    }
    
    private func failDownload(videoId: String, message: String) {
        activeDownloadStatus[videoId] = message
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            await MainActor.run {
                self.cleanupTask(videoId: videoId)
            }
        }
    }
    
    // Ghép luồng hình và luồng tiếng native (Passthrough siêu tốc ~0.3s hoặc Re-encode chất lượng cao)
    private func muxVideoAndAudio(videoURL: URL, audioURL: URL, outputURL: URL) async throws {
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: videoURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let audioAsset = AVURLAsset(url: audioURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        
        let videoTracks = try await videoAsset.loadTracks(withMediaType: .video)
        let audioTracks = try await audioAsset.loadTracks(withMediaType: .audio)
        
        guard let videoTrack = videoTracks.first else {
            throw NSError(domain: "AetherMux", code: -1, userInfo: [NSLocalizedDescriptionKey: "Thiếu track video"])
        }
        
        let vDuration = try await videoAsset.load(.duration)
        let videoRange = CMTimeRange(start: .zero, duration: vDuration)
        
        guard let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw NSError(domain: "AetherMux", code: -2, userInfo: [NSLocalizedDescriptionKey: "Không tạo được video track"])
        }
        try compVideoTrack.insertTimeRange(videoRange, of: videoTrack, at: .zero)
        
        if let audioTrack = audioTracks.first {
            let aDuration = try await audioAsset.load(.duration)
            let minDuration = CMTimeMinimum(vDuration, aDuration)
            let audioRange = CMTimeRange(start: .zero, duration: minDuration)
            
            if let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
                try? compAudioTrack.insertTimeRange(audioRange, of: audioTrack, at: .zero)
            }
        }
        
        try? FileManager.default.createDirectory(at: Self.videosDirectory, withIntermediateDirectories: true, attributes: nil)
        try? FileManager.default.removeItem(at: outputURL)
        
        // Cách 1: Ưu tiên Passthrough muxing (nhanh như chớp ~0.3s, không tốn pin)
        var passthroughSuccess = false
        if let passSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) {
            passSession.outputURL = outputURL
            passSession.outputFileType = .mp4
            passSession.shouldOptimizeForNetworkUse = true
            await passSession.export()
            if passSession.status == .completed {
                passthroughSuccess = true
            }
        }
        
        // Cách 2: Nếu passthrough không hỗ trợ chunk DASH, dùng AVAssetExportPresetHighestQuality
        if !passthroughSuccess {
            try? FileManager.default.removeItem(at: outputURL)
            guard let encodeSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
                throw NSError(domain: "AetherMux", code: -3, userInfo: [NSLocalizedDescriptionKey: "Không thể tạo bộ xuất video"])
            }
            encodeSession.outputURL = outputURL
            encodeSession.outputFileType = .mp4
            encodeSession.shouldOptimizeForNetworkUse = true
            await encodeSession.export()
            
            if encodeSession.status != .completed {
                throw encodeSession.error ?? NSError(domain: "AetherMux", code: -4, userInfo: [NSLocalizedDescriptionKey: "Lỗi xuất file ghép MP4"])
            }
        }
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
    
    private func formatBytes(_ bytes: Int64) -> String {
        guard bytes > 0 else { return "0 MB" }
        let mb = Double(bytes) / (1024 * 1024)
        if mb >= 1000 {
            return String(format: "%.1f GB", mb / 1024)
        }
        return String(format: "%.1f MB", mb)
    }
}
