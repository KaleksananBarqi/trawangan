import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MarketFeedService, marketFeed } from '../src/lib/services/market/index';
import { MockMarketAdapter } from '../src/lib/services/market/adapters/mockAdapter';
import { alertService } from '../src/lib/services/alertService';
import type { PriceAlert } from '../src/lib/types/market';

describe('Background Alert Engine Suite (#146)', () => {
  let mockAdapter: MockMarketAdapter;

  beforeEach(async () => {
    // Bersihkan alert yang tersisa dari test sebelumnya
    const existing = alertService.getAlerts();
    for (const a of existing) {
      await alertService.deleteAlert(a.id);
    }

    mockAdapter = new MockMarketAdapter();
    marketFeed.registerAdapter(mockAdapter);
    await marketFeed.setActiveProvider('mock');
  });

  afterEach(async () => {
    // Bersihkan seluruh alert setelah test
    const existing = alertService.getAlerts();
    for (const a of existing) {
      await alertService.deleteAlert(a.id);
    }
  });

  describe('a. alertService.getActiveAlertSymbols()', () => {
    test('mengembalikan array kosong ketika tidak ada alert', () => {
      const symbols = (alertService as any).getActiveAlertSymbols();
      assert.deepEqual(symbols, []);
    });

    test('mengembalikan simbol unik dari alert yang aktif dan belum terpicu', async () => {
      await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
      await alertService.addAlert({ symbol: 'ETHUSDT', targetPrice: 3500 });

      const symbols = (alertService as any).getActiveAlertSymbols();
      assert.equal(symbols.length, 2);
      assert.ok(symbols.includes('BTCUSDT'));
      assert.ok(symbols.includes('ETHUSDT'));
    });

    test('melakukan deduplikasi simbol jika ada beberapa alert pada simbol yang sama', async () => {
      await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
      await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 70000 });
      await alertService.addAlert({ symbol: 'btcusdt', targetPrice: 72000 });

      const symbols = (alertService as any).getActiveAlertSymbols();
      assert.equal(symbols.length, 1);
      assert.equal(symbols[0], 'BTCUSDT');
    });

    test('mengecualikan alert yang berstatus non-aktif (active: false)', async () => {
      const a1 = await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
      const a2 = await alertService.addAlert({ symbol: 'SOLUSDT', targetPrice: 180 });

      // Nonaktifkan alert SOLUSDT
      await alertService.toggleAlertActive(a2.id);

      const symbols = (alertService as any).getActiveAlertSymbols();
      assert.deepEqual(symbols, ['BTCUSDT']);
    });

    test('mengecualikan alert yang sudah terpicu (triggered: true)', async () => {
      const a1 = await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
      const a2 = await alertService.addAlert({
        symbol: 'ADAUSDT',
        targetPrice: 0.5,
        condition: 'crossing_up',
        frequency: 'once',
      });

      // Simulasikan pemicuan alert ADAUSDT
      alertService.evaluateAlerts('ADAUSDT', 0.55);

      const symbols = (alertService as any).getActiveAlertSymbols();
      assert.ok(!symbols.includes('ADAUSDT'));
      assert.ok(symbols.includes('BTCUSDT'));
    });
  });

  describe('b. marketFeed.pollTick() Background Symbol Ingestion', () => {
    test('menyertakan simbol alert aktif saat active chart & watchlist subscribers kosong', async () => {
      mockAdapter.setMockPrice('NEARUSDT', 5.5, 3.2);

      // Pastikan tidak ada subscription chart maupun watchlist
      const alert = await alertService.addAlert({
        symbol: 'NEARUSDT',
        targetPrice: 6.0,
      });

      await marketFeed.pollTick();

      // Verifikasi ticker NEARUSDT berhasil diambil dan masuk ke cache feed
      const ticker = await marketFeed.getTicker('NEARUSDT');
      assert.ok(ticker);
      assert.equal(ticker.price, 5.5);
    });

    test('partisi dan deduplikasi query simbol ke provider adapter', async () => {
      let queriedSymbols: string[] = [];
      const originalFetchBatch = mockAdapter.fetchBatchTickers.bind(mockAdapter);
      mockAdapter.fetchBatchTickers = async (symbols: string[]) => {
        queriedSymbols = [...symbols];
        return originalFetchBatch(symbols);
      };

      // Tambah dua alert untuk simbol sama dan satu untuk simbol beda
      await alertService.addAlert({ symbol: 'AVAXUSDT', targetPrice: 30 });
      await alertService.addAlert({ symbol: 'AVAXUSDT', targetPrice: 40 });
      await alertService.addAlert({ symbol: 'DOTUSDT', targetPrice: 7 });

      await marketFeed.pollTick();

      assert.ok(queriedSymbols.includes('AVAXUSDT'));
      assert.ok(queriedSymbols.includes('DOTUSDT'));
      // Pastikan AVAXUSDT hanya muncul 1 kali dalam query batch
      const avaxCount = queriedSymbols.filter((s) => s === 'AVAXUSDT').length;
      assert.equal(avaxCount, 1);
    });
  });

  describe('c. Polling Lifecycle Continuity & Idle Resumption', () => {
    test('polling otomatis aktif ketika alert ditambahkan saat polling dalam keadaan idle', async () => {
      // Pastikan polling idle terlebih dahulu
      assert.equal((marketFeed as any).isPollingRunning?.(), false);

      // Tambahkan alert baru
      await alertService.addAlert({ symbol: 'LINKUSDT', targetPrice: 15 });

      // Verifikasi polling loop otomatis berjalan
      assert.equal((marketFeed as any).isPollingRunning?.(), true);
    });

    test('polling tetap berjalan jika subscriber chart berhenti namun masih ada alert aktif', async () => {
      await alertService.addAlert({ symbol: 'ATOMUSDT', targetPrice: 8 });

      // Langganan chart
      const unsub = marketFeed.subscribeActiveTicker('BTCUSDT', () => {});
      assert.equal((marketFeed as any).isPollingRunning?.(), true);

      // Hentikan langganan chart
      unsub();

      // Polling tidak boleh berhenti karena ATOMUSDT alert masih aktif
      assert.equal((marketFeed as any).isPollingRunning?.(), true);
    });

    test('polling berhenti ketika seluruh alert dihapus dan subscriber kosong', async () => {
      const a = await alertService.addAlert({ symbol: 'XRPUSDT', targetPrice: 0.6 });
      assert.equal((marketFeed as any).isPollingRunning?.(), true);

      // Hapus alert
      await alertService.deleteAlert(a.id);

      // Polling harus berhenti (idle)
      assert.equal((marketFeed as any).isPollingRunning?.(), false);
    });
  });

  describe('d. Background Symbol Alert Trigger Evaluation', () => {
    test('perubahan harga simbol latar belakang berhasil mengevaluasi dan memicu alert', async () => {
      mockAdapter.setMockPrice('BNBUSDT', 580);

      const alert = await alertService.addAlert({
        symbol: 'BNBUSDT',
        targetPrice: 600,
        condition: 'crossing_up',
        frequency: 'once',
      });

      let triggeredAlert: PriceAlert | null = null;
      let triggeredPrice = 0;
      const unsubTrigger = alertService.onTrigger((a, p) => {
        triggeredAlert = a;
        triggeredPrice = p;
      });

      // Putaran 1: harga masih 580 (di bawah target)
      await marketFeed.pollTick();
      assert.equal(triggeredAlert, null);

      // Putaran 2: harga melompat ke 605 (crossing up target 600)
      mockAdapter.setMockPrice('BNBUSDT', 605);
      await marketFeed.pollTick();

      assert.ok(triggeredAlert);
      assert.equal((triggeredAlert as PriceAlert).id, alert.id);
      assert.equal(triggeredPrice, 605);

      // Verifikasi alert di storage/memori berubah status menjadi triggered
      const allAlerts = alertService.getAlerts();
      const stored = allAlerts.find((a) => a.id === alert.id);
      assert.ok(stored);
      assert.equal(stored.triggered, true);
      assert.equal(stored.triggeredPrice, 605);
      assert.ok(stored.triggeredAt && stored.triggeredAt > 0);

      // Pastikan simbol tidak lagi masuk getActiveAlertSymbols()
      const activeSymbols = (alertService as any).getActiveAlertSymbols();
      assert.ok(!activeSymbols.includes('BNBUSDT'));

      unsubTrigger();
    });
  });
});
