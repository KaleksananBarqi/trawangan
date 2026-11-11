import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import {
  WorkspaceAutoSaveCoordinator,
  buildWorkspaceSnapshotPayload,
  executeExitFlush,
  resolvePendingWorkspaceOverride,
  PENDING_WORKSPACE_KEY_PREFIX,
  type WorkspacePlanPort,
} from '../src/lib/services/workspaceLifecycle';

function createMockContainer() {
  return {
    nodeType: 1,
    tagName: 'DIV',
    clientWidth: 1000,
    clientHeight: 600,
    style: { setProperty: () => {} },
    children: [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  } as any;
}

function createFakeChartEventHarness() {
  const listeners = new Map<string, Set<(payload?: any) => void>>();
  const configCallbacks = new Set<() => void>();
  let volInputs: Record<string, any> = { upColor: '#00ff00', downColor: '#ff0000', heightPct: 12 };

  const volHandle = {
    id: 'vol_native',
    nativeType: 'volume',
    title: 'Volume',
    visible: true,
    inputValues: () => ({ ...volInputs }),
    setInputs: (patch: Record<string, any>) => {
      volInputs = { ...volInputs, ...patch };
      emit('indicator:inputs', { id: 'vol_native' });
    },
    setVisible: (v: boolean) => {
      volHandle.visible = v;
    },
  };

  const pineHandle = {
    id: 'ind_rsi',
    title: 'RSI',
    visible: true,
    inputValues: () => ({ length: 14 }),
    setInputs: () => {},
    setVisible: () => {},
    remove: () => {},
  };

  const panesList = [
    {
      id: 'price',
      kind: 'price',
      order: 0,
      collapsed: false,
      maximized: false,
      indicators: [{ id: 'vol_native', title: 'Volume', ownScale: false }],
    },
    {
      id: 'pane-ind_rsi',
      kind: 'study',
      order: 1,
      collapsed: false,
      maximized: false,
      indicators: [{ id: 'ind_rsi', title: 'RSI', ownScale: false }],
    },
  ];

  const panesMap = new Map<string, any>([
    ['price', { id: 'price', kind: 'price', order: 0, heightWeight: 3.4, collapsed: false }],
    ['pane-ind_rsi', { id: 'pane-ind_rsi', kind: 'study', order: 1, heightWeight: 0.6, collapsed: false }],
  ]);

  const renderer = {
    scene: {
      panes: panesMap,
      orderedPanes: () => Array.from(panesMap.values()),
    },
    applyConfig: () => {},
    getConfig: () => ({ series: { style: 'candles' }, priceScale: { mode: 'price', log: false, invert: false } }),
    onConfigChanged: (cb: () => void) => {
      configCallbacks.add(cb);
      return () => configCallbacks.delete(cb);
    },
    setNativeData: () => {},
  };

  const coords = {
    getViewport: () => ({ barSpacing: 11.5 }),
    setViewport: () => {},
  };

  const chart = {
    renderer,
    coords,
    indicators: () => [volHandle, pineHandle],
    panes: {
      list: () => panesList,
      collapse: () => {},
    },
    on: (ev: string, cb: (payload?: any) => void) => {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev)!.add(cb);
      return () => listeners.get(ev)?.delete(cb);
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

  function emit(ev: string, payload?: any) {
    for (const cb of listeners.get(ev) || []) {
      cb(payload);
    }
  }

  function emitConfigChanged() {
    for (const cb of configCallbacks) {
      cb();
    }
  }

  return {
    ws,
    chart,
    cell,
    emit,
    emitConfigChanged,
  };
}

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    dump: () => store,
  };
}

