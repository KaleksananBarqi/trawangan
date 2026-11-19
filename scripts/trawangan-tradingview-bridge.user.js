// ==UserScript==
// @name         Trawangan TradingView Bridge
// @namespace    https://github.com/KaleksananBarqi/trawangan
// @version      1.0.0
// @description  Membuka tautan simbol TradingView langsung ke aplikasi desktop trawangan via local loopback bridge.
// @match        *://*.tradingview.com/chart/*
// @match        *://*.tradingview.com/symbols/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BRIDGE_OPEN_URL = 'http://127.0.0.1:47831/open';
  const TIMEOUT_MS = 600;

  const currentUrl = new URL(window.location.href);
  if (
    currentUrl.searchParams.get('notrawangan') === '1' ||
    currentUrl.searchParams.get('web') === '1'
  ) {
    return;
  }

  const hasSymbolQuery = Boolean(currentUrl.searchParams.get('symbol'));
  const hasSymbolPath = /^\/symbols\/[^/]+/i.test(currentUrl.pathname);
  if (!hasSymbolQuery && !hasSymbolPath) {
    return;
  }

  function buildWebBypassUrl() {
    const bypassUrl = new URL(window.location.href);
    bypassUrl.searchParams.set('notrawangan', '1');
    return bypassUrl.toString();
  }

  function renderRedirectedFallback() {
    const bypassHref = buildWebBypassUrl();
    const render = () => {
      if (!document.documentElement) return;
      document.documentElement.innerHTML = [
        '<head><meta charset="utf-8"><title>Opened in trawangan</title></head>',
        '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif;">',
        '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:24px;">',
        '<div style="font-size:15px;font-weight:600;">Opened in trawangan</div>',
        '<a href="' + bypassHref + '" style="color:#58a6ff;font-size:13px;text-decoration:none;border:1px solid #30363d;padding:8px 14px;border-radius:6px;background:#161b22;">Tetap buka di TradingView Web (?notrawangan=1)</a>',
        '</div>',
        '</body>',
      ].join('');
    };

    if (document.body) {
      render();
    } else {
      document.addEventListener('DOMContentLoaded', render, { once: true });
    }
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  fetch(`${BRIDGE_OPEN_URL}?url=${encodeURIComponent(window.location.href)}`, {
    method: 'GET',
    mode: 'cors',
    signal: controller.signal,
  })
    .then((res) => {
      window.clearTimeout(timer);
      if (!res.ok) return;

      try {
        window.stop();
      } catch {
        // Abaikan jika browser membatasi window.stop() sebelum dokumen siap
      }

      try {
        window.close();
      } catch {
        // Browser modern menolak window.close() untuk tab yang tidak dibuka via window.open()
      }

      window.setTimeout(() => {
        if (!window.closed) {
          if (window.history.length > 1) {
            window.history.back();
          }
          renderRedirectedFallback();
        }
      }, 80);
    })
    .catch(() => {
      window.clearTimeout(timer);
      // Biarkan halaman TradingView terbuka normal saat aplikasi trawangan tidak aktif
    });
})();
