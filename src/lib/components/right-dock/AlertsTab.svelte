<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import {
    Plus,
    Bell,
    Trash2,
    Play,
    Pause,
    RotateCcw,
    Pencil
  } from '@lucide/svelte';
  import { marketFeed } from '../../services/market';
  import { alertService } from '../../services/alertService';
  import { isSameSymbol } from '../../services/instrumentIdentity';
  import { parseAdaptiveSymbol } from '../../services/market/symbolSearchService';
  import { formatPriceLabel } from '../../services/priceScaleLabelService';
  import type { PriceAlert } from '../../types/market';

  interface Props {
    activeSymbol: string;
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onRequestCreateAlert?: () => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
  }

  let {
    activeSymbol,
    onSelectSymbol,
    onRequestCreateAlert,
    onRequestEditAlert,
  }: Props = $props();

  let alerts = $state<PriceAlert[]>(alertService.getAlerts());
  let alertFilterMode = $state<'all' | 'current'>('all');
  let newAlertPrice = $state('');
  let newAlertLabel = $state('');
  let showAddAlert = $state(false);
  let alertTickerMap = $state<Record<string, { price: number }>>({});
  let unsubAlerts: (() => void) | null = null;
  let unsubAlertFeed: (() => void) | null = null;

  const displayAlerts = $derived.by(() => {
    if (alertFilterMode === 'current') {
      return alerts.filter((a) => isSameSymbol(a.symbol, activeSymbol));
    }
    return alerts;
  });

  // Ekstrak seluruh simbol unik pada alert agar ticker terpantau meski koin tidak ada di watchlist
  const subscribedAlertSymbols = $derived.by(() => {
    const unique = new Set<string>();
    for (const a of alerts) {
      if (a.symbol) unique.add(a.symbol);
    }
    if (showAddAlert && activeSymbol) {
      unique.add(activeSymbol);
    }
    return [...unique];
  });

  $effect(() => {
    const syms = subscribedAlertSymbols;
    if (unsubAlertFeed) {
      unsubAlertFeed();
      unsubAlertFeed = null;
    }
    if (syms.length > 0) {
      unsubAlertFeed = untrack(() => {
        return marketFeed.subscribeWatchlistTickers(syms, (newMap) => {
          alertTickerMap = { ...alertTickerMap, ...newMap };
        });
      });
    }
    return () => {
      if (unsubAlertFeed) {
        unsubAlertFeed();
        unsubAlertFeed = null;
      }
    };
  });

  onMount(() => {
    unsubAlerts = alertService.subscribe((list) => {
      alerts = list;
    });
  });

  onDestroy(() => {
    if (unsubAlerts) {
      unsubAlerts();
      unsubAlerts = null;
    }
    if (unsubAlertFeed) {
      unsubAlertFeed();
      unsubAlertFeed = null;
    }
  });

  function resolveTickerPrice(sym: string): number {
    const direct = alertTickerMap[sym]?.price;
    if (typeof direct === 'number' && direct > 0) return direct;
    for (const [k, v] of Object.entries(alertTickerMap)) {
      if (v && typeof v.price === 'number' && v.price > 0 && isSameSymbol(k, sym)) {
        return v.price;
      }
    }
    return 0;
  }

  function formatAlertPrice(p?: number, sym?: string): string {
    if (!p) return '--';
    const quote = sym ? parseAdaptiveSymbol(sym).quoteAsset : undefined;
    if (quote === 'IDR') {
      return `Rp ${formatPriceLabel(p, 'IDR')}`;
    }
    return `$${formatPriceLabel(p, quote)}`;
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

    const curP = resolveTickerPrice(activeSymbol);
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

  function calculateAlertDistance(
    target: number,
    sym: string
  ): { diffText: string; pctText: string; isBull: boolean } | null {
    const cur = resolveTickerPrice(sym);
    if (!cur || cur <= 0) return null;
    const diff = target - cur;
    const pct = (diff / cur) * 100;
    const isBull = diff > 0;
    const quote = parseAdaptiveSymbol(sym).quoteAsset;
    const prefix = quote === 'IDR' ? 'Rp ' : '$';
    return {
      diffText: `${isBull ? '+' : '-'}${prefix}${formatPriceLabel(Math.abs(diff), quote)}`,
      pctText: `${isBull ? '+' : ''}${pct.toFixed(2)}%`,
      isBull,
    };
  }
</script>

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
      {activeSymbol.replace('USDT', '').replace('.P', '')} ({alerts.filter((a) => isSameSymbol(a.symbol, activeSymbol)).length})
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
        aria-label="Target harga alert"
        required
      />
      <input
        type="text"
        placeholder="Catatan / Label..."
        bind:value={newAlertLabel}
        class="add-input"
        aria-label="Label catatan alert"
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

        <div class="alert-price-row mono-nums">
          <span class="target-val">{formatAlertPrice(a.targetPrice, a.symbol)}</span>
          {#if distance && a.active && !a.triggered}
            <span class="distance-pill {distance.isBull ? 'pill-bull' : 'pill-bear'}">
              {distance.pctText} ({distance.diffText})
            </span>
          {:else if a.triggered && a.triggeredPrice}
            <span class="hit-pill">
              Hit @ {formatAlertPrice(a.triggeredPrice, a.symbol)}
            </span>
          {/if}
        </div>

        {#if a.label}
          <span class="alert-label">{a.label}</span>
        {/if}
      </div>

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
          class="icon-alert-btn edit"
          title="Sunting Alert Ini (Ubah Target & Kondisi)"
          onclick={() => onRequestEditAlert?.(a)}
        >
          <Pencil size={12} />
        </button>

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

<style>
  .alert-sub-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
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
    font-size: var(--font-size-sm, 10px);
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
    background-color: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan) 28%, transparent);
    font-weight: 600;
  }

  .add-symbol-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--brand-primary);
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    padding: 3px 6px;
    cursor: pointer;
  }

  .add-symbol-btn:hover,
  .add-symbol-btn.active {
    background-color: color-mix(in srgb, var(--brand-primary) 14%, transparent);
    border-color: var(--brand-primary);
  }

  .alert-form {
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
    font-size: var(--font-size-base, 11px);
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
    font-size: var(--font-size-sm, 10px);
    font-weight: 700;
    padding: 0 8px;
    cursor: pointer;
  }

  .items-list {
    flex: 1;
    overflow-y: auto;
    background-color: var(--bg-surface);
  }

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
    border-color: color-mix(in srgb, var(--bear-color) 45%, transparent);
    background-color: color-mix(in srgb, var(--bear-color) 8%, transparent);
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
    font-size: var(--font-size-base, 11px);
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
    font-size: var(--font-size-xs, 9px);
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-cond.bull {
    background-color: color-mix(in srgb, var(--bull-text) 12%, transparent);
    color: var(--bull-text);
  }

  .badge-cond.bear {
    background-color: color-mix(in srgb, var(--bear-color) 12%, transparent);
    color: var(--bear-color);
  }

  .badge-cond.cyan {
    background-color: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
    color: var(--brand-cyan);
  }

  .badge-cond.muted {
    background-color: var(--bg-elevated);
    color: var(--text-dim);
  }

  .badge-alert {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-alert.active {
    background-color: color-mix(in srgb, var(--bull-text) 14%, transparent);
    color: var(--bull-text);
  }

  .badge-alert.triggered {
    background-color: color-mix(in srgb, var(--bear-color) 20%, transparent);
    color: var(--bear-color);
    animation: pulseTrigger 1.5s infinite;
  }

  @keyframes pulseTrigger {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .badge-alert.paused {
    background-color: var(--bg-elevated);
    color: var(--text-dim);
  }

  .alert-price-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-val {
    font-size: var(--font-size-lg, 13px);
    font-weight: 700;
    color: var(--text-main);
  }

  .distance-pill {
    font-size: var(--font-size-xs, 9px);
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .pill-bull {
    color: var(--bull-text);
    background-color: color-mix(in srgb, var(--bull-text) 12%, transparent);
  }

  .pill-bear {
    color: var(--bear-color);
    background-color: color-mix(in srgb, var(--bear-color) 12%, transparent);
  }

  .hit-pill {
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    color: var(--bull-text);
    background-color: color-mix(in srgb, var(--bull-text) 12%, transparent);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .alert-label {
    font-size: var(--font-size-sm, 10px);
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

  .icon-alert-btn.edit:hover {
    color: var(--brand-cyan);
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
  }

  .icon-alert-btn.toggle.active:hover {
    color: var(--status-warn);
    background-color: color-mix(in srgb, var(--status-warn) 15%, transparent);
  }

  .icon-alert-btn.reset:hover {
    color: var(--bull-text);
    background-color: color-mix(in srgb, var(--bull-text) 15%, transparent);
  }

  .icon-alert-btn.delete:hover {
    color: var(--status-danger);
    background-color: color-mix(in srgb, var(--status-danger) 15%, transparent);
  }

  .alert-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 30px 14px;
    text-align: center;
  }

  .empty-icon {
    color: var(--text-dim);
    opacity: 0.6;
  }

  .empty-title {
    font-size: var(--font-size-md, 12px);
    font-weight: 700;
    color: var(--text-muted);
  }

  .empty-sub {
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
    line-height: 1.4;
  }

  button:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }
</style>
