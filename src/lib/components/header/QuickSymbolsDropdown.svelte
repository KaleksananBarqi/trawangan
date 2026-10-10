<script lang="ts">
  import {
    SlidersHorizontal,
    Zap,
    Pin,
    X,
    Check,
    Plus,
    Copy,
    RotateCcw
  } from '@lucide/svelte';
  import type { QuickSymbolsConfig } from '../../types/market';

  interface Props {
    activeSymbol: string;
    watchlistSymbols?: string[];
    quickSymbolsConfig?: QuickSymbolsConfig;
    isWatchlistOpen?: boolean;
    onSymbolChange: (sym: string) => void;
    onQuickSymbolsConfigChange?: (config: QuickSymbolsConfig) => void;
    onToggleWatchlist?: () => void;
  }

  let {
    activeSymbol,
    watchlistSymbols = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
    ],
    quickSymbolsConfig = {
      mode: 'watchlist',
      customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
      maxDisplayCount: 5
    },
    isWatchlistOpen = true,
    onSymbolChange,
    onQuickSymbolsConfigChange,
    onToggleWatchlist
  }: Props = $props();

  let showQuickSymbolsMenu = $state(false);
  let newCustomSymbolInput = $state('');

  let activeQuickSymbols = $derived.by(() => {
    const mode = quickSymbolsConfig?.mode || 'watchlist';
    const limit = quickSymbolsConfig?.maxDisplayCount ?? 5;
    const baseList = mode === 'watchlist'
      ? (watchlistSymbols && watchlistSymbols.length > 0 ? watchlistSymbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'])
      : (quickSymbolsConfig?.customSymbols && quickSymbolsConfig.customSymbols.length > 0 ? quickSymbolsConfig.customSymbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT']);

    return limit === 0 ? baseList : baseList.slice(0, limit);
  });

  function setQuickMode(mode: 'watchlist' | 'custom') {
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      mode
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function setQuickLimit(limit: number) {
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      maxDisplayCount: limit
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function addCustomSymbol(sym: string) {
    const clean = sym.trim().toUpperCase();
    if (!clean) return;
    const formatted = clean.endsWith('USDT') ? clean : `${clean}USDT`;
    const current = quickSymbolsConfig.customSymbols || [];
    if (!current.includes(formatted)) {
      const updated: QuickSymbolsConfig = {
        ...quickSymbolsConfig,
        customSymbols: [...current, formatted]
      };
      onQuickSymbolsConfigChange?.(updated);
    }
    newCustomSymbolInput = '';
  }

  function removeCustomSymbol(sym: string) {
    const current = quickSymbolsConfig.customSymbols || [];
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      customSymbols: current.filter(s => s !== sym)
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function togglePinWatchlistSymbol(sym: string) {
    const current = quickSymbolsConfig.customSymbols || [];
    if (current.includes(sym)) {
      removeCustomSymbol(sym);
    } else {
      addCustomSymbol(sym);
    }
  }

  function copyAllFromWatchlist() {
    if (!watchlistSymbols || watchlistSymbols.length === 0) return;
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      customSymbols: [...watchlistSymbols]
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function resetQuickSymbolsDefault() {
    const updated: QuickSymbolsConfig = {
      mode: 'watchlist',
      customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
      maxDisplayCount: 5
    };
    onQuickSymbolsConfigChange?.(updated);
  }
</script>

<div class="quick-symbols-wrapper">
  <div class="quick-symbols" title="Bilah Koin Cepat">
    {#each activeQuickSymbols as sym}
      <button
        class="symbol-chip {activeSymbol === sym ? 'active' : ''}"
        title="{sym} • Klik untuk tampilkan chart"
        onclick={() => onSymbolChange(sym)}
      >
        {sym.replace('USDT', '')}
      </button>
    {/each}

    <!-- Tombol Atur Koin Cepat -->
    <button
      class="quick-config-btn {showQuickSymbolsMenu ? 'active' : ''}"
      title="Atur Koin Cepat ({quickSymbolsConfig?.mode === 'watchlist' ? 'Mode Watchlist' : 'Mode Kustom'})"
      onclick={() => (showQuickSymbolsMenu = !showQuickSymbolsMenu)}
    >
      <SlidersHorizontal size={11} class="config-icon" />
    </button>
  </div>

  <!-- Popover Kustomisasi Koin Cepat -->
  {#if showQuickSymbolsMenu}
    <div class="quick-config-dropdown obsidian-panel">
      <div class="quick-menu-header">
        <div class="header-left">
          <SlidersHorizontal size={12} class="brand-accent-icon" />
          <span class="menu-title">Koin Cepat Header</span>
        </div>
        <button
          class="icon-close-btn"
          title="Tutup"
          onclick={() => (showQuickSymbolsMenu = false)}
        >
          <X size={12} />
        </button>
      </div>

      <!-- Mode Switcher Tabs -->
      <div class="quick-mode-tabs">
        <button
          class="mode-tab {quickSymbolsConfig?.mode === 'watchlist' ? 'active' : ''}"
          onclick={() => setQuickMode('watchlist')}
        >
          <Zap size={11} />
          <span>Ikuti Watchlist</span>
        </button>
        <button
          class="mode-tab {quickSymbolsConfig?.mode === 'custom' ? 'active' : ''}"
          onclick={() => setQuickMode('custom')}
        >
          <Pin size={11} />
          <span>Pilihan Kustom</span>
        </button>
      </div>

      {#if quickSymbolsConfig?.mode === 'watchlist'}
        <div class="tab-pane">
          <p class="tab-description">
            Otomatis menampilkan koin dari daftar Watchlist aktif secara dinamis.
          </p>

          <div class="limit-selector-group">
            <span class="sub-label">Batas Tampilan:</span>
            <div class="pill-buttons">
              {#each [3, 5, 8, 0] as lim}
                <button
                  class="pill-btn {quickSymbolsConfig?.maxDisplayCount === lim ? 'active' : ''}"
                  onclick={() => setQuickLimit(lim)}
                >
                  {lim === 0 ? 'Semua' : lim}
                </button>
              {/each}
            </div>
          </div>

          <div class="watchlist-preview-section">
            <span class="sub-label">Koin Watchlist ({watchlistSymbols.length}):</span>
            <div class="chips-flow mono-nums">
              {#each watchlistSymbols as sym}
                <button
                  class="preview-chip {activeSymbol === sym ? 'active' : ''}"
                  title="Buka chart {sym}"
                  onclick={() => {
                    onSymbolChange(sym);
                    showQuickSymbolsMenu = false;
                  }}
                >
                  {sym.replace('USDT', '')}
                </button>
              {/each}
            </div>
          </div>

          <div class="quick-menu-actions">
            <button
              class="action-link-btn"
              onclick={() => {
                if (!isWatchlistOpen) onToggleWatchlist?.();
                showQuickSymbolsMenu = false;
              }}
            >
              Buka Panel Watchlist →
            </button>
          </div>
        </div>
      {:else}
        <div class="tab-pane">
          <p class="tab-description">
            Sematkan koin favorit pilihan Anda sendiri untuk navigasi kilat di header.
          </p>

          <div class="limit-selector-group">
            <span class="sub-label">Batas Tampilan:</span>
            <div class="pill-buttons">
              {#each [3, 5, 8, 0] as lim}
                <button
                  class="pill-btn {quickSymbolsConfig?.maxDisplayCount === lim ? 'active' : ''}"
                  onclick={() => setQuickLimit(lim)}
                >
                  {lim === 0 ? 'Semua' : lim}
                </button>
              {/each}
            </div>
          </div>

          <!-- Koin Disematkan -->
          <div class="pinned-section">
            <div class="section-row-header">
              <span class="sub-label">Disematkan ({(quickSymbolsConfig?.customSymbols || []).length}):</span>
            </div>
            <div class="chips-flow mono-nums">
              {#if (quickSymbolsConfig?.customSymbols || []).length === 0}
                <div class="empty-hint">Belum ada koin disematkan. Pilih koin di bawah atau ketik manual.</div>
              {:else}
                {#each (quickSymbolsConfig?.customSymbols || []) as sym}
                  <div class="pinned-chip {activeSymbol === sym ? 'active' : ''}">
                    <button
                      class="chip-sym-btn"
                      title="Buka chart {sym}"
                      onclick={() => {
                        onSymbolChange(sym);
                        showQuickSymbolsMenu = false;
                      }}
                    >
                      {sym.replace('USDT', '')}
                    </button>
                    <button
                      class="chip-remove-btn"
                      title="Lepas {sym}"
                      onclick={(e) => {
                        e.stopPropagation();
                        removeCustomSymbol(sym);
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Opsi Sematkan dari Watchlist -->
          {#if watchlistSymbols && watchlistSymbols.length > 0}
            <div class="watchlist-pick-section">
              <span class="sub-label">Pilih dari Watchlist:</span>
              <div class="chips-flow mono-nums">
                {#each watchlistSymbols as sym}
                  {@const isPinned = (quickSymbolsConfig?.customSymbols || []).includes(sym)}
                  <button
                    class="toggle-chip {isPinned ? 'pinned' : ''}"
                    title="{isPinned ? 'Lepas' : 'Sematkan'} {sym}"
                    onclick={() => togglePinWatchlistSymbol(sym)}
                  >
                    {#if isPinned}
                      <Check size={9} class="chip-icon" />
                    {:else}
                      <Plus size={9} class="chip-icon" />
                    {/if}
                    <span>{sym.replace('USDT', '')}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Form Tambah Simbol Manual -->
          <form
            class="add-custom-form"
            onsubmit={(e) => {
              e.preventDefault();
              addCustomSymbol(newCustomSymbolInput);
            }}
          >
            <input
              type="text"
              placeholder="Ketik koin baru (mis: PEPE)..."
              bind:value={newCustomSymbolInput}
              class="add-input mono-nums"
            />
            <button
              type="submit"
              class="add-submit-btn"
              disabled={!newCustomSymbolInput.trim()}
            >
              <Plus size={11} />
              <span>Sematkan</span>
            </button>
          </form>

          <!-- Aksi Bawah: Salin Watchlist & Reset -->
          <div class="custom-bottom-actions">
            <button
              type="button"
              class="utility-btn"
              title="Salin semua koin watchlist ke daftar kustom"
              onclick={copyAllFromWatchlist}
            >
              <Copy size={11} />
              <span>Salin Watchlist</span>
            </button>

            <button
              type="button"
              class="utility-btn"
              title="Kembalikan ke koin standar"
              onclick={resetQuickSymbolsDefault}
            >
              <RotateCcw size={11} />
              <span>Reset Default</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .quick-symbols-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .quick-symbols {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-base);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-hairline);
  }

  .symbol-chip {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .symbol-chip:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .symbol-chip.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .quick-config-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-dim);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .quick-config-btn:hover {
    background-color: var(--bg-hover);
    color: var(--brand-primary);
  }

  .quick-config-btn.active {
    background-color: var(--bg-panel);
    border-color: var(--border-hairline);
    color: var(--brand-primary);
  }

  .quick-config-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 320px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    z-index: 250;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quick-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.brand-accent-icon) {
    color: var(--brand-primary);
  }

  .menu-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text-main);
  }

  .icon-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: var(--radius-xs);
    transition: all 0.1s ease;
  }

  .icon-close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .quick-mode-tabs {
    display: flex;
    gap: 4px;
    background-color: var(--bg-darkest);
    padding: 2px;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .mode-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .mode-tab:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .mode-tab.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .tab-description {
    font-size: 10.5px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 0;
  }

  .limit-selector-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-hairline);
  }

  .sub-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .pill-buttons {
    display: flex;
    gap: 3px;
  }

  .pill-btn {
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 10px;
    padding: 2px 7px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .pill-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .pill-btn.active {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    font-weight: 700;
    border-color: var(--brand-primary);
  }

  .chips-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 90px;
    overflow-y: auto;
    padding: 2px 0;
  }

  .preview-chip {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .preview-chip:hover {
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .preview-chip.active {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border-color: var(--brand-primary);
  }

  .pinned-chip {
    display: inline-flex;
    align-items: center;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 1px 3px 1px 6px;
    gap: 3px;
  }

  .pinned-chip.active {
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .chip-sym-btn {
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }

  .chip-remove-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }

  .chip-remove-btn:hover {
    color: var(--alert-color);
    background-color: rgba(255, 59, 105, 0.15);
  }

  .toggle-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 10px;
    padding: 2px 5px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .toggle-chip:hover {
    border-color: var(--border-medium);
    color: var(--text-main);
  }

  .toggle-chip.pinned {
    background-color: rgba(0, 240, 144, 0.1);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  .add-custom-form {
    display: flex;
    gap: 4px;
    margin-top: 3px;
  }

  .add-input {
    flex: 1;
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 10.5px;
    padding: 4px 7px;
    border-radius: var(--radius-xs);
    outline: none;
  }

  .add-input:focus {
    border-color: var(--brand-primary);
  }

  .add-submit-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .add-submit-btn:hover:not(:disabled) {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .add-submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .custom-bottom-actions {
    display: flex;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px solid var(--border-hairline);
  }

  .utility-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    transition: all 0.1s ease;
  }

  .utility-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .action-link-btn {
    background: transparent;
    border: none;
    color: var(--brand-primary);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 0;
    text-align: right;
    display: block;
    margin-left: auto;
  }

  .action-link-btn:hover {
    text-decoration: underline;
  }

  .empty-hint {
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
    padding: 4px 0;
  }
</style>
