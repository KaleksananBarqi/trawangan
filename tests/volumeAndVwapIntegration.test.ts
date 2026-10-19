import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INDICATOR_PRESETS } from '../src/lib/data/indicatorPresets';
import { PineTS } from 'pinets';

describe('Ticket 1 & 2: Volume and Session VWAP Indicator Presets', () => {
  it('1. INDICATOR_PRESETS: menyertakan preset Session VWAP dengan kategori Volume', () => {
    const vwapPreset = INDICATOR_PRESETS.find((p) => p.id === 'vwap');
    assert.ok(vwapPreset, 'Preset vwap harus terdaftar di INDICATOR_PRESETS');
    assert.equal(vwapPreset.name, 'Volume Weighted Average Price (VWAP)');
    assert.equal(vwapPreset.category, 'Volume');
    assert.equal(vwapPreset.overlay, true, 'VWAP wajib bertipe overlay=true agar menempel di lilin harga');
    assert.ok(vwapPreset.sourceCode.includes('//@version=6'), 'Wajib Pine Script v6');
    assert.ok(vwapPreset.sourceCode.includes('ta.vwap'), 'Wajib memanggil ta.vwap');
  });

  it('2. PineTS Runtime: Session VWAP preset dapat dikompilasi dan di-plot tanpa runtime error', async () => {
    const vwapPreset = INDICATOR_PRESETS.find((p) => p.id === 'vwap');
    assert.ok(vwapPreset);

    const baseTime = 1700000000000;
    const klines: any[] = [];
    for (let i = 0; i < 30; i++) {
      klines.push({
        openTime: baseTime + i * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000 + i * 50,
      });
    }

    const source = {
      getMarketData: async () => klines,
      getSymbolInfo: async () => ({
        ticker: 'BTCUSDT',
        timezone: 'UTC',
        session: '24x7',
      }),
    };

    const pine = new PineTS(source as any, 'BTCUSDT', '1m', klines.length);
    await pine.ready();

    const ctx = await pine.run(vwapPreset.sourceCode);
    assert.ok(ctx, 'Pine runtime harus menghasilkan context eksekusi');
    assert.ok(ctx.plots, 'Harus menghasilkan objek plots');
    
    // Pastikan ada plot yang dihasilkan dan memiliki data numerik valid (bukan NaN)
    const plotKeys = Object.keys(ctx.plots).filter((k) => !k.startsWith('__'));
    assert.ok(plotKeys.length >= 1, 'Harus memuat minimal garis VWAP dan bands');
    
    // Plot VWAP harus ada dan menghasilkan nilai numerik valid
    const vwapPlot = Object.values(ctx.plots).find((p: any) => p.title === 'VWAP') as any;
    assert.ok(vwapPlot, 'Garis VWAP harus ditemukan pada plot');
    assert.ok(vwapPlot.data.length > 0, 'Data plot VWAP tidak boleh kosong');
    const validPoint = vwapPlot.data.find((pt: any) => typeof pt.value === 'number' && !Number.isNaN(pt.value));
    assert.ok(validPoint, 'Garis VWAP harus menghasilkan nilai numerik valid');
  });

  it('3. INDICATOR_PRESETS: menyertakan preset Volume dengan SMA 20 pada kategori Volume', () => {
    const volPreset = INDICATOR_PRESETS.find((p) => p.id === 'volume');
    assert.ok(volPreset, 'Preset volume harus terdaftar di INDICATOR_PRESETS');
    assert.equal(volPreset.name, 'Volume (with 20 SMA)');
    assert.equal(volPreset.category, 'Volume');
    assert.equal(volPreset.overlay, false, 'Volume harus berada di sub-pane terpisah (overlay=false)');
    assert.ok(volPreset.sourceCode.includes('//@version=5'), 'Wajib Pine Script v5');
    assert.ok(volPreset.sourceCode.includes('ta.sma'), 'Wajib memuat ta.sma untuk volume MA');
    assert.ok(volPreset.sourceCode.includes('format.volume'), 'Wajib menggunakan format.volume');
  });

  it('4. PineTS Runtime: Volume preset dapat dikompilasi dan menghasilkan plot histogram serta MA', async () => {
    const volPreset = INDICATOR_PRESETS.find((p) => p.id === 'volume');
    assert.ok(volPreset);

    const baseTime = 1700000000000;
    const klines: any[] = [];
    for (let i = 0; i < 30; i++) {
      klines.push({
        openTime: baseTime + i * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000 + i * 50,
      });
    }

    const source = {
      getMarketData: async () => klines,
      getSymbolInfo: async () => ({
        ticker: 'BTCUSDT',
        timezone: 'UTC',
        session: '24x7',
      }),
    };

    const pine = new PineTS(source as any, 'BTCUSDT', '1m', klines.length);
    await pine.ready();

    const ctx = await pine.run(volPreset.sourceCode);
    assert.ok(ctx, 'Pine runtime harus menghasilkan context');
    assert.ok(ctx.plots, 'Harus menghasilkan objek plots');

    const plotKeys = Object.keys(ctx.plots).filter((k) => !k.startsWith('__'));
    assert.ok(plotKeys.length >= 2, 'Harus menghasilkan minimal 2 plot: histogram volume dan volume MA');
  });

  it('5. ChartSessionController: showVolume bernilai true secara default dan dapat di-toggle via setShowVolume', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController();
    assert.equal(controller.getSnapshot().showVolume, true, 'Default showVolume harus true');

    let visibleSet = true;
    let volumeHandle = {
      id: 'vol_native',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      setVisible: (v: boolean) => {
        visibleSet = v;
        volumeHandle.visible = v;
      },
      remove: () => {},
    };

    const mockCell = {
      id: 'cell_0',
      symbol: 'binance:BTCUSDT',
      timeframe: '15',
      chart: {
        indicators: () => [volumeHandle],
        addNativeIndicator: (t: string) => volumeHandle,
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: (id: string) => mockCell,
      active: mockCell,
      on: () => {},
    };

    const mockContainer = {
      nodeType: 1,
      tagName: 'DIV',
      clientWidth: 1000,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    };

    controller.attach(mockContainer as any, {
      workspaceFactory: () => mockWs,
    } as any);

    // Toggle off
    controller.setShowVolume(false);
    assert.equal(controller.getSnapshot().showVolume, false);
    assert.equal(visibleSet, false, 'Handle setVisible(false) harus dipanggil');

    // Toggle on
    controller.setShowVolume(true);
    assert.equal(controller.getSnapshot().showVolume, true);
    assert.equal(visibleSet, true, 'Handle setVisible(true) harus dipanggil');
  });

  it('6. Workspace Persistence: saveWorkspaceState menyertakan showVolume', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController({ showVolume: false });
    const saved = controller.saveWorkspaceState('Test Workspace');
    assert.equal(saved.showVolume, false, 'saveWorkspaceState wajib memuat showVolume: false');

    controller.setShowVolume(true);
    const saved2 = controller.saveWorkspaceState('Test Workspace 2');
    assert.equal(saved2.showVolume, true, 'saveWorkspaceState wajib memuat showVolume: true');
  });

  it('7. Workspace Persistence: loadWorkspaceState memulihkan showVolume ke controller', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController({ showVolume: true });
    assert.equal(controller.getSnapshot().showVolume, true);

    await controller.loadWorkspaceState({
      id: 'ws_test_1',
      name: 'Custom',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
      showVolume: false,
      indicators: [],
      timestamp: Date.now(),
    });

    assert.equal(controller.getSnapshot().showVolume, false, 'loadWorkspaceState harus memulihkan showVolume: false');
  });

  it('8. Kategori Preset: filter kategori Volume mengembalikan preset vwap dan volume', () => {
    const volumePresets = INDICATOR_PRESETS.filter((p) => p.category === 'Volume');
    assert.equal(volumePresets.length, 2, 'Kategori Volume harus memuat tepat 2 preset');
    const ids = volumePresets.map((p) => p.id);
    assert.ok(ids.includes('vwap'), 'Harus menyertakan vwap');
    assert.ok(ids.includes('volume'), 'Harus menyertakan volume');
  });

  it('9. Multi-Chart Synchronization: setShowVolume menghormati syncConfig.indicators', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController({
      layout: '2-1',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
    });

    let cell1Vis = true;
    let cell2Vis = true;

    const cell1 = {
      id: 'cell_1',
      symbol: 'BTCUSDT',
      timeframe: '15',
      volumeHidden: false,
      chart: {
        indicators: () => [{ nativeType: 'volume', setVisible: (v: boolean) => { cell1Vis = v; } }],
      },
    };

    const cell2 = {
      id: 'cell_2',
      symbol: 'ETHUSDT',
      timeframe: '15',
      volumeHidden: false,
      chart: {
        indicators: () => [{ nativeType: 'volume', setVisible: (v: boolean) => { cell2Vis = v; } }],
      },
    };

    const mockWs = {
      cells: () => [cell1, cell2],
      active: cell1,
      on: () => {},
    };

    const mockContainer = {
      nodeType: 1,
      tagName: 'DIV',
      clientWidth: 1000,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    };

    controller.attach(mockContainer as any, {
      workspaceFactory: () => mockWs,
    } as any);

    // Saat syncConfig.indicators === false, toggle dengan targetCell cell1 hanya memutasi cell1
    controller.setShowVolume(false, cell1);
    assert.equal(cell1Vis, false, 'Cell 1 visibilitas harus false');
    assert.equal(cell2Vis, true, 'Cell 2 visibilitas harus tetap true saat sync nonaktif');

    // Aktifkan syncConfig.indicators
    controller.syncLayout({ indicators: true });
    controller.setShowVolume(false);
    assert.equal(cell1Vis, false, 'Cell 1 harus false saat sync aktif');
    assert.equal(cell2Vis, false, 'Cell 2 harus ikut diselaraskan saat sync aktif');
  });

  it('10. Native Volume: syncNativeVolumeColors menyelaraskan warna bar volume dengan tema dan custom candle color', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController();

    let volumeInputs: any = {};
    const volumeHandle = {
      id: 'vol_native',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      setInputs: (inputs: any) => {
        volumeInputs = { ...volumeInputs, ...inputs };
      },
    };

    const mockCell = {
      id: 'cell_0',
      chart: {
        indicators: () => [volumeHandle],
        renderer: {
          applyConfig: () => {},
        },
      },
      inner: {
        setTheme: () => {},
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => {},
    };

    controller.attach({
      nodeType: 1,
      tagName: 'DIV',
      clientWidth: 1000,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    } as any, {
      workspaceFactory: () => mockWs,
    } as any);

    // Initial sync
    controller.syncNativeVolumeColors();
    assert.ok(volumeInputs.upColor, 'Harus memiliki upColor');
    assert.ok(volumeInputs.downColor, 'Harus memiliki downColor');
    // Ubah dengan custom candle color via setTheme
    controller.setTheme('signature', 12, { bullColor: '#00ff00', bearColor: '#ff0000' });
    assert.equal(volumeInputs.upColor, '#00ff00', 'upColor volume harus sinkron dengan custom bullColor');
    assert.equal(volumeInputs.downColor, '#ff0000', 'downColor volume harus sinkron dengan custom bearColor');
  });

  it('11. PineEngine: VWAP preset dieksekusi menghasilkan series numerik valid (non-null)', async () => {
    const { PineEngine } = await import('@luxalgo/vela-pinets');
    const vwapPreset = INDICATOR_PRESETS.find((p) => p.id === 'vwap')!;
    assert.ok(vwapPreset);

    const engine = new PineEngine();
    const prepared = await engine.prepare(vwapPreset.sourceCode, 'test-vwap');
    assert.equal(prepared.meta.overlay, true);

    const baseTime = 1700000000;
    const bars: any[] = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        time: baseTime + i * 60,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000 + i * 50,
      });
    }

    const inputDefaults: Record<string, any> = {};
    for (const inp of prepared.inputs ?? []) inputDefaults[inp.key] = inp.defval;

    let modelResult: any = null;
    await new Promise<void>((resolve, reject) => {
      engine.execute(
        {
          prepared,
          market: { symbol: 'BTCUSDT', timeframe: '1m' },
          bars,
          getBars: () => bars,
          fetchSeries: async () => [],
          inputs: inputDefaults,
          props: {},
          visibleRange: { left: bars[0].time, right: bars[bars.length - 1].time },
          mode: 'static',
          historyState: 'complete',
        },
        {
          onModel: (model) => {
            modelResult = model;
            resolve();
          },
          onError: reject,
        }
      );
    });

    assert.ok(modelResult, 'Model harus terkirim dari execute');
    assert.equal(modelResult.overlay, true);
    assert.equal(modelResult.paneHint, 'price');
    const vwapSeries = modelResult.series.find((s: any) => s.title === 'VWAP');
    assert.ok(vwapSeries, 'Series VWAP harus ditemukan');
    assert.equal(vwapSeries.points.length, 20);
    const validNumeric = vwapSeries.points.filter((p: any) => typeof p.value === 'number' && !Number.isNaN(p.value));
    assert.equal(validNumeric.length, 20, 'Seluruh 20 bar wajib menghasilkan nilai VWAP numerik valid (bukan null)');
  });

  it('12. WebGL Renderer: syncNativeVolumeColors memutasi setNativeData layer volume', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const controller = new ChartSessionController();

    let nativeVolumeData: any = null;
    const mockRenderer = {
      setNativeData: (type: string, data: any) => {
        if (type === 'volume') nativeVolumeData = data;
      },
    };

    const mockCell = {
      id: 'cell_0',
      chart: {
        indicators: () => [],
        renderer: mockRenderer,
      },
      inner: {
        setTheme: () => {},
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => {},
    };

    controller.attach({
      nodeType: 1,
      tagName: 'DIV',
      clientWidth: 1000,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    } as any, {
      workspaceFactory: () => mockWs,
    } as any);

    controller.setTheme('signature', 12, { bullColor: '#123456', bearColor: '#654321' });
    assert.ok(nativeVolumeData, 'Renderer setNativeData volume harus dipanggil');
    assert.equal(nativeVolumeData.upColor, '#123456');
    assert.equal(nativeVolumeData.downColor, '#654321');
  });
});



