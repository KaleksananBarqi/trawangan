<script lang="ts">
  import { tick } from 'svelte';
  import { Clock, CornerDownLeft, X } from '@lucide/svelte';
  import { parseQuickTimeframeInput, describeTimeframe } from '../utils/timeframeAdapter';

  interface Props {
    isOpen: boolean;
    initialInput?: string;
    currentTimeframe?: string;
    onApply: (timeframe: string) => void;
    onClose: () => void;
  }

  let {
    isOpen = false,
    initialInput = '',
    currentTimeframe = '1m',
    onApply,
    onClose,
  }: Props = $props();

  let inputValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  // Parse secara reaktif
  let parsedTimeframe = $derived(parseQuickTimeframeInput(inputValue || currentTimeframe));
  let description = $derived(describeTimeframe(inputValue || currentTimeframe));

  $effect(() => {
    if (isOpen) {
      inputValue = initialInput || '';
      tick().then(() => {
        if (inputEl) {
          inputEl.focus();
          inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
        }
      });
    } else {
      inputValue = '';
    }
  });

  function handleSubmit() {
    const val = inputValue.trim();
    if (!val) {
      onClose();
      return;
    }
    const resolvedTf = parseQuickTimeframeInput(val);
    onApply(resolvedTf);
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <!-- Backdrop semi-transparan untuk mendeteksi klik di luar -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="timeframe-quick-bar-backdrop" onclick={handleBackdropClick}>
    <div
      class="timeframe-quick-bar-pill obsidian-panel"
      role="dialog"
      aria-label="Pilih Interval Lilin Cepat"
      tabindex="-1"
    >
      <div class="pill-header">
        <div class="pill-title">
          <Clock size={16} class="clock-icon" />
          <span>Interval Cepat</span>
        </div>
        <button
          type="button"
          class="pill-close-btn"
          onclick={onClose}
          aria-label="Tutup Timeframe Quick Bar"
        >
          <X size={14} />
        </button>
      </div>

      <div class="pill-body">
        <div class="input-wrapper">
          <input
            bind:this={inputEl}
            bind:value={inputValue}
            type="text"
            class="timeframe-input"
            placeholder="Ketik angka..."
            maxlength={8}
            onkeydown={handleKeyDown}
          />
          <button
            type="button"
            class="apply-btn"
            onclick={handleSubmit}
            title="Terapkan Timeframe (Enter)"
          >
            <CornerDownLeft size={16} />
          </button>
        </div>

        {#if inputValue.trim()}
          <div class="preview-badge">
            <span class="preview-target mono-nums">{parsedTimeframe}</span>
            <span class="preview-desc">{description}</span>
          </div>
        {/if}
      </div>

      <div class="pill-footer">
        <span class="hint-item"><kbd>Enter</kbd> Terapkan</span>
        <span class="hint-divider">•</span>
        <span class="hint-item"><kbd>Esc</kbd> Batal</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .timeframe-quick-bar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 72px;
    background: rgba(0, 0, 0, 0.2);
    pointer-events: auto;
  }

  .timeframe-quick-bar-pill {
    width: 280px;
    background: rgba(18, 22, 28, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 20px 48px -8px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(0, 212, 255, 0.15),
      0 0 24px -4px rgba(0, 212, 255, 0.1);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: quickBarSlideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes quickBarSlideDown {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .pill-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pill-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-primary, #38bdf8);
  }

  .clock-icon {
    color: var(--color-primary, #38bdf8);
  }

  .pill-close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-tertiary, #64748b);
    padding: 2px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .pill-close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .pill-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(10, 12, 16, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 4px 8px 4px 12px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--color-primary, #38bdf8);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }

  .timeframe-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-mono, monospace);
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.05em;
    padding: 4px 0;
  }

  .timeframe-input::placeholder {
    font-size: 13px;
    font-weight: 400;
    color: #475569;
  }

  .apply-btn {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: var(--color-primary, #38bdf8);
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .apply-btn:hover {
    background: var(--color-primary, #38bdf8);
    color: #0f172a;
  }

  .preview-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
  }

  .preview-target {
    font-weight: 700;
    color: var(--color-primary, #38bdf8);
  }

  .preview-desc {
    color: var(--color-text-secondary, #cbd5e1);
  }

  .pill-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text-tertiary, #64748b);
  }

  .hint-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  kbd {
    display: inline-block;
    padding: 1px 4px;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    line-height: 1.2;
    color: var(--color-text-secondary, #94a3b8);
    background-color: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }

  .hint-divider {
    color: #334155;
  }
</style>
