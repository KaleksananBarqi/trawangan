// Unit & Seam Tests untuk Tiket #71: Core Multi-Watchlist Data Model, Registry Service, and Legacy Migration
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { WatchlistRegistryService } from '../src/lib/services/watchlistRegistryService';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { PersistenceService } from '../src/lib/services/persistence';
import { DEFAULT_FACTORY_WATCHLISTS } from '../src/lib/services/watchlistRegistryService';

describe('Tiket #71: WatchlistRegistryService', () => {
  let inMemoryAdapter: InMemoryLocalStorageAdapter;
  let persistence: PersistenceService;
  let service: WatchlistRegistryService;

  beforeEach(() => {
    inMemoryAdapter = new InMemoryLocalStorageAdapter();
    persistence = new PersistenceService(inMemoryAdapter);
    service = new WatchlistRegistryService(persistence);
  });

  it('1. Inisialisasi awal tanpa data menghasilkan default watchlists dan active ID default', async () => {
    await service.load();
    const lists = service.listWatchlists();
    assert.ok(lists.length >= 2, 'Harus memuat minimal preset bawaan');
    assert.equal(service.getActiveWatchlistId(), 'default');

    const activeList = service.getActiveWatchlist();
    assert.equal(activeList.id, 'default');
    assert.equal(activeList.name, 'Daftar Utama');
    assert.ok(activeList.items.length > 0);

    // Verifikasi preset Binance & Indodax ada
    const binancePreset = lists.find((l) => l.id === 'preset-binance');
    const indodaxPreset = lists.find((l) => l.id === 'preset-indodax');
    assert.ok(binancePreset, 'Preset Binance harus tersedia');
    assert.ok(indodaxPreset, 'Preset Indodax harus tersedia');
    assert.equal(binancePreset?.isPreset, true);
    assert.equal(indodaxPreset?.isPreset, true);
  });

  it('2. Migrasi data warisan (legacy migration) tanpa kehilangan koin pengguna', async () => {
    const legacySymbols = ['binance:BTCUSDT', 'binance:ETHUSDT', 'indodax:SOLIDR'];
    await inMemoryAdapter.saveWatchlist(legacySymbols);

    // Inisialisasi service baru di atas adapter yang punya legacy data
    const freshPersistence = new PersistenceService(inMemoryAdapter);
    const freshService = new WatchlistRegistryService(freshPersistence);
    await freshService.load();

    const activeList = freshService.getActiveWatchlist();
    assert.equal(activeList.id, 'default');
    assert.deepEqual(activeList.items, legacySymbols, 'Koin legacy harus bermigrasi utuh ke Daftar Utama');
  });

  it('3. CRUD Watchlist: create, rename, duplicate, dan delete', async () => {
    await service.load();

    // Create
    const created = await service.createWatchlist('Scalping Futures', ['bitunix:BTCUSDT.P']);
    assert.ok(created.id);
    assert.equal(created.name, 'Scalping Futures');
    assert.deepEqual(created.items, ['bitunix:BTCUSDT.P']);
    assert.equal(service.listWatchlists().some((l) => l.id === created.id), true);

    // Rename
    const renameSuccess = await service.renameWatchlist(created.id, 'Scalping Agresif');
    assert.equal(renameSuccess, true);
    assert.equal(service.getWatchlist(created.id)?.name, 'Scalping Agresif');

    // Duplicate
    const duplicated = await service.duplicateWatchlist(created.id);
    assert.ok(duplicated);
    assert.notEqual(duplicated?.id, created.id);
    assert.equal(duplicated?.name, 'Scalping Agresif (Salinan)');
    assert.deepEqual(duplicated?.items, ['bitunix:BTCUSDT.P']);

    // Delete
    const deleteSuccess = await service.deleteWatchlist(created.id);
    assert.equal(deleteSuccess, true);
    assert.equal(service.getWatchlist(created.id), null);
  });

  it('4. Proteksi batas minimum: tidak bisa menghapus jika hanya tersisa 1 watchlist', async () => {
    await service.load();
    const lists = service.listWatchlists();

    // Hapus semua kecuali satu
    for (const l of lists.slice(1)) {
      await service.deleteWatchlist(l.id);
    }
    assert.equal(service.listWatchlists().length, 1);

    // Coba hapus yang terakhir
    const lastId = service.listWatchlists()[0].id;
    const canDelete = await service.deleteWatchlist(lastId);
    assert.equal(canDelete, false, 'Watchlist terakhir tidak boleh dihapus');
    assert.equal(service.listWatchlists().length, 1);
  });

  it('5. Fallback otomatis ke default jika active watchlist dihapus', async () => {
    await service.load();
    const custom = await service.createWatchlist('Target Delete', ['binance:SOLUSDT']);
    service.setActiveWatchlistId(custom.id);
    assert.equal(service.getActiveWatchlistId(), custom.id);

    // Hapus watchlist yang sedang aktif
    await service.deleteWatchlist(custom.id);
    assert.equal(service.getActiveWatchlistId(), 'default', 'Harus otomatis fallback ke default');
  });

  it('6. Reset preset sistem ke susunan awal pabrik (Factory Reset)', async () => {
    await service.load();
    const indodaxPreset = service.getWatchlist('preset-indodax');
    assert.ok(indodaxPreset);

    // Modifikasi preset indodax (misal pengguna menghapus atau menambah simbol)
    await service.updateWatchlistItems('preset-indodax', ['indodax:DOGEIDR']);
    assert.deepEqual(service.getWatchlist('preset-indodax')?.items, ['indodax:DOGEIDR']);

    // Reset ke awal pabrik
    const resetSuccess = await service.resetPresetWatchlist('preset-indodax');
    assert.equal(resetSuccess, true);
    assert.deepEqual(
      service.getWatchlist('preset-indodax')?.items,
      DEFAULT_FACTORY_WATCHLISTS.find((p) => p.id === 'preset-indodax')?.items
    );
  });

  it('7. Sinkronisasi updateActiveItems memperbarui memori dan persistensi', async () => {
    await service.load();
    const newItems = ['binance:BTCUSDT', 'binance:SOLUSDT'];
    await service.updateActiveItems(newItems);

    assert.deepEqual(service.getActiveWatchlist().items, newItems);

    // Coba reload service dari persistence yang sama
    const reloadedService = new WatchlistRegistryService(persistence);
    await reloadedService.load();
    assert.deepEqual(reloadedService.getActiveWatchlist().items, newItems);
  });
});
