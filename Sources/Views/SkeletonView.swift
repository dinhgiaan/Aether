import SwiftUI

/// Loại skeleton theo tab (khớp bố cục thật của trang YouTube mobile tương ứng)
enum SkeletonKind: Equatable {
    case home, subs, you

    init(tab: AppTab) {
        switch tab {
        case .subs: self = .subs
        case .you:  self = .you
        default:    self = .home
        }
    }
}

/// Khung xương hiển thị khi trang của tab đang tải: header thật (logo, chuông, tìm kiếm, ⋮) + khối xám nhấp nháy
/// đúng bố cục từng trang (chip lọc, thẻ video, hàng kênh, hồ sơ, lịch sử…). Phủ lên WebView, tự mờ đi khi trang vẽ xong.
struct SkeletonView: View {
    let kind: SkeletonKind

    private let pageBackground = Color(red: 15 / 255, green: 15 / 255, blue: 15 / 255)   // #0f0f0f
    private let headerBackground = Color(red: 12 / 255, green: 12 / 255, blue: 15 / 255)
    private let block = Color.white.opacity(0.09)

    var body: some View {
        VStack(spacing: 0) {
            header
            VStack(alignment: .leading, spacing: 0) {
                switch kind {
                case .home: homeContent
                case .subs: subsContent
                case .you:  youContent
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .clipped()
            .modifier(ShimmerModifier())   // chỉ nhấp nháy phần nội dung, header đứng yên như trang thật
        }
        .background(pageBackground.ignoresSafeArea(edges: .bottom))
        .accessibilityHidden(true)
    }

    // MARK: Header (giống header thật của trang: logo trái, chuông + tìm kiếm + ⋮ phải)

    private var header: some View {
        HStack(spacing: 0) {
            Image("YouTubeWordmark")
                .resizable()
                .scaledToFit()
                .frame(width: 88.6, height: 20)
                .padding(.leading, 14)
            Spacer(minLength: 0)
            headerIcon("bell")
            headerIcon("magnifyingglass")
            Image(systemName: "ellipsis")
                .rotationEffect(.degrees(90))
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 48)
                .padding(.trailing, 4)
        }
        .frame(height: 48)
        .background(headerBackground)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.white.opacity(0.08)).frame(height: 0.5) }
    }

    private func headerIcon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 20, weight: .regular))
            .foregroundStyle(.white)
            .frame(width: 44, height: 48)
    }

    // MARK: Khối dựng sẵn

    /// Thanh chữ xám bo tròn. w = nil → chiếm hết bề ngang trừ `trailing`
    private func bar(_ height: CGFloat, w: CGFloat? = nil, trailing: CGFloat = 0) -> some View {
        RoundedRectangle(cornerRadius: min(height / 2, 6))
            .fill(block)
            .frame(width: w, height: height)
            .frame(maxWidth: w == nil ? CGFloat.infinity : nil, alignment: .leading)
            .padding(.trailing, w == nil ? trailing : 0)
    }

    /// Hàng chip lọc: chip đầu sáng hơn (đang chọn)
    private func chips(_ widths: [CGFloat]) -> some View {
        HStack(spacing: 8) {
            ForEach(Array(widths.enumerated()), id: \.offset) { index, width in
                Capsule()
                    .fill(index == 0 ? Color.white.opacity(0.18) : block)
                    .frame(width: width, height: 32)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Thẻ video: thumbnail 16:9 tràn ngang + avatar kênh + 2 dòng tiêu đề + dòng thông tin
    private var videoCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(block)
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay(alignment: .bottomTrailing) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.black.opacity(0.35))
                        .frame(width: 38, height: 18)
                        .padding(8)
                }
            HStack(alignment: .top, spacing: 12) {
                Circle().fill(block).frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 8) {
                    bar(14, trailing: 28)
                    bar(14, trailing: 110)
                    bar(11, trailing: 170)
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
        }
        .padding(.bottom, 22)
    }

    /// Thẻ ngang (lịch sử / danh sách phát ở tab Bạn)
    private func shelfCard(width: CGFloat = 168) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 8).fill(block).frame(width: width, height: width * 9 / 16)
            bar(12, w: width - 16)
            bar(10, w: width * 0.6)
        }
    }

    private func sectionTitle(_ titleWidth: CGFloat) -> some View {
        HStack {
            bar(18, w: titleWidth)
            Spacer()
            Capsule().fill(block).frame(width: 60, height: 28)
        }
        .padding(.horizontal, 12)
    }

    // MARK: Nội dung từng tab

    /// Trang chủ: chip chủ đề + các thẻ video
    private var homeContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            chips([48, 88, 76, 100, 84, 92])
            videoCard
            videoCard
            videoCard
        }
    }

    /// Đăng ký: hàng avatar kênh cuộn ngang + chip + thẻ video
    private var subsContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                ForEach(0..<6, id: \.self) { _ in
                    VStack(spacing: 8) {
                        Circle().fill(block).frame(width: 56, height: 56)
                        bar(10, w: 44)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            chips([48, 72, 96, 84, 80])
            videoCard
            videoCard
        }
    }

    /// Bạn: hồ sơ (avatar, tên, @handle, nút) + kệ Lịch sử + kệ Danh sách phát
    private var youContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                Circle().fill(block).frame(width: 72, height: 72)
                VStack(alignment: .leading, spacing: 10) {
                    bar(20, w: 150)
                    bar(12, w: 190)
                    bar(12, w: 120)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)

            HStack(spacing: 8) {
                Capsule().fill(block).frame(width: 118, height: 32)
                Capsule().fill(block).frame(width: 132, height: 32)
                Capsule().fill(block).frame(width: 40, height: 32)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 22)

            sectionTitle(90)
            HStack(alignment: .top, spacing: 12) {
                shelfCard(); shelfCard(); shelfCard()
            }
            .padding(.leading, 12)
            .padding(.top, 14)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .leading)

            sectionTitle(120)
            HStack(alignment: .top, spacing: 12) {
                shelfCard(); shelfCard(); shelfCard()
            }
            .padding(.leading, 12)
            .padding(.top, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Hiệu ứng nhấp nháy (một dải sáng quét ngang qua các khối xám)

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    let w = geo.size.width
                    LinearGradient(
                        colors: [.clear, Color.white.opacity(0.10), .clear],
                        startPoint: .leading, endPoint: .trailing
                    )
                    .frame(width: w * 0.7)
                    .offset(x: -w * 0.7 + phase * w * 1.7)
                }
                .mask(content)          // chỉ sáng trên các khối xám, không lan ra nền
                .allowsHitTesting(false)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}
