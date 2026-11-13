import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  ChartSessionController
} from '../src/lib/services/chartSessionController';
import {
  isValidPriceStyle,
  PRICE_STYLE_OPTIONS,
  type PriceStyle,
  type SavedWorkspace
} from '../src/lib/types/market';

/**
 * Helper untuk membuat mock cell chart dengan renderer WebGL2 Vela
 */
function createMockVelaCell(id: string, initialStyle: PriceStyle = 'candles') {
  let style = initialStyle;
  let indicatorsList: any[] = [{ id: 'ind_1', title: 'RSI' }];
  let drawingsList: any[] = [{ id: 'draw_1', type: 'TrendLine' }];
  let appliedConfigs: any[] = [];

  const cell: any = {
    id,
    symbol: 'binance:BTCUSDT',
    timeframe: '15m',
    priceStyle: style,
    setPriceStyle(newStyle: string) {
      style = newStyle as PriceStyle;
      this.priceStyle = newStyle;
    },
    chart: {
      id,
      indicators: () => indicatorsList,
      drawings: {
        all: () => drawingsList
      },
      renderer: {
        renderer: {
          getConfig: () => ({
            series: { style }
          }),
          applyConfig: (cfg: any) => {
            appliedConfigs.push(cfg);
            if (cfg?.series?.style) {
              style = cfg.series.style;
              cell.priceStyle = cfg.series.style;
            }
          }
        }
      }
    }
  };

  return {
    cell,
    getStyle: () => style,
    getAppliedConfigs: () => appliedConfigs,
    getIndicators: () => indicatorsList,
    getDrawings: () => drawingsList
  };
}

