import { test, describe } from 'node:test';
import assert from 'node:assert';
import type { MultiChartSyncConfig, SavedWorkspace } from '../src/lib/types/market';
import { applyLayoutTimeframePolicy } from '../src/lib/constants/defaults';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

function createMockChartCell(id: string, initialTf: string = '15m') {
  let indicatorsList: any[] = [];
  let visibleRange: { from: number; to: number } | null = { from: 1710000000000, to: 1710003600000 };
  let currentSymbol = 'binance:BTCUSDT';
  let currentTimeframe = initialTf;
  let priceStyle = 'candles';
  let barSpacing = 8;
  const heightWeights: number[] = [3, 1];

  const panes = [
    { kind: 'price', heightWeight: 3, manualScale: null, scale: { min: 60000, max: 70000 } },
    { kind: 'oscillator', heightWeight: 1, manualScale: null, scale: { min: 0, max: 100 } }
  ];

  let priceScaleConfig: any = { mode: 'price', log: false };
  let appliedConfig: any = null;

  const cell: any = {
    id,
    symbol: currentSymbol,
    timeframe: currentTimeframe,
    setSymbol(s: string) {
      this.symbol = s;
      currentSymbol = s;
    },
    setTimeframe(tf: string) {
      this.timeframe = tf;
      currentTimeframe = tf;
    },
    chart: {
      id,
      indicators: () => indicatorsList,
      addIndicator: (source: string, opts: any) => {
        const ind = {
          id: `ind_${id}_${Date.now()}_${Math.random()}`,
          title: opts.title,
          source,
          visible: true,
          inputs: opts.inputs || {},
          props: opts.props || {},
          remove: () => {
            indicatorsList = indicatorsList.filter((x) => x !== ind);
          },
          setVisible: (v: boolean) => {
            ind.visible = v;
          },
          setInputs: (inputs: any) => {
            ind.inputs = { ...ind.inputs, ...inputs };
          },
          setProps: (props: any) => {
            ind.props = { ...ind.props, ...props };
          }
        };
        indicatorsList.push(ind);
        return ind;
      },
      setVisibleRange: (r: { from: number; to: number }) => {
        visibleRange = r;
      },
      getVisibleRange: () => visibleRange,
      renderer: {
        renderer: {
          scene: {
            panes: {
              get: (k: string) => panes.find((p) => p.kind === k)
            },
            orderedPanes: () => panes,
            showPriceLine: true
          },
          coords: {
            getViewport: () => ({ barSpacing }),
            setViewport: (vp: any) => {
              if (vp.barSpacing) barSpacing = vp.barSpacing;
            }
          },
          getConfig: () => ({
            priceScale: { ...priceScaleConfig },
            series: { style: priceStyle }
          }),
          applyConfig: (cfg: any) => {
            appliedConfig = cfg;
            if (cfg?.series?.style) priceStyle = cfg.series.style;
            if (cfg?.priceScale) priceScaleConfig = { ...priceScaleConfig, ...cfg.priceScale };
          },
          setManualScale: (pane: any, scale: any) => {
            pane.manualScale = scale;
          },
          scheduler: {
            invalidate: () => {}
          },
          factoryConfig: null as any,
          factoryResetDocument: (orig: any) => ({ ...orig, isReset: true })
        }
      }
    }
  };

  return { cell, getIndicators: () => indicatorsList, getAppliedConfig: () => appliedConfig };
}

