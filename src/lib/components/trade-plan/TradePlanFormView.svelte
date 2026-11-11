<script lang="ts">
  import {
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    Info,
    Plus,
    Trash2,
    X
  } from '@lucide/svelte';
  import {
    buildSymbolSuggestionList,
    normalizeInstrumentToken
  } from '../../services/instrumentIdentity';
  import type { ParsedTradingPlan } from '../../services/planParserService';
  import type { PlanFormDraft, PlanFormZoneDraft } from '../../services/tradePlanFormService';
  import type { ActiveTradingPlan, LivePlanEvaluation } from '../../services/tradingPlanLifecycle';
  import TradePlanContextZonesSection from './TradePlanContextZonesSection.svelte';
  import TradePlanNarrativeSection from './TradePlanNarrativeSection.svelte';

  interface Props {
    activeSymbol: string;
    availableSymbols?: string[];
    resolvedTargetSymbol?: string;
    isSymbolChangedWhileEditing?: boolean;
    isDifferentFromActiveChart?: boolean;
    scopedPlans: ActiveTradingPlan[];
    editingPlanId: string | null;
    editingPlan: ActiveTradingPlan | null;
    stackAsAdditional: boolean;
    hasCanvasConflict: boolean;
    deletedActiveNotice: boolean;
    formDraft: PlanFormDraft;
    formPreviewPlan: ParsedTradingPlan;
    liveMarketStatus: LivePlanEvaluation | null;
    hasCustomRiskPct: boolean;
    liveCalculatedRiskPctText: string;
    isContextZonesOpen: boolean;
    isNarrativeOpen: boolean;
    filledNarrativeCount: number;
    formatPrice: (val: number | null | undefined) => string;
    onSelectActivePlan: (planId: string) => void;
    onStartNewPlan: () => void;
    onReturnToActivePlan: () => void;
    onRemovePlan?: (planId: string) => void;
    onToggleStackAdditional: (checked: boolean) => void;
    onDismissDeletedNotice: () => void;
    onReloadFromCanvas: () => void;
    onDismissCanvasConflict: () => void;
    onPatchDraft: (patch: Partial<PlanFormDraft>) => void;
    onToggleEntryMode: (mode: 'single' | 'dual') => void;
    onDualWeightChange: (which: 'e1' | 'e2', value: string) => void;
    onSetCustomRiskPct: (enabled: boolean, value: string) => void;
    onAddTarget: () => void;
    onRemoveTarget: (index: number) => void;
    onUpdateTargetPrice: (index: number, price: string) => void;
    onUpdateTargetReason: (index: number, reason: string) => void;
    onToggleContextZones: () => void;
    onAddContextZone: () => void;
    onRemoveContextZone: (index: number) => void;
    onUpdateContextZone: (index: number, patch: Partial<PlanFormZoneDraft>) => void;
    onToggleNarrative: () => void;
  }

  let {
    activeSymbol,
    availableSymbols = [],
    resolvedTargetSymbol,
    isSymbolChangedWhileEditing = false,
    isDifferentFromActiveChart = false,
    scopedPlans,
    editingPlanId,
    editingPlan,
    stackAsAdditional,
    hasCanvasConflict,
    deletedActiveNotice,
    formDraft,
    formPreviewPlan,
    liveMarketStatus,
    hasCustomRiskPct,
    liveCalculatedRiskPctText,
    isContextZonesOpen,
    isNarrativeOpen,
    filledNarrativeCount,
    formatPrice,
    onSelectActivePlan,
    onStartNewPlan,
    onReturnToActivePlan,
    onRemovePlan,
    onToggleStackAdditional,
    onDismissDeletedNotice,
    onReloadFromCanvas,
    onDismissCanvasConflict,
    onPatchDraft,
    onToggleEntryMode,
    onDualWeightChange,
    onSetCustomRiskPct,
    onAddTarget,
    onRemoveTarget,
    onUpdateTargetPrice,
    onUpdateTargetReason,
    onToggleContextZones,
    onAddContextZone,
    onRemoveContextZone,
    onUpdateContextZone,
    onToggleNarrative,
  }: Props = $props();

  const symbolSuggestions = $derived.by(() =>
    buildSymbolSuggestionList([activeSymbol, editingPlan?.symbol], availableSymbols)
  );
</script>

