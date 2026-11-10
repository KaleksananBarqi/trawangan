<script lang="ts">
  import { Bell, Filter, History, Pencil, Play, Trash2 } from '@lucide/svelte';
  import { evaluatePlanMarketStatus } from '../../services/tradingPlanLifecycle';
  import type { SavedTradingPlanRecord } from '../../types/market';

  interface Props {
    activeSymbol: string;
    currentPrice: number | null;
    historyRecords: SavedTradingPlanRecord[];
    filteredHistory: SavedTradingPlanRecord[];
    historyFilterMode: 'active_symbol' | 'all';
    isLoadingHistory: boolean;
    formatPrice: (val: number | null | undefined) => string;
    formatTimestamp: (ts: number) => string;
    onChangeFilter: (mode: 'active_symbol' | 'all') => void;
    onClearAllHistory: () => void;
    onReplot: (rec: SavedTradingPlanRecord, withAlerts: boolean) => void;
    onLoadToForm: (rec: SavedTradingPlanRecord) => void;
    onDelete: (id: string) => void;
  }

  let {
    activeSymbol,
    currentPrice,
    historyRecords,
    filteredHistory,
    historyFilterMode,
    isLoadingHistory,
    formatPrice,
    formatTimestamp,
    onChangeFilter,
    onClearAllHistory,
    onReplot,
    onLoadToForm,
    onDelete,
  }: Props = $props();
</script>

