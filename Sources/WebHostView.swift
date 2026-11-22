import UIKit
import WebKit
import SwiftUI

/// Container UIKit giữ MỌI WKWebView của app (đang hiển thị, đang PiP, dự phòng).
///
/// Root cause của lỗi nháy/trắng/đơ trước đây: mỗi lần thu nhỏ/quay lại PiP, SwiftUI bị đổi `.id()`
/// nên gỡ WebView cũ + dựng lại view mới (crossfade opacity mặc định → lộ nền trắng), đồng thời WebView
/// còn bị `removeFromSuperview` rồi nhét vào UIWindow thủ công.
/// Ở đây các WebView luôn nằm cố định trong cùng một container, chỉ đổi thứ tự lớp (z-order) → không nháy.
final class WebHostView: UIView, UIGestureRecognizerDelegate {

    /// Gọi khi người dùng vuốt từ mép trái vào đủ xa. Trả về true nếu đã xử lý (vd. đóng trang video)
    var onEdgeBack: (() -> Bool)?

    private lazy var cover: UIView = {
        let v = UIView()
        v.backgroundColor = UIColor(red: 0.06, green: 0.06, blue: 0.06, alpha: 1)   // #0f0f0f giống nền YouTube dark
        v.translatesAutoresizingMaskIntoConstraints = false
        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = UIColor(white: 1, alpha: 0.7)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        v.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: v.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: v.centerYAnchor, constant: -40)
        ])
        return v
    }()
    private var coverToken = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        clipsToBounds = true

        // Vuốt từ mép trái = quay lại (kiểu iOS). WKWebView tự lo khi trang có lịch sử; gesture này lo trường hợp
        // WebView video chưa có lịch sử để back → đóng video, về trang trước.
        let edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleEdgePan(_:)))
        edge.edges = .left
        edge.delegate = self
        addGestureRecognizer(edge)
    }

    @objc private func handleEdgePan(_ g: UIScreenEdgePanGestureRecognizer) {
        guard g.state == .ended else { return }
        let dx = g.translation(in: self).x
        let vx = g.velocity(in: self).x
        if dx > 80 || vx > 600 { _ = onEdgeBack?() }
    }

    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: - Quản lý WebView

    /// Gắn WebView vào container (ghim 4 cạnh). `behind = true`: đặt phía sau mọi WebView khác.
    func install(_ wv: WKWebView, behind: Bool = false) {
        guard wv.superview !== self else { return }
        wv.translatesAutoresizingMaskIntoConstraints = false
        if behind { insertSubview(wv, at: 0) } else if cover.superview === self { insertSubview(wv, belowSubview: cover) } else { addSubview(wv) }
        NSLayoutConstraint.activate([
            wv.leadingAnchor.constraint(equalTo: leadingAnchor),
            wv.trailingAnchor.constraint(equalTo: trailingAnchor),
            wv.topAnchor.constraint(equalTo: topAnchor),
            wv.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        wv.isUserInteractionEnabled = !behind
    }

    func remove(_ wv: WKWebView) {
        wv.removeFromSuperview()
    }

    // MARK: - Hoán đổi WebView

    /// Đưa `wv` lên trước, `old` lùi ra sau (vẫn sống để PiP chạy tiếp).
    /// - showCover: true khi `wv` mới tạo, chưa nạp xong → phủ lớp loading đen thay vì lộ trang trắng.
    ///   animated: false → đổi tức thì (không crossfade). Dùng khi WebView cũ có thứ không được phép lộ ra giữa chừng
    ///   (vd. <video> đang vào PiP hiện thành khung đen vuông, bị nhìn xuyên qua trong lúc crossfade).
    func present(_ wv: WKWebView, sending old: WKWebView, showCover: Bool, animated: Bool = true) {
        wv.isUserInteractionEnabled = true
        old.isUserInteractionEnabled = false

        if showCover {
            bringSubviewToFront(wv)
            showLoadingCover()
            return
        }

        if !animated {
            wv.alpha = 1
            bringSubviewToFront(wv)
            sendSubviewToBack(old)
            return
        }

        // Crossfade nhẹ: WebView mới mờ dần hiện lên trên WebView cũ (cũ vẫn đủ alpha bên dưới → không lộ nền)
        wv.alpha = 0
        bringSubviewToFront(wv)
        UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            wv.alpha = 1
        } completion: { [weak self, weak old] _ in
            guard let self, let old, old.superview === self else { return }
            self.sendSubviewToBack(old)
        }
    }

    // MARK: - Lớp loading

    private func showLoadingCover() {
        coverToken += 1
        let token = coverToken
        cover.layer.removeAllAnimations()
        cover.alpha = 0
        if cover.superview !== self {
            addSubview(cover)
            NSLayoutConstraint.activate([
                cover.leadingAnchor.constraint(equalTo: leadingAnchor),
                cover.trailingAnchor.constraint(equalTo: trailingAnchor),
                cover.topAnchor.constraint(equalTo: topAnchor),
                cover.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        }
        bringSubviewToFront(cover)
        UIView.animate(withDuration: 0.15) { self.cover.alpha = 1 }
        // Bảo hiểm: nếu didFinish không bao giờ tới thì vẫn gỡ lớp phủ sau 6s
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self, self.coverToken == token else { return }
            self.hideCover(force: true)
        }
    }

    /// Gỡ lớp loading (gọi khi trang duyệt mới nạp xong). Trễ chút để YouTube kịp vẽ nội dung.
    func hideCover(force: Bool = false) {
        guard cover.superview === self else { return }
        let token = coverToken
        let delay: TimeInterval = force ? 0 : 0.35
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.coverToken == token, self.cover.superview === self else { return }
            UIView.animate(withDuration: 0.25, delay: 0, options: [.allowUserInteraction]) {
                self.cover.alpha = 0
            } completion: { [weak self] _ in
                guard let self, self.coverToken == token, self.cover.alpha == 0 else { return }
                self.cover.removeFromSuperview()
            }
        }
    }
}

// MARK: – Cầu nối SwiftUI
struct WebViewContainer: UIViewRepresentable {
    let host: WebHostView

    func makeUIView(context: Context) -> WebHostView { host }
    func updateUIView(_ uiView: WebHostView, context: Context) {}
}
