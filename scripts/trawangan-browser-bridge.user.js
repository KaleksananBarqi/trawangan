// ==UserScript==
// @name         Trawangan Chart Deep Link Bridge
// @namespace    https://trawangan.app/
// @version      1.0.0
// @description  Secara otomatis mengalihkan tautan chart TradingView ke terminal desktop Trawangan
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

  function redirectIfMatching() {
    try {
      const url = new URL(window.location.href);

      // 1. Pola Halaman Chart TradingView: /chart/?symbol=BINANCE:ARIAUSDT.P
      if (url.pathname.startsWith('/chart')) {
        const symbol = url.searchParams.get('symbol');
        if (symbol) {
          const nativeUrl = `trawangan://chart?symbol=${encodeURIComponent(symbol)}`;
          console.log('[Trawangan Bridge] Mengalihkan ke terminal Trawangan:', nativeUrl);
          window.location.href = nativeUrl;
        }
      }
      // 2. Pola Halaman Profil Koin TradingView: /symbols/BTCUSDT/ atau /symbols/BINANCE-BTCUSDT/
      else if (url.pathname.includes('/symbols/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('symbols');
        if (idx !== -1 && parts[idx + 1]) {
          const symSeg = parts[idx + 1].replace('-', ':');
          const nativeUrl = `trawangan://chart?symbol=${encodeURIComponent(symSeg)}`;
          console.log('[Trawangan Bridge] Mengalihkan ke terminal Trawangan:', nativeUrl);
          window.location.href = nativeUrl;
        }
      }
    } catch (e) {
      console.warn('[Trawangan Bridge] Error pengalihan URL:', e);
    }
  }

  // Jalankan segera saat script dieksekusi
  redirectIfMatching();

  // Dengarkan juga perubahan pushState / popstate pada Single-Page App TradingView
  window.addEventListener('popstate', redirectIfMatching);
})();
