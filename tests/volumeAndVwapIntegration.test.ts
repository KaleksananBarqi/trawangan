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
    assert.ok(vwapPreset.sourceCode.includes('//@version=5'), 'Wajib Pine Script v5');
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
    
    const firstPlot = ctx.plots[plotKeys[0]];
    assert.ok(firstPlot.data.length > 0, 'Data plot tidak boleh kosong');
    const validPoint = firstPlot.data.find((pt: any) => typeof pt.value === 'number' && !Number.isNaN(pt.value));
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
});

