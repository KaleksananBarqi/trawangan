import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTradingViewUrl,
  resolveExternalSymbolWithFallback,
  type TradingViewParsedTarget,
} from '../tradingViewBridgeService';
import { SymbolSearchEngine } from '../market/symbolSearchService';

const DUMMY_CANDLE = {
  time: 1700000000,
  open: 1,
  high: 1.1,
  low: 0.9,
  close: 1.05,
  volume: 1000,
};

describe('tradingViewBridgeService - parseTradingViewUrl', () => {
  test('mengurai URL TradingView standar dengan query ?symbol=BITUNIX%3AMMTUSDT.P', () => {
    const parsed = parseTradingViewUrl(
      'https://www.tradingview.com/chart/?symbol=BITUNIX%3AMMTUSDT.P'
    );

    assert.deepEqual(parsed, {
      exchangePrefix: 'BITUNIX',
      normalizedSymbol: 'MMTUSDT.P',
      baseAsset: 'MMT',
      quoteAsset: 'USDT',
      isPerp: true,
      bypass: false,
      timeframe: undefined,
      rawInput: 'https://www.tradingview.com/chart/?symbol=BITUNIX%3AMMTUSDT.P',
    });
  });

  test('mengurai URL TradingView subdomain regional, chart id, dan interval timeframe', () => {
    const parsed = parseTradingViewUrl(
      'https://id.tradingview.com/chart/AbCd1234/?symbol=BINANCE:BTCUSDT.P&interval=15'
    );

    assert.ok(parsed);
    assert.equal(parsed.exchangePrefix, 'BINANCE');
    assert.equal(parsed.normalizedSymbol, 'BTCUSDT.P');
    assert.equal(parsed.timeframe, '15m');
    assert.equal(parsed.isPerp, true);
    assert.equal(parsed.bypass, false);
  });

  test('mengurai URL TradingView format path /symbols/EXCHANGE-SYMBOL/', () => {
    const parsed = parseTradingViewUrl('https://www.tradingview.com/symbols/BITUNIX-MMTUSDT.P/');

    assert.ok(parsed);
    assert.equal(parsed.exchangePrefix, 'BITUNIX');
    assert.equal(parsed.normalizedSymbol, 'MMTUSDT.P');
    assert.equal(parsed.baseAsset, 'MMT');
    assert.equal(parsed.quoteAsset, 'USDT');
    assert.equal(parsed.isPerp, true);
  });

  test('mendeteksi parameter bypass ?notrawangan=1 atau &web=1', () => {
    const bypassA = parseTradingViewUrl(
      'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT&notrawangan=1'
    );
    const bypassB = parseTradingViewUrl(
      'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT&web=1'
    );

    assert.equal(bypassA?.bypass, true);
    assert.equal(bypassB?.bypass, true);
  });

  test('mengurai string simbol langsung dan mengonversi timeframe TradingView umum', () => {
    const direct = parseTradingViewUrl('BYBIT:SOLUSDT.P', '240');
    assert.ok(direct);
    assert.equal(direct.exchangePrefix, 'BYBIT');
    assert.equal(direct.normalizedSymbol, 'SOLUSDT.P');
    assert.equal(direct.timeframe, '4h');
    assert.equal(direct.isPerp, true);

    const daily = parseTradingViewUrl('https://www.tradingview.com/chart/?symbol=IDX:BBCA&interval=1D');
    assert.equal(daily?.exchangePrefix, 'IDX');
    assert.equal(daily?.normalizedSymbol, 'BBCA');
    assert.equal(daily?.timeframe, '1d');
    assert.equal(daily?.isPerp, false);
  });

  test('mengembalikan null untuk input kosong atau URL TradingView tanpa simbol', () => {
    assert.equal(parseTradingViewUrl(''), null);
    assert.equal(parseTradingViewUrl('https://www.tradingview.com/chart/'), null);
  });
});

