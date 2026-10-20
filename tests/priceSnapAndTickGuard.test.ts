import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundToTickSize,
  getAdaptiveTickSize,
  findNearestOhlcPoint,
  type CandlestickBar,
} from '../src/lib/services/priceSnapService';

describe('Ticket 1: Tick-Aligned Price Guard & OHLC Candle Magnet Engine', () => {
  describe('Tick-Aligned Price Guard', () => {
    it('1. Membulatkan harga berdasarkan tickSize eksplisit bursa', () => {
      // BTCUSDT dengan tickSize 0.1
      assert.equal(roundToTickSize(68421.391827419, 0.1), 68421.4);
      // BTCUSDT dengan tickSize 0.01
      assert.equal(roundToTickSize(68421.391827419, 0.01), 68421.39);
      // SOLUSDT dengan tickSize 0.005
      assert.equal(roundToTickSize(142.1234, 0.005), 142.125);
    });

    it('2. Menggunakan resolusi adaptif cerdas jika tickSize tidak diberikan atau invalid', () => {
      // Harga >= 1000 -> step 0.01
      assert.equal(getAdaptiveTickSize(68500), 0.01);
      assert.equal(roundToTickSize(68500.123456), 68500.12);

      // 1 <= Harga < 1000 -> step 0.0001
      assert.equal(getAdaptiveTickSize(155.67891), 0.0001);
      assert.equal(roundToTickSize(155.67891), 155.6789);

      // 0.001 <= Harga < 1 -> step 0.000001
      assert.equal(getAdaptiveTickSize(0.4567891), 0.000001);
      assert.equal(roundToTickSize(0.4567891), 0.456789);

      // Harga < 0.001 (e.g. PEPE/SHIB) -> step 0.00000001
      assert.equal(getAdaptiveTickSize(0.0000123456), 0.00000001);
      assert.equal(roundToTickSize(0.0000123456), 0.00001235);
    });

    it('3. Menangani nilai tepi (edge cases) dengan aman', () => {
      assert.equal(roundToTickSize(0), 0);
      assert.equal(roundToTickSize(-10.1234, 0.01), -10.12);
      assert.equal(roundToTickSize(NaN), 0);
    });
  });

  describe('OHLC Magnet Snapping', () => {
    const sampleCandles: CandlestickBar[] = [
      {
        time: 1700000000,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
      },
      {
        time: 1700000060,
        open: 105,
        high: 115,
        low: 102,
        close: 112,
      },
    ];

    // Mock fungsi proyeksi harga ke koordinat Y piksel (1 unit harga = 2 piksel, 115 -> Y 0, 95 -> Y 40)
    // Y = (115 - price) * 2
    const mockGetPriceY = (price: number) => (115 - price) * 2;

    it('1. Snap otomatis ke High/Low terdekat dalam radius toleransi 15px', () => {
      // High candle 1 = 115, Y = 0. Kursor Y = 2 (jarak 2px <= 15px)
      const result = findNearestOhlcPoint({
        targetPrice: 114,
        targetY: 2,
        candles: sampleCandles,
        getPriceY: mockGetPriceY,
        tolerancePx: 15,
        isMagnetActive: true,
      });

      assert.ok(result);
      assert.equal(result.snapped, true);
      assert.equal(result.price, 115);
      assert.equal(result.snappedType, 'high');
      assert.equal(result.candleTime, 1700000060);
    });

    it('2. Memprioritaskan High dan Low di atas Open dan Close jika jarak seimbang', () => {
      // Buat candle di mana Open dan Low sangat berdekatan
      const candle: CandlestickBar = {
        time: 1700000120,
        open: 100.5,
        high: 110,
        low: 100,
        close: 108,
      };

      // Kursor Y di antara Open (Y=29) dan Low (Y=30), misalnya Y = 29.4
      const result = findNearestOhlcPoint({
        targetPrice: 100.3,
        targetY: 29.4,
        candles: [candle],
        getPriceY: mockGetPriceY,
        tolerancePx: 15,
        isMagnetActive: true,
      });

      assert.ok(result);
      assert.equal(result.snapped, true);
      // Low memiliki prioritas di atas Open
      assert.equal(result.snappedType, 'low');
      assert.equal(result.price, 100);
    });

    it('3. Tidak melakukan snap jika jarak kursor melebihi batas toleransi 15px', () => {
      // Kursor berada di Y = 80 (jauh di bawah low 95 yang berada di Y = 40, jarak 40px > 15px)
      const result = findNearestOhlcPoint({
        targetPrice: 75.123456,
        targetY: 80,
        candles: sampleCandles,
        getPriceY: mockGetPriceY,
        tolerancePx: 15,
        isMagnetActive: true,
      });

      assert.ok(result);
      assert.equal(result.snapped, false);
      // Harga fallback dibulatkan dengan Tick-Aligned Price Guard
      assert.equal(result.price, 75.1235);
      assert.equal(result.snappedType, null);
    });

    it('4. Shift Inversion Guard: Membalik status magnet saat tombol Shift ditekan', () => {
      // Saat magnet aktif (true), tetapi shiftKey=true -> snap dinonaktifkan (gerakan bebas)
      const resWithShiftOnMagnetActive = findNearestOhlcPoint({
        targetPrice: 114.891234,
        targetY: 0.5, // 0.5px dari high 115
        candles: sampleCandles,
        getPriceY: mockGetPriceY,
        tolerancePx: 15,
        isMagnetActive: true,
        shiftKey: true, // Inversi: matikan snap
      });

      assert.equal(resWithShiftOnMagnetActive.snapped, false);
      assert.equal(resWithShiftOnMagnetActive.price, 114.8912); // sanitized float

      // Saat magnet mati (false), tetapi shiftKey=true -> snap diaktifkan sementara
      const resWithShiftOnMagnetInactive = findNearestOhlcPoint({
        targetPrice: 114.891234,
        targetY: 0.5,
        candles: sampleCandles,
        getPriceY: mockGetPriceY,
        tolerancePx: 15,
        isMagnetActive: false,
        shiftKey: true, // Inversi: nyalakan snap
      });

      assert.equal(resWithShiftOnMagnetInactive.snapped, true);
      assert.equal(resWithShiftOnMagnetInactive.price, 115);
      assert.equal(resWithShiftOnMagnetInactive.snappedType, 'high');
    });
  });

  describe('Ticket 4: Long/Short Position Tool & Drawing Snap Inversion', () => {
    it('1. chartDrawingController mendukung setTemporarySnapMode dan restoreOriginalSnapMode', async () => {
      const { chartDrawingController } = await import('../src/lib/services/chartDrawingController');
      
      chartDrawingController.setSnapMode('off');
      assert.equal(chartDrawingController.getSnapshot().snapMode, 'off');

      // Saat shift ditekan, set snap sementara ke strong
      chartDrawingController.setTemporarySnapMode('strong');
      assert.equal(chartDrawingController.getSnapshot().snapMode, 'strong');

      // Saat shift dilepas, pulihkan kembali ke off
      chartDrawingController.restoreOriginalSnapMode();
      assert.equal(chartDrawingController.getSnapshot().snapMode, 'off');
    });

    it('2. extractDrawingPriceBadges menyanitasi harga anchors Long/Short dengan Tick-Aligned Price Guard', async () => {
      const { extractDrawingPriceBadges } = await import('../src/lib/services/priceScaleLabelService');

      const mockDrawing = {
        id: 'pos_btc',
        type: 'position',
        visible: true,
        anchors: [
          { time: 1700000000000, price: 68421.391827419 }, // Entry dengan desimal liar
          { time: 1700000600000, price: 67123.882914123 }, // Stop Loss
          { time: 1700000600000, price: 71200.551829124 }, // Target TP
        ],
        style: { lineColor: '#3b82f6' },
      };

      const badges = extractDrawingPriceBadges([mockDrawing] as any);
      assert.equal(badges.length, 3);

      const entry = badges.find((b) => b.kind === 'entry');
      assert.ok(entry);
      assert.equal(entry.price, 68421.39);

      const sl = badges.find((b) => b.kind === 'stop_loss');
      assert.ok(sl);
      assert.equal(sl.price, 67123.88);

      const tp = badges.find((b) => b.kind === 'take_profit');
      assert.ok(tp);
      assert.equal(tp.price, 71200.55);
    });
  });
});
