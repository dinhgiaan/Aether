// Aether UI – bảng bình luận gọn hơn: avatar nhỏ lại, chữ + khoảng cách thu ~14%.
// Không dựa vào tên class của YouTube (bình luận dùng view-model, tên đổi liên tục): nhận diện bằng ẢNH AVATAR
// (yt3.ggpht.com) bên trong panel bình luận, tìm danh sách chứa các bình luận rồi thu nhỏ từng luồng bình luận bằng CSS `zoom`
// (zoom co cả chữ, avatar, padding theo tỉ lệ nên giữ nguyên bố cục gốc của YouTube).
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  const ZOOM = 0.86;
  const AVATAR_PX = 36;                          // cạnh avatar bình luận gốc (trước zoom) → hiển thị ≈ 31px
  const PANEL = 'ytm-engagement-panel-section-list-renderer, ytm-comment-section-renderer';
  const AVATAR_RE = /yt3\.(ggpht|googleusercontent)\.com/;

  AE.addCSS('comments', `
    [data-ae-zoom] { zoom: ${ZOOM}; }
    [data-ae-zoom] img[data-ae-av], [data-ae-zoom] [data-ae-avbox] { border-radius: 50% !important; }
  `);

  const avatarImgs = () => {
    const sel = PANEL.split(',').map((s) => s.trim() + ' img').join(',');
    return [...document.querySelectorAll(sel)].filter((i) => AVATAR_RE.test(i.currentSrc || i.src || ''));
  };

  const lca = (a, b) => {
    const seen = new Set();
    for (let n = a; n; n = n.parentElement) seen.add(n);
    for (let n = b; n; n = n.parentElement) if (seen.has(n)) return n;
    return null;
  };

  // Tránh zoom nhầm vùng cuộn / vùng định vị cố định (zoom sẽ co cả khung → chừa khoảng trống)
  const isLayoutShell = (el) => {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowY) || cs.position === 'fixed' || cs.position === 'sticky';
  };

  const mark = (el, imgs, depth) => {
    if (!el || el.closest('[data-ae-zoom]')) return;
    if (isLayoutShell(el) && depth < 3) {
      [...el.children].forEach((c) => { if (imgs.some((i) => c.contains(i))) mark(c, imgs, depth + 1); });
      return;
    }
    el.setAttribute('data-ae-zoom', '');
  };

  // Thu nhỏ avatar + các khung bọc có cùng kích thước (YouTube bọc ảnh trong 2-3 lớp cố định px)
  const shrinkAvatar = (img) => {
    if (img.hasAttribute('data-ae-av')) return;
    const w0 = img.offsetWidth;
    if (w0 < 40) { img.setAttribute('data-ae-av', ''); return; }       // avatar trả lời vốn đã nhỏ: giữ nguyên
    let el = img;
    for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
      if (depth > 0 && Math.abs(el.offsetWidth - w0) > 3) break;
      el.style.setProperty('width', AVATAR_PX + 'px', 'important');
      el.style.setProperty('height', AVATAR_PX + 'px', 'important');
      el.style.setProperty('min-width', AVATAR_PX + 'px', 'important');
      el.style.setProperty('max-width', AVATAR_PX + 'px', 'important');
      if (depth > 0) el.setAttribute('data-ae-avbox', '');
    }
    img.setAttribute('data-ae-av', '');
  };

  let listEl = null;
  const apply = () => {
    if (!AE.isWatching()) return;
    const imgs = avatarImgs();
    if (imgs.length < 2) return;

    // Danh sách chứa các bình luận = tổ tiên chung của 2 avatar lớn đầu tiên (ô soạn bình luận + bình luận đầu)
    if (!listEl || !listEl.isConnected || !imgs.some((i) => listEl.contains(i))) {
      const big = imgs.filter((i) => i.offsetWidth >= 36 && !i.closest('[data-ae-zoom]')).slice(0, 2);
      if (big.length < 2) return;
      listEl = lca(big[0], big[1]);
    }
    if (!listEl) return;

    [...listEl.children].forEach((child) => {
      if (!child.hasAttribute('data-ae-zoom') && imgs.some((i) => child.contains(i))) mark(child, imgs, 0);
    });
    imgs.forEach((i) => { if (i.closest('[data-ae-zoom]')) shrinkAvatar(i); });
  };

  AE.on('watch', apply);
  AE.on('refresh', () => { listEl = null; });   // đổi video → tìm lại danh sách
})();
