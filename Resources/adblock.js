// Aether: lọc quảng cáo YouTube + phát nền + đồng bộ Lock Screen / Control Center
(() => {
  'use strict';
  if (window.__aeAdblock) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeAdblock = true;

  // ---- 1. Xóa field quảng cáo khỏi dữ liệu player (Heuristic + Regex động) ---
  const AD_KEY_REGEX = /(^|_)(playerAds|adPlacements?|adSlots?|adBreaks?|adBreakHeartbeatParams|promoted(Video|Sparkles|Item)?|interstitialAds?)($|_)/i;
  const SAFE_EXCLUDE = /^(adaptiveFormats|additionalMetadata)$/i;

  const prune = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 8) return o;
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
  const nativeParse = JSON.parse;
  JSON.parse = function (...args) {
    try {
      const data = nativeParse.apply(this, args);
      return prune(data);
    } catch (_) {
      return nativeParse.apply(this, args);
    }
  };

  if (window.Response && Response.prototype.json) {
    const nativeJson = Response.prototype.json;
    Response.prototype.json = function (...args) {
      return nativeJson.apply(this, args).then((data) => {
        try { return prune(data); } catch (_) { return data; }
      });
    };
  }

  let initialPlayerResponse;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get() { return initialPlayerResponse; },
      set(v) { initialPlayerResponse = prune(v); },
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

  const syncAdSkipper = () => {
    const isWatch = location.pathname.startsWith('/watch');
    document.body?.classList.toggle('ae-watching', isWatch);
    if (isWatch) startAdSkipper();
    else if (adInterval) { clearInterval(adInterval); adInterval = null; }
    
    // Báo trạng thái xem cho Swift Native
    try {
      window.webkit?.messageHandlers?.aetherNav?.postMessage({ isWatching: isWatch });
    } catch (_) {}
  };

  window.addEventListener('popstate', syncAdSkipper, true);
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
    'ytm-pivot-bar-item-renderer:has([tab-identifier="FEshorts"])',
    'ytm-pivot-bar-item-renderer:has(a[href="/shorts"])',
    'ytm-reel-shelf-renderer',
    'ytm-rich-shelf-renderer:has(ytm-reel-item-renderer)',
    'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
    'ytm-reel-item-renderer',
    'ytm-rich-item-renderer:has(ytm-reel-item-renderer)',
    'ytm-rich-item-renderer:has(a[href^="/shorts"])',
    'ytm-video-with-context-renderer:has(a[href^="/shorts"])',
    'ytm-compact-video-renderer:has(a[href^="/shorts"])',
    'ytm-item-section-renderer:has(ytm-reel-shelf-renderer)',
    // Xoá header (logo, search, 3 dots) khi đang xem video
    'body.ae-watching ytm-mobile-topbar-renderer',
    'body.ae-watching header.mobile-topbar-header',
    'body.ae-watching #header-bar',
    // Nút la bàn (Explore) bên cạnh các tags (All, Music...)
    'ytm-chip-cloud-chip-renderer:first-child:has(yt-icon)',
    'ytm-chip-cloud-chip-renderer[chip-style="STYLE_EXPLORE"]',
    'ytm-chip-cloud-chip-renderer:has([aria-label*="Explore"])',
    'ytm-chip-cloud-chip-renderer:has([aria-label*="Khám phá"])',
    // Các button rác trong phần Hồ sơ (Films, Help, Feedback, YouTube Premium)
    'ytm-compact-link-renderer:has(a[href*="/premium"])',
    'ytm-compact-link-renderer:has(a[href*="/storefront"])',
    'ytm-compact-link-renderer:has(a[href*="support.google"])',
    'ytm-compact-link-renderer:has(a[href*="feedback"])',
    'ytm-account-item-section-renderer:has(a[href*="/premium"])',
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

  const currentVideo = () =>
    document.querySelector('.html5-video-player video') || document.querySelector('video');

  let lastTouch = 0;
  let lastSystemPause = 0;
  window.addEventListener('touchend', () => { lastTouch = Date.now(); }, true);

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
    } catch (_) {}
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
      if (v) v.pause();
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
    extractDownloadStreams() {
      try {
        const resp = window.ytInitialPlayerResponse || {};
        const videoDetails = resp.videoDetails || {};
        const streamingData = resp.streamingData || {};
        const rawFormats = streamingData.formats || [];
        const rawAdaptive = streamingData.adaptiveFormats || [];
        
        const vidMatch = location.search.match(/v=([^&]+)/);
        const videoId = videoDetails.videoId || (vidMatch ? vidMatch[1] : 'video');
        const title = videoDetails.title || document.title.replace(' - YouTube', '').trim();
        const author = videoDetails.author || 'YouTube';
        const duration = parseFloat(videoDetails.lengthSeconds) || 0;
        const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        
        // 1. Tìm luồng âm thanh tốt nhất (ưu tiên AAC/m4a để iOS AVFoundation ghép native)
        let bestAudio = null;
        for (const a of rawAdaptive) {
          if (a.url && a.mimeType && a.mimeType.startsWith('audio/')) {
            const isAAC = a.mimeType.includes('mp4a') || a.mimeType.includes('audio/mp4');
            if (!bestAudio) {
              bestAudio = a;
            } else if (isAAC && !bestAudio.mimeType.includes('mp4a')) {
              bestAudio = a; // Ưu tiên AAC
            } else if (isAAC && (a.bitrate || 0) > (bestAudio.bitrate || 0)) {
              bestAudio = a; // Ưu tiên bitrate cao hơn
            }
          }
        }
        
        const qualityMap = new Map(); // height -> stream object
        
        // 2. Quét các luồng Adaptive chất lượng cao (1080p, 1440p 2K, 4K, 720p)
        for (const v of rawAdaptive) {
          if (!v.url || !v.mimeType || !v.mimeType.startsWith('video/')) continue;
          const h = v.height || parseInt(v.qualityLabel) || 0;
          // BỎ TOÀN BỘ < 720p (360p, 480p bị loại bỏ hoàn toàn)
          if (h < 720) continue;
          
          const isH264 = v.mimeType.includes('avc1') || v.mimeType.includes('mp4');
          let label = v.qualityLabel || `${h}p`;
          if (h >= 2160) label = '2160p (4K Ultra HD)';
          else if (h >= 1440) label = '1440p (2K QHD)';
          else if (h >= 1080) label = '1080p Full HD';
          else if (h >= 720) label = '720p HD';
          
          // Ưu tiên codec H.264 (avc1) để iOS ghép file passthrough tức thì
          if (!qualityMap.has(h) || isH264) {
            qualityMap.set(h, {
              quality: label,
              height: h,
              url: v.url,
              audioUrl: bestAudio ? bestAudio.url : null,
              mimeType: v.mimeType
            });
          }
        }
        
        // 3. Quét các luồng Progressive (đã có sẵn cả hình và tiếng, chỉ lấy >= 720p)
        for (const f of rawFormats) {
          if (!f.url) continue;
          const h = f.height || parseInt(f.qualityLabel) || 0;
          if (h < 720) continue; // Bỏ qua 360p, 480p
          
          let label = f.qualityLabel || `${h}p`;
          if (h >= 720 && !label.includes('HD')) label = '720p HD';
          
          if (!qualityMap.has(h)) {
            qualityMap.set(h, {
              quality: label,
              height: h,
              url: f.url,
              audioUrl: null, // Đã có sẵn tiếng
              mimeType: f.mimeType
            });
          }
        }
        
        // Sắp xếp thứ tự từ cao nhất xuống thấp nhất (1440p -> 1080p -> 720p)
        const sortedStreams = Array.from(qualityMap.values())
          .sort((a, b) => b.height - a.height);
        
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
