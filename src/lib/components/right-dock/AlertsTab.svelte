<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import {
    Plus,
    Bell,
    Trash2,
    Play,
    Pause,
    RotateCcw,
    Pencil,
    ChevronDown,
    ChevronRight,
  } from '@lucide/svelte';
  import { marketFeed } from '../../services/market';
  import { alertService } from '../../services/alertService';
  import { isSameSymbol } from '../../services/instrumentIdentity';
  import { parseAdaptiveSymbol } from '../../services/market/symbolSearchService';
  import { formatPriceWithQuoteSymbol } from '../../services/priceScaleLabelService';
  import {
    buildAutoAlertLabel,
    inferAlertConditionFromPrice,
    mergeAlertSymbolSuggestions,
    parseAlertPriceInput,
    resolveAlertTargetSymbol,
  } from '../../services/alertFormHelper';
  import type { AlertCondition, PriceAlert } from '../../types/market';

  interface Props {
    activeSymbol: string;
    availableSymbols?: string[];
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onRequestCreateAlert?: () => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
  }

  let {
    activeSymbol,
    availableSymbols = [],
    onSelectSymbol,
    onRequestCreateAlert,
    onRequestEditAlert,
  }: Props = $props();

  let alerts = $state<PriceAlert[]>(alertService.getAlerts());
  // Filter simbol: 'all' = tampilkan semua, string lain = simbol spesifik
  let alertFilterMode = $state<string>('all');
  let newAlertSymbol = $state('');
  let newAlertPrice = $state('');
  let newAlertCondition = $state<'auto' | AlertCondition>('auto');
  let newAlertLabel = $state('');
  let inlineAlertError = $state('');
  let showAddAlert = $state(false);
  let alertTickerMap = $state<Record<string, { price: number }>>({});
  let unsubAlerts: (() => void) | null = null;
  let unsubAlertFeed: (() => void) | null = null;

  // State menu hapus massal
  let showBulkMenu = $state(false);
  // Key konfirmasi aktif: null | string ('symbol' | 'triggered' | 'all' | 'sym_<symbol>')
  let confirmKey = $state<string | null>(null);
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // Lipatan section riwayat terpicu
  let triggeredSectionOpen = $state(true);

  // Daftar simbol unik beserta jumlah alert per simbol untuk pill filter dinamis
  const symbolPills = $derived.by(() => {
    const map = new Map<string, number>();
    for (const a of alerts) {
      const sym = a.symbol;
      map.set(sym, (map.get(sym) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([symbol, count]) => ({ symbol, count }));
  });

  // Alert yang tampil berdasarkan filter simbol aktif
  const filteredAlerts = $derived.by(() => {
    if (alertFilterMode === 'all') return alerts;
    return alerts.filter((a) => isSameSymbol(a.symbol, alertFilterMode));
  });

  // Pemisahan: aktif (termasuk paused) vs riwayat terpicu
  const activeAlerts = $derived(filteredAlerts.filter((a) => !a.triggered));
  const triggeredAlerts = $derived(filteredAlerts.filter((a) => a.triggered));

  const inlineSymbolSuggestions = $derived(
    mergeAlertSymbolSuggestions(activeSymbol, availableSymbols, newAlertSymbol)
  );

  // Ekstrak seluruh simbol unik pada alert agar ticker terpantau meski koin tidak ada di watchlist
  const subscribedAlertSymbols = $derived.by(() => {
    const unique = new Set<string>();
    for (const a of alerts) {
      if (a.symbol) unique.add(a.symbol);
    }
    if (showAddAlert) {
      const targetSym = resolveAlertTargetSymbol(newAlertSymbol || activeSymbol, activeSymbol || 'BTCUSDT');
      if (targetSym) unique.add(targetSym);
    }
    return [...unique];
  });

  // Counter dinamis untuk label menu hapus massal
  // forSymbol: dihitung dari filteredAlerts agar konsisten dengan konteks tampilan saat ini
  const bulkCounts = $derived.by(() => {
    const forSymbol = alertFilterMode !== 'all'
      ? filteredAlerts.length
      : 0;
    const triggered = triggeredAlerts.length;
    const total = filteredAlerts.length;
    return { forSymbol, triggered, total };
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
    clearConfirmTimer();
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
    return formatPriceWithQuoteSymbol(p, quote, sym);
  }

  function handleTriggerOpenCreateAlert() {
    if (onRequestCreateAlert) {
      onRequestCreateAlert();
    } else {
      showAddAlert = !showAddAlert;
      if (showAddAlert) {
        newAlertSymbol = activeSymbol || 'BTCUSDT';
        newAlertCondition = 'auto';
        inlineAlertError = '';
      }
    }
  }

  async function handleCreateAlert(e: Event) {
    e.preventDefault();
    const p = parseAlertPriceInput(newAlertPrice);
    if (!p) {
      inlineAlertError = 'Masukkan target harga yang valid (> 0).';
      return;
    }

    const targetSym = resolveAlertTargetSymbol(newAlertSymbol || activeSymbol, activeSymbol || 'BTCUSDT');
    const curP = resolveTickerPrice(targetSym);
    const cond: AlertCondition =
      newAlertCondition === 'auto'
        ? inferAlertConditionFromPrice(p, curP)
        : newAlertCondition;

    await alertService.addAlert({
      symbol: targetSym,
      targetPrice: p,
      condition: cond,
      frequency: 'once',
      label: newAlertLabel.trim() || buildAutoAlertLabel(targetSym, p),
    });

    newAlertPrice = '';
    newAlertLabel = '';
    inlineAlertError = '';
    showAddAlert = false;
  }

  async function handleToggleAlert(e: Event, id: string) {
    e.stopPropagation();
    await alertService.toggleAlertActive(id);
  }

  async function handleResetAlert(e: Event, id: string) {
    e.stopPropagation();
    await alertService.resetTriggeredAlert(id);
  }

  async function handleRemoveAlert(e: Event, id: string) {
    e.stopPropagation();
    await alertService.deleteAlert(id);
  }

  function handleEditAlert(e: Event, a: PriceAlert) {
    e.stopPropagation();
    onRequestEditAlert?.(a);
  }

  // Navigasi koin lewat klik seluruh kartu alert
  function handleCardClick(symbol: string) {
    onSelectSymbol(symbol);
  }

  function handleCardKeydown(e: KeyboardEvent, symbol: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectSymbol(symbol);
    }
  }

  // Menutup menu hapus massal saat klik di luar — gunakan referensi elemen
  // agar event dari tombol di dalam dropdown tidak salah ditangkap sebagai "klik luar"
  let bulkMenuEl = $state<HTMLElement | null>(null);

  function handleOutsideClick(e: MouseEvent) {
    // Jika elemen wrapper sudah ter-mount dan klik terjadi di luar wrapper → tutup menu
    if (bulkMenuEl && !bulkMenuEl.contains(e.target as Node)) {
      showBulkMenu = false;
      clearConfirm();
    }
  }

  // === Menu Hapus Massal ===

  function clearConfirmTimer() {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
  }

  function clearConfirm() {
    clearConfirmTimer();
    confirmKey = null;
  }

  function requestConfirm(key: string) {
    // Batalkan timer konfirmasi sebelumnya terlebih dahulu untuk mencegah race condition
    // (misalnya: user klik opsi A → timer A berjalan → klik opsi B sebelum 3.5 detik)
    clearConfirmTimer();
    confirmKey = key;
    // Auto-reset konfirmasi setelah 3.5 detik jika diabaikan
    confirmTimer = setTimeout(() => {
      confirmKey = null;
      confirmTimer = null;
    }, 3500);
  }

  async function executeBulkDelete(key: string, symbolTarget?: string) {
    clearConfirm();
    showBulkMenu = false;
    if (key === 'symbol' && alertFilterMode !== 'all') {
      await alertService.deleteAlertsBySymbol(alertFilterMode);
      alertFilterMode = 'all';
    } else if (key.startsWith('sym_') && symbolTarget) {
      await alertService.deleteAlertsBySymbol(symbolTarget);
      if (alertFilterMode === symbolTarget) {
        alertFilterMode = 'all';
      }
    } else if (key === 'triggered') {
      const sym = alertFilterMode !== 'all' ? alertFilterMode : undefined;
      await alertService.deleteTriggeredAlerts(sym);
    } else if (key === 'all') {
      await alertService.clearAllAlerts();
      alertFilterMode = 'all';
    }
  }

  function handleBulkAction(key: string, symbolTarget?: string) {
    if (confirmKey === key) {
      // Sudah dalam mode konfirmasi → eksekusi
      executeBulkDelete(key, symbolTarget);
    } else {
      // Belum konfirmasi → masuk mode konfirmasi
      requestConfirm(key);
    }
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
    return {
      diffText: `${isBull ? '+' : '-'}${formatPriceWithQuoteSymbol(Math.abs(diff), quote, sym)}`,
      pctText: `${isBull ? '+' : ''}${pct.toFixed(2)}%`,
      isBull,
    };
  }

  // Label singkat simbol untuk pill filter
  function shortSymLabel(sym: string): string {
    return sym.replace('USDT', '').replace('.P', '');
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<!-- Sub-toolbar: filter pills + tombol hapus massal + tombol tambah alert -->
<div class="sub-toolbar alert-sub-toolbar">
  <!-- Filter pills horizontal scroll -->
  <div class="alert-filter-tabs">
    <button
      type="button"
      class="filter-pill {alertFilterMode === 'all' ? 'active' : ''}"
      onclick={() => { alertFilterMode = 'all'; clearConfirm(); }}
    >
      Semua ({alerts.length})
    </button>
    {#each symbolPills as pill (pill.symbol)}
      <button
        type="button"
        class="filter-pill {alertFilterMode === pill.symbol ? 'active' : ''}"
        onclick={() => { alertFilterMode = pill.symbol; clearConfirm(); }}
      >
        {shortSymLabel(pill.symbol)} ({pill.count})
      </button>
    {/each}
  </div>

  <!-- Tombol aksi kanan: menu hapus massal + tambah alert -->
  <div class="toolbar-actions">
    <!-- Menu hapus massal -->
    {#if alerts.length > 0}
      <div class="bulk-menu-wrapper" bind:this={bulkMenuEl}>
        <button
          type="button"
          class="icon-toolbar-btn {showBulkMenu ? 'active' : ''}"
          title="Hapus alert massal"
          onclick={(e) => { e.stopPropagation(); showBulkMenu = !showBulkMenu; }}
        >
          <Trash2 size={12} />
        </button>

        {#if showBulkMenu}
          <div class="bulk-dropdown" role="menu">
            <!-- Opsi hapus per simbol aktif (hanya tampil jika filter simbol spesifik aktif) -->
            {#if alertFilterMode !== 'all' && bulkCounts.forSymbol > 0}
              <button
                type="button"
                class="bulk-menu-item {confirmKey === 'symbol' ? 'confirm-mode' : ''}"
                role="menuitem"
                onclick={(e) => { e.stopPropagation(); handleBulkAction('symbol'); }}
              >
                <Trash2 size={11} />
                {#if confirmKey === 'symbol'}
                  Yakin hapus {bulkCounts.forSymbol} alert {shortSymLabel(alertFilterMode)}?
                {:else}
                  Hapus {bulkCounts.forSymbol} Alert {shortSymLabel(alertFilterMode)}
                {/if}
              </button>
            {/if}

            <!-- Opsi bersihkan riwayat terpicu -->
            {#if bulkCounts.triggered > 0}
              <button
                type="button"
                class="bulk-menu-item {confirmKey === 'triggered' ? 'confirm-mode' : ''}"
                role="menuitem"
                onclick={(e) => { e.stopPropagation(); handleBulkAction('triggered'); }}
              >
                <RotateCcw size={11} />
                {#if confirmKey === 'triggered'}
                  Yakin bersihkan {bulkCounts.triggered} riwayat?
                {:else}
                  Bersihkan {bulkCounts.triggered} Alert Terpicu
                {/if}
              </button>
            {/if}

            <!-- Opsi hapus semua -->
            {#if bulkCounts.total > 0}
              <button
                type="button"
                class="bulk-menu-item danger {confirmKey === 'all' ? 'confirm-mode' : ''}"
                role="menuitem"
                onclick={(e) => { e.stopPropagation(); handleBulkAction('all'); }}
              >
                <Trash2 size={11} />
                {#if confirmKey === 'all'}
                  Yakin hapus SEMUA {bulkCounts.total} alert?
                {:else}
                  Hapus Semua {bulkCounts.total} Alert
                {/if}
              </button>
            {/if}

            <!-- Opsi hapus simbol spesifik langsung dari dropdown -->
            {#if symbolPills.length > 0}
              <div class="bulk-dropdown-divider"></div>
              <div class="bulk-dropdown-heading">Hapus per Simbol:</div>
              <div class="bulk-symbols-list">
                {#each symbolPills as pill (pill.symbol)}
                  {@const key = `sym_${pill.symbol}`}
                  <button
                    type="button"
                    class="bulk-menu-item sym-row {confirmKey === key ? 'confirm-mode' : ''}"
                    role="menuitem"
                    onclick={(e) => { e.stopPropagation(); handleBulkAction(key, pill.symbol); }}
                  >
                    <Trash2 size={11} />
                    {#if confirmKey === key}
                      Yakin hapus {pill.count} alert {shortSymLabel(pill.symbol)}?
                    {:else}
                      <span class="sym-name">{pill.symbol}</span>
                      <span class="sym-badge-cnt mono-nums">{pill.count}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tombol tambah alert -->
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
</div>

{#if showAddAlert}
  <form class="alert-form" onsubmit={handleCreateAlert}>
    <div class="alert-input-group">
      <div class="alert-inline-row">
        <input
          type="text"
          list="inline-alert-symbol-suggestions"
          placeholder="Simbol (e.g. ETHUSDT)..."
          bind:value={newAlertSymbol}
          oninput={() => (inlineAlertError = '')}
          class="add-input mono-nums sym-input"
          aria-label="Simbol alert"
          autocomplete="off"
        />
        <select
          bind:value={newAlertCondition}
          class="add-input cond-select"
          aria-label="Kondisi pemicu alert"
        >
          <option value="auto">Otomatis</option>
          <option value="crossing_up">↗ Crossing Up</option>
          <option value="crossing_down">↘ Crossing Down</option>
          <option value="crossing">↔ Crossing</option>
          <option value="greater_than">≥ Greater</option>
          <option value="less_than">≤ Less</option>
        </select>
      </div>
      <datalist id="inline-alert-symbol-suggestions">
        {#each inlineSymbolSuggestions as sym}
          <option value={sym}></option>
        {/each}
      </datalist>
      <input
        type="text"
        inputmode="decimal"
        placeholder="Target harga (e.g. 69500)..."
        bind:value={newAlertPrice}
        oninput={() => (inlineAlertError = '')}
        class="add-input mono-nums"
        aria-label="Target harga alert"
        autocomplete="off"
        required
      />
      <input
        type="text"
        placeholder="Catatan / Label..."
        bind:value={newAlertLabel}
        class="add-input"
        aria-label="Label catatan alert"
      />
      {#if inlineAlertError}
        <span class="inline-alert-error">{inlineAlertError}</span>
      {/if}
    </div>
    <button type="submit" class="submit-add-btn">Set Alert</button>
  </form>
{/if}

<div class="items-list alerts-list">
  <!-- Section: Alert Aktif (termasuk paused) -->
  {#if activeAlerts.length > 0}
    <div class="section-header">
      <span class="section-label">Aktif</span>
      <span class="section-count">{activeAlerts.length}</span>
    </div>
    {#each activeAlerts as a (a.id)}
      {@const condBadge = getConditionBadge(a.condition)}
      {@const distance = calculateAlertDistance(a.targetPrice, a.symbol)}
      {@const isActiveCoin = isSameSymbol(a.symbol, activeSymbol)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="alert-card {!a.active ? 'paused' : ''} {isActiveCoin ? 'is-active-coin' : ''}"
        role="button"
        tabindex="0"
        title="Beralih ke {a.symbol}"
        onclick={() => handleCardClick(a.symbol)}
        onkeydown={(e) => handleCardKeydown(e, a.symbol)}
      >
        <div class="alert-main">
          <div class="alert-top">
            <span class="alert-sym mono-nums">{a.symbol}</span>

            <span class="badge-cond {condBadge.class}">
              {condBadge.label}
            </span>

            {#if !a.active}
              <span class="badge-alert paused">PAUSED</span>
            {:else}
              <span class="badge-alert active">ACTIVE</span>
            {/if}
          </div>

          <div class="alert-price-row mono-nums">
            <span class="target-val">{formatAlertPrice(a.targetPrice, a.symbol)}</span>
            {#if distance && a.active}
              <span class="distance-pill {distance.isBull ? 'pill-bull' : 'pill-bear'}">
                {distance.pctText} ({distance.diffText})
              </span>
            {/if}
          </div>

          {#if a.label}
            <span class="alert-label">{a.label}</span>
          {/if}
        </div>

        <div class="alert-actions">
          <button
            type="button"
            class="icon-alert-btn toggle {a.active ? 'active' : ''}"
            title={a.active ? 'Jeda alert ini' : 'Aktifkan alert ini'}
            onclick={(e) => handleToggleAlert(e, a.id)}
          >
            {#if a.active}
              <Pause size={12} />
            {:else}
              <Play size={12} />
            {/if}
          </button>

          <button
            type="button"
            class="icon-alert-btn edit"
            title="Sunting Alert Ini (Ubah Target & Kondisi)"
            onclick={(e) => handleEditAlert(e, a)}
          >
            <Pencil size={12} />
          </button>

          <button
            type="button"
            class="icon-alert-btn delete"
            title="Hapus Price Alert ini"
            onclick={(e) => handleRemoveAlert(e, a.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    {/each}
  {/if}

  <!-- Section: Riwayat Terpicu -->
  {#if triggeredAlerts.length > 0}
    <div class="section-header triggered-header">
      <div class="section-header-left">
        <button
          type="button"
          class="section-toggle-btn"
          title={triggeredSectionOpen ? 'Tutup riwayat' : 'Buka riwayat'}
          onclick={() => (triggeredSectionOpen = !triggeredSectionOpen)}
        >
          {#if triggeredSectionOpen}
            <ChevronDown size={11} />
          {:else}
            <ChevronRight size={11} />
          {/if}
        </button>
        <span class="section-label">Riwayat Terpicu</span>
        <span class="section-count triggered">{triggeredAlerts.length}</span>
      </div>
      <!-- Tombol cepat bersihkan riwayat dengan konfirmasi 2 langkah inline -->
      <button
        type="button"
        class="clear-triggered-btn {confirmKey === 'triggered' ? 'confirm-mode' : ''}"
        onclick={(e) => { e.stopPropagation(); handleBulkAction('triggered'); }}
      >
        {#if confirmKey === 'triggered'}
          Yakin?
        {:else}
          Bersihkan
        {/if}
      </button>
    </div>

    {#if triggeredSectionOpen}
      {#each triggeredAlerts as a (a.id)}
        {@const condBadge = getConditionBadge(a.condition)}
        {@const isActiveCoin = isSameSymbol(a.symbol, activeSymbol)}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="alert-card triggered {isActiveCoin ? 'is-active-coin' : ''}"
          role="button"
          tabindex="0"
          title="Beralih ke {a.symbol}"
          onclick={() => handleCardClick(a.symbol)}
          onkeydown={(e) => handleCardKeydown(e, a.symbol)}
        >
          <div class="alert-main">
            <div class="alert-top">
              <span class="alert-sym mono-nums">{a.symbol}</span>

              <span class="badge-cond {condBadge.class}">
                {condBadge.label}
              </span>

              <span class="badge-alert triggered">TRIGGERED</span>
            </div>

            <div class="alert-price-row mono-nums">
              <span class="target-val">{formatAlertPrice(a.targetPrice, a.symbol)}</span>
              {#if a.triggeredPrice}
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
            <button
              type="button"
              class="icon-alert-btn reset"
              title="Aktifkan kembali alert ini"
              onclick={(e) => handleResetAlert(e, a.id)}
            >
              <RotateCcw size={12} />
            </button>

            <button
              type="button"
              class="icon-alert-btn edit"
              title="Sunting Alert Ini"
              onclick={(e) => handleEditAlert(e, a)}
            >
              <Pencil size={12} />
            </button>

            <button
              type="button"
              class="icon-alert-btn delete"
              title="Hapus Price Alert ini"
              onclick={(e) => handleRemoveAlert(e, a.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      {/each}
    {/if}
  {/if}

  {#if filteredAlerts.length === 0}
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
    gap: 6px;
    padding: 5px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
    overflow: visible;
    position: relative;
    z-index: 10;
  }

  /* Filter pills dengan horizontal scroll */
  .alert-filter-tabs {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    scrollbar-width: none;
  }

  .alert-filter-tabs::-webkit-scrollbar {
    display: none;
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
    white-space: nowrap;
    flex-shrink: 0;
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

  /* Tombol aksi toolbar kanan */
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-toolbar-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    padding: 3px 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .icon-toolbar-btn:hover,
  .icon-toolbar-btn.active {
    color: var(--status-danger);
    background-color: color-mix(in srgb, var(--status-danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--status-danger) 25%, transparent);
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
    white-space: nowrap;
  }

  .add-symbol-btn:hover,
  .add-symbol-btn.active {
    background-color: color-mix(in srgb, var(--brand-primary) 14%, transparent);
    border-color: var(--brand-primary);
  }

  /* Menu hapus massal (dropdown popover) */
  .bulk-menu-wrapper {
    position: relative;
  }

  .bulk-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 500;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    min-width: 210px;
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bulk-dropdown-divider {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 4px 0;
  }

  .bulk-dropdown-heading {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
  }

  .bulk-symbols-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bulk-menu-item.sym-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .sym-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sym-badge-cnt {
    font-size: var(--font-size-xs, 9px);
    background-color: var(--bg-elevated);
    padding: 0 4px;
    border-radius: 999px;
    color: var(--text-muted);
    margin-left: auto;
  }

  .bulk-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: var(--font-size-sm, 10px);
    padding: 5px 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
    white-space: nowrap;
  }

  .bulk-menu-item:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .bulk-menu-item.danger {
    color: var(--status-danger);
  }

  .bulk-menu-item.danger:hover {
    background-color: color-mix(in srgb, var(--status-danger) 14%, transparent);
    border-color: color-mix(in srgb, var(--status-danger) 25%, transparent);
  }

  /* State konfirmasi 2 langkah — warna merah + border tegas */
  .bulk-menu-item.confirm-mode,
  .clear-triggered-btn.confirm-mode {
    color: var(--status-danger) !important;
    background-color: color-mix(in srgb, var(--status-danger) 16%, transparent) !important;
    border-color: color-mix(in srgb, var(--status-danger) 35%, transparent) !important;
    font-weight: 700;
  }

  /* Form tambah alert */
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
    min-width: 0;
  }

  .alert-inline-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .sym-input {
    text-transform: uppercase;
    font-weight: 600;
    min-width: 0;
  }

  .cond-select {
    min-width: 0;
    cursor: pointer;
  }

  .inline-alert-error {
    font-size: var(--font-size-xs, 9.5px);
    color: var(--bear-color, #f6465d);
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
    color: var(--on-brand-primary, #000000);
    border: none;
    border-radius: var(--radius-xs);
    font-size: var(--font-size-sm, 10px);
    font-weight: 700;
    padding: 0 8px;
    cursor: pointer;
  }

  /* Daftar utama */
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

  /* Header section Aktif / Riwayat Terpicu */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px;
    margin-top: 2px;
  }

  /* Modifier khusus untuk header section Riwayat Terpicu — sedikit lebih gelap */
  .triggered-header {
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline);
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .section-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs);
  }

  .section-toggle-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .section-label {
    font-size: var(--font-size-xs, 9.5px);
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .section-count {
    font-size: var(--font-size-xs, 9.5px);
    font-weight: 600;
    color: var(--text-dim);
    background-color: var(--bg-elevated);
    padding: 0px 4px;
    border-radius: 999px;
  }

  .section-count.triggered {
    color: var(--bear-color);
    background-color: color-mix(in srgb, var(--bear-color) 14%, transparent);
  }

  /* Tombol bersihkan riwayat cepat di header section */
  .clear-triggered-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    font-size: var(--font-size-xs, 9px);
    padding: 1px 6px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .clear-triggered-btn:hover {
    color: var(--bear-color);
    background-color: color-mix(in srgb, var(--bear-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--bear-color) 25%, transparent);
  }

  /* Kartu alert */
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
    cursor: pointer;
    /* Aksen garis kiri default transparan */
    border-left: 2.5px solid transparent;
  }

  .alert-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-medium);
    border-left-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
  }

  /* Kartu yang koinnya sedang aktif di chart → aksen cyan tegas */
  .alert-card.is-active-coin {
    border-left-color: var(--brand-cyan);
    background-color: color-mix(in srgb, var(--brand-cyan) 5%, transparent);
  }

  .alert-card.is-active-coin:hover {
    background-color: color-mix(in srgb, var(--brand-cyan) 9%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan) 35%, transparent);
    border-left-color: var(--brand-cyan);
  }

  .alert-card.triggered {
    border-color: color-mix(in srgb, var(--bear-color) 45%, transparent);
    background-color: color-mix(in srgb, var(--bear-color) 8%, transparent);
    box-shadow: 0 0 10px var(--bear-glow);
    border-left-color: var(--bear-color);
  }

  .alert-card.triggered.is-active-coin {
    border-left-color: var(--brand-cyan);
  }

  .alert-card.paused {
    opacity: 0.6;
    border-style: dashed;
    border-left-style: solid;
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

  /* Teks simbol koin (bukan button lagi, navigasi lewat klik seluruh kartu) */
  .alert-sym {
    font-size: var(--font-size-base, 11px);
    font-weight: 700;
    color: var(--text-main);
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

  /* Empty state */
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
