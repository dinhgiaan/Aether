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
                OfflineLibraryView(onBack: {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                        web.showOfflineLibrary = false
                    }
                })
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing),
                    removal: .move(edge: .trailing)
                ))
                .zIndex(20)
                .ignoresSafeArea()
            }

            // Cinematic Netflix-Style Splash Screen: hiển thị khi mở app, tự động biến mất mượt mà
            if showSplash {
                // isPageReady: splash chỉ thoát khi intro chạy xong VÀ trang YouTube đã vẽ feed
                NetflixSplashView(isPageReady: !web.isInitialLoading) {
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

