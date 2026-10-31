<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Bell, Minus, Copy, RotateCcw, Check, SlidersHorizontal } from '@lucide/svelte';

  interface Props {

    isOpen: boolean;
    x: number;
    y: number;
    symbol: string;
    price: number | null;
    time: number | null;
    onCreateAlert: (symbol: string, price: number) => void;
    onDrawHorizontalLine?: (price: number) => void;
    onResetChartScale?: () => void;
    onOpenSettings?: () => void;
    onClose: () => void;
  }

  let {
    isOpen,
    x,
    y,
    symbol,
    price,
    time,
    onCreateAlert,
    onDrawHorizontalLine,
    onResetChartScale,
    onOpenSettings,
    onClose,
  }: Props = $props();


  let copied = $state(false);
  let menuEl = $state<HTMLDivElement | null>(null);
  let openedAt = $state(0);

  // Catat waktu pembukaan menu untuk mencegah click-outside seketika
  $effect(() => {
    if (isOpen) {
      openedAt = Date.now();
    }
  });

  /**
   * Action portal untuk memindahkan node DOM langsung ke root body
   * Menghindari masalah overflow: hidden atau stacking context dari chart wrapper
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  // Pastikan menu tidak keluar dari batas viewport layar
  let adjustedX = $derived.by(() => {
    if (typeof window === 'undefined') return x;
    const menuWidth = 245;
    return Math.max(10, Math.min(x, window.innerWidth - menuWidth - 12));
  });

  let adjustedY = $derived.by(() => {
    if (typeof window === 'undefined') return y;
    const menuHeight = 180;
    return Math.max(10, Math.min(y, window.innerHeight - menuHeight - 12));
  });

  function formatPrice(p: number | null): string {
    if (p === null || p === undefined || isNaN(p)) return '--';
    if (p >= 1000) {
      return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }

  function handleCreateAlertClick(e?: MouseEvent) {
    e?.stopPropagation();
    if (price !== null && price > 0) {
      onCreateAlert(symbol, price);
    }
    onClose();
  }

  function handleDrawLineClick(e?: MouseEvent) {
    e?.stopPropagation();
    if (price !== null && price > 0 && onDrawHorizontalLine) {
      onDrawHorizontalLine(price);
    }
    onClose();
  }

  async function handleCopyPrice(e?: MouseEvent) {
    e?.stopPropagation();
    if (price !== null) {
      try {
        await navigator.clipboard.writeText(price.toString());
        copied = true;
        setTimeout(() => {
          copied = false;
          onClose();
        }, 600);
      } catch (_) {
        onClose();
      }
    }
  }

  function handleResetScale(e?: MouseEvent) {
    e?.stopPropagation();
    onResetChartScale?.();
    onClose();
  }

  function handleOpenSettingsClick(e?: MouseEvent) {
    e?.stopPropagation();
    onClose();
    // Beri jeda singkat agar context menu unmount bersih sebelum dialog Vela muncul
    setTimeout(() => {
      onOpenSettings?.();
    }, 16);
  }

  function handleBackdropClick(e: MouseEvent) {
    // Abaikan jika klik terjadi dalam waktu 180ms dari saat menu dibuka (sisa event mouseup/click saat klik kanan)
    if (Date.now() - openedAt < 180) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if isOpen}
  <div use:portal class="context-menu-portal-root">
    <!-- Transparent Click-Outside Backdrop dengan pelindung gesture -->
    <div
      class="context-backdrop"
      onclick={handleBackdropClick}
      onpointerdown={handleBackdropClick}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() - openedAt >= 180) {
          onClose();
        }
      }}
      role="presentation"
    ></div>

    <div
      bind:this={menuEl}
      class="chart-context-menu obsidian-panel"
      style="left: {adjustedX}px; top: {adjustedY}px;"
      role="menu"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <!-- Header Informasi Harga Kursor -->
      <div class="menu-header mono-nums">
        <span class="sym-badge">{symbol}</span>
        <span class="price-val">${formatPrice(price)}</span>
      </div>

      <div class="menu-divider"></div>

      <!-- Pilihan 1: Buat Price Alert (Aksi Utama Bercahaya Neon) -->
      <button
        type="button"
        class="menu-item primary-action"
        onclick={handleCreateAlertClick}
        disabled={price === null || price <= 0}
      >
        <div class="item-left">
          <span class="icon-wrap bell-icon"><Bell size={13} /></span>
          <span class="item-label font-semibold">+ Buat Alert di ${formatPrice(price)}</span>
        </div>
        <span class="shortcut-tag mono-nums">Alt+A</span>
      </button>

      <!-- Pilihan 2: Buat Garis Horizontal -->
      <button
        type="button"
        class="menu-item"
        onclick={handleDrawLineClick}
        disabled={price === null || price <= 0}
      >
        <div class="item-left">
          <span class="icon-wrap"><Minus size={13} /></span>
          <span class="item-label">Horizontal Line</span>
        </div>
        <span class="shortcut-tag mono-nums">Alt+H</span>
      </button>

      <!-- Pilihan 3: Salin Harga -->
      <button
        type="button"
        class="menu-item"
        onclick={handleCopyPrice}
        disabled={price === null}
      >
        <div class="item-left">
          {#if copied}
            <span class="icon-wrap text-emerald"><Check size={13} /></span>
            <span class="item-label text-emerald">Tersalin ke Clipboard!</span>
          {:else}
            <span class="icon-wrap"><Copy size={13} /></span>
            <span class="item-label">Salin Harga</span>
          {/if}
        </div>
      </button>

      <div class="menu-divider"></div>

      <!-- Pilihan 4: Reset Skala Chart -->
      <button
        type="button"
        class="menu-item"
        onclick={handleResetScale}
      >
        <div class="item-left">
          <span class="icon-wrap"><RotateCcw size={13} /></span>
          <span class="item-label">Reset Skala Grafik</span>
        </div>
        <span class="shortcut-tag mono-nums">Alt+Z</span>
      </button>

      <div class="menu-divider"></div>

      <!-- Pilihan 5: Pengaturan Grafik & Lilin -->
      <button
        type="button"
        class="menu-item"
        onclick={handleOpenSettingsClick}
      >
        <div class="item-left">
          <span class="icon-wrap"><SlidersHorizontal size={13} /></span>
          <span class="item-label">Pengaturan Grafik (Warna & Lilin)...</span>
        </div>
        <span class="shortcut-tag mono-nums">Vela</span>
      </button>
    </div>
  </div>
{/if}


<style>
  .context-menu-portal-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 99998;
    pointer-events: none;
  }

  .context-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99998;
    background: transparent;
    pointer-events: auto;
  }

  .chart-context-menu {
    position: fixed;
    z-index: 99999;
    width: 240px;
    background-color: rgba(16, 20, 29, 0.97);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-medium, #2a3447);
    border-radius: var(--radius-sm, 6px);
    box-shadow: 0 10px 36px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.15);
    padding: 5px;
    display: flex;
    flex-direction: column;
    animation: menuAppear 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    pointer-events: auto;
  }

  @keyframes menuAppear {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-3px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 11px;
    color: var(--text-muted, #8b9bb4);
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    margin-bottom: 2px;
  }

  .sym-badge {
    font-weight: 700;
    color: var(--brand-primary, #00f090);
    background-color: rgba(0, 240, 144, 0.12);
    padding: 2px 5px;
    border-radius: var(--radius-xs, 3px);
    font-size: 9px;
    letter-spacing: 0.05em;
  }

  .price-val {
    font-weight: 700;
    color: var(--text-main, #f0f4f8);
    font-size: 11px;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-hairline, rgba(255, 255, 255, 0.08));
    margin: 4px 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs, 4px);
    color: var(--text-main, #e2e8f0);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease, color 0.1s ease;
  }

  .menu-item:hover:not(:disabled) {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--text-main, #ffffff);
  }

  .menu-item:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Item aksi utama: Buat Alert */
  .menu-item.primary-action {
    color: #38bdf8;
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    margin-bottom: 2px;
  }

  .menu-item.primary-action:hover:not(:disabled) {
    background-color: rgba(56, 189, 248, 0.22);
    color: #ffffff;
    border-color: rgba(56, 189, 248, 0.4);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #94a3b8);
  }

  .menu-item.primary-action .bell-icon {
    color: #38bdf8;
  }

  .item-label {
    font-size: 11px;
    white-space: nowrap;
  }

  .shortcut-tag {
    font-size: 9px;
    color: var(--text-dim, #64748b);
    background-color: rgba(255, 255, 255, 0.06);
    padding: 1px 5px;
    border-radius: var(--radius-xs, 3px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .menu-item.primary-action .shortcut-tag {
    color: #7dd3fc;
    border-color: rgba(56, 189, 248, 0.3);
    background-color: rgba(56, 189, 248, 0.12);
  }

  .text-emerald {
    color: var(--brand-primary, #00f090) !important;
  }
</style>
