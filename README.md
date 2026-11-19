# Aether

Client YouTube cá nhân (SwiftUI + WKWebView): đăng nhập Google, lịch sử/playlist như web, chặn quảng cáo, phát nền, PiP.

## Build
Push lên `main` -> GitHub Actions build -> tải `Aether.ipa` ở mục Releases (tag `latest`).

## Cài
LiveContainer -> dấu `+` -> chọn `Aether.ipa` (JIT-less mode).

## Checklist test
1. Đăng nhập Google được (nếu báo "trình duyệt không an toàn" -> xem ghi chú bên dưới)
2. Vào Thư viện -> Lịch sử, playlist hiển thị đúng
3. Phát video: không còn quảng cáo
4. Đang phát -> khóa màn hình / về Home: âm thanh vẫn chạy
5. Nút PiP (góc dưới phải khi xem video) hoạt động

## Cấu trúc
- `Sources/` Swift (WebController giữ WKWebView, lifecycle, điều hướng)
- `Resources/adblock.js` lọc ad + giữ phát nền; `Resources/blocklist.json` chặn request
- `project.yml` cấu hình XcodeGen (project .xcodeproj được sinh trên CI)
