import UIKit
import WebKit
import MediaPlayer

enum Config {
    static let home = URL(string: "https://m.youtube.com/")!
    // UA: OS token freeze theo chuẩn iOS 26+ (Apple freeze tại 18_6), Version khớp Safari iOS 26
    static let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1"
    // Allowlist domain: "google.com" đã bao gồm accounts.google.com, mail.google.com, v.v.
    static let allowedHostSuffixes = [
        "youtube.com", "youtu.be",
        "google.com",
        "googleapis.com",
        "googleusercontent.com",
        "gstatic.com",
    ]
}

struct StreamOption: Identifiable, Codable {
    var id: String { quality + "_" + (mimeType ?? "") }
    let quality: String
    let url: String
    let audioURL: String?
    let mimeType: String?
}

struct VideoDownloadInfo: Identifiable {
    let id: String
    let title: String
    let author: String
    let duration: Double
    let thumbnailURL: String?
    let streams: [StreamOption]
}

@MainActor
final class WebController: NSObject, ObservableObject {
    @Published var isWatching = false
    /// true từ lúc app mở đến khi trang YouTube đầu tiên load xong → ẩn splash
    @Published var isInitialLoading = true
    /// Thông tin download khi người dùng bấm Tải xuống video hiện tại
    @Published var activeDownloadInfo: VideoDownloadInfo?
    @Published var showDownloadSheet = false
    @Published var showOfflineLibrary = false
    
    let webView: WKWebView
    private let contentController = WKUserContentController()
    private var urlObservation: NSKeyValueObservation?

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        config.preferences.isElementFullscreenEnabled = true
        config.websiteDataStore = .default() // lưu cookie đăng nhập
        config.userContentController = contentController

