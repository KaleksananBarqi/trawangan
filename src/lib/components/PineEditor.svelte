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
    AlertCircle
  } from '@lucide/svelte';
  import { savePineScript } from '../services/marketProvider';
  import type { PineScriptRecord } from '../types/market';

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
    initialTitle = 'Custom Pine Indicator',
    onClose,
    onAddToChart,
  }: Props = $props();

  let editorContainer: HTMLDivElement | null = $state(null);
  let editorView: EditorView | null = null;

  let scriptTitle = $state('');
  $effect(() => {
    scriptTitle = initialTitle;
  });
  let isMaximized = $state(false);
  let showConsole = $state(true);
  let consoleLog = $state<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([
    { msg: 'PineTS Runtime Web Worker siap menerima script.', type: 'info', time: new Date().toLocaleTimeString() },
  ]);
  let isCompiling = $state(false);

  const DEFAULT_BOILERPLATE = `//@version=5
indicator("My Custom Indicator", overlay=true)

// Parameter input
length = input.int(20, "Period Length")
src = input.source(close, "Source")

// Perhitungan Moving Average
ma = ta.sma(src, length)

// Plot visual ke chart
plot(ma, "Simple Moving Average", color=#00f2fe, linewidth=2)
`;

  // Tema Gelap Fintech untuk CodeMirror 6
  const fintechTheme = EditorView.theme({
    '&': {
      backgroundColor: '#07090e',
      color: '#e2e8f0',
      fontSize: '12px',
      fontFamily: "'JetBrains Mono', monospace",
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#00f2fe',
      padding: '8px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#00f2fe',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(0, 242, 254, 0.25) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#0a0e17',
      color: '#475569',
      borderRight: '1px solid #1c263c',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#161e31',
      color: '#00f2fe',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
        keymap.of([...defaultKeymap, ...historyKeymap]),
        fintechTheme,
      ],
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer,
    });
  }

  $effect(() => {
    // Sinkronisasi jika initialCode berubah dari luar
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
    const now = new Date().toLocaleTimeString();
    addLog(`Mengompilasi "${scriptTitle}" via Pine Worker...`, 'info');

    try {
      const ok = await onAddToChart(code, scriptTitle);
      if (ok) {
        addLog(`Skrip "${scriptTitle}" berhasil dikompilasi & dipasang ke chart aktif.`, 'success');
      } else {
        addLog(`Gagal memasang skrip. Periksa sintaks Pine Script.`, 'error');
      }
    } catch (err: any) {
      addLog(`Error kompilasi: ${err.message || err}`, 'error');
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
    addLog(`Skrip "${record.title}" berhasil disimpan ke SQLite lokal.`, 'success');
  }

  function handleNewScript() {
    scriptTitle = 'New Indicator';
    initEditor(DEFAULT_BOILERPLATE);
    addLog('Template indikator baru dibuat.', 'info');
  }

  function addLog(msg: string, type: 'info' | 'success' | 'error') {
    consoleLog = [...consoleLog.slice(-40), { msg, type, time: new Date().toLocaleTimeString() }];
  }
</script>

{#if isOpen}
  <div class="pine-drawer glass-panel {isMaximized ? 'maximized' : ''}">
    <!-- Drawer Toolbar -->
    <div class="drawer-header">
      <div class="title-section">
        <span class="editor-badge">PINE EDITOR</span>
        <input
          type="text"
          bind:value={scriptTitle}
          class="title-input mono-nums"
          placeholder="Nama Indikator..."
        />
      </div>

      <div class="toolbar-actions">
        <button
          class="btn-action primary"
          title="Kompilasi dan tambahkan ke chart aktif"
          disabled={isCompiling}
          onclick={handleAddToChart}
        >
          <Play size={13} fill="currentColor" />
          <span>Add to Chart</span>
        </button>

        <button
          class="btn-action"
          title="Simpan skrip ke basis data SQLite"
          onclick={handleSaveScript}
        >
          <Save size={13} />
          <span>Save</span>
        </button>

        <button
          class="btn-action"
          title="Buat template baru"
          onclick={handleNewScript}
        >
          <FilePlus size={13} />
          <span>New</span>
        </button>

        <button
          class="btn-action {showConsole ? 'active' : ''}"
          title="Toggle output console"
          onclick={() => (showConsole = !showConsole)}
        >
          <Terminal size={13} />
          <span>Console</span>
        </button>

        <div class="header-divider"></div>

        <button
          class="icon-btn"
          title={isMaximized ? 'Restore ukuran' : 'Maximize editor'}
          onclick={() => (isMaximized = !isMaximized)}
        >
          {#if isMaximized}
            <Minimize2 size={14} />
          {:else}
            <Maximize2 size={14} />
          {/if}
        </button>

        <button class="icon-btn" title="Tutup editor" onclick={onClose}>
          <X size={15} />
        </button>
      </div>
    </div>

    <!-- Main Editor Canvas & Optional Console -->
    <div class="drawer-content">
      <div class="editor-pane" bind:this={editorContainer}></div>

      {#if showConsole}
        <div class="console-pane mono-nums">
          <div class="console-header">
            <span>COMPILER & RUNTIME LOGS</span>
            <button class="clear-btn" onclick={() => (consoleLog = [])}>Clear</button>
          </div>
          <div class="console-body">
            {#each consoleLog as log}
              <div class="log-line {log.type}">
                <span class="log-time">[{log.time}]</span>
                {#if log.type === 'success'}
                  <Check size={11} class="log-icon" />
                {:else if log.type === 'error'}
                  <AlertCircle size={11} class="log-icon" />
                {/if}
                <span class="log-msg">{log.msg}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pine-drawer {
    position: absolute;
    bottom: 26px; /* Tepat di atas statusbar */
    left: 0;
    right: 0;
    height: 280px;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border-medium);
    z-index: 80;
    transition: height 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6);
  }

  .pine-drawer.maximized {
    height: calc(100vh - 74px); /* Penuh sampai bawah header */
  }

  .drawer-header {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
  }

  .title-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .editor-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    background: rgba(0, 242, 254, 0.12);
    color: var(--brand-cyan);
    border-radius: 3px;
    border: 1px solid rgba(0, 242, 254, 0.3);
    letter-spacing: 0.05em;
  }

  .title-input {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-main);
    font-size: 12px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    outline: none;
    width: 220px;
  }

  .title-input:hover,
  .title-input:focus {
    background: var(--bg-darkest);
    border-color: var(--border-bright);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-action {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-panel);
    border: 1px solid var(--border-medium);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-action:hover {
    background: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .btn-action.primary {
    background: var(--brand-blue);
    border-color: var(--brand-cyan);
    color: #fff;
  }

  .btn-action.primary:hover {
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.4);
  }

  .btn-action.active {
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
  }

  .header-divider {
    width: 1px;
    height: 18px;
    background: var(--border-subtle);
    margin: 0 2px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .icon-btn:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .drawer-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .editor-pane {
    flex: 1;
    height: 100%;
    min-width: 0;
    overflow: auto;
  }

  .console-pane {
    width: 320px;
    background: var(--bg-darkest);
    border-left: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    font-size: 11px;
  }

  .console-header {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: var(--text-main);
  }

  .console-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .log-line {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    line-height: 1.4;
    word-break: break-word;
  }

  .log-time {
    color: var(--text-dim);
    font-size: 9px;
  }

  .log-line.info {
    color: var(--text-muted);
  }
  .log-line.success {
    color: var(--bull-color);
  }
  .log-line.error {
    color: var(--bear-color);
  }

  :global(.log-icon) {
    margin-top: 2px;
    flex-shrink: 0;
  }
</style>
