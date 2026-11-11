<script lang="ts">
  import { onDestroy } from 'svelte';
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
    EyeOff,
    Pencil
  } from '@lucide/svelte';
  import { formatPlanPrice, type ParsedTradingPlan } from '../services/planParserService';
  import {
    buildThesisPresentationModel,
    type EpistemicTextSegment
  } from '../services/thesisOverlayEngine';

  export interface ThesisCardGeometry {
    planId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isWideMode: boolean;
    isMinimized: boolean;
  }

  interface Props {
    plan: ParsedTradingPlan & { id: string };
    initialX?: number;
    initialY?: number;
    initialWidth?: number;
    initialHeight?: number;
    initialIsWideMode?: boolean;
    initialIsMinimized?: boolean;
    onClose?: (planId: string) => void;
    onHide?: (planId: string) => void;
    onEdit?: (planId: string) => void;
    onGeometryChange?: (geo: ThesisCardGeometry) => void;
  }

  let {
    plan,
    initialX = 16,
    initialY = 56,
    initialWidth = 340,
    initialHeight,
    initialIsWideMode = false,
    initialIsMinimized = false,
    onClose,
    onHide,
    onEdit,
    onGeometryChange
  }: Props = $props();

  let isMinimized = $state(initialIsMinimized);
  let isWideMode = $state(initialIsWideMode);
  let cardWidth = $state(initialWidth);
  let cardHeight = $state<number | null>(initialHeight || null);
  let posX = $state(initialX);
  let posY = $state(initialY);

  let cardEl = $state<HTMLDivElement | null>(null);

  function emitGeometryChange() {
    const currentH = cardHeight ?? (cardEl ? cardEl.offsetHeight : 420);
    onGeometryChange?.({
      planId: plan.id,
      x: posX,
      y: posY,
      width: cardWidth,
      height: currentH,
      isWideMode,
      isMinimized
    });
  }

  // State Penyeretan Kartu (Dragging)
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCardX = 0;
  let initialCardY = 0;

  // State Pengubahan Ukuran Kartu (Resizing)
  let isResizing = $state(false);
  let resizeStartX = 0;
  let resizeStartY = 0;
  let initialResizeWidth = 0;
  let initialResizeHeight = 0;

  // Selaraskan state lokal saat geometri hasil restore workspace masuk via props
  $effect(() => {
    const _id = plan.id;
    const nextX = initialX;
    const nextY = initialY;
    const nextW = initialWidth;
    const nextH = initialHeight || null;
    const nextWide = initialIsWideMode;
    const nextMin = initialIsMinimized;
    if (!isDragging && !isResizing) {
      posX = nextX;
      posY = nextY;
      cardWidth = nextW;
      cardHeight = nextH;
      isWideMode = nextWide;
      isMinimized = nextMin;
    }
  });

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
    const wasDragging = isDragging;
    isDragging = false;
    window.removeEventListener('mousemove', handleDragging);
    window.removeEventListener('mouseup', handleStopDrag);
    if (wasDragging) {
      emitGeometryChange();
    }
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
    cardHeight = Math.max(220, Math.min(960, initialResizeHeight + dy));
    isWideMode = cardWidth >= 520;
  }

  function handleStopResize() {
    const wasResizing = isResizing;
    isResizing = false;
    window.removeEventListener('mousemove', handleResizing);
    window.removeEventListener('mouseup', handleStopResize);
    if (wasResizing) {
      emitGeometryChange();
    }
  }

  onDestroy(() => {
    window.removeEventListener('mousemove', handleDragging);
    window.removeEventListener('mouseup', handleStopDrag);
    window.removeEventListener('mousemove', handleResizing);
    window.removeEventListener('mouseup', handleStopResize);
  });

  function toggleWideMode() {
    if (isWideMode) {
      cardWidth = 340;
      isWideMode = false;
    } else {
      cardWidth = 580;
      isWideMode = true;
    }
    emitGeometryChange();
  }

  function setMinimizedState(minimized: boolean) {
    isMinimized = minimized;
    emitGeometryChange();
  }

  const vm = $derived(
    buildThesisPresentationModel(plan, {
      variant: 'floating-card',
      formatPrice: (p) => formatPlanPrice(p ?? undefined)
    })
  );
  const isBearish = $derived(vm.isBearish);
</script>

