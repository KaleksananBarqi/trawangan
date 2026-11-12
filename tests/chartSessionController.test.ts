import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartSessionController,
  resolveVelaSymbol,
  type ChartSessionSnapshot
} from '../src/lib/services/chartSessionController';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

// Mock WebGL Container & Vela Workspace Factory untuk Headless Testing
function createMockContainer(): any {
  return {
    nodeType: 1,
    tagName: 'DIV',
    clientWidth: 1200,
    clientHeight: 800,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function createMockWorkspace() {
  let destroyed = false;
  let activeSymbol = 'binance:BTCUSDT';
  let activeTimeframe = '15';
  let appliedTheme: any = null;
  let appliedTimezone = 'Asia/Jakarta';
  const listeners = new Map<string, Function[]>();

  const mockCell = {
    id: 'cell_main',
    symbol: activeSymbol,
    timeframe: activeTimeframe,
    setSymbol(sym: string) {
      activeSymbol = sym;
      this.symbol = sym;
    },
    setTimeframe(tf: string) {
      activeTimeframe = tf;
      this.timeframe = tf;
    },
    chart: {
      renderer: {
        renderer: {
          set(key: string, val: any) {
            if (key === 'timezone') appliedTimezone = val;
          },
          coords: {
            timezone: appliedTimezone,
          }
        }
      }
    }
  };

  return {
    cells: () => [mockCell],
    cell: (id: string) => (id === 'cell_main' ? mockCell : null),
    active: mockCell,
    on(event: string, fn: Function) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    emit(event: string, ...args: any[]) {
      const list = listeners.get(event) || [];
      for (const fn of list) fn(...args);
    },
    destroy() {
      destroyed = true;
    },
    isDestroyed: () => destroyed,
    getActiveSymbol: () => activeSymbol,
    getActiveTimeframe: () => activeTimeframe,
    getAppliedTheme: () => appliedTheme,
    getAppliedTimezone: () => appliedTimezone,
  };
}

test.describe('ChartSessionController Seam Suite (#51)', () => {
  test('1. resolveVelaSymbol: menormalkan format bursa dan simbol sesuai provider', () => {
    assert.equal(resolveVelaSymbol('BTCUSDT', 'binance'), 'binance:BTCUSDT');
    assert.equal(resolveVelaSymbol('BTC/IDR', 'indodax'), 'indodax:BTCIDR');
    assert.equal(resolveVelaSymbol('ETHIDR', 'indodax'), 'indodax:ETHIDR');
    assert.equal(resolveVelaSymbol('SOLUSDT', 'bitunix'), 'bitunix:SOLUSDT');
    assert.equal(resolveVelaSymbol('BTCUSDT', 'hyperliquid'), 'hyperliquid:BTC');
    assert.equal(resolveVelaSymbol('ETHUSDT', 'coinbase'), 'coinbase:ETH-USD');
  });

  test('2. Initial State & Subscription Contract', () => {
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      timezone: 'Asia/Jakarta'
    });

    const initial = controller.getSnapshot();
    assert.equal(initial.isAttached, false);
    assert.equal(initial.symbol, 'BTCUSDT');
    assert.equal(initial.timeframe, '15m');
    assert.equal(initial.timezone, 'Asia/Jakarta');

    // Subscribe immediately receives snapshot
    let received: ChartSessionSnapshot | undefined;
    const unsub = controller.subscribe((snap) => {
      received = snap;
    });

    assert.ok(received);
    if (!received) throw new Error('Snapshot not received');
    assert.equal(received.symbol, 'BTCUSDT');
    assert.equal(received.isAttached, false);

    unsub();
    controller.destroy();
  });

  test('3. Headless Attach & Workspace Lifecycle', () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: (container, cfg) => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    const container = createMockContainer();
    const detach = controller.attach(container);

    const snapshot = controller.getSnapshot();
    assert.equal(snapshot.isAttached, true);
    assert.ok(controller.getWorkspace());

    // Detach cleans up workspace
    detach();
    assert.equal(controller.getSnapshot().isAttached, false);
    assert.equal(mockWs.isDestroyed(), true);
    assert.equal(controller.getWorkspace(), null);

    controller.destroy();
  });

  test('4. Symbol & Timeframe Switching dengan Propagasi Reaktif', async () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach(createMockContainer());

    let stateChanges = 0;
    const unsub = controller.subscribe(() => {
      stateChanges++;
    });

    // Ubah simbol ke ETHUSDT
    await controller.setSymbol('ETHUSDT', '1h', 'binance');

    assert.equal(controller.getSnapshot().symbol, 'ETHUSDT');
    assert.equal(controller.getSnapshot().timeframe, '1h');
    assert.equal(mockWs.getActiveSymbol(), 'binance:ETHUSDT');
    assert.ok(stateChanges >= 2);

    // Ganti provider ke Indodax IDR
    await controller.setSymbol('BTCIDR', '15m', 'indodax');
    assert.equal(controller.getSnapshot().symbol, 'BTCIDR');
    assert.equal(controller.getSnapshot().providerId, 'indodax');
    assert.equal(mockWs.getActiveSymbol(), 'indodax:BTCIDR');

    unsub();
    controller.destroy();
  });

  test('5. Timezone & Theme Updating', () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      timezone: 'Asia/Jakarta',
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach(createMockContainer());

    controller.setTimezone('UTC');
    assert.equal(controller.getSnapshot().timezone, 'UTC');

    controller.setTheme('binance', 14);
    assert.equal(controller.getSnapshot().themePreset, 'binance');

    controller.destroy();
  });

  test('6. Defensive Null & Destroy Safety', () => {
    const controller = new ChartSessionController();

    // Calling attach with null container should not throw
    assert.doesNotThrow(() => {
      controller.attach(null);
    });
    assert.equal(controller.getSnapshot().isAttached, false);

    // Destroy multiple times safely
    assert.doesNotThrow(() => {
      controller.destroy();
      controller.destroy();
    });
  });

  test('7. cell:active Event Propagation ke onActiveCellChange', () => {
    let mockWs: any = null;
    let receivedCellInfo: { symbol: string; timeframe: string } | null = null;

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      onActiveCellChange: (info) => {
        receivedCellInfo = info;
      },
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach(createMockContainer());

    // Ubah sel aktif di workspace dan picu event cell:active
    mockWs.active.symbol = 'binance:SOLUSDT';
    mockWs.active.timeframe = '60'; // Vela format 60 = 1h

    mockWs.emit('cell:active');

    assert.ok(receivedCellInfo);
    if (!receivedCellInfo) throw new Error('Cell info not received');
    assert.equal((receivedCellInfo as any).symbol, 'SOLUSDT');
    assert.equal((receivedCellInfo as any).timeframe, '1h');

    controller.destroy();
  });

  test('8. Tiket #182: attach() membaca chartDefaultConfig sinkron dari PersistenceService tanpa mengintip localStorage', async () => {
    const adapter = new InMemoryLocalStorageAdapter();
    await adapter.setPreference(
      'chart_default_config',
      JSON.stringify({ candles: { upColor: '#00FFAA', downColor: '#FF2266' }, margins: { top: 0.22 } })
    );
    const persistence = new PersistenceService(adapter);
    await persistence.bootstrap();

    const prevLocalStorage = (globalThis as any).localStorage;
    const peekCalls: string[] = [];
    (globalThis as any).localStorage = {
      getItem: (key: string) => {
        peekCalls.push(key);
        if (key === 'trawangan_chart_default_config') {
          return JSON.stringify({ candles: { upColor: '#999999' } });
        }
        return null;
      },
      setItem: () => {},
      removeItem: () => {},
    };

    try {
      let currentConfig: any = {
        candles: { upColor: '#26a69a', downColor: '#ef5350' },
        margins: { top: 0.1, bottom: 0.1 },
      };
      const nativeRenderer: any = {
        getConfig: () => ({ ...currentConfig, candles: { ...currentConfig.candles }, margins: { ...currentConfig.margins } }),
        applyConfig: (patch: any) => {
          currentConfig = {
            ...currentConfig,
            ...patch,
            candles: { ...currentConfig.candles, ...(patch?.candles || {}) },
            margins: { ...currentConfig.margins, ...(patch?.margins || {}) },
          };
        },
        set: () => {},
        coords: { timezone: 'Asia/Jakarta' },
      };
      const fakeCell: any = {
        id: 'cell_default',
        symbol: 'binance:BTCUSDT',
        timeframe: '15',
        chart: {
          renderer: {
            getConfig: () => nativeRenderer.getConfig(),
            applyConfig: (patch: any) => nativeRenderer.applyConfig(patch),
            renderer: nativeRenderer,
          },
        },
        on: () => () => {},
      };
      const fakeWs: any = {
        cells: () => [fakeCell],
        cell: (id: string) => (id === 'cell_default' ? fakeCell : null),
        active: fakeCell,
        on: () => () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        persistence,
        workspaceFactory: () => fakeWs,
      });

      controller.attach(createMockContainer());

      // Harus langsung diterapkan secara sinkron pada attach() tanpa await hydrateChartDefaultConfig()
      assert.equal(currentConfig.candles.upColor, '#00FFAA');
      assert.equal(currentConfig.candles.downColor, '#FF2266');
      assert.equal(currentConfig.margins.top, 0.22);
      assert.equal(peekCalls.includes('trawangan_chart_default_config'), false);

      // saveCurrentSettingsAsDefault & resetSettingsToFactory memakai persistence yang diinjeksi
      currentConfig.margins.top = 0.33;
      const savedOk = await controller.saveCurrentSettingsAsDefault();
      assert.equal(savedOk, true);
      assert.equal(persistence.getChartDefaultConfigSync()?.margins?.top, 0.33);

      await controller.resetSettingsToFactory();
      assert.equal(persistence.getChartDefaultConfigSync(), null);

      controller.destroy();
    } finally {
      if (prevLocalStorage === undefined) {
        delete (globalThis as any).localStorage;
      } else {
        (globalThis as any).localStorage = prevLocalStorage;
      }
    }
  });
});
