<script lang="ts">
  import { AlertCircle, Check, ClipboardPaste, Trash2 } from '@lucide/svelte';
  import type { ParsedTradingPlan } from '../../services/planParserService';

  interface Props {
    activeSymbol: string;
    textBuffer: string;
    textPreviewPlan: ParsedTradingPlan;
    copyFeedback: boolean;
    textareaEl?: HTMLTextAreaElement | null;
    formatPrice: (val: number | null | undefined) => string;
    onTextChange: (val: string) => void;
    onPasteFromClipboard: () => void;
    onLoadSampleText: () => void;
    onOpenTextInForm: () => void;
    onClearTextBuffer: () => void;
  }

  let {
    activeSymbol,
    textBuffer,
    textPreviewPlan,
    copyFeedback,
    textareaEl = $bindable(null),
    formatPrice,
    onTextChange,
    onPasteFromClipboard,
    onLoadSampleText,
    onOpenTextInForm,
    onClearTextBuffer,
  }: Props = $props();
</script>

<div class="plan-scroll-body text-mode-body">
  <div class="text-toolbar">
    <button
      type="button"
      class="btn-tool-action {copyFeedback ? 'text-success' : ''}"
      onclick={onPasteFromClipboard}
      title="Tempel tabel rencana trading dari clipboard"
    >
      <ClipboardPaste size={11} />
      <span>{copyFeedback ? 'Ditempel!' : 'Tempel'}</span>
    </button>

    <button
      type="button"
      class="btn-tool-action"
      onclick={onLoadSampleText}
      title="Muat contoh format Markdown"
    >
      <span>Contoh</span>
    </button>

    <button
      type="button"
      class="btn-tool-action cyan"
      onclick={onOpenTextInForm}
      title="Muat teks Markdown ini ke Form interaktif"
    >
      <span>Buka di Form</span>
    </button>

    {#if textBuffer}
      <button
        type="button"
        class="btn-tool-action btn-clear"
        onclick={onClearTextBuffer}
        title="Bersihkan isi teks"
        aria-label="Bersihkan isi teks"
      >
        <Trash2 size={11} />
      </button>
    {/if}
  </div>

  <textarea
    bind:this={textareaEl}
    value={textBuffer}
    oninput={(e) => onTextChange(e.currentTarget.value)}
    placeholder="Tempel tabel Markdown atau catatan trading plan di sini..."
    class="markdown-editor mono-nums"
    aria-label="Editor Markdown Trading Plan"
    spellcheck="false"
  ></textarea>

  <div class="text-preview-summary">
    <div class="preview-status-row">
      <span class="preview-title">Hasil Parse Live</span>
      {#if !textBuffer.trim()}
        <span class="status-pill empty">Menunggu Input</span>
      {:else if textPreviewPlan.validation.valid}
        <span class="status-pill valid">
          <Check size={10} /> Valid
        </span>
      {:else}
        <span class="status-pill invalid">
          <AlertCircle size={10} /> Perlu Perbaikan
        </span>
      {/if}
    </div>

    {#if textBuffer.trim() && !textPreviewPlan.validation.valid}
      <div class="sanity-box error compact">
        <ul>
          {#each textPreviewPlan.validation.errors as err}
            <li>{err}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if textPreviewPlan.validation.warnings.length > 0}
      <div class="sanity-box warn compact">
        <ul>
          {#each textPreviewPlan.validation.warnings as warn}
            <li>{warn}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if textPreviewPlan.entry > 0 || textPreviewPlan.stopLoss > 0 || textPreviewPlan.targets.length > 0}
      <div class="compact-metrics-grid mono-nums">
        <div class="compact-metric">
          <span class="cm-label">Bias / Sym</span>
          <span class="cm-val {textPreviewPlan.bias === 'bearish' ? 'bear' : 'bull'}">
            {textPreviewPlan.bias.toUpperCase()} · {textPreviewPlan.symbol || activeSymbol}
          </span>
        </div>
        <div class="compact-metric">
          <span class="cm-label">
            {textPreviewPlan.entries && textPreviewPlan.entries.length > 1 ? 'Blended Entry' : 'Entry'}
          </span>
          <span class="cm-val">{formatPrice(textPreviewPlan.entry)}</span>
        </div>
        <div class="compact-metric">
          <span class="cm-label">Stop Loss</span>
          <span class="cm-val bear">{formatPrice(textPreviewPlan.stopLoss)}</span>
        </div>
      </div>

      {#if textPreviewPlan.targets.length > 0}
        <div class="text-tp-chips mono-nums">
          {#each textPreviewPlan.targets as t}
            <span class="tp-chip">
              {t.label}: {formatPrice(t.price)}
              {#if t.rMultiple !== undefined}
                ({t.rMultiple.toFixed(2)}R)
              {/if}
            </span>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .plan-scroll-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .text-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .btn-tool-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-tool-action:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .btn-tool-action:focus-visible,
  .markdown-editor:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .btn-tool-action.cyan {
    color: var(--brand-cyan);
    border-color: color-mix(in srgb, var(--brand-cyan) 30%, transparent);
  }

  .btn-tool-action.btn-clear {
    margin-left: auto;
  }

  .btn-tool-action.btn-clear:hover {
    color: var(--status-danger);
  }

  .text-success {
    color: var(--bull-text) !important;
    border-color: color-mix(in srgb, var(--bull-text) 35%, transparent) !important;
  }

  .markdown-editor {
    width: 100%;
    min-height: 210px;
    flex: 1;
    box-sizing: border-box;
    resize: vertical;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    padding: 8px;
    color: var(--text-main);
    font-size: var(--font-size-base);
    line-height: 1.45;
    font-family: var(--font-code, monospace);
  }

  .markdown-editor:focus {
    border-color: var(--border-focus);
  }

  .text-preview-summary {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    padding: 7px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preview-title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-sm);
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
  }

  .status-pill.empty {
    background-color: var(--bg-elevated);
    color: var(--text-dim);
  }

  .status-pill.valid {
    background-color: color-mix(in srgb, var(--bull-color) 16%, transparent);
    color: var(--bull-text);
  }

  .status-pill.invalid {
    background-color: color-mix(in srgb, var(--status-danger) 14%, transparent);
    color: var(--status-danger);
  }

  .sanity-box {
    border-radius: var(--radius-md);
    padding: 5px 7px;
    font-size: var(--font-size-sm);
  }

  .sanity-box.error {
    background-color: color-mix(in srgb, var(--status-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-danger) 30%, transparent);
    color: var(--status-danger);
  }

  .sanity-box.warn {
    background-color: color-mix(in srgb, var(--status-warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-warn) 30%, transparent);
    color: var(--status-warn);
  }

  .sanity-box ul {
    margin: 0;
    padding-left: 16px;
    line-height: 1.4;
  }

  .compact-metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .compact-metric {
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
  }

  .cm-label {
    font-size: var(--font-size-2xs);
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .cm-val {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cm-val.bull {
    color: var(--bull-text);
  }

  .cm-val.bear {
    color: var(--bear-color);
  }

  .text-tp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tp-chip {
    font-size: var(--font-size-sm);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background-color: color-mix(in srgb, var(--bull-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--bull-text) 28%, transparent);
    color: var(--bull-text);
  }
</style>
