import Foundation

/// Mô tả một InnerTube client dùng để lấy direct stream URL
struct InnerTubeClient {
    let name: String            // clientName gửi lên InnerTube (IOS, ANDROID_VR...)
    let version: String
    let clientId: String        // X-YouTube-Client-Name
    let userAgent: String       // PHẢI dùng lại đúng UA này khi tải stream do client này sinh ra
    let context: [String: Any]  // phần "client" trong context của payload

    /// Client mà link https trực tiếp cần GVS PO Token (sẽ 403) -> chỉ dùng HLS của client đó
    var hlsOnly: Bool { name == "IOS" || name == "WEB" }

    /// ANDROID_VR: hiện KHÔNG yêu cầu GVS PO Token nên là lựa chọn ưu tiên
    static let androidVR: InnerTubeClient = {
        let version = "1.61.48"
        let ua = "com.google.android.apps.youtube.vr.oculus/\(version) (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
        return InnerTubeClient(
            name: "ANDROID_VR",
            version: version,
            clientId: "28",
            userAgent: ua,
            context: [
                "clientName": "ANDROID_VR",
                "clientVersion": version,
                "deviceMake": "Oculus",
                "deviceModel": "Quest 3",
                "osName": "Android",
                "osVersion": "12L",
                "androidSdkVersion": 32,
                "userAgent": ua
            ]
        )
    }()

    /// IOS: yêu cầu GVS PO Token -> URL dễ bị 403 giữa chừng, chỉ dùng làm dự phòng
    static let ios: InnerTubeClient = {
        let version = "20.10.4"
        let ua = "com.google.ios.youtube/\(version) (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)"
        return InnerTubeClient(
            name: "IOS",
            version: version,
            clientId: "5",
            userAgent: ua,
            context: [
                "clientName": "IOS",
                "clientVersion": version,
                "deviceMake": "Apple",
                "deviceModel": "iPhone16,2",
                "userAgent": ua,
                "osName": "iPhone",
                "osVersion": "17.5.1.21F90"
            ]
        )
    }()

    /// WEB_SAFARI (yt-dlp): UA Safari desktop -> InnerTube trả hlsManifestUrl (m3u8).
    /// Theo PO Token Guide của yt-dlp, HLS của client này hiện KHÔNG cần GVS PO Token.
    /// Lưu ý: version dạng ngày, cần cập nhật theo yt-dlp nếu YouTube từ chối.
    static let webSafari: InnerTubeClient = {
        let version = "2.20250925.01.00"
        let ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15"
        return InnerTubeClient(
            name: "WEB",
            version: version,
            clientId: "1",
            userAgent: ua,
            context: [
                "clientName": "WEB",
                "clientVersion": version,
                "userAgent": ua,
                "osName": "Macintosh",
                "osVersion": "10_15_7",
                "platform": "DESKTOP",
                "hl": "en",
                "gl": "US"
            ]
        )
    }()

    /// Thứ tự thử: ANDROID_VR (link trực tiếp) -> WEB_SAFARI (HLS) -> IOS (dự phòng, dễ 403 sau ~10MB)
    static let all: [InnerTubeClient] = [.androidVR, .webSafari, .ios]
}

/// Ghi lại họ địa chỉ IP (v4/v6) mà một request thực sự dùng.
/// URL googlevideo bị KHÓA theo IP của request "player"; nếu request tải đi bằng họ IP khác -> 403 ngay byte đầu.
final class NetworkProbe: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private static let lock = NSLock()
    private static var _lastResolve = "?"
    /// Thông tin mạng của lần gọi "player" gần nhất
    static var lastResolve: String {
        lock.lock(); defer { lock.unlock() }
        return _lastResolve
    }
    static func setLastResolve(_ value: String) {
        lock.lock(); _lastResolve = value; lock.unlock()
    }

    private let lock = NSLock()
    private var _info = "?"
    /// Thông tin mạng của request vừa hoàn tất, dạng "local:v4 remote:v6"
    var info: String {
        lock.lock(); defer { lock.unlock() }
        return _info
    }

    static func family(_ address: String?) -> String {
        guard let address else { return "?" }
        return address.contains(":") ? "v6" : "v4"
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didFinishCollecting metrics: URLSessionTaskMetrics) {
        guard let t = metrics.transactionMetrics.last else { return }
        let text = "local:\(Self.family(t.localAddress)) remote:\(Self.family(t.remoteAddress))"
        lock.lock(); _info = text; lock.unlock()
    }
}

