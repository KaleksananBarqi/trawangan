<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Zap,
    RefreshCw,
    ShieldAlert,
    Settings,
    X,
    Check,
    Trash2
  } from '@lucide/svelte';
  import type { BrokerId } from '../../types/market';
  import {
    listBrokerConfigs,
    getBrokerAccountState,
    placeManualBrokerOrder,
    cancelManualBrokerOrder,
    type BrokerAccountSummary,
    type BrokerConfigPublic,
    type BrokerOpenOrderItem,
    type BrokerPositionItem
  } from '../../services/brokerBridgeService';
  import { t, tr, trInstant } from '../../i18n';

  interface Props {
    activeSymbol: string;
    currentPrice?: number | null;
    activeBrokerId?: BrokerId;
    onSelectBroker?: (brokerId: BrokerId) => void;
    onOpenBrokerSettings?: () => void;
    onLog?: (msg: string, level?: 'info' | 'success' | 'warn') => void;
  }

  let {
    activeSymbol,
    currentPrice = null,
    activeBrokerId = 'binance',
    onSelectBroker,
    onOpenBrokerSettings,
    onLog
  }: Props = $props();

  let verifiedBrokers = $state<BrokerConfigPublic[]>([]);
  let selectedBroker = $state<BrokerId>('binance');

  $effect(() => {
    if (activeBrokerId) {
      selectedBroker = activeBrokerId;
    }
  });
  let summary = $state<BrokerAccountSummary | null>(null);
  let positions = $state<BrokerPositionItem[]>([]);
  let openOrders = $state<BrokerOpenOrderItem[]>([]);
  let isLoadingState = $state(false);
  let stateError = $state<string | null>(null);

  // Manual Order Form State (100% Manual Input, Decoupled from Trade Plan)
  let orderSymbol = $state('');
  let side = $state<'BUY' | 'SELL'>('BUY');
  let orderType = $state<'MARKET' | 'LIMIT'>('LIMIT');
  let limitPrice = $state('');
  let quantity = $state('');
  let leverage = $state('10');
  let stopLoss = $state('');
  let takeProfit = $state('');

  let showConfirmDialog = $state(false);
  let isSubmittingOrder = $state(false);
  let orderFeedback = $state<{ ok: boolean; text: string } | null>(null);
  let lastTrackedChartSymbol = '';

  $effect(() => {
    if (activeSymbol && activeSymbol !== lastTrackedChartSymbol) {
      lastTrackedChartSymbol = activeSymbol;
      orderSymbol = activeSymbol.replace(/^[^:]+:/, '');
    }
  });

  async function refreshBrokersAndAccount() {
    isLoadingState = true;
    stateError = null;
    try {
      const all = await listBrokerConfigs();
      verifiedBrokers = all.filter((c) => c.is_verified);
      if (verifiedBrokers.length === 0) {
        summary = null;
        positions = [];
        openOrders = [];
        return;
      }
      if (!verifiedBrokers.some((b) => b.broker_id === selectedBroker)) {
        selectedBroker = verifiedBrokers[0].broker_id;
      }
      const res = await getBrokerAccountState(selectedBroker);
      summary = res.summary;
      positions = res.positions;
      openOrders = res.openOrders;
    } catch (err: any) {
      stateError = err?.message || String(err);
    } finally {
      isLoadingState = false;
    }
  }

  onMount(() => {
    orderSymbol = activeSymbol.replace(/^[^:]+:/, '');
    void refreshBrokersAndAccount();
  });

  function handleFillCurrentMarketPrice() {
    if (currentPrice && currentPrice > 0) {
      limitPrice = String(currentPrice);
    }
  }

  function handlePrepareSubmit() {
    orderFeedback = null;
    const qtyNum = parseFloat(quantity);
    if (!orderSymbol.trim() || Number.isNaN(qtyNum) || qtyNum <= 0) {
      orderFeedback = { ok: false, text: trInstant('Isien dhisik Simbol karo Quantity / Lot (> 0) secara manual, Rek!', 'Isi Simbol dan Ukuran Quantity / Lot (> 0) secara manual.', 'Enter Symbol and Quantity / Lot (> 0) manually.') };
      return;
    }
    if (orderType === 'LIMIT') {
      const pNum = parseFloat(limitPrice);
      if (Number.isNaN(pNum) || pNum <= 0) {
        orderFeedback = { ok: false, text: trInstant('Rega Limit wajib diisi manual gawe order LIMIT!', 'Harga Limit wajib diisi manual untuk order LIMIT.', 'Limit Price is required for LIMIT orders.') };
        return;
      }
    }
    showConfirmDialog = true;
  }

  async function handleConfirmSendOrder() {
    if (isSubmittingOrder) return;
    isSubmittingOrder = true;
    orderFeedback = null;
    try {
      const qtyNum = parseFloat(quantity);
      const priceNum = orderType === 'LIMIT' ? parseFloat(limitPrice) : undefined;
      const slNum = stopLoss.trim() ? parseFloat(stopLoss) : undefined;
      const tpNum = takeProfit.trim() ? parseFloat(takeProfit) : undefined;
      const levNum = leverage.trim() ? parseInt(leverage, 10) : undefined;

      const resp = await placeManualBrokerOrder({
        broker_id: selectedBroker,
        symbol: orderSymbol.trim(),
        side,
        order_type: orderType,
        quantity: qtyNum,
        price: priceNum,
        stop_loss: slNum && !Number.isNaN(slNum) ? slNum : undefined,
        take_profit: tpNum && !Number.isNaN(tpNum) ? tpNum : undefined,
        leverage: levNum && !Number.isNaN(levNum) ? levNum : undefined
      });

      showConfirmDialog = false;
      orderFeedback = { ok: true, text: resp.message };
      onLog?.(resp.message, 'success');
      await refreshBrokersAndAccount();
    } catch (err: any) {
      showConfirmDialog = false;
      const msg = err?.message || String(err);
      orderFeedback = { ok: false, text: msg };
      onLog?.(`Order gagal: ${msg}`, 'warn');
    } finally {
      isSubmittingOrder = false;
    }
  }

  async function handleCancelOrder(symbol: string, orderId: string) {
    try {
      const msg = await cancelManualBrokerOrder(selectedBroker, symbol, orderId);
      onLog?.(msg, 'info');
      await refreshBrokersAndAccount();
    } catch (err: any) {
      orderFeedback = { ok: false, text: err?.message || String(err) };
    }
  }
