<script lang="ts">
  import { tick } from 'svelte';
  import {
    FileText,
    X,
    ClipboardPaste,
    Check,
    AlertTriangle,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Sparkles,
    Layers,
    Info,
    Trash2
  } from '@lucide/svelte';
  import {
    parseTradingPlan,
    type ParsedTradingPlan
  } from '../services/planParserService';

  interface Props {
    isOpen: boolean;
    initialText?: string;
    tickSize?: number;
    onApply: (plan: ParsedTradingPlan) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    initialText = '',
    tickSize,
    onApply,
    onClose,
  }: Props = $props();

  let rawText = $state('');
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let copyFeedback = $state(false);

  const SAMPLE_MARKDOWN_PLAN = `|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Entry|81200.0 (Limit sell di dalam area FVG LTF 81182.2 - 81236.7)|
|Alasan Entry|Respek terhadap unfilled Bearish FVG LTF [FAKTA], likuiditas buy-side internal tersapu [INFERENSI]|
|Stop Loss|81400.0|
|Alasan SL|Di atas swing high 81380.0 dengan buffer 20 poin [FAKTA]|
|TP1|80355.4|
|R multiple TP1|4.22R (R = 200). Jarak TP1 = 844.6|
|Alasan TP1|Swing low terdekat 15m & penutupan imbalance lokal [INFERENSI]|
|TP2|79429.0|
|R multiple TP2|8.85R. Jarak TP2 = 1771.0|
|Alasan TP2|Draw on liquidity SSL utama harian [SPEKULASI]|`;

  // Sinkronisasi teks awal saat modal dibuka
  $effect(() => {
    if (isOpen) {
      rawText = initialText || '';
      tick().then(() => {
        if (textareaEl) {
          textareaEl.focus();
          if (initialText) {
            textareaEl.select();
          }
        }
      });
    }
  });

  // Penguraian rencana reaktif
  let parsedPlan = $derived.by<ParsedTradingPlan>(() => {
    return parseTradingPlan(rawText, { tickSize });
  });

  function formatPrice(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val) || val <= 0) return '--';
    if (val >= 1000) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val >= 1 ? val.toFixed(4) : val.toFixed(6);
  }

  async function handlePasteFromClipboard() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          rawText = text;
          copyFeedback = true;
          setTimeout(() => (copyFeedback = false), 1200);
        }
      }
    } catch (_) {
      // Akses clipboard ditolak atau tidak didukung di lingkungan ini
    }
  }

  function handleLoadSample() {
    rawText = SAMPLE_MARKDOWN_PLAN;
  }

  function handleClear() {
    rawText = '';
  }

  function handleApply() {
    if (parsedPlan.validation.valid) {
      onApply(parsedPlan);
      onClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Enter') {
      // Jika di textarea, submit hanya saat menekan Ctrl+Enter atau Cmd+Enter
      if (e.target === textareaEl) {
        if ((e.ctrlKey || e.metaKey) && parsedPlan.validation.valid) {
          e.preventDefault();
          handleApply();
        }
      } else if (parsedPlan.validation.valid) {
        e.preventDefault();
        handleApply();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- Modal Backdrop -->
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="modal-card obsidian-panel import-plan-modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-plan-title"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon-pill">
            <Sparkles size={16} class="text-cyan" />
          </span>
          <div class="header-titles">
            <h3 id="import-plan-title">Import Trading Plan</h3>
            <span class="header-subtitle">Ingestion rencana posisi multi-target deterministik (Zero-LLM)</span>
          </div>
          <span class="shortcut-pill mono-nums">Ctrl+Shift+P</span>
        </div>
        <button type="button" class="close-btn" onclick={onClose} title="Tutup (Esc)">
          <X size={15} />
        </button>
      </div>

      <!-- Modal Body (Two-Column Flex/Grid) -->
      <div class="modal-body">
        <!-- Kolom Kiri: Input Teks / Markdown -->
        <div class="editor-column">
          <div class="column-toolbar">
            <span class="toolbar-label">
              <FileText size={13} class="icon-sub" />
              <span>Tabel Markdown / Format Teks</span>
            </span>
            <div class="toolbar-actions">
              <button
                type="button"
                class="btn-tool-action {copyFeedback ? 'text-success' : ''}"
                onclick={handlePasteFromClipboard}
                title="Tempel dari Clipboard Sistem"
              >
                <ClipboardPaste size={12} />
                <span>{copyFeedback ? 'Ditempel!' : 'Tempel Clipboard'}</span>
              </button>
              <button
                type="button"
                class="btn-tool-action"
                onclick={handleLoadSample}
                title="Muat contoh tabel trading plan"
              >
                <span>Contoh Plan</span>
              </button>
              {#if rawText}
                <button
                  type="button"
                  class="btn-tool-action btn-clear"
                  onclick={handleClear}
                  title="Bersihkan isi teks"
                >
                  <Trash2 size={12} />
                </button>
              {/if}
            </div>
          </div>

          <div class="textarea-wrapper">
            <textarea
              bind:this={textareaEl}
              bind:value={rawText}
              placeholder="Tempel tabel Markdown atau rencana trading di sini...&#10;&#10;Contoh:&#10;|Bias|Bearish|&#10;|Entry|81200.0|&#10;|Stop Loss|81400.0|&#10;|TP1|80355.4 (4.22R)|&#10;|TP2|79429.0 (8.85R)|"
              class="plan-textarea mono-nums"
              spellcheck="false"
            ></textarea>
          </div>

          <div class="editor-hints">
            <Info size={11} class="text-dim" />
            <span class="hint-text">
              Dukungan parser: Parameter <strong>Bias</strong>, <strong>Entry</strong>, <strong>Stop Loss</strong>, serta daftar bertingkat <strong>TP1, TP2, dst</strong>.
            </span>
          </div>
        </div>

        <!-- Kolom Kanan: Live Preview Reaktif & Sanity Guard -->
        <div class="preview-column obsidian-card">
          <div class="column-toolbar">
            <span class="toolbar-label">
              <Layers size={13} class="icon-sub" />
              <span>Live Preview Rencana</span>
            </span>
            <div class="status-indicator">
              {#if !rawText.trim()}
                <span class="status-badge empty">Menunggu Input</span>
              {:else if parsedPlan.validation.valid}
                <span class="status-badge valid">
                  <Check size={11} /> Valid (Siap Impor)
                </span>
              {:else}
                <span class="status-badge invalid">
                  <AlertCircle size={11} /> Perlu Perbaikan
                </span>
              {/if}
            </div>
          </div>

          <div class="preview-scroll-content">
            <!-- Bias Badge Hero -->
            <div class="bias-hero-card bias-{parsedPlan.bias}">
              <div class="bias-content">
                <span class="bias-label">BIAS ARAH POSISI</span>
                <div class="bias-value-row">
                  {#if parsedPlan.bias === 'bearish'}
                    <span class="bias-tag bear">
                      <ArrowDownRight size={16} /> BEARISH / SHORT
                    </span>
                  {:else if parsedPlan.bias === 'bullish'}
                    <span class="bias-tag bull">
                      <ArrowUpRight size={16} /> BULLISH / LONG
                    </span>
                  {:else}
                    <span class="bias-tag neutral">
                      NEUTRAL / BELUM DITENTUKAN
                    </span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Sanity Guard Alert Box (jika validasi gagal) -->
            {#if rawText.trim() && !parsedPlan.validation.valid}
              <div class="sanity-alert-box">
                <div class="alert-title-row">
                  <AlertCircle size={14} class="alert-icon" />
                  <span class="alert-title">Sanity Guard: Rencana Tidak Valid</span>
                </div>
                <ul class="alert-list">
                  {#each parsedPlan.validation.errors as err}
                    <li>{err}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Sanity Guard Warnings (jika ada peringatan) -->
            {#if parsedPlan.validation.warnings.length > 0}
              <div class="sanity-warning-box">
                <div class="warning-title-row">
                  <AlertTriangle size={13} class="warning-icon" />
                  <span class="warning-title">Peringatan Urutan Target</span>
                </div>
                <ul class="warning-list">
                  {#each parsedPlan.validation.warnings as warn}
                    <li>{warn}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Metrics Card: Entry, SL, Risk -->
            <div class="metrics-grid">
              <div class="metric-card entry-card">
                <span class="metric-label">Entry Price</span>
                <span class="metric-value mono-nums">${formatPrice(parsedPlan.entry)}</span>
              </div>
              <div class="metric-card sl-card">
                <span class="metric-label">Stop Loss</span>
                <span class="metric-value mono-nums sl-val">${formatPrice(parsedPlan.stopLoss)}</span>
              </div>
              <div class="metric-card risk-card">
                <span class="metric-label">Jarak Risiko (R)</span>
                <span class="metric-value mono-nums risk-val">${formatPrice(parsedPlan.riskAmount)}</span>
              </div>
            </div>

            <!-- Target Berjenjang (Multi-Target Stages) -->
            <div class="section-block">
              <div class="section-title-row">
                <span class="section-title">Target Bertingkat ({parsedPlan.targets.length} Target)</span>
              </div>
              {#if parsedPlan.targets.length === 0}
                <div class="empty-placeholder">Belum ada target (TP1, TP2, dst.) terdeteksi</div>
              {:else}
                <div class="targets-list">
                  {#each parsedPlan.targets as t}
                    <div class="target-item-card">
                      <div class="target-top-row">
                        <span class="target-badge mono-nums">{t.label || t.id.toUpperCase()}</span>
                        <span class="target-price mono-nums">${formatPrice(t.price)}</span>
                        {#if t.rMultiple !== undefined}
                          <span class="target-r-badge mono-nums">{t.rMultiple.toFixed(2)} R</span>
                        {/if}
                      </div>
                      <div class="target-sub-row">
                        {#if t.distance !== undefined}
                          <span class="target-dist mono-nums">Jarak: +{t.distance.toFixed(2)} pts</span>
                        {/if}
                        {#if t.reason}
                          <span class="target-reason">{t.reason}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Area FVG / Context Zones (jika ada) -->
            {#if parsedPlan.contextZones.length > 0}
              <div class="section-block">
                <div class="section-title-row">
                  <span class="section-title">Zona Konteks & Area FVG ({parsedPlan.contextZones.length})</span>
                </div>
                <div class="zones-chip-row">
                  {#each parsedPlan.contextZones as z}
                    <div class="zone-chip mono-nums">
                      <span class="zone-label">{z.label}:</span>
                      <span class="zone-range">${z.low} – ${z.high}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Tesis Analisis & Alasan (jika ada) -->
            {#if Object.keys(parsedPlan.reasons).length > 0}
              <div class="section-block">
                <div class="section-title-row">
                  <span class="section-title">Tesis & Catatan Alasan</span>
                </div>
                <div class="reasons-list">
                  {#each Object.entries(parsedPlan.reasons) as [key, desc]}
                    <div class="reason-row">
                      <span class="reason-key mono-nums">{key}:</span>
                      <span class="reason-desc">{desc}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <div class="footer-tip mono-nums">
          <span>Tips: Tekan <kbd>Ctrl+Enter</kbd> untuk menerapkan langsung</span>
        </div>
        <div class="footer-buttons">
          <button
            type="button"
            class="btn-secondary"
            onclick={onClose}
          >
            Batal (Esc)
          </button>
          <button
            type="button"
            class="btn-primary {parsedPlan.bias === 'bearish' ? 'btn-bear' : 'btn-bull'}"
            disabled={!parsedPlan.validation.valid}
            onclick={handleApply}
            title={parsedPlan.validation.valid ? 'Terapkan rencana posisi bertingkat ke chart' : 'Rencana belum memenuhi syarat validasi'}
          >
            <Check size={14} />
            <span>Terapkan ke Chart (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(5, 5, 8, 0.78);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.99);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .import-plan-modal {
    width: 100%;
    max-width: 960px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface, #0f1118);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm, 6px);
    background-color: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.25);
  }

  .header-titles h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-main, #e8e9ed);
    letter-spacing: -0.01em;
  }

  .header-subtitle {
    display: block;
    font-size: 11px;
    color: var(--text-dim, #717786);
    margin-top: 1px;
  }

  .shortcut-pill {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-muted, #9ea3b0);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #9ea3b0);
    padding: 6px;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .close-btn:hover {
    color: var(--text-main, #ffffff);
    background-color: rgba(255, 255, 255, 0.08);
  }

  /* Body */
  .modal-body {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 14px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    min-height: 440px;
  }

  @media (max-width: 768px) {
    .modal-body {
      grid-template-columns: 1fr;
    }
  }

  .column-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    min-height: 24px;
  }

  .toolbar-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #9ea3b0);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .icon-sub {
    color: var(--brand-cyan, #00e5ff);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-tool-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 4px;
    color: var(--text-muted, #9ea3b0);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-tool-action:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--text-main, #ffffff);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-clear:hover {
    color: #ff4466;
  }

  .text-success {
    color: #00ff88 !important;
    border-color: rgba(0, 255, 136, 0.3) !important;
  }

  /* Editor Column */
  .editor-column {
    display: flex;
    flex-direction: column;
  }

  .textarea-wrapper {
    flex: 1;
    display: flex;
    min-height: 360px;
  }

  .plan-textarea {
    width: 100%;
    flex: 1;
    resize: none;
    background-color: var(--bg-base, #0a0b10);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 12px;
    color: var(--text-main, #e8e9ed);
    font-size: 11px;
    line-height: 1.5;
    font-family: var(--font-mono, monospace);
    outline: none;
    transition: border-color 0.12s ease;
  }

  .plan-textarea:focus {
    border-color: var(--brand-cyan, #00e5ff);
    box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.2);
  }

  .editor-hints {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 10px;
    color: var(--text-dim, #717786);
  }

  /* Preview Column */
  .preview-column {
    display: flex;
    flex-direction: column;
    background-color: rgba(10, 11, 16, 0.65);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 12px;
    min-height: 380px;
  }

  .status-badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
  }

  .status-badge.empty {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-dim, #717786);
  }

  .status-badge.valid {
    background-color: rgba(0, 255, 136, 0.12);
    color: #00ff88;
    border: 1px solid rgba(0, 255, 136, 0.25);
  }

  .status-badge.invalid {
    background-color: rgba(255, 68, 102, 0.12);
    color: #ff4466;
    border: 1px solid rgba(255, 68, 102, 0.25);
  }

  .preview-scroll-content {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 4px;
  }

  /* Bias Hero */
  .bias-hero-card {
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background-color: rgba(255, 255, 255, 0.02);
  }

  .bias-hero-card.bias-bearish {
    background: linear-gradient(90deg, rgba(255, 105, 180, 0.12) 0%, transparent 100%);
    border-color: rgba(255, 105, 180, 0.3);
  }

  .bias-hero-card.bias-bullish {
    background: linear-gradient(90deg, rgba(0, 255, 136, 0.12) 0%, transparent 100%);
    border-color: rgba(0, 255, 136, 0.3);
  }

  .bias-label {
    display: block;
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim, #717786);
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  .bias-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .bias-tag.bear {
    color: #ff69b4; /* Hot pink */
  }

  .bias-tag.bull {
    color: #00ff88; /* Neon green */
  }

  .bias-tag.neutral {
    color: var(--text-dim, #717786);
  }

  /* Sanity Alert & Warning Box */
  .sanity-alert-box {
    background-color: rgba(255, 68, 102, 0.1);
    border: 1px solid rgba(255, 68, 102, 0.3);
    border-radius: 6px;
    padding: 10px 12px;
  }

  .alert-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #ff4466;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .alert-list {
    margin: 0;
    padding-left: 18px;
    font-size: 10.5px;
    color: #ff99aa;
    line-height: 1.4;
  }

  .sanity-warning-box {
    background-color: rgba(229, 169, 60, 0.1);
    border: 1px solid rgba(229, 169, 60, 0.3);
    border-radius: 6px;
    padding: 8px 10px;
  }

  .warning-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #e5a93c;
    font-size: 10.5px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .warning-list {
    margin: 0;
    padding-left: 18px;
    font-size: 10px;
    color: #f0caa0;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .metric-card {
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
  }

  .metric-label {
    font-size: 9.5px;
    color: var(--text-dim, #717786);
    text-transform: uppercase;
    font-weight: 600;
  }

  .metric-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #e8e9ed);
    margin-top: 2px;
  }

  .sl-val {
    color: #ff69b4;
  }

  .risk-val {
    color: #00e5ff;
  }

  /* Section Block */
  .section-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted, #9ea3b0);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .empty-placeholder {
    font-size: 11px;
    color: var(--text-dim, #717786);
    font-style: italic;
    padding: 8px;
    background-color: rgba(255, 255, 255, 0.01);
    border: 1px dashed rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    text-align: center;
  }

  .targets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .target-item-card {
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid #00ff88;
    border-radius: 4px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .target-top-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .target-badge {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-main, #ffffff);
    background-color: rgba(255, 255, 255, 0.08);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .target-price {
    font-size: 12px;
    font-weight: 600;
    color: #00ff88;
  }

  .target-r-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
    background-color: rgba(0, 255, 136, 0.15);
    color: #00ff88;
    margin-left: auto;
  }

  .target-sub-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: var(--text-dim, #717786);
  }

  .target-dist {
    color: var(--text-muted, #9ea3b0);
  }

  .target-reason {
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Zones & Reasons */
  .zones-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .zone-chip {
    font-size: 10px;
    background-color: rgba(0, 229, 255, 0.08);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 4px;
    padding: 3px 8px;
    display: flex;
    gap: 4px;
  }

  .zone-label {
    color: #00e5ff;
    font-weight: 600;
  }

  .zone-range {
    color: var(--text-main, #ffffff);
  }

  .reasons-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .reason-row {
    display: flex;
    gap: 6px;
    font-size: 10.5px;
    background-color: rgba(255, 255, 255, 0.02);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .reason-key {
    font-weight: 600;
    color: var(--brand-cyan, #00e5ff);
    white-space: nowrap;
  }

  .reason-desc {
    color: var(--text-muted, #9ea3b0);
    line-height: 1.35;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background-color: rgba(255, 255, 255, 0.01);
  }

  .footer-tip {
    font-size: 10px;
    color: var(--text-dim, #717786);
  }

  .footer-tip kbd {
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 9.5px;
    color: var(--text-muted, #9ea3b0);
  }

  .footer-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-secondary {
    background-color: transparent;
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    color: var(--text-muted, #9ea3b0);
    padding: 7px 14px;
    border-radius: var(--radius-sm, 5px);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-secondary:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-main, #ffffff);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border-radius: var(--radius-sm, 5px);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }

  .btn-bull {
    background-color: #00ff88;
    color: #05140b;
  }

  .btn-bull:hover:not(:disabled) {
    background-color: #1aff96;
    box-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
  }

  .btn-bear {
    background-color: #ff69b4;
    color: #1a0410;
  }

  .btn-bear:hover:not(:disabled) {
    background-color: #ff80c0;
    box-shadow: 0 0 12px rgba(255, 105, 180, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
