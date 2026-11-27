// Aether UI – boot: nối sự kiện điều hướng + MutationObserver với hook của các module. PHẢI nạp cuối cùng.
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE || AE.booted) return;
  AE.booted = true;

  const start = () => {
    AE.ensureCSS();

    ['popstate', 'hashchange', 'ae:navigate'].forEach((ev) =>
      window.addEventListener(ev, () => AE.run('refresh')));

    try { window.webkit?.messageHandlers?.aetherReady?.postMessage('ready'); } catch (_) { }

    AE.run('refresh');
    AE.run('ready');

    // MutationObserver: khi đang xem video YouTube đổi DOM liên tục (thanh tiến trình, bình luận…).
    // Trên /watch chỉ chạy việc nhẹ, tối đa ~4 lần/giây; ngoài /watch vẫn đủ nhanh (1 lần/frame).
    let scheduled = false, last = 0;
    const flush = () => {
      scheduled = false; last = Date.now();
      AE.run(AE.isWatching() ? 'watch' : 'browse');
    };
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      const wait = Math.max(0, (AE.isWatching() ? 250 : 300) - (Date.now() - last));
      if (wait > 0) setTimeout(flush, wait);
      else window.requestAnimationFrame(flush);
    }).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
