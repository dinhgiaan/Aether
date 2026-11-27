// Aether UI – bottom bar dạng capsule: pill nền active trượt theo tab, tự ẩn khi cuộn (có ngưỡng),
// bấm lại tab đang chọn → cuộn lên đầu trang
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  AE.addCSS('nav', `
    /* ── Bottom bar: floating capsule ───────────────────────────────────── */
    ytm-bottom-bar-renderer {
      left: 50% !important;
      right: auto !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
      transform: translate3d(-50%, 0, 0) !important;
      width: auto !important;
      min-width: min(320px, 90vw) !important;
      border-radius: 999px !important;
      /* Nền gần đặc, KHÔNG backdrop-filter: blur realtime trên nội dung đang cuộn là nguồn giật khi lướt feed */
      background: rgba(18, 18, 22, 0.94) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border: 0.5px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow:
        inset 0 0.5px 0 rgba(255,255,255,0.12),
        0 4px 14px rgba(0, 0, 0, 0.5) !important;
      overflow: hidden !important;
      transition:
        transform 0.38s cubic-bezier(0.25, 1, 0.5, 1),
        opacity 0.25s ease !important;
      z-index: 999 !important;
    }
    ytm-bottom-bar-renderer.ae-hidden {
      transform: translate3d(-50%, 140%, 0) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    /* ── Tab bar inner ───────────────────────────────────────────────────── */
    ytm-pivot-bar-renderer {
      position: relative !important;   /* mốc toạ độ cho pill */
      background: transparent !important;
      border-top: none !important;
      padding: 4px 6px !important;
      display: flex !important;
      justify-content: space-around !important;
      align-items: center !important;
    }
    ytm-pivot-bar-item-renderer, .ae-dl-tab {
      position: relative !important;
      z-index: 1 !important;           /* nằm trên pill */
      flex: none !important;
      min-width: 54px !important;
      border-radius: 999px !important;
      padding: 6px 12px !important;
      background: transparent !important;
      opacity: 0.62;
      -webkit-tap-highlight-color: transparent;
      transition:
        opacity 0.25s ease,
        transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    ytm-pivot-bar-item-renderer.iron-selected { background: transparent !important; opacity: 1; }

    /* Pill nền active: chỉ animate transform + width trên 1 phần tử tuyệt đối nhỏ → nhẹ, chạy trên GPU */
    #ae-pill {
      position: absolute; left: 0; top: 4px; bottom: 4px; width: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.18);
      transform: translate3d(0, 0, 0);
      opacity: 0;
      z-index: 0;
      pointer-events: none;
      will-change: transform;
    }
    #ae-pill.ae-on { opacity: 1; }
    #ae-pill.ae-anim {
      transition:
        transform 0.42s cubic-bezier(0.32, 0.72, 0, 1),
        width 0.42s cubic-bezier(0.32, 0.72, 0, 1),
        opacity 0.2s ease;
    }

    /* Chừa chỗ để bar nổi không che nội dung */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 85px) !important;
    }
  `);

  const getBar = () => document.querySelector('ytm-bottom-bar-renderer');
  const getPivot = () => document.querySelector('ytm-pivot-bar-renderer');
  const normPath = (p) => p.replace(/\/+$/, '') || '/';

  // ── 1. Pill trượt theo tab đang chọn ─────────────────────────────────────
  let pivotEl = null, pill = null, mo = null, ro = null, placed = false, raf = 0;

  const isSelected = (el) =>
    el.classList.contains('iron-selected') ||
    el.getAttribute('aria-selected') === 'true' ||
    el.getAttribute('aria-current') === 'page';

  const tabPath = (el) => {
    const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
    if (!a) return null;
    try { return normPath(new URL(a.getAttribute('href'), location.href).pathname); } catch (_) { return null; }
  };

  const selectedTab = () => {
    const tabs = [...pivotEl.querySelectorAll('ytm-pivot-bar-item-renderer')];
    return tabs.find(isSelected) || tabs.find((t) => tabPath(t) === normPath(location.pathname)) || null;
  };

  const place = (tab) => {
    if (!pill) return;
    if (!tab || !tab.offsetWidth) { pill.classList.remove('ae-on'); return; }
    pill.style.width = tab.offsetWidth + 'px';
    pill.style.transform = 'translate3d(' + tab.offsetLeft + 'px,0,0)';
    pill.classList.add('ae-on');
    if (!placed) {
      // Lần đặt đầu tiên: không animate (tránh pill bay từ góc trái); bật transition sau 2 frame
      placed = true;
      requestAnimationFrame(() => requestAnimationFrame(() => pill && pill.classList.add('ae-anim')));
    }
  };

  // Trả về true nếu pivot vừa được gắn mới (YouTube có thể dựng lại bar)
  const ensure = () => {
    const p = getPivot();
    let changed = false;
    if (p !== pivotEl) {
      if (mo) mo.disconnect();
      if (ro) ro.disconnect();
      pivotEl = p; placed = false; changed = true;
      if (!p) return changed;
      pill = document.getElementById('ae-pill');
      if (!pill) { pill = document.createElement('div'); pill.id = 'ae-pill'; }
      mo = new MutationObserver(schedule);
      mo.observe(p, { attributes: true, attributeFilter: ['class', 'aria-selected'], subtree: true, childList: true });
      if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(schedule); ro.observe(p); }
    }
    if (pill && pivotEl && pill.parentNode !== pivotEl) pivotEl.appendChild(pill);
    return changed;
  };

  const sync = () => { raf = 0; ensure(); if (pivotEl) place(selectedTab()); };
  function schedule() { if (!raf) raf = requestAnimationFrame(sync); }

  // ── 2. Bấm tab: pill chạy ngay (không đợi YouTube đổi class); bấm lại tab đang chọn → cuộn lên đầu ──
  document.addEventListener('click', (e) => {
    const tab = e.target.closest && e.target.closest('ytm-pivot-bar-item-renderer');
    if (!tab) return;
    const path = tabPath(tab);
    if (isSelected(tab) && (!path || path === normPath(location.pathname))) {
      e.preventDefault(); e.stopImmediatePropagation();   // chặn YouTube tải lại feed: chỉ cuộn lên đầu
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    place(tab);
  }, true);

  // ── 3. Tự ẩn khi cuộn, có ngưỡng (hysteresis) để không nhấp nháy ─────────
  const SHOW_ABOVE_Y = 70;    // gần đầu trang: luôn hiện
  const HIDE_AFTER = 28;      // phải cuộn xuống tích lũy > 28px mới ẩn
  const SHOW_AFTER = 16;      // phải cuộn lên tích lũy > 16px mới hiện lại
  let hidden = false, lastY = 0, acc = 0, ticking = false;

  const setHidden = (v) => {
    acc = 0;
    if (v === hidden) return;
    hidden = v;
    const bar = getBar();
    if (bar) bar.classList.toggle('ae-hidden', v);
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

  // ── 4. Hiệu ứng nhấn tab (scale nhẹ, thuần CSS/JS, không haptic) ─────────
  const TAB_SEL = 'ytm-pivot-bar-item-renderer, .ae-dl-tab';
  const pressStyle = (e, scale) => {
    const tab = e.target.closest && e.target.closest(TAB_SEL);
    if (tab) tab.style.transform = scale;
    return tab;
  };

  AE.on('ready', () => {
    lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
    }, { passive: true });

    document.addEventListener('touchstart', (e) => pressStyle(e, 'scale(0.9)'), { passive: true });
    document.addEventListener('touchend', (e) => {
      const tab = pressStyle(e, 'scale(1.06)');
      if (tab) setTimeout(() => { tab.style.transform = ''; }, 160);
    }, { passive: true });
    document.addEventListener('touchcancel', (e) => pressStyle(e, ''), { passive: true });

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('ae:navigate', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
  });

  AE.on('refresh', () => { setHidden(false); schedule(); });
  AE.on('browse', () => { if (ensure()) schedule(); });
})();
