// Unit & Seam Tests untuk Drawing Context Preservation, Event Suppression Guard, dan Atomic Persistence Flush
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartDrawingController,
  resolveDrawingKey,
} from '../src/lib/services/chartDrawingController';
import { storage, flushDrawings } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

describe('Drawing Context Preservation, Event Suppression Guard, and Atomic Persistence Flush', () => {
  beforeEach(async () => {
    (globalThis as any).localStorage?.clear?.();
    storage.setAdapter(new InMemoryLocalStorageAdapter());
  });

  it('1. Event Suppression Guard: clearCanvasVisuals dan restoreDrawings tidak boleh memicu auto-save dokumen kosong akibat event drawing:removed', async () => {
    const controller = new ChartDrawingController();

    let currentSymbol = 'BTCUSDT.P';
    let currentProvider = 'binance';
    let currentTimeframe = '15m';

    const canvasDrawings: any[] = [];
    const listeners: Record<string, Function[]> = {};

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
            if (idx >= 0) {
              canvasDrawings.splice(idx, 1);
              // Engine Vela sungguhan memancarkan event drawing:removed untuk setiap id yang dihapus
              for (const cb of listeners['drawing:removed'] || []) {
                cb({ id });
              }
            }
          }
        },
        clear: () => {
          canvasDrawings.length = 0;
        },
      },
      on: (ev: string, cb: Function) => {
        if (!listeners[ev]) listeners[ev] = [];
        listeners[ev].push(cb);
      },
      off: (ev: string, cb: Function) => {
        if (listeners[ev]) {
          listeners[ev] = listeners[ev].filter((x) => x !== cb);
        }
      },
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

    // Langkah 1: Pengguna menggambar 2 garis di BTCUSDT.P Binance
    canvasDrawings.push({ id: 'trendline_binance_1', type: 'trendline', price: 67000 });
    canvasDrawings.push({ id: 'hline_binance_2', type: 'hline', price: 68000 });
    controller.handleDrawingMutated();

    // Tunggu auto-save selesai
    await new Promise((r) => setTimeout(r, 450));

    // Verifikasi data tersimpan di SQLite / in-memory adapter
    const savedBefore = await storage.loadDrawings('binance:BTCUSDT.P', 'GLOBAL');
    assert.ok(savedBefore, 'Data Binance harus tersimpan di awal');
    assert.equal(savedBefore.items.length, 2);

    // Langkah 2: Pengguna beralih ke BTCUSDT.P Bitunix
    currentProvider = 'bitunix';
    currentSymbol = 'BTCUSDT.P';

    // Panggil restoreDrawings untuk Bitunix (yang di dalamnya memanggil clearCanvasVisuals dan memicu removeMany -> drawing:removed)
    await controller.restoreDrawings(currentSymbol, currentTimeframe, currentProvider);

    // Kanvas Bitunix harus kosong
    assert.equal(canvasDrawings.length, 0, 'Kanvas Bitunix harus bersih');

    // Tunggu jendela debounce 450ms untuk memastikan tidak ada echo auto-save dokumen kosong yang menimpa Binance
    await new Promise((r) => setTimeout(r, 450));

    // Verifikasi kritis: Data di Binance TIDAK BOLEH tertimpa dokumen kosong!
    const savedAfter = await storage.loadDrawings('binance:BTCUSDT.P', 'GLOBAL');
    assert.ok(savedAfter, 'Data Binance tidak boleh hilang!');
    assert.equal(
      savedAfter.items.length,
      2,
      'Data Binance wajib tetap berisi 2 gambar dan tidak tertimpa oleh dokumen kosong dari clearCanvasVisuals'
    );

    // Langkah 3: Pengguna kembali ke BTCUSDT.P Binance
    currentProvider = 'binance';
    currentSymbol = 'BTCUSDT.P';

    await controller.restoreDrawings(currentSymbol, currentTimeframe, currentProvider);

    // Kedua gambar Binance harus kembali pulih di kanvas!
    assert.equal(canvasDrawings.length, 2, 'Kedua gambar Binance harus pulih utuh di kanvas');
    assert.equal(canvasDrawings[0].id, 'trendline_binance_1');
    assert.equal(canvasDrawings[1].id, 'hline_binance_2');
  });

  it('2. Persistence Debounce Flush: flushDrawings segera menyimpan gambar in-flight sebelum beralih simbol tanpa menunggu 400ms', async () => {
    const controller = new ChartDrawingController();

    let currentSymbol = 'BTCUSDT.P';
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
        removeMany: () => {
          canvasDrawings.length = 0;
        },
        clear: () => {
          canvasDrawings.length = 0;
        },
      },
      on: () => {},
      off: () => {},
    };

    const mockWorkspace = {
      active: { chart: mockChart },
    };

    controller.attachWorkspace(
      mockWorkspace,
      () => currentSymbol,
      () => currentTimeframe,
      () => currentProvider
    );

    // Pengguna menggambar garis baru
    canvasDrawings.push({ id: 'rapid_line_1', type: 'trendline', price: 70000 });
    controller.handleDrawingMutated();

    // Dalam waktu hanya 10ms (jauh sebelum 400ms debounce), pengguna langsung berpindah simbol!
    await new Promise((r) => setTimeout(r, 10));

    // Belum tersimpan jika dicek sebelum flush
    const beforeFlush = await storage.loadDrawings('binance:BTCUSDT.P', 'GLOBAL');
    assert.equal(beforeFlush, null, 'Data belum tersimpan karena timer debounce 400ms masih berjalan');

    // restoreDrawings secara otomatis memanggil flushDrawings() untuk simbol & bursa aktif
    await controller.restoreDrawings('ETHUSDT', '15m', 'binance');

    // Data in-flight harus sudah tersimpan segera berkat flushDrawings!
    const afterFlush = await storage.loadDrawings('binance:BTCUSDT.P', 'GLOBAL');
    assert.ok(afterFlush, 'Data in-flight harus tersimpan permanen setelah di-flush');
    assert.equal(afterFlush.items.length, 1);
    assert.equal(afterFlush.items[0].id, 'rapid_line_1');
  });
});