describe('Header Price Style Selector Suite (#193)', () => {
  test('1. Validasi opsi tipe gaya lilin institusional dan fungsi isValidPriceStyle', () => {
    const expectedStyles: PriceStyle[] = ['candles', 'heikinashi', 'bars', 'line', 'area', 'baseline'];

    assert.strictEqual(PRICE_STYLE_OPTIONS.length, 6, 'Wajib mendukung tepat 6 gaya lilin institusional');
    for (const style of expectedStyles) {
      assert.ok(isValidPriceStyle(style), `Gaya ${style} wajib valid`);
      const opt = PRICE_STYLE_OPTIONS.find((o) => o.id === style);
      assert.ok(opt, `Opsi metadata untuk ${style} wajib tersedia`);
      assert.ok(opt.label.length > 0, `Label untuk ${style} tidak boleh kosong`);
      assert.ok(opt.description.length > 0, `Deskripsi untuk ${style} tidak boleh kosong`);
    }

    // Input tidak valid wajib return false
    assert.strictEqual(isValidPriceStyle('renko'), false, 'Renko di luar cakupan saat ini');
    assert.strictEqual(isValidPriceStyle('kagi'), false, 'Kagi tidak didukung');
    assert.strictEqual(isValidPriceStyle(''), false, 'String kosong wajib false');
    assert.strictEqual(isValidPriceStyle(null), false, 'Null wajib false');
    assert.strictEqual(isValidPriceStyle(undefined), false, 'Undefined wajib false');
    assert.strictEqual(isValidPriceStyle(123), false, 'Non-string wajib false');
  });

  test('2. getPriceStyle & setPriceStyle: membaca dan menyetel gaya pada sel tunggal serta fallback otomatis ke candles saat input invalid', () => {
    const mock = createMockVelaCell('cell_0', 'candles');
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    let reportedStyle: string | null = null;
    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      onPriceStyleChange: (style) => {
        reportedStyle = style;
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Initial style
    assert.strictEqual(controller.getPriceStyle(), 'candles');

    // Ubah ke Heikin-Ashi
    controller.setPriceStyle('heikinashi');
    assert.strictEqual(controller.getPriceStyle(), 'heikinashi');
    assert.strictEqual(mock.getStyle(), 'heikinashi');
    assert.strictEqual(reportedStyle, 'heikinashi');
    assert.strictEqual(mock.getIndicators().length, 1, 'Indikator tidak boleh hilang saat berganti gaya lilin');
    assert.strictEqual(mock.getDrawings().length, 1, 'Drawing tidak boleh hilang saat berganti gaya lilin');

    // Ubah ke OHLC Bars
    controller.setPriceStyle('bars');
    assert.strictEqual(controller.getPriceStyle(), 'bars');
    assert.strictEqual(mock.getStyle(), 'bars');
    assert.strictEqual(reportedStyle, 'bars');

    // Ubah ke Line
    controller.setPriceStyle('line');
    assert.strictEqual(controller.getPriceStyle(), 'line');
    assert.strictEqual(mock.getStyle(), 'line');

    // Ubah ke Area
    controller.setPriceStyle('area');
    assert.strictEqual(controller.getPriceStyle(), 'area');
    assert.strictEqual(mock.getStyle(), 'area');

    // Ubah ke Baseline
    controller.setPriceStyle('baseline');
    assert.strictEqual(controller.getPriceStyle(), 'baseline');
    assert.strictEqual(mock.getStyle(), 'baseline');

    // Fallback saat input invalid: 'renko' -> kembali ke 'candles'
    controller.setPriceStyle('renko');
    assert.strictEqual(controller.getPriceStyle(), 'candles');
    assert.strictEqual(mock.getStyle(), 'candles');
    assert.strictEqual(reportedStyle, 'candles');

    // Fallback saat input invalid: null / string kosong -> 'candles'
    controller.setPriceStyle('heikinashi');
    assert.strictEqual(controller.getPriceStyle(), 'heikinashi');
    controller.setPriceStyle('');
    assert.strictEqual(controller.getPriceStyle(), 'candles');

    controller.destroy();
  });

  test('3. Multi-Chart dengan syncConfig.style aktif: propagasi gaya lilin dari sel aktif ke seluruh sel grid', () => {
    const mock0 = createMockVelaCell('cell_0', 'candles');
    const mock1 = createMockVelaCell('cell_1', 'candles');
    const mock2 = createMockVelaCell('cell_2', 'candles');

    let syncedKey: string | null = null;
    let syncedVal: boolean | null = null;

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell, mock2.cell],
      active: mock0.cell,
      sync: {
        set: (key: string, val: boolean) => {
          if (key === 'style') {
            syncedKey = key;
            syncedVal = val;
          }
        }
      },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      syncConfig: {
        crosshair: true,
        viewport: true,
        symbol: false,
        drawings: true,
        indicators: true,
        style: true
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Ganti gaya di sel aktif (cell_0) ke heikinashi
    controller.setPriceStyle('heikinashi');

    // Seluruh sel di grid wajib tersinkron ke heikinashi
    assert.strictEqual(controller.getPriceStyle(mock0.cell), 'heikinashi');
    assert.strictEqual(controller.getPriceStyle(mock1.cell), 'heikinashi');
    assert.strictEqual(controller.getPriceStyle(mock2.cell), 'heikinashi');
    assert.strictEqual(mock0.getStyle(), 'heikinashi');
    assert.strictEqual(mock1.getStyle(), 'heikinashi');
    assert.strictEqual(mock2.getStyle(), 'heikinashi');

    // Ganti ke baseline
    controller.setPriceStyle('baseline');
    assert.strictEqual(mock0.getStyle(), 'baseline');
    assert.strictEqual(mock1.getStyle(), 'baseline');
    assert.strictEqual(mock2.getStyle(), 'baseline');

    // Memverifikasi syncLayout memperbarui flag sync workspace
    controller.syncLayout({ style: true });
    assert.strictEqual(syncedKey, 'style');
    assert.strictEqual(syncedVal, true);

    controller.destroy();
  });

  test('4. Multi-Chart dengan syncConfig.style NONAKTIF: gaya lilin independen per-sel', () => {
    const mock0 = createMockVelaCell('cell_0', 'candles');
    const mock1 = createMockVelaCell('cell_1', 'bars');

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      syncConfig: {
        crosshair: true,
        viewport: true,
        symbol: false,
        drawings: true,
        indicators: true,
        style: false
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Ubah sel aktif (cell_0) ke heikinashi
    controller.setPriceStyle('heikinashi');

    // cell_0 wajib heikinashi, namun cell_1 tetap mempertahankan 'bars'
    assert.strictEqual(controller.getPriceStyle(mock0.cell), 'heikinashi');
    assert.strictEqual(controller.getPriceStyle(mock1.cell), 'bars');
    assert.strictEqual(mock0.getStyle(), 'heikinashi');
    assert.strictEqual(mock1.getStyle(), 'bars');

    controller.destroy();
  });

  test('5. Switching antara sel multi-chart memancarkan onPriceStyleChange sesuai sel yang difokuskan', () => {
    const mock0 = createMockVelaCell('cell_0', 'candles');
    const mock1 = createMockVelaCell('cell_1', 'heikinashi');

    const listeners: Record<string, Function[]> = {};
    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      sync: { set: () => {} },
      on: (ev: string, fn: Function) => {
        listeners[ev] = listeners[ev] || [];
        listeners[ev].push(fn);
        return () => {
          listeners[ev] = listeners[ev].filter((x) => x !== fn);
        };
      },
      setLayout: () => {},
      destroy: () => {}
    };

    const reportedStyles: string[] = [];
    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      onPriceStyleChange: (style) => {
        reportedStyles.push(style);
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Fokus awal pada cell_0 ('candles')
    assert.strictEqual(controller.getPriceStyle(), 'candles');

    // Alihkan fokus ke cell_1 ('heikinashi')
    mockWs.active = mock1.cell;
    for (const fn of listeners['cell:active'] || []) {
      fn();
    }

    assert.strictEqual(controller.getPriceStyle(), 'heikinashi');
    assert.strictEqual(reportedStyles[reportedStyles.length - 1], 'heikinashi');

    // Alihkan fokus kembali ke cell_0 ('candles')
    mockWs.active = mock0.cell;
    for (const fn of listeners['cell:active'] || []) {
      fn();
    }

    assert.strictEqual(controller.getPriceStyle(), 'candles');
    assert.strictEqual(reportedStyles[reportedStyles.length - 1], 'candles');

    controller.destroy();
  });

  test('6. Workspace persistence: saveWorkspaceState & loadWorkspaceState menyimpan dan memulihkan priceStyle dengan faithful', async () => {
    const mock0 = createMockVelaCell('cell_0', 'candles');
    const mock1 = createMockVelaCell('cell_1', 'line');

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs
    });
    controller.attach({ nodeType: 1 } as any);

    controller.setPriceStyle('heikinashi');
    const saved = controller.saveWorkspaceState('My HeikinAshi Workspace');

    assert.strictEqual(saved.priceStyle, 'heikinashi');
    assert.strictEqual(saved.cells?.[0]?.priceStyle, 'heikinashi');

    // Pulihkan pada instans controller baru
    const newMock0 = createMockVelaCell('new_0', 'candles');
    const newMockWs = {
      cells: () => [newMock0.cell],
      active: newMock0.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    let restoredPriceStyle: string | null = null;
    const restoredController = new ChartSessionController({
      workspaceFactory: () => newMockWs,
      onPriceStyleChange: (s) => {
        restoredPriceStyle = s;
      }
    });
    restoredController.attach({ nodeType: 1 } as any);

    await restoredController.loadWorkspaceState({
      ...saved,
      id: 'ws_restored_193',
      timestamp: Date.now()
    } as SavedWorkspace);

    assert.strictEqual(restoredController.getPriceStyle(), 'heikinashi');
    assert.strictEqual(newMock0.getStyle(), 'heikinashi');
    assert.strictEqual(restoredPriceStyle, 'heikinashi');

    controller.destroy();
    restoredController.destroy();
  });

  test('7. PersistableChange emisi saat setPriceStyle dipanggil', () => {
    const mock = createMockVelaCell('cell_0', 'candles');
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const emittedReasons: string[] = [];
    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      onPersistableStateChange: (reason) => {
        emittedReasons.push(reason);
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Panggilan dengan nilai yang sama tidak memancarkan event
    controller.setPriceStyle('candles');
    assert.strictEqual(emittedReasons.length, 0);

    // Panggilan dengan nilai baru memancarkan 'priceStyle'
    controller.setPriceStyle('heikinashi');
    assert.ok(emittedReasons.includes('priceStyle'));

    controller.destroy();
  });
});
