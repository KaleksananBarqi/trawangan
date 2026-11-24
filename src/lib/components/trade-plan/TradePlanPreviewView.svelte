<script lang="ts">
  import {
    ShieldAlert,
    Target,
    Zap,
    Info,
    Layers,
    Pencil,
    Copy,
    Check,
    Trash2,
    Plus,
    Sparkles,
    Activity
  } from '@lucide/svelte';
  import { formatPlanPrice, type ParsedTradingPlan } from '../../services/planParserService';
  import { serializeTradingPlanToMarkdown } from '../../services/tradePlanFormService';
  import {
    buildThesisPresentationModel,
    type EpistemicTextSegment
  } from '../../services/thesisOverlayEngine';
  import {
    evaluatePlanMarketStatus,
    type ActiveTradingPlan
  } from '../../services/tradingPlanLifecycle';
  import { t } from '../../i18n';

  interface Props {
    activeSymbol: string;
    currentPrice?: number | null;
    scopedPlans: ActiveTradingPlan[];
    selectedPlanId: string | null;
    previewDraftPlan?: ParsedTradingPlan | null;
    onSelectPlan: (planId: string) => void;
    onEditInForm: (planId?: string) => void;
    onStartNewPlan: () => void;
    onRemovePlan?: (planId: string) => void;
  }

  let {
    activeSymbol,
    currentPrice = null,
    scopedPlans = [],
    selectedPlanId = null,
    previewDraftPlan = null,
    onSelectPlan,
    onEditInForm,
    onStartNewPlan,
    onRemovePlan
  }: Props = $props();

  let copiedMd = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  const activePlan = $derived.by<ActiveTradingPlan | null>(() => {
    if (scopedPlans.length === 0) return null;
    if (selectedPlanId) {
      const found = scopedPlans.find((p) => p.id === selectedPlanId);
      if (found) return found;
    }
    return scopedPlans[0];
  });

  const displayPlan = $derived.by<(ParsedTradingPlan & { id?: string; symbol?: string }) | null>(() => {
    if (activePlan) return activePlan;
    if (previewDraftPlan && previewDraftPlan.validation.valid) return previewDraftPlan;
    return null;
  });

  const vm = $derived.by(() => {
    if (!displayPlan) return null;
    return buildThesisPresentationModel(displayPlan, {
      variant: 'side-panel',
      formatPrice: (p) => formatPlanPrice(p ?? undefined)
    });
  });

  const liveStatus = $derived.by(() => {
    if (!displayPlan) return null;
    return evaluatePlanMarketStatus(displayPlan, currentPrice, displayPlan.symbol || activeSymbol);
  });

  async function handleCopyMarkdown() {
    if (!displayPlan) return;
    const md = displayPlan.rawText?.trim() || serializeTradingPlanToMarkdown(displayPlan);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md);
        copiedMd = true;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          copiedMd = false;
          copyTimer = null;
        }, 1600);
      }
    } catch (_) {}
  }
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

