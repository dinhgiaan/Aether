import UIKit
import WebKit
import MediaPlayer

enum Config {
    static let home = URL(string: "https://m.youtube.com/")!
    // UA Safari chuẩn quốc tế tương thích 100% với Google & YouTube (không bị nhận nhầm bot / version lỗi)
    static let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
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
        webView.isOpaque = true
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
        
        // Tải YouTube ngay lập tức khi khởi tạo WebController
        start()
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
        let js = """
        (() => {
          const v = document.querySelector('.html5-video-player video, video');
          if (!v) return;
          if (v.paused) { v.play().catch(() => {}); }
          if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
            const isPiP = v.webkitPresentationMode === 'picture-in-picture';
            const next = isPiP ? 'inline' : 'picture-in-picture';
            window.__aeInPiP = (next === 'picture-in-picture');
            v.webkitSetPresentationMode(next);
            setTimeout(() => { if (v.paused) v.play().catch(() => {}); }, 150);
          } else if (v.requestPictureInPicture) {
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture();
            } else {
              v.requestPictureInPicture();
            }
            setTimeout(() => { if (v.paused) v.play().catch(() => {}); }, 150);
          }
        })();
        """
        run(js)
    }
    
    func handleSwipeDown() {
        // Vuốt video xuống: thu nhỏ video thành Picture-in-Picture nổi tiếp tục phát không bị tắt và không bị mất video
        let js = """
        (() => {
          const v = document.querySelector('.html5-video-player video, video');
          if (v && v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
            if (v.paused) { v.play().catch(() => {}); }
            v.webkitSetPresentationMode('picture-in-picture');
          }
        })();
        """
        run(js)
    }
    
    func goBackToHome() {
        handleSwipeDown()
    }
    
    func requestDownload(explicitId: String? = nil) {
        if let vid = explicitId, !vid.isEmpty {
            Task { @MainActor in
                await self.resolveAndShowDownload(videoId: vid)
            }
            return
        }
        
        // Trích xuất video ID chính xác trực tiếp từ WKWebView
        webView.evaluateJavaScript("window.location.search + '|' + window.location.pathname") { [weak self] res, _ in
            Task { @MainActor in
                guard let self = self else { return }
                var foundId: String? = nil
                if let str = res as? String {
                    let parts = str.split(separator: "|")
                    let search = parts.first ?? ""
                    if let vMatch = search.range(of: "v=") {
                        let sub = search[vMatch.upperBound...]
                        let raw = String(sub.prefix(while: { $0 != "&" && $0 != "#" }))
                        if !raw.isEmpty { foundId = raw }
                    }
                    if foundId == nil, parts.count > 1 {
                        let path = String(parts[1])
                        if path.contains("/shorts/") {
                            foundId = path.components(separatedBy: "/").last
                        }
                    }
                }
                if foundId == nil {
                    foundId = self.extractCurrentVideoId()
                }
                guard let vid = foundId, !vid.isEmpty else {
                    // Fallback JS
                    self.run("window.__aeMedia && window.__aeMedia.extractDownloadStreams()")
                    return
                }
                await self.resolveAndShowDownload(videoId: vid)
            }
        }
    }

    private func extractCurrentVideoId() -> String? {
        guard let url = webView.url else { return nil }
        if let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            if let v = comps.queryItems?.first(where: { $0.name == "v" })?.value, !v.isEmpty {
                return v
            }
        }
        if url.path.contains("/shorts/") {
            return url.lastPathComponent
        }
        return nil
    }

    private func resolveAndShowDownload(videoId: String) async {
        if let info = await YouTubeStreamResolver.resolve(videoId: videoId) {
            self.activeDownloadInfo = info
            self.showDownloadSheet = true
        } else {
            // Fallback JS nếu native gặp sự cố
            self.run("window.__aeMedia && window.__aeMedia.extractDownloadStreams()")
        }
    }

    func setOrientationLandscape() {
        if #available(iOS 16.0, *) {
            let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene
            windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight))
        } else {
            UIDevice.current.setValue(UIInterfaceOrientation.landscapeRight.rawValue, forKey: "orientation")
        }
    }

    func setOrientationPortrait() {
        if #available(iOS 16.0, *) {
            let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene
            windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait))
        } else {
            UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
        }
    }

    private func updateWatching() {
        let path = webView.url?.path ?? ""
        // Shorts bị ẩn trên UI — không cần PiP cho /shorts
        isWatching = path.hasPrefix("/watch")
    }

    // MARK: - Giữ phát nền & Lock screen
    @objc private func willResign() { run("window.__aeMedia && window.__aeMedia.remember()") }
    @objc private func didBackground() {
        // Tự động kích hoạt PiP khi ra ngoài app nếu đang xem video
        run("""
        (() => {
          const v = document.querySelector('.html5-video-player video, video');
          if (v && !v.paused && v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
            v.webkitSetPresentationMode('picture-in-picture');
          }
          window.__aeMedia && window.__aeMedia.enterBackground();
        })();
        """)
    }
    @objc private func willForeground() { run("window.__aeMedia && window.__aeMedia.enterForeground()") }

    func run(_ js: String) {
        // Luôn chạy trong .page content world nơi code JavaScript nhúng tồn tại
        webView.evaluateJavaScript(js, in: nil, in: .page, completionHandler: nil)
    }

    private static func loadResource(_ name: String, _ ext: String) -> String? {
        let bundles = [Bundle(for: WebController.self), Bundle.main]
        for bundle in bundles {
            if let url = bundle.url(forResource: name, withExtension: ext),
               let content = try? String(contentsOf: url, encoding: .utf8) {
                return content
            }
        }
        return nil
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
                if let dict = message.body as? [String: Any] {
                    if let watching = dict["isWatching"] as? Bool {
                        target.isWatching = watching
                    }
                    if let action = dict["action"] as? String {
                        if action == "openDownloads" {
                            target.showOfflineLibrary = true
                        } else if action == "requestDownload" {
                            let vid = dict["videoId"] as? String
                            target.requestDownload(explicitId: vid)
                        } else if action == "enterFullscreen" {
                            target.setOrientationLandscape()
                        } else if action == "exitFullscreen" {
                            target.setOrientationPortrait()
                        }
                    }
                }
            default:
                break
            }
        }
    }
}

