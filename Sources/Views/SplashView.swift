import SwiftUI

// MARK: – Splash giống app YouTube gốc: nền tối + logo ở giữa, mờ dần khi trang đã sẵn sàng
struct SplashView: View {
    let isPageReady: Bool          // trang YouTube đã render feed chưa
    let onFinished: () -> Void

    // Cùng màu nền với trang YouTube dark (#0f0f0f) để lúc chuyển sang WebView không bị lệch màu
    private let background = Color(red: 15 / 255, green: 15 / 255, blue: 15 / 255)
    // Logo luôn hiện tối thiểu chừng này, tránh nháy nếu trang load quá nhanh
    private let minimumDisplayTime: TimeInterval = 0.6

    @State private var logoScale: CGFloat = 0.92
    @State private var logoOpacity: Double = 0.0
    @State private var introDone = false   // đã hiện đủ thời gian tối thiểu
    @State private var exiting = false     // đã bắt đầu thoát (chặn gọi onFinished 2 lần)
    @State private var totalOpacity: Double = 1.0

    var body: some View {
        ZStack {
            background
                .ignoresSafeArea()

            // Logo nằm trong Assets.xcassets/YouTubeLogo.imageset (nguồn: Design/logo-app.svg)
            Image("YouTubeLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96)
                .scaleEffect(logoScale)
                .opacity(logoOpacity)
        }
        .opacity(totalOpacity)
        .contentShape(Rectangle())
        .onTapGesture {
            finish(after: 0.2, duration: 0.2)   // chạm để bỏ qua splash
        }
        .onAppear {
            runIntro()
        }
        .onChange(of: isPageReady) { _, _ in tryExit() }
    }

    /// Logo hiện nhẹ và phóng về đúng cỡ, sau đó chờ đủ thời gian tối thiểu
    private func runIntro() {
        withAnimation(.easeOut(duration: 0.3)) {
            logoScale = 1.0
            logoOpacity = 1.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + minimumDisplayTime) {
            introDone = true
            tryExit()
        }
    }

    /// Chỉ thoát khi đã hiện đủ thời gian tối thiểu VÀ trang YouTube đã vẽ feed (tránh lộ WebView trắng)
    private func tryExit() {
        guard introDone, isPageReady else { return }
        finish(after: 0.3, duration: 0.25)
    }

    /// Mờ dần rồi báo ra ngoài. `exiting` đảm bảo onFinished chỉ chạy 1 lần,
    /// kể cả khi người dùng chạm bỏ qua đúng lúc trang vừa sẵn sàng.
    private func finish(after delay: TimeInterval, duration: TimeInterval) {
        guard !exiting else { return }
        exiting = true
        withAnimation(.easeOut(duration: duration)) {
            totalOpacity = 0.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            onFinished()
        }
    }
}
