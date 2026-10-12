import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MarketFeedService } from '../src/lib/services/market/index';
import { MockMarketAdapter } from '../src/lib/services/market/adapters/mockAdapter';
import { alertService } from '../src/lib/services/alertService';
import type { PriceAlert } from '../src/lib/types/market';

describe('Deep Market Feed Module Unit Tests', () => {
  let feed: MarketFeedService;
  let mockAdapter: MockMarketAdapter;

  beforeEach(() => {
    feed = new MarketFeedService();
    mockAdapter = new MockMarketAdapter();
    feed.registerAdapter(mockAdapter);
    feed.setActiveProvider('mock');
  });

  afterEach(() => {
    feed.destroy();
  });

  test('Active Ticker: langganan simbol aktif menerima pembaruan harga', async () => {
    mockAdapter.setMockPrice('BTCUSDT', 67500, 1.5);

    let receivedPrice = 0;
    const unsub = feed.subscribeActiveTicker('BTCUSDT', (t) => {
      receivedPrice = t.price;
    });

    // Jalankan satu putaran polling manual
    await feed.pollTick();
    assert.strictEqual(receivedPrice, 67500);

    // Ubah harga mock dan poll ulang
    mockAdapter.setMockPrice('BTCUSDT', 68000, 2.2);
    await feed.pollTick();
    assert.strictEqual(receivedPrice, 68000);

    unsub();
  });

  test('Watchlist: langganan daftar simbol menerima map ticker lengkap', async () => {
    mockAdapter.setMockPrice('ETHUSDT', 3550, -0.5);
    mockAdapter.setMockPrice('SOLUSDT', 195, 4.2);

    let receivedMap: Record<string, any> = {};
    const unsub = feed.subscribeWatchlistTickers(['ETHUSDT', 'SOLUSDT'], (map) => {
      receivedMap = map;
    });

    await feed.pollTick();
    assert.ok(receivedMap['ETHUSDT']);
    assert.strictEqual(receivedMap['ETHUSDT'].price, 3550);
    assert.ok(receivedMap['SOLUSDT']);
    assert.strictEqual(receivedMap['SOLUSDT'].price, 195);

    unsub();
  });

  test('Locality: pembaruan harga di market feed otomatis mengevaluasi price alert', async () => {
    // Buat alert di alertService
    const createdAlert = await alertService.addAlert({
      symbol: 'BTCUSDT',
      targetPrice: 70000,
      condition: 'crossing_up',
    });

    let triggeredEvent: PriceAlert | null = null;
    const unsubAlert = alertService.onTrigger((alert) => {
      triggeredEvent = alert;
    });

    // Berlangganan ke feed
    const unsubFeed = feed.subscribeActiveTicker('BTCUSDT', () => {});

    // 1. Harga di bawah target
    mockAdapter.setMockPrice('BTCUSDT', 69500);
    await feed.pollTick();
    assert.strictEqual(triggeredEvent, null);

    // 2. Harga menembus target (crossing up)
    mockAdapter.setMockPrice('BTCUSDT', 70100);
    await feed.pollTick();

    assert.ok(triggeredEvent);
    assert.strictEqual((triggeredEvent as PriceAlert).id, createdAlert.id);
    assert.strictEqual((triggeredEvent as PriceAlert).symbol, 'BTCUSDT');

    unsubAlert();
    unsubFeed();
    await alertService.deleteAlert(createdAlert.id);
  });

  test('Direct Readers: getCandles dan searchSymbols berfungsi tanpa perlu langganan', async () => {
    const candles = await feed.getCandles('BTCUSDT', '15m', 10);
    assert.ok(Array.isArray(candles));
    assert.strictEqual(candles.length, 10);
    assert.ok(candles[0].open > 0);

    const searchResults = await feed.searchSymbols('BTC');
    assert.ok(Array.isArray(searchResults));
    assert.ok(searchResults.length > 0);
    assert.strictEqual(searchResults[0].baseAsset, 'BTC');
  });

  test('Unsubscribe: penghentian langganan membersihkan listener dengan rapi', async () => {
    let callCount = 0;
    const unsub = feed.subscribeActiveTicker('BTCUSDT', () => {
      callCount++;
    });

    await feed.pollTick();
    assert.ok(callCount >= 1);
    const countBeforeUnsub = callCount;

    unsub();
    await feed.pollTick();
    assert.strictEqual(callCount, countBeforeUnsub);
  });

  test('Feed Connection Guard: kegagalan berturut-turut memicu status stalled dan blocked (ISP block detection)', async () => {
    let latestStatus: any = null;
    const unsub = feed.onConnectionChange((status) => {
      latestStatus = status;
    });

    assert.ok(latestStatus);
    assert.strictEqual(latestStatus.state, 'connected');
    assert.strictEqual(latestStatus.errorCount, 0);

    // Pasang subscriber aktif agar pollTick melakukan eksekusi
    const unsubTicker = feed.subscribeActiveTicker('BTCUSDT', () => {});

    // Simulasi kegagalan 1: beralih ke 'stalled'
    mockAdapter.setSimulateFailure(true);
    await feed.pollTick();
    assert.strictEqual(latestStatus.state, 'stalled');
    assert.strictEqual(latestStatus.errorCount, 1);

    // Simulasi kegagalan 2: tetap 'stalled'
    await feed.pollTick();
    assert.strictEqual(latestStatus.state, 'stalled');
    assert.strictEqual(latestStatus.errorCount, 2);

    // Simulasi kegagalan 3: mencapai ambang batas (threshold=3) -> beralih ke 'blocked'
    await feed.pollTick();
    assert.strictEqual(latestStatus.state, 'blocked');
    assert.strictEqual(latestStatus.errorCount, 3);
    assert.ok(latestStatus.message?.includes('terhambat'));

    // Pemulihan 1: resetConnectionError
    feed.resetConnectionError();
    assert.strictEqual(latestStatus.state, 'connected');
    assert.strictEqual(latestStatus.errorCount, 0);

    // Pemulihan 2: saat jaringan kembali normal dan pollTick sukses
    mockAdapter.setSimulateFailure(false);
    await feed.pollTick();
    assert.strictEqual(latestStatus.state, 'connected');

    unsubTicker();
    unsub();
  });

  test('Multi-Quote & Exchange-Aware Symbol Search: mendukung BTC/IDR, exchange chips, dan quoteAsset filters', async () => {
    // Daftarkan mock adapter kedua yang bertindak sebagai Indodax
    const indodaxMock = {
      id: 'indodax',
      name: 'Indodax Spot',
      fetchTicker: async () => ({ symbol: 'BTCIDR', name: 'BTCIDR', price: 1500000000, change24h: 1.5, high24h: 1510000000, low24h: 1480000000, volume24h: 100 }),
      fetchBatchTickers: async () => ({}),
      fetchCandles: async () => [],
      searchSymbols: async (q: string) => {
        const clean = q.toUpperCase().replace(/[\/\-_]/g, '');
        const items = [
          { symbol: 'BTCIDR', baseAsset: 'BTC', quoteAsset: 'IDR', displayName: 'Bitcoin Rupiah', type: 'spot' as const, provider: 'Indodax Spot' },
          { symbol: 'ETHIDR', baseAsset: 'ETH', quoteAsset: 'IDR', displayName: 'Ethereum Rupiah', type: 'spot' as const, provider: 'Indodax Spot' },
        ];
        return items.filter((i) => !clean || i.symbol.includes(clean) || i.baseAsset.includes(clean));
      },
    };
    feed.registerAdapter(indodaxMock);

    // 1. Pencarian dengan format garis miring "BTC/IDR"
    const resultsSlash = await feed.searchSymbols('BTC/IDR', { exchange: 'all' });
    assert.ok(resultsSlash.length > 0);
    const btcIdr = resultsSlash.find((r) => r.symbol === 'BTCIDR');
    assert.ok(btcIdr, 'Hasil harus memuat BTCIDR');
    assert.strictEqual(btcIdr?.quoteAsset, 'IDR');

    // 2. Pencarian dengan format tanda hubung "BTC-IDR"
    const resultsHyphen = await feed.searchSymbols('BTC-IDR', { exchange: 'all' });
    assert.ok(resultsHyphen.some((r) => r.symbol === 'BTCIDR'));

    // 3. Filter berdasarkan bursa (exchange: 'indodax')
    const resultsIndodaxOnly = await feed.searchSymbols('BTC', { exchange: 'indodax' });
    assert.ok(resultsIndodaxOnly.length > 0);
    assert.ok(resultsIndodaxOnly.every((r) => r.provider.includes('Indodax')));

    // 4. Filter berdasarkan quote currency (quoteAsset: 'IDR')
    const resultsIdrOnly = await feed.searchSymbols('BTC', { exchange: 'all', quoteAsset: 'IDR' });
    assert.ok(resultsIdrOnly.length > 0);
    assert.ok(resultsIdrOnly.every((r) => r.quoteAsset === 'IDR'));
    assert.ok(!resultsIdrOnly.some((r) => r.quoteAsset === 'USDT'));

    // 5. Filter berdasarkan quote currency (quoteAsset: 'USDT')
    const resultsUsdtOnly = await feed.searchSymbols('BTC', { exchange: 'all', quoteAsset: 'USDT' });
    assert.ok(resultsUsdtOnly.length > 0);
    assert.ok(resultsUsdtOnly.every((r) => r.quoteAsset === 'USDT'));
  });

  test('Custom Feed Provider Management: menyimpan, membaca, dan mengaktifkan kustom endpoint provider', async () => {
    const customConfig = {
      id: 'custom-dex-feed',
      name: 'Custom Community Node',
      rest_url: 'https://custom-node.example.com',
      ws_url: 'wss://custom-node.example.com/stream',
      is_active: false,
    };

    await feed.saveProviderConfig(customConfig);
    const providers = await feed.getSavedProviders();
    const found = providers.find((p) => p.id === 'custom-dex-feed');
    assert.ok(found);
    assert.strictEqual(found?.name, 'Custom Community Node');
    assert.strictEqual(found?.rest_url, 'https://custom-node.example.com');

    // Aktifkan custom provider
    await feed.setActiveProvider('custom-dex-feed');
    const activeId = await feed.getActiveProviderId();
    assert.strictEqual(activeId, 'custom-dex-feed');

    // Hapus custom provider
    await feed.deleteProvider('custom-dex-feed');
    const afterDelete = await feed.getSavedProviders();
    assert.ok(!afterDelete.some((p) => p.id === 'custom-dex-feed'));
  });
});

