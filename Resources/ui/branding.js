// Aether UI – branding: logo Aether, header, dọn rác (Shorts, mục thừa ở Hồ sơ)
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  const AE_LOGO = 'data:image/png;base64,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';

  // Selector logo YouTube trên header (search.js dùng lại để ẩn logo khi ở trang tìm kiếm)
  AE.LOGO_SEL = '.header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, a.mobile-topbar-header-endpoint, .ytm-mobile-topbar-renderer-logo';

  AE.addCSS('branding', `
    /* Nền tối ngay từ document-start: tránh nháy trắng khi trang chưa vẽ xong (đặc biệt lúc kéo video lộ trang chủ).
       Khi kéo, aetherfix.js đặt html.ae-drag { background: transparent !important } nên vẫn thắng quy tắc này. */
    html { background-color: #0f0f0f; }

    /* Ẩn kệ Shorts */
    ytm-reel-shelf-renderer { display: none !important; }

    /* ── Header hiện đại & Logo có lề chuẩn ───────────────────────────────── */
    .mobile-topbar-header, ytm-mobile-topbar-renderer {
      background: rgba(12, 12, 15, 0.97) !important;
      border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
      padding-left: 0 !important;
    }

    /* Chỉ căn lề riêng cho logo Aether ở trang chủ, KHÔNG làm lệch thanh tìm kiếm */
    .header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, .ytm-mobile-topbar-renderer-logo {
      margin-left: 4px !important;
      padding-left: 0 !important;
    }

    /* Chuyển trang mượt mà. Chỉ ngoài trang watch, và fill-mode "backwards" để KHÔNG giữ transform sau khi xong:
       transform còn sót trên tổ tiên làm position:fixed/sticky (player, chip) bị lệch theo trang. */
    body:not(.ae-watching) ytm-section-list-renderer,
    body:not(.ae-watching) ytm-search-results-section-renderer {
      animation: ae-fadein 0.2s ease backwards;
    }
    @keyframes ae-fadein {
      from { opacity: 0; }   /* chỉ opacity: không tạo transform trên cả danh sách feed */
      to   { opacity: 1; }
    }
  `);

  // ── 2. Thay thế logo YouTube trên Header thành Aether (có khoảng cách) ────
  const replaceLogoWithAether = () => {
    const logoTargets = document.querySelectorAll(
      AE.LOGO_SEL
    );
    logoTargets.forEach((el) => {
      if (el.dataset.aetherLogo) return;
      el.dataset.aetherLogo = 'true';
      // Logo Aether (icon app) thay cho chấm tròn đỏ; sát trái hơn trước (bỏ margin/padding thừa)
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:7px;margin-left:0;padding-left:0;font-family:-apple-system,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.5px;text-decoration:none;">
          <img alt="" src="${AE_LOGO}" style="width:24px;height:24px;border-radius:7px;display:block;flex:none;">
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
  };

  // ── 4b. Xoá triệt để Tab Shorts và các Kệ Shorts trên trang chủ ─────────
  const removeShortsElements = () => {
    // Xoá tab Shorts khỏi Bottom Bar
    const pivotTabs = document.querySelectorAll('ytm-pivot-bar-item-renderer');
    pivotTabs.forEach((tab) => {
      const text = tab.textContent || '';
      const aria = tab.getAttribute('aria-label') || '';
      const href = tab.querySelector('a')?.getAttribute('href') || '';
      if (text.includes('Shorts') || aria.includes('Shorts') || href.includes('/shorts')) {
        tab.style.display = 'none';
        tab.remove();
      }
    });

    // TUYỆT ĐỐI KHÔNG xoá kệ khi ở trong Hồ sơ (để bảo vệ phần Recent / Lịch sử xem video)
    if (location.pathname.startsWith('/feed/you') || location.pathname.startsWith('/feed/library') || location.pathname.startsWith('/feed/history')) {
      return;
    }

    // Xoá kệ Shorts chuyên biệt trên trang chủ
    const shelves = document.querySelectorAll('ytm-reel-shelf-renderer, ytm-rich-section-renderer');
    shelves.forEach((el) => {
      if (el.tagName.toLowerCase() === 'ytm-reel-shelf-renderer') {
        el.style.display = 'none';
        el.remove();
        return;
      }
      const hasReel = el.querySelector('ytm-reel-item-renderer, [aria-label*="Shorts"], [aria-label*="shorts"]');
      const hasWatchVideo = el.querySelector('a[href*="/watch?v="]');
      if (hasReel && !hasWatchVideo) {
        el.style.display = 'none';
        el.remove();
      }
    });
  };

  const run = () => { replaceLogoWithAether(); cleanProfileMenu(); removeShortsElements(); };
  AE.on('refresh', run);
  AE.on('browse', run);
  AE.on('watch', removeShortsElements);
})();
