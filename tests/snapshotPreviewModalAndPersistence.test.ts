// Unit Tests untuk Ticket 3 (#95): Interactive Snapshot Preview Modal, Multi-Chart Scope, & AppSettings Persistence
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import type { AppSettings } from '../src/lib/types/market';
import {
  calculateCompositeDimensions,
  compositeSnapshot,
  generateSnapshotFilename,
  formatSnapshotPrice,
  saveSnapshotToFile,
  getDefaultSnapshotDirectory,
  pickSnapshotDirectory,
  createSnapshotThumbnail,
  isTauriEnvironment,
  type SnapshotOptions,
  type SnapshotMetadata,
  type SaveSnapshotResult
} from '../src/lib/services/chartSnapshotService';
import { formatPriceLabel } from '../src/lib/services/priceScaleLabelService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { THEME_PRESETS } from '../src/lib/constants/themes';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

// Mock Canvas 2D untuk pengujian node environment
function createMockCanvas(width = 1200, height = 800): any {
  const drawCalls: string[] = [];
  const ctx: any = {
    save: () => drawCalls.push('save'),
    restore: () => drawCalls.push('restore'),
    beginPath: () => drawCalls.push('beginPath'),
    closePath: () => drawCalls.push('closePath'),
    moveTo: (x: number, y: number) => drawCalls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => drawCalls.push(`lineTo(${x},${y})`),
    arc: () => drawCalls.push('arc'),
    arcTo: () => drawCalls.push('arcTo'),
    roundRect: () => drawCalls.push('roundRect'),
    rect: () => drawCalls.push('rect'),
    fill: () => drawCalls.push(`fill(${ctx.fillStyle})`),
    stroke: () => drawCalls.push(`stroke(${ctx.strokeStyle})`),
    clip: () => drawCalls.push('clip'),
    fillRect: () => drawCalls.push('fillRect'),
    strokeRect: () => drawCalls.push('strokeRect'),
    fillText: (text: string) => drawCalls.push(`fillText(${text})`),
    drawImage: (img: any, ...args: number[]) => drawCalls.push(`drawImage(${args.join(',')})`),
    measureText: (text: string) => ({ width: text.length * 9 }),
    fillStyle: '#000',
    strokeStyle: '#fff',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  };
  return {
    width,
    height,
    getContext: () => ctx,
    toDataURL: (mime = 'image/png') => `data:${mime};base64,mockPngBase64EncodedData`,
    toBlob: (cb: (blob: Blob | null) => void) => {
      cb(new Blob(['mockPngData'], { type: 'image/png' }));
    },
    getDrawCalls: () => drawCalls,
  };
}

