import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { executeWorkspaceLoadPipeline, type WorkspacePlanPort } from '../src/lib/services/workspaceLifecycle';
import { createMockChartContainer } from './helpers/mockChartContainer';

function createFakePaneChartHarness() {
  const listeners = new Map<string, Set<(payload?: any) => void>>();
  let layoutPanesCalls = 0;
  let invalidateCalls = 0;

  const panesMap = new Map<string, any>([
    ['price', { id: 'price', kind: 'price', order: 0, heightWeight: 3, collapsed: false }],
  ]);

  const indicatorsMeta = new Map<string, { paneId: string; title: string; collapsed?: boolean }>();

  const scene = {
    panes: panesMap,
    orderedPanes: () =>
      Array.from(panesMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    ensurePane: (id: string, kind: string, order: number, heightWeight: number) => {
      const existing = panesMap.get(id);
      if (existing) {
        existing.order = order;
        existing.heightWeight = heightWeight;
        existing.kind = kind;
        return existing;
      }
      const p = { id, kind, order, heightWeight, collapsed: false };
      panesMap.set(id, p);
      return p;
    },
  };

  const nativeRenderer = {
    scene,
    ensurePane: (pane: { id: string; kind: string; order: number; heightWeight?: number }) => {
      return scene.ensurePane(
        pane.id,
        pane.kind,
        pane.order,
        pane.heightWeight ?? (pane.kind === 'price' ? 3 : 1)
      );
    },
    layoutPanes: () => {
      layoutPanesCalls++;
    },
    scheduler: {
      invalidate: () => {
        invalidateCalls++;
      },
    },
    applyConfig: () => {},
    getConfig: () => ({ series: { style: 'candles' }, priceScale: { mode: 'price' } }),
  };

  const chart = {
    renderer: nativeRenderer,
    indicators: () =>
      Array.from(indicatorsMeta.entries()).map(([id, meta]) => ({
        id,
        title: meta.title,
        visible: true,
        remove: () => {},
      })),
    panes: {
      list: () => {
        const byPane = new Map<string, Array<{ id: string; title: string; ownScale: boolean }>>();
        for (const [id, meta] of indicatorsMeta.entries()) {
          if (!byPane.has(meta.paneId)) byPane.set(meta.paneId, []);
          byPane.get(meta.paneId)!.push({ id, title: meta.title, ownScale: false });
        }
        return scene.orderedPanes().map((p: any, idx: number) => ({
          id: p.id,
          kind: p.kind,
          order: idx,
          collapsed: Boolean(p.collapsed),
          maximized: false,
          indicators: byPane.get(p.id) ?? [],
        }));
      },
      collapse: (paneId: string, collapsed: boolean) => {
        const p = panesMap.get(paneId);
        if (p) p.collapsed = collapsed;
      },
    },
    addIndicator: () => ({ id: `ind_${indicatorsMeta.size + 1}`, title: 'Mock' }),
    on: (event: string, cb: (payload?: any) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
      return () => {
        listeners.get(event)?.delete(cb);
      };
    },
  };

  const cell = {
    id: 'cell_0',
    symbol: 'binance:BTCUSDT',
    timeframe: '15',
    chart,
  };

  const ws = {
    cells: () => [cell],
    cell: () => cell,
    active: cell,
    on: () => () => {},
  };

  const emit = (event: string, payload?: any) => {
    for (const cb of listeners.get(event) || []) {
      cb(payload);
    }
  };

  const spawnStudyPane = (indId: string, title: string, weight = 1) => {
    const paneId = `pane-${indId}`;
    const order = panesMap.size;
    nativeRenderer.ensurePane({ id: paneId, kind: 'study', order, heightWeight: weight });
    indicatorsMeta.set(indId, { paneId, title });
    emit('indicator:added', { id: indId });
    emit('pane:changed');
  };

  return {
    ws,
    chart,
    cell,
    nativeRenderer,
    panesMap,
    spawnStudyPane,
    getLayoutCalls: () => layoutPanesCalls,
    getInvalidateCalls: () => invalidateCalls,
  };
}

describe('Fase 2: Persistensi Tata Letak Panel Bawah (paneLayout)', () => {
  it('1. getPaneLayout menghasilkan entri berbasis signature yang tahan terhadap perubahan urutan pane', () => {
    const harness = createFakePaneChartHarness();
    const controller = new ChartSessionController();
    controller.attach(createMockChartContainer(), { workspaceFactory: () => harness.ws });

    harness.spawnStudyPane('ind_rsi', 'RSI', 0.45);
    harness.spawnStudyPane('ind_macd', 'MACD', 1.55);
    harness.panesMap.get('price')!.heightWeight = 3.2;

    const layout = controller.getPaneLayout();
    assert.deepEqual(layout, [
      { signature: 'price', weight: 3.2 },
      { signature: 'RSI', weight: 0.45 },
      { signature: 'MACD', weight: 1.55 },
    ]);
  });

  it('2. applyPaneLayout menunggu sub-pane worker Pine secara event-driven dan mencocokkan via signature meski urutan terbalik', async () => {
    const harness = createFakePaneChartHarness();
    const controller = new ChartSessionController();
    controller.attach(createMockChartContainer(), { workspaceFactory: () => harness.ws });

    // Jalankan applyPaneLayout SEBELUM sub-pane tercipta (simulasi worker async)
    const applyPromise = controller.applyPaneLayout(
      [
        { signature: 'price', weight: 3.5 },
        { signature: 'RSI', weight: 0.4 },
        { signature: 'MACD', weight: 1.8 },
      ],
      { timeoutMs: 1000 }
    );

    // Simulasikan urutan pane terbalik muncul secara asinkron
    setTimeout(() => {
      harness.spawnStudyPane('ind_macd', 'MACD', 1);
    }, 15);
    setTimeout(() => {
      harness.spawnStudyPane('ind_rsi', 'RSI', 1);
    }, 30);

    const applied = await applyPromise;
    assert.equal(applied, true);
    assert.equal(harness.panesMap.get('price')!.heightWeight, 3.5);
    assert.equal(harness.panesMap.get('pane-ind_rsi')!.heightWeight, 0.4);
    assert.equal(harness.panesMap.get('pane-ind_macd')!.heightWeight, 1.8);
    assert.ok(harness.getLayoutCalls() >= 1);
  });

  it('3. Guard ensurePane mempertahankan heightWeight yang sudah di-restore dari reset default Vela', async () => {
    const harness = createFakePaneChartHarness();
    const controller = new ChartSessionController();
    controller.attach(createMockChartContainer(), { workspaceFactory: () => harness.ws });

    harness.spawnStudyPane('ind_rsi', 'RSI', 1);

    await controller.applyPaneLayout([
      { signature: 'price', weight: 3.6 },
      { signature: 'RSI', weight: 0.35 },
    ]);

    // Simulasikan Vela orchestrator memanggil ensurePane TANPA heightWeight setelah history/model update
    harness.nativeRenderer.ensurePane({ id: 'price', kind: 'price', order: 0 });
    harness.nativeRenderer.ensurePane({ id: 'pane-ind_rsi', kind: 'study', order: 1 });

    assert.equal(harness.panesMap.get('price')!.heightWeight, 3.6, 'Bobot price tidak boleh ter-reset ke 3');
    assert.equal(harness.panesMap.get('pane-ind_rsi')!.heightWeight, 0.35, 'Bobot RSI tidak boleh ter-reset ke 1');
  });

  it('4. capturePaneLayoutIfChanged mendeteksi drag separator pane oleh user dan memicu onPersistableStateChange', () => {
    const harness = createFakePaneChartHarness();
    const reasons: string[] = [];
    const controller = new ChartSessionController({
      onPersistableStateChange: (reason) => reasons.push(reason),
    });
    controller.attach(createMockChartContainer(), { workspaceFactory: () => harness.ws });

    harness.spawnStudyPane('ind_rsi', 'RSI', 1);
    // Rekam kondisi awal
    controller.capturePaneLayoutIfChanged();
    reasons.length = 0;

    // Tanpa perubahan -> false
    assert.equal(controller.capturePaneLayoutIfChanged(), false);
    assert.equal(reasons.length, 0);

    // Simulasi user drag separator (paneResizeBy mengubah heightWeight langsung di scene)
    harness.panesMap.get('price')!.heightWeight = 3.5;
    harness.panesMap.get('pane-ind_rsi')!.heightWeight = 0.5;

    assert.equal(controller.capturePaneLayoutIfChanged(), true);
    assert.ok(reasons.includes('paneLayout'));
  });

  it('5. executeWorkspaceLoadPipeline meneruskan w.paneLayout ke chart.applyPaneLayout', async () => {
    const harness = createFakePaneChartHarness();
    const controller = new ChartSessionController();
    controller.attach(createMockChartContainer(), { workspaceFactory: () => harness.ws });
    harness.spawnStudyPane('ind_rsi', 'RSI', 1);

    const mockPlan: WorkspacePlanPort = {
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
        id: 'ws-pane',
        name: 'Compact Bottom',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
        indicators: [],
        paneLayout: [
          { signature: 'price', weight: 3.7 },
          { signature: 'RSI', weight: 0.3 },
        ],
        timestamp: Date.now(),
      },
      chart: controller as any,
      plan: mockPlan,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: () => {},
      onSyncIndicators: () => {},
    });

    assert.equal(harness.panesMap.get('price')!.heightWeight, 3.7);
    assert.equal(harness.panesMap.get('pane-ind_rsi')!.heightWeight, 0.3);
  });

  it('6. R4: installEnsurePaneGuard menghormati flag userTouchedPaneLayout setelah user menggeser pane secara manual', async () => {
    const receivedEnsurePaneArgs: any[] = [];
    const panesMap = new Map<string, any>([
      ['price', { id: 'price', kind: 'price', order: 0, heightWeight: 3, collapsed: false }],
      ['pane-ind_rsi', { id: 'pane-ind_rsi', kind: 'study', order: 1, heightWeight: 1, collapsed: false }],
    ]);
    const panesList = [
      { id: 'price', kind: 'price', order: 0, collapsed: false, indicators: [] },
      { id: 'pane-ind_rsi', kind: 'study', order: 1, collapsed: false, indicators: [{ id: 'ind_rsi', title: 'RSI' }] },
    ];

    const nativeRenderer: any = {
      scene: {
        panes: panesMap,
        orderedPanes: () => Array.from(panesMap.values()),
      },
      ensurePane: (pane: any) => {
        receivedEnsurePaneArgs.push({ ...pane });
        const target = panesMap.get(pane.id);
        if (target && pane.heightWeight !== undefined) {
          target.heightWeight = pane.heightWeight;
        }
      },
      layoutPanes: () => {},
      scheduler: { invalidate: () => {} },
    };

    const chart = {
      renderer: nativeRenderer,
      panes: { list: () => panesList },
      indicators: () => [{ id: 'ind_rsi', title: 'RSI' }],
      on: () => () => {},
    };
    const cell = { id: 'c1', symbol: 'binance:BTCUSDT', timeframe: '15', chart };
    const ws = { cells: () => [cell], cell: () => cell, active: cell, on: () => () => {} };

    const controller = new ChartSessionController();
    controller.attach(createMockChartContainer(), { workspaceFactory: () => ws });

    await controller.applyPaneLayout([
      { signature: 'price', weight: 3.6 },
      { signature: 'RSI', weight: 0.35 },
    ]);

    // Sebelum user menyentuh layout, ensurePane tanpa heightWeight dijaga agar tetap 0.35
    receivedEnsurePaneArgs.length = 0;
    nativeRenderer.ensurePane({ id: 'pane-ind_rsi', kind: 'study', order: 1 });
    assert.equal(receivedEnsurePaneArgs[0]?.heightWeight, 0.35);

    // Simulasi user drag separator secara manual lalu tertangkap oleh capturePaneLayoutIfChanged
    panesMap.get('price')!.heightWeight = 2.0;
    panesMap.get('pane-ind_rsi')!.heightWeight = 2.0;
    assert.equal(controller.capturePaneLayoutIfChanged(cell), true);

    // Setelah userTouchedPaneLayout aktif, ensurePane tanpa heightWeight diteruskan apa adanya tanpa dipaksa bobot restore lama
    receivedEnsurePaneArgs.length = 0;
    nativeRenderer.ensurePane({ id: 'pane-ind_rsi', kind: 'study', order: 1 });
    assert.equal(
      receivedEnsurePaneArgs[0]?.heightWeight,
      undefined,
      'Guard harus mengalah pada ensurePane asli setelah user menggeser pane secara manual'
    );
  });
});
