// Aether UI – nút chuông thông báo ở header (như app YouTube gốc), đặt ngay bên trái nút tìm kiếm.
// Không chèn node vào header của YouTube (dễ bị họ dựng lại): vẽ 1 nút position:fixed lên <body>,
// lấy vị trí từ nút tìm kiếm có sẵn rồi bám theo mỗi lần DOM/scroll/xoay đổi.
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  const NOTI_URL = '/feed/notifications';
  const BELL_PATH = 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z';

  AE.addCSS('bell', `
    #ae-bell {
      position: fixed; z-index: 2147483000; display: none;
      width: 44px; height: 44px; align-items: center; justify-content: center;
      border: 0; border-radius: 50%; background: transparent; color: #fff; padding: 0;
      -webkit-tap-highlight-color: transparent;
      transition: background-color .15s ease, transform .15s ease;
    }
    #ae-bell:active { background: rgba(255,255,255,.14); transform: scale(.92); }
    #ae-bell svg { width: 24px; height: 24px; fill: currentColor; display: block; pointer-events: none; }
  `);

  // Nút tìm kiếm của YouTube trong header: ưu tiên aria-label, fallback nút ngoài cùng bên phải
  const HEADER_SEL = 'ytm-mobile-topbar-renderer, .mobile-topbar-header, header';
  const findSearchButton = () => {
    const header = document.querySelector(HEADER_SEL);
    if (!header) return null;
    const btns = [...header.querySelectorAll('button, a, [role="button"]')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.width < 80 && r.top < 80 && r.right > window.innerWidth * 0.5;
    });
    if (!btns.length) return null;
    const byLabel = btns.find((b) => /search|tìm/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')));
    return byLabel || btns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
  };

  const shouldShow = () => {
    const p = location.pathname;
    if (AE.isWatching() || p.startsWith('/shorts') || p.startsWith('/results') || p.startsWith('/feed/notifications')) return false;
    return !(AE.search && AE.search.isSearchUI());
  };

  let el = null;
  const ensure = () => {
    if (el && el.isConnected) return el;
    el = document.getElementById('ae-bell');
    if (el) return el;
    el = document.createElement('button');
    el.id = 'ae-bell'; el.type = 'button'; el.setAttribute('aria-label', 'Thông báo');
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + BELL_PATH + '"/></svg>';
    document.body.appendChild(el);
    return el;
  };

  const place = () => {
    if (!document.body) return;
    const btn = shouldShow() ? findSearchButton() : null;
    const bell = ensure();
    const r = btn && btn.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > 120) { bell.style.display = 'none'; return; }   // header đang ẩn/cuộn khỏi màn hình
    bell.style.display = 'flex';
    bell.style.top = Math.round(r.top + r.height / 2 - 22) + 'px';
    bell.style.left = Math.round(r.left - 44) + 'px';
  };

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };

  // Mở trang thông báo của YouTube. Capture + chặn mọi sự kiện để YouTube không can thiệp
  window.addEventListener('click', (e) => {
    if (!e.target.closest?.('#ae-bell')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    location.assign(NOTI_URL);
  }, true);

  AE.on('ready', () => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
  });
  AE.on('refresh', schedule);
  AE.on('browse', schedule);
  AE.on('watch', schedule);   // vào /watch → ẩn chuông
})();
