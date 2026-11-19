import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()
    @ObservedObject private var offlineManager = OfflineManager.shared
    @State private var showSplash = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            WebViewContainer(webView: web.webView)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(edges: .bottom)

            // Thanh điều khiển Video Player (Back bên trái + Tải & PiP bên phải)
            if web.isWatching {
                VStack {
                    HStack {
                        Button {
                            Haptic.feedback(.light)
                            web.goBackToHome()
                        } label: {
                            Image(systemName: "chevron.down")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 36, height: 36)
                                .background(.ultraThinMaterial, in: Circle())
                                .overlay(Circle().strokeBorder(.white.opacity(0.2), lineWidth: 0.5))
                                .shadow(color: .black.opacity(0.35), radius: 6)
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.leading, 14)

                        Spacer()

                        HStack(spacing: 8) {
                            Button {
                                Haptic.feedback(.medium)
                                web.requestDownload()
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: "arrow.down.to.line")
                                        .font(.system(size: 12, weight: .bold))
                                    Text("Tải")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundStyle(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(.ultraThinMaterial, in: Capsule())
                                .overlay(Capsule().strokeBorder(.white.opacity(0.22), lineWidth: 0.5))
                                .shadow(color: .black.opacity(0.3), radius: 6)
                            }
                            .buttonStyle(ScaleButtonStyle())

                            PiPButton(action: {
                                Haptic.feedback(.light)
                                web.togglePiP()
                            })
                        }
                        .padding(.trailing, 14)
                    }
                    .padding(.top, 50)

                    Spacer()
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
                .zIndex(6)
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
                NetflixSplashView {
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
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: web.isWatching)
        .animation(.easeInOut(duration: 0.3), value: showSplash)
        .animation(.spring(response: 0.35, dampingFraction: 0.82), value: web.showOfflineLibrary)
        .task {
            web.start()
            // Bảo hiểm: sau 1.35s bắt buộc tắt splash dù bất kể mạng hay môi trường LiveContainer
            try? await Task.sleep(nanoseconds: 1_350_000_000)
            if showSplash {
                withAnimation(.easeInOut(duration: 0.3)) {
                    showSplash = false
                    web.dismissSplash()
                }
            }
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
                        thumbnailURLString: info.thumbnailURL
                    )
                    web.showDownloadSheet = false
                }
                .presentationDetents([.medium])
            }
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

// MARK: – Cinematic Netflix-Style Splash Intro
private struct NetflixSplashView: View {
    let onFinished: () -> Void

    @State private var emblemScale: CGFloat = 0.55
    @State private var emblemOpacity: Double = 0.0
    @State private var shockwaveScale: CGFloat = 0.8
    @State private var shockwaveOpacity: Double = 0.0
    @State private var beamHeight: CGFloat = 0.0
    @State private var beamOpacity: Double = 0.0
    @State private var glowRadius: CGFloat = 10.0
    @State private var zoomThrough: CGFloat = 1.0
    @State private var totalOpacity: Double = 1.0