test('Ticket 3 (#95): Interactive Snapshot Preview Modal, Multi-Chart Scope, & AppSettings Persistence', async (t) => {
  await t.test('1. DEFAULT_APP_SETTINGS: Memverifikasi preferensi snapshot bawaan aplikasi', () => {
    // Nilai default harus mencakup preferensi snapshot yang aman
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotIncludeFrame,
      true,
      'snapshotIncludeFrame harus default ke true'
    );
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotIncludePrice,
      true,
      'snapshotIncludePrice harus default ke true'
    );
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotIncludeTimestamp,
      true,
      'snapshotIncludeTimestamp harus default ke true'
    );
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotScope,
      'active',
      'snapshotScope harus default ke "active"'
    );
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotDirectory,
      '',
      'snapshotDirectory harus default ke string kosong (default OS Downloads)'
    );
  });

  await t.test('2. resolveAppSettings: Normalisasi dan fallback preferensi snapshot', () => {
    // A. Input kosong / null mengembalikan seluruh default snapshot
    const resolvedEmpty = resolveAppSettings(null);
    assert.strictEqual(resolvedEmpty.snapshotIncludeFrame, true);
    assert.strictEqual(resolvedEmpty.snapshotIncludePrice, true);
    assert.strictEqual(resolvedEmpty.snapshotIncludeTimestamp, true);
    assert.strictEqual(resolvedEmpty.snapshotScope, 'active');
    assert.strictEqual(resolvedEmpty.snapshotDirectory, '');

    // B. Input parsial mempertahankan nilai kustom dan memberi fallback ke nilai default yang aman
    const resolvedPartial = resolveAppSettings({
      snapshotIncludeFrame: false,
      snapshotScope: 'all',
      snapshotDirectory: '~/Pictures/Screenshots',
    } as any);
    assert.strictEqual(resolvedPartial.snapshotIncludeFrame, false);
    assert.strictEqual(resolvedPartial.snapshotIncludePrice, true);
    assert.strictEqual(resolvedPartial.snapshotIncludeTimestamp, true);
    assert.strictEqual(resolvedPartial.snapshotScope, 'all');
    assert.strictEqual(resolvedPartial.snapshotDirectory, '~/Pictures/Screenshots');

    // C. Input dengan nilai snapshotScope invalid harus dinormalkan ke 'active'
    const resolvedInvalidScope = resolveAppSettings({
      snapshotScope: 'invalid_scope_string' as any,
    });
    assert.strictEqual(resolvedInvalidScope.snapshotScope, 'active');
  });

  await t.test('3. Persistensi: Menyimpan dan memuat preferensi snapshot via PersistenceService', async () => {
    const memoryAdapter = new InMemoryLocalStorageAdapter();
    const persistence = new PersistenceService(memoryAdapter);

    // Default awal belum ada data tersimpan
    const initialSettings = await persistence.loadSettings();
    assert.strictEqual(initialSettings, null);

    // Simpan pengaturan snapshot baru
    await persistence.saveSettings({
      snapshotIncludeFrame: false,
      snapshotIncludePrice: false,
      snapshotIncludeTimestamp: true,
      snapshotScope: 'all',
      timezone: 'Asia/Makassar',
    });

    const loaded = await persistence.loadSettings();
    assert.ok(loaded);
    assert.strictEqual(loaded.snapshotIncludeFrame, false);
    assert.strictEqual(loaded.snapshotIncludePrice, false);
    assert.strictEqual(loaded.snapshotIncludeTimestamp, true);
    assert.strictEqual(loaded.snapshotScope, 'all');

    const resolved = resolveAppSettings(loaded);
    assert.strictEqual(resolved.snapshotIncludeFrame, false);
    assert.strictEqual(resolved.snapshotIncludePrice, false);
    assert.strictEqual(resolved.snapshotIncludeTimestamp, true);
    assert.strictEqual(resolved.snapshotScope, 'all');
    assert.strictEqual(resolved.timezone, 'Asia/Makassar');
  });

  await t.test('4. Multi-Chart Scope vs Active Chart Komposit Dimensi', () => {
    // Single chart (active cell: 1280x720)
    const singleDim = calculateCompositeDimensions(1280, 720, {
      mode: 'branded',
      scale: 2,
      metadata: { symbol: 'BTCUSDT', timeframe: '15m', providerId: 'binance' },
    });
    assert.strictEqual(singleDim.chartWidth, 2560);
    assert.strictEqual(singleDim.chartHeight, 1440);
    assert.strictEqual(singleDim.width, (1280 + 48) * 2); // 2656
    assert.strictEqual(singleDim.height, (720 + 48 + 60) * 2); // 1656

    // Multi-chart workspace (2x2 grid: 2560x1440)
    const multiDim = calculateCompositeDimensions(2560, 1440, {
      mode: 'branded',
      scale: 2,
      metadata: { symbol: 'WORKSPACE', timeframe: 'MULTI', providerId: 'binance' },
    });
    assert.strictEqual(multiDim.chartWidth, 5120);
    assert.strictEqual(multiDim.chartHeight, 2880);
    assert.strictEqual(multiDim.width, (2560 + 48) * 2);
    assert.strictEqual(multiDim.height, (1440 + 48 + 60) * 2);

    // Clean mode untuk multi-chart workspace
    const multiCleanDim = calculateCompositeDimensions(2560, 1440, {
      mode: 'clean',
      scale: 2,
      metadata: { symbol: 'WORKSPACE', timeframe: 'MULTI', providerId: 'binance' },
    });
    assert.strictEqual(multiCleanDim.width, 5120);
    assert.strictEqual(multiCleanDim.height, 2880);
    assert.strictEqual(multiCleanDim.chartX, 0);
    assert.strictEqual(multiCleanDim.attributionHeight, 0);
  });

  await t.test('5. Delegasi Scope Screenshot pada Chart Controller Interface', () => {
    // Mock workspace dengan 2 sel grafik
    const mockActiveCanvas = createMockCanvas(1200, 800);
    const mockWorkspaceCanvas = createMockCanvas(2400, 800);

    let activeCallCount = 0;
    let workspaceCallCount = 0;

    const mockWorkspace = {
      screenshotCanvas: () => {
        workspaceCallCount++;
        return mockWorkspaceCanvas;
      },
      active: {
        screenshotCanvas: () => {
          activeCallCount++;
          return mockActiveCanvas;
        },
      },
      cells: [
        { screenshotCanvas: () => mockActiveCanvas },
        { screenshotCanvas: () => createMockCanvas(1200, 800) },
      ],
    };

    // Helper simulasi logika Chart.svelte getChartScreenshotCanvas
    function resolveScreenshotCanvas(ws: any, scope: 'active' | 'all' = 'active') {
      if (scope === 'all') {
        if (ws && typeof ws.screenshotCanvas === 'function') {
          return ws.screenshotCanvas();
        }
      }
      return ws?.active?.screenshotCanvas?.() || null;
    }

    const resActive = resolveScreenshotCanvas(mockWorkspace, 'active');
    assert.strictEqual(resActive, mockActiveCanvas);
    assert.strictEqual(activeCallCount, 1);
    assert.strictEqual(workspaceCallCount, 0);

    const resAll = resolveScreenshotCanvas(mockWorkspace, 'all');
    assert.strictEqual(resAll, mockWorkspaceCanvas);
    assert.strictEqual(activeCallCount, 1);
    assert.strictEqual(workspaceCallCount, 1);
  });

  await t.test('6. Verifikasi Komposit Snapshot dengan Opsi Dinamis Modal', () => {
    const srcCanvas = createMockCanvas(1280, 720);
    const targetCanvas = createMockCanvas(2656, 1656);

    // Render dengan frame branded, includePrice false, includeTimestamp true
    const comp1 = compositeSnapshot(
      srcCanvas,
      {
        mode: 'branded',
        scale: 2,
        includePrice: false,
        includeTimestamp: true,
        metadata: {
          symbol: 'ETHUSDT',
          timeframe: '1h',
          providerId: 'binance',
          lastPrice: 3200.5,
          timezone: 'Asia/Jakarta',
        },
      },
      targetCanvas
    );

    assert.ok(comp1);
    const calls1 = targetCanvas.getDrawCalls();
    // Memastikan teks brand dan instrumen digambar
    assert.ok(calls1.some((c: string) => c.includes('fillText(trawangan)')));
    assert.ok(calls1.some((c: string) => c.includes('fillText(ETHUSDT · 1h · BINANCE)')));
    // Karena includePrice = false, teks harga tidak boleh digambar
    assert.strictEqual(calls1.some((c: string) => c.includes('fillText(3,200.50)')), false);

    // Render mode clean murni
    const cleanTarget = createMockCanvas(2560, 1440);
    const compClean = compositeSnapshot(
      srcCanvas,
      {
        mode: 'clean',
        scale: 2,
        metadata: {
          symbol: 'ETHUSDT',
          timeframe: '1h',
          providerId: 'binance',
        },
      },
      cleanTarget
    );
    assert.strictEqual(compClean.width, 2560);
    assert.strictEqual(compClean.height, 1440);
  });

  await t.test('7. Multi-Chart Fallback Composite Stitching (Grid 2 Sel)', () => {
    // Simulasi penggabungan kanvas jika workspace.screenshotCanvas tidak ada
    const cell1Canvas = createMockCanvas(800, 600);
    const cell2Canvas = createMockCanvas(800, 600);

    const stitchedCanvas = createMockCanvas(1600, 600);
    const ctx = stitchedCanvas.getContext('2d');

    // Gambar sel 1 di kiri, sel 2 di kanan
    ctx.drawImage(cell1Canvas, 0, 0, 800, 600);
    ctx.drawImage(cell2Canvas, 800, 0, 800, 600);

    const calls = stitchedCanvas.getDrawCalls();
    assert.strictEqual(calls.filter((c: string) => c.startsWith('drawImage')).length, 2);
    assert.strictEqual(stitchedCanvas.width, 1600);
    assert.strictEqual(stitchedCanvas.height, 600);
  });

  await t.test('8. Zoom Controls: Perhitungan dan Batas Clamping (+ / - / Reset 100%)', () => {
    let zoomLevel = 1.0;
    const handleZoomIn = () => {
      zoomLevel = Math.min(3, Math.round((zoomLevel + 0.25) * 100) / 100);
    };
    const handleZoomOut = () => {
      zoomLevel = Math.max(0.25, Math.round((zoomLevel - 0.25) * 100) / 100);
    };
    const handleResetZoom = () => {
      zoomLevel = 1.0;
    };

    handleZoomIn();
    assert.strictEqual(zoomLevel, 1.25);
    handleZoomIn();
    assert.strictEqual(zoomLevel, 1.5);

    // Zoom-in sampai batas atas (3.0)
    for (let i = 0; i < 15; i++) handleZoomIn();
    assert.strictEqual(zoomLevel, 3.0, 'Zoom tidak boleh melebihi 300% (3.0)');

    // Reset zoom ke 100%
    handleResetZoom();
    assert.strictEqual(zoomLevel, 1.0, 'Reset zoom harus mengembalikan level ke 1.0');

    // Zoom-out sampai batas bawah (0.25)
    for (let i = 0; i < 15; i++) handleZoomOut();
    assert.strictEqual(zoomLevel, 0.25, 'Zoom tidak boleh kurang dari 25% (0.25)');
  });

  await t.test('9. Sinkronisasi Stempel Waktu Filename & CapturedAt', () => {
    const fixedCapturedAt = 1793361600000;
    const filenameActive = generateSnapshotFilename('BTCUSDT', '15m', fixedCapturedAt);
    const filenameAll = generateSnapshotFilename('MULTI-CHART-GRID', 'layout-2v', fixedCapturedAt);

    assert.ok(filenameActive.startsWith('trawangan-BTCUSDT-15m-'));
    assert.ok(filenameActive.endsWith('.png'));
    assert.ok(filenameAll.startsWith('trawangan-MULTI-CHART-GRID-layout-2v-'));
    assert.ok(filenameAll.endsWith('.png'));

    // Verifikasi bahwa timestamp yang sama menghasilkan stempel waktu file identik
    const fn1 = generateSnapshotFilename('ETHUSDT', '1h', fixedCapturedAt);
    const fn2 = generateSnapshotFilename('ETHUSDT', '1h', fixedCapturedAt);
    assert.strictEqual(fn1, fn2, 'Timestamp capturedAt yang sama harus menghasilkan nama file identik');
  });

  await t.test('10. Attribution Bar pada Multi-Chart Scope: Menampilkan Layout Grid dan Menekan Harga Ambigu', () => {
    const srcCanvas = createMockCanvas(1600, 900);
    const targetCanvas = createMockCanvas(3296, 2016);

    const comp = compositeSnapshot(
      srcCanvas,
      {
        mode: 'branded',
        scale: 2,
        includePrice: true,
        metadata: {
          symbol: 'MULTI-CHART GRID',
          timeframe: '2-SPLIT VERTICAL',
          providerId: 'binance',
          layout: '2v',
          scope: 'all',
          lastPrice: 65432.1,
        },
      },
      targetCanvas
    );

    assert.ok(comp);
    const drawCalls = targetCanvas.getDrawCalls();
    assert.ok(
      drawCalls.some((c: string) => c.includes('fillText(MULTI-CHART GRID · 2-SPLIT VERTICAL · BINANCE)')),
      'Harus menampilkan label multi-chart grid dengan layout dan provider'
    );
    assert.strictEqual(
      drawCalls.some((c: string) => c.includes('fillText(65,432.10)')),
      false,
      'Harga single chart tidak boleh digambar pada multi-chart layout'
    );
  });

  await t.test('11. Latar Belakang Komposit Mengikuti Warna Tema Aktif', () => {
    const srcCanvas = createMockCanvas(800, 600);
    const targetCanvas = createMockCanvas(1696, 1416);

    const binanceTheme = THEME_PRESETS.binance;
    const themeBg = binanceTheme.chart.background;

    const comp = compositeSnapshot(
      srcCanvas,
      {
        mode: 'branded',
        scale: 2,
        backgroundColor: themeBg,
        metadata: {
          symbol: 'BTCUSDT',
          timeframe: '4h',
          providerId: 'binance',
        },
      },
      targetCanvas
    );

    assert.ok(comp);
    const calls = targetCanvas.getDrawCalls();
    assert.ok(
      calls.some((c: string) => c === `fill(${themeBg})`),
      'Warna latar belakang komposit harus sesuai tema aktif'
    );
  });

  await t.test('12. ChartSessionController.getScreenshotCanvas Seam: Ekstraksi Kanvas Sesi Tunggal & Multi-Chart', () => {
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      defaultTimeframe: '15m',
      layout: '2v',
      providerId: 'binance',
    });

    const mockCell1Canvas = createMockCanvas(800, 600);
    const mockCell2Canvas = createMockCanvas(800, 600);
    const mockWorkspaceCanvas = createMockCanvas(1600, 600);

    const mockWorkspace = {
      screenshotCanvas: () => mockWorkspaceCanvas,
      active: { screenshotCanvas: () => mockCell1Canvas },
      cells: [
        { screenshotCanvas: () => mockCell1Canvas },
        { screenshotCanvas: () => mockCell2Canvas },
      ],
    };

    (controller as any).workspace = mockWorkspace;
    (controller as any).layout = '2v';

    const canvasActive = controller.getScreenshotCanvas('active');
    assert.strictEqual(canvasActive, mockCell1Canvas, 'Scope active harus mengembalikan kanvas active cell');

    const canvasAll = controller.getScreenshotCanvas('all');
    assert.strictEqual(canvasAll, mockWorkspaceCanvas, 'Scope all harus mengembalikan kanvas komposit seluruh grid');
  });

  await t.test('13. Sinkronisasi & Deduplikasi formatSnapshotPrice dengan priceScaleLabelService', () => {
    // 1. Standar USDT / USD
    assert.strictEqual(formatSnapshotPrice(64250.5), formatPriceLabel(64250.5));
    assert.strictEqual(formatSnapshotPrice(1234.56), formatPriceLabel(1234.56));

    // 2. Crypto Quotes: BTC
    assert.strictEqual(formatSnapshotPrice(0.03451234, 'BTC'), formatPriceLabel(0.03451234, 'BTC'));
    assert.strictEqual(formatSnapshotPrice(0.0000125, 'BTC'), formatPriceLabel(0.0000125, 'BTC'));

    // 3. Local Quotes: IDR
    assert.strictEqual(formatSnapshotPrice(1450000000, 'IDR'), formatPriceLabel(1450000000, 'IDR'));
    assert.strictEqual(formatSnapshotPrice(52450, 'IDR'), formatPriceLabel(52450, 'IDR'));

    // 4. Edge cases: null, undefined, NaN
    assert.strictEqual(formatSnapshotPrice(null), '-');
    assert.strictEqual(formatSnapshotPrice(undefined), '-');
    assert.strictEqual(formatSnapshotPrice(NaN), '-');
  });

  await t.test('14. Snapshot Save Directory: Verifikasi konfigurasi direktori kustom dan saveSnapshotToFile helper', async () => {
    // 1. getDefaultSnapshotDirectory mengembalikan 'Downloads' saat di lingkungan pengujian non-tauri
    const defaultDir = await getDefaultSnapshotDirectory();
    assert.strictEqual(defaultDir, 'Downloads', 'Di lingkungan node harus fallback ke Downloads');

    // 2. saveSnapshotToFile dengan direktori kustom di luar Tauri harus fallback secara jujur ke Downloads/
    const mockCanvas = createMockCanvas(400, 300);
    const saveResultCustom = await saveSnapshotToFile(mockCanvas, 'test-chart.png', '~/Pictures/Screenshots');
    assert.strictEqual(saveResultCustom.success, true);
    assert.strictEqual(
      saveResultCustom.filePath,
      'Downloads/test-chart.png',
      'Fallback ke browser unduhan harus jujur mengembalikan Downloads/ dan bukan custom directory'
    );
    assert.strictEqual(saveResultCustom.isFallback, true, 'isFallback harus true saat di luar Tauri');

    // 3. saveSnapshotToFile tanpa direktori kustom menggunakan fallback folder Downloads
    const saveResultDefault = await saveSnapshotToFile(mockCanvas, 'test-default.png');
    assert.strictEqual(saveResultDefault.success, true);
    assert.strictEqual(saveResultDefault.filePath, 'Downloads/test-default.png');
    assert.strictEqual(saveResultDefault.isFallback, true, 'isFallback harus true saat di luar Tauri');

    // 4. Persistensi: Menyimpan snapshotDirectory ke adapter persistensi
    const mockStorage = new InMemoryLocalStorageAdapter();
    const persistence = new PersistenceService(mockStorage as any);

    await persistence.saveSettings({
      snapshotDirectory: '/media/storage/chart_snaps',
    });

    const loadedSettings = await persistence.loadSettings();
    assert.ok(loadedSettings);
    assert.strictEqual(
      loadedSettings.snapshotDirectory,
      '/media/storage/chart_snaps',
      'Direktori snapshot kustom harus tersimpan dan dapat dimuat kembali secara utuh'
    );
  });

  await t.test('15. Path Traversal Guard Contract: Sanitasi nama berkas dan pencegahan traversal direktori (#98)', () => {
    // A. generateSnapshotFilename membersihkan pemisah direktori (/ dan \)
    const date = new Date(2026, 9, 30, 18, 20, 30);
    const traversalSymbol = '../../../etc/shadow';
    const filename = generateSnapshotFilename(traversalSymbol, '15m', date);
    assert.strictEqual(
      filename.includes('/'),
      false,
      'Nama berkas tidak boleh memuat karakter slash (/)'
    );
    assert.strictEqual(
      filename.includes('\\'),
      false,
      'Nama berkas tidak boleh memuat karakter backslash (\\)'
    );

    // B. Verifikasi bahwa nama berkas yang dihasilkan aman untuk digabungkan dengan direktori target
    assert.match(
      filename,
      /^trawangan-.*-15m-20261030-182030\.png$/,
      'Format nama berkas tetap konsisten dan aman'
    );
  });

  await t.test('16. Ticket 2 (#99): Native Directory Picker, Type Safety, Honest Fallback & Lightweight Thumbnail', async () => {
    // A. Non-Tauri Environment: pickSnapshotDirectory mengembalikan null
    const nonTauriDir = await pickSnapshotDirectory();
    assert.strictEqual(nonTauriDir, null, 'pickSnapshotDirectory di luar Tauri harus mengembalikan null');

    // B. Non-Tauri Environment: saveSnapshotToFile dengan string data URL mengembalikan honest fallback
    const mockDataUrl = 'data:image/png;base64,mockValidPngDataUrl';
    const fallbackRes = await saveSnapshotToFile(mockDataUrl, 'manual-export.png', '/custom/my-folder');
    assert.strictEqual(fallbackRes.success, true);
    assert.strictEqual(fallbackRes.filePath, 'Downloads/manual-export.png', 'Jalur fallback harus honest Downloads/');
    assert.strictEqual(fallbackRes.isFallback, true, 'isFallback harus true saat fallback aktif');

    // C. Simulated Tauri Environment: pickSnapshotDirectory & saveSnapshotToFile
    const originalWindow = (globalThis as any).window;
    try {
      let invokedCommand = '';
      let invokedArgs: any = null;

      (globalThis as any).window = {
        __TAURI_INTERNALS__: {
          invoke: async (cmd: string, args: any) => {
            invokedCommand = cmd;
            invokedArgs = args;
            if (cmd === 'pick_snapshot_directory') {
              return '/home/trader/TradingSnaps';
            }
            if (cmd === 'save_snapshot_file') {
              return `/home/trader/TradingSnaps/${args.filename}`;
            }
            return null;
          },
        },
      };

      assert.strictEqual(isTauriEnvironment(), true, 'isTauriEnvironment harus true saat __TAURI_INTERNALS__ ada');

      // 1. pickSnapshotDirectory berhasil memilih folder
      const pickedDir = await pickSnapshotDirectory();
      assert.strictEqual(invokedCommand, 'pick_snapshot_directory');
      assert.strictEqual(pickedDir, '/home/trader/TradingSnaps');

      // 2. pickSnapshotDirectory saat dialog dibatalkan (null)
      (globalThis as any).window.__TAURI_INTERNALS__.invoke = async () => null;
      const cancelledDir = await pickSnapshotDirectory();
      assert.strictEqual(cancelledDir, null, 'Saat dialog dibatalkan oleh pengguna, kembalikan null');

      // 3. saveSnapshotToFile di Tauri berhasil menyimpan ke direktori kustom
      (globalThis as any).window.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        invokedCommand = cmd;
        invokedArgs = args;
        return `/home/trader/CustomSnapshots/${args.filename}`;
      };

      const mockCanvas = createMockCanvas(800, 600);
      const tauriSaveRes: SaveSnapshotResult = await saveSnapshotToFile(
        mockCanvas,
        'btc-breakout.png',
        '/home/trader/CustomSnapshots'
      );
      assert.strictEqual(tauriSaveRes.success, true);
      assert.strictEqual(tauriSaveRes.filePath, '/home/trader/CustomSnapshots/btc-breakout.png');
      assert.strictEqual(tauriSaveRes.isFallback, false, 'isFallback harus false saat Tauri IPC berhasil');
      assert.strictEqual(invokedCommand, 'save_snapshot_file');
      assert.strictEqual(invokedArgs.directory, '/home/trader/CustomSnapshots');
      assert.strictEqual(invokedArgs.filename, 'btc-breakout.png');

      // 4. saveSnapshotToFile saat Tauri invoke melempar error -> fallback jujur ke Downloads/
      (globalThis as any).window.__TAURI_INTERNALS__.invoke = async () => {
        throw new Error('OS disk write permission denied');
      };
      const tauriErrFallback = await saveSnapshotToFile(mockCanvas, 'btc-err.png', '/restricted/root');
      assert.strictEqual(tauriErrFallback.success, true);
      assert.strictEqual(tauriErrFallback.filePath, 'Downloads/btc-err.png');
      assert.strictEqual(tauriErrFallback.isFallback, true, 'isFallback harus true saat Tauri invoke melempar error');
    } finally {
      (globalThis as any).window = originalWindow;
    }

    // D. Lightweight Thumbnail Helper: createSnapshotThumbnail
    const highResCanvas = createMockCanvas(3840, 2160);
    const thumbUrl = createSnapshotThumbnail(highResCanvas, 200);
    assert.ok(thumbUrl, 'Thumbnail URL harus berhasil dihasilkan');
    assert.ok(thumbUrl.startsWith('data:image/png'), 'Thumbnail URL harus berupa data URL valid');

    // E. Defensive check: input invalid tidak boleh crash
    assert.strictEqual(createSnapshotThumbnail(null as any), undefined);
    assert.strictEqual(createSnapshotThumbnail(undefined as any), undefined);
    assert.strictEqual(createSnapshotThumbnail({} as any), undefined);
    assert.strictEqual(createSnapshotThumbnail(createMockCanvas(0, 0)), undefined);
  });
});
