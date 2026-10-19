<script lang="ts">
  import { Link2, Copy, Check, ExternalLink, Globe } from '@lucide/svelte';

  let copyFeedback = $state(false);

  const USERSCRIPT_CONTENT = `// ==UserScript==
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
      if (url.pathname.startsWith('/chart')) {
        const symbol = url.searchParams.get('symbol');
        if (symbol) {
          window.location.href = 'trawangan://chart?symbol=' + encodeURIComponent(symbol);
        }
      } else if (url.pathname.includes('/symbols/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('symbols');
        if (idx !== -1 && parts[idx + 1]) {
          const symSeg = parts[idx + 1].replace('-', ':');
          window.location.href = 'trawangan://chart?symbol=' + encodeURIComponent(symSeg);
        }
      }
    } catch (_) {}
  }
  redirectIfMatching();
  window.addEventListener('popstate', redirectIfMatching);
})();`;

  async function handleCopyScript() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(USERSCRIPT_CONTENT);
      }
      copyFeedback = true;
      setTimeout(() => (copyFeedback = false), 3500);
    } catch (e) {
      console.warn('Gagal menyalin userscript:', e);
    }
  }
</script>

<div class="browser-bridge-guide-wrapper">
  <div class="bridge-header">
    <div class="bridge-title-col">
      <h4 class="bridge-title">
        <Link2 size={16} class="text-brand" />
        <span>Bantuan & Panduan Skrip Browser (Tampermonkey)</span>
      </h4>
      <p class="bridge-desc">
        Tangkap seluruh tautan grafik dari browser (seperti TradingView, Binance, Bybit, DexScreener) dan otomatis buka di terminal Trawangan via protokol <code>trawangan://</code>.
      </p>
    </div>

    <button
      type="button"
      class="copy-script-btn {copyFeedback ? 'copied' : ''}"
      onclick={handleCopyScript}
    >
      {#if copyFeedback}
        <Check size={13} />
        <span>Skrip Berhasil Disalin!</span>
      {:else}
        <Copy size={13} />
        <span>Salin Skrip Tampermonkey</span>
      {/if}
    </button>
  </div>

  <!-- TUTORIAL LANGKAH DEMI LANGKAH -->
  <div class="tutorial-card obsidian-card">
    <div class="tutorial-step">
      <span class="step-num">1</span>
      <div class="step-content">
        <strong>Pasang Ekstensi Userscript di Browser</strong>
        <p>Pasang ekstensi <em>Tampermonkey</em> atau <em>Violentmonkey</em> di Google Chrome, Microsoft Edge, Brave, atau Firefox.</p>
      </div>
    </div>

    <div class="tutorial-step">
      <span class="step-num">2</span>
      <div class="step-content">
        <strong>Buat Skrip Baru & Tempelkan Kode</strong>
        <p>Klik tombol <strong>"Salin Skrip Tampermonkey"</strong> di atas &rarr; Buka ekstensi Tampermonkey &rarr; pilih <em>"Create a new script"</em> &rarr; tempelkan kode &rarr; tekan <kbd>Ctrl+S</kbd> untuk menyimpan.</p>
      </div>
    </div>

    <div class="tutorial-step">
      <span class="step-num">3</span>
      <div class="step-content">
        <strong>Selesai! Nikmati Intersepsi Otomatis</strong>
        <p>Setiap kali Anda membuka tautan seperti <code>tradingview.com/chart/?symbol=BINANCE:BTCUSDT</code>, browser akan otomatis mengarahkannya ke Trawangan dengan feed bursa terbaik.</p>
      </div>
    </div>

    <div class="test-row">
      <span class="test-label">Uji Coba Tautan Protokol Native:</span>
      <a href="trawangan://chart?symbol=BINANCE:BTCUSDT" class="btn-test-link">
        <ExternalLink size={12} /> Buka BTCUSDT di Trawangan
      </a>
    </div>
  </div>
</div>

<style>
  .browser-bridge-guide-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bridge-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .bridge-title-col {
    flex: 1;
  }

  .bridge-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .text-brand {
    color: #2962ff;
  }

  .bridge-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: 4px 0 0 0;
    line-height: 1.4;
  }

  .copy-script-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #2962ff;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .copy-script-btn:hover {
    background-color: #1e53e5;
  }

  .copy-script-btn.copied {
    background-color: #00f090;
    color: #0a0d14;
  }

  .tutorial-card {
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tutorial-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: rgba(41, 98, 255, 0.15);
    color: #60a5fa;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
  }

  .step-content strong {
    color: var(--text-main, #ffffff);
  }

  .step-content p {
    margin: 0;
    color: var(--text-dim, #6e7681);
    line-height: 1.4;
  }

  .test-row {
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--border-hairline, #21262d);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
  }

  .test-label {
    color: var(--text-dim, #6e7681);
  }

  .btn-test-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #00f090;
    background: rgba(0, 240, 144, 0.08);
    border: 1px solid rgba(0, 240, 144, 0.25);
    padding: 3px 8px;
    border-radius: 4px;
    text-decoration: none;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.15s ease;
  }

  .btn-test-link:hover {
    background: rgba(0, 240, 144, 0.18);
    border-color: rgba(0, 240, 144, 0.5);
  }
</style>
