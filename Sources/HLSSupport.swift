import Foundation

/// Lưu lý do không dùng được HLS ở lần thử gần nhất (hiển thị kèm lỗi để dễ chẩn đoán)
enum HLSDiagnostics {
    private static let lock = NSLock()
    private static var _last = "chưa thử"
    static var last: String {
        lock.lock(); defer { lock.unlock() }
        return _last
    }
    static func set(_ value: String) {
        lock.lock(); _last = value; lock.unlock()
    }
}

/// Một mức chất lượng trong master playlist HLS
struct HLSVariant {
    let height: Int
    let bandwidth: Int
    let codecs: String
    let playlistURL: URL          // media playlist của luồng hình
    let audioPlaylistURL: URL?    // nil nếu âm thanh đã ghép sẵn trong luồng hình
}

/// Kế hoạch tải một media playlist: danh sách file cần tải + nội dung playlist cục bộ
struct HLSPlan {
    struct Item {
        let remote: URL
        let localName: String
    }
    let items: [Item]
    let localPlaylist: String
}

enum HLSParser {
    /// Tải nội dung text của playlist. Mặc định dùng UA Safari; link HLS lấy từ InnerTube phải dùng đúng UA của client đó
    static func fetchText(_ url: URL, userAgent: String = Config.userAgent) async throws -> String {
        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200, let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "AetherHLS", code: -2, userInfo: [
                NSLocalizedDescriptionKey: "Không tải được playlist HLS (HTTP \(status))",
                "httpStatus": status
            ])
        }
        return text
    }

    /// Tách thuộc tính dạng KEY=VALUE,KEY="VALUE, CÓ DẤU PHẨY"
    static func parseAttributes(_ source: String) -> [String: String] {
        var result: [String: String] = [:]
        var key = ""
        var value = ""
        var readingKey = true
        var inQuotes = false

        func flush() {
            let k = key.trimmingCharacters(in: .whitespaces)
            if !k.isEmpty { result[k] = value }
            key = ""
            value = ""
            readingKey = true
        }

        for ch in source {
            if readingKey {
                if ch == "=" { readingKey = false } else { key.append(ch) }
            } else if ch == "\"" {
                inQuotes.toggle()
            } else if ch == "," && !inQuotes {
                flush()
            } else {
                value.append(ch)
            }
        }
        flush()
        return result
    }

    /// Đọc master playlist, trả về các mức chất lượng H.264 (mỗi độ phân giải giữ bitrate cao nhất)
    static func variants(masterURL: URL, userAgent: String = Config.userAgent) async throws -> [HLSVariant] {
        let text = try await fetchText(masterURL, userAgent: userAgent)
        let lines = text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }

        // Nhóm âm thanh: GROUP-ID -> URL playlist (ưu tiên DEFAULT=YES)
        var audioGroups: [String: URL] = [:]
        for line in lines where line.hasPrefix("#EXT-X-MEDIA:") {
            let attrs = parseAttributes(String(line.dropFirst("#EXT-X-MEDIA:".count)))
            guard attrs["TYPE"] == "AUDIO",
                  let groupId = attrs["GROUP-ID"],
                  let uri = attrs["URI"],
                  let url = URL(string: uri, relativeTo: masterURL)?.absoluteURL else { continue }
            if audioGroups[groupId] == nil || attrs["DEFAULT"] == "YES" {
                audioGroups[groupId] = url
            }
        }

        var all: [HLSVariant] = []
        var i = 0
        while i < lines.count {
            let line = lines[i]
            if line.hasPrefix("#EXT-X-STREAM-INF:") {
                let attrs = parseAttributes(String(line.dropFirst("#EXT-X-STREAM-INF:".count)))
                // Dòng URI nằm sau dòng STREAM-INF (bỏ qua dòng trống/comment)
                var j = i + 1
                while j < lines.count, lines[j].isEmpty || lines[j].hasPrefix("#") { j += 1 }
                if j < lines.count, let url = URL(string: lines[j], relativeTo: masterURL)?.absoluteURL {
                    let resolution = attrs["RESOLUTION"] ?? ""
                    let height = Int(resolution.split(separator: "x").last.map(String.init) ?? "") ?? 0
                    all.append(HLSVariant(
                        height: height,
                        bandwidth: Int(attrs["BANDWIDTH"] ?? "") ?? 0,
                        codecs: attrs["CODECS"] ?? "",
                        playlistURL: url,
                        audioPlaylistURL: attrs["AUDIO"].flatMap { audioGroups[$0] }
                    ))
                }
                i = j
            }
            i += 1
        }

        // Chỉ lấy H.264 để iOS phát offline ổn định (nếu không có thì lấy tất cả)
        let h264 = all.filter { $0.codecs.isEmpty || $0.codecs.contains("avc1") }
        let pool = h264.isEmpty ? all : h264

        var bestByHeight: [Int: HLSVariant] = [:]
        for v in pool where v.height > 0 {
            if let existing = bestByHeight[v.height], existing.bandwidth >= v.bandwidth { continue }
            bestByHeight[v.height] = v
        }
        return bestByHeight.values.sorted { $0.height > $1.height }
    }
}

