// Unit & Seam Tests untuk Tiket #67: Multi-Provider Watchlist Polling Multiplexer
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MarketFeedService, resolveSymbolProvider } from '../src/lib/services/market';
import type { MarketProviderAdapter } from '../src/lib/services/market/types';
import type { TickerInfo } from '../src/lib/types/market';

class MockAdapter implements MarketProviderAdapter {
  constructor(public id: string, public name: string) {}

  public requestedSymbols: string[][] = [];

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    return {
      symbol,
      name: symbol,
      price: 100,
      change24h: 1.5,
      high24h: 105,
      low24h: 95,
      volume24h: 1000,
    };
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    this.requestedSymbols.push([...symbols]);
    const res: Record<string, TickerInfo> = {};
    for (const s of symbols) {
      res[s] = {
        symbol: s,
        name: s,
        price: 100,
        change24h: 2.0,
        high24h: 105,
        low24h: 95,
        volume24h: 500,
      };
    }
    return res;
  }

  async fetchCandles(): Promise<any[]> {
    return [];
  }

  async searchSymbols(): Promise<any[]> {
    return [];
  }
}

describe('Tiket #67: Multi-Provider Watchlist Polling Multiplexer', () => {
  it('1. resolveSymbolProvider: memecah simbol ber-prefix atau menginfer bursa secara deterministik', () => {
    assert.deepEqual(resolveSymbolProvider('bitunix:BTCUSDT', 'binance'), {
      providerId: 'bitunix',
      cleanSymbol: 'BTCUSDT',
    });
    assert.deepEqual(resolveSymbolProvider('indodax:BTCIDR', 'binance'), {
      providerId: 'indodax',
      cleanSymbol: 'BTCIDR',
    });
    assert.deepEqual(resolveSymbolProvider('BTCIDR', 'binance'), {
      providerId: 'indodax',
      cleanSymbol: 'BTCIDR',
    });
    assert.deepEqual(resolveSymbolProvider('ETHUSDT', 'bitunix'), {
      providerId: 'bitunix',
      cleanSymbol: 'ETHUSDT',
    });
  });

  it('2. pollTick mempartisi koin watchlist ke adapter masing-masing tanpa menyatukannya ke satu bursa', async () => {
    const service = new MarketFeedService();
    const binanceMock = new MockAdapter('binance', 'Binance Mock');
    const bitunixMock = new MockAdapter('bitunix', 'Bitunix Mock');
    const indodaxMock = new MockAdapter('indodax', 'Indodax Mock');

    service.registerAdapter(binanceMock);
    service.registerAdapter(bitunixMock);
    service.registerAdapter(indodaxMock);

    service.setActiveProvider('binance');

    // Subscribe watchlist campuran
    const mixedSymbols = [
      'binance:BTCUSDT',
      'bitunix:SOLUSDT.P',
      'indodax:BTCIDR',
      'ETHUSDT', // Polos, ikut bursa aktif (binance)
    ];

    let receivedTickers: Record<string, TickerInfo> = {};
    service.subscribeWatchlistTickers(mixedSymbols, (map) => {
      receivedTickers = { ...receivedTickers, ...map };
    });

    // Jalankan poll tick
    await service.pollTick();

    // Verifikasi masing-masing adapter hanya menerima koin miliknya
    const binanceReqs = binanceMock.requestedSymbols.flat();
    assert.ok(binanceReqs.includes('BTCUSDT'));
    assert.ok(binanceReqs.includes('ETHUSDT'));
    assert.ok(!binanceReqs.includes('BTCIDR'));
    assert.ok(!binanceReqs.includes('SOLUSDT.P'));

    const bitunixReqs = bitunixMock.requestedSymbols.flat();
    assert.ok(bitunixReqs.includes('SOLUSDT.P'));
    assert.ok(!bitunixReqs.includes('BTCIDR'));

    const indodaxReqs = indodaxMock.requestedSymbols.flat();
    assert.ok(indodaxReqs.includes('BTCIDR'));
    assert.ok(!indodaxReqs.includes('BTCUSDT'));

    // Status koneksi tetap connected (tidak palsu stalled/blocked)
    const status = service.getConnectionStatus();
    assert.equal(status.state, 'connected');
    assert.equal(status.errorCount, 0);

    service.destroy();
  });

  it('3. pollTick menyaring dan mengabaikan token #section: sehingga adapter tidak pernah menerima string non-ticker', async () => {
    const service = new MarketFeedService();
    const binanceMock = new MockAdapter('binance', 'Binance Mock');
    service.registerAdapter(binanceMock);
    service.setActiveProvider('binance');

    // Watchlist yang memiliki pembatas seksi / kategori
    const listWithSections = [
      '#section:sec_1:LAYER 1:0',
      'binance:BTCUSDT',
      'binance:ETHUSDT',
      '#section:sec_2:MEME:1', // collapsed
      'binance:DOGEUSDT',
    ];

    service.subscribeWatchlistTickers(listWithSections, () => {});
    await service.pollTick();

    const allRequests = binanceMock.requestedSymbols.flat();
    const uniqueRequests = Array.from(new Set(allRequests));
    assert.ok(uniqueRequests.includes('BTCUSDT'), 'BTCUSDT harus dipolling');

    assert.ok(uniqueRequests.includes('ETHUSDT'), 'ETHUSDT harus dipolling');
    assert.ok(uniqueRequests.includes('DOGEUSDT'), 'DOGEUSDT harus tetap dipolling meski seksi collapsed');
    assert.equal(uniqueRequests.length, 3, 'Hanya 3 simbol koin unik yang boleh diminta (BTCUSDT, ETHUSDT, DOGEUSDT)');


    // Pastikan tidak ada token section yang masuk
    assert.ok(!allRequests.some((s) => s.includes('#section')), 'Token #section tidak boleh ditembak ke adapter');
    assert.ok(!allRequests.some((s) => s.includes('LAYER 1')), 'Nama seksi tidak boleh masuk ke query bursa');

    service.destroy();
  });
});

