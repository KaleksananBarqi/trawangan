import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartSessionController,
  type ChartReactiveProps,
} from '../src/lib/services/chartSessionController';

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

function createTrackingMockWorkspace() {
  const counts = {
    setSymbol: 0,
    setTimeframe: 0,
    setLayout: 0,
    setTheme: 0,
    setTimezone: 0,
    setSession: 0,
    setWatermarkVisible: 0,
    setPriceStyle: 0,
    applyConfig: 0,
    syncSet: 0,
  };

  let activeSymbol = 'binance:BTCUSDT';
  let activeTimeframe = '15';
  let activePriceStyle = 'candles';
  let watermarkVisible = true;
  const rendererConfigState: Record<string, any> = {
    candles: { upColor: '#F7F7F7', downColor: '#FF69B4' },
    priceScale: { countdown: false },
  };
  const listeners = new Map<string, Function[]>();

  const nativeRenderer = {
    set(key: string, val: any) {
      if (key === 'timezone') counts.setTimezone += 1;
    },
    applyConfig(patch: any) {
      counts.applyConfig += 1;
      if (patch?.priceScale?.countdown !== undefined) {
        rendererConfigState.priceScale = {
          ...rendererConfigState.priceScale,
          countdown: patch.priceScale.countdown,
        };
      }
    },
    getConfig() {
      return structuredClone(rendererConfigState);
    },
    coords: { timezone: 'Asia/Jakarta' },
    scene: {},
    scheduler: { invalidate: () => {} },
  };

  const mockCell: any = {
    id: 'cell_main',
    symbol: activeSymbol,
    timeframe: activeTimeframe,
    setSymbol(sym: string) {
      counts.setSymbol += 1;
      activeSymbol = sym;
      this.symbol = sym;
    },
    setTimeframe(tf: string) {
      counts.setTimeframe += 1;
      activeTimeframe = tf;
      this.timeframe = tf;
    },
    setSession() {
      counts.setSession += 1;
    },
    setWatermarkVisible(visible: boolean) {
      counts.setWatermarkVisible += 1;
      watermarkVisible = visible;
    },
    getWatermarkVisible() {
      return watermarkVisible;
    },
    getPriceStyle() {
      return activePriceStyle;
    },
    setPriceStyle(style: string) {
      counts.setPriceStyle += 1;
      activePriceStyle = style;
      this.priceStyle = style;
    },
    chart: {
      renderer: {
        renderer: nativeRenderer,
        applyConfig: nativeRenderer.applyConfig,
        getConfig: nativeRenderer.getConfig,
      },
      setTheme() {},
      setSurfaceBackground() {},
    },
  };

  const workspace: any = {
    cells: () => [mockCell],
    cell: (id: string) => (id === 'cell_main' ? mockCell : null),
    active: mockCell,
    sync: {
      set() {
        counts.syncSet += 1;
      },
    },
    setLayout() {
      counts.setLayout += 1;
    },
    setTheme() {
      counts.setTheme += 1;
    },
    on(event: string, fn: Function) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    destroy() {},
  };

  return {
    workspace,
    mockCell,
    counts,
    resetCounts() {
      for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
        counts[key] = 0;
      }
    },
    getWatermarkVisible: () => watermarkVisible,
  };
}

