// Unit & Seam Tests untuk Tiket #65: Exchange-Aware Drawing Isolation and Legacy Fallback Persistence
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartDrawingController,
  resolveDrawingKey,
} from '../src/lib/services/chartDrawingController';
import { storage } from '../src/lib/services/persistence';

describe('Tiket #65: Exchange-Aware Drawing Isolation and Legacy Fallback Persistence', () => {
  beforeEach(async () => {
    // Reset internal mock store jika ada
    (globalThis as any).localStorage?.clear?.();
  });

  it('1. resolveDrawingKey: menghasilkan kunci gabungan provider dan simbol yang ternormalisasi', () => {
    assert.equal(resolveDrawingKey('binance', 'BTCUSDT'), 'binance:BTCUSDT');
    assert.equal(resolveDrawingKey('BITUNIX', 'btcusdt.p'), 'bitunix:BTCUSDT.P');
    assert.equal(resolveDrawingKey('indodax', 'btcidr'), 'indodax:BTCIDR');
    assert.equal(resolveDrawingKey('binance', 'binance:BTCUSDT'), 'binance:BTCUSDT');
    assert.equal(resolveDrawingKey('', 'SOLUSDT'), 'binance:SOLUSDT');
  });

  it('2. Isolasi Gambar: gambar di Binance tidak bocor ke Bitunix dan kanvas dibersihkan saat switch', async () => {
    const controller = new ChartDrawingController();

    let currentSymbol = 'BTCUSDT';
    let currentProvider = 'binance';
    let currentTimeframe = '15m';

    const canvasDrawings: any[] = [];
    const mockChart = {
      drawings: {
        all: () => canvasDrawings,
        toJSON: () => ({ version: 1, items: [...canvasDrawings] }),
        fromJSON: (doc: any) => {
          canvasDrawings.length = 0;
          if (doc?.items) canvasDrawings.push(...doc.items);
        },
        removeMany: (ids: string[]) => {
          for (const id of ids) {
            const idx = canvasDrawings.findIndex((d) => d.id === id);
            if (idx >= 0) canvasDrawings.splice(idx, 1);
          }
        },
        clear: () => {
          canvasDrawings.length = 0;
        },
      },
      on: () => {},
      off: () => {},
    };

    const mockWorkspace = {
      active: {
        chart: mockChart,
        symbol: () => currentSymbol,
        timeframe: () => currentTimeframe,
        providerId: () => currentProvider,
      },
    };

    controller.attachWorkspace(
      mockWorkspace,
      () => currentSymbol,
      () => currentTimeframe,
      () => currentProvider
    );

    // 1. Buat gambar di BTC Binance
    canvasDrawings.push({ id: 'trendline_binance_1', type: 'trendline', price: 65000 });
    controller.handleDrawingMutated();

    // Tunggu debounce save
    await new Promise((r) => setTimeout(r, 450));

    // Verifikasi tersimpan di key binance:BTCUSDT
    const binanceSaved = await storage.loadDrawings('binance:BTCUSDT', 'GLOBAL');
    assert.ok(binanceSaved);
    assert.equal(binanceSaved.items.length, 1);
    assert.equal(binanceSaved.items[0].id, 'trendline_binance_1');

    // 2. Beralih ke Bitunix BTC
    currentProvider = 'bitunix';
    currentSymbol = 'BTCUSDT.P';

    await controller.restoreDrawings(currentSymbol, currentTimeframe, currentProvider);

    // Kanvas harus kosong karena Bitunix belum punya gambar
    assert.equal(canvasDrawings.length, 0);

    // 3. Tambah gambar baru di Bitunix
    canvasDrawings.push({ id: 'hline_bitunix_2', type: 'hline', price: 65100 });
    controller.handleDrawingMutated();
    await new Promise((r) => setTimeout(r, 450));

    // Verifikasi Bitunix punya gambarnya sendiri
    const bitunixSaved = await storage.loadDrawings('bitunix:BTCUSDT.P', 'GLOBAL');
    assert.ok(bitunixSaved);
    assert.equal(bitunixSaved.items.length, 1);
    assert.equal(bitunixSaved.items[0].id, 'hline_bitunix_2');

    // 4. Kembali ke Binance BTC
    currentProvider = 'binance';
    currentSymbol = 'BTCUSDT';

    await controller.restoreDrawings(currentSymbol, currentTimeframe, currentProvider);

    // Gambar Binance harus pulih utuh dan gambar Bitunix tidak ikut campur
    assert.equal(canvasDrawings.length, 1);
    assert.equal(canvasDrawings[0].id, 'trendline_binance_1');
  });

  it('3. Legacy Fallback: memulihkan gambar warisan yang tersimpan tanpa prefix bursa ke namespace binance', async () => {
    const controller = new ChartDrawingController();

    // Simpan data mentah lama ke SQLite / in-memory storage dengan key tanpa prefix
    await storage.saveDrawingsDebounced('ETHUSDT', 'GLOBAL', {
      version: 1,
      items: [{ id: 'legacy_ray_1', type: 'ray', price: 3500 }],
    });
    await new Promise((r) => setTimeout(r, 450));

    const canvasDrawings: any[] = [];
    const mockChart = {
      drawings: {
        all: () => canvasDrawings,
        fromJSON: (doc: any) => {
          canvasDrawings.length = 0;
          if (doc?.items) canvasDrawings.push(...doc.items);
        },
        clear: () => {
          canvasDrawings.length = 0;
        },
      },
    };

    const mockWorkspace = {
      active: { chart: mockChart },
    };

    controller.attachWorkspace(
      mockWorkspace,
      () => 'ETHUSDT',
      () => '1h',
      () => 'binance'
    );

    // Panggil restoreDrawings untuk binance
    await controller.restoreDrawings('ETHUSDT', '1h', 'binance');

    // Harus berhasil menemukan dan memuat data legacy
    assert.equal(canvasDrawings.length, 1);
    assert.equal(canvasDrawings[0].id, 'legacy_ray_1');

    // Tapi jika dicari untuk Bitunix, tidak boleh memuat gambar legacy milik Binance tersebut
    await controller.restoreDrawings('ETHUSDT', '1h', 'bitunix');
    assert.equal(canvasDrawings.length, 0);
  });
});
