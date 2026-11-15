import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { PersistenceService } from '../src/lib/services/persistence';
import { computeWorkspaceFingerprint } from '../src/lib/services/persistence/workspaceService';
import {
  WorkspaceAutoSaveCoordinator,
  buildWorkspaceSnapshotPayload,
  executeWorkspaceLoadPipeline,
  type WorkspaceChartPort,
  type WorkspaceChartSnapshot,
  type WorkspacePlanPort,
} from '../src/lib/services/workspaceLifecycle';
import { createMockChartContainer } from './helpers/mockChartContainer';
import type { SavedWorkspace } from '../src/lib/types/market';

function createFakeWorkspaceChartPort(initial?: Partial<WorkspaceChartSnapshot>): {
  port: WorkspaceChartPort;
  appliedSnapshots: Array<{ snapshot: WorkspaceChartSnapshot; preserveViewport?: boolean }>;
  getState: () => WorkspaceChartSnapshot;
} {
  let state: WorkspaceChartSnapshot = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    layout: '1',
    providerId: 'binance',
    showVolume: true,
    indicators: [],
    paneWeights: [1],
    paneLayout: [{ signature: 'price', weight: 1 }],
    nativeIndicators: [],
    priceScaleState: null,
    priceStyle: 'candles',
    priceScaleCountdown: false,
    barSpacing: 8,
    visibleRange: null,
    ...initial,
  };

  const appliedSnapshots: Array<{ snapshot: WorkspaceChartSnapshot; preserveViewport?: boolean }> = [];

  const port: WorkspaceChartPort = {
    captureWorkspaceSnapshot: () => structuredClone(state),
    applyWorkspaceSnapshot: async (snapshot, options) => {
      appliedSnapshots.push({
        snapshot: structuredClone(snapshot),
        preserveViewport: options?.preserveViewport,
      });
      state = {
        ...state,
        ...structuredClone(snapshot),
        visibleRange: options?.preserveViewport ? state.visibleRange : (snapshot.visibleRange ?? state.visibleRange),
      };
      options?.onSyncIndicators?.();
    },
  };

  return {
    port,
    appliedSnapshots,
    getState: () => state,
  };
}

function createMockWorkspaceForController(symbol = 'ETHUSDT', timeframe = '4h') {
  let currentConfig: Record<string, any> = {};
  let activeIndicators: any[] = [];
  let visibleRangeCalls = 0;
  let barSpacing = 8;
  const scenePanes = new Map<string, any>([
    ['price', { id: 'price', kind: 'price', heightWeight: 3, collapsed: false, showCountdown: false }],
  ]);
  const panesList: any[] = [{ id: 'price', kind: 'price', indicators: [] }];

  const cell: any = {
    id: 'c1',
    symbol: `BINANCE:${symbol}`,
    timeframe,
    setSymbol: (s: string) => { cell.symbol = s; },
    setTimeframe: (tf: string) => { cell.timeframe = tf; },
    chart: {
      indicators: () => activeIndicators,
      panes: { list: () => panesList },
      addIndicator: async (arg: any, opts?: any) => {
        const title = (typeof arg === 'object' ? arg?.title : opts?.title) || 'RSI';
        const ind = { id: `ind-${title}`, title, source: 'plot(rsi)', visible: true };
        activeIndicators.push(ind);
        panesList.push({ id: `study_${title}`, kind: 'study', indicators: [{ title }] });
        scenePanes.set(`study_${title}`, { id: `study_${title}`, kind: 'study', heightWeight: 1, collapsed: false });
        return ind;
      },
      setPriceStyle: (s: string) => { cell.priceStyle = s; },
      setPriceScaleCountdown: (enabled: boolean) => {
        const p = scenePanes.get('price');
        if (p) p.showCountdown = enabled;
      },
      setBarSpacing: (bs: number) => { barSpacing = bs; },
      setVisibleRange: () => { visibleRangeCalls++; },
      renderer: {
        renderer: {
          coords: {
            getViewport: () => ({ barSpacing }),
            setViewport: (vp: any) => { if (typeof vp?.barSpacing === 'number') barSpacing = vp.barSpacing; },
          },
          getConfig: () => currentConfig,
          applyConfig: (cfg: Record<string, any>) => {
            currentConfig = { ...currentConfig, ...cfg };
          },
          scene: {
            panes: scenePanes,
            orderedPanes: () => Array.from(scenePanes.values()),
            setPaneHeightWeight: (paneId: string, weight: number) => {
              const p = scenePanes.get(paneId);
              if (p) p.heightWeight = weight;
            },
            showCountdown: false,
          },
        },
      },
    },
    on: () => () => {},
  };

  const fakeWorkspace: any = {
    active: cell,
    cells: () => [cell],
    layout: '1',
    setLayout: () => {},
    setActiveCell: () => {},
    applyState: () => {},
    on: () => () => {},
  };

  return {
    fakeWorkspace,
    getVisibleRangeCalls: () => visibleRangeCalls,
    getCurrentConfig: () => currentConfig,
  };
}

