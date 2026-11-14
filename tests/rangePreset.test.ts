import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  VISIBLE_RANGE_PRESETS,
  isValidRangePreset,
  getRangePresetConfig,
  calculateRangePresetSpan,
  getNextRangePreset,
  type VisibleRangePreset,
  type RangePresetConfig,
} from '../src/lib/services/rangePresetService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { commandDispatcher } from '../src/lib/services/commandDispatcher';

/**
 * Mock helper untuk membuat cell VelaWorkspace yang mendukung setMarket dan setVisibleRange
 */
function createMockVelaCell(id: string = 'cell-1') {
  let currentTimeframe = '15m';
  let currentVisibleRange: { from: number; to: number } | null = null;
  const marketCalls: any[] = [];
  const setVisibleRangeCalls: any[] = [];
  const eventListeners = new Map<string, Array<(...args: any[]) => void>>();

  // Buat sampel 100 candle bar dummy berinterval 15 menit
  const now = Date.now();
  const fifteenMinMs = 15 * 60 * 1000;
  const sampleBars = Array.from({ length: 100 }, (_, i) => ({
    time: now - (100 - i) * fifteenMinMs,
    open: 50000 + i * 10,
    high: 50050 + i * 10,
    low: 49950 + i * 10,
    close: 50020 + i * 10,
    volume: 100 + i,
  }));

  const chart: any = {
    id,
    market: {
      symbol: 'BTCUSDT',
      timeframe: '15',
      bars: 1000,
    },
    bars: sampleBars,
    rawBars: sampleBars,
    historyCompleted: true,
    async setMarket(opts: any) {
      marketCalls.push(opts);
      if (opts.timeframe) {
        currentTimeframe = opts.timeframe;
        this.market.timeframe = opts.timeframe;
      }
      if (opts.visibleRange) {
        currentVisibleRange = typeof opts.visibleRange === 'object' ? opts.visibleRange : null;
      }
      // Picu event market:changed
      const handlers = eventListeners.get('market:changed') || [];
      for (const h of handlers) h();
      return Promise.resolve();
    },
    setVisibleRange(range: { from: number; to: number }) {
      setVisibleRangeCalls.push(range);
      currentVisibleRange = range;
      const handlers = eventListeners.get('viewport:changed') || [];
      for (const h of handlers) h();
    },
    setVisibleRangePreset(preset: string) {
      setVisibleRangeCalls.push(preset);
      const handlers = eventListeners.get('viewport:changed') || [];
      for (const h of handlers) h();
    },
    getVisibleRange() {
      return currentVisibleRange || {
        from: sampleBars[0].time,
        to: sampleBars[sampleBars.length - 1].time,
      };
    },
    on(event: string, handler: (...args: any[]) => void) {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(handler);
      return () => {
        const arr = eventListeners.get(event) || [];
        const idx = arr.indexOf(handler);
        if (idx !== -1) arr.splice(idx, 1);
      };
    },
    emit(event: string, ...args: any[]) {
      const handlers = eventListeners.get(event) || [];
      for (const h of handlers) h(...args);
    },
    renderer: {
      renderer: {
        getVisibleRange() {
          return currentVisibleRange || {
            from: sampleBars[0].time,
            to: sampleBars[sampleBars.length - 1].time,
          };
        },
        setVisibleRange(range: any) {
          currentVisibleRange = range;
        },
      },
      applyConfig: () => {},
    },
  };

  const cell: any = {
    id,
    symbol: 'binance:BTCUSDT',
    timeframe: '15m',
    setTimeframe(tf: string) {
      currentTimeframe = tf;
      this.timeframe = tf;
    },
    chart,
    inner: chart,
    applyRange: (preset: any) => {
      chart.setMarket({ timeframe: preset.tf, visibleRange: preset.preset });
    },
  };

  return {
    cell,
    chart,
    getMarketCalls: () => marketCalls,
    getSetVisibleRangeCalls: () => setVisibleRangeCalls,
    getCurrentTimeframe: () => currentTimeframe,
    getCurrentVisibleRange: () => currentVisibleRange,
  };
}