enum HLSDownloader {
    struct Job {
        let remote: URL
        let local: URL
    }

    /// Phân tích media playlist: liệt kê segment cần tải và sinh playlist cục bộ (đường dẫn tương đối)
    static func plan(playlistURL: URL, userAgent: String = Config.userAgent) async throws -> HLSPlan {
        let text = try await HLSParser.fetchText(playlistURL, userAgent: userAgent)
        let lines = text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }

        let usesFMP4 = lines.contains { $0.hasPrefix("#EXT-X-MAP:") }
        var items: [HLSPlan.Item] = []
        var output: [String] = []
        var segmentIndex = 0
        var hasEndList = false

        for line in lines where !line.isEmpty {
            if line.hasPrefix("#EXT-X-BYTERANGE") {
                throw unsupported("Playlist HLS dùng byte-range, chưa được hỗ trợ")
            }
            if line.hasPrefix("#EXT-X-KEY:") {
                let attrs = HLSParser.parseAttributes(String(line.dropFirst("#EXT-X-KEY:".count)))
                if let method = attrs["METHOD"], method != "NONE" {
                    throw unsupported("Playlist HLS được mã hóa (\(method)), chưa được hỗ trợ")
                }
                continue
            }
            if line.hasPrefix("#EXT-X-MAP:") {
                let attrs = HLSParser.parseAttributes(String(line.dropFirst("#EXT-X-MAP:".count)))
                guard attrs["BYTERANGE"] == nil else {
                    throw unsupported("Init segment dùng byte-range, chưa được hỗ trợ")
                }
                guard let uri = attrs["URI"], let url = URL(string: uri, relativeTo: playlistURL)?.absoluteURL else {
                    throw unsupported("Thiếu URI của init segment")
                }
                items.append(HLSPlan.Item(remote: url, localName: "init.mp4"))
                output.append("#EXT-X-MAP:URI=\"init.mp4\"")
                continue
            }
            if line.hasPrefix("#") {
                if line.hasPrefix("#EXT-X-ENDLIST") { hasEndList = true }
                output.append(line)
                continue
            }
            // Dòng không bắt đầu bằng # là URI của một segment
            guard let url = URL(string: line, relativeTo: playlistURL)?.absoluteURL else {
                throw unsupported("URI segment không hợp lệ")
            }
            let ext = usesFMP4 ? "m4s" : "ts"
            let name = String(format: "seg_%05d.%@", segmentIndex, ext)
            segmentIndex += 1
            items.append(HLSPlan.Item(remote: url, localName: name))
            output.append(name)
        }

        guard segmentIndex > 0 else { throw unsupported("Playlist HLS không có segment nào") }
        // Playlist VOD phải kết thúc bằng ENDLIST để AVPlayer biết tổng thời lượng
        if !hasEndList { output.append("#EXT-X-ENDLIST") }
        return HLSPlan(items: items, localPlaylist: output.joined(separator: "\n") + "\n")
    }

    /// Tải song song tối đa `maxConcurrent` file, báo tiến trình (đã xong, tổng)
    static func download(
        jobs: [Job],
        maxConcurrent: Int = 4,
        userAgent: String = Config.userAgent,
        onProgress: @escaping @Sendable (Int, Int) -> Void
    ) async throws {
        let total = jobs.count
        guard total > 0 else { return }
        var done = 0

        try await withThrowingTaskGroup(of: Void.self) { group in
            var nextIndex = 0
            while nextIndex < min(maxConcurrent, total) {
                let job = jobs[nextIndex]
                group.addTask { try await fetch(job, userAgent: userAgent) }
                nextIndex += 1
            }
            while try await group.next() != nil {
                done += 1
                onProgress(done, total)
                if nextIndex < total {
                    let job = jobs[nextIndex]
                    group.addTask { try await fetch(job, userAgent: userAgent) }
                    nextIndex += 1
                }
            }
        }
    }

    /// Tải 1 segment, thử lại tối đa 3 lần
    private static func fetch(_ job: Job, userAgent: String) async throws {
        var lastError: Error = unsupported("Không tải được segment")
        for attempt in 0..<3 {
            try Task.checkCancellation()
            do {
                var req = URLRequest(url: job.remote)
                req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
                let (tmp, response) = try await URLSession.shared.download(for: req)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                guard status == 200 || status == 206 else {
                    throw NSError(domain: "AetherHLS", code: -2, userInfo: [
                        NSLocalizedDescriptionKey: "Máy chủ từ chối segment (HTTP \(status))",
                        "httpStatus": status
                    ])
                }
                try? FileManager.default.removeItem(at: job.local)
                try FileManager.default.moveItem(at: tmp, to: job.local)
                return
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                lastError = error
                try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 500_000_000)
            }
        }
        throw lastError
    }

    private static func unsupported(_ message: String) -> NSError {
        NSError(domain: "AetherHLS", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}