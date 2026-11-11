<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { Bell, X, ArrowUpRight, ArrowDownRight, MoveHorizontal, Check, Zap, Edit3, Trash2 } from '@lucide/svelte';
  import type { AlertCondition, AlertFrequency, PriceAlert } from '../types/market';
  import { alertService } from '../services/alertService';
  import { marketFeed } from '../services/market';
  import { isSameInstrument } from '../services/instrumentIdentity';
  import { parseAdaptiveSymbol } from '../services/market/symbolSearchService';
  import { formatPriceWithQuoteSymbol } from '../services/priceScaleLabelService';
  import {
    buildAlertModalInitialDraft,
    buildAlertModalInitSignature,
    buildAutoAlertLabel,
    computeAlertPriceDiff,
    computeTickAlignedAlertPrice,
    inferAlertConditionFromPrice,
    mergeAlertSymbolSuggestions,
    parseAlertPriceInput,
    resolveAlertReferenceMarketPrice,
    resolveAlertTargetSymbol,
    shouldInitializeAlertModalSession,
  } from '../services/alertFormHelper';

  interface Props {
    isOpen: boolean;
    chartSymbol?: string;
    chartTickSize?: number;
    initialSymbol?: string;
    initialPrice?: number;
    currentMarketPrice?: number;
    editingAlert?: PriceAlert | null;
    availableSymbols?: string[];
    onClose: () => void;
    onCreated?: (alert: any) => void;
    onUpdated?: (alert: PriceAlert) => void;
  }

  let {
    isOpen,
    chartSymbol,
    chartTickSize,
    initialSymbol = 'BTCUSDT',
    initialPrice,
    currentMarketPrice = 0,
    editingAlert = null,
    availableSymbols = [],
    onClose,
    onCreated,
    onUpdated,
  }: Props = $props();

  let symbolInput = $state('');
  let targetPrice = $state<string>('');
  let condition = $state<AlertCondition>('crossing');
  let frequency = $state<AlertFrequency>('once');
  let label = $state('');
  let validationError = $state('');

  let priceInputEl = $state<HTMLInputElement | null>(null);
  let symbolInputEl = $state<HTMLInputElement | null>(null);

  let otherSymbolTickerPrice = $state<number | null>(null);
  let isFetchingOtherTicker = $state(false);

  // Pelacak internal non-reaktif agar ticker pasar tidak me-reset input manual pengguna
  let wasOpen = false;
  let lastInitSignature: string | null = null;
  let hasUserEditedCondition = false;
  let hasUserEditedLabel = false;

  let effectiveChartSymbol = $derived((chartSymbol || initialSymbol || 'BTCUSDT').trim() || 'BTCUSDT');
  let canonicalSymbol = $derived(
    resolveAlertTargetSymbol(symbolInput, editingAlert?.symbol || initialSymbol || effectiveChartSymbol)
  );
  let isDifferentFromChart = $derived(!isSameInstrument(canonicalSymbol, effectiveChartSymbol));
  let targetQuote = $derived(parseAdaptiveSymbol(canonicalSymbol).quoteAsset || 'USDT');
  let symbolSuggestions = $derived(
    mergeAlertSymbolSuggestions(effectiveChartSymbol, availableSymbols, symbolInput)
  );
  let referenceMarketPrice = $derived(
    resolveAlertReferenceMarketPrice({
      typedSymbol: symbolInput,
      chartSymbol: effectiveChartSymbol,
      chartMarketPrice: currentMarketPrice || 0,
      cachedTickerPrice: otherSymbolTickerPrice,
    })
  );
  let parsedTargetPrice = $derived(parseAlertPriceInput(targetPrice));
  let priceDiff = $derived(computeAlertPriceDiff(targetPrice, referenceMarketPrice));

  function formatMoney(val: number, quote = targetQuote): string {
    if (!Number.isFinite(val) || val <= 0) return '--';
    return formatPriceWithQuoteSymbol(val, quote);
  }

  // Inisialisasi nilai modal HANYA saat modal baru dibuka atau target alert/simbol awal berubah
  $effect(() => {
    const open = isOpen;
    const initSym = initialSymbol;
    const initPx = initialPrice;
    const editItem = editingAlert;

    const initSignature = buildAlertModalInitSignature({
      initialSymbol: initSym,
      initialPrice: initPx,
      editingAlert: editItem,
    });

    const guard = shouldInitializeAlertModalSession({
      isOpen: open,
      wasOpen,
      initSignature,
      lastInitSignature,
    });
    wasOpen = guard.nextWasOpen;
    lastInitSignature = guard.nextSignature;

    if (!open) {
      otherSymbolTickerPrice = null;
      isFetchingOtherTicker = false;
      validationError = '';
      return;
    }

    if (!guard.shouldInit) return;

    const initialDraft = untrack(() =>
      buildAlertModalInitialDraft({
        initialSymbol: initSym,
        initialPrice: initPx,
        currentMarketPrice,
        editingAlert: editItem,
      })
    );

    symbolInput = initialDraft.symbol;
    targetPrice = initialDraft.targetPrice;
    condition = initialDraft.condition;
    frequency = initialDraft.frequency;
    label = initialDraft.label;
    validationError = '';
    hasUserEditedCondition = Boolean(editItem);
    hasUserEditedLabel = Boolean(editItem);
    otherSymbolTickerPrice = null;

    tick().then(() => {
      if (isOpen && document.activeElement !== symbolInputEl) {
        priceInputEl?.focus();
        priceInputEl?.select();
      }
    });
  });

  // Lookup harga referensi koin lain di latar belakang tanpa memengaruhi grafik aktif
  $effect(() => {
    const open = isOpen;
    const sym = canonicalSymbol;
    const diffCoin = isDifferentFromChart;

    if (!open || !diffCoin || !sym) {
      otherSymbolTickerPrice = null;
      isFetchingOtherTicker = false;
      return;
    }

    return marketFeed.watchSymbolTicker(
      sym,
      (fetched) => {
        otherSymbolTickerPrice = fetched && fetched.price > 0 ? fetched.price : null;
      },
      {
        debounceMs: 260,
        onLoadingChange: (loading) => {
          isFetchingOtherTicker = loading;
        },
      }
    );
  });

  function applyResolvedSymbol(sym: string) {
    symbolInput = sym;
    validationError = '';
    if (!hasUserEditedLabel) {
      label = buildAutoAlertLabel(sym, targetPrice);
    }
  }

  function handleSymbolInputChange(e: Event) {
    symbolInput = (e.currentTarget as HTMLInputElement).value;
    validationError = '';
    if (!hasUserEditedLabel) {
      const resolved = resolveAlertTargetSymbol(
        symbolInput,
        editingAlert?.symbol || initialSymbol || effectiveChartSymbol
      );
      label = buildAutoAlertLabel(resolved, targetPrice);
    }
  }

  function handleSymbolInputBlur() {
    if (!symbolInput.trim()) return;
    const resolved = resolveAlertTargetSymbol(
      symbolInput,
      editingAlert?.symbol || initialSymbol || effectiveChartSymbol
    );
    if (resolved && resolved !== symbolInput) {
      applyResolvedSymbol(resolved);
    }
  }

  function handleTargetPriceInput(e: Event) {
    targetPrice = (e.currentTarget as HTMLInputElement).value;
    validationError = '';
    if (!hasUserEditedLabel) {
      label = buildAutoAlertLabel(canonicalSymbol, targetPrice);
    }
    if (!hasUserEditedCondition && !editingAlert) {
      const p = parseAlertPriceInput(targetPrice);
      if (p && referenceMarketPrice > 0) {
        condition = inferAlertConditionFromPrice(p, referenceMarketPrice);
      }
    }
  }

  function handleLabelInput(e: Event) {
    label = (e.currentTarget as HTMLInputElement).value;
    hasUserEditedLabel = true;
  }

  function handleSelectCondition(nextCond: AlertCondition) {
    condition = nextCond;
    hasUserEditedCondition = true;
  }

  function applyPercentageOffset(percent: number) {
    if (!referenceMarketPrice || referenceMarketPrice <= 0) return;
    const computedPrice = percent === 0 ? referenceMarketPrice : referenceMarketPrice * (1 + percent / 100);
    const aligned = computeTickAlignedAlertPrice(computedPrice, !isDifferentFromChart, chartTickSize);
    const snappedPrice = aligned.price > 0 ? aligned.price : computedPrice;
    targetPrice = aligned.formattedText || String(snappedPrice);
    validationError = '';
    if (!hasUserEditedCondition) {
      condition = inferAlertConditionFromPrice(snappedPrice, referenceMarketPrice);
    }
    if (!hasUserEditedLabel) {
      label = buildAutoAlertLabel(canonicalSymbol, targetPrice);
    }
  }

  async function handleSubmit(e?: Event) {
    e?.preventDefault();
    if (!symbolInput.trim()) {
      validationError = 'Masukkan simbol / pasangan koin terlebih dahulu.';
      symbolInputEl?.focus();
      return;
    }

    const finalSymbol = resolveAlertTargetSymbol(
      symbolInput,
      editingAlert?.symbol || initialSymbol || effectiveChartSymbol
    );
    const p = parseAlertPriceInput(targetPrice);
    if (!p || isNaN(p) || p <= 0) {
      validationError = 'Masukkan target harga numerik yang valid (> 0).';
      priceInputEl?.focus();
      return;
    }

    const sameAsChart = isSameInstrument(finalSymbol, effectiveChartSymbol);
    const aligned = computeTickAlignedAlertPrice(p, sameAsChart, chartTickSize);
    const snappedPrice = aligned.price > 0 ? aligned.price : p;
    const labelPriceText = aligned.formattedText || String(snappedPrice);
    const finalLabel = label.trim() || buildAutoAlertLabel(finalSymbol, labelPriceText);

    if (editingAlert) {
      const updated = await alertService.updateAlert(editingAlert.id, {
        symbol: finalSymbol,
        targetPrice: snappedPrice,
        condition,
        frequency,
        label: finalLabel,
      });
      if (updated) {
        onUpdated?.(updated);
      }
    } else {
      const newA = await alertService.addAlert({
        symbol: finalSymbol,
        targetPrice: snappedPrice,
        condition,
        frequency,
        label: finalLabel,
      });
      onCreated?.(newA);
    }
    onClose();
  }

  async function handleDeleteThisAlert() {
    if (!editingAlert) return;
    await alertService.deleteAlert(editingAlert.id);
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- Modal Backdrop -->
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="modal-card obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="bell-pill">
            {#if editingAlert}
              <Edit3 size={14} />
            {:else}
              <Bell size={14} />
            {/if}
          </span>
          <h3>{editingAlert ? 'Sunting Price Alert' : 'Buat Price Alert'}</h3>
          <span class="symbol-pill mono-nums">{canonicalSymbol}</span>
        </div>
        <button type="button" class="close-btn" onclick={onClose} title="Tutup (Esc)">
          <X size={15} />
        </button>
      </div>

      <!-- Form Body -->
      <form class="modal-body" onsubmit={handleSubmit}>
        <!-- Input Simbol / Koin Target -->
        <div class="form-group">
          <label for="alert-symbol-input">
            <span>Pasangan / Koin Target</span>
            <span class="sub-label">
              {#if isDifferentFromChart}
                <span class="scope-tag other">Berbeda dari chart aktif ({effectiveChartSymbol})</span>
              {:else}
                <span class="scope-tag sync">Sinkron dengan chart</span>
              {/if}
            </span>
          </label>
          <div class="symbol-input-row">
            <input
              id="alert-symbol-input"
              bind:this={symbolInputEl}
              type="text"
              list="alert-modal-symbol-suggestions"
              value={symbolInput}
              oninput={handleSymbolInputChange}
              onblur={handleSymbolInputBlur}
              placeholder="Contoh: BTCUSDT, ETH, SOLUSDT..."
              class="text-input mono-nums symbol-input-field"
              autocomplete="off"
              spellcheck="false"
            />
            {#if symbolInput.trim() && symbolInput.trim().toUpperCase() !== canonicalSymbol}
              <button
                type="button"
                class="resolve-sym-btn mono-nums"
                onclick={() => applyResolvedSymbol(canonicalSymbol)}
                title="Gunakan simbol kanonikal {canonicalSymbol}"
              >
                → {canonicalSymbol}
              </button>
            {/if}
          </div>
          <datalist id="alert-modal-symbol-suggestions">
            {#each symbolSuggestions as sym}
              <option value={sym}></option>
            {/each}
          </datalist>
        </div>

        <!-- Input Target Harga -->
        <div class="form-group">
          <label for="alert-target-price">
            <span>Target Harga ({targetQuote})</span>
            {#if referenceMarketPrice > 0}
              <span class="sub-label mono-nums">
                Pasar {canonicalSymbol}: {formatMoney(referenceMarketPrice)}
              </span>
            {:else if isFetchingOtherTicker}
              <span class="sub-label">Memuat harga {canonicalSymbol}...</span>
            {:else if isDifferentFromChart}
              <span class="sub-label">Input harga {canonicalSymbol} secara manual</span>
            {/if}
          </label>
          <div class="input-with-symbol">
            <input
              id="alert-target-price"
              bind:this={priceInputEl}
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              value={targetPrice}
              oninput={handleTargetPriceInput}
              class="text-input mono-nums price-large {validationError && (!parsedTargetPrice || parsedTargetPrice <= 0) ? 'input-invalid' : ''}"
              autocomplete="off"
              required
            />
          </div>

          <!-- Tombol Shortcut Jarak Persentase Cepat -->
          <div class="percentage-presets">
            <span class="preset-label">Offset Cepat:</span>
            <button type="button" class="preset-btn bear" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(-5)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '-5% dari harga pasar'}>-5%</button>
            <button type="button" class="preset-btn bear" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(-2)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '-2% dari harga pasar'}>-2%</button>
            <button type="button" class="preset-btn bear" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(-1)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '-1% dari harga pasar'}>-1%</button>
            <button type="button" class="preset-btn neutral" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(0)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : 'Gunakan harga pasar koin ini'}>Pasar</button>
            <button type="button" class="preset-btn bull" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(1)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '+1% dari harga pasar'}>+1%</button>
            <button type="button" class="preset-btn bull" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(2)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '+2% dari harga pasar'}>+2%</button>
            <button type="button" class="preset-btn bull" disabled={referenceMarketPrice <= 0} onclick={() => applyPercentageOffset(5)} title={referenceMarketPrice <= 0 ? 'Harga pasar koin target belum tersedia' : '+5% dari harga pasar'}>+5%</button>
          </div>

          <!-- Jarak Persentase -->
          {#if priceDiff}
            <div class="price-diff-hint mono-nums">
              {#if priceDiff.diff > 0}
                <span class="text-bull">+{priceDiff.pct.toFixed(2)}% ({formatMoney(priceDiff.diff)}) di atas harga pasar {canonicalSymbol}</span>
              {:else if priceDiff.diff < 0}
                <span class="text-bear">{priceDiff.pct.toFixed(2)}% ({formatMoney(Math.abs(priceDiff.diff))}) di bawah harga pasar {canonicalSymbol}</span>
              {:else}
                <span class="text-muted">Tepat pada harga pasar {canonicalSymbol} saat ini</span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Pilihan Kondisi -->
        <div class="form-group">
          <label for="condition-options">Kondisi Pemicu</label>
          <div id="condition-options" class="condition-tabs">
            <button
              type="button"
              class="cond-tab {condition === 'crossing_up' ? 'active' : ''}"
              onclick={() => handleSelectCondition('crossing_up')}
              title="Terpicu saat harga menembus ke atas target"
            >
              <ArrowUpRight size={13} class="cond-icon bull" />
              <span>Menembus Ke Atas (↗)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'crossing_down' ? 'active' : ''}"
              onclick={() => handleSelectCondition('crossing_down')}
              title="Terpicu saat harga menembus ke bawah target"
            >
              <ArrowDownRight size={13} class="cond-icon bear" />
              <span>Menembus Ke Bawah (↘)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'crossing' ? 'active' : ''}"
              onclick={() => handleSelectCondition('crossing')}
              title="Terpicu saat harga menyeberangi target ke arah mana pun"
            >
              <MoveHorizontal size={13} class="cond-icon" />
              <span>Menyeberang (Crossing)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'greater_than' ? 'active' : ''}"
              onclick={() => handleSelectCondition('greater_than')}
              title="Terpicu jika harga lebih besar atau sama dengan target"
            >
              <span>Lebih Besar (≥)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'less_than' ? 'active' : ''}"
              onclick={() => handleSelectCondition('less_than')}
              title="Terpicu jika harga lebih kecil atau sama dengan target"
            >
              <span>Lebih Kecil (≤)</span>
            </button>
          </div>
        </div>

        <!-- Pilihan Frekuensi -->
        <div class="form-group">
          <label for="frequency-options">Frekuensi Notifikasi</label>
          <div id="frequency-options" class="frequency-options">
            <button
              type="button"
              class="freq-card {frequency === 'once' ? 'active' : ''}"
              onclick={() => (frequency = 'once')}
            >
              <div class="freq-header">
                <span class="freq-title">Hanya Sekali (Once)</span>
                {#if frequency === 'once'}
                  <Check size={12} class="check-icon" />
                {/if}
              </div>
              <p class="freq-desc">Alert dinonaktifkan otomatis setelah terpicu satu kali.</p>
            </button>

            <button
              type="button"
              class="freq-card {frequency === 'every_time' ? 'active' : ''}"
              onclick={() => (frequency = 'every_time')}
            >
              <div class="freq-header">
                <span class="freq-title">Setiap Kali (Every Time)</span>
                {#if frequency === 'every_time'}
                  <Check size={12} class="check-icon" />
                {/if}
              </div>
              <p class="freq-desc">Alert tetap aktif dan akan membunyikan alarm tiap kali disentuh.</p>
            </button>
          </div>
        </div>

        <!-- Label / Catatan -->
        <div class="form-group">
          <label for="alert-label-input">Label / Catatan Pesan</label>
          <input
            id="alert-label-input"
            type="text"
            placeholder="Contoh: Resistance H4 Breakout, TP 1..."
            value={label}
            oninput={handleLabelInput}
            class="text-input"
          />
        </div>

        {#if validationError}
          <div class="validation-error-banner" role="alert">
            {validationError}
          </div>
        {/if}

        <!-- Modal Actions -->
        <div class="modal-footer">
          {#if editingAlert}
            <button type="button" class="btn-delete-alert" onclick={handleDeleteThisAlert} title="Hapus alert ini">
              <Trash2 size={12} />
              <span>Hapus Alert Ini</span>
            </button>
          {/if}
          <div class="footer-right">
            <button type="button" class="btn-cancel" onclick={onClose}>
              Batal
            </button>
            <button type="submit" class="btn-submit {editingAlert ? 'btn-update' : ''}">
              {#if editingAlert}
                <Edit3 size={13} />
                <span>Simpan Perubahan</span>
              {:else}
                <Zap size={13} />
                <span>Pasang Alert {canonicalSymbol}</span>
              {/if}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background-color: rgba(6, 9, 14, 0.78);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    width: 450px;
    max-width: 95vw;
    max-height: 92vh;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    height: 44px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bell-pill {
    color: var(--brand-cyan);
    display: flex;
    align-items: center;
  }

  .header-title h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .symbol-pill {
    font-size: 10px;
    font-weight: 700;
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.12);
    border: 1px solid rgba(0, 240, 144, 0.25);
    padding: 1px 6px;
    border-radius: var(--radius-xs);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .modal-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-group label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sub-label {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 400;
  }

  .scope-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--radius-xs);
  }

  .scope-tag.other {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.28);
  }

  .scope-tag.sync {
    color: var(--text-dim);
  }

  .symbol-input-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .symbol-input-field {
    flex: 1;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .resolve-sym-btn {
    flex-shrink: 0;
    background-color: rgba(56, 189, 248, 0.14);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: var(--brand-cyan);
    font-size: 10px;
    font-weight: 700;
    padding: 6px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .resolve-sym-btn:hover {
    background-color: rgba(56, 189, 248, 0.24);
  }

  .input-with-symbol {
    display: flex;
  }

  .input-with-symbol .text-input {
    width: 100%;
  }

  .text-input {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 12px;
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.12s ease;
  }

  .text-input:focus {
    border-color: var(--border-focus);
  }

  .text-input.input-invalid {
    border-color: var(--bear-color, #f6465d);
  }

  .price-large {
    font-size: 16px;
    font-weight: 700;
    color: var(--brand-cyan);
    letter-spacing: 0.02em;
  }

  .percentage-presets {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .preset-label {
    font-size: 10px;
    color: var(--text-dim);
    margin-right: 2px;
  }

  .preset-btn {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    padding: 3px 6px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .preset-btn:hover:not(:disabled) {
    border-color: var(--border-focus);
    background-color: var(--bg-hover);
  }

  .preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .preset-btn.bear {
    color: var(--bear-color);
  }

  .preset-btn.bull {
    color: var(--bull-color);
  }

  .preset-btn.neutral {
    color: var(--brand-cyan);
    font-weight: 600;
  }

  .price-diff-hint {
    font-size: 10px;
    margin-top: 4px;
  }

  .text-bull { color: var(--bull-color); }
  .text-bear { color: var(--bear-color); }
  .text-muted { color: var(--text-muted); }

  /* Condition Tabs */
  .condition-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .cond-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    padding: 6px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s ease;
    text-align: left;
  }

  .cond-tab:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .cond-tab.active {
    background-color: rgba(56, 189, 248, 0.12);
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
    font-weight: 600;
  }

  :global(.cond-icon.bull) { color: var(--bull-color); }
  :global(.cond-icon.bear) { color: var(--bear-color); }

  /* Frequency Cards */
  .frequency-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .freq-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
  }

  .freq-card:hover {
    background-color: var(--bg-hover);
  }

  .freq-card.active {
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.06);
  }

  .freq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .freq-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .freq-card.active .freq-title {
    color: var(--brand-primary);
  }

  :global(.check-icon) {
    color: var(--brand-primary);
  }

  .freq-desc {
    font-size: 9px;
    color: var(--text-dim);
    line-height: 1.3;
  }

  .validation-error-banner {
    font-size: 11px;
    color: var(--bear-color, #f6465d);
    background-color: rgba(246, 70, 93, 0.12);
    border: 1px solid rgba(246, 70, 93, 0.35);
    border-radius: var(--radius-xs);
    padding: 6px 8px;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--border-hairline);
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .btn-delete-alert {
    background-color: rgba(246, 70, 93, 0.12);
    border: 1px solid rgba(246, 70, 93, 0.3);
    color: var(--brand-down, #f6465d);
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-delete-alert:hover {
    background-color: rgba(246, 70, 93, 0.22);
    border-color: rgba(246, 70, 93, 0.5);
  }

  .btn-cancel {
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    padding: 6px 12px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .btn-submit {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--brand-primary);
    border: none;
    border-radius: var(--radius-xs);
    color: var(--on-brand-primary, #000000);
    font-size: 11px;
    font-weight: 700;
    padding: 6px 14px;
    cursor: pointer;
    transition: opacity 0.12s ease;
  }

  .btn-submit:hover {
    opacity: 0.9;
  }
</style>
