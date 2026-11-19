import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.black.ignoresSafeArea()

            WebViewContainer(webView: web.webView)
                .ignoresSafeArea(edges: .bottom)

            // Splash: hiện khi app vừa mở, ẩn khi trang đầu load xong
            if web.isInitialLoading {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
                    .ignoresSafeArea()
            }

            // PiP button: chỉ hiện khi đang xem video /watch
            if web.isWatching {
                PiPButton(action: web.togglePiP)
                    .transition(
                        .scale(scale: 0.5, anchor: .bottomTrailing)
                        .combined(with: .opacity)
                    )
                    .zIndex(5)
            }
        }
        // Spring animation cho PiP button in/out
        .animation(
            .spring(response: 0.38, dampingFraction: 0.72, blendDuration: 0),
            value: web.isWatching
        )
        // Fade cho splash screen
        .animation(.easeInOut(duration: 0.45), value: web.isInitialLoading)
        .task { await web.start() }
    }
}

// MARK: – Liquid-Glass PiP button
private struct PiPButton: View {
    let action: () -> Void
    @State private var pressed = false

    var body: some View {
        Button {
            action()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "pip.enter")
                    .font(.system(size: 14, weight: .semibold))
                    .symbolEffect(.bounce, value: pressed)
                Text("PiP")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 15)
            .padding(.vertical, 11)
            // Glass material — tự blend với nội dung phía sau
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.28), .white.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.6
                    )
            )
            // Spring scale khi nhấn
            .scaleEffect(pressed ? 0.90 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: pressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded   { _ in pressed = false }
        )
        .padding(.trailing, 16)
        .safeAreaPadding(.bottom)
        .padding(.bottom, 10)
    }
}

// MARK: – Splash / loading screen
private struct SplashView: View {
    @State private var scale: CGFloat = 0.82
    @State private var glowOpacity: Double = 0.0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Glow halo phía sau icon
            Circle()
                .fill(Color.red.opacity(0.18))
                .frame(width: 120, height: 120)
                .blur(radius: 32)
                .opacity(glowOpacity)

            VStack(spacing: 16) {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(red: 1, green: 0.15, blue: 0.1),
                                     Color(red: 0.9, green: 0, blue: 0)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(scale)
                    .shadow(color: .red.opacity(0.4), radius: 20, y: 6)

                Text("Aether")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.88))
                    .opacity(glowOpacity)
            }
        }
        .onAppear {
            // Entrance pop
            withAnimation(.spring(response: 0.5, dampingFraction: 0.62)) {
                scale = 1.0
            }
            // Fade in label + glow
            withAnimation(.easeOut(duration: 0.6).delay(0.15)) {
                glowOpacity = 1.0
            }
            // Pulse breath loop
            withAnimation(
                .easeInOut(duration: 1.1)
                .repeatForever(autoreverses: true)
                .delay(0.5)
            ) {
                scale = 1.07
            }
        }
    }
}

// MARK: – WKWebView wrapper
struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