describe('tradingViewBridgeService - resolveExternalSymbolWithFallback', () => {
  test('langsung menembak API bursa asal secara dinamis untuk koin di luar daftar statis 40 koin', async () => {
    const calls: Array<[string, string, number | undefined]> = [];
    const getCandles = async (symbol: string, interval: string, limit?: number) => {
      calls.push([symbol, interval, limit]);
      if (symbol === 'bitunix:MMTUSDT.P') return [DUMMY_CANDLE];
      return [];
    };

    const parsed: TradingViewParsedTarget = {
      exchangePrefix: 'BITUNIX',
      normalizedSymbol: 'MMTUSDT.P',
      baseAsset: 'MMT',
      quoteAsset: 'USDT',
      isPerp: true,
      bypass: false,
      rawInput: 'BITUNIX:MMTUSDT.P',
    };

    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });

    assert.deepEqual(resolved, {
      symbol: 'MMTUSDT.P',
      providerId: 'bitunix',
    });
    assert.deepEqual(calls, [['bitunix:MMTUSDT.P', '15m', 5]]);
  });

  test('menjalankan rantai fallback .P (binance -> bitunix -> hyperliquid -> spot) saat bursa asal tidak didukung', async () => {
    const calls: string[] = [];
    const getCandles = async (symbol: string) => {
      calls.push(symbol);
      if (symbol === 'binance:MMTUSDT.P') {
        throw new Error('404 symbol not found');
      }
      if (symbol === 'bitunix:MMTUSDT.P') {
        return [DUMMY_CANDLE];
      }
      return [];
    };

    const parsed = parseTradingViewUrl('BYBIT:MMTUSDT.P')!;
    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });

    assert.deepEqual(resolved, {
      symbol: 'MMTUSDT.P',
      providerId: 'bitunix',
      redirectedFrom: 'BYBIT',
    });
    assert.deepEqual(calls, ['binance:MMTUSDT.P', 'bitunix:MMTUSDT.P']);
  });

  test('melanjutkan fallback .P ke hyperliquid lalu ke spot jika futures gagal', async () => {
    const calls: string[] = [];
    const getCandles = async (symbol: string) => {
      calls.push(symbol);
      if (symbol === 'binance:NEWGEMUSDT') return [DUMMY_CANDLE];
      return [];
    };

    const parsed = parseTradingViewUrl('OKX:NEWGEMUSDT.P')!;
    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });

    assert.deepEqual(resolved, {
      symbol: 'NEWGEMUSDT',
      providerId: 'binance',
      redirectedFrom: 'OKX',
    });
    assert.deepEqual(calls, [
      'binance:NEWGEMUSDT.P',
      'bitunix:NEWGEMUSDT.P',
      'hyperliquid:NEWGEMUSDT.P',
      'binance:NEWGEMUSDT',
    ]);
  });

  test('menjalankan rantai fallback Spot (binance -> bitunix perp -> coinbase -> indodax -> hyperliquid)', async () => {
    const calls: string[] = [];
    const getCandles = async (symbol: string) => {
      calls.push(symbol);
      if (symbol === 'coinbase:ABC-USD') return [DUMMY_CANDLE];
      return [];
    };

    const parsed = parseTradingViewUrl('MEXC:ABCUSDT')!;
    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });

    assert.deepEqual(resolved, {
      symbol: 'ABC-USD',
      providerId: 'coinbase',
      redirectedFrom: 'MEXC',
    });
    assert.deepEqual(calls, [
      'binance:ABCUSDT',
      'bitunix:ABCUSDT.P',
      'coinbase:ABC-USD',
    ]);
  });

  test('memetakan IDX ke Yahoo Finance .JK saat probing', async () => {
    const getCandles = async (symbol: string) => {
      if (symbol === 'yahoo:BBCA.JK') return [DUMMY_CANDLE];
      return [];
    };

    const parsed = parseTradingViewUrl('https://www.tradingview.com/chart/?symbol=IDX:BBCA')!;
    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });

    assert.deepEqual(resolved, {
      symbol: 'BBCA.JK',
      providerId: 'yahoo',
    });
  });

  test('mengembalikan null jika seluruh bursa fallback gagal atau kosong', async () => {
    const getCandles = async () => [];
    const parsed = parseTradingViewUrl('BYBIT:UNKNOWNXYZUSDT.P')!;
    const resolved = await resolveExternalSymbolWithFallback(parsed, { getCandles });
    assert.equal(resolved, null);
  });
});

describe('SymbolSearchEngine - Dynamic Online Fallback Bitunix Futures', () => {
  test('menyertakan kandidat Bitunix Futures (${base}USDT.P) untuk koin baru', async () => {
    const engine = new SymbolSearchEngine();
    const results = await engine.search('MMTUSDT.P');

    const bitunixCandidate = results.find(
      (item) => item.symbol === 'MMTUSDT.P' && item.provider === 'Bitunix Futures'
    );
    assert.ok(bitunixCandidate);
    assert.equal(bitunixCandidate.type, 'perp');
    assert.equal(bitunixCandidate.baseAsset, 'MMT');
  });

  test('menyertakan kandidat Bitunix Futures ketika query menggunakan prefix BITUNIX:', async () => {
    const engine = new SymbolSearchEngine();
    const results = await engine.search('BITUNIX:MMTUSDT.P');

    const bitunixCandidate = results.find(
      (item) => item.symbol === 'MMTUSDT.P' && item.provider === 'Bitunix Futures'
    );
    assert.ok(bitunixCandidate);
  });
});
