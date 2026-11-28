import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()
    // Không quan sát OfflineManager trực tiếp: tiến trình tải cập nhật rất dày → ContentView bị dựng lại liên tục.
    // DownloadUIState gom lại còn ≤ ~7 lần/giây.
    @ObservedObject private var downloads = DownloadUIState.shared
    private let offlineManager = OfflineManager.shared
    @State private var showSplash = true
    /// Các video người dùng đã vuốt ẩn banner (banner hiện lại khi có video mới)
    @State private var dismissedBannerIDs: Set<String> = []

    /// Tab hiển thị trên thanh: đang mở màn hình Đã tải thì là Đã tải, ngược lại theo trang YouTube
    private var displayedTab: AppTab { web.showOfflineLibrary ? .downloads : web.selectedTab }

    private func handleTabSelect(_ tab: AppTab) {
        if tab == .downloads {
            guard !web.showOfflineLibrary else { return }
            withAnimation(.easeInOut(duration: 0.25)) { web.showOfflineLibrary = true }
            return
        }
        if web.showOfflineLibrary {
            withAnimation(.easeInOut(duration: 0.25)) { web.showOfflineLibrary = false }
            // Trang YouTube phía sau đã đang ở đúng tab → chỉ cần đóng thư viện
            if tab != web.selectedTab || web.isWatching { web.openTab(tab) }
        } else if tab == web.selectedTab {
            web.scrollToTop()          // bấm lại tab đang chọn: chỉ cuộn lên đầu, không tải lại
        } else {
            web.openTab(tab)
        }
    }

    /// Video đầu tiên đang tải mà chưa bị ẩn banner
    private var bannerID: String? {
        downloads.activeIDs.first { !dismissedBannerIDs.contains($0) }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            // Cử chỉ vuốt xuống từ video được xử lý trong JS (Resources/ui/watch.js) để có user gesture khi bật PiP
            // Host view giữ mọi WKWebView cố định → hoán đổi PiP chỉ đổi z-order, không dựng lại view (hết nháy)
            WebViewContainer(host: web.hostView)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(edges: web.isFullscreen ? .all : .bottom)   // xoay ngang: phủ kín cả tai thỏ, không còn viền đen 2 bên

            // Nút Back native phủ lên mũi tên ← của header khi tìm kiếm (/results hoặc lớp phủ tìm kiếm).
            // Root cause "bấm Back không được": chạm trong WebView bị YouTube/WKWebView nuốt → dùng lớp native bắt chạm trước.
            if web.isSearching && !web.isWatching && !web.isFullscreen && !web.showOfflineLibrary {
                Color.clear
                    .frame(width: 52, height: 56)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        Haptic.feedback(.light)
                        web.goBackFromSearch()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .zIndex(12)
                    .accessibilityLabel("Quay lại")
            }

            // Nút Tải video nổi: nhỏ gọn, kéo thả tự do, nhớ vị trí
            // Bọc Group để animation CHỈ áp cho nút (trước đây .animation gắn cả ZStack → WebView bị animate khi xoay → giật)
            Group {
            if web.isWatching && !web.isFullscreen {
                let currentVidId = web.extractCurrentVideoId() ?? ""
                let progress = downloads.progress[currentVidId]

                FloatingDownloadButton(progress: progress) {
                    Haptic.feedback(.medium)
                    if progress != nil {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                            web.showOfflineLibrary = true
                        }
                    } else {
                        web.requestDownload()
                    }
                }
                .transition(.scale.combined(with: .opacity))
                .zIndex(10)
            }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.75), value: web.isWatching && !web.isFullscreen)

            // Banner tiến trình tải: vuốt lên/sang ngang để ẩn, có nút Hủy.
            // activeIDs đã sắp xếp: trước đây .keys.first đổi ngẫu nhiên giữa các video khi tải nhiều cái cùng lúc
            if let activeId = bannerID, let progress = downloads.progress[activeId] {
                DownloadProgressBanner(
                    progress: progress,
                    title: downloads.titles[activeId] ?? "Đang tải video...",
                    status: downloads.status[activeId] ?? "\(Int(progress * 100))%",
                    onOpen: {
                        Haptic.feedback(.light)
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                            web.showOfflineLibrary = true
                        }
                    },
                    onCancel: {
                        Haptic.feedback(.light)
                        offlineManager.cancelDownload(videoId: activeId)
                    },
                    onDismiss: { dismissedBannerIDs.insert(activeId) }
                )
                .id(activeId)   // đổi video → dựng lại banner (reset offset kéo)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(15)
            }

            // Màn hình Thư viện Ngoại Tuyến toàn trang (Dedicated Full Page)
            if web.showOfflineLibrary {
                OfflineLibraryView()
                    .transition(.opacity)
                    .zIndex(20)
                    .ignoresSafeArea()
            }

            // Thanh tab native: dùng chung cho trang YouTube và màn hình Đã tải. Nằm trên thư viện (20), dưới splash (30)
            VStack(spacing: 0) {
                Spacer()
                NativeTabBar(selected: displayedTab, onSelect: handleTabSelect)
                    .offset(y: web.isTabBarVisible ? 0 : 140)
                    .opacity(web.isTabBarVisible ? 1 : 0)
                    .allowsHitTesting(web.isTabBarVisible)
            }
            .zIndex(25)
            .animation(.spring(response: 0.38, dampingFraction: 0.85), value: web.isTabBarVisible)

            // Splash giống app YouTube gốc: hiển thị khi mở app, tự động biến mất mượt mà
            if showSplash {
                // isPageReady: splash chỉ thoát khi đã hiện đủ thời gian tối thiểu VÀ trang YouTube đã vẽ feed
                SplashView(isPageReady: !web.isInitialLoading) {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        showSplash = false
                        web.dismissSplash()
                    }
                }
                .transition(.opacity)
                .zIndex(30)
                .ignoresSafeArea()
            }
        }
        .statusBarHidden(web.isFullscreen)
        .animation(.easeInOut(duration: 0.3), value: showSplash)
        .animation(.spring(response: 0.35, dampingFraction: 0.82), value: bannerID)
        // Dọn danh sách đã ẩn khi video đó tải xong/bị hủy
        .onChange(of: downloads.activeIDs) { _, ids in
            dismissedBannerIDs.formIntersection(ids)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.82), value: web.showOfflineLibrary)
        .task {
            web.start()
            // Bảo hiểm: mạng quá chậm / môi trường LiveContainer → sau 4s vẫn cho vào app.
            // Gọi dismissSplash() để isInitialLoading đổi → splash tự chạy animation thoát (không tắt cái "phựt")
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            web.dismissSplash()
        }
        // Sheet chọn chất lượng tải xuống
        .sheet(isPresented: $web.showDownloadSheet) {
            if let info = web.activeDownloadInfo {
                DownloadQualitySheet(info: info) { chosenStream in
                    offlineManager.startDownload(
                        videoId: info.id,
                        title: info.title,
                        author: info.author,
                        quality: chosenStream.quality,
                        duration: info.duration,
                        streamURLString: chosenStream.url,
                        audioURLString: chosenStream.audioURL,
                        thumbnailURLString: info.thumbnailURL,
                        userAgent: chosenStream.userAgent,
                        clientName: chosenStream.clientName,
                        isHLS: chosenStream.isHLS
                    )
                    web.showDownloadSheet = false
                }
                .presentationDetents([.medium])
            }
        }
    }
}

