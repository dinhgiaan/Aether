import SwiftUI

/// Banner tiến trình tải nổi ở góc trên.
/// - Vuốt lên hoặc sang ngang để ẩn (banner chỉ hiện lại khi có video mới).
/// - Nút ✕ để hủy tải (ẩn khi đã hoàn tất).
struct DownloadProgressBanner: View {
    let progress: Double
    let title: String
    let status: String
    let onOpen: () -> Void
    let onCancel: () -> Void
    let onDismiss: () -> Void

    @State private var drag: CGSize = .zero

    private let dismissDistance: CGFloat = 36   // vuốt lên quá mức này → ẩn
    private let dismissSide: CGFloat = 90       // vuốt ngang quá mức này → ẩn
    private var isFinished: Bool { progress >= 1.0 }

    var body: some View {
        VStack {
            HStack(spacing: 12) {
                ringView

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(status)
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.7))
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Button(action: onOpen) {
                    Text("Xem")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.18), in: Capsule())
                }

                if !isFinished {
                    Button(action: onCancel) {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white.opacity(0.85))
                            .frame(width: 26, height: 26)
                            .background(Color.white.opacity(0.12), in: Circle())
                    }
                    .accessibilityLabel("Hủy tải")
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            // Nền đặc bán trong suốt thay cho .ultraThinMaterial: blur realtime phía trên WebView đang phát video rất tốn GPU
            .background(Color(white: 0.1).opacity(0.94), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.white.opacity(0.22), lineWidth: 0.6))
            .shadow(color: .black.opacity(0.4), radius: 6, y: 3)
            .padding(.horizontal, 16)
            .padding(.top, 48)
            .offset(x: drag.width, y: min(0, drag.height))      // chỉ cho kéo lên, không kéo xuống
            .opacity(1 - min(0.6, Double(max(abs(drag.width) / 260, -drag.height / 160))))
            .gesture(dismissGesture)

            Spacer()
        }
    }

    // MARK: – Vòng tiến trình
    private var ringView: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.18), lineWidth: 3)
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
    }

    // MARK: – Cử chỉ vuốt để ẩn
    private var dismissGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { drag = $0.translation }
            .onEnded { value in
                let shouldDismiss = value.translation.height < -dismissDistance
                    || abs(value.translation.width) > dismissSide
                if shouldDismiss {
                    onDismiss()
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { drag = .zero }
                }
            }
    }
}