/// Ghi lại lý do mỗi InnerTube client thất bại/thành công (hiển thị kèm lỗi để dễ chẩn đoán)
enum ResolveLog {
    private static let lock = NSLock()
    private static var entries: [String] = []
    static var last: String {
        lock.lock(); defer { lock.unlock() }
        return entries.isEmpty ? "chưa thử" : entries.joined(separator: ";")
    }
    static func reset() { lock.lock(); entries = []; lock.unlock() }
    static func add(_ value: String) { lock.lock(); entries.append(value); lock.unlock() }
}

/// visitorData của phiên YouTube đang chạy trong WKWebView. yt-dlp luôn gửi kèm giá trị này;
/// thiếu nó, các request InnerTube ẩn danh dễ bị trả LOGIN_REQUIRED / UNPLAYABLE.
enum YouTubeSession {
    private static let lock = NSLock()
    private static var _visitorData: String?
    static var visitorData: String? {
        lock.lock(); defer { lock.unlock() }
        return _visitorData
    }
    static func setVisitorData(_ value: String) {
        lock.lock(); _visitorData = value; lock.unlock()
    }
}

struct YouTubeStreamResolver {
    /// Trích xuất stream trực tiếp (>= 720p). Thử lần lượt từng client, bỏ qua các client trong `excluding`
    /// (dùng khi một client đã bị 403 lúc tải và cần đổi sang client khác).
    static func resolve(videoId: String, excluding: Set<String> = []) async -> VideoDownloadInfo? {
        ResolveLog.reset()
        for client in InnerTubeClient.all where !excluding.contains(client.name) {
            if let info = await resolve(videoId: videoId, client: client) {
                return info
            }
        }
        return nil
    }

    /// Lấy lại URL mới cho đúng 1 client (URL cũ có thể đã bị khóa vào họ IP sai)
    static func resolve(videoId: String, clientName: String) async -> VideoDownloadInfo? {
        guard let client = InnerTubeClient.all.first(where: { $0.name == clientName }) else { return nil }
        return await resolve(videoId: videoId, client: client)
    }

