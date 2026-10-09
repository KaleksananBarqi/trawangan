<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Chart from '../lib/components/Chart.svelte';
  import DrawingToolbar from '../lib/components/DrawingToolbar.svelte';
  import WatchlistPanel from '../lib/components/WatchlistPanel.svelte';
  import ReplayBar from '../lib/components/ReplayBar.svelte';
  import PineEditor from '../lib/components/PineEditor.svelte';
  import StatusBar from '../lib/components/StatusBar.svelte';
  import SettingsModal from '../lib/components/SettingsModal.svelte';
  import ProviderModal from '../lib/components/ProviderModal.svelte';
  import IndicatorModal from '../lib/components/IndicatorModal.svelte';
  import { fetch24hTicker } from '../lib/services/marketProvider';
  import type {
    TickerInfo,
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig,
    WorkspaceMode,
    AppSettings
  } from '../lib/types/market';
  import { saveWorkspace, type SavedWorkspace } from '../lib/services/workspaceStorage';
  import { Terminal, X, TrendingUp, Sparkles, Layers } from '@lucide/svelte';

  // ─── Core Market & Navigation State ───
  let activeSymbol = $state('BTCUSDT');
  let activeTimeframe = $state<Timeframe>('1m');
  let currentLayout = $state('1');
  let ticker = $state<TickerInfo | null>(null);

  // Dual Workspace Mode: 'terminal' vs 'pine'
  let workspaceMode = $state<WorkspaceMode>('terminal');

  // Multi-Chart Sync State
  let syncConfig = $state<MultiChartSyncConfig>({
    crosshair: true,
    symbol: false,
    drawings: true,
  });

  // Settings & Preferences State
  let appSettings = $state<AppSettings>({
    timezone: 'Asia/Jakarta',
    soundEnabled: true,
    showWatermark: true,
    showGrid: true,
    showReplayBar: false,
    theme: 'obsidian',
  });

  // Panels & Modals Visibility State
  let isSettingsModalOpen = $state(false);
  let isProviderModalOpen = $state(false);
  let isIndicatorModalOpen = $state(false);
  let isDrawingToolbarVisible = $state(true);
  let isWatchlistOpen = $state(true);
  let isReplayActive = $state(false);
  let isConsoleDrawerOpen = $state(false);

  // Replay State
  let isReplayPlaying = $state(false);
  let replayPlaybackSpeed = $state(1);

  // Drawing Tools State
  let activeDrawingTool = $state<DrawingToolType | null>('cursor');
  let snapMode = $state<SnapMode>('off');
  let stayMode = $state(false);
  let isDrawingsLocked = $state(false);
  let isDrawingsHidden = $state(false);

  // Pine Editor Content State
  let editorInitialCode = $state('');
  let editorInitialTitle = $state('Trawangan_Alpha_v6.pine');

  // Active Indicators State (bersih tanpa dummy)
  let activeIndicators = $state<ActiveIndicatorInfo[]>([]);

  const defaultWatchlistSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ];

  function handleNavigateWatchlist(direction: number) {
    const idx = defaultWatchlistSymbols.indexOf(activeSymbol);
    if (idx === -1) {
      handleSymbolChange(defaultWatchlistSymbols[0]);
    } else {
      let nextIdx = (idx + direction) % defaultWatchlistSymbols.length;
      if (nextIdx < 0) nextIdx += defaultWatchlistSymbols.length;
      handleSymbolChange(defaultWatchlistSymbols[nextIdx]);
    }
  }

  let chartComponent: any = $state(null);
  let tickerInterval: any = null;

  // Terminal Diagnostics Logs
  let systemLogs = $state<{ time: string; msg: string; level: 'info' | 'success' | 'warn' }[]>([
    { time: '16:00:01', msg: 'Trawangan Native Core initialized via Tauri v2.', level: 'info' },
    { time: '16:00:02', msg: 'SQLite embedded database connected (rusqlite 0.32).', level: 'info' },
    { time: '16:00:03', msg: 'Binance WebSocket stream active (wss://stream.binance.com).', level: 'success' },
    { time: '16:00:05', msg: 'LuxAlgo Vela WebGL2 context ready. Target: 120 FPS.', level: 'success' },
  ]);

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

    // Global keyboard shortcuts (TradingView Standard Suite)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan shortcut jika sedang fokus mengetik di input, textarea, contenteditable, atau CodeMirror
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('.cm-editor'))
      );

      // Toggle Console Logs: Ctrl + ` or Cmd + ` (selalu aktif)
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        isConsoleDrawerOpen = !isConsoleDrawerOpen;
        return;
      }

      if (isInput) return;

      // Watchlist Navigation: Space (koin berikutnya), Shift + Space (koin sebelumnya)
      if (e.code === 'Space') {
        e.preventDefault();
        handleNavigateWatchlist(e.shiftKey ? -1 : 1);
        return;
      }

      // Drawing Tool Shortcuts (Alt + T, Alt + H, Alt + F, Alt + M, Alt + Z)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 't') {
          e.preventDefault();
          handleSelectTool('trendline');
          addSystemLog('Shortcut: Tool Trendline dipilih (Alt+T)', 'info');
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          handleSelectTool('hline');
          addSystemLog('Shortcut: Tool Horizontal Line dipilih (Alt+H)', 'info');
          return;
        }
        if (k === 'f') {
          e.preventDefault();
          handleSelectTool('fibretracement');
          addSystemLog('Shortcut: Tool Fibonacci Retracement dipilih (Alt+F)', 'info');
          return;
        }
        if (k === 'm') {
          e.preventDefault();
          handleSelectTool('measure');
          addSystemLog('Shortcut: Tool Penggaris/Measure dipilih (Alt+M)', 'info');
          return;
        }
        if (k === 'z') {
          e.preventDefault();
          if (chartComponent?.fitChart) chartComponent.fitChart();
          addSystemLog('Shortcut: Reset skala/fit grafik (Alt+Z)', 'info');
          return;
        }
      }

      // Toggle Bar Replay: Shift + R
      if (e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleToggleReplay();
        return;
      }

      // Quick Timeframe Shortcuts & Esc
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') { handleTimeframeChange('1m'); return; }
        if (e.key === '5') { handleTimeframeChange('5m'); return; }
        if (e.key === '0') { handleTimeframeChange('15m'); return; }
        if (e.key.toLowerCase() === 'f') {
          if (chartComponent?.fitChart) chartComponent.fitChart();
          return;
        }
        if (e.key === 'Escape') {
          handleSelectTool('cursor');
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          handleUndo();
          return;
        }
      }

      // Undo / Redo
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
    addSystemLog(`Simbol berganti ke ${newSym}`, 'info');
  }

  function handleTimeframeChange(newTf: Timeframe) {
    activeTimeframe = newTf;
    addSystemLog(`Timeframe aktif: ${newTf}`, 'info');
  }

  function handleLayoutChange(newLayout: string) {
    currentLayout = newLayout;
    addSystemLog(`Tata letak chart: ${newLayout}`, 'info');
  }

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

  function handleWorkspaceModeChange(mode: WorkspaceMode) {
    workspaceMode = mode;
    addSystemLog(`Workspace beralih ke mode: ${mode === 'terminal' ? 'Trading Terminal' : 'Pine Script IDE'}`, 'info');
  }

  function handleUpdateSettings(newSettings: Partial<AppSettings>) {
    appSettings = { ...appSettings, ...newSettings };
    addSystemLog(`Pengaturan aplikasi diperbarui.`, 'info');
  }

  function handleSaveWorkspace(name: string) {
    saveWorkspace({
      name,
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      layout: currentLayout,
      indicators: activeIndicators.map(i => ({ title: i.title, source: i.source, visible: i.visible }))
    });
    addSystemLog(`Workspace "${name}" disimpan`, 'success');
  }

  async function handleLoadWorkspace(w: SavedWorkspace) {
    handleSymbolChange(w.symbol);
    handleTimeframeChange(w.timeframe as Timeframe);
    handleLayoutChange(w.layout);
    
    // Tunggu komponen chart selesai re-render dengan layout baru
    setTimeout(async () => {
      if (chartComponent) {
        // Hapus indikator lama
        const oldIndicators = chartComponent.getActiveIndicators();
        for (const ind of oldIndicators) {
          chartComponent.removeIndicator(ind.id);
        }
        
        // Muat indikator dari workspace
        if (w.indicators && w.indicators.length > 0) {
          for (const ind of w.indicators) {
            if (ind.source) {
              await chartComponent.addPineIndicator(ind.source, ind.title);
            }
          }
        }
      }
      addSystemLog(`Workspace "${w.name}" dimuat`, 'success');
    }, 200);
  }

  // ─── Drawing Tools Handlers ───
  function handleSelectTool(tool: DrawingToolType | null) {
    activeDrawingTool = tool;
    if (chartComponent) {
      chartComponent.setDrawingTool(tool);
    }
  }

  function handleToggleSnap() {
    const next: Record<SnapMode, SnapMode> = { off: 'weak', weak: 'strong', strong: 'off' };
    snapMode = next[snapMode];
    if (chartComponent) {
      chartComponent.setSnapMode(snapMode);
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
      chartComponent.setDrawingsLocked(isDrawingsLocked);
    }
  }

  function handleToggleHide() {
    isDrawingsHidden = !isDrawingsHidden;
    if (chartComponent) {
      chartComponent.setDrawingsHidden(isDrawingsHidden);
    }
  }

  function handleUndo() {
    if (chartComponent) chartComponent.undoDrawing();
  }

  function handleRedo() {
    if (chartComponent) chartComponent.redoDrawing();
  }

  function handleClear() {
    if (chartComponent && confirm('Hapus semua objek gambar pada grafik saat ini?')) {
      chartComponent.clearAllDrawings();
      addSystemLog('Seluruh objek gambar dibersihkan.', 'warn');
    }
  }

  // ─── Bar Replay Handlers ───
  async function handleToggleReplay() {
    isReplayActive = !isReplayActive;
    if (isReplayActive) {
      isReplayPlaying = false;
      if (chartComponent) {
        await chartComponent.startReplay();
        addSystemLog('Bar Replay mode aktif. Menampilkan candle masa lalu.', 'info');
      }
    } else {
      isReplayPlaying = false;
      if (chartComponent) {
        chartComponent.stopReplay();
        addSystemLog('Bar Replay dinonaktifkan. Kembali ke streaming live.', 'info');
      }
    }
  }

  function handleReplayTogglePlay() {
    isReplayPlaying = !isReplayPlaying;
    if (chartComponent) {
      if (isReplayPlaying) {
        chartComponent.playReplay(replayPlaybackSpeed);
        addSystemLog(`Replay memutar candle (${replayPlaybackSpeed}x).`, 'info');
      } else {
        chartComponent.pauseReplay();
        addSystemLog('Replay dijeda.', 'info');
      }
    }
  }

  function handleReplayStepForward() {
    if (chartComponent) {
      chartComponent.stepReplay();
      addSystemLog('Replay step +1 bar ke depan.', 'info');
    }
  }

  function handleReplaySpeedChange(speed: number) {
    replayPlaybackSpeed = speed;
    if (chartComponent && isReplayPlaying) {
      chartComponent.playReplay(speed);
    }
    addSystemLog(`Kecepatan replay diatur ke ${speed}x.`, 'info');
  }

  async function handleReplayRewind() {
    if (chartComponent) {
      isReplayPlaying = false;
      chartComponent.pauseReplay();
      await chartComponent.startReplay();
      addSystemLog('Replay di-rewind kembali ke titik cut-off.', 'info');
    }
  }

  function handleCloseReplay() {
    isReplayActive = false;
    isReplayPlaying = false;
    if (chartComponent) {
      chartComponent.stopReplay();
    }
    addSystemLog('Bar Replay ditutup. Kembali ke data pasar live.', 'info');
  }

  // ─── Indicators & Pine Script Handlers ───
  async function handleAddIndicator(code: string, title: string): Promise<boolean> {
    if (chartComponent) {
      const ok = await chartComponent.addPineIndicator(code, title);
      if (ok) {
        syncActiveIndicators();
        addSystemLog(`Indikator "${title}" berhasil diterapkan ke grafik.`, 'success');
      }
      return ok;
    }
    return false;
  }

  function syncActiveIndicators() {
    if (chartComponent && typeof chartComponent.getActiveIndicators === 'function') {
      activeIndicators = chartComponent.getActiveIndicators();
    }
  }

  function handleRemoveIndicator(id: string) {
    if (chartComponent && typeof chartComponent.removeIndicator === 'function') {
      chartComponent.removeIndicator(id);
    }
    activeIndicators = activeIndicators.filter(i => i.id !== id);
    syncActiveIndicators();
    addSystemLog(`Indikator dihapus: ${id}`, 'info');
  }

  function handleToggleIndicatorVisibility(id: string) {
    if (chartComponent && typeof chartComponent.toggleIndicatorVisibility === 'function') {
      chartComponent.toggleIndicatorVisibility(id);
    }
    syncActiveIndicators();
  }

  function handleOpenInEditor(code: string, title: string) {
    editorInitialCode = code;
    editorInitialTitle = title;
    workspaceMode = 'pine';
  }

  function addSystemLog(msg: string, level: 'info' | 'success' | 'warn') {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    systemLogs = [...systemLogs.slice(-60), { time, msg, level }];
  }
