// Aether UI – core: namespace chung `window.AE`, nạp CSS, đăng ký hook vòng đời cho các module.
// Thứ tự nạp (xem WebController.uiScripts): core → branding → nav → search → watch → watch-fx → debug → boot
(() => {
  'use strict';
  if (window.AE) return;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return;
  window.__aeUI = true;   // giữ cờ cũ cho tương thích

  const styles = new Map();                                  // id → css
  const hooks = { ready: [], refresh: [], browse: [], watch: [] };

  const AE = window.AE = {
    /** Đăng ký CSS cho 1 module (tự chèn lại nếu YouTube làm mất thẻ <style>) */
    addCSS(id, css) { styles.set(id, css); AE.ensureCSS(); },
    ensureCSS() {
      const root = document.head || document.documentElement;
      if (!root) return;
      styles.forEach((css, id) => {
        const key = 'ae-css-' + id;
        let el = document.getElementById(key);
        if (!el) { el = document.createElement('style'); el.id = key; root.appendChild(el); }
        if (el.textContent !== css) el.textContent = css;
      });
    },
    /**
     * Đăng ký hook vòng đời:
     *  - ready   : 1 lần khi DOM sẵn sàng
     *  - refresh : khi điều hướng (popstate / hashchange / ae:navigate) và lúc khởi động
     *  - browse  : mỗi lần DOM đổi, NGOÀI trang /watch (đã throttle)
     *  - watch   : mỗi lần DOM đổi, TRONG trang /watch (nhẹ, ≤ ~4 lần/giây)
     */
    on(name, fn) { hooks[name].push(fn); },
    run(name) {
      hooks[name].forEach((fn) => { try { fn(); } catch (err) { console.warn('[Aether]', name, err); } });
    },
    isWatching: () => location.pathname.startsWith('/watch'),
    post(msg) { try { window.webkit.messageHandlers.aetherNav.postMessage(msg); } catch (_) { } },
  };

  document.addEventListener('DOMContentLoaded', AE.ensureCSS, { once: true });
})();
