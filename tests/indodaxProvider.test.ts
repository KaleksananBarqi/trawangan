// Unit Tests untuk First-Class Indodax Provider & Indonesian Rupiah Price Formatting Seam
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { IndodaxProvider } from '../src/lib/services/indodaxProvider';
import { IndodaxAdapter } from '../src/lib/services/market/adapters/indodaxAdapter';
import { formatPriceLabel } from '../src/lib/services/priceScaleLabelService';

describe('Indodax Provider & IDR Currency Formatting Seam Suite', () => {
  const provider = new IndodaxProvider();
  const adapter = new IndodaxAdapter();

  test('1. Provider Info: mengembalikan identitas dan kapabilitas Indodax yang valid', () => {
    const info = provider.info();
    assert.equal(info.name, 'indodax');
    assert.equal(info.displayName, 'Indodax');
    assert.equal(info.capabilities.enumerate, true);
    assert.equal(info.capabilities.symbolInfo, true);
  });

  test('2. Timeframe Mapping: mengonversi interval TradingView ke parameter query Indodax', () => {
    assert.equal(provider.mapTimeframe('1m'), '1');
    assert.equal(provider.mapTimeframe('5m'), '5');
    assert.equal(provider.mapTimeframe('15m'), '15');
    assert.equal(provider.mapTimeframe('30m'), '30');
    assert.equal(provider.mapTimeframe('1h'), '60');
    assert.equal(provider.mapTimeframe('4h'), '240');
    assert.equal(provider.mapTimeframe('1D'), '1D');
    assert.equal(provider.mapTimeframe('1W'), '1W');
    assert.equal(provider.mapTimeframe('1M'), '1M');
  });

  test('3. Symbol Normalization: menormalkan berbagai format pair IDR/USDT Indodax', () => {
    assert.equal(provider.normalizePair('BTC/IDR'), 'btcidr');
    assert.equal(provider.normalizePair('indodax:BTCIDR'), 'btcidr');
    assert.equal(provider.normalizePair('ETH_IDR'), 'ethidr');
    assert.equal(provider.normalizePair('BTCUSDT'), 'btcusdt');
    assert.equal(provider.normalizePair('BTC'), 'btcidr'); // Default jika tanpa quote currency
  });

  test('4. Transformasi Kline: mengonversi payload Indodax ke Vela OHLCV berurutan waktu (milidetik)', () => {
    const rawIndodaxPayload = [
      { Time: 1791816300, Open: 1476350000, High: 1478761000, Low: 1473000000, Close: 1473000000, Volume: '0.1344' },
      { Time: 1791815400, Open: 1480000000, High: 1482874000, Low: 1476350000, Close: 1478859000, Volume: '0.1026' }
    ];

    const bars = provider.transformKlineData(rawIndodaxPayload);
    assert.equal(bars.length, 2);
    // Memastikan urutan waktu menaik (ascending): 1791815400 harus mendahului 1791816300
    assert.equal(bars[0].time, 1791815400 * 1000);
    assert.equal(bars[0].open, 1480000000);
    assert.equal(bars[1].time, 1791816300 * 1000);
    assert.equal(bars[1].close, 1473000000);
    assert.equal(bars[1].volume, 0.1344);
  });

  test('5. IndodaxAdapter Ticker Parsing: mengonversi payload ticker_all ke format TickerInfo', () => {
    const rawTickers = {
      btc_idr: {
        last: '1473000000',
        high: '1498001000',
        low: '1470000000',
        vol_btc: '12.78',
        vol_idr: '19046867720',
        buy: '1473000000',
        sell: '1474000000',
        server_time: 1791816668
      }
    };

    const tickerInfo = adapter.parseTickerFromMap('BTCIDR', rawTickers);
    assert.ok(tickerInfo);
    assert.equal(tickerInfo.price, 1473000000);
    assert.equal(tickerInfo.high24h, 1498001000);
    assert.equal(tickerInfo.low24h, 1470000000);
    assert.equal(tickerInfo.symbol, 'BTCIDR');
  });

  test('6. IDR Price Formatting: menggunakan pemisah ribuan titik pada mata uang Rupiah', () => {
    // Harga IDR bernilai ratusan juta atau milyar (contoh harga BTC)
    const formattedBtc = formatPriceLabel(1480000000, 'IDR');
    assert.equal(formattedBtc, '1.480.000.000');

    // Harga IDR puluhan ribu (contoh koin menengah)
    const formattedMid = formatPriceLabel(52450, 'IDR');
    assert.equal(formattedMid, '52.450');

    // Koin mikro bernilai desimal
    const formattedMicro = formatPriceLabel(0.0456, 'IDR');
    assert.equal(formattedMicro, '0,0456');

    // Mempertahankan kompatibilitas mata uang default (USDT / non-IDR) dengan koma
    const formattedUsd = formatPriceLabel(2547.17);
    assert.equal(formattedUsd, '2,547.17');
  });
});
