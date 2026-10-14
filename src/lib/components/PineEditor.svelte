<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
  } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
  import { bracketMatching } from '@codemirror/language';
  import {
    Play,
    Save,
    FilePlus,
    X,
    Check,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    FileCode,
    PlayCircle,
    BarChart3,
    Terminal,
    Copy,
    List,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
  } from '@lucide/svelte';
  import { marketFeed } from '../services/market';
  import { saveScript } from '../services/persistence';
  import { Indicator } from 'pinets';
  import { runPineStrategyBacktest } from '../services/strategyEngine';
  import type {
    PineScriptRecord,
    StrategyPerformanceSummary,
    StrategyTradeRecord,
  } from '../types/market';

  interface Props {
    isOpen: boolean;
    initialCode?: string;
    initialTitle?: string;
    activeSymbol?: string;
    activeTimeframe?: string;
    providerId?: string;
    onClose: () => void;
    onAddToChart: (code: string, title: string) => Promise<boolean>;
    onStrategyUpdate?: (summary: StrategyPerformanceSummary) => void;
  }

  let {
    isOpen,
    initialCode = '',
    initialTitle = 'Trawangan_Alpha_v6.pine',
    activeSymbol = 'BTCUSDT',
    activeTimeframe = '15m',
    providerId = 'binance',
    onClose,
    onAddToChart,
    onStrategyUpdate,
  }: Props = $props();

  let editorContainer: HTMLDivElement | null = $state(null);
  let editorView: EditorView | null = null;

  let currentScriptId = $state<string | null>(null);
  let scriptTitle = $state(initialTitle || 'Trawangan_Alpha_v6.pine');
  let saveFeedback = $state(false);
  let isReadOnly = $state(false);

  // Status & Telemetry
  let isCompiling = $state(false);
  let isBacktesting = $state(false);
  let compileStatus = $state<'ready' | 'success' | 'error'>('ready');
  let compileDurationMs = $state(12);
  let lastErrorMessage = $state<string | null>(null);

  // Status Bar Cursor Position
  let cursorLine = $state(1);
  let cursorCol = $state(1);

  // Collapsible Bottom Drawer (Console & Strategy Tester)
  let isDrawerOpen = $state(false);
  let activeDrawerTab = $state<'console' | 'performance' | 'trades'>('console');
  let tradeFilter = $state<'all' | 'long' | 'short' | 'open'>('all');

  // Strategy Tester Summary State
  let perf = $state<StrategyPerformanceSummary | null>(null);

  let filteredTrades = $derived.by(() => {
    const list = perf?.trades || [];
    if (tradeFilter === 'long') return list.filter((t) => t.direction === 'long');
    if (tradeFilter === 'short') return list.filter((t) => t.direction === 'short');
    if (tradeFilter === 'open') return list.filter((t) => t.status === 'open');
    return list;
  });

  let consoleLog = $state<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([
    { msg: 'PineTS Runtime Web Worker siap.', type: 'info', time: '12:00:00' },
  ]);

  const DEFAULT_BOILERPLATE = `//@version=6
strategy("Trawangan_Alpha_v6", overlay=true, margin_long=100, margin_short=100)

// Parameter input
fastLength = input.int(14, "Fast EMA Length")
slowLength = input.int(28, "Slow EMA Length")
src = input.source(close, "Source")

// Moving Averages
fastEMA = ta.ema(src, fastLength)
slowEMA = ta.ema(src, slowLength)

// Entry Conditions
longCondition = ta.crossover(fastEMA, slowEMA)
shortCondition = ta.crossunder(fastEMA, slowEMA)

if (longCondition)
    strategy.entry("Long #1", strategy.long)

if (shortCondition)
    strategy.close("Long #1")

// Plot lines
plot(fastEMA, "EMA Fast", color=#00F090, linewidth=2)
plot(slowEMA, "EMA Slow", color=#3B82F6, linewidth=2)
`;

  // Obsidian Precision Terminal theme untuk CodeMirror 6 (Sleek TradingView dark style)
  const obsidianTheme = EditorView.theme({
    '&': {
      backgroundColor: '#0A0D14',
      color: '#CBD5E1',
      fontSize: '12px',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#00F090',
      padding: '8px 0',
      lineHeight: '1.6',
    },
    '.cm-cursor': {
      borderLeftColor: '#00F090',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(0, 240, 144, 0.22) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#0D111A',
      color: '#475569',
      borderRight: '1px solid #1A2234',
      minWidth: '38px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#141B29',
      color: '#00F090',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(26, 34, 52, 0.45)',
    },
    '.cm-line': {
      padding: '0 8px',
    },
  });

  onMount(() => {
    initEditor(initialCode || DEFAULT_BOILERPLATE);
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  });

  function updateCursorPos(view: EditorView) {
    try {
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      cursorLine = line.number;
      cursorCol = pos - line.from + 1;
    } catch (_) {}
  }

  function initEditor(content: string) {
    if (!editorContainer) return;
    if (editorView) editorView.destroy();

    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        history(),
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              handleAddToChart();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged) {
            updateCursorPos(update.view);
          }
        }),
        obsidianTheme,
      ],
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer,
    });
    updateCursorPos(editorView);
  }

  export function loadScript(code: string, title: string, id?: string) {
    scriptTitle = title || 'Custom_Script.pine';
    currentScriptId = id || null;
    isReadOnly = title.includes('[Contoh]') || title.includes('[Bawaan]');

    if (!editorView && editorContainer) {
      initEditor(code);
    } else if (editorView) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: code },
        selection: { anchor: 0 },
      });
      setTimeout(() => {
        editorView?.requestMeasure();
        editorView?.focus();
      }, 40);
    }
    compileStatus = 'ready';
    lastErrorMessage = null;
    addLog(`Skrip "${scriptTitle}" dimuat ke Pine Editor.`, 'info');
  }

  function getCode(): string {
    return editorView ? editorView.state.doc.toString() : '';
  }

  function addLog(msg: string, type: 'info' | 'success' | 'error') {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    consoleLog = [...consoleLog.slice(-50), { msg, type, time }];
  }

  async function handleAddToChart() {
    const code = getCode();
    if (!code.trim()) return;

    isCompiling = true;
    lastErrorMessage = null;
    const start = performance.now();
    addLog(`Mengompilasi "${scriptTitle}"...`, 'info');

    let declType = 'script';
    // Tahap 1: Validasi sintaks Pine Script dengan parser resmi PineTS
    try {
      const validator = new Indicator(code);
      await validator.prepare();
      declType = validator.getDeclarationType?.() || 'script';
      addLog(`Sintaks Pine Script valid (${declType}).`, 'info');
    } catch (parseErr: any) {
      compileStatus = 'error';
      lastErrorMessage = parseErr?.message || String(parseErr);
      isDrawerOpen = true;
      activeDrawerTab = 'console';
      addLog(`Error sintaks: ${lastErrorMessage}`, 'error');
      isCompiling = false;
      return;
    }

    // Tahap 2: Simpan otomatis ke basis data SQLite
    const id = currentScriptId || `script-${Date.now()}`;
    const title = scriptTitle?.trim() || 'Untitled Script';
    try {
      const record: PineScriptRecord = {
        id,
        title,
        code,
        is_overlay: code.includes('overlay=true'),
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      await saveScript(record);
      currentScriptId = id;
      saveFeedback = true;
      setTimeout(() => {
        saveFeedback = false;
      }, 2000);
    } catch (saveErr) {
      console.warn('Gagal autosave ke SQLite:', saveErr);
    }

    // Tahap 3: Jalankan evaluasi backtest hanya jika script bertipe 'strategy'
    if (declType === 'strategy') {
      await executeStrategyBacktest(true);
    } else {
      perf = null;
    }

    // Tahap 4: Terapkan ke chart engine Vela WebGL2
    try {
      const ok = await onAddToChart(code, scriptTitle);
      compileDurationMs = Math.round(performance.now() - start) || 10;

      if (ok) {
        compileStatus = 'success';
        addLog(`Kompilasi selesai (${compileDurationMs}ms). Aktif di chart.`, 'success');
      } else {
        compileStatus = 'error';
        lastErrorMessage = 'Gagal menerapkan script ke chart canvas.';
        isDrawerOpen = true;
        activeDrawerTab = 'console';
        addLog(lastErrorMessage, 'error');
      }
    } catch (err: any) {
      compileStatus = 'error';
      lastErrorMessage = err?.message || String(err);
      isDrawerOpen = true;
      activeDrawerTab = 'console';
      addLog(`Runtime error: ${lastErrorMessage}`, 'error');
    } finally {
      isCompiling = false;
    }
  }

  async function handleSaveScript() {
    const code = getCode();
    if (!code.trim()) return;

    const id = currentScriptId || `script-${Date.now()}`;
    const title = scriptTitle?.trim() || 'Untitled Script';

    const record: PineScriptRecord = {
      id,
      title,
      code,
      is_overlay: code.includes('overlay=true'),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      await saveScript(record);
      currentScriptId = id;
      saveFeedback = true;
      setTimeout(() => {
        saveFeedback = false;
      }, 2000);
      addLog(`Skrip "${record.title}" disimpan ke SQLite.`, 'success');
      // Terapkan ke chart
      await onAddToChart(code, title);
    } catch (err: any) {
      addLog(`Gagal menyimpan: ${err.message || err}`, 'error');
    }
  }

  function handleNewScript() {
    currentScriptId = null;
    scriptTitle = 'Custom_Script_v6.pine';
    isReadOnly = false;
    if (editorView) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: DEFAULT_BOILERPLATE },
        selection: { anchor: 0 },
      });
      setTimeout(() => editorView?.requestMeasure(), 30);
    } else {
      initEditor(DEFAULT_BOILERPLATE);
    }
    compileStatus = 'ready';
    lastErrorMessage = null;
    addLog('Template skrip baru siap diedit.', 'info');
  }

  function handleMakeCopy() {
    currentScriptId = null;
    scriptTitle = `${scriptTitle.replace(/\.pine$/, '')}_Salinan.pine`;
    isReadOnly = false;
    addLog(`Membuat salinan skrip sebagai "${scriptTitle}".`, 'info');
  }

  async function executeStrategyBacktest(silent = false): Promise<StrategyPerformanceSummary | null> {
    const code = getCode();
    if (!code.trim()) return null;

    isBacktesting = true;
    if (!silent) addLog(`Mengambil candle ${activeSymbol} & menjalankan backtest...`, 'info');

    try {
      const candles = await marketFeed.getCandles(activeSymbol, activeTimeframe, 600);
      if (!candles || candles.length === 0) {
        if (!silent) addLog('Tidak ada candle pasar tersedia.', 'error');
        isBacktesting = false;
        return null;
      }

      const res = await runPineStrategyBacktest(code, candles);
      if (res.success && res.summary) {
        perf = res.summary;
        onStrategyUpdate?.(res.summary);
        if (!silent) {
          addLog(`Backtest selesai (${res.executionTimeMs}ms). Net Profit: $${res.summary.netProfit}.`, 'success');
          isDrawerOpen = true;
          activeDrawerTab = 'performance';
        }
        return res.summary;
      } else {
        if (!silent) addLog(`Peringatan: ${res.error || 'Bukan tipe strategy()'}`, 'error');
        return null;
      }
    } catch (err: any) {
      if (!silent) addLog(`Error backtester: ${err.message || err}`, 'error');
      return null;
    } finally {
      isBacktesting = false;
    }
  }
