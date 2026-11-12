<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import {
    X,
    Check,
    ChevronDown,
    Pencil,
    MoreHorizontal,
    Folder,
    GripVertical,
    Trash2
  } from '@lucide/svelte';
  import { marketFeed } from '../../services/market';
  import {
    parseWatchlistEntry,
    isSectionToken,
    formatSectionToken,
    parseSectionToken,
    moveItemToSection,
    reorderWatchlistItems,
    removeSymbolFromWatchlist,
    type WatchlistSectionToken
  } from '../../services/watchlistUtils';
  import { parseAdaptiveSymbol } from '../../services/market/symbolSearchService';
  import { formatPriceLabel } from '../../services/priceScaleLabelService';
  import { resolveMacroIndexDescriptor } from '../../services/macroIndexCatalog';
  import { watchlistRegistry } from '../../services/watchlistRegistryService';
  import WatchlistSwitcher from '../WatchlistSwitcher.svelte';
  import SymbolLogo from '../common/SymbolLogo.svelte';
  import type { WatchlistRecord } from '../../types/market';

  interface SectionGroup {
    section: WatchlistSectionToken | null;
    items: string[];
  }

  interface Props {
    symbols: string[];
    activeSymbol: string;
    activeProviderId: string;
    registryWatchlists: WatchlistRecord[];
    activeWatchlist: WatchlistRecord;
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onUpdateWatchlist: (nextSymbols: string[]) => Promise<void>;
  }

  let {
    symbols,
    activeSymbol,
    activeProviderId,
    registryWatchlists,
    activeWatchlist,
    onSelectSymbol,
    onUpdateWatchlist,
  }: Props = $props();

  let tickerMap = $state<
    Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>
  >({});
  let unsubWatchlistFeed: (() => void) | null = null;

  // State modal dan menu kategori (section)
  let showRenameSectionModal = $state(false);
  let renameSectionId = $state<string | null>(null);
  let renameSectionValue = $state('');
  let activeSectionMenuId = $state<string | null>(null);

  // State menu konteks koin ("Pindahkan ke Kategori...")
  let activeCoinMenuSymbol = $state<string | null>(null);

  // State drag & drop urutan watchlist
  let draggedItemIndex = $state<number | null>(null);
  let dragOverItemIndex = $state<number | null>(null);
  let dragOverPosition = $state<'before' | 'after'>('before');

  $effect(() => {
    const syms = symbols;
    if (syms && syms.length > 0) {
      if (unsubWatchlistFeed) unsubWatchlistFeed();
      unsubWatchlistFeed = untrack(() => {
        return marketFeed.subscribeWatchlistTickers(syms, (newMap) => {
          tickerMap = { ...tickerMap, ...newMap };
        });
      });
      return () => {
        if (unsubWatchlistFeed) {
          unsubWatchlistFeed();
          unsubWatchlistFeed = null;
        }
      };
    }
  });

  onDestroy(() => {
    if (unsubWatchlistFeed) {
      unsubWatchlistFeed();
      unsubWatchlistFeed = null;
    }
  });

  function handleSelectRowSymbol(rawEntry: string) {
    const { providerId, symbol } = parseWatchlistEntry(rawEntry);
    onSelectSymbol(symbol, providerId);
  }

  async function handleRemoveSymbol(e: MouseEvent, rawEntry: string) {
    e.stopPropagation();
    e.preventDefault();
    await onUpdateWatchlist(removeSymbolFromWatchlist(symbols, rawEntry));
  }

  const groupedSections = $derived.by<SectionGroup[]>(() => {
    const groups: SectionGroup[] = [];
    let current: SectionGroup = { section: null, items: [] };

    for (const item of symbols) {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed) {
          if (current.section !== null || current.items.length > 0) {
            groups.push(current);
          }
          current = { section: parsed, items: [] };
          continue;
        }
      }
      current.items.push(item);
    }

    if (current.section !== null || current.items.length > 0) {
      groups.push(current);
    }

    return groups;
  });

  const availableSections = $derived.by<WatchlistSectionToken[]>(() => {
    const list: WatchlistSectionToken[] = [];
    for (const item of symbols) {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed) list.push(parsed);
      }
    }
    return list;
  });

  async function handleToggleSectionCollapse(sectionId: string) {
    const next = symbols.map((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed && parsed.id === sectionId) {
          return formatSectionToken(parsed.name, parsed.id, !parsed.isCollapsed);
        }
      }
      return item;
    });
    await onUpdateWatchlist(next);
  }

  function openRenameSection(section: WatchlistSectionToken, e: MouseEvent) {
    e.stopPropagation();
    renameSectionId = section.id;
    renameSectionValue = section.name;
    showRenameSectionModal = true;
    activeSectionMenuId = null;
  }

  async function handleRenameSectionSubmit() {
    if (!renameSectionId || !renameSectionValue.trim()) return;
    const clean = renameSectionValue.trim().toUpperCase();
    const next = symbols.map((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed && parsed.id === renameSectionId) {
          return formatSectionToken(clean, parsed.id, parsed.isCollapsed);
        }
      }
      return item;
    });
    await onUpdateWatchlist(next);
    showRenameSectionModal = false;
    renameSectionId = null;
    renameSectionValue = '';
  }

  async function handleDeleteSection(sectionId: string, e: MouseEvent) {
    e.stopPropagation();
    activeSectionMenuId = null;
    const next = symbols.filter((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        return parsed?.id !== sectionId;
      }
      return true;
    });
    await onUpdateWatchlist(next);
  }

  function handleDragStart(e: DragEvent, index: number) {
    draggedItemIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    dragOverPosition = e.clientY < midY ? 'before' : 'after';
    dragOverItemIndex = index;
  }

  async function handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      draggedItemIndex = null;
      dragOverItemIndex = null;
      return;
    }

    const reordered = reorderWatchlistItems(symbols, draggedItemIndex, targetIndex, dragOverPosition);
    draggedItemIndex = null;
    dragOverItemIndex = null;
    await onUpdateWatchlist(reordered);
  }

  function handleDragEnd() {
    draggedItemIndex = null;
    dragOverItemIndex = null;
  }

  async function handleMoveSymbolToSection(sym: string, targetSecId: string | null) {
    activeCoinMenuSymbol = null;
    const updated = moveItemToSection(symbols, sym, targetSecId);
    await onUpdateWatchlist(updated);
  }

  function formatPrice(p?: number, sym?: string): string {
    if (!p) return '--';
    const macroDesc = sym ? resolveMacroIndexDescriptor(sym) : null;
    if (macroDesc) {
      const compact = formatPriceLabel(p, macroDesc.quoteUnit, sym);
      return macroDesc.quoteUnit === '%' ? compact : `$${compact}`;
    }
    const quote = sym ? parseAdaptiveSymbol(sym).quoteAsset : undefined;
    if (quote === 'IDR') {
      return `Rp ${formatPriceLabel(p, 'IDR')}`;
    }
    return formatPriceLabel(p, quote, sym);
  }
