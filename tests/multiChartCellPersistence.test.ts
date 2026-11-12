import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import {
  executeWorkspaceLoadPipeline,
  buildWorkspaceSnapshotPayload,
  type WorkspacePlanPort,
} from '../src/lib/services/workspaceLifecycle';
import { storage } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { createMockChartContainer } from './helpers/mockChartContainer';

function createFakeMultiCellVelaWorkspace(initialLayout: string = '4') {
  const wsListeners = new Map<string, Set<(payload?: any) => void>>();
  let layoutId = initialLayout;
  let activeId = 'c1';
  let trackSizes: Record<string, { cols?: number[]; rows?: number[] }> = {
    '4': { cols: [1.3, 0.7], rows: [0.8, 1.2] },
  };
  const applyStateCalls: any[] = [];

  function makeCell(
    id: string,
    symbol: string,
    timeframe: string,
    priceStyle: string,
    barSpacing: number,
    volHeightPct: number,
    studyName?: string,
    studyWeight: number = 1,
    priceWeight: number = 3,
    rendererCfgPatch: Record<string, any> = {}
  ) {
    const cellListeners = new Map<string, Set<(payload?: any) => void>>();
    let currentSymbol = symbol;
    let currentTf = timeframe;
    let currentStyle = priceStyle;
    let currentSpacing = barSpacing;
    let rendererConfig: any = {
      series: { style: priceStyle },
      priceScale: { mode: 'price', log: false, invert: false },
      ...rendererCfgPatch,
    };

    const volInputs: Record<string, any> = {
      upColor: '#00ff00',
      downColor: '#ff0000',
      heightPct: volHeightPct,
    };

    const volHandle = {
      id: `vol_${id}`,
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      paneId: volHeightPct > 15 ? 'pane-vol' : 'price',
      inputValues: () => ({ ...volInputs }),
      setInputs: (patch: any) => Object.assign(volInputs, patch),
      setVisible: (v: boolean) => {
        volHandle.visible = v;
      },
    };

    const activePineHandles: any[] = [];
    if (studyName) {
      activePineHandles.push({
        id: `pine_${id}_${studyName}`,
        title: studyName,
        source: `//@version=6\nindicator("${studyName}")\nplot(close)`,
        visible: true,
        inputValues: () => ({ length: 14 }),
        setInputs: () => {},
        setVisible: (v: boolean) => {
          activePineHandles[0].visible = v;
        },
        remove: () => {
          const idx = activePineHandles.findIndex((h) => h.id === `pine_${id}_${studyName}`);
          if (idx >= 0) activePineHandles.splice(idx, 1);
        },
      });
    }

    const panesMap = new Map<string, any>([
      ['price', { id: 'price', kind: 'price', order: 0, heightWeight: priceWeight, collapsed: false }],
    ]);
    const panesList: any[] = [
      {
        id: 'price',
        kind: 'price',
        order: 0,
        collapsed: false,
        indicators:
          volHandle.paneId === 'price'
            ? [{ id: volHandle.id, title: 'Volume', ownScale: false }]
            : [],
      },
    ];
    if (volHandle.paneId !== 'price') {
      panesMap.set('pane-vol', { id: 'pane-vol', kind: 'study', order: 1, heightWeight: 0.8, collapsed: false });
      panesList.push({
        id: 'pane-vol',
        kind: 'study',
        order: 1,
        collapsed: false,
        indicators: [{ id: volHandle.id, title: 'Volume', ownScale: false }],
      });
    }
    if (studyName) {
      panesMap.set(`pane-${studyName}`, {
        id: `pane-${studyName}`,
        kind: 'study',
        order: panesList.length,
        heightWeight: studyWeight,
        collapsed: false,
      });
      panesList.push({
        id: `pane-${studyName}`,
        kind: 'study',
        order: panesList.length,
        collapsed: false,
        indicators: [{ id: `pine_${id}_${studyName}`, title: studyName, ownScale: false }],
      });
    }

    const renderer = {
      scene: {
        panes: panesMap,
        orderedPanes: () => Array.from(panesMap.values()),
        volumeLayer: { heightFrac: volHeightPct / 100 },
      },
      layoutPanes: () => {},
      scheduler: { invalidate: () => {} },
      applyConfig: (patch: any) => {
        rendererConfig = {
          ...rendererConfig,
          ...patch,
          series: { ...(rendererConfig.series || {}), ...(patch?.series || {}) },
          priceScale: { ...(rendererConfig.priceScale || {}), ...(patch?.priceScale || {}) },
        };
        if (patch?.series?.style) currentStyle = patch.series.style;
      },
      getConfig: () => JSON.parse(JSON.stringify(rendererConfig)),
      setNativeData: () => {},
    };

    const coords = {
      getViewport: () => ({ barSpacing: currentSpacing }),
      setViewport: (vp: any) => {
        if (typeof vp?.barSpacing === 'number') currentSpacing = vp.barSpacing;
      },
    };

    let drawingsDoc: any = { version: 1, drawings: [] };

    const chart = {
      renderer,
      coords,
      indicators: () => [volHandle, ...activePineHandles],
      addIndicator: (source: string, opts: any) => {
        const h: any = {
          id: `pine_${id}_${opts?.title || 'Ind'}_${activePineHandles.length}`,
          title: opts?.title || 'Ind',
          source,
          visible: true,
          inputValues: () => ({ ...(opts?.inputs || {}) }),
          setInputs: (p: any) => {
            h._inputs = { ...(h._inputs || {}), ...p };
          },
          setProps: () => {},
          setVisible: (v: boolean) => {
            h.visible = v;
          },
          remove: () => {
            const idx = activePineHandles.indexOf(h);
            if (idx >= 0) activePineHandles.splice(idx, 1);
          },
        };
        activePineHandles.push(h);
        if (!source.includes('overlay=true') && !source.includes('overlay = true')) {
          const pId = `pane-${h.title}`;
          if (!panesMap.has(pId)) {
            panesMap.set(pId, { id: pId, kind: 'study', order: panesList.length, heightWeight: 1, collapsed: false });
            panesList.push({
              id: pId,
              kind: 'study',
              order: panesList.length,
              collapsed: false,
              indicators: [{ id: h.id, title: h.title, ownScale: false }],
            });
          }
        }
        for (const cb of cellListeners.get('indicator:added') || []) cb({ id: h.id });
        return h;
      },
      panes: {
        list: () => panesList,
        collapse: (pid: string, collapsed: boolean) => {
          const sp = panesMap.get(pid);
          if (sp) sp.collapsed = collapsed;
          const lp = panesList.find((p) => p.id === pid);
          if (lp) lp.collapsed = collapsed;
        },
        moveIndicator: (indId: string, target: any) => {
          for (const p of panesList) {
            const idx = p.indicators.findIndex((i: any) => i.id === indId);
            if (idx >= 0) p.indicators.splice(idx, 1);
          }
          if (target === 'price') {
            panesList[0].indicators.push({ id: indId, title: 'Volume', ownScale: false });
          } else {
            const newId = 'pane-vol';
            panesMap.set(newId, { id: newId, kind: 'study', order: panesList.length, heightWeight: 1, collapsed: false });
            panesList.push({
              id: newId,
              kind: 'study',
              order: panesList.length,
              collapsed: false,
              indicators: [{ id: indId, title: 'Volume', ownScale: false }],
            });
          }
        },
      },
      drawings: {
        all: () => drawingsDoc.drawings || [],
        toJSON: () => JSON.parse(JSON.stringify(drawingsDoc)),
        fromJSON: (doc: any) => {
          drawingsDoc = JSON.parse(JSON.stringify(doc || { version: 1, drawings: [] }));
        },
      },
      on: (ev: string, cb: (payload?: any) => void) => {
        if (!cellListeners.has(ev)) cellListeners.set(ev, new Set());
        cellListeners.get(ev)!.add(cb);
        return () => cellListeners.get(ev)?.delete(cb);
      },
      off: (ev: string, cb: (payload?: any) => void) => {
        cellListeners.get(ev)?.delete(cb);
      },
    };

    const cell: any = {
      id,
      get symbol() {
        return currentSymbol;
      },
      get timeframe() {
        return currentTf;
      },
      get priceStyle() {
        return currentStyle;
      },
      state: { bars: 500, session: 'regular' },
      chart,
      setSymbol: (s: string) => {
        currentSymbol = s;
      },
      setTimeframe: (tf: string) => {
        currentTf = tf;
      },
      setPriceStyle: (st: string) => {
        currentStyle = st;
        renderer.applyConfig({ series: { style: st } });
      },
    };

    return cell;
  }

  let cells: any[] = [
    makeCell('c1', 'binance:BTCUSDT', '15', 'candles', 10, 10, 'RSI', 0.9, 3.1, { candles: { wickVisible: true } }),
    makeCell('c2', 'bitunix:ETHUSDT.P', '60', 'bars', 14, 18, 'MACD', 1.4, 2.6, { priceScale: { mode: 'log', log: true, invert: false } }),
    makeCell('c3', 'indodax:BTCIDR', '240', 'line', 7, 12),
    makeCell('c4', 'binance:SOLUSDT', 'D', 'area', 12, 15, 'EMA', 1.0, 3.0),
  ];

  activeId = 'c2'; // Cell kedua (index 1) yang aktif!

  const ws: any = {
    get active() {
      return cells.find((c) => c.id === activeId) || cells[0];
    },
    cells: () => cells,
    cell: (id: string) => cells.find((c) => c.id === id),
    setLayout: (nextLayout: string) => {
      layoutId = nextLayout;
      const targetCount = nextLayout === '4' ? 4 : nextLayout === '2' || nextLayout === '2h' || nextLayout === '2v' ? 2 : 1;
      while (cells.length < targetCount) {
        const idx = cells.length + 1;
        cells.push(makeCell(`c${idx}`, 'binance:BTCUSDT', '15', 'candles', 8, 15));
      }
      if (cells.length > targetCount) {
        cells = cells.slice(0, targetCount);
      }
      if (!cells.some((c) => c.id === activeId)) {
        activeId = cells[0].id;
      }
    },
    setActiveCell: (id: string) => {
      const prev = activeId;
      if (cells.some((c) => c.id === id)) {
        activeId = id;
        for (const cb of wsListeners.get('cell:active') || []) {
          cb({ id, prev });
        }
      }
    },
    on: (ev: string, cb: (payload?: any) => void) => {
      if (!wsListeners.has(ev)) wsListeners.set(ev, new Set());
      wsListeners.get(ev)!.add(cb);
      return () => wsListeners.get(ev)?.delete(cb);
    },
    emit: (ev: string, payload?: any) => {
      for (const cb of wsListeners.get(ev) || []) cb(payload);
    },
    getState: () => ({
      version: 1,
      layout: layoutId,
      activeCellId: activeId,
      trackSizes: JSON.parse(JSON.stringify(trackSizes)),
      charts: cells.map((c) => ({
        id: c.id,
        symbol: c.symbol,
        timeframe: c.timeframe,
        priceStyle: c.priceStyle,
        session: c.state.session,
        bars: c.state.bars,
        rendererConfig: c.chart.renderer.getConfig(),
        // Field berikut sengaja ada di Vela getState() untuk diuji bahwa Trawangan membuangnya sesuai K1
        drawings: { version: 1, drawings: [{ id: 'vela_raw_draw' }] },
        indicators: { manifest: ['SecretVelaInd'], natives: ['volume'] },
      })),
    }),
    applyState: (doc: any) => {
      applyStateCalls.push(JSON.parse(JSON.stringify(doc)));
      if (doc?.trackSizes) {
        trackSizes = JSON.parse(JSON.stringify(doc.trackSizes));
      }
      if (Array.isArray(doc?.charts)) {
        for (const chartDoc of doc.charts) {
          const targetCell = cells.find((c) => c.id === chartDoc.id);
          if (!targetCell) continue;
          if (chartDoc.symbol) targetCell.setSymbol(chartDoc.symbol);
          if (chartDoc.timeframe) targetCell.setTimeframe(chartDoc.timeframe);
          if (chartDoc.priceStyle) targetCell.setPriceStyle(chartDoc.priceStyle);
          if (chartDoc.rendererConfig) targetCell.chart.renderer.applyConfig(chartDoc.rendererConfig);
          if (chartDoc.session) targetCell.state.session = chartDoc.session;
          if (chartDoc.bars) targetCell.state.bars = chartDoc.bars;
        }
      }
      if (doc?.activeCellId) {
        ws.setActiveCell(doc.activeCellId);
      }
    },
    sync: { set: () => {} },
    destroy: () => {},
  };

  if (initialLayout !== '4') {
    ws.setLayout(initialLayout);
  }

  return { ws, cells: () => cells, applyStateCalls };
}

