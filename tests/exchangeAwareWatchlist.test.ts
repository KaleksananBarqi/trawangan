// Unit & Seam Tests untuk Tiket #68: Exchange-Aware Watchlist Data Model, UI Badges, and One-Click Routing
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWatchlistEntry,
  formatWatchlistEntry,
} from '../src/lib/services/watchlistUtils';

describe('Tiket #68: Exchange-Aware Watchlist Data Model and Utilities', () => {
  it('1. parseWatchlistEntry: mengurai format provider:symbol dengan benar', () => {
    assert.deepEqual(parseWatchlistEntry('bitunix:BTCUSDT'), {
      providerId: 'bitunix',
      symbol: 'BTCUSDT',
    });
    assert.deepEqual(parseWatchlistEntry('binance:BTCUSDT'), {
      providerId: 'binance',
      symbol: 'BTCUSDT',
    });
    assert.deepEqual(parseWatchlistEntry('indodax:BTCIDR'), {
      providerId: 'indodax',
      symbol: 'BTCIDR',
    });
  });

  it('2. parseWatchlistEntry (Legacy Fallback): menginfer bursa untuk data lama tanpa prefix bursa', () => {
    // Data warisan koin IDR otomatis dipetakan ke Indodax
    assert.deepEqual(parseWatchlistEntry('BTCIDR'), {
      providerId: 'indodax',
      symbol: 'BTCIDR',
    });
    // Data warisan koin USDT otomatis dipetakan ke Binance
    assert.deepEqual(parseWatchlistEntry('BTCUSDT'), {
      providerId: 'binance',
      symbol: 'BTCUSDT',
    });
    assert.deepEqual(parseWatchlistEntry('SOLUSDT'), {
      providerId: 'binance',
      symbol: 'SOLUSDT',
    });
  });

  it('3. formatWatchlistEntry: menghasilkan string terstandarisasi provider:symbol', () => {
    assert.equal(formatWatchlistEntry('BTCUSDT', 'bitunix'), 'bitunix:BTCUSDT');
    assert.equal(formatWatchlistEntry('bitunix:BTCUSDT', 'bitunix'), 'bitunix:BTCUSDT');
    assert.equal(formatWatchlistEntry('BTCUSDT', 'Binance Official Public'), 'binance:BTCUSDT');
    assert.equal(formatWatchlistEntry('BTCIDR', 'indodax'), 'indodax:BTCIDR');
  });

  it('4. Memungkinkan koin BTC yang sama dari Binance dan Bitunix berada dalam satu watchlist tanpa tumpang tindih', () => {
    const list: string[] = [];

    const entry1 = formatWatchlistEntry('BTCUSDT', 'binance');
    const entry2 = formatWatchlistEntry('BTCUSDT', 'bitunix');

    list.push(entry1);
    list.push(entry2);

    assert.equal(list.length, 2);
    assert.ok(list.includes('binance:BTCUSDT'));
    assert.ok(list.includes('bitunix:BTCUSDT'));

    const parsed1 = parseWatchlistEntry(list[0]);
    const parsed2 = parseWatchlistEntry(list[1]);

    assert.equal(parsed1.symbol, 'BTCUSDT');
    assert.equal(parsed1.providerId, 'binance');

    assert.equal(parsed2.symbol, 'BTCUSDT');
    assert.equal(parsed2.providerId, 'bitunix');
  });
});
