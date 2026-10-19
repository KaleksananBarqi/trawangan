// Unit & Seam Tests untuk Tiket #68: Exchange-Aware Watchlist Data Model, UI Badges, and One-Click Routing
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWatchlistEntry,
  formatWatchlistEntry,
  isSectionToken,
  formatSectionToken,
  parseSectionToken,
  insertSymbolIntoSection,
  moveItemToSection,
  reorderWatchlistItems,
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

  it('5. Utilitas Section Token: format, parse, dan deteksi token pembatas kategori', () => {
    const token = formatSectionToken('Layer 1', 'sec_123', false);
    assert.equal(token, '#section:sec_123:Layer 1:0');
    assert.equal(isSectionToken(token), true);
    assert.equal(isSectionToken('binance:BTCUSDT'), false);

    const parsed = parseSectionToken(token);
    assert.deepEqual(parsed, {
      id: 'sec_123',
      name: 'Layer 1',
      isCollapsed: false,
    });

    const collapsedToken = formatSectionToken('DeFi Protocol', 'sec_456', true);
    assert.equal(collapsedToken, '#section:sec_456:DeFi Protocol:1');
    assert.equal(parseSectionToken(collapsedToken)?.isCollapsed, true);

    // parseWatchlistEntry aman dan tidak menganggap section sebagai koin
    const parsedEntry = parseWatchlistEntry(token);
    assert.equal(parsedEntry.symbol, '');
  });

  it('6. insertSymbolIntoSection: menempatkan koin baru ke seksi target atau seksi terbuka', () => {
    const list = [
      'binance:BTCUSDT',
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      '#section:sec_defi:DeFi:0',
      'binance:UNIUSDT',
    ];

    // Sisipkan ke seksi DeFi
    const updated1 = insertSymbolIntoSection(list, 'binance:AAVEUSDT', 'sec_defi');
    assert.deepEqual(updated1, [
      'binance:BTCUSDT',
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      '#section:sec_defi:DeFi:0',
      'binance:UNIUSDT',
      'binance:AAVEUSDT',
    ]);

    // Sisipkan ke seksi Layer 1 (harus masuk sebelum #section:sec_defi)
    const updated2 = insertSymbolIntoSection(list, 'binance:AVAXUSDT', 'sec_l1');
    assert.deepEqual(updated2, [
      'binance:BTCUSDT',
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      'binance:AVAXUSDT',
      '#section:sec_defi:DeFi:0',
      'binance:UNIUSDT',
    ]);

    // Sisipkan ke tanpa kategori (targetSectionId = null, harus sebelum #section pertama)
    const updated3 = insertSymbolIntoSection(list, 'binance:ETHUSDT', null);
    assert.deepEqual(updated3, [
      'binance:BTCUSDT',
      'binance:ETHUSDT',
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      '#section:sec_defi:DeFi:0',
      'binance:UNIUSDT',
    ]);
  });

  it('7. moveItemToSection: memindahkan koin ke seksi yang ditentukan', () => {
    const list = [
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      'binance:UNIUSDT', // salah tempat
      '#section:sec_defi:DeFi:0',
      'binance:AAVEUSDT',
    ];

    const moved = moveItemToSection(list, 'binance:UNIUSDT', 'sec_defi');
    assert.deepEqual(moved, [
      '#section:sec_l1:Layer 1:0',
      'binance:SOLUSDT',
      '#section:sec_defi:DeFi:0',
      'binance:AAVEUSDT',
      'binance:UNIUSDT',
    ]);
  });

  it('8. reorderWatchlistItems: memindahkan item sebelum atau sesudah target saat Drag & Drop', () => {
    const list = ['A', 'B', 'C', 'D'];

    // Pindahkan D ke sebelum B (index 3 -> sebelum index 1)
    const res1 = reorderWatchlistItems(list, 3, 1, 'before');
    assert.deepEqual(res1, ['A', 'D', 'B', 'C']);

    // Pindahkan A ke sesudah C (index 0 -> setelah index 2)
    const res2 = reorderWatchlistItems(list, 0, 2, 'after');
    assert.deepEqual(res2, ['B', 'C', 'A', 'D']);
  });
});

