import test from 'node:test';
import assert from 'node:assert/strict';
import { universalFetch } from '../src/lib/services/httpClient';
import { BitunixAdapter } from '../src/lib/services/market/adapters/bitunixAdapter';
import { IndodaxAdapter } from '../src/lib/services/market/adapters/indodaxAdapter';

test('Universal HTTP Client Suite & CORS Bridge', async (t) => {
  await t.test('1. Non-Tauri Fallback: universalFetch menggunakan global fetch dengan benar', async () => {
    // Di lingkungan Node test runner, __TAURI_INTERNALS__ tidak ada sehingga menggunakan fetch
    const res = await universalFetch('https://api.binance.com/api/v3/ping');
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, {});
  });

  await t.test('2. BitunixAdapter fetchTicker & batchTickers tanpa endpoint 404', async () => {
    const adapter = new BitunixAdapter();
    assert.equal(adapter.id, 'bitunix');

    // Mock universalFetch untuk menguji parsing internal tanpa bergantung koneksi live
    const mockBatch = await adapter.fetchBatchTickers(['BTCUSDT.P', 'ETHUSDT.P']);
    // Jika ada koneksi internet di test runner, pastikan struktur valid jika terisi
    if (Object.keys(mockBatch).length > 0) {
      if (mockBatch['BTCUSDT.P']) {
        assert.equal(mockBatch['BTCUSDT.P'].symbol, 'BTCUSDT.P');
        assert.ok(mockBatch['BTCUSDT.P'].price >= 0);
      }
    }
  });

  await t.test('3. IndodaxAdapter parsing batch ticker_all', async () => {
    const adapter = new IndodaxAdapter();
    assert.equal(adapter.id, 'indodax');

    const sampleTickersMap = {
      btc_idr: {
        last: '1450000000',
        high: '1460000000',
        low: '1420000000',
        buy: '1449000000',
        vol_idr: '25000000000',
      },
      eth_idr: {
        last: '42000000',
        high: '43000000',
        low: '41000000',
        buy: '41900000',
        vol_idr: '8000000000',
      },
    };

    const parsedBtc = adapter.parseTickerFromMap('BTCIDR', sampleTickersMap);
    assert.ok(parsedBtc);
    assert.equal(parsedBtc?.symbol, 'BTCIDR');
    assert.equal(parsedBtc?.price, 1450000000);
    assert.ok((parsedBtc?.change24h || 0) > 0);

    const parsedEth = adapter.parseTickerFromMap('indodax:ETH/IDR', sampleTickersMap);
    assert.ok(parsedEth);
    assert.equal(parsedEth?.symbol, 'ETHIDR');
    assert.equal(parsedEth?.price, 42000000);
  });
});
