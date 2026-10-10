<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, X, Plus, Code, Trash2, Sliders, Layers, Sparkles } from '@lucide/svelte';
  import { INDICATOR_PRESETS, type IndicatorPreset } from '../data/indicatorPresets';
  import { loadScripts, deleteScript } from '../services/persistence';
  import type { PineScriptRecord } from '../types/market';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectIndicator: (code: string, title: string) => void;
    onOpenInEditor: (code: string, title: string) => void;
  }

  let { isOpen, onClose, onSelectIndicator, onOpenInEditor }: Props = $props();

  let searchQuery = $state('');
  let selectedCategory = $state<string>('All');
  let savedScripts = $state<PineScriptRecord[]>([]);

  const categories = ['All', 'Trend', 'Momentum', 'Volatility', 'Signals', 'My Scripts'];

  $effect(() => {
    if (isOpen) {
      loadSavedScripts();
    }
  });

  async function loadSavedScripts() {
    savedScripts = await loadScripts();
  }

  async function handleDeleteScript(e: MouseEvent, id: string) {
    e.stopPropagation();
    await deleteScript(id);
    await loadSavedScripts();
  }

  const filteredPresets = $derived(
    INDICATOR_PRESETS.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
  );

  const filteredSavedScripts = $derived(
    savedScripts.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal-card glass-panel">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <Layers size={18} class="header-icon" />
          <h3>Indikator & Scripting Library</h3>
        </div>
        <button class="close-btn" onclick={onClose}>
          <X size={18} />
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="search-section">
        <div class="search-box">
          <Search size={15} class="search-icon" />
          <input
            type="text"
            placeholder="Cari indikator (e.g. RSI, EMA, Bollinger, SuperTrend)..."
            bind:value={searchQuery}
            class="search-input"
          />
        </div>

        <div class="category-tabs">
          {#each categories as cat}
            <button
              class="tab-btn {selectedCategory === cat ? 'active' : ''}"
              onclick={() => (selectedCategory = cat)}
            >
              {#if cat === 'My Scripts'}
                <Code size={12} />
              {/if}
              {cat}
            </button>
          {/each}
        </div>
      </div>

      <!-- Indicators List -->
      <div class="indicators-list">
        {#if selectedCategory === 'My Scripts'}
          <!-- Saved Scripts Tab -->
          {#if filteredSavedScripts.length === 0}
            <div class="empty-state">
              <Code size={32} class="empty-icon" />
              <p>Belum ada skrip Pine yang disimpan.</p>
              <small>Buka Pine Editor di bagian bawah untuk membuat dan menyimpan skrip kustom Anda.</small>
            </div>
          {:else}
            {#each filteredSavedScripts as s}
              <div class="indicator-item glass-panel">
                <div class="item-main">
                  <div class="item-header">
                    <span class="item-name">{s.title}</span>
                    <span class="badge {s.is_overlay ? 'badge-overlay' : 'badge-sub'}">
                      {s.is_overlay ? 'Overlay' : 'Pane'}
                    </span>
                  </div>
                  <div class="item-date">
                    Diperbarui: {new Date(s.updated_at).toLocaleDateString()}
                  </div>
                </div>

                <div class="item-actions">
                  <button
                    class="btn-icon"
                    title="Edit di Pine Editor"
                    onclick={() => {
                      onOpenInEditor(s.code, s.title);
                      onClose();
                    }}
                  >
                    <Code size={14} />
                  </button>
                  <button
                    class="btn-icon danger"
                    title="Hapus skrip"
                    onclick={(e) => handleDeleteScript(e, s.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    class="btn-add"
                    onclick={() => {
                      onSelectIndicator(s.code, s.title);
                      onClose();
                    }}
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        {:else}
          <!-- Presets Tab -->
          {#if filteredPresets.length === 0}
            <div class="empty-state">
              <Search size={32} class="empty-icon" />
              <p>Tidak ada indikator yang cocok dengan pencarian.</p>
            </div>
          {:else}
            {#each filteredPresets as p}
              <div class="indicator-item glass-panel">
                <div class="item-main">
                  <div class="item-header">
                    <span class="item-name">{p.name}</span>
                    <span class="category-tag">{p.category}</span>
                    <span class="badge {p.overlay ? 'badge-overlay' : 'badge-sub'}">
                      {p.overlay ? 'Overlay' : 'Sub-Pane'}
                    </span>
                  </div>
                  <p class="item-desc">{p.description}</p>
                </div>

                <div class="item-actions">
                  <button
                    class="btn-icon"
                    title="Lihat / Edit kode di Pine Editor"
                    onclick={() => {
                      onOpenInEditor(p.sourceCode, p.name);
                      onClose();
                    }}
                  >
                    <Code size={14} />
                  </button>
                  <button
                    class="btn-add"
                    onclick={() => {
                      onSelectIndicator(p.sourceCode, p.name);
                      onClose();
                    }}
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    width: 650px;
    max-width: 92vw;
    height: 560px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  .modal-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  :global(.header-icon) {
    color: var(--brand-cyan);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .close-btn:hover {
    color: var(--text-main);
  }

  .search-section {
    padding: 14px 18px 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-darkest);
    border: 1px solid var(--border-medium);
    padding: 7px 12px;
    border-radius: var(--radius-sm);
  }

  :global(.search-icon) {
    color: var(--text-dim);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 12px;
    outline: none;
  }

  .category-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .tab-btn.active {
    background: var(--bg-active);
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
  }

  .indicators-list {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .indicator-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all 0.15s;
  }

  .indicator-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .item-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .category-tag {
    font-size: 10px;
    color: var(--text-dim);
    background: rgba(255, 255, 255, 0.04);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
  }

  .badge-overlay {
    background: rgba(0, 242, 254, 0.12);
    color: var(--brand-cyan);
  }

  .badge-sub {
    background: rgba(139, 92, 246, 0.15);
    color: var(--brand-purple);
  }

  .item-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .item-date {
    font-size: 10px;
    color: var(--text-dim);
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 14px;
  }

  .btn-icon {
    background: var(--bg-panel);
    border: 1px solid var(--border-medium);
    color: var(--text-muted);
    padding: 5px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .btn-icon:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .btn-icon.danger:hover {
    color: var(--bear-color);
    border-color: var(--bear-color);
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--brand-blue);
    border: 1px solid var(--brand-cyan);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-add:hover {
    background: #2563eb;
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.4);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    gap: 8px;
    text-align: center;
    padding: 20px;
  }

  :global(.empty-icon) {
    color: var(--border-bright);
    margin-bottom: 6px;
  }
</style>
