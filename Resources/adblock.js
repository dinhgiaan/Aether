// Aether: lọc quảng cáo YouTube + giữ phát nền. Chạy ở document start trong mọi frame YouTube.
(() => {
  'use strict';
  if (window.__aeAdblock) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeAdblock = true;

  // ---- 1. Xóa field quảng cáo khỏi dữ liệu player -------------------------
  const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];
  const prune = (o) => {
    if (o && typeof o === 'object') {
      for (const k of AD_KEYS) if (k in o) { try { delete o[k]; } catch (_) {} }
      if (o.playerResponse && typeof o.playerResponse === 'object') prune(o.playerResponse);
    }
    return o;
  };

  // Hook cả 3 đường dữ liệu: JSON.parse, fetch().json(), ytInitialPlayerResponse nhúng trong HTML
  const nativeParse = JSON.parse;
  JSON.parse = function () { return prune(nativeParse.apply(this, arguments)); };

  if (window.Response && Response.prototype.json) {
    const nativeJson = Response.prototype.json;
    Response.prototype.json = function () { return nativeJson.apply(this, arguments).then(prune); };
  }

  let initialPlayerResponse;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get() { return initialPlayerResponse; },
      set(v) { initialPlayerResponse = prune(v); },
    });
  } catch (_) {}

  // ---- 2. Nếu ad vẫn lọt: mute, tua cuối, bấm Skip ------------------------
  const SKIP = [
    '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button', '.ytp-ad-overlay-close-button',
  ].join(',');
  let mutedByUs = false;
  setInterval(() => {
    const player = document.querySelector('.html5-video-player');
    const video = player && player.querySelector('video');
    if (player && player.classList.contains('ad-showing')) {
      if (video) {
        if (!video.muted) { video.muted = true; mutedByUs = true; }
        if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.1) {
          video.currentTime = video.duration;
        }
      }
    } else if (mutedByUs) {
      if (video) video.muted = false;
      mutedByUs = false;
    }
    const skip = document.querySelector(SKIP);
    if (skip) skip.click();
  }, 300);

  // ---- 3. Ẩn ô quảng cáo trong feed ---------------------------------------
  // Mỗi selector một rule riêng để selector không hỗ trợ không làm hỏng cả bộ
  const HIDE = [
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
  ];
  const css = HIDE.map((s) => s + '{display:none!important}').join('\n');
  const addStyle = () => {
    if (document.getElementById('ae-adblock-style')) return;
    const root = document.head || document.documentElement;
    if (!root) return;
    const style = document.createElement('style');
    style.id = 'ae-adblock-style';
    style.textContent = css;
    root.appendChild(style);
  };
  addStyle();
  document.addEventListener('DOMContentLoaded', addStyle);

  // ---- 4. Phát nền + PiP (chỉ frame chính) --------------------------------
  if (window !== window.top) return;

  // Giả trang luôn "visible" để YouTube không tự pause khi app xuống nền
  try {
    for (const [prop, val] of [
      ['hidden', false], ['webkitHidden', false],
      ['visibilityState', 'visible'], ['webkitVisibilityState', 'visible'],
    ]) Object.defineProperty(document, prop, { configurable: true, get: () => val });
  } catch (_) {}
  for (const type of ['visibilitychange', 'webkitvisibilitychange']) {
    document.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
  }

  const currentVideo = () =>
    document.querySelector('.html5-video-player video') || document.querySelector('video');

  let lastTouch = 0;
  let lastSystemPause = 0;
  window.addEventListener('touchend', () => { lastTouch = Date.now(); }, true);

  const media = {
    wasPlaying: false,
    keepAliveUntil: 0,
    // Native gọi ngay trước khi app mất focus: ghi nhớ video có đang phát không
    remember() {
      const v = currentVideo();
      this.wasPlaying = !!(v && !v.paused && !v.ended);
    },
    // Native gọi ngay sau khi xuống nền: mở "cửa sổ" 6s, pause nào rơi vào đây sẽ bị hoàn tác
    enterBackground() {
      const now = Date.now();
      const v = currentVideo();
      // remember() có thể thua race với pause của hệ thống: pause không do người dùng chạm cũng tính
      if (!this.wasPlaying && v && v.paused && !v.ended && now - lastSystemPause < 2500) this.wasPlaying = true;
      this.keepAliveUntil = now + 6000;
      this.resume();
    },
    enterForeground() { this.keepAliveUntil = 0; },
    resume() {
      const v = currentVideo();
      if (this.wasPlaying && v && v.paused && !v.ended) {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      }
    },
    togglePiP() {
      const v = currentVideo();
      if (!v || !v.webkitSetPresentationMode) return 'unsupported';
      v.webkitSetPresentationMode(
        v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
      );
      return 'ok';
    },
  };

  document.addEventListener('pause', (e) => {
    if (!(e.target instanceof HTMLVideoElement)) return;
    const now = Date.now();
    if (now - lastTouch > 800) lastSystemPause = now; // pause không do chạm = do hệ thống
    if (media.wasPlaying && now < media.keepAliveUntil) setTimeout(() => media.resume(), 60);
  }, true);

  window.__aeMedia = media;
})();