</script>

<div class="order-execution-tab custom-scroll">
  <div class="tab-top-bar">
    <div class="title-wrap">
      <Zap size={13} class="text-cyan" />
      <span class="tab-title">{$t('broker.orderTabTitle')}</span>
    </div>
    <div class="top-actions">
      <button
        type="button"
        class="icon-btn"
        title="Refresh Saldo & Posisi"
        onclick={refreshBrokersAndAccount}
      >
        <RefreshCw size={12} class={isLoadingState ? 'spin' : ''} />
      </button>
      <button
        type="button"
        class="icon-btn"
        title="Buka Pengaturan Broker"
        onclick={() => onOpenBrokerSettings?.()}
      >
        <Settings size={12} />
      </button>
    </div>
  </div>

  <!-- Decoupled Notice -->
  <div class="decoupled-banner">
    <ShieldAlert size={12} />
    <span>{$t('broker.planSeparatedNotice')}</span>
  </div>

  {#if verifiedBrokers.length === 0}
    <div class="empty-broker-box">
      <p>{$tr('Durung ono akun broker sing wis diverifikasi, Rek.', 'Belum ada akun broker yang terverifikasi.', 'No verified broker accounts yet.')}</p>
      <button type="button" class="btn-setup" onclick={() => onOpenBrokerSettings?.()}>
        <Settings size={13} />
        <span>{$tr('Setup Kunci API Broker', 'Setup Kredensial Broker', 'Setup Broker Credentials')}</span>
      </button>
    </div>
  {:else}
    <!-- Broker Selector -->
    <div class="broker-selector-row">
      {#each verifiedBrokers as b (b.broker_id)}
        <button
          type="button"
          class="broker-chip {selectedBroker === b.broker_id ? 'active' : ''}"
          onclick={() => {
            selectedBroker = b.broker_id;
            onSelectBroker?.(b.broker_id);
            void refreshBrokersAndAccount();
          }}
        >
          {b.broker_id.toUpperCase()}
        </button>
      {/each}
    </div>

    <!-- Account Balance Strip -->
    {#if summary}
      <div class="account-summary-grid mono-nums">
        <div class="metric-box">
          <span class="m-lbl">Balance</span>
          <span class="m-val">{summary.balance.toFixed(2)} {summary.currency}</span>
        </div>
        <div class="metric-box">
          <span class="m-lbl">Equity</span>
          <span class="m-val">{summary.equity.toFixed(2)} {summary.currency}</span>
        </div>
        <div class="metric-box full">
          <span class="m-lbl">Free Margin · {summary.server_info}</span>
          <span class="m-val text-cyan">{summary.available_margin.toFixed(2)} {summary.currency}</span>
        </div>
      </div>
    {:else if stateError}
      <div class="feedback err mono-nums">{stateError}</div>
    {/if}

    <!-- MANUAL ORDER TICKET FORM -->
    <div class="ticket-card">
      <div class="side-toggle">
        <button
          type="button"
          class="side-btn buy {side === 'BUY' ? 'active' : ''}"
          onclick={() => (side = 'BUY')}
        >
          BUY / LONG
        </button>
        <button
          type="button"
          class="side-btn sell {side === 'SELL' ? 'active' : ''}"
          onclick={() => (side = 'SELL')}
        >
          SELL / SHORT
        </button>
      </div>

      <div class="type-toggle">
        <button
          type="button"
          class="type-btn {orderType === 'LIMIT' ? 'active' : ''}"
          onclick={() => (orderType = 'LIMIT')}
        >
          LIMIT
        </button>
        <button
          type="button"
          class="type-btn {orderType === 'MARKET' ? 'active' : ''}"
          onclick={() => (orderType = 'MARKET')}
        >
          MARKET
        </button>
      </div>

      <div class="field-group">
        <label for="ord-sym">Symbol ({selectedBroker === 'mt5' ? 'mis. XAUUSDm / EURUSD' : 'mis. BTCUSDT'})</label>
        <input id="ord-sym" type="text" class="inp mono-nums" bind:value={orderSymbol} />
      </div>

      {#if orderType === 'LIMIT'}
        <div class="field-group">
          <div class="lbl-row">
            <label for="ord-price">{$tr('Rega Limit', 'Harga Limit', 'Limit Price')}</label>
            {#if currentPrice}
              <button type="button" class="link-btn mono-nums" onclick={handleFillCurrentMarketPrice}>
                {$tr('Gawe Last', 'Pakai Last', 'Use Last')} ({currentPrice})
              </button>
            {/if}
          </div>
          <input id="ord-price" type="number" step="any" class="inp mono-nums" placeholder="0.00" bind:value={limitPrice} />
        </div>
      {/if}

      <div class="two-cols">
        <div class="field-group">
          <label for="ord-qty">{selectedBroker === 'mt5' ? 'Volume (Lot)' : $tr('Quantity (Koin)', 'Quantity (Koin)', 'Quantity (Coin)')}</label>
          <input
            id="ord-qty"
            type="number"
            step="any"
            class="inp mono-nums"
            placeholder={selectedBroker === 'mt5' ? '0.01' : '0.001'}
            bind:value={quantity}
          />
        </div>

        {#if selectedBroker !== 'mt5'}
          <div class="field-group">
            <label for="ord-lev">Leverage (x)</label>
            <input id="ord-lev" type="number" min="1" max="125" class="inp mono-nums" bind:value={leverage} />
          </div>
        {/if}
      </div>

      <div class="two-cols">
        <div class="field-group">
          <label for="ord-sl">Stop Loss ({$tr('Opsional', 'Opsional', 'Optional')})</label>
          <input id="ord-sl" type="number" step="any" class="inp mono-nums" placeholder="--" bind:value={stopLoss} />
        </div>
        <div class="field-group">
          <label for="ord-tp">Take Profit ({$tr('Opsional', 'Opsional', 'Optional')})</label>
          <input id="ord-tp" type="number" step="any" class="inp mono-nums" placeholder="--" bind:value={takeProfit} />
        </div>
      </div>

      {#if orderFeedback}
        <div class="feedback {orderFeedback.ok ? 'ok' : 'err'} mono-nums">
          {orderFeedback.text}
        </div>
      {/if}

      <button
        type="button"
        class="submit-order-btn {side === 'BUY' ? 'buy' : 'sell'}"
        onclick={handlePrepareSubmit}
      >
        <span>{side === 'BUY' ? $tr('Tembak Manual BUY / LONG', 'Kirim Manual BUY / LONG', 'Place Manual BUY / LONG') : $tr('Tembak Manual SELL / SHORT', 'Kirim Manual SELL / SHORT', 'Place Manual SELL / SHORT')}</span>
      </button>
    </div>

    <!-- OPEN POSITIONS & PENDING ORDERS -->
    <div class="positions-section">
      <span class="sec-hdr">{$tr('POSISI URIP', 'POSISI AKTIF', 'OPEN POSITIONS')} ({positions.length})</span>
      {#if positions.length === 0}
        <div class="empty-mini">{$tr('Durung ono posisi sing kebukak.', 'Tidak ada posisi terbuka.', 'No open positions.')}</div>
      {:else}
        {#each positions as pos (pos.id)}
          <div class="pos-row mono-nums">
            <div>
              <strong class={pos.side === 'LONG' ? 'text-bull' : 'text-bear'}>{pos.side}</strong>
              <span> {pos.symbol} · {pos.size}</span>
              <div class="sub-meta">Entry: {pos.entry_price}</div>
            </div>
            <div class="pos-right">
              <span class={pos.unrealized_pnl >= 0 ? 'text-bull' : 'text-bear'}>
                {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl.toFixed(2)}
              </span>
            </div>
          </div>
        {/each}
      {/if}

      <span class="sec-hdr" style="margin-top: 6px;">PENDING ORDERS ({openOrders.length})</span>
      {#if openOrders.length === 0}
        <div class="empty-mini">{$tr('Gak ono antrean limit order.', 'Tidak ada antrean limit order.', 'No pending limit orders.')}</div>
      {:else}
        {#each openOrders as ord (ord.order_id)}
          <div class="pos-row mono-nums">
            <div>
              <strong>{ord.side} {ord.order_type}</strong>
              <span> {ord.symbol}</span>
              <div class="sub-meta">Qty: {ord.quantity} @ {ord.price}</div>
            </div>
            <button
              type="button"
              class="cancel-ord-btn"
              title={$tr('Batalkan Order', 'Batalkan Order', 'Cancel Order')}
              onclick={() => handleCancelOrder(ord.symbol, ord.order_id)}
            >
              <Trash2 size={11} />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<!-- Explicit Confirmation Modal before Sending Order -->
{#if showConfirmDialog}
  <div class="confirm-backdrop" role="dialog" aria-modal="true">
    <div class="confirm-dialog obsidian-panel">
      <div class="confirm-hdr">
        <span>{$tr('Konfirmasi Tembak Order Manual', 'Konfirmasi Eksekusi Order Manual', 'Confirm Manual Order Execution')}</span>
        <button type="button" class="icon-btn" onclick={() => (showConfirmDialog = false)}>
          <X size={13} />
        </button>
      </div>
      <div class="confirm-body mono-nums">
        <div class="c-row"><span>{$tr('Broker Tujuan:', 'Broker Tujuan:', 'Target Broker:')}</span><strong>{selectedBroker.toUpperCase()}</strong></div>
        <div class="c-row"><span>{$tr('Koin / Simbol:', 'Simbol:', 'Symbol:')}</span><strong>{orderSymbol}</strong></div>
        <div class="c-row"><span>{$tr('Arah & Tipe:', 'Arah & Tipe:', 'Side & Type:')}</span><strong class={side === 'BUY' ? 'text-bull' : 'text-bear'}>{side} {orderType}</strong></div>
        <div class="c-row"><span>{$tr('Rega:', 'Harga:', 'Price:')}</span><strong>{orderType === 'MARKET' ? 'MARKET' : limitPrice}</strong></div>
        <div class="c-row"><span>Quantity / Lot:</span><strong>{quantity}</strong></div>
        {#if stopLoss}<div class="c-row"><span>Stop Loss:</span><strong>{stopLoss}</strong></div>{/if}
        {#if takeProfit}<div class="c-row"><span>Take Profit:</span><strong>{takeProfit}</strong></div>{/if}
      </div>
      <div class="confirm-ftr">
        <button type="button" class="btn-cancel" onclick={() => (showConfirmDialog = false)}>
          {$t('common.cancel')}
        </button>
        <button
          type="button"
          class="btn-confirm {side === 'BUY' ? 'buy' : 'sell'}"
          disabled={isSubmittingOrder}
          onclick={handleConfirmSendOrder}
        >
          <Check size={13} />
          <span>{isSubmittingOrder ? $tr('Ngirim...', 'Mengirim...', 'Sending...') : $tr('Gas! Tembak Saiki', 'Ya, Eksekusi Sekarang', 'Confirm & Place Order')}</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .order-execution-tab {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tab-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--text-main);
  }

  .top-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    padding: 5px;
    border-radius: 5px;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .decoupled-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 7px 9px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--status-warn) 11%, transparent);
    color: var(--status-warn, #f59e0b);
    font-size: 10.5px;
    line-height: 1.4;
  }

  .broker-selector-row {
    display: flex;
    gap: 5px;
  }

  .broker-chip {
    flex: 1;
    padding: 6px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: var(--bg-panel);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .broker-chip.active {
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
    background: color-mix(in srgb, var(--brand-cyan) 13%, transparent);
  }

  .account-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .metric-box {
    padding: 7px 8px;
    border-radius: 6px;
    background: var(--bg-panel);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metric-box.full {
    grid-column: 1 / -1;
  }

  .m-lbl {
    font-size: 9.5px;
    color: var(--text-dim);
  }

  .m-val {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .ticket-card {
    padding: 10px;
    border-radius: 8px;
    background: var(--bg-panel);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .side-toggle,
  .type-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .side-btn,
  .type-btn {
    padding: 6px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: var(--bg-elevated);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .side-btn.buy.active {
    background: color-mix(in srgb, var(--bull-color) 18%, transparent);
    border-color: var(--bull-color);
    color: var(--bull-color);
  }

  .side-btn.sell.active {
    background: color-mix(in srgb, var(--bear-color) 18%, transparent);
    border-color: var(--bear-color);
    color: var(--bear-color);
  }

  .type-btn.active {
    background: color-mix(in srgb, var(--brand-cyan) 15%, transparent);
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
  }

  .two-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .lbl-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .field-group label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--brand-cyan);
    font-size: 9.5px;
    cursor: pointer;
    padding: 0;
  }

  .inp {
    padding: 6px 8px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: var(--bg-surface);
    color: var(--text-main);
    font-size: 11px;
    width: 100%;
  }

  .submit-order-btn {
    padding: 8px;
    border-radius: 6px;
    border: none;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .submit-order-btn.buy,
  .btn-confirm.buy {
    background: var(--bull-color);
    color: #0b0e14;
  }

  .submit-order-btn.sell,
  .btn-confirm.sell {
    background: var(--bear-color);
    color: #0b0e14;
  }

  .feedback {
    padding: 6px 8px;
    border-radius: 5px;
    font-size: 10.5px;
  }

  .feedback.ok {
    background: color-mix(in srgb, var(--bull-color) 14%, transparent);
    color: var(--bull-color);
  }

  .feedback.err {
    background: color-mix(in srgb, var(--bear-color) 14%, transparent);
    color: var(--bear-color);
  }

  .positions-section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .sec-hdr {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--text-dim);
  }

  .empty-mini {
    font-size: 10.5px;
    color: var(--text-dim);
    padding: 6px 0;
  }

  .pos-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: 5px;
    background: var(--bg-panel);
    font-size: 10.5px;
  }

  .sub-meta {
    font-size: 9.5px;
    color: var(--text-dim);
  }

  .cancel-ord-btn {
    padding: 4px 6px;
    border-radius: 4px;
    border: none;
    background: color-mix(in srgb, var(--bear-color) 15%, transparent);
    color: var(--bear-color);
    cursor: pointer;
  }

  .empty-broker-box {
    padding: 20px 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .btn-setup {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 6px;
    border: none;
    background: var(--brand-primary);
    color: #0b0e14;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1500;
    background: rgba(8, 10, 15, 0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .confirm-dialog {
    width: 360px;
    max-width: 94vw;
    background: var(--bg-surface);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
    border-radius: 10px;
    overflow: hidden;
  }

  .confirm-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-panel);
    font-size: 12px;
    font-weight: 800;
  }

  .confirm-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11.5px;
  }

  .c-row {
    display: flex;
    justify-content: space-between;
  }

  .confirm-ftr {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    background: var(--bg-panel);
  }

  .btn-cancel {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
  }

  .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .text-bull { color: var(--bull-color); }
  .text-bear { color: var(--bear-color); }
  .text-cyan { color: var(--brand-cyan); }
</style>
