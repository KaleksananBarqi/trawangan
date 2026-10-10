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
    Flame,
    Bell,
    Layers,
    Eye,
    EyeOff,
    Trash2,
    CheckCircle2,
    Play,
    Pause,
    RotateCcw,
    ArrowUpRight,
    ArrowDownRight,
    MoveHorizontal,
    SlidersHorizontal
  } from '@lucide/svelte';
  import { loadWatchlist, saveWatchlist } from '../services/persistence';
  import { marketFeed } from '../services/market';
  import { alertService } from '../services/alertService';
  import SymbolSearchModal from './SymbolSearchModal.svelte';
  import type { PriceAlert, ObjectTreeItem } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeSymbol: string;
    activeProviderId?: string;
    watchlistSymbols?: string[];
    activeIndicators?: { id: string; title: string; visible: boolean }[];
    onSelectSymbol: (symbol: string) => void;
    onToggleCollapse: () => void;
    onToggleIndicatorVisibility?: (id: string) => void;
    onRemoveIndicator?: (id: string) => void;
    onWatchlistChange?: (symbols: string[]) => void;
    onRequestCreateAlert?: () => void;
    onOpenSymbolSearch?: () => void;
  }

  let {
    isOpen,
    activeSymbol,
    activeProviderId = 'binance',
    watchlistSymbols: propSymbols,
    activeIndicators = [],
    onSelectSymbol,
    onToggleCollapse,
    onToggleIndicatorVisibility,
    onRemoveIndicator,
    onWatchlistChange,
    onRequestCreateAlert,
    onOpenSymbolSearch,
  }: Props = $props();

  let activeTab = $state<'watchlist' | 'alerts' | 'objects'>('watchlist');
  let isSymbolSearchOpen = $state(false);

  // Watchlist state
  let symbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  let tickerMap = $state<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>>({});
  let searchQuery = $state('');
  let newSymbolInput = $state('');
  // Alerts state & filters
  let alerts = $state<PriceAlert[]>([]);
  let alertFilterMode = $state<'all' | 'current'>('all');
  let newAlertPrice = $state('');
  let newAlertLabel = $state('');
  let showAddInput = $state(false);
  let showAddAlert = $state(false);
  let unsubWatchlistFeed: (() => void) | null = null;
  let unsubAlerts: (() => void) | null = null;

  const displayAlerts = $derived.by(() => {
    if (alertFilterMode === 'current') {
      const clean = activeSymbol.replace('.P', '').toUpperCase();
      return alerts.filter((a) => a.symbol.replace('.P', '').toUpperCase() === clean);
    }
    return alerts;
  });

  const activeAlertsCount = $derived(alerts.filter((a) => a.active && !a.triggered).length);
  const triggeredAlertsCount = $derived(alerts.filter((a) => a.triggered).length);

  let lastSyncedHash = '';

  $effect(() => {
    if (propSymbols && propSymbols.length > 0) {
      const h = JSON.stringify(propSymbols);
      if (h !== lastSyncedHash && h !== JSON.stringify(symbols)) {
        lastSyncedHash = h;
        symbols = [...propSymbols];
      }
    }
  });

  async function applyWatchlistUpdate(newSymbols: string[]) {
    symbols = [...newSymbols];
    lastSyncedHash = JSON.stringify(newSymbols);
    if (JSON.stringify(newSymbols) !== JSON.stringify(propSymbols)) {
      onWatchlistChange?.(newSymbols);
    }
    await saveWatchlist(newSymbols);
  }

  async function loadInitialWatchlist() {
    try {
      if (propSymbols && propSymbols.length > 0) {
        symbols = [...propSymbols];
        lastSyncedHash = JSON.stringify(symbols);
      } else {
        const saved = await loadWatchlist();
        if (saved && saved.length > 0) {
          symbols = [...saved];
          lastSyncedHash = JSON.stringify(symbols);
          if (JSON.stringify(saved) !== JSON.stringify(propSymbols)) {
            onWatchlistChange?.(symbols);
          }
        }
      }
    } catch (err) {
      console.warn('Gagal memuat awal watchlist:', err);
    }
  }

  $effect(() => {
    if (symbols && symbols.length > 0) {
      if (unsubWatchlistFeed) unsubWatchlistFeed();
      unsubWatchlistFeed = marketFeed.subscribeWatchlistTickers(symbols, (newMap) => {
        tickerMap = { ...tickerMap, ...newMap };
      });
    }
  });

  onMount(() => {
    loadInitialWatchlist();
    unsubAlerts = alertService.subscribe((list) => {
      alerts = list;
    });
  });

  onDestroy(() => {
    if (unsubWatchlistFeed) unsubWatchlistFeed();
    if (unsubAlerts) unsubAlerts();
  });

  async function handleAddSymbol(e: Event) {
    e.preventDefault();
    const clean = newSymbolInput.trim().toUpperCase();
    if (!clean) return;

    let formatted = clean;
    if (clean.endsWith('.P')) {
      const base = clean.slice(0, -2);
      formatted = base.endsWith('USDT') ? clean : `${base}USDT.P`;
    } else if (!clean.endsWith('USDT')) {
      formatted = `${clean}USDT`;
    }

    if (!symbols.includes(formatted)) {
      await applyWatchlistUpdate([...symbols, formatted]);
    }
    newSymbolInput = '';
    showAddInput = false;
  }

  async function handleToggleSymbolFromSearch(sym: string) {
    let next: string[];
    if (symbols.includes(sym)) {
      next = symbols.filter((s) => s !== sym);
    } else {
      next = [...symbols, sym];
    }
    await applyWatchlistUpdate(next);
  }

  async function handleRemoveSymbol(e: MouseEvent, sym: string) {
    e.stopPropagation();
    e.preventDefault();
    const next = symbols.filter((s) => s !== sym);
    await applyWatchlistUpdate(next);
  }

  function handleTriggerOpenCreateAlert() {
    if (onRequestCreateAlert) {
      onRequestCreateAlert();
    } else {
      showAddAlert = !showAddAlert;
    }
  }

  async function handleCreateAlert(e: Event) {
    e.preventDefault();
    const p = parseFloat(newAlertPrice);
    if (!p) return;

    const curP = tickerMap[activeSymbol]?.price || 0;
    const cond = curP > 0 ? (p > curP ? 'crossing_up' : 'crossing_down') : 'crossing';

    await alertService.addAlert({
      symbol: activeSymbol,
      targetPrice: p,
      condition: cond,
      frequency: 'once',
      label: newAlertLabel.trim() || `Target ${activeSymbol} @ ${p}`,
    });

    newAlertPrice = '';
    newAlertLabel = '';
    showAddAlert = false;
  }

  async function handleToggleAlert(id: string) {
    await alertService.toggleAlertActive(id);
  }

  async function handleResetAlert(id: string) {
    await alertService.resetTriggeredAlert(id);
  }

  async function handleRemoveAlert(id: string) {
    await alertService.deleteAlert(id);
  }

  function getConditionBadge(cond: string) {
    switch (cond) {
      case 'crossing_up':
      case 'above':
        return { label: '↗ Crossing Up', class: 'bull' };
      case 'crossing_down':
      case 'below':
        return { label: '↘ Crossing Down', class: 'bear' };
      case 'crossing':
        return { label: '↔ Crossing', class: 'cyan' };
      case 'greater_than':
        return { label: '≥ Greater', class: 'bull' };
      case 'less_than':
        return { label: '≤ Less', class: 'bear' };
      default:
        return { label: 'Crossing', class: 'muted' };
    }
  }

  function calculateAlertDistance(target: number, sym: string): { diffText: string; pctText: string; isBull: boolean } | null {
    const cur = tickerMap[sym]?.price;
    if (!cur || cur <= 0) return null;
    const diff = target - cur;
    const pct = (diff / cur) * 100;
    const isBull = diff > 0;
    return {
      diffText: `${isBull ? '+' : ''}$${Math.abs(diff).toFixed(diff >= 100 ? 1 : 2)}`,
      pctText: `${isBull ? '+' : ''}${pct.toFixed(2)}%`,
      isBull,
    };
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
    class="collapsed-toggle-btn obsidian-panel"
    title="Buka Panel Kanan"
    onclick={onToggleCollapse}
  >
    <ChevronLeft size={14} />
    <span class="vertical-label">PANEL</span>
  </button>
{/if}

<!-- Watchlist & Telemetry Right Drawer Panel -->
{#if isOpen}
  <aside class="right-panel obsidian-panel">
    <!-- Panel Header: Tab Switching -->
    <div class="panel-header">
      <nav class="panel-tabs">
        <button
          class="tab-btn {activeTab === 'watchlist' ? 'active' : ''}"
          onclick={() => (activeTab = 'watchlist')}
        >
          <Flame size={13} />
          <span>Watchlist</span>
          <span class="count-pill mono-nums">{symbols.length}</span>
        </button>

        <button
          class="tab-btn {activeTab === 'alerts' ? 'active' : ''}"
          onclick={() => (activeTab = 'alerts')}
        >
          <Bell size={13} />
          <span>Alerts</span>
          <span class="count-pill mono-nums">{alerts.length}</span>
        </button>

        <button
          class="tab-btn {activeTab === 'objects' ? 'active' : ''}"
          onclick={() => (activeTab = 'objects')}
        >
          <Layers size={13} />
          <span>Layers</span>
          {#if activeIndicators.length > 0}
            <span class="count-pill mono-nums">{activeIndicators.length}</span>
          {/if}
        </button>
      </nav>

      <button
        class="collapse-action-btn"
        title="Tutup Panel"
        onclick={onToggleCollapse}
      >
        <ChevronRight size={15} />
      </button>
    </div>

    <!-- TAB 1: WATCHLIST -->
    {#if activeTab === 'watchlist'}
      <!-- Watchlist Toolbar: Add & Search -->
      <div class="sub-toolbar">
        <div class="search-box">
          <span class="search-icon"><Search size={12} /></span>
          <input
            type="text"
            placeholder="Filter list..."
            bind:value={searchQuery}
            class="search-input"
          />
          {#if searchQuery}
            <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>
              <X size={11} />
            </button>
          {/if}
        </div>

        <button
          type="button"
          class="symbol-search-trigger-btn"
          title="Buka Pencarian Pair Kripto Valid (Spot / Perpetuals)"
          onclick={() => {
            if (onOpenSymbolSearch) onOpenSymbolSearch();
            else isSymbolSearchOpen = true;
          }}
        >
          <Search size={11} />
          <span>Cari Pair</span>
        </button>

        <button
          class="add-symbol-btn {showAddInput ? 'active' : ''}"
          title="Input Cepat Simbol"
          onclick={() => (showAddInput = !showAddInput)}
        >
          <Plus size={13} />
        </button>
      </div>

      <!-- Feed Status & Column Headers -->
      <div class="table-head mono-nums">
        <div class="col-symbol-wrapper">
          <span class="col-symbol">Symbol</span>
          <span class="active-feed-pill">{activeProviderId.toUpperCase()}</span>
        </div>
        <span class="col-price">Last Price</span>
        <span class="col-change">24h %</span>
      </div>

      {#if showAddInput}
        <form class="add-form" onsubmit={handleAddSymbol}>
          <input
            type="text"
            placeholder="Ketik simbol (e.g. BTCUSDT.P, SUI)..."
            bind:value={newSymbolInput}
            class="add-input mono-nums"
          />
          <button type="submit" class="submit-add-btn">Add</button>
        </form>
      {/if}

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
                <span class="status-pip {isBull ? 'pip-bull' : 'pip-bear'}"></span>
                <span class="symbol-name">{sym.replace('USDT.P', '').replace('USDT', '').replace('.P', '')}</span>
                {#if sym.endsWith('.P')}
                  <span class="type-tag perp mono-nums">.P</span>
                {:else}
                  <span class="type-tag spot mono-nums">SPOT</span>
                {/if}
              </div>

              <div class="row-price mono-nums">
                {formatPrice(ticker?.price)}
              </div>

              <div class="row-change mono-nums">
                {#if ticker?.change24h !== undefined}
                  <span class="change-pill {isBull ? 'pill-bull' : 'pill-bear'}">
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
              <X size={11} />
            </button>
          </div>
        {/each}

        {#if filteredSymbols.length === 0}
          <div class="empty-state">
            <span>Tidak ada koin yang sesuai pencarian.</span>
          </div>
        {/if}
      </div>

    <!-- TAB 2: PRICE ALERTS -->
    {:else if activeTab === 'alerts'}
      <div class="sub-toolbar alert-sub-toolbar">
        <div class="alert-filter-tabs">
          <button
            type="button"
            class="filter-pill {alertFilterMode === 'all' ? 'active' : ''}"
            onclick={() => (alertFilterMode = 'all')}
          >
            Semua ({alerts.length})
          </button>
          <button
            type="button"
            class="filter-pill {alertFilterMode === 'current' ? 'active' : ''}"
            onclick={() => (alertFilterMode = 'current')}
          >
            {activeSymbol.replace('USDT', '').replace('.P', '')} ({displayAlerts.length})
          </button>
        </div>

        <button
          type="button"
          class="add-symbol-btn {showAddAlert ? 'active' : ''}"
          title="Buat Price Alert Baru"
          onclick={handleTriggerOpenCreateAlert}
        >
          <Plus size={13} />
          <span>Alert</span>
        </button>
      </div>

      {#if showAddAlert}
        <form class="alert-form" onsubmit={handleCreateAlert}>
          <div class="alert-input-group">
            <input
              type="number"
              step="any"
              placeholder="Target harga (e.g. 69500)..."
              bind:value={newAlertPrice}
              class="add-input mono-nums"
              required
            />
            <input
              type="text"
              placeholder="Catatan / Label..."
              bind:value={newAlertLabel}
              class="add-input"
            />
          </div>
          <button type="submit" class="submit-add-btn">Set Alert</button>
        </form>
      {/if}

      <div class="items-list alerts-list">
        {#each displayAlerts as a (a.id)}
          {@const condBadge = getConditionBadge(a.condition)}
          {@const distance = calculateAlertDistance(a.targetPrice, a.symbol)}
          <div class="alert-card {a.triggered ? 'triggered' : ''} {!a.active ? 'paused' : ''}">
            <div class="alert-main">
              <!-- Baris Atas: Simbol, Badge Kondisi, & Status -->
              <div class="alert-top">
                <button
                  type="button"
                  class="alert-sym-btn mono-nums"
                  title="Beralih grafik ke simbol {a.symbol}"
                  onclick={() => onSelectSymbol(a.symbol)}
                >
                  <span class="sym-txt">{a.symbol}</span>
                </button>

                <span class="badge-cond {condBadge.class}">
                  {condBadge.label}
                </span>

                {#if a.triggered}
                  <span class="badge-alert triggered">TRIGGERED</span>
                {:else if !a.active}
                  <span class="badge-alert paused">PAUSED</span>
                {:else}
                  <span class="badge-alert active">ACTIVE</span>
                {/if}
              </div>

              <!-- Baris Tengah: Target Price & Selisih Jarak -->
              <div class="alert-price-row mono-nums">
                <span class="target-val">${formatPrice(a.targetPrice)}</span>
                {#if distance && a.active && !a.triggered}
                  <span class="distance-pill {distance.isBull ? 'pill-bull' : 'pill-bear'}">
                    {distance.pctText} ({distance.diffText})
                  </span>
                {:else if a.triggered && a.triggeredPrice}
                  <span class="hit-pill">
                    Hit @ ${formatPrice(a.triggeredPrice)}
                  </span>
                {/if}
              </div>

              <!-- Baris Bawah: Catatan Label -->
              {#if a.label}
                <span class="alert-label">{a.label}</span>
              {/if}
            </div>

            <!-- Tombol Aksi Kontrol Alert -->
            <div class="alert-actions">
              {#if a.triggered}
                <button
                  type="button"
                  class="icon-alert-btn reset"
                  title="Aktifkan kembali alert ini"
                  onclick={() => handleResetAlert(a.id)}
                >
                  <RotateCcw size={12} />
                </button>
              {:else}
                <button
                  type="button"
                  class="icon-alert-btn toggle {a.active ? 'active' : ''}"
                  title={a.active ? 'Jeda alert ini' : 'Aktifkan alert ini'}
                  onclick={() => handleToggleAlert(a.id)}
                >
                  {#if a.active}
                    <Pause size={12} />
                  {:else}
                    <Play size={12} />
                  {/if}
                </button>
              {/if}

              <button
                type="button"
                class="icon-alert-btn delete"
                title="Hapus Price Alert ini"
                onclick={() => handleRemoveAlert(a.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}

        {#if displayAlerts.length === 0}
          <div class="empty-state alert-empty">
            <span class="empty-icon"><Bell size={24} /></span>
            <span class="empty-title">Belum ada Price Alert</span>
            <p class="empty-sub">
              Klik kanan pada grafik di harga mana pun untuk membuat alert instan, atau klik tombol <strong>+ Alert</strong> di atas.
            </p>
          </div>
        {/if}
      </div>

    <!-- TAB 3: OBJECT TREE & INDICATOR LAYERS -->
    {:else if activeTab === 'objects'}
      <div class="sub-toolbar">
        <span class="sub-title">Layer Objek & Indikator</span>
        <span class="layer-count mono-nums">{activeIndicators.length} Aktif</span>
      </div>

      <div class="items-list objects-list">
        {#each activeIndicators as ind (ind.id)}
          <div class="layer-item">
            <div class="layer-info">
              <span class="layer-icon"><Layers size={13} /></span>
              <span class="layer-name">{ind.title}</span>
            </div>

            <div class="layer-actions">
              <button
                class="icon-action-btn {ind.visible ? 'visible' : 'hidden'}"
                title={ind.visible ? 'Sembunyikan' : 'Tampilkan'}
                onclick={() => onToggleIndicatorVisibility?.(ind.id)}
              >
                {#if ind.visible}
                  <Eye size={13} />
                {:else}
                  <EyeOff size={13} />
                {/if}
              </button>

              <button
                class="icon-action-btn delete"
                title="Hapus Indikator"
                onclick={() => onRemoveIndicator?.(ind.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        {/each}

        {#if activeIndicators.length === 0}
          <div class="empty-state">
            <span>Tidak ada indikator kustom aktif di chart.</span>
          </div>
        {/if}
      </div>
    {/if}
  </aside>
{/if}

<SymbolSearchModal
  isOpen={isSymbolSearchOpen}
  activeSymbol={activeSymbol}
  activeProviderId={activeProviderId}
  watchlistSymbols={symbols}
  onSelectSymbol={onSelectSymbol}
  onToggleWatchlistSymbol={handleToggleSymbolFromSearch}
  onClose={() => (isSymbolSearchOpen = false)}
/>

<style>
  .collapsed-toggle-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 35;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-right: none;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    padding: 10px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .collapsed-toggle-btn:hover {
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .vertical-label {
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .right-panel {
    width: 300px;
    height: 100%;
    background-color: var(--bg-surface);
    border-left: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    z-index: 30;
    flex-shrink: 0;
    overflow: hidden;
  }

  /* Header & Tabs */
  .panel-header {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .panel-tabs {
    display: flex;
    gap: 2px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tab-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tab-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-base);
    font-weight: 600;
  }

  .count-pill {
    font-size: 9px;
    background-color: var(--bg-container);
    color: var(--text-dim);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .tab-btn.active .count-pill {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
  }

  .collapse-action-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 4px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .collapse-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  /* Sub Toolbar */
  .sub-toolbar {
    padding: 6px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }

  .sub-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .layer-count {
    font-size: 10px;
    color: var(--text-dim);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 3px 6px;
    flex: 1;
  }

  .search-icon {
    color: var(--text-dim);
  }

  .search-input {
    background: none;
    border: none;
    color: var(--text-main);
    font-size: 11px;
    width: 100%;
    outline: none;
  }

  .clear-search-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 0;
  }

  .symbol-search-trigger-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-xs);
    color: #60a5fa;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .symbol-search-trigger-btn:hover {
    background-color: rgba(59, 130, 246, 0.22);
    border-color: #60a5fa;
    color: #93c5fd;
  }

  .add-symbol-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--brand-primary);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6px;
    cursor: pointer;
  }

  .add-symbol-btn:hover,
  .add-symbol-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
  }

  .add-form, .alert-form {
    padding: 6px 8px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    gap: 6px;
  }

  .alert-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .add-input {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    outline: none;
  }

  .add-input:focus {
    border-color: var(--border-focus);
  }

  .submit-add-btn {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border: none;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 700;
    padding: 0 8px;
    cursor: pointer;
  }

  /* Table Head */
  .table-head {
    display: grid;
    grid-template-columns: 100px 1fr 65px;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    font-size: 10px;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .col-symbol-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .active-feed-pill {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 3px;
    border-radius: 2px;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
    letter-spacing: 0.05em;
  }

  .col-price {
    text-align: right;
    padding-right: 8px;
  }

  .col-change {
    text-align: right;
  }

  /* Items List */
  .items-list {
    flex: 1;
    overflow-y: auto;
    background-color: var(--bg-surface);
  }

  .watchlist-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(30, 41, 59, 0.4);
    position: relative;
  }

  .watchlist-row:hover {
    background-color: var(--bg-hover);
  }

  .watchlist-row.active-row {
    background-color: rgba(59, 130, 246, 0.08);
    border-left: 2px solid var(--brand-blue);
  }

  .row-select-btn {
    display: grid;
    grid-template-columns: 100px 1fr 65px;
    align-items: center;
    padding: 5px 8px;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .row-symbol {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-pip {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  .pip-bull {
    background-color: var(--bull-color);
  }

  .pip-bear {
    background-color: var(--bear-color);
  }

  .symbol-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .type-tag {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 3px;
    border-radius: 2px;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .type-tag.perp {
    background-color: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .type-tag.spot {
    background-color: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .row-price {
    font-size: 11px;
    color: var(--text-main);
    text-align: right;
    padding-right: 8px;
  }

  .row-change {
    text-align: right;
  }

  .change-pill {
    display: inline-block;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
  }

  .pill-bull {
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
  }

  .pill-bear {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.1);
  }

  .delete-item-btn {
    opacity: 0;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .watchlist-row:hover .delete-item-btn {
    opacity: 1;
  }

  .delete-item-btn:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.18);
    border-color: rgba(255, 59, 105, 0.4);
  }

  /* Alerts Sub Toolbar & Filters */
  .alert-sub-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
  }

  .alert-filter-tabs {
    display: flex;
    gap: 3px;
  }

  .filter-pill {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .filter-pill:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .filter-pill.active {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.25);
    font-weight: 600;
  }

  /* Alerts List */
  .alerts-list {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .alert-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 8px 10px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    position: relative;
    transition: all 0.15s ease;
  }

  .alert-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-medium);
  }

  .alert-card.triggered {
    border-color: rgba(255, 59, 105, 0.45);
    background-color: rgba(255, 59, 105, 0.06);
    box-shadow: 0 0 10px var(--bear-glow);
  }

  .alert-card.paused {
    opacity: 0.6;
    border-style: dashed;
  }

  .alert-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .alert-top {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .alert-sym-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
    display: inline-flex;
    align-items: center;
  }

  .alert-sym-btn:hover .sym-txt {
    color: var(--brand-primary);
    text-decoration: underline;
  }

  .badge-cond {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-cond.bull {
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--bull-color);
  }

  .badge-cond.bear {
    background-color: rgba(255, 59, 105, 0.12);
    color: var(--bear-color);
  }

  .badge-cond.cyan {
    background-color: rgba(56, 189, 248, 0.12);
    color: var(--brand-cyan);
  }

  .badge-cond.muted {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-dim);
  }

  .badge-alert {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-alert.active {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
  }

  .badge-alert.triggered {
    background-color: rgba(255, 59, 105, 0.2);
    color: var(--bear-color);
    animation: pulseTrigger 1.5s infinite;
  }

  @keyframes pulseTrigger {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .badge-alert.paused {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-dim);
  }

  .alert-price-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-val {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .distance-pill {
    font-size: 9.5px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .hit-pill {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .alert-label {
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .alert-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
  }

  .icon-alert-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .icon-alert-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .icon-alert-btn.toggle.active:hover {
    color: #eab308;
    background-color: rgba(234, 179, 8, 0.15);
  }

  .icon-alert-btn.reset:hover {
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.15);
  }

  .icon-alert-btn.delete:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.15);
  }

  .alert-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 30px 14px;
  }

  .empty-icon {
    color: var(--text-dim);
    opacity: 0.5;
  }

  .empty-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .empty-sub {
    font-size: 10px;
    color: var(--text-dim);
    line-height: 1.4;
    text-align: center;
  }

  /* Layer Objects */
  .objects-list {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .layer-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .layer-icon {
    color: var(--brand-primary);
  }

  .layer-name {
    font-size: 11px;
    color: var(--text-main);
    font-weight: 500;
  }

  .layer-actions {
    display: flex;
    gap: 4px;
  }

  .icon-action-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    padding: 3px;
    border-radius: var(--radius-xs);
    cursor: pointer;
  }

  .icon-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .icon-action-btn.delete:hover {
    color: var(--bear-color);
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
  }
</style>
