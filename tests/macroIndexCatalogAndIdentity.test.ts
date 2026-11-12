import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MACRO_INDEX_CATALOG,
  canonicalizeMacroIndexSymbol,
  isMacroDominanceSymbol,
  isMacroIndexSymbol,
  resolveMacroIndexDescriptor,
} from '../src/lib/services/macroIndexCatalog';
import {
  getCellMarketIdentity,
  normalizeSymbolForMatching,
  parseInstrumentIdentity,
  resolveCanonicalInstrumentSymbol,
  resolveDrawingStorageKey,
  resolveVelaSymbolKey,
  routeVenueForSymbol,
} from '../src/lib/services/instrumentIdentity';
import {
  formatWatchlistEntry,
  isSymbolInWatchlist,
  parseWatchlistEntry,
  removeSymbolFromWatchlist,
  toggleSymbolInWatchlist,
} from '../src/lib/services/watchlistUtils';
import {
  getMonogramColor,
  getMonogramInitials,
  resolveCoinLogoUrl,
} from '../src/lib/services/symbolLogoService';
import { SymbolSearchEngine } from '../src/lib/services/market/symbolSearchService';

describe('ADR-0024: Katalog Indeks Makro, Identitas Instrumen, & Isolasi Watchlist', () => {
  test('1. Seluruh 7 simbol makro kanonikal beserta aliasnya terpetakan akurat', () => {
    assert.equal(MACRO_INDEX_CATALOG.length, 7);

    const cases: Array<[string, string | null]> = [
      ['TOTAL', 'TOTAL'],
      ['total1', 'TOTAL'],
      ['TOTALCAP', 'TOTAL'],
      ['cryptocap', 'TOTAL'],
      ['CRYPTOTOTALMARKETCAP', 'TOTAL'],
      ['macro:total', 'TOTAL'],
      ['CRYPTOCAP:TOTAL1', 'TOTAL'],
      ['INDEX:TOTAL2', 'TOTAL2'],
      ['TOTALEXBTC', 'TOTAL2'],
      ['TOTAL3', 'TOTAL3'],
      ['OTHERS', 'OTHERS'],
      ['otherscap', 'OTHERS'],
      ['BTC.D', 'BTC.D'],
      ['btcd', 'BTC.D'],
      ['BTC-D', 'BTC.D'],
      ['ETH.D', 'ETH.D'],
      ['ethdom', 'ETH.D'],
      ['USDT.D', 'USDT.D'],
      ['usdt/d', 'USDT.D'],
      // Simbol non-makro atau ber-prefix bursa lain harus tetap null
      ['BTC', null],
      ['BTCUSDT', null],
      ['BBCA.JK', null],
      ['binance:TOTAL', null],
    ];

    for (const [input, expected] of cases) {
      assert.equal(canonicalizeMacroIndexSymbol(input), expected, `Alias gagal untuk "${input}"`);
      assert.equal(isMacroIndexSymbol(input), expected !== null);
    }

    assert.equal(isMacroDominanceSymbol('BTC.D'), true);
    assert.equal(isMacroDominanceSymbol('ETHD'), true);
    assert.equal(isMacroDominanceSymbol('USDT.D'), true);
    assert.equal(isMacroDominanceSymbol('TOTAL'), false);
    assert.equal(resolveMacroIndexDescriptor('TOTAL2')?.quoteUnit, 'USD');
    assert.equal(resolveMacroIndexDescriptor('BTCD')?.quoteUnit, '%');
  });

  test('2. Resolusi simbol instrumen menjaga keutuhan .D dan tidak membocorkan quote makro ke koin biasa', () => {
    // Jika chart aktif adalah indeks makro lalu user membuka alert/target "ETH", jangan pernah menjadi "ETHTOTAL".
    assert.equal(resolveCanonicalInstrumentSymbol('ETH', 'TOTAL'), 'ETHUSDT');
    assert.equal(resolveCanonicalInstrumentSymbol('SOL', 'BTC.D'), 'SOLUSDT');
    assert.equal(resolveCanonicalInstrumentSymbol('btcd', 'BTCUSDT'), 'BTC.D');
    assert.equal(resolveCanonicalInstrumentSymbol('total1', 'ETHUSDT'), 'TOTAL');

    // Titik dominansi (.D) harus terjaga dan terbedakan dari simbol USD biasa.
    assert.equal(normalizeSymbolForMatching('BTC.D'), 'BTC.D');
    assert.equal(normalizeSymbolForMatching('btcd'), 'BTC.D');
    assert.equal(normalizeSymbolForMatching('macro:BTCDOM'), 'BTC.D');
    assert.notEqual(normalizeSymbolForMatching('BTC.D'), normalizeSymbolForMatching('BTCUSD'));
    assert.equal(normalizeSymbolForMatching('ETH.D'), 'ETH.D');
    assert.equal(normalizeSymbolForMatching('USDT.D'), 'USDT.D');

    // Normalisasi pair reguler tetap identik.
    assert.equal(normalizeSymbolForMatching('BTC-USDT'), 'BTCUSDT');
    assert.equal(normalizeSymbolForMatching('binance:SOLUSDT.P'), 'SOLUSDT');

    const macroIdentity = parseInstrumentIdentity('macro:BTC.D');
    assert.equal(macroIdentity.providerId, 'macro');
    assert.equal(macroIdentity.canonicalSymbol, 'BTC.D');
    assert.equal(macroIdentity.quote, '%');

    const regularIdentity = parseInstrumentIdentity('ETHUSDT');
    assert.equal(regularIdentity.providerId, 'binance');
    assert.equal(regularIdentity.quote, 'USDT');
  });

  test('3. Venue routing, kunci Vela, & kunci drawing memisahkan macro dari bursa trading reguler', () => {
    assert.equal(routeVenueForSymbol('TOTAL', 'binance'), 'macro');
    assert.equal(routeVenueForSymbol('btcd', 'indodax'), 'macro');
    // Saat berpindah dari chart macro ke simbol reguler, provider tidak boleh tertinggal di 'macro'.
    assert.equal(routeVenueForSymbol('BTCUSDT', 'macro'), 'binance');
    assert.equal(routeVenueForSymbol('BBCA.JK', 'macro'), 'yahoo');
    assert.equal(routeVenueForSymbol('BTCIDR', 'macro'), 'indodax');
    assert.equal(routeVenueForSymbol('ETHUSDT', 'coinbase'), 'coinbase');

    assert.equal(resolveVelaSymbolKey('total1', 'binance'), 'macro:TOTAL');
    assert.equal(resolveVelaSymbolKey('btcd', 'macro'), 'macro:BTC.D');
    assert.equal(resolveVelaSymbolKey('BTCUSDT', 'binance'), 'binance:BTCUSDT');

    assert.equal(resolveDrawingStorageKey('binance', 'btcd', 'ws1'), 'ws1:macro:BTC.D');
    assert.equal(resolveDrawingStorageKey('binance', 'BTCUSDT', 'ws1'), 'ws1:binance:BTCUSDT');

    assert.deepEqual(getCellMarketIdentity({ symbol: 'totalcap', providerId: 'binance' }), {
      providerId: 'macro',
      symbol: 'TOTAL',
    });
  });

  test('4. Serialisasi watchlist macro:* dan toggle menjaga entri reguler & pembatas #section', () => {
    assert.deepEqual(parseWatchlistEntry('TOTAL'), { providerId: 'macro', symbol: 'TOTAL' });
    assert.deepEqual(parseWatchlistEntry('btcd'), { providerId: 'macro', symbol: 'BTC.D' });
    assert.deepEqual(parseWatchlistEntry('macro:TOTAL3'), { providerId: 'macro', symbol: 'TOTAL3' });
    assert.deepEqual(parseWatchlistEntry('BTCIDR'), { providerId: 'indodax', symbol: 'BTCIDR' });

    assert.equal(formatWatchlistEntry('TOTAL1', 'binance'), 'macro:TOTAL');
    assert.equal(formatWatchlistEntry('BTC.D'), 'macro:BTC.D');
    assert.equal(formatWatchlistEntry('BTCUSDT', 'binance'), 'binance:BTCUSDT');

    let items = ['#section:sec_1:MAKRO:0', 'binance:BTCUSDT', 'indodax:BTCIDR'];
    const addRes = toggleSymbolInWatchlist(items, 'btcd', 'macro');
    assert.equal(addRes.added, true);
    assert.equal(addRes.entry, 'macro:BTC.D');
    items = addRes.items;

    assert.equal(isSymbolInWatchlist(items, 'BTC.D', 'macro'), true);
    assert.equal(isSymbolInWatchlist(items, 'BTCD'), true);
    assert.equal(isSymbolInWatchlist(items, 'BTCUSDT', 'binance'), true);

    const afterRemove = removeSymbolFromWatchlist(items, 'BTC.D', 'macro');
    assert.equal(isSymbolInWatchlist(afterRemove, 'BTC.D', 'macro'), false);
    assert.ok(afterRemove.includes('#section:sec_1:MAKRO:0'));
    assert.ok(afterRemove.includes('binance:BTCUSDT'));
  });

  test('5. Engine logo memakai monogram offline untuk indeks makro tanpa menyentuh logo koin reguler', () => {
    const totalLogo = resolveCoinLogoUrl('TOTAL');
    assert.equal(totalLogo.primary, '');
    assert.equal(totalLogo.cdnFallback, '');
    assert.equal(totalLogo.isLocal, true);
    assert.equal(totalLogo.baseAsset, 'TOTAL');

    const btcDomLogo = resolveCoinLogoUrl('btcd');
    assert.equal(btcDomLogo.primary, '');
    assert.equal(btcDomLogo.cdnFallback, '');
    assert.equal(btcDomLogo.isLocal, true);
    assert.equal(btcDomLogo.baseAsset, 'BTC.D');

    assert.equal(getMonogramInitials('TOTAL'), 'TOT');
    assert.equal(getMonogramInitials('TOTAL2'), 'TOT2');
    assert.equal(getMonogramInitials('TOTAL3'), 'TOT3');
    assert.equal(getMonogramInitials('OTHERS'), 'OTHR');
    assert.equal(getMonogramInitials('BTC.D'), 'BTC%');
    assert.equal(getMonogramInitials('ETH.D'), 'ETH%');
    assert.equal(getMonogramInitials('USDT.D'), 'USD%');

    assert.equal(getMonogramColor('TOTAL'), getMonogramColor('TOTAL'));
    // Regresi logo koin reguler harus nol.
    assert.equal(resolveCoinLogoUrl('BTC').primary, '/icons/coins/btc.svg');
    assert.equal(resolveCoinLogoUrl('BTCUSDT').primary, '/icons/coins/btc.svg');
  });

  test('6. Pencarian simbol mengurutkan alias makro di atas & tidak membuat pair palsu TOTALUSDT', async () => {
    const engine = new SymbolSearchEngine();
    const resAlias = await engine.search('total1');
    assert.ok(resAlias.length > 0);
    assert.equal(resAlias[0].symbol, 'TOTAL');
    assert.equal(resAlias[0].provider, 'Macro Index');
    assert.equal(
      resAlias.some((r) => r.symbol.includes('TOTAL1USDT')),
      false,
      'Alias makro tidak boleh memicu sintesis pair spot USDT palsu'
    );

    const resDom = await engine.search('btcd');
    assert.ok(resDom.length > 0);
    assert.equal(resDom[0].symbol, 'BTC.D');
    assert.equal(resDom[0].quoteAsset, '%');

    const btcRegular = await engine.search('BTC');
    assert.ok(btcRegular.some((r) => r.symbol === 'BTCUSDT' && r.provider === 'Binance Spot'));
  });
});