    private static func resolve(videoId: String, client: InnerTubeClient) async -> VideoDownloadInfo? {
        guard let url = URL(string: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(client.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue(client.clientId, forHTTPHeaderField: "X-YouTube-Client-Name")
        request.setValue(client.version, forHTTPHeaderField: "X-YouTube-Client-Version")
        // Gắn visitorData của phiên WebView (nếu có) vào cả header lẫn context
        var clientContext = client.context
        if let visitorData = YouTubeSession.visitorData {
            request.setValue(visitorData, forHTTPHeaderField: "X-Goog-Visitor-Id")
            clientContext["visitorData"] = visitorData
        }
        if client.name == "WEB" {
            request.setValue("https://www.youtube.com", forHTTPHeaderField: "Origin")
        }

        let payload: [String: Any] = [
            "videoId": videoId,
            "contentCheckOk": true,
            "racyCheckOk": true,
            "context": ["client": clientContext]
        ]
        guard let bodyData = try? JSONSerialization.data(withJSONObject: payload) else { return nil }
        request.httpBody = bodyData

        do {
            let probe = NetworkProbe()
            let (data, response) = try await URLSession.shared.data(for: request, delegate: probe)
            NetworkProbe.setLastResolve(probe.info)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                ResolveLog.add("\(client.name):http=\((response as? HTTPURLResponse)?.statusCode ?? 0)")
                return nil
            }

            let playability = json["playabilityStatus"] as? [String: Any]
            let playStatus = playability?["status"] as? String ?? "?"
            guard playStatus == "OK" else {
                // Kèm lý do YouTube trả về (cắt ngắn) để biết là bot-check, giới hạn vùng, hay yêu cầu đăng nhập
                let reason = (playability?["reason"] as? String).map { String($0.prefix(60)) } ?? ""
                ResolveLog.add("\(client.name):ps=\(playStatus)[\(reason)]vd=\(YouTubeSession.visitorData == nil ? "no" : "yes")")
                return nil
            }

            let videoDetails = json["videoDetails"] as? [String: Any] ?? [:]
            let title = videoDetails["title"] as? String ?? "Video"
            let author = videoDetails["author"] as? String ?? "YouTube"
            let duration = Double(videoDetails["lengthSeconds"] as? String ?? "0") ?? 0.0
            let thumbnailURL = "https://i.ytimg.com/vi/\(videoId)/hqdefault.jpg"

            let streamingData = json["streamingData"] as? [String: Any] ?? [:]
            let adaptiveFormats = streamingData["adaptiveFormats"] as? [[String: Any]] ?? []
            let progressiveFormats = streamingData["formats"] as? [[String: Any]] ?? []

            // 1. Audio AAC (mp4a) bitrate cao nhất
            var bestAudioURL: String? = nil
            var highestAudioBitrate = 0
            for item in adaptiveFormats {
                guard let mimeType = item["mimeType"] as? String,
                      mimeType.hasPrefix("audio/"),
                      mimeType.contains("mp4a"),
                      let urlStr = item["url"] as? String else { continue }
                let bitrate = item["bitrate"] as? Int ?? 0
                if bestAudioURL == nil || bitrate > highestAudioBitrate {
                    bestAudioURL = urlStr
                    highestAudioBitrate = bitrate
                }
            }

            var options: [(height: Int, option: StreamOption)] = []
            var seenHeights = Set<Int>()

            // 2. Progressive (đã có sẵn audio) >= 720p
            for item in progressiveFormats {
                guard let urlStr = item["url"] as? String else { continue }
                let height = item["height"] as? Int ?? 0
                guard height >= 720, !seenHeights.contains(height) else { continue }
                seenHeights.insert(height)

                let label = item["qualityLabel"] as? String ?? "\(height)p HD"
                options.append((height, StreamOption(
                    quality: "\(label) (Trực tiếp)",
                    url: urlStr,
                    audioURL: nil,
                    mimeType: item["mimeType"] as? String,
                    userAgent: client.userAgent,
                    clientName: client.name
                )))
            }

            // 3. Adaptive H.264 (avc1) >= 720p, ghép với audio bằng AVFoundation
            for item in adaptiveFormats {
                guard let mimeType = item["mimeType"] as? String,
                      mimeType.hasPrefix("video/"),
                      mimeType.contains("avc1"),
                      let urlStr = item["url"] as? String,
                      bestAudioURL != nil else { continue }

                let height = item["height"] as? Int ?? 0
                guard height >= 720, !seenHeights.contains(height) else { continue }
                seenHeights.insert(height)

                let label: String
                switch height {
                case 2160...: label = "2160p (4K Ultra HD)"
                case 1440...: label = "1440p (2K QHD)"
                case 1080...: label = "1080p Full HD"
                default:      label = "720p HD"
                }

                options.append((height, StreamOption(
                    quality: label,
                    url: urlStr,
                    audioURL: bestAudioURL,
                    mimeType: mimeType,
                    userAgent: client.userAgent,
                    clientName: client.name
                )))
            }

            // 4. HLS: không cần GVS PO Token. Client IOS có link trực tiếp luôn bị 403 -> thay bằng HLS;
            //    client khác chỉ dùng HLS khi không có link trực tiếp nào.
            if client.hlsOnly || options.isEmpty,
               let hlsString = streamingData["hlsManifestUrl"] as? String,
               let hlsURL = URL(string: hlsString) {
                do {
                    let variants = try await HLSParser.variants(masterURL: hlsURL, userAgent: client.userAgent)
                    let hd = variants.filter { $0.height >= 720 }
                    let hlsOptions: [(height: Int, option: StreamOption)] = (hd.isEmpty ? variants : hd).map { v in
                        let label: String
                        switch v.height {
                        case 2160...: label = "2160p (4K Ultra HD)"
                        case 1440...: label = "1440p (2K QHD)"
                        case 1080...: label = "1080p Full HD"
                        case 720...:  label = "720p HD"
                        default:      label = "\(v.height)p"
                        }
                        return (v.height, StreamOption(
                            quality: label,
                            url: v.playlistURL.absoluteString,
                            audioURL: v.audioPlaylistURL?.absoluteString,
                            mimeType: "application/vnd.apple.mpegurl",
                            userAgent: client.userAgent,
                            clientName: client.name,
                            isHLS: true
                        ))
                    }
                    if !hlsOptions.isEmpty {
                        ResolveLog.add("\(client.name):hls=\(hlsOptions.count)")
                        // IOS/WEB: bỏ link trực tiếp vì cần PO Token (sẽ 403)
                        options = client.hlsOnly ? hlsOptions : options + hlsOptions
                    }
                } catch {
                    ResolveLog.add("\(client.name):hlsErr=\(error.localizedDescription)")
                }
            } else if client.hlsOnly {
                ResolveLog.add("\(client.name):noHlsManifest")
            }

            guard !options.isEmpty else {
                ResolveLog.add("\(client.name):noStream(adaptive=\(adaptiveFormats.count),prog=\(progressiveFormats.count))")
                return nil
            }

            // Độ phân giải cao nhất lên đầu (sort theo height thật, không parse từ label)
            options.sort { $0.height > $1.height }

            return VideoDownloadInfo(
                id: videoId,
                title: title,
                author: author,
                duration: duration,
                thumbnailURL: thumbnailURL,
                streams: options.map(\.option)
            )
        } catch {
            ResolveLog.add("\(client.name):err=\(error.localizedDescription)")
            return nil
        }
    }
}