import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()
    @ObservedObject private var offlineManager = OfflineManager.shared

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.black.ignoresSafeArea()

            WebViewContainer(webView: web.webView)
                .ignoresSafeArea(edges: .bottom)

            // Nút Back / Thu nhỏ video (Góc trên bên trái khi đang xem video)
            if web.isWatching {
                VStack {
                    HStack {
                        Button {
                            Haptic.feedback(.light)
                            web.goBackToHome()
                        } label: {
                            Image(systemName: "chevron.down")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 38, height: 38)
                                .background(.ultraThinMaterial, in: Circle())
                                .overlay(Circle().strokeBorder(.white.opacity(0.2), lineWidth: 0.5))
                                .shadow(color: .black.opacity(0.3), radius: 6)
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.leading, 16)
                        .padding(.top, 50)
                        Spacer()
                    }
                    Spacer()
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
                .zIndex(6)
            }

            // Nút Thư viện Ngoại Tuyến (Góc trên bên phải khi ở trang chủ)
            if !web.isWatching && !web.isInitialLoading {
                VStack {
                    HStack {
                        Spacer()
                        Button {
                            Haptic.feedback(.light)
                            web.showOfflineLibrary = true
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "arrow.down.circle.fill")
                                    .font(.system(size: 15, weight: .semibold))
                                if !offlineManager.downloadedVideos.isEmpty {
                                    Text("\(offlineManager.downloadedVideos.count)")
                                        .font(.system(size: 12, weight: .bold))
                                        .contentTransition(.numericText())
                                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: offlineManager.downloadedVideos.count)
                                }
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.ultraThinMaterial, in: Capsule())
                            .overlay(Capsule().strokeBorder(.white.opacity(0.2), lineWidth: 0.5))
                            .shadow(color: .black.opacity(0.25), radius: 6)
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.trailing, 16)
                        .padding(.top, 50)
                    }
                    Spacer()
                }
                .transition(.opacity)
                .zIndex(6)
            }

            // Thanh công cụ nổi góc dưới phải (PiP + Tải xuống) khi xem video
            if web.isWatching {
                HStack(spacing: 8) {
                    // Nút Tải xuống video
                    Button {
                        Haptic.feedback(.medium)
                        web.requestDownload()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.down.to.line")
                                .font(.system(size: 13, weight: .semibold))
                            Text("Tải")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay(
                            Capsule().strokeBorder(
                                LinearGradient(
                                    colors: [.white.opacity(0.28), .white.opacity(0.08)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 0.6
                            )
                        )
                    }
                    .buttonStyle(ScaleButtonStyle())

                    // Nút PiP
                    PiPButton(action: {
                        Haptic.feedback(.light)
                        web.togglePiP()
                    })
                }
                .padding(.trailing, 16)
                .safeAreaPadding(.bottom)
                .padding(.bottom, 10)
                .transition(
                    .scale(scale: 0.6, anchor: .bottomTrailing)
                    .combined(with: .opacity)
                )
                .zIndex(5)
            }

            // Splash Screen: hiển thị khi mở app, tự động biến mất siêu nhanh khi trang sẵn sàng
            if web.isInitialLoading {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
                    .ignoresSafeArea()
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: web.isWatching)
        .animation(.easeInOut(duration: 0.3), value: web.isInitialLoading)
        .task { await web.start() }
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
                        thumbnailURLString: info.thumbnailURL
                    )
                    web.showDownloadSheet = false
                }
                .presentationDetents([.medium])
            }
        }
        // Sheet danh sách video đã tải ngoại tuyến
        .sheet(isPresented: $web.showOfflineLibrary) {
            OfflineLibraryView()
        }
    }
}

// MARK: – Sheet chọn chất lượng tải xuống
private struct DownloadQualitySheet: View {
    let info: VideoDownloadInfo
    let onSelect: (StreamOption) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color(white: 0.08).ignoresSafeArea()
                
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(info.title)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        Text(info.author)
                            .font(.subheadline)
                            .foregroundStyle(.gray)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.top, 12)
                    
                    Text("CHỌN CHẤT LƯỢNG TẢI:")
                        .font(.caption)
                        .foregroundStyle(.gray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                    
                    VStack(spacing: 10) {
                        if info.streams.isEmpty {
                            Text("Không tìm thấy luồng tải trực tiếp cho video này.")
                                .font(.subheadline)
                                .foregroundStyle(.gray)
                                .padding()
                        } else {
                            ForEach(info.streams) { stream in
                                Button {
                                    onSelect(stream)
                                } label: {
                                    HStack {
                                        Image(systemName: "video.fill")
                                            .foregroundStyle(.red)
                                        Text(stream.quality)
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(.white)
                                        Spacer()
                                        Text(stream.audioURL != nil ? "Ghép Native HD" : "Trực tiếp")
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.white.opacity(0.12), in: Capsule())
                                            .foregroundStyle(.white.opacity(0.8))
                                        Image(systemName: "arrow.down.circle.fill")
                                            .foregroundStyle(.red)
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer()
                }
            }
            .navigationTitle("Tải Video Ngoại Tuyến")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Hủy") { dismiss() }
                        .foregroundStyle(.gray)
                }
            }
        }
        .preferredColorScheme(.dark)
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
                    .font(.system(size: 13, weight: .semibold))
                    .symbolEffect(.bounce, value: pressed)
                Text("PiP")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
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
            .scaleEffect(pressed ? 0.90 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: pressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded   { _ in pressed = false }
        )
    }
}

// MARK: – Splash / loading screen
private struct SplashView: View {
    @State private var scale: CGFloat = 0.85
    @State private var glowOpacity: Double = 0.0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            Circle()
                .fill(Color.red.opacity(0.22))
                .frame(width: 130, height: 130)
                .blur(radius: 36)
                .opacity(glowOpacity)

            VStack(spacing: 16) {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 68))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(red: 1, green: 0.2, blue: 0.15),
                                     Color(red: 0.85, green: 0, blue: 0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(scale)
                    .shadow(color: .red.opacity(0.45), radius: 24, y: 8)

                Text("Aether")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))
                    .opacity(glowOpacity)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.68)) {
                scale = 1.0
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.1)) {
                glowOpacity = 1.0
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

// MARK: – Haptic Feedback Helper
private enum Haptic {
    static func feedback(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
}

// MARK: – Tactile Spring Button Style
private struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.90 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.65), value: configuration.isPressed)
    }
}
