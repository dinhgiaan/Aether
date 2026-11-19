# Aether

Client YouTube cá nhân cao cấp (SwiftUI + WKWebView): Chặn quảng cáo đa tầng, phát nền Lock Screen / Control Center, tải video xem ngoại tuyến, PiP, Liquid-Glass UI, bảo vệ chống dịch ngược.

## Tính năng nổi bật
- 🚫 **Chặn quảng cáo thông minh**: Heuristic regex tự động nhận diện field mới + tua 16x bypass + lọc request native.
- 🎵 **Chạy nền & Trung tâm điều khiển**: Hiện đầy đủ bài hát, tên kênh, ảnh bìa, thanh tua và nút Play/Pause tại Màn hình khóa (Lock Screen) và Trung tâm điều khiển (Control Center).
- 📥 **Tải video xem ngoại tuyến**: Tải trực tiếp video MP4 có tiếng về máy, lưu trong thư viện offline, phát mượt mà không cần mạng.
- 📺 **Picture-in-Picture & Xoay ngang**: Nút PiP kính mờ nổi bật, hỗ trợ mở rộng toàn màn hình và tự động xoay ngang video khi quay máy.
- ⬇️ **Cử chỉ vuốt xuống về Trang chủ**: Vuốt nhẹ video xuống hoặc bấm nút mũi tên kính góc trên để thu nhỏ/quay lại trang chủ như app gốc.
- 💊 **Thanh điều hướng Liquid-Glass 120Hz**: Capsule nổi bo tròn, tự ẩn khi cuộn xuống, hiện khi cuộn lên, tối ưu 60/120fps không giật lag.
- ❌ **Sạch bóng Shorts & Rác**: Xóa hoàn toàn tab Shorts, kệ Shorts trang chủ, video gợi ý Shorts; xóa các nút Films, Help, Feedback, YouTube Premium ở mục Hồ sơ; xóa nút la bàn bên cạnh thanh lọc chủ đề.
- ✨ **Header & Tìm kiếm Aether**: Thay logo YouTube thành logo Aether phát sáng; làm mới giao diện lịch sử tìm kiếm và thu gọn bình luận 15% tinh tế.
- ⚡ **Khởi động siêu tốc**: Splash screen pop-up mượt mà và tự động vào app ngay trong ~0.8s.
- 🛡️ **Bảo vệ mã nguồn**: Tích hợp cờ chống dịch ngược (Anti-Debugging PT_DENY_ATTACH, stripped symbols, whole-module optimization).

## Build
Push lên `main` → GitHub Actions tự động build → tải `Aether.ipa` ở mục **Releases** (tag `latest`).

## Cài đặt
Cài file `Aether.ipa` qua **LiveContainer** / TrollStore / AltStore / Sideloadly (hỗ trợ JIT-less mode).

## Cấu trúc dự án
| File | Chức năng |
|------|-----------|
| `Sources/AetherApp.swift` | Điểm khởi chạy app, kích hoạt khiên bảo mật, AVAudioSession |
| `Sources/SecurityGuard.swift` | Module bảo vệ chống đính kèm debugger, phát hiện can thiệp |
| `Sources/OfflineManager.swift` | Quản lý tải xuống, lưu trữ file MP4 và ảnh bìa video ngoại tuyến |
| `Sources/OfflineLibraryView.swift` | Giao diện danh sách video ngoại tuyến & Native AVPlayer |
| `Sources/ContentView.swift` | Giao diện chính SwiftUI, Splash, Nút Back/PiP/Tải xuống |
| `Sources/WebController.swift` | Quản lý WKWebView, MPNowPlayingInfoCenter, MPRemoteCommandCenter |
| `Resources/adblock.js` | Lọc quảng cáo, đồng bộ media session, kiểm soát phát nền |
| `Resources/uienhance.js` | Giao diện Liquid-Glass, cử chỉ vuốt, thương hiệu Aether, làm gọn UI |
| `Resources/blocklist.json` | Danh sách rule chặn request cấp mạng của WebKit |
| `Resources/Assets.xcassets` | Bộ nhận diện thương hiệu & Logo app Aether |
| `project.yml` | Cấu hình XcodeGen, quyền hệ thống và cờ tối ưu bảo mật |
