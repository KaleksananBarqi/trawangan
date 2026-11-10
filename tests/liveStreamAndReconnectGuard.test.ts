import test from 'node:test';
import assert from 'node:assert/strict';
import { universalFetch } from '../src/lib/services/httpClient';
import { BitunixProvider, getBitunixBarOpenMs } from '../src/lib/services/bitunixProvider';
import { IndodaxProvider } from '../src/lib/services/indodaxProvider';
import { YahooFinanceProvider } from '../src/lib/services/yahooFinanceProvider';
import { BitunixAdapter } from '../src/lib/services/market/adapters/bitunixAdapter';
import { MarketFeedService } from '../src/lib/services/market';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

type FakeWsMessageHandler = ((ev: { data: string }) => void) | null;
type FakeWsLifecycleHandler = (() => void) | null;

class MockWebSocket {
  public url: string;
  public readyState = 0; // CONNECTING
  public sentFrames: string[] = [];
  public onopen: FakeWsLifecycleHandler = null;
  public onmessage: FakeWsMessageHandler = null;
  public onclose: FakeWsLifecycleHandler = null;
  public onerror: ((err?: any) => void) | null = null;
  public closedCount = 0;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    this.sentFrames.push(data);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closedCount++;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(payload: any) {
    this.onmessage?.({
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  simulateDrop() {
    this.readyState = 3;
    this.onclose?.();
  }

  simulateError() {
    this.onerror?.(new Error('Simulated WS failure'));
  }
}

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

test.describe('Diagnosing Bugs #LiveFeed — Regression Suite', () => {
  test('1. universalFetch membatalkan request yang menggantung sesuai timeoutMs di lingkungan non-Tauri', async () => {
    await withMockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted.');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        }),
      async () => {
        const startedAt = Date.now();
        await assert.rejects(
          () => universalFetch('https://fapi.bitunix.com/api/v1/futures/market/kline?symbol=ETHUSDT', { timeoutMs: 80 }),
          (err: any) => err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '')
        );
        const elapsed = Date.now() - startedAt;
        assert.ok(elapsed < 400, `Harus timeout cepat (<400ms), aktual=${elapsed}ms`);
      }
    );
  });

  test('2. BitunixProvider.getBars menyertakan forming candle aktif dari ticker dan mendukung pagination > 200', async () => {
    // Tetapkan waktu deterministik: pukul 04:18:45.000Z pada interval 15m -> candle berjalan terbuka di 04:15:00Z,
    // sedangkan /kline REST Bitunix hanya mengembalikan candle yang sudah tutup (terbaru 04:00:00Z).
    const baseOpenMs = Date.UTC(2026, 10, 10, 4, 0, 0);
    const barMs = 15 * 60 * 1000;
    const currentOpenMs = baseOpenMs + barMs; // 04:15:00Z
    const fakeNow = currentOpenMs + 225_000; // 04:18:45Z

    const requestedUrls: string[] = [];

    await withMockFetch(async (url) => {
      requestedUrls.push(url);
      if (url.includes('/futures/market/kline')) {
        const parsed = new URL(url);
        const endTimeParam = parsed.searchParams.get('endTime');
        const limitParam = Number(parsed.searchParams.get('limit') || '200');
        assert.ok(limitParam <= 200, `Bitunix API max limit adalah 200, diminta=${limitParam}`);

        // Halaman 1 (tanpa endTime): 200 candle tutup dari terbaru baseOpenMs mundur
        if (!endTimeParam) {
          const data = Array.from({ length: 200 }, (_, idx) => {
            const t = baseOpenMs - idx * barMs;
            return {
              time: String(t),
              open: '2110.00',
              high: '2115.00',
              low: '2108.00',
              close: idx === 0 ? '2113.66' : '2112.00',
              baseVol: '100',
              quoteVol: '211000',
            };
          });
          return new Response(JSON.stringify({ code: 0, msg: 'Success', data }), { status: 200 });
        }

        // Halaman 2 (endTime = newestOldest - 1): 100 candle tambahan
        const endTimeNum = Number(endTimeParam);
        const data = Array.from({ length: 100 }, (_, idx) => {
          const t = endTimeNum + 1 - (idx + 1) * barMs;
          return {
            time: String(t),
            open: '2100.00',
            high: '2105.00',
            low: '2098.00',
            close: '2102.00',
            baseVol: '80',
            quoteVol: '168000',
          };
        });
        return new Response(JSON.stringify({ code: 0, msg: 'Success', data }), { status: 200 });
      }

      if (url.includes('/futures/market/tickers')) {
        return new Response(
          JSON.stringify({
            code: 0,
            msg: 'Success',
            data: [
              {
                symbol: 'ETHUSDT',
                lastPrice: '2117.45',
                markPrice: '2117.40',
                last: '2115.00',
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ code: 404 }), { status: 404 });
    }, async () => {
      const provider = new (BitunixProvider as any)({ now: () => fakeNow });
      const bars = await provider.getBars('ETHUSDT', '15m', { countBack: 250 });

      assert.ok(bars.length >= 250, `Harus mendukung pagination > 200 bar, aktual=${bars.length}`);
      // Terurut ascending
      for (let i = 1; i < bars.length; i++) {
        assert.ok(bars[i].time > bars[i - 1].time, 'Bar harus urut menaik tanpa duplikat');
      }

      const lastBar = bars[bars.length - 1];
      assert.equal(lastBar.time, currentOpenMs, 'Bar terakhir harus berada di periode candle yang sedang berjalan');
      assert.equal(lastBar.open, 2113.66, 'Open forming bar harus melanjutkan close bar penutup sebelumnya');
      assert.equal(lastBar.close, 2117.45, 'Close forming bar harus memakai lastPrice ticker');
      assert.ok(lastBar.time + barMs > fakeNow, 'Countdown timer bar aktif harus > 0');
      assert.ok(!requestedUrls.some((u) => u.includes('fapi.binance.com')), 'Tidak boleh fallback ke Binance saat Bitunix sehat');
    });
  });

  test('3. BitunixProvider.subscribe menggunakan WebSocket live, heartbeat ping, dan memisahkan rollover closing tick', async () => {
    const sockets: MockWebSocket[] = [];
    const baseOpenMs = Date.UTC(2026, 10, 10, 4, 13, 0);
    const nextOpenMs = baseOpenMs + 60_000; // 04:14:00Z
    let fakeNow = baseOpenMs + 58_000;

    const provider = new (BitunixProvider as any)({
      wsFactory: (url: string) => {
        const ws = new MockWebSocket(url);
        sockets.push(ws);
        return ws;
      },
      now: () => fakeNow,
      pingIntervalMs: 40,
      staleMs: 5000,
    });

    await withMockFetch(async () => new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 }), async () => {
      const emitted: any[] = [];
      const unsub = provider.subscribe('ETHUSDT', '1m', (bar: any) => emitted.push(bar));

      assert.equal(sockets.length, 1, 'BitunixProvider.subscribe harus membuka WebSocket ke fapi.bitunix.com');
      const ws = sockets[0];
      assert.match(ws.url, /^wss:\/\/fapi\.bitunix\.com/);

      ws.simulateOpen();
      const subFrame = ws.sentFrames.map((f) => JSON.parse(f)).find((f) => f.op === 'subscribe');
      assert.ok(subFrame, 'Harus mengirim payload subscribe saat WS terbuka');
      assert.equal(subFrame.args[0].symbol, 'ETHUSDT');
      assert.equal(subFrame.args[0].ch, 'market_kline_1min');

      // Tick normal di 04:13:58Z
      ws.simulateMessage({
        ch: 'market_kline_1min',
        symbol: 'ETHUSDT',
        ts: baseOpenMs + 58_000,
        data: { o: '2112.86', c: '2113.50', h: '2114.20', l: '2112.85', b: '105.012' },
      });
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].time, baseOpenMs);
      assert.equal(emitted[0].close, 2113.5);

      // Rollover pair pada ts=04:14:00.095Z persis perilaku live Bitunix
      fakeNow = nextOpenMs + 95;
      ws.simulateMessage({
        ch: 'market_kline_1min',
        symbol: 'ETHUSDT',
        ts: nextOpenMs + 95,
        data: { o: '2112.86', c: '2113.66', h: '2114.20', l: '2112.85', b: '105.452' },
      });
      ws.simulateMessage({
        ch: 'market_kline_1min',
        symbol: 'ETHUSDT',
        ts: nextOpenMs + 95,
        data: { o: '2113.66', c: '2113.66', h: '2113.66', l: '2113.66', b: '0' },
      });

      assert.equal(emitted.length, 3);
      assert.equal(emitted[1].time, baseOpenMs, 'Pesan closing tick rollover harus memperbarui candle 04:13');
      assert.equal(emitted[1].close, 2113.66);
      assert.equal(emitted[2].time, nextOpenMs, 'Pesan bar baru rollover harus membuka candle 04:14');
      assert.equal(emitted[2].open, 2113.66);

      // Tunggu heartbeat ping terkirim
      await delay(70);
      const pingFrame = ws.sentFrames.map((f) => JSON.parse(f)).find((f) => f.op === 'ping');
      assert.ok(pingFrame, 'Harus mengirim ping heartbeat ke Bitunix WS');

      unsub();
    });
  });

  test('4. BitunixProvider memulihkan stream macet (stale watchdog), fallback REST, reconnect backoff, dan melapor ke Feed Health Guard', async () => {
    const sockets: MockWebSocket[] = [];
    const healthEvents: Array<{ state: string; message?: string }> = [];
    const currentOpenMs = Date.UTC(2026, 10, 10, 4, 20, 0);
    let fakeNow = currentOpenMs + 10_000;
    let tickerCallCount = 0;

    const provider = new (BitunixProvider as any)({
      wsFactory: (url: string) => {
        const ws = new MockWebSocket(url);
        sockets.push(ws);
        return ws;
      },
      healthSink: {
        reportStreamState(_key: string, _providerId: string, state: string, message?: string) {
          healthEvents.push({ state, message });
        },
      },
      now: () => fakeNow,
      staleMs: 60,
      pingIntervalMs: 500,
      pongTimeoutMs: 50,
      pollFallbackMs: 40,
      baseBackoffMs: 35,
      maxBackoffMs: 120,
    });

    await withMockFetch(async (url) => {
      if (url.includes('/futures/market/kline')) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: [
              {
                time: String(currentOpenMs - 60_000),
                open: '2110.00',
                high: '2112.00',
                low: '2109.00',
                close: '2111.50',
                baseVol: '50',
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/futures/market/tickers')) {
        tickerCallCount++;
        return new Response(
          JSON.stringify({
            code: 0,
            data: [{ symbol: 'ETHUSDT', lastPrice: String(2112 + tickerCallCount * 0.1) }],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      const bars: any[] = [];
      const unsub = provider.subscribe('ETHUSDT', '1m', (b: any) => bars.push(b));

      // Socket #1 buka, kirim 1 bar, lalu diam membeku (silent half-open drop!)
      assert.equal(sockets.length, 1);
      sockets[0].simulateOpen();
      sockets[0].simulateMessage({
        ch: 'market_kline_1min',
        symbol: 'ETHUSDT',
        ts: fakeNow,
        data: { o: '2111.50', c: '2112.00', h: '2112.20', l: '2111.40', b: '10' },
      });

      // Maju waktu > staleMs dan tunggu watchdog bekerja tanpa pesan WS baru
      fakeNow += 200;
      await delay(140);

      assert.ok(sockets[0].closedCount >= 1, 'Socket macet wajib ditutup oleh watchdog');
      assert.ok(sockets.length >= 2, 'Watchdog + backoff wajib membuka koneksi WebSocket baru untuk reconnect');
      assert.ok(healthEvents.some((e) => e.state === 'stalled'), 'Stall harus dilaporkan ke Feed Connection Guard');
      assert.ok(tickerCallCount >= 1, 'Saat WS stall/drop harus menjalankan REST fallback/sync');

      // Saat socket #2 buka & mengirim bar baru, status pulih menjadi connected
      sockets[sockets.length - 1].simulateOpen();
      sockets[sockets.length - 1].simulateMessage({
        ch: 'market_kline_1min',
        symbol: 'ETHUSDT',
        ts: fakeNow + 500,
        data: { o: '2111.50', c: '2113.00', h: '2113.10', l: '2111.40', b: '22' },
      });

      assert.equal(healthEvents[healthEvents.length - 1]?.state, 'connected', 'Saat WS pulih, Guard harus kembali connected');
      unsub();
    });
  });

  test('5. IndodaxProvider & YahooFinanceProvider: guard anti-overlap, propagasi kegagalan network ke Guard, dan pemulihan otomatis', async () => {
    const indodaxStates: string[] = [];
    const yahooStates: string[] = [];

    let indodaxInFlight = 0;
    let maxIndodaxInFlight = 0;
    let failIndodax = true;

    await withMockFetch(async (url) => {
      if (url.includes('indodax.com')) {
        indodaxInFlight++;
        maxIndodaxInFlight = Math.max(maxIndodaxInFlight, indodaxInFlight);
        await delay(45);
        indodaxInFlight--;
        if (failIndodax) {
          return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
        }
        return new Response(
          JSON.stringify([
            { Time: Math.floor(Date.now() / 1000), Open: '1500', High: '1510', Low: '1495', Close: '1505', Volume: '12' },
          ]),
          { status: 200 }
        );
      }
      if (url.includes('yahoo.com')) {
        return new Response('Forbidden', { status: 503, statusText: 'Service Unavailable' });
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      const indodax = new (IndodaxProvider as any)({
        pollIntervalMs: 15,
        maxBackoffMs: 40,
        healthSink: {
          reportStreamState(_k: string, _p: string, state: string) {
            indodaxStates.push(state);
          },
        },
      });
      const yahoo = new (YahooFinanceProvider as any)({
        pollIntervalMs: 15,
        maxBackoffMs: 40,
        healthSink: {
          reportStreamState(_k: string, _p: string, state: string) {
            yahooStates.push(state);
          },
        },
      });

      const indodaxBars: any[] = [];
      const unsubI = indodax.subscribe('BTCIDR', '15m', (b: any) => indodaxBars.push(b));
      const unsubY = yahoo.subscribe('BBCA.JK', '1d', () => {});

      await delay(140);
      assert.equal(maxIndodaxInFlight, 1, 'Polling tidak boleh tumpang-tindih (in-flight guard)');
      assert.ok(indodaxStates.includes('stalled'), 'Kegagalan HTTP Indodax harus melapor stalled ke Guard');
      assert.ok(yahooStates.includes('stalled'), 'Kegagalan HTTP Yahoo harus melapor stalled ke Guard');

      // Pulihkan Indodax
      failIndodax = false;
      await delay(120);
      assert.ok(indodaxBars.length >= 1, 'Saat pulih, polling harus kembali mengirim bar');
      assert.equal(indodaxStates[indodaxStates.length - 1], 'connected', 'Guard Indodax harus kembali connected');

      unsubI();
      unsubY();
    });
  });

  test('6. BitunixAdapter.fetchCandles memakai endpoint resmi /kline dan tidak memanggil /tradingview/history (404)', async () => {
    const urls: string[] = [];
    const baseOpenMs = Date.UTC(2026, 10, 10, 4, 0, 0);

    await withMockFetch(async (url) => {
      urls.push(url);
      if (url.includes('/tradingview/history')) {
        return new Response(JSON.stringify({ code: 404, data: null, msg: 'Not Found' }), { status: 404 });
      }
      if (url.includes('/futures/market/kline')) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: [
              { time: String(baseOpenMs), open: '2110', high: '2114', low: '2109', close: '2113', baseVol: '100' },
              { time: String(baseOpenMs - 900_000), open: '2105', high: '2111', low: '2104', close: '2110', baseVol: '90' },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/futures/market/tickers')) {
        return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }, async () => {
      const adapter = new BitunixAdapter();
      const candles = await adapter.fetchCandles('ETHUSDT.P', '15m', 100);
      assert.ok(!urls.some((u) => u.includes('/tradingview/history')), 'Tidak boleh menembak endpoint 404 /tradingview/history');
      assert.ok(candles.length >= 2, 'Harus mengembalikan candle valid dari /futures/market/kline');
      assert.ok(candles[0].time < candles[1].time, 'Candle harus terurut ascending');
    });
  });

  test('7. MarketFeedService Guard mempertahankan status stall dari stream grafik meskipun watchlist ticker sukses', async () => {
    const feed = new MarketFeedService();
    await feed.setActiveProvider('bitunix');

    // Simulasikan stream grafik bitunix gagal
    (feed as any).reportStreamHealth('chart:bitunix:ETHUSDT:15m', 'bitunix', 'blocked', 'Stream candle ETHUSDT macet');
    assert.equal(feed.getConnectionStatus().state, 'blocked');

    // Simulasikan polling ticker/watchlist sukses
    feed.recordSuccess();
    assert.equal(
      feed.getConnectionStatus().state,
      'blocked',
      'recordSuccess() dari ticker REST tidak boleh menimpa status blocked milik stream candle aktif'
    );

    // Pulihkan stream grafik
    (feed as any).reportStreamHealth('chart:bitunix:ETHUSDT:15m', 'bitunix', 'connected');
    assert.equal(feed.getConnectionStatus().state, 'connected');

    feed.destroy();
  });

  test('8. ChartSessionController Stream Guard & reconnectLiveFeed memulihkan silent stream drop dan memicu healGap', async () => {
    let subscribeCalls = 0;
    let healGapCalls = 0;
    const unsubs: number[] = [];

    const mockFeed = new MarketFeedService();
    await mockFeed.setActiveProvider('binance');

    let activeSubCallback: ((bar: any) => void) | null = null;
    const fakeVelaProvider = {
      info: () => ({ name: 'binance', capabilities: { enumerate: true, stream: true, symbolInfo: true } }),
      async getBars() {
        return [{ time: Date.now(), open: 100, high: 101, low: 99, close: 100.5, volume: 10 }];
      },
      subscribe(_ticker: string, _tf: string, onBar: (bar: any) => void) {
        const callId = ++subscribeCalls;
        activeSubCallback = onBar;
        return () => {
          unsubs.push(callId);
        };
      },
    };

    let registeredProviders: Record<string, () => any> = {};
    let wsUnsubCount = 0;

    const fakeWorkspace = {
      active: {
        id: 'cell_1',
        symbol: 'binance:BTCUSDT',
        timeframe: '15',
        chart: {
          orchestrator: {
            bars: [{ time: Date.now() - 60_000, open: 99, high: 100, low: 98, close: 100 }],
            canHeal: () => true,
            async healGap() {
              healGapCalls++;
            },
          },
        },
      },
      cells: () => [fakeWorkspace.active],
      on: () => {},
      destroy: () => {
        wsUnsubCount++;
      },
    };

    const controller = new (ChartSessionController as any)({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      feedHealthSink: mockFeed,
      streamWatchdogMs: 35,
      streamStaleMs: 50,
      providerFactories: {
        binance: () => fakeVelaProvider,
      },
      workspaceFactory: (_container: any, cfg: any) => {
        registeredProviders = cfg.providers;
        return fakeWorkspace;
      },
    });

    const mockContainer: any = {
      nodeType: 1,
      style: {},
      children: [],
      querySelectorAll: () => [],
    };
    controller.attach(mockContainer);

    assert.ok(registeredProviders.binance, 'Provider binance harus terdaftar di workspace config');
    const wrappedBinance = registeredProviders.binance();

    const receivedBars: any[] = [];
    const subUnsub = wrappedBinance.subscribe('BTCUSDT', '15', (b: any) => receivedBars.push(b));
    assert.equal(subscribeCalls, 1);

    // Simulasikan silence > streamStaleMs -> watchdog harus unsubscribe & resubscribe + sync bar + lapor guard
    await delay(110);
    assert.ok(unsubs.includes(1), 'StreamGuard harus menutup subscription WS yang diam membeku');
    assert.ok(subscribeCalls >= 2, 'StreamGuard harus membuka ulang subscription secara otomatis');
    assert.ok(receivedBars.length >= 1, 'StreamGuard harus melakukan sync bar via getBars');

    // Simulasikan manual reconnect (mis. tombol "Coba Ulang" atau event online)
    await controller.reconnectLiveFeed();
    assert.ok(healGapCalls >= 1, 'reconnectLiveFeed wajib memicu healGap pada orchestrator Vela');
    assert.ok(subscribeCalls >= 3, 'reconnectLiveFeed wajib me-reconnect stream subscription');

    subUnsub();
    controller.destroy();
    mockFeed.destroy();
    assert.equal(wsUnsubCount, 1);
  });

  test('9. Penyelarasan waktu Bitunix 1w/1M UTC & event window online auto-reconnect', async () => {
    // 2026-11-10 adalah hari Selasa UTC; awal minggu Bitunix wajib jatuh pada Senin 2026-11-09 00:00Z
    const tuesdayMs = Date.UTC(2026, 10, 10, 14, 30, 0);
    assert.equal(
      getBitunixBarOpenMs(tuesdayMs, '1w'),
      Date.UTC(2026, 10, 9, 0, 0, 0),
      'Bar open mingguan Bitunix wajib jatuh pada Senin 00:00 UTC'
    );
    assert.equal(
      getBitunixBarOpenMs(tuesdayMs, '1M'),
      Date.UTC(2026, 10, 1, 0, 0, 0),
      'Bar open bulanan Bitunix wajib jatuh pada tanggal 1 pukul 00:00 UTC'
    );

    // Uji auto-reconnect ketika event browser 'online' terpicu
    const prevWindow = (globalThis as any).window;
    const windowListeners = new Map<string, Set<Function>>();
    (globalThis as any).window = {
      addEventListener: (ev: string, fn: Function) => {
        if (!windowListeners.has(ev)) windowListeners.set(ev, new Set());
        windowListeners.get(ev)!.add(fn);
      },
      removeEventListener: (ev: string, fn: Function) => {
        windowListeners.get(ev)?.delete(fn);
      },
    };

    try {
      let subscribeCalls = 0;
      let healGapCalls = 0;
      const fakeProvider = {
        info: () => ({ name: 'binance', capabilities: { enumerate: true, stream: true, symbolInfo: true } }),
        async getBars() {
          return [];
        },
        subscribe() {
          subscribeCalls++;
          return () => {};
        },
      };
      const fakeWs = {
        active: {
          id: 'cell_1',
          symbol: 'binance:BTCUSDT',
          timeframe: '15',
          chart: {
            orchestrator: {
              bars: [{ time: Date.now() - 60_000, open: 1, high: 1, low: 1, close: 1 }],
              canHeal: () => true,
              async healGap() {
                healGapCalls++;
              },
            },
          },
        },
        cells: () => [fakeWs.active],
        on: () => {},
        destroy: () => {},
      };

      let regProviders: Record<string, () => any> = {};
      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        providerId: 'binance',
        providerFactories: { binance: () => fakeProvider },
        workspaceFactory: (_c, cfg) => {
          regProviders = cfg.providers;
          return fakeWs;
        },
      });
      const mockContainer: any = { nodeType: 1, style: {}, children: [], querySelectorAll: () => [] };
      controller.attach(mockContainer);
      const unsub = regProviders.binance().subscribe('BTCUSDT', '15', () => {});
      assert.equal(subscribeCalls, 1);

      const onlineHandlers = windowListeners.get('online');
      assert.ok(onlineHandlers && onlineHandlers.size > 0, 'Harus mendaftarkan listener window online');
      for (const fn of onlineHandlers) fn();
      await delay(30);

      assert.ok(subscribeCalls >= 2, 'Event window online harus menyambung ulang stream aktif');
      assert.ok(healGapCalls >= 1, 'Event window online harus memanggil healGap');

      unsub();
      controller.destroy();
      assert.equal(windowListeners.get('online')?.size ?? 0, 0, 'Listener window online harus dilepas saat destroy');
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });
});
