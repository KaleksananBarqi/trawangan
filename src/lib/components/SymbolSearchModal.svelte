<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Search, X, Check, Plus, ArrowRight, CornerDownLeft, Sparkles, TrendingUp, Layers } from '@lucide/svelte';
  import { marketFeed } from '../services/market';
  import { getSearchResultKey, parseAdaptiveSymbol } from '../services/market/symbolSearchService';
  import SymbolLogo from './common/SymbolLogo.svelte';
  import { formatWatchlistEntry, parseWatchlistEntry, normalizeProviderId } from '../services/watchlistUtils';
  import type { MarketSearchResult } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeSymbol: string;
    activeProviderId?: string;
    watchlistSymbols?: string[];
    initialQuery?: string;
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onToggleWatchlistSymbol?: (symbol: string) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    activeSymbol,
    activeProviderId = 'binance',
    watchlistSymbols = [],
    initialQuery = '',
    onSelectSymbol,
    onToggleWatchlistSymbol,
    onClose,
  }: Props = $props();

  let query = $state('');
  let filterType = $state<'all' | 'spot' | 'perp'>('all');
  let selectedExchange = $state<string>('all');
  let selectedQuote = $state<'all' | 'IDR' | 'USDT' | 'BTC'>('all');
  let searchResults = $state<MarketSearchResult[]>([]);
  let selectedIndex = $state(0);
  let searchInputEl = $state<HTMLInputElement | null>(null);
  let recentSearches = $state<string[]>([]);
  let liveTickerMap = $state<Record<string, { price: number; change24h: number }>>({});
  let availableProviders = $state<import('../types/market').ProviderConfig[]>([]);

  // Sinkronkan initialQuery saat modal dibuka (misal dari Type-to-Search)
  $effect(() => {
    if (isOpen) {
      query = initialQuery || '';
      selectedIndex = 0;
    }
  });

  function loadRecentSearches() {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('trawangan_recent_searches');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            recentSearches = parsed.slice(0, 5);
          }
        }
      } catch (_) {}
    }
  }

  function addRecentSearch(sym: string) {
    if (typeof localStorage !== 'undefined') {
      try {
        const clean = sym.toUpperCase();
        const filtered = recentSearches.filter((s) => s.toUpperCase() !== clean);
        const next = [clean, ...filtered].slice(0, 5);
        recentSearches = next;
        localStorage.setItem('trawangan_recent_searches', JSON.stringify(next));
      } catch (_) {}
    }
  }

  function clearRecentSearches() {
    recentSearches = [];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('trawangan_recent_searches');
      } catch (_) {}
    }
  }

  function formatPricePreview(price: number, quoteAsset = 'USDT'): string {
    if (!price || isNaN(price)) return '-';
    const q = (quoteAsset || 'USDT').toUpperCase();
    if (q === 'IDR') {
      if (price >= 1) {
        return `Rp ${Math.round(price).toLocaleString('id-ID')}`;
      }
      return `Rp ${price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    if (q === 'BTC') {
      return `${price.toFixed(8)} ₿`;
    }
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Perbarui hasil pencarian saat query, filter, exchange, atau quote berubah
  $effect(() => {
    if (isOpen) {
      loadRecentSearches();
      marketFeed.getSavedProviders().then((res) => (availableProviders = res));

      // Respon Instan (< 5ms) dari cache lokal / registry offline sebelum agregasi jaringan
      const localResults = marketFeed.searchLocalSymbols(query, {
        filterType,
        exchange: selectedExchange as any,
        quoteAsset: selectedQuote,
      });
      if (localResults.length > 0) {
        searchResults = localResults;
        selectedIndex = 0;
      }

      marketFeed
        .searchSymbols(query, {
          filterType,
          exchange: selectedExchange as any,
          quoteAsset: selectedQuote,
        })
        .then((res) => {
          searchResults = res;
          selectedIndex = 0;
          // Ambil preview ticker 24h untuk 20 item pertama
          const symbols = res.slice(0, 20).map((r) => r.symbol);
          if (symbols.length > 0) {
            marketFeed
              .getWatchlistTickers(symbols)
              .then((tickers) => {
                liveTickerMap = { ...liveTickerMap, ...tickers };
              })
              .catch(() => {});
          }
        });
    }
  });

  // Auto-focus input saat modal dibuka
  $effect(() => {
    if (isOpen) {
      tick().then(() => {
        searchInputEl?.focus();
        searchInputEl?.select();
      });
    }
  });

  function scrollSelectedIntoView() {
    tick().then(() => {
      const el = document.querySelector('.result-item-row.highlighted');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % searchResults.length;
        scrollSelectedIntoView();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        selectedIndex = (selectedIndex - 1 + searchResults.length) % searchResults.length;
        scrollSelectedIntoView();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handlePickSymbol(searchResults[selectedIndex].symbol, searchResults[selectedIndex].provider);
      }
    }
  }

  function handlePickSymbol(sym: string, providerId?: string) {
    addRecentSearch(sym);
    onSelectSymbol(sym, providerId);
    onClose();
  }

  function handleToggleWatchlist(e: MouseEvent, sym: string) {
    e.stopPropagation();
    e.preventDefault();
    onToggleWatchlistSymbol?.(sym);
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="modal-backdrop"
    onclick={onClose}
    role="presentation"
  >
    <!-- Modal Window (Click propagation stopped) -->
    <div
      class="search-modal-card obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Simbol Kripto"
    >
      <!-- Top Input & Action Bar -->
      <div class="search-input-header">
        <div class="search-input-box">
          <Search size={16} class="search-icon" />
          <input
            bind:this={searchInputEl}
            bind:value={query}
            type="text"
            placeholder="Cari pair crypto (misal: BTC, BTCUSDT.P, SOL, PEPE)..."
            class="modal-input mono-nums"
          />
          {#if query}
            <button
              type="button"
              class="clear-btn"
              title="Hapus pencarian"
              onclick={() => {
                query = '';
                searchInputEl?.focus();
              }}
            >
              <X size={14} />
            </button>
          {/if}
        </div>
        <button
          type="button"
          class="close-modal-btn"
          title="Tutup dialog (Esc)"
          onclick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <!-- Filter Tabs & Provider Context -->
      <div class="filter-toolbar">
        <div class="filter-primary-row">
          <div class="filter-tabs">
            <button
              type="button"
              class="filter-tab-btn {filterType === 'all' ? 'active' : ''}"
              onclick={() => (filterType = 'all')}
            >
              Semua Tipe
            </button>
            <button
              type="button"
              class="filter-tab-btn {filterType === 'spot' ? 'active' : ''}"
              onclick={() => (filterType = 'spot')}
            >
              Spot
            </button>
            <button
              type="button"
              class="filter-tab-btn {filterType === 'perp' ? 'active' : ''}"
              onclick={() => (filterType = 'perp')}
            >
              <span class="perp-dot"></span> Perpetuals (.P)
            </button>
          </div>

          <div class="active-feed-info">
            <span class="feed-label">Sumber:</span>
            <span class="feed-badge {activeProviderId}">
              {activeProviderId === 'indodax' ? 'INDODAX SPOT (IDR)' : activeProviderId === 'bitunix' ? 'BITUNIX FUTURES' : 'BINANCE SPOT/FUTURES'}
            </span>
          </div>
        </div>

        <!-- Baris Kedua: Exchange & Quote Filter Chips -->
        <div class="sub-filters-row">
          <div class="chips-group">
            <span class="chips-label">Bursa:</span>
            <button
              type="button"
              class="filter-chip {selectedExchange === 'all' ? 'active' : ''}"
              onclick={() => (selectedExchange = 'all')}
            >
              Semua
            </button>
            <button
              type="button"
              class="filter-chip {selectedExchange === 'indodax' ? 'active' : ''}"
              onclick={() => (selectedExchange = 'indodax')}
            >
              Indodax
            </button>
            <button
              type="button"
              class="filter-chip {selectedExchange === 'binance' ? 'active' : ''}"
              onclick={() => (selectedExchange = 'binance')}
            >
              Binance
            </button>
            <button
              type="button"
              class="filter-chip {selectedExchange === 'bitunix' ? 'active' : ''}"
              onclick={() => (selectedExchange = 'bitunix')}
            >
              Bitunix
            </button>
            {#each availableProviders.filter((p) => !['binance', 'indodax', 'bitunix'].includes(p.id)) as cProv (cProv.id)}
              <button
                type="button"
                class="filter-chip {selectedExchange === cProv.id ? 'active' : ''}"
                onclick={() => (selectedExchange = cProv.id)}
              >
                {cProv.name}
              </button>
            {/each}
          </div>

          <div class="chips-divider"></div>

          <div class="chips-group">
            <span class="chips-label">Quote:</span>
            <button
              type="button"
              class="filter-chip {selectedQuote === 'all' ? 'active' : ''}"
              onclick={() => (selectedQuote = 'all')}
            >
              Semua
            </button>
            <button
              type="button"
              class="filter-chip {selectedQuote === 'IDR' ? 'active' : ''}"
              onclick={() => (selectedQuote = 'IDR')}
            >
              IDR (Rp)
            </button>
            <button
              type="button"
              class="filter-chip {selectedQuote === 'USDT' ? 'active' : ''}"
              onclick={() => (selectedQuote = 'USDT')}
            >
              USDT ($)
            </button>
            <button
              type="button"
              class="filter-chip {selectedQuote === 'BTC' ? 'active' : ''}"
              onclick={() => (selectedQuote = 'BTC')}
            >
              BTC (₿)
            </button>
          </div>
        </div>
      </div>

      <!-- Results List Container -->
      <div class="results-container">
        {#if !query.trim() && recentSearches.length > 0}
          <div class="recent-searches-box">
            <div class="recent-header">
              <span class="recent-label">Terakhir Dicari</span>
              <button
                type="button"
                class="clear-recent-btn"
                onclick={clearRecentSearches}
              >
                Hapus
              </button>
            </div>
            <div class="recent-chips">
              {#each recentSearches as rSym}
                {@const p = parseAdaptiveSymbol(rSym)}
                <button
                  type="button"
                  class="recent-chip mono-nums"
                  onclick={() => handlePickSymbol(rSym)}
                >
                  <SymbolLogo baseAsset={p.baseAsset} quoteAsset={p.quoteAsset} size="xs" />
                  <span>{rSym}</span>
                  <ArrowRight size={10} class="recent-arrow" />
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if searchResults.length > 0}
          <div class="results-list" role="listbox">
            {#each searchResults as item, index (getSearchResultKey(item))}
              {@const isWatchlisted = watchlistSymbols.some((w) => {
                const p = parseWatchlistEntry(w);
                return p.symbol === item.symbol.toUpperCase() && p.providerId === normalizeProviderId(item.provider);
              })}
              {@const isCurrentChart = activeSymbol === item.symbol}
              {@const isHighlighted = selectedIndex === index}

              <div
                class="result-item-row {isHighlighted ? 'highlighted' : ''} {isCurrentChart ? 'current-active' : ''}"
                onclick={() => handlePickSymbol(item.symbol, item.provider)}
                onkeydown={(e) => {
                  if (e.key === 'Enter') handlePickSymbol(item.symbol, item.provider);
                }}
                onmouseenter={() => (selectedIndex = index)}
                role="button"
                tabindex="0"
              >
                <!-- Left: Logo + Symbol + Type Tag + Name -->
                <div class="item-left">
                  <SymbolLogo baseAsset={item.baseAsset} quoteAsset={item.quoteAsset} size="md" />
                  <div class="item-text-info">
                    <div class="symbol-title-row">
                      <span class="symbol-name mono-nums">{item.baseAsset}</span>
                      <span class="quote-currency mono-nums">/{item.quoteAsset}</span>
                      {#if item.type === 'perp'}
                        <span class="type-badge perp mono-nums">.P PERP</span>
                      {:else}
                        <span class="type-badge spot mono-nums">SPOT</span>
                      {/if}
                    </div>
                    <div class="item-desc">
                      <span>{item.displayName}</span>
                      <span class="separator">·</span>
                      <span class="venue-tag">{item.provider}</span>
                    </div>
                  </div>
                </div>

                <!-- Right: Live Ticker Preview, Action Button & Active Marker -->
                <div class="item-right">
                  {#if liveTickerMap[item.symbol]}
                    {@const ticker = liveTickerMap[item.symbol]}
                    <div class="ticker-preview-col">
                      <span class="preview-price mono-nums">
                        {formatPricePreview(ticker.price, item.quoteAsset)}
                      </span>
                      <span class="preview-change mono-nums {ticker.change24h >= 0 ? 'pos' : 'neg'}">
                        {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
                      </span>
                    </div>
                  {/if}

                  {#if isCurrentChart}
                    <span class="active-chart-badge">
                      <span class="live-dot"></span> Aktif
                    </span>
                  {/if}

                  <button
                    type="button"
                    class="watchlist-toggle-btn {isWatchlisted ? 'in-watchlist' : 'add-action'}"
                    title={isWatchlisted ? 'Hapus dari Watchlist' : 'Tambahkan ke Watchlist'}
                    onclick={(e) => handleToggleWatchlist(e, formatWatchlistEntry(item.symbol, item.provider))}
                    onpointerdown={(e) => e.stopPropagation()}
                  >
                    {#if isWatchlisted}
                      <Check size={12} />
                      <span>Watchlist</span>
                    {:else}
                      <Plus size={12} />
                      <span>Watchlist</span>
                    {/if}
                  </button>

                  <div class="select-indicator" title="Buka Chart">
                    <CornerDownLeft size={13} />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-results-box">
            <Search size={28} class="empty-icon" />
            <span class="empty-title">Tidak ada pair kripto yang cocok</span>
            <span class="empty-subtitle">
              Coba cari ticker lain atau gunakan format simbol seperti <code>BTC/IDR</code> atau <code>BTCUSDT.P</code>
            </span>
          </div>
        {/if}
      </div>

      <!-- Footer: Keyboard Navigation Helper -->
      <div class="modal-footer">
        <div class="shortcut-hints">
          <span class="shortcut-item">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigasi
          </span>
          <span class="shortcut-item">
            <kbd>↵ Enter</kbd> Buka di Chart
          </span>
          <span class="shortcut-item">
            <kbd>Esc</kbd> Tutup
          </span>
        </div>
        <div class="footer-tip">
          <span>Tip: Simbol berakhiran <b>.P</b> memuat data Futures Perpetual</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .search-modal-card {
    width: 580px;
    max-width: 92vw;
    background-color: var(--bg-surface, #121820);
    border: 1px solid var(--border-medium, #2a3441);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Header Input Area */
  .search-input-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-hairline, #1f2733);
    background-color: var(--bg-panel, #0f141c);
    gap: 10px;
  }

  .search-input-box {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  :global(.search-icon) {
    color: var(--brand-primary, #00f090);
    flex-shrink: 0;
  }

  .modal-input {
    background: none;
    border: none;
    outline: none;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-main, #f1f5f9);
    width: 100%;
    letter-spacing: 0.02em;
  }

  .modal-input::placeholder {
    color: var(--text-dim, #64748b);
    font-size: 13px;
  }

  .clear-btn, .close-modal-btn {
    background: none;
    border: none;
    color: var(--text-dim, #64748b);
    padding: 4px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .clear-btn:hover, .close-modal-btn:hover {
    color: var(--text-main, #f1f5f9);
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  /* Filter Toolbar */
  .filter-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 14px;
    background-color: var(--bg-container, #161e29);
    border-bottom: 1px solid var(--border-hairline, #1f2733);
  }

  .filter-primary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sub-filters-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .chips-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .chips-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-dim, #64748b);
    margin-right: 2px;
  }

  .chips-divider {
    width: 1px;
    height: 14px;
    background-color: var(--border-hairline, #2a3441);
  }

  .filter-chip {
    background: none;
    border: 1px solid var(--border-hairline, #2a3441);
    color: var(--text-muted, #94a3b8);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .filter-chip:hover {
    color: var(--text-main, #f1f5f9);
    background-color: rgba(255, 255, 255, 0.06);
  }

  .filter-chip.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: rgba(0, 240, 144, 0.35);
    color: var(--brand-primary, #00f090);
    font-weight: 600;
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
  }

  .filter-tab-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--text-muted, #94a3b8);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.12s ease;
  }

  .filter-tab-btn:hover {
    color: var(--text-main, #f1f5f9);
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }

  .filter-tab-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: rgba(0, 240, 144, 0.3);
    color: var(--brand-primary, #00f090);
  }

  .perp-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #eab308;
  }

  .active-feed-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
  }

  .feed-label {
    color: var(--text-dim, #64748b);
  }

  .feed-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
  }

  .feed-badge.indodax {
    background-color: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(37, 99, 235, 0.3);
  }

  .feed-badge.bitunix {
    background-color: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .feed-badge.binance {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  /* Recent Searches */
  .recent-searches-box {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background-color: rgba(0, 0, 0, 0.2);
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
  }

  .recent-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim, #64748b);
  }

  .clear-recent-btn {
    background: none;
    border: none;
    font-size: 10px;
    color: var(--text-dim, #64748b);
    cursor: pointer;
    padding: 0;
  }

  .clear-recent-btn:hover {
    color: #f87171;
  }

  .recent-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .recent-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-container, #161e29);
    border: 1px solid var(--border-hairline, #2a3441);
    color: var(--text-main, #f1f5f9);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .recent-chip:hover {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: rgba(0, 240, 144, 0.3);
    color: var(--brand-primary, #00f090);
  }

  :global(.recent-arrow) {
    color: var(--text-dim, #64748b);
  }

  /* Ticker Preview Column */
  .ticker-preview-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-right: 4px;
    line-height: 1.2;
  }

  .preview-price {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main, #f1f5f9);
  }

  .preview-change {
    font-size: 10px;
    font-weight: 600;
  }

  .preview-change.pos {
    color: var(--brand-primary, #00f090);
  }

  .preview-change.neg {
    color: #ef4444;
  }

  /* Results List */
  .results-container {
    max-height: 380px;
    overflow-y: auto;
    background-color: var(--bg-surface, #121820);
  }

  .results-list {
    display: flex;
    flex-direction: column;
  }

  .result-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(30, 41, 59, 0.3);
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .result-item-row:hover,
  .result-item-row.highlighted {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }

  .result-item-row.current-active {
    border-left: 2px solid var(--brand-primary, #00f090);
  }

  .item-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .item-text-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .symbol-title-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .symbol-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #f1f5f9);
  }

  .quote-currency {
    font-size: 11px;
    color: var(--text-dim, #64748b);
  }

  .type-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .type-badge.perp {
    background-color: rgba(234, 179, 8, 0.16);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .type-badge.spot {
    background-color: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .item-desc {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, #94a3b8);
  }

  .separator {
    color: var(--text-dim, #64748b);
  }

  .venue-tag {
    font-size: 10px;
    color: var(--text-dim, #64748b);
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .active-chart-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 600;
    color: var(--brand-primary, #00f090);
    background-color: rgba(0, 240, 144, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--brand-primary, #00f090);
    box-shadow: 0 0 6px var(--brand-primary, #00f090);
  }

  .watchlist-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 7px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .watchlist-toggle-btn.add-action {
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-hairline, #2a3441);
    color: var(--text-muted, #94a3b8);
  }

  .watchlist-toggle-btn.add-action:hover {
    background-color: rgba(0, 240, 144, 0.15);
    border-color: var(--brand-primary, #00f090);
    color: var(--brand-primary, #00f090);
  }

  .watchlist-toggle-btn.in-watchlist {
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: #60a5fa;
  }

  .watchlist-toggle-btn.in-watchlist:hover {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .select-indicator {
    color: var(--text-dim, #64748b);
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .result-item-row.highlighted .select-indicator {
    color: var(--brand-primary, #00f090);
  }

  /* Empty State */
  .empty-results-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    gap: 6px;
    text-align: center;
  }

  :global(.empty-icon) {
    color: var(--text-dim, #64748b);
    margin-bottom: 4px;
    opacity: 0.6;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted, #94a3b8);
  }

  .empty-subtitle {
    font-size: 11px;
    color: var(--text-dim, #64748b);
  }

  .empty-subtitle code {
    background-color: var(--bg-container, #161e29);
    color: var(--brand-primary, #00f090);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: inherit;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 14px;
    background-color: var(--bg-panel, #0f141c);
    border-top: 1px solid var(--border-hairline, #1f2733);
    font-size: 10px;
    color: var(--text-dim, #64748b);
  }

  .shortcut-hints {
    display: flex;
    gap: 12px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  kbd {
    background-color: var(--bg-container, #161e29);
    border: 1px solid var(--border-hairline, #2a3441);
    border-radius: 3px;
    padding: 1px 4px;
    font-family: inherit;
    font-size: 9px;
    color: var(--text-muted, #94a3b8);
  }

  .footer-tip b {
    color: var(--brand-primary, #00f090);
  }
</style>
