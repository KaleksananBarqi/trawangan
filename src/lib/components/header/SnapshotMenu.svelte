<script lang="ts">
  import { Camera, Copy, Download, SlidersHorizontal, ChevronDown, Check } from '@lucide/svelte';

  interface Props {
    onRequestQuickCopySnapshot?: () => void;
    onRequestQuickDownloadSnapshot?: () => void;
    onOpenSnapshotPreview?: () => void;
  }

  let {
    onRequestQuickCopySnapshot,
    onRequestQuickDownloadSnapshot,
    onOpenSnapshotPreview,
  }: Props = $props();

  let showMenu = $state(false);
  let copyFeedback = $state(false);

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showMenu && !target.closest('.snapshot-menu-group')) {
      showMenu = false;
    }
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
    {#if copyFeedback}
      <Check size={13} class="camera-icon text-brand" />
    {:else}
      <Camera size={13} class="camera-icon" />
    {/if}
    <span class="btn-text">Snapshot</span>
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
          title="Salin gambar PNG 2x HiDPI langsung ke clipboard sistem"
        >
          <div class="item-left">
            <Copy size={13} class="item-icon text-cyan" />
            <div class="item-text">
              <span class="item-title">Salin Gambar ke Clipboard</span>
            </div>
          </div>
          <span class="shortcut-badge mono-nums">Ctrl+Shift+S</span>
        </button>

        <!-- 2. Simpan Gambar PNG -->
        <button
          type="button"
          class="menu-item-btn"
          onclick={handleQuickDownload}
          title="Unduh file gambar PNG dengan format terstruktur"
        >
          <div class="item-left">
            <Download size={13} class="item-icon text-muted" />
            <div class="item-text">
              <span class="item-title">Simpan Gambar (PNG)</span>
            </div>
          </div>
        </button>

        <div class="dropdown-divider"></div>

        <!-- 3. Pratinjau & Kustomisasi -->
        <button
          type="button"
          class="menu-item-btn preview-btn"
          onclick={handleOpenPreview}
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
    width: 275px;
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

  .dropdown-title {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.05em;
    text-transform: uppercase;
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

  .menu-item-btn:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-hairline);
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
