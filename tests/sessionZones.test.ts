import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  SESSION_PRE,
  SESSION_POST,
  SESSION_OFF,
  type MarketSession,
  isSessionSupported,
  getSymbolSessionSpec,
  expandSessionZones,
  createSessionRendererConfig,
  marketSessionService,
} from '../src/lib/services/marketSessionService';

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

describe('Tiket #205: Session Zones & Extended Hours Shading Suite', () => {
  describe('1. Token Warna Tematik & Tipe Sesi Pasar', () => {
    test('Token warna tematik sesi pasar sesuai spesifikasi Vela WebGL2', () => {
      // Spesifikasi: SESSION_PRE = "#f97316" (Amber), SESSION_POST = "#0ea5e9" (Biru), SESSION_OFF = "#9ca3af" (Abu-abu)
      assert.strictEqual(SESSION_PRE, '#f97316', 'SESSION_PRE wajib berupa warna amber #f97316');
      assert.strictEqual(SESSION_POST, '#0ea5e9', 'SESSION_POST wajib berupa warna biru #0ea5e9');
      assert.strictEqual(SESSION_OFF, '#9ca3af', 'SESSION_OFF wajib berupa warna slate #9ca3af');
    });

    test('createSessionRendererConfig mengembalikan konfigurasi warna WebGL2 sessions yang valid', () => {
      const cfg = createSessionRendererConfig();
      assert.ok(cfg.sessions, 'Konfigurasi wajib memiliki field sessions');
      assert.strictEqual(cfg.sessions.premarketColor, SESSION_PRE);
      assert.strictEqual(cfg.sessions.postmarketColor, SESSION_POST);
      assert.strictEqual(cfg.sessions.extendedColor, SESSION_POST);
    });
  });

  describe('2. Deteksi Dukungan Sesi Pasar (Gating Venue & Simbol)', () => {
    test('Pasar ekuitas & indeks US Yahoo Finance mendukung session zones', () => {
      assert.strictEqual(isSessionSupported('AAPL', 'yahoo'), true);
      assert.strictEqual(isSessionSupported('TSLA', 'yahoo'), true);
      assert.strictEqual(isSessionSupported('SPY', 'yahoo'), true);
      assert.strictEqual(isSessionSupported('^GSPC', 'yahoo'), true);
      assert.strictEqual(isSessionSupported('^IXIC', 'yahoo'), true);
      assert.strictEqual(isSessionSupported('yahoo:AAPL', 'yahoo'), true);
    });

    test('Feed kripto continuous 24/7 (Binance, Indodax, Bitunix, Coinbase) menolak session zones secara aman', () => {
      assert.strictEqual(isSessionSupported('BTCUSDT', 'binance'), false);
      assert.strictEqual(isSessionSupported('ETHUSDT', 'binance'), false);
      assert.strictEqual(isSessionSupported('BTCIDR', 'indodax'), false);
      assert.strictEqual(isSessionSupported('BTCUSDT.P', 'bitunix'), false);
      assert.strictEqual(isSessionSupported('BTC-USD', 'coinbase'), false);
      assert.strictEqual(isSessionSupported('BTC-USD', 'custom'), false);
    });

    test('getSymbolSessionSpec mengembalikan spesifikasi jam bursa New York untuk saham US', () => {
      const spec = getSymbolSessionSpec('AAPL', 'yahoo');
      assert.ok(spec, 'Spesifikasi sesi AAPL tidak boleh null');
      assert.strictEqual(spec.timezone, 'America/New_York');
      assert.strictEqual(spec.overnight, false);
      // RTH 09:30-16:00 (570 s/d 960 menit dari tengah malam)
      assert.strictEqual(spec.regular.start, 570);
      assert.strictEqual(spec.regular.end, 960);
      // ETH 04:00-20:00 (240 s/d 1200 menit dari tengah malam)
      assert.strictEqual(spec.extended.start, 240);
      assert.strictEqual(spec.extended.end, 1200);
    });

    test('getSymbolSessionSpec mengembalikan null untuk instrumen kripto 24/7', () => {
      assert.strictEqual(getSymbolSessionSpec('BTCUSDT', 'binance'), null);
      assert.strictEqual(getSymbolSessionSpec('BTCIDR', 'indodax'), null);
    });
  });

  describe('3. Kalkulasi Zona Shading expandSessionZones', () => {
    test('expandSessionZones menghasilkan rentang pre-market dan post-market pada hari kerja', () => {
      const spec = getSymbolSessionSpec('AAPL', 'yahoo')!;
      // Rabu 12 November 2026 00:00 UTC sampai Kamis 13 November 2026 23:59 UTC
      const from = Date.UTC(2026, 10, 11, 0, 0, 0);
      const to = Date.UTC(2026, 10, 13, 23, 59, 59);

      const zones = expandSessionZones(spec, from, to);
      assert.ok(Array.isArray(zones.pre), 'pre zones harus berupa array');
      assert.ok(Array.isArray(zones.post), 'post zones harus berupa array');
      assert.ok(zones.pre.length > 0, 'Harus ada pita pre-market yang terhitung');
      assert.ok(zones.post.length > 0, 'Harus ada pita post-market yang terhitung');

      // Validasi setiap pita memiliki [from, to] dengan to > from
      for (const [s, e] of zones.pre) {
        assert.ok(e > s, `Batas pre-market harus valid (${s} < ${e})`);
      }
      for (const [s, e] of zones.post) {
        assert.ok(e > s, `Batas post-market harus valid (${s} < ${e})`);
      }
    });

    test('expandSessionZones mengabaikan akhir pekan (Sabtu dan Minggu non-overnight)', () => {
      const spec = getSymbolSessionSpec('AAPL', 'yahoo')!;
      // Sabtu 14 November 2026 12:00 UTC s/d Minggu 15 November 2026 20:00 UTC (Sabtu-Minggu siang di NY)
      const from = Date.UTC(2026, 10, 14, 12, 0, 0);
      const to = Date.UTC(2026, 10, 15, 20, 0, 0);

      const zones = expandSessionZones(spec, from, to);
      assert.strictEqual(zones.pre.length, 0, 'Tidak boleh ada pre-market di akhir pekan');
      assert.strictEqual(zones.post.length, 0, 'Tidak boleh ada post-market di akhir pekan');
    });
  });

  describe('4. Lifecycle State Service marketSessionService', () => {
    test('Default session adalah "regular" dan sessionAvailable bernilai boolean', () => {
      marketSessionService.reset();
      assert.strictEqual(marketSessionService.getSession(), 'regular');
      assert.strictEqual(marketSessionService.isSessionAvailable(), false);
    });

    test('setSession dan toggleSession memperbarui status dan memicu subscriber', () => {
      marketSessionService.reset();
      marketSessionService.setSessionAvailable(true);

      let notifiedState: any = null;
      const unsub = marketSessionService.subscribe((st) => {
        notifiedState = st;
      });

      marketSessionService.setSession('extended');
      assert.strictEqual(marketSessionService.getSession(), 'extended');
      assert.strictEqual(notifiedState?.session, 'extended');

      // toggleSession membalik 'extended' -> 'regular'
      const toggled = marketSessionService.toggleSession();
      assert.strictEqual(toggled, 'regular');
      assert.strictEqual(marketSessionService.getSession(), 'regular');
      assert.strictEqual(notifiedState?.session, 'regular');

      // toggleSession membalik 'regular' -> 'extended'
      const toggled2 = marketSessionService.toggleSession();
      assert.strictEqual(toggled2, 'extended');
      assert.strictEqual(marketSessionService.getSession(), 'extended');

      unsub();
    });
  });

  describe('5. YahooFinanceProvider Session Integration', () => {
    test('getSymbolInfo mengembalikan spesifikasi session jam bursa untuk saham AS dan 24x7 untuk kripto', async () => {
      const { YahooFinanceProvider } = await import('../src/lib/services/yahooFinanceProvider');
      const provider = new YahooFinanceProvider();

      const usStockInfo = await provider.getSymbolInfo('AAPL');
      assert.strictEqual(usStockInfo.session, '0930-1600', 'Sesi reguler saham AS wajib 0930-1600');
      assert.strictEqual(usStockInfo.session_extended, '0400-2000', 'Sesi extended saham AS wajib 0400-2000');
      assert.strictEqual(usStockInfo.timezone, 'America/New_York');

      const cryptoInfo = await provider.getSymbolInfo('BTC-USD');
      assert.strictEqual(cryptoInfo.session, '24x7', 'Kripto Yahoo wajib tetap 24x7');

      const idxInfo = await provider.getSymbolInfo('BBCA.JK');
      assert.strictEqual(idxInfo.session, '0900-1615', 'Sesi bursa IDX wajib 0900-1615');
      assert.strictEqual(idxInfo.timezone, 'Asia/Jakarta');
    });

    test('Provider dapat mengatur dan membaca session mode (regular vs extended)', async () => {
      const { YahooFinanceProvider } = await import('../src/lib/services/yahooFinanceProvider');
      const provider = new YahooFinanceProvider();

      assert.strictEqual(provider.getSession(), 'regular');
      provider.setSession('extended');
      assert.strictEqual(provider.getSession(), 'extended');
      provider.setSession('regular');
      assert.strictEqual(provider.getSession(), 'regular');
    });

    test('isYahooMarketActive memperhitungkan extended hours (04:00-20:00 ET) saat session === "extended"', async () => {
      const { isYahooMarketActive } = await import('../src/lib/services/yahooFinanceProvider');

      // Pre-market time: Rabu 06:00 ET (11:00 UTC)
      const preMarketWednesday = new Date('2026-11-11T11:00:00Z');
      // Regular mode: tutup pada 06:00 ET
      assert.strictEqual(isYahooMarketActive('AAPL', preMarketWednesday, 'regular'), false);
      // Extended mode: buka pada 06:00 ET (karena pre-market 04:00-09:30 ET aktif)
      assert.strictEqual(isYahooMarketActive('AAPL', preMarketWednesday, 'extended'), true);

      // Post-market time: Rabu 18:00 ET (23:00 UTC)
      const postMarketWednesday = new Date('2026-11-11T23:00:00Z');
      // Regular mode: tutup pada 18:00 ET
      assert.strictEqual(isYahooMarketActive('AAPL', postMarketWednesday, 'regular'), false);
      // Extended mode: buka pada 18:00 ET (karena post-market 16:00-20:00 ET aktif)
      assert.strictEqual(isYahooMarketActive('AAPL', postMarketWednesday, 'extended'), true);

      // Tengah malam (01:00 ET): tutup baik di regular maupun extended
      const midnightWednesday = new Date('2026-11-11T06:00:00Z');
      assert.strictEqual(isYahooMarketActive('AAPL', midnightWednesday, 'regular'), false);
      assert.strictEqual(isYahooMarketActive('AAPL', midnightWednesday, 'extended'), false);
    });

    test('fetchBarsStrict menyertakan query parameter includePrePost sesuai sesi pasar', async () => {
      const { YahooFinanceProvider } = await import('../src/lib/services/yahooFinanceProvider');
      const provider = new YahooFinanceProvider();

      const originalFetch = (globalThis as any).fetch;
      let requestedUrl = '';
      (globalThis as any).fetch = async (url: string) => {
        requestedUrl = String(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ chart: { result: [{ timestamp: [1700000000], indicators: { quote: [{ open: [150], high: [155], low: [149], close: [154], volume: [1000] }] } }] } })
        };
      };

      try {
        // Mode Extended -> wajib menyertakan includePrePost=true
        await provider.fetchBarsStrict('AAPL', '15m', { countBack: 10, session: 'extended' });
        assert.ok(requestedUrl.includes('includePrePost=true'), `URL harus mengandung includePrePost=true: ${requestedUrl}`);

        // Mode Regular -> wajib menyertakan includePrePost=false
        await provider.fetchBarsStrict('AAPL', '15m', { countBack: 10, session: 'regular' });
        assert.ok(requestedUrl.includes('includePrePost=false'), `URL harus mengandung includePrePost=false: ${requestedUrl}`);
      } finally {
        (globalThis as any).fetch = originalFetch;
      }
    });
  });

  describe('6. ChartSessionController Session Management & Crypto Isolation', () => {
    test('ChartSessionController mendukung pembacaan dan pengubahan mode sesi (RTH/ETH)', async () => {
      const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
      const controller = new ChartSessionController({
        symbol: 'AAPL',
        timeframe: '15m',
        providerId: 'yahoo',
        layout: 'single',
      });

      assert.strictEqual(controller.getSession(), 'regular');
      assert.strictEqual(controller.isSessionAvailable(), true);

      controller.setSession('extended');
      assert.strictEqual(controller.getSession(), 'extended');

      const next = controller.toggleSession();
      assert.strictEqual(next, 'regular');
      assert.strictEqual(controller.getSession(), 'regular');
    });

    test('ChartSessionController mengabaikan session zones pada pasar kripto 24/7 secara aman', async () => {
      const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        providerId: 'binance',
        layout: 'single',
      });

      // Pada kripto, sessionAvailable wajib bernilai false
      assert.strictEqual(controller.isSessionAvailable(), false);

      // Mengubah simbol ke Indodax BTCIDR tetap false
      await controller.setSymbol('BTCIDR', '15m', 'indodax');
      assert.strictEqual(controller.isSessionAvailable(), false);

      // Beralih ke saham Yahoo Finance mengaktifkan dukungan session
      await controller.setSymbol('AAPL', '15m', 'yahoo');
      assert.strictEqual(controller.isSessionAvailable(), true);
    });

    test('ChartSessionController menyinkronkan setSession ke cell aktif Vela', async () => {
      const { ChartSessionController } = await import('../src/lib/services/chartSessionController');

      let cellSessionSet = '';
      const mockCell: any = {
        id: 'cell_1',
        symbol: 'yahoo:AAPL',
        timeframe: '15m',
        session: 'regular',
        sessionAvailable: true,
        setSession: (s: string) => {
          cellSessionSet = s;
          mockCell.session = s;
        },
        chart: {
          renderer: {
            renderer: {
              getConfig: () => ({ sessions: { premarketColor: '#f97316', postmarketColor: '#0ea5e9' } }),
              applyConfig: () => {},
              set: () => {}
            }
          }
        }
      };

      const mockWorkspace: any = {
        active: mockCell,
        cells: () => [mockCell],
        cell: () => mockCell,
        on: () => () => {},
        off: () => {}
      };

      const controller = new ChartSessionController({
        symbol: 'AAPL',
        timeframe: '15m',
        providerId: 'yahoo',
        layout: 'single',
        workspaceFactory: () => mockWorkspace
      });

      controller.attach(createMockContainer());
      controller.setSession('extended');

      assert.strictEqual(cellSessionSet, 'extended', 'Cell aktif wajib menerima setSession("extended")');
      assert.strictEqual(controller.getSession(), 'extended');
    });
  });
});
