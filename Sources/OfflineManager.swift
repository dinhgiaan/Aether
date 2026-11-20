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
        thumbnailURLString: String?,
        userAgent: String? = nil,
        clientName: String? = nil,
        triedClients: Set<String> = []
    ) {
        guard let videoStreamURL = URL(string: streamURLString) else { return }
        let ua = userAgent ?? InnerTubeClient.ios.userAgent
        var tried = triedClients
        if let clientName { tried.insert(clientName) }

        // Khi bị 403: đổi sang InnerTube client khác (nếu còn) rồi tải lại đúng chất lượng đã chọn
        let onFailure: (Error) -> Void = { [weak self] error in
            guard let self else { return }
            let ns = error as NSError
            let isForbidden = (ns.userInfo["httpStatus"] as? Int) == 403
            let remaining = InnerTubeClient.all.filter { !tried.contains($0.name) }
            guard isForbidden, !remaining.isEmpty else {
                self.failDownload(videoId: videoId, message: "Lỗi tải video: \(error.localizedDescription)")
                return
            }
            self.activeDownloadStatus[videoId] = "Đang thử nguồn khác..."
            Task { @MainActor in
                let targetHeight = Int(quality.prefix(while: \.isNumber)) ?? 0
                guard let info = await YouTubeStreamResolver.resolve(videoId: videoId, excluding: tried),
                      // chọn stream có độ phân giải gần nhất (không vượt quá) mức đã chọn
                      let alt = info.streams.first(where: { (Int($0.quality.prefix(while: \.isNumber)) ?? 0) <= targetHeight })
                              ?? info.streams.last else {
                    self.failDownload(videoId: videoId, message: "Lỗi tải video: \(error.localizedDescription)")
                    return
                }
                self.startDownload(
                    videoId: videoId, title: title, author: author, quality: alt.quality,
                    duration: duration, streamURLString: alt.url, audioURLString: alt.audioURL,
                    thumbnailURLString: thumbnailURLString,
                    userAgent: alt.userAgent, clientName: alt.clientName, triedClients: tried
                )
            }
        }
        
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
                thumbFileName: thumbFileName,
                userAgent: ua,
                onFailure: onFailure
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
                thumbFileName: thumbFileName,
                userAgent: ua,
                onFailure: onFailure
            )
        }
    }
    
    // MARK: – Tải stream với nhiều chế độ Range (tự leo thang khi bị 403)
    private enum RangeMode: String {
        case header   // Range: bytes=a-b (chunk 10MB)
        case query    // &range=a-b trên URL (cách yt-dlp dùng cho googlevideo)
        case stream   // 1 request mở "bytes=a-" đọc liên tục, ít request nhất
    }

    private nonisolated static func httpError(_ status: Int, detail: String = "") -> NSError {
        NSError(domain: "AetherDownload", code: -2, userInfo: [
            NSLocalizedDescriptionKey: "Máy chủ từ chối kết nối (HTTP \(status))\(detail)",
            "httpStatus": status // dùng để quyết định có đổi client hay không
        ])
    }

    /// Tải 1 đoạn [start, end] bằng header Range hoặc tham số query `range`
    private nonisolated static func fetchRange(
        session: URLSession, url: URL, userAgent: String,
        start: Int64, end: Int64, mode: RangeMode
    ) async throws -> (Data, HTTPURLResponse) {
        var req: URLRequest
        if mode == .query, var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            var items = (comps.queryItems ?? []).filter { $0.name != "range" }
            items.append(URLQueryItem(name: "range", value: "\(start)-\(end)"))
            comps.queryItems = items
            req = URLRequest(url: comps.url ?? url)
        } else {
            req = URLRequest(url: url)
            req.setValue("bytes=\(start)-\(end)", forHTTPHeaderField: "Range")
        }
        // UA PHẢI khớp với client InnerTube đã sinh ra URL
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw httpError(0) }
        guard http.statusCode == 206 || (http.statusCode == 200 && start == 0) else {
            throw httpError(http.statusCode)
        }
        return (data, http)
    }

    /// Lấy tổng dung lượng từ Content-Range / Content-Length
    private nonisolated static func totalLength(from http: HTTPURLResponse, start: Int64) -> Int64 {
        if let cr = http.value(forHTTPHeaderField: "Content-Range"),
           let totalStr = cr.components(separatedBy: "/").last, let total = Int64(totalStr) {
            return total
        }
        if let ls = http.value(forHTTPHeaderField: "Content-Length"), let len = Int64(ls) {
            return start + len
        }
        return 0
    }

    private nonisolated func downloadStreamChunked(
        streamURL: URL,
        fileExtension: String,
        userAgent: String,
        label: String,   // "video" hoặc "audio" – chỉ để hiển thị lỗi dễ chẩn đoán
        onProgress: @escaping @Sendable (Double, Int64, Int64) -> Void
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

        let chunkSize: Int64 = 10 * 1024 * 1024 // 10MB như yt-dlp: ít request hơn 10 lần so với 1MB
        var startByte: Int64 = 0
        let session = URLSession(configuration: .default)
        defer { session.finishTasksAndInvalidate() }

        let modes: [RangeMode] = [.header, .query, .stream]
        var modeIndex = 0
        var attempt = 0
        var finished = false

        do {
            while !finished && (clen == 0 || startByte < clen) {
                try Task.checkCancellation()
                let mode = modes[modeIndex]
                do {
                    switch mode {
                    case .header, .query:
                        let endByte = (clen > 0) ? min(startByte + chunkSize - 1, clen - 1) : (startByte + chunkSize - 1)
                        let (data, http) = try await Self.fetchRange(
                            session: session, url: streamURL, userAgent: userAgent,
                            start: startByte, end: endByte, mode: mode
                        )
                        if clen == 0 { clen = Self.totalLength(from: http, start: startByte) }
                        if data.isEmpty { finished = true; break }
                        try fileHandle.write(contentsOf: data)
                        startByte += Int64(data.count)
                        onProgress(clen > 0 ? min(1.0, Double(startByte) / Double(clen)) : 0.5, startByte, clen)

                    case .stream:
                        var req = URLRequest(url: streamURL)
                        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
                        req.setValue("bytes=\(startByte)-", forHTTPHeaderField: "Range")
                        let (bytes, response) = try await session.bytes(for: req)
                        guard let http = response as? HTTPURLResponse,
                              http.statusCode == 206 || (http.statusCode == 200 && startByte == 0) else {
                            throw Self.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
                        }
                        if clen == 0 { clen = Self.totalLength(from: http, start: startByte) }
                        let before = startByte
                        var buffer = Data()
                        buffer.reserveCapacity(256 * 1024)
                        for try await byte in bytes {
                            buffer.append(byte)
                            if buffer.count >= 256 * 1024 {
                                try fileHandle.write(contentsOf: buffer)
                                startByte += Int64(buffer.count)
                                buffer.removeAll(keepingCapacity: true)
                                onProgress(clen > 0 ? min(1.0, Double(startByte) / Double(clen)) : 0.5, startByte, clen)
                            }
                        }
                        if !buffer.isEmpty {
                            try fileHandle.write(contentsOf: buffer)
                            startByte += Int64(buffer.count)
                            onProgress(clen > 0 ? min(1.0, Double(startByte) / Double(clen)) : 0.5, startByte, clen)
                        }
                        // Kết nối đóng mà không nhận thêm byte nào -> coi như bị chặn
                        if startByte == before { throw Self.httpError(0) }
                    }
                    attempt = 0
                } catch let error as NSError where error.domain == "AetherDownload" && error.code == -2 {
                    let status = error.userInfo["httpStatus"] as? Int ?? 0
                    guard status == 0 || status == 403 || status >= 500 else { throw error }
                    // 1) thử lại cùng chế độ 1 lần  2) leo thang sang chế độ Range khác (giữ nguyên phần đã tải)
                    if attempt < 1 {
                        attempt += 1
                        try await Task.sleep(nanoseconds: 800_000_000)
                        continue
                    }
                    attempt = 0
                    if modeIndex < modes.count - 1 {
                        NSLog("Aether %@: HTTP %d ở %lld bytes (chế độ %@) -> đổi chế độ", label, status, startByte, mode.rawValue)
                        modeIndex += 1
                        continue
                    }
                    // Hết cách: báo kèm vị trí để chẩn đoán
                    throw Self.httpError(status, detail: " [\(label) @ \(Self.formatBytes(startByte)) / \(Self.formatBytes(clen))]")
                } catch let error as URLError where error.code != .cancelled {
                    // Lỗi mạng tạm thời: thử lại tối đa 2 lần
                    if attempt >= 2 { throw error }
                    attempt += 1
                    try await Task.sleep(nanoseconds: UInt64(attempt) * 800_000_000)
                }
            }
        } catch {
            // Dọn file đệm khi lỗi (fileHandle được đóng bởi defer phía trên)
            try? FileManager.default.removeItem(at: destTempURL)
            throw error
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
        thumbFileName: String?,
        userAgent: String,
        onFailure: @escaping (Error) -> Void
    ) {
        Task {
            do {
                let safeTemp = try await self.downloadStreamChunked(streamURL: videoURL, fileExtension: "mp4", userAgent: userAgent, label: "video") { [weak self] progress, written, expected in
                    Task { @MainActor in
                        guard let self = self else { return }
                        self.activeDownloadProgress[videoId] = progress
                        let writtenStr = Self.formatBytes(written)
                        let totalStr = expected > 0 ? Self.formatBytes(expected) : "..."
                        self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(progress * 100))%)"
                    }
                }
                
                try? FileManager.default.createDirectory(at: Self.videosDirectory, withIntermediateDirectories: true, attributes: nil)
                try? FileManager.default.removeItem(at: destURL)
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
                NSLog("Aether single download error: %@", error.localizedDescription)
                try? FileManager.default.removeItem(at: destURL)
                onFailure(error)
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
        thumbFileName: String?,
        userAgent: String,
        onFailure: @escaping (Error) -> Void
    ) {
        Task {
            var vProgress: Double = 0.0
            var aProgress: Double = 0.0
            var vWritten: Int64 = 0
            var vTotal: Int64 = 0
            var aWritten: Int64 = 0
            var aTotal: Int64 = 0
            
            let updateProgress: @Sendable () -> Void = { [weak self] in
                Task { @MainActor in
                    guard let self = self else { return }
                    let combined = (vProgress * 0.88) + (aProgress * 0.12)
                    let writtenTotal = vWritten + aWritten
                    let totalTotal = vTotal + aTotal
                    let writtenStr = Self.formatBytes(writtenTotal)
                    let totalStr = totalTotal > 0 ? Self.formatBytes(totalTotal) : "..."
                    self.activeDownloadProgress[videoId] = max(0.02, min(0.94, combined))
                    self.activeDownloadStatus[videoId] = "\(writtenStr) / \(totalStr) (\(Int(combined * 100))%)"
                }
            }
            
            do {
                async let vTask = self.downloadStreamChunked(streamURL: videoURL, fileExtension: "mp4", userAgent: userAgent, label: "video") { p, w, t in
                    vProgress = p; vWritten = w; vTotal = t; updateProgress()
                }
                async let aTask = self.downloadStreamChunked(streamURL: audioURL, fileExtension: "m4a", userAgent: userAgent, label: "audio") { p, w, t in
                    aProgress = p; aWritten = w; aTotal = t; updateProgress()
                }
                
                let (vTemp, aTemp) = try await (vTask, aTask)
                
                self.activeDownloadProgress[videoId] = 0.95
                self.activeDownloadStatus[videoId] = "Đang ghép nối & lưu video..."
                
                try await self.muxVideoAndAudio(videoURL: vTemp, audioURL: aTemp, outputURL: destURL)
                try? FileManager.default.removeItem(at: vTemp)
                try? FileManager.default.removeItem(at: aTemp)
                
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
                NSLog("Aether dual download error: %@", error.localizedDescription)
                try? FileManager.default.removeItem(at: destURL)
                onFailure(error)
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
    private nonisolated func muxVideoAndAudio(videoURL: URL, audioURL: URL, outputURL: URL) async throws {
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
    
    nonisolated static func formatBytes(_ bytes: Int64) -> String {
        guard bytes > 0 else { return "0 MB" }
        let mb = Double(bytes) / (1024 * 1024)
        if mb >= 1000 {
            return String(format: "%.1f GB", mb / 1024)
        }
        return String(format: "%.1f MB", mb)
    }
}
