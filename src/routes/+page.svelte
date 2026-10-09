<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Chart from '../lib/components/Chart.svelte';
  import DrawingToolbar from '../lib/components/DrawingToolbar.svelte';
  import WatchlistPanel from '../lib/components/WatchlistPanel.svelte';
  import ProviderModal from '../lib/components/ProviderModal.svelte';
  import IndicatorModal from '../lib/components/IndicatorModal.svelte';
  import PineEditor from '../lib/components/PineEditor.svelte';
  import ActiveIndicatorsBar from '../lib/components/ActiveIndicatorsBar.svelte';
  import { fetch24hTicker } from '../lib/services/marketProvider';
  import type {
    TickerInfo,
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig
  } from '../lib/types/market';
  import { Activity, Cpu, Wifi, Layers } from '@lucide/svelte';

  let activeSymbol = $state('BTCUSDT');
  let activeTimeframe = $state<Timeframe>('1m');
  let currentLayout = $state('1');
  let ticker = $state<TickerInfo | null>(null);

  // Multi-Chart Sync State
  let syncConfig = $state<MultiChartSyncConfig>({
    crosshair: true,
    symbol: false,
    drawings: true,
  });

  // Modals & Panels Visibility State
  let isProviderModalOpen = $state(false);
  let isIndicatorModalOpen = $state(false);
  let isPineEditorOpen = $state(false);
  let isDrawingToolbarVisible = $state(true);
  let isWatchlistOpen = $state(true);

  // Drawing Tools State
  let activeDrawingTool = $state<DrawingToolType | null>('cursor');
  let snapMode = $state<SnapMode>('off');
  let stayMode = $state(false);
  let isDrawingsLocked = $state(false);
  let isDrawingsHidden = $state(false);

  // Pine Editor Content State
  let editorInitialCode = $state('');
  let editorInitialTitle = $state('Custom Indicator');

  // Active Indicators State
  let activeIndicators = $state<ActiveIndicatorInfo[]>([]);
  let chartComponent: any = $state(null);

  let tickerInterval: any = null;

  async function updateTicker() {
    try {
      ticker = await fetch24hTicker(activeSymbol);
    } catch (e) {
      console.warn('Ticker update failed:', e);
    }
  }

  $effect(() => {
    if (activeSymbol) {
      updateTicker();
    }
  });

  onMount(() => {
    updateTicker();
    tickerInterval = setInterval(updateTicker, 4000);

    // Keyboard shortcuts global untuk trading & drawing
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else {
          e.preventDefault();
          handleRedo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        handleSelectTool('cursor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  onDestroy(() => {
    if (tickerInterval) clearInterval(tickerInterval);
  });

  function handleSymbolChange(newSym: string) {
    activeSymbol = newSym;
  }

  function handleTimeframeChange(newTf: Timeframe) {
    activeTimeframe = newTf;
  }

  function handleLayoutChange(newLayout: string) {
    currentLayout = newLayout;
  }

  // Multi-Chart Cell Focus Callback
  function handleActiveCellChange(cellInfo: { symbol: string; timeframe: Timeframe }) {
    if (cellInfo.symbol && cellInfo.symbol !== activeSymbol) {
      activeSymbol = cellInfo.symbol;
    }
    if (cellInfo.timeframe && cellInfo.timeframe !== activeTimeframe) {
      activeTimeframe = cellInfo.timeframe;
    }
  }

  function handleToggleSyncCrosshair() {
    syncConfig.crosshair = !syncConfig.crosshair;
  }

  function handleToggleSyncDrawings() {
    syncConfig.drawings = !syncConfig.drawings;
  }

  // ─── Drawing Tools Handlers ───

  function handleSelectTool(tool: DrawingToolType | null) {
    activeDrawingTool = tool;
    if (chartComponent) {
      chartComponent.setDrawingTool(tool);
    }
  }

  function handleToggleSnap() {
    const nextSnap: SnapMode = snapMode === 'off' ? 'weak' : snapMode === 'weak' ? 'strong' : 'off';
    snapMode = nextSnap;
    if (chartComponent) {
      chartComponent.setSnapMode(nextSnap);
    }
  }

  function handleToggleStay() {
    stayMode = !stayMode;
    if (chartComponent) {
      chartComponent.setStayMode(stayMode);
    }
  }

  function handleToggleLock() {
    isDrawingsLocked = !isDrawingsLocked;
    if (chartComponent) {
      chartComponent.lockAllDrawings(isDrawingsLocked);
    }
  }

  function handleToggleHide() {
    isDrawingsHidden = !isDrawingsHidden;
    if (chartComponent) {
      chartComponent.hideAllDrawings(isDrawingsHidden);
    }
  }

  function handleUndo() {
    if (chartComponent) {
      chartComponent.undoDrawing();
    }
  }

  function handleRedo() {
    if (chartComponent) {
      chartComponent.redoDrawing();
    }
  }

  function handleClearDrawings() {
    if (confirm('Hapus seluruh garis dan analisis gambar pada chart ini?')) {
      if (chartComponent) {
        chartComponent.clearAllDrawings();
      }
    }
  }

  // ─── Indicator Handlers ───

  async function handleAddIndicator(code: string, title: string): Promise<boolean> {
    if (!chartComponent) return false;
    try {
      return await chartComponent.addPineIndicator(code, title);
    } catch (err) {
      console.error('Error saat menambah indikator ke chart:', err);
      return false;
    }
  }

  function handleOpenInEditor(code: string, title: string) {
    editorInitialCode = code;
    editorInitialTitle = title;
    isPineEditorOpen = true;
  }

  function handleToggleIndicatorVisibility(id: string) {
    if (chartComponent) {
      chartComponent.toggleIndicatorVisibility(id);
    }
  }

  function handleRemoveIndicator(id: string) {
    if (chartComponent) {
      chartComponent.removeIndicator(id);
    }
  }

  function handleEditIndicator(id: string) {
    if (!chartComponent) return;
    const source = chartComponent.getIndicatorSource(id);
    const ind = activeIndicators.find((i) => i.id === id);
    if (source) {
      handleOpenInEditor(source, ind?.title || 'Edit Indicator');
    }
  }
</script>

<div class="app-layout">
  <!-- Top Navigation & Controls Header -->
  <Header
    {activeSymbol}
    {activeTimeframe}
    {ticker}
    {currentLayout}
    {syncConfig}
    activeIndicatorCount={activeIndicators.length}
    {isPineEditorOpen}
    {isDrawingToolbarVisible}
    {isWatchlistOpen}
    onSymbolChange={handleSymbolChange}
    onTimeframeChange={handleTimeframeChange}
    onLayoutChange={handleLayoutChange}
    onToggleSyncCrosshair={handleToggleSyncCrosshair}
    onToggleSyncDrawings={handleToggleSyncDrawings}
    onToggleDrawingToolbar={() => (isDrawingToolbarVisible = !isDrawingToolbarVisible)}
    onToggleWatchlist={() => (isWatchlistOpen = !isWatchlistOpen)}
    onOpenProviderModal={() => (isProviderModalOpen = true)}
    onOpenIndicatorModal={() => (isIndicatorModalOpen = true)}
    onTogglePineEditor={() => (isPineEditorOpen = !isPineEditorOpen)}
  />

  <!-- Main Chart Canvas & Workspaces Area -->
  <main class="chart-canvas-area {isWatchlistOpen ? 'with-watchlist' : ''}">
    <!-- Vertical Drawing Toolbar (Left) -->
    {#if isDrawingToolbarVisible}
      <DrawingToolbar
        activeTool={activeDrawingTool}
        {snapMode}
        {stayMode}
        isLocked={isDrawingsLocked}
        isHidden={isDrawingsHidden}
        onSelectTool={handleSelectTool}
        onToggleSnap={handleToggleSnap}
        onToggleStay={handleToggleStay}
        onToggleLock={handleToggleLock}
        onToggleHide={handleToggleHide}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClearDrawings}
      />
    {/if}

    <!-- Active Indicators Legend Bar (Top Left) -->
    <ActiveIndicatorsBar
      indicators={activeIndicators}
      onToggleVisibility={handleToggleIndicatorVisibility}
      onEditIndicator={handleEditIndicator}
      onRemoveIndicator={handleRemoveIndicator}
    />

    <!-- Multi-Chart Canvas Engine -->
    <Chart
      bind:this={chartComponent}
      symbol={activeSymbol}
      timeframe={activeTimeframe}
      layout={currentLayout}
      {syncConfig}
      onActiveIndicatorsChange={(list) => (activeIndicators = list)}
      onActiveCellChange={handleActiveCellChange}
    />

    <!-- Dockable Collapsible Watchlist Panel (Right) -->
    <WatchlistPanel
      isOpen={isWatchlistOpen}
      {activeSymbol}
      onSelectSymbol={handleSymbolChange}
      onToggleCollapse={() => (isWatchlistOpen = !isWatchlistOpen)}
    />

    <!-- In-App Pine Script Editor Drawer (Bottom) -->
    <PineEditor
      isOpen={isPineEditorOpen}
      initialCode={editorInitialCode}
      initialTitle={editorInitialTitle}
      onClose={() => (isPineEditorOpen = false)}
      onAddToChart={handleAddIndicator}
    />
  </main>

  <!-- Bottom Workspace Status Bar -->
  <footer class="status-bar glass-panel mono-nums">
    <div class="status-left">
      <span class="status-indicator live">
        <span class="pulse-dot"></span>
        FEED: BINANCE LIVE
      </span>
      <span class="status-item">
        <Wifi size={12} />
        LATENCY: 14ms
      </span>
      <span class="status-item">
        <Activity size={12} />
        WEBGL2 HARDWARE ACCELERATED
      </span>
    </div>

    <div class="status-right">
      <span class="status-item">
        <Cpu size={12} />
        PINETS RUNTIME (WORKER)
      </span>
      <span class="status-item">
        <Layers size={12} />
        LAYOUT: {currentLayout.toUpperCase()} {currentLayout !== '1' ? (syncConfig.drawings ? '(SYNC ON)' : '(INDEPENDENT)') : ''}
      </span>
      <span class="status-badge">TAURI v2 + SVELTE 5</span>
    </div>
  </footer>

  <!-- Custom Provider Modal -->
  <ProviderModal
    isOpen={isProviderModalOpen}
    onClose={() => (isProviderModalOpen = false)}
  />

  <!-- Indicator Library Modal -->
  <IndicatorModal
    isOpen={isIndicatorModalOpen}
    onClose={() => (isIndicatorModalOpen = false)}
    onSelectIndicator={handleAddIndicator}
    onOpenInEditor={handleOpenInEditor}
  />
</div>

<style>
  .app-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-darkest);
    color: var(--text-main);
    overflow: hidden;
    position: relative;
  }

  .chart-canvas-area {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;
    transition: padding-right 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chart-canvas-area.with-watchlist {
    padding-right: 275px;
  }

  .status-bar {
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 10px;
    color: var(--text-muted);
    border-top: 1px solid var(--border-subtle);
    z-index: 50;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .status-indicator.live {
    color: var(--bull-color);
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--bull-color);
    box-shadow: 0 0 8px var(--bull-color);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.5;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
    100% {
      opacity: 0.5;
      transform: scale(0.9);
    }
  }

  .status-badge {
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--brand-cyan);
    font-size: 9px;
    font-weight: 600;
  }
</style>
