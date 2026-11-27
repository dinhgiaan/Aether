# Aether

Client YouTube cá nhân cao cấp (SwiftUI + WKWebView): Chặn quảng cáo đa tầng, phát nền Lock Screen / Control Center, tải video xem ngoại tuyến, PiP, Liquid-Glass UI.

## Tính năng nổi bật
- 🚫 **Chặn quảng cáo thông minh**: Heuristic regex tự động nhận diện field mới + tua 16x bypass + lọc request native.
- 🎵 **Chạy nền & Trung tâm điều khiển**: Hiện đầy đủ bài hát, tên kênh, ảnh bìa, thanh tua và nút Play/Pause tại Màn hình khóa (Lock Screen) và Trung tâm điều khiển (Control Center).
- 📥 **Tải video xem ngoại tuyến**: Tải trực tiếp video MP4 có tiếng về máy, lưu trong thư viện offline, phát mượt mà không cần mạng.
- 📺 **Picture-in-Picture & Xoay ngang**: Nút PiP kính mờ nổi bật, hỗ trợ mở rộng toàn màn hình và tự động xoay ngang video khi quay máy.
- ⬇️ **Cử chỉ vuốt xuống về Trang chủ**: Vuốt nhẹ video xuống hoặc bấm nút mũi tên kính góc trên để thu nhỏ/quay lại trang chủ như app gốc.
- 💊 **Thanh điều hướng Liquid-Glass 120Hz**: Capsule nổi bo tròn, tự ẩn khi cuộn xuống, hiện khi cuộn lên, bottom bar dạng capsule nổi kiểu iOS 26 (chỉ icon, pill nền active trượt mượt theo tab đang chọn), bấm lại tab để cuộn lên đầu, tối ưu 60/120fps không giật lag.
- ❌ **Sạch bóng Shorts & Rác**: Xóa hoàn toàn tab Shorts, kệ Shorts trang chủ, video gợi ý Shorts; xóa các nút Films, Help, Feedback, YouTube Premium ở mục Hồ sơ; xóa nút la bàn bên cạnh thanh lọc chủ đề.
- ✨ **Header & Tìm kiếm Aether**: Thay logo YouTube thành logo Aether phát sáng; khi tìm kiếm logo đổi thành nút mũi tên quay về trang trước; làm mới giao diện lịch sử tìm kiếm và thu gọn bình luận 15% tinh tế.
- 📥 **Banner tiến trình tải**: Vuốt lên/sang ngang để ẩn, nút ✕ để hủy tải.
- ⚡ **Khởi động siêu tốc**: Splash screen pop-up mượt mà và tự động vào app ngay trong ~0.8s.

## Build
Push lên `main` → GitHub Actions tự động build → tải `Aether.ipa` ở mục **Releases** (tag `latest`).

## Cài đặt
Cài file `Aether.ipa` qua **LiveContainer** / TrollStore / AltStore / Sideloadly (hỗ trợ JIT-less mode).

## Cấu trúc dự án
| File | Chức năng |
|------|-----------|
| `Sources/AetherApp.swift` | Điểm khởi chạy app, cấu hình AVAudioSession |
| `Sources/OfflineManager.swift` | Quản lý tải xuống (có hủy tải), lưu file MP4 và ảnh bìa video ngoại tuyến |
| `Sources/OfflineLibraryView.swift` | Giao diện danh sách video ngoại tuyến & Native AVPlayer |
| `Sources/ContentView.swift` | Giao diện chính SwiftUI, ghép các view con |
| `Sources/Views/NetflixSplashView.swift` | Splash intro khi mở app |
| `Sources/Views/DownloadQualitySheet.swift` | Sheet chọn chất lượng tải xuống |
| `Sources/Views/DownloadProgressBanner.swift` | Banner tiến trình tải (vuốt để ẩn, nút hủy) |
| `Sources/Support/Haptic.swift` | Helper phản hồi xúc giác |
| `Sources/WebController.swift` | Quản lý WKWebView, MPNowPlayingInfoCenter, MPRemoteCommandCenter |
| `Resources/adblock.js` | Lọc quảng cáo, đồng bộ media session, kiểm soát phát nền |
| `Resources/ui/core.js` | Namespace `window.AE`, nạp CSS, hook vòng đời cho các module |
| `Resources/ui/branding.js` | Logo Aether, header, dọn Shorts và mục thừa ở Hồ sơ |
| `Resources/ui/nav.js` | Bottom bar capsule nổi kiểu iOS 26: chỉ icon, pill trượt theo tab, tự ẩn khi cuộn (hysteresis), bấm lại để cuộn lên đầu |
| `Resources/ui/downloads-tab.js` | Tab "Đã tải" trong bottom bar |
| `Resources/ui/search.js` | Giao diện lịch sử/gợi ý tìm kiếm, nút Back thay logo |
| `Resources/ui/watch.js` | Trang xem video: vuốt xuống PiP, player ghim, fullscreen giả, vuốt mép trái để quay lại |
| `Resources/ui/watch-fx.js` | Animation trả lời bình luận, panel hàng đợi Mix |
| `Resources/ui/debug.js` | Gỡ lỗi: giữ 3 ngón tay để copy sơ đồ DOM |
| `Resources/ui/boot.js` | Nối sự kiện điều hướng + MutationObserver (nạp cuối cùng) |
| `Resources/blocklist.json` | Danh sách rule chặn request cấp mạng của WebKit |
| `Resources/Assets.xcassets` | Bộ nhận diện thương hiệu & Logo app Aether |
| `project.yml` | Cấu hình XcodeGen, quyền hệ thống và cờ tối ưu |