test.describe('ChartSessionController.applyReactiveProps (#217)', () => {
  test('1. Pemanggilan berulang dengan props identik bersifat no-op ketat', () => {
    const mock = createTrackingMockWorkspace();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      layout: '1',
      themePreset: 'signature',
      fontSize: 12,
      timezone: 'Asia/Jakarta',
      session: 'regular',
      gridMode: 'normal',
      showCurrentPriceLine: true,
      priceScaleCountdown: false,
      showVolume: true,
      showWatermark: true,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      workspaceFactory: () => mock.workspace,
    });

    controller.attach(createMockContainer());
    mock.resetCounts();

    let notifyCount = 0;
    controller.subscribe(() => {
      notifyCount += 1;
    });
    notifyCount = 0;

    const initialProps: ChartReactiveProps = {
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      layout: '1',
      themePreset: 'signature',
      fontSize: 12,
      timezone: 'Asia/Jakarta',
      session: 'regular',
      gridMode: 'normal',
      showCurrentPriceLine: true,
      priceScaleCountdown: false,
      showVolume: true,
      showWatermark: true,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    };

    controller.applyReactiveProps(initialProps);
    controller.applyReactiveProps({ ...initialProps });

    assert.equal(mock.counts.setSymbol, 0);
    assert.equal(mock.counts.setTimeframe, 0);
    assert.equal(mock.counts.setLayout, 0);
    assert.equal(mock.counts.setTheme, 0);
    assert.equal(mock.counts.setTimezone, 0);
    assert.equal(mock.counts.setSession, 0);
    assert.equal(mock.counts.setWatermarkVisible, 0);
    assert.equal(mock.counts.syncSet, 0);
    assert.equal(notifyCount, 0);

    controller.destroy();
  });

  test('2. Perubahan symbol + timeframe bersamaan memicu satu setSymbol terkoordinasi dan tidak berulang', async () => {
    const mock = createTrackingMockWorkspace();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      workspaceFactory: () => mock.workspace,
    });

    controller.attach(createMockContainer());
    mock.resetCounts();

    controller.applyReactiveProps({
      symbol: 'ETHUSDT',
      timeframe: '1h',
      providerId: 'binance',
    });

    // Tunggu microtask async setSymbol selesai
    await Promise.resolve();

    assert.equal(mock.counts.setSymbol, 1);
    assert.equal(mock.counts.setTimeframe, 1);
    assert.equal(mock.mockCell.symbol, 'binance:ETHUSDT');
    assert.equal(mock.mockCell.timeframe, '1h');
    assert.equal(controller.getSnapshot().symbol, 'ETHUSDT');
    assert.equal(controller.getSnapshot().timeframe, '1h');

    // Pemanggilan ulang dengan nilai yang sama harus menjadi no-op
    mock.resetCounts();
    controller.applyReactiveProps({
      symbol: 'ETHUSDT',
      timeframe: '1h',
      providerId: 'binance',
    });
    await Promise.resolve();

    assert.equal(mock.counts.setSymbol, 0);
    assert.equal(mock.counts.setTimeframe, 0);

    controller.destroy();
  });

  test('3. Perubahan themePreset + gridMode + customChartBackground + fontSize digabung menjadi satu pemanggilan setTheme', () => {
    const mock = createTrackingMockWorkspace();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      themePreset: 'signature',
      gridMode: 'normal',
      fontSize: 12,
      workspaceFactory: () => mock.workspace,
    });

    controller.attach(createMockContainer());
    mock.resetCounts();

    controller.applyReactiveProps({
      themePreset: 'ocean',
      gridMode: 'dimmed',
      fontSize: 14,
      customChartBackground: { mode: 'solid', solidColor: '#101520' },
    });

    assert.equal(mock.counts.setTheme, 1);
    assert.equal(controller.getSnapshot().themePreset, 'ocean');
    assert.equal(controller.getGridMode(), 'dimmed');

    // Pemanggilan ulang dengan objek customChartBackground baru tetapi nilai identik -> no-op
    mock.resetCounts();
    controller.applyReactiveProps({
      themePreset: 'ocean',
      gridMode: 'dimmed',
      fontSize: 14,
      customChartBackground: { mode: 'solid', solidColor: '#101520' },
    });
    assert.equal(mock.counts.setTheme, 0);

    controller.destroy();
  });

  test('4. Perubahan priceScaleCountdown, session, timezone, showWatermark, layout, syncConfig, dan priceStyle diperbarui idempoten', () => {
    const mock = createTrackingMockWorkspace();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      timezone: 'Asia/Jakarta',
      session: 'regular',
      priceScaleCountdown: false,
      showWatermark: true,
      workspaceFactory: () => mock.workspace,
    });

    controller.attach(createMockContainer());
    mock.resetCounts();

    controller.applyReactiveProps({
      layout: '2',
      timezone: 'UTC',
      session: 'extended',
      priceScaleCountdown: true,
      showWatermark: false,
      priceStyle: 'heikinashi',
      syncConfig: { crosshair: false, viewport: true, symbol: false, drawings: true, indicators: true },
    });

    assert.equal(mock.counts.setLayout, 1);
    assert.equal(mock.counts.setTimezone, 1);
    assert.equal(mock.counts.setSession, 1);
    assert.equal(mock.counts.setWatermarkVisible, 1);
    assert.equal(mock.getWatermarkVisible(), false);
    assert.equal(mock.counts.setPriceStyle, 1);
    assert.equal(mock.counts.syncSet, 10);
    assert.equal(controller.getSnapshot().layout, '2');
    assert.equal(controller.getSnapshot().timezone, 'UTC');
    assert.equal(controller.getSnapshot().session, 'extended');
    assert.equal(controller.isPriceScaleCountdownEnabled(), true);
    assert.equal(controller.getPriceStyle(), 'heikinashi');

    // Pemanggilan ulang dengan nilai identik tidak memicu mutasi lagi
    mock.resetCounts();
    controller.applyReactiveProps({
      layout: '2',
      timezone: 'UTC',
      session: 'extended',
      priceScaleCountdown: true,
      showWatermark: false,
      priceStyle: 'heikinashi',
      syncConfig: { crosshair: false, viewport: true, symbol: false, drawings: true, indicators: true },
    });

    assert.equal(mock.counts.setLayout, 0);
    assert.equal(mock.counts.setTimezone, 0);
    assert.equal(mock.counts.setSession, 0);
    assert.equal(mock.counts.setWatermarkVisible, 0);
    assert.equal(mock.counts.setPriceStyle, 0);
    assert.equal(mock.counts.syncSet, 0);

    controller.destroy();
  });

  test('5. Penghapusan explicit undefined pada customChartBackground memicu reset tema, sedangkan omit parsial mempertahankannya', () => {
    const mock = createTrackingMockWorkspace();
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      customChartBackground: { mode: 'solid', solidColor: '#121212' },
      workspaceFactory: () => mock.workspace,
    });

    controller.attach(createMockContainer());
    mock.resetCounts();

    // Omit customChartBackground -> tidak direset
    controller.applyReactiveProps({ symbol: 'BTCUSDT', timeframe: '15m' });
    assert.equal(mock.counts.setTheme, 0);

    // Explicit undefined -> direset
    controller.applyReactiveProps({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      customChartBackground: undefined,
    });
    assert.equal(mock.counts.setTheme, 1);

    controller.destroy();
  });
});
