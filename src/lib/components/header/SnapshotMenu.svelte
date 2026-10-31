<script lang="ts">
  import { Camera, Copy, Download, SlidersHorizontal, ChevronDown, Check } from '@lucide/svelte';
  import type { SnapshotScaleMultiplier } from '../../types/market';
  import { calculateCompositeDimensions } from '../../services/chartSnapshotService';

  interface Props {
    onRequestQuickCopySnapshot?: () => void;
    onRequestQuickDownloadSnapshot?: () => void;
    onOpenSnapshotPreview?: () => void;
    currentScaleMultiplier?: SnapshotScaleMultiplier;
    onScaleMultiplierChange?: (scale: SnapshotScaleMultiplier) => void;
    chartDimensions?: { width: number; height: number };
    isProcessing?: boolean;
  }

  let {
    onRequestQuickCopySnapshot,
    onRequestQuickDownloadSnapshot,
    onOpenSnapshotPreview,
    currentScaleMultiplier = 2,
    onScaleMultiplierChange,
    chartDimensions,
    isProcessing = false,
  }: Props = $props();

  let showMenu = $state(false);
  let copyFeedback = $state(false);
  let selectedScale = $state<SnapshotScaleMultiplier>(currentScaleMultiplier);

  $effect(() => {
    if (currentScaleMultiplier !== undefined) {
      selectedScale = currentScaleMultiplier;
    }
  });

  const MULTIPLIERS: SnapshotScaleMultiplier[] = [1, 2, 4, 6];

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showMenu && !target.closest('.snapshot-menu-group')) {
      showMenu = false;
    }
  }

  function handleSelectScale(mult: SnapshotScaleMultiplier) {
    selectedScale = mult;
    onScaleMultiplierChange?.(mult);
  }

  function getDimensionText(mult: SnapshotScaleMultiplier): string {
    const baseW = chartDimensions?.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const baseH = chartDimensions?.height || (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.75) : 1080);
    const dim = calculateCompositeDimensions(baseW, baseH, {
      mode: 'branded',
      scaleMultiplier: mult,
      metadata: {
        symbol: 'BTCUSDT',
        timeframe: '15m',
        providerId: 'binance',
      },
    });
    return `${mult}x · ${dim.width} × ${dim.height} px`;
  }

  function handleQuickCopy() {
    showMenu = false;
    copyFeedback = true;
    setTimeout(() => {
      copyFeedback = false;
    }, 1200);
    onRequestQuickCopySnapshot?.();
  }

  function handleQuickDownload() {
    showMenu = false;
    onRequestQuickDownloadSnapshot?.();
  }

  function handleOpenPreview() {
    showMenu = false;
    onOpenSnapshotPreview?.();
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<div class="snapshot-menu-group">
  <button
    type="button"
    class="snapshot-trigger-btn {showMenu ? 'active' : ''}"
    title="Ambil Tangkapan Layar (Shortcut Ctrl+Shift+S)"
    aria-label="Ambil Tangkapan Layar"
    onclick={() => (showMenu = !showMenu)}
  >
    {#if isProcessing}
      <span class="trigger-mini-spinner"></span>
    {:else if copyFeedback}
      <Check size={13} class="camera-icon text-brand" />
    {:else}
      <Camera size={13} class="camera-icon" />
    {/if}
    <span class="btn-text">{isProcessing ? 'Rendering...' : 'Snapshot'}</span>
    <ChevronDown size={10} class="dropdown-chevron {showMenu ? 'open' : ''}" />
  </button>

  {#if showMenu}
    <div class="snapshot-dropdown obsidian-panel">
      <div class="dropdown-header">
        <span class="dropdown-title">TANGKAPAN LAYAR</span>
      </div>

      <div class="menu-items">
        <!-- 1. Salin Gambar ke Clipboard -->
        <button
          type="button"
          class="menu-item-btn"
          onclick={handleQuickCopy}
          disabled={isProcessing}
          title="Salin gambar PNG {selectedScale}x langsung ke clipboard sistem"
        >
          <div class="item-left">
            <Copy size={13} class="item-icon text-cyan" />
            <div class="item-text">
              <span class="item-title">Salin Gambar ({selectedScale}x)</span>
            </div>
          </div>
          <span class="shortcut-badge mono-nums">Ctrl+Shift+S</span>
        </button>

        <!-- 2. Simpan Gambar PNG -->
        <button
          type="button"
          class="menu-item-btn"
          onclick={handleQuickDownload}
          disabled={isProcessing}
          title="Unduh file gambar PNG dengan format terstruktur"
        >
          <div class="item-left">
            <Download size={13} class="item-icon text-muted" />
            <div class="item-text">
              <span class="item-title">Simpan Gambar ({selectedScale}x)</span>
            </div>
          </div>
        </button>

        <!-- 3. Resolusi Multiplier (1x, 2x, 4x, 6x) (#125) -->
        <div class="dropdown-divider"></div>
        <div class="dropdown-section-header">
          <span class="dropdown-title">RESOLUSI MULTIPLIER</span>
          <span class="scale-est-label mono-nums">{getDimensionText(selectedScale)}</span>
        </div>
        <div class="scale-chips-row">
          {#each MULTIPLIERS as mult}
            <button
              type="button"
              class="scale-chip-btn {selectedScale === mult ? 'active' : ''}"
              onclick={() => handleSelectScale(mult)}
              disabled={isProcessing}
              title="Pilih skala {getDimensionText(mult)}"
            >
              <span class="scale-chip-num">{mult}x</span>
            </button>
          {/each}
        </div>

        <!-- Indikator Status Pemrosesan Asinkron (#125) -->
        {#if isProcessing}
          <div class="processing-status-bar">
            <span class="processing-spinner"></span>
            <span class="processing-msg">Memproses snapshot {selectedScale}x...</span>
          </div>
        {/if}

        <div class="dropdown-divider"></div>

        <!-- 4. Pratinjau & Kustomisasi -->
        <button
          type="button"
          class="menu-item-btn preview-btn"
          onclick={handleOpenPreview}
          disabled={isProcessing}
          title="Buka dialog pratinjau snapshot interaktif"
        >
          <div class="item-left">
            <SlidersHorizontal size={13} class="item-icon text-brand" />
            <div class="item-text">
              <span class="item-title">Pratinjau & Kustomisasi...</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .snapshot-menu-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .snapshot-trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    height: 26px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .snapshot-trigger-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .snapshot-trigger-btn.active {
    background-color: var(--bg-hover);
    color: var(--brand-primary);
    border-color: var(--brand-primary);
  }

  .trigger-mini-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 105, 180, 0.2);
    border-top-color: #ff69b4;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .camera-icon {
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .btn-text {
    font-size: 11px;
    font-weight: 500;
  }

  .dropdown-chevron {
    transition: transform 0.15s ease;
    color: var(--text-dim);
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
  }

  .snapshot-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 285px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    z-index: 250;
    padding: 7px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(8px);
  }

  .dropdown-header {
    padding: 4px 6px 6px;
    border-bottom: 1px solid var(--border-hairline);
    margin-bottom: 2px;
  }

  .dropdown-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px 2px;
  }

  .dropdown-title {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .scale-est-label {
    font-size: 9.5px;
    color: #ff69b4;
    font-weight: 500;
  }

  .scale-chips-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 2px 4px;
  }

  .scale-chip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .scale-chip-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .scale-chip-btn.active {
    background: rgba(255, 105, 180, 0.15);
    border-color: #ff69b4;
  }

  .scale-chip-num {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .scale-chip-btn.active .scale-chip-num {
    color: #ff69b4;
    font-weight: 700;
  }

  .scale-chip-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .processing-status-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: rgba(255, 105, 180, 0.08);
    border: 1px solid rgba(255, 105, 180, 0.2);
    border-radius: var(--radius-xs, 4px);
    margin: 2px 4px;
  }

  .processing-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 105, 180, 0.25);
    border-top-color: #ff69b4;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .processing-msg {
    font-size: 10px;
    color: #ff80bf;
    font-weight: 500;
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
    text-align: left;
    width: 100%;
  }

  .menu-item-btn:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--border-hairline);
  }

  .menu-item-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-icon {
    flex-shrink: 0;
  }

  .text-brand {
    color: var(--brand-primary);
  }

  .text-cyan {
    color: #38bdf8;
  }

  .text-muted {
    color: var(--text-muted);
  }

  .item-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-main);
  }

  .shortcut-badge {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    padding: 2px 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: 3px;
    color: var(--text-dim);
  }

  .dropdown-divider {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 3px 0;
  }
</style>
