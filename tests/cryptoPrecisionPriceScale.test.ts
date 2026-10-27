import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatPriceLabel } from '../src/lib/services/priceScaleLabelService';
import { SymbolSearchEngine } from '../src/lib/services/market/symbolSearchService';
import { BinanceAdapter } from '../src/lib/services/market/adapters/binanceAdapter';

describe('Ticket 2 (#88): Crypto-Denominated Precision & BTC Quote Filter', () => {
  describe('1. formatPriceLabel with Crypto Quotes', () => {
    test('Memformat harga berkuotasi BTC dengan 8 desimal presisi dan simbol ₿ tanpa $', () => {
      const price = 0.03451234;
      const formatted = formatPriceLabel(price, 'BTC');

      assert.ok(!formatted.includes('$'), 'Tidak boleh mengandung simbol dolar ($)');
      assert.ok(formatted.includes('₿'), 'Harus menyertakan simbol Bitcoin ₿');
      assert.match(formatted, /0\.03451234/);
    });

    test('Memformat fraksi satoshi kecil dengan leading zero dan presisi penuh', () => {
      const satoshiPrice = 0.0000125;
      const formatted = formatPriceLabel(satoshiPrice, 'BTC');

      assert.ok(!formatted.includes('$'));
      assert.ok(formatted.includes('₿'));
      assert.match(formatted, /0\.00001250/);
    });

    test('Tetap memformat USDT dengan format dolar standar', () => {
      const usdtPrice = 64250.5;
      const formatted = formatPriceLabel(usdtPrice, 'USDT');
      assert.ok(!formatted.includes('₿'));
      assert.match(formatted, /64,250\.50/);
    });

    test('Tetap memformat IDR dengan format Rupiah lokal', () => {
      const idrPrice = 1450000000;
      const formatted = formatPriceLabel(idrPrice, 'IDR');
      assert.ok(formatted.includes('1.450.000.000'));
    });
  });

  describe('2. SymbolSearchEngine with BTC Quote Filter', () => {
    const engine = new SymbolSearchEngine();
    engine.registerAdapter(new BinanceAdapter());

    test('Menyaring pencarian dengan quoteAsset: "BTC" hanya mengembalikan pair ber-quote BTC', async () => {
      const results = await engine.search('', { quoteAsset: 'BTC' as any });
      assert.ok(results.length > 0, 'Harus menemukan pasangan kuotasi BTC');
      assert.ok(results.every((r) => r.quoteAsset === 'BTC'), 'Seluruh hasil harus berkuotasi BTC');
      assert.ok(results.some((r) => r.symbol === 'ETHBTC'));
    });

    test('Pencarian koin spesifik dengan quoteAsset: "BTC" mengembalikan pair BTC saja', async () => {
      const results = await engine.search('SOL', { quoteAsset: 'BTC' as any });
      assert.ok(results.length > 0);
      assert.ok(results.every((r) => r.quoteAsset === 'BTC'));
      assert.equal(results[0].symbol, 'SOLBTC');
    });
  });
});
