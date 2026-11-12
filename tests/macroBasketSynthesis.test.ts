import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MacroBasketCoordinator,
  buildCompositeMacroBars,
  computeAltCalibrationMultiplier,
  type ComponentBarSeries,
  type MacroMetadataSnapshot,
  type StablecoinHistoryPoint,
} from '../src/lib/services/macroBasketCoordinator';
import { MacroIndexProvider } from '../src/lib/services/macroIndexProvider';
import type { UniversalResponse } from '../src/lib/services/httpClient';
import type { Candle } from '../src/lib/types/market';

const DAY_MS = 86_400_000;

function makeJsonResponse(body: unknown, status = 200): UniversalResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? 'Too Many Requests' : 'OK',
    text: async () => JSON.stringify(body),
    json: async <T = any>() => body as T,
  };
}

function makeSampleMetadata(): MacroMetadataSnapshot {
  return {
    fetchedAt: 1_700_000_000_000,
    totalGlobalMarketCapUsd: 2_600_000_000_000,
    top10StablecoinCapUsd: 190_000_000_000,
    currentTotalStablecoinCapUsd: 210_000_000_000,
    currentUsdtCapUsd: 140_000_000_000,
    source: 'live',
    constituents: [
      {
        symbol: 'BTC',
        coingeckoId: 'bitcoin',
        name: 'Bitcoin',
        circulatingSupply: 19_800_000,
        currentPriceUsd: 70_000,
        currentMarketCapUsd: 1_386_000_000_000,
        marketCapRank: 1,
        inTop10: true,
      },
      {
        symbol: 'ETH',
        coingeckoId: 'ethereum',
        name: 'Ethereum',
        circulatingSupply: 120_000_000,
        currentPriceUsd: 3_000,
        currentMarketCapUsd: 360_000_000_000,
        marketCapRank: 2,
        inTop10: true,
      },
      {
        symbol: 'SOL',
        coingeckoId: 'solana',
        name: 'Solana',
        circulatingSupply: 500_000_000,
        currentPriceUsd: 200,
        currentMarketCapUsd: 100_000_000_000,
        marketCapRank: 5,
        inTop10: true,
      },
      {
        symbol: 'SUI',
        coingeckoId: 'sui',
        name: 'Sui',
        circulatingSupply: 3_000_000_000,
        currentPriceUsd: 4,
        currentMarketCapUsd: 12_000_000_000,
        marketCapRank: 18,
        inTop10: false,
      },
    ],
  };
}

