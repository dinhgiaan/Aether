import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()
    @ObservedObject private var offlineManager = OfflineManager.shared
    @State private var showSplash = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            WebViewContainer(webView: web.webView, onSwipeDown: {
                if web.isWatching {
                    Haptic.feedback(.medium)
                    web.handleSwipeDown()
                }
            })
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(edges: .bottom)

            // Nút Tải video nổi ở góc dưới bên phải khi đang xem video (Icon only, chuẩn Liquid-Glass)
            if web.isWatching {
                let currentVidId = web.extractCurrentVideoId() ?? ""
                let isDownloadingCurrent = offlineManager.activeDownloadProgress[currentVidId] != nil
                let currentProgress = offlineManager.activeDownloadProgress[currentVidId] ?? 0.0

                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            Haptic.feedback(.medium)
                            if isDownloadingCurrent {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                    web.showOfflineLibrary = true
                                }
                            } else {
                                web.requestDownload()
                            }
                        } label: {
                            ZStack {
                                if isDownloadingCurrent {
                                    Circle()
                                        .trim(from: 0, to: CGFloat(currentProgress))
                                        .stroke(Color.red, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                                        .rotationEffect(.degrees(-90))
                                        .frame(width: 38, height: 38)
                                        .animation(.linear(duration: 0.2), value: currentProgress)
                                    
                                    Text("\(Int(currentProgress * 100))%")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(.white)
                                } else {
                                    Image(systemName: "arrow.down.to.line")
                                        .font(.system(size: 19, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                            .frame(width: 48, height: 48)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(
                                Circle()
                                    .strokeBorder(
                                        LinearGradient(
                                            colors: [.white.opacity(0.35), .white.opacity(0.10)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        ),
                                        lineWidth: 0.8
                                    )
                            )
                            .shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 4)
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.trailing, 20)
                        .padding(.bottom, 24)
                    }
                }
                .transition(.scale.combined(with: .opacity))
                .zIndex(10)
            }

            // Thanh thông báo tiến trình tải video thời gian thực nổi ở góc trên
            if let activeId = offlineManager.activeDownloadProgress.keys.first,
               let progress = offlineManager.activeDownloadProgress[activeId] {
                VStack {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .stroke(Color.white.opacity(0.18), lineWidth: 3)
                            Circle()
                                .trim(from: 0, to: CGFloat(progress))
                                .stroke(Color.red, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                                .animation(.linear(duration: 0.2), value: progress)
                            Text("\(Int(progress * 100))%")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 32, height: 32)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(offlineManager.activeDownloadTitles[activeId] ?? "Đang tải video...")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(offlineManager.activeDownloadStatus[activeId] ?? "\(Int(progress * 100))%")
                                .font(.system(size: 11))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                        
                        Spacer()
                        
                        Button {
                            Haptic.feedback(.light)
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                web.showOfflineLibrary = true
                            }
                        } label: {
                            Text("Xem")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.18), in: Capsule())
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.white.opacity(0.22), lineWidth: 0.6))
                    .shadow(color: .black.opacity(0.45), radius: 10, y: 5)
                    .padding(.horizontal, 16)
                    .padding(.top, 48)

                    Spacer()
                }
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

// MARK: – WKWebView wrapper với bộ nhận diện vuốt xuống Native 120Hz
struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView
    let onSwipeDown: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSwipeDown: onSwipeDown)
    }

    func makeUIView(context: Context) -> WKWebView {
        let swipe = UISwipeGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleSwipe))
        swipe.direction = .down
        swipe.delegate = context.coordinator
        webView.addGestureRecognizer(swipe)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onSwipeDown = onSwipeDown
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onSwipeDown: () -> Void
        init(onSwipeDown: @escaping () -> Void) {
            self.onSwipeDown = onSwipeDown
        }

        @objc func handleSwipe(_ gesture: UISwipeGestureRecognizer) {
            guard let wv = gesture.view as? WKWebView else { return }
            // Kích hoạt khi người dùng đang ở phần đầu video
            if wv.scrollView.contentOffset.y <= 25 {
                onSwipeDown()
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            return true
        }
    }
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