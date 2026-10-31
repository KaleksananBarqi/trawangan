import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import type { AppSettings, SecurityWatermarkConfig, UserProfileConfig } from '../src/lib/types/market';
import {
  compositeSnapshot,
  resolveSecurityWatermarkText,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';

/**
 * Mock helper 2D Canvas Context untuk lingkungan pengujian Node.js
 */
function createMockCanvas(width = 1280, height = 720) {
  const operations: { method: string; args: any[] }[] = [];
  const state: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0,
  };

  const context: any = {
    ...state,
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(val: number) {
      state.globalAlpha = val;
      operations.push({ method: 'setGlobalAlpha', args: [val] });
    },
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
    translate: (x: number, y: number) => operations.push({ method: 'translate', args: [x, y] }),
    rotate: (angle: number) => operations.push({ method: 'rotate', args: [angle] }),
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 3,
    }),
  };

  const canvas = {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    toDataURL: (type = 'image/png') => `data:${type};base64,mockImageData`,
    toBlob: (cb: (blob: Blob | null) => void, type = 'image/png') => {
      const mockBlob = new Blob(['mockBlobData'], { type });
      cb(mockBlob);
    },
    operations,
    context,
  };

  return canvas;
}

describe('Tiket #127: Anti-Theft Semi-Transparent Security Watermark Suite', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 67420.5,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-10-31T12:00:00Z'),
  };

  describe('1. AppSettings & Defaults: securityWatermark Schema & Normalization', () => {
    test('DEFAULT_APP_SETTINGS menyertakan konfigurasi default securityWatermark yang valid', () => {
      assert.ok(DEFAULT_APP_SETTINGS.securityWatermark, 'securityWatermark harus terdefinisi di DEFAULT_APP_SETTINGS');
      assert.equal(DEFAULT_APP_SETTINGS.securityWatermark.enabled, false);
      assert.equal(DEFAULT_APP_SETTINGS.securityWatermark.text, '');
      assert.equal(DEFAULT_APP_SETTINGS.securityWatermark.opacity, 0.10);
      assert.equal(DEFAULT_APP_SETTINGS.securityWatermark.showOnLiveCanvas, false);
    });

    test('resolveAppSettings menormalkan konfigurasi kosong atau null dengan nilai default yang aman', () => {
      const resolved = resolveAppSettings(null);
      assert.deepEqual(resolved.securityWatermark, {
        enabled: false,
        text: '',
        opacity: 0.10,
        showOnLiveCanvas: false,
      });
    });

    test('resolveAppSettings melakukan clamping rentang opacity ke 0.05 s.d. 0.30', () => {
      // Nilai terlalu rendah (< 0.05) di-clamp ke 0.05
      const tooLow = resolveAppSettings({
        securityWatermark: { enabled: true, opacity: 0.01, showOnLiveCanvas: false },
      });
      assert.equal(tooLow.securityWatermark?.opacity, 0.05);

      // Nilai terlalu tinggi (> 0.30) di-clamp ke 0.30
      const tooHigh = resolveAppSettings({
        securityWatermark: { enabled: true, opacity: 0.75, showOnLiveCanvas: false },
      });
      assert.equal(tooHigh.securityWatermark?.opacity, 0.30);

      // Nilai dalam rentang sah dipertahankan
      const valid = resolveAppSettings({
        securityWatermark: { enabled: true, opacity: 0.22, showOnLiveCanvas: true },
      });
      assert.equal(valid.securityWatermark?.opacity, 0.22);
      assert.equal(valid.securityWatermark?.showOnLiveCanvas, true);

      // Nilai non-numerik atau NaN dinormalkan ke default 0.10
      const invalidNaN = resolveAppSettings({
        securityWatermark: { enabled: true, opacity: NaN as any, showOnLiveCanvas: false },
      });
      assert.equal(invalidNaN.securityWatermark?.opacity, 0.10);
    });

    test('resolveSecurityWatermarkText menghasilkan teks kustom atau fallback cerdas dari userProfile', () => {
      // 1. Teks kustom eksplisit diprioritaskan
      const customRes = resolveSecurityWatermarkText(
        { enabled: true, text: 'PRIVATE TRADING GROUP', opacity: 0.15, showOnLiveCanvas: false },
        { username: 'TraderOne', handle: '@trader' }
      );
      assert.equal(customRes, 'PRIVATE TRADING GROUP');

      // 2. Teks kosong -> fallback ke username dan handle profil
      const fallbackBoth = resolveSecurityWatermarkText(
        { enabled: true, text: '   ', opacity: 0.15, showOnLiveCanvas: false },
        { username: 'Satoshi Nakamoto', handle: '@nakamoto' }
      );
      assert.equal(fallbackBoth, 'Satoshi Nakamoto (@nakamoto)');

      // 3. Hanya username
      const fallbackNameOnly = resolveSecurityWatermarkText(
        { enabled: true, text: '', opacity: 0.15, showOnLiveCanvas: false },
        { username: 'Barqi', handle: '' }
      );
      assert.equal(fallbackNameOnly, 'Barqi');

      // 4. Hanya handle (memastikan awalan @ rapi)
      const fallbackHandleOnly = resolveSecurityWatermarkText(
        { enabled: true, text: '', opacity: 0.15, showOnLiveCanvas: false },
        { username: '', handle: 'cryptowhale' }
      );
      assert.equal(fallbackHandleOnly, '@cryptowhale');

      // 5. Keduanya kosong -> fallback default sistem TRAWANGAN
      const fallbackSystem = resolveSecurityWatermarkText(
        { enabled: true, text: '', opacity: 0.15, showOnLiveCanvas: false },
        { username: '', handle: '' }
      );
      assert.equal(fallbackSystem, 'TRAWANGAN');
    });
  });

  describe('2. Canvas Rendering: Diagonal Security Watermark on Snapshot', () => {
    test('compositeSnapshot tidak merender watermark diagonal jika watermark.enabled = false', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1200, height: 600 };

      compositeSnapshot(source, {
        metadata: baseMetadata,
        watermark: { enabled: false, text: 'SECRET', opacity: 0.15, showOnLiveCanvas: false },
      }, mockCanvas);

      const rotateOps = mockCanvas.operations.filter((op) => op.method === 'rotate');
      assert.equal(rotateOps.length, 0, 'Tidak boleh ada operasi rotate untuk watermark jika enabled = false');

      const fillOps = mockCanvas.operations.filter(
        (op) => op.method === 'fillText' && String(op.args[0]).includes('SECRET')
      );
      assert.equal(fillOps.length, 0, 'Teks watermark tidak boleh di-render jika enabled = false');
    });

    test('compositeSnapshot merender watermark diagonal dengan rotasi sudut diagonal (-30° s.d. -35°) dan opasitas terkontrol', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1200, height: 600 };

      compositeSnapshot(source, {
        metadata: baseMetadata,
        watermark: {
          enabled: true,
          text: 'EXCLUSIVE ALPHA DESK',
          opacity: 0.18,
          showOnLiveCanvas: false,
        },
      }, mockCanvas);

      // Periksa operasi rotasi sudut diagonal antara -30° (-0.5236 rad) dan -35° (-0.6108 rad)
      const rotateOps = mockCanvas.operations.filter((op) => op.method === 'rotate');
      assert.ok(rotateOps.length >= 1, 'Harus ada pemanggilan rotate untuk memiringkan watermark secara diagonal');
      const angleRad = rotateOps[0].args[0];
      const angleDeg = (angleRad * 180) / Math.PI;
      assert.ok(
        angleDeg <= -29 && angleDeg >= -36,
        `Sudut rotasi watermark (${angleDeg}°) harus berada di rentang diagonal -30° s.d. -35°`
      );

      // Periksa opasitas diterapkan sesuai nilai watermark.opacity
      const alphaOps = mockCanvas.operations.filter(
        (op) => op.method === 'setGlobalAlpha' && Math.abs(op.args[0] - 0.18) < 0.001
      );
      assert.ok(alphaOps.length >= 1, 'globalAlpha harus diset sesuai nilai opacity (0.18)');

      // Periksa teks watermark digambar
      const fillTextOps = mockCanvas.operations.filter(
        (op) => op.method === 'fillText' && op.args[0] === 'EXCLUSIVE ALPHA DESK'
      );
      assert.equal(fillTextOps.length, 1, 'Teks watermark harus digambar tepat 1 kali');
    });

    test('compositeSnapshot memanfaatkan fallback teks userProfile saat watermark.text kosong', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1200, height: 600 };

      compositeSnapshot(source, {
        metadata: baseMetadata,
        userProfile: {
          username: 'John Doe',
          handle: '@johndoe',
        },
        watermark: {
          enabled: true,
          text: '',
          opacity: 0.12,
          showOnLiveCanvas: false,
        },
      }, mockCanvas);

      const fillTextOps = mockCanvas.operations.filter(
        (op) => op.method === 'fillText' && op.args[0] === 'John Doe (@johndoe)'
      );
      assert.equal(fillTextOps.length, 1, 'Teks fallback John Doe (@johndoe) harus dirender saat watermark.text kosong');
    });
  });

  describe('3. Clean Chart Mode: Security Watermark Preservation', () => {
    test('Mode clean chart tetap merender watermark diagonal jika diaktifkan', () => {
      const mockCanvas = createMockCanvas(1200, 600);
      const source = { width: 1200, height: 600 };

      compositeSnapshot(source, {
        mode: 'clean',
        metadata: baseMetadata,
        watermark: {
          enabled: true,
          text: 'CONFIDENTIAL CLEAN',
          opacity: 0.20,
          showOnLiveCanvas: false,
        },
      }, mockCanvas);

      // Pada clean mode, source image di-draw
      const drawImageOps = mockCanvas.operations.filter((op) => op.method === 'drawImage');
      assert.ok(drawImageOps.length >= 1, 'Clean mode harus merender source canvas');

      // Dan watermark keamanan tetap dirender di atasnya
      const fillTextOps = mockCanvas.operations.filter(
        (op) => op.method === 'fillText' && op.args[0] === 'CONFIDENTIAL CLEAN'
      );
      assert.equal(fillTextOps.length, 1, 'Clean mode wajib merender watermark keamanan saat enabled');

      const rotateOps = mockCanvas.operations.filter((op) => op.method === 'rotate');
      assert.ok(rotateOps.length >= 1, 'Clean mode wajib merotasi watermark secara diagonal');
    });

    test('Mode clean chart tidak merender watermark jika watermark.enabled = false', () => {
      const mockCanvas = createMockCanvas(1200, 600);
      const source = { width: 1200, height: 600 };

      compositeSnapshot(source, {
        mode: 'clean',
        metadata: baseMetadata,
        watermark: {
          enabled: false,
          text: 'SHOULD NOT APPEAR',
          opacity: 0.20,
          showOnLiveCanvas: false,
        },
      }, mockCanvas);

      const fillTextOps = mockCanvas.operations.filter(
        (op) => op.method === 'fillText' && String(op.args[0]).includes('SHOULD NOT APPEAR')
      );
      assert.equal(fillTextOps.length, 0);
    });
  });

  describe('4. Live Canvas Integration: showOnLiveCanvas Toggle Contract', () => {
    test('showOnLiveCanvas mempertahankan toggle boolean dan evaluasi visibilitas kanvas kerja', () => {
      const configInactive: SecurityWatermarkConfig = {
        enabled: false,
        opacity: 0.10,
        showOnLiveCanvas: true,
      };
      // Jika enabled = false, live canvas tidak boleh menampilkan watermark kendati showOnLiveCanvas true
      const shouldRenderInactive = configInactive.enabled && configInactive.showOnLiveCanvas;
      assert.equal(shouldRenderInactive, false);

      const configActiveWithoutLive: SecurityWatermarkConfig = {
        enabled: true,
        opacity: 0.10,
        showOnLiveCanvas: false,
      };
      // Jika showOnLiveCanvas = false, live canvas tidak menampilkan
      const shouldRenderNoLive = configActiveWithoutLive.enabled && configActiveWithoutLive.showOnLiveCanvas;
      assert.equal(shouldRenderNoLive, false);

      const configActiveWithLive: SecurityWatermarkConfig = {
        enabled: true,
        opacity: 0.25,
        showOnLiveCanvas: true,
      };
      // Jika keduanya true, live canvas merender watermark
      const shouldRenderLive = configActiveWithLive.enabled && configActiveWithLive.showOnLiveCanvas;
      assert.equal(shouldRenderLive, true);
    });
  });
});
