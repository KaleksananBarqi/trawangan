<script lang="ts">
  import {
    TrendingUp,
    ChevronRight,
    ChevronDown,
    Layers,
    Eye,
    EyeOff,
    Trash2,
    ArrowUpRight,
    MoveHorizontal,
    SlidersHorizontal,
    Lock,
    Unlock,
    Settings,
    Code,
    Square,
    Type,
    Minus,
    Pencil,
    Sparkles
  } from '@lucide/svelte';
  import { isSameSymbol } from '../../services/instrumentIdentity';
  import type { ActiveTradingPlan } from '../../services/tradingPlanLifecycle';
  import type { TradePlanTabSubMode } from '../../services/tradePlanFormService';

  interface Props {
    activeSymbol: string;
    activeIndicators?: { id: string; title: string; visible: boolean; source?: string; inputs?: any }[];
    activeDrawings?: any[];
    selectedDrawingId?: string | null;
    showVolume?: boolean;
    activePlans?: ActiveTradingPlan[];
    showThesisCards?: boolean;
    onToggleVolumeVisibility?: () => void;
    onToggleIndicatorVisibility?: (id: string) => void;
    onRemoveIndicator?: (id: string) => void;
    onConfigureIndicator?: (id: string) => void;
    onOpenIndicatorInPine?: (id: string, source?: string) => void;
    onToggleDrawingVisibility?: (id: string) => void;
    onToggleDrawingLock?: (id: string) => void;
    onRemoveDrawing?: (id: string) => void;
    onSelectDrawing?: (id: string | null) => void;
    onBulkHideDrawings?: (hidden: boolean) => void;
    onBulkLockDrawings?: (locked: boolean) => void;
    onBulkDeleteDrawings?: () => void;
    onToggleThesisCards?: () => void;
    onRemovePlan?: (id: string) => void;
    onEditPlan?: (planId: string) => void;
    onOpenPlanTab?: (subMode?: TradePlanTabSubMode) => void;
  }

  let {
    activeSymbol,
    activeIndicators = [],
    activeDrawings = [],
    selectedDrawingId = null,
    showVolume = true,
    activePlans = [],
    showThesisCards = true,
    onToggleVolumeVisibility,
    onToggleIndicatorVisibility,
    onRemoveIndicator,
    onConfigureIndicator,
    onOpenIndicatorInPine,
    onToggleDrawingVisibility,
    onToggleDrawingLock,
    onRemoveDrawing,
    onSelectDrawing,
    onBulkHideDrawings,
    onBulkLockDrawings,
    onBulkDeleteDrawings,
    onToggleThesisCards,
    onRemovePlan,
    onEditPlan,
    onOpenPlanTab,
  }: Props = $props();

  let isIndicatorsGroupOpen = $state(true);
  let isPlansGroupOpen = $state(true);
  let isDrawingsGroupOpen = $state(true);

  const scopedPlans = $derived(
    activePlans.filter((p) => !p.symbol || isSameSymbol(p.symbol, activeSymbol))
  );
  const nativeVolumeCount = $derived(showVolume ? 1 : 0);
  const totalIndicatorsCount = $derived(activeIndicators.length + nativeVolumeCount);

  // Otomatis scroll item layer yang dipilih dari kanvas ke area pandang
  function scrollIntoViewIfSelected(node: HTMLElement, isSelected: boolean) {
    if (isSelected) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return {
      update(selected: boolean) {
        if (selected) {
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };
  }

  // Jika ada drawing dipilih dari kanvas sementara grup drawings tertutup, buka otomatis
  $effect(() => {
    if (selectedDrawingId && !isDrawingsGroupOpen) {
      isDrawingsGroupOpen = true;
    }
  });

  function getDrawingMeta(drawing: any) {
    const type = drawing.type || 'drawing';
    const anchors = Array.isArray(drawing.anchors) ? drawing.anchors : [];
    let priceStr = '';
    if (anchors.length > 0 && typeof anchors[0]?.price === 'number') {
      priceStr = `@ ${anchors[0].price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
    }

    switch (type) {
      case 'trendline':
        return { title: 'Garis Tren (Trendline)', icon: TrendingUp, subtitle: priceStr };
      case 'hline':
        return { title: 'Garis Horisontal (H-Line)', icon: MoveHorizontal, subtitle: priceStr };
      case 'hray':
        return { title: 'Sinar Horisontal (H-Ray)', icon: ArrowUpRight, subtitle: priceStr };
      case 'vline':
        return { title: 'Garis Vertikal', icon: Minus, subtitle: 'Time axis' };
      case 'fibonacci':
        return { title: 'Fibonacci Retracement', icon: SlidersHorizontal, subtitle: priceStr };
      case 'rectangle':
        return { title: 'Kotak (Rectangle)', icon: Square, subtitle: priceStr };
      case 'position':
        return { title: 'Posisi Long/Short', icon: TrendingUp, subtitle: priceStr };
      case 'text':
      case 'note':
      case 'callout':
        return {
          title: drawing.text?.content ? `Teks: "${drawing.text.content.slice(0, 16)}"` : 'Anotasi Teks',
          icon: Type,
          subtitle: priceStr
        };
      case 'pricelabel':
      case 'pricenote':
        return { title: 'Label Harga', icon: MoveHorizontal, subtitle: priceStr };
      default:
        return { title: drawing.name || drawing.type || 'Objek Gambar', icon: Layers, subtitle: priceStr };
    }
  }
</script>

<div class="sub-toolbar">
  <span class="sub-title">Unified Object Tree</span>
  <span class="layer-count mono-nums">{totalIndicatorsCount + activeDrawings.length} Total</span>
</div>

<div class="items-list objects-list">
  <!-- 1. GRUP INDIKATOR AKTIF -->
  <div class="tree-group">
    <div class="tree-group-header">
      <button
        type="button"
        class="tree-group-title clickable"
        onclick={() => (isIndicatorsGroupOpen = !isIndicatorsGroupOpen)}
        aria-expanded={isIndicatorsGroupOpen}
      >
        <span class="chevron-icon">
          {#if isIndicatorsGroupOpen}
            <ChevronDown size={13} />
          {:else}
            <ChevronRight size={13} />
          {/if}
        </span>
        <span>Indikator</span>
        <span class="group-count mono-nums">{totalIndicatorsCount}</span>
      </button>
    </div>

    {#if isIndicatorsGroupOpen}
      <div class="tree-group-content">
        <div class="layer-item">
          <div class="layer-info">
            <span class="layer-icon"><Layers size={13} /></span>
            <span class="layer-name" title="Volume (Native Overlay)">Volume (Native Overlay)</span>
          </div>

          <div class="layer-actions">
            <button
              type="button"
              class="icon-action-btn {showVolume ? 'visible' : 'hidden'}"
              title={showVolume ? 'Sembunyikan Volume' : 'Tampilkan Volume'}
              onclick={() => onToggleVolumeVisibility?.()}
            >
              {#if showVolume}
                <Eye size={12} />
              {:else}
                <EyeOff size={12} />
              {/if}
            </button>
          </div>
        </div>

        {#each activeIndicators as ind (ind.id)}
          <div class="layer-item">
            <div class="layer-info">
              <span class="layer-icon"><Layers size={13} /></span>
              <span class="layer-name" title={ind.title}>{ind.title}</span>
            </div>

            <div class="layer-actions">
              <button
                type="button"
                class="icon-action-btn"
                title="Pengaturan Parameter Indikator"
                onclick={() => onConfigureIndicator?.(ind.id)}
              >
                <Settings size={12} />
              </button>

              {#if ind.source || ind.id.includes('pine')}
                <button
                  type="button"
                  class="icon-action-btn pine-btn"
                  title="Buka Skrip di Pine IDE"
                  onclick={() => onOpenIndicatorInPine?.(ind.id, ind.source)}
                >
                  <Code size={12} />
                </button>
              {/if}

              <button
                type="button"
                class="icon-action-btn {ind.visible ? 'visible' : 'hidden'}"
                title={ind.visible ? 'Sembunyikan' : 'Tampilkan'}
                onclick={() => onToggleIndicatorVisibility?.(ind.id)}
              >
                {#if ind.visible}
                  <Eye size={12} />
                {:else}
                  <EyeOff size={12} />
                {/if}
              </button>

              <button
                type="button"
                class="icon-action-btn delete"
                title="Hapus Indikator"
                onclick={() => onRemoveIndicator?.(ind.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}

        {#if activeIndicators.length === 0 && !showVolume}
          <div class="empty-subgroup">
            <span>Tidak ada indikator aktif</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 2. GRUP TRADING PLAN -->
  <div class="tree-group">
    <div class="tree-group-header">
      <button
        type="button"
        class="tree-group-title clickable"
        onclick={() => (isPlansGroupOpen = !isPlansGroupOpen)}
        aria-expanded={isPlansGroupOpen}
      >
        <span class="chevron-icon">
          {#if isPlansGroupOpen}
            <ChevronDown size={13} />
          {:else}
            <ChevronRight size={13} />
          {/if}
        </span>
        <span>Trading Plan</span>
        <span class="group-count mono-nums">{scopedPlans.length}</span>
      </button>
    </div>

    {#if isPlansGroupOpen}
      <div class="tree-group-content">
        {#each scopedPlans as plan (plan.id)}
          {@const isBear = plan.bias === 'bearish'}
          {@const planTooltip = [
            `Trading Plan ${plan.bias?.toUpperCase()} (${plan.targets?.length || 0} TP)`,
            plan.reasons?.entry ? `Katalis Entry: ${plan.reasons.entry}` : null,
            plan.reasons?.stopLoss ? `Stop Loss: ${plan.reasons.stopLoss}` : null,
            plan.conclusion?.invalidationScenario ? `Invalidasi: ${plan.conclusion.invalidationScenario}` : null
          ].filter(Boolean).join('\n')}
          <div class="layer-item plan-layer-item" title={planTooltip}>
            <div class="layer-info">
              <span class="layer-icon {isBear ? 'text-pink' : 'text-emerald'}">
                <Sparkles size={13} />
              </span>
              <span class="layer-name">
                Plan {plan.bias?.toUpperCase()} ({plan.targets?.length || 0} TP)
              </span>
              {#if plan.conclusion?.probability}
                <span class="plan-prob-chip mono-nums">{plan.conclusion.probability}</span>
              {/if}
            </div>

            <div class="layer-actions">
              <button
                type="button"
                class="icon-action-btn edit"
                title="Edit Trade Plan di Panel Kanan"
                onclick={() => onEditPlan?.(plan.id)}
              >
                <Pencil size={12} />
              </button>

              <button
                type="button"
                class="icon-action-btn {showThesisCards ? 'visible' : 'hidden'}"
                title={showThesisCards ? 'Sembunyikan Kartu Tesis di Grafik' : 'Tampilkan Kartu Tesis di Grafik'}
                onclick={() => onToggleThesisCards?.()}
              >
                {#if showThesisCards}
                  <Eye size={12} />
                {:else}
                  <EyeOff size={12} />
                {/if}
              </button>

              <button
                type="button"
                class="icon-action-btn delete"
                title="Hapus Rencana Perdagangan Ini"
                onclick={() => onRemovePlan?.(plan.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}

        {#if scopedPlans.length === 0}
          <div class="empty-subgroup">
            <span>Tidak ada trading plan aktif</span>
            <button
              class="empty-action-link"
              type="button"
              onclick={() => onOpenPlanTab?.('form')}
            >
              + Buat Trade Plan
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 3. GRUP OBJEK GAMBAR (DRAWINGS) -->
  <div class="tree-group">
    <div class="tree-group-header">
      <button
        type="button"
        class="tree-group-title clickable"
        onclick={() => (isDrawingsGroupOpen = !isDrawingsGroupOpen)}
        aria-expanded={isDrawingsGroupOpen}
      >
        <span class="chevron-icon">
          {#if isDrawingsGroupOpen}
            <ChevronDown size={13} />
          {:else}
            <ChevronRight size={13} />
          {/if}
        </span>
        <span>Objek Gambar</span>
        <span class="group-count mono-nums">{activeDrawings.length}</span>
      </button>

      <div class="group-bulk-actions">
        <button
          type="button"
          class="bulk-action-btn"
          title="Sembunyikan / Tampilkan Semua Gambar"
          onclick={() => onBulkHideDrawings?.(activeDrawings.some((d) => d.visible !== false))}
        >
          <Eye size={11} />
        </button>
        <button
          type="button"
          class="bulk-action-btn"
          title="Kunci / Buka Semua Gambar"
          onclick={() => onBulkLockDrawings?.(activeDrawings.some((d) => !d.locked))}
        >
          <Lock size={11} />
        </button>
        <button
          type="button"
          class="bulk-action-btn delete"
          title="Hapus Semua Gambar"
          onclick={() => onBulkDeleteDrawings?.()}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>

    {#if isDrawingsGroupOpen}
      <div class="tree-group-content">
        {#each activeDrawings as drawing (drawing.id)}
          {@const meta = getDrawingMeta(drawing)}
          {@const isSelected = selectedDrawingId === drawing.id}
          {@const isVisible = drawing.visible !== false}
          {@const isLocked = drawing.locked === true}
          {@const IconComp = meta.icon}
          <div
            class="layer-item drawing-item {isSelected ? 'selected' : ''}"
            use:scrollIntoViewIfSelected={isSelected}
          >
            <button
              type="button"
              class="layer-select-btn"
              onclick={() => onSelectDrawing?.(drawing.id)}
            >
              <span class="layer-icon drawing-icon">
                <IconComp size={13} />
              </span>
              <span class="drawing-labels">
                <span class="layer-name">{meta.title}</span>
                {#if meta.subtitle}
                  <span class="layer-sub mono-nums">{meta.subtitle}</span>
                {/if}
              </span>
            </button>

            <div class="layer-actions">
              <button
                type="button"
                class="icon-action-btn {isVisible ? 'visible' : 'hidden'}"
                title={isVisible ? 'Sembunyikan Objek' : 'Tampilkan Objek'}
                onclick={() => onToggleDrawingVisibility?.(drawing.id)}
              >
                {#if isVisible}
                  <Eye size={12} />
                {:else}
                  <EyeOff size={12} />
                {/if}
              </button>

              <button
                type="button"
                class="icon-action-btn {isLocked ? 'locked' : ''}"
                title={isLocked ? 'Buka Kunci Objek' : 'Kunci Objek'}
                onclick={() => onToggleDrawingLock?.(drawing.id)}
              >
                {#if isLocked}
                  <Lock size={12} />
                {:else}
                  <Unlock size={12} />
                {/if}
              </button>

              <button
                type="button"
                class="icon-action-btn delete"
                title="Hapus Objek Gambar"
                onclick={() => onRemoveDrawing?.(drawing.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}

        {#if activeDrawings.length === 0}
          <div class="empty-subgroup">
            <span>Belum ada coretan gambar pada pair ini</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .sub-toolbar {
    padding: 6px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }

  .sub-title {
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .layer-count {
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
  }

  .objects-list {
    flex: 1;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    background-color: var(--bg-surface);
  }

  .tree-group {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .tree-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    user-select: none;
  }

  .tree-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-base, 11px);
    font-weight: 700;
    color: var(--text-main);
    background: transparent;
    border: none;
    padding: 0;
    text-align: left;
    flex: 1;
  }

  .tree-group-title.clickable {
    cursor: pointer;
  }

  .chevron-icon {
    display: flex;
    align-items: center;
    color: var(--text-dim);
  }

  .group-count {
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 8px;
    background-color: var(--bg-elevated);
    color: var(--text-dim);
  }

  .group-bulk-actions {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .bulk-action-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .bulk-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .bulk-action-btn.delete:hover {
    color: var(--status-danger);
  }

  .tree-group-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    transition: all 0.12s ease;
    gap: 4px;
  }

  .layer-item.drawing-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-medium);
  }

  .layer-item.drawing-item.selected {
    background-color: color-mix(in srgb, var(--bull-text) 10%, transparent);
    border-color: color-mix(in srgb, var(--bull-text) 45%, transparent);
  }

  .layer-select-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
    background: transparent;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }

  .layer-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .layer-icon {
    display: flex;
    align-items: center;
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .drawing-icon {
    color: var(--brand-blue);
  }

  .drawing-labels {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .layer-name {
    font-size: var(--font-size-base, 11px);
    color: var(--text-main);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-sub {
    font-size: var(--font-size-xs, 9px);
    color: var(--text-dim);
    line-height: 1;
  }

  .layer-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .icon-action-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    padding: 3px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .icon-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .icon-action-btn.pine-btn:hover {
    color: var(--brand-purple);
    background-color: color-mix(in srgb, var(--brand-purple) 15%, transparent);
  }

  .icon-action-btn.locked {
    color: var(--status-warn);
  }

  .icon-action-btn.edit:hover {
    color: var(--brand-cyan);
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
  }

  .icon-action-btn.delete:hover {
    color: var(--status-danger);
  }

  .empty-subgroup {
    padding: 12px 8px;
    text-align: center;
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
    font-style: italic;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .empty-action-link {
    background: transparent;
    border: none;
    color: var(--brand-cyan);
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-md);
    transition: background-color 0.15s ease;
  }

  .empty-action-link:hover {
    background: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
  }

  .plan-prob-chip {
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--brand-cyan) 15%, transparent);
    color: var(--brand-cyan);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 30%, transparent);
    margin-left: 4px;
  }

  .text-pink {
    color: var(--bear-color) !important;
  }

  .text-emerald {
    color: var(--bull-text) !important;
  }

  button:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }
</style>
