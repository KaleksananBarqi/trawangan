import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  compositeSnapshot,
  resolveSecurityWatermarkText,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';

// Mock Canvas yang mencatat urutan operasi gambar secara presisi
function createRecordedCanvas(width = 800, height = 600) {
  const operations: { method: string; args: any[] }[] = [];
  const context: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
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
    translate: (...args: any[]) => operations.push({ method: 'translate', args }),
    rotate: (...args: any[]) => operations.push({ method: 'rotate', args }),
    fill: () => operations.push({ method: 'fill', args: [context.fillStyle] }),
    stroke: () => operations.push({ method: 'stroke', args: [context.strokeStyle] }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (...args: any[]) => operations.push({ method: 'fillRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth, context.globalAlpha] }),
    strokeText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'strokeText', args: [text, x, y, maxWidth] }),
    drawImage: (image: any, ...args: any[]) =>
      operations.push({ method: 'drawImage', args: [image, ...args] }),
    measureText: (text: string) => ({ width: text.length * 8 }),
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => ({
      addColorStop: () => {},
    }),
  };

  return {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    operations,
    context,
  };
}

describe('Bug Repro: Watermark Profile di Screenshot Tidak Muncul', () => {
  const metadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 68500,
    timezone: 'Asia/Jakarta',
  };

  test('REPRO: Di mode branded frame, drawImage(chartCanvas) menimpa drawSecurityWatermark jika chartCanvas opaque atau digambar di atas watermark', () => {
    const sourceCanvas = createRecordedCanvas(800, 600);
    const targetCanvas = createRecordedCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      padding: 24,
      backgroundColor: '#0F0F0F',
      watermark: {
        enabled: true,
        text: '', // Mengikuti profil
        opacity: 0.15,
      },
      userProfile: {
        username: 'Satoshi Nakamoto',
        handle: 'satoshin',
      },
      metadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Ambil semua operasi fillText untuk teks watermark
    const expectedWatermarkText = resolveSecurityWatermarkText(options.watermark, options.userProfile);
    assert.equal(expectedWatermarkText, 'Satoshi Nakamoto · @satoshin');

    const watermarkOps = targetCanvas.operations.filter(
      (op) => op.method === 'fillText' && op.args[0] === expectedWatermarkText
    );
    assert.ok(watermarkOps.length > 0, 'Watermark text harus dirender di kanvas');

    const drawImageCandleOps = targetCanvas.operations.filter(
      (op) => op.method === 'drawImage' && op.args[0] === sourceCanvas
    );
    assert.ok(drawImageCandleOps.length > 0, 'Kanvas chart lilin harus dirender');

    const watermarkIdx = targetCanvas.operations.indexOf(watermarkOps[0]);
    const drawImageIdx = targetCanvas.operations.indexOf(drawImageCandleOps[0]);

    // Setelah perbaikan:
    // drawImageIdx < watermarkIdx
    // sourceCanvas (grafik chart) digambar DULUAN, lalu watermark profil anti-maling
    // digambar DI ATASNYA dengan opasitas semi-transparan (globalAlpha = 0.15)
    // sehingga watermark profil tidak pernah tertimpa atau terhapus oleh piksel opaque grafik!
    assert.ok(
      drawImageIdx < watermarkIdx,
      `Grafik chart (index: ${drawImageIdx}) harus digambar sebelum watermark profil (index: ${watermarkIdx}) agar tidak menutupi watermark!`
    );

    // Verifikasi opasitas watermark diaplikasikan dengan benar (0.15)
    const watermarkAlpha = watermarkOps[0].args[4];
    assert.equal(watermarkAlpha, 0.15, 'Tanda air harus menggunakan opasitas semi-transparan sesuai preferensi pengguna');
  });

  test('KONSISTENSI: Mode clean juga menggambar watermark setelah drawImage grafik', () => {
    const sourceCanvas = createRecordedCanvas(800, 600);
    const targetCanvas = createRecordedCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'clean',
      scale: 1,
      padding: 0,
      watermark: {
        enabled: true,
        text: 'SECURE-CLEAN',
        opacity: 0.20,
      },
      metadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    const watermarkOps = targetCanvas.operations.filter(
      (op) => op.method === 'fillText' && op.args[0] === 'SECURE-CLEAN'
    );
    const drawImageCandleOps = targetCanvas.operations.filter(
      (op) => op.method === 'drawImage' && op.args[0] === sourceCanvas
    );

    const watermarkIdx = targetCanvas.operations.indexOf(watermarkOps[0]);
    const drawImageIdx = targetCanvas.operations.indexOf(drawImageCandleOps[0]);

    assert.ok(drawImageIdx < watermarkIdx, 'Mode clean juga harus menggambar chart sebelum watermark');
  });
});
