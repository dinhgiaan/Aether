import SwiftUI

/// 4 tab của thanh điều hướng dưới. "Đã tải" mở màn hình native, 3 tab còn lại điều hướng trang YouTube.
enum AppTab: String, CaseIterable, Identifiable {
    case home, subs, downloads, you

    var id: String { rawValue }

    /// Khóa dùng chung với JS (Resources/ui/nav.js: currentKey / __aeGoTab)
    var key: String { rawValue }

    static func fromKey(_ key: String) -> AppTab? {
        AppTab.allCases.first { $0.key == key && $0 != .downloads }
    }

    var icon: String {
        switch self {
        case .home:      return "house"
        case .subs:      return "play.square.stack"
        case .downloads: return "arrow.down.circle"
        case .you:       return "person.crop.circle"
        }
    }

    var selectedIcon: String { icon + ".fill" }

    var title: String {
        switch self {
        case .home:      return "Trang chủ"
        case .subs:      return "Đăng ký"
        case .downloads: return "Đã tải"
        case .you:       return "Bạn"
        }
    }

    /// URL dự phòng khi không bấm hộ được tab của YouTube bằng JS
    var fallbackURL: URL? {
        switch self {
        case .home:      return URL(string: "https://m.youtube.com/")
        case .subs:      return URL(string: "https://m.youtube.com/feed/subscriptions")
        case .you:       return URL(string: "https://m.youtube.com/feed/you")
        case .downloads: return nil
        }
    }
}

/// Thanh tab dạng capsule nổi (kiểu iOS 26), chỉ icon; pill nền trượt theo tab đang chọn.
/// Vẽ bằng SwiftUI thay vì trong trang web: phần tử fixed trong WebKit bị nảy khi trang đang tải.
struct NativeTabBar: View {
    let selected: AppTab
    let onSelect: (AppTab) -> Void

    @Namespace private var pillNamespace

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                Button { onSelect(tab) } label: {
                    Image(systemName: tab == selected ? tab.selectedIcon : tab.icon)
                        .font(.system(size: 22))
                        .foregroundStyle(.white.opacity(tab == selected ? 1 : 0.7))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background {
                            if tab == selected {
                                // matchedGeometryEffect: cùng một pill "di chuyển" sang tab mới thay vì mờ đi rồi hiện lại
                                Capsule()
                                    .fill(Color.white.opacity(0.16))
                                    .matchedGeometryEffect(id: "pill", in: pillNamespace)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(TabPressStyle())
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(tab == selected ? .isSelected : [])
            }
        }
        .padding(4)
        .frame(height: 54)
        .frame(maxWidth: 345)
        // Nền gần đặc, không dùng .material: blur realtime phía trên WebView đang cuộn tốn GPU
        .background(Capsule().fill(Color(white: 0.10).opacity(0.95)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.16), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.5), radius: 10, y: 4)
        .padding(.horizontal, 26)
        .frame(maxWidth: .infinity)
        .animation(.spring(response: 0.38, dampingFraction: 0.82), value: selected)
    }
}

/// Nhấn tab: thu nhỏ nhẹ, nhả ra thì bật về (spring). Không haptic.
private struct TabPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
