import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSeriesTicker,
  normalizeSeriesTimeframe,
  applyRangeBounds,
  createPineFetchSeriesAdapter,
  toOHLCVBar,
  TrawanganPineWorkerEngine,
  type FetchSeriesRange,
  type OHLCVBar,
} from '../src/lib/services/pineSeriesAdapter';
import type { Candle } from '../src/lib/types/market';

test('Pine Series Adapter & Inter-Symbol Resolution (#197)', async (t) => {
  await t.test('1. parseSeriesTicker - Penguraian Simbol & Routing Provider', () => {
    // 1.1 Prefix Bursa Eksplisit
    const binance = parseSeriesTicker('BINANCE:BTCUSDT');
    assert.equal(binance.providerId, 'binance');
    assert.equal(binance.cleanSymbol, 'BTCUSDT');
    assert.equal(binance.rawSymbol, 'BINANCE:BTCUSDT');

    const yahoo = parseSeriesTicker('YAHOO:^GSPC');
    assert.equal(yahoo.providerId, 'yahoo');
    assert.equal(yahoo.cleanSymbol, '^GSPC');

    const yahooStock = parseSeriesTicker('YAHOO:AAPL');
    assert.equal(yahooStock.providerId, 'yahoo');
    assert.equal(yahooStock.cleanSymbol, 'AAPL');

    const macro = parseSeriesTicker('MACRO:TOTAL');
    assert.equal(macro.providerId, 'macro');
    assert.equal(macro.cleanSymbol, 'TOTAL');

    const macroBtcD = parseSeriesTicker('MACRO:BTC.D');
    assert.equal(macroBtcD.providerId, 'macro');
    assert.equal(macroBtcD.cleanSymbol, 'BTC.D');

    const indodax = parseSeriesTicker('INDODAX:BTCIDR');
    assert.equal(indodax.providerId, 'indodax');
    assert.equal(indodax.cleanSymbol, 'BTCIDR');

    const bitunix = parseSeriesTicker('BITUNIX:BTCUSDT.P');
    assert.equal(bitunix.providerId, 'bitunix');
    assert.equal(bitunix.cleanSymbol, 'BTCUSDT.P');

    const coinbase = parseSeriesTicker('COINBASE:BTC-USD');
    assert.equal(coinbase.providerId, 'coinbase');
    assert.equal(coinbase.cleanSymbol, 'BTC-USD');

    const hyperliquid = parseSeriesTicker('HYPERLIQUID:ETH');
    assert.equal(hyperliquid.providerId, 'hyperliquid');
    assert.equal(hyperliquid.cleanSymbol, 'ETH');

    // 1.2 Bare Symbols (Inference Cerdas)
    const bareBtc = parseSeriesTicker('BTCUSDT');
    assert.equal(bareBtc.providerId, 'binance');
    assert.equal(bareBtc.cleanSymbol, 'BTCUSDT');

    const bareYahooIdx = parseSeriesTicker('^IXIC');
    assert.equal(bareYahooIdx.providerId, 'yahoo');
    assert.equal(bareYahooIdx.cleanSymbol, '^IXIC');

    const bareIndoStock = parseSeriesTicker('BBCA.JK');
    assert.equal(bareIndoStock.providerId, 'yahoo');
    assert.equal(bareIndoStock.cleanSymbol, 'BBCA.JK');

    const bareCommodity = parseSeriesTicker('GC=F');
    assert.equal(bareCommodity.providerId, 'yahoo');
    assert.equal(bareCommodity.cleanSymbol, 'GC=F');

    const bareTotal = parseSeriesTicker('TOTAL');
    assert.equal(bareTotal.providerId, 'macro');
    assert.equal(bareTotal.cleanSymbol, 'TOTAL');

    const bareTotal2 = parseSeriesTicker('TOTAL2');
    assert.equal(bareTotal2.providerId, 'macro');
    assert.equal(bareTotal2.cleanSymbol, 'TOTAL2');

    const bareBtcD = parseSeriesTicker('BTC.D');
    assert.equal(bareBtcD.providerId, 'macro');
    assert.equal(bareBtcD.cleanSymbol, 'BTC.D');

    const bareIndodax = parseSeriesTicker('ETHIDR');
    assert.equal(bareIndodax.providerId, 'indodax');
    assert.equal(bareIndodax.cleanSymbol, 'ETHIDR');

    // 1.3 Extended Ticker Modifiers (misal Vela chart style modifier ;heikinashi)
    const modified = parseSeriesTicker('BINANCE:ETHUSDT;heikinashi');
    assert.equal(modified.providerId, 'binance');
    assert.equal(modified.cleanSymbol, 'ETHUSDT');
    assert.equal(modified.modifier, 'heikinashi');

    // 1.4 Whitespace & Case Insensitivity
    const messy = parseSeriesTicker('  binance:btcusdt  ');
    assert.equal(messy.providerId, 'binance');
    assert.equal(messy.cleanSymbol, 'BTCUSDT');
  });

  await t.test('2. normalizeSeriesTimeframe - Normalisasi Format Timeframe PineTS', () => {
    // Format angka menit dari PineTS
    assert.equal(normalizeSeriesTimeframe('1'), '1m');
    assert.equal(normalizeSeriesTimeframe('3'), '3m');
    assert.equal(normalizeSeriesTimeframe('5'), '5m');
    assert.equal(normalizeSeriesTimeframe('15'), '15m');
    assert.equal(normalizeSeriesTimeframe('30'), '30m');
    assert.equal(normalizeSeriesTimeframe('60'), '1h');
    assert.equal(normalizeSeriesTimeframe('120'), '2h');
    assert.equal(normalizeSeriesTimeframe('240'), '4h');

    // Format huruf periode besar
    assert.equal(normalizeSeriesTimeframe('D'), '1D');
    assert.equal(normalizeSeriesTimeframe('1D'), '1D');
    assert.equal(normalizeSeriesTimeframe('W'), '1W');
    assert.equal(normalizeSeriesTimeframe('1W'), '1W');
    assert.equal(normalizeSeriesTimeframe('M'), '1M');
    assert.equal(normalizeSeriesTimeframe('1M'), '1M');

    // Format standar langsung lolos
    assert.equal(normalizeSeriesTimeframe('15m'), '15m');
    assert.equal(normalizeSeriesTimeframe('1h'), '1h');
    assert.equal(normalizeSeriesTimeframe('4h'), '4h');

    // Kosong atau undefined fallback ke default
    assert.equal(normalizeSeriesTimeframe(''), '15m');
  });

  await t.test('3. applyRangeBounds & toOHLCVBar - Filter & Slicing Batas Waktu', () => {
    const rawCandles: Candle[] = [
      { time: 1000, open: 10, high: 15, low: 9, close: 14, volume: 100 },
      { time: 2000, open: 14, high: 16, low: 13, close: 15, volume: 150 },
      { time: 3000, open: 15, high: 18, low: 14, close: 17, volume: 200 },
      { time: 4000, open: 17, high: 19, low: 16, close: 18, volume: 250 },
      { time: 5000, open: 18, high: 20, low: 17, close: 19, volume: 300 },
    ];

    const bars: OHLCVBar[] = rawCandles.map(toOHLCVBar);

    // Verifikasi dual-interface OHLCVBar (tuple + object)
    assert.equal(bars[0][0], 1000);
    assert.equal(bars[0][1], 10);
    assert.equal(bars[0][2], 15);
    assert.equal(bars[0][3], 9);
    assert.equal(bars[0][4], 14);
    assert.equal(bars[0][5], 100);

    assert.equal(bars[0].time, 1000);
    assert.equal(bars[0].open, 10);
    assert.equal(bars[0].high, 15);
    assert.equal(bars[0].low, 9);
    assert.equal(bars[0].close, 14);
    assert.equal(bars[0].volume, 100);

    // 3.1 Tanpa range filter
    const full = applyRangeBounds(bars);
    assert.equal(full.length, 5);

    // 3.2 Filter 'from'
    const fromBars = applyRangeBounds(bars, { from: 3000 });
    assert.equal(fromBars.length, 3);
    assert.equal(fromBars[0].time, 3000);
    assert.equal(fromBars[2].time, 5000);

    // 3.3 Filter 'to'
    const toBars = applyRangeBounds(bars, { to: 3000 });
    assert.equal(toBars.length, 3);
    assert.equal(toBars[0].time, 1000);
    assert.equal(toBars[2].time, 3000);

    // 3.4 Filter kombinasi 'from' dan 'to'
    const windowBars = applyRangeBounds(bars, { from: 2000, to: 4000 });
    assert.equal(windowBars.length, 3);
    assert.equal(windowBars[0].time, 2000);
    assert.equal(windowBars[2].time, 4000);

    // 3.5 Filter 'limit' (mengambil tail terbaru)
    const limitedBars = applyRangeBounds(bars, { limit: 2 });
    assert.equal(limitedBars.length, 2);
    assert.equal(limitedBars[0].time, 4000);
    assert.equal(limitedBars[1].time, 5000);

    // 3.6 Kombinasi 'from', 'to', dan 'limit'
    const combined = applyRangeBounds(bars, { from: 1000, to: 4000, limit: 2 });
    assert.equal(combined.length, 2);
    assert.equal(combined[0].time, 3000);
    assert.equal(combined[1].time, 4000);
  });

  await t.test('4. createPineFetchSeriesAdapter - Alur Cache SQLite Hit, Miss, dan Network Delegation', async () => {
    let sqliteLoadCalls = 0;
    let sqliteSaveCalls = 0;
    let networkFetchCalls = 0;

    const mockSqliteDb = new Map<string, Candle[]>();

    // Seeding awal di cache SQLite untuk BINANCE:ETHUSDT:1h
    const seedEthCandles: Candle[] = [
      { time: 10000, open: 2000, high: 2050, low: 1990, close: 2040, volume: 50 },
      { time: 13600, open: 2040, high: 2080, low: 2030, close: 2070, volume: 60 },
      { time: 17200, open: 2070, high: 2100, low: 2060, close: 2090, volume: 70 },
    ];
    mockSqliteDb.set('binance:ETHUSDT:1h', seedEthCandles);

    const adapter = createPineFetchSeriesAdapter({
      sqliteLoader: async (symbol, timeframe, _limit) => {
        sqliteLoadCalls++;
        return mockSqliteDb.get(`${symbol}:${timeframe}`) || [];
      },
      sqliteSaver: async (symbol, timeframe, candles) => {
        sqliteSaveCalls++;
        mockSqliteDb.set(`${symbol}:${timeframe}`, candles);
      },
      networkFetcher: async (_symbol, _interval, _limit) => {
        networkFetchCalls++;
        return [
          { time: 20000, open: 90000, high: 91000, low: 89500, close: 90500, volume: 1000 },
          { time: 21000, open: 90500, high: 92000, low: 90200, close: 91800, volume: 1200 },
        ];
      },
    });

    // 4.1 Skenario Cache HIT (ETHUSDT sudah ada di SQLite)
    const ethBars = await adapter('BINANCE:ETHUSDT', '60');
    assert.equal(sqliteLoadCalls, 1, 'Memeriksa SQLite cache');
    assert.equal(networkFetchCalls, 0, 'Jaringan tidak dipanggil karena cache hit');
    assert.equal(ethBars.length, 3);
    assert.equal(ethBars[0].close, 2040);
    assert.equal(ethBars[0][4], 2040);

    // 4.2 Skenario In-Memory Cache HIT (Pemanggilan kedua tidak perlu SQLite lagi)
    const ethBarsMem = await adapter('BINANCE:ETHUSDT', '60');
    assert.equal(sqliteLoadCalls, 1, 'In-memory cache mencegah query SQLite berulang');
    assert.equal(networkFetchCalls, 0);
    assert.equal(ethBarsMem.length, 3);

    // 4.3 Skenario Cache MISS (BTCUSDT belum ada di SQLite)
    const btcBars = await adapter('BINANCE:BTCUSDT', '15');
    assert.equal(sqliteLoadCalls, 3, 'Memeriksa SQLite cache untuk provider key dan fallback bare symbol');
    assert.equal(networkFetchCalls, 1, 'Memanggil networkFetcher karena data belum ada di cache');
    assert.ok(sqliteSaveCalls >= 1, 'Menyimpan lilin baru ke SQLite cache');
    assert.equal(btcBars.length, 2);
    assert.equal(btcBars[1].close, 91800);
    assert.equal(btcBars[1][4], 91800);

    // 4.4 Skenario Cache HIT berikutnya setelah disimpan
    const btcBarsHit = await adapter('BINANCE:BTCUSDT', '15');
    assert.equal(networkFetchCalls, 1, 'Tidak memicu network kedua');
    assert.equal(btcBarsHit.length, 2);
  });

  await t.test('5. TrawanganPineWorkerEngine - Integrasi Subclass Worker Engine', async () => {
    let adapterCalled = false;
    const testAdapter = async (sym: string, tf: string, range?: FetchSeriesRange) => {
      adapterCalled = true;
      return [toOHLCVBar({ time: 5000, open: 100, high: 110, low: 95, close: 105, volume: 500 })];
    };

    // Buat fake worker factory agar tidak memicu Web Worker browser/DOM nyata
    const fakeMessages: any[] = [];
    const fakeWorker = {
      postMessage(msg: any) {
        fakeMessages.push(msg);
      },
      addEventListener(_type: string, _listener: any) {},
      terminate() {},
    };

    const engine = new TrawanganPineWorkerEngine({
      createWorker: () => fakeWorker,
      fetchSeries: testAdapter,
    });

    assert.equal(engine.language, 'pine');
    assert.ok(typeof (engine as any).serveFetch === 'function');

    // Simulasikan worker meminta series via serveFetch
    await (engine as any).serveFetch(42, 'YAHOO:^GSPC', '1D', { limit: 10 });
    assert.ok(adapterCalled, 'fetchSeries adapter harus dipanggil oleh serveFetch');

    // Pastikan respon balik dikirim ke worker via postMessage
    const responseMsg = fakeMessages.find((m) => m.kind === 'fetchSeriesResult' && m.reqId === 42);
    assert.ok(responseMsg, 'Pesan fetchSeriesResult harus dikirim kembali ke worker');
    assert.equal(responseMsg.bars.length, 1);
    assert.equal(responseMsg.bars[0].close, 105);
  });

  await t.test('6. End-to-End Pine Script request.security Resolution', async () => {
    const { PineEngine } = await import('@luxalgo/vela-pinets');
    const pineEngine = new PineEngine();

    // Skrip Pine v5 multi-symbol overlay yang memanggil request.security
    const scriptSource = `
//@version=5
indicator("Spread Multi-Simbol", overlay=false)
secClose = request.security("BINANCE:ETHUSDT", "15", close)
ratio = close / secClose
plot(ratio, title="BTC/ETH Ratio")
`;

    const prepared = await pineEngine.prepare(scriptSource, 'inst_test_security');
    assert.ok(prepared, 'Skrip harus berhasil di-prepare/transpile');

    const chartBars = [
      { time: 100000, open: 60000, high: 60500, low: 59500, close: 60200, volume: 100 },
      { time: 100900, open: 60200, high: 61000, low: 60100, close: 60800, volume: 120 },
    ];

    let fetchSeriesCalled = false;
    const adapter = createPineFetchSeriesAdapter({
      networkFetcher: async (symbol, interval, _limit) => {
        fetchSeriesCalled = true;
        assert.ok(symbol.includes('ETHUSDT'));
        return [
          { time: 100000, open: 3000, high: 3050, low: 2980, close: 3010, volume: 50 },
          { time: 100900, open: 3010, high: 3080, low: 3000, close: 3040, volume: 60 },
        ];
      },
    });

    let receivedModel: any = null;
    let executionError: any = null;

    await new Promise<void>((resolve) => {
      pineEngine.execute(
        {
          prepared,
          market: { symbol: 'BINANCE:BTCUSDT', timeframe: '15' } as any,
          bars: chartBars as any,
          getBars: () => chartBars as any,
          fetchSeries: adapter,
          inputs: {},
          props: {},
          visibleRange: { left: 90000, right: 110000 },
          mode: 'static',
        },
        {
          onModel: (model) => {
            receivedModel = model;
            resolve();
          },
          onAlert: () => {},
          onWarning: () => {},
          onError: (err) => {
            executionError = err;
            resolve();
          },
        }
      );
    });

    assert.equal(executionError, null, 'Tidak boleh ada runtime error missing series pada skrip Pine');
    assert.ok(fetchSeriesCalled, 'Adapter fetchSeries harus terpanggil untuk menyelesaikan ETHUSDT');
    assert.ok(receivedModel, 'Model indikator harus terbentuk dan diterima');
  });
});
