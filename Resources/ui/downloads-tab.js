// Aether UI – tab "Đã tải" trong bottom bar (bấm → Swift mở thư viện offline)
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

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
      } catch (_) { }
    });

    // Chèn trước tab Hồ sơ
    // Dùng tab cuối thật sự, KHÔNG dùng lastElementChild: nav.js gắn thêm #ae-pill vào pivot nên lastElementChild có thể là pill
    const items = pivot.querySelectorAll(':scope > ytm-pivot-bar-item-renderer');
    const lastItem = items.length ? items[items.length - 1] : pivot.lastElementChild;
    if (lastItem) {
      pivot.insertBefore(tab, lastItem);
    } else {
      pivot.appendChild(tab);
    }
  };

  AE.on('refresh', injectDownloadsTab);
  AE.on('browse', injectDownloadsTab);
})();