describe('Visible Range Presets Suite (#204)', () => {
  describe('1. Validasi Preset dan Konfigurasi Domain Horizon', () => {
    test('Daftar VISIBLE_RANGE_PRESETS mencakup seluruh 8 standar institusional', () => {
      const expected: VisibleRangePreset[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
      assert.deepStrictEqual(VISIBLE_RANGE_PRESETS, expected);
      assert.strictEqual(VISIBLE_RANGE_PRESETS.length, 8);
    });

    test('isValidRangePreset memvalidasi preset dengan ketat', () => {
      assert.strictEqual(isValidRangePreset('1D'), true);
      assert.strictEqual(isValidRangePreset('5D'), true);
      assert.strictEqual(isValidRangePreset('1M'), true);
      assert.strictEqual(isValidRangePreset('3M'), true);
      assert.strictEqual(isValidRangePreset('6M'), true);
      assert.strictEqual(isValidRangePreset('YTD'), true);
      assert.strictEqual(isValidRangePreset('1Y'), true);
      assert.strictEqual(isValidRangePreset('ALL'), true);

      assert.strictEqual(isValidRangePreset('10D'), false);
      assert.strictEqual(isValidRangePreset('2W'), false);
      assert.strictEqual(isValidRangePreset(''), false);
      assert.strictEqual(isValidRangePreset(null), false);
      assert.strictEqual(isValidRangePreset(undefined), false);
      assert.strictEqual(isValidRangePreset(123), false);
    });

    test('getRangePresetConfig memetakan setiap preset ke timeframe dan bar budget optimal', () => {
      for (const preset of VISIBLE_RANGE_PRESETS) {
        const config = getRangePresetConfig(preset);
        assert.ok(config, `Konfigurasi untuk preset ${preset} harus ada`);
        assert.strictEqual(config.id, preset);
        assert.ok(config.label.length > 0, 'Label harus berupa string non-kosong');
        assert.ok(config.timeframe.length > 0, 'Timeframe harus berupa string non-kosong');
        assert.ok(config.bars > 0, 'Bar budget harus bernilai positif');
      }

      // Verifikasi spesifik resolusi candle optimal
      const c1D = getRangePresetConfig('1D');
      assert.ok(c1D.timeframe === '1m' || c1D.timeframe === '5m');

      const c5D = getRangePresetConfig('5D');
      assert.ok(c5D.timeframe === '5m' || c5D.timeframe === '15m');

      const c1M = getRangePresetConfig('1M');
      assert.ok(c1M.timeframe === '30m' || c1M.timeframe === '1h');

      const c3M = getRangePresetConfig('3M');
      assert.ok(c3M.timeframe === '1h' || c3M.timeframe === '2h');

      const c6M = getRangePresetConfig('6M');
      assert.ok(c6M.timeframe === '2h' || c6M.timeframe === '4h');

      const cYTD = getRangePresetConfig('YTD');
      assert.strictEqual(cYTD.timeframe, '1D');

      const c1Y = getRangePresetConfig('1Y');
      assert.strictEqual(c1Y.timeframe, '1D');

      const cALL = getRangePresetConfig('ALL');
      assert.ok(cALL.timeframe === '1W' || cALL.timeframe === '1M' || cALL.timeframe === '1D');
    });

    test('calculateRangePresetSpan menghitung rentang from-to yang deterministik', () => {
      const fixedNow = Date.UTC(2026, 10, 14, 12, 0, 0); // 14 November 2026 12:00 UTC
      const dayMs = 86_400_000;

      // 1D: 24 jam ke belakang
      const span1D = calculateRangePresetSpan('1D', undefined, fixedNow);
      assert.strictEqual(span1D.to, fixedNow);
      assert.strictEqual(span1D.from, fixedNow - dayMs);

      // 5D: 5 hari ke belakang
      const span5D = calculateRangePresetSpan('5D', undefined, fixedNow);
      assert.strictEqual(span5D.to, fixedNow);
      assert.strictEqual(span5D.from, fixedNow - 5 * dayMs);

      // 1M: 30 hari ke belakang
      const span1M = calculateRangePresetSpan('1M', undefined, fixedNow);
      assert.strictEqual(span1M.to, fixedNow);
      assert.strictEqual(span1M.from, fixedNow - 30 * dayMs);

      // YTD: 1 Januari 2026 00:00:00 UTC
      const spanYTD = calculateRangePresetSpan('YTD', undefined, fixedNow);
      assert.strictEqual(spanYTD.to, fixedNow);
      assert.strictEqual(spanYTD.from, Date.UTC(2026, 0, 1, 0, 0, 0));

      // 1Y: 365 hari ke belakang
      const span1Y = calculateRangePresetSpan('1Y', undefined, fixedNow);
      assert.strictEqual(span1Y.to, fixedNow);
      assert.strictEqual(span1Y.from, fixedNow - 365 * dayMs);

      // ALL dengan bars riwayat
      const sampleBars = [
        { time: Date.UTC(2020, 0, 1) },
        { time: Date.UTC(2026, 10, 14) },
      ];
      const spanALL = calculateRangePresetSpan('ALL', sampleBars, fixedNow);
      assert.strictEqual(spanALL.from, Date.UTC(2020, 0, 1));
      assert.strictEqual(spanALL.to, Date.UTC(2026, 10, 14));
    });

    test('getNextRangePreset merotasi preset secara siklik maju dan mundur', () => {
      // Maju (Next)
      assert.strictEqual(getNextRangePreset('1D', 'next'), '5D');
      assert.strictEqual(getNextRangePreset('5D', 'next'), '1M');
      assert.strictEqual(getNextRangePreset('1M', 'next'), '3M');
      assert.strictEqual(getNextRangePreset('3M', 'next'), '6M');
      assert.strictEqual(getNextRangePreset('6M', 'next'), 'YTD');
      assert.strictEqual(getNextRangePreset('YTD', 'next'), '1Y');
      assert.strictEqual(getNextRangePreset('1Y', 'next'), 'ALL');
      assert.strictEqual(getNextRangePreset('ALL', 'next'), '1D');

      // Mundur (Prev)
      assert.strictEqual(getNextRangePreset('1D', 'prev'), 'ALL');
      assert.strictEqual(getNextRangePreset('ALL', 'prev'), '1Y');
      assert.strictEqual(getNextRangePreset('1Y', 'prev'), 'YTD');
      assert.strictEqual(getNextRangePreset('YTD', 'prev'), '6M');
      assert.strictEqual(getNextRangePreset('6M', 'prev'), '3M');
      assert.strictEqual(getNextRangePreset('3M', 'prev'), '1M');
      assert.strictEqual(getNextRangePreset('1M', 'prev'), '5D');
      assert.strictEqual(getNextRangePreset('5D', 'prev'), '1D');
    });
  });

  describe('2. Integrasi ChartSessionController dengan Single-Pass Viewport Framing', () => {
    test('setVisibleRangePreset menerapkan timeframe, bars, dan visibleRange secara single-pass', async () => {
      const mock = createMockVelaCell('cell-single-pass');
      let capturedPresetChange: VisibleRangePreset | null = null;

      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace,
        onRangePresetChange: (preset) => {
          capturedPresetChange = preset;
        },
      });

      const fakeContainer = {} as HTMLElement;
      controller.attach(fakeContainer);

      // Aktifkan preset 1M
      const success = await controller.setVisibleRangePreset('1M');
      assert.strictEqual(success, true);
      assert.strictEqual(controller.getActiveRangePreset(), '1M');
      assert.strictEqual(capturedPresetChange, '1M');

      // Periksa panggilan single-pass setMarket pada inner chart
      const calls = mock.getMarketCalls();
      assert.ok(calls.length > 0, 'Harus ada panggilan setMarket');
      const lastCall = calls[calls.length - 1];
      assert.ok(lastCall.timeframe, 'Panggilan setMarket harus menyertakan timeframe optimal');
      assert.ok(lastCall.visibleRange, 'Panggilan setMarket harus menyertakan visibleRange');
      assert.ok(lastCall.bars && lastCall.bars >= 500, 'Panggilan setMarket harus menyertakan bar budget yang cukup');

      // Verifikasi timeframe di controller ikut terbarui
      const snapshot = controller.getSnapshot();
      assert.strictEqual(snapshot.activeRangePreset, '1M');
    });

    test('cycleRangePreset memutar preset secara siklis dan menerapkan horizon berikutnya', async () => {
      const mock = createMockVelaCell('cell-cycle');
      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace,
      });
      controller.attach({} as HTMLElement);

      // Awalnya null atau default, set awal ke 1D
      await controller.setVisibleRangePreset('1D');
      assert.strictEqual(controller.getActiveRangePreset(), '1D');

      // Putar maju (next) -> harus menjadi 5D
      const nextPreset = await controller.cycleRangePreset('next');
      assert.strictEqual(nextPreset, '5D');
      assert.strictEqual(controller.getActiveRangePreset(), '5D');

      // Putar mundur (prev) -> kembali ke 1D
      const prevPreset = await controller.cycleRangePreset('prev');
      assert.strictEqual(prevPreset, '1D');
      assert.strictEqual(controller.getActiveRangePreset(), '1D');
    });

    test('Fallback aman saat preset tidak valid diberikan ke setVisibleRangePreset', async () => {
      const mock = createMockVelaCell('cell-invalid');
      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace,
      });
      controller.attach({} as HTMLElement);

      // Panggil dengan nilai tidak valid
      const result = await controller.setVisibleRangePreset('99D' as any);
      assert.strictEqual(result, false);
      assert.strictEqual(controller.getActiveRangePreset(), null);
    });

    test('Pembaruan manual viewport mereset activeRangePreset jika menyimpang dari framed horizon', async () => {
      const mock = createMockVelaCell('cell-vp-drift');
      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace,
      });
      controller.attach({} as HTMLElement);

      await controller.setVisibleRangePreset('1D');
      assert.strictEqual(controller.getActiveRangePreset(), '1D');

      // Simulasikan user melakukan zooming/panning jauh (misal durasi viewport melebar jadi 100 hari)
      const now = Date.now();
      mock.chart.setVisibleRange({
        from: now - 100 * 86_400_000,
        to: now,
      });

      // controller harus mendeteksi pergeseran dan mereset preset
      assert.strictEqual(controller.getActiveRangePreset(), null);
    });

    test('setVisibleRangePreset("1Y") tidak ter-clamp oleh bar timeframe lama dan memicu onActiveCellChange', async () => {
      const mock = createMockVelaCell('cell-1y-switch');
      const cellChanges: Array<{ symbol: string; timeframe: string }> = [];

      // Simulasikan setMarket mengganti bars menjadi 400 bar harian
      const originalSetMarket = mock.chart.setMarket.bind(mock.chart);
      mock.chart.setMarket = async (opts: any) => {
        if (opts.timeframe === 'D') {
          const now = Date.now();
          const dayMs = 86_400_000;
          const dailyBars = Array.from({ length: 400 }, (_, i) => ({
            time: now - (400 - i) * dayMs,
            open: 50000,
            high: 51000,
            low: 49000,
            close: 50500,
            volume: 1000,
          }));
          mock.chart.bars = dailyBars;
          mock.chart.rawBars = dailyBars;
        }
        return originalSetMarket(opts);
      };

      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        workspaceFactory: () => mockWorkspace,
        onActiveCellChange: (info) => {
          cellChanges.push({ symbol: info.symbol, timeframe: info.timeframe });
        },
      });
      controller.attach({} as HTMLElement);

      await controller.setVisibleRangePreset('1Y');

      const calls = mock.getMarketCalls();
      const lastCall = calls[calls.length - 1];
      const spanMs = lastCall.visibleRange.to - lastCall.visibleRange.from;
      // 1Y harus sekitar 365 hari, bukan ~25 jam dari bar 15m lama
      assert.ok(spanMs >= 360 * 86_400_000, `Expected ~365 days span, got ${spanMs / 86_400_000} days`);
      assert.ok(
        cellChanges.some((c) => c.timeframe === '1D'),
        'onActiveCellChange harus dipanggil dengan timeframe 1D'
      );
    });

    test('setTimeframe dan setSymbol manual mereset activeRangePreset ke null', async () => {
      const mock = createMockVelaCell('cell-manual-reset');
      const presetEvents: Array<VisibleRangePreset | null> = [];
      const mockWorkspace: any = {
        active: mock.cell,
        cells: () => [mock.cell],
        cellsById: new Map([[mock.cell.id, mock.cell]]),
        cell: () => mock.cell,
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace,
        onRangePresetChange: (preset) => presetEvents.push(preset),
      });
      controller.attach({} as HTMLElement);

      await controller.setVisibleRangePreset('1M');
      assert.strictEqual(controller.getActiveRangePreset(), '1M');

      controller.setTimeframe('4h');
      assert.strictEqual(controller.getActiveRangePreset(), null);
      assert.strictEqual(presetEvents[presetEvents.length - 1], null);

      await controller.setVisibleRangePreset('3M');
      assert.strictEqual(controller.getActiveRangePreset(), '3M');

      await controller.setSymbol('ETHUSDT');
      assert.strictEqual(controller.getActiveRangePreset(), null);
    });
  });

  describe('3. Pendaftaran Perintah Keyboard (Keyboard Shortcut Integration)', () => {
    test('Perintah cycle-range-preset terdaftar di CommandDispatcher dengan shortcut Alt+R', () => {
      const cmd = commandDispatcher.get('cycle-range-preset');
      assert.ok(cmd, 'Perintah cycle-range-preset harus terdaftar');
      assert.strictEqual(cmd.category, 'Skala & Tampilan Grafik');
      assert.ok(cmd.keys.includes('Alt') && cmd.keys.includes('R'), 'Shortcut harus menyertakan Alt+R');
    });
  });
});