describe('Fase 3: Pemicu Auto-Save Lengkap & Flush saat Exit', () => {
  it('1. ChartSessionController memancarkan onPersistableStateChange untuk mutasi chart relevan', async () => {
    const harness = createFakeChartEventHarness();
    const reasons: string[] = [];

    const controller = new ChartSessionController({
      onPersistableStateChange: (reason) => reasons.push(reason),
      viewportPersistDebounceMs: 20,
    });
    controller.attach(createMockContainer(), { workspaceFactory: () => harness.ws });
    reasons.length = 0;

    harness.emit('priceStyle:change', { from: 'candles', to: 'heikinashi' });
    assert.ok(reasons.includes('priceStyle'));

    harness.emitConfigChanged();
    assert.ok(reasons.includes('rendererConfig'));

    harness.emit('indicator:visibility', { id: 'ind_rsi', visible: false });
    assert.ok(reasons.includes('indicator:visibility'));

    harness.emit('indicator:moved', { id: 'ind_rsi', paneId: 'price' });
    assert.ok(reasons.includes('indicator:moved'));

    harness.emit('indicator:inputs', { id: 'ind_rsi' });
    assert.ok(reasons.includes('indicator:inputs'));

    harness.emit('pane:changed');
    assert.ok(reasons.includes('pane:changed'));

    // viewport:changed wajib ter-debounce (tidak sinkron seketika, lalu terpancar setelah delay)
    const beforeViewportCount = reasons.filter((r) => r === 'viewport').length;
    harness.emit('viewport:changed', { from: 100, to: 200 });
    harness.emit('viewport:changed', { from: 101, to: 201 });
    assert.equal(reasons.filter((r) => r === 'viewport').length, beforeViewportCount);

    await new Promise((r) => setTimeout(r, 45));
    assert.equal(reasons.filter((r) => r === 'viewport').length, beforeViewportCount + 1);
  });

  it('2. Suppression guard memblokir onPersistableStateChange saat restore workspace atau syncNativeVolumeColors', async () => {
    const harness = createFakeChartEventHarness();
    const reasons: string[] = [];

    const controller = new ChartSessionController({
      onPersistableStateChange: (reason) => reasons.push(reason),
      viewportPersistDebounceMs: 15,
    });
    controller.attach(createMockContainer(), { workspaceFactory: () => harness.ws });
    reasons.length = 0;

    // syncNativeVolumeColors memanggil handle.setInputs -> harness memancarkan indicator:inputs
    controller.syncNativeVolumeColors(harness.cell, false);
    assert.equal(reasons.length, 0, 'syncNativeVolumeColors tidak boleh memicu auto-save');

    // Saat beginWorkspaceRestore aktif, seluruh event ditekan
    controller.beginWorkspaceRestore();
    harness.emit('priceStyle:change', { from: 'candles', to: 'line' });
    harness.emit('pane:changed');
    harness.emit('viewport:changed', { from: 1, to: 10 });
    controller.endWorkspaceRestore();

    await new Promise((r) => setTimeout(r, 35));
    assert.equal(reasons.length, 0, 'Event selama beginWorkspaceRestore wajib diabaikan');
  });

  it('3. WorkspaceAutoSaveCoordinator memakai debounce default 1500ms dan flushNow() langsung menyimpan', async () => {
    let saveCalls = 0;
    let savedSymbol = '';
    const coordinator = new WorkspaceAutoSaveCoordinator({
      onSave: async (input) => {
        saveCalls++;
        savedSymbol = input.symbol;
      },
    });
    assert.equal((coordinator as any).debounceMs, 1500);

    coordinator.trigger({
      id: 'ws-flush',
      name: 'Flush WS',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
    });
    assert.equal(coordinator.isPending(), true);
    assert.equal(saveCalls, 0);

    const flushed = await coordinator.flushNow();
    assert.equal(flushed, true);
    assert.equal(coordinator.isPending(), false);
    assert.equal(saveCalls, 1);
    assert.equal(savedSymbol, 'ETHUSDT');

    // flushNow ulang tanpa perubahan lagi wajib diabaikan (fingerprint identik)
    const flushedAgain = await coordinator.flushNow({
      id: 'ws-flush',
      name: 'Flush WS',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
    });
    assert.equal(flushedAgain, false);
    assert.equal(saveCalls, 1);
  });

  it('4. buildWorkspaceSnapshotPayload menyatukan field v2 (paneLayout, nativeIndicators) dan getAllActivePlans', () => {
    const harness = createFakeChartEventHarness();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
    });
    controller.attach(createMockContainer(), { workspaceFactory: () => harness.ws });

    const allPlans = [
      { id: 'p-btc', symbol: 'BTCUSDT', bias: 'long', entry: 65000, stopLoss: 64000, targets: [{ price: 68000, percentage: 100 }] },
      { id: 'p-sol', symbol: 'SOLUSDT', bias: 'short', entry: 150, stopLoss: 160, targets: [{ price: 130, percentage: 100 }] },
    ];

    const planPort: WorkspacePlanPort = {
      setWorkspaceId: () => {},
      clearAllPlans: () => {},
      restorePlans: () => {},
      getActivePlans: () => [allPlans[0]], // hanya simbol aktif
      getAllActivePlans: () => allPlans, // seluruh simbol
      isThesisCardsVisible: () => true,
    };

    const payload = buildWorkspaceSnapshotPayload({
      id: 'ws-uni',
      name: 'Unified Snapshot',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      showVolume: true,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      chart: controller as any,
      plan: planPort,
      activeRightDockPanel: 'plan',
    });

    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.activeRightDockPanel, 'plan');
    assert.equal(payload.activePlans?.length, 2, 'Semua plan lintas koin wajib disertakan');
    assert.deepEqual(payload.paneLayout, [
      { signature: 'price', weight: 3.4 },
      { signature: 'RSI', weight: 0.6 },
    ]);
    assert.equal(payload.nativeIndicators?.length, 1);
    assert.equal(payload.nativeIndicators?.[0].type, 'volume');
    assert.equal(payload.nativeIndicators?.[0].inputs?.heightPct, 12);
  });

  it('5. Exit flush menyimpan backup sinkron localStorage & resolvePendingWorkspaceOverride memulihkan bila lebih baru', async () => {
    const storage = createMemoryStorage();
    let flushedDrawings = false;
    let savedToDb: any = null;

    const coordinator = new WorkspaceAutoSaveCoordinator({
      debounceMs: 1500,
      onSave: async (input) => {
        savedToDb = input;
      },
    });
    coordinator.setSavedFingerprint('old-fp');

    const snapshot = {
      id: 'ws-exit',
      name: 'Exit Test',
      schemaVersion: 2,
      symbol: 'BTCUSDT',
      timeframe: '4h',
      layout: '1',
      providerId: 'binance',
      indicators: [],
      paneLayout: [{ signature: 'price', weight: 3.8 }],
      timestamp: Date.now(),
    };

    const res = await executeExitFlush({
      flushDrawings: async () => {
        flushedDrawings = true;
      },
      buildSnapshot: () => snapshot,
      coordinator,
      storage,
    });

    assert.equal(flushedDrawings, true);
    assert.equal(res.pendingWritten, true);
    assert.equal(res.flushed, true);
    assert.equal(savedToDb?.timeframe, '4h');

    const pendingRaw = storage.getItem(`${PENDING_WORKSPACE_KEY_PREFIX}ws-exit`);
    assert.ok(pendingRaw, 'Backup sinkron pending wajib ditulis ke localStorage saat exit');

    // Simulasi kasus app crash / closed sebelum SQLite commit: SQLite punya timestamp lebih lama
    const staleSqliteWs: any = {
      id: 'ws-exit',
      name: 'Exit Test',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      indicators: [],
      timestamp: snapshot.timestamp - 5000,
    };

    const recovered = resolvePendingWorkspaceOverride(staleSqliteWs, 'ws-exit', storage);
    assert.equal(recovered.usedPending, true);
    assert.equal(recovered.workspace.timeframe, '4h');
    assert.equal(recovered.workspace.schemaVersion, 2);
    assert.equal(
      storage.getItem(`${PENDING_WORKSPACE_KEY_PREFIX}ws-exit`),
      null,
      'Key pending wajib dibersihkan sesudah dipulihkan'
    );

    // Jika SQLite sudah lebih baru dari pending, pakai SQLite dan bersihkan pending usang
    storage.setItem(
      `${PENDING_WORKSPACE_KEY_PREFIX}ws-exit`,
      JSON.stringify({ ...snapshot, timeframe: '5m', timestamp: 1000 })
    );
    const newerSqliteWs: any = { ...staleSqliteWs, timeframe: '1d', timestamp: 9999999999999 };
    const kept = resolvePendingWorkspaceOverride(newerSqliteWs, 'ws-exit', storage);
    assert.equal(kept.usedPending, false);
    assert.equal(kept.workspace.timeframe, '1d');
    assert.equal(storage.getItem(`${PENDING_WORKSPACE_KEY_PREFIX}ws-exit`), null);
  });
});