</script>

<!-- Multi-Watchlist Switcher Popover -->
<WatchlistSwitcher
  {activeWatchlist}
  watchlists={registryWatchlists}
  onSelectWatchlist={async (id) => {
    await watchlistRegistry.setActiveWatchlistId(id);
  }}
  onCreateWatchlist={async (name) => {
    await watchlistRegistry.createWatchlist(name);
  }}
  onRenameWatchlist={async (id, name) => {
    await watchlistRegistry.renameWatchlist(id, name);
  }}
  onDuplicateWatchlist={async (id) => {
    await watchlistRegistry.duplicateWatchlist(id);
  }}
  onDeleteWatchlist={async (id) => {
    await watchlistRegistry.deleteWatchlist(id);
  }}
  onResetPreset={async (id) => {
    await watchlistRegistry.resetPresetWatchlist(id);
  }}
/>

<!-- Feed Status & Header Kolom -->
<div class="table-head mono-nums">
  <div class="col-symbol-wrapper">
    <span class="col-symbol">Symbol</span>
    <span class="active-feed-pill">{activeProviderId.toUpperCase()}</span>
  </div>
  <span class="col-price">Last Price</span>
  <span class="col-change">24h %</span>
</div>

<!-- Daftar Watchlist -->
<div class="items-list">
  {#each groupedSections as group (group.section ? group.section.id : '__uncat__')}
      {#if group.section}
        {@const sec = group.section}
        {@const secTokenStr = symbols.find((s) => isSectionToken(s) && parseSectionToken(s)?.id === sec.id) || ''}
        {@const secGlobalIndex = symbols.indexOf(secTokenStr)}
        <div
          class="section-divider-row {sec.isCollapsed ? 'collapsed' : ''} {dragOverItemIndex === secGlobalIndex && dragOverPosition === 'before' ? 'drop-target-before' : ''} {dragOverItemIndex === secGlobalIndex && dragOverPosition === 'after' ? 'drop-target-after' : ''} {draggedItemIndex === secGlobalIndex ? 'is-dragging' : ''}"
          draggable="true"
          role="group"
          aria-label="Kategori {sec.name}"
          ondragstart={(e) => handleDragStart(e, secGlobalIndex)}
          ondragover={(e) => handleDragOver(e, secGlobalIndex)}
          ondrop={(e) => handleDrop(e, secGlobalIndex)}
          ondragend={handleDragEnd}
        >
          <button
            type="button"
            class="section-toggle-btn"
            onclick={() => handleToggleSectionCollapse(sec.id)}
            title={sec.isCollapsed ? 'Bentangkan kategori' : 'Lipat kategori'}
          >
            <ChevronDown size={11} class="section-chevron {sec.isCollapsed ? 'collapsed' : ''}" />
            <span class="section-title">{sec.name}</span>
            <span class="section-count mono-nums">{group.items.length}</span>
          </button>

          <div class="section-menu-wrapper">
            <button
              type="button"
              class="btn-section-menu {activeSectionMenuId === sec.id ? 'active' : ''}"
              onclick={(e) => {
                e.stopPropagation();
                activeSectionMenuId = activeSectionMenuId === sec.id ? null : sec.id;
              }}
              title="Opsi kategori"
            >
              <MoreHorizontal size={12} />
            </button>

            {#if activeSectionMenuId === sec.id}
              <button
                type="button"
                class="menu-backdrop-btn"
                aria-label="Tutup menu kategori"
                onclick={() => (activeSectionMenuId = null)}
              ></button>
              <div class="section-dropdown-menu" role="menu">
                <button
                  type="button"
                  class="section-menu-item"
                  onclick={(e) => openRenameSection(sec, e)}
                >
                  <Pencil size={11} />
                  <span>Ganti Nama Kategori</span>
                </button>
                <button
                  type="button"
                  class="section-menu-item danger"
                  onclick={(e) => handleDeleteSection(sec.id, e)}
                >
                  <Trash2 size={11} />
                  <span>Hapus Kategori (Simpan Koin)</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if !group.section || !group.section.isCollapsed}
        {#each group.items as sym (sym)}
          {@const symGlobalIndex = symbols.indexOf(sym)}
          {@const entry = parseWatchlistEntry(sym)}
          {@const macroDesc = resolveMacroIndexDescriptor(entry.symbol)}
          {@const isMacroEntry = entry.providerId === 'macro' || Boolean(macroDesc)}
          {@const parsedPair = parseAdaptiveSymbol(entry.symbol)}
          {@const displaySymName = macroDesc ? macroDesc.shortName : parsedPair.baseAsset}
          {@const ticker = tickerMap[sym] || tickerMap[entry.symbol]}
          {@const isBull = (ticker?.change24h ?? 0) >= 0}
          {@const isCurrentActive = activeSymbol === entry.symbol && activeProviderId === entry.providerId}
          <div
            class="watchlist-row {isCurrentActive ? 'active-row' : ''} {dragOverItemIndex === symGlobalIndex && dragOverPosition === 'before' ? 'drop-target-before' : ''} {dragOverItemIndex === symGlobalIndex && dragOverPosition === 'after' ? 'drop-target-after' : ''} {draggedItemIndex === symGlobalIndex ? 'is-dragging' : ''}"
            draggable="true"
            role="listitem"
            ondragstart={(e) => handleDragStart(e, symGlobalIndex)}
            ondragover={(e) => handleDragOver(e, symGlobalIndex)}
            ondrop={(e) => handleDrop(e, symGlobalIndex)}
            ondragend={handleDragEnd}
            oncontextmenu={(e) => {
              e.preventDefault();
              activeCoinMenuSymbol = activeCoinMenuSymbol === sym ? null : sym;
            }}
          >
            <button
              type="button"
              class="row-select-btn"
              onclick={() => handleSelectRowSymbol(sym)}
            >
              <div class="row-symbol">
                <span class="row-drag-handle" title="Tarik untuk menata ulang urutan">
                  <GripVertical size={10} />
                </span>
                <span class="status-pip {isBull ? 'pip-bull' : 'pip-bear'}"></span>
                <SymbolLogo baseAsset={displaySymName} quoteAsset={isMacroEntry ? '' : parsedPair.quoteAsset} size="sm" />
                <span class="symbol-name">{displaySymName}</span>
                <span class="venue-badge {isMacroEntry ? 'macro' : entry.providerId} mono-nums">
                  {isMacroEntry ? 'IDX' : entry.providerId.toUpperCase()}
                </span>
                {#if isMacroEntry}
                  <span class="type-tag index mono-nums">{macroDesc?.quoteUnit === '%' ? 'DOM%' : 'MACRO'}</span>
                {:else if entry.symbol.endsWith('.P')}
                  <span class="type-tag perp mono-nums">.P</span>
                {:else if entry.symbol.endsWith('IDR')}
                  <span class="type-tag idr mono-nums">IDR</span>
                {:else if parsedPair.quoteAsset && parsedPair.quoteAsset !== 'USDT'}
                  <span class="type-tag spot mono-nums">{parsedPair.quoteAsset}</span>
                {:else}
                  <span class="type-tag spot mono-nums">SPOT</span>
                {/if}
              </div>

              <div
                class="row-price mono-nums"
                title={isMacroEntry && !ticker?.price ? 'Nilai indeks makro hanya dihitung saat grafik simbol ini dibuka' : undefined}
              >
                {formatPrice(ticker?.price, entry.symbol)}
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

            <div class="coin-row-actions">
              <div class="coin-menu-wrapper">
                <button
                  type="button"
                  class="btn-coin-menu {activeCoinMenuSymbol === sym ? 'active' : ''}"
                  title="Pindahkan koin ke kategori..."
                  onclick={(e) => {
                    e.stopPropagation();
                    activeCoinMenuSymbol = activeCoinMenuSymbol === sym ? null : sym;
                  }}
                >
                  <MoreHorizontal size={11} />
                </button>

                {#if activeCoinMenuSymbol === sym}
                  {@const currentSecId = group.section?.id ?? null}
                  <button
                    type="button"
                    class="menu-backdrop-btn coin-backdrop"
                    aria-label="Tutup menu kategori koin"
                    onclick={(e) => { e.stopPropagation(); activeCoinMenuSymbol = null; }}
                  ></button>
                  <div class="coin-dropdown-menu" role="menu">
                    <div class="coin-dropdown-header">Pindahkan ke Kategori:</div>
                    <button
                      type="button"
                      class="coin-menu-item {currentSecId === null ? 'current' : ''}"
                      onclick={(e) => {
                        e.stopPropagation();
                        handleMoveSymbolToSection(sym, null);
                      }}
                    >
                      <Folder size={11} />
                      <span class="menu-label">Tanpa Kategori (Bagian Atas)</span>
                      {#if currentSecId === null}
                        <Check size={11} class="menu-check" />
                      {/if}
                    </button>

                    {#each availableSections as avSec (avSec.id)}
                      <button
                        type="button"
                        class="coin-menu-item {currentSecId === avSec.id ? 'current' : ''}"
                        onclick={(e) => {
                          e.stopPropagation();
                          handleMoveSymbolToSection(sym, avSec.id);
                        }}
                      >
                        <Folder size={11} />
                        <span class="menu-label">{avSec.name}</span>
                        {#if currentSecId === avSec.id}
                          <Check size={11} class="menu-check" />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <button
                type="button"
                class="delete-item-btn"
                title="Hapus dari watchlist"
                onclick={(e) => handleRemoveSymbol(e, sym)}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    {/each}

  {#if symbols.filter((s) => !isSectionToken(s)).length === 0}
    <div class="empty-state">
      <span>Daftar pantau kosong. Tambahkan koin lewat tombol Bintang di Header atau tekan Ctrl+K.</span>
    </div>
  {/if}
</div>

<!-- Modal Ganti Nama Kategori / Section -->
{#if showRenameSectionModal}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal" role="dialog" aria-modal="true" aria-label="Ganti Nama Kategori">
      <div class="modal-header">
        <span>Ganti Nama Kategori</span>
        <button
          type="button"
          class="btn-close-modal"
          aria-label="Tutup modal"
          onclick={() => { showRenameSectionModal = false; renameSectionId = null; }}
        >
          <X size={13} />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); handleRenameSectionSubmit(); }}>
        <div class="modal-body">
          <label class="modal-label" for="rename-section-name">Nama Baru Kategori</label>
          <input
            id="rename-section-name"
            type="text"
            class="modal-input"
            placeholder="Nama kategori baru"
            bind:value={renameSectionValue}
          />
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={() => { showRenameSectionModal = false; renameSectionId = null; }}
          >
            Batal
          </button>
          <button type="submit" class="btn-modal-submit" disabled={!renameSectionValue.trim()}>
            Simpan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .table-head {
    display: grid;
    grid-template-columns: minmax(112px, 1.3fr) minmax(64px, 1fr) 58px;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .col-symbol-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .active-feed-pill {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    padding: 1px 3px;
    border-radius: var(--radius-xs);
    background-color: var(--bg-elevated);
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

  .items-list {
    flex: 1;
    overflow-y: auto;
    background-color: var(--bg-surface);
  }

  .watchlist-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid color-mix(in srgb, var(--border-hairline) 75%, transparent);
    position: relative;
  }

  .watchlist-row:hover {
    background-color: var(--bg-hover);
  }

  .watchlist-row.active-row {
    background-color: color-mix(in srgb, var(--brand-blue) 12%, transparent);
    border-left: 2px solid var(--brand-blue);
  }

  .row-select-btn {
    display: grid;
    grid-template-columns: minmax(112px, 1.3fr) minmax(64px, 1fr) 58px;
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
    gap: 3px;
    min-width: 0;
    white-space: nowrap;
  }

  .status-pip {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pip-bull {
    background-color: var(--bull-text);
  }

  .pip-bear {
    background-color: var(--bear-color);
  }

  .symbol-name {
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    color: var(--text-main);
  }

  .type-tag {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    padding: 1px 3px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .type-tag.perp {
    background-color: color-mix(in srgb, var(--status-warn) 15%, transparent);
    color: var(--status-warn);
    border: 1px solid color-mix(in srgb, var(--status-warn) 32%, transparent);
  }

  .type-tag.idr {
    background-color: color-mix(in srgb, var(--brand-blue) 15%, transparent);
    color: var(--brand-blue);
    border: 1px solid color-mix(in srgb, var(--brand-blue) 32%, transparent);
  }

  .type-tag.spot {
    background-color: var(--bg-elevated);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
  }

  .type-tag.index {
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 14%, transparent);
    color: var(--brand-cyan, #38bdf8);
    border: 1px solid color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
  }

  .venue-badge {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.05em;
    line-height: 1;
    text-transform: uppercase;
    background-color: var(--bg-elevated);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
  }

  .venue-badge.macro {
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 14%, transparent);
    color: var(--brand-cyan, #38bdf8);
    border-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
  }

  .venue-badge.binance {
    background-color: color-mix(in srgb, var(--status-warn) 14%, transparent);
    color: var(--status-warn);
    border-color: color-mix(in srgb, var(--status-warn) 30%, transparent);
  }

  .venue-badge.bitunix {
    background-color: color-mix(in srgb, var(--brand-purple) 14%, transparent);
    color: var(--brand-purple);
    border-color: color-mix(in srgb, var(--brand-purple) 30%, transparent);
  }

  .venue-badge.indodax,
  .venue-badge.coinbase {
    background-color: color-mix(in srgb, var(--brand-blue) 14%, transparent);
    color: var(--brand-blue);
    border-color: color-mix(in srgb, var(--brand-blue) 30%, transparent);
  }

  .venue-badge.hyperliquid {
    background-color: color-mix(in srgb, var(--bull-text) 14%, transparent);
    color: var(--bull-text);
    border-color: color-mix(in srgb, var(--bull-text) 30%, transparent);
  }

  .row-price {
    font-size: var(--font-size-base, 11px);
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
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
  }

  .pill-bull {
    color: var(--bull-text);
    background-color: color-mix(in srgb, var(--bull-text) 12%, transparent);
  }

  .pill-bear {
    color: var(--bear-color);
    background-color: color-mix(in srgb, var(--bear-color) 12%, transparent);
  }

  .change-placeholder {
    color: var(--text-dim);
    font-size: var(--font-size-sm, 10px);
  }

  .row-drag-handle {
    opacity: 0;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    cursor: grab;
    transition: opacity 0.12s ease;
    margin-right: -2px;
  }

  .watchlist-row:hover .row-drag-handle {
    opacity: 0.7;
  }

  .row-drag-handle:hover {
    opacity: 1 !important;
    color: var(--text-main);
  }

  .watchlist-row.drop-target-before,
  .section-divider-row.drop-target-before {
    border-top: 2px solid var(--brand-primary) !important;
  }

  .watchlist-row.drop-target-after,
  .section-divider-row.drop-target-after {
    border-bottom: 2px solid var(--brand-primary) !important;
  }

  .watchlist-row.is-dragging,
  .section-divider-row.is-dragging {
    opacity: 0.35 !important;
    background-color: var(--bg-elevated);
  }

  .coin-row-actions {
    opacity: 0;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 3px;
    transition: opacity 0.15s ease;
  }

  .watchlist-row:hover .coin-row-actions,
  .watchlist-row:focus-within .coin-row-actions {
    opacity: 1;
  }

  .coin-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .btn-coin-menu {
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
    transition: all 0.15s ease;
  }

  .btn-coin-menu:hover,
  .btn-coin-menu.active {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .menu-backdrop-btn {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: transparent;
    border: none;
    padding: 0;
    cursor: default;
  }

  .menu-backdrop-btn.coin-backdrop {
    z-index: 110;
  }

  .coin-dropdown-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 111;
    min-width: 190px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--bg-darkest) 70%, transparent);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .coin-dropdown-header {
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    padding: 4px 6px;
    border-bottom: 1px solid var(--border-hairline);
    margin-bottom: 2px;
  }

  .coin-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 5px 8px;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-base, 11px);
    text-align: left;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.1s ease;
  }

  .coin-menu-item:hover {
    background-color: var(--bg-hover);
  }

  .coin-menu-item.current {
    color: var(--brand-primary);
    font-weight: 600;
  }

  .menu-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.menu-check) {
    color: var(--brand-primary);
    flex-shrink: 0;
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
    transition: all 0.15s ease;
  }

  .coin-row-actions .delete-item-btn {
    position: static;
    transform: none;
    opacity: 1;
  }

  .watchlist-row:hover .delete-item-btn,
  .watchlist-row:focus-within .delete-item-btn {
    opacity: 1;
  }

  .delete-item-btn:hover {
    color: var(--status-danger);
    background-color: color-mix(in srgb, var(--status-danger) 16%, transparent);
    border-color: color-mix(in srgb, var(--status-danger) 40%, transparent);
  }

  /* Section Divider Row */
  .section-divider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border-top: 1px solid var(--border-hairline);
    border-bottom: 1px solid var(--border-hairline);
    position: relative;
    user-select: none;
    transition: background-color 0.12s ease;
  }

  .section-divider-row:hover {
    background-color: var(--bg-hover);
  }

  .section-divider-row.collapsed {
    opacity: 0.8;
  }

  .section-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-sm, 10px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    padding: 0;
    flex: 1;
    text-align: left;
    transition: color 0.12s ease;
  }

  .section-toggle-btn:hover {
    color: var(--text-main);
  }

  :global(.section-chevron) {
    color: var(--text-dim);
    transition: transform 0.15s ease;
  }

  :global(.section-chevron.collapsed) {
    transform: rotate(-90deg);
  }

  .section-title {
    color: var(--text-muted);
  }

  .section-toggle-btn:hover .section-title {
    color: var(--text-main);
  }

  .section-count {
    font-size: var(--font-size-xs, 9px);
    color: var(--text-dim);
    background-color: var(--bg-elevated);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .section-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .btn-section-menu {
    background: none;
    border: none;
    color: var(--text-dim);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
    opacity: 0.7;
  }

  .section-divider-row:hover .btn-section-menu,
  .btn-section-menu.active {
    opacity: 1;
  }

  .btn-section-menu:hover,
  .btn-section-menu.active {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .section-dropdown-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 101;
    min-width: 170px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--bg-darkest) 70%, transparent);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-base, 11px);
    text-align: left;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.1s ease;
  }

  .section-menu-item:hover {
    background-color: var(--bg-hover);
  }

  .section-menu-item.danger {
    color: var(--status-danger);
  }

  .section-menu-item.danger:hover {
    background-color: color-mix(in srgb, var(--status-danger) 14%, transparent);
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    font-size: var(--font-size-base, 11px);
    color: var(--text-dim);
  }

  /* Modal Rename Kategori */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--bg-darkest) 72%, transparent);
    backdrop-filter: blur(2px);
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .switcher-modal {
    background: var(--bg-panel);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 320px;
    box-shadow: 0 16px 36px color-mix(in srgb, var(--bg-darkest) 75%, transparent);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-hairline);
    font-size: var(--font-size-md, 12px);
    font-weight: 600;
    color: var(--text-main);
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-xs);
  }

  .btn-close-modal:hover {
    color: var(--text-main);
  }

  .modal-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .modal-label {
    font-size: var(--font-size-base, 11px);
    color: var(--text-muted);
  }

  .modal-input {
    width: 100%;
    padding: 7px 10px;
    background: var(--bg-base);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-md, 12px);
    outline: none;
    box-sizing: border-box;
  }

  .modal-input:focus {
    border-color: var(--border-focus);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    background: var(--bg-container);
    border-top: 1px solid var(--border-hairline);
  }

  .btn-modal-cancel {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--font-size-base, 11px);
    cursor: pointer;
  }

  .btn-modal-cancel:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .btn-modal-submit {
    padding: 6px 14px;
    background: var(--brand-primary);
    border: none;
    border-radius: var(--radius-md);
    color: var(--on-brand-primary, #000000);
    font-size: var(--font-size-base, 11px);
    font-weight: 700;
    cursor: pointer;
  }

  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }
</style>
