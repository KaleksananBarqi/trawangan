import { describe, test } from 'node:test';
import assert from 'node:assert';
import { SymbolSearchEngine } from '../src/lib/services/market/symbolSearchService';
import type { MarketSearchResult } from '../src/lib/types/market';

describe('Watchlist Omni-Search & Symbol Exploration Seam Suite (Tiket #24)', () => {
  test('1. Dual-Layer Omni-Search: Query memfilter koin lokal dan memuat hasil bursa secara bersamaan', async () => {
    const localWatchlist = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const query = 're';

    // Layer 1: Filter lokal
    const localMatches = localWatchlist.filter((s) => s.toLowerCase().includes(query.toLowerCase()));
    assert.strictEqual(localMatches.length, 0, 'Koin lokal tidak memiliki koin berawalan RE');

    // Layer 2: Hasil bursa dari Search Engine
    const engine = new SymbolSearchEngine();
    const exchangeResults = await engine.search(query);

    assert.ok(exchangeResults.length > 0, 'Hasil bursa harus memuat koin-koin berawalan RE');
    const topDistinctBases = Array.from(new Set(exchangeResults.slice(0, 12).map((r) => r.baseAsset)));
    assert.ok(topDistinctBases.includes('RENDER'), 'Bursa harus memunculkan RENDER di kelompok teratas');
    assert.ok(topDistinctBases.includes('REEF'), 'Bursa harus memunculkan REEF di kelompok teratas');
  });

  test('2. 1-Klik Tambah ke Watchlist (+ Action): Menambahkan koin bursa ke daftar pantau tanpa duplikasi', () => {
    let watchlist = ['BTCUSDT', 'ETHUSDT'];
    const newSymbolToAdd = 'RENDERUSDT';

    function addSymbolToWatchlist(currentList: string[], symbolToAdd: string): string[] {
      const clean = symbolToAdd.trim().toUpperCase();
      if (!clean) return currentList;
      if (currentList.includes(clean)) return currentList;
      return [...currentList, clean];
    }

    // Tambah pertama kali
    watchlist = addSymbolToWatchlist(watchlist, newSymbolToAdd);
    assert.strictEqual(watchlist.length, 3);
    assert.ok(watchlist.includes('RENDERUSDT'));

    // Tambah ulang simbol yang sama (idempotent)
    watchlist = addSymbolToWatchlist(watchlist, newSymbolToAdd);
    assert.strictEqual(watchlist.length, 3, 'Tidak boleh ada duplikasi simbol');
  });

  test('3. Auto Provider Switch saat klik koin bursa: IDR beralih ke Indodax, USDT beralih ke Binance', () => {
    let activeProvider = 'binance';

    function resolveProviderForSymbol(symbol: string, currentProvider: string): string {
      if (symbol.endsWith('IDR') || symbol.includes('/IDR')) {
        return 'indodax';
      }
      if (symbol.includes('USDT') && currentProvider === 'indodax') {
        return 'binance';
      }
      return currentProvider;
    }

    // Klik koin Indodax IDR saat provider aktif Binance
    activeProvider = resolveProviderForSymbol('BTCIDR', activeProvider);
    assert.strictEqual(activeProvider, 'indodax', 'Harus beralih ke Indodax saat memilih pasangan IDR');

    // Klik koin Binance USDT saat provider aktif Indodax
    activeProvider = resolveProviderForSymbol('RENDERUSDT', activeProvider);
    assert.strictEqual(activeProvider, 'binance', 'Harus beralih kembali ke Binance saat memilih pasangan USDT');
  });

  test('4. Keyboard Navigation Index Selection: Boundary clamping dan cycling', () => {
    const totalItems = 5;
    let selectedIndex = 0;

    function navigate(currentIndex: number, direction: 'up' | 'down', total: number): number {
      if (total === 0) return 0;
      if (direction === 'down') {
        return (currentIndex + 1) % total;
      } else {
        return (currentIndex - 1 + total) % total;
      }
    }

    selectedIndex = navigate(selectedIndex, 'down', totalItems);
    assert.strictEqual(selectedIndex, 1);

    selectedIndex = navigate(selectedIndex, 'up', totalItems);
    assert.strictEqual(selectedIndex, 0);

    // Up dari 0 cycling ke index terakhir (4)
    selectedIndex = navigate(selectedIndex, 'up', totalItems);
    assert.strictEqual(selectedIndex, 4);

    // Down dari 4 cycling kembali ke 0
    selectedIndex = navigate(selectedIndex, 'down', totalItems);
    assert.strictEqual(selectedIndex, 0);
  });
});
