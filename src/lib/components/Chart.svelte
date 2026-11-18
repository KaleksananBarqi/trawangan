<script module lang="ts">
  import type { SnapshotThesisLayout } from '../types/market';

  /**
   * Handle sempit untuk operasi view/DOM khusus milik Chart.svelte
   * (di luar kontroler sesi ChartSessionController).
   */
  export interface ChartViewHandle {
    getLastHoveredPrice(): number | null;
    getChartScreenshotCanvas(
      scope?: 'active' | 'all',
      thesisLayout?: SnapshotThesisLayout
    ): HTMLCanvasElement | null;
    openChartSettings(section?: string): void;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import './chart.css';
  import { Scissors, Bell, X, WifiOff, Edit3 } from '@lucide/svelte';
  import { ChartSessionController } from '../services/chartSessionController';
  import { chartDrawingController, isSameSymbol, type GestureCreationState } from '../services/chartDrawingController';
  import { priceScaleOverlayController } from '../services/priceScaleOverlayController';
  import { alertService } from '../services/alertService';
  import { dedupeByKey } from '../utils/dedupeByKey';
  import { dataWindowService } from '../services/dataWindowService';
  import { marketFeed } from '../services/market';
  import { replaySession } from '../services/replay';
  import { getTimeframeDurationMs } from '../services/replay/historicalRange';
  import { findNearestOhlcPoint } from '../services/priceSnapService';
  import { isEditableElement } from '../services/commandDispatcher';
  import { isTradingPlanText } from '../services/planParserService';
  import {
    renderScreenshotCanvasWithOverlay,
    resolveSecurityWatermarkText
  } from '../services/chartSnapshotService';
  import { THEME_PRESETS, resolveThemeConfig } from '../constants/themes';
  import ChartContextMenu from './ChartContextMenu.svelte';
  import FloatingThesisCard from './FloatingThesisCard.svelte';
  import RangePresetBar from './RangePresetBar.svelte';
  import type {
    Timeframe, ActiveIndicatorInfo, DrawingToolType, MultiChartSyncConfig,
    Candle, StrategyPerformanceSummary, PriceAlert, ThemePresetId,
    CustomChartBackgroundConfig, UserProfileConfig, SecurityWatermarkConfig,
    CustomThemePalette, GridMode
  } from '../types/market';
  import type { PriceScaleBadge } from '../services/priceScaleLabelService';
  import type { FeedConnectionStatus } from '../services/market/types';

  export interface ReplayStateInfo {
    active: boolean; playing: boolean; cursorTime: number | null;
    remaining: number; bounds: { first: number; last: number } | null;
  }

  interface Props {
    symbol: string; timeframe: Timeframe; defaultTimeframe?: Timeframe; layout: string;
    providerId?: string; syncConfig?: MultiChartSyncConfig; showWatermark?: boolean;
    showCurrentPriceLine?: boolean; showPriceScaleCountdown?: boolean; showVolume?: boolean; showIndicatorPriceLabels?: boolean; showDrawingPriceLabels?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe; providerId?: string }) => void;
    onPriceStyleChange?: (style: string) => void;
    onReplayStateChange?: (state: ReplayStateInfo) => void;
    onCutoffSelected?: (timestamp: number) => void; onCutoffCancelled?: () => void;
    onStrategyUpdate?: (summary: StrategyPerformanceSummary) => void;
    onRequestCreateAlert?: (symbol: string, price: number) => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
    onOpenTradePlanPaste?: (initialText?: string) => void;
    onEditPlan?: (planId: string) => void;
    onVelaThemeSelect?: (mode: 'dark' | 'light') => void;
    onPersistableStateChange?: (reason: string) => void;
    onSessionStateChange?: (state: { session: 'regular' | 'extended'; sessionAvailable: boolean }) => void;
    themePreset?: ThemePresetId | string; fontSize?: number; timezone?: string;
    marketSession?: 'regular' | 'extended';
    workspaceId?: string | null;
    gridMode?: GridMode;
    customPalette?: CustomThemePalette | null;
    customBullColor?: string; customBearColor?: string;
    customChartBackground?: CustomChartBackgroundConfig;
    securityWatermark?: SecurityWatermarkConfig;
    userProfile?: UserProfileConfig;
    sessionController?: ChartSessionController | null;
  }

  let {
    symbol, timeframe, defaultTimeframe = '15m', layout, providerId = 'binance',
    themePreset = 'signature', fontSize = 12, timezone = 'Asia/Jakarta',
    marketSession = 'regular',
    workspaceId = 'default_workspace', gridMode = 'normal',
    customPalette, customBullColor, customBearColor, customChartBackground,
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    showWatermark = true, showCurrentPriceLine = true, showPriceScaleCountdown = false, showVolume = true, showIndicatorPriceLabels = true,
    showDrawingPriceLabels = true, onActiveIndicatorsChange, onActiveCellChange,
    onPriceStyleChange,
    onCutoffCancelled, onRequestCreateAlert, onRequestEditAlert, onOpenTradePlanPaste,
    onEditPlan, onVelaThemeSelect, onPersistableStateChange, onSessionStateChange, securityWatermark, userProfile,
    sessionController = $bindable<ChartSessionController | null>(null),
  }: Props = $props();

  let chartContainer: HTMLDivElement | null = $state(null);
  let isMounted = $state(false);

  const controller = new ChartSessionController({
    symbol, timeframe, defaultTimeframe, layout, providerId, themePreset,
    fontSize, timezone, session: marketSession, gridMode, customPalette: customPalette || undefined, customBullColor, customBearColor, customChartBackground,
    showCurrentPriceLine, showPriceScaleCountdown, showVolume, showWatermark, syncConfig, onActiveCellChange,
    onPriceStyleChange,
    onActiveIndicatorsChange: (indicators) => {
      priceScaleOverlayController.updateIndicators(indicators, showIndicatorPriceLabels);
      onActiveIndicatorsChange?.(indicators);
    },
    onVelaThemeSelect, onPersistableStateChange
  });
  sessionController = controller;

  /**
   * Mengekspos instance ChartSessionController bertipe ketat untuk pemanggil shell (#217)
   */
  export function getSessionController(): ChartSessionController {
    return controller;
  }

  let feedConnectionStatus = $state(marketFeed.getConnectionStatus());
  let isDismissedConnectionWarning = $state(false);
  let isSelectingCutoff = $state(false);
  let lastLoadedWorkspaceId = $state<string | null>(null);
  let lastHoveredPrice = $state<number | null>(null);
  let cutlineX = $state<number | null>(null);
  let cutlineY = $state<number | null>(null);
  let hoveredBarDateText = $state('');
  let hoveredBarPriceText = $state('');
  let snappedBarTime = $state<number | null>(null);
  let isSkippingToEnd = false;
  let isLoadingHistoricalContext = false;
  let isHandpullActive = $state(false);
  let isGestureActive = $state(false);
  let gestureCreationState = $state<GestureCreationState | null>(null);
  let gestureInkCanvas: HTMLCanvasElement | null = $state(null);
  let isDrawingGestureStroke = $state(false);
  let isContextMenuOpen = $state(false);
  let contextMenuX = $state(0), contextMenuY = $state(0);
  let contextMenuPrice = $state<number | null>(null), contextMenuTime = $state<number | null>(null);

  let allAlerts = $state<PriceAlert[]>([]);
  let activeSymbolAlerts = $derived.by(() => {
    return dedupeByKey(
      allAlerts.filter((a) => isSameSymbol(a.symbol, symbol)),
      (a) => a.id
    );
  });
  let draggingAlertId = $state<string | null>(null);
  let draggingAlertPrice = $state<number | null>(null);
  let overlayTick = $state(0);
  let alertYPositions = $state<Record<string, number | null>>({});
  let drawingBadgeYPositions = $state<Record<string, number | null>>({});
  let indicatorBadgeYPositions = $state<Record<string, number | null>>({});
  let drawingPriceBadges = $state<PriceScaleBadge[]>([]);
  let indicatorPriceBadges = $state<PriceScaleBadge[]>([]);
  let activePlans = $state<Array<any>>([]);
  let showThesisCards = $state(true);
  let scopedActivePlans = $derived(
    dedupeByKey(
      activePlans.filter((p) => !p.symbol || isSameSymbol(p.symbol, symbol)),
      (p) => p.id
    )
  );

  let unsubAlerts: (() => void) | null = null;
  let unsubController: (() => void) | null = null;
  let unsubDrawingState: (() => void) | null = null;
  let unsubDrawingDraft: (() => void) | null = null;
  let unsubAttachWorkspace: (() => void) | null = null;
  let unsubAttachOverlay: (() => void) | null = null;
  let unsubAttachDataWindow: (() => void) | null = null;
  let unsubOverlay: (() => void) | null = null;
  let unsubFeedConnection: (() => void) | null = null;
  let unsubReplayEvents: Array<() => void> = [];
  let dblClickPaneCaptureTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPointerClientY: number | null = null;
  let currentActiveDrawingTool: DrawingToolType | null = null;
  let lastRawActivePlansRef: Array<any> | null = null;
  let lastRawThesisGeometriesRef: Record<string, any> | null = null;

  function scheduleBadgePositionUpdate() { priceScaleOverlayController.scheduleUpdate(); }

  function handleChartWrapperPointerDown(e: PointerEvent) {
    lastPointerClientY = e.clientY;
    scheduleBadgePositionUpdate();
  }

  function handleChartWrapperPointerMove(e: PointerEvent) {
    lastPointerClientY = e.clientY;
    // Saat drawing tool aktif digambar ATAU handle posisi Long/Short di mode 'cursor' sedang digeser,
    // pembaruan posisi badge sudah dijadwalkan oleh subscribeDraft() sekali per rAF.
    if (
      e.buttons > 0 &&
      !chartDrawingController.isDraftInteractionActive() &&
      (currentActiveDrawingTool === null ||
        currentActiveDrawingTool === 'cursor' ||
        currentActiveDrawingTool === 'handpull' ||
        currentActiveDrawingTool === 'measure')
    ) {
      scheduleBadgePositionUpdate();
    }
  }

  function handleChartWrapperPointerUp() {
    chartDrawingController.clearDraftInteractionState();
    priceScaleOverlayController.scheduleContinuousSync(200);
    controller.capturePaneLayoutIfChanged();
  }
  function formatPrice(p: number | null): string { return priceScaleOverlayController.formatPrice(p); }
  function getPriceY(p: number | null): number | null {
    // Konsumsi overlayTick agar Svelte 5 me-recompute pemanggilan getPriceY saat viewport/skala harga berubah
    void overlayTick;
    return p !== null ? priceScaleOverlayController.getPriceY(p) : null;
  }

  let prevOverlaySymbol: string | null = null;
  let prevOverlayTimeframe: Timeframe | null = null;
  let prevShowDrawingLabels: boolean | null = null;
  let prevShowIndicatorLabels: boolean | null = null;
  let prevOverlayAlerts: PriceAlert[] | null = null;
  let prevOverlayPlans: Array<any> | null = null;

  // Satu efek rekonsiliasi terpadu untuk seluruh prop reaktif: mencegah 19 efek terpecah dan membatasi mutasi engine secara idempoten (#217)
  $effect(() => {
    const mounted = isMounted;
    const s = symbol;
    const p = providerId;
    const tf = timeframe;
    const l = layout;
    const sc = syncConfig;
    const wsId = workspaceId || 'default_workspace';
    const gm = gridMode;
    const tp = themePreset;
    const fs = fontSize;
    const cb = customBullColor;
    const cr = customBearColor;
    const cp = customPalette;
    const tz = timezone;
    const ms = marketSession;
    const bg = customChartBackground;
    const showDrawingLabels = showDrawingPriceLabels;
    const pl = showCurrentPriceLine;
    const cd = showPriceScaleCountdown;
    const alerts = allAlerts;
    const v = showVolume;
    const wm = showWatermark;
    const showIndLabels = showIndicatorPriceLabels;
    const plans = scopedActivePlans;

    untrack(() => {
      chartDrawingController.setWorkspaceId(wsId);
      if (!mounted) {
        lastLoadedWorkspaceId = wsId;
        return;
      }

      controller.applyReactiveProps({
        symbol: s,
        providerId: p,
        timeframe: tf,
        layout: l,
        syncConfig: sc,
        gridMode: gm,
        themePreset: tp,
        fontSize: fs,
        customBullColor: cb,
        customBearColor: cr,
        customPalette: cp !== undefined ? cp : null,
        customChartBackground: bg,
        timezone: tz,
        session: ms,
        showCurrentPriceLine: pl,
        priceScaleCountdown: cd,
        showVolume: v,
        showWatermark: wm,
      });

      if (lastLoadedWorkspaceId !== null && lastLoadedWorkspaceId !== wsId && !controller.isRestoring()) {
        chartDrawingController.restoreDrawings(s, tf, p, wsId).catch(() => {});
      }
      lastLoadedWorkspaceId = wsId;

      if (prevOverlaySymbol !== null && s !== prevOverlaySymbol && replaySession.getSnapshot().active) {
        replaySession.close();
      } else if (prevOverlayTimeframe !== null && tf !== prevOverlayTimeframe && replaySession.getSnapshot().active) {
        const savedCursor = replaySession.getSnapshot().cursorTime;
        const { chart } = getActiveChartContext();
        if (chart?.historyComplete) {
          void chart.historyComplete().then(() => {
            if (!replaySession.getSnapshot().active) return;
            const ws = controller.getWorkspace();
            if (!ws?.replay?.state?.active && savedCursor !== null) {
              void startReplay(savedCursor, true);
            } else {
              emitReplayState();
            }
          });
        }
      }

      if (s !== prevOverlaySymbol || tf !== prevOverlayTimeframe) {
        prevOverlayTimeframe = tf;
        refreshCachedCandles();
      }
      if (showDrawingLabels !== prevShowDrawingLabels) {
        prevShowDrawingLabels = showDrawingLabels;
        priceScaleOverlayController.updateDrawings(chartDrawingController.getSnapshot().activeDrawings || [], showDrawingLabels);
      }
      if (s !== prevOverlaySymbol || alerts !== prevOverlayAlerts) {
        priceScaleOverlayController.updateAlerts(alerts, s);
      }
      if (showIndLabels !== prevShowIndicatorLabels) {
        prevShowIndicatorLabels = showIndLabels;
        priceScaleOverlayController.updateIndicators(controller.getActiveIndicators(), showIndLabels);
      }
      if (plans !== prevOverlayPlans || alerts !== prevOverlayAlerts) {
        prevOverlayPlans = plans;
        controller.getTimelineMarksController().loadTradePlans(plans, alerts);
      }

      prevOverlaySymbol = s;
      prevOverlayAlerts = alerts;
    });
  });

  onMount(() => {
    isMounted = true;
    if (chartContainer) {
      controller.attach(chartContainer);
      const ws = controller.getWorkspace();
      if (ws) {
        unsubAttachWorkspace = chartDrawingController.attachWorkspace(
          ws,
          () => symbol,
          () => timeframe,
          () => providerId,
          () => workspaceId
        );
        unsubAttachOverlay = priceScaleOverlayController.attachChart(chartContainer, ws);
        unsubAttachDataWindow = dataWindowService.attachWorkspace(ws, chartContainer);
        attachReplayWorkspaceEvents(ws);
      }
      chartContainer.addEventListener('pointermove', handleCutoffPointerMove);
      chartContainer.addEventListener('mouseleave', handleCutoffPointerLeave);
      chartContainer.addEventListener('pointerdown', handleCutoffPointerDownCapture, true);
      chartContainer.addEventListener('click', handleCutoffClickCapture, true);
    }
    replaySession.bindDriver({
      getBounds: () => getReplayBounds(),
      start: async (targetTime: number) => startReplay(targetTime, false),
      seekTo: async (targetTime: number) => startReplay(targetTime, true),
      skipToEnd: async () => skipToEndReplay(),
      play: (speedMs: number) => { controller.getWorkspace()?.replay?.play?.(speedMs); },
      pause: () => { controller.getWorkspace()?.replay?.pause?.(); },
      step: (count = 1) => {
        const replay = controller.getWorkspace()?.replay;
        if (!replay) return;
        for (let i = 0; i < count; i++) {
          if (!replay.step()) break;
        }
        emitReplayState();
      },
      stepBack: (count = 1) => stepBackReplay(count),
      stop: () => stopReplay(),
      getState: () => readWorkspaceReplayState(),
      enableCutoffVisual: () => enableCutoffSelection(),
      cancelCutoffVisual: () => cancelCutoffSelection()
    });
    unsubController = controller.subscribe((snap) => {
      onSessionStateChange?.({ session: snap.session, sessionAvailable: snap.sessionAvailable });
    });
    unsubAlerts = alertService.subscribe((alerts) => {
      allAlerts = alerts;
      priceScaleOverlayController.updateAlerts(alerts, symbol);
    });
    unsubDrawingDraft = chartDrawingController.subscribeDraft((draftDrawings) => {
      priceScaleOverlayController.updateDrawings(draftDrawings || [], showDrawingPriceLabels);
    });
    unsubDrawingState = chartDrawingController.subscribe((st) => {
      currentActiveDrawingTool = st.activeTool;
      const nextHandpull = st.activeTool === 'handpull';
      if (isHandpullActive !== nextHandpull) isHandpullActive = nextHandpull;
      const prevGesture = isGestureActive;
      const nextGesture = chartDrawingController.isGestureMode();
      if (nextGesture !== prevGesture) {
        isGestureActive = nextGesture;
        if (nextGesture) {
          syncInkCanvasSize();
        }
      }
      if (gestureCreationState !== st.lastGestureCreation) {
        gestureCreationState = st.lastGestureCreation;
      }
      if (lastRawActivePlansRef !== st.activePlans) {
        lastRawActivePlansRef = st.activePlans;
        activePlans = st.activePlans || [];
      }
      const nextShowCards = st.showThesisCards ?? true;
      if (showThesisCards !== nextShowCards) {
        showThesisCards = nextShowCards;
      }
      if (lastRawThesisGeometriesRef !== st.thesisCardGeometries) {
        lastRawThesisGeometriesRef = st.thesisCardGeometries;
        const nextGeoms: Record<string, { x: number; y: number; width: number; height: number; isWideMode: boolean; isMinimized: boolean }> = {};
        for (const [planId, geo] of Object.entries(st.thesisCardGeometries || {})) {
          if (geo && typeof geo === 'object') {
            nextGeoms[planId] = {
              x: geo.x,
              y: geo.y,
              width: geo.width,
              height: geo.height ?? 420,
              isWideMode: Boolean(geo.isWideMode),
              isMinimized: Boolean(geo.isMinimized),
            };
          }
        }
        thesisCardGeometries = nextGeoms;
      }
      priceScaleOverlayController.updateDrawings(st.activeDrawings || [], showDrawingPriceLabels);
    });
    unsubOverlay = priceScaleOverlayController.subscribe((coords) => {
      overlayTick = coords.tick;
      alertYPositions = coords.alertYPositions;
      drawingBadgeYPositions = coords.drawingBadgeYPositions;
      indicatorBadgeYPositions = coords.indicatorBadgeYPositions;
      drawingPriceBadges = coords.drawingPriceBadges;
      indicatorPriceBadges = coords.indicatorPriceBadges;
    });
    unsubFeedConnection = marketFeed.onConnectionChange((st: FeedConnectionStatus) => {
      feedConnectionStatus = st; if (st.state === 'connected') isDismissedConnectionWarning = false;
    });
    window.addEventListener('paste', handleCanvasPaste);
  });

  onDestroy(() => {
    isMounted = false;
    if (dblClickPaneCaptureTimer) {
      clearTimeout(dblClickPaneCaptureTimer);
      dblClickPaneCaptureTimer = null;
    }
    unsubController?.(); unsubAlerts?.(); unsubDrawingDraft?.(); unsubDrawingState?.(); unsubOverlay?.(); unsubFeedConnection?.();
    unsubAttachWorkspace?.(); unsubAttachOverlay?.(); unsubAttachDataWindow?.();
    for (const off of unsubReplayEvents) off();
    unsubReplayEvents = [];
    if (chartContainer) {
      chartContainer.removeEventListener('pointermove', handleCutoffPointerMove);
      chartContainer.removeEventListener('mouseleave', handleCutoffPointerLeave);
      chartContainer.removeEventListener('pointerdown', handleCutoffPointerDownCapture, true);
      chartContainer.removeEventListener('click', handleCutoffClickCapture, true);
    }
    window.removeEventListener('paste', handleCanvasPaste);
    replaySession.bindDriver(null); sessionController = null; controller.destroy();
  });

  function getActiveChartContext(): { ws: any; cell: any; chart: any; renderer: any; coords: any; bars: any[] } {
    const ws = controller.getWorkspace();
    const cell = ws?.active || controller.getAllCells()[0] || null;
    const chart = (cell?.chart as any) ?? null;
    const renderer = chart?.renderer?.renderer || chart?.renderer || null;
    const coords = renderer?.coords || chart?.coords || null;
    const bars = chart?.rawBars || renderer?.bars || [];
    return { ws, cell, chart, renderer, coords, bars };
  }

  function formatCutlineDate(epochMs: number): string {
    return new Date(epochMs).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function updateCutlineFromPointer(clientX: number, clientY: number): void {
    if (!chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    const localX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const localY = Math.max(0, Math.min(clientY - rect.top, rect.height));
    cutlineY = localY;

    const { coords, bars } = getActiveChartContext();
    if (coords && typeof coords.xToLogical === 'function' && bars.length > 0) {
      const rawLogical = Math.round(coords.xToLogical(localX));
      const idx = Math.max(0, Math.min(bars.length - 1, rawLogical));
      const snappedX = typeof coords.logicalToX === 'function' ? coords.logicalToX(idx) : localX;
      cutlineX = Number.isFinite(snappedX) ? Math.max(0, Math.min(snappedX, rect.width)) : localX;

      const bar = bars[idx];
      if (bar && typeof bar.time === 'number') {
        snappedBarTime = bar.time;
        hoveredBarDateText = formatCutlineDate(bar.time);
        hoveredBarPriceText = typeof bar.close === 'number' ? formatPrice(bar.close) : '';
        return;
      }
    }

    cutlineX = localX;
    snappedBarTime = null;
    hoveredBarDateText = 'Klik lilin untuk potong';
    hoveredBarPriceText = '';
  }

  function handleCutoffPointerMove(e: PointerEvent): void {
    if (!isSelectingCutoff) return;
    updateCutlineFromPointer(e.clientX, e.clientY);
  }

  function handleCutoffPointerLeave(): void {
    if (!isSelectingCutoff) return;
    cutlineX = null;
    cutlineY = null;
    snappedBarTime = null;
  }

  function isCutoffEventIgnored(eventTarget: EventTarget | null): boolean {
    const el = eventTarget as HTMLElement | null;
    return Boolean(el?.closest('button') || el?.closest('.floating-thesis-card'));
  }

  function handleCutoffPointerDownCapture(e: PointerEvent): void {
    if (!isSelectingCutoff || e.button !== 0 || isCutoffEventIgnored(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    updateCutlineFromPointer(e.clientX, e.clientY);
    const chosenTime = snappedBarTime ?? getReplayBounds()?.last ?? null;
    if (chosenTime !== null) {
      void replaySession.setCutoff(chosenTime);
    }
  }

  function handleCutoffClickCapture(e: MouseEvent): void {
    if (!isSelectingCutoff || isCutoffEventIgnored(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function enableCutoffSelection(): void {
    isSelectingCutoff = true;
    cutlineX = null;
    cutlineY = null;
    snappedBarTime = null;
    hoveredBarDateText = '';
    hoveredBarPriceText = '';
  }

  function cancelCutoffSelection(): void {
    isSelectingCutoff = false;
    cutlineX = null;
    cutlineY = null;
    snappedBarTime = null;
    onCutoffCancelled?.();
  }

  function readWorkspaceReplayState() {
    const s = controller.getWorkspace()?.replay?.state;
    if (!s) return null;
    return {
      active: Boolean(s.active),
      playing: Boolean(s.playing),
      cursorTime: s.cursorTime ?? null,
      remaining: s.remaining ?? 0,
    };
  }

  function emitReplayState(ev?: { reason?: string }): void {
    if (isLoadingHistoricalContext) return;
    const ws = controller.getWorkspace();
    if (!ws?.replay) return;
    const s = ws.replay.state;
    const b = ws.replay.bounds;

    if (ev?.reason === 'finished' || (isSkippingToEnd && ev?.reason === 'stopped')) {
      isSkippingToEnd = false;
      replaySession.notifyDriverState({
        active: true,
        playing: false,
        cursorTime: b?.last ?? s?.cursorTime ?? null,
        remaining: 0,
        bounds: b ?? null,
      });
      return;
    }

    replaySession.notifyDriverState({
      active: Boolean(s?.active) || replaySession.getSnapshot().isSelectingBar,
      playing: Boolean(s?.playing),
      cursorTime: s?.cursorTime ?? null,
      remaining: s?.remaining ?? 0,
      bounds: b ?? null,
    });
  }

  function attachReplayWorkspaceEvents(ws: any): void {
    for (const off of unsubReplayEvents) off();
    unsubReplayEvents = [];
    const r = ws?.replay;
    if (!r || typeof r.on !== 'function') return;
    const events = ['replay:start', 'replay:step', 'replay:play', 'replay:pause'] as const;
    for (const evName of events) {
      const off = r.on(evName, () => {
        emitReplayState();
        priceScaleOverlayController.scheduleUpdate();
      });
      if (typeof off === 'function') unsubReplayEvents.push(off);
    }
    const offEnd = r.on('replay:end', (payload: any) => {
      emitReplayState(payload);
      priceScaleOverlayController.scheduleUpdate();
    });
    if (typeof offEnd === 'function') unsubReplayEvents.push(offEnd);
  }

  function getReplayBounds(): { first: number; last: number } | null {
    return controller.getWorkspace()?.replay?.bounds || null;
  }

  function focusCameraOnTimestamp(targetTime: number): void {
    const { chart, renderer, bars } = getActiveChartContext();
    if (!chart || bars.length === 0) return;

    let cutIdx = bars.findIndex((b: any) => b.time >= targetTime);
    if (cutIdx === -1) cutIdx = bars.length - 1;

    const leftIdx = Math.max(0, cutIdx - 90);
    const barMs = getTimeframeDurationMs(timeframe);
    const rightPad = barMs * 18;
    const fromTime = bars[leftIdx].time;
    const toTime = bars[cutIdx].time + rightPad;

    try {
      if (typeof renderer?.setVisibleRange === 'function') {
        renderer.setVisibleRange({ from: fromTime, to: toTime });
      } else if (typeof chart?.setMarket === 'function') {
        void chart.setMarket({ visibleRange: { from: fromTime, to: toTime } });
      }
      priceScaleOverlayController.scheduleContinuousSync(200);
    } catch (_) {}
  }

  async function ensureHistoricalContext(targetTime: number): Promise<boolean> {
    const { chart, bars: initialBars } = getActiveChartContext();
    if (!chart) return false;

    const barMs = getTimeframeDurationMs(timeframe);
    const contextBars = 350;
    const desiredOldest = targetTime - contextBars * barMs;

    if (initialBars.length === 0 || desiredOldest < initialBars[0].time) {
      const spanBars = Math.ceil((Date.now() - desiredOldest) / barMs) + 120;
      const neededBars = Math.min(25000, Math.max(800, initialBars.length + 500, spanBars));
      if (typeof chart.setMarket === 'function') {
        isLoadingHistoricalContext = true;
        try {
          await chart.setMarket({ bars: neededBars });
          if (typeof chart.historyComplete === 'function') {
            await chart.historyComplete();
          }
        } finally {
          isLoadingHistoricalContext = false;
        }
      }
    }

    const { bars } = getActiveChartContext();
    if (bars.length < 2) {
      replaySession.notifyDriverState({
        errorMessage: 'Data candle tidak mencukupi untuk memulai replay.',
      });
      return false;
    }

    if (targetTime < bars[0].time - barMs * 5) {
      const earliestLabel = formatCutlineDate(bars[0].time);
      replaySession.notifyDriverState({
        errorMessage: `Histori bursa hanya tersedia mulai ${earliestLabel}.`,
      });
      return false;
    }

    return true;
  }

  async function startReplay(fromTimestamp?: number, isSeek = false): Promise<boolean> {
    const ws = controller.getWorkspace();
    if (!ws?.replay) return false;
    try {
      const targetTime = fromTimestamp ?? Date.now() - 3 * 3600 * 1000;
      const hasContext = await ensureHistoricalContext(targetTime);
      if (!hasContext) return false;

      const { bars } = getActiveChartContext();
      if (bars.length < 2) return false;

      if (isSeek && targetTime >= bars[bars.length - 1].time) {
        return skipToEndReplay();
      }

      const maxCutoff = bars[bars.length - 2].time;
      const effectiveTarget = Math.min(Math.max(targetTime, bars[0].time), maxCutoff);

      await ws.replay.start({ from: effectiveTarget });
      focusCameraOnTimestamp(effectiveTarget);
      emitReplayState();
      return true;
    } catch (err) {
      console.warn('[Chart] Gagal memulai Bar Replay:', err);
      replaySession.notifyDriverState({
        errorMessage: 'Gagal memuat sesi Bar Replay pada waktu tersebut.',
      });
      return false;
    }
  }

  async function stepBackReplay(count = 1): Promise<void> {
    const ws = controller.getWorkspace();
    if (!ws?.replay) return;
    const state = ws.replay.state;
    const cursor = state?.cursorTime;
    const { bars } = getActiveChartContext();
    if (bars.length === 0) return;

    let targetTime: number;
    if (cursor != null) {
      const curIdx = bars.findIndex((b: any) => b.time >= cursor);
      const safeIdx = curIdx === -1 ? bars.length - 1 : curIdx;
      const prevIdx = Math.max(0, safeIdx - Math.max(1, count));
      targetTime = bars[prevIdx].time;
    } else {
      const prevIdx = Math.max(0, bars.length - 1 - Math.max(1, count));
      targetTime = bars[prevIdx].time;
    }

    await ws.replay.start({ from: targetTime });
    emitReplayState();
    priceScaleOverlayController.scheduleUpdate();
  }

  async function skipToEndReplay(): Promise<boolean> {
    const ws = controller.getWorkspace();
    if (!ws?.replay) return false;
    try {
      if (ws.replay.state?.active) {
        isSkippingToEnd = true;
        ws.replay.stop();
      }
      const b = getReplayBounds();
      replaySession.notifyDriverState({
        active: true,
        playing: false,
        cursorTime: b?.last ?? null,
        remaining: 0,
        bounds: b ?? null,
      });
      return true;
    } catch (_) {
      return false;
    } finally {
      isSkippingToEnd = false;
    }
  }

  function stopReplay(): void {
    isSkippingToEnd = false;
    isSelectingCutoff = false;
    cutlineX = null;
    cutlineY = null;
    snappedBarTime = null;
    const ws = controller.getWorkspace();
    if (ws?.replay?.state?.active) ws.replay.stop();
  }

  let cachedCandles = $state<Candle[]>([]);
  let snapInfo = $state<{
    snapped: boolean;
    type: 'high' | 'low' | 'open' | 'close' | null;
    candleY?: number;
    candleX?: number;
    price: number;
  } | null>(null);

  // Pelacakan geometri posisi & dimensi kartu tesis aktif dari controller untuk sinkronisasi snapshot
  let thesisCardGeometries = $state<Record<string, { x: number; y: number; width: number; height: number; isWideMode: boolean; isMinimized: boolean }>>({});

  function handleThesisCardGeometryChange(geo: { planId: string; x: number; y: number; width: number; height: number; isWideMode: boolean; isMinimized: boolean }) {
    chartDrawingController.setThesisCardGeometry(geo.planId, {
      x: geo.x,
      y: geo.y,
      width: geo.width,
      height: geo.height,
      isWideMode: geo.isWideMode,
      isMinimized: geo.isMinimized,
    });
  }

  async function refreshCachedCandles() {
    try {
      const bars = await marketFeed.getCandles(symbol, timeframe, 300);
      if (Array.isArray(bars) && bars.length > 0) {
        cachedCandles = bars;
      }
    } catch (_) {}
  }

  async function handleRetryFeedConnection() {
    isDismissedConnectionWarning = false;
    marketFeed.resetConnectionError();
    void marketFeed.pollTick().catch(() => {});
    await controller.reconnectLiveFeed();
    void refreshCachedCandles();
  }

  function handleAlertPointerDown(e: PointerEvent, alert: PriceAlert) {
    e.stopPropagation();
    draggingAlertId = alert.id;
    draggingAlertPrice = alert.targetPrice;
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    refreshCachedCandles();
  }

  function handleAlertPointerMove(e: PointerEvent, alert: PriceAlert) {
    if (draggingAlertId !== alert.id) return;
    const rawPrice = priceScaleOverlayController.getPriceFromClientY(e.clientY);
    if (rawPrice !== null && rawPrice > 0) {
      const containerRect = chartContainer?.getBoundingClientRect();
      const localY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const isMagnet = chartDrawingController.getSnapshot().snapMode !== 'off';

      const snapRes = findNearestOhlcPoint({
        targetPrice: rawPrice,
        targetY: localY,
        candles: cachedCandles,
        getPriceY: (p) => priceScaleOverlayController.getPriceY(p),
        tolerancePx: 15,
        isMagnetActive: isMagnet,
        shiftKey: false, // Inversi shift sudah ditangani oleh controller state (menghindari double-inversion)
        symbol,
      });

      draggingAlertPrice = snapRes.price;
      if (snapRes.snapped) {
        const timeX = snapRes.candleTime ? priceScaleOverlayController.getTimeX(snapRes.candleTime) : null;
        snapInfo = {
          snapped: true,
          type: snapRes.snappedType,
          candleY: snapRes.candleY,
          candleX: timeX ?? undefined,
          price: snapRes.price,
        };
      } else {
        snapInfo = null;
      }
      scheduleBadgePositionUpdate();
    }
  }

  function handleAlertPointerUp(e: PointerEvent, alert: PriceAlert) {
    if (draggingAlertId === alert.id) {
      if (draggingAlertPrice && Math.abs(draggingAlertPrice - alert.targetPrice) > 0.000001) {
        alertService.updateAlert(alert.id, { targetPrice: draggingAlertPrice });
      }
      draggingAlertId = null;
      draggingAlertPrice = null;
      snapInfo = null;
      try { (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId); } catch (_) {}
    }
  }
  function handleContainerContextMenu(e: MouseEvent) {
    e.preventDefault(); contextMenuX = e.clientX; contextMenuY = e.clientY;
    contextMenuPrice = priceScaleOverlayController.getPriceFromClientY(e.clientY);
    contextMenuTime = Date.now(); isContextMenuOpen = true;
  }

  function handleContainerDblClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('.alert-line-badge') || target?.closest('.floating-thesis-card')) {
      return;
    }

    const rect = chartContainer?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = controller.getWorkspace()?.active || controller.getAllCells()[0];
    const native = cell?.chart?.renderer?.renderer || cell?.chart?.renderer;
    const input = native?.input;
    const coords = typeof input?.deps?.getCoords === 'function' ? input.deps.getCoords() : native?.coords;

    let isAxis = false;
    if (input && typeof input.regionAt === 'function') {
      try {
        const region = input.regionAt(x, y);
        if (region === 'price' || region === 'time') {
          isAxis = true;
        }
      } catch (_) {}
    }

    if (!isAxis && coords) {
      if ((typeof coords.width === 'number' && x > coords.width) || (typeof coords.height === 'number' && y > coords.height)) {
        isAxis = true;
      }
    }

    if (isAxis) {
      controller.fitChart();
    } else {
      chartDrawingController.handleDrawingDblClick();
    }
    // Deteksi reset tinggi pane setelah double-click separator
    controller.capturePaneLayoutIfChanged();
    if (dblClickPaneCaptureTimer) {
      clearTimeout(dblClickPaneCaptureTimer);
    }
    dblClickPaneCaptureTimer = setTimeout(() => {
      dblClickPaneCaptureTimer = null;
      controller.capturePaneLayoutIfChanged();
    }, 0);
  }

  /**
   * Merender screenshot kanvas WebGL2 beserta overlay anotasi DOM & trading plan (#95, #135).
   */
  export function getChartScreenshotCanvas(scope: 'active' | 'all' = 'active', thesisLayout?: SnapshotThesisLayout): HTMLCanvasElement | null {
    const baseCanvas = controller.getScreenshotCanvas(scope);
    if (!baseCanvas) return null;
    if (!chartContainer) return baseCanvas;

    const currentTheme = resolveThemeConfig(themePreset);

    return renderScreenshotCanvasWithOverlay({
      baseCanvas,
      containerWidth: chartContainer.clientWidth || baseCanvas.width,
      containerHeight: chartContainer.clientHeight || baseCanvas.height,
      drawingPriceBadges,
      showDrawingPriceLabels,
      activePlans: scopedActivePlans,
      showThesisCards,
      thesisLayout,
      cardGeometries: thesisCardGeometries,
      getPriceY: (p) => getPriceY(p),
      formatPrice: (p) => formatPrice(p),
      themeConfig: currentTheme
    });
  }
  /**
   * Mengambil harga terakhir di bawah kursor untuk pembuatan alert cepat (Alt+A).
   */
  export function getLastHoveredPrice(): number | null {
    if (lastPointerClientY !== null) {
      const livePrice = priceScaleOverlayController.getPriceFromClientY(lastPointerClientY);
      if (livePrice !== null) {
        lastHoveredPrice = livePrice;
        return livePrice;
      }
    }
    return lastHoveredPrice;
  }
  /**
   * Membuka dialog pengaturan bawaan renderer Vela pada sel aktif.
   */
  export function openChartSettings(section: string = 'Symbol'): void {
    const cell = controller.getWorkspace()?.active || controller.getAllCells()[0];
    const r = cell?.chart?.renderer?.renderer || cell?.chart?.renderer;
    if (r?.openSettings) r.openSettings(section);
    else if (r?.openSettingsDialog) r.openSettingsDialog(section);
  }

  function syncInkCanvasSize() {
    if (gestureInkCanvas && chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      if (gestureInkCanvas.width !== rect.width || gestureInkCanvas.height !== rect.height) {
        gestureInkCanvas.width = rect.width;
        gestureInkCanvas.height = rect.height;
      }
    }
  }

  function renderLiveInk() {
    if (!gestureInkCanvas) return;
    const ctx = gestureInkCanvas.getContext('2d');
    if (!ctx) return;

    const points = chartDrawingController.getLiveGestureStroke();
    if (points.length < 2) return;

    ctx.clearRect(0, 0, gestureInkCanvas.width, gestureInkCanvas.height);

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const xc = (points[i - 1].x + points[i].x) / 2;
      const yc = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function clearLiveInk() {
    if (!gestureInkCanvas) return;
    const ctx = gestureInkCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, gestureInkCanvas.width, gestureInkCanvas.height);
    }
  }

  function resetVelaDragState() {
    if (!chartContainer) return;
    try {
      const canvases = chartContainer.querySelectorAll('canvas');
      for (const c of canvases) {
        c.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      }
    } catch (_) {}
  }

  function handleGesturePointerDown(e: PointerEvent) {
    scheduleBadgePositionUpdate();
    chartDrawingController.dismissGestureHUD();
    if (isGestureActive && e.button === 0 && chartContainer) {
      syncInkCanvasSize();
      isDrawingGestureStroke = true;
      const rect = chartContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      chartDrawingController.startGestureStroke(x, y);
      renderLiveInk();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function handleGesturePointerMove(e: PointerEvent) {
    scheduleBadgePositionUpdate();
    if (isDrawingGestureStroke && chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      chartDrawingController.addGesturePoint(x, y);
      renderLiveInk();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function handleGesturePointerUp(e: PointerEvent) {
    if (isDrawingGestureStroke && chartContainer) {
      isDrawingGestureStroke = false;
      const rect = chartContainer.getBoundingClientRect();

      const wicks: Array<{ highY: number; lowY: number }> = [];
      for (const c of cachedCandles.slice(-60)) {
        const hy = getPriceY(c.high);
        const ly = getPriceY(c.low);
        if (hy !== null && ly !== null) {
          wicks.push({ highY: hy, lowY: ly });
        }
      }

      chartDrawingController.finishGestureStroke({
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        wicks,
        wickSnapRadius: 20
      });

      clearLiveInk();
      isGestureActive = chartDrawingController.isGestureMode();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      resetVelaDragState();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function handleGesturePointerCancel(e: PointerEvent) {
    if (isDrawingGestureStroke) {
      isDrawingGestureStroke = false;
      chartDrawingController.cancelGestureStroke();
      clearLiveInk();
      isGestureActive = chartDrawingController.isGestureMode();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      resetVelaDragState();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function handleWindowKeyDown(e: KeyboardEvent) {
    // Tab candidate cycling saat Gesture HUD aktif
    if (e.key === 'Tab' && chartDrawingController.isGestureHUDActive()) {
      e.preventDefault();
      e.stopPropagation();
      chartDrawingController.cycleGestureCandidate();
      return;
    }

    // Esc cancel saat Gesture HUD aktif
    if (e.key === 'Escape' && chartDrawingController.isGestureHUDActive()) {
      e.preventDefault();
      e.stopPropagation();
      chartDrawingController.cancelGestureCreation();
      return;
    }

    if (e.key === 'Shift') {
      const snap = chartDrawingController.getSnapshot().snapMode;
      const inverted = snap === 'off' ? 'strong' : 'off';
      chartDrawingController.setTemporarySnapMode(inverted);
    }
    // Transient hold tombol `~` (Backquote / Tilde)
    if (!isEditableElement(e.target) && (e.key === '`' || e.code === 'Backquote' || e.key === '~')) {
      chartDrawingController.setTransientGestureHold(true);
      isGestureActive = true;
      syncInkCanvasSize();
    }
  }

  function handleWindowKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      chartDrawingController.restoreOriginalSnapMode();
    }
    // Release transient hold saat tombol `~` atau `Shift+D` dilepas (jika sedang gaya hold)
    const isTilde = e.key === '`' || e.code === 'Backquote' || e.key === '~';
    const isShiftOrD = e.key === 'Shift' || e.key === 'd' || e.key === 'D' || e.code === 'KeyD';
    if (isTilde || (isShiftOrD && chartDrawingController.isHoldingGesture())) {
      chartDrawingController.setTransientGestureHold(false);
      isGestureActive = chartDrawingController.isGestureMode();
      resetVelaDragState();
    }
  }

  function handleCanvasPaste(e: ClipboardEvent) {
    if (isEditableElement(e.target)) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    const text = clipboardData.getData('text/plain') || clipboardData.getData('text');
    if (text && isTradingPlanText(text)) {
      e.preventDefault();
      onOpenTradePlanPaste?.(text);
    }
  }


  const chartBackgroundStyle = $derived.by(() => {
    const cfg = resolveThemeConfig(themePreset);
    if (customChartBackground?.mode === 'gradient') {
      const top = customChartBackground.gradientTop || '#0F0F0F';
      const bottom = customChartBackground.gradientBottom || '#181A20';
      return `background: linear-gradient(180deg, ${top}, ${bottom});`;
    }
    if (customChartBackground?.mode === 'solid' && customChartBackground.solidColor) {
      return `background: ${customChartBackground.solidColor};`;
    }
    return `background: ${cfg.chart.background};`;
  });
</script>

<svelte:window onkeydown={handleWindowKeyDown} onkeyup={handleWindowKeyUp} />

<div 
  class="chart-wrapper {isSelectingCutoff ? 'selecting-cutoff' : ''} {isHandpullActive ? 'handpull-mode' : ''} {isGestureActive ? 'gesture-mode' : ''}"
  data-custom-bg={customChartBackground?.mode === 'solid' || customChartBackground?.mode === 'gradient' ? 'true' : 'false'}
  style={chartBackgroundStyle}
  oncontextmenu={handleContainerContextMenu}
  onwheel={scheduleBadgePositionUpdate}
  onpointerdown={handleChartWrapperPointerDown}
  onpointermove={handleChartWrapperPointerMove}
  onpointerup={handleChartWrapperPointerUp}
  onpaste={handleCanvasPaste}
  ondblclick={handleContainerDblClick}
  role="region"
  aria-label="Area Grafik Utama"
>
  <!-- Lapisan Watermark Keamanan Live Canvas (Diletakkan di lapisan belakang candlestick / z-index 0) -->
  {#if securityWatermark?.enabled && securityWatermark?.showOnLiveCanvas}
    {@const watermarkText = resolveSecurityWatermarkText(securityWatermark, userProfile)}
    <div
      class="live-security-watermark-overlay"
      style="opacity: {securityWatermark.opacity ?? 0.10}; pointer-events: none;"
      aria-hidden="true"
    >
      <span class="live-diagonal-watermark-text mono-nums">
        {watermarkText}
      </span>
    </div>
  {/if}

  <div bind:this={chartContainer} class="vela-container"></div>
  <canvas
    bind:this={gestureInkCanvas}
    class="gesture-ink-canvas {isGestureActive ? 'active' : ''}"
    onpointerdown={handleGesturePointerDown}
    onpointermove={handleGesturePointerMove}
    onpointerup={handleGesturePointerUp}
    onpointercancel={handleGesturePointerCancel}
  ></canvas>

  {#if isGestureActive}
    <div class="gesture-mode-hud mono-nums">
      <span class="gesture-hud-dot"></span>
      <span>GESTURE DRAW</span>
      <span class="gesture-hud-sub">Tahan goresan di kanvas</span>
    </div>
  {/if}

  {#if gestureCreationState}
    {@const active = gestureCreationState.candidates[gestureCreationState.candidateIndex]}
    {@const next = gestureCreationState.candidates.length > 1
      ? gestureCreationState.candidates[(gestureCreationState.candidateIndex + 1) % gestureCreationState.candidates.length]
      : null}
    <div class="gesture-candidate-hud mono-nums" role="status" aria-live="polite">
      <span class="gesture-candidate-tool">{active?.label || active?.tool}</span>
      <span class="gesture-candidate-actions">
        {#if next}
          (Tab: {next.label || next.tool} • Esc: Batalkan)
        {:else}
          (Esc: Batalkan)
        {/if}
      </span>
    </div>
  {/if}

  {#if (feedConnectionStatus.state === 'blocked' || feedConnectionStatus.state === 'stalled') && !isDismissedConnectionWarning}
    <div class="feed-connection-warning-banner obsidian-card" role="alert">
      <div class="warning-left">
        <WifiOff size={16} class="warning-icon" />
        <span class="warning-text">
          {#if feedConnectionStatus.message}
            {feedConnectionStatus.message}
          {:else}
            Koneksi feed ke <b>{feedConnectionStatus.providerId.toUpperCase()}</b> {feedConnectionStatus.state === 'blocked' ? 'terhambat (diblokir ISP)' : 'tersendat'}.
          {/if}
          Ingin beralih ke Indodax atau coba lagi?
        </span>
      </div>
      <div class="warning-actions">
        <button type="button" class="btn-switch-indodax" onclick={() => { marketFeed.setActiveProvider('indodax'); onActiveCellChange?.({ symbol: symbol.toUpperCase().endsWith('IDR') ? symbol : 'BTCIDR', timeframe, providerId: 'indodax' }); }}>Beralih ke Indodax</button>
        <button type="button" class="btn-retry-feed" onclick={handleRetryFeedConnection}>Coba Ulang</button>
        <button type="button" class="btn-dismiss-warning" title="Tutup" onclick={() => (isDismissedConnectionWarning = true)}><X size={14} /></button>
      </div>
    </div>
  {/if}

  {#each activeSymbolAlerts as a (a.id)}
    {@const isDragging = draggingAlertId === a.id}
    {@const displayPrice = isDragging && draggingAlertPrice ? draggingAlertPrice : a.targetPrice}
    {@const yPos = isDragging ? getPriceY(displayPrice) : (a.id in alertYPositions ? alertYPositions[a.id] : getPriceY(displayPrice))}
    {#if yPos !== null && yPos >= 0}
      <div class="chart-alert-line {a.triggered ? 'triggered' : ''} {a.active ? 'active' : 'paused'} {isDragging ? 'is-dragging' : ''}" style="top: {yPos}px;">
        <div
          class="alert-line-badge mono-nums {isDragging ? 'dragging' : ''}"
          onpointerdown={(e) => handleAlertPointerDown(e, a)}
          onpointermove={(e) => handleAlertPointerMove(e, a)}
          onpointerup={(e) => handleAlertPointerUp(e, a)}
          onpointercancel={(e) => handleAlertPointerUp(e, a)}
          ondblclick={(e) => {
            e.stopPropagation();
            onRequestEditAlert?.(a);
          }}
          title="Tahan & geser untuk mengubah harga (Double-click untuk sunting)"
        >
          <Bell size={10} class="badge-bell" />
          <span class="badge-price">{priceScaleOverlayController.formatPriceWithQuote(displayPrice)}</span>
          {#if isDragging && snapInfo?.snapped}
            <span class="badge-snap-tag mono-nums">MAGNET: {snapInfo.type?.toUpperCase()}</span>
          {/if}
          {#if a.label}<span class="badge-lbl">{a.label}</span>{/if}
          <button
            type="button"
            class="badge-edit-btn"
            title="Sunting Alert"
            onclick={(e) => {
              e.stopPropagation();
              onRequestEditAlert?.(a);
            }}
          >
            <Edit3 size={10} />
          </button>
          <button
            type="button"
            class="badge-del-btn"
            title="Hapus Alert"
            onclick={(e) => {
              e.stopPropagation();
              alertService.deleteAlert(a.id);
            }}
          >
            <X size={10} />
          </button>
        </div>
      </div>
    {/if}
  {/each}

  {#if draggingAlertId && snapInfo?.snapped && snapInfo.candleY !== undefined}
    <div
      class="snap-halo-indicator"
      style="top: {snapInfo.candleY}px; {snapInfo.candleX !== undefined ? `left: ${snapInfo.candleX}px; margin-left: -7px;` : 'right: 80px;'}"
      title="Magnet terkunci ke {snapInfo.type?.toUpperCase()}: {formatPrice(snapInfo.price)}"
    >
      <div class="snap-halo-dot"></div>
      <div class="snap-halo-pulse"></div>
    </div>
  {/if}

  {#if showDrawingPriceLabels}
    {#each drawingPriceBadges as badge (badge.id)}
      {@const yPos = drawingBadgeYPositions[badge.id] ?? null}
      {#if yPos !== null && yPos >= 0}
        <div class="price-scale-badge-item mono-nums" style="top: {yPos}px; background-color: {badge.bgColor || badge.color}; color: #ffffff; border: 1px solid {badge.color}66;" title="{badge.title || badge.label}: {badge.label || formatPrice(badge.price)}">
          {#if badge.title}<span class="badge-tag">{badge.title}</span>{/if}
          <span class="badge-num">{badge.label || formatPrice(badge.price)}</span>
        </div>
      {/if}
    {/each}
  {/if}

  {#if showIndicatorPriceLabels}
    {#each indicatorPriceBadges as badge (badge.id)}
      {@const yPos = indicatorBadgeYPositions[badge.id] ?? null}
      {#if yPos !== null && yPos >= 0}
        <div class="price-scale-badge-item indicator-badge mono-nums" style="top: {yPos}px; border-left: 3px solid {badge.color}; background-color: {badge.bgColor || '#0f172a'}; color: {badge.color}; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08);" title="{badge.title || badge.label}: {badge.label || formatPrice(badge.price)}">
          {#if badge.title}<span class="badge-tag">{badge.title}</span>{/if}
          <span class="badge-num">{badge.label || formatPrice(badge.price)}</span>
        </div>
      {/if}
    {/each}
  {/if}

  {#if isSelectingCutoff}
    {#if cutlineX !== null}
      <div class="replay-future-curtain" style="left: {cutlineX}px;"></div>
      <div class="vertical-cutline" style="left: {cutlineX}px;">
        <div class="cutline-scissors-badge obsidian-card mono-nums" style="top: {Math.max(48, Math.min((cutlineY ?? 80) - 28, 420))}px;">
          <Scissors size={12} class="badge-cut-icon" />
          <span>{hoveredBarDateText || 'Klik lilin untuk potong'}</span>
          {#if hoveredBarPriceText}
            <span class="cutline-price-tag">{hoveredBarPriceText}</span>
          {/if}
        </div>
      </div>
    {/if}
  {/if}

  {#if showThesisCards}
    {#each scopedActivePlans as plan, idx (plan.id)}
      {@const savedGeo = thesisCardGeometries[plan.id]}
      <FloatingThesisCard
        {plan}
        initialX={savedGeo?.x ?? (16 + idx * 24)}
        initialY={savedGeo?.y ?? (56 + idx * 24)}
        initialWidth={savedGeo?.width ?? 340}
        initialHeight={savedGeo?.height}
        initialIsWideMode={savedGeo?.isWideMode ?? false}
        initialIsMinimized={savedGeo?.isMinimized ?? false}
        onClose={(id) => chartDrawingController.removePlan(id)}
        onHide={() => chartDrawingController.setThesisCardsVisible(false)}
        onEdit={(id) => onEditPlan?.(id)}
        onGeometryChange={handleThesisCardGeometryChange}
      />
    {/each}
  {/if}

  <ChartContextMenu
    isOpen={isContextMenuOpen}
    x={contextMenuX}
    y={contextMenuY}
    {symbol}
    price={contextMenuPrice}
    time={contextMenuTime}
    onCreateAlert={() => { if (contextMenuPrice) onRequestCreateAlert?.(symbol, contextMenuPrice); isContextMenuOpen = false; }}
    onDrawHorizontalLine={() => { chartDrawingController.setTool('hline'); isContextMenuOpen = false; }}
    onResetChartScale={() => controller.fitChart()}
    onClose={() => (isContextMenuOpen = false)}
  />

  <!-- Bilah Toolbar Preset Rentang Waktu (1D, 5D, 1M, 3M, 6M, YTD, 1Y, ALL) -->
  <div class="chart-viewport-footer-presets">
    <RangePresetBar {controller} />
  </div>
</div>