    var body: some View {
        ZStack {
            // Nền đen điện ảnh sâu
            Color(red: 0.04, green: 0.04, blue: 0.06)
                .ignoresSafeArea()

            // Dải ruy-băng ánh sáng đa sắc phong cách Netflix (Vertical Ribbon Beams)
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [Color.clear, Color(red: 0.98, green: 0.72, blue: 0.15), Color.clear], startPoint: .top, endPoint: .bottom))
                    .frame(width: 4, height: beamHeight * 0.7)
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [Color.clear, Color(red: 0.95, green: 0.35, blue: 0.18), Color.clear], startPoint: .top, endPoint: .bottom))
                    .frame(width: 6, height: beamHeight * 0.9)
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [Color.clear, Color(red: 0.95, green: 0.15, blue: 0.25), Color.clear], startPoint: .top, endPoint: .bottom))
                    .frame(width: 8, height: beamHeight)
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [Color.clear, Color(red: 0.85, green: 0.08, blue: 0.35), Color.clear], startPoint: .top, endPoint: .bottom))
                    .frame(width: 6, height: beamHeight * 0.85)
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [Color.clear, Color(red: 0.65, green: 0.15, blue: 0.85), Color.clear], startPoint: .top, endPoint: .bottom))
                    .frame(width: 4, height: beamHeight * 0.65)
            }
            .opacity(beamOpacity)
            .blur(radius: 6)

            // Vòng sóng xung kích phát sáng bùng nổ (Shockwave Ripple)
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [Color(red: 0.98, green: 0.72, blue: 0.15),
                                 Color(red: 0.95, green: 0.25, blue: 0.25)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 3
                )
                .frame(width: 100, height: 100)
                .scaleEffect(shockwaveScale)
                .opacity(shockwaveOpacity)

            // Vùng sáng quang sai trung tâm
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(red: 0.95, green: 0.35, blue: 0.15).opacity(0.45),
                                 Color.clear],
                        center: .center,
                        startRadius: 10,
                        endRadius: 110
                    )
                )
                .frame(width: 220, height: 220)
                .blur(radius: glowRadius)
                .opacity(emblemOpacity)

            // Biểu tượng trung tâm Celestial Eclipse + Chữ Aether
            VStack(spacing: 24) {
                ZStack {
                    // Vòng mặt trời nhật thực
                    Circle()
                        .strokeBorder(
                            AngularGradient(
                                colors: [
                                    Color(red: 0.98, green: 0.72, blue: 0.15),
                                    Color(red: 0.95, green: 0.25, blue: 0.25),
                                    Color(red: 0.75, green: 0.10, blue: 0.20),
                                    Color(red: 0.98, green: 0.72, blue: 0.15)
                                ],
                                center: .center
                            ),
                            lineWidth: 5.5
                        )
                        .frame(width: 82, height: 82)
                        .shadow(color: Color(red: 0.95, green: 0.35, blue: 0.15).opacity(0.65), radius: 18)

                    // Tam giác Play phát sáng
                    Image(systemName: "play.fill")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.white)
                        .offset(x: 3)
                        .shadow(color: .white.opacity(0.5), radius: 8)
                }
                .scaleEffect(emblemScale)
                .opacity(emblemOpacity)

                // Typography điện ảnh: A E T H E R
                VStack(spacing: 6) {
                    Text("A E T H E R")
                        .font(.system(size: 22, weight: .heavy, design: .rounded))
                        .tracking(8)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, Color(white: 0.82)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .shadow(color: Color(red: 0.95, green: 0.35, blue: 0.15).opacity(0.5), radius: 14)
                }
                .opacity(emblemOpacity)
            }
            .scaleEffect(zoomThrough)
        }
        .opacity(totalOpacity)
        .contentShape(Rectangle())
        .onTapGesture {
            dismissImmediately()
        }
        .onAppear {
            runNetflixSequence()
        }
    }

    private func dismissImmediately() {
        withAnimation(.easeOut(duration: 0.2)) {
            totalOpacity = 0.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            onFinished()
        }
    }

    private func runNetflixSequence() {
        // Giai đoạn 1 (0.0s - 0.32s): Logo xuất hiện từ không gian sâu
        withAnimation(.spring(response: 0.42, dampingFraction: 0.68)) {
            emblemScale = 1.0
            emblemOpacity = 1.0
        }

        // Giai đoạn 2 (0.32s - 0.75s): Vụ nổ ánh sáng dải ruy-băng "Ta-Dum"
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            Haptic.feedback(.medium)
            withAnimation(.easeOut(duration: 0.45)) {
                shockwaveScale = 3.6
                shockwaveOpacity = 0.8
                beamHeight = 280
                beamOpacity = 0.9
                glowRadius = 35
            }
            withAnimation(.easeIn(duration: 0.35).delay(0.2)) {
                shockwaveOpacity = 0.0
                beamOpacity = 0.0
            }
        }

        // Giai đoạn 3 (0.85s - 1.15s): Zoom xuyên qua logo mở màn hình chính YouTube
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.82) {
            withAnimation(.easeInOut(duration: 0.32)) {
                zoomThrough = 1.35
                totalOpacity = 0.0
            }
        }

        // Hoàn tất và dỡ bỏ Splash Screen hoàn toàn
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            onFinished()
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