describe('Fase 5: State Per-Sel Multi-Chart & Hybrid Restore', () => {
  it('1. getCellsSnapshot, getTrackSizes, dan getActiveCellIndex menangkap state lengkap tiap sel tanpa drawings/indicators Vela', () => {
    const mock = createFakeMultiCellVelaWorkspace('4');
    const controller = new ChartSessionController({
      symbol: 'ETHUSDT.P',
      timeframe: '1h',
      layout: '4',
      providerId: 'bitunix',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
    });
    controller.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => mock.ws });

    const trackSizes = controller.getTrackSizes();
    assert.deepEqual(trackSizes, { cols: [1.3, 0.7], rows: [0.8, 1.2] });

    const activeIdx = controller.getActiveCellIndex();
    assert.equal(activeIdx, 1, 'Cell c2 pada index 1 harus terdeteksi sebagai activeCellIndex');

    const cellsSnap = controller.getCellsSnapshot();
    assert.equal(cellsSnap.length, 4);

    assert.equal(cellsSnap[0].symbol, 'BTCUSDT');
    assert.equal(cellsSnap[0].providerId, 'binance');
    assert.equal(cellsSnap[0].timeframe, '15m');
    assert.equal(cellsSnap[0].priceStyle, 'candles');
    assert.equal(cellsSnap[0].barSpacing, 10);
    assert.equal(cellsSnap[0].indicators?.[0]?.title, 'RSI');

    assert.equal(cellsSnap[1].symbol, 'ETHUSDT.P');
    assert.equal(cellsSnap[1].providerId, 'bitunix');
    assert.equal(cellsSnap[1].timeframe, '1h');
    assert.equal(cellsSnap[1].priceStyle, 'bars');
    assert.equal(cellsSnap[1].barSpacing, 14);
    assert.equal(cellsSnap[1].priceScaleState?.mode, 'log');
    assert.equal(cellsSnap[1].nativeIndicators?.[0]?.inputs?.heightPct, 18);
    assert.equal(cellsSnap[1].nativeIndicators?.[0]?.placement, 'own-pane');
    assert.equal(cellsSnap[1].indicators?.[0]?.title, 'MACD');

    assert.equal(cellsSnap[2].symbol, 'BTCIDR');
    assert.equal(cellsSnap[2].providerId, 'indodax');
    assert.equal(cellsSnap[2].timeframe, '4h');

    assert.equal(cellsSnap[3].symbol, 'SOLUSDT');
    assert.equal(cellsSnap[3].timeframe, '1D');
    assert.equal(cellsSnap[3].indicators?.[0]?.title, 'EMA');

    // Pastikan tidak ada properti mentah drawings Vela pada snapshot sel
    assert.equal((cellsSnap[0] as any).drawings, undefined);
    assert.ok(cellsSnap[0].rendererConfig);
  });

  it('2. setLayout melewati applyLayoutTimeframePolicy & cloneIndicatorsToCells saat isRestoringWorkspace dan state:changed memancarkan trackSizes', () => {
    const mock = createFakeMultiCellVelaWorkspace('1');
    const reasons: string[] = [];
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      defaultTimeframe: '15m',
      layout: '1',
      onPersistableStateChange: (r) => reasons.push(r),
    });
    controller.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => mock.ws });
    reasons.length = 0;

    // Pasang indikator di cell 0 sebelum restore
    controller.beginWorkspaceRestore();
    controller.setLayout('2v');
    const cells = controller.getAllCells();
    cells[1].setTimeframe('D');
    // Panggil ulang setLayout dalam mode restore -> cell[1] timeframe D & indikator kosong TIDAK boleh ditimpa policy default
    controller.setLayout('2v');
    assert.equal(cells[1].timeframe, 'D');
    assert.equal(
      cells[1].chart.indicators().filter((i: any) => i.nativeType !== 'volume').length,
      0
    );
    controller.endWorkspaceRestore();

    // Event state:changed di luar restore memancarkan trackSizes
    mock.ws.emit('state:changed');
    assert.ok(reasons.includes('trackSizes'));
  });

  it('3. executeWorkspaceLoadPipeline memulihkan 4 sel independen, trackSizes, activeCellIndex, dan membuang drawings/indicators pada applyState', async () => {
    // Siapkan target controller bersih di layout 1
    const cleanMock = createFakeMultiCellVelaWorkspace('1');
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
    });
    controller.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => cleanMock.ws });

    const planPort: WorkspacePlanPort = {
      setWorkspaceId: () => {},
      clearAllPlans: () => {},
      resetInMemoryPlanState: () => {},
      restorePlans: () => {},
      getActivePlans: () => [],
      getAllActivePlans: () => [],
      isThesisCardsVisible: () => true,
    };

    const workspaceDoc: any = {
      id: 'ws-multi-4',
      name: 'Quad Grid Desk',
      schemaVersion: 2,
      symbol: 'ETHUSDT.P',
      timeframe: '1h',
      layout: '4',
      providerId: 'bitunix',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
      trackSizes: { cols: [1.4, 0.6], rows: [0.7, 1.3] },
      activeCellIndex: 1,
      indicators: [],
      cells: [
        {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          providerId: 'binance',
          priceStyle: 'candles',
          barSpacing: 9,
          rendererConfig: { series: { style: 'candles' } },
          paneLayout: [
            { signature: 'price', weight: 3.2 },
            { signature: 'RSI', weight: 0.8 },
          ],
          nativeIndicators: [{ type: 'volume', inputs: { heightPct: 9 }, visible: true, placement: 'overlay' }],
          indicators: [{ title: 'RSI', source: 'indicator("RSI")\nplot(close)', visible: true, inputs: { length: 14 } }],
        },
        {
          symbol: 'ETHUSDT.P',
          timeframe: '1h',
          providerId: 'bitunix',
          priceStyle: 'bars',
          barSpacing: 15,
          priceScaleState: { mode: 'log', log: true, invert: false, auto: true, manualScale: null },
          rendererConfig: { series: { style: 'bars' }, priceScale: { mode: 'price', log: true } },
          paneLayout: [
            { signature: 'price', weight: 2.2 },
            { signature: 'Volume', weight: 0.9 },
            { signature: 'MACD', weight: 1.5 },
          ],
          nativeIndicators: [{ type: 'volume', inputs: { heightPct: 22 }, visible: true, placement: 'own-pane' }],
          indicators: [{ title: 'MACD', source: 'indicator("MACD")\nplot(close)', visible: true }],
        },
        {
          symbol: 'BTCIDR',
          timeframe: '4h',
          providerId: 'indodax',
          priceStyle: 'line',
          barSpacing: 7,
          nativeIndicators: [{ type: 'volume', inputs: { heightPct: 12 }, visible: true, placement: 'overlay' }],
          indicators: [],
        },
        {
          symbol: 'SOLUSDT',
          timeframe: '1d',
          providerId: 'binance',
          priceStyle: 'area',
          barSpacing: 11,
          paneLayout: [
            { signature: 'price', weight: 2.9 },
            { signature: 'EMA', weight: 1.1 },
          ],
          nativeIndicators: [{ type: 'volume', inputs: { heightPct: 15 }, visible: true, placement: 'overlay' }],
          indicators: [{ title: 'EMA', source: 'indicator("EMA")\nplot(close)', visible: true }],
        },
      ],
    };

    const res = await executeWorkspaceLoadPipeline({
      workspace: workspaceDoc,
      chart: controller as any,
      plan: planPort,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: (l) => controller.setLayout(l),
      onSyncConfigChange: (cfg) => controller.syncLayout(cfg),
      onSyncIndicators: () => {},
    });

    assert.equal(res.success, true);

    const cells = controller.getAllCells();
    assert.equal(cells.length, 4);
    assert.equal(cells[0].symbol, 'binance:BTCUSDT');
    assert.equal(cells[1].symbol, 'bitunix:ETHUSDT.P');
    assert.equal(cells[2].symbol, 'indodax:BTCIDR');
    assert.equal(cells[3].symbol, 'binance:SOLUSDT');

    assert.equal(cells[0].timeframe, '15');
    assert.equal(cells[1].timeframe, '60');
    assert.equal(cells[2].timeframe, '240');
    assert.equal(cells[3].timeframe, 'D');

    assert.equal(controller.getBarSpacing(cells[0]), 9);
    assert.equal(controller.getBarSpacing(cells[1]), 15);
    assert.equal(controller.getPriceScaleState(cells[1])?.log, true);

    // Indikator per-sel independen saat syncConfig.indicators === false
    assert.deepEqual(
      cells[0].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      ['RSI']
    );
    assert.deepEqual(
      cells[1].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      ['MACD']
    );
    assert.deepEqual(
      cells[2].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      []
    );
    assert.deepEqual(
      cells[3].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      ['EMA']
    );

    // Pane layout & native volume heightPct per-sel
    assert.equal(controller.getNativeIndicators(cells[0])[0].inputs?.heightPct, 9);
    assert.equal(controller.getNativeIndicators(cells[1])[0].placement, 'own-pane');
    assert.equal(controller.getPaneLayout(cells[1]).find((p) => p.signature === 'MACD')?.weight, 1.5);

    // TrackSizes & activeCellIndex
    assert.deepEqual(controller.getTrackSizes(), { cols: [1.4, 0.6], rows: [0.7, 1.3] });
    assert.equal(controller.getActiveCellIndex(), 1);
    assert.equal(cleanMock.ws.active.id, 'c2');

    // Hybrid guard: applyState parsial tidak pernah membawa drawings / indicators milik Vela
    assert.ok(cleanMock.applyStateCalls.length >= 1);
    const lastApply = cleanMock.applyStateCalls[cleanMock.applyStateCalls.length - 1];
    assert.deepEqual(lastApply.trackSizes?.['4'], { cols: [1.4, 0.6], rows: [0.7, 1.3] });
    for (const c of lastApply.charts || []) {
      assert.equal(c.drawings, undefined);
      assert.equal(c.indicators, undefined);
    }

    // Payload snapshot juga harus memasukkan cells, trackSizes, activeCellIndex
    const snapPayload = buildWorkspaceSnapshotPayload({
      id: 'ws-multi-4',
      name: 'Quad Grid Desk',
      symbol: 'ETHUSDT.P',
      timeframe: '1h',
      layout: '4',
      providerId: 'bitunix',
      chart: controller as any,
      plan: planPort,
    });
    assert.equal(snapPayload.cells?.length, 4);
    assert.deepEqual(snapPayload.trackSizes, { cols: [1.4, 0.6], rows: [0.7, 1.3] });
    assert.equal(snapPayload.activeCellIndex, 1);
  });

  it('4. ChartDrawingController memulihkan drawing masing-masing sel saat restoreAllCellDrawings dan sync saat cell:active', async () => {
    const adapter = new InMemoryLocalStorageAdapter();
    storage.setAdapter(adapter);

    const btcDoc = { version: 1, drawings: [{ id: 'd_btc', type: 'trendline' }] };
    const ethDoc = { version: 1, drawings: [{ id: 'd_eth', type: 'hline' }] };
    await adapter.saveDrawings('ws-draw:binance:BTCUSDT', 'GLOBAL', JSON.stringify(btcDoc));
    await adapter.saveDrawings('ws-draw:binance:ETHUSDT', 'GLOBAL', JSON.stringify(ethDoc));

    const mock = createFakeMultiCellVelaWorkspace('2v');
    mock.ws.setLayout('2v');
    const cells = mock.ws.cells();
    cells[0].setSymbol('binance:BTCUSDT');
    cells[1].setSymbol('binance:ETHUSDT');
    mock.ws.setActiveCell('c1');

    const drawingCtrl = new ChartDrawingController();
    drawingCtrl.setWorkspaceId('ws-draw');
    drawingCtrl.attachWorkspace(
      mock.ws,
      () => (mock.ws.active.symbol.split(':')[1] || 'BTCUSDT'),
      () => '15m',
      () => (mock.ws.active.symbol.split(':')[0] || 'binance'),
      () => 'ws-draw'
    );

    await drawingCtrl.restoreAllCellDrawings('ws-draw');
    assert.deepEqual(
      cells[0].chart.drawings.all().map((d: any) => d.id),
      ['d_btc']
    );
    assert.deepEqual(
      cells[1].chart.drawings.all().map((d: any) => d.id),
      ['d_eth']
    );

    // Pindah active cell ke c2 -> activeDrawings mencerminkan drawing milik ETHUSDT
    mock.ws.setActiveCell('c2');
    assert.deepEqual(
      drawingCtrl.getSnapshot().activeDrawings.map((d: any) => d.id),
      ['d_eth']
    );
  });

  it('5. R3: Urutan restorasi applyCellsSnapshot sesuai Fase 5, getCellsSnapshot menyembunyikan cells[].indicators saat synced, & multi-cell memulihkan sharedIndicators', async () => {
    const syncedMock = createFakeMultiCellVelaWorkspace('2v');
    syncedMock.ws.setLayout('2v');
    const [c1, c2] = syncedMock.ws.cells();
    c1.setSymbol('binance:BTCUSDT');
    c2.setSymbol('binance:ETHUSDT');

    // Pasang indikator dan cek getCellsSnapshot dengan syncConfig.indicators = true (default)
    const syncedCtrl = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '2v',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    });
    syncedCtrl.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => syncedMock.ws });
    await syncedCtrl.addPineIndicator('plot(close)', 'SharedEMA');

    const syncedCellsSnap = syncedCtrl.getCellsSnapshot();
    assert.equal(syncedCellsSnap.length, 2);
    assert.equal(
      syncedCellsSnap[0].indicators,
      undefined,
      'Saat syncConfig.indicators aktif, cells[].indicators tidak boleh menduplikasi Pine source'
    );
    assert.equal(syncedCellsSnap[1].indicators, undefined);

    // Uji restorasi multi-cell dengan syncConfig.indicators = true & sharedIndicators pada root
    const targetMock = createFakeMultiCellVelaWorkspace('1');
    const eventOrder: string[] = [];
    const targetCtrl = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    });
    targetCtrl.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => targetMock.ws });

    // Instrumentasi metode untuk memverifikasi urutan tepat Fase 5 pada applyCellsSnapshot
    const origAddPine = targetCtrl.addPineIndicatorToCell.bind(targetCtrl);
    const origApplyNative = targetCtrl.applyNativeIndicators.bind(targetCtrl);
    const origApplyPane = targetCtrl.applyPaneLayout.bind(targetCtrl);
    const origApplyScale = targetCtrl.applyPriceScaleState.bind(targetCtrl);
    const origSetSpacing = targetCtrl.setBarSpacing.bind(targetCtrl);
    const origApplyVr = targetCtrl.applyVisibleRange.bind(targetCtrl);

    (targetCtrl as any).addPineIndicatorToCell = async (...args: any[]) => {
      eventOrder.push('pine');
      return origAddPine(...(args as [any, any, any, any, any, any]));
    };
    (targetCtrl as any).applyNativeIndicators = async (...args: any[]) => {
      eventOrder.push('native');
      return origApplyNative(...(args as [any, any]));
    };
    (targetCtrl as any).applyPaneLayout = async (...args: any[]) => {
      eventOrder.push('paneLayout');
      return origApplyPane(...(args as [any, any, any]));
    };
    (targetCtrl as any).applyPriceScaleState = (...args: any[]) => {
      eventOrder.push('priceScale');
      return origApplyScale(...(args as [any, any]));
    };
    (targetCtrl as any).setBarSpacing = (...args: any[]) => {
      eventOrder.push('barSpacing');
      return origSetSpacing(...(args as [any, any]));
    };
    (targetCtrl as any).applyVisibleRange = (...args: any[]) => {
      eventOrder.push('visibleRange');
      return origApplyVr(...(args as [any, any]));
    };

    const planPort: WorkspacePlanPort = {
      setWorkspaceId: () => {},
      clearAllPlans: () => {},
      resetInMemoryPlanState: () => {},
      restorePlans: () => {},
      getActivePlans: () => [],
      getAllActivePlans: () => [],
      isThesisCardsVisible: () => true,
    };

    await executeWorkspaceLoadPipeline({
      workspace: {
        id: 'ws-synced-order',
        name: 'Synced 2v',
        schemaVersion: 2,
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '2v',
        providerId: 'binance',
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
        indicators: [{ title: 'SharedEMA', source: 'indicator("SharedEMA")\nplot(close)', visible: true }],
        cells: [
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            providerId: 'binance',
            priceStyle: 'candles',
            barSpacing: 12,
            priceScaleState: { mode: 'log', log: true, invert: false, auto: true, manualScale: null },
            nativeIndicators: [{ type: 'volume', inputs: { heightPct: 10 }, visible: true, placement: 'overlay' }],
            paneLayout: [{ signature: 'price', weight: 3.5 }],
            visibleRange: { from: 100, to: 200 },
          },
          {
            symbol: 'ETHUSDT',
            timeframe: '1h',
            providerId: 'binance',
            priceStyle: 'bars',
            barSpacing: 9,
            priceScaleState: { mode: 'price', log: false, invert: false, auto: true, manualScale: null },
            nativeIndicators: [{ type: 'volume', inputs: { heightPct: 14 }, visible: true, placement: 'own-pane' }],
            paneLayout: [{ signature: 'price', weight: 3.0 }],
            visibleRange: { from: 150, to: 250 },
          },
        ],
        timestamp: Date.now(),
      },
      chart: targetCtrl as any,
      plan: planPort,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: (l) => targetCtrl.setLayout(l),
      onSyncConfigChange: (cfg) => targetCtrl.syncLayout(cfg),
      onSyncIndicators: () => {},
    });

    // Kedua sel memulihkan SharedEMA dari root indicators
    const finalCells = targetCtrl.getAllCells();
    assert.deepEqual(
      finalCells[0].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      ['SharedEMA']
    );
    assert.deepEqual(
      finalCells[1].chart.indicators().filter((i: any) => i.nativeType !== 'volume').map((i: any) => i.title),
      ['SharedEMA']
    );

    // Urutan per sel pertama wajib: pine -> native -> paneLayout -> priceScale -> barSpacing -> visibleRange
    const firstCellSlice = eventOrder.slice(0, 6);
    assert.deepEqual(
      firstCellSlice,
      ['pine', 'native', 'paneLayout', 'priceScale', 'barSpacing', 'visibleRange'],
      `Urutan restorasi sel wajib mengikuti Fase 5, actual=${firstCellSlice.join('->')}`
    );

    syncedCtrl.destroy();
    targetCtrl.destroy();
  });

  it('6. R4: perpindahan cell:active langsung mem-flush drawing sel sebelumnya dengan kunci sel lama sebelum beralih', async () => {
    const adapter = new InMemoryLocalStorageAdapter();
    const savedCalls: Array<{ symbol: string; tf: string; json: string }> = [];
    const origSave = adapter.saveDrawings.bind(adapter);
    adapter.saveDrawings = async (symbol: string, tf: string, data: string) => {
      savedCalls.push({ symbol, tf, json: data });
      return origSave(symbol, tf, data);
    };
    storage.setAdapter(adapter);

    const mock = createFakeMultiCellVelaWorkspace('2v');
    mock.ws.setLayout('2v');
    const cells = mock.ws.cells();
    cells[0].setSymbol('binance:BTCUSDT');
    cells[1].setSymbol('binance:ETHUSDT');
    mock.ws.setActiveCell('c1');

    const drawingCtrl = new ChartDrawingController();
    drawingCtrl.setWorkspaceId('ws-switch');
    drawingCtrl.attachWorkspace(
      mock.ws,
      () => {
        const sym = mock.ws.active?.symbol || 'BTCUSDT';
        return sym.includes(':') ? sym.split(':')[1] : sym;
      },
      () => '15m',
      () => {
        const sym = mock.ws.active?.symbol || 'binance:BTCUSDT';
        return sym.includes(':') ? sym.split(':')[0] : 'binance';
      },
      () => 'ws-switch'
    );

    // Simulasi user menggambar di c1 (BTCUSDT) lalu langsung klik pindah ke c2 (ETHUSDT) sebelum debounce 400ms
    cells[0].chart.drawings.fromJSON({
      version: 1,
      drawings: [{ id: 'd_btc_unsaved', type: 'trendline' }],
    });
    mock.ws.setActiveCell('c2');

    // Tunggu microtask flush asinkron
    await new Promise((r) => setTimeout(r, 15));

    const btcFlush = savedCalls.find((c) => c.symbol === 'ws-switch:binance:BTCUSDT');
    assert.ok(btcFlush, 'Drawing sel c1 wajib langsung di-flush ke kunci BTCUSDT saat pindah ke c2');
    assert.ok(
      JSON.parse(btcFlush!.json).drawings.some((d: any) => d.id === 'd_btc_unsaved'),
      'Payload flush wajib memuat d_btc_unsaved milik sel c1'
    );
    const leakedToEth = savedCalls.find(
      (c) => c.symbol === 'ws-switch:binance:ETHUSDT' && c.json.includes('d_btc_unsaved')
    );
    assert.equal(leakedToEth, undefined, 'Drawing sel lama tidak boleh tertulis ke kunci sel baru');
  });

  it('7. R5: ChartDrawingController.attachWorkspace() cleanup melepas listener workspace.on (cell:created & cell:active)', () => {
    const wsListeners = new Map<string, Set<(payload?: any) => void>>();
    const chart: any = {
      drawings: { all: () => [], toJSON: () => ({ version: 1, drawings: [] }) },
      on: () => () => {},
    };
    const cell = { id: 'c1', symbol: 'binance:BTCUSDT', timeframe: '15', chart };
    const ws: any = {
      active: cell,
      cells: () => [cell],
      cell: () => cell,
      on: (ev: string, cb: (payload?: any) => void) => {
        if (!wsListeners.has(ev)) wsListeners.set(ev, new Set());
        wsListeners.get(ev)!.add(cb);
        return () => wsListeners.get(ev)?.delete(cb);
      },
    };

    const drawingCtrl = new ChartDrawingController();
    const detach = drawingCtrl.attachWorkspace(ws, () => 'BTCUSDT', () => '15m', () => 'binance');
    assert.equal(wsListeners.get('cell:created')?.size ?? 0, 1);
    assert.equal(wsListeners.get('cell:active')?.size ?? 0, 1);

    detach();
    assert.equal(wsListeners.get('cell:created')?.size ?? 0, 0, 'cell:created harus dilepas oleh detach()');
    assert.equal(wsListeners.get('cell:active')?.size ?? 0, 0, 'cell:active harus dilepas oleh detach()');
  });

  it('8. Perpindahan cell:active antara macro:TOTAL dan binance:BTCUSDT meneruskan providerId lewat onActiveCellChange', () => {
    const mock = createFakeMultiCellVelaWorkspace('2v');
    const cells = mock.cells();
    cells[0].setSymbol('macro:TOTAL');
    cells[0].setTimeframe('D');
    cells[1].setSymbol('binance:BTCUSDT');
    cells[1].setTimeframe('15');
    mock.ws.setActiveCell('c2');

    const activeCellEvents: Array<{ symbol: string; timeframe: string; providerId?: string }> = [];
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '2v',
      providerId: 'binance',
      onActiveCellChange: (info) => {
        activeCellEvents.push(info);
      },
    });
    controller.attach(createMockChartContainer(1200, 800), { workspaceFactory: () => mock.ws });

    mock.ws.setActiveCell('c1');
    mock.ws.setActiveCell('c2');

    assert.deepEqual(activeCellEvents, [
      { symbol: 'TOTAL', timeframe: '1D', providerId: 'macro' },
      { symbol: 'BTCUSDT', timeframe: '15m', providerId: 'binance' },
    ]);

    controller.destroy();
  });
});
