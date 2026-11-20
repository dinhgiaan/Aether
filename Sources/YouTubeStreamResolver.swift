import Foundation

/// Mô tả một InnerTube client dùng để lấy direct stream URL
struct InnerTubeClient {
    let name: String            // clientName gửi lên InnerTube (IOS, ANDROID_VR...)
    let version: String
    let clientId: String        // X-YouTube-Client-Name
    let userAgent: String       // PHẢI dùng lại đúng UA này khi tải stream do client này sinh ra
    let context: [String: Any]  // phần "client" trong context của payload

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

    /// Thứ tự thử: ANDROID_VR trước, IOS sau
    static let all: [InnerTubeClient] = [.androidVR, .ios]
}

struct YouTubeStreamResolver {
    /// Trích xuất stream trực tiếp (>= 720p). Thử lần lượt từng client, bỏ qua các client trong `excluding`
    /// (dùng khi một client đã bị 403 lúc tải và cần đổi sang client khác).
    static func resolve(videoId: String, excluding: Set<String> = []) async -> VideoDownloadInfo? {
        for client in InnerTubeClient.all where !excluding.contains(client.name) {
            if let info = await resolve(videoId: videoId, client: client) {
                return info
            }
        }
        return nil
    }

    private static func resolve(videoId: String, client: InnerTubeClient) async -> VideoDownloadInfo? {
        guard let url = URL(string: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(client.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue(client.clientId, forHTTPHeaderField: "X-YouTube-Client-Name")
        request.setValue(client.version, forHTTPHeaderField: "X-YouTube-Client-Version")

        let payload: [String: Any] = [
            "videoId": videoId,
            "contentCheckOk": true,
            "racyCheckOk": true,
            "context": ["client": client.context]
        ]
        guard let bodyData = try? JSONSerialization.data(withJSONObject: payload) else { return nil }
        request.httpBody = bodyData

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return nil
            }

            let playability = json["playabilityStatus"] as? [String: Any]
            guard (playability?["status"] as? String) == "OK" else { return nil }

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

            guard !options.isEmpty else { return nil }

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
            return nil
        }
    }
}
