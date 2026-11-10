import test from 'node:test';
import assert from 'node:assert/strict';
import { universalFetch } from '../src/lib/services/httpClient';
import { BinanceAdapter } from '../src/lib/services/market/adapters/binanceAdapter';
import { BitunixProvider, normalizeBitunixSymbol } from '../src/lib/services/bitunixProvider';
import { resolveVelaSymbolKey } from '../src/lib/services/instrumentIdentity';
import { MarketFeedService } from '../src/lib/services/market';
import { TelemetryService } from '../src/lib/services/telemetryService';
import { StreamGuardCoordinator, wrapProviderWithStreamGuard } from '../src/lib/services/streamHealthGuard';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { HyperliquidAdapter } from '../src/lib/services/market/adapters/hyperliquidAdapter';
import { CoinbaseAdapter } from '../src/lib/services/market/adapters/coinbaseAdapter';
import { CustomFeedProvider } from '../src/lib/services/customProvider';
import { CustomFeedAdapter } from '../src/lib/services/market/adapters/customAdapter';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withMockFetch<T>(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<T>
): Promise<T> {
  const prevFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  }) as typeof fetch;

  return fn().finally(() => {
    globalThis.fetch = prevFetch;
  });
}

test.describe('Phase 2 Hardening — Semua Datafeed, Pair Normalization, & Illiquid Guard', () => {
  test('1. universalFetch mendukung POST + body JSON dan timeoutMs untuk POST', async () => {
    const calls: Array<{ url: string; method?: string; body?: any }> = [];

    await withMockFetch(async (url, init) => {
      calls.push({ url, method: init?.method, body: init?.body });
      if (url.includes('slow-post')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted.');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }, async () => {
      const res = await (universalFetch as any)('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
        timeoutMs: 1000,
      });
      assert.equal(res.ok, true);
      assert.deepEqual(await res.json(), { ok: true });
      assert.equal(calls[0].method, 'POST');
      assert.equal(calls[0].body, JSON.stringify({ type: 'allMids' }));

      await assert.rejects(
        () =>
          (universalFetch as any)('https://api.hyperliquid.xyz/info?slow-post=1', {
            method: 'POST',
            body: '{}',
            timeoutMs: 60,
          }),
        (err: any) => err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '')
      );
    });
  });

  test('2. BinanceAdapter: .P perp klines mengarah ke fapi.binance.com tanpa sufiks .P dan mematuhi timeout', async () => {
    const requestedUrls: string[] = [];

    await withMockFetch(async (url, init) => {
      requestedUrls.push(url);
      if (url.includes('hang-timeout')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
      if (url.startsWith('https://fapi.binance.com/fapi/v1/klines')) {
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get('symbol'), 'BTCUSDT', 'Sufiks .P harus dihapus saat memanggil fapi.binance.com');
        return new Response(
          JSON.stringify([
            [1700000000000, '60000', '60500', '59800', '60200', '123.4'],
          ]),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.binance.com/api/v3/klines')) {
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get('symbol'), 'ETHUSDT');
        return new Response(
          JSON.stringify([
            [1700000000000, '3000', '3050', '2980', '3020', '456.7'],
          ]),
          { status: 200 }
        );
      }
      if (url.includes('/ticker/24hr')) {
        return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      const adapter = new BinanceAdapter();
      const perpCandles = await adapter.fetchCandles('binance:BTCUSDT.P', '15m', 10);
      assert.equal(perpCandles.length, 1);
      assert.equal(perpCandles[0].close, 60200);
      assert.ok(
        requestedUrls.some((u) => u.startsWith('https://fapi.binance.com/fapi/v1/klines') && u.includes('symbol=BTCUSDT&')),
        'Kontrak .P harus diarahkan ke fapi.binance.com dengan simbol bersih tanpa .P'
      );
      assert.ok(
        !requestedUrls.some((u) => u.includes('symbol=BTCUSDT.P')),
        'Tidak boleh mengirim BTCUSDT.P ke REST API Binance'
      );

      const spotCandles = await adapter.fetchCandles('ETH/USDT', '1h', 10);
      assert.equal(spotCandles.length, 1);
      assert.equal(spotCandles[0].close, 3020);

      // Total error pada batch tickers wajib melemparkan exception ke pollTick / pemanggil
      await assert.rejects(() => adapter.fetchBatchTickers(['BTCUSDT.P']));

      // Timeout via adapter constructor option
      const fastTimeoutAdapter = new (BinanceAdapter as any)({ timeoutMs: 50 });
      await assert.rejects(() => fastTimeoutAdapter.fetchCandles('HANG-TIMEOUT', '15m', 5));
    });
  });

  test('3. HyperliquidAdapter & CoinbaseAdapter: parsing batch tickers, candles, dan propagasi error', async () => {
    await withMockFetch(async (url, init) => {
      if (url === 'https://api.hyperliquid.xyz/info') {
        const payload = JSON.parse(String(init?.body || '{}'));
        if (payload.type === 'metaAndAssetCtxs') {
          return new Response(
            JSON.stringify([
              { universe: [{ name: 'BTC' }, { name: 'ETH' }] },
              [
                { markPx: '90500', prevDayPx: '89000', dayNtlVlm: '150000000' },
                { markPx: '3200', prevDayPx: '3100', dayNtlVlm: '75000000' },
              ],
            ]),
            { status: 200 }
          );
        }
        if (payload.type === 'spotMetaAndAssetCtxs') {
          return new Response(
            JSON.stringify([
              { universe: [{ name: 'PURR/USDC', tokens: [0, 1] }], tokens: [{ name: 'PURR' }, { name: 'USDC' }] },
              [{ coin: 'PURR/USDC', markPx: '0.25', prevDayPx: '0.20', dayNtlVlm: '500000' }],
            ]),
            { status: 200 }
          );
        }
        if (payload.type === 'candleSnapshot') {
          assert.equal(payload.req.coin, 'PURR/USDC', 'Spot pair Hyperliquid ber-slash tidak boleh dipotong');
          return new Response(
            JSON.stringify([
              { t: 1700000900000, o: '0.24', h: '0.26', l: '0.23', c: '0.25', v: '1200' },
              { t: 1700000000000, o: '0.22', h: '0.25', l: '0.21', c: '0.24', v: '1000' },
            ]),
            { status: 200 }
          );
        }
      }

      if (url.startsWith('https://api.exchange.coinbase.com/products/ETH-BTC/stats')) {
        return new Response(
          JSON.stringify({ open: '0.0350', high: '0.0365', low: '0.0345', last: '0.0360', volume: '5400' }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.exchange.coinbase.com/products/ETH-BTC/ticker')) {
        return new Response(
          JSON.stringify({ price: '0.0362', volume: '5400' }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.exchange.coinbase.com/products/BTC-USD/candles')) {
        // Format Coinbase Exchange: [timeSec, low, high, open, close, volume] (terurut terbaru dulu)
        return new Response(
          JSON.stringify([
            [1700000900, 89900, 90600, 90100, 90500, 45.2],
            [1700000000, 89500, 90200, 89700, 90100, 38.1],
          ]),
          { status: 200 }
        );
      }
      return new Response('Upstream error', { status: 500 });
    }, async () => {
      const hl = new HyperliquidAdapter();
      assert.equal(hl.id, 'hyperliquid');
      const hlBatch = await hl.fetchBatchTickers(['BTCUSDT', 'PURR/USDC']);
      assert.equal(hlBatch['BTCUSDT'].price, 90500);
      assert.equal(hlBatch['PURR/USDC'].price, 0.25);

      const hlCandles = await hl.fetchCandles('PURR/USDC', '15m', 20);
      assert.equal(hlCandles.length, 2);
      assert.ok(hlCandles[0].time < hlCandles[1].time, 'Candle Hyperliquid harus terurut ascending');
      assert.equal(hlCandles[1].close, 0.25);

      const cb = new CoinbaseAdapter();
      assert.equal(cb.id, 'coinbase');
      const cbBatch = await cb.fetchBatchTickers(['ETH/BTC']);
      assert.equal(cbBatch['ETH/BTC'].price, 0.0362);
      assert.ok(cbBatch['ETH/BTC'].change24h > 0);

      const cbCandles = await cb.fetchCandles('BTCUSDT.P', '15m', 20);
      assert.equal(cbCandles.length, 2);
      assert.equal(cbCandles[0].time, 1700000000000, 'Timestamp detik Coinbase harus dikonversi ke ms & urut naik');
      assert.equal(cbCandles[0].low, 89500);
      assert.equal(cbCandles[0].high, 90200);
      assert.equal(cbCandles[0].open, 89700);
      assert.equal(cbCandles[0].close, 90100);
    });
  });

  test('4. MarketFeedService mendaftarkan Hyperliquid & Coinbase, adapter custom-*, dan direct reader menghormati prefix', async () => {
    const requestedUrls: string[] = [];

    await withMockFetch(async (url) => {
      requestedUrls.push(url);
      if (url === 'https://api.hyperliquid.xyz/info') {
        return new Response(
          JSON.stringify([
            { universe: [{ name: 'SOL' }] },
            [{ markPx: '185.5', prevDayPx: '180.0', dayNtlVlm: '12000000' }],
          ]),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.exchange.coinbase.com/products/BTC-USD/')) {
        return new Response(
          JSON.stringify({ price: '91234', open: '90000', high: '92000', low: '89500', last: '91234', volume: '999' }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://fapi.bitunix.com/api/v1/futures/market/kline')) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: [{ time: String(Date.now() - 60_000), open: '2100', high: '2110', low: '2095', close: '2105', baseVol: '20' }],
          }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://fapi.bitunix.com/api/v1/futures/market/tickers')) {
        return new Response(JSON.stringify({ code: 0, data: [{ symbol: 'ETHUSDT', lastPrice: '2108' }] }), { status: 200 });
      }
      if (url.startsWith('https://relay.example.com/klines')) {
        return new Response(
          JSON.stringify([
            [1700000000, 100, 105, 99, 104, 50],
            [1700000900, 104, 108, 102, 107, 65],
          ]),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      const feed = new MarketFeedService();
      assert.equal(feed.getAdapter('hyperliquid').id, 'hyperliquid');
      assert.equal(feed.getAdapter('coinbase').id, 'coinbase');

      // Saat activeProvider masih binance, direct reader ber-prefix wajib mengarah ke adapter yang benar
      const bitunixCandles = await feed.getCandles('bitunix:ETHUSDT', '15m', 10);
      assert.ok(bitunixCandles.length >= 1);
      assert.ok(requestedUrls.some((u) => u.includes('fapi.bitunix.com/api/v1/futures/market/kline')));

      const watchlistBatch = await feed.getWatchlistTickers(['hyperliquid:SOLUSDT', 'coinbase:BTC-USD']);
      assert.equal(watchlistBatch['hyperliquid:SOLUSDT'].price, 185.5);
      assert.equal(watchlistBatch['coinbase:BTC-USD'].price, 91234);

      // Simpan & aktifkan custom node -> otomatis tersambung ke CustomFeedAdapter
      await feed.saveProviderConfig({
        id: 'custom-999',
        name: 'My Relay Node',
        rest_url: 'https://relay.example.com',
        ws_url: '',
        is_active: true,
      });
      assert.equal(feed.getAdapter('custom-999').id, 'custom-999');
      const customCandles = await feed.getCandles('BTCUSDT', '15m', 10);
      assert.equal(customCandles.length, 2);
      assert.equal(customCandles[0].time, 1700000000000);
      assert.equal(customCandles[1].close, 107);

      const customTicker = await feed.getTicker('BTCUSDT');
      assert.equal(customTicker.price, 107);

      feed.destroy();
    });
  });

  test('5. TelemetryService menembak endpoint ping asli untuk hyperliquid, coinbase, dan yahoo + nama Yahoo Finance', async () => {
    const pingRequests: Array<{ url: string; method?: string; body?: any }> = [];
    const telemetry = new TelemetryService();

    await withMockFetch(async (url, init) => {
      pingRequests.push({ url, method: init?.method, body: init?.body });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }, async () => {
      telemetry.setActiveProvider('hyperliquid');
      await telemetry.measurePing();
      assert.equal(pingRequests[0].url, 'https://api.hyperliquid.xyz/info');
      assert.equal(pingRequests[0].method, 'POST');
      assert.equal(pingRequests[0].body, '{"type":"allMids"}');

      telemetry.setActiveProvider('coinbase');
      await telemetry.measurePing();
      assert.equal(pingRequests[1].url, 'https://api.exchange.coinbase.com/time');

      telemetry.setActiveProvider('yahoo');
      assert.equal(telemetry.getSnapshot().providerName, 'Yahoo Finance');
      await telemetry.measurePing();
      assert.ok(pingRequests[2].url.includes('query1.finance.yahoo.com/v8/finance/chart/GC=F'));
    });

    telemetry.stop();
  });

  test('6. Normalisasi simbol & key Vela menjaga delimiter khusus Coinbase/Hyperliquid dan membersihkan Bitunix', () => {
    // Bitunix
    assert.equal(normalizeBitunixSymbol('ETH/USDT'), 'ETHUSDT');
    assert.equal(normalizeBitunixSymbol('eth-usdt.p'), 'ETHUSDT');
    assert.equal(normalizeBitunixSymbol('bitunix:sol_usdt'), 'SOLUSDT');

    assert.equal(resolveVelaSymbolKey('ETH/USDT', 'bitunix'), 'bitunix:ETHUSDT');
    assert.equal(resolveVelaSymbolKey('btcusdt.p', 'bitunix'), 'bitunix:BTCUSDT.P');
    assert.equal(resolveVelaSymbolKey('BTC/USDT', 'binance'), 'binance:BTCUSDT');

    // Coinbase: pertahankan pair eksplisit non-USD & ubah slash -> hyphen
    assert.equal(resolveVelaSymbolKey('ETH-BTC', 'coinbase'), 'coinbase:ETH-BTC');
    assert.equal(resolveVelaSymbolKey('ETH/BTC', 'coinbase'), 'coinbase:ETH-BTC');
    assert.equal(resolveVelaSymbolKey('BTCUSD', 'coinbase'), 'coinbase:BTC-USD');
    assert.equal(resolveVelaSymbolKey('BTCUSDT.P', 'coinbase'), 'coinbase:BTC-USD');

    // Hyperliquid: pertahankan spot pair ber-slash & pertahankan perp coin tunggal
    assert.equal(resolveVelaSymbolKey('PURR/USDC', 'hyperliquid'), 'hyperliquid:PURR/USDC');
    assert.equal(resolveVelaSymbolKey('BTCUSDT', 'hyperliquid'), 'hyperliquid:BTC');

    // Custom-* harus dinormalisasi agar kompatibel dengan regex Vela ProviderRegistry ([A-Za-z0-9_.]+)
    assert.equal(resolveVelaSymbolKey('BTCUSDT', 'custom-12345'), 'custom_12345:BTCUSDT');
  });

  test('7. wrapProviderWithStreamGuard: bedakan pair sepi likuiditas (REST sehat) vs fail-soft error []/throw', async () => {
    const statesQuiet: string[] = [];
    const coordQuiet = new StreamGuardCoordinator({
      reportStreamState(_k, _p, state) {
        statesQuiet.push(state);
      },
    });

    // Kasus A: Pair sepi — WS tidak kirim bar, namun getBars sukses mengembalikan candle valid terbaru
    let quietSubCount = 0;
    const quietProvider = wrapProviderWithStreamGuard(
      {
        async getBars(_ticker: string, _timeframe: string, _opts?: any) {
          return [{ time: Date.now(), open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 10 }];
        },
        subscribe(_ticker: string, _timeframe: string, _onBar: (bar: any) => void, _opts?: any) {
          quietSubCount++;
          return () => {};
        },
      },
      'binance',
      coordQuiet,
      { watchdogCheckMs: 25, staleStreamMs: 35, minResubscribeGapMs: 35 }
    );

    const unsubQuiet = quietProvider.subscribe('RAREUSDT', '15', () => {});
    await delay(180); // Cukup untuk 3+ siklus watchdog
    assert.ok(quietSubCount >= 2, 'Watchdog tetap wajib menyambung ulang WS secara berkala saat stream diam');
    assert.ok(!statesQuiet.includes('blocked'), 'Pair sepi dengan REST sehat tidak boleh memicu false-alarm blocked');
    assert.ok(!statesQuiet.includes('stalled'), 'Pair sepi dengan tail REST sukses tidak boleh memicu flash stalled');
    unsubQuiet();
    coordQuiet.clear();

    // Kasus B: Koneksi terblokir pada provider bawaan Vela (getBars fail-soft mengembalikan [])
    const statesFailSoft: string[] = [];
    const coordFail = new StreamGuardCoordinator({
      reportStreamState(_k, _p, state) {
        statesFailSoft.push(state);
      },
    });

    const brokenProvider = wrapProviderWithStreamGuard(
      {
        async getBars(_ticker: string, _timeframe: string, _opts?: any) {
          return []; // Perilaku fail-soft BinanceProvider/HyperliquidProvider/CoinbaseProvider saat fetch gagal
        },
        subscribe(_ticker: string, _timeframe: string, _onBar: (bar: any) => void, _opts?: any) {
          return () => {};
        },
      },
      'binance',
      coordFail,
      { watchdogCheckMs: 25, staleStreamMs: 35, minResubscribeGapMs: 35 }
    );

    const unsubBroken = brokenProvider.subscribe('BTCUSDT', '15', () => {});
    await delay(180);
    assert.ok(statesFailSoft.includes('stalled'), 'Kegagalan fail-soft [] harus terdeteksi sebagai stalled');
    assert.ok(statesFailSoft.includes('blocked'), 'Kegagalan fail-soft [] berulang >= 3 kali wajib naik menjadi blocked');
    unsubBroken();
    coordFail.clear();
  });

  test('8. CustomFeedProvider & ChartSessionController: mendukung format object array, polling guard, dan custom-* di chart', async () => {
    const feed = new MarketFeedService();
    await feed.saveProviderConfig({
      id: 'custom-777',
      name: 'Object Node',
      rest_url: 'https://obj-node.example.com',
      ws_url: '',
      is_active: true,
    });

    await withMockFetch(async (url) => {
      if (url.startsWith('https://obj-node.example.com/klines')) {
        return new Response(
          JSON.stringify([
            { time: 1700000000, open: '50', high: '55', low: '49', close: '52', volume: '10' },
          ]),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      // Uji langsung CustomFeedProvider
      const customProv = new CustomFeedProvider({
        providerId: 'custom-777',
        restUrl: 'https://obj-node.example.com',
        pollIntervalMs: 25,
      });
      const bars = await customProv.getBars('BTCUSDT', '15', { countBack: 5 });
      assert.equal(bars.length, 1);
      assert.equal(bars[0].time, 1700000000000);
      assert.equal(bars[0].close, 52);

      // Uji polling & reconnectAll
      const streamed: any[] = [];
      const unsub = customProv.subscribe('BTCUSDT', '15', (b) => streamed.push(b));
      await delay(65);
      assert.ok(streamed.length >= 1, 'CustomFeedProvider polling fallback harus mengirim bar');
      unsub();

      // Uji registrasi di ChartSessionController saat attached dengan provider custom-*
      let registeredProviders: Record<string, () => any> = {};
      const fakeWs: any = {
        active: { id: 'c1', symbol: 'custom_777:BTCUSDT', setSymbol(s: string) { this.symbol = s; }, chart: {} },
        cells: () => [fakeWs.active],
        on: () => {},
        destroy: () => {},
      };
      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        providerId: 'custom-777',
        feedHealthSink: feed,
        workspaceFactory: (_el, cfg) => {
          registeredProviders = cfg.providers;
          return fakeWs;
        },
      });
      const mockContainer: any = { nodeType: 1, style: {}, children: [], querySelectorAll: () => [] };
      controller.attach(mockContainer);

      assert.ok(
        registeredProviders['custom_777'],
        'ChartSessionController harus mendaftarkan custom provider (kunci Vela custom_777)'
      );
      const customVelaInstance = registeredProviders['custom_777']();
      const velaBars = await customVelaInstance.getBars('BTCUSDT', '15', { limit: 1 });
      assert.equal(velaBars.length, 1);
      assert.equal(velaBars[0].close, 52);

      // Uji CustomFeedAdapter langsung
      const customAdapter = new CustomFeedAdapter({
        id: 'custom-777',
        name: 'Object Node',
        rest_url: 'https://obj-node.example.com',
        ws_url: '',
        is_active: true,
      });
      const adapterCandles = await customAdapter.fetchCandles('BTCUSDT', '15m', 5);
      assert.equal(adapterCandles.length, 1);

      controller.destroy();
    });

    await feed.deleteProvider('custom-777');
    feed.destroy();
  });
});
