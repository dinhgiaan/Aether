// Aether UI Enhancement – Liquid-Glass bottom nav + gestures + branding + animations + downloads tab
(() => {
  'use strict';
  if (window.__aeUI) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;

  // ── 1. CSS: Liquid-Glass + Search + Header + Comments ──────────────────────
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
      backdrop-filter: blur(40px) saturate(1.9) brightness(1.08) !important;
      -webkit-backdrop-filter: blur(40px) saturate(1.9) brightness(1.08) !important;
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

    /* ── Content clearance so floating bar doesn't cover items ──────────── */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 85px) !important;
    }

    /* ── Header hiện đại & Logo có lề chuẩn ──────────────────────────────── */
    .mobile-topbar-header, ytm-mobile-topbar-renderer {
      background: rgba(12, 12, 15, 0.85) !important;
      backdrop-filter: blur(24px) !important;
      -webkit-backdrop-filter: blur(24px) !important;
      border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
      padding-left: 12px !important;
    }

    .header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, a.mobile-topbar-header-endpoint, .ytm-mobile-topbar-renderer-logo {
      margin-left: 8px !important;
      padding-left: 2px !important;
    }

    /* ── Custom UI/UX Tìm kiếm Liquid-Glass cao cấp ──────────────────────── */
    ytm-search-box, .search-box-wrapper, form.search-form {
      border-radius: 999px !important;
      background: rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: 0.5px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
      transition: all 0.2s ease !important;
    }

    ytm-search-box:focus-within, .search-box-wrapper:focus-within {
      background: rgba(255, 255, 255, 0.14) !important;
      border-color: rgba(255, 45, 85, 0.45) !important;
      box-shadow: 0 4px 20px rgba(255, 45, 85, 0.18) !important;
    }

    .search-box-input {
      font-size: 15px !important;
      color: #ffffff !important;
      padding: 8px 14px !important;
    }

    /* Gợi ý tìm kiếm kính mờ */
    .compact-link, ytm-search-suggestion, ytm-history-suggestion-renderer {
      border-radius: 14px !important;
      margin: 4px 10px !important;
      padding: 11px 16px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border: 0.5px solid rgba(255, 255, 255, 0.06) !important;
      transition: all 0.15s ease !important;
    }

    .compact-link:active, ytm-search-suggestion:active, ytm-history-suggestion-renderer:active {
      background: rgba(255, 255, 255, 0.14) !important;
      transform: scale(0.99) !important;
    }

    /* Chuyển trang mượt mà */
    ytm-section-list-renderer, ytm-search-results-section-renderer {
      animation: ae-fadein 0.2s ease both !important;
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
    s.textContent = CSS;
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

    // Thêm thẻ "Video đã tải ngoại tuyến" vào Hồ Sơ
    if (location.pathname.startsWith('/feed/you') || location.pathname.startsWith('/feed/library')) {
      if (!document.getElementById('ae-profile-dl-card')) {
        const container = document.querySelector('ytm-item-section-renderer, ytm-section-list-renderer');
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
          card.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:34px;height:34px;border-radius:50%;background:rgba(255,36,66,0.18);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:#ff334b;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="8 12 12 16 16 12"></polyline>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                </svg>
              </div>
              <div>
                <div style="font-size:14px;font-weight:700;color:#fff;">Video đã tải ngoại tuyến</div>
                <div style="font-size:11px;color:#aaa;margin-top:2px;">Xem lại mọi lúc không cần mạng</div>
              </div>
            </div>
            <div style="color:#aaa;font-size:18px;">›</div>
          `;
          card.addEventListener('click', () => {
            try {
              window.webkit?.messageHandlers?.aetherNav?.postMessage({ action: 'openDownloads' });
            } catch (_) {}
          });
          container.prepend(card);
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
      } catch (_) {}
    });

    // Chèn trước tab Hồ sơ
    const lastItem = pivot.lastElementChild;
    if (lastItem) {
      pivot.insertBefore(tab, lastItem);
    } else {
      pivot.appendChild(tab);
    }
  };

  // ── 5. Vuốt video xuống để thu nhỏ PiP / quay về trang trước không bị ngắt ─
  let startY = 0;
  let startX = 0;
  let isVideoTouch = false;

  window.addEventListener('touchstart', (e) => {
    if (!location.pathname.startsWith('/watch')) return;
    if (e.touches.length === 1) {
      const t = e.target;
      if (t && t.closest('.html5-video-player, #player-container-id, video, .player-control-overlay, .ytm-video-player-container')) {
        isVideoTouch = true;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
      } else {
        isVideoTouch = false;
      }
    }
  }, { capture: true, passive: true });

  window.addEventListener('touchend', (e) => {
    if (!isVideoTouch || e.changedTouches.length !== 1) return;
    const deltaY = e.changedTouches[0].clientY - startY;
    const deltaX = Math.abs(e.changedTouches[0].clientX - startX);
    if (deltaY > 55 && deltaX < 45) {
      // Kích hoạt PiP trước để video tiếp tục phát nổi không bị tắt
      try {
        if (window.__aeMedia && window.__aeMedia.togglePiP) {
          window.__aeMedia.togglePiP();
        }
      } catch (_) {}
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
    isVideoTouch = false;
  }, { capture: true, passive: true });

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
      injectDownloadsTab();
    };

    window.addEventListener('popstate', refreshUI);
    window.addEventListener('ae:navigate', refreshUI);

    try {
      window.webkit?.messageHandlers?.aetherReady?.postMessage('ready');
    } catch (_) {}

    refreshUI();

    let moScheduled = false;
    const observer = new MutationObserver(() => {
      if (moScheduled) return;
      moScheduled = true;
      window.requestAnimationFrame(() => {
        replaceLogoWithAether();
        cleanProfileMenu();
        injectDownloadsTab();
        moScheduled = false;
      });
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