</script>

<div class="app-layout">
  <!-- Top Master Navigation & Titlebar -->
  <Header
    {activeSymbol}
    {activeTimeframe}
    {ticker}
    {currentLayout}
    {workspaceMode}
    {syncConfig}
    {activeIndicators}
    {isDrawingToolbarVisible}
    {isWatchlistOpen}
    {isReplayActive}
    onSymbolChange={handleSymbolChange}
    onTimeframeChange={handleTimeframeChange}
    onLayoutChange={handleLayoutChange}
    onWorkspaceModeChange={handleWorkspaceModeChange}
    onSaveWorkspace={handleSaveWorkspace}
    onLoadWorkspace={handleLoadWorkspace}
    onToggleSyncCrosshair={handleToggleSyncCrosshair}
    onToggleSyncDrawings={handleToggleSyncDrawings}
    onToggleDrawingToolbar={() => (isDrawingToolbarVisible = !isDrawingToolbarVisible)}
    onToggleWatchlist={() => (isWatchlistOpen = !isWatchlistOpen)}
    onToggleReplay={handleToggleReplay}
    onOpenProviderModal={() => (isProviderModalOpen = true)}
    onOpenIndicatorModal={() => (isIndicatorModalOpen = true)}
    onOpenSettingsModal={() => (isSettingsModalOpen = true)}
  />

  <!-- Main Viewport Area -->
  <main class="main-workspace {workspaceMode}">
    <!-- Optional Bar Replay Controller (Only visible when active) -->
    {#if isReplayActive}
      <ReplayBar
        isPlaying={isReplayPlaying}
        playbackSpeed={replayPlaybackSpeed}
        onTogglePlay={handleReplayTogglePlay}
        onStepForward={handleReplayStepForward}
        onSelectSpeed={handleReplaySpeedChange}
        onRewind={handleReplayRewind}
        onClose={handleCloseReplay}
      />
    {/if}

    <!-- WORKSPACE MODE 1: TRADING TERMINAL VIEW -->
    {#if workspaceMode === 'terminal'}
      <div class="terminal-workspace">
        <!-- Chart Canvas Container -->
        <div class="chart-canvas-area {isWatchlistOpen ? 'with-watchlist' : ''}">


          <!-- WebGL2 Vela Chart Core -->
          <Chart
            bind:this={chartComponent}
            symbol={activeSymbol}
            timeframe={activeTimeframe}
            layout={currentLayout}
            {syncConfig}
            showWatermark={appSettings.showWatermark}
            onActiveIndicatorsChange={(list) => (activeIndicators = list)}
            onActiveCellChange={handleActiveCellChange}
          />

          <!-- Left Utility Ribbon (Drawing Tools) -->
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
              onClear={handleClear}
            />
          {/if}
        </div>

        <!-- Right Collapsible Panel (Watchlist, Alerts, Object Tree) -->
        <WatchlistPanel
          isOpen={isWatchlistOpen}
          {activeSymbol}
          {activeIndicators}
          onSelectSymbol={handleSymbolChange}
          onToggleCollapse={() => (isWatchlistOpen = !isWatchlistOpen)}
          onToggleIndicatorVisibility={handleToggleIndicatorVisibility}
          onRemoveIndicator={handleRemoveIndicator}
        />
      </div>

    <!-- WORKSPACE MODE 2: PINE SCRIPT v6 IDE & BACKTESTER VIEW -->
    {:else if workspaceMode === 'pine'}
      <div class="pine-workspace">
        <!-- Top Pane (40%): Mini Live Strategy Chart & Execution Signal Overlay -->
        <div class="pine-top-chart-pane">
          <!-- Dynamic Floating Signal Badge -->
          <div class="floating-strategy-badge obsidian-panel mono-nums">
            <div class="badge-item">
              <span class="badge-pip-bull"></span>
              <span class="badge-bold">POSITION: LONG (2.5 BTC)</span>
            </div>
            <div class="badge-divider"></div>
            <div class="badge-item">
              <span class="badge-label">UNREALIZED PnL:</span>
              <span class="badge-val-bull">+$8,245.50 (+13.2%)</span>
            </div>
            <div class="badge-divider"></div>
            <div class="badge-item">
              <span class="badge-label">RISK/REWARD:</span>
              <span class="badge-val">1:3.4</span>
            </div>
          </div>

          <!-- WebGL2 Vela Live Chart -->
          <Chart
            bind:this={chartComponent}
            symbol={activeSymbol}
            timeframe={activeTimeframe}
            layout="1"
            {syncConfig}
            onActiveIndicatorsChange={(list) => (activeIndicators = list)}
            onActiveCellChange={handleActiveCellChange}
          />
        </div>

        <!-- Splitter Handle (1px Precision Hairline) -->
        <div class="splitter-hairline">
          <div class="splitter-grip"></div>
        </div>

        <!-- Bottom Pane (60%): Pine Script v6 Split IDE & Strategy Tester -->
        <div class="pine-bottom-ide-pane">
          <PineEditor
            isOpen={true}
            initialCode={editorInitialCode}
            initialTitle={editorInitialTitle}
            onClose={() => (workspaceMode = 'terminal')}
            onAddToChart={handleAddIndicator}
          />
        </div>
      </div>
    {/if}
  </main>

  <!-- Interactive Terminal Console Drawer (Collapsible [Ctrl+`]) -->
  {#if isConsoleDrawerOpen}
    <div class="console-drawer obsidian-panel">
      <div class="drawer-header">
        <div class="drawer-title mono-nums">
          <Terminal size={13} class="text-bull" />
          <span>TERMINAL DIAGNOSTICS & RUNTIME LOGS</span>
          <span class="log-badge mono-nums">{systemLogs.length} Events</span>
        </div>
        <button
          class="btn-close-drawer"
          title="Tutup Console Drawer"
          onclick={() => (isConsoleDrawerOpen = false)}
        >
          <X size={14} />
        </button>
      </div>

      <div class="drawer-content mono-nums">
        {#each systemLogs as item}
          <div class="log-row {item.level}">
            <span class="log-ts">[{item.time}]</span>
            <span class="log-text">{item.msg}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Bottom System Status Bar (Fixed 26px) -->
  <StatusBar
    isConsoleOpen={isConsoleDrawerOpen}
    onToggleConsole={() => (isConsoleDrawerOpen = !isConsoleDrawerOpen)}
  />

  <!-- Preferences & Settings Modal (Clean Screen Policy) -->
  <SettingsModal
    isOpen={isSettingsModalOpen}
    settings={appSettings}
    onClose={() => (isSettingsModalOpen = false)}
    onUpdateSettings={handleUpdateSettings}
  />

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
    font-family: var(--font-sans);
  }

  .main-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  /* MODE 1: TRADING TERMINAL STYLING */
  .terminal-workspace {
    flex: 1;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .chart-canvas-area {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .chart-canvas-area.with-watchlist {
    /* Watchlist panel uses flex flow, no padding needed here */
  }

  /* MODE 2: PINE SCRIPT IDE STYLING */
  .pine-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .pine-top-chart-pane {
    height: 40%;
    width: 100%;
    position: relative;
    overflow: hidden;
    background-color: var(--bg-darkest);
  }

  .floating-strategy-badge {
    position: absolute;
    top: 10px;
    left: 12px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    background-color: rgba(18, 23, 33, 0.92);
    border: 1px solid var(--border-hairline);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .badge-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .badge-pip-bull {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--bull-color);
    box-shadow: 0 0 6px var(--bull-color);
  }

  .badge-bold {
    font-weight: 700;
    color: var(--text-main);
  }

  .badge-label {
    color: var(--text-dim);
  }

  .badge-val-bull {
    color: var(--bull-color);
    font-weight: 700;
  }

  .badge-val {
    color: var(--brand-primary);
    font-weight: 600;
  }

  .badge-divider {
    width: 1px;
    height: 10px;
    background-color: var(--border-hairline);
  }

  .splitter-hairline {
    height: 4px;
    background-color: var(--bg-container);
    border-top: 1px solid var(--border-hairline);
    border-bottom: 1px solid var(--border-hairline);
    cursor: row-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background-color 0.15s ease;
  }

  .splitter-hairline:hover {
    background-color: var(--brand-primary);
  }

  .splitter-grip {
    width: 32px;
    height: 2px;
    border-radius: 2px;
    background-color: var(--border-bright);
  }

  .pine-bottom-ide-pane {
    height: 60%;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  /* Console Drawer [Ctrl+`] */
  .console-drawer {
    position: absolute;
    bottom: 26px;
    left: 0;
    right: 0;
    height: 170px;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.65);
    z-index: 45;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.15s ease-out;
  }

  .drawer-header {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .drawer-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-main);
  }

  .log-badge {
    font-size: 9px;
    color: var(--text-dim);
    background-color: var(--bg-base);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .btn-close-drawer {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-xs);
    display: flex;
  }

  .btn-close-drawer:hover {
    color: var(--text-main);
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
  }

  .log-row {
    display: flex;
    gap: 8px;
    line-height: 1.4;
  }

  .log-ts {
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .log-row.info .log-text {
    color: var(--text-muted);
  }

  .log-row.success .log-text {
    color: var(--bull-color);
  }

  .log-row.warn .log-text {
    color: #f59e0b;
  }

  .text-bull {
    color: var(--bull-color);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
