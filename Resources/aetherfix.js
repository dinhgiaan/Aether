// Aether – vá hiển thị (document-start, chỉ main frame của youtube.com)
// Việc 1: nền tối ngay khung hình đầu → hết nháy trắng
// Việc 2: gắn class ae-watching ngay khi <body> vừa tạo → player ghim đúng chỗ từ đầu, không bị "nhảy" layout
// Việc 3: báo Swift khi feed trang chủ đã có nội dung (aetherFeedReady) → splash tắt đúng lúc
// Việc 4: báo Swift khi trang /watch đã ổn định layout (watchReady) → gỡ lớp phủ loading mà không bị giật
(() => {
    'use strict';
    if (window.__aeFix) return;
    if (!/(^|\.)youtube\.com$/.test(location.hostname)) return;
    window.__aeFix = true;

    const post = (name, body) => {
        try { window.webkit.messageHandlers[name].postMessage(body); } catch (_) { }
    };
    const isWatch = () => location.pathname.startsWith('/watch');

    // Ở document-start <html>/<body> có thể chưa tồn tại → đợi chúng xuất hiện
    const waitFor = (get, cb) => {
        const first = get();
        if (first) { cb(first); return; }
        const mo = new MutationObserver(() => {
            const el = get();
            if (el) { mo.disconnect(); cb(el); }
        });
        mo.observe(document, { childList: true, subtree: true });
    };

    // ── 1. Nền tối ngay từ đầu ────────────────────────────────────────────────
    waitFor(() => document.documentElement, (root) => {
        const s = document.createElement('style');
        s.id = 'ae-fix-bg';
        s.textContent =
            'html,body{background:#0f0f0f!important}' +
            // Đang kéo video xuống (class do uienhance.js gắn): nền trong suốt + ẩn mọi thứ trừ player → lộ trang chủ phía sau
            'html.ae-drag,html.ae-drag body{background:transparent!important}' +
            'html.ae-drag body{visibility:hidden!important}' +
            'html.ae-drag .ae-drag-keep,html.ae-drag .ae-drag-keep *{visibility:visible!important}';
        root.appendChild(s);
    });

    // ── 2. ae-watching sớm (adblock.js chỉ gắn được ở DOMContentLoaded khi mở thẳng /watch) ──
    waitFor(() => document.body, (b) => {
        b.classList.toggle('ae-watching', isWatch());
    });

    // ── 3. Feed trang chủ đã có nội dung ──────────────────────────────────────
    if (!isWatch()) {
        const FEED_SEL = 'ytm-rich-item-renderer, ytm-media-item, ytm-video-with-context-renderer, ytm-compact-video-renderer';
        let done = false, queued = false, mo = null;
        const finish = () => {
            if (done) return;
            done = true;
            if (mo) mo.disconnect();
            // Chờ 2 khung hình để nội dung kịp vẽ rồi mới báo
            requestAnimationFrame(() => requestAnimationFrame(() => post('aetherFeedReady', 'ready')));
        };
        const check = () => { queued = false; if (!done && document.querySelector(FEED_SEL)) finish(); };
        waitFor(() => document.documentElement, (root) => {
            if (document.querySelector(FEED_SEL)) { finish(); return; }
            mo = new MutationObserver(() => {
                if (!queued && !done) { queued = true; requestAnimationFrame(check); }
            });
            mo.observe(root, { childList: true, subtree: true });
            setTimeout(() => { if (mo) mo.disconnect(); }, 8000);   // không giữ observer mãi nếu trang không có feed
        });
    }

    // ── 4. Trang /watch đã ổn định layout ─────────────────────────────────────
    // Mốc = tiêu đề/kênh của video (cùng mốc mà ensurePlayerSpacer trong uienhance.js dùng).
    // Root cause "video đã phát mà vẫn còn vòng loading": trước đây chỉ gỡ cover khi mốc đứng yên ≥ 450ms, mà mốc hay
    // dịch chuyển lâu hơn video bắt đầu phát. Giờ video đã phát là gỡ ngay sau tối đa 450ms (hoặc 200ms nếu layout đã yên).
    if (isWatch()) {
        const PROBE = 'h1.slim-video-metadata-title, .slim-video-metadata-title, .ytm-slim-video-information-title, ytm-slim-video-metadata-section-renderer, ytm-slim-video-information-renderer, ytm-slim-owner-renderer, .slim-owner-channel-name';
        const t0 = performance.now();
        let lastTop = NaN, stableSince = 0, playingAt = 0, done = false;
        const finish = () => {
            if (done) return;
            done = true;
            post('aetherNav', { action: 'watchReady' });
        };
        const isPlaying = () => {
            const v = document.querySelector('#player-container-id video, .html5-video-player video, video');
            return !!v && !v.paused && v.readyState >= 3 && v.currentTime > 0.05;
        };
        const step = (now) => {
            if (done) return;
            let stable = 0;
            const probe = document.querySelector(PROBE);
            if (probe) {
                const top = Math.round(probe.getBoundingClientRect().top);
                if (top !== lastTop) { lastTop = top; stableSince = now; }
                stable = now - stableSince;
            }
            if (!playingAt && isPlaying()) playingAt = now;
            if (playingAt && (stable >= 200 || now - playingAt >= 450)) { finish(); return; }   // video đã phát → gỡ cover
            if (stable >= 600) { finish(); return; }          // video không tự phát (autoplay bị chặn): layout yên là đủ
            if (now - t0 > 4000) { finish(); return; }        // bảo hiểm: không để cover treo
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
})();