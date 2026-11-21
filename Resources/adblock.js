// Aether: lọc quảng cáo YouTube + phát nền + đồng bộ Lock Screen / Control Center
(() => {
  'use strict';
  if (window.__aeAdblock) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeAdblock = true;

  // ---- 1. Xóa field quảng cáo khỏi dữ liệu player (Heuristic + Regex động) ---
  const AD_KEY_REGEX = /(^|_)(playerAds|adPlacements?|adSlots?|adBreaks?|adBreakHeartbeatParams|promoted(Video|Sparkles|Item)?|interstitialAds?)($|_)/i;
  const SAFE_EXCLUDE = /^(adaptiveFormats|additionalMetadata)$/i;

  // Tối ưu hiệu năng: trước đây duyệt sâu 8 tầng MỌI kết quả JSON.parse / Response.json (YouTube gọi rất nhiều,
  // có cái hàng trăm KB) → chiếm main thread gây lag. Các key quảng cáo thực tế chỉ ở 3-4 tầng đầu.
  const PRUNE_MAX_DEPTH = 4;
  const AD_TEXT_HINT = /playerAds|adPlacement|adSlots?\b|adBreak|interstitialAds?|promoted(Video|Sparkles|Item)?\b/i;
  const prune = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > PRUNE_MAX_DEPTH) return o;
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) prune(o[i], depth + 1);
      return o;
    }
    for (const k of Object.keys(o)) {
      if (SAFE_EXCLUDE.test(k)) continue;
      if (AD_KEY_REGEX.test(k)) {
        try { delete o[k]; } catch (_) { }
      } else if (o[k] && typeof o[k] === 'object') {
        prune(o[k], depth + 1);
      }
    }
    return o;
  };

  // Hook cả 3 đường dữ liệu: JSON.parse, fetch().json(), ytInitialPlayerResponse nhúng trong HTML
  const playerResponsesByVid = new Map();
  const cachePlayerResponse = (data) => {
    if (!data || typeof data !== 'object') return;
    const vid = data.videoDetails?.videoId;
    if (vid) {
      playerResponsesByVid.set(vid, data);
      // Giới hạn bộ nhớ: mỗi player response rất nặng, chỉ giữ vài video gần nhất
      if (playerResponsesByVid.size > 6) playerResponsesByVid.delete(playerResponsesByVid.keys().next().value);
    }
  };

  const nativeParse = JSON.parse;
  JSON.parse = function (...args) {
    try {
      const data = nativeParse.apply(this, args);
      if (data && (data.streamingData || data.videoDetails)) {
        cachePlayerResponse(data);
        window.__lastPlayerResponse = data;
      }
      // Chuỗi không chứa dấu hiệu quảng cáo → bỏ qua hoàn toàn bước duyệt đối tượng
      const text = args[0];
      if (typeof text === 'string' && !AD_TEXT_HINT.test(text)) return data;
      return prune(data);
    } catch (_) {
      return nativeParse.apply(this, args);
    }
  };

  if (window.Response && Response.prototype.json) {
    const nativeJson = Response.prototype.json;
    Response.prototype.json = function (...args) {
      return nativeJson.apply(this, args).then((data) => {
        try {
          if (data && (data.streamingData || data.videoDetails)) {
            cachePlayerResponse(data);
            window.__lastPlayerResponse = data;
          }
          return prune(data);
        } catch (_) {
          return data;
        }
      });
    };
  }

  let initialPlayerResponse;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get() { return initialPlayerResponse; },
      set(v) {
        if (v) cachePlayerResponse(v);
        initialPlayerResponse = prune(v);
      },
    });
  } catch (_) { }

  // ---- 2. Nếu ad vẫn lọt: mute, tua nhanh 16x, bấm Skip -------------------
  const SKIP = [
    '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button', '.ytp-ad-overlay-close-button',
  ].join(',');
  let mutedByUs = false;
  let adInterval = null;

  const tickAdSkipper = () => {
    const player = document.querySelector('.html5-video-player');
    if (!player) {
      clearInterval(adInterval); adInterval = null; return;
    }
    const video = player.querySelector('video');
    if (player.classList.contains('ad-showing')) {
      if (video) {
        if (!video.muted) { video.muted = true; mutedByUs = true; }
        try { video.playbackRate = 16; } catch (_) { }
        if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.1) {
          video.currentTime = video.duration;
        }
      }
      const skip = document.querySelector(SKIP);
      if (skip) skip.click();

      if (window.ytInitialPlayerResponse) {
        prune(window.ytInitialPlayerResponse);
      }
    } else if (mutedByUs) {
      if (video) {
        video.muted = false;
        try { video.playbackRate = 1; } catch (_) { }
      }
      mutedByUs = false;
    }
  };

  const startAdSkipper = () => {
    if (!adInterval) adInterval = setInterval(tickAdSkipper, 300);
  };

  // ---- 2a. Tiện ích PiP: toast, pause native, chờ PiP bật ----
  // Kiến trúc mới: KHÔNG đụng vào DOM của <video> đang PiP. Swift giữ nguyên trang /watch trong
  // một WKWebView ẩn ("parked") và mở trang chủ ở WebView mới, nên PiP không bao giờ mất hình.
  const nativePause = (v) => { try { HTMLMediaElement.prototype.pause.call(v); } catch (_) { } };
  const videoIdOf = () => (location.search.match(/[?&]v=([^&]+)/) || [])[1] || '';
  const postNav = (payload) => {
    try { window.webkit?.messageHandlers?.aetherNav?.postMessage(payload); return true; } catch (_) { return false; }
  };

  const toast = (msg) => {
    try {
      let el = document.getElementById('ae-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ae-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);transform:translateX(-50%);max-width:80vw;padding:10px 16px;border-radius:999px;background:rgba(40,40,40,.96);color:#fff;font:500 13px -apple-system,sans-serif;z-index:2147483647;pointer-events:none;transition:opacity .25s;opacity:0;text-align:center';
        (document.body || document.documentElement).appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      clearTimeout(el.__t);
      el.__t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
    } catch (_) { }
  };

  window.__aeToast = toast;
  const isPiP = (v) => v.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === v;
  const waitForPiP = (v, ms) => new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (isPiP(v)) return resolve(true);
      if (Date.now() - t0 > ms) return resolve(false);
      setTimeout(tick, 50);
    };
    tick();
  });

  const syncAdSkipper = () => {
    const isWatch = location.pathname.startsWith('/watch');
    document.body?.classList.toggle('ae-watching', isWatch);
    if (isWatch) {
      startAdSkipper();
    }
    else if (adInterval) { clearInterval(adInterval); adInterval = null; }

    // Báo trạng thái xem cho Swift Native
    try {
      window.webkit?.messageHandlers?.aetherNav?.postMessage({ isWatching: isWatch });
    } catch (_) { }
  };

  window.addEventListener('popstate', syncAdSkipper, true);
  // body chưa tồn tại ở document-start → class ae-watching chưa gắn được khi mở thẳng trang /watch
  document.addEventListener('DOMContentLoaded', syncAdSkipper, { once: true });
  const origPush = history.pushState.bind(history);
  history.pushState = function (...args) {
    origPush(...args);
    syncAdSkipper();
    window.dispatchEvent(new Event('ae:navigate'));
  };
  syncAdSkipper();

  // ---- 3. CSS Chặn quảng cáo, Shorts, Header khi xem video, và các nút rác ---
  const HIDE = [
    // Quảng cáo
    'ad-slot-renderer', 'ytm-ad-slot-renderer', 'ytd-ad-slot-renderer',
    'ytm-promoted-sparkles-web-renderer', 'ytm-promoted-video-renderer',
    'ytm-companion-ad-renderer', 'ytm-companion-slot', 'ytm-in-feed-ad-layout-renderer',
    'ytm-banner-promo-renderer', 'ytm-statement-banner-renderer', 'ytm-mealbar-promo-renderer',
    'ytm-brand-video-singleton-renderer', 'ytm-brand-video-shelf-renderer',
    'ytm-paid-content-overlay-renderer', 'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer', '#player-ads', '#masthead-ad',
    '.ytp-ad-overlay-container', '.ytp-ad-message-container', '.video-ads',
    'ytm-rich-item-renderer:has(ad-slot-renderer)',
    'ytm-rich-item-renderer:has(ytm-ad-slot-renderer)',
    'ytm-item-section-renderer:has(ad-slot-renderer)',
    'ytm-reel-video-renderer:has(ad-slot-renderer)',
    // Nút "Open App"
    '.yt-uix-redirect-button', '.open-app-button', 'ytm-open-app-promo-renderer',
    'ytm-app-promo-renderer', '.ytp-webview-open-app-button',
    // Tab Shorts & Giá sách Shorts trên trang chủ / tìm kiếm
    'ytm-reel-shelf-renderer',
    'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
    'ytm-rich-section-renderer:has(ytm-reel-item-renderer)',
    'ytm-reel-item-renderer',
    'ytm-reel-player-overlay-renderer',
    // Nút la bàn (Explore) bên cạnh các tags (All, Music...)
    'ytm-chip-cloud-chip-renderer:first-child:has(yt-icon)',
    'ytm-chip-cloud-chip-renderer[chip-style="STYLE_EXPLORE"]',
    'ytm-chip-cloud-chip-renderer:has([aria-label*="Explore"])',
    // Các button rác trong phần Hồ sơ (Films, Help, Feedback, YouTube Premium)
    'ytm-compact-link-renderer:has(a[href*="/premium"])',
    'ytm-compact-link-renderer:has(a[href*="/storefront"])',
    'ytm-compact-link-renderer:has(a[href*="support.google"])',
    'ytm-compact-link-renderer:has(a[href*="feedback"])',
    'ytm-account-item-section-renderer:has(a[href*="/premium"])',
  ];
  const HIDE_CSS = HIDE.map((s) => s + '{display:none!important}').join('\n');
  const EXTRA_CSS = `
    /* Watch page: Xoá sạch khoảng trống thừa, ẩn placeholder bị trùng lặp */
    body.ae-watching #app,
    body.ae-watching ytm-app,
    body.ae-watching .page-container,
    body.ae-watching ytm-watch,
    body.ae-watching .watch-page {
      padding-top: 0 !important;
      margin-top: 0 !important;
    }

    /* Ẩn triệt để placeholder giả lập chiều cao video để không bị khoảng xám trống khổng lồ */
    body.ae-watching #player-placeholder,
    body.ae-watching .player-placeholder,
    body.ae-watching ytm-player-placeholder {
      display: none !important;
      height: 0 !important;
      min-height: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Player: GHIM cố định ở đầu màn hình khi cuộn mô tả / bình luận / video đề xuất (giống app YouTube).
       Trước đây ép position:relative nên video trôi mất khi cuộn. uienhance.js đo chiều cao player
       (biến --ae-player-h) để body chừa chỗ, nội dung bên dưới không bị player đè lên. Bỏ qua khi đang fullscreen. */
    body.ae-watching #player-container-id:not(:fullscreen):not(:-webkit-full-screen),
    body.ae-watching .player-container:not(:fullscreen):not(:-webkit-full-screen) {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 1000 !important;
      background: #000 !important;
      /* Chặn trang cuộn theo khi vuốt trên video → cử chỉ vuốt-xuống-thu-nhỏ không bị giành quyền */
      touch-action: none !important;
    }
    /* Xoay ngang: player phủ kín màn hình (iOS không cho script tự vào fullscreen nếu không có chạm,
       nên dùng "fullscreen giả" bằng CSS; class ae-land do uienhance.js bật khi width > height) */
    body.ae-land.ae-watching { overflow: hidden !important; }
    body.ae-land.ae-watching #player-container-id:not(:fullscreen):not(:-webkit-full-screen),
    body.ae-land.ae-watching .player-container:not(:fullscreen):not(:-webkit-full-screen) {
      top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
      width: 100vw !important; height: 100vh !important; max-height: none !important;
      z-index: 2147483000 !important;
    }
    body.ae-land.ae-watching #player-container-id .html5-video-player,
    body.ae-land.ae-watching #player-container-id #player,
    body.ae-land.ae-watching #player-container-id .html5-video-container,
    body.ae-land.ae-watching .player-container .html5-video-player {
      width: 100% !important; height: 100% !important; max-height: none !important;
    }
    body.ae-land.ae-watching #player-container-id video,
    body.ae-land.ae-watching .player-container video {
      width: 100% !important; height: 100% !important; left: 0 !important; top: 0 !important; object-fit: contain !important;
    }
    /* Trang watch không có thanh điều hướng dưới (tránh vùng vô hình chặn chạm vào thẻ Mix ở đáy) */
    body.ae-watching ytm-bottom-bar-renderer { display: none !important; }

    /* Chừa chỗ cho player đang position:fixed: uienhance.js tự đo và thêm padding-top vào nhánh nội dung bên dưới. */
    body.ae-land.ae-watching .watch-below-the-player { display: none !important; }   /* giảm tải layout khi xoay ngang */


    /* Thanh chip (All / From the series / Related…) không dính cứng ở đầu trang nữa:
       cuộn tự nhiên cùng danh sách đề xuất thay vì "bật ra" đột ngột khi cuộn xuống */
    body.ae-watching ytm-chip-cloud-renderer,
    body.ae-watching ytm-related-chip-cloud-renderer,
    body.ae-watching .chip-cloud {
      position: static !important;
      top: auto !important;
    }

    body.ae-watching .watch-below-the-player {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    /* Tối ưu bình luận: thu nhỏ khoảng cách để xem được 4-5 comment cùng lúc */
    ytm-comment-thread-renderer, ytm-comment-renderer {
      padding: 3px 6px !important;
      margin: 1px 0 !important;
    }
    ytm-comment-renderer .comment-text {
      font-size: 0.80rem !important;
      line-height: 1.28 !important;
      margin: 1px 0 !important;
    }
    ytm-comment-renderer .comment-header {
      margin-bottom: 1px !important;
    }
    /* LƯU Ý: không được ép transition/animation lên ytm-engagement-panel-section-list-renderer.
       Panel (hàng đợi Mix, bình luận…) tự điều khiển đóng/mở bằng transform + transitionend; animation
       fill-mode:both của ta khoá transform ở translateY(0) và ghi đè transition → đóng bị giật, bấm mở không ăn. */
  `;
  const addStyle = () => {
    if (document.getElementById('ae-adblock-style')) return;
    const root = document.head || document.documentElement;
    if (!root) return;
    const style = document.createElement('style');
    style.id = 'ae-adblock-style';
    style.textContent = HIDE_CSS + '\n' + EXTRA_CSS;
    root.appendChild(style);
  };
  addStyle();
  document.addEventListener('DOMContentLoaded', addStyle, { once: true });

  // ---- 4. Phát nền + PiP + Đồng bộ Lock Screen / Control Center -----------
  if (window !== window.top) return;

  // Giả trang luôn "visible" để YouTube không tự pause khi app xuống nền
  try {
    for (const [prop, val] of [
      ['hidden', false], ['webkitHidden', false],
      ['visibilityState', 'visible'], ['webkitVisibilityState', 'visible'],
    ]) Object.defineProperty(document, prop, { configurable: true, get: () => val });
  } catch (_) { }
  for (const type of ['visibilitychange', 'webkitvisibilitychange']) {
    document.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
  }

  document.addEventListener('webkitpresentationmodechanged', (e) => {
    const v = e.target;
    if (v instanceof HTMLVideoElement) {
      if (v.webkitPresentationMode === 'picture-in-picture') {
        window.__aeInPiP = true;
        if (v.paused) v.play().catch(() => { });
      } else {
        window.__aeInPiP = false;
        // Trang đang bị "parked" (ẩn) vì thu nhỏ PiP: báo Swift khi PiP kết thúc.
        // Nút X → video bị pause → huỷ trang; nút "quay lại app" → video vẫn phát → hoán đổi về trang này.
        if (window.__aeParked) {
          setTimeout(() => {
            if (!window.__aeParked || isPiP(v)) return;
            window.__aeParked = false;
            postNav({ action: 'pipEnded', restore: !v.paused });
          }, 350);
        }
      }
    }
  }, true);

  const currentVideo = () =>
    document.querySelector('.html5-video-player video') || document.querySelector('video');

  let lastTouch = 0;
  let lastSystemPause = 0;
  window.addEventListener('touchend', () => { lastTouch = Date.now(); }, true);

  // ── Âm thanh: nhớ lựa chọn tắt/bật tiếng của người dùng ──────────────────────────────────────────
  // Root cause "TAP TO UNMUTE": mỗi video giờ mở ở WebView mới (trang nạp mới, chưa có user-activation) nên YouTube
  // tự phát ở chế độ tắt tiếng. Ta ghi nhớ lần người dùng CHỦ ĐỘNG bật/tắt tiếng (có chạm ngay trước đó) và
  // tự bật lại tiếng khi vào video nếu lần cuối họ để bật tiếng.
  const MUTE_KEY = 'ae.userMuted';
  const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; } };
  document.addEventListener('volumechange', (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || Date.now() - lastTouch > 1500) return;   // chỉ ghi nhận thay đổi do người dùng chạm
    const pl = v.closest && v.closest('.html5-video-player');
    if (pl && pl.classList.contains('ad-showing')) return;
    try { localStorage.setItem(MUTE_KEY, (v.muted || v.volume === 0) ? '1' : '0'); } catch (_) { }
  }, true);
  const restoreSound = () => {
    if (!location.pathname.startsWith('/watch') || readMuted() || mutedByUs) return;
    const v = document.querySelector('.html5-video-player video') || document.querySelector('video');
    if (!v) return;
    const pl = v.closest('.html5-video-player');
    if (pl && pl.classList.contains('ad-showing')) return;   // quảng cáo: để bộ bỏ qua quảng cáo xử lý
    if (v.muted || v.volume === 0) {
      try { if (pl && typeof pl.unMute === 'function') pl.unMute(); } catch (_) { }
      v.muted = false;
      if (v.volume === 0) v.volume = 1;
    }
  };
  document.addEventListener('playing', () => { restoreSound(); setTimeout(restoreSound, 400); setTimeout(restoreSound, 1500); }, true);
  document.addEventListener('loadedmetadata', restoreSound, true);

  // Gửi thông tin phát nhạc lên Lock Screen / Control Center
  const syncNowPlaying = () => {
    const v = currentVideo();
    if (!v) return;
    const title = (document.querySelector('h1.slim-video-metadata-title, .ytm-slim-video-information-title')?.textContent || document.title || '')
      .replace(' - YouTube', '').trim();
    const author = (document.querySelector('.slim-owner-channel-name, ytm-channel-thumbnail-with-link-renderer + *')?.textContent || 'YouTube').trim();
    const vidMatch = location.search.match(/v=([^&]+)/);
    const thumbnail = vidMatch ? `https://i.ytimg.com/vi/${vidMatch[1]}/hqdefault.jpg` : '';

    try {
      window.webkit?.messageHandlers?.nowPlaying?.postMessage({
        title: title || 'Aether Player',
        author: author,
        duration: isFinite(v.duration) ? v.duration : 0,
        currentTime: isFinite(v.currentTime) ? v.currentTime : 0,
        isPlaying: !v.paused,
        thumbnail: thumbnail
      });
    } catch (_) { }
  };

  const media = {
    wasPlaying: false,
    keepAliveUntil: 0,
    remember() {
      const v = currentVideo();
      this.wasPlaying = !!(v && !v.paused && !v.ended);
    },
    enterBackground() {
      const now = Date.now();
      const v = currentVideo();
      if (!this.wasPlaying && v && v.paused && !v.ended && now - lastSystemPause < 2500) this.wasPlaying = true;
      this.keepAliveUntil = now + 6000;
      this.resume();
    },
    enterForeground() { this.keepAliveUntil = 0; },
    resume() {
      const v = currentVideo();
      if (v && v.paused && !v.ended) {
        const p = v.play();
        if (p && p.catch) p.catch(() => { });
      }
      syncNowPlaying();
    },
    pause() {
      const v = currentVideo();
      if (v) nativePause(v); // dùng native để không bị guard chặn
      syncNowPlaying();
    },
    togglePlay() {
      const v = currentVideo();
      if (!v) return;
      if (v.paused) this.resume();
      else this.pause();
    },
    seek(pos) {
      const v = currentVideo();
      if (v && isFinite(pos)) {
        v.currentTime = pos;
        syncNowPlaying();
      }
    },
    skip(seconds) {
      const v = currentVideo();
      if (v && isFinite(v.duration)) {
        v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
        syncNowPlaying();
      }
    },
    // Vuốt xuống từ video: bật PiP rồi nhờ Swift "park" trang này và mở trang chủ ở WebView mới.
    // PHẢI được gọi trực tiếp trong touchend (user gesture), nếu không WebKit từ chối PiP.
    minimize() {
      const v = currentVideo();
      // Báo kết quả cho uienhance.js để hoàn tác hiệu ứng kéo video khi PiP thất bại
      const report = (ok) => { try { window.dispatchEvent(new CustomEvent('ae:minimize-result', { detail: { ok } })); } catch (_) { } };
      if (!v || !(v.readyState >= 1)) { toast('Chưa có video để thu nhỏ'); report(false); return 'no-video'; }
      const useWK = !!(v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture'));
      if (!useWK && !v.requestPictureInPicture) { toast('Thiết bị không hỗ trợ PiP'); report(false); return 'unsupported'; }
      if (v.paused && !v.ended) { const p = v.play(); if (p && p.catch) p.catch(() => { }); }
      try {
        if (useWK) v.webkitSetPresentationMode('picture-in-picture');
        else { const p = v.requestPictureInPicture(); if (p && p.catch) p.catch(() => { }); }
      } catch (e) { toast('Không bật được PiP'); report(false); return 'error'; }

      waitForPiP(v, 900).then((ok) => {
        if (!ok) { toast('Không bật được PiP, hãy thử lại'); report(false); return; }
        window.__aeParked = true;
        if (!postNav({ action: 'minimizeToPiP', vid: videoIdOf() })) { window.__aeParked = false; report(false); return; }
        report(true);
      });
      return 'pending';
    },
    togglePiP() {
      const v = currentVideo();
      if (!v) return 'no-video';
      try {
        if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
          const next = v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
          v.webkitSetPresentationMode(next);
          return next;
        } else if (v.requestPictureInPicture) {
          if (document.pictureInPictureElement) document.exitPictureInPicture();
          else v.requestPictureInPicture();
          return 'standard';
        }
      } catch (e) {
        console.warn('Aether PiP error:', e);
      }
      return 'unsupported';
    },
    // Lấy manifest HLS + metadata từ chính player response mà trang YouTube dùng để phát.
    // HLS không cần PO Token như link googlevideo trực tiếp nên không bị 403.
    async getHLS(videoId) {
      const diag = [];
      const sdKeys = (r) => (r && r.streamingData) ? Object.keys(r.streamingData).join('+') : 'none';
      const pick = (r) => {
        if (!r) return null;
        const vid = r.videoDetails && r.videoDetails.videoId;
        if (vid && vid !== videoId) return null;
        const hls = r.streamingData && r.streamingData.hlsManifestUrl;
        if (!hls) return null;
        const d = r.videoDetails || {};
        return {
          hls: hls,
          title: d.title || '',
          author: d.author || '',
          duration: parseFloat(d.lengthSeconds) || 0
        };
      };

      // 1. Ưu tiên dữ liệu trang đã nhận sẵn
      const cachedResp = playerResponsesByVid.get(videoId) || window.__lastPlayerResponse || window.ytInitialPlayerResponse;
      const cached = pick(playerResponsesByVid.get(videoId))
        || pick(window.__lastPlayerResponse)
        || pick(window.ytInitialPlayerResponse);
      if (cached) return cached;
      diag.push('cache=' + (cachedResp ? 'co(sd:' + sdKeys(cachedResp) + ')' : 'khong'));

      // 2. Chưa có: tự gọi player API bằng đúng context của trang (cookie + visitorData hợp lệ)
      try {
        const cfg = window.ytcfg && window.ytcfg.get ? window.ytcfg : null;
        const ctx = cfg && cfg.get('INNERTUBE_CONTEXT');
        diag.push('ctx=' + (ctx ? 'co' : 'khong'));
        if (!ctx) return { hls: null, diag: diag.join(' ') };
        const key = cfg.get('INNERTUBE_API_KEY');
        const res = await fetch('/youtubei/v1/player?prettyPrint=false' + (key ? '&key=' + key : ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: videoId, context: ctx, contentCheckOk: true, racyCheckOk: true })
        });
        diag.push('http=' + res.status);
        if (!res.ok) return { hls: null, diag: diag.join(' ') };
        const r = await res.json();
        const found = pick(r);
        if (found) return found;
        diag.push('ps=' + ((r.playabilityStatus && r.playabilityStatus.status) || '?'));
        diag.push('sd=' + sdKeys(r));
        return { hls: null, diag: diag.join(' ') };
      } catch (e) {
        diag.push('loi=' + (e && e.message ? e.message : e));
        return { hls: null, diag: diag.join(' ') };
      }
    },
    async extractDownloadStreams() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let videoId = urlParams.get('v');
        if (!videoId) {
          const m = location.pathname.match(/\/(shorts|watch|v)\/([a-zA-Z0-9_-]+)/);
          if (m) videoId = m[2];
        }
        const player = document.querySelector('.html5-video-player') || document.querySelector('#movie_player');
        const pData = (player && player.getVideoData) ? player.getVideoData() : {};
        if (!videoId && pData.video_id) {
          videoId = pData.video_id;
        }
        if (!videoId) return;

        // Lấy tiêu đề và tác giả CHÍNH XÁC của video hiện tại từ DOM để tránh tag video khác
        let title = document.querySelector('h1.slim-video-metadata-title, .ytm-slim-video-information-title, .slim-video-metadata-header')?.textContent?.trim();
        if (!title && pData.title) title = pData.title;
        if (!title) title = document.title.replace(' - YouTube', '').trim();

        let author = document.querySelector('.slim-owner-channel-name, ytm-channel-thumbnail-with-link-renderer + *')?.textContent?.trim();
        if (!author && pData.author) author = pData.author;
        if (!author) author = 'YouTube';

        const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        // Gọi trực tiếp InnerTube Client iOS 20.10.4 để lấy stream sạch 1080p, 1440p, 4K, 720p không bị bot check
        let targetData = null;
        try {
          const res = await fetch('/youtubei/v1/player?prettyPrint=false', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '5',
              'X-YouTube-Client-Version': '20.10.4'
            },
            body: JSON.stringify({
              videoId: videoId,
              context: {
                client: {
                  clientName: 'IOS',
                  clientVersion: '20.10.4',
                  deviceMake: 'Apple',
                  deviceModel: 'iPhone16,2',
                  userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
                  osName: 'iPhone',
                  osVersion: '17.5.1.21F90'
                }
              }
            })
          });
          if (res.ok) {
            targetData = await res.json();
          }
        } catch (e) {
          console.warn('Aether iOS client fetch error:', e);
        }

        // Cập nhật metadata chuẩn từ targetData nếu có
        if (targetData && targetData.videoDetails) {
          if (targetData.videoDetails.title) title = targetData.videoDetails.title;
          if (targetData.videoDetails.author) author = targetData.videoDetails.author;
        }

        // Thu thập formats: ưu tiên targetData, fallback player responses khớp videoId
        let streamingData = targetData?.streamingData;
        if (!streamingData) {
          const matchedCached = playerResponsesByVid.get(videoId);
          if (matchedCached && matchedCached.streamingData) {
            streamingData = matchedCached.streamingData;
          }
        }

        const rawAdaptive = streamingData?.adaptiveFormats || [];
        const rawFormats = streamingData?.formats || [];

        // Tìm luồng âm thanh tốt nhất (AAC/m4a để iOS AVFoundation ghép native tức thì)
        let bestAudioUrl = null;
        let highestAudioBitrate = 0;
        for (const a of rawAdaptive) {
          if (a.url && a.mimeType && a.mimeType.startsWith('audio/')) {
            const isAAC = a.mimeType.includes('mp4a') || a.mimeType.includes('audio/mp4');
            const br = a.bitrate || 0;
            if (isAAC && (!bestAudioUrl || br > highestAudioBitrate)) {
              bestAudioUrl = a.url;
              highestAudioBitrate = br;
            } else if (!bestAudioUrl) {
              bestAudioUrl = a.url;
            }
          }
        }

        const qualityMap = new Map();

        // Quét các luồng Adaptive chất lượng cao: TUYỆT ĐỐI CHỈ LẤY >= 720p (720p, 1080p, 1440p, 2160p)
        for (const v of rawAdaptive) {
          if (!v.url || !v.mimeType || !v.mimeType.startsWith('video/')) continue;
          const h = v.height || parseInt(v.qualityLabel) || 0;
          if (h < 720) continue; // Nghiêm cấm 360p, 480p

          let label = v.qualityLabel || `${h}p`;
          if (h >= 2160) label = '2160p (4K Ultra HD)';
          else if (h >= 1440) label = '1440p (2K QHD)';
          else if (h >= 1080) label = '1080p Full HD';
          else if (h >= 720) label = '720p HD';

          const isH264 = v.mimeType.includes('avc1') || v.mimeType.includes('mp4');
          if (!qualityMap.has(h) || isH264) {
            qualityMap.set(h, {
              quality: label,
              height: h,
              url: v.url,
              audioUrl: bestAudioUrl,
              mimeType: v.mimeType
            });
          }
        }

        // Quét các luồng Progressive (có sẵn âm thanh, >= 720p)
        for (const f of rawFormats) {
          if (!f.url) continue;
          const h = f.height || parseInt(f.qualityLabel) || 0;
          if (h < 720) continue;

          let label = f.qualityLabel || `${h}p`;
          if (h >= 720 && !label.includes('HD')) label = '720p HD';

          if (!qualityMap.has(h)) {
            qualityMap.set(h, {
              quality: label,
              height: h,
              url: f.url,
              audioUrl: null,
              mimeType: f.mimeType
            });
          }
        }

        // Fallback: Nếu không có adaptive, lấy luồng đang nạp trên <video>
        const activeVideo = document.querySelector('video');
        if (qualityMap.size === 0 && activeVideo && activeVideo.src && activeVideo.src.startsWith('http')) {
          qualityMap.set(720, {
            quality: '720p HD (Trực tiếp)',
            height: 720,
            url: activeVideo.src,
            audioUrl: null,
            mimeType: 'video/mp4'
          });
        }

        const sortedStreams = Array.from(qualityMap.values())
          .sort((a, b) => b.height - a.height);

        const duration = parseFloat(targetData?.videoDetails?.lengthSeconds) || activeVideo?.duration || 0;

        window.webkit?.messageHandlers?.downloadData?.postMessage({
          videoId: videoId,
          title: title,
          author: author,
          duration: duration,
          thumbnail: thumbnail,
          formats: sortedStreams
        });
      } catch (e) {
        console.warn('Aether stream extraction error:', e);
      }
    }
  };

  // ── 5. Toàn màn hình = xoay ngang app + player phủ kín bằng CSS (class ae-land, xem uienhance.js) ──────
  // Trước đây dùng webkitEnterFullscreen() (trình phát native của iOS): chuyển cảnh nặng + khi đóng iOS tự pause video,
  // và còn gọi cả khi xoay máy không có thao tác chạm → hai lần chuyển cảnh chồng nhau gây lag.
  // Giờ chỉ xoay giao diện: video không bị đụng vào nên không giật, không bị dừng.
  const FS_SEL = '.fullscreen-icon, .ytp-fullscreen-button, button.fullscreen-button, .ytwPlayerBottomControlsFullscreenButtonWrapper, [aria-label*="Full screen"], [aria-label*="Toàn màn hình"], [aria-label*="toàn màn hình"], [aria-label*="Fullscreen"], [aria-label*="Exit full"], .icon-button[aria-label*="screen"]';
  let lastFsReq = 0;
  const requestFs = () => {
    lastFsReq = Date.now();
    postNav({ action: window.innerWidth > window.innerHeight ? 'exitFullscreen' : 'enterFullscreen' });
  };
  document.addEventListener('click', (e) => {
    if (!location.pathname.startsWith('/watch')) return;
    const fsBtn = e.target.closest && e.target.closest(FS_SEL);
    if (!fsBtn || !currentVideo()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    requestFs();
  }, true);
  // Nút fullscreen của giao diện mới có thể không khớp selector → YouTube tự vào fullscreen phần tử (video bị lệch, cắt đáy).
  // Chặn: thoát ngay và đổi thành "xoay ngang/dọc" của ta.
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => document.addEventListener(t, () => {
    if (!location.pathname.startsWith('/watch')) return;
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
    try { (document.exitFullscreen || document.webkitExitFullscreen || function () { }).call(document); } catch (_) { }
    if (Date.now() - lastFsReq > 700) requestFs();
  }, true));

  // Nếu vẫn lọt vào fullscreen native (vd. YouTube tự gọi): iOS pause video khi thoát → tự phát lại
  let wasPlayingBeforeFS = false;
  document.addEventListener('webkitbeginfullscreen', (e) => {
    const v = e.target;
    wasPlayingBeforeFS = v instanceof HTMLVideoElement && !v.paused;
  }, true);
  document.addEventListener('webkitendfullscreen', (e) => {
    postNav({ action: 'exitFullscreen' });
    const v = e.target;
    if (wasPlayingBeforeFS && v instanceof HTMLVideoElement) {
      [60, 250, 600].forEach((ms) => setTimeout(() => { if (v.paused && !v.ended) v.play().catch(() => { }); }, ms));
    }
  }, true);

  // Lắng nghe trạng thái video để đồng bộ lên Lock Screen
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLVideoElement) syncNowPlaying();
  }, true);

  document.addEventListener('pause', (e) => {
    if (!(e.target instanceof HTMLVideoElement)) return;
    const now = Date.now();
    if (now - lastTouch > 800) lastSystemPause = now;
    if (media.wasPlaying && now < media.keepAliveUntil) setTimeout(() => media.resume(), 60);
    syncNowPlaying();
  }, true);

  document.addEventListener('timeupdate', (e) => {
    if (e.target instanceof HTMLVideoElement) {
      // Throttle sync now playing every 4 seconds
      const now = Date.now();
      if (!window.__lastTimeSync || now - window.__lastTimeSync > 4000) {
        window.__lastTimeSync = now;
        syncNowPlaying();
      }
    }
  }, true);

  window.__aeMedia = media;
})();