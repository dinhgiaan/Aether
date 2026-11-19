import UIKit
import WebKit

enum Config {
    static let home = URL(string: "https://m.youtube.com/")!
    // UA Safari chuẩn: giảm khả năng Google chặn đăng nhập trong webview
    static let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    // Chỉ cho phép điều hướng trang chính trong các domain này
    static let allowedHostSuffixes = ["youtube.com", "google.com", "youtu.be"]
}

@MainActor
final class WebController: NSObject, ObservableObject {
    @Published var isWatching = false

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

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.customUserAgent = Config.userAgent
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
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

    // Nạp rule chặn request trước rồi mới load trang, tránh ad lọt lúc khởi động
    func start() async {
        guard webView.url == nil else { return }
        if let json = WebController.loadResource("blocklist", "json") {
            do {
                let list = try await WKContentRuleListStore.default()
                    .compileContentRuleList(forIdentifier: "AetherBlocklist", encodedContentRuleList: json)
                if let list { contentController.add(list) }
            } catch {
                NSLog("Aether: compile blocklist lỗi: %@", error.localizedDescription)
            }
        }
        webView.load(URLRequest(url: Config.home))
    }

    func togglePiP() {
        run("window.__aeMedia && window.__aeMedia.togglePiP()")
    }

    private func updateWatching() {
        let path = webView.url?.path ?? ""
        isWatching = path.hasPrefix("/watch") || path.hasPrefix("/shorts")
    }

    // MARK: - Giữ phát nền
    // Native báo cho JS trước/sau khi app bị đưa xuống nền để JS tự resume video bị WebKit pause
    @objc private func willResign() { run("window.__aeMedia && window.__aeMedia.remember()") }
    @objc private func didBackground() { run("window.__aeMedia && window.__aeMedia.enterBackground()") }
    @objc private func willForeground() { run("window.__aeMedia && window.__aeMedia.enterForeground()") }

    private func run(_ js: String) {
        webView.evaluateJavaScript(js, completionHandler: nil)
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
        if ["about", "blob", "data"].contains(scheme) { decisionHandler(.allow); return }

        // Chặn deep link (vnd.youtube://, intent://...) để không bị đẩy sang app khác
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

    // Link target=_blank: load ngay trong webview hiện tại
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}
