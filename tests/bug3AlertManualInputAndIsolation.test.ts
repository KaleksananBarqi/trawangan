import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlertModalInitialDraft,
  buildAlertModalInitSignature,
  buildAutoAlertLabel,
  computeAlertPriceDiff,
  computeTickAlignedAlertPrice,
  inferAlertConditionFromPrice,
  mergeAlertSymbolSuggestions,
  parseAlertPriceInput,
  resolveAlertReferenceMarketPrice,
  resolveAlertTargetSymbol,
  shouldInitializeAlertModalSession,
} from '../src/lib/services/alertFormHelper';
import { formatPriceWithQuoteSymbol } from '../src/lib/services/priceScaleLabelService';
import { MarketFeedService } from '../src/lib/services/market';
import { alertService } from '../src/lib/services/alertService';

describe('Bug 3 Regression: Input Manual Alert & Isolasi Harga Simbol Modal', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop()!;
      await alertService.deleteAlert(id);
    }
  });

  it('1. parseAlertPriceInput memparsing desimal titik/koma, pemisah ribuan, & simbol mata uang secara aman', () => {
    assert.equal(parseAlertPriceInput('68500.25'), 68500.25);
    assert.equal(parseAlertPriceInput('68500,5'), 68500.5);
    assert.equal(parseAlertPriceInput('0,00045'), 0.00045);
    assert.equal(parseAlertPriceInput('2,500'), 2500);
    assert.equal(parseAlertPriceInput('65,432.10'), 65432.1);
    assert.equal(parseAlertPriceInput('1.450.000,75'), 1450000.75);
    assert.equal(parseAlertPriceInput('$ 3,150.25'), 3150.25);
    assert.equal(parseAlertPriceInput('Rp 1.500.000'), 1500000);
    assert.equal(parseAlertPriceInput('Rp1.500.000'), 1500000);
    assert.equal(parseAlertPriceInput('68500 USDT'), 68500);
    assert.equal(parseAlertPriceInput('1.450.000 IDR'), 1450000);

    assert.equal(parseAlertPriceInput('12idr34'), null);
    assert.equal(parseAlertPriceInput('12usdt34'), null);
    assert.equal(parseAlertPriceInput(''), null);
    assert.equal(parseAlertPriceInput('0'), null);
    assert.equal(parseAlertPriceInput('-120'), null);
    assert.equal(parseAlertPriceInput('abc'), null);
  });

  it('2. Session guard CreateAlertModal mengabaikan ticker ticks saat modal sedang terbuka agar input manual tidak tertimpa', () => {
    const sig1 = buildAlertModalInitSignature({
      initialSymbol: 'BTCUSDT',
      initialPrice: 90000,
      editingAlert: null,
    });
    // Perhatikan signature tidak mengandung currentMarketPrice!
    const sigAfterTick = buildAlertModalInitSignature({
      initialSymbol: 'BTCUSDT',
      initialPrice: 90000,
      editingAlert: null,
    });
    assert.equal(sig1, sigAfterTick);

    // Buka modal pertama kali -> wajib inisialisasi
    const openStep = shouldInitializeAlertModalSession({
      isOpen: true,
      wasOpen: false,
      initSignature: sig1,
      lastInitSignature: null,
    });
    assert.equal(openStep.shouldInit, true);

    // Simulasikan 10 ticker live incoming -> signature sama & wasOpen true -> JANGAN reset form
    const tickStep = shouldInitializeAlertModalSession({
      isOpen: true,
      wasOpen: openStep.nextWasOpen,
      initSignature: sigAfterTick,
      lastInitSignature: openStep.nextSignature,
    });
    assert.equal(tickStep.shouldInit, false);

    // Saat modal ditutup lalu dibuka kembali -> wajib inisialisasi ulang
    const closeStep = shouldInitializeAlertModalSession({
      isOpen: false,
      wasOpen: tickStep.nextWasOpen,
      initSignature: sig1,
      lastInitSignature: tickStep.nextSignature,
    });
    assert.equal(closeStep.shouldInit, false);
    assert.equal(closeStep.nextWasOpen, false);

    const reopenStep = shouldInitializeAlertModalSession({
      isOpen: true,
      wasOpen: closeStep.nextWasOpen,
      initSignature: sig1,
      lastInitSignature: closeStep.nextSignature,
    });
    assert.equal(reopenStep.shouldInit, true);
  });

  it('3. resolveAlertReferenceMarketPrice mencegah harga chart (BTCUSDT) bocor saat user memilih koin lain (ETHUSDT)', () => {
    assert.equal(resolveAlertTargetSymbol('eth', 'BTCUSDT'), 'ETHUSDT');
    assert.equal(resolveAlertTargetSymbol('binance:SOL/USDT.P', 'BTCUSDT'), 'SOLUSDT.P');

    // Simbol sama dengan chart -> gunakan chartMarketPrice
    const sameCoinRef = resolveAlertReferenceMarketPrice({
      typedSymbol: 'BTCUSDT.P',
      chartSymbol: 'BTCUSDT',
      chartMarketPrice: 91500,
      cachedTickerPrice: null,
    });
    assert.equal(sameCoinRef, 91500);

    // Simbol berbeda (ETHUSDT) tanpa cache ticker -> HARUS 0, dilarang memakai 91500 (harga BTC)!
    const otherCoinNoCache = resolveAlertReferenceMarketPrice({
      typedSymbol: 'ETHUSDT',
      chartSymbol: 'BTCUSDT',
      chartMarketPrice: 91500,
      cachedTickerPrice: null,
    });
    assert.equal(otherCoinNoCache, 0);
    assert.equal(computeAlertPriceDiff('3300', otherCoinNoCache), null);

    // Simbol berbeda dengan ticker ETHUSDT tersedia (3200) -> gunakan 3200
    const otherCoinWithCache = resolveAlertReferenceMarketPrice({
      typedSymbol: 'eth',
      chartSymbol: 'BTCUSDT',
      chartMarketPrice: 91500,
      cachedTickerPrice: 3200,
    });
    assert.equal(otherCoinWithCache, 3200);
    const diff = computeAlertPriceDiff('3360', otherCoinWithCache);
    assert.ok(diff);
    assert.equal(diff.diff, 160);
    assert.equal(diff.pct, 5);
    assert.equal(diff.isHigher, true);
  });

  it('4. Draft builder, auto-label, & alertService.updateAlert mendukung perubahan simbol lintas koin', async () => {
    const initial = buildAlertModalInitialDraft({
      initialSymbol: 'BTCUSDT',
      initialPrice: 92000,
      currentMarketPrice: 90000,
      editingAlert: null,
    });
    assert.equal(initial.symbol, 'BTCUSDT');
    assert.equal(initial.targetPrice, '92000');
    assert.equal(initial.condition, 'crossing_up');
    assert.equal(inferAlertConditionFromPrice(88000, 90000), 'crossing_down');
    assert.equal(buildAutoAlertLabel('ETHUSDT', '3250'), 'Target ETHUSDT @ 3250');

    const suggestions = mergeAlertSymbolSuggestions(
      'BTCUSDT',
      ['###CRYPTO', 'binance:BTCUSDT', 'ETHUSDT', 'SOL/USDT.P'],
      'eth'
    );
    assert.deepEqual(suggestions, ['ETH', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT.P']);

    // Buat alert pada BTCUSDT lalu sunting menjadi ETHUSDT dengan target manual 3150
    const created = await alertService.addAlert({
      symbol: 'btcusdt',
      targetPrice: 91000,
      condition: 'crossing_up',
      frequency: 'once',
    });
    createdIds.push(created.id);
    assert.equal(created.symbol, 'BTCUSDT');

    const updated = await alertService.updateAlert(created.id, {
      symbol: '  ethusdt ',
      targetPrice: 3150,
      condition: 'less_than',
      frequency: 'every_time',
      label: 'ETH Demand Zone',
    });
    assert.ok(updated);
    assert.equal(updated.symbol, 'ETHUSDT');
    assert.equal(updated.targetPrice, 3150);
    assert.equal(updated.condition, 'less_than');
    assert.equal(updated.frequency, 'every_time');
    assert.equal(updated.label, 'ETH Demand Zone');
  });

  it('5. Edit alert lintas koin menjaga chartSymbol tetap terisolasi, format quote BTC tanpa "$", & tick alignment konsisten', async () => {
    // Skenario edit alert ETHUSDT ketika chart aktif masih BTCUSDT (harga 91500)
    const editEthAlert: any = {
      id: 'edit_eth_1',
      symbol: 'ETHUSDT',
      targetPrice: 3250,
      condition: 'crossing_up',
      frequency: 'once',
      label: 'ETH Watch',
      active: true,
      triggered: false,
      createdAt: 1,
    };
    const editDraft = buildAlertModalInitialDraft({
      initialSymbol: editEthAlert.symbol,
      initialPrice: editEthAlert.targetPrice,
      currentMarketPrice: 91500,
      editingAlert: editEthAlert,
    });
    assert.equal(editDraft.symbol, 'ETHUSDT');
    // Saat modal tahu chartSymbol asli adalah 'BTCUSDT', harga 91500 tidak boleh dianggap milik ETHUSDT
    const isolatedEditRef = resolveAlertReferenceMarketPrice({
      typedSymbol: editDraft.symbol,
      chartSymbol: 'BTCUSDT',
      chartMarketPrice: 91500,
      cachedTickerPrice: null,
    });
    assert.equal(isolatedEditRef, 0);

    // Kepatuhan Crypto-Denominated Precision (BTC & quote kripto lain tidak diawali '$')
    assert.equal(formatPriceWithQuoteSymbol(0.032, 'BTC'), '0.03200000 ₿');
    assert.equal(formatPriceWithQuoteSymbol(0.45, 'ETH'), '0.450000 ETH');
    assert.equal(formatPriceWithQuoteSymbol(91500, 'USDT'), '$91,500.00');
    assert.equal(formatPriceWithQuoteSymbol(1500000, 'IDR'), 'Rp 1.500.000');

    // Preset & submit alignment terhadap tickSize
    const alignedSame = computeTickAlignedAlertPrice(91500 * 1.01, true, 0.5);
    assert.equal(alignedSame.price, 92415);
    assert.equal(alignedSame.formattedText, '92415');
    const alignedMicro = computeTickAlignedAlertPrice(0.000012349, false);
    assert.equal(alignedMicro.price, 0.00001235);
    assert.equal(alignedMicro.formattedText, '0.00001235');

    // Uji MarketFeedService.watchSymbolTicker & pembatalan sebelum debounce berakhir
    const feed = new MarketFeedService();
    let fetchCount = 0;
    feed.registerAdapter({
      id: 'binance',
      name: 'Mock Binance',
      fetchTicker: async (sym: string) => {
        fetchCount++;
        return {
          symbol: sym,
          name: sym,
          price: sym === 'ETHUSDT' ? 3210 : 0,
          change24h: 0,
          changePercent24h: 0,
          high24h: 3250,
          low24h: 3180,
          volume24h: 1000,
        };
      },
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async () => [],
    });

    const receivedPrices: Array<number | null> = [];
    const unsubCanceled = feed.watchSymbolTicker(
      'ETHUSDT',
      (t) => receivedPrices.push(t?.price ?? null),
      { debounceMs: 40 }
    );
    // Batalkan segera sebelum debounce 40ms berakhir
    unsubCanceled();
    await new Promise((r) => setTimeout(r, 65));
    assert.equal(fetchCount, 0, 'watchSymbolTicker yang dibatalkan sebelum debounce tidak boleh memicu fetch');

    let settledPrice: number | null = null;
    const loadingStates: boolean[] = [];
    const unsubLive = feed.watchSymbolTicker(
      'ETHUSDT',
      (t) => {
        settledPrice = t?.price ?? null;
      },
      {
        debounceMs: 15,
        onLoadingChange: (loading) => loadingStates.push(loading),
      }
    );
    await new Promise((r) => setTimeout(r, 45));
    unsubLive();
    assert.equal(fetchCount, 1);
    assert.equal(settledPrice, 3210);
    assert.deepEqual(loadingStates, [true, false]);
  });
});
