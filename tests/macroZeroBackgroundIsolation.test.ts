import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MarketFeedService } from '../src/lib/services/market';
import type { MarketProviderAdapter } from '../src/lib/services/market/types';
import { alertService } from '../src/lib/services/alertService';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import type { Candle, MarketSearchResult, TickerInfo } from '../src/lib/types/market';

function makeSpyAdapter(id: string, defaultPrice: number) {
  const counts = {
    fetchTicker: 0,
    fetchBatchTickers: 0,
    fetchCandles: 0,
    searchSymbols: 0,
    batchSymbolsRequested: [] as string[][],
    singleSymbolsRequested: [] as string[],
  };

  const buildTicker = (sym: string): TickerInfo => ({
    symbol: sym,
    name: sym,
    price: defaultPrice,
    change24h: 1.5,
    high24h: defaultPrice * 1.02,
    low24h: defaultPrice * 0.98,
    volume24h: 1000,
  });

  const adapter: MarketProviderAdapter = {
    id,
    name: `Mock ${id}`,
    async fetchTicker(symbol: string): Promise<TickerInfo> {
      counts.fetchTicker++;
      counts.singleSymbolsRequested.push(symbol);
      return buildTicker(symbol);
    },
    async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
      counts.fetchBatchTickers++;
      counts.batchSymbolsRequested.push([...symbols]);
      const out: Record<string, TickerInfo> = {};
      for (const s of symbols) {
        out[s] = buildTicker(s);
      }
      return out;
    },
    async fetchCandles(): Promise<Candle[]> {
      counts.fetchCandles++;
      return [];
    },
    async searchSymbols(): Promise<MarketSearchResult[]> {
      counts.searchSymbols++;
      return [];
    },
  };

  return { adapter, counts };
}

