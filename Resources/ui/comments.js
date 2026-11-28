// Aether UI – bảng bình luận gọn + đẹp hơn. Selector lấy từ DOM dump thật của m.youtube.com (panel comments):
//   ytm-engagement-panel-section-list-renderer.engagement-panel-comments-section
//     ytm-comments-header-renderer (ô "Add a comment…") · ytm-comment-thread-renderer (mỗi luồng)
//       ytm-comment-renderer > a.YtmCommentRendererIconContainer (avatar) + button.YtmCommentRendererContent
//       ytm-comment-replies-renderer > … button "Show more replies"
// Thu nhỏ bằng CSS `zoom` trên từng luồng (co đều chữ, avatar, khoảng cách) rồi tinh chỉnh từng phần.
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  const ZOOM = 0.86;                 // tỉ lệ thu nhỏ toàn bộ luồng bình luận
  const AVATAR_PX = 36;              // avatar bình luận gốc (trước zoom) → hiển thị ≈ 31px
  const P = 'ytm-engagement-panel-section-list-renderer.engagement-panel-comments-section';

  AE.addCSS('comments', `
    /* ── Thu gọn: mỗi luồng + ô soạn bình luận ───────────────────────────── */
    ${P} ytm-comment-thread-renderer,
    ${P} ytm-comments-header-renderer { zoom: ${ZOOM}; }

    /* Avatar bình luận gốc nhỏ lại (avatar trả lời giữ nguyên cỡ riêng của YouTube) */
    ${P} ytm-comment-thread-renderer > ytm-comment-renderer a.YtmCommentRendererIconContainer,
    ${P} ytm-comment-thread-renderer > ytm-comment-renderer ytm-profile-icon.comment-icon,
    ${P} ytm-comment-thread-renderer > ytm-comment-renderer ytm-profile-icon.comment-icon img {
      width: ${AVATAR_PX}px !important; height: ${AVATAR_PX}px !important; border-radius: 50% !important;
    }
    ${P} ytm-comment-thread-renderer > ytm-comment-renderer a.YtmCommentRendererIconContainer { height: auto !important; }

    /* ── Tên kênh: màu xanh nhạt + đậm hơn ───────────────────────────────── */
    ${P} .YtmCommentRendererTitle,
    ${P} .YtmCommentRendererTitle .ytAttributedStringHost {
      color: #8ab4f8 !important; font-weight: 600 !important; letter-spacing: .1px;
    }

    /* ── Khoảng cách dọc: hàng like / dislike / reply sát nút "Show more replies" ───── */
    ${P} ytm-comment-replies-renderer { margin-top: -6px !important; }
    ${P} .YtmCommentRendererDetails { margin-bottom: 0 !important; }

    /* ── Nút "Show more replies": bo góc nhẹ + nền ──────────────────────────────── */
    ${P} ytm-comment-replies-renderer .YtmContinuationItemRendererHost,
    ${P} ytm-comment-replies-renderer ytm-button-renderer.YtmContinuationItemRendererButton { height: auto !important; min-height: 0 !important; }
    ${P} ytm-comment-replies-renderer ytm-button-renderer.YtmContinuationItemRendererButton button {
      height: 32px !important; min-height: 0 !important; min-width: 0 !important;
      margin-left: 0 !important;                 /* bỏ margin âm cũ để nền thẳng hàng với cột chữ */
      padding: 0 14px !important;
      border-radius: 10px !important;
      background: rgba(255, 255, 255, 0.10) !important;
    }
    ${P} ytm-comment-replies-renderer .ytSpecButtonShapeNextButtonTextContent {
      height: 32px !important; padding: 0 !important; display: flex; align-items: center;
    }
    ${P} ytm-comment-replies-renderer yt-touch-feedback-shape { border-radius: 10px !important; }

    /* ── Chưa có bình luận ──────────────────────────────────────────────── */
    #ae-no-comments { padding: 44px 24px 56px; text-align: center; color: #aaa; font: 500 14px/1.4 -apple-system, sans-serif; }
    #ae-no-comments b { display: block; color: #fff; font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  `);

  // ── "No comments yet" khi video chưa có bình luận ─────────────────────────
  // Tránh nháy nhãn lúc đang tải: chỉ hiện khi KHÔNG có luồng nào, KHÔNG có vòng tải, có ô "Add a comment…"
  // (video tắt bình luận không có ô này → YouTube tự báo "Comments are turned off", ta không chen vào) và trạng thái đó đã ổn định.
  let emptySince = 0, recheck = 0;
  const syncEmpty = () => {
    const label = document.getElementById('ae-no-comments');
    const reset = () => { if (label) label.remove(); emptySince = 0; };
    const panel = document.querySelector(P);
    if (!panel || panel.getBoundingClientRect().height < 100) return reset();

    const section = panel.querySelector('ytm-item-section-renderer');
    const hasThreads = !!panel.querySelector('ytm-comment-thread-renderer');
    const hasBox = !!panel.querySelector('ytm-comment-simplebox-renderer');
    const loading = !!(section && section.querySelector('ytm-continuation-item-renderer, ytm-spinner, .spinner'));
    const countEl = panel.querySelector('.engagement-panel-section-list-header-context');
    const count = countEl ? (countEl.textContent || '').trim() : '';
    if (!section || !hasBox || hasThreads || loading || (count && count !== '0')) return reset();

    if (label && label.isConnected) return;
    const waitMs = count === '0' ? 600 : 2500;          // có số "0" thì chắc chắn; không có số thì chờ lâu hơn cho an toàn
    if (!emptySince) emptySince = Date.now();
    const left = waitMs - (Date.now() - emptySince);
    if (left > 0) {
      clearTimeout(recheck);
      recheck = setTimeout(syncEmpty, left + 50);
      return;
    }
    const el = document.createElement('div');
    el.id = 'ae-no-comments';
    el.innerHTML = '<b>No comments yet</b>Be the first to comment.';
    section.appendChild(el);
  };

  AE.on('watch', syncEmpty);
  AE.on('refresh', () => { const l = document.getElementById('ae-no-comments'); if (l) l.remove(); emptySince = 0; });
})();
