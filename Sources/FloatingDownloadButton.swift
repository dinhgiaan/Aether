import SwiftUI

/// Nút tải xuống nổi: nhỏ gọn, kéo thả tự do trên màn hình, nhớ vị trí giữa các lần mở app.
/// Vị trí lưu dạng TỈ LỆ (0...1) trong vùng khả dụng → đúng cả khi xoay máy / đổi kích thước màn hình.
struct FloatingDownloadButton: View {
    /// nil = chưa tải; có giá trị 0...1 = đang tải video hiện tại
    let progress: Double?
    let onTap: () -> Void

    @AppStorage("ae.dlButton.fx") private var storedFX: Double = -1   // -1 = chưa đặt → góc dưới phải
    @AppStorage("ae.dlButton.fy") private var storedFY: Double = -1
    @State private var dragOffset: CGSize = .zero
    @State private var isPressed = false

    private let diameter: CGFloat = 36
    private let margin: CGFloat = 8
    private let tapSlop: CGFloat = 6   // di chuyển ít hơn mức này = chạm, không phải kéo

    var body: some View {
        GeometryReader { geo in
            let area = Bounds(size: geo.size, diameter: diameter, margin: margin)
            let base = area.point(fx: storedFX < 0 ? 1.0 : storedFX,
                                  fy: storedFY < 0 ? 0.90 : storedFY)
            let current = area.clamp(CGPoint(x: base.x + dragOffset.width,
                                             y: base.y + dragOffset.height))

            buttonBody
                .scaleEffect(isPressed ? 0.9 : 1.0)
                .animation(.spring(response: 0.22, dampingFraction: 0.7), value: isPressed)
                .gesture(
                    // minimumDistance 0: tự phân biệt chạm / kéo bằng tapSlop.
                    // Dùng toạ độ .global để translation ổn định dù nút đang di chuyển theo ngón tay (tránh giật).
                    DragGesture(minimumDistance: 0, coordinateSpace: .global)
                        .onChanged { value in
                            isPressed = true
                            dragOffset = value.translation
                        }
                        .onEnded { value in
                            isPressed = false
                            let moved = hypot(value.translation.width, value.translation.height)
                            if moved < tapSlop {
                                dragOffset = .zero
                                onTap()
                            } else {
                                // Chốt vị trí mới (lưu tỉ lệ) rồi xoá offset trong cùng một transaction
                                let final = area.clamp(CGPoint(x: base.x + value.translation.width,
                                                               y: base.y + value.translation.height))
                                let ratio = area.ratio(of: final)
                                var t = Transaction(); t.disablesAnimations = true
                                withTransaction(t) {
                                    storedFX = ratio.x
                                    storedFY = ratio.y
                                    dragOffset = .zero
                                }
                            }
                        }
                )
                // position đặt SAU gesture: vùng chạm chỉ là chính nút, không phủ cả màn hình
                .position(current)
        }
    }

    // MARK: - Giao diện nút (nhỏ, Liquid-Glass)
    private var buttonBody: some View {
        ZStack {
            if let progress {
                Circle()
                    .stroke(Color.white.opacity(0.18), lineWidth: 2.5)
                    .frame(width: diameter - 7, height: diameter - 7)
                Circle()
                    .trim(from: 0, to: CGFloat(min(max(progress, 0), 1)))
                    .stroke(Color.red, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: diameter - 7, height: diameter - 7)
                    .animation(.linear(duration: 0.2), value: progress)
                Text("\(Int(progress * 100))")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            } else {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: diameter, height: diameter)
        // Nền đặc bán trong suốt thay cho .ultraThinMaterial: blur realtime phía trên WebView đang phát video rất tốn GPU
        .background(Color.black.opacity(0.55), in: Circle())
        .overlay(
            Circle().strokeBorder(
                LinearGradient(colors: [.white.opacity(0.35), .white.opacity(0.10)],
                               startPoint: .topLeading, endPoint: .bottomTrailing),
                lineWidth: 0.8)
        )
        .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 3)
        .contentShape(Circle())
    }

    // MARK: - Hình học vùng kéo
    /// Vùng tâm nút được phép nằm trong (đã trừ bán kính + lề) và các phép đổi toạ độ ↔ tỉ lệ
    private struct Bounds {
        let minX: CGFloat, maxX: CGFloat, minY: CGFloat, maxY: CGFloat

        init(size: CGSize, diameter: CGFloat, margin: CGFloat) {
            let inset = diameter / 2 + margin
            minX = inset
            minY = inset
            maxX = max(inset, size.width - inset)
            maxY = max(inset, size.height - inset)
        }

        func point(fx: Double, fy: Double) -> CGPoint {
            CGPoint(x: minX + (maxX - minX) * CGFloat(fx),
                    y: minY + (maxY - minY) * CGFloat(fy))
        }

        func clamp(_ p: CGPoint) -> CGPoint {
            CGPoint(x: min(max(p.x, minX), maxX), y: min(max(p.y, minY), maxY))
        }

        func ratio(of p: CGPoint) -> (x: Double, y: Double) {
            let w = maxX - minX, h = maxY - minY
            return (w > 0 ? Double((p.x - minX) / w) : 1,
                    h > 0 ? Double((p.y - minY) / h) : 1)
        }
    }
}
