<script lang="ts">
  import { X, Search, Keyboard, Sparkles, Command, Pencil } from '@lucide/svelte';
  import {
    SHORTCUT_GLOSSARY,
    filterShortcuts,
    getShortcutsByCategory,
    type ShortcutItem
  } from '../services/shortcutService';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onOpenGestureGuide?: () => void;
  }

  let { isOpen, onClose, onOpenGestureGuide }: Props = $props();

  let searchQuery = $state('');
  let selectedCategory = $state<string>('Semua');

  const categories = [
    'Semua',
    'Navigasi & Simbol',
    'Alat Gambar (Drawing Tools)',
    'Bar Replay (Simulasi)',
    'Analisis & Indikator',
    'Skala & Tampilan Grafik',
    'Timeframe Cepat',
    'Sistem & Bantuan'
  ];

  let displayedShortcuts = $derived.by(() => {
    let list = filterShortcuts(searchQuery);
    if (selectedCategory !== 'Semua') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    return list;
  });

  // Kelompokkan per kategori untuk tampilan terstruktur saat melihat "Semua"
  let groupedDisplay = $derived.by(() => {
    if (selectedCategory !== 'Semua' || searchQuery.trim().length > 0) {
      return null;
    }
    return getShortcutsByCategory();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="modal-container obsidian-card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-modal-title"
    >
      <!-- Header Modal -->
      <div class="modal-header">
        <div class="header-title-box">
          <div class="header-icon-box">
            <Keyboard size={18} class="accent-icon" />
          </div>
          <div>
            <h2 id="shortcut-modal-title" class="modal-title">Pusat Pintasan Keyboard</h2>
            <p class="modal-subtitle">Glosarium komprehensif navigasi & alat kerja terminal Trawangan</p>
          </div>
        </div>
        <button type="button" class="close-btn" onclick={onClose} aria-label="Tutup Glosarium">
          <X size={18} />
        </button>
      </div>

      <!-- Bilah Pencarian Kilat -->
      <div class="search-bar-wrapper">
        <div class="search-input-box">
          <Search size={15} class="search-icon" />
          <input
            type="text"
            class="search-input"
            placeholder="Cari shortcut (contoh: Alt, Replay, Watchlist, Skala, Garis)..."
            bind:value={searchQuery}
            autofocus
          />
          {#if searchQuery}
            <button
              type="button"
              class="clear-search-btn"
              onclick={() => (searchQuery = '')}
              aria-label="Bersihkan pencarian"
            >
              <X size={13} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Tab Filter Kategori -->
      <div class="category-tabs-container">
        {#each categories as cat}
          <button
            type="button"
            class="category-tab-btn {selectedCategory === cat ? 'active' : ''}"
            onclick={() => (selectedCategory = cat)}
          >
            <span>{cat}</span>
          </button>
        {/each}
      </div>

      <!-- Banner Pintas Panduan Goresan Draw by Holding -->
      <div class="gesture-guide-banner">
        <div class="gesture-banner-left">
          <Pencil size={14} class="banner-pencil-icon text-cyan" />
          <span class="banner-guide-text">
            Tahan <kbd class="inline-kbd">~</kbd> atau tekan <kbd class="inline-kbd">Shift+D</kbd> di kanvas grafik untuk menggambar bebas.
          </span>
        </div>
        <button
          type="button"
          class="btn-open-gesture-guide"
          onclick={() => {
            onClose();
            onOpenGestureGuide?.();
          }}
        >
          <Sparkles size={12} />
          <span>Buka Panduan Goresan (Draw by Holding)...</span>
        </button>
      </div>

      <!-- Konten Daftar Shortcut -->
      <div class="shortcuts-scroll-area">
        {#if displayedShortcuts.length === 0}
          <div class="empty-state">
            <Command size={28} class="empty-icon" />
            <p class="empty-text">Tidak ada shortcut yang cocok dengan "{searchQuery}"</p>
            <button type="button" class="btn-reset-search" onclick={() => { searchQuery = ''; selectedCategory = 'Semua'; }}>
              Tampilkan Semua Shortcut
            </button>
          </div>
        {:else if groupedDisplay}
          <!-- Tampilan Terkelompok per Kategori -->
          {#each Object.entries(groupedDisplay) as [catName, items]}
            <div class="category-section">
              <h3 class="category-title">{catName}</h3>
              <div class="shortcut-grid">
                {#each items as item (item.id)}
                  <div class="shortcut-card">
                    <div class="shortcut-keys">
                      {#each item.keys as key}
                        <kbd class="key-badge mono-nums">{key}</kbd>
                      {/each}
                    </div>
                    <span class="shortcut-desc">{item.desc}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <!-- Tampilan Flat Hasil Filter / Pencarian -->
          <div class="shortcut-grid">
            {#each displayedShortcuts as item (item.id)}
              <div class="shortcut-card">
                <div class="shortcut-card-top">
                  <div class="shortcut-keys">
                    {#each item.keys as key}
                      <kbd class="key-badge mono-nums">{key}</kbd>
                    {/each}
                  </div>
                  <span class="shortcut-category-tag">{item.category}</span>
                </div>
                <span class="shortcut-desc">{item.desc}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer Bantuan -->
      <div class="modal-footer">
        <div class="footer-tip">
          <Sparkles size={13} class="tip-icon" />
          <span>Tekan <kbd class="inline-kbd">?</kbd> atau <kbd class="inline-kbd">F1</kbd> kapan saja untuk membuka jendela ini kembali.</span>
        </div>
        <button type="button" class="btn-done" onclick={onClose}>
          Selesai (Esc)
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(6, 8, 12, 0.78);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-container {
    width: 100%;
    max-width: 840px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface, #0f121a);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    background-color: rgba(255, 255, 255, 0.02);
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon-box {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .accent-icon {
    color: var(--accent-primary, #60a5fa);
  }

  .modal-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-main, #f3f4f6);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: 11px;
    color: var(--text-muted, #9ca3af);
    margin: 2px 0 0 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-dim, #6b7280);
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .close-btn:hover {
    color: var(--text-main, #f3f4f6);
    background-color: rgba(255, 255, 255, 0.08);
  }

  .search-bar-wrapper {
    padding: 12px 20px 8px 20px;
  }

  .search-input-box {
    position: relative;
    display: flex;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    border-radius: 6px;
    padding: 0 12px;
    transition: border-color 0.15s ease;
  }

  .search-input-box:focus-within {
    border-color: var(--accent-primary, #60a5fa);
    box-shadow: 0 0 0 1px var(--accent-primary, #60a5fa);
  }

  .search-icon {
    color: var(--text-dim, #6b7280);
    margin-right: 8px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    height: 36px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-main, #f3f4f6);
    font-size: 12px;
    font-family: inherit;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-dim, #6b7280);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search-btn:hover {
    color: var(--text-main, #f3f4f6);
  }

  .category-tabs-container {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 20px 10px 20px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
  }

  .category-tabs-container::-webkit-scrollbar {
    height: 3px;
  }

  .category-tabs-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }

  .category-tab-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted, #9ca3af);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s ease;
  }

  .category-tab-btn:hover {
    color: var(--text-main, #f3f4f6);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .category-tab-btn.active {
    color: var(--accent-primary, #60a5fa);
    background-color: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.3);
    font-weight: 600;
  }

  .gesture-guide-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 20px 0 20px;
    padding: 8px 12px;
    border-radius: 6px;
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.22);
  }

  .gesture-banner-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted, #9ca3af);
  }

  .banner-pencil-icon {
    flex-shrink: 0;
  }

  .banner-guide-text {
    line-height: 1.35;
  }

  .btn-open-gesture-guide {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 600;
    color: var(--brand-cyan, #38bdf8);
    background-color: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s ease;
  }

  .btn-open-gesture-guide:hover {
    background-color: var(--brand-cyan, #38bdf8);
    color: #0b0d12;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
  }

  .text-cyan {
    color: var(--brand-cyan, #38bdf8);
  }

  .shortcuts-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .shortcuts-scroll-area::-webkit-scrollbar {
    width: 6px;
  }

  .shortcuts-scroll-area::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .category-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-title {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim, #6b7280);
    margin: 0;
    padding-bottom: 4px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  @media (max-width: 640px) {
    .shortcut-grid {
      grid-template-columns: 1fr;
    }
  }

  .shortcut-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    transition: all 0.12s ease;
  }

  .shortcut-card:hover {
    background-color: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .shortcut-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .shortcut-category-tag {
    font-size: 9.5px;
    color: var(--text-dim, #6b7280);
    background-color: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 700;
    color: #e5e7eb;
    background-color: #1a1e29;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-bottom: 2px solid rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    font-family: inherit;
    user-select: none;
  }

  .inline-kbd {
    display: inline-block;
    padding: 1px 4px;
    font-size: 10px;
    font-weight: 600;
    color: #f3f4f6;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    font-family: inherit;
  }

  .shortcut-desc {
    font-size: 11.5px;
    color: var(--text-muted, #9ca3af);
    line-height: 1.4;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    color: var(--text-dim, #6b7280);
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 13px;
    color: var(--text-muted, #9ca3af);
    margin-bottom: 12px;
  }

  .btn-reset-search {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-main, #f3f4f6);
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 11.5px;
    cursor: pointer;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    background-color: rgba(255, 255, 255, 0.02);
  }

  .footer-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted, #9ca3af);
  }

  .tip-icon {
    color: #f59e0b;
    flex-shrink: 0;
  }

  .btn-done {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.2));
    color: var(--text-main, #f3f4f6);
    padding: 6px 16px;
    border-radius: 4px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-done:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
