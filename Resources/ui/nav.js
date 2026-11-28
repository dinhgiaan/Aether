// Aether UI – điều hướng: thanh tab đã chuyển sang NATIVE (SwiftUI, Sources/Views/NativeTabBar.swift).
// Mỗi tab (Home / Đăng ký / Bạn) có WebView riêng (WebController.tabWebViews) nên chuyển tab là việc của Swift.
// Module này chỉ còn: ẩn thanh tab của YouTube, báo cho Swift biết đang tìm kiếm / cuộn lên-xuống,
// và cung cấp 2 hàm cho Swift gọi: __aeReport(), __aeScrollTop().
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  AE.addCSS('nav', `
    /* Thanh tab của YouTube bị ẩn: đã có thanh tab native */
    ytm-bottom-bar-renderer, ytm-pivot-bar-renderer { display: none !important; }

    /* Chừa chỗ cho thanh tab native (54pt + vùng an toàn + khe) */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px) !important;
    }
  `);

  // ── 0. Phát hiện bottom sheet / dialog đang mở (menu ⋮ của video, chia sẻ, lưu vào playlist…) ──
  // Root cause lỗi "thanh tab đè lên menu": thanh tab là lớp native nằm TRÊN WebView nên che luôn các mục cuối của sheet.
  // Giờ báo cho Swift { sheetOpen } để ẩn thanh tab khi sheet mở. Không dựa vào 1 tên thẻ duy nhất (YouTube hay đổi):
  // vừa kiểm tra các thẻ sheet/scrim đã biết, vừa quét lớp con trực tiếp của body/ytm-app tìm khối position:fixed dính đáy màn hình.
  const KNOWN_SHEET = 'ytw-scrim, bottom-sheet-container, ytm-bottom-sheet-renderer, ytm-menu-popup-renderer, ytm-dialog, tp-yt-paper-dialog, .bottom-sheet-layout, #ae-sheet';
  const isShown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isSheetOpen = () => {
    if (!document.body || AE.isWatching()) return false;       // trang video đã ẩn thanh tab sẵn
    for (const el of document.querySelectorAll(KNOWN_SHEET)) {
      if (el.getBoundingClientRect().height > 80 && isShown(el)) return true;
    }
    const app = document.querySelector('ytm-app');
    const roots = [...document.body.children, ...(app ? app.children : [])];
    for (const el of roots) {
      if (el.id === 'ae-bell' || el.id === 'ae-noti') continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.height > 120 && r.width >= window.innerWidth * 0.85 && r.bottom >= window.innerHeight - 2 && isShown(el)) return true;
    }
    return false;
  };

  // ── 1. Báo "đang tìm kiếm" + "đang mở sheet" cho Swift (chỉ khi đổi) ─────────
  let lastSearching, lastSheet;
  const report = () => {
    const searching = AE.search ? !!AE.search.isSearchUI() : false;
    if (searching !== lastSearching) { lastSearching = searching; AE.post({ searching }); }
    const sheetOpen = isSheetOpen();
    if (sheetOpen !== lastSheet) { lastSheet = sheetOpen; AE.post({ sheetOpen }); }
  };

  // ── 2. Tự ẩn thanh tab khi cuộn, có ngưỡng (hysteresis) để không nhấp nháy ──
  // Swift nhận { barHidden: Bool } và tự animate; JS chỉ quyết định khi nào ẩn/hiện.
  const SHOW_ABOVE_Y = 70;    // gần đầu trang: luôn hiện
  const HIDE_AFTER = 28;      // cuộn xuống tích lũy > 28px mới ẩn
  const SHOW_AFTER = 16;      // cuộn lên tích lũy > 16px mới hiện lại
  let hidden = false, lastY = 0, acc = 0, ticking = false;

  const setHidden = (v) => {
    acc = 0;
    if (v === hidden) return;
    hidden = v;
    AE.post({ barHidden: v });
  };

  const onScrollFrame = () => {
    ticking = false;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const rawY = window.scrollY;
    if (rawY > maxY) { lastY = maxY; return; }      // đàn hồi cuối trang: bỏ qua
    const y = Math.max(0, rawY);                    // đàn hồi đầu trang: coi như 0
    const d = y - lastY;
    lastY = y;
    if (y < SHOW_ABOVE_Y) { setHidden(false); return; }
    if (Math.abs(d) < 1) return;
    if ((d > 0) !== (acc > 0)) acc = 0;             // đổi hướng → tích lũy lại từ đầu
    acc += d;
    if (!hidden && acc > HIDE_AFTER) setHidden(true);
    else if (hidden && acc < -SHOW_AFTER) setHidden(false);
  };

  // ── 3. API cho Swift ─────────────────────────────────────────────────────
  // Gọi khi tab này vừa được hiển thị: Swift đã đặt lại "thanh tab hiện", nên JS cũng coi là chưa ẩn,
  // và gửi lại trạng thái tìm kiếm để Swift đồng bộ với đúng trang đang hiển thị.
  window.__aeReport = () => {
    hidden = false; acc = 0; lastY = window.scrollY;
    lastSearching = undefined; lastSheet = undefined;
    report();
    if (AE.bell && AE.bell.report) AE.bell.report();
  };

  window.__aeScrollTop = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 4. Nối vào vòng đời ──────────────────────────────────────────────────
  AE.on('ready', () => {
    lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
    }, { passive: true });
    // Mở/đóng giao diện tìm kiếm có thể không đổi URL (pushState/hash) → bổ sung theo focus ô nhập
    document.addEventListener('focusin', () => setTimeout(report, 0));
    document.addEventListener('focusout', () => setTimeout(report, 0));
    // Sheet mở/đóng sau 1 cú chạm (menu ⋮, nền mờ để đóng): kiểm tra nhanh thay vì chờ nhịp 300ms của observer chung
    document.addEventListener('click', () => { setTimeout(report, 120); setTimeout(report, 450); }, true);
    report();
  });

  AE.on('refresh', () => { setHidden(false); report(); });
  AE.on('browse', report);
})();
