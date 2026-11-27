import SwiftUI

// MARK: – Cinematic Netflix-Style Splash Intro
struct NetflixSplashView: View {
    let isPageReady: Bool          // trang YouTube đã render feed chưa
    let onFinished: () -> Void

    @State private var emblemScale: CGFloat = 0.55
    @State private var emblemOpacity: Double = 0.0
    @State private var shockwaveScale: CGFloat = 0.8
    @State private var shockwaveOpacity: Double = 0.0
    @State private var beamHeight: CGFloat = 0.0
    @State private var beamOpacity: Double = 0.0
    @State private var introDone = false   // animation giới thiệu đã chạy xong
    @State private var exiting = false     // đã bắt đầu thoát
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
                .blur(radius: 24)   // cố định: animate bán kính blur buộc vẽ lại mỗi frame, rất dễ rớt khung
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

                // Chữ "Aether": viết hoa chữ đầu, liền nét (không in hoa toàn bộ, không giãn chữ)
                VStack(spacing: 6) {
                    Text("Aether")
                        .font(.system(size: 34, weight: .heavy, design: .rounded))
                        .tracking(0.5)
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
        .onChange(of: isPageReady) { _, _ in tryExit() }
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
            }
            withAnimation(.easeIn(duration: 0.35).delay(0.2)) {
                shockwaveOpacity = 0.0
                beamOpacity = 0.0
            }
        }

        // Intro xong ở ~0.82s. Trước đây ở mốc này splash tự mờ đi bất kể trang đã load chưa → lộ WebView trắng.
        // Giờ chỉ thoát khi trang đã sẵn sàng (tryExit kiểm tra cả hai điều kiện).
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.82) {
            introDone = true
            tryExit()
        }
    }

    /// Giai đoạn 3: zoom xuyên qua logo rồi mờ dần → chỉ chạy khi intro xong VÀ trang YouTube đã render
    private func tryExit() {
        guard introDone, isPageReady, !exiting else { return }
        exiting = true
        withAnimation(.easeInOut(duration: 0.32)) {
            zoomThrough = 1.35
            totalOpacity = 0.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            onFinished()
        }
    }
}