describe('Multi-Chart Synchronization Engine Unit Tests (ChartSessionController Seam)', () => {
  test('1. MultiChartSyncConfig & syncLayout: memverifikasi nilai default dan update terisolasi pada ChartSessionController', () => {
    const controller = new ChartSessionController();
    const snapshot = controller.getSnapshot();

    assert.strictEqual(snapshot.syncConfig.crosshair, true, 'Crosshair wajib aktif secara default');
    assert.strictEqual(snapshot.syncConfig.viewport, true, 'Viewport wajib aktif secara default agar kursor & gerakan tersinkron');
    assert.strictEqual(snapshot.syncConfig.symbol, false, 'Symbol independen secara default');
    assert.strictEqual(snapshot.syncConfig.drawings, true, 'Drawings sinkron antar chart');
    assert.strictEqual(snapshot.syncConfig.indicators, true, 'Indicators wajib aktif secara default');

    // Toggle Viewport
    controller.syncLayout({ viewport: false });
    assert.strictEqual(controller.getSnapshot().syncConfig.viewport, false);
    controller.syncLayout({ viewport: true });
    assert.strictEqual(controller.getSnapshot().syncConfig.viewport, true);

    // Toggle Crosshair
    controller.syncLayout({ crosshair: false });
    assert.strictEqual(controller.getSnapshot().syncConfig.crosshair, false);

    // Toggle Symbol
    controller.syncLayout({ symbol: true });
    assert.strictEqual(controller.getSnapshot().syncConfig.symbol, true);

    // Toggle Indicators
    controller.syncLayout({ indicators: false });
    assert.strictEqual(controller.getSnapshot().syncConfig.indicators, false);
    controller.syncLayout({ indicators: true });
    assert.strictEqual(controller.getSnapshot().syncConfig.indicators, true);

    controller.destroy();
  });

  test('2. Auto-Clone Indicators on setLayout: cell baru mewarisi seluruh indikator dari chart utama via controller', async () => {
    const mock0 = createMockChartCell('cell_0');
    const mock1 = createMockChartCell('cell_1');

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      setLayout: (_ly: string) => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true }
    });

    controller.attach({ nodeType: 1 } as any);

    // Pasang 3 indikator pada controller
    await controller.addPineIndicator('plot(ta.ema(close, 20))', 'EMA 20', { length: 20 });
    await controller.addPineIndicator('plot(ta.rsi(close, 14))', 'RSI', { length: 14 });
    await controller.addPineIndicator('plot(ta.macd(close, 12, 26, 9))', 'MACD');

    // Ubah layout grid ke 2 chart
    controller.setLayout('2');

    const cell1Indicators = mock1.getIndicators();
    assert.strictEqual(cell1Indicators.length, 3, 'Cell 1 harus mewarisi ke-3 indikator');
    assert.strictEqual(cell1Indicators[0].title, 'EMA 20');
    assert.strictEqual(cell1Indicators[1].title, 'RSI');
    assert.strictEqual(cell1Indicators[2].title, 'MACD');

    controller.destroy();
  });

  test('3. Indicator Reconciliation on syncLayout: menyelaraskan follower cell saat indikator disinkronkan kembali', async () => {
    const mock0 = createMockChartCell('cell_0');
    const mock1 = createMockChartCell('cell_1');

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      setLayout: () => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false }
    });

    controller.attach({ nodeType: 1 } as any);

    // Active cell memiliki 2 indikator
    await controller.addPineIndicator('code1', 'EMA 20');
    await controller.addPineIndicator('code2', 'Bollinger Bands');

    // Follower cell memiliki custom indikator yang berbeda
    mock1.cell.chart.addIndicator('code3', { title: 'Stochastic RSI' });
    assert.strictEqual(mock1.getIndicators().length, 1);
    assert.strictEqual(mock1.getIndicators()[0].title, 'Stochastic RSI');

    // Aktifkan sinkronisasi indikator kembali
    controller.syncLayout({ indicators: true });

    // Follower cell harus dibersihkan dari indikator lama dan diselaraskan dengan active cell
    const cell1Indicators = mock1.getIndicators();
    assert.strictEqual(cell1Indicators.length, 2);
    assert.strictEqual(cell1Indicators[0].title, 'EMA 20');
    assert.strictEqual(cell1Indicators[1].title, 'Bollinger Bands');

    controller.destroy();
  });

  test('4. Revert to Single Chart Layout: mempertahankan indikator dari cell aktif saat kembali ke layout 1', async () => {
    const mock0 = createMockChartCell('cell_0');
    const mock1 = createMockChartCell('cell_1');

    // Jadikan cell 1 sebagai active cell yang terfokus
    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock1.cell,
      setLayout: () => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs
    });

    controller.attach({ nodeType: 1 } as any);

    // Pasang indikator pada active cell (cell 1)
    await controller.addPineIndicator('codeST', 'SuperTrend');

    // Tambahkan indikator sampah lama di cell 0
    mock0.cell.chart.addIndicator('codeOld', { title: 'Old Indicator' });

    // Revert kembali ke layout 1 chart
    controller.setLayout('1');

    const activeIndicators = controller.getActiveIndicators();
    assert.strictEqual(activeIndicators.length, 1);
    assert.strictEqual(activeIndicators[0].title, 'SuperTrend');

    controller.destroy();
  });

  test('5. Vela Sync Mapping & Viewport Alignment: controller.syncLayout memetakan flag ke workspace.sync dan menyelaraskan visible range', () => {
    const mock0 = createMockChartCell('cell_0');
    const mock1 = createMockChartCell('cell_1');
    const mock2 = createMockChartCell('cell_2');

    const appliedSettings: Record<string, boolean> = {};

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell, mock2.cell],
      active: mock0.cell,
      setLayout: () => {},
      sync: {
        set: (key: string, val: boolean) => {
          appliedSettings[key] = Boolean(val);
        }
      },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs
    });

    controller.attach({ nodeType: 1 } as any);

    controller.syncLayout({
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true
    });

    assert.strictEqual(appliedSettings['crosshair'], true);
    assert.strictEqual(appliedSettings['viewport'], true);
    assert.strictEqual(appliedSettings['symbol'], false);
    assert.strictEqual(appliedSettings['drawings'], true);

    // Verifikasi perataan rentang viewport ke follower cells
    assert.deepStrictEqual(mock1.cell.chart.getVisibleRange(), mock0.cell.chart.getVisibleRange());
    assert.deepStrictEqual(mock2.cell.chart.getVisibleRange(), mock0.cell.chart.getVisibleRange());

    controller.destroy();
  });

  test('6. Atomic Workspace State Snapshot & Restoration: saveWorkspaceState dan loadWorkspaceState memulihkan seluruh visual properties', async () => {
    const mock0 = createMockChartCell('cell_0');

    const mockWs = {
      cells: () => [mock0.cell],
      active: mock0.cell,
      setLayout: () => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'indodax',
      workspaceFactory: () => mockWs
    });

    controller.attach({ nodeType: 1 } as any);

    // Set properties
    controller.applyPaneWeights([3, 1.25]);
    controller.applyPriceScaleState({
      mode: 'log',
      auto: false,
      manualScale: { min: 65000, max: 71000 }
    });
    controller.setPriceStyle('heikinashi');
    controller.setBarSpacing(14.5);
    await controller.addPineIndicator('pine', 'Stochastic Oscillator', { periodK: 14, periodD: 3, smoothK: 3 });

    // Snapshot via controller
    const saved = controller.saveWorkspaceState('Scalping Layout Pro');

    assert.strictEqual(saved.name, 'Scalping Layout Pro');
    assert.strictEqual(saved.symbol, 'BTCUSDT');
    assert.strictEqual(saved.timeframe, '15m');
    assert.strictEqual(saved.providerId, 'indodax');
    assert.deepStrictEqual(saved.paneWeights, [3, 1.25]);
    assert.strictEqual(saved.priceScaleState?.mode, 'log');
    assert.strictEqual(saved.priceStyle, 'heikinashi');
    assert.strictEqual(saved.barSpacing, 14.5);
    assert.strictEqual(saved.indicators.length, 1);
    assert.strictEqual(saved.indicators[0].title, 'Stochastic Oscillator');

    // Pulihkan pada instans controller baru
    const newMock = createMockChartCell('new_cell');
    const newWs = {
      cells: () => [newMock.cell],
      active: newMock.cell,
      setLayout: () => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const restoredController = new ChartSessionController({
      workspaceFactory: () => newWs
    });
    restoredController.attach({ nodeType: 1 } as any);

    await restoredController.loadWorkspaceState({
      ...saved,
      id: 'ws_restored',
      timestamp: Date.now()
    } as SavedWorkspace);

    const restoredSnap = restoredController.getSnapshot();
    assert.strictEqual(restoredSnap.symbol, 'BTCUSDT');
    assert.strictEqual(restoredSnap.timeframe, '15m');
    assert.strictEqual(restoredSnap.providerId, 'indodax');
    assert.strictEqual(restoredController.getPaneWeights()[0], 3);
    assert.strictEqual(restoredController.getPriceStyle(), 'heikinashi');
    assert.strictEqual(restoredController.getBarSpacing(), 14.5);
    assert.strictEqual(restoredSnap.activeIndicators.length, 1);
    assert.strictEqual(restoredSnap.activeIndicators[0].title, 'Stochastic Oscillator');

    controller.destroy();
    restoredController.destroy();
  });

  test('7. Programmatic Chart Settings Persistence: saveCurrentSettingsAsDefault & resetSettingsToFactory tanpa DOM MutationObserver', async () => {
    const mock0 = createMockChartCell('cell_0');
    const mock1 = createMockChartCell('cell_1');

    const mockWs = {
      cells: () => [mock0.cell, mock1.cell],
      active: mock0.cell,
      setLayout: () => {},
      sync: { set: () => {} },
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs
    });

    controller.attach({ nodeType: 1 } as any);

    // Simpan pengaturan saat ini sebagai default
    const ok = await controller.saveCurrentSettingsAsDefault();
    assert.strictEqual(ok, true);

    // Pastikan factoryConfig terdistribusi ke seluruh cell
    assert.ok(mock0.cell.chart.renderer.renderer.factoryConfig);
    assert.ok(mock1.cell.chart.renderer.renderer.factoryConfig);

    // Reset pengaturan ke factory
    await controller.resetSettingsToFactory();

    controller.destroy();
  });

  test('8. Crosshair External Coordinates: menghitung visibilitas kursor lintas panel', () => {
    function isCrosshairInBounds(x: number, y: number, width: number, height: number): boolean {
      return x >= 0 && x <= width && y >= 0 && y <= height;
    }

    const canvasWidth = 800;
    const canvasHeight = 500;

    const syncedX = 420;
    const syncedY = 250;
    assert.strictEqual(isCrosshairInBounds(syncedX, syncedY, canvasWidth, canvasHeight), true);

    const outOfBoundsX = -150;
    const outOfBoundsY = 250;
    assert.strictEqual(isCrosshairInBounds(outOfBoundsX, outOfBoundsY, canvasWidth, canvasHeight), false);
  });

  test('9. Layout Expansion Timeframe Policy: cell baru mengadopsi defaultTimeframe sedangkan cell aktif dipertahankan', () => {
    const activeCell = {
      id: 'cell_active',
      timeframe: '1h',
      setTimeframe(tf: string) { this.timeframe = tf; }
    };

    const newCell1 = {
      id: 'cell_new_1',
      timeframe: '1m',
      setTimeframe(tf: string) { this.timeframe = tf; }
    };

    const newCell2 = {
      id: 'cell_new_2',
      timeframe: '1m',
      setTimeframe(tf: string) { this.timeframe = tf; }
    };

    const cells = [activeCell, newCell1, newCell2];

    applyLayoutTimeframePolicy({
      activeCell,
      cells,
      defaultTimeframe: '15m',
      syncTimeframe: false,
    });

    assert.strictEqual(activeCell.timeframe, '1h', 'Cell aktif tidak boleh tertimpa timeframe-nya');
    assert.strictEqual(newCell1.timeframe, '15m', 'Cell baru 1 harus diinisialisasi dengan defaultTimeframe 15m');
    assert.strictEqual(newCell2.timeframe, '15m', 'Cell baru 2 harus diinisialisasi dengan defaultTimeframe 15m');

    applyLayoutTimeframePolicy({
      activeCell,
      cells,
      defaultTimeframe: '15m',
      syncTimeframe: true,
    });

    assert.strictEqual(activeCell.timeframe, '1h');
    assert.strictEqual(newCell1.timeframe, '1h');
    assert.strictEqual(newCell2.timeframe, '1h');
  });
});
