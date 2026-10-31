<script lang="ts">
  import { onMount } from 'svelte';
  import {
    GripVertical,
    Minus,
    Maximize2,
    Minimize2,
    X,
    ShieldAlert,
    Target,
    Zap,
    Info,
    ChevronDown,
    Layers,
    EyeOff
  } from '@lucide/svelte';
  import type { ParsedTradingPlan } from '../services/planParserService';

  interface Props {
    plan: ParsedTradingPlan & { id: string };
    initialX?: number;
    initialY?: number;
    initialWidth?: number;
    initialHeight?: number;
    onClose?: (planId: string) => void;
    onHide?: (planId: string) => void;
  }

  let {
    plan,
    initialX = 16,
    initialY = 56,
    initialWidth = 340,
    initialHeight,
    onClose,
    onHide
  }: Props = $props();

  let isMinimized = $state(false);
  let isWideMode = $state(false);
  let cardWidth = $state(initialWidth);
  let cardHeight = $state<number | null>(initialHeight || null);
  let posX = $state(initialX);
  let posY = $state(initialY);

  let cardEl = $state<HTMLDivElement | null>(null);

  // Dragging Card State
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCardX = 0;
  let initialCardY = 0;

  // Resizing Card State
  let isResizing = $state(false);
  let resizeStartX = 0;
  let resizeStartY = 0;
  let initialResizeWidth = 0;
  let initialResizeHeight = 0;

  function handleStartDrag(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.resize-handle')) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialCardX = posX;
    initialCardY = posY;

    window.addEventListener('mousemove', handleDragging);
    window.addEventListener('mouseup', handleStopDrag);
  }

  function handleDragging(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    posX = Math.max(8, initialCardX + dx);
    posY = Math.max(8, initialCardY + dy);
  }

  function handleStopDrag() {
    isDragging = false;
    window.removeEventListener('mousemove', handleDragging);
    window.removeEventListener('mouseup', handleStopDrag);
  }

  function handleStartResize(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    initialResizeWidth = cardWidth;
    initialResizeHeight = cardEl ? cardEl.offsetHeight : 420;

    window.addEventListener('mousemove', handleResizing);
    window.addEventListener('mouseup', handleStopResize);
  }

  function handleResizing(e: MouseEvent) {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    cardWidth = Math.max(300, Math.min(840, initialResizeWidth + dx));
    cardHeight = Math.max(220, Math.min(760, initialResizeHeight + dy));
    isWideMode = cardWidth >= 520;
  }

  function handleStopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', handleResizing);
    window.removeEventListener('mouseup', handleStopResize);
  }

  function toggleWideMode() {
    if (isWideMode) {
      cardWidth = 340;
      isWideMode = false;
    } else {
      cardWidth = 580;
      isWideMode = true;
    }
  }

  function formatPrice(p?: number): string {
    if (p === undefined || isNaN(p)) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }

  // Highlight tag epistemik seperti [FAKTA], [INFERENSI], [SPEKULASI]
  function formatEpistemicText(text?: string): string {
    if (!text) return '';
    return text
      .replace(/\[FAKTA\]/g, '<span class="epistemic-badge fakta">[FAKTA]</span>')
      .replace(/\[INFERENSI\]/g, '<span class="epistemic-badge inferensi">[INFERENSI]</span>')
      .replace(/\[SPEKULASI\]/g, '<span class="epistemic-badge spekulasi">[SPEKULASI]</span>');
  }

  const isBearish = $derived(plan.bias === 'bearish');
</script>

