// Aether UI – điều hướng: thanh tab đã chuyển sang NATIVE (SwiftUI, Sources/Views/NativeTabBar.swift).
// Module này chỉ còn: ẩn thanh tab của YouTube, báo cho Swift biết tab hiện tại / đang tìm kiếm / cuộn lên-xuống,
// và cung cấp 2 hàm cho Swift gọi: __aeGoTab(key), __aeScrollTop().
// Lý do chuyển native: phần tử fixed trong WebKit bị nảy khi trang tab mới đang tải.
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  AE.addCSS('nav', `
    /* Ẩn thanh tab của YouTube nhưng vẫn để trong DOM: __aeGoTab bấm hộ các tab này (điều hướng SPA, không tải lại trang) */
    ytm-bottom-bar-renderer, ytm-pivot-bar-renderer { display: none !important; }

    /* Chừa chỗ cho thanh tab native (54pt + vùng an toàn + khe) */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px) !important;
    }
  `);

  const normPath = (p) => p.replace(/\/+$/, '') || '/';

  // ── 1. Tab hiện tại, suy từ URL ──────────────────────────────────────────
  const currentKey = () => {
    const p = normPath(location.pathname);
    if (p === '/') return 'home';
    if (p.startsWith('/feed/subscriptions')) return 'subs';
    if (p.startsWith('/feed/library') || p.startsWith('/feed/you') || p.startsWith('/feed/history')) return 'you';
    return null;   // trang khác (kênh, playlist…): Swift giữ tab đang chọn
  };

  // ── 2. Báo trạng thái cho Swift (chỉ khi đổi) ────────────────────────────
  let lastTab, lastSearching;
  const report = () => {
    const tab = currentKey();
    const searching = AE.search ? !!AE.search.isSearchUI() : false;
    const msg = {};
    if (tab && tab !== lastTab) { lastTab = tab; msg.tab = tab; }
    if (searching !== lastSearching) { lastSearching = searching; msg.searching = searching; }
    if (Object.keys(msg).length) AE.post(msg);
  };

  // ── 3. Tự ẩn thanh tab khi cuộn, có ngưỡng (hysteresis) để không nhấp nháy ──
  // Swift nhận { barHidden: Bool } và tự animate; JS chỉ quyết định khi nào ẩn/hiện.
  const SHOW_ABOVE_Y = 70;    // gần đầu trang: luôn hiện
  const HIDE_AFTER = 28;      // cuộn xuống tích lũy > 28px mới ẩn
  const SHOW_AFTER = 16;      // cuộn lên tích lũy > 16px mới hiện lại
  let hidden = false, lastY = 0, acc = 0, ticking = false, quietUntil = 0;

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
    // Sau khi đổi tab trang đổi chiều cao → trình duyệt kẹp scroll, sinh sự kiện cuộn giả: bỏ qua
    if (Date.now() < quietUntil) { lastY = Math.min(Math.max(0, rawY), maxY); acc = 0; return; }
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

  // ── 4. API cho Swift ─────────────────────────────────────────────────────
  const KEY_PATHS = { home: ['/'], subs: ['/feed/subscriptions'], you: ['/feed/you', '/feed/library'] };
  const KEY_LABEL = { home: /home|trang chủ/i, subs: /subscri|đăng ký/i, you: /\byou\b|library|thư viện|bạn/i };

  const itemPath = (el) => {
    const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
    if (!a) return null;
    try { return normPath(new URL(a.getAttribute('href'), location.href).pathname); } catch (_) { return null; }
  };

  // URL đích mặc định + nạp cứng (cả hai có thể bị thay ở test)
  const KEY_URL = { home: '/', subs: '/feed/subscriptions', you: '/feed/library' };   // mobile web: tab "You" → /feed/library
  const hardNavigate = (url) => (AE.hardNavigate || ((u) => location.assign(u)))(url);
  let goToken = 0;

  // Bấm hộ tab gốc của YouTube (điều hướng SPA, không tải lại trang). Trả về true nếu bắt đầu được thao tác.
  // Root cause lỗi "bấm tab Đăng ký/Bạn nhưng trang vẫn là Trang chủ": bấm .click() lên tab đang ẩn có thể KHÔNG làm YouTube đổi trang
  // (hàm cũ trả về true ngay lúc bấm, không kiểm tra kết quả). Giờ: sau khi bấm, nếu URL không đổi trong ~1.4s thì nạp thẳng URL đích.
  window.__aeGoTab = (key) => {
    const items = [...document.querySelectorAll('ytm-pivot-bar-item-renderer')];
    const item = items.find((t) => (KEY_PATHS[key] || []).includes(itemPath(t))) ||
      items.find((t) => KEY_LABEL[key] && KEY_LABEL[key].test((t.getAttribute('aria-label') || '') + ' ' + t.textContent));
    const anchor = item && item.querySelector('a[href]');
    // Ưu tiên href thật của tab (đúng với phiên bản YouTube đang chạy), không có thì dùng URL mặc định
    let target = KEY_URL[key];
    try { if (anchor) target = new URL(anchor.getAttribute('href'), location.href).href; } catch (_) { }

    quietUntil = Date.now() + 1800;
    setHidden(false);
    try { window.scrollTo(0, 0); } catch (_) { }
    if (item) (anchor || item).click();

    const startPath = normPath(location.pathname);
    const token = ++goToken;
    setTimeout(() => {
      if (token !== goToken) return;                       // đã có lần bấm tab mới hơn
      if (currentKey() === key || normPath(location.pathname) !== startPath) return;   // đã sang đúng tab (hoặc ít nhất đã rời trang cũ)
      hardNavigate(target);                                // click không có tác dụng → nạp thẳng
    }, item ? 1400 : 0);
    return true;
  };

  window.__aeScrollTop = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 5. Nối vào vòng đời ──────────────────────────────────────────────────
  AE.on('ready', () => {
    lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
    }, { passive: true });
    // Mở/đóng giao diện tìm kiếm có thể không đổi URL (pushState/hash) → bổ sung theo focus ô nhập
    document.addEventListener('focusin', () => setTimeout(report, 0));
    document.addEventListener('focusout', () => setTimeout(report, 0));
    report();
  });

  AE.on('refresh', () => { quietUntil = Date.now() + 600; setHidden(false); report(); });
  AE.on('browse', report);
})();
