<script lang="ts">
  import { Bell, X, ExternalLink, CheckCircle } from '@lucide/svelte';
  import type { PriceAlert } from '../types/market';

  interface Props {
    alerts: PriceAlert[];
    onSelectSymbol?: (symbol: string) => void;
    onDismiss: (id: string) => void;
  }

  let {
    alerts = [],
    onSelectSymbol,
    onDismiss,
  }: Props = $props();

  function formatPrice(p?: number): string {
    if (!p) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }

  function formatTime(timestamp?: number): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour12: false });
  }
</script>

<div class="toast-container">
  {#each alerts as a (a.id)}
    <div class="alert-toast-card obsidian-panel">
      <!-- Glow Stripe Indicator -->
      <div class="glow-indicator"></div>

      <div class="toast-content">
        <!-- Toast Header -->
        <div class="toast-header">
          <div class="header-left">
            <span class="bell-ringing"><Bell size={13} /></span>
            <span class="toast-badge">ALERT TRIGGERED</span>
            <span class="time-stamp mono-nums">{formatTime(a.triggeredAt)}</span>
          </div>
          <button
            type="button"
            class="dismiss-btn"
            title="Tutup Notifikasi"
            onclick={() => onDismiss(a.id)}
          >
            <X size={13} />
          </button>
        </div>

        <!-- Target & Actual Price -->
        <div class="price-row mono-nums">
          <span class="symbol-name">{a.symbol}</span>
          <div class="price-details">
            <span class="target-lbl">Target: ${formatPrice(a.targetPrice)}</span>
            {#if a.triggeredPrice}
              <span class="hit-lbl text-bull">Hit: ${formatPrice(a.triggeredPrice)}</span>
            {/if}
          </div>
        </div>

        <!-- Label / Catatan -->
        {#if a.label}
          <div class="label-row">
            <span class="alert-note">{a.label}</span>
          </div>
        {/if}

        <!-- Footer Actions -->
        {#if onSelectSymbol}
          <div class="toast-actions">
            <button
              type="button"
              class="jump-chart-btn"
              onclick={() => {
                onSelectSymbol(a.symbol);
                onDismiss(a.id);
              }}
            >
              <ExternalLink size={11} />
              <span>Lihat di Grafik</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 50px;
    right: 14px;
    z-index: 1050;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: 320px;
    width: 100%;
  }

  .alert-toast-card {
    pointer-events: auto;
    background-color: rgba(18, 23, 33, 0.96);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 240, 144, 0.35);
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 15px rgba(0, 240, 144, 0.2);
    position: relative;
    overflow: hidden;
    animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(30px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  .glow-indicator {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--brand-primary);
    box-shadow: 0 0 8px var(--bull-glow);
  }

  .toast-content {
    padding: 8px 10px 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toast-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .bell-ringing {
    color: var(--brand-primary);
    display: flex;
    animation: bellShake 1.2s infinite ease-in-out;
  }

  @keyframes bellShake {
    0%, 100% { transform: rotate(0); }
    15% { transform: rotate(14deg); }
    30% { transform: rotate(-14deg); }
    45% { transform: rotate(8deg); }
    60% { transform: rotate(-8deg); }
    75% { transform: rotate(0); }
  }

  .toast-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.12);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .time-stamp {
    font-size: 9px;
    color: var(--text-dim);
  }

  .dismiss-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dismiss-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }

  .symbol-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .price-details {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 10px;
  }

  .target-lbl {
    color: var(--text-dim);
  }

  .hit-lbl {
    font-weight: 700;
  }

  .text-bull {
    color: var(--bull-color);
  }

  .label-row {
    margin-top: 1px;
  }

  .alert-note {
    font-size: 10px;
    color: var(--text-muted);
    background-color: rgba(255, 255, 255, 0.04);
    padding: 2px 5px;
    border-radius: var(--radius-xs);
    display: inline-block;
  }

  .toast-actions {
    margin-top: 4px;
    display: flex;
    justify-content: flex-end;
  }

  .jump-chart-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .jump-chart-btn:hover {
    background-color: rgba(59, 130, 246, 0.22);
    color: #93c5fd;
  }
</style>
