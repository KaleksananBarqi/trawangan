<script lang="ts">
  import {
    Search,
    X,
    HelpCircle,
    Grid,
    Code,
    Radio
  } from '@lucide/svelte';
  import { SHORTCUT_GLOSSARY, filterShortcuts } from '../../services/shortcutService';
  import BrowserBridgeGuide from './BrowserBridgeGuide.svelte';

  let helpSearchQuery = $state('');

  let filteredShortcuts = $derived.by(() => {
    return filterShortcuts(helpSearchQuery);
  });

  let groupedShortcuts = $derived.by(() => {
    const groups: Record<string, typeof SHORTCUT_GLOSSARY> = {};
    for (const item of filteredShortcuts) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  });
</script>

<div class="help-pane">
  <!-- Header Seksi Bantuan -->
  <div class="section-group">
    <div class="help-header-flex">
      <div>
        <h3 class="section-heading">Pusat Bantuan & Panduan Shortcut</h3>
        <p class="section-desc">
          Gunakan tombol pintas keyboard berikut untuk mempercepat navigasi grafik, eksekusi alat gambar, dan analisis pasar.
        </p>
      </div>
      <div class="help-f1-badge mono-nums">
        <span>Shortcut Bantuan:</span> <kbd class="kbd-key">F1</kbd> / <kbd class="kbd-key">?</kbd>
      </div>
    </div>

    <!-- Input Pencarian Cepat Shortcut -->
    <div class="shortcut-search-box">
      <Search size={14} class="search-icon-dim" />
      <input
        type="text"
        placeholder="Cari tombol shortcut (e.g. replay, alt, kursor, fit)..."
        bind:value={helpSearchQuery}
        class="shortcut-search-input"
      />
      {#if helpSearchQuery}
        <button class="clear-search-btn" onclick={() => (helpSearchQuery = '')}>
          <X size={12} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Daftar Shortcut Per Kategori -->
  <div class="section-group">
    <div class="shortcut-categories-container">
      {#if Object.keys(groupedShortcuts).length === 0}
        <div class="empty-shortcut-state">
          <HelpCircle size={24} class="text-dim" />
          <span>Tidak ada tombol shortcut yang cocok dengan "{helpSearchQuery}".</span>
        </div>
      {/if}

      {#each Object.entries(groupedShortcuts) as [categoryName, items]}
        <div class="shortcut-category-card">
          <div class="category-header">
            <span class="category-title">{categoryName}</span>
            <span class="category-count mono-nums">{items.length} pintasan</span>
          </div>

          <div class="shortcut-items-table">
            {#each items as item}
              <div class="shortcut-row">
                <div class="shortcut-keys-wrapper">
                  {#each item.keys as keyPart, idx}
                    <kbd class="kbd-key mono-nums">{keyPart}</kbd>
                    {#if idx < item.keys.length - 1}
                      <span class="kbd-plus">+</span>
                    {/if}
                  {/each}
                </div>
                <div class="shortcut-desc">{item.desc}</div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Panduan Skrip Browser (Deep Link Bridge) -->
  <div class="section-group">
    <BrowserBridgeGuide />
  </div>

  <!-- Panduan Fitur Inti (Quick Guide) -->
  <div class="section-group">
    <h4 class="section-title">Panduan Ringkas Fitur Utama</h4>
    <div class="feature-guides-grid">
      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Grid size={14} class="text-cyan" />
          <span class="guide-card-title">Multi-Chart & Sinkronisasi</span>
        </div>
        <p class="guide-card-body">
          Pilih tata letak multi-chart (1, 2 Horisontal, 2 Vertikal, 4 Grid) lewat menu
          <strong>Workspace & Layout</strong>. Aktifkan sinkronisasi kursor crosshair, gerakan waktu viewport,
          simbol, dan objek gambar secara langsung lewat menu <strong>Actions</strong> di header.
        </p>
      </div>

      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Code size={14} class="text-bull" />
          <span class="guide-card-title">Pine Script v6 IDE & Backtester</span>
        </div>
        <p class="guide-card-body">
          Beralih ke mode <strong>Pine IDE</strong> di header kiri atas untuk membuat, mengedit, dan mengevaluasi indikator
          serta strategi kuantitatif kustom secara instan menggunakan AST Engine Pine Script v6 di Web Worker independen.
        </p>
      </div>

      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Radio size={14} class="text-amber" />
          <span class="guide-card-title">Data Feed Binance & Bitunix</span>
        </div>
        <p class="guide-card-body">
          Ganti penyedia feed live antara <strong>Binance Futures</strong> dan <strong>Bitunix Futures</strong>
          di tab <strong>Data Feed</strong>. Trawangan Terminal mendukung format koin perpetual standar dan simbol <span class="mono-nums">.P</span> secara mulus.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .help-pane {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .help-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .section-heading {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: var(--text-base, #ffffff);
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: 4px 0 0 0;
    line-height: 1.4;
  }

  .help-f1-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-dim, #8b949e);
    padding: 4px 8px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    white-space: nowrap;
  }

  .shortcut-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 6px 12px;
  }

  .shortcut-search-box:focus-within {
    border-color: var(--border-focus, #58a6ff);
  }

  .shortcut-search-input {
    background: transparent;
    border: none;
    color: var(--text-base, #ffffff);
    font-size: 12px;
    outline: none;
    flex: 1;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-dim, #6e7681);
    cursor: pointer;
  }

  .shortcut-categories-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcut-category-card {
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    overflow: hidden;
  }

  .category-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-subtle, #30363d);
  }

  .category-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .category-count {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .shortcut-items-table {
    display: flex;
    flex-direction: column;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid rgba(48, 54, 61, 0.4);
    font-size: 11px;
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-keys-wrapper {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .kbd-key {
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }

  .kbd-plus {
    color: var(--text-dim, #6e7681);
    font-size: 9px;
  }

  .shortcut-desc {
    color: var(--text-dim, #8b949e);
  }

  .empty-shortcut-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    color: var(--text-dim, #6e7681);
    font-size: 12px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .feature-guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .feature-guide-card {
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .guide-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .guide-card-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
  }

  .guide-card-body {
    font-size: 10.5px;
    color: var(--text-dim, #8b949e);
    line-height: 1.4;
    margin: 0;
  }

  .text-cyan { color: #38bdf8; }
  .text-bull { color: #3fb950; }
  .text-amber { color: #f59e0b; }
</style>
