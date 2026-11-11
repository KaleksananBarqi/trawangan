import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { chartDrawingController } from '../src/lib/services/chartDrawingController';
import {
  buildWorkspaceSnapshotPayload,
  executeWorkspaceLoadPipeline,
  type WorkspaceChartPort,
  type WorkspacePlanPort,
} from '../src/lib/services/workspaceLifecycle';
import {
  saveChartDefaultConfig,
  clearChartDefaultConfig,
  computeWorkspaceFingerprint,
} from '../src/lib/services/persistence';
import type { SavedWorkspace } from '../src/lib/types/market';
import { createMockChartContainer } from './helpers/mockChartContainer';

function createFakeCell(opts: {
  id?: string;
  symbol?: string;
  timeframe?: string;
  bars?: Array<{ time: number; open?: number; high?: number; low?: number; close?: number }>;
  visibleRange?: { from: number; to: number } | null;
  historyCompleted?: boolean;
  initialConfig?: any;
} = {}) {
  const listeners = new Map<string, Set<Function>>();
  const appliedConfigs: any[] = [];
  const setVisibleRangeCalls: Array<{ from: number; to: number }> = [];
  let rendererConfig: any = opts.initialConfig ? JSON.parse(JSON.stringify(opts.initialConfig)) : {
    candles: { upColor: '#26a69a', downColor: '#ef5350' },
    margins: { top: 0.1, bottom: 0.1 },
  };

  function deepMerge(target: any, patch: any) {
    if (!patch || typeof patch !== 'object') return target;
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  let currentVr = opts.visibleRange !== undefined ? opts.visibleRange : null;
  let barSpacing = 8;

  const nativeRenderer: any = {
    scene: {
      showPriceLine: true,
      panes: new Map([['price', { id: 'price', kind: 'price', heightWeight: 3 }]]),
      orderedPanes: () => [{ id: 'price', kind: 'price', heightWeight: 3 }],
    },
    coords: {
      barCount: opts.bars?.length ?? 0,
      width: 1000,
      get barSpacing() { return barSpacing; },
      setViewport: () => {},
    },
    bars: opts.bars ?? [],
    factoryConfig: JSON.parse(JSON.stringify(rendererConfig)),
    applyConfig(patch: any) {
      appliedConfigs.push(patch);
      rendererConfig = deepMerge(rendererConfig, patch);
    },
    getConfig() {
      return JSON.parse(JSON.stringify(rendererConfig));
    },
    set: () => {},
    onConfigChanged: () => () => {},
    scheduler: { invalidate: () => {} },
    factoryResetDocument: (orig: any) => JSON.parse(JSON.stringify(orig)),
  };

  const chart: any = {
    orchestrator: opts.historyCompleted !== undefined
      ? {
          historyCompleted: opts.historyCompleted,
          switchingMarket: false,
          rawBars: opts.bars ?? [],
        }
      : undefined,
    bars: opts.bars ?? [],
    renderer: {
      renderer: nativeRenderer,
      applyConfig: (patch: any) => nativeRenderer.applyConfig(patch),
      getConfig: () => nativeRenderer.getConfig(),
      getBarSpacing: () => barSpacing,
      setBarSpacing: (v: number) => { barSpacing = v; },
      setPriceScaleOptions: () => {},
    },
    panes: {
      list: () => [{ id: 'price', kind: 'price', order: 0, indicators: [] }],
    },
    indicators: () => [],
    drawings: {
      all: () => [],
      toJSON: () => ({ version: 1, drawings: [] }),
      fromJSON: () => {},
      setSnapMode: () => {},
      setStayMode: () => {},
    },
    getVisibleRange: () => currentVr ? { ...currentVr } : null,
    setVisibleRange(vr: { from: number; to: number }) {
      setVisibleRangeCalls.push({ ...vr });
      currentVr = { ...vr };
    },
    setPriceStyle: () => {},
    priceStyle: 'candles',
    on(ev: string, fn: Function) {
      let set = listeners.get(ev);
      if (!set) {
        set = new Set();
        listeners.set(ev, set);
      }
      set.add(fn);
      return () => set!.delete(fn);
    },
    off(ev: string, fn: Function) {
      listeners.get(ev)?.delete(fn);
    },
    emit(ev: string, payload?: any) {
      for (const fn of listeners.get(ev) || []) {
        fn(payload);
      }
    },
  };

  const cell: any = {
    id: opts.id || 'c1',
    symbol: opts.symbol || 'binance:BTCUSDT',
    timeframe: opts.timeframe || '15',
    priceStyle: 'candles',
    chart,
    state: { session: 'regular', bars: 500 },
    setSymbol(sym: string) { cell.symbol = sym; },
    setTimeframe(tf: string) { cell.timeframe = tf; },
    setPriceStyle(ps: string) { cell.priceStyle = ps; chart.priceStyle = ps; },
  };

  return { cell, chart, nativeRenderer, appliedConfigs, setVisibleRangeCalls };
}

function createFakeWorkspaceFromCells(cells: any[]) {
  return {
    active: cells[0],
    cells: () => cells,
    cell: (id: string) => cells.find((c) => c.id === id) ?? null,
    getState() {
      return {
        version: 1,
        layout: cells.length > 1 ? '2v' : '1',
        activeCellId: this.active?.id || 'c1',
        charts: cells.map((c) => ({
          id: c.id,
          symbol: c.symbol,
          timeframe: c.timeframe,
          priceStyle: c.priceStyle,
          rendererConfig: c.chart.renderer.getConfig(),
          session: c.state?.session,
          bars: c.state?.bars,
        })),
      };
    },
    applyState(doc: any) {
      if (Array.isArray(doc?.charts)) {
        for (const ch of doc.charts) {
          const target = cells.find((c) => c.id === ch.id);
          if (target) {
            if (ch.symbol) target.symbol = ch.symbol;
            if (ch.timeframe) target.timeframe = ch.timeframe;
            if (ch.rendererConfig) target.chart.renderer.applyConfig(ch.rendererConfig);
          }
        }
      }
    },
    setLayout: () => {},
    setTheme: () => {},
    on: () => () => {},
    off: () => {},
    destroy: () => {},
    sync: { set: () => {} },
  };
}

describe('Phase 6 — Workspace Persistence Completeness Suite', () => {
  beforeEach(async () => {
    await clearChartDefaultConfig();
    chartDrawingController.resetInMemoryPlanState();
    chartDrawingController.setSnapMode('off');
    chartDrawingController.setStayMode(false);
    (chartDrawingController as any).restoreThesisCardGeometries?.({});
  });

  afterEach(async () => {
    await clearChartDefaultConfig();
    chartDrawingController.resetInMemoryPlanState();
    chartDrawingController.setSnapMode('off');
    chartDrawingController.setStayMode(false);
    (chartDrawingController as any).restoreThesisCardGeometries?.({});
  });

  test('1. visibleRange K2: capture atLiveEdge flag & deferred history:complete restore ONLY when scrolled into history', async () => {
    // Buat 100 bar dengan interval 60_000ms (last bar time = 99 * 60_000 = 5_940_000)
    const bars = Array.from({ length: 100 }, (_, i) => ({ time: i * 60_000 }));

    // Case A: Viewport berada di ujung live (bar 80..99)
    const liveCellRig = createFakeCell({
      bars,
      visibleRange: { from: 80 * 60_000, to: 99 * 60_000 },
      historyCompleted: true,
    });
    const liveWs = createFakeWorkspaceFromCells([liveCellRig.cell]);
    const persistReasons: string[] = [];
    const ctrlLive = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => liveWs,
      onPersistableStateChange: (r) => persistReasons.push(r),
    });
    ctrlLive.attach(createMockChartContainer(1200, 720));

    const liveSnap = (ctrlLive as any).getVisibleRangeSnapshot();
    assert.ok(liveSnap, 'getVisibleRangeSnapshot harus mengembalikan range');
    assert.equal(liveSnap.from, 80 * 60_000);
    assert.equal(liveSnap.to, 99 * 60_000);
    assert.equal(liveSnap.atLiveEdge, true, 'harus menandai atLiveEdge=true di ujung live');

    const appliedAtLive = (ctrlLive as any).applyVisibleRange(liveSnap);
    assert.equal(appliedAtLive, false, 'K2: atLiveEdge=true tidak boleh memanggil setVisibleRange');
    assert.equal(liveCellRig.setVisibleRangeCalls.length, 0);
    ctrlLive.destroy();

    // Case B: Viewport di-scroll mundur ke masa lalu (bar 10..40, atLiveEdge = false)
    const histCellRig = createFakeCell({
      bars,
      visibleRange: { from: 10 * 60_000, to: 40 * 60_000 },
      historyCompleted: false,
    });
    const histWs = createFakeWorkspaceFromCells([histCellRig.cell]);
    const histPersistReasons: string[] = [];
    const ctrlHist = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => histWs,
      onPersistableStateChange: (r) => histPersistReasons.push(r),
    });
    ctrlHist.attach(createMockChartContainer(1200, 720));

    const histSnap = (ctrlHist as any).getVisibleRangeSnapshot();
    assert.equal(histSnap.atLiveEdge, false, 'harus menandai atLiveEdge=false saat scroll ke historis');

    // Simulasikan loadWorkspaceState pada target yang history belum selesai (historyCompleted=false)
    const targetRig = createFakeCell({
      bars,
      visibleRange: { from: 70 * 60_000, to: 99 * 60_000 },
      historyCompleted: false,
    });
    const targetWs = createFakeWorkspaceFromCells([targetRig.cell]);
    const ctrlTarget = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => targetWs,
      onPersistableStateChange: (r) => histPersistReasons.push(r),
    });
    ctrlTarget.attach(createMockChartContainer(1200, 720));

    const queued = (ctrlTarget as any).applyVisibleRange(histSnap);
    assert.equal(queued, true);
    assert.equal(targetRig.setVisibleRangeCalls.length, 0, 'Belum boleh setVisibleRange sebelum history:complete');

    // Sekarang emit history:complete -> barulah setVisibleRange dipanggil tepat 1x!
    targetRig.chart.emit('history:complete');
    assert.equal(targetRig.setVisibleRangeCalls.length, 1, 'Harus memanggil setVisibleRange setelah history:complete');
    assert.deepEqual(targetRig.setVisibleRangeCalls[0], { from: 10 * 60_000, to: 40 * 60_000 });

    // Pastikan roundtrip single-cell di buildWorkspaceSnapshotPayload & executeWorkspaceLoadPipeline
    const payload = buildWorkspaceSnapshotPayload({
      id: 'ws-vr',
      name: 'VR Test',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      chart: ctrlHist as unknown as WorkspaceChartPort,
    });
    assert.deepEqual(payload.visibleRange, histSnap);

    // Multi-cell: getCellsSnapshot juga harus menangkap visibleRange per cell
    const cellsSnap = ctrlHist.getCellsSnapshot();
    assert.deepEqual(cellsSnap[0].visibleRange, histSnap);

    ctrlHist.destroy();
    ctrlTarget.destroy();
  });

  test('2. chartDefaultConfig auto-load priority (K3: workspace rendererConfig > user default > factory) & UI button wiring', async () => {
    await saveChartDefaultConfig({
      candles: { upColor: '#00AAFF', downColor: '#FF4400' },
      margins: { top: 0.25 },
    });

    const rig = createFakeCell({
      id: 'c1',
      symbol: 'binance:BTCUSDT',
      initialConfig: { candles: { upColor: '#26a69a', downColor: '#ef5350' }, margins: { top: 0.1 } },
    });
    const ws = createFakeWorkspaceFromCells([rig.cell]);

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => ws,
    });
    controller.attach(createMockChartContainer(1200, 720));

    // Tunggu hidrasi chartDefaultConfig saat attach()
    await (controller as any).hydrateChartDefaultConfig?.();

    const afterBootConfig = rig.chart.renderer.getConfig();
    assert.equal(afterBootConfig.candles.upColor, '#00AAFF', 'attach() harus memuat & menerapkan chartDefaultConfig');
    assert.equal(afterBootConfig.margins.top, 0.25, 'properti non-candle di chartDefaultConfig ikut diterapkan');

    // Sekarang pulihkan workspace yang hanya menimpa candles.upColor -> downColor & margins dari default tetap bertahan!
    const wsSnapshot: SavedWorkspace = {
      id: 'ws-k3',
      name: 'K3 Priority',
      schemaVersion: 2,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      indicators: [],
      cells: [
        {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          providerId: 'binance',
          rendererConfig: {
            candles: { upColor: '#112233' },
          },
        },
      ],
      timestamp: Date.now(),
    };

    await controller.loadWorkspaceState(wsSnapshot);
    const afterWorkspaceConfig = rig.chart.renderer.getConfig();
    assert.equal(afterWorkspaceConfig.candles.upColor, '#112233', 'workspace rendererConfig harus menang atas default user');
    assert.equal(afterWorkspaceConfig.candles.downColor, '#FF4400', 'setting default user yg tidak ditimpa workspace tetap berlaku');
    assert.equal(afterWorkspaceConfig.margins.top, 0.25, 'margin default user tetap berlaku bila workspace tak mengubahnya');

    controller.destroy();

    // Cek wiring tombol "Simpan sebagai Default" di ChartTab.svelte, SettingsModal.svelte, +page.svelte
    const chartTabSrc = fs.readFileSync(path.resolve('src/lib/components/settings/ChartTab.svelte'), 'utf8');
    const settingsModalSrc = fs.readFileSync(path.resolve('src/lib/components/SettingsModal.svelte'), 'utf8');
    const pageSrc = fs.readFileSync(path.resolve('src/routes/+page.svelte'), 'utf8');

    assert.ok(chartTabSrc.includes('onSaveChartAsDefault'), 'ChartTab.svelte harus menerima prop onSaveChartAsDefault');
    assert.ok(chartTabSrc.includes('Simpan sebagai Default'), 'ChartTab.svelte harus punya tombol Simpan sebagai Default');
    assert.ok(settingsModalSrc.includes('onSaveChartAsDefault'), 'SettingsModal.svelte harus meneruskan onSaveChartAsDefault');
    assert.ok(pageSrc.includes('onSaveChartAsDefault'), '+page.svelte harus menghubungkan onSaveChartAsDefault');
    assert.ok(pageSrc.includes('saveCurrentChartSettingsAsDefault'), '+page.svelte harus memanggil saveCurrentChartSettingsAsDefault');
  });

  test('3. thesisCardGeometry: state di chartDrawingController, equality guard, snapshot roundtrip & props FloatingThesisCard', async () => {
    let notifyCount = 0;
    const unsub = chartDrawingController.subscribe(() => {
      notifyCount++;
    });
    notifyCount = 0;

    const geo1 = { x: 240, y: 120, width: 580, height: 380, isWideMode: true, isMinimized: true };
    const changed1 = (chartDrawingController as any).setThesisCardGeometry('plan-1', geo1);
    assert.equal(changed1, true);
    assert.equal(notifyCount, 1);

    // Equality guard: memanggil lagi dengan nilai sama TIDAK boleh memicu notify/dirty save
    const changedRepeat = (chartDrawingController as any).setThesisCardGeometry('plan-1', { ...geo1 });
    assert.equal(changedRepeat, false, 'Nilai geometri identik tidak boleh memicu dirty notify');
    assert.equal(notifyCount, 1);

    assert.deepEqual((chartDrawingController as any).getThesisCardGeometries(), { 'plan-1': geo1 });

    // Roundtrip buildWorkspaceSnapshotPayload & executeWorkspaceLoadPipeline
    const payload = buildWorkspaceSnapshotPayload({
      id: 'ws-geo',
      name: 'Geo WS',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      plan: chartDrawingController as unknown as WorkspacePlanPort,
    });
    assert.deepEqual(payload.thesisCardGeometry, { 'plan-1': geo1 });

    // Reset state controller, lalu restore melalui executeWorkspaceLoadPipeline
    (chartDrawingController as any).restoreThesisCardGeometries({});
    assert.deepEqual((chartDrawingController as any).getThesisCardGeometries(), {});

    const mockChart: WorkspaceChartPort = {
      clearAllIndicators: () => {},
      addPineIndicator: async () => {},
      getActiveIndicators: () => [],
      toggleIndicatorVisibility: () => {},
      setPriceStyle: () => {},
      setBarSpacing: () => {},
      applyPriceScaleState: () => {},
      applyPaneWeights: () => {},
    };

    const fullWorkspace: SavedWorkspace = {
      id: 'ws-geo',
      name: 'Geo WS',
      schemaVersion: 2,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      indicators: [],
      paneWeights: [],
      paneLayout: [],
      nativeIndicators: [],
      priceScaleState: null,
      priceStyle: 'candles',
      barSpacing: 8,
      showVolume: true,
      activePlans: [],
      showThesisCards: true,
      thesisCardGeometry: { 'plan-1': geo1 },
      drawingToolbar: { snapMode: 'off', stayMode: false },
      timestamp: Date.now(),
    };

    const res = await executeWorkspaceLoadPipeline({
      workspace: fullWorkspace,
      chart: mockChart,
      plan: chartDrawingController as unknown as WorkspacePlanPort,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: () => {},
      onSyncIndicators: () => {},
    });

    assert.equal(res.success, true);
    assert.deepEqual((chartDrawingController as any).getThesisCardGeometries(), { 'plan-1': geo1 });

    // Pastikan fingerprint Step 9 sama persis dengan buildWorkspaceSnapshotPayload pasca-load (anti false auto-save!)
    const postLoadPayload = buildWorkspaceSnapshotPayload({
      id: 'ws-geo',
      name: 'Geo WS',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      chart: mockChart,
      plan: chartDrawingController as unknown as WorkspacePlanPort,
    });
    assert.equal(computeWorkspaceFingerprint(postLoadPayload as any), res.fingerprint);

    unsub();

    // Verifikasi FloatingThesisCard & Chart.svelte mendukung isWideMode & isMinimized
    const cardSrc = fs.readFileSync(path.resolve('src/lib/components/FloatingThesisCard.svelte'), 'utf8');
    const chartSrc = fs.readFileSync(path.resolve('src/lib/components/Chart.svelte'), 'utf8');
    assert.ok(cardSrc.includes('initialIsWideMode'), 'FloatingThesisCard.svelte harus mendukung prop initialIsWideMode');
    assert.ok(cardSrc.includes('initialIsMinimized'), 'FloatingThesisCard.svelte harus mendukung prop initialIsMinimized');
    assert.ok(chartSrc.includes('initialIsWideMode'), 'Chart.svelte harus meneruskan initialIsWideMode ke FloatingThesisCard');
    assert.ok(chartSrc.includes('initialIsMinimized'), 'Chart.svelte harus meneruskan initialIsMinimized ke FloatingThesisCard');
    assert.ok(chartSrc.includes('setThesisCardGeometry'), 'Chart.svelte harus sinkron ke chartDrawingController.setThesisCardGeometry');
  });

  test('4. drawingToolbar (snapMode & stayMode): save, restore, fingerprint sensitivity & +page.svelte auto-save tracking', async () => {
    chartDrawingController.setSnapMode('strong');
    chartDrawingController.setStayMode(true);

    const payload = buildWorkspaceSnapshotPayload({
      id: 'ws-tb',
      name: 'Toolbar WS',
      symbol: 'SOLUSDT',
      timeframe: '1h',
      layout: '1',
      plan: chartDrawingController as unknown as WorkspacePlanPort,
    });

    assert.deepEqual(payload.drawingToolbar, { snapMode: 'strong', stayMode: true });

    // Fingerprint harus sensitif terhadap perubahan snapMode & stayMode
    const fp1 = computeWorkspaceFingerprint(payload as any);
    const fp2 = computeWorkspaceFingerprint({ ...payload, drawingToolbar: { snapMode: 'weak', stayMode: true } } as any);
    const fp3 = computeWorkspaceFingerprint({ ...payload, drawingToolbar: { snapMode: 'strong', stayMode: false } } as any);
    assert.notEqual(fp1, fp2);
    assert.notEqual(fp1, fp3);

    // Reset lalu restore via pipeline
    chartDrawingController.setSnapMode('off');
    chartDrawingController.setStayMode(false);

    const mockChart: WorkspaceChartPort = {
      clearAllIndicators: () => {},
      addPineIndicator: async () => {},
      getActiveIndicators: () => [],
      toggleIndicatorVisibility: () => {},
      setPriceStyle: () => {},
      setBarSpacing: () => {},
      applyPriceScaleState: () => {},
      applyPaneWeights: () => {},
    };

    const res = await executeWorkspaceLoadPipeline({
      workspace: {
        ...(payload as SavedWorkspace),
        id: 'ws-tb',
        name: 'Toolbar WS',
        timestamp: Date.now(),
      },
      chart: mockChart,
      plan: chartDrawingController as unknown as WorkspacePlanPort,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: () => {},
      onSyncIndicators: () => {},
    });

    assert.equal(res.success, true);
    assert.equal(chartDrawingController.getSnapshot().snapMode, 'strong');
    assert.equal(chartDrawingController.getSnapshot().stayMode, true);

    // Pastikan +page.svelte memantau snapMode, stayMode, dan thesisCardGeometries pada $effect auto-save
    const pageSrc = fs.readFileSync(path.resolve('src/routes/+page.svelte'), 'utf8');
    const effectBlockMatch = pageSrc.match(/\/\/ Pantau perubahan parameter UI[\s\S]*?triggerWorkspaceAutoSave\(\);[\s\S]*?\}\);/);
    assert.ok(effectBlockMatch, 'Blok $effect auto-save harus ditemukan di +page.svelte');
    const effectBlock = effectBlockMatch![0];
    assert.ok(effectBlock.includes('snapMode'), '$effect auto-save harus memantau snapMode');
    assert.ok(effectBlock.includes('stayMode'), '$effect auto-save harus memantau stayMode');
    assert.ok(effectBlock.includes('thesisCardGeometries') || effectBlock.includes('ThesisCardGeometries'), '$effect auto-save harus memantau thesisCardGeometries');
  });

  test('5. K3 rendererConfig Sanitizer: kunci tema global disaring saat persist & restore, override kustom sel bertahan', async () => {
    const rig = createFakeCell({
      id: 'c1',
      symbol: 'binance:BTCUSDT',
      initialConfig: {
        layout: { background: '#0D0E12', textColor: '#E5E7EB', fontSize: 12 },
        grid: { vertLines: { visible: true, color: 'rgba(255,255,255,0.06)' }, horzLines: { visible: true } },
        timeScale: { timezone: 'Asia/Jakarta' },
        panes: { separatorColor: '#333333' },
        priceScale: { mode: 'price', log: false, currentPriceLine: true, borderColor: '#444444' },
        crosshair: { color: '#777777', labelBackground: '#222222', width: 2, style: 'dashed', opacity: 0.8 },
        candles: { upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350', bodyVisible: true, borderVisible: true, wickVisible: false },
        bars: { upColor: '#26a69a', downColor: '#ef5350' },
        margins: { top: 0.18, bottom: 0.1 },
      },
    });
    const ws = createFakeWorkspaceFromCells([rig.cell]);

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      themePreset: 'signature',
      gridMode: 'normal',
      timezone: 'Asia/Jakarta',
      showCurrentPriceLine: true,
      workspaceFactory: () => ws,
    });
    controller.attach(createMockChartContainer(1200, 720));

    // Terapkan tema aktif signature (up=#26A69A, down=#EF5350) + grid normal
    controller.setTheme('signature');

    // Simulasikan getCellsSnapshot() saat tema warna sama persis dgn tema aktif + properti non-global (wickVisible=false, crosshair.width=2, margins.top=0.18)
    const cellsSnap = controller.getCellsSnapshot();
    const persistedRc = cellsSnap[0].rendererConfig as Record<string, any>;
    assert.ok(persistedRc, 'rendererConfig non-global tetap harus tersimpan');
    assert.equal(persistedRc.layout, undefined, 'layout global tidak boleh bocor ke workspace cell rendererConfig');
    assert.equal(persistedRc.grid, undefined, 'grid global tidak boleh bocor ke workspace cell rendererConfig');
    assert.equal(persistedRc.timeScale, undefined, 'timeScale.timezone global tidak boleh bocor ke workspace');
    assert.equal(persistedRc.panes?.separatorColor, undefined, 'panes.separatorColor global tidak boleh bocor');
    assert.equal(persistedRc.priceScale?.currentPriceLine, undefined, 'priceScale.currentPriceLine global tidak boleh bocor');
    assert.equal(persistedRc.priceScale?.borderColor, undefined, 'priceScale.borderColor global tidak boleh bocor');
    assert.equal(persistedRc.crosshair?.color, undefined, 'crosshair.color global tidak boleh bocor');
    assert.equal(persistedRc.crosshair?.labelBackground, undefined, 'crosshair.labelBackground global tidak boleh bocor');
    assert.equal(persistedRc.crosshair?.width, 2, 'crosshair.width non-global harus dipertahankan');
    assert.equal(persistedRc.margins?.top, 0.18, 'margins.top harus dipertahankan');
    assert.equal(persistedRc.candles?.wickVisible, false, 'flag candles.wickVisible harus dipertahankan');
    assert.equal(persistedRc.candles?.upColor, undefined, 'candles.upColor yang identik dgn tema aktif tidak boleh mengunci warna tema');
    assert.equal(persistedRc.bars, undefined, 'bars kosong setelah warna tema disaring harus dihilangkan');

    // Sekarang ubah tema global & gridMode ke 'light' + 'hidden' + 'UTC', lalu muat workspace LAMA yg terlanjur membawa kunci global usang
    controller.setTheme('light');
    controller.setGridMode('hidden');
    controller.setTimezone('UTC');
    controller.setShowCurrentPriceLine(true);

    const legacyWs: SavedWorkspace = {
      id: 'ws-legacy-k3',
      name: 'Legacy K3 Pollution',
      schemaVersion: 2,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      indicators: [],
      cells: [
        {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          providerId: 'binance',
          rendererConfig: {
            layout: { background: '#990000', textColor: '#111111' },
            grid: { vertLines: { visible: true, color: '#ff00ff' }, horzLines: { visible: true, color: '#ff00ff' } },
            timeScale: { timezone: 'America/New_York' },
            panes: { separatorColor: '#888888' },
            priceScale: { currentPriceLine: false, borderColor: '#555555' },
            crosshair: { color: '#aaaaaa', labelBackground: '#000000', width: 3 },
            candles: { upColor: '#abcdef' },
            margins: { top: 0.22 },
          },
        },
      ],
      timestamp: Date.now(),
    };

    await controller.loadWorkspaceState(legacyWs);
    const afterRestoreCfg = rig.chart.renderer.getConfig();
    assert.notEqual(afterRestoreCfg.layout?.background, '#990000', 'Restore workspace lama tidak boleh menimpa background tema global aktif');
    assert.equal(afterRestoreCfg.grid?.vertLines?.visible, false, 'Restore workspace lama tidak boleh menyalakan ulang grid yang sedang hidden secara global');
    assert.equal(afterRestoreCfg.priceScale?.currentPriceLine, true, 'currentPriceLine global wajib dipertahankan');
    assert.equal(afterRestoreCfg.candles?.upColor, '#abcdef', 'Override candle kustom eksplisit dari workspace wajib tetap dipulihkan');
    assert.equal(afterRestoreCfg.margins?.top, 0.22, 'Override margin eksplisit dari workspace wajib tetap dipulihkan');
    assert.equal(afterRestoreCfg.crosshair?.width, 3, 'crosshair.width non-global wajib tetap dipulihkan');

    controller.destroy();
  });
});
