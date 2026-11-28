// Aether UI – gỡ lỗi: giữ 3 ngón tay ~0.7s → copy sơ đồ DOM
(() => {
  'use strict';
  const AE = window.AE;
  if (!AE) return;

  // ── 5e. Gỡ lỗi: giữ 3 ngón tay ~0.7s trên trang → copy sơ đồ DOM vào clipboard để dán gửi lập trình viên ──
  const dumpDom = () => {
    const out = [];
    // Đang mở panel (bình luận, hàng đợi…): chỉ dump riêng panel đó, sâu hơn + kèm cỡ chữ / kích thước ảnh (tránh bị player + thumbnail ăn hết dung lượng)
    const panelEl = [...document.querySelectorAll('ytm-engagement-panel-section-list-renderer')].find((e) => e.getBoundingClientRect().height > 100);
    const SKIP = panelEl ? /^(SCRIPT|STYLE|SVG|PATH|LINK|META|NOSCRIPT|YT-ICON|C3-ICON)$/i : /^(SCRIPT|STYLE|SVG|PATH|LINK|META|NOSCRIPT|IMG|YT-ICON|C3-ICON)$/i;
    const maxDepth = panelEl ? 18 : 11;
    const walk = (el, depth) => {
      if (SKIP.test(el.tagName) || depth > maxDepth) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      let line = '  '.repeat(depth) + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
      line += ' [' + Math.round(r.top + window.scrollY) + ',' + Math.round(r.height) + ']';
      if (cs.position !== 'static') line += ' pos:' + cs.position;
      if (parseFloat(cs.paddingTop) > 0) line += ' pt:' + Math.round(parseFloat(cs.paddingTop));
      if (/^(H1|H2)$/.test(el.tagName)) line += ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
      if (panelEl) {
        line += ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
        if (el.tagName === 'IMG') line += ' img';
        const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
        if (own) line += ' fs:' + cs.fontSize + ' "' + [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue.trim()).join(' ').slice(0, 14) + '"';
        if (cs.display === 'flex') line += ' flex gap:' + cs.gap;
        const mp = [['mt', 'marginTop'], ['mb', 'marginBottom'], ['ml', 'marginLeft'], ['pt', 'paddingTop'], ['pb', 'paddingBottom'], ['pl', 'paddingLeft']].map(([n, k]) => [n, Math.round(parseFloat(cs[k]) || 0)]).filter((x) => x[1]);
        if (mp.length) line += ' ' + mp.map((x) => x.join(':')).join(',');
      }
      out.push(line);
      let n = 0;
      const cap = panelEl ? 5 : (/^(LAZY-LIST|YTM-SECTION-LIST-RENDERER)$/.test(el.tagName) ? 3 : 14);
      for (const c of el.children) { if (n++ >= cap) { out.push('  '.repeat(depth + 1) + '…'); break; } walk(c, depth + 1); }
    };
    const head = 'Aether DOM dump | ' + location.pathname + location.search.slice(0, 40) + ' | win ' + innerWidth + 'x' + innerHeight +
      ' | scrollY ' + Math.round(scrollY) + ' | body.class=' + document.body.className + ' | --ae-pad: ' +
      [...document.querySelectorAll('[style*="padding-top"]')].map((e) => e.tagName.toLowerCase() + ':' + e.style.paddingTop).join(',');
    walk(panelEl || document.body, 0);
    if (panelEl) return head + '\n== PANEL ' + panelEl.tagName.toLowerCase() + '.' + String(panelEl.className).trim().split(/\s+/).join('.') + ' ==\n' + out.join('\n').slice(0, 20000);
    // Các lớp phủ lớn (bottom sheet, panel, dialog): position fixed/absolute chiếm > 20% màn hình, kèm chuỗi tổ tiên
    const ov = [];
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (ov.length >= 40) break;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || (cs.position !== 'fixed' && cs.position !== 'absolute')) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < vw * vh * 0.2 || r.width < 100) continue;
      const nm = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      const chain = []; for (let n = el.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) chain.push(nm(n));
      ov.push(nm(el) + ' rect[x' + Math.round(r.left) + ' y' + Math.round(r.top) + ' w' + Math.round(r.width) + ' h' + Math.round(r.height) + '] ' +
        cs.position + ' z:' + cs.zIndex + ' tf:' + (cs.transform === 'none' ? '-' : 'y') + ' vis:' + cs.visibility + ' op:' + cs.opacity + ' <- ' + chain.join(' < '));
    }
    let text = head + '\n== OVERLAYS ==\n' + (ov.join('\n') || '(none)') + '\n== TREE ==\n' + out.join('\n');
    if (text.length > 16000) text = text.slice(0, 16000) + '\n…(cắt bớt)';
    return text;
  };
  (() => {
    let timer = 0;
    window.addEventListener('touchstart', (e) => {
      clearTimeout(timer);
      if (e.touches.length !== 3) return;
      timer = setTimeout(() => {
        try {
          const text = dumpDom();
          window.webkit.messageHandlers.aetherNav.postMessage({ action: 'debugDump', text });
        } catch (_) { }
      }, 700);
    }, { passive: true, capture: true });
    const stop = () => clearTimeout(timer);
    window.addEventListener('touchend', stop, { passive: true, capture: true });
    window.addEventListener('touchcancel', stop, { passive: true, capture: true });
  })();
})();