        // Script chặn quảng cáo, chạy ở document start trong mọi frame
        if let js = WebController.loadResource("adblock", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            )
        }
        // UI enhancement: Liquid-Glass bottom nav + animations + gesture. Chỉ main frame
        if let js = WebController.loadResource("uienhance", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            )
        }

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        // Message handlers kết nối JS với Swift Native
        let proxy = WeakScriptProxy(target: self)
        contentController.add(proxy, name: "aetherReady")
        contentController.add(proxy, name: "nowPlaying")
        contentController.add(proxy, name: "downloadData")
        contentController.add(proxy, name: "aetherNav")

        webView.customUserAgent = Config.userAgent
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        // Fix: safe-area trên trang login bị trắng — để WKWebView tự quản lý inset
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.navigationDelegate = self
        webView.uiDelegate = self

        // YouTube là SPA: URL đổi bằng pushState nên theo dõi bằng KVO
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.updateWatching() }
        }

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(willResign), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(didBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(willForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
        
        setupRemoteCommands()
        
        // Timer dự phòng tối đa 0.8s để tắt splash screen bất kể mạng nhanh hay chậm
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.dismissSplash()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        urlObservation?.invalidate()
    }

    func dismissSplash() {
        guard isInitialLoading else { return }
        isInitialLoading = false
    }

    // Tải trang web YouTube ngay lập tức, không đợi loadBlocklist
    func start() {
        guard webView.url == nil else { return }
        webView.load(URLRequest(url: Config.home))
        Task.detached(priority: .userInitiated) { [weak self] in
            await self?.loadBlocklist()
        }
    }

    // Cache-aware: thử lấy blocklist đã compile từ disk, chỉ compile lại khi chưa có.
    private func loadBlocklist() async {
        guard let store = WKContentRuleListStore.default() else {
            NSLog("Aether: không thể khởi tạo WKContentRuleListStore")
            return
        }
        let version = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1"
        let id = "AetherBlocklist-v\(version)"
        // Nếu đã compile rồi thì dùng luôn — tránh compile lại mỗi lần app khởi động
        let cached: WKContentRuleList? = await withCheckedContinuation { continuation in
            store.lookUpContentRuleList(forIdentifier: id) { list, _ in
                continuation.resume(returning: list)
            }
        }
        if let cached {
            contentController.add(cached)
            return
        }
        guard let json = WebController.loadResource("blocklist", "json") else { return }
        do {
            if let list = try await store.compileContentRuleList(forIdentifier: id, encodedContentRuleList: json) {
                contentController.add(list)
            }
        } catch {
            NSLog("Aether: compile blocklist lỗi: %@", error.localizedDescription)
        }
    }

    func togglePiP() {
        // Thực thi trong .page world để truy cập trực tiếp window.__aeMedia và HTMLVideoElement
        run("window.__aeMedia && window.__aeMedia.togglePiP()")
    }
    
    func goBackToHome() {
        if webView.canGoBack {
            webView.goBack()
        } else {
            webView.load(URLRequest(url: Config.home))
        }
    }
    
    func requestDownload() {
        run("window.__aeMedia && window.__aeMedia.extractDownloadStreams()")
    }

    private func updateWatching() {
        let path = webView.url?.path ?? ""
        // Shorts bị ẩn trên UI — không cần PiP cho /shorts
        isWatching = path.hasPrefix("/watch")
    }

    // MARK: - Giữ phát nền & Lock screen
    @objc private func willResign() { run("window.__aeMedia && window.__aeMedia.remember()") }
    @objc private func didBackground() { run("window.__aeMedia && window.__aeMedia.enterBackground()") }
    @objc private func willForeground() { run("window.__aeMedia && window.__aeMedia.enterForeground()") }

    func run(_ js: String) {
        // Luôn chạy trong .page content world nơi code JavaScript nhúng tồn tại
        webView.evaluateJavaScript(js, in: nil, in: .page, completionHandler: nil)
    }

    private static func loadResource(_ name: String, _ ext: String) -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }
    
    // MARK: - Trung tâm điều khiển & Lock Screen (MPRemoteCommandCenter)
    private func setupRemoteCommands() {
        let rcc = MPRemoteCommandCenter.shared()
        
        rcc.playCommand.isEnabled = true
        rcc.playCommand.addTarget { [weak self] _ in
            self?.run("window.__aeMedia && window.__aeMedia.resume()")
            return .success
        }
        
        rcc.pauseCommand.isEnabled = true
        rcc.pauseCommand.addTarget { [weak self] _ in
            self?.run("window.__aeMedia && window.__aeMedia.pause()")
            return .success
        }
        
        rcc.togglePlayPauseCommand.isEnabled = true
        rcc.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.run("window.__aeMedia && window.__aeMedia.togglePlay()")
            return .success
        }
        
        rcc.changePlaybackPositionCommand.isEnabled = true
        rcc.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.run("window.__aeMedia && window.__aeMedia.seek(\(posEvent.positionTime))")
            return .success
        }
        
        rcc.skipForwardCommand.isEnabled = true
        rcc.skipForwardCommand.preferredIntervals = [10]
        rcc.skipForwardCommand.addTarget { [weak self] _ in
            self?.run("window.__aeMedia && window.__aeMedia.skip(10)")
            return .success
        }
        
        rcc.skipBackwardCommand.isEnabled = true
        rcc.skipBackwardCommand.preferredIntervals = [10]
        rcc.skipBackwardCommand.addTarget { [weak self] _ in
            self?.run("window.__aeMedia && window.__aeMedia.skip(-10)")
            return .success
        }
    }
    
    func updateNowPlaying(dict: [String: Any]) {
        let title = dict["title"] as? String ?? "Aether Video"
        let author = dict["author"] as? String ?? "YouTube"
        let duration = dict["duration"] as? Double ?? 0
        let currentTime = dict["currentTime"] as? Double ?? 0
        let isPlaying = dict["isPlaying"] as? Bool ?? true
        let thumbnail = dict["thumbnail"] as? String
        
        let info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: author,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
        
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        
        if let thumbStr = thumbnail, let url = URL(string: thumbStr) {
            Task.detached(priority: .background) {
                if let data = try? Data(contentsOf: url), let img = UIImage(data: data) {
                    let artwork = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
                    Task { @MainActor in
                        var current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                        current[MPMediaItemPropertyArtwork] = artwork
                        MPNowPlayingInfoCenter.default().nowPlayingInfo = current
                    }
                }
            }
        }
    }
    
    func handleDownloadPayload(dict: [String: Any]) {
        guard let videoId = dict["videoId"] as? String,
              let title = dict["title"] as? String else { return }
        let author = dict["author"] as? String ?? ""
        let duration = dict["duration"] as? Double ?? 0
        let thumbnail = dict["thumbnail"] as? String
        
        var streams: [StreamOption] = []
        if let rawStreams = dict["formats"] as? [[String: Any]] {
            for s in rawStreams {
                if let q = s["quality"] as? String, let u = s["url"] as? String {
                    let audioU = s["audioUrl"] as? String
                    let m = s["mimeType"] as? String
                    streams.append(StreamOption(quality: q, url: u, audioURL: audioU, mimeType: m))
                }
            }
        }
        
        activeDownloadInfo = VideoDownloadInfo(
            id: videoId,
            title: title,
            author: author,
            duration: duration,
            thumbnailURL: thumbnail,
            streams: streams
        )
        showDownloadSheet = true
    }
}