// MARK: - Điều hướng & Xử lý WebKit
extension WebController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        let scheme = url.scheme?.lowercased() ?? ""
        if ["about", "blob", "data", "javascript"].contains(scheme) {
            decisionHandler(.allow)
            return
        }

        // Chặn deep link ứng dụng ngoài (vnd.youtube://, intent://...)
        guard scheme == "http" || scheme == "https" else {
            decisionHandler(.cancel)
            return
        }

        // Cho phép toàn bộ tài nguyên trong frame con (player, analytics, assets)
        if !(navigationAction.targetFrame?.isMainFrame ?? true) {
            decisionHandler(.allow)
            return
        }

        let host = url.host?.lowercased() ?? ""
        // Các domain hợp lệ của YouTube, Google và CDN dịch vụ
        let isInternal = host.contains("youtube.") ||
                         host.contains("youtu.be") ||
                         host.contains("google.") ||
                         host.contains("gstatic.") ||
                         host.contains("ggpht.") ||
                         host.contains("googlevideo.") ||
                         host.contains("ytimg.") ||
                         host.isEmpty

        if isInternal {
            decisionHandler(.allow)
        } else {
            // Chỉ mở Safari ngoài khi người dùng CHỦ ĐỘNG click vào 1 liên kết ngoài trang
            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        dismissSplash()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        NSLog("Aether: WebContent process terminated, tự động nạp lại...")
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        dismissSplash()
        showErrorPageIfNeeded(error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        dismissSplash()
        showErrorPageIfNeeded(error: error)
    }

    private func showErrorPageIfNeeded(error: Error) {
        let nsErr = error as NSError
        guard nsErr.domain != NSURLErrorDomain || nsErr.code != NSURLErrorCancelled else { return }
        let html = """
        <html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>body{background:#0a0a0d;color:#aaa;font-family:-apple-system,sans-serif;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        height:100vh;margin:0;gap:16px;text-align:center;padding:24px}
        h2{color:#fff;margin:0;font-size:20px}
        p{color:#888;font-size:14px;max-width:320px;margin:0;line-height:1.4}
        button{background:#ff2442;color:#fff;border:none;border-radius:24px;
        padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer}</style></head>
        <body>
        <h2>Không thể tải YouTube</h2>
        <p>\(nsErr.localizedDescription)</p>
        <button onclick='location.href="https://m.youtube.com/"'>Thử lại</button>
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
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
        let isInternal = host.contains("youtube.") || host.contains("google.") || host.contains("youtu.be")
        if isInternal {
            webView.load(navigationAction.request)
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }
}
