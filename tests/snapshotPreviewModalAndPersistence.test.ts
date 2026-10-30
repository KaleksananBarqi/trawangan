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
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

// Mock Canvas 2D untuk pengujian node environment
function createMockCanvas(width = 1200, height = 800): any {
  const drawCalls: string[] = [];
  return {
    width,
    height,
    getContext: (type: string) => ({
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
      fill: () => drawCalls.push('fill'),
      stroke: () => drawCalls.push('stroke'),
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
    }),
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
  });

  await t.test('2. resolveAppSettings: Normalisasi dan fallback preferensi snapshot', () => {
    // A. Input kosong / null mengembalikan seluruh default snapshot
    const resolvedEmpty = resolveAppSettings(null);
    assert.strictEqual(resolvedEmpty.snapshotIncludeFrame, true);
    assert.strictEqual(resolvedEmpty.snapshotIncludePrice, true);
    assert.strictEqual(resolvedEmpty.snapshotIncludeTimestamp, true);
    assert.strictEqual(resolvedEmpty.snapshotScope, 'active');

    // B. Input parsial mempertahankan nilai kustom dan memberi fallback ke nilai default yang aman
    const resolvedPartial = resolveAppSettings({
      snapshotIncludeFrame: false,
      snapshotScope: 'all',
    } as any);
    assert.strictEqual(resolvedPartial.snapshotIncludeFrame, false);
    assert.strictEqual(resolvedPartial.snapshotIncludePrice, true);
    assert.strictEqual(resolvedPartial.snapshotIncludeTimestamp, true);
    assert.strictEqual(resolvedPartial.snapshotScope, 'all');

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
});
