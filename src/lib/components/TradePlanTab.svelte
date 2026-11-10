<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Sparkles, FileText, History, Check, Bell, RotateCcw } from '@lucide/svelte';
  import {
    parseTradingPlan,
    formatPlanPrice,
    type ParsedTradingPlan,
    type ZonePolarity
  } from '../services/planParserService';
  import {
    SAMPLE_MARKDOWN_PLAN,
    buildParsedPlanFromFormDraft,
    computePlanFingerprint,
    createEmptyPlanFormDraft,
    finalizePlanFromTabSubmission,
    hasCustomRiskPercent,
    planToFormDraft,
    resolveSubModeTransition,
    serializeTradingPlanToMarkdown,
    type ApplyPlanFromTabOptions,
    type PlanFormDraft,
    type PlanFormZoneDraft,
    type TradePlanActivationRequest,
    type TradePlanTabSubMode,
    type UpdatePlanFromTabOptions
  } from '../services/tradePlanFormService';
  import {
    loadTradingPlanHistory,
    deleteTradingPlanFromHistory,
    clearTradingPlanHistory
  } from '../services/persistence';
  import { alertService } from '../services/alertService';
  import { commandDispatcher } from '../services/commandDispatcher';
  import { isSameSymbol } from '../services/instrumentIdentity';
  import { type ActiveTradingPlan } from '../services/tradingPlanLifecycle';
  import type { SavedTradingPlanRecord } from '../types/market';
  import TradePlanFormView from './trade-plan/TradePlanFormView.svelte';
  import TradePlanTextView from './trade-plan/TradePlanTextView.svelte';
  import TradePlanVaultView from './trade-plan/TradePlanVaultView.svelte';

  export type {
    TradePlanTabSubMode,
    TradePlanActivationRequest,
    ApplyPlanFromTabOptions,
    UpdatePlanFromTabOptions
  };

  interface Props {
    isActive?: boolean;
    activeSymbol?: string;
    currentPrice?: number | null;
    tickSize?: number;
    activePlans?: ActiveTradingPlan[];
    activationRequest?: TradePlanActivationRequest | null;
    onApplyPlan: (plan: ParsedTradingPlan, options?: ApplyPlanFromTabOptions) => Promise<any> | any;
    onUpdatePlan: (planId: string, plan: ParsedTradingPlan, options?: UpdatePlanFromTabOptions) => Promise<any> | any;
    onRemovePlan?: (planId: string) => void;
    onConsumeActivation?: (nonce: number) => void;
    onLog?: (msg: string, level?: 'info' | 'success' | 'warn') => void;
  }

  let {
    isActive = true,
    activeSymbol = 'BTCUSDT',
    currentPrice = null,
    tickSize,
    activePlans = [],
    activationRequest = null,
    onApplyPlan,
    onUpdatePlan,
    onRemovePlan,
    onConsumeActivation,
    onLog,
  }: Props = $props();

  import { evaluatePlanMarketStatus } from '../services/tradingPlanLifecycle';

  let subMode = $state<TradePlanTabSubMode>('form');
  let editingPlanId = $state<string | null>(null);
  let isExplicitNewMode = $state(false);
  let stackAsAdditional = $state(false);
  let formDraft = $state<PlanFormDraft>(createEmptyPlanFormDraft('BTCUSDT'));
  let textBuffer = $state('');
  let lastEditedSource = $state<'form' | 'text' | null>(null);
  let isDirty = $state(false);
  let isAlertToggleDirty = $state(false);
  let hasCustomRiskPct = $state(false);
  let autoCreateAlerts = $state(true);

  let loadedPlanFingerprint = $state<string | null>(null);
  let hasCanvasConflict = $state(false);
  let deletedActiveNotice = $state(false);

  let isContextZonesOpen = $state(false);
  let isNarrativeOpen = $state(false);

  let historyRecords = $state<SavedTradingPlanRecord[]>([]);
  let isLoadingHistory = $state(false);
  let historyFilterMode = $state<'active_symbol' | 'all'>('active_symbol');
  let copyFeedback = $state(false);
  let isSubmitting = $state(false);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  let lastTrackedSymbol = '';
  let lastHandledActivationNonce = 0;
  let hasInitializedMount = false;
  let unsubAlerts: (() => void) | null = null;
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const scopedPlans = $derived.by<ActiveTradingPlan[]>(() =>
    activePlans.filter((p) => !p.symbol || isSameSymbol(p.symbol, activeSymbol))
  );

  const editingPlan = $derived.by<ActiveTradingPlan | null>(() => {
    if (!editingPlanId) return null;
    return activePlans.find((p) => p.id === editingPlanId) || null;
  });

  const effectiveFormDraft = $derived.by<PlanFormDraft>(() =>
    hasCustomRiskPct ? formDraft : { ...formDraft, riskPercent: '' }
  );

  const formPreviewPlan = $derived.by<ParsedTradingPlan>(() =>
    buildParsedPlanFromFormDraft(effectiveFormDraft)
  );

  const liveCalculatedRiskPctText = $derived.by<string>(() => {
    if (hasCustomRiskPct) return formDraft.riskPercent;
    if (typeof formPreviewPlan.riskPercent === 'number' && !isNaN(formPreviewPlan.riskPercent) && formPreviewPlan.riskPercent > 0) {
      return String(formPreviewPlan.riskPercent);
    }
    return '';
  });

  const textPreviewPlan = $derived.by<ParsedTradingPlan>(() => parseTradingPlan(textBuffer));

  const activePreviewPlan = $derived<ParsedTradingPlan>(
    subMode === 'text' ? textPreviewPlan : formPreviewPlan
  );

  const liveMarketStatus = $derived.by(() =>
    evaluatePlanMarketStatus(activePreviewPlan, currentPrice, activeSymbol)
  );

  const filledNarrativeCount = $derived.by(() => {
    let count = 0;
    if (formDraft.setupStatus.trim()) count++;
    if (formDraft.confluenceScore.trim()) count++;
    if (formDraft.probability.trim()) count++;
    if (formDraft.probabilityNotes.trim()) count++;
    if (formDraft.definition.trim()) count++;
    if (formDraft.invalidationScenario.trim()) count++;
    if (formDraft.entryReason.trim()) count++;
    if (formDraft.stopLossReason.trim()) count++;
    if (formDraft.targets.some((t) => t.reason.trim())) count++;
    return count;
  });

  const filteredHistory = $derived.by<SavedTradingPlanRecord[]>(() => {
    if (historyFilterMode === 'all' || !activeSymbol) return historyRecords;
    return historyRecords.filter((rec) => isSameSymbol(rec.symbol, activeSymbol));
  });

  function formatPrice(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val) || val <= 0) return '--';
    return formatPlanPrice(val);
  }

  function formatTimestamp(ts: number): string {
    if (!ts) return '--';
    try {
      return new Date(ts).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return new Date(ts).toISOString();
    }
  }

  async function refreshHistory() {
    isLoadingHistory = true;
    try {
      const list = await loadTradingPlanHistory();
      historyRecords = Array.isArray(list) ? list : [];
    } catch {
      historyRecords = [];
    } finally {
      isLoadingHistory = false;
    }
  }

  function loadActivePlanIntoDraft(plan: ActiveTradingPlan) {
    editingPlanId = plan.id;
    isExplicitNewMode = false;
    stackAsAdditional = false;
    formDraft = planToFormDraft(plan, activeSymbol);
    textBuffer = plan.rawText || serializeTradingPlanToMarkdown(plan);
    hasCustomRiskPct = hasCustomRiskPercent(plan);
    autoCreateAlerts = alertService.hasActiveAlertsForPlan(plan.id);
    isDirty = false;
    isAlertToggleDirty = false;
    lastEditedSource = null;
    hasCanvasConflict = false;
    deletedActiveNotice = false;
    loadedPlanFingerprint = computePlanFingerprint(plan);
    if (formDraft.contextZones.length > 0) {
      isContextZonesOpen = true;
    }
  }

  function resetDraftToNewEmpty(targetSymbol = activeSymbol) {
    editingPlanId = null;
    formDraft = createEmptyPlanFormDraft(targetSymbol);
    textBuffer = '';
    hasCustomRiskPct = false;
    autoCreateAlerts = true;
    isDirty = false;
    isAlertToggleDirty = false;
    lastEditedSource = null;
    hasCanvasConflict = false;
    deletedActiveNotice = false;
    loadedPlanFingerprint = null;
    isContextZonesOpen = false;
  }

  function markFormDirty() {
    isDirty = true;
    lastEditedSource = 'form';
  }

  function patchFormDraft(patch: Partial<PlanFormDraft>) {
    formDraft = { ...formDraft, ...patch };
    markFormDirty();
  }

  function applyExternalActivation(req: TradePlanActivationRequest) {
    subMode = req.subMode || 'form';

    if (req.initialText && req.initialText.trim()) {
      editingPlanId = null;
      isExplicitNewMode = true;
      textBuffer = req.initialText;
      const parsed = parseTradingPlan(req.initialText);
      formDraft = planToFormDraft(parsed, activeSymbol);
      hasCustomRiskPct = hasCustomRiskPercent(parsed);
      autoCreateAlerts = true;
      isDirty = true;
      isAlertToggleDirty = false;
      lastEditedSource = 'text';
      hasCanvasConflict = false;
      deletedActiveNotice = false;
      loadedPlanFingerprint = null;
      if (formDraft.contextZones.length > 0) {
        isContextZonesOpen = true;
      }
      if (subMode === 'text') {
        tick().then(() => textareaEl?.focus());
      }
      return;
    }

    if (req.planId) {
      const target =
        scopedPlans.find((p) => p.id === req.planId) ||
        activePlans.find((p) => p.id === req.planId);
      if (target) {
        loadActivePlanIntoDraft(target);
        return;
      }
    }

    if (subMode === 'history') {
      void refreshHistory();
      return;
    }

    if (scopedPlans.length > 0) {
      loadActivePlanIntoDraft(scopedPlans[0]);
    } else {
      isExplicitNewMode = false;
      resetDraftToNewEmpty(activeSymbol);
    }
  }

  onMount(() => {
    void refreshHistory();
    unsubAlerts = alertService.subscribe(() => {
      if (editingPlanId && !isAlertToggleDirty) {
        autoCreateAlerts = alertService.hasActiveAlertsForPlan(editingPlanId);
      }
    });
  });

  onDestroy(() => {
    unsubAlerts?.();
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }
  });

  // Ikat shortcut Ctrl/Cmd+Enter melalui CommandDispatcher SSOT saat editor aktif dan valid
  $effect(() => {
    if (!isActive || subMode === 'history' || !activePreviewPlan.validation.valid || isSubmitting) {
      return;
    }
    return commandDispatcher.bindHandler('commit-trade-plan', () => {
      void handleCommit();
      return true;
    });
  });

  // Sinkronisasi aktivasi eksternal, perpindahan simbol, dan perubahan level dari kanvas
  $effect(() => {
    const curSym = activeSymbol;
    const plansSnapshot = scopedPlans;
    const req = activationRequest;

    if (!hasInitializedMount || curSym !== lastTrackedSymbol) {
      hasInitializedMount = true;
      lastTrackedSymbol = curSym;
      if (req && req.nonce > 0 && req.nonce !== lastHandledActivationNonce) {
        lastHandledActivationNonce = req.nonce;
        applyExternalActivation(req);
        queueMicrotask(() => onConsumeActivation?.(req.nonce));
      } else if (plansSnapshot.length > 0) {
        loadActivePlanIntoDraft(plansSnapshot[0]);
      } else {
        isExplicitNewMode = false;
        resetDraftToNewEmpty(curSym);
      }
      return;
    }

    if (req && req.nonce > 0 && req.nonce !== lastHandledActivationNonce) {
      lastHandledActivationNonce = req.nonce;
      applyExternalActivation(req);
      queueMicrotask(() => onConsumeActivation?.(req.nonce));
      return;
    }

    if (editingPlanId) {
      const currentPlan = plansSnapshot.find((p) => p.id === editingPlanId);
      if (!currentPlan) {
        if (!isDirty) {
          if (plansSnapshot.length > 0) {
            loadActivePlanIntoDraft(plansSnapshot[0]);
          } else {
            isExplicitNewMode = false;
            resetDraftToNewEmpty(curSym);
          }
        } else {
          editingPlanId = null;
          isExplicitNewMode = true;
          loadedPlanFingerprint = null;
          hasCanvasConflict = false;
          deletedActiveNotice = true;
        }
        return;
      }

      const nextFp = computePlanFingerprint(currentPlan);
      if (loadedPlanFingerprint !== null && nextFp !== loadedPlanFingerprint) {
        if (!isDirty) {
          loadActivePlanIntoDraft(currentPlan);
        } else {
          hasCanvasConflict = true;
        }
      }
    } else if (!isExplicitNewMode && !isDirty && plansSnapshot.length > 0) {
      loadActivePlanIntoDraft(plansSnapshot[0]);
    }
  });

  function handleSwitchSubMode(nextMode: TradePlanTabSubMode) {
    const transition = resolveSubModeTransition({
      currentSubMode: subMode,
      nextSubMode: nextMode,
      lastEditedSource,
      textBuffer,
      formPreviewPlan,
      currentFormSymbol: formDraft.symbol,
      activeSymbol
    });

    if (transition.nextTextBuffer !== undefined) textBuffer = transition.nextTextBuffer;
    if (transition.nextFormDraft !== undefined) formDraft = transition.nextFormDraft;
    if (transition.nextHasCustomRiskPct !== undefined) hasCustomRiskPct = transition.nextHasCustomRiskPct;
    if (transition.shouldOpenContextZones) isContextZonesOpen = true;
    if (transition.shouldCloseContextZones) isContextZonesOpen = false;

    subMode = transition.nextSubMode;

    if (transition.shouldRefreshHistory) {
      void refreshHistory();
    }
    if (transition.shouldFocusTextArea) {
      tick().then(() => textareaEl?.focus());
    }
  }

  function handleToggleEntryMode(mode: 'single' | 'dual') {
    if (formDraft.entryMode === mode) return;
    const nextPatch: Partial<PlanFormDraft> = { entryMode: mode };
    if (mode === 'dual') {
      if (!formDraft.e1Price.trim() && !formDraft.e2Price.trim() && formDraft.entry.trim()) {
        nextPatch.e1Price = formDraft.entry.trim();
      }
    } else if (!formDraft.entry.trim()) {
      if (formPreviewPlan.entry > 0) {
        nextPatch.entry = String(formPreviewPlan.entry);
      } else if (formDraft.e1Price.trim()) {
        nextPatch.entry = formDraft.e1Price.trim();
      }
    }
    patchFormDraft(nextPatch);
  }

  function handleDualWeightChange(which: 'e1' | 'e2', rawValue: string) {
    const cleaned = parseFloat(rawValue);
    const companion =
      !isNaN(cleaned) && cleaned >= 0 && cleaned <= 100
        ? String(parseFloat((100 - cleaned).toFixed(2)))
        : undefined;

    if (which === 'e1') {
      patchFormDraft({
        e1WeightPct: rawValue,
        ...(companion !== undefined ? { e2WeightPct: companion } : {})
      });
    } else {
      patchFormDraft({
        e2WeightPct: rawValue,
        ...(companion !== undefined ? { e1WeightPct: companion } : {})
      });
    }
  }

  function handleAddTarget() {
    const nextNum = formDraft.targets.length + 1;
    patchFormDraft({
      targets: [...formDraft.targets, { id: `tp${nextNum}`, label: `TP${nextNum}`, price: '', reason: '' }]
    });
  }

  function handleRemoveTarget(index: number) {
    if (formDraft.targets.length <= 1) return;
    const filtered = formDraft.targets.filter((_, i) => i !== index);
    patchFormDraft({
      targets: filtered.map((t, idx) => ({
        ...t,
        id: `tp${idx + 1}`,
        label: /^TP\d+$/i.test(t.label.trim()) || !t.label.trim() ? `TP${idx + 1}` : t.label
      }))
    });
  }

  function handleAddContextZone() {
    isContextZonesOpen = true;
    const defaultPolarity: ZonePolarity = formDraft.bias === 'bearish' ? 'bear' : 'bull';
    const nextId = `zone_${Date.now()}_${formDraft.contextZones.length + 1}`;
    patchFormDraft({
      contextZones: [
        ...formDraft.contextZones,
        {
          id: nextId,
          label: defaultPolarity === 'bear' ? 'Bearish FVG' : 'Bullish FVG',
          polarity: defaultPolarity,
          low: '',
          high: '',
          kind: 'FVG'
        }
      ]
    });
  }

  function handleUpdateContextZone(index: number, patch: Partial<PlanFormZoneDraft>) {
    patchFormDraft({
      contextZones: formDraft.contextZones.map((z, i) => (i === index ? { ...z, ...patch } : z))
    });
  }

  async function handleCommit() {
    if (isSubmitting || !activePreviewPlan.validation.valid) return;

    isSubmitting = true;
    try {
      const targetSymbolHint = editingPlanId && editingPlan ? editingPlan.symbol || activeSymbol : activeSymbol;
      const { plan: finalPlan } = finalizePlanFromTabSubmission({
        subMode,
        textBuffer,
        effectiveFormDraft,
        previewPlan: activePreviewPlan,
        activeSymbol: targetSymbolHint,
        chartTickSize: tickSize,
        currentPrice
      });

      if (!finalPlan.validation.valid) {
        onLog?.('Validasi Trade Plan gagal sebelum diterapkan.', 'warn');
        return;
      }

      if (editingPlanId && editingPlan) {
        const res = await onUpdatePlan(editingPlanId, finalPlan, { autoCreateAlerts });
        const updatedPlan: ActiveTradingPlan = res?.plan || {
          ...finalPlan,
          id: res?.planId || editingPlanId,
          symbol: finalPlan.symbol || activeSymbol
        };
        loadActivePlanIntoDraft(updatedPlan);
      } else {
        const replaceExistingOnSymbol = scopedPlans.length > 0 && !stackAsAdditional;
        const res = await onApplyPlan(finalPlan, {
          autoCreateAlerts,
          isFromHistory: false,
          replaceExistingOnSymbol
        });
        if (res?.plan) {
          loadActivePlanIntoDraft(res.plan);
        } else {
          isDirty = false;
          isAlertToggleDirty = false;
          isExplicitNewMode = false;
        }
      }

      await refreshHistory();
    } finally {
      isSubmitting = false;
    }
  }

  async function handlePasteFromClipboard() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          textBuffer = text;
          lastEditedSource = 'text';
          isDirty = true;
          copyFeedback = true;
          if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
          copyFeedbackTimer = setTimeout(() => {
            copyFeedback = false;
            copyFeedbackTimer = null;
          }, 1200);
        }
      }
    } catch {
      onLog?.('Akses clipboard tidak tersedia di lingkungan ini.', 'warn');
    }
  }

  function handleOpenTextInForm() {
    lastEditedSource = 'text';
    handleSwitchSubMode('form');
  }

  function handleLoadVaultRecordToForm(rec: SavedTradingPlanRecord) {
    if (!rec?.plan) return;
    const matchingActive =
      scopedPlans.find((p) => p.id === rec.id) || activePlans.find((p) => p.id === rec.id);

    if (matchingActive) {
      loadActivePlanIntoDraft(matchingActive);
    } else {
      editingPlanId = null;
      isExplicitNewMode = true;
      stackAsAdditional = false;
      formDraft = planToFormDraft(rec.plan, rec.symbol || activeSymbol);
      textBuffer = rec.rawText || rec.plan.rawText || serializeTradingPlanToMarkdown(rec.plan);
      hasCustomRiskPct = hasCustomRiskPercent(rec.plan);
      autoCreateAlerts = true;
      isDirty = true;
      isAlertToggleDirty = false;
      lastEditedSource = 'form';
      hasCanvasConflict = false;
      deletedActiveNotice = false;
      loadedPlanFingerprint = null;
      if (formDraft.contextZones.length > 0) {
        isContextZonesOpen = true;
      }
    }
    subMode = 'form';
  }

  async function handleReplotFromHistory(rec: SavedTradingPlanRecord, withAlerts = false) {
    if (!rec?.plan) return;
    const res = await onApplyPlan(
      {
        ...rec.plan,
        symbol: rec.symbol || rec.plan.symbol || activeSymbol,
        timeframe: rec.timeframe || rec.plan.timeframe
      } as ParsedTradingPlan,
      {
        autoCreateAlerts: withAlerts,
        isFromHistory: true,
        savedRecord: rec,
        replaceExistingOnSymbol: false
      }
    );
    if (res?.plan) {
      loadActivePlanIntoDraft(res.plan);
      subMode = 'form';
    }
  }
