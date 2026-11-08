import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSymbolForMatching,
  isSameInstrument,
  isSameSymbol,
  parseInstrumentIdentity,
  resolveDrawingStorageKey,
  resolveDrawingKey,
  resolveVelaSymbolKey,
  resolveVelaSymbol,
  routeVenueForSymbol,
  getCellMarketIdentity,
} from '../src/lib/services/instrumentIdentity';

describe('Instrument Identity & Venue Capability Engine Suite (Candidate #5)', () => {
  describe('1. normalizeSymbolForMatching & isSameInstrument', () => {
    test('menghilangkan awalan bursa, tanda baca delimiter, dan sufiks kontrak derivatif', () => {
      assert.strictEqual(normalizeSymbolForMatching('binance:BTCUSDT'), 'BTCUSDT');
      assert.strictEqual(normalizeSymbolForMatching('BINANCE:btcusdt.p'), 'BTCUSDT');
      assert.strictEqual(normalizeSymbolForMatching('BTC/USDT'), 'BTCUSDT');
      assert.strictEqual(normalizeSymbolForMatching('BTC-USDT-PERP'), 'BTCUSDT');
      assert.strictEqual(normalizeSymbolForMatching('sol_usdt_perp'), 'SOLUSDT');
      assert.strictEqual(normalizeSymbolForMatching(''), '');
      assert.strictEqual(normalizeSymbolForMatching(null), '');
      assert.strictEqual(normalizeSymbolForMatching(undefined), '');
    });

    test('isSameInstrument membandingkan kesetaraan simbol lintas bursa dan format kontrak', () => {
      assert.strictEqual(isSameInstrument('BTCUSDT', 'BTCUSDT'), true);
      assert.strictEqual(isSameInstrument('btcusdt', 'BTCUSDT'), true);
      assert.strictEqual(isSameInstrument('binance:BTCUSDT', 'BTCUSDT'), true);
      assert.strictEqual(isSameInstrument('BTCUSDT.P', 'BTCUSDT'), true);
      assert.strictEqual(isSameInstrument('BTC-PERP', 'binance:BTC'), true);
      assert.strictEqual(isSameInstrument('BTC/IDR', 'indodax:BTCIDR'), true);
      assert.strictEqual(isSameInstrument('BTCUSDT', 'ETHUSDT'), false);
      assert.strictEqual(isSameInstrument(null, 'BTCUSDT'), false);
      assert.strictEqual(isSameInstrument('BTCUSDT', undefined), false);
    });

    test('isSameSymbol berfungsi sebagai alias kompatibel ke belakang', () => {
      assert.strictEqual(isSameSymbol('SOLUSDT-PERP', 'SOLUSDT'), true);
      assert.strictEqual(isSameSymbol('ETHUSDT', 'BTCUSDT'), false);
    });
  });

  describe('2. parseInstrumentIdentity', () => {
    test('mengurai simbol spot standar', () => {
      const parsed = parseInstrumentIdentity('BTCUSDT');
      assert.strictEqual(parsed.providerId, 'binance');
      assert.strictEqual(parsed.symbol, 'BTCUSDT');
      assert.strictEqual(parsed.canonicalSymbol, 'BTCUSDT');
      assert.strictEqual(parsed.base, 'BTC');
      assert.strictEqual(parsed.quote, 'USDT');
      assert.strictEqual(parsed.contractType, 'spot');
    });

    test('mengurai simbol derivatif perp dengan sufiks .P', () => {
      const parsed = parseInstrumentIdentity('ETHUSDT.P');
      assert.strictEqual(parsed.symbol, 'ETHUSDT.P');
      assert.strictEqual(parsed.canonicalSymbol, 'ETHUSDT');
      assert.strictEqual(parsed.base, 'ETH');
      assert.strictEqual(parsed.quote, 'USDT');
      assert.strictEqual(parsed.contractType, 'perp');
    });

    test('mengurai simbol dengan awalan provider eksplisit', () => {
      const parsed = parseInstrumentIdentity('indodax:BTCIDR');
      assert.strictEqual(parsed.providerId, 'indodax');
      assert.strictEqual(parsed.symbol, 'BTCIDR');
      assert.strictEqual(parsed.canonicalSymbol, 'BTCIDR');
      assert.strictEqual(parsed.base, 'BTC');
      assert.strictEqual(parsed.quote, 'IDR');
    });
  });

  describe('3. resolveDrawingStorageKey & resolveDrawingKey', () => {
    test('menghasilkan kunci kanonikal berhuruf besar untuk simbol dan huruf kecil untuk bursa', () => {
      const key = resolveDrawingStorageKey('binance', 'btcusdt');
      assert.strictEqual(key, 'binance:BTCUSDT');
    });

    test('mengekstrak provider dari simbol jika terkandung format provider:symbol', () => {
      const key = resolveDrawingStorageKey('binance', 'bitunix:solusdt');
      assert.strictEqual(key, 'bitunix:SOLUSDT');
    });

    test('menyertakan workspaceId yang ternormalisasi huruf kecil saat disediakan', () => {
      const key = resolveDrawingStorageKey('binance', 'BTCUSDT', 'My_Workspace');
      assert.strictEqual(key, 'my_workspace:binance:BTCUSDT');
    });

    test('resolveDrawingKey identik dengan resolveDrawingStorageKey', () => {
      assert.strictEqual(
        resolveDrawingKey('binance', 'ETHUSDT', 'ws-1'),
        resolveDrawingStorageKey('binance', 'ETHUSDT', 'ws-1')
      );
    });
  });

  describe('4. resolveVelaSymbolKey & resolveVelaSymbol', () => {
    test('memformat simbol sesuai bursa target', () => {
      assert.strictEqual(resolveVelaSymbolKey('BTC/IDR', 'indodax'), 'indodax:BTCIDR');
      assert.strictEqual(resolveVelaSymbolKey('BTCUSDT', 'hyperliquid'), 'hyperliquid:BTC');
      assert.strictEqual(resolveVelaSymbolKey('BTCUSDT.P', 'coinbase'), 'coinbase:BTC-USD');
      assert.strictEqual(resolveVelaSymbolKey('btcusdt.p', 'bitunix'), 'bitunix:BTCUSDT.P');
      assert.strictEqual(resolveVelaSymbolKey('btcusdt', 'binance'), 'binance:BTCUSDT');
    });

    test('resolveVelaSymbol berfungsi sebagai alias', () => {
      assert.strictEqual(resolveVelaSymbol('ETHUSDT', 'binance'), 'binance:ETHUSDT');
    });
  });

  describe('5. routeVenueForSymbol', () => {
    test('mengarahkan simbol IDR ke Indodax', () => {
      assert.strictEqual(routeVenueForSymbol('BTCIDR', 'binance'), 'indodax');
    });

    test('mengarahkan kontrak .P dari Indodax ke Bitunix', () => {
      assert.strictEqual(routeVenueForSymbol('BTCUSDT.P', 'indodax'), 'bitunix');
    });

    test('mengarahkan simbol USDT dari Indodax ke Binance', () => {
      assert.strictEqual(routeVenueForSymbol('BTCUSDT', 'indodax'), 'binance');
    });

    test('menghormati petunjuk venueHint eksplisit', () => {
      assert.strictEqual(routeVenueForSymbol('BTCUSDT', 'binance', 'hyperliquid'), 'hyperliquid');
      assert.strictEqual(routeVenueForSymbol('BTCUSDT', 'binance', 'coinbase'), 'coinbase');
    });
  });

  describe('6. getCellMarketIdentity', () => {
    test('mengembalikan default saat cell kosong', () => {
      assert.deepStrictEqual(getCellMarketIdentity(null), { providerId: 'binance', symbol: '' });
    });

    test('mengekstrak bursa dan simbol dari format cell', () => {
      assert.deepStrictEqual(
        getCellMarketIdentity({ symbol: 'bitunix:SOLUSDT' }),
        { providerId: 'bitunix', symbol: 'SOLUSDT' }
      );
      assert.deepStrictEqual(
        getCellMarketIdentity({ symbol: 'BTCIDR' }),
        { providerId: 'indodax', symbol: 'BTCIDR' }
      );
    });
  });
});
