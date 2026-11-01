// tests/chartAutoFit.test.ts
// Unit Tests untuk Viewport Auto-Fit Scaling (Alt+Z & F) dan Delegasi Reset View (Tiket #139)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';

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

test.describe('Chart Viewport Auto-Fit Scaling Suite (#139)', () => {
  test('1. ChartSessionController.fitChart() memanggil cell.resetView() pada sel aktif', () => {
    let resetViewCalled = false;
    const mockCell = {
      id: 'cell_main',
      resetView: () => {
        resetViewCalled = true;
      },
      chart: {}
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => ({
        active: mockCell,
        cells: () => [mockCell],
        destroy: () => {}
      })
    });

    controller.attach(createMockContainer());

    assert.equal(typeof (controller as any).fitChart, 'function', 'ChartSessionController harus memiliki fungsi fitChart()');
    (controller as any).fitChart();

    assert.equal(resetViewCalled, true, 'cell.resetView() harus dipanggil saat fitChart() dieksekusi');
    controller.destroy();
  });

  test('2. ChartSessionController.fitChart() fallback ke cell.chart.renderer.resetView() jika cell tidak memiliki resetView()', () => {
    let rendererResetViewCalled = false;
    const mockCell = {
      id: 'cell_custom',
      chart: {
        renderer: {
          renderer: {
            resetView: () => {
              rendererResetViewCalled = true;
            }
          }
        }
      }
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => ({
        active: mockCell,
        cells: () => [mockCell],
        destroy: () => {}
      })
    });

    controller.attach(createMockContainer());

    (controller as any).fitChart();
    assert.equal(rendererResetViewCalled, true, 'Fallback ke renderer.resetView() harus terpanggil');
    controller.destroy();
  });

  test('3. ChartSessionController.fitChart() fallback ke cell.chart.fitContent() jika renderer tidak memiliki resetView()', () => {
    let fitContentCalled = false;
    const mockCell = {
      id: 'cell_custom',
      chart: {
        fitContent: () => {
          fitContentCalled = true;
        }
      }
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => ({
        active: mockCell,
        cells: () => [mockCell],
        destroy: () => {}
      })
    });

    controller.attach(createMockContainer());

    (controller as any).fitChart();
    assert.equal(fitContentCalled, true, 'Fallback ke chart.fitContent() harus terpanggil');
    controller.destroy();
  });

  test('4. ChartSessionController.fitChart() fallback ke cell.chart.resetView() jika opsi lain tidak tersedia', () => {
    let chartResetViewCalled = false;
    const mockCell = {
      id: 'cell_custom',
      chart: {
        resetView: () => {
          chartResetViewCalled = true;
        }
      }
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => ({
        active: null,
        cells: () => [mockCell],
        destroy: () => {}
      })
    });

    controller.attach(createMockContainer());

    (controller as any).fitChart();
    assert.equal(chartResetViewCalled, true, 'Fallback ke chart.resetView() pada sel pertama harus terpanggil');
    controller.destroy();
  });

  test('5. ChartSessionController.fitChart() aman dan tidak melempar error saat sel atau workspace tidak ada', () => {
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m'
    });

    assert.doesNotThrow(() => {
      (controller as any).fitChart();
    }, 'fitChart() tidak boleh melempar error saat belum ter-attach');
  });

  test('6. CommandDispatcher: Pintasan Alt+Z (fit-chart-z) dan F (fit-chart-f) memicu fitChart()', () => {
    const dispatcher = createDefaultCommandDispatcher();
    let fitChartCallCount = 0;

    const mockChartComponent = {
      fitChart: () => {
        fitChartCallCount++;
      }
    };

    // Daftarkan handler seperti di +page.svelte
    dispatcher.bindHandler('fit-chart-z', () => {
      mockChartComponent.fitChart();
    });
    dispatcher.bindHandler('fit-chart-f', () => {
      mockChartComponent.fitChart();
    });

    // 1. Uji penekanan Alt + Z
    let preventedZ = false;
    const altZEvent = {
      key: 'z',
      code: 'KeyZ',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: () => { preventedZ = true; },
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledZ = dispatcher.dispatch(altZEvent);
    assert.equal(handledZ, true, 'Alt+Z harus ditangani oleh dispatcher');
    assert.equal(fitChartCallCount, 1, 'fitChart() harus dipanggil 1 kali oleh Alt+Z');
    assert.equal(preventedZ, true, 'preventDefault harus dipanggil');

    // 2. Uji penekanan tombol F
    let preventedF = false;
    const fEvent = {
      key: 'f',
      code: 'KeyF',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => { preventedF = true; },
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledF = dispatcher.dispatch(fEvent);
    assert.equal(handledF, true, 'Tombol F harus ditangani oleh dispatcher');
    assert.equal(fitChartCallCount, 2, 'fitChart() harus dipanggil 2 kali secara total');
    assert.equal(preventedF, true, 'preventDefault harus dipanggil untuk F');

    // 3. Pintasan Alt+Z dan F harus ditekan/diabaikan saat input HTML sedang fokus
    const inputZEvent = {
      key: 'z',
      code: 'KeyZ',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'INPUT' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledInputZ = dispatcher.dispatch(inputZEvent);
    assert.equal(handledInputZ, false, 'Alt+Z tidak boleh memicu aksi saat berada di input');

    const inputFEvent = {
      key: 'f',
      code: 'KeyF',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'TEXTAREA' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledInputF = dispatcher.dispatch(inputFEvent);
    assert.equal(handledInputF, false, 'Tombol F tidak boleh memicu aksi saat berada di textarea');
    assert.equal(fitChartCallCount, 2, 'Total panggilan fitChart() tetap 2');
  });

  test('7. Double-click pada sumbu harga/waktu mengevaluasi region dan memicu reset/fit', () => {
    let resetViewCalls = 0;
    let resetPriceScaleCalls = 0;

    const mockCoords = { width: 900, height: 600 };
    const mockInput = {
      regionAt(x: number, y: number) {
        if (x > mockCoords.width && y <= mockCoords.height) return 'price';
        if (y > mockCoords.height && x <= mockCoords.width) return 'time';
        return 'data';
      },
      deps: {
        resetView: () => {
          resetViewCalls++;
        },
        resetPriceScale: () => {
          resetPriceScaleCalls++;
        }
      },
      doubleActivate(x: number, y: number) {
        const region = this.regionAt(x, y);
        if (region === 'price') this.deps.resetPriceScale();
        else if (region === 'time') this.deps.resetView();
      }
    };

    // Klik dua kali pada sumbu waktu (bawah grafik: x = 450, y = 650)
    mockInput.doubleActivate(450, 650);
    assert.equal(resetViewCalls, 1, 'Double click pada sumbu waktu harus memicu resetView()');

    // Klik dua kali pada sumbu harga (kanan grafik: x = 950, y = 300)
    mockInput.doubleActivate(950, 300);
    assert.equal(resetPriceScaleCalls, 1, 'Double click pada sumbu harga harus memicu resetPriceScale()');
  });
});
