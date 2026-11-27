// Aether UI – tìm kiếm: restyle lịch sử/gợi ý giống app YouTube + nút mũi tên Back thay cho logo
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

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
    /* Icon/nút gốc của YouTube (mũi tên ↖ trắng lệch theo độ dài chữ): ẩn đi, chỉ dùng nút .ae-sug-fill của Aether */
    .ae-sug-row .ae-native-icon { display: none !important; }
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

  // ── Nút Back thay logo khi ở giao diện tìm kiếm ───────────────────────────
  const ICO_BACK_PATH = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';
  const logoSel = (AE.LOGO_SEL || '.header-bar-logo, ytm-home-logo').split(',').map((s) => s.trim());
  const BACK_CSS = `
    html.ae-search-ui ${logoSel.map((s) => s).join(',\n    html.ae-search-ui ')} { display: none !important; }
    html.ae-search-ui .ae-native-back { display: none !important; }
    #ae-back {
      flex: none; display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; margin: 0 2px 0 4px; padding: 0; border: 0; border-radius: 50%;
      background: transparent; color: #fff; -webkit-tap-highlight-color: transparent;
      transition: background-color .15s ease, transform .15s ease;
    }
    #ae-back:active { background: rgba(255,255,255,.14); transform: scale(.92); }
    #ae-back svg { width: 24px; height: 24px; fill: currentColor; display: block; pointer-events: none; }
  `;
  AE.addCSS('search', SEARCH_CSS + BACK_CSS);

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

  // Root cause mũi tên bị nhân đôi: YouTube đã có sẵn nút ↖ riêng trong mỗi hàng, Aether lại thêm 1 nút nữa.
  // Nút gốc nằm theo dòng chảy flex ngay sau chữ → lệch x theo độ dài chữ. Ẩn mọi icon/nút rỗng chữ của YouTube.
  const NATIVE_ICON_SEL = 'button, [role="button"], c3-icon, ytm-icon, svg, img, [class*="icon" i], [class*="arrow" i]';
  const hideNativeIcons = (row) => {
    row.querySelectorAll(NATIVE_ICON_SEL).forEach((el) => {
      if (el.classList.contains('ae-native-icon') || el.closest('.ae-sug-fill, .ae-sug-remove')) return;
      if ((el.textContent || '').trim()) return;   // có chữ → là phần nội dung, không phải icon
      el.classList.add('ae-native-icon');
    });
  };

  const markRow = (row, isHist, removeBtn) => {
    row.classList.add('ae-sug-row');
    hideNativeIcons(row);
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
  let plainList = null;   // cache list gợi ý khi gõ: tránh quét toàn bộ DOM + getBoundingClientRect mỗi frame
  const enhanceSearch = (force) => {
    if (!isSearchContext()) return;
    const now = Date.now();
    if (!force && now - searchLast < 120) {                 // throttle + trailing call
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
    const input = document.querySelector(SEARCH_INPUT_SEL);
    const hasText = !!(input && input.value && input.value.trim());
    if (!hasText) plainList = null;
    let list = null;
    if (hasText) {
      list = plainList && plainList.isConnected && plainList.childElementCount >= 1 ? plainList : findPlainSuggestionList();
      plainList = list;
    }
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

  // Trang tìm kiếm = ô nhập/gợi ý (isSearchContext) hoặc trang kết quả /results
  const isSearchUI = () => isSearchContext() || location.pathname.startsWith('/results');

  // Quay về trang trước (Trang chủ / Đăng ký / Thư viện…) theo lịch sử duyệt; hết lịch sử thì về Trang chủ
  const goBack = () => {
    try { document.activeElement && document.activeElement.blur(); } catch (_) { }
    if (history.length > 1) history.back();
    else location.assign('/');
  };

  const NATIVE_BACK_RE = /^(back|go back|quay lại|trở lại)$/i;

  const syncBackButton = () => {
    const on = isSearchUI();
    document.documentElement.classList.toggle('ae-search-ui', on);
    const existing = document.getElementById('ae-back');
    if (!on) { if (existing) existing.remove(); return; }

    const header = document.querySelector('.mobile-topbar-header, ytm-mobile-topbar-renderer');
    if (!header) return;

    // Ẩn nút back gốc (nếu có) để không bị 2 mũi tên
    header.querySelectorAll('button, [role="button"]').forEach((b) => {
      if (b.id === 'ae-back' || b.closest('#ae-back')) return;
      if (NATIVE_BACK_RE.test((b.getAttribute('aria-label') || '').trim())) b.classList.add('ae-native-back');
    });

    // Chèn ngay vị trí logo (logo bị ẩn bằng CSS) → bố cục giống hệt chỗ logo cũ, không phụ thuộc cấu trúc DOM
    const logo = header.querySelector(AE.LOGO_SEL || '.header-bar-logo');
    const anchor = logo || header.firstElementChild;
    if (!anchor || !anchor.parentNode) return;
    if (existing && existing.nextElementSibling === anchor) return;   // đã đúng chỗ
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'ae-back';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Quay lại');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICO_BACK_PATH + '"/></svg>';
    anchor.parentNode.insertBefore(btn, anchor);
  };

  // Capture để YouTube không xử lý chạm trước
  window.addEventListener('click', (e) => {
    if (!e.target.closest?.('#ae-back')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    goBack();
  }, true);

  AE.search = { isSearchUI, enhanceSearch, goBack };

  AE.on('refresh', () => { syncBackButton(); enhanceSearch(); });
  AE.on('browse', () => { syncBackButton(); enhanceSearch(); });

  // Observer riêng: xử lý ngay trước khung hình kế (rAF) thay vì chờ 300ms của observer chung.
  // Root cause mũi tên "nhảy lung tung": gợi ý hiện ra ở dạng gốc ~300-450ms rồi mới bị restyle.
  AE.on('ready', () => {
    let searchRaf = 0;
    new MutationObserver(() => {
      if (searchRaf || AE.isWatching()) return;
      searchRaf = window.requestAnimationFrame(() => { searchRaf = 0; enhanceSearch(true); syncBackButton(); });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
