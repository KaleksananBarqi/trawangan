<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Plus,
    X,
    Search,
    TrendingUp,
    TrendingDown,
    ChevronRight,
    ChevronLeft,
    ListFilter,
    Flame
  } from '@lucide/svelte';
  import { fetchWatchlist, persistWatchlist } from '../services/drawingStorage';
  import { fetchWatchlistTickers } from '../services/marketProvider';
  import type { WatchlistItem } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeSymbol: string;
    onSelectSymbol: (symbol: string) => void;
    onToggleCollapse: () => void;
  }

  let {
    isOpen,
    activeSymbol,
    onSelectSymbol,
    onToggleCollapse,
  }: Props = $props();

  let symbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  let tickerMap = $state<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>>({});
  let searchQuery = $state('');
  let newSymbolInput = $state('');
  let showAddInput = $state(false);
  let pollInterval: any = null;

  async function loadInitialWatchlist() {
    try {
      const saved = await fetchWatchlist();
      if (saved && saved.length > 0) {
        symbols = saved;
      }
      await refreshTickers();
    } catch (err) {
      console.warn('Gagal memuat awal watchlist:', err);
    }
  }

  async function refreshTickers() {
    if (symbols.length === 0) return;
    try {
      const data = await fetchWatchlistTickers(symbols);
      tickerMap = { ...tickerMap, ...data };
    } catch (err) {
      console.warn('Refresh watchlist tickers error:', err);
    }
  }

  onMount(() => {
    loadInitialWatchlist();
    pollInterval = setInterval(refreshTickers, 4000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  async function handleAddSymbol(e: Event) {
    e.preventDefault();
    const clean = newSymbolInput.trim().toUpperCase();
    if (!clean) return;

    const formatted = clean.endsWith('USDT') ? clean : `${clean}USDT`;
    if (!symbols.includes(formatted)) {
      symbols = [...symbols, formatted];
      await persistWatchlist(symbols);
      await refreshTickers();
    }
    newSymbolInput = '';
    showAddInput = false;
  }

  async function handleRemoveSymbol(e: MouseEvent, sym: string) {
    e.stopPropagation();
    symbols = symbols.filter((s) => s !== sym);
    await persistWatchlist(symbols);
  }

  const filteredSymbols = $derived(
    symbols.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function formatPrice(p?: number): string {
    if (!p) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }
</script>

<!-- Collapsed Tab Toggle Button -->
{#if !isOpen}
  <button
    class="collapsed-toggle-btn glass-panel"
    title="Buka Watchlist Panel"
    onclick={onToggleCollapse}
  >
    <ChevronLeft size={16} />
    <span class="vertical-label">WATCHLIST</span>
  </button>
{/if}

<!-- Watchlist Drawer Panel -->
{#if isOpen}
  <aside class="watchlist-panel glass-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="header-title">
        <Flame size={16} class="title-icon" />
        <span>WATCHLIST</span>
        <span class="badge-count mono-nums">{symbols.length}</span>
      </div>

      <div class="header-actions">
        <button
          class="action-icon-btn {showAddInput ? 'active' : ''}"
          title="Tambah Pasangan Koin"
          onclick={() => (showAddInput = !showAddInput)}
        >
          <Plus size={15} />
        </button>
        <button
          class="action-icon-btn"
          title="Tutup Watchlist"
          onclick={onToggleCollapse}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>

    <!-- Quick Add Input Form -->
    {#if showAddInput}
      <form class="add-form" onsubmit={handleAddSymbol}>
        <input
          type="text"
          placeholder="E.g. NEAR atau PEPEUSDT..."
          bind:value={newSymbolInput}
          class="add-input"
        />
        <button type="submit" class="add-btn">Add</button>
      </form>
    {/if}

    <!-- Search Input Filter -->
    <div class="search-box">
      <Search size={13} class="search-icon-svg" />
      <input
        type="text"
        placeholder="Cari di watchlist..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>
          <X size={12} />
        </button>
      {/if}
    </div>

    <!-- Column Headers -->
    <div class="table-head">
      <span class="col-symbol">Simbol</span>
      <span class="col-price">Harga</span>
      <span class="col-change">24h %</span>
    </div>

    <!-- Watchlist Items List -->
    <div class="items-list">
      {#each filteredSymbols as sym (sym)}
        {@const ticker = tickerMap[sym]}
        {@const isBull = (ticker?.change24h ?? 0) >= 0}
        <div class="watchlist-row {activeSymbol === sym ? 'active-row' : ''}">
          <button
            type="button"
            class="row-select-btn"
            onclick={() => onSelectSymbol(sym)}
          >
            <div class="row-symbol">
              <span class="symbol-name">{sym.replace('USDT', '')}</span>
              <span class="quote-asset">/USDT</span>
            </div>

            <div class="row-price mono-nums">
              {formatPrice(ticker?.price)}
            </div>

            <div class="row-change {isBull ? 'bull' : 'bear'} mono-nums">
              {#if ticker?.change24h !== undefined}
                <span class="change-badge">
                  {#if isBull}+{/if}{ticker.change24h.toFixed(2)}%
                </span>
              {:else}
                <span class="change-placeholder">--</span>
              {/if}
            </div>
          </button>

          <button
            type="button"
            class="delete-item-btn"
            title="Hapus dari watchlist"
            onclick={(e) => handleRemoveSymbol(e, sym)}
          >
            <X size={12} />
          </button>
        </div>
      {/each}

      {#if filteredSymbols.length === 0}
        <div class="empty-state">
          <span>Tidak ada koin yang sesuai pencarian.</span>
        </div>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .collapsed-toggle-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 35;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 4px;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    cursor: pointer;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-right: none;
    transition: all 0.2s ease;
  }

  .collapsed-toggle-btn:hover {
    color: var(--brand-cyan);
    background: var(--bg-hover);
  }

  .vertical-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--text-dim);
  }

  .watchlist-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 275px;
    z-index: 40;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border-subtle);
    box-shadow: -6px 0 24px rgba(0, 0, 0, 0.4);
    animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .panel-header {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--text-main);
  }

  :global(.title-icon) {
    color: #f59e0b;
  }

  .badge-count {
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 9px;
    color: var(--text-muted);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-icon-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-icon-btn:hover,
  .action-icon-btn.active {
    background: var(--bg-hover);
    color: var(--brand-cyan);
  }

  .add-form {
    display: flex;
    padding: 8px 10px;
    gap: 6px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid var(--border-subtle);
  }

  .add-input {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    color: var(--text-main);
    font-size: 11px;
    outline: none;
  }

  .add-input:focus {
    border-color: var(--brand-cyan);
  }

  .add-btn {
    background: var(--brand-cyan);
    color: #000;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 10px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .search-box {
    position: relative;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
  }

  :global(.search-icon-svg) {
    position: absolute;
    left: 18px;
    color: var(--text-dim);
  }

  .search-input {
    width: 100%;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 4px 24px 4px 26px;
    color: var(--text-main);
    font-size: 11px;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--border-bright);
  }

  .clear-search-btn {
    position: absolute;
    right: 18px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
  }

  .table-head {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 600;
    border-bottom: 1px solid var(--border-subtle);
  }

  .col-symbol {
    flex: 1.2;
  }
  .col-price {
    flex: 1.1;
    text-align: right;
  }
  .col-change {
    flex: 1;
    text-align: right;
  }

  .items-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .watchlist-row {
    position: relative;
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    transition: background 0.12s ease;
  }

  .watchlist-row:hover {
    background: var(--bg-hover);
  }

  .watchlist-row.active-row {
    background: rgba(0, 242, 254, 0.08);
    border-left: 3px solid var(--brand-cyan);
  }

  .row-select-btn {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
  }

  .row-symbol {
    flex: 1.2;
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .symbol-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .quote-asset {
    font-size: 9px;
    color: var(--text-dim);
  }

  .row-price {
    flex: 1.1;
    text-align: right;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .row-change {
    flex: 1;
    text-align: right;
    font-size: 11px;
    font-weight: 600;
  }

  .row-change.bull {
    color: var(--bull-color);
  }

  .row-change.bear {
    color: var(--bear-color);
  }

  .change-badge {
    padding: 2px 4px;
    border-radius: 3px;
  }

  .row-change.bull .change-badge {
    background: var(--bull-glow);
  }

  .row-change.bear .change-badge {
    background: var(--bear-glow);
  }

  .delete-item-btn {
    position: absolute;
    right: 4px;
    opacity: 0;
    background: rgba(246, 70, 93, 0.2);
    border: none;
    border-radius: 3px;
    color: var(--bear-color);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .watchlist-row:hover .delete-item-btn {
    opacity: 1;
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    color: var(--text-dim);
    font-size: 11px;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