{#if isMinimized}
  <!-- Mini Collapsed Pill HUD -->
  <div
    class="thesis-collapsed-pill obsidian-card"
    style="left: {posX}px; top: {posY}px;"
    onmousedown={handleStartDrag}
    role="region"
    aria-label="Tesis Trading Plan (Terkecilkan)"
  >
    <div class="pill-drag-handle">
      <GripVertical size={11} />
    </div>

    <div class="pill-badge {isBearish ? 'bearish' : 'bullish'}">
      {isBearish ? 'BEARISH' : 'BULLISH'}
    </div>

    <span class="pill-title mono-nums">
      {plan.conclusion?.probability ? `(${plan.conclusion.probability})` : `${plan.targets.length} Target`}
    </span>

    <button
      type="button"
      class="pill-btn"
      title="Buka Tesis Lengkap"
      onclick={() => (isMinimized = false)}
    >
      <Maximize2 size={11} />
    </button>

    <button
      type="button"
      class="pill-btn hide"
      title="Sembunyikan Tesis dari Grafik"
      onclick={() => onHide?.(plan.id)}
    >
      <EyeOff size={11} />
    </button>

    <button
      type="button"
      class="pill-btn close"
      title="Tutup & Hapus Rencana"
      onclick={() => onClose?.(plan.id)}
    >
      <X size={11} />
    </button>
  </div>
{:else}
  <!-- Full Glassmorphism Floating Card HUD -->
  <div
    bind:this={cardEl}
    class="floating-thesis-card obsidian-card {isWideMode ? 'wide-layout' : ''}"
    style="left: {posX}px; top: {posY}px; width: {cardWidth}px; {cardHeight ? `height: ${cardHeight}px;` : ''}"
    role="region"
    aria-label="Tesis Rencana Perdagangan"
  >
    <!-- Header Draggable -->
    <div
      class="thesis-header"
      onmousedown={handleStartDrag}
      role="banner"
    >
      <div class="header-left">
        <span class="drag-icon" title="Geser posisi kartu"><GripVertical size={13} /></span>
        <span class="bias-tag {isBearish ? 'bearish' : 'bullish'}">
          {isBearish ? 'BEARISH' : 'BULLISH'}
        </span>
        {#if plan.conclusion?.probability}
          <span class="prob-tag" title="Tingkat Keyakinan Setup">
            {plan.conclusion.probability}
          </span>
        {/if}
      </div>

      <div class="header-actions">
        <!-- Tombol Toggle Mode Lebar (Wide Mode 580px) -->
        <button
          type="button"
          class="card-btn {isWideMode ? 'active-wide' : ''}"
          title={isWideMode ? 'Persempit Jendela (340px)' : 'Lebarkan Jendela Tesis (580px)'}
          onclick={toggleWideMode}
        >
          {#if isWideMode}
            <Minimize2 size={12} />
          {:else}
            <Maximize2 size={12} />
          {/if}
        </button>

        <!-- Tombol Sembunyikan (Hide) -->
        <button
          type="button"
          class="card-btn"
          title="Sembunyikan Tesis dari Grafik"
          onclick={() => onHide?.(plan.id)}
        >
          <EyeOff size={12} />
        </button>

        <!-- Tombol Minimize ke Pill -->
        <button
          type="button"
          class="card-btn"
          title="Perkecil ke Pill"
          onclick={() => (isMinimized = true)}
        >
          <Minus size={12} />
        </button>

        <!-- Tombol Close & Delete -->
        <button
          type="button"
          class="card-btn close"
          title="Tutup & Hapus Rencana dari Grafik"
          onclick={() => onClose?.(plan.id)}
        >
          <X size={12} />
        </button>
      </div>
    </div>

    <!-- Scrollable Thesis Body -->
    <div class="thesis-body custom-scroll {isWideMode ? 'columns-grid' : ''}">
      {#if isWideMode}
        <!-- Kolom Kiri: Katalis Entry, FVG, Definisi, & Risiko -->
        <div class="thesis-col left-col">
          {#if plan.definition}
            <div class="definition-banner">
              <Info size={11} class="def-icon" />
              <span class="def-text">{plan.definition}</span>
            </div>
          {/if}

          <!-- Section: Katalis Entry & FVG -->
          <div class="thesis-section entry-section">
            <div class="section-title-row">
              <span class="section-icon"><Zap size={11} /></span>
              <span class="section-label">KATALIS ENTRY</span>
              <span class="price-val mono-nums {isBearish ? 'bearish' : 'bullish'}">
                ${formatPrice(plan.entry)}
              </span>
            </div>

            {#if plan.contextZones && plan.contextZones.length > 0}
              <div class="zones-container">
                {#each plan.contextZones as zone}
                  <div class="zone-pill {isBearish ? 'bearish' : 'bullish'} mono-nums">
                    <Layers size={10} />
                    <span>{zone.label || 'FVG'}: ${formatPrice(zone.low)} - ${formatPrice(zone.high)}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if plan.reasons.entry}
              <div class="reason-text">
                {@html formatEpistemicText(plan.reasons.entry)}
              </div>
            {/if}
          </div>

          <!-- Section: Ringkasan Probabilitas & Risiko -->
          {#if plan.riskAmount || plan.conclusion?.probabilityNotes}
            <div class="thesis-section risk-summary-section">
              {#if plan.riskAmount}
                <div class="risk-meta-row mono-nums">
                  <span class="meta-lbl">Unit Risiko (R):</span>
                  <span class="meta-val">${formatPrice(plan.riskAmount)}</span>
                </div>
              {/if}
              {#if plan.conclusion?.probabilityNotes}
                <div class="prob-notes">
                  {@html formatEpistemicText(plan.conclusion.probabilityNotes)}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Kolom Kanan: Skenario Invalidasi & Target Likuiditas -->
        <div class="thesis-col right-col">
          <!-- Section: Proteksi & Skenario Invalidasi -->
          <div class="thesis-section sl-section">
            <div class="section-title-row">
              <span class="section-icon sl"><ShieldAlert size={11} /></span>
              <span class="section-label">INVALIDASI & STOP LOSS</span>
              <span class="price-val mono-nums sl">
                ${formatPrice(plan.stopLoss)}
              </span>
            </div>

            {#if plan.reasons.stopLoss}
              <div class="reason-text">
                {@html formatEpistemicText(plan.reasons.stopLoss)}
              </div>
            {/if}

            {#if plan.conclusion?.invalidationScenario}
              <div class="invalidation-box">
                <span class="inv-badge">SKENARIO BATAL</span>
                <span class="inv-content">
                  {@html formatEpistemicText(plan.conclusion.invalidationScenario)}
                </span>
              </div>
            {/if}
          </div>

          <!-- Section: Target Likuiditas (Take Profit) -->
          <div class="thesis-section tp-section">
            <div class="section-title-row">
              <span class="section-icon tp"><Target size={11} /></span>
              <span class="section-label">TARGET LIKUIDITAS ({plan.targets.length})</span>
            </div>

            <div class="targets-list">
              {#each plan.targets as tgt, idx}
                {@const targetKey = `tp${idx + 1}`}
                {@const reason = plan.reasons[targetKey]}
                <div class="target-item">
                  <div class="target-item-header">
                    <span class="target-badge mono-nums">TP{idx + 1}</span>
                    <span class="target-price mono-nums">${formatPrice(tgt.price)}</span>
                    {#if tgt.rMultiple}
                      <span class="r-badge mono-nums">+{tgt.rMultiple.toFixed(2)}R</span>
                    {/if}
                  </div>
                  {#if reason}
                    <div class="target-reason">
                      {@html formatEpistemicText(reason)}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- Tampilan Standar 1 Kolom Ringkas -->
        {#if plan.definition}
          <div class="definition-banner">
            <Info size={11} class="def-icon" />
            <span class="def-text">{plan.definition}</span>
          </div>
        {/if}

        <!-- Section: Katalis Entry & FVG -->
        <div class="thesis-section entry-section">
          <div class="section-title-row">
            <span class="section-icon"><Zap size={11} /></span>
            <span class="section-label">KATALIS ENTRY</span>
            <span class="price-val mono-nums {isBearish ? 'bearish' : 'bullish'}">
              ${formatPrice(plan.entry)}
            </span>
          </div>

          {#if plan.contextZones && plan.contextZones.length > 0}
            <div class="zones-container">
              {#each plan.contextZones as zone}
                <div class="zone-pill {isBearish ? 'bearish' : 'bullish'} mono-nums">
                  <Layers size={10} />
                  <span>{zone.label || 'FVG'}: ${formatPrice(zone.low)} - ${formatPrice(zone.high)}</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if plan.reasons.entry}
            <div class="reason-text">
              {@html formatEpistemicText(plan.reasons.entry)}
            </div>
          {/if}
        </div>

        <!-- Section: Proteksi & Skenario Invalidasi -->
        <div class="thesis-section sl-section">
          <div class="section-title-row">
            <span class="section-icon sl"><ShieldAlert size={11} /></span>
            <span class="section-label">INVALIDASI & STOP LOSS</span>
            <span class="price-val mono-nums sl">
              ${formatPrice(plan.stopLoss)}
            </span>
          </div>

          {#if plan.reasons.stopLoss}
            <div class="reason-text">
              {@html formatEpistemicText(plan.reasons.stopLoss)}
            </div>
          {/if}

          {#if plan.conclusion?.invalidationScenario}
            <div class="invalidation-box">
              <span class="inv-badge">SKENARIO BATAL</span>
              <span class="inv-content">
                {@html formatEpistemicText(plan.conclusion.invalidationScenario)}
              </span>
            </div>
          {/if}
        </div>

        <!-- Section: Target Likuiditas (Take Profit) -->
        <div class="thesis-section tp-section">
          <div class="section-title-row">
            <span class="section-icon tp"><Target size={11} /></span>
            <span class="section-label">TARGET LIKUIDITAS ({plan.targets.length})</span>
          </div>

          <div class="targets-list">
            {#each plan.targets as tgt, idx}
              {@const targetKey = `tp${idx + 1}`}
              {@const reason = plan.reasons[targetKey]}
              <div class="target-item">
                <div class="target-item-header">
                  <span class="target-badge mono-nums">TP{idx + 1}</span>
                  <span class="target-price mono-nums">${formatPrice(tgt.price)}</span>
                  {#if tgt.rMultiple}
                    <span class="r-badge mono-nums">+{tgt.rMultiple.toFixed(2)}R</span>
                  {/if}
                </div>
                {#if reason}
                  <div class="target-reason">
                    {@html formatEpistemicText(reason)}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Section: Ringkasan Probabilitas & Risiko -->
        {#if plan.riskAmount || plan.conclusion?.probabilityNotes}
          <div class="thesis-section risk-summary-section">
            {#if plan.riskAmount}
              <div class="risk-meta-row mono-nums">
                <span class="meta-lbl">Unit Risiko (R):</span>
                <span class="meta-val">${formatPrice(plan.riskAmount)}</span>
              </div>
            {/if}
            {#if plan.conclusion?.probabilityNotes}
              <div class="prob-notes">
                {@html formatEpistemicText(plan.conclusion.probabilityNotes)}
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Drag Resize Handle di sudut kanan-bawah -->
    <div
      class="resize-handle"
      title="Tarik untuk mengubah ukuran jendela tesis"
      onmousedown={handleStartResize}
      role="separator"
      aria-label="Ubah ukuran jendela tesis"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    </div>
  </div>
{/if}

<style>
  /* Glassmorphism Collapsed Pill */
  .thesis-collapsed-pill {
    position: absolute;
    z-index: 26;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    cursor: grab;
    user-select: none;
    transition: border-color 0.15s ease;
  }

  .thesis-collapsed-pill:hover {
    border-color: rgba(255, 255, 255, 0.25);
  }

  .pill-drag-handle {
    display: flex;
    align-items: center;
    color: #64748b;
  }

  .pill-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .pill-badge.bearish {
    background: rgba(255, 105, 180, 0.15);
    color: #ff69b4;
    border: 1px solid rgba(255, 105, 180, 0.35);
  }

  .pill-badge.bullish {
    background: rgba(0, 255, 136, 0.15);
    color: #00ff88;
    border: 1px solid rgba(0, 255, 136, 0.35);
  }

  .pill-title {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
  }

  .pill-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 4px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pill-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .pill-btn.hide:hover {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .pill-btn.close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Full Glassmorphism Card */
  .floating-thesis-card {
    position: absolute;
    z-index: 26;
    min-width: 300px;
    max-width: calc(100% - 32px);
    background: rgba(13, 20, 36, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.2) inset;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: text;
    transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Header */
  .thesis-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    cursor: grab;
    flex-shrink: 0;
  }

  .thesis-header:active {
    cursor: grabbing;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .drag-icon {
    display: flex;
    align-items: center;
    color: #64748b;
  }

  .bias-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }

  .bias-tag.bearish {
    background: rgba(255, 105, 180, 0.16);
    color: #ff69b4;
    border: 1px solid rgba(255, 105, 180, 0.4);
  }

  .bias-tag.bullish {
    background: rgba(0, 255, 136, 0.16);
    color: #00ff88;
    border: 1px solid rgba(0, 255, 136, 0.4);
  }

  .prob-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(56, 189, 248, 0.14);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .card-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .card-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .card-btn.active-wide {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
  }

  .card-btn.close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Body Content */
  .thesis-body {
    padding: 10px 12px;
    max-height: 480px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  /* Wide Multi-Column Layout */
  .thesis-body.columns-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .thesis-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .custom-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }

  .definition-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 2px solid #38bdf8;
    border-radius: 0 4px 4px 0;
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
    line-height: 1.4;
  }

  .def-icon {
    flex-shrink: 0;
    color: #38bdf8;
    margin-top: 2px;
  }

  /* Section Common */
  .thesis-section {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .thesis-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.06em;
  }

  .section-icon {
    display: flex;
    align-items: center;
    color: #38bdf8;
  }

  .section-icon.sl {
    color: #ef4444;
  }

  .section-icon.tp {
    color: #10b981;
  }

  .section-label {
    flex: 1;
  }

  .price-val {
    font-size: 11px;
    font-weight: 700;
  }

  .price-val.bearish {
    color: #ff69b4;
  }

  .price-val.bullish {
    color: #00ff88;
  }

  .price-val.sl {
    color: #ef4444;
  }

  .zones-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .zone-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .zone-pill.bearish {
    background: rgba(255, 105, 180, 0.1);
    color: #ff69b4;
    border: 1px solid rgba(255, 105, 180, 0.25);
  }

  .zone-pill.bullish {
    background: rgba(0, 255, 136, 0.1);
    color: #00ff88;
    border: 1px solid rgba(0, 255, 136, 0.25);
  }

  .reason-text {
    font-size: 11px;
    line-height: 1.45;
    color: #cbd5e1;
  }

  /* Invalidation Callout */
  .invalidation-box {
    margin-top: 4px;
    padding: 6px 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px dashed rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: #fca5a5;
  }

  .inv-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
    padding: 1px 4px;
    border-radius: 3px;
    margin-right: 4px;
    letter-spacing: 0.04em;
  }

  /* Targets List */
  .targets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .target-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 5px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .target-item-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-badge {
    font-size: 10px;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .target-price {
    font-size: 11px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .r-badge {
    font-size: 10px;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .target-reason {
    font-size: 10.5px;
    color: #94a3b8;
    line-height: 1.35;
  }

  /* Epistemic Badges */
  :global(.epistemic-badge) {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.03em;
  }

  :global(.epistemic-badge.fakta) {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  :global(.epistemic-badge.inferensi) {
    background: rgba(250, 204, 21, 0.15);
    color: #facc15;
    border: 1px solid rgba(250, 204, 21, 0.3);
  }

  :global(.epistemic-badge.spekulasi) {
    background: rgba(251, 146, 60, 0.15);
    color: #fb923c;
    border: 1px solid rgba(251, 146, 60, 0.3);
  }

  /* Risk Summary Section */
  .risk-summary-section {
    font-size: 10.5px;
    color: #94a3b8;
  }

  .risk-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
  }

  .meta-lbl {
    color: #64748b;
  }

  .meta-val {
    color: #cbd5e1;
    font-weight: 600;
  }

  .prob-notes {
    margin-top: 4px;
    line-height: 1.4;
    color: #cbd5e1;
  }

  /* Drag Resize Corner Handle */
  .resize-handle {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    cursor: se-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.5;
    transition: opacity 0.15s ease;
    user-select: none;
  }

  .resize-handle:hover {
    opacity: 1;
  }
</style>