</script>

<div class="pine-tv-panel">
  <!-- Top Header Toolbar (TradingView Style) -->
  <header class="tv-header">
    <div class="header-left">
      <div class="script-title-box">
        <FileCode size={13} class="icon-code" />
        <input
          type="text"
          bind:value={scriptTitle}
          class="script-name-input mono-nums"
          placeholder="Nama Skrip..."
        />
      </div>

      <!-- Status Pill -->
      {#if isCompiling}
        <span class="status-pill compiling">Kompilasi...</span>
      {:else if compileStatus === 'success'}
        <span class="status-pill success"><Check size={10} /> Aktif</span>
      {:else if compileStatus === 'error'}
        <span class="status-pill error"><AlertCircle size={10} /> Error</span>
      {:else}
        <span class="status-pill ready">Siap</span>
      {/if}
    </div>

    <!-- Actions Cluster -->
    <div class="header-right">
      <button
        class="tv-btn btn-primary"
        title="Terapkan ke chart (Ctrl+S)"
        disabled={isCompiling}
        onclick={handleAddToChart}
      >
        <Play size={11} fill="currentColor" />
        <span>Tambah ke Chart</span>
      </button>

      <button
        class="tv-btn btn-secondary {saveFeedback ? 'btn-saved' : ''}"
        title="Simpan ke basis data offline"
        onclick={handleSaveScript}
      >
        {#if saveFeedback}
          <Check size={11} class="text-bull" />
          <span class="text-bull">Tersimpan</span>
        {:else}
          <Save size={11} />
          <span>Simpan</span>
        {/if}
      </button>

      <button
        class="tv-btn btn-icon"
        title="Buat skrip baru"
        onclick={handleNewScript}
      >
        <FilePlus size={13} />
      </button>

      <button
        class="tv-btn btn-icon btn-close"
        title="Tutup Pine IDE (Esc)"
        onclick={onClose}
      >
        <X size={14} />
      </button>
    </div>
  </header>

  <!-- Read-Only Banner (jika skrip bawaan / contoh) -->
  {#if isReadOnly}
    <div class="readonly-banner">
      <AlertCircle size={12} class="banner-icon" />
      <span>Skrip ini hanya dapat dibaca. Untuk mengedit, buat salinan terlebih dahulu.</span>
      <button class="btn-copy-action" onclick={handleMakeCopy}>
        <Copy size={11} />
        <span>Buat Salinan</span>
      </button>
    </div>
  {/if}

  <!-- Error Summary Pill jika ada error kompilasi -->
  {#if compileStatus === 'error' && lastErrorMessage && !isDrawerOpen}
    <div class="error-banner" onclick={() => { isDrawerOpen = true; activeDrawerTab = 'console'; }}>
      <AlertCircle size={12} class="text-bear" />
      <span class="err-text">{lastErrorMessage}</span>
      <span class="err-hint">Klik untuk buka Console</span>
    </div>
  {/if}

  <!-- Main Code Area (CodeMirror Canvas) -->
  <div class="tv-editor-area" bind:this={editorContainer}></div>

  <!-- Bottom Status Bar -->
  <footer class="tv-status-bar mono-nums">
    <div class="status-left">
      <span>Baris {cursorLine}, Kolom {cursorCol}</span>
      <span class="separator">·</span>
      <span>Pine Script® v6</span>
    </div>

    <div class="status-right">
      <button
        class="drawer-toggle-btn {isDrawerOpen ? 'active' : ''}"
        onclick={() => (isDrawerOpen = !isDrawerOpen)}
      >
        <Terminal size={11} />
        <span>Console & Tester</span>
        {#if isDrawerOpen}
          <ChevronDown size={11} />
        {:else}
          <ChevronUp size={11} />
        {/if}
      </button>
    </div>
  </footer>

  <!-- Collapsible Bottom Drawer (Console & Strategy Tester) -->
  {#if isDrawerOpen}
    <div class="tv-drawer">
      <!-- Drawer Navigation Header -->
      <div class="drawer-tabs-header">
        <div class="tabs-group">
          <button
            class="drawer-tab {activeDrawerTab === 'console' ? 'active' : ''}"
            onclick={() => (activeDrawerTab = 'console')}
          >
            <Terminal size={11} />
            <span>Console ({consoleLog.length})</span>
          </button>

          <button
            class="drawer-tab {activeDrawerTab === 'performance' ? 'active' : ''}"
            onclick={() => (activeDrawerTab = 'performance')}
          >
            <BarChart3 size={11} />
            <span>Strategy Tester</span>
          </button>

          <button
            class="drawer-tab {activeDrawerTab === 'trades' ? 'active' : ''}"
            onclick={() => (activeDrawerTab = 'trades')}
          >
            <List size={11} />
            <span>Riwayat Transaksi ({perf?.trades?.length || 0})</span>
          </button>
        </div>

        <div class="drawer-actions">
          <button
            class="btn-run-backtest"
            disabled={isBacktesting}
            onclick={() => executeStrategyBacktest(false)}
          >
            <PlayCircle size={11} />
            <span>{isBacktesting ? 'Menguji...' : 'Uji Strategi'}</span>
          </button>

          <button
            class="btn-close-drawer"
            title="Sembunyikan drawer"
            onclick={() => (isDrawerOpen = false)}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <!-- Drawer Content Pane -->
      <div class="drawer-body">
        {#if activeDrawerTab === 'console'}
          <div class="console-list mono-nums">
            {#each consoleLog as log}
              <div class="console-row {log.type}">
                <span class="log-time">{log.time}</span>
                <span class="log-msg">{log.msg}</span>
              </div>
            {/each}
          </div>
        {:else if activeDrawerTab === 'performance'}
          {#if perf}
            <div class="perf-metrics-grid mono-nums">
              <div class="metric-box">
                <span class="metric-title">NET PROFIT</span>
                <span class="metric-value {perf.netProfit >= 0 ? 'text-bull' : 'text-bear'}">
                  {perf.netProfit >= 0 ? '+' : ''}${perf.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <small>({perf.netProfitPercent}%)</small>
                </span>
              </div>

              <div class="metric-box">
                <span class="metric-title">WIN RATE</span>
                <span class="metric-value">{perf.winRate}%</span>
              </div>

              <div class="metric-box">
                <span class="metric-title">PROFIT FACTOR</span>
                <span class="metric-value text-cyan">{perf.profitFactor}</span>
              </div>

              <div class="metric-box">
                <span class="metric-title">TOTAL TRADES</span>
                <span class="metric-value">{perf.totalTrades}</span>
              </div>

              <div class="metric-box">
                <span class="metric-title">MAX DRAWDOWN</span>
                <span class="metric-value text-bear">${perf.maxDrawdown} ({perf.maxDrawdownPercent}%)</span>
              </div>

              <div class="metric-box">
                <span class="metric-title">GROSS PROFIT</span>
                <span class="metric-value text-bull">+${perf.grossProfit.toFixed(2)}</span>
              </div>
            </div>
          {:else}
            <div class="empty-perf-notice">
              <BarChart3 size={24} class="empty-icon" />
              <span>Belum ada hasil backtest. Klik <b>Uji Strategi</b> untuk menjalankan evaluasi PineTS.</span>
            </div>
          {/if}
        {:else if activeDrawerTab === 'trades'}
          {#if perf && perf.trades.length > 0}
            <div class="trades-table-wrapper mono-nums">
              <table class="trades-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Arah</th>
                    <th>Harga Masuk</th>
                    <th>Harga Keluar</th>
                    <th>Profit ($)</th>
                    <th>Profit (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredTrades as t}
                    {@const p = t.profit ?? 0}
                    {@const pp = t.profitPercent ?? 0}
                    <tr>
                      <td>#{t.tradeNum || t.id}</td>
                      <td>{t.status.toUpperCase()}</td>
                      <td class="{t.direction === 'long' ? 'text-bull' : 'text-bear'}">{t.direction.toUpperCase()}</td>
                      <td>${t.entryPrice.toFixed(2)}</td>
                      <td>{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : 'OPEN'}</td>
                      <td class="{p >= 0 ? 'text-bull' : 'text-bear'}">
                        {p >= 0 ? '+' : ''}${p.toFixed(2)}
                      </td>
                      <td class="{pp >= 0 ? 'text-bull' : 'text-bear'}">
                        {pp >= 0 ? '+' : ''}{pp.toFixed(2)}%
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="empty-perf-notice">
              <List size={24} class="empty-icon" />
              <span>Tidak ada transaksi tercatat pada rentang data ini.</span>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .pine-tv-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: #0A0D14;
    border-left: 1px solid var(--border-hairline, #1E293B);
    overflow: hidden;
    position: relative;
    user-select: none;
  }

  /* Header Toolbar */
  .tv-header {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    background-color: #0E121B;
    border-bottom: 1px solid var(--border-hairline, #1E293B);
    flex-shrink: 0;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .script-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .icon-code {
    color: var(--bull-color, #00F090);
    flex-shrink: 0;
  }

  .script-name-input {
    background: transparent;
    border: 1px solid transparent;
    color: #F8FAFC;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    max-width: 170px;
    outline: none;
    text-overflow: ellipsis;
    transition: all 0.15s ease;
  }

  .script-name-input:focus,
  .script-name-input:hover {
    border-color: #334155;
    background-color: #141A26;
  }

  /* Status Pills */
  .status-pill {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  .status-pill.ready {
    background-color: rgba(148, 163, 184, 0.12);
    color: #94A3B8;
  }

  .status-pill.success {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--bull-color, #00F090);
  }

  .status-pill.error {
    background-color: rgba(244, 63, 94, 0.15);
    color: var(--bear-color, #F43F5E);
  }

  .status-pill.compiling {
    background-color: rgba(234, 179, 8, 0.15);
    color: #EAB308;
  }

  /* Action Buttons */
  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .tv-btn {
    border: none;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: linear-gradient(135deg, #00F090, #00C875);
    color: #05080E;
    padding: 4px 10px;
    box-shadow: 0 1px 3px rgba(0, 240, 144, 0.25);
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-0.5px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #171E2D;
    color: #CBD5E1;
    border: 1px solid #28334A;
    padding: 4px 8px;
  }

  .btn-secondary:hover {
    background-color: #222C3F;
    color: #FFFFFF;
  }

  .btn-saved {
    border-color: rgba(0, 240, 144, 0.4);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .btn-icon {
    background: transparent;
    color: #94A3B8;
    padding: 4px;
  }

  .btn-icon:hover {
    background-color: #1A2234;
    color: #F8FAFC;
  }

  .btn-close:hover {
    color: #F43F5E;
    background-color: rgba(244, 63, 94, 0.12);
  }

  /* Read-Only & Error Banners */
  .readonly-banner {
    background-color: rgba(234, 179, 8, 0.12);
    border-bottom: 1px solid rgba(234, 179, 8, 0.25);
    color: #FDE047;
    font-size: 10px;
    padding: 5px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .banner-icon {
    flex-shrink: 0;
    color: #EAB308;
  }

  .btn-copy-action {
    background-color: #EAB308;
    color: #0F172A;
    border: none;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: auto;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .error-banner {
    background-color: rgba(244, 63, 94, 0.1);
    border-bottom: 1px solid rgba(244, 63, 94, 0.3);
    color: #FDA4AF;
    font-size: 10px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .err-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .err-hint {
    font-size: 9px;
    color: #94A3B8;
    text-decoration: underline;
  }

  /* Main Editor Area */
  .tv-editor-area {
    flex: 1;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .tv-editor-area :global(.cm-editor) {
    height: 100%;
  }

  .tv-editor-area :global(.cm-scroller) {
    overflow: auto;
    font-family: inherit;
  }

  /* Status Bar */
  .tv-status-bar {
    height: 24px;
    background-color: #090C12;
    border-top: 1px solid #161D2B;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-size: 10px;
    color: #64748B;
    flex-shrink: 0;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .separator {
    color: #334155;
  }

  .drawer-toggle-btn {
    background: transparent;
    border: none;
    color: #94A3B8;
    font-size: 10px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .drawer-toggle-btn:hover,
  .drawer-toggle-btn.active {
    color: #00F090;
    background-color: #141B29;
  }

  /* Drawer Container */
  .tv-drawer {
    height: 190px;
    background-color: #0B0E16;
    border-top: 1px solid #1E293B;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    animation: drawerSlide 0.12s ease-out;
  }

  @keyframes drawerSlide {
    from {
      height: 0px;
      opacity: 0;
    }
    to {
      height: 190px;
      opacity: 1;
    }
  }

  .drawer-tabs-header {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    background-color: #0E121B;
    border-bottom: 1px solid #1A2234;
    flex-shrink: 0;
  }

  .tabs-group {
    display: flex;
    gap: 4px;
  }

  .drawer-tab {
    background: transparent;
    border: none;
    color: #64748B;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 3px;
  }

  .drawer-tab:hover {
    color: #CBD5E1;
  }

  .drawer-tab.active {
    background-color: #161D2C;
    color: #00F090;
  }

  .drawer-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-run-backtest {
    background-color: #141C2B;
    border: 1px solid #222F47;
    color: #38BDF8;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .btn-run-backtest:hover:not(:disabled) {
    background-color: #1A263B;
    color: #7DD3FC;
  }

  .btn-close-drawer {
    background: transparent;
    border: none;
    color: #64748B;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .btn-close-drawer:hover {
    color: #E2E8F0;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 6px 10px;
  }

  /* Console logs */
  .console-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
  }

  .console-row {
    display: flex;
    gap: 8px;
    line-height: 1.4;
  }

  .log-time {
    color: #475569;
    flex-shrink: 0;
  }

  .console-row.info .log-msg {
    color: #94A3B8;
  }

  .console-row.success .log-msg {
    color: #00F090;
  }

  .console-row.error .log-msg {
    color: #F43F5E;
  }

  /* Performance Grid */
  .perf-metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .metric-box {
    background-color: #0F1420;
    border: 1px solid #1C2436;
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metric-title {
    font-size: 9px;
    color: #64748B;
  }

  .metric-value {
    font-size: 12px;
    font-weight: 700;
    color: #F1F5F9;
  }

  .empty-perf-notice {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #64748B;
    font-size: 11px;
    text-align: center;
    padding: 20px;
  }

  .empty-icon {
    color: #334155;
  }

  /* Trades Table */
  .trades-table-wrapper {
    overflow-x: auto;
  }

  .trades-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    text-align: left;
  }

  .trades-table th {
    color: #64748B;
    font-weight: 600;
    padding: 4px 6px;
    border-bottom: 1px solid #1E293B;
  }

  .trades-table td {
    padding: 4px 6px;
    border-bottom: 1px solid #141B29;
    color: #CBD5E1;
  }

  .text-bull {
    color: var(--bull-color, #00F090);
  }

  .text-bear {
    color: var(--bear-color, #F43F5E);
  }

  .text-cyan {
    color: #38BDF8;
  }
</style>
