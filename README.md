# Aether

Client YouTube cá nhân (SwiftUI + WKWebView): đăng nhập Google, lịch sử/playlist như web, chặn quảng cáo, phát nền, PiP, Liquid-Glass UI.

## Tính năng
- 🚫 Chặn quảng cáo (request-level blocklist + JS prune + DOM hide)
- 🔐 Đăng nhập Google/Gmail (OAuth đầy đủ, cookie persist)
- 🎵 Phát nền khi khóa màn hình hoặc chuyển app
- 📺 Picture-in-Picture (nút PiP xuất hiện khi xem video)
- 💊 Liquid-Glass bottom nav (floating capsule, scroll-to-hide, spring animation)
- ❌ Không có tab Shorts, không có banner mời mở app YouTube

## Build
Push lên `main` → GitHub Actions build → tải `Aether.ipa` ở mục **Releases** (tag `latest`).

## Cài
LiveContainer → dấu `+` → chọn `Aether.ipa` (JIT-less mode).

## Checklist test
1. [ ] App mở: thấy splash screen (icon đỏ pulse), sau đó YouTube load
2. [ ] Đăng nhập Google được (nếu báo "trình duyệt không an toàn" thử lại hoặc clear cookie)
3. [ ] Vào Thư viện → Lịch sử, playlist hiển thị đúng
4. [ ] Feed không còn quảng cáo; phát video không có pre-roll
5. [ ] Bottom bar hình capsule nổi, scroll xuống tự ẩn, scroll lên hiện lại
6. [ ] Phát video → khóa màn hình / về Home: âm thanh vẫn chạy
7. [ ] Nút PiP (góc dưới phải, chỉ hiện khi xem video) hoạt động
8. [ ] Mất mạng: hiện trang "Không thể tải trang" với nút Thử lại

## Cấu trúc
| File | Chức năng |
|------|-----------|
| `Sources/AetherApp.swift` | App entry, AVAudioSession setup |
| `Sources/ContentView.swift` | SwiftUI layout, Splash, Liquid-Glass PiP button |
| `Sources/WebController.swift` | WKWebView lifecycle, navigation, blocklist caching |
| `Resources/adblock.js` | Lọc quảng cáo + background playback + event navigation |
| `Resources/uienhance.js` | Liquid-Glass UI + scroll-to-hide + animations |
| `Resources/blocklist.json` | Content rules chặn request |
| `project.yml` | XcodeGen config |
