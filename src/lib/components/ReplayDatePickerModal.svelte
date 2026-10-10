<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar, Clock, X, Check, History, Sparkles, ArrowRight } from '@lucide/svelte';
  import { replaySession } from '../services/replay';

  interface Props {
    isOpen: boolean;
    bounds?: { first: number; last: number } | null;
    currentBarTime?: number | null;
    onSelectDate?: (timestamp: number) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    bounds: propBounds,
    currentBarTime: propCurrentBarTime,
    onSelectDate,
    onClose,
  }: Props = $props();

  let bounds = $derived(propBounds !== undefined ? propBounds : replaySession.getSnapshot().bounds);
  let currentBarTime = $derived(propCurrentBarTime !== undefined ? propCurrentBarTime : replaySession.getSnapshot().cursorTime);

  // State input datetime dalam format ISO lokal (YYYY-MM-DDTHH:mm)
  let dateTimeInput = $state('');
  let errorMessage = $state('');

  // Hitung default date-time saat modal dibuka
  $effect(() => {
    if (isOpen) {
      errorMessage = '';
      const baseTime = currentBarTime || (bounds ? bounds.last - 24 * 3600 * 1000 : Date.now() - 24 * 3600 * 1000);
      dateTimeInput = toLocalISOString(baseTime);
    }
  });

  function toLocalISOString(epochMs: number): string {
    const d = new Date(epochMs);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatDisplayDate(epochMs: number): string {
    return new Date(epochMs).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  // Quick jump presets
  const presets = [
    { label: '24 Jam Lalu', offsetMs: 24 * 3600 * 1000 },
    { label: '3 Hari Lalu', offsetMs: 3 * 24 * 3600 * 1000 },
    { label: '7 Hari Lalu', offsetMs: 7 * 24 * 3600 * 1000 },
    { label: '30 Hari Lalu', offsetMs: 30 * 24 * 3600 * 1000 },
  ];

  function applyPreset(offsetMs: number) {
    errorMessage = '';
    const referenceTime = bounds?.last || Date.now();
    let target = referenceTime - offsetMs;
    if (bounds?.first && target < bounds.first) {
      target = bounds.first;
    }
    dateTimeInput = toLocalISOString(target);
  }

  function handleSubmit(e?: SubmitEvent) {
    if (e) e.preventDefault();
    errorMessage = '';

    if (!dateTimeInput) {
      errorMessage = 'Pilih tanggal dan waktu yang valid.';
      return;
    }

    const selectedEpoch = new Date(dateTimeInput).getTime();
    if (isNaN(selectedEpoch)) {
      errorMessage = 'Format tanggal tidak valid.';
      return;
    }

    const now = Date.now();
    if (selectedEpoch > now) {
      errorMessage = 'Waktu tidak boleh berada di masa depan.';
      return;
    }

    if (bounds) {
      if (bounds.first && selectedEpoch < bounds.first) {
        // Beri kelonggaran tapi beri warning jika terlalu lampau
        errorMessage = `Riwayat candle paling awal adalah ${formatDisplayDate(bounds.first)}.`;
        return;
      }
      if (bounds.last && selectedEpoch > bounds.last) {
        errorMessage = `Riwayat candle terakhir adalah ${formatDisplayDate(bounds.last)}.`;
        return;
      }
    }

    if (onSelectDate) {
      onSelectDate(selectedEpoch);
    } else {
      replaySession.setCutoff(selectedEpoch);
    }
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal-card glass-panel obsidian-card" role="dialog" aria-modal="true">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="header-icon"><Calendar size={16} /></span>
          <h3>Lompat ke Tanggal Replay</h3>
        </div>
        <button class="close-btn" title="Tutup (Esc)" onclick={onClose}>
          <X size={14} />
        </button>
      </div>

      <!-- Content -->
      <form class="modal-body" onsubmit={handleSubmit}>
        <!-- Quick Jump Presets -->
        <div class="section-block">
          <span class="section-label">PILIHAN CEPAT (QUICK JUMP):</span>
          <div class="presets-grid">
            {#each presets as p}
              <button
                type="button"
                class="preset-chip"
                onclick={() => applyPreset(p.offsetMs)}
              >
                <span class="preset-icon"><Clock size={11} /></span>
                <span>{p.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Custom Date & Time Picker -->
        <div class="section-block">
          <label class="section-label" for="replay-date-picker-input">
            TANGGAL & WAKTU SPESIFIK:
          </label>
          <div class="input-container">
            <input
              id="replay-date-picker-input"
              type="datetime-local"
              class="datetime-input mono-nums"
              bind:value={dateTimeInput}
              max={bounds?.last ? toLocalISOString(bounds.last) : toLocalISOString(Date.now())}
              min={bounds?.first ? toLocalISOString(bounds.first) : undefined}
            />
          </div>
        </div>

        <!-- Bounds Data Info -->
        {#if bounds && bounds.first && bounds.last}
          <div class="bounds-info mono-nums">
            <div class="bounds-row">
              <span class="bounds-lbl">Data Paling Awal:</span>
              <span class="bounds-val">{formatDisplayDate(bounds.first)}</span>
            </div>
            <div class="bounds-row">
              <span class="bounds-lbl">Data Terkini:</span>
              <span class="bounds-val">{formatDisplayDate(bounds.last)}</span>
            </div>
          </div>
        {/if}

        {#if errorMessage}
          <div class="error-banner mono-nums">
            {errorMessage}
          </div>
        {/if}

        <!-- Actions -->
        <div class="modal-footer">
          <button type="button" class="cancel-btn" onclick={onClose}>
            Batal
          </button>
          <button type="submit" class="submit-btn">
            <Check size={13} />
            <span>Mulai Replay dari Tanggal Ini</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(6, 9, 14, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .modal-card {
    width: 420px;
    max-width: 92vw;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .modal-header {
    height: 42px;
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

  .header-icon {
    color: var(--brand-primary);
  }

  .header-title h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
    letter-spacing: -0.01em;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-xs);
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .modal-body {
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.04em;
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .preset-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-chip:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .preset-icon {
    color: var(--text-dim);
  }

  .input-container {
    position: relative;
    width: 100%;
  }

  .datetime-input {
    width: 100%;
    height: 36px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    color: var(--text-main);
    padding: 0 10px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .datetime-input:focus {
    border-color: var(--brand-primary);
  }

  .bounds-info {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px 10px;
    font-size: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bounds-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bounds-lbl {
    color: var(--text-dim);
  }

  .bounds-val {
    color: var(--text-muted);
  }

  .error-banner {
    background-color: rgba(255, 59, 105, 0.12);
    border: 1px solid rgba(255, 59, 105, 0.3);
    color: var(--bear-color);
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 11px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--border-hairline);
  }

  .cancel-btn {
    height: 30px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .submit-btn {
    height: 30px;
    padding: 0 14px;
    background-color: var(--brand-primary);
    border: 1px solid var(--brand-primary);
    border-radius: var(--radius-xs);
    color: var(--bg-darkest);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .submit-btn:hover {
    opacity: 0.9;
  }
</style>
