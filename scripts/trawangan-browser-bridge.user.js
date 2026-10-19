// ==UserScript==
// @name         Trawangan Chart Deep Link Bridge
// @namespace    https://trawangan.app/
// @version      1.1.0
// @description  Otomatis mengalihkan grafik TradingView ke terminal desktop Trawangan
// @author       trawangan
// @match        https://*.tradingview.com/chart/*
// @match        https://*.tradingview.com/symbols/*
// @match        https://tradingview.com/chart/*
// @match        https://tradingview.com/symbols/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function extractSymbol(rawHref) {
    try {
      const url = new URL(rawHref);
      // 1. Cek query param ?symbol=
      let symbol = url.searchParams.get('symbol');
      if (symbol) return decodeURIComponent(symbol);

      // 2. Regex fallback jika searchParams belum terurai
      const match = rawHref.match(/[?&]symbol=([^&#]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);

      // 3. Cek path /symbols/
      if (url.pathname.includes('/symbols/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('symbols');
        if (idx !== -1 && parts[idx + 1]) {
          return parts[idx + 1].replace('-', ':');
        }
      }
    } catch (_) {}
    return null;
  }

  function launchTrawangan(symbol) {
    if (!symbol) return;
    const nativeUrl = 'trawangan://chart?symbol=' + encodeURIComponent(symbol);
    console.log('[Trawangan Bridge] Meluncurkan terminal Trawangan:', nativeUrl);

    // 1. Metode Anchor Click (paling disukai browser modern)
    try {
      const a = document.createElement('a');
      a.href = nativeUrl;
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(function () {
        try { a.remove(); } catch (_) {}
      }, 1000);
    } catch (_) {}

    // 2. Metode Window Location Assign
    try {
      window.location.assign(nativeUrl);
    } catch (_) {}

    // 3. Fallback salin ke clipboard agar Smart Clipboard Watcher Trawangan menangkapnya
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href);
      }
    } catch (_) {}
  }

  function renderFloatingBanner(symbol) {
    if (document.getElementById('trawangan-bridge-banner')) return;
    const nativeUrl = 'trawangan://chart?symbol=' + encodeURIComponent(symbol);

    const banner = document.createElement('div');
    banner.id = 'trawangan-bridge-banner';
    banner.style.cssText =
      'position: fixed; top: 12px; right: 16px; z-index: 999999999; ' +
      'background: #11141a; border: 1px solid #2962ff; border-left: 4px solid #00f090; ' +
      'color: #ffffff; padding: 10px 14px; border-radius: 6px; ' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ' +
      'font-size: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.85); ' +
      'display: flex; align-items: center; gap: 10px; animation: slideDown 0.2s ease-out;';

    banner.innerHTML =
      '<div style="display: flex; flex-direction: column; gap: 2px;">' +
      '  <span style="font-weight: 700; color: #00f090; font-size: 11px; text-transform: uppercase;">🚀 Trawangan Terminal</span>' +
      '  <span style="color: #cbd5e1; font-size: 12px;">Buka <strong>' + symbol + '</strong> di aplikasi desktop?</span>' +
      '</div>' +
      '<a href="' + nativeUrl + '" style="background: #2962ff; color: #ffffff; text-decoration: none; padding: 5px 12px; border-radius: 4px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s ease;">' +
      '  Buka di Trawangan' +
      '</a>' +
      '<button id="trawangan-close-banner" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 4px; border-radius: 3px;">✕</button>';

    (document.body || document.documentElement).appendChild(banner);

    const closeBtn = document.getElementById('trawangan-close-banner');
    if (closeBtn) {
      closeBtn.onclick = function () {
        banner.remove();
      };
    }
  }

  function handleInterception() {
    const symbol = extractSymbol(window.location.href);
    if (!symbol) return;

    // Trigger peluncuran protokol trawangan://
    launchTrawangan(symbol);

    // Tampilkan banner interaktif jika DOM sudah siap
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        renderFloatingBanner(symbol);
      });
    } else {
      renderFloatingBanner(symbol);
    }
  }

  // Jalankan segera
  handleInterception();

  // Dengarkan navigasi SPA (TradingView chart symbol switch)
  window.addEventListener('popstate', handleInterception);
  let lastUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      handleInterception();
    }
  }, 1000);
})();
