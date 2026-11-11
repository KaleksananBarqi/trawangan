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
  isSymbolInWatchlist,
  toggleSymbolInWatchlist,
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

describe('Tiket #166: Seam Pencocokan & Toggle Watchlist Sadar Bursa', () => {
  it('1. isSymbolInWatchlist: mencocokkan entri canonical provider:symbol secara terisolasi per bursa', () => {
    const items = ['binance:BTCUSDT', 'indodax:BTCIDR', 'yahoo:BBCA.JK'];

    assert.equal(isSymbolInWatchlist(items, 'BTCUSDT', 'binance'), true);
    assert.equal(isSymbolInWatchlist(items, 'BTCUSDT', 'bitunix'), false);
    assert.equal(isSymbolInWatchlist(items, 'BTCIDR', 'indodax'), true);
    assert.equal(isSymbolInWatchlist(items, 'BTCIDR', 'binance'), false);
    assert.equal(isSymbolInWatchlist(items, 'BBCA.JK', 'yahoo'), true);
    assert.equal(isSymbolInWatchlist(items, 'BBCA.JK', 'Yahoo Finance'), true);
  });

  it('2. isSymbolInWatchlist: mendukung entri legacy tanpa prefix serta fallback parseWatchlistEntry saat providerId diabaikan', () => {
    // Daftar memuat entri legacy tanpa prefix
    const legacyItems = ['BTCUSDT', 'BTCIDR'];
    assert.equal(isSymbolInWatchlist(legacyItems, 'BTCUSDT', 'binance'), true);
    assert.equal(isSymbolInWatchlist(legacyItems, 'BTCUSDT', 'bitunix'), false);
    assert.equal(isSymbolInWatchlist(legacyItems, 'BTCIDR', 'indodax'), true);
    assert.equal(isSymbolInWatchlist(legacyItems, 'BTCIDR', 'binance'), false);

    // Saat providerId tidak diberikan, fallback mengikuti parseWatchlistEntry (BTCIDR -> indodax)
    const canonicalItems = ['indodax:BTCIDR', 'bitunix:ETHUSDT', 'binance:SOLUSDT'];
    assert.equal(isSymbolInWatchlist(canonicalItems, 'BTCIDR'), true);
    assert.equal(isSymbolInWatchlist(canonicalItems, 'SOLUSDT'), true);
    assert.equal(isSymbolInWatchlist(canonicalItems, 'ETHUSDT'), false);
    assert.equal(isSymbolInWatchlist(canonicalItems, 'bitunix:ETHUSDT'), true);
  });

  it('3. isSymbolInWatchlist: menormalkan huruf/spasi/nama bursa, mengabaikan token #section:, dan aman untuk input kosong', () => {
    const items = [
      '#section:sec_1:Layer 1:0',
      '  binance:BTCUSDT  ',
      '',
      '#section:sec_2:DeFi:1',
    ];

    assert.equal(isSymbolInWatchlist(items, ' btcusdt ', 'Binance Official Public'), true);
    assert.equal(isSymbolInWatchlist(items, 'binance:btcusdt'), true);
    assert.equal(isSymbolInWatchlist(items, '#section:sec_1:Layer 1:0'), false);
    assert.equal(isSymbolInWatchlist(items, '#section:sec_1:Layer 1:0', 'binance'), false);
    assert.equal(isSymbolInWatchlist(items, ''), false);
    assert.equal(isSymbolInWatchlist(items, '   ', 'binance'), false);
    assert.equal(isSymbolInWatchlist(items, 'binance:', 'binance'), false);
    assert.equal(isSymbolInWatchlist([], 'BTCUSDT', 'binance'), false);
  });

  it('4. toggleSymbolInWatchlist: menambahkan entri canonical di slot atas tanpa kategori meskipun #section: ada', () => {
    // Kasus daftar datar tanpa kategori -> masuk ke indeks 0
    const flat = ['binance:ETHUSDT'];
    const addFlat = toggleSymbolInWatchlist(flat, 'btcusdt', 'binance');
    assert.deepEqual(addFlat, {
      items: ['binance:BTCUSDT', 'binance:ETHUSDT'],
      added: true,
      entry: 'binance:BTCUSDT',
    });
    assert.deepEqual(flat, ['binance:ETHUSDT'], 'Array input asal tidak boleh termutasi');

    // Kasus daftar dengan kategori & item uncategorized -> masuk sebelum #section pertama
    const withSections = ['binance:ETHUSDT', '#section:sec_l1:Layer 1:0', 'binance:SOLUSDT'];
    const addBeforeSection = toggleSymbolInWatchlist(withSections, 'BTCUSDT', 'bitunix');
    assert.deepEqual(addBeforeSection, {
      items: ['binance:ETHUSDT', 'bitunix:BTCUSDT', '#section:sec_l1:Layer 1:0', 'binance:SOLUSDT'],
      added: true,
      entry: 'bitunix:BTCUSDT',
    });

    // Kasus daftar langsung diawali kategori -> masuk di indeks 0 sebelum #section pertama
    const sectionsOnly = ['#section:sec_l1:Layer 1:0', 'binance:SOLUSDT'];
    const addTopBeforeFirstSection = toggleSymbolInWatchlist(sectionsOnly, 'BTCUSDT', 'binance');
    assert.deepEqual(addTopBeforeFirstSection, {
      items: ['binance:BTCUSDT', '#section:sec_l1:Layer 1:0', 'binance:SOLUSDT'],
      added: true,
      entry: 'binance:BTCUSDT',
    });

    // Kasus providerId diabaikan untuk pair IDR -> infer indodax
    const addLegacyIdr = toggleSymbolInWatchlist([], 'btcidr');
    assert.deepEqual(addLegacyIdr, {
      items: ['indodax:BTCIDR'],
      added: true,
      entry: 'indodax:BTCIDR',
    });
  });

  it('5. toggleSymbolInWatchlist: menghapus entri canonical dan duplikat legacy tanpa menyentuh #section: atau bursa lain', () => {
    const mixedList = [
      'BTCUSDT',
      '#section:sec_1:Layer 1:0',
      'binance:BTCUSDT',
      'bitunix:BTCUSDT',
      'binance:SOLUSDT',
    ];

    const removedBinance = toggleSymbolInWatchlist(mixedList, 'BTCUSDT', 'binance');
    assert.deepEqual(removedBinance, {
      items: ['#section:sec_1:Layer 1:0', 'bitunix:BTCUSDT', 'binance:SOLUSDT'],
      added: false,
      entry: 'binance:BTCUSDT',
    });

    // Hapus item legacy BTCIDR tanpa providerId eksplisit (fallback ke indodax)
    const removedLegacyIdr = toggleSymbolInWatchlist(['BTCIDR', 'binance:BTCUSDT'], 'BTCIDR');
    assert.deepEqual(removedLegacyIdr, {
      items: ['binance:BTCUSDT'],
      added: false,
      entry: 'indodax:BTCIDR',
    });
  });

  it('6. toggleSymbolInWatchlist: mengabaikan input kosong atau token #section: dengan aman', () => {
    const items = ['binance:BTCUSDT', '#section:sec_1:Layer 1:0'];
    assert.deepEqual(toggleSymbolInWatchlist(items, ''), {
      items: ['binance:BTCUSDT', '#section:sec_1:Layer 1:0'],
      added: false,
      entry: '',
    });
    assert.deepEqual(toggleSymbolInWatchlist(items, '#section:sec_1:Layer 1:0', 'binance'), {
      items: ['binance:BTCUSDT', '#section:sec_1:Layer 1:0'],
      added: false,
      entry: '',
    });
  });
});

