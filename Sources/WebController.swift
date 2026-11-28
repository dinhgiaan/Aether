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
    // UA + tên client đã sinh ra URL này: phải tải bằng đúng UA, nếu không googlevideo trả 403
    var userAgent: String? = nil
    var clientName: String? = nil
    // true: url là media playlist HLS (audioURL là playlist âm thanh nếu tách riêng)
    var isHLS: Bool = false
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
    /// Tab đang chọn của thanh tab native (đồng bộ từ URL trang duyệt, hoặc đặt ngay khi người dùng bấm để pill chạy tức thì)
    @Published var selectedTab: AppTab = .home
    /// Đang ở giao diện tìm kiếm (gợi ý / kết quả) → ẩn thanh tab
    @Published var isSearching = false
    /// Cuộn xuống → ẩn thanh tab, cuộn lên → hiện (JS tính ngưỡng, xem Resources/ui/nav.js)
    @Published var isBarHiddenByScroll = false

    /// Thanh tab hiện khi: đang ở màn hình Đã tải, hoặc ở trang duyệt (không xem video, không tìm kiếm, không toàn màn hình, chưa cuộn ẩn)
    var isTabBarVisible: Bool {
        showOfflineLibrary || (!isWatching && !isSearching && !isFullscreen && !isBarHiddenByScroll)
    }

    // MARK: - Tab: mỗi tab YouTube giữ 1 WKWebView riêng
    //
    // Root cause chuyển tab chậm: trước đây mọi tab dùng chung 1 WebView và mỗi lần chuyển là nạp lại trang (hoặc ép YouTube tự điều hướng)
    // → tải lại cả feed. Giờ mỗi tab (Home / Đăng ký / Bạn) có WebView riêng nằm sẵn trong host; chuyển tab chỉ là đổi lớp hiển thị
    // (tức thì, giữ nguyên feed và vị trí cuộn của từng tab), giống tab của một app iOS.
    private var tabWebViews: [AppTab: WKWebView] = [:]

    /// WebView của tab; chưa có thì dựng và nạp trang. isNew = true khi cần lớp phủ loading
    private func tabWebView(for tab: AppTab) -> (view: WKWebView, isNew: Bool) {
        if let wv = tabWebViews[tab] {
            // Đã dựng sẵn (preload) nhưng chưa nạp được gì (vd. lỗi mạng lúc đó) → nạp lại và coi như mới
            if wv.url == nil && !wv.isLoading, let url = tab.fallbackURL {
                wv.load(URLRequest(url: url))
                return (wv, true)
            }
            return (wv, false)
        }
        let wv = makeWebView()
        hostView.install(wv)
        tabWebViews[tab] = wv
        if let url = tab.fallbackURL { wv.load(URLRequest(url: url)) }
        return (wv, true)
    }

    /// Dựng sẵn tab nền khi app đã yên: lần đầu bấm tab cũng tức thì (không phải đợi tải)
    private func preloadTab(_ tab: AppTab) {
        guard tab != .downloads, tab != selectedTab, tabWebViews[tab] == nil, let url = tab.fallbackURL else { return }
        let wv = makeWebView()
        hostView.install(wv, behind: true)   // nằm sau cùng, không nhận chạm
        tabWebViews[tab] = wv
        wv.load(URLRequest(url: url))
    }

    /// Chuyển sang 1 tab YouTube (Home / Đăng ký / Bạn)
    func openTab(_ tab: AppTab) {
        guard tab != .downloads else { return }
        isBarHiddenByScroll = false
        // Đang ở trang video (mở thư viện từ nút tải nổi): đóng video để quay về trang duyệt trước
        if webView !== browseWebView { closeWatch(instant: true) }
        guard tab != selectedTab else { return }

        let old: WKWebView = browseWebView
        let (target, isNew) = tabWebView(for: tab)
        selectedTab = tab                  // pill chạy ngay
        browseWebView = target
        webView = target
        observeURL()
        updateWatching()
        isFullscreen = false
        isSearching = false
        // Báo JS của trang tab đó gửi lại trạng thái (tìm kiếm / thanh cuộn) để Swift đồng bộ với đúng trang đang hiển thị
        target.evaluateJavaScript("window.__aeReport && window.__aeReport();", in: nil, in: .page, completionHandler: nil)
        // Tab mới nạp: phủ lớp loading tới khi xong. Tab đã có sẵn: crossfade nhẹ, tức thì
        hostView.present(target, sending: old, showCover: isNew, animated: !isNew)
    }

    /// Bấm lại tab đang chọn: cuộn mượt lên đầu trang (không tải lại)
    func scrollToTop() {
        run("window.__aeScrollTop && window.__aeScrollTop();")
    }
    /// Video đang toàn màn hình (native hoặc xoay ngang) → ẩn nút Tải nổi
    @Published var isFullscreen = false {
        didSet {
            guard isFullscreen != oldValue else { return }
            // Toàn màn hình: bỏ inset safe-area để video phủ kín chiều ngang (trước đây mất ~44px mỗi bên ở chế độ ngang)
            webView.scrollView.contentInsetAdjustmentBehavior = isFullscreen ? .never : .automatic
        }
    }
    
    /// Container giữ MỌI WKWebView (đang hiển thị / đang PiP / dự phòng).
    /// Các WebView không bao giờ bị gỡ ra rồi gắn lại → không còn nháy trắng khi thu nhỏ / quay lại từ PiP.
    let hostView = WebHostView()
    /// WebView đang hiển thị (nằm trên cùng trong hostView)
    private(set) var webView: WKWebView
    /// WebView đang giữ trang /watch ở chế độ PiP (nằm phía sau giao diện, vẫn "sống"). nil nếu không có
    private(set) var parkedWebView: WKWebView?
    /// WebView duyệt (trang chủ, tìm kiếm…) – KHÔNG bao giờ bị thay khi mở video, nên feed + vị trí cuộn được giữ nguyên.
    /// Video mở ở một WebView riêng (nằm trên); vuốt xuống chỉ việc hiện lại WebView này.
    private(set) var browseWebView: WKWebView!
    private var lastBrowseURL: URL = Config.home
    private let configuration: WKWebViewConfiguration
    /// start() được gọi từ init VÀ từ ContentView.task → cờ này đảm bảo chỉ nạp trang + biên dịch blocklist đúng 1 lần
    private var didStart = false
    /// WebView dự phòng (chưa nạp trang nào) nằm sẵn sau cùng để bấm video không phải khởi tạo WKWebView trên main thread.
    /// KHÔNG nạp about:blank vào đây: nó thành 1 mục lịch sử → canGoBack = true → cử chỉ vuốt-từ-mép-trái đóng video bị hỏng.
    private var spareWebView: WKWebView?
    /// Lần cuối khôi phục trang video từ PiP: để biết tín hiệu "pipClosedLate" (bấm X nhưng iOS pause chậm) còn hợp lệ không
    private var restoredAt = Date.distantPast
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

        // Script vá hiển thị (nền tối, class ae-watching sớm, báo feed/watch sẵn sàng).
        // Phải đăng ký TRƯỚC adblock/ui để chạy đầu tiên.
        if let js = WebController.loadResource("aetherfix", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            )
        }
        // Script chặn quảng cáo, chạy ở document start trong mọi frame
        if let js = WebController.loadResource("adblock", "js") {
            contentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            )
        }
        // UI enhancement (Resources/ui/*.js): chỉ main frame. Thứ tự quan trọng: core trước, boot cuối cùng.
        for name in WebController.uiScripts {
            if let js = WebController.loadResource(name, "js") {
                contentController.addUserScript(
                    WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
                )
            }
        }

        configuration = config
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        // Message handlers kết nối JS với Swift Native
        let proxy = WeakScriptProxy(target: self)
        contentController.add(proxy, name: "aetherReady")
        contentController.add(proxy, name: "nowPlaying")
        contentController.add(proxy, name: "downloadData")
        contentController.add(proxy, name: "aetherNav")
        contentController.add(proxy, name: "aetherFeedReady")

        browseWebView = webView
        tabWebViews[.home] = webView
        configure(webView)
        hostView.install(webView)
        hostView.onEdgeBack = { [weak self] in self?.handleEdgeBack() ?? false }
        observeURL()

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(willResign), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(didBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(willForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
        
        setupRemoteCommands()
        
        // Tải YouTube ngay lập tức khi khởi tạo WebController
        start()
    }

    // MARK: - Quản lý WebView (duyệt / video / parked cho PiP)
    private func makeWebView() -> WKWebView {
        // Dùng chung configuration (cookie, user scripts, blocklist) → vẫn đăng nhập sẵn
        let wv = WKWebView(frame: .zero, configuration: configuration)
        configure(wv)
        return wv
    }

    /// #0f0f0f giống nền YouTube dark
    private static let darkBackground = UIColor(red: 0.06, green: 0.06, blue: 0.06, alpha: 1)

    private func configure(_ wv: WKWebView) {
        wv.customUserAgent = Config.userAgent
        wv.allowsBackForwardNavigationGestures = true
        wv.isOpaque = true
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.underPageBackgroundColor = Self.darkBackground   // không lộ nền trắng khi nội dung chưa vẽ
        // Fix: safe-area trên trang login bị trắng — để WKWebView tự quản lý inset
        wv.scrollView.contentInsetAdjustmentBehavior = .automatic
        wv.navigationDelegate = self
        wv.uiDelegate = self
    }

    // YouTube là SPA: URL đổi bằng pushState nên theo dõi bằng KVO (gắn lại mỗi khi đổi WebView)
    private func observeURL() {
        urlObservation?.invalidate()
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.updateWatching() }
        }
    }

    /// WebView dùng cho lệnh media (Lock Screen, nền): ưu tiên trang đang PiP
    private var mediaWebView: WKWebView { parkedWebView ?? webView }

    func runMedia(_ js: String) {
        mediaWebView.evaluateJavaScript(js, in: nil, in: .page, completionHandler: nil)
    }

    /// Dọn một WebView: ngắt mọi liên kết rồi gỡ khỏi host
    private func tearDown(_ wv: WKWebView, silenceMedia: Bool) {
        wv.stopLoading()
        wv.navigationDelegate = nil
        wv.uiDelegate = nil
        hostView.remove(wv)
        if silenceMedia { wv.loadHTMLString("", baseURL: nil) }   // ngắt media chắc chắn
    }

    // MARK: Mở video ở WebView riêng

    /// Bấm video ở trang duyệt: mở ở WebView mới phía trên, WebView duyệt giữ nguyên (feed + vị trí cuộn).
    /// Root cause của lỗi "video vừa chọn biến mất khỏi trang chủ": trước đây vuốt xuống là nạp lại trang chủ ở WebView
    /// mới → YouTube trả feed khác. Giờ trang chủ chính là WebView cũ nên không đổi gì.
    func openWatch(_ url: URL) {
        destroyParked()   // mở video mới → đóng PiP cũ
        guard webView === browseWebView else {
            webView.load(URLRequest(url: url))   // đang ở WebView video rồi → điều hướng tại chỗ
            return
        }
        // Dùng WebView dựng sẵn nếu có → tránh khựng vài frame do WKWebView() khởi tạo ngay lúc chạm
        let watch = spareWebView ?? makeWebView()
        spareWebView = nil
        hostView.install(watch)   // đã nằm trong host thì hàm tự bỏ qua
        watch.load(URLRequest(url: url))
        webView = watch
        observeURL()
        isWatching = true
        hostView.present(watch, sending: browseWebView, showCover: true)
        // Dựng sẵn cái kế tiếp khi UI đã yên (không trùng frame với animation mở video)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.prewarmSpare() }
    }

    private func prewarmSpare() {
        guard spareWebView == nil else { return }
        let wv = makeWebView()
        hostView.install(wv, behind: true)   // nằm sau cùng, không nhận chạm
        spareWebView = wv
    }

    /// Vuốt từ mép trái: nếu đang ở WebView video mà không còn lịch sử để back → đóng video, về trang duyệt.
    /// (Có lịch sử thì WKWebView tự back bằng cử chỉ của nó.)
    @discardableResult
    func handleEdgeBack() -> Bool {
        guard webView !== browseWebView, !webView.canGoBack else { return false }
        closeWatch()
        return true
    }

    /// instant = true: đổi tức thì, không crossfade (dùng khi trang video vừa bị khôi phục nhầm sau nút X của PiP)
    func closeWatch(instant: Bool = false) {
        guard webView !== browseWebView else { return }
        let watch = webView
        webView = browseWebView
        observeURL()
        isWatching = false
        isFullscreen = false
        hostView.present(browseWebView, sending: watch, showCover: false, animated: !instant)
        // Đợi crossfade xong mới huỷ WebView video (dừng video chắc chắn)
        DispatchQueue.main.asyncAfter(deadline: .now() + (instant ? 0.05 : 0.35)) { [weak self] in
            self?.tearDown(watch, silenceMedia: true)
        }
    }

    /// Vuốt xuống khi đang PiP: giữ nguyên trang /watch ở WebView phía sau, hiện lại WebView duyệt.
    /// Không đụng vào DOM của <video> nên PiP không mất hình, và không tạo/gỡ view nào nên không nháy.
    func parkCurrentForPiP() {
        guard parkedWebView == nil, isWatching else { return }
        let parked = webView
        var needsCover = false
        if parked === browseWebView {
            // Dự phòng: video đã mở tại chỗ trong chính WebView duyệt → phải dựng WebView duyệt mới
            let fresh = makeWebView()
            hostView.install(fresh, behind: true)
            fresh.load(URLRequest(url: lastBrowseURL))
            browseWebView = fresh
            tabWebViews[selectedTab] = fresh
            needsCover = true
        }
        parkedWebView = parked
        webView = browseWebView
        observeURL()
        isWatching = false
        isFullscreen = false
        hostView.present(browseWebView, sending: parked, showCover: needsCover, animated: false)   // tức thì: không để khung đen của video đang PiP lộ ra qua crossfade
    }

    /// Nút "quay lại app" của cửa sổ PiP: đưa WebView video lên lại (WebView duyệt vẫn ở phía sau)
    func restoreParked() {
        guard let parked = parkedWebView else { return }
        let previous = webView
        parkedWebView = nil
        webView = parked
        observeURL()
        setTransparent(parked, false)   // đang trong suốt từ lúc kéo thu nhỏ → trả lại nền đen đặc
        restoredAt = Date()
        // Đổi tức thì (không crossfade 0.22s): cửa sổ PiP đang tự phóng về chỗ video, trang video phải có mặt ngay
        hostView.present(parked, sending: previous, showCover: false, animated: false)
        updateWatching()
    }

    /// Bấm X nhưng iOS pause video chậm → JS đã khôi phục nhầm: đóng lại trang video (chỉ trong ~2s sau khi khôi phục)
    func handleLatePiPClose() {
        guard Date().timeIntervalSince(restoredAt) < 3.0, webView !== browseWebView else { return }
        closeWatch(instant: true)
    }

    /// Kéo video xuống: cho WebView video trong suốt để thấy trang chủ (WebView duyệt) nằm phía sau thay vì khung đen
    func setRevealTransparent(_ on: Bool) { setTransparent(webView, on) }

    private func setTransparent(_ wv: WKWebView, _ on: Bool) {
        wv.isOpaque = !on
        let color: UIColor = on ? .clear : .black
        wv.backgroundColor = color
        wv.scrollView.backgroundColor = color
        wv.underPageBackgroundColor = on ? .clear : Self.darkBackground   // trong suốt khi kéo để còn thấy trang chủ phía sau
    }

    /// Đóng PiP (nút X, hoặc mở video mới): dừng và huỷ WebView đang giữ
    func destroyParked() {
        guard let parked = parkedWebView else { return }
        parkedWebView = nil
        tearDown(parked, silenceMedia: true)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        urlObservation?.invalidate()
    }

    func dismissSplash() {
        guard isInitialLoading else { return }
        isInitialLoading = false
        // Trang chủ đã lên → dựng WebView dự phòng đầu tiên (tránh tranh tài nguyên lúc đang nạp trang)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in self?.prewarmSpare() }
        // Rồi dựng sẵn 2 tab còn lại, cách nhau để không tranh tài nguyên với feed trang chủ
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) { [weak self] in self?.preloadTab(.subs) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in self?.preloadTab(.you) }
    }

    // Tải trang web YouTube ngay lập tức, không đợi loadBlocklist
    func start() {
        guard !didStart, webView.url == nil else { return }
        didStart = true
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
    
    /// Thu nhỏ video: bật PiP → giữ video sống → về trang trước.
    /// Logic nằm trong JS (__aeMedia.minimize). Gọi từ Swift không có user gesture nên WebKit có thể
    /// từ chối PiP (JS sẽ hiện toast); cử chỉ vuốt thật chạy trong touchend ở Resources/ui/watch.js.
    func handleSwipeDown() {
        run("window.__aeMedia && window.__aeMedia.minimize && window.__aeMedia.minimize();")
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

    func extractCurrentVideoId() -> String? {
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

    /// Lấy danh sách chất lượng HLS từ chính trang đang phát (không cần PO Token)
    private func resolveHLS(videoId: String) async -> VideoDownloadInfo? {
        do {
            let result = try await webView.callAsyncJavaScript(
                "return window.__aeMedia && window.__aeMedia.getHLS ? await window.__aeMedia.getHLS(videoId) : null;",
                arguments: ["videoId": videoId],
                in: nil,
                contentWorld: .page
            )
            guard let dict = result as? [String: Any] else {
                HLSDiagnostics.set("JS không trả dữ liệu (getHLS chưa có trong adblock.js?)")
                return nil
            }
            guard let hlsString = dict["hls"] as? String, let hlsURL = URL(string: hlsString) else {
                HLSDiagnostics.set("trang không có hlsManifestUrl: \(dict["diag"] as? String ?? "?")")
                return nil
            }

            let variants = try await HLSParser.variants(masterURL: hlsURL)
            // Ưu tiên >= 720p; nếu video không có thì hiện tất cả mức đang có
            let hd = variants.filter { $0.height >= 720 }
            let chosen = hd.isEmpty ? variants : hd
            guard !chosen.isEmpty else {
                HLSDiagnostics.set("master HLS không có mức H.264 nào")
                return nil
            }
            HLSDiagnostics.set("OK \(chosen.count) mức")

            let streams = chosen.map { v in
                StreamOption(
                    quality: Self.hlsQualityLabel(height: v.height),
                    url: v.playlistURL.absoluteString,
                    audioURL: v.audioPlaylistURL?.absoluteString,
                    mimeType: "application/vnd.apple.mpegurl",
                    isHLS: true
                )
            }
            let title = (dict["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Video"
            let author = (dict["author"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "YouTube"
            let duration = (dict["duration"] as? Double) ?? 0
            return VideoDownloadInfo(
                id: videoId,
                title: title,
                author: author,
                duration: duration,
                thumbnailURL: "https://i.ytimg.com/vi/\(videoId)/hqdefault.jpg",
                streams: streams
            )
        } catch {
            NSLog("Aether HLS resolve error: %@", error.localizedDescription)
            HLSDiagnostics.set("lỗi đọc HLS: \(error.localizedDescription)")
            return nil
        }
    }

    private static func hlsQualityLabel(height: Int) -> String {
        switch height {
        case 2160...: return "2160p (4K Ultra HD)"
        case 1440...: return "1440p (2K QHD)"
        case 1080...: return "1080p Full HD"
        case 720...:  return "720p HD"
        default:      return "\(height)p"
        }
    }

    /// Đọc visitorData từ ytcfg của trang YouTube đang mở để InnerTube dùng chung phiên
    private func refreshVisitorData() async {
        let js = "(function(){try{return (window.ytcfg&&ytcfg.get&&ytcfg.get('VISITOR_DATA'))||''}catch(e){return ''}})()"
        if let value = (try? await webView.evaluateJavaScript(js)) as? String, !value.isEmpty {
            YouTubeSession.setVisitorData(value)
        }
    }

    private func resolveAndShowDownload(videoId: String) async {
        await refreshVisitorData()
        // Ưu tiên HLS: link googlevideo trực tiếp (client IOS) bị 403 vì thiếu PO Token
        if let hlsInfo = await resolveHLS(videoId: videoId) {
            self.activeDownloadInfo = hlsInfo
            self.showDownloadSheet = true
            return
        }
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
            windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape)) { _ in }
        } else {
            UIDevice.current.setValue(UIInterfaceOrientation.landscapeRight.rawValue, forKey: "orientation")
        }
    }

    func setOrientationPortrait() {
        if #available(iOS 16.0, *) {
            let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene
            windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
        } else {
            UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
        }
    }

    private func updateWatching() {
        let url = webView.url
        let path = url?.path ?? ""
        // Shorts bị ẩn trên UI — không cần PiP cho /shorts
        let watching = path.hasPrefix("/watch")
        if isWatching != watching { isWatching = watching }
        if watching {
            destroyParked()   // mở video mới → đóng PiP cũ
        } else {
            if let url, (url.host ?? "").contains("youtube.") {
                lastBrowseURL = url   // nhớ trang trước khi vào video để quay về đúng chỗ
            }
        }
    }

    // MARK: - Giữ phát nền & Lock screen
    @objc private func willResign() { runMedia("window.__aeMedia && window.__aeMedia.remember()") }
    @objc private func didBackground() {
        // Tự động kích hoạt PiP khi ra ngoài app nếu đang xem video
        runMedia("""
        (() => {
          const v = document.querySelector('.html5-video-player video, video');
          if (v && !v.paused && v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
            v.webkitSetPresentationMode('picture-in-picture');
          }
          window.__aeMedia && window.__aeMedia.enterBackground();
        })();
        """)
    }
    @objc private func willForeground() { runMedia("window.__aeMedia && window.__aeMedia.enterForeground()") }

    func run(_ js: String) {
        // Luôn chạy trong .page content world nơi code JavaScript nhúng tồn tại
        webView.evaluateJavaScript(js, in: nil, in: .page, completionHandler: nil)
    }

    /// Các module giao diện JS, nạp theo đúng thứ tự này (module sau dùng namespace `window.AE` của core)
    private static let uiScripts = [
        "core", "branding", "nav", "search", "watch", "watch-fx", "debug", "boot"
    ]

    private static func loadResource(_ name: String, _ ext: String) -> String? {
        let bundles = [Bundle(for: WebController.self), Bundle.main]
        for bundle in bundles {
            // Xcode copy phẳng vào bundle; fallback subdirectory "ui" phòng khi giữ nguyên cấu trúc thư mục
            if let url = bundle.url(forResource: name, withExtension: ext)
                ?? bundle.url(forResource: name, withExtension: ext, subdirectory: "ui"),
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
            self?.runMedia("window.__aeMedia && window.__aeMedia.resume()")
            return .success
        }
        
        rcc.pauseCommand.isEnabled = true
        rcc.pauseCommand.addTarget { [weak self] _ in
            self?.runMedia("window.__aeMedia && window.__aeMedia.pause()")
            return .success
        }
        
        rcc.togglePlayPauseCommand.isEnabled = true
        rcc.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.runMedia("window.__aeMedia && window.__aeMedia.togglePlay()")
            return .success
        }
        
        rcc.changePlaybackPositionCommand.isEnabled = true
        rcc.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.runMedia("window.__aeMedia && window.__aeMedia.seek(\(posEvent.positionTime))")
            return .success
        }
        
        rcc.skipForwardCommand.isEnabled = true
        rcc.skipForwardCommand.preferredIntervals = [10]
        rcc.skipForwardCommand.addTarget { [weak self] _ in
            self?.runMedia("window.__aeMedia && window.__aeMedia.skip(10)")
            return .success
        }
        
        rcc.skipBackwardCommand.isEnabled = true
        rcc.skipBackwardCommand.preferredIntervals = [10]
        rcc.skipBackwardCommand.addTarget { [weak self] _ in
            self?.runMedia("window.__aeMedia && window.__aeMedia.skip(-10)")
            return .success
        }
    }
    
    /// Cache ảnh bìa: JS gọi nowPlaying mỗi ~4s + mỗi lần play/pause; trước đây lần nào cũng tải lại ảnh từ mạng
    /// và ghi đè nowPlayingInfo làm ảnh bìa trên Lock Screen nháy mất rồi hiện lại.
    private var artworkURLString: String?
    private var cachedArtwork: MPMediaItemArtwork?

    func updateNowPlaying(dict: [String: Any]) {
        let title = dict["title"] as? String ?? "Aether Video"
        let author = dict["author"] as? String ?? "YouTube"
        let duration = dict["duration"] as? Double ?? 0
        let currentTime = dict["currentTime"] as? Double ?? 0
        let isPlaying = dict["isPlaying"] as? Bool ?? true
        let thumbnail = dict["thumbnail"] as? String ?? ""

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: author,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
        // Đã có ảnh bìa trong cache → gắn luôn vào lần cập nhật này
        if thumbnail == artworkURLString, let art = cachedArtwork {
            info[MPMediaItemPropertyArtwork] = art
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        // Chỉ tải khi đổi sang video khác
        guard !thumbnail.isEmpty, thumbnail != artworkURLString, let url = URL(string: thumbnail) else { return }
        artworkURLString = thumbnail
        cachedArtwork = nil
        Task.detached(priority: .background) { [weak self] in
            guard let data = try? Data(contentsOf: url), let img = UIImage(data: data) else {
                await self?.artworkDidFail(thumbnail)
                return
            }
            let artwork = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
            await self?.artworkDidLoad(artwork, for: thumbnail)
        }
    }

    private func artworkDidFail(_ key: String) {
        if artworkURLString == key { artworkURLString = nil }   // lỗi mạng → cho thử lại ở lần sau
    }

    private func artworkDidLoad(_ artwork: MPMediaItemArtwork, for key: String) {
        guard artworkURLString == key else { return }   // đã chuyển video khác → bỏ
        cachedArtwork = artwork
        var current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        current[MPMediaItemPropertyArtwork] = artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = current
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
                    // JS fallback gọi InnerTube client IOS -> tải bằng đúng UA của client IOS
                    streams.append(StreamOption(
                        quality: q, url: u, audioURL: audioU, mimeType: m,
                        userAgent: InnerTubeClient.ios.userAgent,
                        clientName: InnerTubeClient.ios.name
                    ))
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
                break   // bắn ở DOMContentLoaded (quá sớm, feed chưa vẽ) → không dùng để tắt splash nữa
            case "aetherFeedReady":
                target.dismissSplash()   // feed trang chủ đã có nội dung thật
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
                    let fromVisible = message.webView === target.webView
                    let fromParked = message.webView != nil && message.webView === target.parkedWebView
                    // Trạng thái xem chỉ lấy từ WebView đang hiển thị (bỏ qua trang đang PiP ở nền)
                    // So sánh trước khi gán: @Published phát thay đổi cả khi giá trị y hệt → SwiftUI dựng lại cả ContentView
                    // (adblock.js gửi isWatching ở mỗi pushState, kể cả đúng lúc cover đang fade-in lúc mở video)
                    if let watching = dict["isWatching"] as? Bool, fromVisible, target.isWatching != watching {
                        target.isWatching = watching
                    }
                    if let fs = dict["isFullscreen"] as? Bool, fromVisible || fromParked, target.isFullscreen != fs {
                        target.isFullscreen = fs
                    }
                    // Trạng thái thanh tab: chỉ nhận từ trang duyệt đang hiển thị (không nhận từ trang video / trang PiP ở nền)
                    if fromVisible, message.webView === target.browseWebView {
                        if let searching = dict["searching"] as? Bool, target.isSearching != searching {
                            target.isSearching = searching
                        }
                        if let hidden = dict["barHidden"] as? Bool, target.isBarHiddenByScroll != hidden {
                            target.isBarHiddenByScroll = hidden
                        }
                    }
                    if let action = dict["action"] as? String {
                        if action == "minimizeToPiP" {
                            if fromVisible { target.parkCurrentForPiP() }
                        } else if action == "pipEnded" {
                            if fromParked {
                                if (dict["restore"] as? Bool) == true { target.restoreParked() }
                                else { target.destroyParked() }
                            }
                        } else if action == "debugDump" {
                            // Giữ 3 ngón tay trên trang → copy sơ đồ DOM vào clipboard để dán gửi đi
                            if let text = dict["text"] as? String {
                                UIPasteboard.general.string = text
                                Haptic.feedback(.heavy)
                                (message.webView ?? target.webView).evaluateJavaScript(
                                    "window.__aeToast && window.__aeToast('Đã copy sơ đồ trang – hãy dán vào chat');",
                                    in: nil, in: .page, completionHandler: nil)
                            }
                        } else if action == "edgeBack" {
                            // Vuốt từ mép trái (JS bắt được, phòng khi gesture native không nhận)
                            if fromVisible { target.handleEdgeBack() }
                        } else if action == "openWatch" {
                            if fromVisible, let str = dict["url"] as? String, let url = URL(string: str),
                               (url.host ?? "").hasSuffix("youtube.com") {
                                target.openWatch(url)
                            }
                        } else if action == "dragReveal" {
                            if fromVisible, let on = dict["on"] as? Bool { target.setRevealTransparent(on) }
                        } else if action == "pipClosedLate" {
                            if fromVisible { target.handleLatePiPClose() }
                        } else if action == "watchReady" {
                            // Layout trang video đã ổn định (padding chừa chỗ cho player đã áp) → gỡ lớp phủ ngay
                            if fromVisible { target.hostView.hideCover(force: true) }
                        } else if action == "openDownloads" {
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
    /// Domain tin cậy: <name>.<tld> hoặc <name>.<co|com|net|org>.<cc>, kèm mọi subdomain. VD: m.youtube.com, www.google.com.vn
    static func isTrustedHost(_ host: String) -> Bool {
        if host == "youtu.be" || host.hasSuffix(".youtu.be") { return true }
        let pattern = #"(^|\.)(youtube|youtube-nocookie|google|gstatic|ggpht|googlevideo|ytimg|googleusercontent)\.([a-z]{2,}|(com|co|net|org)\.[a-z]{2})$"#
        return host.range(of: pattern, options: .regularExpression) != nil
    }

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
        // Chỉ coi là nội bộ khi domain gốc đúng là của YouTube/Google/CDN (không dùng contains → chặn youtube.evil.com)
        let isInternal = host.isEmpty || WebController.isTrustedHost(host)

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
        if webView === browseWebView {
            // Tín hiệu chính tắt splash là aetherFeedReady (feed đã vẽ). Đây chỉ là dự phòng nếu selector feed không khớp.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in self?.dismissSplash() }
            if webView === self.webView { hostView.hideCover() }   // trang duyệt mới nạp xong → bỏ lớp loading
        } else if webView === self.webView {
            // WebView video: cover do tín hiệu watchReady gỡ (đợi layout ổn định). Dự phòng 2.5s nếu JS không báo.
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self, weak webView] in
                guard let self, let webView, webView === self.webView else { return }
                self.hostView.hideCover(force: true)
            }
        }
        // WebView dự phòng (spare) không nạp gì nên không đi tới đây
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView === parkedWebView { destroyParked(); return }
        // Tab nền bị iOS thu hồi bộ nhớ: bỏ khỏi pool, lần chuyển tới sẽ dựng lại
        if webView !== self.webView, let tab = tabWebViews.first(where: { $0.value === webView })?.key {
            tabWebViews[tab] = nil
            hostView.remove(webView)
            return
        }
        guard webView === self.webView else { return }
        NSLog("Aether: WebContent process terminated, tự động nạp lại...")
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        dismissSplash()
        if webView === self.webView { hostView.hideCover() }
        showErrorPageIfNeeded(error: error, in: webView)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        dismissSplash()
        if webView === self.webView { hostView.hideCover() }
        showErrorPageIfNeeded(error: error, in: webView)
    }

    private func showErrorPageIfNeeded(error: Error, in webView: WKWebView) {
        guard webView === self.webView else { return }   // chỉ hiện trang lỗi ở WebView đang hiển thị
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
        let isInternal = WebController.isTrustedHost(host)
        if isInternal {
            webView.load(navigationAction.request)
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }
}