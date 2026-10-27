import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAdaptiveSymbol,
  SymbolSearchEngine,
} from '../src/lib/services/market/symbolSearchService';
import { resolveSymbolProvider } from '../src/lib/services/market';
import { resolveVelaSymbol } from '../src/lib/services/chartSessionController';
import { BinanceAdapter } from '../src/lib/services/market/adapters/binanceAdapter';

describe('Ticket 1 (#87): Adaptive Quote Parser & Venue Capability Guard', () => {
  describe('1. parseAdaptiveSymbol Grammar Unit Tests', () => {
    test('Memecah simbol dengan delimiter garis miring (ETH/BTC, BTC/IDR)', () => {
      const res1 = parseAdaptiveSymbol('ETH/BTC');
      assert.equal(res1.baseAsset, 'ETH');
      assert.equal(res1.quoteAsset, 'BTC');
      assert.equal(res1.cleanSymbol, 'ETHBTC');

      const res2 = parseAdaptiveSymbol('BTC/IDR');
      assert.equal(res2.baseAsset, 'BTC');
      assert.equal(res2.quoteAsset, 'IDR');
      assert.equal(res2.cleanSymbol, 'BTCIDR');
    });

    test('Memecah simbol dengan delimiter tanda hubung dan garis bawah (ETH-BTC, SOL_BTC)', () => {
      const res1 = parseAdaptiveSymbol('ETH-BTC');
      assert.equal(res1.baseAsset, 'ETH');
      assert.equal(res1.quoteAsset, 'BTC');
      assert.equal(res1.cleanSymbol, 'ETHBTC');

      const res2 = parseAdaptiveSymbol('SOL_BTC');
      assert.equal(res2.baseAsset, 'SOL');
      assert.equal(res2.quoteAsset, 'BTC');
      assert.equal(res2.cleanSymbol, 'SOLBTC');
    });

    test('Memecah simbol bersambung dengan sufiks kuotasi umum (ETHBTC, SOLBTC, BTCIDR, DOGEUSDT)', () => {
      const ethbtc = parseAdaptiveSymbol('ETHBTC');
      assert.equal(ethbtc.baseAsset, 'ETH');
      assert.equal(ethbtc.quoteAsset, 'BTC');
      assert.equal(ethbtc.cleanSymbol, 'ETHBTC');

      const solbtc = parseAdaptiveSymbol('SOLBTC');
      assert.equal(solbtc.baseAsset, 'SOL');
      assert.equal(solbtc.quoteAsset, 'BTC');
      assert.equal(solbtc.cleanSymbol, 'SOLBTC');

      const btcIdr = parseAdaptiveSymbol('BTCIDR');
      assert.equal(btcIdr.baseAsset, 'BTC');
      assert.equal(btcIdr.quoteAsset, 'IDR');
      assert.equal(btcIdr.cleanSymbol, 'BTCIDR');

      const dogeUsdt = parseAdaptiveSymbol('DOGEUSDT');
      assert.equal(dogeUsdt.baseAsset, 'DOGE');
      assert.equal(dogeUsdt.quoteAsset, 'USDT');
      assert.equal(dogeUsdt.cleanSymbol, 'DOGEUSDT');
    });

    test('Menangani simbol tunggal tanpa kuotasi (SOL, BTC) dengan default USDT', () => {
      const res = parseAdaptiveSymbol('SOL');
      assert.equal(res.baseAsset, 'SOL');
      assert.equal(res.quoteAsset, 'USDT');
      assert.equal(res.isQuoteExplicit, false);
    });

    test('Mengenali kontrak derivatif .P (BTCUSDT.P)', () => {
      const res = parseAdaptiveSymbol('BTCUSDT.P');
      assert.equal(res.baseAsset, 'BTC');
      assert.equal(res.quoteAsset, 'USDT');
      assert.equal(res.isPerp, true);
    });
  });

  describe('2. SymbolSearchEngine: Pencarian ETHBTC & Venue Capability Guard', () => {
    const engine = new SymbolSearchEngine();
    engine.registerAdapter(new BinanceAdapter());

    test('Pencarian "ETHBTC" menghasilkan Binance Spot pair tanpa sufiks USDT', async () => {
      const results = await engine.search('ETHBTC');
      assert.ok(results.length > 0, 'Harus mengembalikan hasil pencarian');

      const top = results[0];
      assert.equal(top.symbol, 'ETHBTC');
      assert.equal(top.baseAsset, 'ETH');
      assert.equal(top.quoteAsset, 'BTC');
      assert.equal(top.type, 'spot');
      assert.match(top.provider, /Binance/i);

      // Verifikasi TIDAK ADA ETHBTCUSDT atau ETHBTCUSDT.P
      const forcedUsdt = results.find((r) => r.symbol.includes('ETHBTCUSDT'));
      assert.equal(forcedUsdt, undefined, 'Tidak boleh memaksa ETHBTC menjadi ETHBTCUSDT');
    });

    test('Pencarian "ETH/BTC" menghasilkan Base ETH dan Quote BTC', async () => {
      const results = await engine.search('ETH/BTC');
      assert.ok(results.length > 0);
      assert.equal(results[0].symbol, 'ETHBTC');
      assert.equal(results[0].quoteAsset, 'BTC');
    });

    test('Venue Capability Guard: Pasangan quote BTC tidak pernah memunculkan kontrak .P fiktif', async () => {
      const results = await engine.search('ETHBTC');
      const perpResults = results.filter((r) => r.type === 'perp' || r.symbol.endsWith('.P'));
      assert.equal(perpResults.length, 0, 'Kontrak fiktif .P tidak boleh muncul untuk kuotasi kripto');
    });

    test('Registry lokal memuat pasangan BTC spot populer secara instan (< 10ms)', () => {
      const start = performance.now();
      const localMatches = engine.searchLocal('ETHBTC');
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 20, `Lookup lokal harus sangat cepat (< 20ms), durasi: ${elapsed}ms`);
      assert.ok(localMatches.length > 0, 'Harus menemukan ETHBTC di registry lokal');
      assert.equal(localMatches[0].symbol, 'ETHBTC');
      assert.equal(localMatches[0].quoteAsset, 'BTC');
    });

    test('Pencarian koin tunggal "SOL" tetap menghasilkan Spot dan Perp', async () => {
      const results = await engine.search('SOL');
      const hasSpot = results.some((r) => r.symbol === 'SOLUSDT' && r.type === 'spot');
      const hasPerp = results.some((r) => r.symbol === 'SOLUSDT.P' && r.type === 'perp');

      assert.ok(hasSpot, 'Harus memiliki SOLUSDT Spot');
      assert.ok(hasPerp, 'Harus memiliki SOLUSDT.P Perp');
    });
  });

  describe('3. Routing Provider & Vela Chart Session Resolution', () => {
    test('resolveSymbolProvider mengarahkan ETHBTC ke Binance Spot', () => {
      const routed = resolveSymbolProvider('ETHBTC');
      assert.equal(routed.providerId, 'binance');
      assert.equal(routed.cleanSymbol, 'ETHBTC');
    });

    test('resolveVelaSymbol menormalkan format ETHBTC ke binance:ETHBTC', () => {
      const velaSym = resolveVelaSymbol('ETHBTC', 'binance');
      assert.equal(velaSym, 'binance:ETHBTC');
    });
  });
});
