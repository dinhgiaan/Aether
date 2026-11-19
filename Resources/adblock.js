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
  const playerResponsesByVid = new Map();
  const cachePlayerResponse = (data) => {
    if (!data || typeof data !== 'object') return;
    const vid = data.videoDetails?.videoId;
    if (vid) {
      playerResponsesByVid.set(vid, data);
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
    // Tab Shorts & Giá sách Shorts trên trang chủ / tìm kiếm triệt để
    'ytm-pivot-bar-item-renderer:has([tab-identifier="FEshorts"])',
    'ytm-pivot-bar-item-renderer:has(a[href*="/shorts"])',
    'ytm-reel-shelf-renderer',
    'ytm-rich-shelf-renderer',
    'ytm-rich-shelf-renderer:has(ytm-reel-item-renderer)',
    'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
    'ytm-rich-section-renderer:has(ytm-reel-item-renderer)',
    'ytm-rich-section-renderer:has(a[href*="/shorts"])',
    'ytm-rich-section-renderer:has([aria-label*="Shorts"])',
    'ytm-rich-section-renderer:has([title*="Shorts"])',
    'ytm-reel-item-renderer',
    'ytm-rich-item-renderer:has(ytm-reel-item-renderer)',
    'ytm-rich-item-renderer:has(a[href*="/shorts"])',
    'ytm-video-with-context-renderer:has(a[href*="/shorts"])',
    'ytm-compact-video-renderer:has(a[href*="/shorts"])',
    'ytm-item-section-renderer:has(ytm-reel-shelf-renderer)',
    'ytm-item-section-renderer:has(ytm-reel-item-renderer)',
    'ytm-item-section-renderer:has(a[href*="/shorts"])',
    'ytm-item-section-renderer:has([aria-label*="Shorts"])',
    'ytm-shelf-renderer:has(ytm-reel-item-renderer)',
    'ytm-reel-player-overlay-renderer',
    '[aria-label*="Shorts"]',
    '[title*="Shorts"]',
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
  const HIDE_CSS = HIDE.map((s) => s + '{display:none!important}').join('\n');
  const EXTRA_CSS = `
    /* Watch page: Xoá sạch khoảng trống thừa, ẩn placeholder bị trùng lặp */
    body.ae-watching ytm-mobile-topbar-renderer,
    body.ae-watching header.mobile-topbar-header,
    body.ae-watching #header-bar {
      display: none !important;
      height: 0 !important;
      min-height: 0 !important;
    }

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

    body.ae-watching #player-container-id,
    body.ae-watching .player-container {
      position: relative !important;
      top: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
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
    ytm-engagement-panel-section-list-renderer,
    ytm-comment-section-renderer {
      transition: transform 0.32s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.22s ease !important;
      animation: ae-slide-up 0.30s cubic-bezier(0.25, 1, 0.5, 1) both !important;
    }
    @keyframes ae-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
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
        if (v.paused) v.play().catch(() => {});
      } else {
        window.__aeInPiP = false;
      }
    }
  }, true);

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

  // ── 5. Hỗ trợ xoay ngang màn hình toàn màn hình (Landscape Fullscreen) ──────
  document.addEventListener('click', (e) => {
    const fsBtn = e.target.closest(
      '.fullscreen-icon, .ytp-fullscreen-button, button.fullscreen-button, [aria-label*="Full screen"], [aria-label*="Toàn màn hình"], [aria-label*="toàn màn hình"], [aria-label*="Fullscreen"], .icon-button[aria-label*="screen"]'
    );
    if (fsBtn) {
      const v = currentVideo();
      if (v) {
        e.preventDefault();
        e.stopPropagation();
        try {
          window.webkit?.messageHandlers?.aetherNav?.postMessage({ action: 'enterFullscreen' });
        } catch (_) {}
        if (v.webkitEnterFullscreen) {
          v.webkitEnterFullscreen();
        }
      }
    }
  }, true);

  // Khi thoát fullscreen video trên iOS
  document.addEventListener('webkitendfullscreen', () => {
    try {
      window.webkit?.messageHandlers?.aetherNav?.postMessage({ action: 'exitFullscreen' });
    } catch (_) {}
  }, true);

  // Tự động vào Native iOS Fullscreen khi người dùng xoay ngang điện thoại lúc xem video
  window.addEventListener('orientationchange', () => {
    if (location.pathname.startsWith('/watch')) {
      const isLandscape = Math.abs(window.orientation) === 90;
      const v = currentVideo();
      if (isLandscape && v && v.webkitEnterFullscreen && !v.webkitDisplayingFullscreen) {
        v.webkitEnterFullscreen();
      }
    }
  });

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
