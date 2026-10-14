<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import './chart.css';
  import { Scissors, Bell, X, WifiOff } from '@lucide/svelte';
  import { ChartSessionController } from '../services/chartSessionController';
  import { chartDrawingController } from '../services/chartDrawingController';
  import { priceScaleOverlayController } from '../services/priceScaleOverlayController';
  import { alertService } from '../services/alertService';
  import { marketFeed } from '../services/market';
  import { replaySession } from '../services/replay';
  import ChartContextMenu from './ChartContextMenu.svelte';
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
    showCurrentPriceLine?: boolean; showIndicatorPriceLabels?: boolean; showDrawingPriceLabels?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
    onReplayStateChange?: (state: ReplayStateInfo) => void;
    onCutoffSelected?: (timestamp: number) => void; onCutoffCancelled?: () => void;
    onStrategyUpdate?: (summary: StrategyPerformanceSummary) => void;
    onRequestCreateAlert?: (symbol: string, price: number) => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
    themePreset?: ThemePresetId; fontSize?: number; timezone?: string;
  }

  let {
    symbol, timeframe, defaultTimeframe = '15m', layout, providerId = 'binance',
    themePreset = 'signature', fontSize = 12, timezone = 'Asia/Jakarta',
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    showWatermark = true, showCurrentPriceLine = true, showIndicatorPriceLabels = true,
    showDrawingPriceLabels = true, onActiveIndicatorsChange, onActiveCellChange,
    onCutoffCancelled, onRequestCreateAlert,
  }: Props = $props();

  let chartContainer: HTMLDivElement | null = $state(null);
  let isMounted = false;

  const controller = new ChartSessionController({
    symbol, timeframe, defaultTimeframe, layout, providerId, themePreset,
    fontSize, timezone, showCurrentPriceLine, syncConfig, onActiveCellChange, onActiveIndicatorsChange
  });

  let feedConnectionStatus = $state(marketFeed.getConnectionStatus());
  let isDismissedConnectionWarning = $state(false);
  let isSelectingCutoff = $state(false);
  let lastHoveredPrice = $state<number | null>(null);
  let cutlineX = $state<number | null>(null);
  let cutlineY = $state<number | null>(null);
  let hoveredBarDateText = $state('');
  let isHandpullActive = $state(false);
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

  let unsubAlerts: (() => void) | null = null;
  let unsubDrawingState: (() => void) | null = null;
  let unsubOverlay: (() => void) | null = null;
  let unsubFeedConnection: (() => void) | null = null;

  function scheduleBadgePositionUpdate() { priceScaleOverlayController.scheduleUpdate(); }
  function formatPrice(p: number | null): string { return priceScaleOverlayController.formatPrice(p); }
  function getPriceY(p: number | null): number | null { return p !== null ? priceScaleOverlayController.getPriceY(p) : null; }

  $effect(() => { if (isMounted) controller.setSymbol(symbol, timeframe, providerId); });
  $effect(() => { if (isMounted && layout) controller.setLayout(layout); });
  $effect(() => { if (isMounted && syncConfig) controller.syncLayout(syncConfig); });
  $effect(() => { if (isMounted) controller.setTheme(themePreset, fontSize); });
  $effect(() => { if (isMounted && timezone) controller.setTimezone(timezone); });
  $effect(() => { if (isMounted) controller.setShowCurrentPriceLine(showCurrentPriceLine); });
  $effect(() => {
    if (isMounted) {
      for (const cell of controller.getAllCells()) {
        if (typeof cell?.setWatermarkVisible === 'function') cell.setWatermarkVisible(showWatermark);
      }
    }
  });
  $effect(() => {
    priceScaleOverlayController.updateIndicators(controller.getActiveIndicators(), showIndicatorPriceLabels);
  });

  onMount(() => {
    isMounted = true;
    if (chartContainer) {
      controller.attach(chartContainer);
      const ws = controller.getWorkspace();
      if (ws) {
        chartDrawingController.attachWorkspace(ws, () => symbol, () => timeframe);
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
      scheduleBadgePositionUpdate();
    });
    unsubOverlay = priceScaleOverlayController.subscribe((coords) => {
      drawingPriceBadges = coords.drawingPriceBadges;
      indicatorPriceBadges = coords.indicatorPriceBadges;
    });
    unsubFeedConnection = marketFeed.onConnectionChange((st: FeedConnectionStatus) => {
      feedConnectionStatus = st; if (st.state === 'connected') isDismissedConnectionWarning = false;
    });
  });

  onDestroy(() => {
    isMounted = false; unsubAlerts?.(); unsubDrawingState?.(); unsubOverlay?.(); unsubFeedConnection?.();
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

  function handleAlertPointerDown(e: PointerEvent, alert: PriceAlert) {
    e.stopPropagation(); draggingAlertId = alert.id; draggingAlertPrice = alert.targetPrice;
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }
  function handleAlertPointerMove(e: PointerEvent, alert: PriceAlert) {
    if (draggingAlertId !== alert.id) return;
    const p = priceScaleOverlayController.getPriceFromClientY(e.clientY);
    if (p !== null && p > 0) { draggingAlertPrice = p; scheduleBadgePositionUpdate(); }
  }
  function handleAlertPointerUp(e: PointerEvent, alert: PriceAlert) {
    if (draggingAlertId === alert.id) {
      if (draggingAlertPrice && Math.abs(draggingAlertPrice - alert.targetPrice) > 0.000001) {
        alertService.updateAlert(alert.id, { targetPrice: draggingAlertPrice });
      }
      draggingAlertId = null; draggingAlertPrice = null;
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
</script>

<div 
  class="chart-wrapper {isSelectingCutoff ? 'selecting-cutoff' : ''} {isHandpullActive ? 'handpull-mode' : ''}"
  oncontextmenu={handleContainerContextMenu}
  onwheel={scheduleBadgePositionUpdate}
  onpointerdown={scheduleBadgePositionUpdate}
  onpointermove={scheduleBadgePositionUpdate}
  role="region"
  aria-label="Area Grafik Utama"
>
  <div bind:this={chartContainer} class="vela-container"></div>

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
        <div class="alert-line-badge mono-nums {isDragging ? 'dragging' : ''}" onpointerdown={(e) => handleAlertPointerDown(e, a)} onpointermove={(e) => handleAlertPointerMove(e, a)} onpointerup={(e) => handleAlertPointerUp(e, a)} onpointercancel={(e) => handleAlertPointerUp(e, a)} title="Tahan & geser untuk mengubah harga">
          <Bell size={10} class="badge-bell" />
          <span class="badge-price">${formatPrice(displayPrice)}</span>
          {#if a.label}<span class="badge-lbl">{a.label}</span>{/if}
          <button type="button" class="badge-del-btn" title="Hapus Alert" onclick={(e) => { e.stopPropagation(); alertService.deleteAlert(a.id); }}><X size={10} /></button>
        </div>
      </div>
    {/if}
  {/each}

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

  <ChartContextMenu
    isOpen={isContextMenuOpen}
    x={contextMenuX}
    y={contextMenuY}
    {symbol}
    price={contextMenuPrice}
    time={contextMenuTime}
    onCreateAlert={() => { if (contextMenuPrice) onRequestCreateAlert?.(symbol, contextMenuPrice); isContextMenuOpen = false; }}
    onDrawHorizontalLine={() => { chartDrawingController.setTool('hline'); isContextMenuOpen = false; }}
    onResetChartScale={fitChart}
    onOpenSettings={() => { openChartSettings(); isContextMenuOpen = false; }}
    onClose={() => (isContextMenuOpen = false)}
  />
</div>
