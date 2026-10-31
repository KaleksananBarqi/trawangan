<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import './chart.css';
  import { Scissors, Bell, X, WifiOff, Edit3 } from '@lucide/svelte';
  import { ChartSessionController } from '../services/chartSessionController';
  import { chartDrawingController, type GestureCreationState } from '../services/chartDrawingController';
  import { priceScaleOverlayController } from '../services/priceScaleOverlayController';
  import { alertService } from '../services/alertService';
  import { marketFeed } from '../services/market';
  import { replaySession } from '../services/replay';
  import { findNearestOhlcPoint } from '../services/priceSnapService';
  import { isEditableElement } from '../services/commandDispatcher';
  import { isTradingPlanText } from '../services/planParserService';
  import ChartContextMenu from './ChartContextMenu.svelte';
  import FloatingThesisCard from './FloatingThesisCard.svelte';
  import type {
    Timeframe, ActiveIndicatorInfo, DrawingToolType, SnapMode, MultiChartSyncConfig,
    Candle, StrategyPerformanceSummary, PriceAlert, ThemePresetId, SavedWorkspace
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
    showCurrentPriceLine?: boolean; showVolume?: boolean; showIndicatorPriceLabels?: boolean; showDrawingPriceLabels?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
    onReplayStateChange?: (state: ReplayStateInfo) => void;
    onCutoffSelected?: (timestamp: number) => void; onCutoffCancelled?: () => void;
    onStrategyUpdate?: (summary: StrategyPerformanceSummary) => void;
    onRequestCreateAlert?: (symbol: string, price: number) => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
    onOpenImportPlan?: (initialText?: string) => void;
    themePreset?: ThemePresetId; fontSize?: number; timezone?: string;
    customBullColor?: string; customBearColor?: string;
  }

  let {
    symbol, timeframe, defaultTimeframe = '15m', layout, providerId = 'binance',
    themePreset = 'signature', fontSize = 12, timezone = 'Asia/Jakarta',
    customBullColor, customBearColor,
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    showWatermark = true, showCurrentPriceLine = true, showVolume = true, showIndicatorPriceLabels = true,
    showDrawingPriceLabels = true, onActiveIndicatorsChange, onActiveCellChange,
    onCutoffCancelled, onRequestCreateAlert, onRequestEditAlert, onOpenImportPlan,
  }: Props = $props();

  let chartContainer: HTMLDivElement | null = $state(null);
  let isMounted = $state(false);

  const controller = new ChartSessionController({
    symbol, timeframe, defaultTimeframe, layout, providerId, themePreset,
    fontSize, timezone, customBullColor, customBearColor,
    showCurrentPriceLine, showVolume, syncConfig, onActiveCellChange, onActiveIndicatorsChange
  });

  let feedConnectionStatus = $state(marketFeed.getConnectionStatus());
  let isDismissedConnectionWarning = $state(false);
  let isSelectingCutoff = $state(false);
  let lastHoveredPrice = $state<number | null>(null);
  let cutlineX = $state<number | null>(null);
  let cutlineY = $state<number | null>(null);
  let hoveredBarDateText = $state('');
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
    const clean = symbol.replace('.P', '').toUpperCase();
    return allAlerts.filter((a) => a.symbol.replace('.P', '').toUpperCase() === clean);
  });
  let draggingAlertId = $state<string | null>(null);
  let draggingAlertPrice = $state<number | null>(null);
  let drawingPriceBadges = $state<PriceScaleBadge[]>([]);
  let indicatorPriceBadges = $state<PriceScaleBadge[]>([]);
  let activePlans = $state<Array<any>>([]);
  let showThesisCards = $state(true);

  let unsubAlerts: (() => void) | null = null;
  let unsubDrawingState: (() => void) | null = null;
  let unsubOverlay: (() => void) | null = null;
  let unsubFeedConnection: (() => void) | null = null;

  function scheduleBadgePositionUpdate() { priceScaleOverlayController.scheduleUpdate(); }
  function formatPrice(p: number | null): string { return priceScaleOverlayController.formatPrice(p); }
  function getPriceY(p: number | null): number | null { return p !== null ? priceScaleOverlayController.getPriceY(p) : null; }

  // Explicit prop read guarantees Svelte 5 dependency registration on initial run
  $effect(() => { const s = symbol, p = providerId; if (isMounted) controller.setSymbol(s, undefined, p); });
  $effect(() => { const tf = timeframe; if (isMounted) controller.setTimeframe(tf); });
  $effect(() => { const l = layout; if (isMounted && l) controller.setLayout(l); });
  $effect(() => { const sc = syncConfig; if (isMounted && sc) controller.syncLayout(sc); });
  $effect(() => { const tp = themePreset, fs = fontSize, cb = customBullColor, cr = customBearColor; if (isMounted) controller.setTheme(tp, fs, { bullColor: cb, bearColor: cr }); });
  $effect(() => { const tz = timezone; if (isMounted && tz) controller.setTimezone(tz); });
  $effect(() => {
    const show = showDrawingPriceLabels;
    if (isMounted) {
      priceScaleOverlayController.updateDrawings(chartDrawingController.getSnapshot().activeDrawings || [], show);
      scheduleBadgePositionUpdate();
    }
  });
  $effect(() => { const pl = showCurrentPriceLine; if (isMounted) controller.setShowCurrentPriceLine(pl); });
  $effect(() => { const v = showVolume; if (isMounted && v !== undefined) controller.setShowVolume(v); });
  $effect(() => {
    const wm = showWatermark;
    if (isMounted) for (const c of controller.getAllCells()) c?.setWatermarkVisible?.(wm);
  });
  $effect(() => {
    const ind = controller.getActiveIndicators(), lbl = showIndicatorPriceLabels;
    priceScaleOverlayController.updateIndicators(ind, lbl);
  });

  onMount(() => {
    isMounted = true;
    if (chartContainer) {
      controller.attach(chartContainer);
      const ws = controller.getWorkspace();
      if (ws) {
        chartDrawingController.attachWorkspace(ws, () => symbol, () => timeframe, () => providerId);
        priceScaleOverlayController.attachChart(chartContainer, ws);
      }
    }
    replaySession.bindDriver({
      getBounds: () => getReplayBounds(),
      start: async (targetTime: number) => startReplay(targetTime),
      play: (speedMs: number) => { controller.getWorkspace()?.replay?.play?.(speedMs); },
      pause: () => { controller.getWorkspace()?.replay?.pause?.(); },
      step: () => { controller.getWorkspace()?.replay?.step?.(); },
      stepBack: () => {},
      stop: () => stopReplay(),
      getState: () => {
        const r = controller.getWorkspace()?.replay;
        return r ? { active: Boolean(r.active), playing: Boolean(r.playing), cursorTime: r.cursorTime ?? null, remaining: r.remainingBars ?? 0 } : null;
      },
      enableCutoffVisual: () => {},
      cancelCutoffVisual: () => {}
    });
    unsubAlerts = alertService.subscribe((alerts) => { allAlerts = alerts; scheduleBadgePositionUpdate(); });
    unsubDrawingState = chartDrawingController.subscribe((st) => {
      isHandpullActive = st.activeTool === 'handpull';
      const prevGesture = isGestureActive;
      isGestureActive = chartDrawingController.isGestureMode();
      if (isGestureActive && !prevGesture) {
        syncInkCanvasSize();
      }
      gestureCreationState = st.lastGestureCreation;
      activePlans = st.activePlans || [];
      showThesisCards = st.showThesisCards ?? true;
      priceScaleOverlayController.updateDrawings(st.activeDrawings || [], showDrawingPriceLabels);
      scheduleBadgePositionUpdate();
    });
    unsubOverlay = priceScaleOverlayController.subscribe((coords) => {
      drawingPriceBadges = coords.drawingPriceBadges;
      indicatorPriceBadges = coords.indicatorPriceBadges;
    });
    unsubFeedConnection = marketFeed.onConnectionChange((st: FeedConnectionStatus) => {
      feedConnectionStatus = st; if (st.state === 'connected') isDismissedConnectionWarning = false;
    });
    window.addEventListener('paste', handleCanvasPaste);
  });

  onDestroy(() => {
    isMounted = false; unsubAlerts?.(); unsubDrawingState?.(); unsubOverlay?.(); unsubFeedConnection?.();
    window.removeEventListener('paste', handleCanvasPaste);
    replaySession.bindDriver(null); controller.destroy();
  });

  export function enableCutoffSelection(): void { isSelectingCutoff = true; }
  export function cancelCutoffSelection(): void {
    isSelectingCutoff = false; cutlineX = null; cutlineY = null; onCutoffCancelled?.();
  }
  export function isCutoffSelectionActive(): boolean { return isSelectingCutoff; }
  export function getReplayBounds(): { first: number; last: number } | null {
    return controller.getWorkspace()?.replay?.bounds || null;
  }
  export function getReplayState(): any { return replaySession.getSnapshot(); }
  export async function startReplay(fromTimestamp?: number): Promise<boolean> {
    const ws = controller.getWorkspace();
    if (!ws?.replay) return false;
    try {
      if (fromTimestamp) ws.replay.start({ from: fromTimestamp }); else ws.replay.start();
      return true;
    } catch (_) { return false; }
  }
  export function playReplay(speed = 1): void { replaySession.play(speed); }
  export function pauseReplay(): void { replaySession.pause(); }
  export function stepReplay(): void { replaySession.step(); }
  export function stopReplay(): void {
    const ws = controller.getWorkspace();
    if (ws?.replay?.active) ws.replay.stop();
    replaySession.close();
  }
  export function isReplaying(): boolean { return replaySession.getSnapshot().active; }

  let cachedCandles = $state<Candle[]>([]);
  let snapInfo = $state<{
    snapped: boolean;
    type: 'high' | 'low' | 'open' | 'close' | null;
    candleY?: number;
    candleX?: number;
    price: number;
  } | null>(null);

  async function refreshCachedCandles() {
    try {
      const bars = await marketFeed.getCandles(symbol, timeframe, 300);
      if (Array.isArray(bars) && bars.length > 0) {
        cachedCandles = bars;
      }
    } catch (_) {}
  }

  $effect(() => {
    const s = symbol, tf = timeframe;
    if (isMounted) {
      refreshCachedCandles();
    }
  });

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

  // Delegasi tunggal ke ChartSessionController
  export function getPaneWeights(): number[] { return controller.getPaneWeights(); }
  export function applyPaneWeights(weights: number[]): boolean { return controller.applyPaneWeights(weights); }
  export function getPriceScaleState(): any { return controller.getPriceScaleState(); }
  export function applyPriceScaleState(state: any): boolean { return controller.applyPriceScaleState(state); }
  export function getPriceStyle(): string { return controller.getPriceStyle(); }
  export function setPriceStyle(style: string): void { controller.setPriceStyle(style); }
  export function setTimeframe(tf: Timeframe): void { controller.setTimeframe(tf); }
  export function getBarSpacing(): number { return controller.getBarSpacing(); }
  export function setBarSpacing(spacing: number): void { controller.setBarSpacing(spacing); }
  export function saveWorkspaceState(name?: string) { return controller.saveWorkspaceState(name); }
  export function loadWorkspaceState(snapshot: SavedWorkspace) { return controller.loadWorkspaceState(snapshot); }
  export function saveCurrentChartSettingsAsDefault(btn?: HTMLElement) { return controller.saveCurrentSettingsAsDefault(btn); }
  export function resetChartSettingsToFactory() { return controller.resetSettingsToFactory(); }
  export function enforceCurrentPriceLine(): void { controller.enforceCurrentPriceLine(); }
  export function enforceCurrentPriceLineOnCell(cell: any): void { controller.enforceCurrentPriceLine(cell); }
  export function applyWorkspaceTimezone(tz: string): void { controller.setTimezone(tz); }
  export function getActiveIndicators(): ActiveIndicatorInfo[] { return controller.getActiveIndicators(); }
  export function getChartScreenshotCanvas(scope: 'active' | 'all' = 'active'): HTMLCanvasElement | null {
    return controller.getScreenshotCanvas(scope);
  }
  export function addPineIndicator(src: string, t?: string, i?: Record<string, any>, p?: Record<string, any>) {
    return controller.addPineIndicator(src, t, i, p);
  }
  export function removeIndicator(id: string): void { controller.removeIndicator(id); }
  export function clearAllIndicators(): void { controller.clearAllIndicators(); }
  export function toggleIndicatorVisibility(id: string): void { controller.toggleIndicatorVisibility(id); }
  export function getIndicatorSource(id: string): string | undefined { return controller.getIndicatorSource(id); }
  export function syncIndicatorsFromActiveCell(): void { controller.syncIndicatorsFromActiveCell(); }
  export async function getActiveCandles(limit = 1000): Promise<Candle[]> { return marketFeed.getCandles(symbol, timeframe, limit); }
  export function fitChart(): void {
    const chart = (controller.getWorkspace()?.active || controller.getAllCells()[0])?.chart;
    if (typeof chart?.fit === 'function') chart.fit();
  }
  export function getLastHoveredPrice(): number | null { return lastHoveredPrice; }
  export function openChartSettings(section: string = 'Symbol'): void {
    const cell = controller.getWorkspace()?.active || controller.getAllCells()[0];
    const r = cell?.chart?.renderer?.renderer || cell?.chart?.renderer;
    if (r?.openSettings) r.openSettings(section);
    else if (r?.openSettingsDialog) r.openSettingsDialog(section);
  }

  // Delegasi Drawing ke ChartDrawingController
  export function setDrawingTool(tool: DrawingToolType | null): void { chartDrawingController.setTool(tool); }
  export function setSnapMode(mode: SnapMode): void { chartDrawingController.setSnapMode(mode); }
  export function setStayMode(stay: boolean): void { chartDrawingController.setStayMode(stay); }
  export function undoDrawing(): void { chartDrawingController.undo(); }
  export function redoDrawing(): void { chartDrawingController.redo(); }
  export async function clearAllDrawings(): Promise<void> { await chartDrawingController.clearAll(); }
  export function lockAllDrawings(lock: boolean): void { chartDrawingController.setLock(lock); }
  export function hideAllDrawings(hide: boolean): void { chartDrawingController.setHide(hide); }
  export function setDrawingsLocked(lock: boolean): void { chartDrawingController.setLock(lock); }
  export function setDrawingsHidden(hide: boolean): void { chartDrawingController.setHide(hide); }

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
      onOpenImportPlan?.(text);
    }
  }

  export function setShowVolume(show: boolean): void { controller.setShowVolume(show); }
