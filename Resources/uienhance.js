// Aether UI Enhancement – Liquid-Glass bottom nav + gestures + branding + animations + downloads tab
(() => {
  'use strict';
  if (window.__aeUI) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;


  const AE_LOGO = 'data:image/png;base64,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';

  // ── Icon (Material) dùng cho hàng lịch sử / gợi ý / nút điền ──────────────
  const ICON = (d) => 'url("data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='" + d + "'/></svg>") + '")';
  const ICO_HISTORY = ICON('M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z');
  const ICO_SEARCH = ICON('M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z');
  const ICO_FILL = ICON('M5 15h2V8.41L18.59 20 20 18.59 8.41 7H15V5H5v10z');

  const SEARCH_CSS = `
    /* ── Danh sách lịch sử & gợi ý tìm kiếm: giống app YouTube hiện tại ───── */
    .ae-sug-list {
      background: #0f0f0f !important;
      padding: 0 !important; margin: 0 !important;
      border: 0 !important; box-shadow: none !important;
    }
    .ae-sug-row {
      display: flex !important;
      align-items: center !important;
      min-height: 48px !important;
      margin: 0 !important;
      padding: 0 4px 0 16px !important;
      box-sizing: border-box !important;
      background: transparent !important;
      border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
      -webkit-tap-highlight-color: rgba(255,255,255,0.10);
      -webkit-touch-callout: none;
      -webkit-user-select: none; user-select: none;
    }
    .ae-sug-row:active { background: rgba(255,255,255,0.10) !important; }
    /* Icon bên trái: đồng hồ = lịch sử, kính lúp = gợi ý */
    .ae-sug-row::before {
      content: ''; flex: 0 0 24px; width: 24px; height: 24px; margin-right: 16px;
      background-color: #fff; opacity: .92;
      -webkit-mask: var(--ae-ico) center / contain no-repeat;
              mask: var(--ae-ico) center / contain no-repeat;
    }
    .ae-sug-row.ae-hist { --ae-ico: ${ICO_HISTORY}; }
    .ae-sug-row.ae-sug  { --ae-ico: ${ICO_SEARCH}; }
    /* Chữ: trắng, không gạch chân, không còn màu link xanh */
    .ae-sug-row, .ae-sug-row *:not(.ae-sug-fill) {
      color: #fff !important; text-decoration: none !important;
      font-size: 16px !important; font-weight: 400 !important;
      background-color: transparent !important; border: 0 !important;
      box-shadow: none !important; text-transform: none !important;
    }
    .ae-sug-row > *:not(.ae-sug-fill):not(.ae-sug-remove) {
      flex: 1 1 auto !important; min-width: 0 !important;
      white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
      margin: 0 !important; padding: 0 !important;
    }
    /* Ẩn chữ "Remove" xanh; xóa bằng nhấn giữ (có hộp thoại xác nhận) như YouTube */
    .ae-sug-remove { display: none !important; }
    /* Nút ↖ điền chữ vào ô tìm kiếm */
    .ae-sug-fill {
      flex: 0 0 44px !important; width: 44px !important; height: 44px !important;
      margin: 0 0 0 auto !important; padding: 0 !important;
      border: 0 !important; background: transparent !important; position: relative;
      -webkit-tap-highlight-color: transparent;
    }
    .ae-sug-fill::after {
      content: ''; position: absolute; inset: 10px;
      background-color: #aaa;
      -webkit-mask: ${ICO_FILL} center / contain no-repeat;
              mask: ${ICO_FILL} center / contain no-repeat;
    }
    .ae-sug-fill:active::after { background-color: #fff; }

    /* Bottom sheet xác nhận xóa lịch sử */
    #ae-sheet { position: fixed; inset: 0; z-index: 2147483646; font-family: -apple-system, sans-serif; }
    #ae-sheet .ae-sheet-bg { position: absolute; inset: 0; background: rgba(0,0,0,.55); animation: ae-fade .18s ease both; }
    #ae-sheet .ae-sheet-card {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: #212121; border-radius: 14px 14px 0 0;
      padding: 18px 0 calc(env(safe-area-inset-bottom, 0px) + 8px);
      animation: ae-sheet-up .24s cubic-bezier(.25,1,.5,1) both;
    }
    #ae-sheet .ae-sheet-q {
      color: #aaa; font-size: 13px; padding: 0 20px 10px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #ae-sheet button {
      display: block; width: 100%; text-align: left; border: 0; background: transparent;
      color: #fff; font-size: 16px; padding: 14px 20px;
    }
    #ae-sheet button:active { background: rgba(255,255,255,.1); }
    #ae-sheet .ae-sheet-ok { color: #ff4e45; }
    @keyframes ae-fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ae-sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
  `;

  // ── 1. CSS: Liquid-Glass + Header + Comments ──────────────────────────────
  const CSS = `
    /* ── Bottom bar: floating capsule ───────────────────────────────────── */
    ytm-bottom-bar-renderer {
      left: 50% !important;
      right: auto !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
      transform: translate3d(-50%, 0, 0) !important;
      width: auto !important;
      min-width: min(320px, 90vw) !important;
      border-radius: 999px !important;

      /* Liquid Glass Apple Style */
      /* Nền gần đặc, KHÔNG backdrop-filter: blur realtime trên nội dung đang cuộn là nguồn giật khi lướt feed */
      background: rgba(18, 18, 22, 0.94) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border: 0.5px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow:
        inset 0 0.5px 0 rgba(255,255,255,0.12),
        0 4px 14px rgba(0, 0, 0, 0.5) !important;   /* bóng nhỏ: bóng blur 36px phải vẽ lại mỗi frame cuộn */

      overflow: hidden !important;
      transition:
        transform 0.38s cubic-bezier(0.25, 1, 0.5, 1),
        opacity 0.25s ease !important;
      z-index: 999 !important;
    }

    /* Scroll-to-hide state */
    ytm-bottom-bar-renderer.ae-hidden {
      transform: translate3d(-50%, 140%, 0) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    /* ── Tab bar inner ───────────────────────────────────────────────────── */
    ytm-pivot-bar-renderer {
      background: transparent !important;
      border-top: none !important;
      padding: 4px 6px !important;
      display: flex !important;
      justify-content: space-around !important;
      align-items: center !important;
    }

    ytm-pivot-bar-item-renderer, .ae-dl-tab {
      flex: none !important;
      min-width: 54px !important;
      border-radius: 999px !important;
      padding: 6px 12px !important;
      transition:
        background 0.18s ease,
        transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    ytm-pivot-bar-item-renderer.iron-selected {
      background: rgba(255, 255, 255, 0.14) !important;
    }

    /* Ẩn triệt để Shorts Tab và Kệ Reels chuyên biệt */
    ytm-reel-shelf-renderer {
      display: none !important;
    }

    /* Đảm bảo phần Recent / Lịch sử xem trong tab Hồ sơ luôn hiển thị đầy đủ */

    /* ── Content clearance so floating bar doesn't cover items ──────────── */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 85px) !important;
    }

    /* ── Header hiện đại & Logo có lề chuẩn ──────────────────────────────── */
    .mobile-topbar-header, ytm-mobile-topbar-renderer {
      background: rgba(12, 12, 15, 0.97) !important;
      border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
      padding-left: 0 !important;
    }

    /* Chỉ căn lề riêng cho logo Aether ở trang chủ, KHÔNG làm lệch thanh tìm kiếm */
    .header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, .ytm-mobile-topbar-renderer-logo {
      margin-left: 4px !important;
      padding-left: 0 !important;
    }

    /* Chuyển trang mượt mà. Chỉ ngoài trang watch, và fill-mode "backwards" để KHÔNG giữ transform sau khi xong:
       transform còn sót trên tổ tiên làm position:fixed/sticky (player, chip) bị lệch theo trang. */
    body:not(.ae-watching) ytm-section-list-renderer,
    body:not(.ae-watching) ytm-search-results-section-renderer {
      animation: ae-fadein 0.2s ease backwards;
    }
    @keyframes ae-fadein {
      from { opacity: 0; }   /* chỉ opacity: không tạo transform trên cả danh sách feed */
      to   { opacity: 1; }
    }
  `;

  const injectCSS = () => {
    if (document.getElementById('ae-ui-style')) return;
    const root = document.head || document.documentElement;
    if (!root) return;
    const s = document.createElement('style');
    s.id = 'ae-ui-style';
    s.textContent = CSS + SEARCH_CSS;
    root.appendChild(s);
  };
  injectCSS();
  document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

  // ── 2. Thay thế logo YouTube trên Header thành Aether (có khoảng cách) ────
  const replaceLogoWithAether = () => {
    const logoTargets = document.querySelectorAll(
      '.header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, a.mobile-topbar-header-endpoint, .ytm-mobile-topbar-renderer-logo'
    );
    logoTargets.forEach((el) => {
      if (el.dataset.aetherLogo) return;
      el.dataset.aetherLogo = 'true';
      // Logo Aether (icon app) thay cho chấm tròn đỏ; sát trái hơn trước (bỏ margin/padding thừa)
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:7px;margin-left:0;padding-left:0;font-family:-apple-system,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.5px;text-decoration:none;">
          <img alt="" src="${AE_LOGO}" style="width:24px;height:24px;border-radius:7px;display:block;flex:none;">
          <span style="background:linear-gradient(135deg,#ffffff 20%,#ff334b 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Aether</span>
        </div>
      `;
    });
  };

  // ── 3. Lọc bỏ các mục thừa và thêm thẻ "Video đã tải" trong phần Hồ Sơ ───
  const cleanProfileMenu = () => {
    const unwantedKeywords = ['phim', 'films', 'movies', 'help', 'trợ giúp', 'feedback', 'phản hồi', 'youtube premium'];
    document.querySelectorAll('ytm-compact-link-renderer, ytm-menu-item-renderer').forEach((item) => {
      const text = item.textContent?.toLowerCase() || '';
      for (const kw of unwantedKeywords) {
        if (text.includes(kw)) {
          item.style.setProperty('display', 'none', 'important');
          break;
        }
      }
    });

    // Thêm thẻ "Video đã tải ngoại tuyến" vào Hồ Sơ bên dưới phần Lịch sử xem (Recent)
    if (location.pathname.startsWith('/feed/you') || location.pathname.startsWith('/feed/library')) {
      if (!document.getElementById('ae-profile-dl-card')) {
        const historyShelf = document.querySelector('ytm-rich-shelf-renderer, ytm-item-section-renderer:has(a[href*="/watch"])');
        const container = document.querySelector('ytm-section-list-renderer') || document.querySelector('.page-container');
        if (container) {
          const card = document.createElement('div');
          card.id = 'ae-profile-dl-card';
          card.style.cssText = `
            margin: 12px 14px;
            padding: 13px 16px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.08);
            border: 0.5px solid rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
          `;
          card.addEventListener('click', () => {
            try {
              window.webkit?.messageHandlers?.aetherNav?.postMessage({ action: 'openDownloads' });
            } catch (_) { }
          });
          if (historyShelf && historyShelf.nextSibling) {
            historyShelf.parentNode.insertBefore(card, historyShelf.nextSibling);
          } else {
            container.prepend(card);
          }
        }
      }
    }
  };

  // ── 4. Thêm Tab "Đã tải" riêng vào Bottom Bar ──────────────────────────────
  const injectDownloadsTab = () => {
    const pivot = document.querySelector('ytm-pivot-bar-renderer');
    if (!pivot || document.getElementById('ae-downloads-tab')) return;

    const tab = document.createElement('div');
    tab.id = 'ae-downloads-tab';
    tab.className = 'ae-dl-tab';
    tab.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    `;
    tab.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;position:relative;">
        <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="8 12 12 16 16 12"></polyline>
          <line x1="12" y1="8" x2="12" y2="16"></line>
        </svg>
      </div>
      <span style="font-size:10px;font-weight:600;color:#fff;margin-top:3px;">Đã tải</span>
    `;

    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tab.style.transform = 'scale(0.88)';
      setTimeout(() => { tab.style.transform = ''; }, 160);
      try {
        window.webkit?.messageHandlers?.aetherNav?.postMessage({ action: 'openDownloads' });
      } catch (_) { }
    });

    // Chèn trước tab Hồ sơ
    const lastItem = pivot.lastElementChild;
    if (lastItem) {
      pivot.insertBefore(tab, lastItem);
    } else {
      pivot.appendChild(tab);
    }
  };

  // ── 4b. Xoá triệt để Tab Shorts và các Kệ Shorts trên trang chủ ─────────
  const removeShortsElements = () => {
    // Xoá tab Shorts khỏi Bottom Bar
    const pivotTabs = document.querySelectorAll('ytm-pivot-bar-item-renderer');
    pivotTabs.forEach((tab) => {
      const text = tab.textContent || '';
      const aria = tab.getAttribute('aria-label') || '';
      const href = tab.querySelector('a')?.getAttribute('href') || '';
      if (text.includes('Shorts') || aria.includes('Shorts') || href.includes('/shorts')) {
        tab.style.display = 'none';
        tab.remove();
      }
    });

    // TUYỆT ĐỐI KHÔNG xoá kệ khi ở trong Hồ sơ (để bảo vệ phần Recent / Lịch sử xem video)
    if (location.pathname.startsWith('/feed/you') || location.pathname.startsWith('/feed/library') || location.pathname.startsWith('/feed/history')) {
      return;
    }

    // Xoá kệ Shorts chuyên biệt trên trang chủ
    const shelves = document.querySelectorAll('ytm-reel-shelf-renderer, ytm-rich-section-renderer');
    shelves.forEach((el) => {
      if (el.tagName.toLowerCase() === 'ytm-reel-shelf-renderer') {
        el.style.display = 'none';
        el.remove();
        return;
      }
      const hasReel = el.querySelector('ytm-reel-item-renderer, [aria-label*="Shorts"], [aria-label*="shorts"]');
      const hasWatchVideo = el.querySelector('a[href*="/watch?v="]');
      if (hasReel && !hasWatchVideo) {
        el.style.display = 'none';
        el.remove();
      }
    });
  };

  // ── 5. Search: restyle lịch sử/gợi ý giống YouTube hiện tại ────────────────
  // Không dựa vào tên tag/class của YouTube (hay đổi): nhận diện hàng lịch sử qua nút "Remove"/"Xóa".
  const REMOVE_RE = /^(remove|xóa|xoá|gỡ|delete)$/i;
  const SEARCH_INPUT_SEL = 'input[type="search"], input[name="search_query"], input[type="text"]';

  const isSearchContext = () => {
    const p = location.pathname;
    if (p.startsWith('/watch') || p.startsWith('/results') || p.startsWith('/shorts')) return false;
    return /search/i.test(location.hash) || !!document.querySelector('input[type="search"], input[name="search_query"]');
  };

  // Tìm mọi nút có chữ Remove/Xóa (duyệt text node, rẻ hơn querySelectorAll('*'))
  const findRemoveButtons = () => {
    const out = new Set();
    if (!document.body) return [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const t = n.nodeValue;
        return t && t.length < 10 && REMOVE_RE.test(t.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (w.nextNode()) {
      const el = w.currentNode.parentElement;
      if (el) out.add(el.closest('button, a, [role="button"]') || el);
    }
    return [...out];
  };

  // Từ nút Remove đi lên tới "hàng": tổ tiên cao nhất chỉ chứa đúng 1 nút Remove và text ngắn
  const rowOf = (btn, all) => {
    let node = btn;
    while (node.parentElement && node.parentElement !== document.body) {
      const p = node.parentElement;
      if (all.filter((b) => p.contains(b)).length > 1) break;   // p chứa nhiều hàng → node là hàng
      if ((p.textContent || '').trim().length > 160) break;     // đã leo quá cao
      if (p.querySelector('input, form, header')) break;        // tới vùng chứa cả ô tìm kiếm → dừng
      node = p;
    }
    return node === btn ? btn.parentElement : node;
  };

  const rowText = (row) => {
    const clone = row.cloneNode(true);
    clone.querySelectorAll('.ae-sug-fill, .ae-sug-remove').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  // Fallback cho gợi ý khi đang gõ (không có nút Remove): tìm list nằm dưới ô nhập, các con là text ngắn
  const findPlainSuggestionList = () => {
    const input = document.querySelector(SEARCH_INPUT_SEL);
    if (!input || !input.value || !input.value.trim()) return null;
    const bottom = input.getBoundingClientRect().bottom - 8;
    let best = null;
    for (const el of document.body.getElementsByTagName('*')) {
      const n = el.childElementCount;
      if (n < 3 || n > 20 || el.contains(input)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < bottom || r.width < window.innerWidth * 0.9) continue;
      const kids = [...el.children];
      const ok = kids.every((k) => {
        const len = (k.textContent || '').trim().length;
        return len > 0 && len < 120 && !k.querySelector('img, video');
      });
      if (ok && (!best || n >= best.childElementCount)) best = el;
    }
    return best;
  };

  const markRow = (row, isHist, removeBtn) => {
    row.classList.add('ae-sug-row');
    row.classList.toggle('ae-hist', isHist);
    row.classList.toggle('ae-sug', !isHist);
    if (removeBtn) removeBtn.classList.add('ae-sug-remove');
    if (!row.querySelector(':scope > .ae-sug-fill')) {
      const fill = document.createElement('button');
      fill.type = 'button';
      fill.className = 'ae-sug-fill';
      fill.setAttribute('aria-label', 'Điền vào ô tìm kiếm');
      row.appendChild(fill);
    }
  };

  let searchLast = 0, searchTimer = 0;
  const enhanceSearch = () => {
    if (!isSearchContext()) return;
    const now = Date.now();
    if (now - searchLast < 120) {                 // throttle + trailing call
      if (!searchTimer) searchTimer = setTimeout(() => { searchTimer = 0; enhanceSearch(); }, 140);
      return;
    }
    searchLast = now;

    const buttons = findRemoveButtons();
    if (buttons.length) {
      const handledLists = new Set();
      buttons.forEach((btn) => {
        const row = rowOf(btn, buttons);
        if (!row) return;
        const list = row.parentElement;
        // Hàng cùng list (gồm cả gợi ý thường không có nút Remove) được style đồng bộ
        const siblings = list && list.children.length <= 30 &&
          [...list.children].every((k) => (k.textContent || '').trim().length < 160);
        if (siblings && !handledLists.has(list)) {
          handledLists.add(list);
          list.classList.add('ae-sug-list');
          [...list.children].forEach((k) => {
            if (!(k.textContent || '').trim()) return;
            if (k.tagName === 'HEADER' || k.querySelector('input')) return;   // không đụng vào header/ô nhập
            const rb = buttons.find((b) => k.contains(b));
            markRow(k, !!rb, rb || null);
          });
        } else if (!siblings) {
          markRow(row, true, btn);
        }
      });
      return;
    }
    const list = findPlainSuggestionList();
    if (list) {
      list.classList.add('ae-sug-list');
      [...list.children].forEach((k) => markRow(k, false, null));
    }
  };

  const fillSearchInput = (text) => {
    const input = document.querySelector(SEARCH_INPUT_SEL);
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text + ' ');
    input.dispatchEvent(new Event('input', { bubbles: true }));   // để YouTube tải gợi ý mới
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) { }
  };

  const showRemoveSheet = (query, onConfirm) => {
    document.getElementById('ae-sheet')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'ae-sheet';
    wrap.innerHTML = '<div class="ae-sheet-bg"></div><div class="ae-sheet-card">' +
      '<div class="ae-sheet-q"></div>' +
      '<button class="ae-sheet-ok" type="button">Xóa khỏi lịch sử tìm kiếm</button>' +
      '<button class="ae-sheet-cancel" type="button">Hủy</button></div>';
    wrap.querySelector('.ae-sheet-q').textContent = query;   // textContent: tránh chèn HTML từ query
    const close = () => wrap.remove();
    wrap.querySelector('.ae-sheet-bg').addEventListener('click', close);
    wrap.querySelector('.ae-sheet-cancel').addEventListener('click', close);
    wrap.querySelector('.ae-sheet-ok').addEventListener('click', () => { close(); onConfirm(); });
    document.body.appendChild(wrap);
  };

  // Nút ↖ và nhấn giữ để xóa: event delegation, không phụ thuộc YouTube render lại DOM
  (() => {
    let timer = 0, startX = 0, startY = 0, pressedRow = null, longPressed = false;
    const cancel = () => { clearTimeout(timer); timer = 0; };

    window.addEventListener('touchstart', (e) => {
      const row = e.target.closest?.('.ae-sug-row.ae-hist');
      if (!row || e.target.closest('.ae-sug-fill') || e.touches.length !== 1) return;
      pressedRow = row; longPressed = false;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      cancel();
      timer = setTimeout(() => {
        longPressed = true;
        const btn = row.querySelector('.ae-sug-remove');
        if (!btn) return;
        showRemoveSheet(rowText(row), () => { btn.click(); });
      }, 520);
    }, { passive: true, capture: true });

    window.addEventListener('touchmove', (e) => {
      if (!timer) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
    }, { passive: true, capture: true });
    window.addEventListener('touchend', cancel, { passive: true, capture: true });
    window.addEventListener('touchcancel', cancel, { passive: true, capture: true });

    // Sau nhấn giữ: chặn click kế tiếp để YouTube không chạy tìm kiếm
    window.addEventListener('click', (e) => {
      const fill = e.target.closest?.('.ae-sug-fill');
      if (fill) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const row = fill.closest('.ae-sug-row');
        if (row) fillSearchInput(rowText(row));
        return;
      }
      if (longPressed && pressedRow && pressedRow.contains(e.target)) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      }
      longPressed = false;
    }, true);
  })();

  // ── 5b. Vuốt xuống từ video → PiP + về trang trước (chạy trong JS để có user gesture) ─
  // Mượt: cập nhật transform trong requestAnimationFrame (1 lần/frame), chỉ dùng transform+opacity (GPU),
  // touch-action:none trên player (CSS ở adblock.js) để trang không cuộn tranh quyền, và khi thả quá ngưỡng
  // video tiếp tục trượt ra thay vì bật ngược lại rồi mới biến mất.
  const playerEl = (v) => v.closest('#player-container-id, .player-container') || v.parentElement;
  const resetPlayer = (el, animate) => {
    if (!el) return;
    el.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s ease' : 'none';
    el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, animate ? 260 : 30);
  };

  (() => {
    let g = null, busy = false, raf = 0, lastEl = null;
    const COMMIT_DIST = 90;

    const paint = () => {
      raf = 0;
      if (!g || g.lock !== 'v' || !g.el) return;
      const dy = Math.max(0, g.dy);
      const ty = dy < 120 ? dy : 120 + (dy - 120) * 0.35;           // kéo càng xa càng nặng tay
      const p = Math.min(1, dy / 260);
      g.el.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0) scale(' + (1 - p * 0.1).toFixed(3) + ')';
    };

    window.addEventListener('touchstart', (e) => {
      g = null;
      if (busy || !location.pathname.startsWith('/watch') || e.touches.length !== 1) return;
      if (inFullscreenMode()) return;   // toàn màn hình: không có cử chỉ thu nhỏ
      const v = document.querySelector('.html5-video-player video, video');
      if (!v || v.webkitDisplayingFullscreen || document.fullscreenElement) return;
      const r = v.getBoundingClientRect();
      const t = e.touches[0];
      if (r.width < 50 || t.clientX < r.left || t.clientX > r.right || t.clientY < r.top || t.clientY > r.bottom) return;
      g = { v, x0: t.clientX, y0: t.clientY, t0: Date.now(), dy: 0, lock: null, el: playerEl(v) };
    }, { passive: true, capture: true });

    window.addEventListener('touchmove', (e) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      if (!g.lock && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        g.lock = (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2) ? 'v' : 'x';   // chỉ nhận vuốt xuống dọc
        if (g.lock === 'v' && g.el) {
          g.el.style.transition = 'none';
          g.el.style.willChange = 'transform';
          g.y0 = t.clientY;   // tính từ lúc khoá hướng → video bám ngón tay, không bị giật nhảy ban đầu
        }
      }
      if (g.lock === 'x') { g = null; return; }
      if (g.lock === 'v') {
        g.dy = t.clientY - g.y0;
        if (!raf) raf = requestAnimationFrame(paint);
      }
    }, { passive: true, capture: true });

    const finish = (cancelled) => {
      const s = g; g = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!s || s.lock !== 'v') return;
      const dt = (Date.now() - s.t0) || 1;
      const fast = s.dy > 40 && (s.dy / dt) > 0.5;
      if (!cancelled && (s.dy > COMMIT_DIST || fast)) {
        // Tiếp tục trượt ra rồi mờ hẳn: liền mạch với lúc PiP bật lên
        lastEl = s.el;
        if (s.el) {
          s.el.style.transition = 'transform .2s cubic-bezier(.4,0,1,1)';
          s.el.style.transform = 'translate3d(0,' + Math.max(160, s.dy) + 'px,0) scale(.88)';
        }
        busy = true; setTimeout(() => { busy = false; }, 1500);
        // Gọi đồng bộ trong touchend để WebKit coi là user gesture khi bật PiP
        try { window.__aeMedia && window.__aeMedia.minimize(); } catch (_) { resetPlayer(s.el, true); }
      } else {
        resetPlayer(s.el, true);
      }
    };
    window.addEventListener('touchend', () => finish(false), { passive: true, capture: true });
    window.addEventListener('touchcancel', () => finish(true), { passive: true, capture: true });

    // Kết quả thu nhỏ: thất bại → đưa video về chỗ cũ; thành công → trang đã bị "park" phía sau,
    // dọn style lúc không ai nhìn thấy để khi quay lại từ PiP video hiện đúng vị trí
    window.addEventListener('ae:minimize-result', (e) => {
      const el = lastEl; lastEl = null;
      if (!el) return;
      if (e.detail && e.detail.ok) setTimeout(() => resetPlayer(el, false), 700);
      else resetPlayer(el, true);
    });
  })();

  // ── 5c. Player ghim: chừa chỗ cho nội dung bên dưới (tự đo & tự hiệu chỉnh) ──────────────────────
  // Player đang position:fixed nên không còn chiếm chỗ trong luồng trang. Cả spacer lẫn padding của body đều không
  // chắc đúng vì không biết cấu trúc DOM thật của YouTube (nội dung có thể nằm trong container fixed/absolute riêng).
  // Cách làm không phụ thuộc cấu trúc: lấy tiêu đề video làm "mốc" → tìm nhánh nội dung chứa nó → thêm padding-top
  // cho nhánh đó cho tới khi mốc nằm ngay dưới player. Nếu YouTube đã tự chừa chỗ thì không thêm gì (không bị hở).
  const ensurePlayerSpacer = (() => {
    let ro = null, watched = null, padEl = null, pad = 0, fixes = 0, lastNav = '';
    const PROBE = 'h1.slim-video-metadata-title, .slim-video-metadata-title, .ytm-slim-video-information-title, ytm-slim-video-metadata-section-renderer, ytm-slim-video-information-renderer, ytm-slim-owner-renderer, .slim-owner-channel-name';
    const clearPad = () => { if (padEl) padEl.style.removeProperty('padding-top'); padEl = null; pad = 0; };
    const setPad = (el, px) => {
      if (padEl && padEl !== el) padEl.style.removeProperty('padding-top');
      padEl = el; pad = Math.max(0, Math.round(px));
      el.style.setProperty('padding-top', pad + 'px', 'important');
    };
    const measure = (player) => {
      // Dump DOM thật cho thấy #player-container-id có chiều cao đúng → dùng thẳng; chỉ khi bất thường mới dự phòng 16:9.
      // (Không lấy max với video/inner nữa: ngay sau khi thoát fullscreen chúng còn kích thước cũ → pad bị phình gấp đôi.)
      let h = player.getBoundingClientRect().height;
      if (!(h > 20)) h = window.innerWidth * 9 / 16;
      return Math.round(Math.min(h, window.innerHeight * 0.6));
    };
    const findProbe = (player) => {
      let p = document.querySelector(PROBE);
      if (p && !player.contains(p)) return p;
      for (const el of document.querySelectorAll('h1, h2')) {
        if (!player.contains(el) && (el.textContent || '').trim().length > 3 && !el.closest('ytm-engagement-panel-section-list-renderer, ytm-comment-section-renderer')) return el;
      }
      return null;
    };
    // Nhánh con của tổ tiên chung (với player) chứa probe
    const branchOf = (probe, player) => {
      let n = probe;
      while (n && n.parentElement && !n.parentElement.contains(player)) n = n.parentElement;
      return (n && n !== document.body && n !== document.documentElement && !n.contains(player)) ? n : null;
    };
    const apply = () => {
      if (!location.pathname.startsWith('/watch')) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      if (inFullscreenMode()) return;
      const nav = location.pathname + location.search;
      if (nav !== lastNav) { lastNav = nav; fixes = 0; }      // video mới → hiệu chỉnh lại từ đầu
      const player = document.getElementById('player-container-id') || document.querySelector('.player-container');
      if (!player) return;
      const h = measure(player);
      if (typeof ResizeObserver === 'function' && watched !== player) {
        if (ro) ro.disconnect();
        ro = new ResizeObserver(apply);
        ro.observe(player);
        const inner = player.querySelector('.html5-video-player');
        if (inner) ro.observe(inner);
        watched = player;
      }
      const probe = findProbe(player);
      if (!probe || window.scrollY > 1) return;                 // chưa có nội dung / đang cuộn: đợi lần sau
      const branch = branchOf(probe, player);
      if (!branch) return;
      if (padEl !== branch) { setPad(branch, 0); }
      // Idempotent: vị trí "tự nhiên" của mốc (không tính padding ta thêm) = y - pad → pad cần có = h - tự_nhiên.
      // Không cộng dồn nên không bao giờ phình lên dù bị gọi nhiều lần / số liệu thoáng qua.
      const y = probe.getBoundingClientRect().top + window.scrollY;
      const want = Math.max(0, Math.round(h - (y - pad)));
      if (want !== pad && fixes < 6) { fixes++; setPad(branch, want); requestAnimationFrame(apply); }
      else if (want === pad) fixes = 0;
    };
    window.addEventListener('resize', () => { setTimeout(() => { fixes = 0; apply(); }, 120); setTimeout(() => { fixes = 0; apply(); }, 600); }, { passive: true });
    apply.reset = clearPad;
    return apply;
  })();

  // ── 5c-2. Fullscreen giả: ae-land (app đã xoay ngang) / ae-rot (xoay player 90° bằng CSS khi app không xoay được) ──
  let lastFsState = false;
  const postFs = (on) => {
    if (on === lastFsState) return;
    lastFsState = on;
    try { window.webkit.messageHandlers.aetherNav.postMessage({ isFullscreen: on }); } catch (_) { }
  };
  const inFullscreenMode = () => !!document.body && (document.body.classList.contains('ae-land') || document.body.classList.contains('ae-rot'));
  const setViewVars = () => {   // kích thước vùng nhìn thấy THẬT (innerWidth/innerHeight), dùng cho fullscreen xoay giả
    const r = document.documentElement.style;
    r.setProperty('--ae-w', window.innerWidth + 'px');
    r.setProperty('--ae-h', window.innerHeight + 'px');
  };
  const syncLandscape = () => {
    if (!document.body) return;
    setViewVars();
    const b = document.body;
    const v = document.querySelector('video');
    const native = !!(v && v.webkitDisplayingFullscreen);
    const watching = location.pathname.startsWith('/watch');
    const landscape = watching && window.innerWidth > window.innerHeight && !native &&
      !document.fullscreenElement && !document.webkitFullscreenElement;
    if (landscape) b.classList.remove('ae-rot');                 // app đã xoay thật → bỏ xoay giả
    if (!watching) b.classList.remove('ae-rot');
    const was = b.classList.contains('ae-land');
    b.classList.toggle('ae-land', landscape);
    postFs(landscape || b.classList.contains('ae-rot'));
    // Đổi hướng → báo YouTube tính lại kích thước player (CSS đã ép đúng, đây chỉ để player nội bộ đồng bộ)
    if (was !== landscape) [400].forEach((ms) => setTimeout(() => {   // 1 lần, sau khi xoay xong → không thêm tải lúc đang xoay
      try { window.dispatchEvent(new Event('resize')); } catch (_) { }
    }, ms));
  };
  window.addEventListener('resize', syncLandscape, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(syncLandscape, 150), { passive: true });
  window.addEventListener('ae:navigate', syncLandscape);
  window.__aeFs = {
    toggle() {
      const b = document.body;
      if (!b || !location.pathname.startsWith('/watch')) return;
      const post = (m) => { try { window.webkit.messageHandlers.aetherNav.postMessage(m); } catch (_) { } };
      if (b.classList.contains('ae-rot')) { b.classList.remove('ae-rot'); postFs(false); return; }   // thoát xoay giả
      if (window.innerWidth > window.innerHeight) { post({ action: 'exitFullscreen' }); return; }       // xoay app về dọc
      setViewVars();
      post({ action: 'enterFullscreen' });                                                              // xin xoay app sang ngang
      // Nếu app không xoay được (vd. chạy trong LiveContainer) → xoay player 90° bằng CSS
      setTimeout(() => {
        if (location.pathname.startsWith('/watch') && window.innerWidth <= window.innerHeight) {
          setViewVars(); b.classList.add('ae-rot'); postFs(true);
        }
      }, 900);
    }
  };

  // ── 5c-3. Bấm video ở trang duyệt → mở ở WebView riêng (giữ nguyên trang chủ phía sau) ────────
  window.addEventListener('click', (e) => {
    if (location.pathname.startsWith('/watch') || e.defaultPrevented) return;
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
    if (!/(^|\.)youtube\.com$/.test(u.hostname) || u.pathname !== '/watch' || !u.searchParams.get('v')) return;
    try {
      const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.aetherNav;
      if (!h) return;
      e.preventDefault(); e.stopImmediatePropagation();
      h.postMessage({ action: 'openWatch', url: u.href });
    } catch (_) { }
  }, true);

  // ── 5c-4. Thẻ "Next: … Mix" ở đáy: chạm BẤT KỲ đâu trên thẻ = mở danh sách (như bấm mũi tên) ──
  // Dump DOM thật: thẻ là <ytm-playlist-panel-entry-point> (fixed), mũi tên là button.playlist-panel-right-icon.
  // YouTube xử lý chạm thân thẻ bằng touch/pointer (không phải click) nên phải chặn từ touchend/pointerup ở pha capture.
  (() => {
    const ARROW = 'button.playlist-panel-right-icon, .playlist-panel-right-icon';
    let start = null;
    const cardAt = (x, y) => {
      const card = document.querySelector('ytm-playlist-panel-entry-point');
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return (r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) ? card : null;
    };
    const onArrow = (t) => !!(t && t.closest && t.closest(ARROW));
    const open = (card) => { const a = card.querySelector(ARROW); if (a) a.click(); };

    window.addEventListener('touchstart', (e) => {
      start = null;
      if (!location.pathname.startsWith('/watch') || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (cardAt(t.clientX, t.clientY) && !onArrow(e.target)) start = { x: t.clientX, y: t.clientY };
    }, { passive: true, capture: true });

    window.addEventListener('touchend', (e) => {
      const s = start; start = null;
      if (!s || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) return;       // kéo/cuộn, không phải chạm
      const card = cardAt(t.clientX, t.clientY);
      if (!card || onArrow(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();                       // chặn YouTube xử lý (nhảy video khác)
      open(card);
    }, { passive: false, capture: true });

    // Chặn các sự kiện còn lại của lần chạm đó trên thân thẻ (trừ mũi tên)
    ['pointerup', 'mouseup', 'click'].forEach((type) => window.addEventListener(type, (e) => {
      if (!location.pathname.startsWith('/watch') || onArrow(e.target)) return;
      if (e.isTrusted === false) return;
      if (cardAt(e.clientX, e.clientY)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true));
  })();

  // ── 5d. Animation mượt khi mở "xem trả lời" bình luận ──────────────────────────────────────────
  // CSS keyframes không làm nội dung bên dưới trượt theo → vẫn thấy "giật cục". Animate chiều cao thật bằng WAAPI.
  const animateReveal = (el, delay) => {
    if (!el || el.__aeRevealed || typeof el.animate !== 'function') return;
    el.__aeRevealed = true;
    const h = el.getBoundingClientRect().height;
    if (h < 8) return;
    el.style.overflow = 'hidden';
    const anim = el.animate(
      [
        { height: '0px', opacity: 0, transform: 'translateY(-8px)' },
        { height: h + 'px', opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 300, delay: delay || 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
    );
    const done = () => { el.style.overflow = ''; };
    anim.onfinish = done; anim.oncancel = done;
  };

  const REPLY_SEL = 'ytm-comment-replies-renderer ytm-comment-renderer, ytm-comment-replies-renderer .comment-reply, .comment-replies-renderer ytm-comment-renderer';
  const observeReplies = () => {
    if (!document.body) return;
    new MutationObserver((muts) => {
      if (!location.pathname.startsWith('/watch')) return;
      let i = 0;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          // Chỉ animate phần tử TRẢ LỜI mới thêm vào (bình luận gốc và panel giữ nguyên hành vi của YouTube)
          if (n.matches?.(REPLY_SEL)) animateReveal(n, Math.min(i++, 6) * 40);
          else if (n.matches?.('ytm-comment-replies-renderer, .comment-replies-renderer')) animateReveal(n, 0);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  };

  // ── 5e. Gỡ lỗi: giữ 3 ngón tay ~0.7s trên trang → copy sơ đồ DOM vào clipboard để dán gửi lập trình viên ──
  const dumpDom = () => {
    const out = [];
    const SKIP = /^(SCRIPT|STYLE|SVG|PATH|LINK|META|NOSCRIPT|IMG|YT-ICON|C3-ICON)$/i;
    const walk = (el, depth) => {
      if (SKIP.test(el.tagName) || depth > 11) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      let line = '  '.repeat(depth) + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
      line += ' [' + Math.round(r.top + window.scrollY) + ',' + Math.round(r.height) + ']';
      if (cs.position !== 'static') line += ' pos:' + cs.position;
      if (parseFloat(cs.paddingTop) > 0) line += ' pt:' + Math.round(parseFloat(cs.paddingTop));
      if (/^(H1|H2)$/.test(el.tagName)) line += ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
      out.push(line);
      let n = 0;
      const cap = /^(LAZY-LIST|YTM-SECTION-LIST-RENDERER)$/.test(el.tagName) ? 3 : 14;
      for (const c of el.children) { if (n++ >= cap) { out.push('  '.repeat(depth + 1) + '…'); break; } walk(c, depth + 1); }
    };
    const head = 'Aether DOM dump | ' + location.pathname + location.search.slice(0, 40) + ' | win ' + innerWidth + 'x' + innerHeight +
      ' | scrollY ' + Math.round(scrollY) + ' | body.class=' + document.body.className + ' | --ae-pad: ' +
      [...document.querySelectorAll('[style*="padding-top"]')].map((e) => e.tagName.toLowerCase() + ':' + e.style.paddingTop).join(',');
    walk(document.body, 0);
    // Các lớp phủ lớn (bottom sheet, panel, dialog): position fixed/absolute chiếm > 20% màn hình, kèm chuỗi tổ tiên
    const ov = [];
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (ov.length >= 40) break;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || (cs.position !== 'fixed' && cs.position !== 'absolute')) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < vw * vh * 0.2 || r.width < 100) continue;
      const nm = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      const chain = []; for (let n = el.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) chain.push(nm(n));
      ov.push(nm(el) + ' rect[x' + Math.round(r.left) + ' y' + Math.round(r.top) + ' w' + Math.round(r.width) + ' h' + Math.round(r.height) + '] ' +
        cs.position + ' z:' + cs.zIndex + ' tf:' + (cs.transform === 'none' ? '-' : 'y') + ' vis:' + cs.visibility + ' op:' + cs.opacity + ' <- ' + chain.join(' < '));
    }
    let text = head + '\n== OVERLAYS ==\n' + (ov.join('\n') || '(none)') + '\n== TREE ==\n' + out.join('\n');
    if (text.length > 16000) text = text.slice(0, 16000) + '\n…(cắt bớt)';
    return text;
  };
  (() => {
    let timer = 0;
    window.addEventListener('touchstart', (e) => {
      clearTimeout(timer);
      if (e.touches.length !== 3) return;
      timer = setTimeout(() => {
        try {
          const text = dumpDom();
          window.webkit.messageHandlers.aetherNav.postMessage({ action: 'debugDump', text });
        } catch (_) { }
      }, 700);
    }, { passive: true, capture: true });
    const stop = () => clearTimeout(timer);
    window.addEventListener('touchend', stop, { passive: true, capture: true });
    window.addEventListener('touchcancel', stop, { passive: true, capture: true });
  })();

  // ── 5f. Animation mở/đóng panel hàng đợi Mix ─────────────────────────────────────────────────────
  // Chỉ dùng WAAPI trên thuộc tính `translate`/`opacity` (KHÔNG fill, KHÔNG đổi transform/transition của YouTube) nên
  // không phá cơ chế đóng/mở riêng của panel như animation CSS ép cứng trước đây.
  // Mở: phần tử panel xuất hiện → trượt lên + hiện dần. Đóng: panel biến mất → dựng bản sao tĩnh trượt xuống + mờ dần.
  const ensurePanelAnimator = (() => {
    let host = null, mo = null, prev = [], snaps = [], raf = 0, snapTimer = 0;
    const HOST_SEL = 'ytm-playlist-engagement-panel';
    const OUT_MS = 230, IN_MS = 300;
    // Phần tử "panel" đang hiển thị trong host: cao > 150px, rộng gần hết màn hình, loại thẻ thu gọn + lớp nền của nó
    const visiblePanels = () => {
      const out = [];
      for (const el of host.querySelectorAll('*')) {
        if (el.closest('ytm-playlist-panel-entry-point') || el.classList.contains('playlist-entrypoint-background-protection')) continue;
        if (out.some((o) => o.contains(el))) continue;                        // chỉ lấy phần tử ngoài cùng
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.height > 150 && r.width > window.innerWidth * 0.8) out.push(el);
      }
      return out;
    };
    const isScrim = (el) => el.getBoundingClientRect().height >= window.innerHeight * 0.9 && !el.querySelector('ytm-playlist-panel-renderer, ytm-engagement-panel-section-list-renderer');
    const animateIn = (el) => {
      if (typeof el.animate !== 'function') return;
      const frames = isScrim(el) ? [{ opacity: 0 }, { opacity: 1 }] : [{ translate: '0 36px', opacity: 0 }, { translate: '0 0', opacity: 1 }];
      el.animate(frames, { duration: IN_MS, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
    const takeSnapshots = (els) => {
      snaps = els.map((el) => ({ parent: el.parentNode, clone: el.cloneNode(true), scrim: isScrim(el) }));
    };
    const animateOut = () => {
      const list = snaps; snaps = [];
      list.forEach(({ parent, clone, scrim }) => {
        if (!parent || !parent.isConnected || typeof clone.animate !== 'function') return;
        clone.style.pointerEvents = 'none';
        clone.removeAttribute('id');
        parent.appendChild(clone);
        const frames = scrim ? [{ opacity: 1 }, { opacity: 0 }] : [{ translate: '0 0', opacity: 1 }, { translate: '0 36px', opacity: 0 }];
        const a = clone.animate(frames, { duration: OUT_MS, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        const done = () => clone.remove();
        a.onfinish = done; a.oncancel = done;
        setTimeout(done, OUT_MS + 200);
      });
    };
    const check = () => {
      raf = 0;
      if (!host || !host.isConnected) return;
      const now = visiblePanels();
      if (!prev.length && now.length) {                         // vừa mở
        now.forEach(animateIn);
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => { const cur = visiblePanels(); if (cur.length) takeSnapshots(cur); }, IN_MS + 80);
      } else if (prev.length && !now.length) {                  // vừa đóng
        clearTimeout(snapTimer);
        animateOut();
      }
      prev = now;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    return () => {
      if (!location.pathname.startsWith('/watch')) { host = null; prev = []; snaps = []; if (mo) { mo.disconnect(); mo = null; } return; }
      const h = document.querySelector(HOST_SEL);
      if (!h || h === host) return;
      host = h; snaps = [];
      prev = visiblePanels();                                  // trạng thái ban đầu: không animate
      if (prev.length) takeSnapshots(prev);
      if (mo) mo.disconnect();
      mo = new MutationObserver(schedule);
      mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'opened', 'expanded'] });
    };
  })();

  // ── 5g. Vuốt từ mép trái → quay lại (JS dự phòng cho cử chỉ native): đóng video, về trang trước ─────
  (() => {
    let s = null;
    window.addEventListener('touchstart', (e) => {
      s = null;
      if (e.touches.length !== 1 || !location.pathname.startsWith('/watch')) return;
      if (inFullscreenMode()) return;
      const t = e.touches[0];
      if (t.clientX <= 24) s = { x: t.clientX, y: t.clientY, t0: Date.now() };
    }, { passive: true, capture: true });
    window.addEventListener('touchend', (e) => {
      const st = s; s = null;
      if (!st || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - st.x, dy = Math.abs(t.clientY - st.y);
      if (dx > 70 && dy < 80 && Date.now() - st.t0 < 800) {
        try { window.webkit.messageHandlers.aetherNav.postMessage({ action: 'edgeBack' }); } catch (_) { }
      }
    }, { passive: true, capture: true });
    window.addEventListener('touchcancel', () => { s = null; }, { passive: true, capture: true });
  })();

  // ── 6. Tối ưu Bottom bar: 120Hz mượt mà với requestAnimationFrame ─────────
  document.addEventListener('DOMContentLoaded', () => {
    let prev = 0;
    let hidden = false;
    let ticking = false;
    const getBar = () => document.querySelector('ytm-bottom-bar-renderer');

    const toggle = (hide) => {
      if (hide === hidden) return;
      hidden = hide;
      getBar()?.classList.toggle('ae-hidden', hide);
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y < 70) toggle(false);
          else if (y > prev + 16) toggle(true);
          else if (y < prev - 10) toggle(false);
          prev = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    const refreshUI = () => {
      hidden = false;
      getBar()?.classList.remove('ae-hidden');
      replaceLogoWithAether();
      cleanProfileMenu();
      removeShortsElements();
      injectDownloadsTab();
      enhanceSearch();
    };

    window.addEventListener('popstate', refreshUI);
    window.addEventListener('hashchange', refreshUI);
    window.addEventListener('ae:navigate', refreshUI);
    window.addEventListener('ae:navigate', () => setTimeout(ensurePlayerSpacer, 0));

    try {
      window.webkit?.messageHandlers?.aetherReady?.postMessage('ready');
    } catch (_) { }

    refreshUI();
    ensurePlayerSpacer();
    ensurePanelAnimator();
    window.addEventListener('ae:navigate', () => setTimeout(ensurePanelAnimator, 400));
    observeReplies();

    // MutationObserver: khi đang xem video YouTube đổi DOM liên tục (thanh tiến trình, bình luận…).
    // Trước đây mỗi lần đổi là chạy cả loạt querySelectorAll nặng → chiếm main thread, cử chỉ vuốt bị giật.
    // Giờ: trên /watch chỉ chạy việc nhẹ, tối đa ~4 lần/giây; ngoài /watch vẫn đủ nhanh (1 lần/frame).
    let moScheduled = false, moLast = 0, moTimer = 0;
    const runEnhancers = () => {
      moScheduled = false; moTimer = 0; moLast = Date.now();
      if (location.pathname.startsWith('/watch')) {
        removeShortsElements();
        ensurePlayerSpacer();
        syncLandscape();
        ensurePanelAnimator();
        return;
      }
      ensurePlayerSpacer.reset();   // rời trang watch → bỏ padding đã thêm
      replaceLogoWithAether();
      cleanProfileMenu();
      removeShortsElements();
      injectDownloadsTab();
      enhanceSearch();
    };
    const observer = new MutationObserver(() => {
      if (moScheduled) return;
      moScheduled = true;
      const wait = Math.max(0, (location.pathname.startsWith('/watch') ? 250 : 300) - (Date.now() - moLast));
      if (wait > 0) moTimer = setTimeout(runEnhancers, wait);
      else window.requestAnimationFrame(runEnhancers);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });

  // ── 7. Hiệu ứng chạm tab phản hồi xúc giác nhẹ (Spring feedback) ───────────
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer, .ae-dl-tab');
      if (tab) tab.style.transform = 'scale(0.88)';
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer, .ae-dl-tab');
      if (!tab) return;
      tab.style.transform = 'scale(1.08)';
      setTimeout(() => { if (tab) tab.style.transform = ''; }, 160);
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer, .ae-dl-tab');
      if (tab) tab.style.transform = '';
    }, { passive: true });
  }, { once: true });
})();