<div class="plan-scroll-body history-body">
  <div class="vault-toolbar">
    <div class="vault-filter-row">
      <Filter size={11} class="text-dim" />
      <button
        type="button"
        class="vault-filter-btn {historyFilterMode === 'active_symbol' ? 'active' : ''}"
        onclick={() => onChangeFilter('active_symbol')}
      >
        {activeSymbol}
      </button>
      <button
        type="button"
        class="vault-filter-btn {historyFilterMode === 'all' ? 'active' : ''}"
        onclick={() => onChangeFilter('all')}
      >
        Semua ({historyRecords.length})
      </button>
    </div>

    {#if historyRecords.length > 0}
      <button
        type="button"
        class="btn-tool-action btn-clear"
        onclick={onClearAllHistory}
        title="Hapus seluruh riwayat Trade Plan Vault"
      >
        <Trash2 size={11} />
        <span>Hapus Semua</span>
      </button>
    {/if}
  </div>

  {#if currentPrice && currentPrice > 0}
    <div class="vault-live-price mono-nums">
      <span>Harga {activeSymbol}:</span>
      <strong>{formatPrice(currentPrice)}</strong>
    </div>
  {/if}

  {#if isLoadingHistory}
    <div class="vault-empty">Memuat riwayat Trade Plan...</div>
  {:else if filteredHistory.length === 0}
    <div class="vault-empty">
      <History size={20} class="text-dim" />
      <p>
        {historyFilterMode === 'active_symbol'
          ? `Belum ada riwayat tersimpan untuk ${activeSymbol}.`
          : 'Belum ada riwayat di Trade Plan Vault.'}
      </p>
    </div>
  {:else}
    <div class="vault-list">
      {#each filteredHistory as rec (rec.id)}
        {@const liveComp = evaluatePlanMarketStatus(rec, currentPrice, activeSymbol)}
        <div class="vault-card bias-{rec.plan?.bias || 'neutral'}">
          <div class="vault-card-head">
            <div class="vault-badges mono-nums">
              <span class="vault-sym">{rec.symbol}</span>
              {#if rec.timeframe}
                <span class="vault-tf">{rec.timeframe}</span>
              {/if}
              <span class="vault-bias {rec.plan?.bias === 'bearish' ? 'bear' : 'bull'}">
                {rec.plan?.bias === 'bearish' ? 'SHORT' : 'LONG'}
              </span>
            </div>
            <span class="vault-ts mono-nums">{formatTimestamp(rec.createdAt)}</span>
          </div>

          {#if liveComp}
            <div class="live-market-strip {liveComp.badgeClass} mono-nums">
              <span class="live-dot"></span>
              <span>{liveComp.label} ({liveComp.diffPctText})</span>
            </div>
          {/if}

          <div class="vault-levels mono-nums">
            <div>
              <span class="vl-lbl">Entry</span>
              <span class="vl-val">{formatPrice(rec.plan?.entry)}</span>
            </div>
            <div>
              <span class="vl-lbl">SL</span>
              <span class="vl-val bear">{formatPrice(rec.plan?.stopLoss)}</span>
            </div>
            <div>
              <span class="vl-lbl">TP</span>
              <span class="vl-val bull">{rec.plan?.targets?.length || 0} Level</span>
            </div>
          </div>

          <div class="vault-actions">
            <button
              type="button"
              class="btn-vault primary"
              onclick={() => onReplot(rec, false)}
              title="Proyeksikan ulang plan ini ke chart"
            >
              <Play size={10} />
              <span>Proyeksikan</span>
            </button>
            <button
              type="button"
              class="btn-vault alert"
              onclick={() => onReplot(rec, true)}
              title="Proyeksikan ke chart sekaligus pasang alert"
            >
              <Bell size={10} />
              <span>+ Alert</span>
            </button>
            <button
              type="button"
              class="btn-vault"
              onclick={() => onLoadToForm(rec)}
              title="Buka rencana ini di Form untuk disunting"
            >
              <Pencil size={10} />
              <span>Buka di Form</span>
            </button>
            <button
              type="button"
              class="btn-vault danger"
              onclick={() => onDelete(rec.id)}
              title="Hapus dari riwayat"
              aria-label="Hapus riwayat {rec.symbol}"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .plan-scroll-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vault-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .vault-filter-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .vault-filter-btn {
    padding: 3px 7px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
  }

  .vault-filter-btn.active {
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan) 35%, transparent);
    color: var(--brand-cyan);
  }

  .btn-tool-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-tool-action.btn-clear:hover {
    color: var(--status-danger);
    border-color: color-mix(in srgb, var(--status-danger) 35%, transparent);
  }

  .vault-filter-btn:focus-visible,
  .btn-tool-action:focus-visible,
  .btn-vault:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .vault-live-price {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    font-size: var(--font-size-sm);
    color: var(--text-dim);
  }

  .vault-live-price strong {
    color: var(--text-main);
  }

  .vault-empty {
    padding: 24px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    font-size: var(--font-size-base);
    color: var(--text-dim);
  }

  .vault-empty p {
    margin: 0;
  }

  .vault-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .vault-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vault-card.bias-bullish {
    border-left: 3px solid var(--bull-text);
  }

  .vault-card.bias-bearish {
    border-left: 3px solid var(--bear-color);
  }

  .vault-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .vault-badges {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .vault-sym {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--text-main);
  }

  .vault-tf {
    font-size: var(--font-size-xs);
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    background-color: var(--bg-elevated);
    color: var(--text-muted);
  }

  .vault-bias {
    font-size: var(--font-size-xs);
    font-weight: 700;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
  }

  .vault-bias.bull {
    background-color: color-mix(in srgb, var(--bull-color) 16%, transparent);
    color: var(--bull-text);
  }

  .vault-bias.bear {
    background-color: color-mix(in srgb, var(--bear-color) 14%, transparent);
    color: var(--bear-color);
  }

  .vault-ts {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
  }

  .live-market-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 7px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-hairline);
  }

  .live-market-strip.status-tp {
    color: var(--bull-text);
    border-color: color-mix(in srgb, var(--bull-text) 30%, transparent);
    background-color: color-mix(in srgb, var(--bull-color) 10%, transparent);
  }

  .live-market-strip.status-sl {
    color: var(--status-danger);
    border-color: color-mix(in srgb, var(--status-danger) 30%, transparent);
    background-color: color-mix(in srgb, var(--status-danger) 8%, transparent);
  }

  .live-market-strip.status-running {
    color: var(--brand-cyan);
    border-color: color-mix(in srgb, var(--brand-cyan) 30%, transparent);
    background-color: color-mix(in srgb, var(--brand-cyan) 8%, transparent);
  }

  .live-market-strip.status-waiting {
    color: var(--status-warn);
    border-color: color-mix(in srgb, var(--status-warn) 30%, transparent);
    background-color: color-mix(in srgb, var(--status-warn) 8%, transparent);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: currentColor;
    flex-shrink: 0;
  }

  .vault-levels {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    font-size: var(--font-size-sm);
  }

  .vault-levels > div {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .vl-lbl {
    font-size: var(--font-size-2xs);
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .vl-val {
    font-weight: 700;
    color: var(--text-main);
  }

  .vl-val.bull {
    color: var(--bull-text);
  }

  .vl-val.bear {
    color: var(--bear-color);
  }

  .vault-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .btn-vault {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-hairline);
    background-color: var(--bg-container);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-vault:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .btn-vault.primary {
    color: var(--bull-text);
    border-color: color-mix(in srgb, var(--bull-text) 30%, transparent);
    background-color: color-mix(in srgb, var(--bull-color) 10%, transparent);
  }

  .btn-vault.alert {
    color: var(--brand-cyan);
    border-color: color-mix(in srgb, var(--brand-cyan) 30%, transparent);
    background-color: color-mix(in srgb, var(--brand-cyan) 8%, transparent);
  }

  .btn-vault.danger {
    margin-left: auto;
  }

  .btn-vault.danger:hover {
    color: var(--status-danger);
    border-color: color-mix(in srgb, var(--status-danger) 35%, transparent);
  }
</style>