</script>

<svelte:window onkeydown={handleWindowKeyDown} onkeyup={handleWindowKeyUp} />

<div 
  class="chart-wrapper {isSelectingCutoff ? 'selecting-cutoff' : ''} {isHandpullActive ? 'handpull-mode' : ''} {isGestureActive ? 'gesture-mode' : ''}"
  oncontextmenu={handleContainerContextMenu}
  onwheel={scheduleBadgePositionUpdate}
  onpointerdown={scheduleBadgePositionUpdate}
  onpaste={handleCanvasPaste}
  role="region"
  aria-label="Area Grafik Utama"
>
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
          Koneksi feed ke <b>{feedConnectionStatus.providerId.toUpperCase()}</b> {feedConnectionStatus.state === 'blocked' ? 'terhambat (diblokir ISP)' : 'tersendat'}. Ingin beralih ke Indodax atau coba lagi?
        </span>
      </div>
      <div class="warning-actions">
        <button type="button" class="btn-switch-indodax" onclick={() => { marketFeed.setActiveProvider('indodax'); onActiveCellChange?.({ symbol: symbol.toUpperCase().endsWith('IDR') ? symbol : 'BTCIDR', timeframe }); }}>Beralih ke Indodax</button>
        <button type="button" class="btn-retry-feed" onclick={() => marketFeed.resetConnectionError()}>Coba Ulang</button>
        <button type="button" class="btn-dismiss-warning" title="Tutup" onclick={() => (isDismissedConnectionWarning = true)}><X size={14} /></button>
      </div>
    </div>
  {/if}

  {#each activeSymbolAlerts as a (a.id)}
    {@const isDragging = draggingAlertId === a.id}
    {@const displayPrice = isDragging && draggingAlertPrice ? draggingAlertPrice : a.targetPrice}
    {@const yPos = getPriceY(displayPrice)}
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
          <span class="badge-price">${formatPrice(displayPrice)}</span>
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
      title="Magnet terkunci ke {snapInfo.type?.toUpperCase()}: ${formatPrice(snapInfo.price)}"
    >
      <div class="snap-halo-dot"></div>
      <div class="snap-halo-pulse"></div>
    </div>
  {/if}

  {#if showDrawingPriceLabels}
    {#each drawingPriceBadges as badge (badge.id)}
      {@const yPos = getPriceY(badge.price)}
      {#if yPos !== null && yPos >= 0}
        <div class="price-scale-badge-item mono-nums" style="top: {yPos}px; background-color: {badge.bgColor || badge.color}; color: #ffffff; border: 1px solid {badge.color}66;" title="{badge.title || badge.label}: ${formatPrice(badge.price)}">
          {#if badge.title}<span class="badge-tag">{badge.title}</span>{/if}
          <span class="badge-num">${formatPrice(badge.price)}</span>
        </div>
      {/if}
    {/each}
  {/if}

  {#if showIndicatorPriceLabels}
    {#each indicatorPriceBadges as badge (badge.id)}
      {@const yPos = getPriceY(badge.price)}
      {#if yPos !== null && yPos >= 0}
        <div class="price-scale-badge-item indicator-badge mono-nums" style="top: {yPos}px; border-left: 3px solid {badge.color}; background-color: {badge.bgColor || '#0f172a'}; color: {badge.color}; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08);" title="{badge.title || badge.label}: ${formatPrice(badge.price)}">
          {#if badge.title}<span class="badge-tag">{badge.title}</span>{/if}
          <span class="badge-num">${formatPrice(badge.price)}</span>
        </div>
      {/if}
    {/each}
  {/if}

  {#if isSelectingCutoff}
    {#if cutlineX !== null}
      <div class="vertical-cutline" style="left: {cutlineX}px;">
        <div class="cutline-scissors-badge obsidian-card mono-nums" style="top: {Math.max(48, Math.min((cutlineY ?? 80) - 28, 420))}px;">
          <Scissors size={12} class="badge-cut-icon" />
          <span>{hoveredBarDateText || 'Klik lilin untuk potong'}</span>
        </div>
      </div>
    {/if}
    <div class="cutoff-overlay-hint">
      <div class="hint-pill obsidian-card">
        <Scissors size={13} class="hint-icon" />
        <span class="hint-text mono-nums">KLIK LILIN DI GRAFIK UNTUK MEMULAI REPLAY DARI TITIK TERSEBUT</span>
        <button type="button" class="cancel-hint-btn" onclick={cancelCutoffSelection}>Batal (Esc)</button>
      </div>
    </div>
  {/if}

  {#if showThesisCards}
    {#each activePlans as plan, idx (plan.id)}
      <FloatingThesisCard
        {plan}
        initialX={16 + idx * 24}
        initialY={56 + idx * 24}
        onClose={(id) => chartDrawingController.removePlan(id)}
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
    hasActivePlans={activePlans.length > 0}
    {showThesisCards}
    onCreateAlert={() => { if (contextMenuPrice) onRequestCreateAlert?.(symbol, contextMenuPrice); isContextMenuOpen = false; }}
    onDrawHorizontalLine={() => { chartDrawingController.setTool('hline'); isContextMenuOpen = false; }}
    onResetChartScale={fitChart}
    onOpenSettings={() => { openChartSettings(); isContextMenuOpen = false; }}
    onOpenImportPlan={() => { isContextMenuOpen = false; onOpenImportPlan?.(); }}
    onToggleThesisCards={() => chartDrawingController.toggleThesisCardsVisible()}
    onClose={() => (isContextMenuOpen = false)}
  />
</div>