<div class="docked-thesis-preview custom-scroll">
  {#if scopedPlans.length > 1}
    <div class="plan-switcher-strip" role="tablist" aria-label="Pilih Plan Aktif">
      {#each scopedPlans as p, idx (p.id)}
        {@const isSelected = activePlan?.id === p.id}
        <button
          type="button"
          class="plan-pill {isSelected ? 'active' : ''} {p.bias === 'bearish' ? 'bear' : 'bull'}"
          onclick={() => onSelectPlan(p.id)}
        >
          <span class="pill-dot"></span>
          <span class="mono-nums">#{idx + 1} {p.bias === 'bearish' ? 'SHORT' : 'LONG'}</span>
        </button>
      {/each}
      <button
        type="button"
        class="plan-pill add-btn"
        title={$t('plan.newPlan')}
        onclick={onStartNewPlan}
      >
        <Plus size={11} />
      </button>
    </div>
  {/if}

  {#if displayPlan && vm}
    <!-- Action Toolbar -->
    <div class="preview-toolbar">
      <div class="toolbar-sym mono-nums">
        <Sparkles size={12} class="text-cyan" />
        <span class="sym-text">{displayPlan.symbol || activeSymbol}</span>
        {#if !activePlan}
          <span class="draft-chip">DRAFT</span>
        {/if}
      </div>

      <div class="toolbar-actions">
        <button
          type="button"
          class="action-chip edit"
          onclick={() => onEditInForm(activePlan?.id)}
          title={$t('plan.editInForm')}
        >
          <Pencil size={11} />
          <span>{$t('plan.editBtn')}</span>
        </button>

        <button
          type="button"
          class="action-chip"
          onclick={handleCopyMarkdown}
          title={$t('plan.copyMarkdown')}
        >
          {#if copiedMd}
            <Check size={11} class="text-bull" />
            <span>{$t('common.copied')}</span>
          {:else}
            <Copy size={11} />
            <span>MD</span>
          {/if}
        </button>

        <button
          type="button"
          class="action-chip"
          onclick={onStartNewPlan}
          title={$t('plan.newPlan')}
        >
          <Plus size={11} />
        </button>

        {#if activePlan && onRemovePlan}
          <button
            type="button"
            class="action-chip danger"
            onclick={() => onRemovePlan(activePlan.id)}
            title={$t('plan.deletePlan')}
          >
            <Trash2 size={11} />
          </button>
        {/if}
      </div>
    </div>

    <!-- Live Market Distance Strip -->
    {#if liveStatus}
      <div class="live-status-banner {liveStatus.badgeClass}">
        <div class="status-left">
          <Activity size={12} />
          <span class="status-lbl">{liveStatus.label}</span>
        </div>
        <span class="status-diff mono-nums">{liveStatus.diffPctText}</span>
      </div>
    {/if}

    <!-- Docked Thesis Surface Card -->
    <div class="thesis-card-surface">
      <div class="thesis-card-header">
        <div class="badges-wrap">
          <span class="bias-tag {vm.isBearish ? 'bearish' : 'bullish'}">
            {vm.header.biasLabel}
          </span>
          {#if vm.header.probabilityBadge}
            <span class="prob-tag">{vm.header.probabilityBadge.fullText}</span>
          {/if}
          {#if vm.header.setupStatusBadge}
            <span class="status-tag mono-nums">{vm.header.setupStatusBadge}</span>
          {/if}
          {#if vm.header.confluenceBadge}
            <span class="conf-tag mono-nums">{vm.header.confluenceBadge.shortText}</span>
          {/if}
        </div>
      </div>

      {#if vm.definition}
        <div class="definition-banner">
          <Info size={12} class="def-icon" />
          <span class="def-text">{vm.definition}</span>
        </div>
      {/if}

      <!-- Entry & Context Zones -->
      <div class="thesis-section entry-section">
        <div class="section-title-row">
          <span class="section-icon"><Zap size={12} /></span>
          <span class="section-label">{vm.entrySection.title}</span>
          <span class="price-val mono-nums {vm.isBearish ? 'bearish' : 'bullish'}">
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

      <!-- Stop Loss & Invalidation -->
      <div class="thesis-section sl-section">
        <div class="section-title-row">
          <span class="section-icon sl"><ShieldAlert size={12} /></span>
          <span class="section-label">{vm.invalidationSection.title}</span>
          <span class="price-val mono-nums sl">{vm.invalidationSection.formattedStopLoss}</span>
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

      <!-- Take Profit Targets -->
      <div class="thesis-section tp-section">
        <div class="section-title-row">
          <span class="section-icon tp"><Target size={12} /></span>
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

      <!-- Risk & Probability Summary -->
      {#if vm.riskFooter}
        <div class="thesis-section risk-summary-section">
          {#if vm.riskFooter.formattedRiskAmount}
            <div class="risk-meta-row mono-nums">
              <span class="meta-lbl">Unit Risiko (1R):</span>
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
  {:else}
    <!-- Empty State -->
    <div class="empty-preview-box">
      <div class="empty-icon-wrap">
        <Sparkles size={22} />
      </div>
      <h4 class="empty-title">{$t('plan.emptyPreviewTitle')}</h4>
      <p class="empty-desc">{$t('plan.emptyPreviewDesc')}</p>
      <div class="empty-actions">
        <button type="button" class="btn-create-plan" onclick={onStartNewPlan}>
          <Plus size={13} />
          <span>{$t('plan.createFirstPlan')}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .docked-thesis-preview {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .plan-switcher-strip {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .plan-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: var(--radius-sm, 5px);
    background: var(--bg-elevated);
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .plan-pill .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .plan-pill.bull.active {
    background: color-mix(in srgb, var(--bull-color) 14%, transparent);
    border-color: color-mix(in srgb, var(--bull-color) 42%, transparent);
    color: var(--bull-color);
  }

  .plan-pill.bear.active {
    background: color-mix(in srgb, var(--bear-color) 14%, transparent);
    border-color: color-mix(in srgb, var(--bear-color) 42%, transparent);
    color: var(--bear-color);
  }

  .plan-pill.add-btn {
    padding: 4px 6px;
  }

  .preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-panel);
    border-radius: var(--radius-md, 6px);
  }

  .toolbar-sym {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .draft-chip {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--status-warn) 18%, transparent);
    color: var(--status-warn);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    border-radius: var(--radius-sm, 5px);
    background: var(--bg-elevated);
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .action-chip:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .action-chip.edit {
    color: var(--brand-cyan);
    background: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
  }

  .action-chip.danger:hover {
    color: var(--status-danger);
    background: color-mix(in srgb, var(--status-danger) 16%, transparent);
  }

  .live-status-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: var(--radius-md, 6px);
    font-size: 11px;
    font-weight: 600;
    background: var(--bg-elevated);
    border: 1px solid transparent;
  }

  .live-status-banner.status-tp {
    background: color-mix(in srgb, var(--bull-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--bull-color) 35%, transparent);
    color: var(--bull-color);
  }

  .live-status-banner.status-sl {
    background: color-mix(in srgb, var(--bear-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--bear-color) 35%, transparent);
    color: var(--bear-color);
  }

  .live-status-banner.status-active,
  .live-status-banner.status-zone {
    background: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan) 35%, transparent);
    color: var(--brand-cyan);
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-diff {
    font-size: 10.5px;
    opacity: 0.9;
  }

  .thesis-card-surface {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 11px;
    background: var(--chart-thesis-bg, var(--bg-panel));
    border-radius: var(--radius-lg, 8px);
  }

  .thesis-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badges-wrap {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
  }

  .bias-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .bias-tag.bearish {
    background: var(--chart-thesis-bear-glow, rgba(255, 105, 180, 0.16));
    color: var(--chart-thesis-bear, var(--bear-color));
    border: 1px solid var(--chart-thesis-bear, var(--bear-color));
  }

  .bias-tag.bullish {
    background: var(--chart-thesis-bull-glow, rgba(0, 255, 136, 0.16));
    color: var(--chart-thesis-bull, var(--bull-color));
    border: 1px solid var(--chart-thesis-bull, var(--bull-color));
  }

  .prob-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan);
  }

  .status-tag,
  .conf-tag {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--status-warn) 14%, transparent);
    color: var(--status-warn);
  }

  .definition-banner {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 8px 10px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--brand-cyan) 9%, transparent);
    border-left: 2.5px solid var(--brand-cyan);
    font-size: 11px;
    line-height: 1.45;
    color: var(--chart-thesis-text, var(--text-main));
  }

  :global(.def-icon) {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--brand-cyan);
  }

  .thesis-section {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 9px 10px;
    border-radius: 6px;
    background: var(--bg-container);
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-icon {
    display: inline-flex;
    color: var(--brand-cyan);
  }

  .section-icon.sl {
    color: var(--bear-color);
  }

  .section-icon.tp {
    color: var(--bull-color);
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    flex: 1;
  }

  .price-val {
    font-size: 12px;
    font-weight: 700;
  }

  .price-val.bullish {
    color: var(--bull-color);
  }

  .price-val.bearish,
  .price-val.sl {
    color: var(--bear-color);
  }

  .entry-levels-container,
  .zones-container {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .entry-level-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border-radius: 5px;
    font-size: 10.5px;
    background: var(--bg-elevated);
  }

  .level-lbl {
    color: var(--text-muted);
    font-weight: 600;
  }

  .level-price {
    color: var(--text-main);
    font-weight: 700;
  }

  .level-weight {
    color: var(--brand-cyan);
    font-size: 9.5px;
  }

  .zone-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    background: var(--bg-elevated);
    color: var(--text-muted);
  }

  .zone-pill.bullish {
    color: var(--bull-color);
    background: color-mix(in srgb, var(--bull-color) 11%, transparent);
  }

  .zone-pill.bearish {
    color: var(--bear-color);
    background: color-mix(in srgb, var(--bear-color) 11%, transparent);
  }

  .reason-text,
  .target-reason,
  .prob-notes {
    font-size: 11px;
    line-height: 1.48;
    color: var(--chart-thesis-text, var(--text-main));
  }

  .epistemic-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    padding: 0 4px;
    margin: 0 2px;
    border-radius: 3px;
    letter-spacing: 0.03em;
  }

  .epistemic-badge.fakta {
    background: rgba(0, 255, 136, 0.14);
    color: #00ff88;
  }

  .epistemic-badge.inferensi {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
  }

  .epistemic-badge.spekulasi {
    background: rgba(245, 158, 11, 0.16);
    color: #f59e0b;
  }

  .invalidation-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 8px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--bear-color) 9%, transparent);
    border: 1px dashed color-mix(in srgb, var(--bear-color) 35%, transparent);
    font-size: 10.5px;
  }

  .inv-badge {
    font-size: 9px;
    font-weight: 800;
    color: var(--bear-color);
    letter-spacing: 0.04em;
  }

  .targets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .target-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 8px;
    border-radius: 5px;
    background: var(--bg-elevated);
  }

  .target-item-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-badge {
    font-size: 10px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--bull-color) 15%, transparent);
    color: var(--bull-color);
  }

  .target-price {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
    flex: 1;
  }

  .r-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--bull-color) 14%, transparent);
    color: var(--bull-color);
  }

  .r-badge.sl-r-badge {
    background: color-mix(in srgb, var(--bear-color) 14%, transparent);
    color: var(--bear-color);
  }

  .r-sub {
    opacity: 0.8;
    font-size: 9px;
    margin-left: 3px;
  }

  .risk-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
  }

  .meta-lbl {
    color: var(--text-muted);
  }

  .meta-val {
    font-weight: 700;
    color: var(--text-main);
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .risk-pct-badge {
    font-size: 9.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--bg-elevated);
    color: var(--brand-cyan);
  }

  .empty-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 36px 18px;
    gap: 10px;
    color: var(--text-muted);
  }

  .empty-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--brand-cyan) 12%, transparent);
    color: var(--brand-cyan);
  }

  .empty-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .empty-desc {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.5;
    max-width: 260px;
  }

  .btn-create-plan {
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--radius-md, 6px);
    background: var(--brand-primary);
    color: var(--on-brand-primary, #0F0F0F);
    border: none;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