describe('Ticket #214: Declarative WorkspaceChartSnapshot Seam', () => {
  test('1. ChartSessionController mengimplementasikan captureWorkspaceSnapshot() dan applyWorkspaceSnapshot() secara langsung', async () => {
    const { fakeWorkspace, getCurrentConfig } = createMockWorkspaceForController('ETHUSDT', '4h');
    const controller = new ChartSessionController({
      symbol: 'ETHUSDT',
      timeframe: '4h',
      providerId: 'binance',
      layout: '1',
      workspaceFactory: () => fakeWorkspace,
    });

    const container = createMockChartContainer();
    controller.attach(container as any);

    const snapshot: WorkspaceChartSnapshot = {
      symbol: 'ETHUSDT',
      timeframe: '4h',
      layout: '1',
      providerId: 'binance',
      showVolume: true,
      indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
      paneWeights: [3, 1],
      paneLayout: [
        { signature: 'price', weight: 3 },
        { signature: 'RSI', weight: 1 },
      ],
      nativeIndicators: [{ type: 'volume', visible: true, placement: 'own-pane' }],
      priceScaleState: { mode: 'log', autoScale: true },
      priceStyle: 'bars',
      priceScaleCountdown: true,
      barSpacing: 14,
      visibleRange: { from: 1000, to: 2000, atLiveEdge: false },
      rendererConfig: {
        layout: { background: '#000000' }, // harus tersanitasi
        candles: { wickVisible: false },
      },
    };

    // Pastikan controller memenuhi kontrak WorkspaceChartPort secara langsung
    const port: WorkspaceChartPort = controller;
    await port.applyWorkspaceSnapshot(snapshot);

    const captured = port.captureWorkspaceSnapshot();
    assert.equal(captured.priceStyle, 'bars');
    assert.equal(captured.priceScaleCountdown, true);
    assert.equal(captured.barSpacing, 14);
    assert.notEqual(getCurrentConfig().layout?.background, '#000000', 'Kunci global layout dari snapshot wajib disanitasi');
    assert.equal(getCurrentConfig().candles?.wickVisible, false);

    controller.destroy();
  });

  test('2. ChartSessionController.applyWorkspaceSnapshot menghormati opsi preserveViewport: true', async () => {
    const { fakeWorkspace, getVisibleRangeCalls } = createMockWorkspaceForController('BTCUSDT', '1h');
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      providerId: 'binance',
      layout: '1',
      workspaceFactory: () => fakeWorkspace,
    });
    const container = createMockChartContainer();
    controller.attach(container as any);

    await controller.applyWorkspaceSnapshot(
      {
        indicators: [],
        priceStyle: 'bars',
        visibleRange: { from: 100, to: 200, atLiveEdge: false },
      },
      { preserveViewport: true }
    );

    assert.equal(getVisibleRangeCalls(), 0, 'preserveViewport: true tidak boleh memanggil setVisibleRange');
    assert.equal(controller.getPriceStyle(), 'bars');
    controller.destroy();
  });

  test('3. End-to-end WorkspaceLifecycle: capture, fingerprint dirty detection, InMemoryLocalStorageAdapter({ memoryOnly: true }), dan restore', async () => {
    const adapter = new InMemoryLocalStorageAdapter({ memoryOnly: true });
    const persistence = new PersistenceService(adapter);

    const fakeChart = createFakeWorkspaceChartPort({
      symbol: 'SOLUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'bybit',
      priceStyle: 'candles',
      priceScaleCountdown: false,
      barSpacing: 10,
      indicators: [{ title: 'MACD', source: 'plot(macd)', visible: true }],
      paneLayout: [
        { signature: 'price', weight: 3 },
        { signature: 'MACD', weight: 1 },
      ],
    });

    const mockPlan: WorkspacePlanPort = {
      setWorkspaceId: () => {},
      clearAllPlans: () => {},
      restorePlans: () => {},
      getActivePlans: () => [],
      isThesisCardsVisible: () => true,
      flushDrawings: async () => {},
    };

    // 1. Capture snapshot awal & simpan ke InMemoryLocalStorageAdapter
    const initialPayload = buildWorkspaceSnapshotPayload({
      id: 'ws-e2e-214',
      name: 'E2E 214',
      symbol: 'SOLUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'bybit',
      chart: fakeChart.port,
      plan: mockPlan,
    });
    const savedInitial = await persistence.saveWorkspace(initialPayload as SavedWorkspace);

    const coordinator = new WorkspaceAutoSaveCoordinator({
      debounceMs: 10,
      onSave: async (input) => {
        await persistence.saveWorkspace({ ...input, id: 'ws-e2e-214' } as SavedWorkspace);
      },
    });
    coordinator.setSavedFingerprint(computeWorkspaceFingerprint(savedInitial));

    // 2. Mutasi priceScaleCountdown pada fake port -> fingerprint harus berubah & auto-save terpicu
    await fakeChart.port.applyWorkspaceSnapshot({
      ...fakeChart.port.captureWorkspaceSnapshot(),
      priceScaleCountdown: true,
    });

    const mutatedPayload = buildWorkspaceSnapshotPayload({
      id: 'ws-e2e-214',
      name: 'E2E 214',
      symbol: 'SOLUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'bybit',
      chart: fakeChart.port,
      plan: mockPlan,
    });
    const dirtyFp = coordinator.trigger(mutatedPayload);
    assert.ok(dirtyFp, 'Toggle priceScaleCountdown harus menandai workspace dirty');
    const flushed = await coordinator.flushNow();
    assert.equal(flushed, true, 'Coordinator harus menyimpan perubahan ke InMemoryLocalStorageAdapter');

    // 3. Muat kembali dari InMemoryLocalStorageAdapter dan restore ke fake port baru via executeWorkspaceLoadPipeline
    const workspaces = await persistence.loadWorkspaces();
    const reloaded = workspaces.find((w) => w.id === 'ws-e2e-214');
    assert.ok(reloaded, 'Workspace harus tersimpan di InMemoryLocalStorageAdapter');
    assert.equal(reloaded.priceScaleCountdown, true);

    const freshFakeChart = createFakeWorkspaceChartPort();
    const loadResult = await executeWorkspaceLoadPipeline({
      workspace: reloaded,
      chart: freshFakeChart.port,
      plan: mockPlan,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: () => {},
      onSyncIndicators: () => {},
    });

    assert.equal(loadResult.success, true);
    assert.equal(freshFakeChart.getState().priceScaleCountdown, true);
    assert.equal(freshFakeChart.getState().barSpacing, 10);
    assert.equal(freshFakeChart.getState().indicators[0]?.title, 'MACD');
    assert.equal(freshFakeChart.appliedSnapshots.length, 1);
  });
});
