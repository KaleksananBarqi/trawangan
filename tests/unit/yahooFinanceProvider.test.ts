import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YahooFinanceProvider, resampleCandles, type OHLCV } from '../../src/lib/services/yahooFinanceProvider';
import { resolveSymbolProvider } from '../../src/lib/services/market';
import { resolveVelaSymbolKey, routeVenueForSymbol } from '../../src/lib/services/instrumentIdentity';
import { SymbolSearchEngine, POPULAR_YAHOO_ASSETS } from '../../src/lib/services/market/symbolSearchService';

describe('Yahoo Finance Provider & Multi-Asset Feed Suite', () => {
  const provider = new YahooFinanceProvider();

  describe('1. mapTimeframe & Resampling Detection', () => {
    it('memetakan interval native Yahoo (1m, 5m, 15m, 30m, 1h, 1d, 1w, 1mo)', () => {
      assert.deepEqual(provider.mapTimeframe('1m'), { interval: '1m' });
      assert.deepEqual(provider.mapTimeframe('5m'), { interval: '5m' });
      assert.deepEqual(provider.mapTimeframe('15m'), { interval: '15m' });
      assert.deepEqual(provider.mapTimeframe('1h'), { interval: '1h' });
      assert.deepEqual(provider.mapTimeframe('1d'), { interval: '1d' });
      assert.deepEqual(provider.mapTimeframe('1w'), { interval: '1wk' });
      assert.deepEqual(provider.mapTimeframe('1M'), { interval: '1mo' });
    });

    it('memetakan timeframe 2h dan 4h ke basis 1h dengan flag resampleTargetSec', () => {
      const tf2h = provider.mapTimeframe('2h');
      assert.equal(tf2h.interval, '1h');
      assert.equal(tf2h.resampleTargetSec, 7200);

      const tf4h = provider.mapTimeframe('4h');
      assert.equal(tf4h.interval, '1h');
      assert.equal(tf4h.resampleTargetSec, 14400);
    });
  });

  describe('2. resampleCandles Algorithm Unit Test', () => {
    it('mengagregasikan empat lilin 1h menjadi satu lilin 4h dengan benar', () => {
      const baseBucketTime = Math.floor(10000000000 / 14400000) * 14400000;
      const normalizedBars: OHLCV[] = [
        { time: baseBucketTime, open: 100, high: 110, low: 95, close: 105, volume: 50 },
        { time: baseBucketTime + 3600000, open: 105, high: 120, low: 102, close: 115, volume: 80 },
        { time: baseBucketTime + 7200000, open: 115, high: 118, low: 90, close: 92, volume: 100 },
        { time: baseBucketTime + 10800000, open: 92, high: 108, low: 88, close: 104, volume: 70 },
      ];

      const resampled = resampleCandles(normalizedBars, 14400);

      assert.equal(resampled.length, 1);
      const bar4h = resampled[0];
      assert.equal(bar4h.time, baseBucketTime);
      assert.equal(bar4h.open, 100); // Open dari lilin pertama
      assert.equal(bar4h.high, 120); // High tertinggi di antara 4 lilin
      assert.equal(bar4h.low, 88);   // Low terendah di antara 4 lilin
      assert.equal(bar4h.close, 104); // Close dari lilin terakhir
      assert.equal(bar4h.volume, 300); // Total akumulasi volume (50+80+100+70)
    });
  });

  describe('3. Smart Provider Inference & Venue Routing', () => {
    it('mengarahkan saham Indonesia (.JK) otomatis ke provider yahoo', () => {
      const res = resolveSymbolProvider('BBCA.JK');
      assert.equal(res.providerId, 'yahoo');
      assert.equal(res.cleanSymbol, 'BBCA.JK');

      assert.equal(routeVenueForSymbol('BBCA.JK'), 'yahoo');
      assert.equal(resolveVelaSymbolKey('BBCA.JK', 'binance'), 'yahoo:BBCA.JK');
    });

    it('mengarahkan instrumen berawalan ^ (indeks) ke provider yahoo', () => {
      const res = resolveSymbolProvider('^IXIC');
      assert.equal(res.providerId, 'yahoo');
      assert.equal(res.cleanSymbol, '^IXIC');

      assert.equal(routeVenueForSymbol('^IXIC'), 'yahoo');
      assert.equal(resolveVelaSymbolKey('^IXIC', 'binance'), 'yahoo:^IXIC');
    });

    it('mengarahkan instrumen berjangka komoditas (=F) ke provider yahoo', () => {
      const res = resolveSymbolProvider('GC=F');
      assert.equal(res.providerId, 'yahoo');
      assert.equal(res.cleanSymbol, 'GC=F');

      assert.equal(routeVenueForSymbol('GC=F'), 'yahoo');
      assert.equal(resolveVelaSymbolKey('GC=F', 'binance'), 'yahoo:GC=F');
    });

    it('tetap mengarahkan kripto IDR ke indodax dan USDT ke binance/bitunix', () => {
      assert.equal(resolveSymbolProvider('BTCIDR').providerId, 'indodax');
      assert.equal(resolveSymbolProvider('BTCUSDT').providerId, 'binance');
      assert.equal(resolveSymbolProvider('BTCUSDT.P', 'indodax').providerId, 'bitunix');
    });
  });

  describe('4. Symbol Aliasing Engine & Offline Registry', () => {
    const engine = new SymbolSearchEngine();

    it('menemukan GC=F ketika mencari kata kunci XAUUSD atau GOLD', () => {
      const matchesGold = engine.searchLocal('XAUUSD');
      assert.ok(matchesGold.length > 0);
      assert.equal(matchesGold[0].symbol, 'GC=F');
      assert.equal(matchesGold[0].quoteAsset, 'USD');

      const matchesAlias = engine.searchLocal('GOLD');
      assert.ok(matchesAlias.some((m) => m.symbol === 'GC=F'));
    });

    it('menemukan ^IXIC ketika mencari kata kunci NASDAQ', () => {
      const matchesNasdaq = engine.searchLocal('NASDAQ');
      assert.ok(matchesNasdaq.length > 0);
      assert.ok(matchesNasdaq.some((m) => m.symbol === '^IXIC'));
    });

    it('menemukan saham Indo BBCA.JK saat mencari BBCA', () => {
      const matchesBbca = engine.searchLocal('BBCA');
      assert.ok(matchesBbca.length > 0);
      assert.ok(matchesBbca.some((m) => m.symbol === 'BBCA.JK'));
    });
  });
});