describe('ADR-0024: Kebijakan Isolasi Zero-Background untuk Indeks Makro', () => {
  test('Watchlist, Alert Engine, Ctrl+K Search, & watchSymbolTicker tidak memicu fetch makro saat chart tertutup', async () => {
    const feed = new MarketFeedService();
    const macroSpy = makeSpyAdapter('macro', 2.6e12);
    const binanceSpy = makeSpyAdapter('binance', 68_000);
    const indodaxSpy = makeSpyAdapter('indodax', 1_100_000_000);

    feed.registerAdapter(macroSpy.adapter);
    feed.registerAdapter(binanceSpy.adapter);
    feed.registerAdapter(indodaxSpy.adapter);

    const createdAlertIds: string[] = [];

    try {
      // 1. Alert aktif ke TOTAL dan BTC.D tidak boleh menyalakan polling background atau memicu fetch makro.
      const a1 = await alertService.addAlert({ symbol: 'TOTAL', targetPrice: 3e12, condition: 'crossing_up' });
      const a2 = await alertService.addAlert({ symbol: 'BTC.D', targetPrice: 60, condition: 'crossing_up' });
      createdAlertIds.push(a1.id, a2.id);

      await feed.pollTick();
      assert.equal(macroSpy.counts.fetchTicker, 0);
      assert.equal(macroSpy.counts.fetchBatchTickers, 0);
      assert.equal(feed.isPollingRunning(), false, 'Alert makro saja tidak boleh menyalakan polling loop');

      // 2. Watchlist berisi simbol reguler + macro:* saat user hanya membuka chart reguler (belum subscribeActiveTicker makro).
      const unsubWatchlist = feed.subscribeWatchlistTickers(
        ['binance:BTCUSDT', 'indodax:BTCIDR', 'macro:TOTAL', 'macro:BTC.D'],
        () => {}
      );
      await feed.pollTick();

      assert.equal(macroSpy.counts.fetchTicker, 0, 'Watchlist tidak boleh memicu fetchTicker makro');
      assert.equal(macroSpy.counts.fetchBatchTickers, 0, 'Watchlist tidak boleh memicu fetchBatchTickers makro');
      assert.ok(binanceSpy.counts.fetchBatchTickers >= 1, 'Polling ticker Binance reguler harus tetap berjalan normal');
      assert.ok(indodaxSpy.counts.fetchBatchTickers >= 1, 'Polling ticker Indodax reguler harus tetap berjalan normal');

      // 3. Batch manual getWatchlistTickers dan preview watchSymbolTicker tidak boleh fetch jaringan makro.
      const batchRes = await feed.getWatchlistTickers(['binance:BTCUSDT', 'macro:TOTAL', 'macro:BTC.D']);
      assert.ok(batchRes['binance:BTCUSDT']);
      assert.equal(batchRes['macro:TOTAL'], undefined);
      assert.equal(macroSpy.counts.fetchBatchTickers, 0);

      let previewCalled = false;
      const stopWatchMacro = feed.watchSymbolTicker('TOTAL', () => {
        previewCalled = true;
      }, { debounceMs: 5 });
      await new Promise((r) => setTimeout(r, 20));
      stopWatchMacro();
      assert.equal(previewCalled, true);
      assert.equal(macroSpy.counts.fetchTicker, 0, 'watchSymbolTicker makro hanya boleh membaca snapshot memori');

      // 4. Pencarian simbol (Ctrl+K) tidak memanggil jaringan fetchTicker/fetchBatchTickers makro.
      const searchHits = await feed.searchSymbols('TOTAL');
      assert.ok(searchHits.some((h) => h.symbol === 'TOTAL'));
      assert.equal(macroSpy.counts.fetchTicker, 0);
      assert.equal(macroSpy.counts.fetchBatchTickers, 0);

      // 5. Buka chart aktif TOTAL -> hanya sekarang macro adapter aktif melakukan fetch.
      let activeTotalPrice = 0;
      const unsubActiveMacro = feed.subscribeActiveTicker('TOTAL', (t) => {
        activeTotalPrice = t.price;
      });
      await new Promise((r) => setTimeout(r, 15));
      await feed.pollTick();

      assert.equal(activeTotalPrice, 2.6e12);
      assert.ok(macroSpy.counts.fetchTicker >= 1 || macroSpy.counts.fetchBatchTickers >= 1);
      // Pastikan hanya TOTAL (yang sedang dibuka) yang masuk batch aktif, bukan BTC.D yang tidak dibuka!
      const requestedMacroBatchSyms = macroSpy.counts.batchSymbolsRequested.flat();
      assert.ok(requestedMacroBatchSyms.includes('TOTAL'));
      assert.equal(requestedMacroBatchSyms.includes('BTC.D'), false);

      // 6. Tutup chart TOTAL -> fetch makro kembali berhenti total pada pollTick berikutnya.
      unsubActiveMacro();
      const tickerCountAfterClose = macroSpy.counts.fetchTicker;
      const batchCountAfterClose = macroSpy.counts.fetchBatchTickers;

      await feed.pollTick();
      assert.equal(macroSpy.counts.fetchTicker, tickerCountAfterClose);
      assert.equal(macroSpy.counts.fetchBatchTickers, batchCountAfterClose);

      unsubWatchlist();
    } finally {
      for (const id of createdAlertIds) {
        await alertService.deleteAlert(id);
      }
      feed.destroy();
    }
  });

  test('setActiveProvider(macro) & setActiveProviderContext tidak menimpa provider global di PersistenceService', async () => {
    assert.strictEqual((globalThis as any).localStorage, undefined);
    const adapter = new InMemoryLocalStorageAdapter();
    adapter.clearMemory();
    const persistence = new PersistenceService(adapter);
    await persistence.bootstrap();

    const feed = new MarketFeedService(persistence);
    try {
      await feed.setActiveProvider('binance');
      const beforeProviders = await persistence.loadProviders();
      assert.equal(beforeProviders.find((p) => p.id === 'binance')?.is_active, true);

      let persistentWriteCalls = 0;
      const origSetActive = adapter.setActiveProvider.bind(adapter);
      const origSaveProvider = adapter.saveProvider.bind(adapter);
      adapter.setActiveProvider = async (id: string) => {
        persistentWriteCalls += 1;
        return origSetActive(id);
      };
      adapter.saveProvider = async (provider) => {
        persistentWriteCalls += 1;
        return origSaveProvider(provider);
      };

      // Baik setActiveProvider('macro') maupun setActiveProviderContext('macro') dilarang memutasi is_active binance di persistence.
      await feed.setActiveProvider('macro');
      feed.setActiveProviderContext('macro');

      assert.equal(
        persistentWriteCalls,
        0,
        'Dynamic Feeder Context (macro) tidak boleh memicu penulisan provider aktif ke persistence adapter'
      );

      const afterProviders = await persistence.loadProviders();
      assert.equal(
        afterProviders.find((p) => p.id === 'binance')?.is_active,
        true,
        'Binance wajib tetap is_active: true pada persistence layer saat sel makro dibuka'
      );
      assert.equal(afterProviders.some((p) => p.id === 'macro' && p.is_active), false);
      assert.equal(
        await feed.getActiveProviderId(),
        'binance',
        'getActiveProviderId tidak boleh memulihkan macro sebagai global provider'
      );
    } finally {
      feed.destroy();
    }
  });
});
