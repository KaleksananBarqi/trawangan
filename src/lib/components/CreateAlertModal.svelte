<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Bell, X, ArrowUpRight, ArrowDownRight, MoveHorizontal, Check, Zap } from '@lucide/svelte';
  import type { AlertCondition, AlertFrequency } from '../types/market';
  import { alertService } from '../services/alertService';

  interface Props {
    isOpen: boolean;
    initialSymbol: string;
    initialPrice?: number;
    currentMarketPrice?: number;
    onClose: () => void;
    onCreated?: (alert: any) => void;
  }

  let {
    isOpen,
    initialSymbol,
    initialPrice,
    currentMarketPrice = 0,
    onClose,
    onCreated,
  }: Props = $props();

  let symbol = $state('');
  let targetPrice = $state<string>('');
  let condition = $state<AlertCondition>('crossing');
  let frequency = $state<AlertFrequency>('once');
  let label = $state('');
  let priceInputEl = $state<HTMLInputElement | null>(null);

  // Auto set nilai awal saat modal terbuka
  $effect(() => {
    if (isOpen) {
      symbol = initialSymbol || 'BTCUSDT';
      const curP = currentMarketPrice || 0;

      if (initialPrice !== undefined && initialPrice > 0) {
        targetPrice = initialPrice.toString();
        // Otomatis pilih kondisi cerdas berdasarkan harga pasar vs harga target
        if (curP > 0) {
          if (initialPrice > curP) {
            condition = 'crossing_up';
          } else if (initialPrice < curP) {
            condition = 'crossing_down';
          } else {
            condition = 'crossing';
          }
        }
      } else if (curP > 0) {
        targetPrice = curP.toString();
        condition = 'crossing_up';
      } else {
        targetPrice = '';
        condition = 'crossing';
      }

      label = `Target ${symbol} @ ${targetPrice}`;

      tick().then(() => {
        priceInputEl?.focus();
        priceInputEl?.select();
      });
    }
  });

  // Hitung persentase jarak harga target dari harga saat ini
  let priceDiff = $derived.by(() => {
    const p = parseFloat(targetPrice);
    if (!p || !currentMarketPrice || currentMarketPrice <= 0) return null;
    const diff = p - currentMarketPrice;
    const pct = (diff / currentMarketPrice) * 100;
    return {
      diff,
      pct,
      isHigher: diff > 0,
    };
  });

  async function handleSubmit(e?: Event) {
    e?.preventDefault();
    const p = parseFloat(targetPrice);
    if (!p || isNaN(p) || p <= 0) return;

    const newA = await alertService.addAlert({
      symbol: symbol.toUpperCase(),
      targetPrice: p,
      condition,
      frequency,
      label: label.trim() || `Target ${symbol} @ ${p}`,
    });

    onCreated?.(newA);
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
    >
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="bell-pill"><Bell size={14} /></span>
          <h3>Buat Price Alert</h3>
          <span class="symbol-pill mono-nums">{symbol}</span>
        </div>
        <button type="button" class="close-btn" onclick={onClose} title="Tutup (Esc)">
          <X size={15} />
        </button>
      </div>

      <!-- Form Body -->
      <form class="modal-body" onsubmit={handleSubmit}>
        <!-- Input Target Harga -->
        <div class="form-group">
          <label for="alert-target-price">
            <span>Target Harga ($)</span>
            {#if currentMarketPrice > 0}
              <span class="sub-label mono-nums">
                Harga Pasar Saat Ini: ${currentMarketPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            {/if}
          </label>
          <div class="input-with-symbol">
            <input
              id="alert-target-price"
              bind:this={priceInputEl}
              type="number"
              step="any"
              placeholder="0.00"
              bind:value={targetPrice}
              class="text-input mono-nums price-large"
              required
            />
          </div>

          <!-- Jarak Persentase -->
          {#if priceDiff}
            <div class="price-diff-hint mono-nums">
              {#if priceDiff.diff > 0}
                <span class="text-bull">+{priceDiff.pct.toFixed(2)}% (${priceDiff.diff.toFixed(2)}) di atas harga pasar</span>
              {:else if priceDiff.diff < 0}
                <span class="text-bear">{priceDiff.pct.toFixed(2)}% (${Math.abs(priceDiff.diff).toFixed(2)}) di bawah harga pasar</span>
              {:else}
                <span class="text-muted">Tepat pada harga pasar saat ini</span>
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
              onclick={() => (condition = 'crossing_up')}
              title="Terpicu saat harga menembus ke atas target"
            >
              <ArrowUpRight size={13} class="cond-icon bull" />
              <span>Menembus Ke Atas (↗)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'crossing_down' ? 'active' : ''}"
              onclick={() => (condition = 'crossing_down')}
              title="Terpicu saat harga menembus ke bawah target"
            >
              <ArrowDownRight size={13} class="cond-icon bear" />
              <span>Menembus Ke Bawah (↘)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'crossing' ? 'active' : ''}"
              onclick={() => (condition = 'crossing')}
              title="Terpicu saat harga menyeberangi target ke arah mana pun"
            >
              <MoveHorizontal size={13} class="cond-icon" />
              <span>Menyeberang (Crossing)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'greater_than' ? 'active' : ''}"
              onclick={() => (condition = 'greater_than')}
              title="Terpicu jika harga lebih besar atau sama dengan target"
            >
              <span>Lebih Besar (≥)</span>
            </button>

            <button
              type="button"
              class="cond-tab {condition === 'less_than' ? 'active' : ''}"
              onclick={() => (condition = 'less_than')}
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
            bind:value={label}
            class="text-input"
          />
        </div>

        <!-- Modal Actions -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick={onClose}>
            Batal
          </button>
          <button type="submit" class="btn-submit">
            <Zap size={13} />
            <span>Pasang Price Alert</span>
          </button>
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
    width: 440px;
    max-width: 95vw;
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
    gap: 14px;
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
  }

  .sub-label {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 400;
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

  .price-large {
    font-size: 16px;
    font-weight: 700;
    color: var(--brand-cyan);
    letter-spacing: 0.02em;
  }

  .price-diff-hint {
    font-size: 10px;
    margin-top: 2px;
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

  .cond-icon.bull { color: var(--bull-color); }
  .cond-icon.bear { color: var(--bear-color); }

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

  .check-icon {
    color: var(--brand-primary);
  }

  .freq-desc {
    font-size: 9px;
    color: var(--text-dim);
    line-height: 1.3;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--border-hairline);
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
    color: var(--bg-darkest);
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
