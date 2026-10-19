import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExternalChartUrl,
  normalizeSymbolAndContract,
  resolveChartTargetWithFallback,
  mapExchangeToProviderId,
  type ParsedChartTarget
} from '../src/lib/services/urlInterceptorService';
import { marketFeed } from '../src/lib/services/market';

describe('URL Interceptor Service Seam Suite', () => {
  describe('1. Parsing URL Eksternal & Skema Native trawangan://', () => {
    test('TradingView web chart dengan prefix bursa dan sufiks perpetual .P', () => {
      const url = 'https://www.tradingview.com/chart/?symbol=BINANCE:ARIAUSDT.P';
      const parsed = parseExternalChartUrl(url);

      assert.ok(parsed, 'URL TradingView harus berhasil di-parse');
      assert.equal(parsed.providerId, 'binance');
      assert.equal(parsed.symbol, 'ARIAUSDT.P');
    });

    test('TradingView web chart dengan URL encoded symbol query', () => {
      const url = 'https://id.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT';
      const parsed = parseExternalChartUrl(url);

      assert.ok(parsed);
      assert.equal(parsed.providerId, 'binance');
      assert.equal(parsed.symbol, 'BTCUSDT');
    });

    test('TradingView symbols path (halaman profil koin)', () => {
      const url = 'https://www.tradingview.com/symbols/ETHUSDT/';
      const parsed = parseExternalChartUrl(url);

      assert.ok(parsed);
      assert.equal(parsed.symbol, 'ETHUSDT');
    });

    test('Skema native trawangan://chart?symbol=BINANCE:ARIAUSDT.P', () => {
      const uri = 'trawangan://chart?symbol=BINANCE:ARIAUSDT.P';
      const parsed = parseExternalChartUrl(uri);

      assert.ok(parsed);
      assert.equal(parsed.providerId, 'binance');
      assert.equal(parsed.symbol, 'ARIAUSDT.P');
    });

    test('Skema native trawangan://open?url=encoded_url', () => {
      const uri = 'trawangan://open?url=' + encodeURIComponent('https://www.tradingview.com/chart/?symbol=BYBIT:SOLUSDT.P');
      const parsed = parseExternalChartUrl(uri);

      assert.ok(parsed);
      assert.equal(parsed.providerId, 'bybit');
      assert.equal(parsed.symbol, 'SOLUSDT.P');
    });

    test('Binance web trade spot & futures URL', () => {
      const spotUrl = 'https://www.binance.com/en/trade/BTC_USDT?type=spot';
      const parsedSpot = parseExternalChartUrl(spotUrl);
      assert.ok(parsedSpot);
      assert.equal(parsedSpot.providerId, 'binance');
      assert.equal(parsedSpot.symbol, 'BTCUSDT');

      const futuresUrl = 'https://www.binance.com/en/futures/ETHUSDT';
      const parsedFut = parseExternalChartUrl(futuresUrl);
      assert.ok(parsedFut);
      assert.equal(parsedFut.providerId, 'binance');
      assert.equal(parsedFut.symbol, 'ETHUSDT');
    });

    test('Bybit web trade URL', () => {
      const url = 'https://www.bybit.com/trade/usdt/BTCUSDT';
      const parsed = parseExternalChartUrl(url);
      assert.ok(parsed);
      assert.equal(parsed.providerId, 'bybit');
      assert.equal(parsed.symbol, 'BTCUSDT');
    });

    test('DexScreener web URL', () => {
      const url = 'https://dexscreener.com/solana/sol_usdc';
      const parsed = parseExternalChartUrl(url);
      assert.ok(parsed);
      assert.ok(parsed.symbol.includes('SOL'));
    });

    test('Mengabaikan URL sembarang yang bukan charting atau crypto', () => {
      assert.equal(parseExternalChartUrl('https://google.com/search?q=trawangan'), null);
      assert.equal(parseExternalChartUrl('https://github.com/KaleksananBarqi/trawangan'), null);
      assert.equal(parseExternalChartUrl(''), null);
    });
  });

  describe('2. Normalisasi Simbol & Kontrak Derivatif', () => {
    test('Membersihkan sufiks perpetual .P, -PERP, SWAP', () => {
      const res1 = normalizeSymbolAndContract('ARIAUSDT.P');
      assert.equal(res1.cleanSymbol, 'ARIAUSDT');
      assert.equal(res1.isPerpetual, true);

      const res2 = normalizeSymbolAndContract('BTC-PERP');
      assert.equal(res2.cleanSymbol, 'BTC');
      assert.equal(res2.isPerpetual, true);

      const res3 = normalizeSymbolAndContract('BTC_USDT');
      assert.equal(res3.cleanSymbol, 'BTCUSDT');
      assert.equal(res3.isPerpetual, false);
    });

    test('Ekstraksi Base dan Quote currency', () => {
      const res = normalizeSymbolAndContract('BTCUSDT');
      assert.equal(res.base, 'BTC');
      assert.equal(res.quote, 'USDT');

      const resIdr = normalizeSymbolAndContract('BTCIDR');
      assert.equal(resIdr.base, 'BTC');
      assert.equal(resIdr.quote, 'IDR');
    });
  });

  describe('3. Multi-Provider Fallback Routing', () => {
    // Mock SearchEngine sederhana
    const mockSearchEngine = {
      async search(query: string) {
        if (query.toUpperCase().includes('ARIA')) {
          return [
            { providerId: 'bitunix', symbol: 'ARIAUSDT.P', base: 'ARIA', quote: 'USDT' },
            { providerId: 'bybit', symbol: 'ARIAUSDT', base: 'ARIA', quote: 'USDT' }
          ];
        }
        if (query.toUpperCase().includes('BTC')) {
          return [
            { providerId: 'binance', symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT' },
            { providerId: 'bitunix', symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT' },
            { providerId: 'indodax', symbol: 'BTCIDR', base: 'BTC', quote: 'IDR' }
          ];
        }
        return [];
      }
    };

    test('mapExchangeToProviderId memetakan nama bursa secara akurat via dictionary', () => {
      assert.equal(mapExchangeToProviderId('BINANCE'), 'binance');
      assert.equal(mapExchangeToProviderId('ByBit_Spot'), 'bybit');
      assert.equal(mapExchangeToProviderId('BitUnix-Perp'), 'bitunix');
      assert.equal(mapExchangeToProviderId('Indodax'), 'indodax');
      assert.equal(mapExchangeToProviderId('Coinbase_Pro'), 'coinbase');
      assert.equal(mapExchangeToProviderId('OKX_Web'), 'okx');
      assert.equal(mapExchangeToProviderId('Kucoin_V2'), 'kucoin');
      assert.equal(mapExchangeToProviderId('Hyperliquid_DEX'), 'hyperliquid');
      assert.equal(mapExchangeToProviderId('unknown_exchange'), 'unknown_exchange');
      assert.equal(mapExchangeToProviderId(''), 'binance');
    });

    test('MarketFeedService mengekspos getSearchEngine() secara formal bertipe', () => {
      assert.ok(typeof marketFeed.getSearchEngine === 'function');
      const engine = marketFeed.getSearchEngine();
      assert.ok(engine, 'SearchEngine instance harus tersedia');
      assert.ok(typeof engine.search === 'function');
    });

    test('Jika bursa asal (binance) memiliki koin BTCUSDT, gunakan bursa asal', async () => {
      const target: ParsedChartTarget = {
        providerId: 'binance',
        symbol: 'BTCUSDT',
        rawUrl: 'https://tradingview.com/chart/?symbol=BINANCE:BTCUSDT'
      };

      const result = await resolveChartTargetWithFallback(target, mockSearchEngine as any);
      assert.equal(result.providerId, 'binance');
      assert.equal(result.symbol, 'BTCUSDT');
      assert.equal(result.redirectedNotice, undefined);
    });

    test('Jika bursa asal (binance) TIDAK memiliki ARIAUSDT, fallback ke bitunix dengan notifikasi', async () => {
      const target: ParsedChartTarget = {
        providerId: 'binance',
        symbol: 'ARIAUSDT.P',
        rawUrl: 'https://tradingview.com/chart/?symbol=BINANCE:ARIAUSDT.P'
      };

      const result = await resolveChartTargetWithFallback(target, mockSearchEngine as any);
      assert.equal(result.providerId, 'bitunix');
      assert.ok(result.symbol.includes('ARIAUSDT'));
      assert.ok(result.redirectedNotice?.includes('BINANCE:ARIAUSDT'));
    });
  });
});
