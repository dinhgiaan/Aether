// Aether UI Enhancement – Liquid-Glass bottom nav + animations
// Chỉ chạy ở main frame, chỉ trên youtube.com
(() => {
  'use strict';
  if (window.__aeUI) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;

  // ── 1. CSS: Liquid-Glass floating capsule ──────────────────────────────────
  const CSS = `
    /* ── Bottom bar: floating capsule ───────────────────────────────────── */
    ytm-bottom-bar-renderer {
      left: 50% !important;
      right: auto !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
      transform: translateX(-50%) !important;
      width: auto !important;
      min-width: min(300px, 88vw) !important;
      border-radius: 999px !important;

      /* Liquid Glass */
      background: rgba(16, 16, 20, 0.62) !important;
      backdrop-filter: blur(48px) saturate(1.9) brightness(1.08) !important;
      -webkit-backdrop-filter: blur(48px) saturate(1.9) brightness(1.08) !important;
      border: 0.5px solid rgba(255, 255, 255, 0.14) !important;
      box-shadow:
        inset 0 0.5px 0 rgba(255,255,255,0.10),
        0 8px 40px rgba(0, 0, 0, 0.60),
        0 2px 8px  rgba(0, 0, 0, 0.30) !important;

      overflow: hidden !important;
      will-change: transform, opacity !important;
      transition:
        transform 0.42s cubic-bezier(0.34, 1.4, 0.64, 1),
        opacity   0.28s ease !important;
    }

    /* Scroll-to-hide state */
    ytm-bottom-bar-renderer.ae-hidden {
      transform: translateX(-50%) translateY(130%) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    /* ── Tab bar inner ───────────────────────────────────────────────────── */
    ytm-pivot-bar-renderer {
      background: transparent !important;
      border-top: none !important;
      padding: 4px 8px !important;
    }

    ytm-pivot-bar-item-renderer {
      flex: none !important;
      min-width: 58px !important;
      border-radius: 999px !important;
      padding: 8px 14px !important;
      transition:
        background 0.18s ease,
        transform  0.20s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    /* Active tab highlight pill */
    ytm-pivot-bar-item-renderer.iron-selected {
      background: rgba(255, 255, 255, 0.13) !important;
    }

    /* ── Content clearance so floating bar doesn't cover items ──────────── */
    .page-container {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 90px) !important;
    }

    /* ── Smooth page transitions (YouTube SPA) ──────────────────────────── */
    ytm-section-list-renderer,
    ytm-search-results-section-renderer {
      animation: ae-fadein 0.22s ease both !important;
    }

    @keyframes ae-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }

    /* ── Smoother thumbnail image load ──────────────────────────────────── */
    img.yt-img-shadow, ytm-thumbnail-cover img {
      transition: opacity 0.25s ease !important;
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

  // ── 2. Scroll-to-hide bottom bar ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    let prev = 0, hidden = false;
    const getBar = () => document.querySelector('ytm-bottom-bar-renderer');

    const toggle = (hide) => {
      if (hide === hidden) return;
      hidden = hide;
      getBar()?.classList.toggle('ae-hidden', hide);
    };

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < 80)             toggle(false);     // gần đầu → luôn hiện
      else if (y > prev + 14) toggle(true);      // scroll xuống → ẩn
      else if (y < prev - 8)  toggle(false);     // scroll lên → hiện
      prev = y;
    }, { passive: true });

    // Luôn hiện bar khi navigate — dùng ae:navigate do adblock.js dispatch (không hook pushState lại)
    const showBar = () => { hidden = false; getBar()?.classList.remove('ae-hidden'); };
    window.addEventListener('popstate', showBar);
    window.addEventListener('ae:navigate', showBar);
  }, { once: true });

  // ── 3. Tab press: spring bounce feedback ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (tab) tab.style.transform = 'scale(0.87)';
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (!tab) return;
      // spring overshoot → settle
      tab.style.transform = 'scale(1.10)';
      setTimeout(() => { if (tab) tab.style.transform = ''; }, 180);
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
      const tab = e.target.closest('ytm-pivot-bar-item-renderer');
      if (tab) tab.style.transform = '';
    }, { passive: true });
  }, { once: true });
})();

