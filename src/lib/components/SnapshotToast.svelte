<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Camera, Check, X, ExternalLink, SlidersHorizontal, AlertCircle } from '@lucide/svelte';

  export interface SnapshotToastData {
    visible: boolean;
    type?: 'copied' | 'saved' | 'error';
    message: string;
    thumbnailUrl?: string;
    timestamp?: number;
  }

  interface Props {
    toast: SnapshotToastData | null;
    onDismiss: () => void;
    onOpenPreview?: () => void;
  }

  let {
    toast = null,
    onDismiss,
    onOpenPreview,
  }: Props = $props();

  let dismissTimer: any = null;

  $effect(() => {
    // Reset timer saat toast baru muncul
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    if (toast && toast.visible) {
      dismissTimer = setTimeout(() => {
        onDismiss();
      }, 4000);
    }

    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    };
  });
</script>

{#if toast && toast.visible}
  <div class="snapshot-toast-overlay" role="status" aria-live="polite">
    <div class="snapshot-toast-card obsidian-panel {toast.type || 'copied'}">
      <!-- Glow Stripe Indicator -->
      <div class="glow-indicator"></div>

      <!-- Thumbnail Preview (jika tersedia) -->
      {#if toast.thumbnailUrl}
        <div class="thumbnail-wrapper">
          <img src={toast.thumbnailUrl} alt="Thumbnail Snapshot" class="thumbnail-img" />
        </div>
      {/if}

      <div class="toast-body">
        <div class="toast-header">
          <div class="header-left">
            {#if toast.type === 'error'}
              <AlertCircle size={14} class="status-icon text-bear" />
              <span class="badge badge-error">GAGAL</span>
            {:else}
              <Check size={14} class="status-icon text-brand" />
              <span class="badge badge-success">SNAPSHOT</span>
            {/if}
          </div>
          <button
            type="button"
            class="dismiss-btn"
            title="Tutup Notifikasi"
            aria-label="Tutup Notifikasi"
            onclick={onDismiss}
          >
            <X size={12} />
          </button>
        </div>

        <div class="toast-message">
          <p>{toast.message}</p>
        </div>

        {#if onOpenPreview && toast.type !== 'error'}
          <div class="toast-actions">
            <button
              type="button"
              class="preview-action-btn"
              onclick={() => {
                onOpenPreview?.();
                onDismiss();
              }}
            >
              <SlidersHorizontal size={11} />
              <span>Buka Pratinjau</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .snapshot-toast-overlay {
    position: fixed;
    bottom: 24px;
    right: 20px;
    z-index: 1100;
    pointer-events: auto;
    animation: toastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .snapshot-toast-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: var(--bg-surface, #141414);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.15);
    padding: 10px 12px;
    min-width: 290px;
    max-width: 360px;
    overflow: hidden;
    backdrop-filter: blur(12px);
  }

  .glow-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--brand-primary, #ff69b4);
    box-shadow: 0 0 8px var(--brand-primary, #ff69b4);
  }

  .snapshot-toast-card.error .glow-indicator {
    background: var(--bear-color, #ef4444);
    box-shadow: 0 0 8px var(--bear-color, #ef4444);
  }

  .thumbnail-wrapper {
    width: 52px;
    height: 40px;
    border-radius: 4px;
    overflow: hidden;
    background-color: #000;
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .toast-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
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

  .status-icon.text-brand {
    color: var(--brand-primary, #ff69b4);
  }

  .status-icon.text-bear {
    color: var(--bear-color, #ef4444);
  }

  .badge {
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 4.5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    font-family: var(--font-mono, monospace);
  }

  .badge-success {
    background: rgba(255, 105, 180, 0.15);
    color: var(--brand-primary, #ff69b4);
    border: 1px solid rgba(255, 105, 180, 0.3);
  }

  .badge-error {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .dismiss-btn {
    background: transparent;
    border: none;
    color: var(--text-dim, #777);
    padding: 2px;
    cursor: pointer;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .dismiss-btn:hover {
    color: var(--text-main, #fff);
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  .toast-message p {
    margin: 0;
    font-size: 11px;
    color: var(--text-main, #eee);
    line-height: 1.35;
    word-break: break-word;
  }

  .toast-actions {
    margin-top: 4px;
    display: flex;
    align-items: center;
  }

  .preview-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--bg-base, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-xs, 4px);
    color: var(--text-main, #ddd);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preview-action-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--brand-primary, #ff69b4);
    border-color: var(--brand-primary, #ff69b4);
  }
</style>
