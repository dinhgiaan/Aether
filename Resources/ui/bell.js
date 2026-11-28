// Aether UI – chuông thông báo + bảng thông báo (như app YouTube gốc).
// Root cause lỗi trước: m.youtube.com KHÔNG có trang /feed/notifications (ytm-browse rỗng) → bấm chuông ra trang trống,
// và tab Home giữ nguyên trang trống đó. Giờ chuông mở BẢNG thông báo tự dựng (không điều hướng), dữ liệu lấy từ endpoint
// nội bộ /youtubei/v1/notification/get_notification_menu bằng cookie đăng nhập sẵn có trong WebView.
// Chuông được gắn BÊN TRONG header (position:absolute) nên cứng theo header, không còn "lỏng" khi cuộn.
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  const BELL_PATH = 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z';
  const BACK_PATH = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';

  AE.addCSS('bell', `
    #ae-bell {
      position: absolute; top: 0; z-index: 5; display: none;
      width: 44px; height: 100%; align-items: center; justify-content: center;
      border: 0; background: transparent; color: #fff; padding: 0;
      -webkit-tap-highlight-color: transparent;
      pointer-events: auto !important;      /* header của YouTube có thể đặt pointer-events:none → nút con kế thừa và không nhận chạm */
      touch-action: manipulation;
    }
    #ae-bell:active svg { opacity: .6; }
    #ae-bell svg { width: 24px; height: 24px; fill: currentColor; display: block; pointer-events: none; }
    #ae-bell .ae-badge {
      position: absolute; top: 8px; left: 24px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
      border-radius: 8px; background: #ff0000; color: #fff; font: 700 10px/16px -apple-system, sans-serif;
      text-align: center; display: none; pointer-events: none;
    }

    #ae-noti {
      position: fixed; inset: 0; z-index: 2147483200; background: #0f0f0f; color: #fff;
      display: none; flex-direction: column; font-family: -apple-system, sans-serif;
    }
    #ae-noti.ae-open { display: flex; animation: ae-noti-in .2s ease both; }
    @keyframes ae-noti-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
    #ae-noti .ae-noti-bar {
      flex: none; display: flex; align-items: center; height: 48px; padding: 0 4px;
      background: rgba(12,12,15,.97); border-bottom: .5px solid rgba(255,255,255,.08);
    }
    #ae-noti .ae-noti-close {
      width: 44px; height: 44px; border: 0; background: transparent; color: #fff; padding: 0;
      display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent;
    }
    #ae-noti .ae-noti-close svg { width: 24px; height: 24px; fill: currentColor; pointer-events: none; }
    #ae-noti .ae-noti-title { font-size: 18px; font-weight: 600; margin-left: 4px; }
    #ae-noti .ae-noti-list {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
    }
    #ae-noti .ae-noti-row {
      display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; position: relative;
      -webkit-tap-highlight-color: rgba(255,255,255,.08);
    }
    #ae-noti .ae-noti-row:active { background: rgba(255,255,255,.08); }
    #ae-noti .ae-noti-row.ae-unread { background: rgba(62,166,255,.10); }
    #ae-noti .ae-noti-row.ae-unread::before {
      content: ''; position: absolute; left: 5px; top: 50%; width: 6px; height: 6px; margin-top: -3px;
      border-radius: 50%; background: #3ea6ff;
    }
    #ae-noti .ae-noti-avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; background: #272727 center / cover no-repeat; }
    #ae-noti .ae-noti-body { flex: 1; min-width: 0; }
    #ae-noti .ae-noti-text {
      font-size: 14px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    #ae-noti .ae-noti-time { font-size: 12px; color: #aaa; margin-top: 4px; }
    #ae-noti .ae-noti-thumb { flex: none; width: 86px; height: 48px; border-radius: 6px; background: #272727 center / cover no-repeat; }
    #ae-noti .ae-noti-msg { padding: 40px 24px; text-align: center; color: #aaa; font-size: 14px; line-height: 1.5; }
    #ae-noti .ae-noti-msg button {
      margin-top: 12px; border: 0; border-radius: 18px; background: #272727; color: #fff; font-size: 14px; padding: 9px 18px;
    }
  `);

  // ── Gọi InnerTube bằng đăng nhập sẵn có (SAPISIDHASH như chính trang YouTube làm) ──────────
  const ORIGIN = location.origin;
  const getCookie = (name) => (document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')) || [])[1];
  const sha1Hex = async (s) => {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const hasLogin = () => !!(getCookie('SAPISID') || getCookie('__Secure-3PAPISID'));

  // opts.web = true: dùng context của client WEB (desktop) thay vì MWEB — endpoint thông báo vốn chỉ có ở bản desktop nên mweb có thể trả 400
  const innertube = async (path, body, opts) => {
    const cfg = window.ytcfg;
    const get = (k) => (cfg && typeof cfg.get === 'function' ? cfg.get(k) : undefined);
    const key = get('INNERTUBE_API_KEY');
    let context = get('INNERTUBE_CONTEXT');
    if (!key || !context) throw new Error('Trang YouTube chưa sẵn sàng, thử lại sau giây lát');
    const web = !!(opts && opts.web);
    if (web) {
      context = JSON.parse(JSON.stringify(context));
      context.client = Object.assign({}, context.client, { clientName: 'WEB', clientVersion: '2.20250101.00.00', platform: 'DESKTOP', clientFormFactor: 'UNKNOWN_FORM_FACTOR' });
      delete context.client.mainAppWebInfo; delete context.client.userInterfaceTheme;
    }
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-AuthUser': String(get('SESSION_INDEX') || 0),
      'X-Origin': ORIGIN,
      'X-Youtube-Client-Name': web ? '1' : String(get('INNERTUBE_CONTEXT_CLIENT_NAME') || 2),
      'X-Youtube-Client-Version': web ? context.client.clientVersion : String(get('INNERTUBE_CONTEXT_CLIENT_VERSION') || (context.client && context.client.clientVersion) || ''),
    };
    const sid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
    if (sid) {
      const ts = Math.floor(Date.now() / 1000);
      headers.Authorization = 'SAPISIDHASH ' + ts + '_' + (await sha1Hex(ts + ' ' + sid + ' ' + ORIGIN));
    }
    const res = await fetch('/youtubei/v1/' + path + '?key=' + encodeURIComponent(key) + '&prettyPrint=false', {
      method: 'POST', credentials: 'include', headers, body: JSON.stringify(Object.assign({ context }, body)),
    });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j && j.error && (j.error.message || j.error.status)) || ''; } catch (_) { }
      throw new Error('HTTP ' + res.status + (detail ? ' – ' + detail : ''));
    }
    return res.json();
  };

  // Thử lần lượt các kiểu request cho tới khi 1 kiểu được chấp nhận, rồi nhớ kiểu đó cho các lần sau.
  const VARIANTS = [
    { name: 'mweb+type', web: false, withType: true },
    { name: 'mweb', web: false, withType: false },
    { name: 'web+type', web: true, withType: true },
    { name: 'web', web: true, withType: false },
  ];
  let goodVariant = -1;
  const callMenu = async (path, extraBody) => {
    const order = goodVariant >= 0 ? [goodVariant] : VARIANTS.map((_, i) => i);
    const errors = [];
    for (const i of order) {
      const v = VARIANTS[i];
      const body = Object.assign({}, extraBody);
      if (v.withType && !body.ctoken) body.notificationsMenuRequestType = 'NOTIFICATIONS_MENU_REQUEST_TYPE_INBOX';
      try {
        const json = await innertube(path, body, { web: v.web });
        goodVariant = i;
        return json;
      } catch (err) { errors.push(v.name + ': ' + (err && err.message ? err.message : err)); }
    }
    throw new Error(errors.join(' | '));
  };

  // Duyệt JSON không phụ thuộc đường dẫn cố định (YouTube hay đổi cấu trúc)
  const walk = (root, fn) => {
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      fn(n);
      for (const k in n) { const v = n[k]; if (v && typeof v === 'object') stack.push(v); }
    }
  };
  const textOf = (t) => (!t ? '' : t.simpleText || (t.runs || []).map((r) => r.text).join(''));
  const firstThumb = (t) => { const a = t && t.thumbnails; return a && a.length ? a[a.length - 1].url : ''; };

  const parseMenu = (json) => {
    const items = []; let token = null;
    walk(json, (o) => {
      if (o.notificationRenderer) items.push(o.notificationRenderer);
      const t = o.getNotificationMenuEndpoint && o.getNotificationMenuEndpoint.ctoken;
      if (t) token = t;
    });
    // Thứ tự duyệt bằng stack bị đảo → đặt lại theo thứ tự xuất hiện (mới → cũ)
    return { items: items.reverse(), token };
  };

  // ── Bảng thông báo ───────────────────────────────────────────────────────
  let panel = null, listEl = null, token = null, loading = false, exhausted = false;

  const msg = (html, retry) => {
    listEl.querySelectorAll('.ae-noti-msg').forEach((n) => n.remove());
    const d = document.createElement('div');
    d.className = 'ae-noti-msg';
    d.textContent = html;
    if (retry) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Thử lại';
      b.addEventListener('click', retry);
      d.appendChild(document.createElement('br')); d.appendChild(b);
    }
    listEl.appendChild(d);
  };

  const openUrl = (url) => {
    closePanel();
    try {
      const abs = new URL(url, ORIGIN);
      if (abs.pathname.startsWith('/watch')) AE.post({ action: 'openWatch', url: abs.href });
      else location.assign(abs.href);
    } catch (_) { }
  };

  const renderItem = (n) => {
    const row = document.createElement('div');
    row.className = 'ae-noti-row' + (n.read ? '' : ' ae-unread');
    const av = document.createElement('div'); av.className = 'ae-noti-avatar';
    const avatar = firstThumb(n.thumbnail); if (avatar) av.style.backgroundImage = 'url("' + avatar + '")';
    const body = document.createElement('div'); body.className = 'ae-noti-body';
    const tx = document.createElement('div'); tx.className = 'ae-noti-text'; tx.textContent = textOf(n.shortMessage) || textOf(n.title);
    const tm = document.createElement('div'); tm.className = 'ae-noti-time'; tm.textContent = textOf(n.sentTimeText);
    body.appendChild(tx); body.appendChild(tm);
    row.appendChild(av); row.appendChild(body);
    const vt = firstThumb(n.videoThumbnail);
    if (vt) { const th = document.createElement('div'); th.className = 'ae-noti-thumb'; th.style.backgroundImage = 'url("' + vt + '")'; row.appendChild(th); }
    const url = n.navigationEndpoint && n.navigationEndpoint.commandMetadata && n.navigationEndpoint.commandMetadata.webCommandMetadata
      && n.navigationEndpoint.commandMetadata.webCommandMetadata.url;
    if (url) row.addEventListener('click', () => openUrl(url));
    return row;
  };

  const load = async (more) => {
    if (loading || (more && (exhausted || !token))) return;
    if (!hasLogin()) { msg('Bạn cần đăng nhập YouTube (ở tab Bạn) để xem thông báo.'); return; }
    loading = true;
    if (!more) { listEl.textContent = ''; msg('Đang tải thông báo…'); }
    try {
      const json = await callMenu('notification/get_notification_menu', more ? { ctoken: token } : {});
      const { items, token: next } = parseMenu(json);
      listEl.querySelectorAll('.ae-noti-msg').forEach((n) => n.remove());
      items.forEach((n) => listEl.appendChild(renderItem(n)));
      token = next && next !== token ? next : null;
      exhausted = !token;
      if (!more && !items.length) msg('Chưa có thông báo nào.');
      setBadge(0);
    } catch (err) {
      msg('Không tải được thông báo: ' + (err && err.message ? err.message : err), () => load(more));
    } finally { loading = false; }
  };

  const ensurePanel = () => {
    if (panel && panel.isConnected) return;
    panel = document.createElement('div');
    panel.id = 'ae-noti';
    panel.innerHTML = '<div class="ae-noti-bar"><button class="ae-noti-close" type="button" aria-label="Đóng">' +
      '<svg viewBox="0 0 24 24"><path d="' + BACK_PATH + '"/></svg></button><span class="ae-noti-title">Thông báo</span></div>' +
      '<div class="ae-noti-list"></div>';
    listEl = panel.querySelector('.ae-noti-list');
    panel.querySelector('.ae-noti-close').addEventListener('click', closePanel);
    // Cuộn gần cuối → tải trang cũ hơn (mới → cũ)
    listEl.addEventListener('scroll', () => {
      if (listEl.scrollTop + listEl.clientHeight > listEl.scrollHeight - 400) load(true);
    }, { passive: true });
    document.body.appendChild(panel);
  };

  const openPanel = () => {
    ensurePanel();
    token = null; exhausted = false;
    panel.classList.add('ae-open');
    load(false);
  };
  function closePanel() { if (panel) panel.classList.remove('ae-open'); }

  // ── Chuông trong header + chấm đỏ số thông báo chưa đọc ───────────────────
  let bell = null, badge = null, lastCount = 0, lastUnseenAt = 0;
  function setBadge(n) {
    lastCount = n;
    if (!badge) return;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = n > 0 ? 'block' : 'none';
  }

  const refreshUnseen = async () => {
    if (Date.now() - lastUnseenAt < 60000 || !hasLogin()) return;
    lastUnseenAt = Date.now();
    try {
      const json = await callMenu('notification/get_unseen_count', {});
      let count = 0;
      walk(json, (o) => { if (typeof o.unseenCount === 'number') count = o.unseenCount; });
      setBadge(count);
    } catch (_) { /* chấm đỏ chỉ là phụ: lỗi thì thôi */ }
  };

  const HEADER_SEL = 'header.mobile-topbar-header, ytm-mobile-topbar-renderer header, ytm-mobile-topbar-renderer';
  const SEARCH_BTN_SEL = 'button[aria-label*="earch" i], button[aria-label*="ìm" i], a[aria-label*="earch" i]';
  // Root cause chuông biến mất: querySelector trả về nút ĐẦU TIÊN khớp, mà header còn chứa <yt-searchbox> (ẩn ở chế độ thường)
  // cũng có nút "Search" → lấy nhầm nút rộng 0 → chuông tự ẩn. Giờ ưu tiên .topbar-button-search-button, rồi chỉ nhận nút đang hiển thị.
  const pickSearchButton = (header) => {
    const preferred = header.querySelector('.topbar-button-search-button');
    if (preferred && preferred.getBoundingClientRect().width > 0) return preferred;
    return [...header.querySelectorAll(SEARCH_BTN_SEL)].find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > window.innerWidth * 0.5 && r.top < 80;
    }) || null;
  };

  const shouldShow = () => {
    const p = location.pathname;
    if (AE.isWatching() || p.startsWith('/shorts') || p.startsWith('/results')) return false;
    return !(AE.search && AE.search.isSearchUI());
  };

  // Báo vị trí chuông cho Swift: lớp native bắt chạm đặt đúng chỗ này (không phụ thuộc hit-test của trang YouTube).
  // Root cause "bấm chuông không có gì xảy ra": chạm trong WebView ở vùng header không tới được nút → dùng cùng đường
  // native → JS như nút Back (đã chứng minh hoạt động, có haptic).
  let lastRect = '';
  const reportRect = (r) => {
    const key = r ? [r.x, r.y, r.w, r.h].join(',') : 'null';
    if (key === lastRect) return;
    lastRect = key;
    AE.post({ bellRect: r });
  };

  const place = () => {
    if (!document.body) return;
    const header = document.querySelector(HEADER_SEL);
    const search = header && pickSearchButton(header);
    const hr = header && header.getBoundingClientRect();
    const sr = search && search.getBoundingClientRect();
    if (!header || !search || !sr.width || !shouldShow()) { if (bell) bell.style.display = 'none'; reportRect(null); return; }

    if (!bell || !bell.isConnected || bell.parentElement !== header) {
      bell = document.getElementById('ae-bell') || document.createElement('button');
      bell.id = 'ae-bell'; bell.type = 'button'; bell.setAttribute('aria-label', 'Thông báo');
      bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + BELL_PATH + '"/></svg><span class="ae-badge"></span>';
      badge = bell.querySelector('.ae-badge');
      setBadge(lastCount);
      if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
      header.appendChild(bell);
    }
    bell.style.display = 'flex';
    const left = Math.round(sr.left - hr.left - 44);       // toạ độ tương đối header → dính cứng với header
    if (bell.style.left !== left + 'px') bell.style.left = left + 'px';
    reportRect({ x: Math.max(0, Math.round(sr.left - 44)), y: Math.max(0, Math.round(sr.top)), w: 44, h: Math.max(44, Math.round(sr.height)) });
    refreshUnseen();
  };

  // Root cause "bấm chuông không phản ứng": header của YouTube xử lý chạm bằng touch/pointer và nuốt luôn click tổng hợp,
  // nên chỉ lắng nghe 'click' là không đủ. Bắt ở touchend (pha capture, chặn YouTube) rồi mở bảng; click chỉ còn là đường dự phòng
  // (chuột/bàn phím), có chặn trùng để không mở 2 lần.
  let touch = null, swallowUntil = 0;
  const onBell = (e) => !!(e.target && e.target.closest && e.target.closest('#ae-bell'));
  const toggle = () => { if (panel && panel.classList.contains('ae-open')) closePanel(); else openPanel(); };
  window.addEventListener('touchstart', (e) => {
    touch = null;
    if (e.touches.length !== 1 || !onBell(e)) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true, capture: true });
  window.addEventListener('touchend', (e) => {
    const st = touch; touch = null;
    if (!st || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10) return;       // kéo, không phải chạm
    e.preventDefault(); e.stopImmediatePropagation();
    swallowUntil = Date.now() + 600;
    toggle();
  }, { passive: false, capture: true });
  window.addEventListener('click', (e) => {
    if (!onBell(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (Date.now() < swallowUntil) return;       // click tổng hợp sau touchend vừa xử lý
    toggle();
  }, true);

  // API cho Swift (nút chuông native): mở/đóng bảng thông báo, báo lại vị trí chuông khi đổi tab
  AE.bell = { toggle, report: () => { lastRect = ''; place(); } };

  AE.on('ready', () => {
    window.addEventListener('resize', place, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(place, 200), { passive: true });
  });
  AE.on('refresh', () => { closePanel(); place(); });
  AE.on('browse', place);
  AE.on('watch', () => { closePanel(); place(); });   // vào /watch → ẩn chuông, đóng bảng
})();
