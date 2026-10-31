import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  compositeSnapshot,
  captureSnapshot,
  resolveSecurityWatermarkText,
  preloadAvatarImage,
  getCachedAvatar,
  clearCachedAvatar,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { THEME_PRESETS } from '../src/lib/constants/themes';

// Helper mock 2D Canvas
function createMockCanvas(width = 800, height = 600) {
  const operations: { method: string; args: any[] }[] = [];
  const context: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
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
    strokeRect: (...args: any[]) => operations.push({ method: 'strokeRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth] }),
    strokeText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'strokeText', args: [text, x, y, maxWidth] }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      const gradObj = {
        type: 'linearGradient',
        coords: [x0, y0, x1, y1],
        colorStops: [] as any[],
        addColorStop: (offset: number, color: string) => {
          gradObj.colorStops.push({ offset, color });
          operations.push({ method: 'addColorStop', args: [offset, color] });
        },
      };
      return gradObj;
    },
  };

  return {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    operations,
    context,
  };
}

describe('Evaluasi Fix: Custom Background, Frame Margin, & Profile Attribution', () => {
  const baseMeta: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 67500,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-10-31T12:00:00Z'),
  };

  test('1. Vela Transparency: Controller mengirim theme background "transparent" ke workspace saat custom background aktif', () => {
    let capturedInitConfig: any = null;
    let capturedTheme: any = null;
    const mockWs = {
      cells: () => [],
      active: null,
      setTheme: (theme: any) => { capturedTheme = theme; },
      on: () => {},
      off: () => {},
      destroy: () => {},
    };

    const mockChild: any = { style: { background: '', setProperty: (p: string, v: string) => { mockChild.style[p] = v; }, removeProperty: (p: string) => { delete mockChild.style[p]; } } };
    const mockContainer: any = {
      style: { background: '' },
      children: [mockChild],
      querySelectorAll: () => [mockChild],
      clientWidth: 800,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      themePreset: 'signature',
      customChartBackground: {
        mode: 'gradient',
        gradientTop: '#112233',
        gradientBottom: '#445566',
      },
      workspaceFactory: (_c: any, cfg: any) => {
        capturedInitConfig = cfg;
        return mockWs;
      },
    });

    controller.attach(mockContainer);

    assert.equal(capturedInitConfig.theme.background, 'transparent', 'Workspace Vela harus diinisialisasi dengan theme.background transparent');
    assert.equal(mockChild.style.background, 'transparent', 'Elemen anak Vela harus transparan');

    // Kembalikan ke theme
    controller.setCustomChartBackground({ mode: 'theme' });
    assert.equal(capturedTheme.background, THEME_PRESETS.signature.chart.background, 'Workspace Vela harus kembali ke warna background tema');

    controller.destroy();
  });

  test('2. Snapshot Frame Margin: Outer container harus selalu menggunakan backgroundColor (#0F0F0F), bukan customBg', () => {
    const sourceCanvas = createMockCanvas(800, 500);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      padding: 24,
      backgroundColor: '#0F0F0F',
      customBackground: {
        mode: 'solid',
        solidColor: '#FF5500',
      },
      metadata: baseMeta,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Operasi fill pertama (outer container) HARUS #0F0F0F
    const fillOps = targetCanvas.operations.filter((op) => op.method === 'fill');
    assert.ok(fillOps.length >= 2, 'Harus ada minimal 2 operasi fill (container frame dan chart area)');
    assert.equal(fillOps[0].args[0], '#0F0F0F', 'Outer frame container harus diisi dengan #0F0F0F, BUKAN customBg!');
    assert.equal(fillOps[1].args[0], '#FF5500', 'Area chart harus diisi dengan customBg (#FF5500)');
  });

  test('3. Profile Attribution: bio dan handle ditampilkan di attribution bar saat tersedia', () => {
    const sourceCanvas = createMockCanvas(800, 500);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      padding: 24,
      backgroundColor: '#0F0F0F',
      userProfile: {
        username: 'Satoshi Nakamoto',
        handle: 'satoshin',
        bio: 'Chief Architect',
      },
      metadata: baseMeta,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    const textOps = targetCanvas.operations.filter((op) => op.method === 'fillText');
    const hasUsername = textOps.some((op) => op.args[0] === 'Satoshi Nakamoto');
    const hasHandle = textOps.some((op) => op.args[0] === '@satoshin');
    const hasBio = textOps.some((op) => String(op.args[0]).includes('Chief Architect'));

    assert.ok(hasUsername, 'Username harus dirender di attribution bar');
    assert.ok(hasHandle, 'Handle (@satoshin) harus dirender di attribution bar');
    assert.ok(hasBio, 'Bio/deskripsi harus dirender di attribution bar');
  });

  test('4. Security Watermark Text Resolution menyertakan username, handle, dan bio jika kustom kosong', () => {
    const textWithCustom = resolveSecurityWatermarkText({ text: 'CONFIDENTIAL ALPHA' }, { username: 'TraderX', handle: 'x' });
    assert.equal(textWithCustom, 'CONFIDENTIAL ALPHA');

    const textFromProfile = resolveSecurityWatermarkText({ text: '' }, { username: 'TraderX', handle: '@traderx', bio: 'Swing Specialist' });
    assert.equal(textFromProfile, 'TraderX · @traderx');

    const textFallback = resolveSecurityWatermarkText({ text: '' }, { username: '', handle: '' });
    assert.equal(textFallback, 'TRAWANGAN');
  });

  test('5. Watermark di belakang lilin: drawSecurityWatermark dipanggil sebelum drawImage candlestick', () => {
    const sourceCanvas = createMockCanvas(800, 500);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      padding: 24,
      backgroundColor: '#0F0F0F',
      watermark: {
        enabled: true,
        text: 'ANTI-THEFT-WATERMARK',
        opacity: 0.15,
      },
      metadata: baseMeta,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Cari indeks di mana teks watermark digambar dan indeks di mana sourceCanvas digambar
    const watermarkTextIdx = targetCanvas.operations.findIndex(
      (op) => op.method === 'fillText' && op.args[0] === 'ANTI-THEFT-WATERMARK'
    );
    const drawImageCandleIdx = targetCanvas.operations.findIndex(
      (op) => op.method === 'drawImage' && op.args[0] === sourceCanvas
    );

    assert.ok(watermarkTextIdx !== -1, 'Watermark text harus dirender di canvas');
    assert.ok(drawImageCandleIdx !== -1, 'Candlestick canvas harus dirender di canvas');
    assert.ok(
      watermarkTextIdx < drawImageCandleIdx,
      'Watermark harus digambar SEBELUM (di belakang) candlestick canvas!'
    );
  });
});
