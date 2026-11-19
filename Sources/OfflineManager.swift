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
    
    // Quản lý các phiên tải có delegate cập nhật phần trăm thực tế
    private var activeSessions: [String: URLSession] = [:]
    private var downloadDelegates: [String: AnyObject] = [:]
    
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
    
    // MARK: – Tải đơn luồng với Delegate báo % chuẩn xác
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
        let delegate = SingleDownloadDelegate(
            onProgress: { [weak self] progress, written, expected in
                Task { @MainActor in
                    guard let self = self else { return }
                    self.activeDownloadProgress[videoId] = progress
                    let writtenStr = self.formatBytes(written)
                    let totalStr = expected > 0 ? self.formatBytes(expected) : "..."
                    self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(progress * 100))%)"
                }
            },
            onComplete: { [weak self] tempURL, error in
                Task { @MainActor in
                    guard let self = self else { return }
                    self.activeSessions.removeValue(forKey: videoId)
                    self.downloadDelegates.removeValue(forKey: videoId)
                    
                    if let safeTemp = tempURL, error == nil {
                        try? FileManager.default.createDirectory(at: Self.videosDirectory, withIntermediateDirectories: true, attributes: nil)
                        try? FileManager.default.removeItem(at: destURL)
                        do {
                            try FileManager.default.moveItem(at: safeTemp, to: destURL)
                            self.finishDownload(
                                videoId: videoId,
                                title: title,
                                author: author,
                                quality: quality,
                                duration: duration,
                                fileName: videoFileName,
                                thumbName: thumbFileName
                            )
                        } catch {
                            self.failDownload(videoId: videoId, message: "Lỗi lưu file: \(error.localizedDescription)")
                            try? FileManager.default.removeItem(at: safeTemp)
                        }
                    } else {
                        self.failDownload(videoId: videoId, message: error?.localizedDescription ?? "Lỗi tải file")
                    }
                }
            }
        )
        
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        activeSessions[videoId] = session
        downloadDelegates[videoId] = delegate
        
        var req = URLRequest(url: videoURL)
        req.setValue("com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", forHTTPHeaderField: "User-Agent")
        let task = session.downloadTask(with: req)
        task.resume()
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
        let tempVideoURL = Self.videosDirectory.appendingPathComponent("temp_v_\(videoId).mp4")
        let tempAudioURL = Self.videosDirectory.appendingPathComponent("temp_a_\(videoId).m4a")
        
        var vProgress: Double = 0.0
        var aProgress: Double = 0.0
        var vBytesWritten: Int64 = 0
        var vBytesExpected: Int64 = 0
        var aBytesWritten: Int64 = 0
        var aBytesExpected: Int64 = 0
        
        var vTempDownloaded: URL? = nil
        var aTempDownloaded: URL? = nil
        var downloadError: Error? = nil
        var completedCount = 0
        
        let updateCombinedProgress = { [weak self] in
            Task { @MainActor in
                guard let self = self else { return }
                let totalProgress = (vProgress * 0.88) + (aProgress * 0.12)
                self.activeDownloadProgress[videoId] = max(0.02, totalProgress)
                
                let writtenTotal = vBytesWritten + aBytesWritten
                let expectedTotal = vBytesExpected + aBytesExpected
                let writtenStr = self.formatBytes(writtenTotal)
                let totalStr = expectedTotal > 0 ? self.formatBytes(expectedTotal) : "..."
                self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(totalProgress * 100))%)"
            }
        }
        
        let checkFinished = { [weak self] in
            Task { @MainActor in
                guard let self = self else { return }
                guard completedCount == 2 else { return }
                
                self.activeSessions.removeValue(forKey: videoId + "_v")
                self.activeSessions.removeValue(forKey: videoId + "_a")
                self.downloadDelegates.removeValue(forKey: videoId + "_v")
                self.downloadDelegates.removeValue(forKey: videoId + "_a")
                
                if let err = downloadError {
                    self.failDownload(videoId: videoId, message: "Lỗi tải: \(err.localizedDescription)")
                    if let v = vTempDownloaded { try? FileManager.default.removeItem(at: v) }
                    if let a = aTempDownloaded { try? FileManager.default.removeItem(at: a) }
                    return
                }
                
                guard let vTemp = vTempDownloaded, let aTemp = aTempDownloaded else {
                    self.failDownload(videoId: videoId, message: "Không tìm thấy dữ liệu tải")
                    return
                }
                
                try? FileManager.default.createDirectory(at: Self.videosDirectory, withIntermediateDirectories: true, attributes: nil)
                self.activeDownloadStatus[videoId] = "Đang ghép nối & lưu video..."
                self.activeDownloadProgress[videoId] = 0.95
                
                // Ghép nối AVFoundation Passthrough native
                Task.detached(priority: .userInitiated) {
                    do {
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
                        // Fallback an toàn: nếu ghép tiếng gặp sự cố, vẫn lưu file video gốc để người dùng xem được 100%!
                        NSLog("Aether: Passthrough muxing issue: %@", error.localizedDescription)
                        try? FileManager.default.removeItem(at: destURL)
                        try? FileManager.default.copyItem(at: vTemp, to: destURL)
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
                    }
                }
            }
        }
        
        // Delegate cho luồng video
        let vDelegate = SingleDownloadDelegate(
            onProgress: { progress, written, expected in
                vProgress = progress
                vBytesWritten = written
                vBytesExpected = expected
                updateCombinedProgress()
            },
            onComplete: { tempURL, error in
                if let error = error { downloadError = error }
                vTempDownloaded = tempURL
                completedCount += 1
                checkFinished()
            }
        )
        
        // Delegate cho luồng audio
        let aDelegate = SingleDownloadDelegate(
            onProgress: { progress, written, expected in
                aProgress = progress
                aBytesWritten = written
                aBytesExpected = expected
                updateCombinedProgress()
            },
            onComplete: { tempURL, error in
                if let error = error { downloadError = error }
                aTempDownloaded = tempURL
                completedCount += 1
                checkFinished()
            }
        )
        
        let vSession = URLSession(configuration: .default, delegate: vDelegate, delegateQueue: nil)
        let aSession = URLSession(configuration: .default, delegate: aDelegate, delegateQueue: nil)
        
        activeSessions[videoId + "_v"] = vSession
        activeSessions[videoId + "_a"] = aSession
        downloadDelegates[videoId + "_v"] = vDelegate
        downloadDelegates[videoId + "_a"] = aDelegate
        
        var vReq = URLRequest(url: videoURL)
        vReq.setValue("com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", forHTTPHeaderField: "User-Agent")
        var aReq = URLRequest(url: audioURL)
        aReq.setValue("com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", forHTTPHeaderField: "User-Agent")
        
        vSession.downloadTask(with: vReq).resume()
        aSession.downloadTask(with: aReq).resume()
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
    
    // Ghép luồng hình và luồng tiếng native tốc độ cao (0.5s - 1s, không tốn pin)
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
        
        if let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) {
            try compVideoTrack.insertTimeRange(videoRange, of: videoTrack, at: .zero)
        }
        
        if let audioTrack = audioTracks.first {
            let aDuration = try await audioAsset.load(.duration)
            let minDuration = CMTimeMinimum(vDuration, aDuration)
            let audioRange = CMTimeRange(start: .zero, duration: minDuration)
            
            if let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
                try? compAudioTrack.insertTimeRange(audioRange, of: audioTrack, at: .zero)
            }
        }
        
        try? FileManager.default.removeItem(at: outputURL)
        
        var exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)
        if exportSession == nil || !exportSession!.supportedFileTypes.contains(.mp4) {
            exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality)
        }
        
        guard let session = exportSession else {
            try FileManager.default.copyItem(at: videoURL, to: outputURL)
            return
        }
        
        session.outputURL = outputURL
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        
        await session.export()
        
        if session.status != .completed {
            NSLog("Aether: Passthrough export failed (\(session.error?.localizedDescription ?? "")), copying video track directly")
            try? FileManager.default.removeItem(at: outputURL)
            try FileManager.default.copyItem(at: videoURL, to: outputURL)
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

// MARK: – URLSessionDownloadDelegate cho phép lắng nghe % tiến trình từng chunk
private final class SingleDownloadDelegate: NSObject, URLSessionDownloadDelegate {
    let onProgress: (Double, Int64, Int64) -> Void
    let onComplete: (URL?, Error?) -> Void
    
    init(onProgress: @escaping (Double, Int64, Int64) -> Void, onComplete: @escaping (URL?, Error?) -> Void) {
        self.onProgress = onProgress
        self.onComplete = onComplete
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let progress = totalBytesExpectedToWrite > 0 ? Double(totalBytesWritten) / Double(totalBytesExpectedToWrite) : 0
        onProgress(progress, totalBytesWritten, totalBytesExpectedToWrite)
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // Bắt buộc phải di chuyển file tạm ngay lập tức trước khi delegate này kết thúc,
        // nếu không hệ điều hành iOS sẽ tự động xoá file tại `location`!
        let safeTemp = FileManager.default.temporaryDirectory.appendingPathComponent("ae_dl_" + UUID().uuidString + ".tmp")
        do {
            try? FileManager.default.removeItem(at: safeTemp)
            try FileManager.default.moveItem(at: location, to: safeTemp)
            onComplete(safeTemp, nil)
        } catch {
            onComplete(nil, error)
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            onComplete(nil, error)
        }
    }
}