<div class="plan-scroll-body">
  {#if scopedPlans.length > 0}
    <div class="active-plan-toolbar">
      {#if editingPlanId && scopedPlans.length > 1}
        <select
          class="plan-selector-select mono-nums"
          value={editingPlanId}
          onchange={(e) => onSelectActivePlan(e.currentTarget.value)}
          aria-label="Pilih plan aktif untuk diedit"
        >
          {#each scopedPlans as p, idx (p.id)}
            <option value={p.id}>
              #{idx + 1} {p.bias === 'bearish' ? 'SHORT' : 'LONG'} · E {formatPrice(p.entry)} ({p.targets?.length || 0} TP)
            </option>
          {/each}
        </select>
      {:else if editingPlanId && editingPlan}
        <span class="active-plan-pill mono-nums">
          <span class="status-dot {editingPlan.bias === 'bearish' ? 'bear' : 'bull'}"></span>
          <span>
            Edit Plan Aktif ({editingPlan.bias === 'bearish' ? 'SHORT' : 'LONG'} · {editingPlan.targets?.length || 0} TP)
          </span>
        </span>
      {:else}
        <span class="active-plan-pill new-mode">
          <span>Mode Plan Baru</span>
        </span>
      {/if}

      <div class="toolbar-mini-actions">
        {#if editingPlanId}
          <button
            type="button"
            class="mini-action-btn"
            title="Buat rencana trading baru"
            onclick={onStartNewPlan}
          >
            <Plus size={11} />
            <span>Plan Baru</span>
          </button>
          <button
            type="button"
            class="mini-action-btn danger"
            title="Hapus plan aktif ini dari chart"
            aria-label="Hapus plan aktif ini dari chart"
            onclick={() => onRemovePlan?.(editingPlanId!)}
          >
            <Trash2 size={11} />
          </button>
        {:else}
          <button
            type="button"
            class="mini-action-btn"
            title="Kembali mengedit plan yang aktif di chart"
            onclick={onReturnToActivePlan}
          >
            <span>Edit Plan Aktif ({scopedPlans.length})</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if !editingPlanId && scopedPlans.length > 0}
    <label class="stack-toggle-row">
      <input
        type="checkbox"
        checked={stackAsAdditional}
        onchange={(e) => onToggleStackAdditional(e.currentTarget.checked)}
      />
      <span>Tumpuk sebagai plan tambahan</span>
      <span class="stack-hint">
        {stackAsAdditional ? 'Ditambahkan ke chart' : 'Menggantikan plan lama di simbol ini'}
      </span>
    </label>
  {/if}

  {#if deletedActiveNotice}
    <div class="conflict-banner info">
      <div class="conflict-text">
        <Info size={12} />
        <span>Plan aktif dihapus dari chart; draf tetap dipertahankan.</span>
      </div>
      <button
        type="button"
        class="conflict-dismiss"
        onclick={onDismissDeletedNotice}
        aria-label="Tutup pemberitahuan"
      >
        <X size={11} />
      </button>
    </div>
  {/if}

  {#if hasCanvasConflict && editingPlan}
    <div class="conflict-banner warn" role="status">
      <div class="conflict-text">
        <AlertTriangle size={12} />
        <span>Level di chart berubah</span>
      </div>
      <div class="conflict-actions">
        <button
          type="button"
          class="btn-reload-canvas"
          onclick={onReloadFromCanvas}
        >
          Muat dari chart
        </button>
        <button
          type="button"
          class="conflict-dismiss"
          title="Abaikan perubahan chart dan pertahankan draf form"
          onclick={onDismissCanvasConflict}
          aria-label="Abaikan perubahan chart"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  {/if}

  <!-- Seksi Inti: Bias & Symbol (Dapat Diubah Manual) -->
  <div class="form-card">
    <div class="form-row-2col">
      <div class="field-group">
        <span class="field-label">Bias Arah</span>
        <div class="segmented-toggle" role="group" aria-label="Pilih Bias Arah">
          <button
            type="button"
            class="seg-btn bull {formDraft.bias === 'bullish' ? 'active' : ''}"
            onclick={() => onPatchDraft({ bias: 'bullish' })}
          >
            <ArrowUpRight size={12} />
            <span>LONG</span>
          </button>
          <button
            type="button"
            class="seg-btn bear {formDraft.bias === 'bearish' ? 'active' : ''}"
            onclick={() => onPatchDraft({ bias: 'bearish' })}
          >
            <ArrowDownRight size={12} />
            <span>SHORT</span>
          </button>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-symbol-input">
          <span>Symbol</span>
          {#if resolvedTargetSymbol && formDraft.symbol.trim() && normalizeInstrumentToken(formDraft.symbol) !== resolvedTargetSymbol}
            <button
              type="button"
              class="inline-reset-link mono-nums"
              title="Lengkapi menjadi pasangan penuh {resolvedTargetSymbol}"
              onclick={() => onPatchDraft({ symbol: resolvedTargetSymbol })}
            >
              → {resolvedTargetSymbol}
            </button>
          {/if}
        </label>
        <input
          id="tp-symbol-input"
          type="text"
          list="tp-form-symbol-suggestions"
          class="form-input symbol-input mono-nums"
          value={formDraft.symbol}
          placeholder={activeSymbol}
          aria-label="Symbol Instrumen Trade Plan"
          oninput={(e) => onPatchDraft({ symbol: e.currentTarget.value.toUpperCase() })}
          onblur={(e) => {
            const raw = e.currentTarget.value;
            const norm = normalizeInstrumentToken(raw);
            if (norm && norm !== raw) {
              onPatchDraft({ symbol: norm });
            } else if (!raw.trim()) {
              onPatchDraft({ symbol: editingPlan?.symbol || activeSymbol });
            }
          }}
        />
        <datalist id="tp-form-symbol-suggestions">
          {#each symbolSuggestions as sym (sym)}
            <option value={sym}></option>
          {/each}
        </datalist>
      </div>
    </div>

    {#if isSymbolChangedWhileEditing && editingPlan && resolvedTargetSymbol}
      <div class="conflict-banner info" role="status">
        <div class="conflict-text">
          <Info size={12} />
          <span>
            Target berpindah ke <strong>{resolvedTargetSymbol}</strong>. Setup <strong>{editingPlan.symbol || activeSymbol}</strong> lama tetap utuh.
          </span>
        </div>
      </div>
    {:else if isDifferentFromActiveChart && resolvedTargetSymbol}
      <div class="conflict-banner info" role="status">
        <div class="conflict-text">
          <Info size={12} />
          <span>
            Plan ini akan diterapkan ke <strong>{resolvedTargetSymbol}</strong> (berbeda dari chart aktif <strong>{activeSymbol}</strong>).
          </span>
        </div>
      </div>
    {/if}

    {#if liveMarketStatus}
      <div class="live-market-strip {liveMarketStatus.badgeClass} mono-nums">
        <span class="live-dot"></span>
        <span class="live-label">{liveMarketStatus.label}</span>
        <span class="live-diff">{liveMarketStatus.diffPctText}</span>
      </div>
    {/if}
  </div>

  <!-- Seksi Entry & Stop Loss -->
  <div class="form-card">
    <div class="section-header-inline">
      <span class="section-heading">Entry & Manajemen Risiko</span>
      <div class="mini-segmented" role="group" aria-label="Mode Entry">
        <button
          type="button"
          class="mini-seg-btn {formDraft.entryMode === 'single' ? 'active' : ''}"
          onclick={() => onToggleEntryMode('single')}
        >
          Single
        </button>
        <button
          type="button"
          class="mini-seg-btn {formDraft.entryMode === 'dual' ? 'active' : ''}"
          onclick={() => onToggleEntryMode('dual')}
        >
          Dual E1/E2
        </button>
      </div>
    </div>

    {#if formDraft.entryMode === 'single'}
      <div class="field-group">
        <label class="field-label" for="tp-entry-single">Harga Entry</label>
        <input
          id="tp-entry-single"
          type="text"
          inputmode="decimal"
          class="form-input mono-nums"
          value={formDraft.entry}
          placeholder="Contoh: 81200.0"
          oninput={(e) => onPatchDraft({ entry: e.currentTarget.value })}
        />
      </div>
    {:else}
      <div class="dual-entry-editor">
        <div class="dual-entry-row">
          <div class="field-group flex-2">
            <label class="field-label" for="tp-e1-price">Entry 1 (E1)</label>
            <input
              id="tp-e1-price"
              type="text"
              inputmode="decimal"
              class="form-input mono-nums"
              value={formDraft.e1Price}
              placeholder="Harga E1"
              oninput={(e) => onPatchDraft({ e1Price: e.currentTarget.value })}
            />
          </div>
          <div class="field-group w-weight">
            <label class="field-label" for="tp-e1-weight">Bobot %</label>
            <input
              id="tp-e1-weight"
              type="text"
              inputmode="decimal"
              class="form-input mono-nums"
              value={formDraft.e1WeightPct}
              oninput={(e) => onDualWeightChange('e1', e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="dual-entry-row">
          <div class="field-group flex-2">
            <label class="field-label" for="tp-e2-price">Entry 2 (E2)</label>
            <input
              id="tp-e2-price"
              type="text"
              inputmode="decimal"
              class="form-input mono-nums"
              value={formDraft.e2Price}
              placeholder="Harga E2"
              oninput={(e) => onPatchDraft({ e2Price: e.currentTarget.value })}
            />
          </div>
          <div class="field-group w-weight">
            <label class="field-label" for="tp-e2-weight">Bobot %</label>
            <input
              id="tp-e2-weight"
              type="text"
              inputmode="decimal"
              class="form-input mono-nums"
              value={formDraft.e2WeightPct}
              oninput={(e) => onDualWeightChange('e2', e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="blended-readout mono-nums">
          <span>Blended Entry:</span>
          <strong>{formatPrice(formPreviewPlan.entry)}</strong>
        </div>
      </div>
    {/if}

    <div class="form-row-2col">
      <div class="field-group">
        <label class="field-label" for="tp-sl-input">Stop Loss</label>
        <input
          id="tp-sl-input"
          type="text"
          inputmode="decimal"
          class="form-input mono-nums sl-input"
          value={formDraft.stopLoss}
          placeholder="Harga SL"
          oninput={(e) => onPatchDraft({ stopLoss: e.currentTarget.value })}
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-risk-pct-input">
          Risk %
          {#if hasCustomRiskPct}
            <button
              type="button"
              class="inline-reset-link"
              onclick={() => onSetCustomRiskPct(false, '')}
            >
              Auto
            </button>
          {/if}
        </label>
        <input
          id="tp-risk-pct-input"
          type="text"
          inputmode="decimal"
          class="form-input mono-nums"
          value={liveCalculatedRiskPctText}
          placeholder="Otomatis"
          oninput={(e) => {
            const val = e.currentTarget.value;
            onSetCustomRiskPct(Boolean(val.trim()), val);
          }}
        />
      </div>
    </div>

    <div class="risk-unit-strip mono-nums">
      <span>Jarak Risiko (1R):</span>
      <strong class="text-cyan">
        {formPreviewPlan.riskAmount > 0 ? formatPrice(formPreviewPlan.riskAmount) : '--'}
      </strong>
      {#if formPreviewPlan.riskPercent}
        <span class="risk-pct-badge">({formPreviewPlan.riskPercent}%)</span>
      {/if}
    </div>
  </div>

  <!-- Seksi Targets (TP1..TPn) -->
  <div class="form-card">
    <div class="section-header-inline">
      <span class="section-heading">Target Profit ({formDraft.targets.length})</span>
      <button
        type="button"
        class="btn-inline-add"
        onclick={onAddTarget}
      >
        <Plus size={11} />
        <span>Tambah TP</span>
      </button>
    </div>

    <div class="targets-editor-list">
      {#each formDraft.targets as tgt, idx (tgt.id + '_' + idx)}
        {@const previewTarget = formPreviewPlan.targets[idx]}
        <div class="target-edit-row">
          <span class="target-index-badge mono-nums">{tgt.label || `TP${idx + 1}`}</span>
          <input
            type="text"
            inputmode="decimal"
            class="form-input mono-nums tp-price-input"
            value={tgt.price}
            placeholder="Harga TP{idx + 1}"
            aria-label="Harga {tgt.label || `TP${idx + 1}`}"
            oninput={(e) => onUpdateTargetPrice(idx, e.currentTarget.value)}
          />
          <span class="live-r-badge mono-nums {previewTarget?.rMultiple && previewTarget.rMultiple > 0 ? 'positive' : ''}">
            {#if previewTarget && typeof previewTarget.rMultiple === 'number'}
              {previewTarget.rMultiple.toFixed(2)}R
              {#if previewTarget.rMultipleByEntry?.e1 !== undefined}
                <span class="sub-r-e1">({previewTarget.rMultipleByEntry.e1.toFixed(1)} E1)</span>
              {/if}
            {:else}
              --R
            {/if}
          </span>
          <button
            type="button"
            class="btn-row-remove"
            disabled={formDraft.targets.length <= 1}
            title={formDraft.targets.length <= 1 ? 'Minimal 1 target diperlukan' : 'Hapus target ini'}
            aria-label="Hapus {tgt.label || `TP${idx + 1}`}"
            onclick={() => onRemoveTarget(idx)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Sanity Guard Feedback (Error & Warnings) -->
  {#if !formPreviewPlan.validation.valid && (formDraft.entry || formDraft.e1Price || formDraft.stopLoss || formDraft.targets.some((t) => t.price))}
    <div class="sanity-box error">
      <div class="sanity-title">
        <AlertCircle size={12} />
        <span>Perlu Perbaikan Level</span>
      </div>
      <ul>
        {#each formPreviewPlan.validation.errors as err}
          <li>{err}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if formPreviewPlan.validation.warnings.length > 0}
    <div class="sanity-box warn">
      <div class="sanity-title">
        <AlertTriangle size={12} />
        <span>Peringatan Struktur</span>
      </div>
      <ul>
        {#each formPreviewPlan.validation.warnings as warn}
          <li>{warn}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <TradePlanContextZonesSection
    zones={formDraft.contextZones}
    isOpen={isContextZonesOpen}
    onToggleOpen={onToggleContextZones}
    onAddZone={onAddContextZone}
    onRemoveZone={onRemoveContextZone}
    onUpdateZone={onUpdateContextZone}
  />

  <TradePlanNarrativeSection
    draft={formDraft}
    isOpen={isNarrativeOpen}
    filledCount={filledNarrativeCount}
    onToggleOpen={onToggleNarrative}
    {onPatchDraft}
    {onUpdateTargetReason}
  />
</div>

<style>
  .plan-scroll-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .active-plan-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 5px 7px;
    background-color: color-mix(in srgb, var(--brand-cyan) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 22%, transparent);
    border-radius: var(--radius-md);
  }

  .plan-selector-select {
    flex: 1;
    min-width: 0;
    background-color: var(--bg-base);
    color: var(--text-main);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    padding: 3px 5px;
  }

  .active-plan-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-main);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-plan-pill.new-mode {
    color: var(--status-warn);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot.bull {
    background-color: var(--bull-text);
  }

  .status-dot.bear {
    background-color: var(--bear-color);
  }

  .toolbar-mini-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .mini-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--brand-cyan);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .mini-action-btn:hover {
    border-color: color-mix(in srgb, var(--brand-cyan) 45%, transparent);
    background-color: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
  }

  .mini-action-btn.danger {
    color: var(--text-dim);
  }

  .mini-action-btn.danger:hover {
    color: var(--status-danger);
    border-color: color-mix(in srgb, var(--status-danger) 35%, transparent);
    background-color: color-mix(in srgb, var(--status-danger) 10%, transparent);
  }

  .stack-toggle-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background-color: color-mix(in srgb, var(--status-warn) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-warn) 25%, transparent);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-main);
    cursor: pointer;
  }

  .stack-hint {
    font-size: var(--font-size-sm);
    color: var(--text-dim);
    margin-left: auto;
  }

  .conflict-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 8px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .conflict-banner.warn {
    background-color: color-mix(in srgb, var(--status-warn) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-warn) 35%, transparent);
    color: var(--status-warn);
  }

  .conflict-banner.info {
    background-color: color-mix(in srgb, var(--brand-cyan) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 28%, transparent);
    color: var(--brand-cyan);
  }

  .conflict-text {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
  }

  .conflict-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-reload-canvas {
    padding: 2px 7px;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--status-warn) 45%, transparent);
    background-color: color-mix(in srgb, var(--status-warn) 18%, transparent);
    color: var(--status-warn);
    font-size: var(--font-size-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .btn-reload-canvas:hover {
    background-color: color-mix(in srgb, var(--status-warn) 28%, transparent);
  }

  .conflict-dismiss {
    background: none;
    border: none;
    border-radius: var(--radius-xs);
    color: inherit;
    opacity: 0.75;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .conflict-dismiss:hover {
    opacity: 1;
  }

  .form-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .form-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .flex-2 {
    flex: 2;
  }

  .w-weight {
    width: 66px;
    flex-shrink: 0;
  }

  .field-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .symbol-input {
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .inline-reset-link {
    background: none;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--brand-cyan);
    font-size: var(--font-size-xs);
    font-weight: 700;
    cursor: pointer;
    padding: 0 2px;
  }

  .form-input {
    width: 100%;
    box-sizing: border-box;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-base);
    padding: 5px 7px;
    transition: border-color 0.12s ease;
  }

  .form-input:focus {
    border-color: var(--border-focus);
  }

  .plan-selector-select:focus-visible,
  .mini-action-btn:focus-visible,
  .btn-reload-canvas:focus-visible,
  .conflict-dismiss:focus-visible,
  .seg-btn:focus-visible,
  .mini-seg-btn:focus-visible,
  .inline-reset-link:focus-visible,
  .form-input:focus-visible,
  .btn-inline-add:focus-visible,
  .btn-row-remove:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .sl-input {
    color: var(--bear-color);
  }

  .segmented-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .seg-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .seg-btn.bull.active {
    background-color: color-mix(in srgb, var(--bull-color) 18%, transparent);
    color: var(--bull-text);
  }

  .seg-btn.bear.active {
    background-color: color-mix(in srgb, var(--bear-color) 16%, transparent);
    color: var(--bear-color);
  }

  .live-market-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 7px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-hairline);
  }

  .live-market-strip.status-tp {
    color: var(--bull-text);
    border-color: color-mix(in srgb, var(--bull-text) 30%, transparent);
    background-color: color-mix(in srgb, var(--bull-color) 10%, transparent);
  }

  .live-market-strip.status-sl {
    color: var(--status-danger);
    border-color: color-mix(in srgb, var(--status-danger) 30%, transparent);
    background-color: color-mix(in srgb, var(--status-danger) 8%, transparent);
  }

  .live-market-strip.status-running {
    color: var(--brand-cyan);
    border-color: color-mix(in srgb, var(--brand-cyan) 30%, transparent);
    background-color: color-mix(in srgb, var(--brand-cyan) 8%, transparent);
  }

  .live-market-strip.status-waiting {
    color: var(--status-warn);
    border-color: color-mix(in srgb, var(--status-warn) 30%, transparent);
    background-color: color-mix(in srgb, var(--status-warn) 8%, transparent);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: currentColor;
    flex-shrink: 0;
  }

  .live-diff {
    margin-left: auto;
    opacity: 0.9;
  }

  .section-header-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .section-heading {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mini-segmented {
    display: flex;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    padding: 1px;
    gap: 2px;
  }

  .mini-seg-btn {
    border: none;
    background: transparent;
    color: var(--text-dim);
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .mini-seg-btn.active {
    background-color: color-mix(in srgb, var(--brand-cyan) 16%, transparent);
    color: var(--brand-cyan);
  }

  .dual-entry-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dual-entry-row {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }

  .blended-readout,
  .risk-unit-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 7px;
    background-color: var(--bg-elevated);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-dim);
  }

  .blended-readout strong {
    color: var(--text-main);
    margin-left: auto;
  }

  .risk-unit-strip strong {
    margin-left: auto;
  }

  .text-cyan {
    color: var(--brand-cyan);
  }

  .risk-pct-badge {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .btn-inline-add {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    background-color: color-mix(in srgb, var(--brand-cyan) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 28%, transparent);
    border-radius: var(--radius-md);
    color: var(--brand-cyan);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-inline-add:hover {
    background-color: color-mix(in srgb, var(--brand-cyan) 20%, transparent);
  }

  .targets-editor-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .target-edit-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .target-index-badge {
    font-size: var(--font-size-sm);
    font-weight: 700;
    padding: 3px 5px;
    min-width: 32px;
    text-align: center;
    border-radius: var(--radius-sm);
    background-color: color-mix(in srgb, var(--bull-color) 14%, transparent);
    color: var(--bull-text);
    border: 1px solid color-mix(in srgb, var(--bull-text) 28%, transparent);
    flex-shrink: 0;
  }

  .tp-price-input {
    flex: 1;
    min-width: 0;
    color: var(--bull-text);
  }

  .live-r-badge {
    font-size: var(--font-size-sm);
    font-weight: 700;
    padding: 3px 6px;
    border-radius: var(--radius-md);
    background-color: var(--bg-elevated);
    color: var(--text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .live-r-badge.positive {
    background-color: color-mix(in srgb, var(--bull-color) 16%, transparent);
    color: var(--bull-text);
  }

  .sub-r-e1 {
    font-size: var(--font-size-2xs);
    opacity: 0.85;
    margin-left: 2px;
  }

  .btn-row-remove {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-dim);
    padding: 4px;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-row-remove:hover:not(:disabled) {
    color: var(--status-danger);
    background-color: color-mix(in srgb, var(--status-danger) 12%, transparent);
  }

  .btn-row-remove:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sanity-box {
    border-radius: var(--radius-md);
    padding: 7px 9px;
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

  .sanity-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .sanity-box ul {
    margin: 0;
    padding-left: 16px;
    line-height: 1.4;
  }
</style>
