import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompositeDimensions,
  generateSnapshotFilename,
  formatSnapshotTimestamp,
  formatSnapshotPrice,
  compositeSnapshot,
  captureSnapshot,
  getSnapshotDataUrl,
  getSnapshotBlob,
  copySnapshotToClipboard,
  downloadSnapshot,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';

// Helper mock untuk 2D Canvas Context dalam lingkungan Node.js
function createMockCanvas(width = 800, height = 600) {
  const operations: { method: string; args: any[] }[] = [];
  const state: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };

  const context: any = {
    ...state,
    save: () => operations.push({ method: 'save', args: [] }),
    restore: () => operations.push({ method: 'restore', args: [] }),
    beginPath: () => operations.push({ method: 'beginPath', args: [] }),
    closePath: () => operations.push({ method: 'closePath', args: [] }),
    moveTo: (x: number, y: number) => operations.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => operations.push({ method: 'lineTo', args: [x, y] }),
    arc: (...args: any[]) => operations.push({ method: 'arc', args }),
    arcTo: (...args: any[]) => operations.push({ method: 'arcTo', args }),
    roundRect: (...args: any[]) => operations.push({ method: 'roundRect', args }),
    rect: (...args: any[]) => operations.push({ method: 'rect', args }),
    fill: () => operations.push({ method: 'fill', args: [context.fillStyle] }),
    stroke: () => operations.push({ method: 'stroke', args: [context.strokeStyle] }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (...args: any[]) => operations.push({ method: 'fillRect', args }),
    strokeRect: (...args: any[]) => operations.push({ method: 'strokeRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth, context.font, context.fillStyle] }),
    strokeText: (text: string, x: number, y: number) =>
      operations.push({ method: 'strokeText', args: [text, x, y] }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
  };

  const canvas = {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    toDataURL: (type = 'image/png') => `data:${type};base64,mockImageData`,
    toBlob: (cb: (blob: Blob | null) => void, type = 'image/png') => {
      // Mock Blob
      const mockBlob = new Blob(['mockBlobData'], { type });
      cb(mockBlob);
    },
    operations,
    context,
  };

  return canvas;
}

describe('Chart Snapshot Service Seam Suite (#93)', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 67420.5,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-10-30T11:20:00Z'),
  };

  describe('1. calculateCompositeDimensions', () => {
    test('Branded Frame: menghitung dimensi dengan padding 24px dan attribution bar 60px pada scale 2x', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        metadata: baseMetadata,
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // (1000 + 48) * 2 = 2096
      assert.equal(dim.width, 2096);
      // (600 + 48 + 60) * 2 = 1416
      assert.equal(dim.height, 1416);
      assert.equal(dim.chartX, 48); // 24 * 2
      assert.equal(dim.chartY, 48); // 24 * 2
      assert.equal(dim.chartWidth, 2000); // 1000 * 2
      assert.equal(dim.chartHeight, 1200); // 600 * 2
      assert.equal(dim.attributionY, 1248); // (24 + 600) * 2
      assert.equal(dim.attributionHeight, 120); // 60 * 2
    });

    test('Clean Chart: dimensi persis sama dengan source raster pada skala 1x dan 2x', () => {
      const sourceW = 800;
      const sourceH = 500;

      const dimScale1 = calculateCompositeDimensions(sourceW, sourceH, {
        mode: 'clean',
        scale: 1,
        metadata: baseMetadata,
      });

      assert.equal(dimScale1.width, 800);
      assert.equal(dimScale1.height, 500);
      assert.equal(dimScale1.chartX, 0);
      assert.equal(dimScale1.chartY, 0);
      assert.equal(dimScale1.chartWidth, 800);
      assert.equal(dimScale1.chartHeight, 500);
      assert.equal(dimScale1.attributionY, 0);
      assert.equal(dimScale1.attributionHeight, 0);

      const dimScale2 = calculateCompositeDimensions(sourceW, sourceH, {
        mode: 'clean',
        scale: 2,
        metadata: baseMetadata,
      });

      assert.equal(dimScale2.width, 1600);
      assert.equal(dimScale2.height, 1000);
      assert.equal(dimScale2.chartWidth, 1600);
      assert.equal(dimScale2.chartHeight, 1000);
    });

    test('Default options: mode default branded dan scale default 2', () => {
      const dim = calculateCompositeDimensions(500, 300, {
        metadata: baseMetadata,
      });

      // Default padding 24, attribution 60, scale 2
      // width: (500 + 48) * 2 = 1096
      // height: (300 + 48 + 60) * 2 = 816
      assert.equal(dim.width, 1096);
      assert.equal(dim.height, 816);
    });
  });

  describe('2. generateSnapshotFilename', () => {
    test('Format penamaan file terstruktur: trawangan-[symbol]-[tf]-[formattedDate].png', () => {
      const date = new Date(2026, 9, 30, 18, 20, 30); // 30 Okt 2026, 18:20:30
      const filename = generateSnapshotFilename('BTCUSDT', '15m', date);
      assert.match(filename, /^trawangan-BTCUSDT-15m-20261030-182030\.png$/);
    });

    test('Sanitasi karakter khusus (: dan /) agar aman untuk filesystem OS', () => {
      const date = new Date(2026, 9, 30, 18, 20, 30);
      const filename = generateSnapshotFilename('BINANCE:ETH/USDT', '1h', date);
      assert.equal(filename, 'trawangan-BINANCE-ETH-USDT-1h-20261030-182030.png');
    });

    test('Mendukung timestamp berupa angka unix epoch millis', () => {
      const timeMs = new Date(2026, 9, 30, 12, 0, 0).getTime();
      const filename = generateSnapshotFilename('SOLUSDT', '4h', timeMs);
      assert.match(filename, /^trawangan-SOLUSDT-4h-20261030-120000\.png$/);
    });
  });

  describe('3. formatSnapshotTimestamp', () => {
    test('Format default WIB (Asia/Jakarta) dengan tanggal dan jam rapi', () => {
      // 30 Oktober 2026 11:20:00 UTC = 18:20:00 WIB
      const date = new Date('2026-10-30T11:20:00Z');
      const formatted = formatSnapshotTimestamp(date, 'Asia/Jakarta');
      assert.ok(formatted.includes('30 Okt 2026') || formatted.includes('30 Oct 2026'));
      assert.ok(formatted.includes('18:20') || formatted.includes('18.20'));
      assert.ok(formatted.includes('WIB'));
    });

    test('Format dengan timezone UTC', () => {
      const date = new Date('2026-10-30T11:20:00Z');
      const formatted = formatSnapshotTimestamp(date, 'UTC');
      assert.ok(formatted.includes('11:20') || formatted.includes('11.20'));
      assert.ok(formatted.includes('UTC'));
    });
  });

  describe('4. formatSnapshotPrice', () => {
    test('Format harga besar >= 1000 dengan pemisah ribuan', () => {
      assert.equal(formatSnapshotPrice(67420.5), '67,420.50');
      assert.equal(formatSnapshotPrice(1234567.89), '1,234,567.89');
    });

    test('Format harga kecil < 1 dengan presisi desimal cukup', () => {
      assert.equal(formatSnapshotPrice(0.000456), '0.000456');
    });

    test('Format harga dengan pasangan IDR', () => {
      assert.equal(formatSnapshotPrice(1050000, 'IDR'), '1.050.000');
    });

    test('Menangani nilai null, undefined, atau NaN dengan aman', () => {
      assert.equal(formatSnapshotPrice(null), '-');
      assert.equal(formatSnapshotPrice(undefined), '-');
      assert.equal(formatSnapshotPrice(NaN), '-');
    });
  });

  describe('5. compositeSnapshot & Rendering Canvas', () => {
    test('Render mode branded: menggambar container background, chart raster, dan attribution bar', () => {
      const sourceCanvas = createMockCanvas(500, 300);
      const targetCanvas = createMockCanvas(1, 1);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        backgroundColor: '#0F0F0F',
        metadata: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          providerId: 'binance',
          lastPrice: 67420.5,
          timezone: 'Asia/Jakarta',
          timestamp: new Date('2026-10-30T11:20:00Z'),
        },
      };

      const result = compositeSnapshot(sourceCanvas, options, targetCanvas);
      assert.equal(result, targetCanvas);

      // Verifikasi target canvas di-resize ke dimensi komposit
      assert.equal(targetCanvas.width, (500 + 48) * 2);
      assert.equal(targetCanvas.height, (300 + 48 + 60) * 2);

      // Verifikasi drawImage dipanggil untuk merender source chart
      const drawImageOp = targetCanvas.operations.find((op) => op.method === 'drawImage');
      assert.ok(drawImageOp, 'Harus memanggil drawImage untuk merender chart');
      assert.equal(drawImageOp.args[0], sourceCanvas);
      assert.equal(drawImageOp.args[1], 48); // chartX (24 * 2)
      assert.equal(drawImageOp.args[2], 48); // chartY (24 * 2)
      assert.equal(drawImageOp.args[3], 1000); // chartWidth (500 * 2)
      assert.equal(drawImageOp.args[4], 600); // chartHeight (300 * 2)

      // Verifikasi teks-teks pada Attribution Bar digambar
      const fillTextOps = targetCanvas.operations.filter((op) => op.method === 'fillText');
      const drawnTexts = fillTextOps.map((op) => op.args[0]);

      // Monogram 'tr'
      assert.ok(drawnTexts.includes('tr'), 'Attribution bar harus memuat monogram "tr"');
      // Brand 'trawangan'
      assert.ok(drawnTexts.includes('trawangan'), 'Attribution bar harus memuat teks brand "trawangan"');
      // Badge instrumen
      const hasInstrumentBadge = drawnTexts.some((txt) => txt.includes('BTCUSDT') && txt.includes('15m'));
      assert.ok(hasInstrumentBadge, 'Attribution bar harus memuat badge instrumen');
      // Harga pasar
      const hasPrice = drawnTexts.some((txt) => txt.includes('67,420.50'));
      assert.ok(hasPrice, 'Attribution bar harus memuat harga terakhir');
      // URL Trawangan
      const hasUrl = drawnTexts.some((txt) => txt.includes('kaleksananbarqi.github.io/trawangan'));
      assert.ok(hasUrl, 'Attribution bar harus memuat website URL');
    });

    test('Render mode clean: hanya menggambar raster chart tanpa bingkai atau attribution bar', () => {
      const sourceCanvas = createMockCanvas(400, 200);
      const targetCanvas = createMockCanvas(1, 1);

      const options: SnapshotOptions = {
        mode: 'clean',
        scale: 2,
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      assert.equal(targetCanvas.width, 800);
      assert.equal(targetCanvas.height, 400);

      const drawImageOp = targetCanvas.operations.find((op) => op.method === 'drawImage');
      assert.ok(drawImageOp);
      assert.equal(drawImageOp.args[1], 0);
      assert.equal(drawImageOp.args[2], 0);

      const fillTextOps = targetCanvas.operations.filter((op) => op.method === 'fillText');
      assert.equal(fillTextOps.length, 0, 'Clean mode tidak boleh menggambar teks attribution');
    });

    test('Toggle includePrice, includeTimestamp, dan includeBrandUrl menghormati konfigurasi opsi', () => {
      const sourceCanvas = createMockCanvas(400, 200);
      const targetCanvas = createMockCanvas(1, 1);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        includePrice: false,
        includeTimestamp: false,
        includeBrandUrl: false,
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      const fillTextOps = targetCanvas.operations.filter((op) => op.method === 'fillText');
      const drawnTexts = fillTextOps.map((op) => op.args[0]);

      assert.ok(!drawnTexts.some((txt) => txt.includes('67,420.50')), 'Harga tidak boleh digambar');
      assert.ok(!drawnTexts.some((txt) => txt.includes('kaleksananbarqi.github.io/trawangan')), 'URL tidak boleh digambar');
    });
  });

  describe('6. Helper Ekspor: captureSnapshot, getSnapshotDataUrl, getSnapshotBlob', () => {
    test('getSnapshotDataUrl mengembalikan data URL string valid', async () => {
      const sourceCanvas = createMockCanvas(300, 200);
      const dataUrl = await getSnapshotDataUrl(sourceCanvas, {
        metadata: baseMetadata,
      });
      assert.ok(dataUrl.startsWith('data:image/png'));
    });

    test('getSnapshotBlob mengembalikan objek Blob PNG', async () => {
      const sourceCanvas = createMockCanvas(300, 200);
      const blob = await getSnapshotBlob(sourceCanvas, {
        metadata: baseMetadata,
      });
      assert.ok(blob);
      assert.equal(blob.type, 'image/png');
    });

    test('captureSnapshot mengembalikan target canvas yang siap diekspor', async () => {
      const sourceCanvas = createMockCanvas(300, 200);
      const canvas = await captureSnapshot(sourceCanvas, {
        metadata: baseMetadata,
      });
      assert.ok(canvas);
      assert.ok(canvas.width > 0);
      assert.ok(canvas.height > 0);
    });
  });

  describe('7. Clipboard & Download Helpers', () => {
    test('copySnapshotToClipboard sukses jika clipboard write tersedia', async () => {
      const originalClipboardItem = (globalThis as any).ClipboardItem;

      let clipboardWrittenItems: any = null;

      (globalThis as any).ClipboardItem = class MockClipboardItem {
        data: any;
        constructor(data: any) {
          this.data = data;
        }
      };

      const mockClipboardApi = {
        write: async (items: any[]) => {
          clipboardWrittenItems = items;
        },
      };

      const canvas = createMockCanvas(400, 300);

      try {
        const result = await copySnapshotToClipboard(canvas, mockClipboardApi);
        assert.equal(result.success, true);
        assert.ok(clipboardWrittenItems);
      } finally {
        (globalThis as any).ClipboardItem = originalClipboardItem;
      }
    });

    test('copySnapshotToClipboard menangani error dengan graceful fallback saat write gagal', async () => {
      const originalClipboardItem = (globalThis as any).ClipboardItem;

      (globalThis as any).ClipboardItem = class MockClipboardItem {
        data: any;
        constructor(data: any) {
          this.data = data;
        }
      };

      const mockClipboardApi = {
        write: async () => {
          throw new Error('Clipboard access denied by OS permission');
        },
      };

      const canvas = createMockCanvas(400, 300);

      try {
        const result = await copySnapshotToClipboard(canvas, mockClipboardApi);
        assert.equal(result.success, false);
        assert.ok(result.error?.includes('denied'));
        assert.ok(result.fallbackUrl?.startsWith('data:image/png'));
      } finally {
        (globalThis as any).ClipboardItem = originalClipboardItem;
      }
    });

    test('copySnapshotToClipboard menangani lingkungan tanpa Clipboard API', async () => {
      const canvas = createMockCanvas(400, 300);
      const result = await copySnapshotToClipboard(canvas, null);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('tidak didukung'));
      assert.ok(result.fallbackUrl?.startsWith('data:image/png'));
    });

    test('downloadSnapshot mengembalikan URL dan memicu klik link jika document tersedia', () => {
      const originalDocument = (globalThis as any).document;

      let clicked = false;
      let downloadAttr = '';
      let hrefAttr = '';

      (globalThis as any).document = {
        createElement: (tag: string) => {
          if (tag === 'a') {
            return {
              set download(val: string) {
                downloadAttr = val;
              },
              set href(val: string) {
                hrefAttr = val;
              },
              click: () => {
                clicked = true;
              },
            };
          }
          return {};
        },
        body: {
          appendChild: () => {},
          removeChild: () => {},
        },
      };

      const canvas = createMockCanvas(400, 300);

      try {
        const resultUrl = downloadSnapshot(canvas, 'test-snapshot.png');
        assert.equal(clicked, true);
        assert.equal(downloadAttr, 'test-snapshot.png');
        assert.ok(resultUrl.startsWith('data:image/png'));
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
  });
});
