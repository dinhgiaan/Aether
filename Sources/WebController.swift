import UIKit
import WebKit

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

@MainActor
final class WebController: NSObject, ObservableObject {
    @Published var isWatching = false
    /// true từ lúc app mở đến khi trang YouTube đầu tiên load xong → ẩn splash
    @Published var isInitialLoading = true

    let webView: WKWebView
    private let contentController = WKUserContentController()
    private var urlObservation: NSKeyValueObservation?

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        config.websiteDataStore = .default() // lưu cookie đăng nhập
        config.userContentController = contentController

        // Script chặn quảng cáo, chạy ở document start trong mọi frame
        if let js = WebController.loadResource("adblock", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            )
        }
        // UI enhancement: Liquid-Glass bottom nav + animations. Chỉ main frame
        if let js = WebController.loadResource("uienhance", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            )
        }

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.customUserAgent = Config.userAgent
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        // Fix: safe-area trên trang login bị trắng — để WKWebView tự quản lý inset
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.navigationDelegate = self
        webView.uiDelegate = self

        // YouTube là SPA: URL đổi bằng pushState nên phải theo dõi bằng KVO
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.updateWatching() }
        }

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(willResign), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(didBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(willForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        urlObservation?.invalidate()
    }

    // Nạp rule chặn request trước rồi mới load trang, tránh ad lọt lúc khởi động
    func start() async {
        guard webView.url == nil else { return }
        await loadBlocklist()
        webView.load(URLRequest(url: Config.home))
    }

    // Cache-aware: thử lấy blocklist đã compile từ disk, chỉ compile lại khi chưa có.
    // Version làm suffix của id → update blocklist.json trong bản mới sẽ tự recompile.
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
        run("window.__aeMedia && window.__aeMedia.togglePiP()")
    }

    private func updateWatching() {
        let path = webView.url?.path ?? ""
        // Shorts bị ẩn trên UI — không cần PiP cho /shorts
        isWatching = path.hasPrefix("/watch")
    }

    // MARK: - Giữ phát nền
    // Native báo cho JS trước/sau khi app bị đưa xuống nền để JS tự resume video bị WebKit pause
    @objc private func willResign() { run("window.__aeMedia && window.__aeMedia.remember()") }
    @objc private func didBackground() { run("window.__aeMedia && window.__aeMedia.enterBackground()") }
    @objc private func willForeground() { run("window.__aeMedia && window.__aeMedia.enterForeground()") }

    private func run(_ js: String) {
        // Dùng API mới với WKContentWorld để tránh deprecation warning (iOS 14+)
        webView.evaluateJavaScript(js, in: nil, in: .defaultClient, completionHandler: nil)
    }

    private static func loadResource(_ name: String, _ ext: String) -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
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
        if isInitialLoading { isInitialLoading = false }
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
        isInitialLoading = false   // ẩn splash dù load lỗi
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
