// Aether UI – branding: logo YouTube ở header, dọn rác (Shorts, mục thừa ở Hồ sơ)
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  // Logo YouTube (SVG, wordmark trắng cho nền tối) nhúng dạng data URI: không cần mạng, không bị CSP chặn.
  // Nguồn: Design/logo-in-app.svg (wordmark gốc #282828 dành cho nền sáng → đổi sang #fff).
  const YT_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0ODkuNSIgaGVpZ2h0PSIxMTAuNSIgdmlld0JveD0iMS4yNSAtMC4yNSA0ODkuNSAxMTAuNSI+PHBhdGggZD0iTTE1NC4zIDE3LjVjLTEuOC02LjctNy4xLTEyLTEzLjgtMTMuOEMxMjguNC40IDc5LjcuNCA3OS43LjRTMzEgLjUgMTguOSAzLjhjLTYuNyAxLjgtMTIgNy4xLTEzLjggMTMuOEMxLjkgMjkuNyAxLjkgNTUgMS45IDU1czAgMjUuMyAzLjMgMzcuNWMxLjggNi43IDcuMSAxMiAxMy44IDEzLjggMTIuMSAzLjMgNjAuOCAzLjMgNjAuOCAzLjNzNDguNyAwIDYwLjgtMy4zYzYuNy0xLjggMTItNy4xIDEzLjgtMTMuOCAzLjMtMTIuMSAzLjMtMzcuNSAzLjMtMzcuNXMtLjEtMjUuMy0zLjQtMzcuNXoiIGZpbGw9InJlZCIvPjxwYXRoIGQ9Ik0xMDQuNiA1NUw2NC4yIDMxLjZ2NDYuOHoiIGZpbGw9IiNmZmYiLz48ZyBmaWxsPSIjZmZmIj48cGF0aCBkPSJNMjI3LjkgOTkuN2MtMy4xLTIuMS01LjMtNS4zLTYuNi05LjdzLTEuOS0xMC4yLTEuOS0xNy41di05LjljMC03LjMuNy0xMy4zIDIuMi0xNy43IDEuNS00LjUgMy44LTcuNyA3LTkuN3M3LjMtMy4xIDEyLjQtMy4xYzUgMCA5LjEgMSAxMi4xIDMuMXM1LjMgNS4zIDYuNyA5LjcgMi4xIDEwLjMgMi4xIDE3LjZ2OS45YzAgNy4zLS43IDEzLjEtMi4xIDE3LjVzLTMuNiA3LjYtNi43IDkuN2MtMy4xIDItNy4zIDMuMS0xMi41IDMuMS01LjQuMS05LjYtMS0xMi43LTN6TTI0NS4yIDg5Yy45LTIuMiAxLjMtNS45IDEuMy0xMC45VjU2LjhjMC00LjktLjQtOC41LTEuMy0xMC43LS45LTIuMy0yLjQtMy40LTQuNS0zLjRzLTMuNSAxLjEtNC40IDMuNC0xLjMgNS44LTEuMyAxMC43djIxLjNjMCA1IC40IDguNyAxLjIgMTAuOXMyLjMgMy4zIDQuNSAzLjNjMi4xIDAgMy42LTEuMSA0LjUtMy4zem0yMTkuMi0xNi4zdjMuNWwuNCA5LjljLjMgMi4yLjggMy44IDEuNiA0LjhzMi4xIDEuNSAzLjggMS41YzIuMyAwIDMuOS0uOSA0LjctMi43LjktMS44IDEuMy00LjggMS40LTguOWwxMy4zLjhjLjEuNi4xIDEuNC4xIDIuNCAwIDYuMy0xLjcgMTEtNS4yIDE0LjFzLTguMyA0LjctMTQuNiA0LjdjLTcuNiAwLTEyLjktMi40LTE1LjktNy4xcy00LjYtMTIuMS00LjYtMjJWNjEuNmMwLTEwLjIgMS42LTE3LjcgNC43LTIyLjQgMy4yLTQuNyA4LjYtNy4xIDE2LjItNy4xIDUuMyAwIDkuMyAxIDEyLjEgMi45czQuOCA0LjkgNiA5IDEuNyA5LjcgMS43IDE2Ljl2MTEuN2gtMjUuN3ptMi0yOC44Yy0uOCAxLTEuMyAyLjUtMS42IDQuN3MtLjQgNS41LS40IDEwdjQuOWgxMS4ydi00LjljMC00LjQtLjEtNy43LS40LTEwcy0uOC0zLjktMS42LTQuOC0yLTEuNC0zLjYtMS40Yy0xLjcuMS0yLjkuNi0zLjYgMS41ek0xOTAuNSA3MS40TDE3MyA4LjJoMTUuM2w2LjEgMjguNmMxLjYgNy4xIDIuNyAxMy4xIDMuNSAxOGguNGMuNS0zLjYgMS43LTkuNSAzLjUtMTcuOWw2LjMtMjguN2gxNS4zbC0xNy43IDYzLjF2MzAuM2gtMTUuMVY3MS40eiIvPjxwYXRoIGQ9Ik0zMTEuNSAzMy40djY4LjNoLTEybC0xLjMtOC40aC0uM2MtMy4zIDYuMy04LjIgOS41LTE0LjcgOS41LTQuNSAwLTcuOS0xLjUtMTAtNC41LTIuMi0zLTMuMi03LjYtMy4yLTEzLjl2LTUxaDE1LjR2NTAuMWMwIDMgLjMgNS4yIDEgNi41czEuOCAxLjkgMy4zIDEuOWMxLjMgMCAyLjYtLjQgMy44LTEuMnMyLjEtMS45IDIuNy0zLjFWMzMuNHoiLz48cGF0aCB0cmFuc2Zvcm09InRyYW5zbGF0ZSg3OC45KSIgZD0iTTMxMS41IDMzLjR2NjguM2gtMTJsLTEuMy04LjRoLS4zYy0zLjMgNi4zLTguMiA5LjUtMTQuNyA5LjUtNC41IDAtNy45LTEuNS0xMC00LjUtMi4yLTMtMy4yLTcuNi0zLjItMTMuOXYtNTFoMTUuNHY1MC4xYzAgMyAuMyA1LjIgMSA2LjVzMS44IDEuOSAzLjMgMS45YzEuMyAwIDIuNi0uNCAzLjgtMS4yczIuMS0xLjkgMi43LTMuMVYzMy40eiIvPjxwYXRoIGQ9Ik0zNTMuMyAyMC42SDMzOHY4MS4xaC0xNVYyMC42aC0xNS4zVjguMmg0NS41djEyLjR6bTg3LjkgMjMuN2MtLjktNC4zLTIuNC03LjQtNC41LTkuNC0yLjEtMS45LTQuOS0yLjktOC42LTIuOS0yLjggMC01LjUuOC03LjkgMi40LTIuNSAxLjYtNC4zIDMuNy01LjcgNi4zaC0uMXYtMzZoLTE0Ljh2OTYuOWgxMi43bDEuNi02LjVoLjNjMS4yIDIuMyAzIDQuMSA1LjMgNS41YTE2LjI2IDE2LjI2IDAgMCAwIDcuOSAyYzUuMiAwIDktMi40IDExLjUtNy4yIDIuNC00LjggMy43LTEyLjMgMy43LTIyLjRWNjIuMmMwLTcuNi0uNS0xMy42LTEuNC0xNy45em0tMTQuMSAyNy45YzAgNS0uMiA4LjktLjYgMTEuN3MtMS4xIDQuOC0yLjEgNi0yLjMgMS44LTMuOSAxLjhjLTEuMyAwLTIuNC0uMy0zLjUtLjlzLTEuOS0xLjUtMi42LTIuN1Y0OS4zYy41LTEuOSAxLjQtMy40IDIuNy00LjZzMi42LTEuOCA0LjEtMS44YzEuNiAwIDIuOC42IDMuNiAxLjguOSAxLjIgMS40IDMuMyAxLjggNi4yLjMgMi45LjUgNyAuNSAxMi40eiIvPjwvZz48L3N2Zz4=';

  // Selector logo YouTube trên header (search.js dùng lại để ẩn logo khi ở trang tìm kiếm)
  AE.LOGO_SEL = '.header-bar-logo, ytm-home-logo, .topbar-header-logo-icon, a.mobile-topbar-header-endpoint, .ytm-mobile-topbar-renderer-logo';

  AE.addCSS('branding', `
    /* Nền tối ngay từ document-start: tránh nháy trắng khi trang chưa vẽ xong (đặc biệt lúc kéo video lộ trang chủ).
       Khi kéo, ytfix.js đặt html.ae-drag { background: transparent !important } nên vẫn thắng quy tắc này. */
    html { background-color: #0f0f0f; }

    /* Chặn chọn chữ / menu "Copy · Look Up · Translate" của iOS khi chạm giữ hoặc chạm nhầm.
       Root cause lỗi trong ảnh: WKWebView cho chọn chữ trên toàn trang, nên 1 lần chạm giữ là kéo ra vùng chọn
       trải từ ô tìm kiếm tới thumbnail. Chỉ cho chọn trong ô nhập liệu để vẫn gõ/dán/sửa được. */
    html, body {
      -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none;
    }
    input, textarea, [contenteditable="true"], [contenteditable=""] {
      -webkit-user-select: text; user-select: text;
      -webkit-touch-callout: default;
    }

    /* Ẩn kệ Shorts */
    ytm-reel-shelf-renderer { display: none !important; }

    /* ── Header hiện đại & Logo có lề chuẩn ───────────────────────────────── */
    .mobile-topbar-header, ytm-mobile-topbar-renderer {
      background: rgba(12, 12, 15, 0.97) !important;
      border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
      padding-left: 0 !important;
    }

    /* Chỉ căn lề riêng cho logo YouTube ở trang chủ, KHÔNG làm lệch thanh tìm kiếm */
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

  // ── 2. Thay logo trên Header bằng logo YouTube chuẩn (giống app gốc, không thêm chữ) ────
  // Lý do vẫn "thay" thay vì dùng logo có sẵn của trang: search.js cần phần tử này để đổi sang nút Back
  // (lưu/khôi phục innerHTML), và kích thước/lề do ta kiểm soát nên luôn đúng như app gốc.
  const replaceHeaderLogo = () => {
    const logoTargets = document.querySelectorAll(
      AE.LOGO_SEL
    );
    logoTargets.forEach((el) => {
      if (el.dataset.aeLogo || el.dataset.aeMode === 'back') return;   // aeMode=back: search.js đang dùng phần tử này làm nút quay lại
      el.dataset.aeLogo = 'true';
      // Cao 20px × rộng ≈ 88.6px (đúng tỉ lệ 90×20 của app gốc); lề trái 10px cộng với margin-left 4px của CSS phía trên
      el.innerHTML = `
        <div style="display:flex;align-items:center;margin-left:10px;">
          <img alt="YouTube" src="${YT_LOGO}" style="width:88.6px;height:20px;display:block;flex:none;">
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

  const run = () => { replaceHeaderLogo(); cleanProfileMenu(); removeShortsElements(); };
  AE.on('refresh', run);
  AE.on('browse', run);
  AE.on('watch', removeShortsElements);
})();