{#snippet epistemicText(segments: EpistemicTextSegment[])}
  {#each segments as seg}
    {#if seg.type === 'badge'}
      <span class="epistemic-badge {seg.kind}">{seg.label}</span>{seg.trailingPunct ?? ''}
    {:else}
      {seg.content}
    {/if}
  {/each}
{/snippet}

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
      {vm.header.biasLabel}
    </div>

    <span class="pill-title mono-nums">
      {vm.header.collapsedSubtitle}
    </span>

    <button
      type="button"
      class="pill-btn edit"
      title="Edit Trade Plan di Form"
      onclick={() => onEdit?.(plan.id)}
    >
      <Pencil size={11} />
    </button>

    <button
      type="button"
      class="pill-btn"
      title="Buka Tesis Lengkap"
      onclick={() => setMinimizedState(false)}
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
    class="floating-thesis-card obsidian-card {isWideMode ? 'wide-layout' : ''} {cardHeight ? 'has-custom-height' : ''}"
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
          {vm.header.biasLabel}
        </span>
        {#if vm.header.probabilityBadge}
          <span class="prob-tag" title="Tingkat Keyakinan Setup">
            {vm.header.probabilityBadge.fullText}
          </span>
        {/if}
        {#if vm.header.setupStatusBadge}
          <span class="status-tag mono-nums" title="Status Setup">
            {vm.header.setupStatusBadge}
          </span>
        {/if}
        {#if vm.header.confluenceBadge}
          <span class="status-tag conf-tag mono-nums" title="Skor Konfluensi Setup">
            {vm.header.confluenceBadge.shortText}
          </span>
        {/if}
      </div>

      <div class="header-actions">
        <!-- Tombol Edit Plan di Panel Kanan -->
        <button
          type="button"
          class="card-btn edit"
          title="Edit Trade Plan di Form"
          onclick={() => onEdit?.(plan.id)}
        >
          <Pencil size={12} />
        </button>

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
          onclick={() => setMinimizedState(true)}
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
      {#if vm.definition}
        <div class="definition-banner">
          <Info size={11} class="def-icon" />
          <span class="def-text">{vm.definition}</span>
        </div>
      {/if}

      <!-- Section: Katalis Entry & FVG -->
      <div class="thesis-section entry-section">
        <div class="section-title-row">
          <span class="section-icon"><Zap size={11} /></span>
          <span class="section-label">
            {vm.entrySection.title}
          </span>
          <span class="price-val mono-nums {isBearish ? 'bearish' : 'bullish'}">
            {vm.entrySection.formattedPrimaryPrice}
          </span>
        </div>

        {#if vm.entrySection.dualEntries.length > 0}
          <div class="entry-levels-container">
            {#each vm.entrySection.dualEntries as e (e.id)}
              <div class="entry-level-pill mono-nums {e.style}">
                <span class="level-lbl">{e.label}</span>
                <span class="level-price">{e.formattedPrice}</span>
                {#if e.weightText}
                  <span class="level-weight">{e.weightText}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if vm.entrySection.contextZones.length > 0}
          <div class="zones-container">
            {#each vm.entrySection.contextZones as zone}
              <div class="zone-pill {zone.polarity} mono-nums">
                <Layers size={10} />
                <span>{zone.formattedRange}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if vm.entrySection.reasonSegments.length > 0}
          <div class="reason-text">
            {@render epistemicText(vm.entrySection.reasonSegments)}
          </div>
        {/if}
      </div>

      <!-- Section: Proteksi & Skenario Invalidasi -->
      <div class="thesis-section sl-section">
        <div class="section-title-row">
          <span class="section-icon sl"><ShieldAlert size={11} /></span>
          <span class="section-label">{vm.invalidationSection.title}</span>
          <span class="price-val mono-nums sl">
            {vm.invalidationSection.formattedStopLoss}
          </span>
          <span class="r-badge sl-r-badge mono-nums">{vm.invalidationSection.rBadge}</span>
        </div>

        {#if vm.invalidationSection.reasonSegments.length > 0}
          <div class="reason-text">
            {@render epistemicText(vm.invalidationSection.reasonSegments)}
          </div>
        {/if}

        {#if vm.invalidationSection.invalidationBox}
          <div class="invalidation-box">
            <span class="inv-badge">{vm.invalidationSection.invalidationBox.badgeLabel}</span>
            <span class="inv-content">
              {@render epistemicText(vm.invalidationSection.invalidationBox.segments)}
            </span>
          </div>
        {/if}
      </div>

      <!-- Section: Target Likuiditas (Take Profit) -->
      <div class="thesis-section tp-section">
        <div class="section-title-row">
          <span class="section-icon tp"><Target size={11} /></span>
          <span class="section-label">{vm.targetsSection.title}</span>
        </div>

        <div class="targets-list">
          {#each vm.targetsSection.items as item}
            <div class="target-item">
              <div class="target-item-header">
                <span class="target-badge mono-nums">{item.badge}</span>
                <span class="target-price mono-nums">{item.formattedPrice}</span>
                {#if item.rBadge}
                  <span class="r-badge mono-nums {item.rBadge.isNegative ? 'sl-r-badge' : ''}">
                    {item.rBadge.primaryText}
                    {#if item.rBadge.e1SubText}
                      <span class="r-sub">{item.rBadge.e1SubText}</span>
                    {/if}
                  </span>
                {/if}
              </div>
              {#if item.reasonSegments.length > 0}
                <div class="target-reason">
                  {@render epistemicText(item.reasonSegments)}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Section: Ringkasan Probabilitas & Risiko -->
      {#if vm.riskFooter}
        <div class="thesis-section risk-summary-section">
          {#if vm.riskFooter.formattedRiskAmount}
            <div class="risk-meta-row mono-nums">
              <span class="meta-lbl">Unit Risiko (R):</span>
              <span class="meta-val">
                {vm.riskFooter.formattedRiskAmount}
                {#if vm.riskFooter.riskPercentText}
                  <span class="risk-pct-badge">{vm.riskFooter.riskPercentText}</span>
                {/if}
              </span>
            </div>
          {/if}
          {#if vm.riskFooter.probabilityNotesSegments.length > 0}
            <div class="prob-notes">
              {@render epistemicText(vm.riskFooter.probabilityNotesSegments)}
            </div>
          {/if}
        </div>
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
    background: var(--chart-thesis-bg, var(--bg-secondary, rgba(20, 24, 35, 0.92)));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--chart-thesis-border, var(--border-subtle, rgba(255, 255, 255, 0.12)));
    border-radius: 20px;
    box-shadow: var(--chart-thesis-shadow, 0 4px 16px rgba(0, 0, 0, 0.5));
    cursor: grab;
    user-select: none;
    transition: border-color 0.15s ease;
  }

  .thesis-collapsed-pill:hover {
    border-color: var(--chart-thesis-border-hairline, var(--border-bright, rgba(255, 255, 255, 0.25)));
  }

  .pill-drag-handle {
    display: flex;
    align-items: center;
    color: var(--chart-thesis-text-muted, var(--text-muted, #64748b));
  }

  .pill-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .pill-badge.bearish {
    background: var(--chart-thesis-bear-glow, var(--bear-glow, rgba(255, 105, 180, 0.15)));
    color: var(--chart-thesis-bear, var(--bear-color, #ff69b4));
    border: 1px solid var(--chart-thesis-bear, var(--bear-color, rgba(255, 105, 180, 0.35)));
  }

  .pill-badge.bullish {
    background: var(--chart-thesis-bull-glow, var(--bull-glow, rgba(0, 255, 136, 0.15)));
    color: var(--chart-thesis-bull, var(--bull-color, #00ff88));
    border: 1px solid var(--chart-thesis-bull, var(--bull-color, rgba(0, 255, 136, 0.35)));
  }

  .pill-title {
    font-size: 11px;
    color: var(--chart-thesis-text-muted, var(--text-muted, #94a3b8));
    font-weight: 500;
  }

  .pill-btn {
    background: transparent;
    border: none;
    color: var(--chart-thesis-text-muted, var(--text-muted, #94a3b8));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 4px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pill-btn:hover {
    background: var(--chart-thesis-header-bg, var(--bg-hover));
    color: var(--chart-thesis-text, var(--text-main));
  }

  .pill-btn:focus-visible,
  .card-btn:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }

  .pill-btn.edit:hover {
    background: color-mix(in srgb, var(--chart-thesis-cyan, var(--brand-cyan)) 18%, transparent);
    color: var(--chart-thesis-cyan, var(--brand-cyan));
  }

  .pill-btn.hide:hover {
    background: color-mix(in srgb, var(--status-warn) 20%, transparent);
    color: var(--status-warn);
  }

  .pill-btn.close:hover {
    background: color-mix(in srgb, var(--status-danger) 20%, transparent);
    color: var(--status-danger);
  }

  /* Full Glassmorphism Card (Chart-Dominant Thesis Surface, ADR-0019) */
  .floating-thesis-card {
    position: absolute;
    z-index: 26;
    min-width: 300px;
    max-width: calc(100% - 32px);
    background: var(--chart-thesis-bg, var(--bg-secondary, rgba(20, 24, 35, 0.92)));
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--chart-thesis-border, var(--border-subtle, rgba(255, 255, 255, 0.12)));
    border-radius: 10px;
    box-shadow: var(--chart-thesis-shadow, 0 10px 30px rgba(0, 0, 0, 0.65)), 0 0 1px var(--chart-thesis-border-hairline, var(--border-hairline, rgba(255, 255, 255, 0.2))) inset;
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
    background: var(--chart-thesis-header-bg, rgba(255, 255, 255, 0.03));
    border-bottom: 1px solid var(--chart-thesis-border, var(--border-subtle, rgba(255, 255, 255, 0.08)));
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
    color: var(--chart-thesis-text-muted, var(--text-muted, #64748b));
  }

  .bias-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }

  .bias-tag.bearish {
    background: var(--chart-thesis-bear-glow, var(--bear-glow, rgba(255, 105, 180, 0.16)));
    color: var(--chart-thesis-bear, var(--bear-color, #ff69b4));
    border: 1px solid var(--chart-thesis-bear, var(--bear-color, rgba(255, 105, 180, 0.4)));
  }

  .bias-tag.bullish {
    background: var(--chart-thesis-bull-glow, var(--bull-glow, rgba(0, 255, 136, 0.16)));
    color: var(--chart-thesis-bull, var(--bull-color, #00ff88));
    border: 1px solid var(--chart-thesis-bull, var(--bull-color, rgba(0, 255, 136, 0.4)));
  }

  .prob-tag {
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    padding: 2px 5px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--chart-thesis-cyan, var(--brand-cyan)) 14%, transparent);
    color: var(--chart-thesis-cyan, var(--brand-cyan));
    border: 1px solid color-mix(in srgb, var(--chart-thesis-cyan, var(--brand-cyan)) 30%, transparent);
  }

  .status-tag {
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    padding: 2px 5px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--status-warn) 12%, transparent);
    color: var(--status-warn);
    border: 1px solid color-mix(in srgb, var(--status-warn) 30%, transparent);
    letter-spacing: 0.3px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .card-btn {
    background: transparent;
    border: none;
    color: var(--chart-thesis-text-muted, var(--text-muted));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: var(--radius-md);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .card-btn:hover {
    background: var(--chart-thesis-header-bg, var(--bg-hover));
    color: var(--chart-thesis-text, var(--text-main));
  }

  .card-btn.edit:hover {
    background: color-mix(in srgb, var(--chart-thesis-cyan, var(--brand-cyan)) 18%, transparent);
    color: var(--chart-thesis-cyan, var(--brand-cyan));
  }

  .card-btn.active-wide {
    color: var(--chart-thesis-cyan, var(--brand-cyan));
    background: color-mix(in srgb, var(--chart-thesis-cyan, var(--brand-cyan)) 15%, transparent);
  }

  .card-btn.close:hover {
    background: color-mix(in srgb, var(--status-danger) 20%, transparent);
    color: var(--status-danger);
  }

  /* Body Content */
  .thesis-body {
    padding: 10px 12px;
    min-height: 0;
    max-height: 520px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1 1 auto;
  }

  /* Saat kartu memiliki tinggi eksplisit kustom (cardHeight), hilangkan batas max-height agar mengisi penuh */
  .floating-thesis-card.has-custom-height .thesis-body {
    max-height: none;
    height: 100%;
  }

  /* Wide Multi-Column Layout */
  .thesis-body.columns-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
  }

  .thesis-body.columns-grid .definition-banner {
    grid-column: 1 / -1;
  }

  .thesis-body.columns-grid .entry-section {
    grid-column: 1;
  }

  .thesis-body.columns-grid .risk-summary-section {
    grid-column: 1;
  }

  .thesis-body.columns-grid .sl-section {
    grid-column: 2;
  }

  .thesis-body.columns-grid .tp-section {
    grid-column: 2;
  }

  .custom-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scroll::-webkit-scrollbar-thumb {
    background: var(--chart-thesis-border-hairline, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }

  .definition-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    background: var(--chart-thesis-header-bg, rgba(255, 255, 255, 0.03));
    border-left: 2px solid var(--chart-thesis-cyan, #38bdf8);
    border-radius: 0 4px 4px 0;
    font-size: 11px;
    color: var(--chart-thesis-text-muted, var(--text-muted, #94a3b8));
    font-style: italic;
    line-height: 1.4;
  }

  .def-icon {
    flex-shrink: 0;
    color: var(--chart-thesis-cyan, #38bdf8);
    margin-top: 2px;
  }

  /* Section Common */
  .thesis-section {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--chart-thesis-border, var(--border-subtle, rgba(255, 255, 255, 0.05)));
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
    color: var(--chart-thesis-text-muted, var(--text-muted, #64748b));
    letter-spacing: 0.06em;
  }

  .section-icon {
    display: flex;
    align-items: center;
    color: var(--chart-thesis-cyan, #38bdf8);
  }

  .section-icon.sl {
    color: #ef4444;
  }

  .section-icon.tp {
    color: var(--chart-thesis-bull, #10b981);
  }

  .section-label {
    flex: 1;
  }

  .price-val {
    font-size: 11px;
    font-weight: 700;
  }

  .price-val.bearish {
    color: var(--chart-thesis-bear, var(--bear-color, #ff69b4));
  }

  .price-val.bullish {
    color: var(--chart-thesis-bull, var(--bull-color, #00ff88));
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
    background: var(--chart-thesis-bear-glow, var(--bear-glow, rgba(255, 105, 180, 0.1)));
    color: var(--chart-thesis-bear, var(--bear-color, #ff69b4));
    border: 1px solid var(--chart-thesis-bear, var(--bear-color, rgba(255, 105, 180, 0.25)));
  }

  .zone-pill.bullish {
    background: var(--chart-thesis-bull-glow, var(--bull-glow, rgba(0, 255, 136, 0.1)));
    color: var(--chart-thesis-bull, var(--bull-color, #00ff88));
    border: 1px solid var(--chart-thesis-bull, var(--bull-color, rgba(0, 255, 136, 0.25)));
  }

  .zone-pill.neutral {
    background: rgba(160, 160, 160, 0.1);
    color: var(--text-secondary, #94a3b8);
    border: 1px solid rgba(160, 160, 160, 0.25);
  }

  .reason-text {
    font-size: 11px;
    line-height: 1.45;
    color: var(--chart-thesis-text, var(--text-primary, var(--text-main, #cbd5e1)));
  }

  /* Invalidation Callout */
  .invalidation-box {
    margin-top: 4px;
    padding: 6px 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px dashed rgba(239, 68, 68, 0.35);
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--chart-thesis-text, #fca5a5);
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
    background: var(--chart-thesis-item-bg, rgba(255, 255, 255, 0.02));
    border: 1px solid var(--chart-thesis-border, rgba(255, 255, 255, 0.04));
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
    background: var(--chart-thesis-bull-glow, rgba(16, 185, 129, 0.15));
    color: var(--chart-thesis-bull, #10b981);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .target-price {
    font-size: 11px;
    font-weight: 600;
    color: var(--chart-thesis-text, var(--text-primary, var(--text-main, #f1f5f9)));
  }

  .r-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--chart-thesis-cyan, #38bdf8);
    background: rgba(56, 189, 248, 0.12);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .r-badge.sl-r-badge {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.14);
  }

  .r-sub {
    font-size: 9px;
    font-weight: 500;
    opacity: 0.85;
    margin-left: 3px;
  }

  .risk-pct-badge {
    font-size: 10px;
    color: var(--chart-thesis-cyan, #38bdf8);
    margin-left: 4px;
    font-weight: 600;
  }

  .status-tag.conf-tag {
    background: rgba(168, 85, 247, 0.16);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  /* Dual-Entry Pills */
  .entry-levels-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }

  .entry-level-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .entry-level-pill.aggressive {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .entry-level-pill.moderate {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.3);
  }

  .level-lbl {
    font-weight: 600;
    opacity: 0.9;
  }

  .level-price {
    font-weight: 700;
  }

  .level-weight {
    font-size: 9px;
    opacity: 0.8;
  }

  .target-reason {
    font-size: 10.5px;
    color: var(--chart-thesis-text-muted, var(--text-muted, #94a3b8));
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
    color: #eab308;
    border: 1px solid rgba(250, 204, 21, 0.3);
  }

  :global(.epistemic-badge.spekulasi) {
    background: rgba(251, 146, 60, 0.15);
    color: #f97316;
    border: 1px solid rgba(251, 146, 60, 0.3);
  }

  /* Risk Summary Section */
  .risk-summary-section {
    font-size: 10.5px;
    color: var(--chart-thesis-text-muted, var(--text-muted, #94a3b8));
  }

  .risk-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
  }

  .meta-lbl {
    color: var(--chart-thesis-text-muted, var(--text-muted, #64748b));
  }

  .meta-val {
    color: var(--chart-thesis-text, var(--text-primary, var(--text-main, #cbd5e1)));
    font-weight: 600;
  }

  .prob-notes {
    margin-top: 4px;
    line-height: 1.4;
    color: var(--chart-thesis-text, var(--text-primary, var(--text-main, #cbd5e1)));
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
