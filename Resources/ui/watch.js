// Aether UI – trang xem video: vuốt xuống thu nhỏ (PiP), chừa chỗ player ghim, fullscreen giả,
// mở video ở WebView riêng, thẻ Mix, vuốt mép trái để quay lại
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  // ── 5b. Vuốt xuống từ video → PiP + về trang trước (chạy trong JS để có user gesture) ─
  // Mượt: cập nhật transform trong requestAnimationFrame (1 lần/frame), chỉ dùng transform+opacity (GPU),
  // touch-action:none trên player (CSS ở adblock.js) để trang không cuộn tranh quyền, và khi thả quá ngưỡng
  // video tiếp tục trượt ra thay vì bật ngược lại rồi mới biến mất.
  const playerEl = (v) => v.closest('#player-container-id, .player-container') || v.parentElement;
  const resetPlayer = (el, animate) => {
    if (!el) return;
    el.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s ease' : 'none';
    el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = '';
    setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, animate ? 260 : 30);
  };

  (() => {
    let g = null, busy = false, raf = 0, lastEl = null;
    const COMMIT_DIST = 90;
    const PIP_PLACEHOLDER = 'offscreen';   // 'offscreen' | 'corner' (xem ghi chú v4 ở finish())

    // Root cause khung đen phía sau khi kéo: player (position:fixed) bị kéo đi nhưng chỗ cũ của nó vẫn là nền/placeholder
    // đen của trang video. Giờ lúc kéo: ẩn mọi thứ trừ player (CSS .ae-drag trong aetherfix.js) + báo Swift cho WebView
    // video trong suốt → lộ trang chủ (WebView duyệt) nằm phía sau, giống vuốt thu nhỏ kiểu app thật.
    const postDrag = (on) => { try { window.webkit.messageHandlers.aetherNav.postMessage({ action: 'dragReveal', on }); } catch (_) { } };
    const revealOn = (el) => {
      if (el) el.classList.add('ae-drag-keep');
      document.documentElement.classList.add('ae-drag');
      postDrag(true);
    };
    const revealOff = () => {
      document.documentElement.classList.remove('ae-drag');
      document.querySelectorAll('.ae-drag-keep').forEach((n) => n.classList.remove('ae-drag-keep'));
      postDrag(false);
    };

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
          revealOn(g.el);
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
        // Root cause khối đen vuông: iOS vẽ hoạt ảnh vào PiP từ KHUNG của <video> tại thời điểm bật PiP (lớp hệ thống, nằm trên
        // mọi view nên đổi WebView cũng không che được). Trước đây khung đó đang bị ta kéo xuống + thu 88% → khối đen hiện ở
        // giữa màn hình, lệch xa cửa sổ PiP. Giờ trả player về đúng chỗ gốc (không transition) TRƯỚC khi bật PiP,
        // để hoạt ảnh của iOS đi từ vị trí video thật vào góc PiP.
        lastEl = s.el;
        if (s.el) {
          s.el.style.transition = 'none'; s.el.style.transform = ''; s.el.style.opacity = ''; s.el.style.willChange = ''; void s.el.offsetHeight;   // ép tính layout để đo khung gốc
          // v4: iOS vẫn vẽ 1 khối đen đúng tại khung <video> lúc bật PiP (~0.7s, tới khi resetPlayer chạy). v3 giả định cửa sổ PiP
          // nằm ở góc dưới-phải để che khối đó, nhưng iOS nhớ vị trí PiP lần trước (có thể ở trên/giữa) → khối đen lộ ra.
          // Giờ đẩy khung video xuống NGAY DƯỚI mép màn hình (thu nhỏ cỡ PiP): khối đen nằm ngoài vùng nhìn thấy, không phụ thuộc
          // vị trí cửa sổ PiP. Nếu thiết bị không bật được PiP ở chế độ này, đổi PIP_PLACEHOLDER về 'corner' để dùng lại v3.
          try {
            const r = s.el.getBoundingClientRect();
            const pw = Math.min(190, r.width * 0.5), sc = pw / Math.max(1, r.width);
            const tx = window.innerWidth - pw - 16;
            const ty = (PIP_PLACEHOLDER === 'offscreen')
              ? window.innerHeight + 8 - r.top                                  // mép trên của video nằm dưới đáy màn hình
              : window.innerHeight - pw * 9 / 16 - 110 - r.top;                  // v3: sát góc dưới-phải
            s.el.style.transformOrigin = '0 0';
            s.el.style.transform = 'translate3d(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px,0) scale(' + sc.toFixed(3) + ')';
            void s.el.offsetHeight;
          } catch (_) { }
        }
        busy = true; setTimeout(() => { busy = false; }, 1500);
        // Gọi đồng bộ trong touchend để WebKit coi là user gesture khi bật PiP
        try { window.__aeMedia && window.__aeMedia.minimize(); } catch (_) { resetPlayer(s.el, true); setTimeout(revealOff, 280); }
      } else {
        resetPlayer(s.el, true);
        setTimeout(revealOff, 280);   // đợi video trượt về chỗ cũ xong mới trả lại nền
      }
    };
    window.addEventListener('touchend', () => finish(false), { passive: true, capture: true });
    window.addEventListener('touchcancel', () => finish(true), { passive: true, capture: true });

    // Kết quả thu nhỏ: thất bại → đưa video về chỗ cũ; thành công → trang đã bị "park" phía sau,
    // dọn style lúc không ai nhìn thấy để khi quay lại từ PiP video hiện đúng vị trí
    window.addEventListener('ae:minimize-result', (e) => {
      const el = lastEl; lastEl = null;
      if (!el) return;
      if (e.detail && e.detail.ok) setTimeout(() => { resetPlayer(el, false); revealOff(); }, 700);
      else { resetPlayer(el, true); setTimeout(revealOff, 280); }
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

  AE.watch = { ensurePlayerSpacer, syncLandscape, inFullscreenMode };

  AE.on('ready', () => {
    ensurePlayerSpacer();
    window.addEventListener('ae:navigate', () => setTimeout(ensurePlayerSpacer, 0));
  });
  AE.on('browse', () => ensurePlayerSpacer.reset());   // rời trang watch → bỏ padding đã thêm
  AE.on('watch', () => { ensurePlayerSpacer(); syncLandscape(); });
})();