describe('ADR-0024: Sintesis Basket Indeks Makro, Kalibrasi, & Ketahanan Feeder', () => {
  test('1. Metadata snapshot mengecualikan aset wrapped/LSD & memisahkan stablecoin secara bersih', async () => {
    const cgMarkets = [
      { symbol: 'btc', id: 'bitcoin', name: 'Bitcoin', current_price: 70000, market_cap: 1.38e12, circulating_supply: 19.7e6, market_cap_rank: 1 },
      { symbol: 'eth', id: 'ethereum', name: 'Ethereum', current_price: 3000, market_cap: 3.6e11, circulating_supply: 120e6, market_cap_rank: 2 },
      { symbol: 'usdt', id: 'tether', name: 'Tether', current_price: 1, market_cap: 1.4e11, circulating_supply: 1.4e11, market_cap_rank: 3 },
      { symbol: 'steth', id: 'staked-ether', name: 'Lido Staked ETH', current_price: 3000, market_cap: 3e10, circulating_supply: 10e6, market_cap_rank: 4 },
      { symbol: 'wbtc', id: 'wrapped-bitcoin', name: 'Wrapped Bitcoin', current_price: 70000, market_cap: 1e10, circulating_supply: 1.4e5, market_cap_rank: 5 },
      { symbol: 'sol', id: 'solana', name: 'Solana', current_price: 200, market_cap: 1e11, circulating_supply: 5e8, market_cap_rank: 6 },
      { symbol: 'usdc', id: 'usd-coin', name: 'USD Coin', current_price: 1, market_cap: 6e10, circulating_supply: 6e10, market_cap_rank: 7 },
      { symbol: 'xrp', id: 'ripple', name: 'XRP', current_price: 2, market_cap: 1.1e11, circulating_supply: 5.5e10, market_cap_rank: 8 },
      { symbol: 'bnb', id: 'binancecoin', name: 'BNB', current_price: 600, market_cap: 8.5e10, circulating_supply: 1.42e8, market_cap_rank: 9 },
    ];

    const coordinator = new MacroBasketCoordinator({
      disableLocalStorage: true,
      fetchFn: async (url) => {
        if (url.includes('/api/v3/global')) {
          return makeJsonResponse({ data: { total_market_cap: { usd: 2_600_000_000_000 } } });
        }
        if (url.includes('/coins/markets')) {
          return makeJsonResponse(cgMarkets);
        }
        return makeJsonResponse({}, 404);
      },
    });

    const snap = await coordinator.getMetadataSnapshot();
    const syms = new Set(snap.constituents.map((c) => c.symbol));
    assert.equal(snap.source, 'live');
    assert.equal(syms.has('BTC'), true);
    assert.equal(syms.has('SOL'), true);
    assert.equal(syms.has('STETH'), false, 'STETH harus dikecualikan agar tidak menggandakan ETH');
    assert.equal(syms.has('WBTC'), false, 'WBTC harus dikecualikan agar tidak menggandakan BTC');
    assert.equal(syms.has('USDT'), false, 'Stablecoin dipisah ke agregat stablecoin');
    assert.equal(snap.currentUsdtCapUsd, 140_000_000_000);
    assert.equal(snap.currentTotalStablecoinCapUsd, 200_000_000_000);
  });

  test('2. Invarian komposit: TOTAL >= TOTAL2 >= TOTAL3 >= OTHERS, anti-lookahead SUI, & wick terbalik USDT.D', () => {
    const metadata = makeSampleMetadata();
    const t1 = 1_700_006_400_000; // hari ke-1 (SUI belum rilis)
    const t2 = t1 + DAY_MS;       // hari ke-2 (SUI mulai rilis, pasar koreksi intraday)
    const t3 = t2 + DAY_MS;       // hari ke-3 (suplai stablecoin naik)

    const stableHistory: StablecoinHistoryPoint[] = [
      { dayKey: Math.floor(t1 / DAY_MS) * DAY_MS, totalUsd: 180_000_000_000, usdtUsd: 120_000_000_000 },
      { dayKey: Math.floor(t3 / DAY_MS) * DAY_MS, totalUsd: 210_000_000_000, usdtUsd: 140_000_000_000 },
    ];

    const series: ComponentBarSeries[] = [
      {
        symbol: 'BTC',
        bars: [
          { time: t1, open: 60000, high: 62000, low: 59000, close: 61000, volume: 10 },
          { time: t2, open: 61000, high: 61500, low: 55000, close: 58000, volume: 20 },
          { time: t3, open: 58000, high: 65000, low: 57500, close: 64000, volume: 15 },
        ],
      },
      {
        symbol: 'ETH',
        bars: [
          { time: t1, open: 2800, high: 2900, low: 2700, close: 2850, volume: 10 },
          { time: t2, open: 2850, high: 2900, low: 2500, close: 2700, volume: 10 },
          { time: t3, open: 2700, high: 3100, low: 2680, close: 3000, volume: 10 },
        ],
      },
      {
        symbol: 'SOL',
        bars: [
          { time: t1, open: 150, high: 160, low: 145, close: 155, volume: 10 },
          { time: t2, open: 155, high: 158, low: 130, close: 142, volume: 10 },
          { time: t3, open: 142, high: 175, low: 140, close: 170, volume: 10 },
        ],
      },
      {
        symbol: 'SUI',
        bars: [
          // SUI sengaja dimulai pada t2 untuk memverifikasi anti-lookahead bias di t1
          { time: t2, open: 2.0, high: 2.2, low: 1.8, close: 2.1, volume: 5 },
          { time: t3, open: 2.1, high: 2.5, low: 2.0, close: 2.4, volume: 5 },
        ],
      },
    ];

    const mult = computeAltCalibrationMultiplier(metadata, new Set(['BTC', 'ETH', 'SOL', 'SUI']));
    assert.ok(mult >= 0.85 && mult <= 2.2);

    const barsTotal = buildCompositeMacroBars({ targetSymbol: 'TOTAL', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsTotal2 = buildCompositeMacroBars({ targetSymbol: 'TOTAL2', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsTotal3 = buildCompositeMacroBars({ targetSymbol: 'TOTAL3', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsOthers = buildCompositeMacroBars({ targetSymbol: 'OTHERS', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsBtcD = buildCompositeMacroBars({ targetSymbol: 'BTC.D', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsEthD = buildCompositeMacroBars({ targetSymbol: 'ETH.D', metadata, stablecoinHistory: stableHistory, componentSeries: series });
    const barsUsdtD = buildCompositeMacroBars({ targetSymbol: 'USDT.D', metadata, stablecoinHistory: stableHistory, componentSeries: series });

    assert.equal(barsTotal.length, 3);
    // Pada t1 (sebelum listing SUI), OTHERS hanya bernilai stablecoin non-top10, setelah t2 naik karena SUI masuk basket.
    assert.ok(barsOthers[1].close > barsOthers[0].close, 'SUI wajib masuk OTHERS mulai t2 tanpa bocor ke t1');

    for (let i = 0; i < 3; i++) {
      // Monotonisitas kapitalisasi pasar
      assert.ok(barsTotal[i].close >= barsTotal2[i].close);
      assert.ok(barsTotal2[i].close >= barsTotal3[i].close);
      assert.ok(barsTotal3[i].close >= barsOthers[i].close);
      assert.ok(barsOthers[i].close >= 0);

      // Integritas OHLC semua seri
      for (const b of [barsTotal[i], barsTotal2[i], barsTotal3[i], barsOthers[i], barsBtcD[i], barsEthD[i], barsUsdtD[i]]) {
        assert.ok(b.high >= Math.max(b.open, b.close));
        assert.ok(b.low <= Math.min(b.open, b.close));
      }

      // Rentang dominansi valid & total < 100%
      const sumDom = barsBtcD[i].close + barsEthD[i].close + barsUsdtD[i].close;
      assert.ok(sumDom > 0 && sumDom < 100, `Jumlah dominansi tidak valid: ${sumDom}`);
    }

    // Pada t2 pasar jatuh intraday (low jauh di bawah close): USDT.D wajib membentuk wick atas lebih tinggi dari max(O,C)
    assert.ok(barsUsdtD[1].high > Math.max(barsUsdtD[1].open, barsUsdtD[1].close));
  });

  test('3. Failover Binance -> Coinbase Exchange, fallback CoinGecko 429, dan SQLite read-through cache', async () => {
    const requestedUrls: string[] = [];
    const savedWrites: Array<{ symbol: string; timeframe: string; count: number }> = [];
    const baseSec = Math.floor(Date.UTC(2025, 0, 6) / 1000); // Senin UTC

    const freshCachedBars: Candle[] = [
      { time: Date.now() - 120_000, open: 2.5e12, high: 2.55e12, low: 2.48e12, close: 2.52e12, volume: 0 },
    ];

    // 3a. SQLite cache segar (< 5 menit) wajib langsung mengembalikan hasil tanpa 1 pun request jaringan.
    const cacheHitCoordinator = new MacroBasketCoordinator({
      disableLocalStorage: true,
      loadSqliteCache: async () => freshCachedBars,
      fetchFn: async (url) => {
        requestedUrls.push(url);
        return makeJsonResponse({}, 500);
      },
    });
    const hitBars = await cacheHitCoordinator.getMacroCandles('TOTAL', '1D', 100);
    assert.equal(hitBars.length, 1);
    assert.equal(requestedUrls.length, 0, 'SQLite cache segar harus mencegah request jaringan');

    // 3b. Cold cache: CoinGecko kena 429, Binance gagal untuk ETH (failover ke Coinbase) -> masih memproduksi bar sah.
    let binanceCalls = 0;
    let coinbaseCalls = 0;
    const coldCoordinator = new MacroBasketCoordinator({
      disableLocalStorage: true,
      loadSqliteCache: async () => [],
      saveSqliteCache: async (symbol, timeframe, candles) => {
        savedWrites.push({ symbol, timeframe, count: candles.length });
      },
      fetchFn: async (url) => {
        if (url.includes('coingecko.com')) {
          return makeJsonResponse({ error: 'rate limit' }, 429);
        }
        if (url.includes('stablecoins.llama.fi/stablecoincharts/all')) {
          return makeJsonResponse([{ date: baseSec, totalCirculatingUSD: { peggedUSD: 200e9 } }]);
        }
        if (url.includes('stablecoins.llama.fi/stablecoin/1')) {
          return makeJsonResponse({ tokens: [{ date: baseSec, circulating: { peggedUSD: 135e9 } }] });
        }
        if (url.includes('api.binance.com/api/v3/klines')) {
          binanceCalls++;
          if (url.includes('symbol=ETHUSDT')) {
            return makeJsonResponse({ msg: 'blocked' }, 451);
          }
          // Kembalikan 2 bar untuk BTCUSDT dan koin fallback lain
          return makeJsonResponse([
            [baseSec * 1000, '60000', '62000', '59000', '61000', '100'],
            [(baseSec + 86400) * 1000, '61000', '63000', '60000', '62500', '120'],
          ]);
        }
        if (url.includes('api.exchange.coinbase.com/products/ETH-USD/candles')) {
          coinbaseCalls++;
          // Format Coinbase Exchange: descending [timeSec, low, high, open, close, volume]
          return makeJsonResponse([
            [baseSec + 86400, 2900, 3150, 2950, 3100, 50],
            [baseSec, 2800, 3000, 2850, 2950, 40],
          ]);
        }
        return makeJsonResponse({}, 404);
      },
    });

    const coldBars = await coldCoordinator.getMacroCandles('BTC.D', '1D', 50);
    assert.ok(coldBars.length >= 2, 'Harus menghasilkan bar meskipun CoinGecko 429 & ETH lewat Coinbase');
    assert.ok(binanceCalls > 0);
    assert.equal(coinbaseCalls, 1, 'ETH wajib failover tepat 1 kali ke Coinbase Exchange');
    // Tunggu microtask flush untuk penulisan SQLite cache asinkron.
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(
      savedWrites.some((w) => w.symbol === 'macro:BTC.D' && w.timeframe === '1D' && w.count >= 2),
      'Hasil sintesis cold start harus ditulis ke SQLite cache'
    );

    // 3c. Uji boundary pagination getBars pada MacroIndexProvider: scroll kiri melewati bar pertama -> [].
    const provider = new MacroIndexProvider({ coordinator: coldCoordinator });
    const allProviderBars = await provider.getBars('BTCD', '1D');
    assert.ok(allProviderBars.length >= 2);
    const outOfRangeOlder = await provider.getBars('BTCD', '1D', { to: allProviderBars[0].time - DAY_MS });
    assert.deepEqual(outOfRangeOlder, [], 'Scroll melampaui batas terlama wajib mengembalikan array kosong');
  });

  test('4. MacroIndexProvider.subscribe membatalkan timer dan AbortSignal in-flight saat unsubscribe', async () => {
    let abortObserved = false;
    let fetchStarted = false;
    const coordinator = new MacroBasketCoordinator({
      disableLocalStorage: true,
      fetchFn: async (_url, opts) => {
        fetchStarted = true;
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            abortObserved = true;
          });
        }
        await new Promise((r) => setTimeout(r, 80));
        return makeJsonResponse({}, 503);
      },
    });

    const provider = new MacroIndexProvider({ coordinator, pollIntervalMs: 10 });
    const unsub = provider.subscribe('TOTAL', '1D', () => {});
    assert.equal(provider.getActiveSubscriptionCount(), 1);

    // Tunggu polling aktif masuk ke request in-flight, lalu langsung unsubscribe.
    for (let i = 0; i < 20 && !fetchStarted; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.equal(fetchStarted, true, 'Polling aktif harus mulai melakukan fetch setelah interval');

    unsub();
    assert.equal(provider.getActiveSubscriptionCount(), 0);
    assert.equal(abortObserved, true, 'Unsubscribe chart wajib menggugurkan AbortSignal in-flight');
  });
});
