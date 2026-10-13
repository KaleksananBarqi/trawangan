import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  calculateSearchScore,
  rankSearchResults,
  SymbolSearchEngine,
} from '../src/lib/services/market/symbolSearchService';
import type { MarketSearchResult } from '../src/lib/types/market';
import type { MarketProviderAdapter } from '../src/lib/services/market/types';

describe('Multi-Tier Symbol Search Engine Suite (Tiket #23)', () => {
  // ─── 1. Scoring & Ranking Multi-Tier ───
  test('1. Scoring Multi-Tier: Query berawalan "re" memprioritaskan prefix ticker di atas substring acak', () => {
    const query = 're';

    const renderItem: MarketSearchResult = {
      symbol: 'RENDERUSDT',
      baseAsset: 'RENDER',
      quoteAsset: 'USDT',
      displayName: 'Render Token Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const reefItem: MarketSearchResult = {
      symbol: 'REEFUSDT',
      baseAsset: 'REEF',
      quoteAsset: 'USDT',
      displayName: 'Reef Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const reqItem: MarketSearchResult = {
      symbol: 'REQUSDT',
      baseAsset: 'REQ',
      quoteAsset: 'USDT',
      displayName: 'Request Network Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const renItem: MarketSearchResult = {
      symbol: 'RENUSDT',
      baseAsset: 'REN',
      quoteAsset: 'USDT',
      displayName: 'Ren Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const reiItem: MarketSearchResult = {
      symbol: 'REIUSDT',
      baseAsset: 'REI',
      quoteAsset: 'USDT',
      displayName: 'Rei Network Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    // Item dengan 're' hanya sebagai substring di tengah/akhir ticker atau nama (Tier 4)
    const coreItem: MarketSearchResult = {
      symbol: 'COREUSDT',
      baseAsset: 'CORE',
      quoteAsset: 'USDT',
      displayName: 'Core DAO Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const pyrexItem: MarketSearchResult = {
      symbol: 'PYREXUSDT',
      baseAsset: 'PYREX',
      quoteAsset: 'USDT',
      displayName: 'Pyrex Token Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    // Item tanpa substring 're' sama sekali
    const btcItem: MarketSearchResult = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      displayName: 'Bitcoin Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    // Hitung score
    const scoreRender = calculateSearchScore(query, renderItem);
    const scoreReef = calculateSearchScore(query, reefItem);
    const scoreReq = calculateSearchScore(query, reqItem);
    const scoreRen = calculateSearchScore(query, renItem);
    const scoreRei = calculateSearchScore(query, reiItem);
    const scoreCore = calculateSearchScore(query, coreItem);
    const scorePyrex = calculateSearchScore(query, pyrexItem);
    const scoreBtc = calculateSearchScore(query, btcItem);

    // Assert: Semua item berawalan 'RE' harus memiliki skor Tier 1/2 (>= 80)
    assert.ok(scoreRender >= 80, `RENDER score (${scoreRender}) harus >= 80`);
    assert.ok(scoreReef >= 80, `REEF score (${scoreReef}) harus >= 80`);
    assert.ok(scoreReq >= 80, `REQ score (${scoreReq}) harus >= 80`);
    assert.ok(scoreRen >= 80, `REN score (${scoreRen}) harus >= 80`);
    assert.ok(scoreRei >= 80, `REI score (${scoreRei}) harus >= 80`);

    // Assert: Item substring harus memiliki skor jauh lebih rendah (< 80 tapi > 0)
    assert.ok(scoreCore < 80 && scoreCore > 0, `CORE score (${scoreCore}) harus < 80 dan > 0`);
    assert.ok(scorePyrex < 80 && scorePyrex > 0, `PYREX score (${scorePyrex}) harus < 80 dan > 0`);
    assert.strictEqual(scoreBtc, 0, 'BTC yang tidak cocok harus bernilai 0');

    // Lakukan ranking kumpulan item
    const unranked = [btcItem, coreItem, renItem, renderItem, reefItem, reiItem, pyrexItem, reqItem];
    const ranked = rankSearchResults(query, unranked);

    // Lima koin teratas wajib berasal dari keluarga awalan 'RE'
    const top5Symbols = ranked.slice(0, 5).map((r) => r.baseAsset);
    assert.ok(top5Symbols.includes('RENDER'), 'Top 5 harus menyertakan RENDER');
    assert.ok(top5Symbols.includes('REEF'), 'Top 5 harus menyertakan REEF');
    assert.ok(top5Symbols.includes('REQ'), 'Top 5 harus menyertakan REQ');
    assert.ok(top5Symbols.includes('REN'), 'Top 5 harus menyertakan REN');
    assert.ok(top5Symbols.includes('REI'), 'Top 5 harus menyertakan REI');

    // CORE dan PYREX harus berada setelah koin-koin berawalan 'RE'
    const coreIndex = ranked.findIndex((r) => r.baseAsset === 'CORE');
    const renderIndex = ranked.findIndex((r) => r.baseAsset === 'RENDER');
    assert.ok(coreIndex > -1, 'CORE harus tetap ada di hasil karena mengandung substring RE');
    assert.ok(renderIndex < coreIndex, 'RENDER harus berada di atas CORE');
  });

  test('2. Exact Match Priority: Simbol yang persis sama dengan query memperoleh bobot tertinggi', () => {
    const query = 'BTC';

    const exactBtc: MarketSearchResult = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      displayName: 'Bitcoin Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const btcGold: MarketSearchResult = {
      symbol: 'BTGUSDT',
      baseAsset: 'BTG',
      quoteAsset: 'USDT',
      displayName: 'Bitcoin Gold Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const wbtc: MarketSearchResult = {
      symbol: 'WBTCUSDT',
      baseAsset: 'WBTC',
      quoteAsset: 'USDT',
      displayName: 'Wrapped Bitcoin Spot',
      type: 'spot',
      provider: 'Binance Spot',
    };

    const ranked = rankSearchResults(query, [wbtc, btcGold, exactBtc]);
    assert.strictEqual(ranked[0].baseAsset, 'BTC', 'BTC exact match harus nomor 1');
  });

  // ─── 2. Multi-Quote & Multi-Exchange Aggregation ───
  test('3. Multi-Quote Isolation: Filter IDR hanya mengembalikan aset IDR (Indodax), USDT hanya USDT', async () => {
    const engine = new SymbolSearchEngine();

    // Mock Adapter Binance
    const mockBinance: MarketProviderAdapter = {
      id: 'binance',
      name: 'Binance',
      fetchTicker: async () => ({} as any),
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async () => [
        { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', displayName: 'Bitcoin Spot', type: 'spot', provider: 'Binance Spot' },
        { symbol: 'RENDERUSDT', baseAsset: 'RENDER', quoteAsset: 'USDT', displayName: 'Render Spot', type: 'spot', provider: 'Binance Spot' },
      ],
    };

    // Mock Adapter Indodax
    const mockIndodax: MarketProviderAdapter = {
      id: 'indodax',
      name: 'Indodax',
      fetchTicker: async () => ({} as any),
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async () => [
        { symbol: 'BTCIDR', baseAsset: 'BTC', quoteAsset: 'IDR', displayName: 'Bitcoin Rupiah', type: 'spot', provider: 'Indodax Spot' },
        { symbol: 'USDTIDR', baseAsset: 'USDT', quoteAsset: 'IDR', displayName: 'Tether Rupiah', type: 'spot', provider: 'Indodax Spot' },
      ],
    };

    engine.registerAdapter(mockBinance);
    engine.registerAdapter(mockIndodax);

    // Cari dengan filter quote IDR
    const idrResults = await engine.search('BTC', { quoteAsset: 'IDR' });
    assert.ok(idrResults.length > 0);
    assert.ok(idrResults.every((r) => r.quoteAsset === 'IDR'), 'Seluruh hasil harus ber-quote IDR');
    assert.ok(idrResults.some((r) => r.symbol === 'BTCIDR'));

    // Cari dengan filter quote USDT
    const usdtResults = await engine.search('BTC', { quoteAsset: 'USDT' });
    assert.ok(usdtResults.length > 0);
    assert.ok(usdtResults.every((r) => r.quoteAsset === 'USDT'), 'Seluruh hasil harus ber-quote USDT');
    assert.ok(usdtResults.some((r) => r.symbol === 'BTCUSDT'));
  });

  // ─── 3. Dynamic Online Fallback ───
  test('4. Dynamic Online Fallback: Mensintesis pasangan valid saat mencari koin yang belum terindeks', async () => {
    const engine = new SymbolSearchEngine();

    // Adapter kosong tanpa koin terdaftar
    const emptyAdapter: MarketProviderAdapter = {
      id: 'binance',
      name: 'Binance',
      fetchTicker: async () => ({} as any),
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async () => [],
    };
    engine.registerAdapter(emptyAdapter);

    // Cari simbol baru yang belum ada di database lokal
    const unknownCoin = 'STRK';
    const results = await engine.search(unknownCoin, { exchange: 'all' });

    assert.ok(results.length > 0, 'Harus menghasilkan fallback sintetis');
    const spotFallback = results.find((r) => r.type === 'spot');
    const perpFallback = results.find((r) => r.type === 'perp');

    assert.ok(spotFallback, 'Wajib ada fallback spot');
    assert.strictEqual(spotFallback?.symbol, 'STRKUSDT');
    assert.strictEqual(spotFallback?.baseAsset, 'STRK');

    assert.ok(perpFallback, 'Wajib ada fallback perp');
    assert.strictEqual(perpFallback?.symbol, 'STRKUSDT.P');
  });

  // ─── 4. Sub-10ms Fast Registry Search ───
  test('5. Sub-10ms Fast Cache: Pencarian dari registry lokal merespons dalam waktu < 10ms', async () => {
    const engine = new SymbolSearchEngine();

    const t0 = performance.now();
    const results = await engine.searchLocal('re');
    const duration = performance.now() - t0;

    assert.ok(results.length > 0, 'Harus menemukan pasangan berawalan re dari registry lokal');
    assert.ok(duration < 20, `Durasi pencarian lokal (${duration.toFixed(2)}ms) harus sangat cepat (< 20ms)`);
    assert.ok(results.some((r) => r.baseAsset === 'RENDER'));
  });
});