</script>

<div class="trade-plan-tab">
  <div class="plan-submode-bar" role="tablist" aria-label="Mode Trade Plan">
    <button
      type="button"
      role="tab"
      aria-selected={subMode === 'form'}
      class="submode-btn {subMode === 'form' ? 'active' : ''}"
      onclick={() => handleSwitchSubMode('form')}
    >
      <Sparkles size={11} />
      <span>Form</span>
    </button>

    <button
      type="button"
      role="tab"
      aria-selected={subMode === 'text'}
      class="submode-btn {subMode === 'text' ? 'active' : ''}"
      onclick={() => handleSwitchSubMode('text')}
    >
      <FileText size={11} />
      <span>Teks</span>
    </button>

    <button
      type="button"
      role="tab"
      aria-selected={subMode === 'history'}
      class="submode-btn {subMode === 'history' ? 'active' : ''}"
      onclick={() => handleSwitchSubMode('history')}
    >
      <History size={11} />
      <span>Riwayat</span>
      {#if historyRecords.length > 0}
        <span class="submode-count mono-nums">{historyRecords.length}</span>
      {/if}
    </button>
  </div>

  {#if subMode === 'form'}
    <TradePlanFormView
      {activeSymbol}
      {scopedPlans}
      {editingPlanId}
      {editingPlan}
      {stackAsAdditional}
      {hasCanvasConflict}
      {deletedActiveNotice}
      {formDraft}
      {formPreviewPlan}
      {liveMarketStatus}
      {hasCustomRiskPct}
      {liveCalculatedRiskPctText}
      {isContextZonesOpen}
      {isNarrativeOpen}
      {filledNarrativeCount}
      {formatPrice}
      onSelectActivePlan={(planId) => {
        const found = scopedPlans.find((p) => p.id === planId);
        if (found) {
          isExplicitNewMode = false;
          loadActivePlanIntoDraft(found);
        }
      }}
      onStartNewPlan={() => {
        isExplicitNewMode = true;
        stackAsAdditional = false;
        resetDraftToNewEmpty(activeSymbol);
        subMode = 'form';
      }}
      onReturnToActivePlan={() => {
        if (scopedPlans.length === 0) return;
        isExplicitNewMode = false;
        loadActivePlanIntoDraft(scopedPlans[0]);
        subMode = 'form';
      }}
      {onRemovePlan}
      onToggleStackAdditional={(checked) => (stackAsAdditional = checked)}
      onDismissDeletedNotice={() => (deletedActiveNotice = false)}
      onReloadFromCanvas={() => editingPlan && loadActivePlanIntoDraft(editingPlan)}
      onDismissCanvasConflict={() => {
        if (editingPlan) loadedPlanFingerprint = computePlanFingerprint(editingPlan);
        hasCanvasConflict = false;
      }}
      onPatchDraft={patchFormDraft}
      onToggleEntryMode={handleToggleEntryMode}
      onDualWeightChange={handleDualWeightChange}
      onSetCustomRiskPct={(enabled, val) => {
        hasCustomRiskPct = enabled;
        patchFormDraft({ riskPercent: val });
      }}
      onAddTarget={handleAddTarget}
      onRemoveTarget={handleRemoveTarget}
      onUpdateTargetPrice={(idx, price) => {
        patchFormDraft({
          targets: formDraft.targets.map((t, i) => (i === idx ? { ...t, price } : t))
        });
      }}
      onUpdateTargetReason={(idx, reason) => {
        patchFormDraft({
          targets: formDraft.targets.map((t, i) => (i === idx ? { ...t, reason } : t))
        });
      }}
      onToggleContextZones={() => (isContextZonesOpen = !isContextZonesOpen)}
      onAddContextZone={handleAddContextZone}
      onRemoveContextZone={(idx) => {
        patchFormDraft({ contextZones: formDraft.contextZones.filter((_, i) => i !== idx) });
      }}
      onUpdateContextZone={handleUpdateContextZone}
      onToggleNarrative={() => (isNarrativeOpen = !isNarrativeOpen)}
    />
  {:else if subMode === 'text'}
    <TradePlanTextView
      {activeSymbol}
      {textBuffer}
      {textPreviewPlan}
      {copyFeedback}
      bind:textareaEl
      {formatPrice}
      onTextChange={(val) => {
        textBuffer = val;
        lastEditedSource = 'text';
        isDirty = true;
      }}
      onPasteFromClipboard={handlePasteFromClipboard}
      onLoadSampleText={() => {
        textBuffer = SAMPLE_MARKDOWN_PLAN;
        lastEditedSource = 'text';
        isDirty = true;
      }}
      onOpenTextInForm={handleOpenTextInForm}
      onClearTextBuffer={() => {
        textBuffer = '';
        lastEditedSource = 'text';
        isDirty = true;
      }}
    />
  {:else}
    <TradePlanVaultView
      {activeSymbol}
      {currentPrice}
      {historyRecords}
      {filteredHistory}
      {historyFilterMode}
      {isLoadingHistory}
      {formatPrice}
      {formatTimestamp}
      onChangeFilter={(mode) => (historyFilterMode = mode)}
      onClearAllHistory={async () => {
        await clearTradingPlanHistory();
        historyRecords = [];
      }}
      onReplot={handleReplotFromHistory}
      onLoadToForm={handleLoadVaultRecordToForm}
      onDelete={async (id) => {
        historyRecords = await deleteTradingPlanFromHistory(id);
      }}
    />
  {/if}

  {#if subMode !== 'history'}
    <div class="plan-sticky-footer">
      <label class="alert-toggle-row">
        <input
          type="checkbox"
          checked={autoCreateAlerts}
          onchange={(e) => {
            autoCreateAlerts = e.currentTarget.checked;
            isAlertToggleDirty = true;
          }}
        />
        <Bell size={11} class={autoCreateAlerts ? 'text-cyan' : 'text-dim'} />
        <span>Alert Otomatis (Entry, SL & TP)</span>
      </label>

      <div class="footer-action-row">
        <button
          type="button"
          class="btn-reset"
          disabled={isSubmitting || (!isDirty && !isAlertToggleDirty && Boolean(editingPlanId))}
          onclick={() => (editingPlan ? loadActivePlanIntoDraft(editingPlan) : resetDraftToNewEmpty(activeSymbol))}
          title="Kembalikan nilai draf"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <button
          type="button"
          class="btn-apply {activePreviewPlan.bias === 'bearish' ? 'bear' : 'bull'}"
          disabled={!activePreviewPlan.validation.valid || isSubmitting}
          onclick={handleCommit}
          title={activePreviewPlan.validation.valid ? 'Terapkan ke Chart (Ctrl+Enter)' : 'Lengkapi level valid terlebih dahulu'}
        >
          <Check size={13} />
          <span>{editingPlanId ? 'Terapkan Perubahan' : 'Terapkan ke Chart'}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .trade-plan-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background-color: var(--bg-surface);
    color: var(--text-main);
  }

  .plan-submode-bar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    padding: 6px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .submode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .submode-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .submode-btn.active {
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan) 35%, transparent);
    color: var(--brand-cyan);
  }

  .submode-count {
    font-size: var(--font-size-xs);
    padding: 0 4px;
    border-radius: var(--radius-sm);
    background-color: var(--bg-elevated);
    color: var(--text-dim);
  }

  .submode-btn.active .submode-count {
    background-color: color-mix(in srgb, var(--brand-cyan) 22%, transparent);
    color: var(--brand-cyan);
  }

  .submode-btn:focus-visible,
  .btn-reset:focus-visible,
  .btn-apply:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .plan-sticky-footer {
    flex-shrink: 0;
    padding: 8px;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .alert-toggle-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
  }

  :global(.text-cyan) {
    color: var(--brand-cyan);
  }

  :global(.text-dim) {
    color: var(--text-dim);
  }

  .footer-action-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 9px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-reset:hover:not(:disabled) {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .btn-reset:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-apply {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 10px;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.12s ease;
  }

  .btn-apply.bull {
    background-color: var(--bull-color);
    color: var(--on-bull-color, #0F0F0F);
  }

  .btn-apply.bear {
    background-color: var(--bear-color);
    color: var(--on-bear-color, #0F0F0F);
  }

  .btn-apply:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .btn-apply:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
