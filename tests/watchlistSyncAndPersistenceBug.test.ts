// Unit & Regression Seam Tests: Watchlist Sync, Persistence, & Context Menu Integrity
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { WatchlistRegistryService } from '../src/lib/services/watchlistRegistryService';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { PersistenceService } from '../src/lib/services/persistence';
import { formatWatchlistEntry, parseWatchlistEntry, isSectionToken, insertSymbolIntoSection } from '../src/lib/services/watchlistUtils';

function getTickerCount(items: string[]): number {
  return items.filter((item) => !item.startsWith('#section:')).length;
}

describe('Watchlist Sync & Persistence Bug Reproduction & Fix Suite', () => {
  let inMemoryAdapter: InMemoryLocalStorageAdapter;
  let persistence: PersistenceService;
  let service: WatchlistRegistryService;

  beforeEach(async () => {
    inMemoryAdapter = new InMemoryLocalStorageAdapter();
    persistence = new PersistenceService(inMemoryAdapter);
    service = new WatchlistRegistryService(persistence);
    await service.load();
  });

  it('1. BUG REPRO & FIX: Menambahkan koin ke watchlist kustom (e.g. "futures") langsung menambah ticker count dan tersimpan ke registry', async () => {
    // 1. Buat watchlist "futures" kosong
    const created = await service.createWatchlist('futures', []);
    assert.equal(created.name, 'futures');
    assert.equal(service.getActiveWatchlistId(), created.id);
    assert.equal(getTickerCount(service.getActiveWatchlist().items), 0, 'Count awal harus 0');

    // 2. Simulasikan penambahan koin melalui alur pencarian (SymbolSearch) ke active watchlist
    const rawCoin = 'BTCUSDT.P';
    const activeProviderId = 'binance';
    const entry = formatWatchlistEntry(rawCoin, activeProviderId);

    // Dapatkan items saat ini dari active watchlist
    const currentItems = service.getActiveWatchlist().items;
    const target = parseWatchlistEntry(entry);
    const exists = currentItems.some((s) => {
      if (s === entry) return true;
      const p = parseWatchlistEntry(s);
      return p.symbol === target.symbol && p.providerId === target.providerId;
    });

    let next: string[];
    if (exists) {
      next = currentItems.filter((s) => {
        if (s === entry) return false;
        const p = parseWatchlistEntry(s);
        return !(p.symbol === target.symbol && p.providerId === target.providerId);
      });
    } else {
      next = insertSymbolIntoSection(currentItems, entry, null);
    }

    // Eksekusi pembaruan ke registry
    await service.updateActiveItems(next);

    // 3. Verifikasi koin langsung tersimpan di active watchlist dan ticker count bertambah
    const updatedActive = service.getActiveWatchlist();
    assert.equal(updatedActive.id, created.id);
    assert.equal(getTickerCount(updatedActive.items), 1, 'Ticker count pada watchlist "futures" harus bertambah menjadi 1');
    assert.ok(updatedActive.items.includes(entry));

    // 4. Verifikasi bahwa persistensi reload mempertahankan koin di watchlist "futures"
    const freshService = new WatchlistRegistryService(persistence);
    await freshService.load();
    assert.equal(freshService.getActiveWatchlistId(), created.id);
    const persistedActive = freshService.getActiveWatchlist();
    assert.equal(persistedActive.name, 'futures');
    assert.equal(getTickerCount(persistedActive.items), 1);
    assert.ok(persistedActive.items.includes(entry));
  });

  it('2. Format provider entry konsisten saat menambahkan koin bursa (Exchange Search)', () => {
    let symbols = ['binance:BTCUSDT', '#section:sec_1:DEFI'];
    const exchangeItem = { symbol: 'ETHUSDT', provider: 'binance' };

    // Format dengan provider
    const formatted = formatWatchlistEntry(exchangeItem.symbol, exchangeItem.provider);
    assert.equal(formatted, 'binance:ETHUSDT');

    // Cek apakah sudah ada (harus false)
    const exists = symbols.some((w) => {
      const p = parseWatchlistEntry(w);
      return p.symbol === exchangeItem.symbol && p.providerId === exchangeItem.provider;
    });
    assert.equal(exists, false);

    // Insert ke section
    symbols = insertSymbolIntoSection(symbols, formatted, 'sec_1');
    assert.deepEqual(symbols, ['binance:BTCUSDT', '#section:sec_1:DEFI', 'binance:ETHUSDT']);
  });

  it('3. Navigasi Watchlist mengabaikan token section divider', () => {
    const listWithSections = [
      'binance:BTCUSDT',
      '#section:sec_1:LAYER 1',
      'binance:SOLUSDT',
      '#section:sec_2:MEME',
      'binance:DOGEUSDT'
    ];

    const cleanList = listWithSections.filter((item) => !isSectionToken(item));
    assert.deepEqual(cleanList, ['binance:BTCUSDT', 'binance:SOLUSDT', 'binance:DOGEUSDT']);

    // Navigasi dari BTCUSDT (+1) harus ke SOLUSDT, bukan ke #section:sec_1:LAYER 1
    const idx = cleanList.indexOf('binance:BTCUSDT');
    const nextIdx = (idx + 1) % cleanList.length;
    assert.equal(cleanList[nextIdx], 'binance:SOLUSDT');
  });
});
