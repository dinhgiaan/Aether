// Aether UI Enhancement – Liquid-Glass bottom nav + gestures + branding + animations
(() => {
  'use strict';
  if (window.__aeUI) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;

  // ── 1. CSS: Liquid-Glass + Modern Typography + Search + Comments ───────────
  const CSS = `
    /* ── Bottom bar: floating capsule ───────────────────────────────────── */
    ytm-bottom-bar-renderer {
      left: 50% !important;
      right: auto !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
      transform: translate3d(-50%, 0, 0) !important;
      width: auto !important;
      min-width: min(290px, 86vw) !important;
      border-radius: 999px !important;

      /* Liquid Glass Apple Style */
      background: rgba(16, 16, 20, 0.68) !important;
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
    }

    ytm-pivot-bar-item-renderer {
      flex: none !important;
      min-width: 56px !important;
      border-radius: 999px !important;
      padding: 7px 14px !important;
      transition:
        background 0.18s ease,
        transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    /* Active tab highlight pill */
    ytm-pivot-bar-item-renderer.iron-selected {
      background: rgba(255, 255, 255, 0.14) !important;
    }

    /* ── Content clearance so floating bar doesn't cover items ──────────── */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 85px) !important;
    }

    /* ── Header hiện đại ─────────────────────────────────────────────────── */
    .mobile-topbar-header, ytm-mobile-topbar-renderer {
      background: rgba(12, 12, 15, 0.85) !important;
      backdrop-filter: blur(24px) !important;
      -webkit-backdrop-filter: blur(24px) !important;
      border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
    }

    /* ── Tìm kiếm & Lịch sử tìm kiếm giao diện kính Liquid-Glass ─────────── */
    ytm-search-box, .search-box-wrapper {
      border-radius: 999px !important;
      background: rgba(255, 255, 255, 0.09) !important;
      border: 0.5px solid rgba(255, 255, 255, 0.15) !important;
    }
    
    .compact-link, ytm-search-suggestion, ytm-history-suggestion-renderer {
      border-radius: 12px !important;
      margin: 3px 8px !important;
      padding: 10px 14px !important;
      transition: background 0.15s ease !important;
      border: none !important;
    }
    
    .compact-link:active, ytm-search-suggestion:active {
      background: rgba(255, 255, 255, 0.12) !important;
    }

    /* ── Tối ưu phần bình luận: giảm 15% kích thước chữ, layout thẻ bo tròn ─ */
    ytm-comment-renderer, .comment-thread-renderer {
      font-size: 0.85rem !important;
      padding: 8px 0 !important;
    }
    ytm-comment-renderer .comment-text {
      font-size: 0.85rem !important;
      line-height: 1.38 !important;
      color: #e2e2e8 !important;
    }
    ytm-comment-renderer .comment-author {
      font-size: 0.78rem !important;
      font-weight: 600 !important;
    }
    ytm-comment-section-renderer {
      border-radius: 20px 20px 0 0 !important;
      background: rgba(18, 18, 22, 0.95) !important;
      backdrop-filter: blur(30px) !important;
      -webkit-backdrop-filter: blur(30px) !important;
    }

    /* ── Chuyển trang mượt mà ────────────────────────────────────────────── */
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

  // ── 2. Thay thế logo YouTube trên Header thành Aether ─────────────────────
  const replaceLogoWithAether = () => {
    const logoTargets = document.querySelectorAll(
      '.header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, a.mobile-topbar-header-endpoint, .ytm-mobile-topbar-renderer-logo'
    );
    logoTargets.forEach((el) => {
      if (el.dataset.aetherLogo) return;
      el.dataset.aetherLogo = 'true';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;font-family:-apple-system,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.5px;text-decoration:none;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff2222;box-shadow:0 0 8px #ff2222;"></span>
          <span style="background:linear-gradient(135deg,#ffffff 20%,#ff3333 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Aether</span>
        </div>
      `;
    });
  };

  // ── 3. Lọc bỏ các mục thừa trong phần Hồ Sơ (Films, Help, Feedback, Premium)
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
  };

  // ── 4. Vuốt video xuống để về trang chủ (Swipe down gesture on video) ──────
  const setupVideoSwipeGesture = () => {
    let startY = 0;
    let startX = 0;
    let isSwiping = false;

    const player = document.querySelector('.html5-video-player');
    if (!player || player.dataset.swipeSetup) return;
    player.dataset.swipeSetup = 'true';

    player.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        isSwiping = false;
      }
    }, { passive: true });

    player.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const deltaY = e.touches[0].clientY - startY;
        const deltaX = Math.abs(e.touches[0].clientX - startX);
        if (deltaY > 30 && deltaX < 40) {
          isSwiping = true;
        }
      }
    }, { passive: true });

    player.addEventListener('touchend', (e) => {
      if (isSwiping && e.changedTouches.length === 1) {
        const deltaY = e.changedTouches[0].clientY - startY;
        if (deltaY > 70) {
          // Vuốt xuống thành công -> quay lại trang trước / trang chủ
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = '/';
          }
        }
      }
      isSwiping = false;
    }, { passive: true });
  };

  // ── 5. Tối ưu Bottom bar: 120Hz mượt mà với requestAnimationFrame ─────────
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

    const showBar = () => {
      hidden = false;
      getBar()?.classList.remove('ae-hidden');
      setTimeout(replaceLogoWithAether, 100);
      setTimeout(cleanProfileMenu, 250);
      setTimeout(setupVideoSwipeGesture, 300);
    };

    window.addEventListener('popstate', showBar);
    window.addEventListener('ae:navigate', showBar);

    // Báo ngay cho Swift tắt splash screen
    try {
      window.webkit?.messageHandlers?.aetherReady?.postMessage('ready');
    } catch (_) {}

    // Chạy các tác vụ làm đẹp ban đầu
    replaceLogoWithAether();
    cleanProfileMenu();
    setupVideoSwipeGesture();

    // Quan sát thay đổi DOM với requestAnimationFrame throttling để đạt 120Hz mượt mà tuyệt đối
    let moScheduled = false;
    const observer = new MutationObserver(() => {
      if (moScheduled) return;
      moScheduled = true;
      window.requestAnimationFrame(() => {
        replaceLogoWithAether();
        cleanProfileMenu();
        setupVideoSwipeGesture();
        moScheduled = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });

  // ── 6. Hiệu ứng chạm tab phản hồi xúc giác nhẹ (Spring feedback) ───────────
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (tab) tab.style.transform = 'scale(0.88)';
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (!tab) return;
      tab.style.transform = 'scale(1.08)';
      setTimeout(() => { if (tab) tab.style.transform = ''; }, 160);
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (tab) tab.style.transform = '';
    }, { passive: true });
  }, { once: true });
})();