// MARK: - Script Message Handler Proxy (Weak to avoid retain cycle)
final class WeakScriptProxy: NSObject, WKScriptMessageHandler {
    weak var target: WebController?
    init(target: WebController) { self.target = target }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        Task { @MainActor in
            guard let target = target else { return }
            switch message.name {
            case "aetherReady":
                target.dismissSplash()
            case "nowPlaying":
                if let dict = message.body as? [String: Any] {
                    target.updateNowPlaying(dict: dict)
                }
            case "downloadData":
                if let dict = message.body as? [String: Any] {
                    target.handleDownloadPayload(dict: dict)
                }
            case "aetherNav":
                if let dict = message.body as? [String: Any], let watching = dict["isWatching"] as? Bool {
                    target.isWatching = watching
                }
            default:
                break
            }
        }
    }
}

// MARK: - Điều hướng
extension WebController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Frame con (iframe, player) luôn cho qua
        guard navigationAction.targetFrame?.isMainFrame ?? true,
              let url = navigationAction.request.url else {
            decisionHandler(.allow); return
        }
        let scheme = url.scheme?.lowercased() ?? ""
        // about/blob/data/javascript là scheme nội bộ hoặc link hành động trang, luôn cho qua
        if ["about", "blob", "data", "javascript"].contains(scheme) { decisionHandler(.allow); return }

        // Chặn deep link (vnd.youtube://, intent://...) để không bị đẩy sang app YouTube thật
        // Bao gồm sau khi login Gmail xong YouTube redirect về via custom scheme
        guard scheme == "http" || scheme == "https" else { decisionHandler(.cancel); return }

        let host = url.host?.lowercased() ?? ""
        let allowed = Config.allowedHostSuffixes.contains { host == $0 || host.hasSuffix("." + $0) }
        if allowed {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url) // link ngoài mở bằng Safari
            decisionHandler(.cancel)
        }
    }

    // Splash ẩn khi trang đầu tiên load xong thành công
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        dismissSplash()
    }

    // Link target=_blank: load ngay trong webview nếu domain được phép, nếu không mở Safari
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil,
              let url = navigationAction.request.url else { return nil }
        let scheme = url.scheme?.lowercased() ?? ""
        guard scheme == "http" || scheme == "https" else { return nil }
        let host = url.host?.lowercased() ?? ""
        let allowed = Config.allowedHostSuffixes.contains { host == $0 || host.hasSuffix("." + $0) }
        if allowed {
            webView.load(navigationAction.request)
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }

    // Hiện trang lỗi thân thiện khi mất mạng / server không phản hồi
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        dismissSplash()
        let nsErr = error as NSError
        // Bỏ qua lỗi "bị cancel" do chính app cancel (ví dụ chặn deep link)
        guard nsErr.domain != NSURLErrorDomain || nsErr.code != NSURLErrorCancelled else { return }
        let html = """
        <html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>body{background:#0f0f0f;color:#aaa;font-family:-apple-system,sans-serif;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        height:100vh;margin:0;gap:12px}
        h2{color:#fff;margin:0}button{background:#ff0000;color:#fff;border:none;
        border-radius:20px;padding:10px 24px;font-size:16px;cursor:pointer}</style></head>
        <body>
        <h2>Không thể tải trang</h2>
        <p>\(nsErr.localizedDescription)</p>
        <button onclick='location.reload()'>Thử lại</button>
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}
