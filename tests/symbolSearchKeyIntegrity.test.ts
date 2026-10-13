import { describe, test } from 'node:test';
import assert from 'node:assert';
import { marketFeed } from '../src/lib/services/market';
import { getSearchResultKey, SymbolSearchEngine } from '../src/lib/services/market/symbolSearchService';
import type { MarketSearchResult } from '../src/lib/types/market';
import type { MarketProviderAdapter } from '../src/lib/services/market/types';

describe('Symbol Search Modal Key Integrity & Duplicate Guard Suite', () => {
  test('1. REGRESSION FIX: SymbolSearchModal each block key via getSearchResultKey(item) MUST be 100% unique on Ctrl+K (empty query)', async () => {
    // Saat pengguna menekan Ctrl+K, query pencarian awalnya kosong ('')
    const results = await marketFeed.searchSymbols('');
    assert.ok(results.length > 0, 'Hasil pencarian simbol tidak boleh kosong');

    // Evaluasi key yang telah diperbaiki: getSearchResultKey(item)
    const keysUsedInModal = results.map((item: MarketSearchResult) => getSearchResultKey(item));
    const seen = new Set<string>();
    const duplicateKeys: string[] = [];

    for (const key of keysUsedInModal) {
      if (seen.has(key)) {
        duplicateKeys.push(key);
      } else {
        seen.add(key);
      }
    }

    assert.deepStrictEqual(
      duplicateKeys,
      [],
      `getSearchResultKey tidak boleh menghasilkan duplicate key pada Ctrl+K! Duplikat: ${duplicateKeys.join(', ')}`
    );
  });

  test('2. REGRESSION FIX: searchLocalSymbols (< 5ms instant cache) must have 100% unique keys', () => {
    const localResults = marketFeed.searchLocalSymbols('');
    assert.ok(localResults.length > 0, 'Cache lokal tidak boleh kosong');

    const keys = localResults.map((item) => getSearchResultKey(item));
    const seen = new Set<string>();
    const duplicateKeys: string[] = [];

    for (const k of keys) {
      if (seen.has(k)) duplicateKeys.push(k);
      else seen.add(k);
    }

    assert.deepStrictEqual(duplicateKeys, [], 'Cache lokal tidak boleh memiliki duplicate key');
  });

  test('3. REGRESSION FIX: Common queries (BTC, ETH, SOL, RE, DOGE) must have 100% unique keys across all providers', async () => {
    const queries = ['BTC', 'ETH', 'SOL', 'RE', 'DOGE', 'USDT', 'PEPE'];

    for (const q of queries) {
      const results = await marketFeed.searchSymbols(q);
      const keys = results.map((item) => getSearchResultKey(item));
      const seen = new Set<string>();
      const duplicates: string[] = [];

      for (const k of keys) {
        if (seen.has(k)) duplicates.push(k);
        else seen.add(k);
      }

      assert.deepStrictEqual(
        duplicates,
        [],
        `Query "${q}" menghasilkan duplicate key: ${duplicates.join(', ')}`
      );
    }
  });

  test('4. DEFENSE-IN-DEPTH: SymbolSearchEngine final deduplication guarantees uniqueness even with buggy adapter returning duplicate items', async () => {
    const engine = new SymbolSearchEngine();

    // Adapter nakal yang sengaja me-return item dengan symbol, type, dan provider identik
    const buggyAdapter: MarketProviderAdapter = {
      id: 'buggy',
      name: 'Buggy Provider',
      fetchTicker: async () => ({} as any),
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async () => [
        {
          symbol: 'CLONEUSDT',
          baseAsset: 'CLONE',
          quoteAsset: 'USDT',
          displayName: 'Clone Token 1',
          type: 'spot',
          provider: 'Buggy Provider',
        },
        {
          symbol: 'CLONEUSDT',
          baseAsset: 'CLONE',
          quoteAsset: 'USDT',
          displayName: 'Clone Token 2',
          type: 'spot',
          provider: 'Buggy Provider',
        },
      ],
    };

    engine.registerAdapter(buggyAdapter);

    const results = await engine.search('CLONE');
    const cloneResults = results.filter((r) => r.symbol === 'CLONEUSDT');

    // Engine harus mendeduplikasi sehingga hanya 1 item CLONEUSDT yang lolos
    assert.strictEqual(cloneResults.length, 1, 'Hanya 1 item per (provider:symbol:type) yang boleh lolos dari engine');

    const keys = results.map((r) => getSearchResultKey(r));
    const seen = new Set<string>();
    const duplicates = keys.filter((k) => seen.has(k) ? true : (seen.add(k), false));
    assert.deepStrictEqual(duplicates, [], 'Engine wajib menjamin 0 duplikat key');
  });
});
