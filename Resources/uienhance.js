// Aether UI Enhancement – Liquid-Glass bottom nav + gestures + branding + animations + downloads tab
(() => {
  'use strict';
  if (window.__aeUI) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;


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
      background: rgba(16, 16, 20, 0.72) !important;
      /* blur nhẹ hơn: blur 40px + saturate trên nội dung đang cuộn rất tốn GPU → lag */
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 0.5px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow:
        inset 0 0.5px 0 rgba(255,255,255,0.12),
        0 8px 36px rgba(0, 0, 0, 0.65),
        0 2px 8px rgba(0, 0, 0, 0.35) !important;

      overflow: hidden !important;
      will-change: transform, opacity !important;
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
      margin-left: 14px !important;
      padding-left: 2px !important;
    }

    /* Chuyển trang mượt mà. Chỉ ngoài trang watch, và fill-mode "backwards" để KHÔNG giữ transform sau khi xong:
       transform còn sót trên tổ tiên làm position:fixed/sticky (player, chip) bị lệch theo trang. */
    body:not(.ae-watching) ytm-section-list-renderer,
    body:not(.ae-watching) ytm-search-results-section-renderer {
      animation: ae-fadein 0.2s ease backwards;
    }
    @keyframes ae-fadein {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
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
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-left:10px;padding-left:4px;font-family:-apple-system,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.5px;text-decoration:none;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff2442;box-shadow:0 0 10px #ff2442;"></span>
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
      g.el.style.opacity = String(1 - p * 0.55);
    };

    window.addEventListener('touchstart', (e) => {
      g = null;
      if (busy || !location.pathname.startsWith('/watch') || e.touches.length !== 1) return;
      if (document.body.classList.contains('ae-land')) return;   // xoay ngang: không có cử chỉ thu nhỏ
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
          g.el.style.willChange = 'transform, opacity';
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
          s.el.style.transition = 'transform .2s cubic-bezier(.4,0,1,1), opacity .2s ease';
          s.el.style.transform = 'translate3d(0,' + Math.max(160, s.dy) + 'px,0) scale(.88)';
          s.el.style.opacity = '0';
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

  // ── 5c. Player ghim: đo chiều cao player → biến CSS --ae-player-h (adblock.js dùng làm padding-top của body) ──
  // Không chèn phần tử vào DOM của YouTube nữa: cách cũ (spacer cạnh player) hỏng khi cấu trúc cha của player khác dự đoán,
  // khiến tên video / kênh / bình luận bị player đè lên và biến mất.
  const ensurePlayerSpacer = (() => {
    let ro = null, watched = null, resizeBound = false;
    const measure = (player) => {
      // Player position:fixed nên offsetHeight có thể = 0 → lấy lớn nhất của container / .html5-video-player / video;
      // không có thì dùng tỉ lệ 16:9 theo bề rộng.
      const inner = player.querySelector('.html5-video-player');
      const vid = player.querySelector('video');
      let h = Math.max(
        player.getBoundingClientRect().height,
        inner ? inner.getBoundingClientRect().height : 0,
        vid ? vid.getBoundingClientRect().height : 0
      );
      if (!(h > 20)) h = window.innerWidth * 9 / 16;
      return Math.round(Math.min(h, window.innerHeight * 0.6));
    };
    const apply = () => {
      if (!location.pathname.startsWith('/watch')) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      if (document.body && document.body.classList.contains('ae-land')) return;   // xoay ngang: giữ nguyên giá trị cũ
      const player = document.getElementById('player-container-id') || document.querySelector('.player-container');
      if (!player) return;
      const h = measure(player) + 'px';
      const root = document.documentElement;
      if (root.style.getPropertyValue('--ae-player-h') !== h) root.style.setProperty('--ae-player-h', h);
      if (typeof ResizeObserver === 'function' && watched !== player) {
        if (ro) ro.disconnect();
        ro = new ResizeObserver(apply);
        ro.observe(player);
        const inner = player.querySelector('.html5-video-player');
        if (inner) ro.observe(inner);
        watched = player;
      }
    };
    if (!resizeBound) { resizeBound = true; window.addEventListener('resize', () => setTimeout(apply, 120), { passive: true }); }
    return apply;
  })();

  // ── 5c-2. Xoay ngang: bật class ae-land (CSS ở adblock.js làm player phủ kín màn hình) ──
  const syncLandscape = () => {
    if (!document.body) return;
    const v = document.querySelector('video');
    const native = !!(v && v.webkitDisplayingFullscreen);
    const on = location.pathname.startsWith('/watch') && window.innerWidth > window.innerHeight && !native;
    document.body.classList.toggle('ae-land', on);
  };
  window.addEventListener('resize', syncLandscape, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(syncLandscape, 150), { passive: true });
  window.addEventListener('ae:navigate', syncLandscape);

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

  // ── 5c-4. Thẻ "Next: … Mix" ở đáy: bấm vào BẤT KỲ đâu trên thẻ = mở danh sách (như bấm mũi tên) ──
  // Trước đây chạm vào thân thẻ không mở panel mà còn xuyên xuống video đề xuất bên dưới → nhảy sang video khác.
  window.addEventListener('click', (e) => {
    if (!location.pathname.startsWith('/watch') || e.defaultPrevented) return;
    const x = e.clientX, y = e.clientY;
    if (y < window.innerHeight * 0.6) return;
    let card = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest('#ae-sheet, #ae-toast')) return;
      for (let n = el, i = 0; n && n !== document.body && i < 10; n = n.parentElement, i++) {
        const pos = getComputedStyle(n).position;
        if (pos !== 'fixed' && pos !== 'sticky') continue;
        const r = n.getBoundingClientRect();
        if (r.width > window.innerWidth * 0.7 && r.height > 30 && r.height < 160 && r.top > window.innerHeight * 0.55) { card = n; break; }
      }
      if (card) break;
    }
    if (!card) return;
    const btns = card.querySelectorAll('button, [role="button"], .icon-button');
    if (!btns.length) return;
    const arrow = btns[btns.length - 1];
    if (arrow.contains(e.target)) return;   // đã bấm trúng mũi tên → để YouTube tự xử lý
    e.preventDefault(); e.stopImmediatePropagation();
    arrow.click();
  }, true);

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
        return;
      }
      document.documentElement.style.removeProperty('--ae-player-h');   // rời trang watch → bỏ chỗ giữ cho player
      replaceLogoWithAether();
      cleanProfileMenu();
      removeShortsElements();
      injectDownloadsTab();
      enhanceSearch();
    };
    const observer = new MutationObserver(() => {
      if (moScheduled) return;
      moScheduled = true;
      const wait = Math.max(0, (location.pathname.startsWith('/watch') ? 250 : 160) - (Date.now() - moLast));
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