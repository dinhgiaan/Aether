// Aether UI – animation ở trang xem video: xem trả lời bình luận, panel hàng đợi Mix
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  // ── 5d. Animation mượt khi mở "xem trả lời" bình luận ──────────────────────────────────────────
  // CSS keyframes không làm nội dung bên dưới trượt theo → vẫn thấy "giật cục". Animate chiều cao thật bằng WAAPI.
  const animateReveal = (el, delay) => {
    if (!el || el.__aeRevealed || typeof el.animate !== 'function') return;
    el.__aeRevealed = true;
    const h = el.getBoundingClientRect().height;
    if (h < 8) return;
    el.style.overflow = 'hidden';
    const anim = el.animate(
      [
        { height: '0px', opacity: 0, transform: 'translateY(-8px)' },
        { height: h + 'px', opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 300, delay: delay || 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
    );
    const done = () => { el.style.overflow = ''; };
    anim.onfinish = done; anim.oncancel = done;
  };

  const REPLY_SEL = 'ytm-comment-replies-renderer ytm-comment-renderer, ytm-comment-replies-renderer .comment-reply, .comment-replies-renderer ytm-comment-renderer';
  const observeReplies = () => {
    if (!document.body) return;
    new MutationObserver((muts) => {
      if (!location.pathname.startsWith('/watch')) return;
      let i = 0;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          // Chỉ animate phần tử TRẢ LỜI mới thêm vào (bình luận gốc và panel giữ nguyên hành vi của YouTube)
          if (n.matches?.(REPLY_SEL)) animateReveal(n, Math.min(i++, 6) * 40);
          else if (n.matches?.('ytm-comment-replies-renderer, .comment-replies-renderer')) animateReveal(n, 0);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  };

  // ── 5f. Animation mở/đóng panel hàng đợi Mix ─────────────────────────────────────────────────────
  // Chỉ dùng WAAPI trên thuộc tính `translate`/`opacity` (KHÔNG fill, KHÔNG đổi transform/transition của YouTube) nên
  // không phá cơ chế đóng/mở riêng của panel như animation CSS ép cứng trước đây.
  // Mở: phần tử panel xuất hiện → trượt lên + hiện dần. Đóng: panel biến mất → dựng bản sao tĩnh trượt xuống + mờ dần.
  const ensurePanelAnimator = (() => {
    let host = null, mo = null, prev = [], snaps = [], raf = 0, snapTimer = 0;
    const HOST_SEL = 'ytm-playlist-engagement-panel';
    const OUT_MS = 230, IN_MS = 300;
    // Phần tử "panel" đang hiển thị trong host: cao > 150px, rộng gần hết màn hình, loại thẻ thu gọn + lớp nền của nó
    const visiblePanels = () => {
      const out = [];
      for (const el of host.querySelectorAll('*')) {
        if (el.closest('ytm-playlist-panel-entry-point') || el.classList.contains('playlist-entrypoint-background-protection')) continue;
        if (out.some((o) => o.contains(el))) continue;                        // chỉ lấy phần tử ngoài cùng
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.height > 150 && r.width > window.innerWidth * 0.8) out.push(el);
      }
      return out;
    };
    const isScrim = (el) => el.getBoundingClientRect().height >= window.innerHeight * 0.9 && !el.querySelector('ytm-playlist-panel-renderer, ytm-engagement-panel-section-list-renderer');
    const animateIn = (el) => {
      if (typeof el.animate !== 'function') return;
      const frames = isScrim(el) ? [{ opacity: 0 }, { opacity: 1 }] : [{ translate: '0 36px', opacity: 0 }, { translate: '0 0', opacity: 1 }];
      el.animate(frames, { duration: IN_MS, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
    const takeSnapshots = (els) => {
      snaps = els.map((el) => ({ parent: el.parentNode, clone: el.cloneNode(true), scrim: isScrim(el) }));
    };
    const animateOut = () => {
      const list = snaps; snaps = [];
      list.forEach(({ parent, clone, scrim }) => {
        if (!parent || !parent.isConnected || typeof clone.animate !== 'function') return;
        clone.style.pointerEvents = 'none';
        clone.removeAttribute('id');
        parent.appendChild(clone);
        const frames = scrim ? [{ opacity: 1 }, { opacity: 0 }] : [{ translate: '0 0', opacity: 1 }, { translate: '0 36px', opacity: 0 }];
        const a = clone.animate(frames, { duration: OUT_MS, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        const done = () => clone.remove();
        a.onfinish = done; a.oncancel = done;
        setTimeout(done, OUT_MS + 200);
      });
    };
    const check = () => {
      raf = 0;
      if (!host || !host.isConnected) return;
      const now = visiblePanels();
      if (!prev.length && now.length) {                         // vừa mở
        now.forEach(animateIn);
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => { const cur = visiblePanels(); if (cur.length) takeSnapshots(cur); }, IN_MS + 80);
      } else if (prev.length && !now.length) {                  // vừa đóng
        clearTimeout(snapTimer);
        animateOut();
      }
      prev = now;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    return () => {
      if (!location.pathname.startsWith('/watch')) { host = null; prev = []; snaps = []; if (mo) { mo.disconnect(); mo = null; } return; }
      const h = document.querySelector(HOST_SEL);
      if (!h || h === host) return;
      host = h; snaps = [];
      prev = visiblePanels();                                  // trạng thái ban đầu: không animate
      if (prev.length) takeSnapshots(prev);
      if (mo) mo.disconnect();
      mo = new MutationObserver(schedule);
      mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'opened', 'expanded'] });
    };
  })();

  AE.on('ready', () => {
    ensurePanelAnimator();
    window.addEventListener('ae:navigate', () => setTimeout(ensurePanelAnimator, 400));
    observeReplies();
  });
  AE.on('watch', ensurePanelAnimator);
})();
