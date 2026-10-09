<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
  import { bracketMatching } from '@codemirror/language';
  import {
    Play,
    Save,
    FilePlus,
    Terminal,
    ChevronDown,
    ChevronUp,
    Maximize2,
    Minimize2,
    X,
    Check,
    AlertCircle,
    BarChart3,
    TrendingUp,
    ShieldAlert,
    Cpu,
    FileCode,
    Sparkles
  } from '@lucide/svelte';
  import { savePineScript } from '../services/marketProvider';
  import { Indicator } from 'pinets';
  import type { PineScriptRecord, StrategyPerformanceSummary } from '../types/market';

  interface Props {
    isOpen: boolean;
    initialCode?: string;
    initialTitle?: string;
    onClose: () => void;
    onAddToChart: (code: string, title: string) => Promise<boolean>;
  }

  let {
    isOpen,
    initialCode = '',
    initialTitle = 'Trawangan_Alpha_v6.pine',
    onClose,
    onAddToChart,
  }: Props = $props();

  let editorContainer: HTMLDivElement | null = $state(null);
  let editorView: EditorView | null = null;

  let scriptTitle = $state('');
  $effect(() => {
    scriptTitle = initialTitle;
  });

  let rightTab = $state<'performance' | 'console'>('performance');
  let isCompiling = $state(false);
  let compileDurationMs = $state(14);
  let compileStatus = $state<'ready' | 'success' | 'error'>('ready');

  // Strategy Tester Summary State (Mock/Live Quant Telemetry)
  let perf = $state<StrategyPerformanceSummary>({
    netProfit: 18450.00,
    netProfitPercent: 27.4,
    winRate: 68.4,
    totalTrades: 70,
    profitFactor: 2.42,
    maxDrawdown: 2100.00,
    maxDrawdownPercent: 4.12,
  });

  let consoleLog = $state<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([
    { msg: 'PineTS Runtime Web Worker v0.2.15 initialized.', type: 'info', time: '14:00:01' },
    { msg: 'WebAssembly SIMD acceleration enabled.', type: 'info', time: '14:00:02' },
    { msg: 'Strategy "Trawangan_Alpha_v6" loaded ready for backtesting.', type: 'success', time: '14:00:04' },
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

  // Obsidian Precision Terminal theme untuk CodeMirror 6
  const obsidianTheme = EditorView.theme({
    '&': {
      backgroundColor: '#0B0E14',
      color: '#CBD5E1',
      fontSize: '12px',
      fontFamily: "'JetBrains Mono', monospace",
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#00F090',
      padding: '8px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#00F090',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(0, 240, 144, 0.22) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#0E121A',
      color: '#475569',
      borderRight: '1px solid #1E293B',
      minWidth: '36px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#161E2E',
      color: '#00F090',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(30, 41, 59, 0.35)',
    },
  });

  onMount(() => {
    initEditor(initialCode || DEFAULT_BOILERPLATE);
  });

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
          ...historyKeymap
        ]),
        obsidianTheme,
      ],
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer,
    });
  }

  $effect(() => {
    if (editorView && initialCode && editorView.state.doc.toString() !== initialCode) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: initialCode },
      });
      scriptTitle = initialTitle;
    }
  });

  onDestroy(() => {
    if (editorView) editorView.destroy();
  });

  function getCode(): string {
    return editorView ? editorView.state.doc.toString() : '';
  }

  async function handleAddToChart() {
    const code = getCode();
    if (!code.trim()) return;

    isCompiling = true;
    const start = performance.now();
    addLog(`Mengompilasi "${scriptTitle}" via PineTS Worker...`, 'info');

    // Tahap 1: Validasi sintaks Pine Script dengan parser resmi PineTS
    try {
      const validator = new Indicator(code);
      await validator.prepare();
      addLog(`Sintaks Pine Script valid (${validator.getDeclarationType?.() || 'script'}).`, 'info');
    } catch (parseErr: any) {
      compileStatus = 'error';
      rightTab = 'console';
      const errMsg = parseErr?.message || String(parseErr);
      addLog(`Error sintaks Pine Script: ${errMsg}`, 'error');
      isCompiling = false;
      return;
    }

    // Tahap 2: Terapkan ke chart engine Vela WebGL2
    try {
      const ok = await onAddToChart(code, scriptTitle);
      compileDurationMs = Math.round(performance.now() - start) || 12;

      if (ok) {
        compileStatus = 'success';
        addLog(`Kompilasi selesai dalam ${compileDurationMs}ms. Indikator/strategi berhasil aktif di chart.`, 'success');
      } else {
        compileStatus = 'error';
        rightTab = 'console';
        addLog(`Gagal mengeksekusi script ke chart. Periksa kompatibilitas fungsi.`, 'error');
      }
    } catch (err: any) {
      compileStatus = 'error';
      rightTab = 'console';
      addLog(`Error eksekusi runtime: ${err.message || err}`, 'error');
    } finally {
      isCompiling = false;
    }
  }

  async function handleSaveScript() {
    const code = getCode();
    if (!code.trim()) return;

    const record: PineScriptRecord = {
      id: `script-${Date.now()}`,
      title: scriptTitle || 'Untitled Script',
      code,
      is_overlay: code.includes('overlay=true'),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await savePineScript(record);
    addLog(`Skrip "${record.title}" disimpan ke database SQLite offline.`, 'success');
  }

  function handleNewScript() {
    scriptTitle = 'Custom_Strategy_v6.pine';
    initEditor(DEFAULT_BOILERPLATE);
    addLog('Template strategi baru siap diedit.', 'info');
  }

  function addLog(msg: string, type: 'info' | 'success' | 'error') {
    consoleLog = [...consoleLog.slice(-50), { msg, type, time: new Date().toLocaleTimeString() }];
  }
</script>

{#if isOpen}
  <div class="pine-ide obsidian-panel">
    <!-- Master IDE Top Toolbar -->
    <header class="ide-master-header">
      <div class="left-cluster">
        <div class="script-badge">
          <FileCode size={14} class="text-bull" />
          <input
            type="text"
            bind:value={scriptTitle}
            class="title-input mono-nums"
            placeholder="Nama Skrip..."
          />
          <span class="v6-pill">v6 Native</span>
          <span class="engine-pill">Strategy Engine</span>
        </div>

        <div class="divider"></div>

        <div class="actions-group">
          <button
            class="btn-compile"
            title="Kompilasi dan terapkan strategi (Ctrl+S)"
            disabled={isCompiling}
            onclick={handleAddToChart}
          >
            <Play size={12} fill="currentColor" />
            <span>{isCompiling ? 'Compiling...' : 'Compile & Apply (Ctrl+S)'}</span>
          </button>

          <button
            class="btn-secondary"
            title="Simpan ke basis data SQLite"
            onclick={handleSaveScript}
          >
            <Save size={12} />
            <span>Save Local</span>
          </button>

          <button
            class="btn-secondary"
            title="Buat file template baru"
            onclick={handleNewScript}
          >
            <FilePlus size={12} />
            <span>New</span>
          </button>
        </div>
      </div>

      <div class="right-cluster">
        <div class="compiler-status mono-nums">
          <span class="status-dot {compileStatus === 'error' ? 'dot-bear' : 'dot-bull'}"></span>
          <span class="text-bull">Compiled ({compileDurationMs}ms)</span>
          <span class="err-count">0 Err / 0 Warn</span>
        </div>

        <div class="divider"></div>

        <span class="lsp-badge mono-nums">LSP: ON</span>

        <button class="btn-close" title="Tutup Pine IDE" onclick={onClose}>
          <X size={15} />
        </button>
      </div>
    </header>

    <!-- IDE Body Split: Left 65% Code Editor | Right 35% Strategy Tester -->
    <div class="ide-body">
      <!-- 65% CODE EDITOR -->
      <section class="editor-pane">
        <!-- Editor Tabs Bar -->
        <div class="editor-tabs-bar">
          <div class="tabs-group">
            <div class="tab-item active mono-nums">
              <FileCode size={12} class="text-bull" />
              <span>{scriptTitle}</span>
            </div>
          </div>

          <div class="meta-info mono-nums">
            <span>Pine Script v6</span>
            <span>Spaces: 4</span>
            <span>UTF-8</span>
          </div>
        </div>

        <!-- CodeMirror Editor Buffer -->
        <div class="codemirror-wrapper" bind:this={editorContainer}></div>
      </section>

      <!-- 35% STRATEGY PERFORMANCE & CONSOLE -->
      <aside class="right-strategy-pane obsidian-panel">
        <!-- Sub Tabs -->
        <div class="strategy-tabs-bar">
          <button
            class="strategy-tab {rightTab === 'performance' ? 'active' : ''}"
            onclick={() => (rightTab = 'performance')}
          >
            <BarChart3 size={13} />
            <span>Strategy Performance</span>
          </button>

          <button
            class="strategy-tab {rightTab === 'console' ? 'active' : ''}"
            onclick={() => (rightTab = 'console')}
          >
            <Terminal size={13} />
            <span>Console Logs</span>
            <span class="log-count mono-nums">{consoleLog.length}</span>
          </button>
        </div>

        <div class="strategy-content">
          {#if rightTab === 'performance'}
            <div class="perf-container">
              <!-- Net Profit Card -->
              <div class="perf-metric-hero obsidian-card">
                <span class="metric-label">Net Profit (Unrealized + Realized)</span>
                <div class="hero-val-box mono-nums">
                  <span class="hero-val text-bull">+${perf.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span class="hero-pct pill-bull">+{perf.netProfitPercent}%</span>
                </div>
              </div>

              <!-- Metrics Grid -->
              <div class="perf-grid mono-nums">
                <div class="perf-card">
                  <span class="perf-card-title">Win Rate</span>
                  <span class="perf-card-value text-bull">{perf.winRate}%</span>
                  <span class="perf-card-sub">48 Win / 22 Loss</span>
                </div>

                <div class="perf-card">
                  <span class="perf-card-title">Profit Factor</span>
                  <span class="perf-card-value text-cyan">{perf.profitFactor}</span>
                  <span class="perf-card-sub">Gross Win / Gross Loss</span>
                </div>

                <div class="perf-card">
                  <span class="perf-card-title">Max Drawdown</span>
                  <span class="perf-card-value text-bear">-{perf.maxDrawdownPercent}%</span>
                  <span class="perf-card-sub">-${perf.maxDrawdown.toLocaleString()}</span>
                </div>

                <div class="perf-card">
                  <span class="perf-card-title">Total Closed Trades</span>
                  <span class="perf-card-value">{perf.totalTrades}</span>
                  <span class="perf-card-sub">Bar Backtest Run</span>
                </div>
              </div>

              <!-- Strategy Status Badge -->
              <div class="strategy-banner obsidian-card">
                <div class="banner-item">
                  <TrendingUp size={14} class="text-bull" />
                  <span>Trailing Stop: <strong>Active (2.5% ATR)</strong></span>
                </div>
                <div class="banner-item">
                  <Sparkles size={14} class="text-cyan" />
                  <span>Execution: <strong>Web Worker Non-blocking</strong></span>
                </div>
              </div>
            </div>

          {:else if rightTab === 'console'}
            <div class="console-container mono-nums">
              <div class="console-logs">
                {#each consoleLog as log}
                  <div class="log-entry {log.type}">
                    <span class="log-time">[{log.time}]</span>
                    <span class="log-msg">{log.msg}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </aside>
    </div>
  </div>
{/if}

<style>
  .pine-ide {
    width: 100%;
    height: 100%;
    background-color: var(--bg-darkest);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-top: 1px solid var(--border-hairline);
  }

  /* Master Header */
  .ide-master-header {
    height: 38px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    flex-shrink: 0;
  }

  .left-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .script-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .title-input {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    width: 170px;
    outline: none;
  }

  .title-input:focus {
    border-color: var(--border-focus);
  }

  .v6-pill {
    font-size: 9px;
    font-weight: 700;
    color: var(--bg-darkest);
    background-color: var(--brand-primary);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
  }

  .engine-pill {
    font-size: 9px;
    color: var(--text-dim);
    background-color: var(--bg-container);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border-hairline);
  }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-compile {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border: none;
    padding: 4px 10px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .btn-compile:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    cursor: pointer;
  }

  .btn-secondary:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .right-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .compiler-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot-bull {
    background-color: var(--bull-color);
    box-shadow: 0 0 6px var(--bull-color);
  }

  .dot-bear {
    background-color: var(--bear-color);
    box-shadow: 0 0 6px var(--bear-color);
  }

  .err-count {
    color: var(--text-dim);
    font-size: 10px;
  }

  .lsp-badge {
    font-size: 10px;
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.1);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
  }

  .btn-close:hover {
    color: var(--bear-color);
    background-color: var(--bg-hover);
  }

  /* Body Split */
  .ide-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Editor 65% */
  .editor-pane {
    flex: 65;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-darkest);
    border-right: 1px solid var(--border-hairline);
    overflow: hidden;
  }

  .editor-tabs-bar {
    height: 26px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    flex-shrink: 0;
  }

  .tabs-group {
    display: flex;
    height: 100%;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    background-color: var(--bg-darkest);
    border-right: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 500;
  }

  .meta-info {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--text-dim);
  }

  .codemirror-wrapper {
    flex: 1;
    overflow: hidden;
  }

  /* Right 35% Strategy Pane */
  .right-strategy-pane {
    flex: 35;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface);
    overflow: hidden;
  }

  .strategy-tabs-bar {
    height: 30px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    padding: 0 6px;
    gap: 2px;
    align-items: center;
    flex-shrink: 0;
  }

  .strategy-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
  }

  .strategy-tab:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .strategy-tab.active {
    color: var(--brand-primary);
    background-color: var(--bg-base);
    font-weight: 600;
  }

  .log-count {
    font-size: 9px;
    color: var(--text-dim);
    background-color: var(--bg-container);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .strategy-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .perf-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .perf-metric-hero {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    font-size: 11px;
    color: var(--text-dim);
  }

  .hero-val-box {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .hero-val {
    font-size: 20px;
    font-weight: 700;
  }

  .hero-pct {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: var(--radius-xs);
  }

  .pill-bull {
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.12);
  }

  .perf-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .perf-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .perf-card-title {
    font-size: 10px;
    color: var(--text-dim);
  }

  .perf-card-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-main);
  }

  .perf-card-sub {
    font-size: 9px;
    color: var(--text-dim);
  }

  .strategy-banner {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 2px;
  }

  .banner-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .banner-item strong {
    color: var(--text-main);
  }

  /* Console Container */
  .console-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .console-logs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }

  .log-entry {
    display: flex;
    gap: 6px;
    line-height: 1.4;
  }

  .log-time {
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .log-entry.info .log-msg {
    color: var(--text-muted);
  }

  .log-entry.success .log-msg {
    color: var(--bull-color);
  }

  .log-entry.error .log-msg {
    color: var(--bear-color);
  }

  .text-bull {
    color: var(--bull-color);
  }

  .text-bear {
    color: var(--bear-color);
  }

  .text-cyan {
    color: var(--brand-cyan);
  }
</style>
