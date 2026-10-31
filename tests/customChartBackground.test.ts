import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { THEME_PRESETS } from '../src/lib/constants/themes';
import {
  compositeSnapshot,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';
import type { CustomChartBackgroundConfig } from '../src/lib/types/market';

// Helper mock untuk 2D Canvas Context dengan dukungan createLinearGradient
function createMockCanvasWithGradient(width = 800, height = 600) {
  const operations: { method: string; args: any[] }[] = [];
  const gradients: Array<{
    coords: number[];
    colorStops: Array<{ offset: number; color: string }>;
  }> = [];

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
    fill: () => operations.push({ method: 'fill', args: [context.fillStyle] }),
    stroke: () => operations.push({ method: 'stroke', args: [context.strokeStyle] }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (...args: any[]) => operations.push({ method: 'fillRect', args }),
    strokeRect: (...args: any[]) => operations.push({ method: 'strokeRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth] }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      const stops: Array<{ offset: number; color: string }> = [];
      const gradObj = {
        type: 'linearGradient',
        coords: [x0, y0, x1, y1],
        colorStops: stops,
        addColorStop: (offset: number, color: string) => {
          stops.push({ offset, color });
          operations.push({ method: 'addColorStop', args: [offset, color] });
        },
      };
      gradients.push(gradObj);
      operations.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
      return gradObj;
    },
  };

  return {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    operations,
    gradients,
    context,
  };
}

describe('Tiket #128: Custom Chart Canvas Background (Solid & Vertical Gradient)', () => {
  describe('1. Default Settings & Sanitasi resolveAppSettings', () => {
    test('a. DEFAULT_APP_SETTINGS memuat customChartBackground dengan nilai awal mode "theme"', () => {
      assert.ok(DEFAULT_APP_SETTINGS.customChartBackground, 'customChartBackground harus terdefinisi');
      assert.equal(DEFAULT_APP_SETTINGS.customChartBackground?.mode, 'theme');
      assert.equal(DEFAULT_APP_SETTINGS.customChartBackground?.solidColor, '#0F0F0F');
      assert.equal(DEFAULT_APP_SETTINGS.customChartBackground?.gradientTop, '#0F0F0F');
      assert.equal(DEFAULT_APP_SETTINGS.customChartBackground?.gradientBottom, '#181A20');
    });

    test('b. resolveAppSettings mengembalikan default aman jika input kosong atau null', () => {
      const resolved = resolveAppSettings(null);
      assert.deepEqual(resolved.customChartBackground, {
        mode: 'theme',
        solidColor: '#0F0F0F',
        gradientTop: '#0F0F0F',
        gradientBottom: '#181A20',
      });
    });

    test('c. resolveAppSettings menormalkan mode invalid ke "theme" dan mempertahankan warna valid', () => {
      const resolved = resolveAppSettings({
        customChartBackground: {
          mode: 'invalid_mode' as any,
          solidColor: '#222222',
        },
      });
      assert.ok(resolved.customChartBackground);
      assert.equal(resolved.customChartBackground.mode, 'theme');
      assert.equal(resolved.customChartBackground.solidColor, '#222222');
      assert.equal(resolved.customChartBackground.gradientTop, '#0F0F0F');
    });

    test('d. resolveAppSettings mempertahankan konfigurasi solid dan gradient yang valid', () => {
      const solidResolved = resolveAppSettings({
        customChartBackground: {
          mode: 'solid',
          solidColor: '#1A1A1A',
        },
      });
      assert.ok(solidResolved.customChartBackground);
      assert.equal(solidResolved.customChartBackground.mode, 'solid');
      assert.equal(solidResolved.customChartBackground.solidColor, '#1A1A1A');

      const gradientResolved = resolveAppSettings({
        customChartBackground: {
          mode: 'gradient',
          gradientTop: '#101010',
          gradientBottom: '#303030',
        },
      });
      assert.ok(gradientResolved.customChartBackground);
      assert.equal(gradientResolved.customChartBackground.mode, 'gradient');
      assert.equal(gradientResolved.customChartBackground.gradientTop, '#101010');
      assert.equal(gradientResolved.customChartBackground.gradientBottom, '#303030');
    });
  });

  describe('2. Penerapan Background di ChartSessionController & DOM Wrapper', () => {
    test('a. Menerapkan background mode "theme" sesuai warna tema aktif', () => {
      const mockContainer: any = {
        style: { background: '' },
        clientWidth: 800,
        clientHeight: 600,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const mockWs = {
        cells: () => [],
        active: null,
        setTheme: () => {},
        on: () => {},
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        themePreset: 'signature',
        workspaceFactory: () => mockWs,
      });

      controller.attach(mockContainer);

      assert.equal(mockContainer.style.background, THEME_PRESETS.signature.chart.background);

      controller.destroy();
    });

    test('b. Menerapkan background mode "solid" dengan warna hex spesifik', () => {
      const mockContainer: any = {
        style: { background: '' },
        clientWidth: 800,
        clientHeight: 600,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const mockWs = {
        cells: () => [],
        active: null,
        setTheme: () => {},
        on: () => {},
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        themePreset: 'signature',
        customChartBackground: {
          mode: 'solid',
          solidColor: '#123456',
        },
        workspaceFactory: () => mockWs,
      });

      controller.attach(mockContainer);

      assert.equal(mockContainer.style.background, '#123456');

      // Update secara dinamis via setCustomChartBackground
      controller.setCustomChartBackground({
        mode: 'solid',
        solidColor: '#654321',
      });
      assert.equal(mockContainer.style.background, '#654321');

      controller.destroy();
    });

    test('c. Menerapkan background mode "gradient" dengan CSS linear-gradient vertikal', () => {
      const mockContainer: any = {
        style: { background: '' },
        clientWidth: 800,
        clientHeight: 600,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const mockWs = {
        cells: () => [],
        active: null,
        setTheme: () => {},
        on: () => {},
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        themePreset: 'signature',
        customChartBackground: {
          mode: 'gradient',
          gradientTop: '#10141E',
          gradientBottom: '#1F2937',
        },
        workspaceFactory: () => mockWs,
      });

      controller.attach(mockContainer);

      assert.equal(mockContainer.style.background, 'linear-gradient(180deg, #10141E, #1F2937)');

      controller.destroy();
    });

    test('d. Reset latar belakang kembali ke mode "theme" mengembalikan warna latar preset tema', () => {
      const mockContainer: any = {
        style: { background: '' },
        clientWidth: 800,
        clientHeight: 600,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const mockWs = {
        cells: () => [],
        active: null,
        setTheme: () => {},
        on: () => {},
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        themePreset: 'binance',
        customChartBackground: {
          mode: 'solid',
          solidColor: '#FF0000',
        },
        workspaceFactory: () => mockWs,
      });

      controller.attach(mockContainer);
      assert.equal(mockContainer.style.background, '#FF0000');

      // Reset ke mode theme
      controller.setCustomChartBackground({
        mode: 'theme',
      });
      assert.equal(mockContainer.style.background, THEME_PRESETS.binance.chart.background);

      controller.destroy();
    });
  });

  describe('3. Kompositor Snapshot 2D Kanvas dengan Custom Background', () => {
    const baseMetadata: SnapshotMetadata = {
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      lastPrice: 68000,
      timezone: 'Asia/Jakarta',
      timestamp: new Date('2026-10-31T12:00:00Z'),
    };

    test('a. compositeSnapshot dengan mode "solid" menggunakan solidColor untuk latar container dan chart', () => {
      const sourceCanvas = createMockCanvasWithGradient(600, 400);
      const targetCanvas = createMockCanvasWithGradient(1, 1);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 20,
        backgroundColor: '#0F0F0F',
        customBackground: {
          mode: 'solid',
          solidColor: '#1E293B',
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // Verifikasi fillStyle disetel ke solidColor
      const fillOps = targetCanvas.operations.filter((op) => op.method === 'fill');
      assert.ok(fillOps.length > 0, 'Harus ada pemanggilan fill()');
      const hasSolidColorFill = fillOps.some((op) => op.args[0] === '#1E293B');
      assert.ok(hasSolidColorFill, 'Harus mengisi latar belakang menggunakan solidColor #1E293B');
    });

    test('b. compositeSnapshot dengan mode "gradient" memanggil createLinearGradient vertikal untuk area chart & container', () => {
      const sourceCanvas = createMockCanvasWithGradient(600, 400);
      const targetCanvas = createMockCanvasWithGradient(1, 1);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 20,
        backgroundColor: '#0F0F0F',
        customBackground: {
          mode: 'gradient',
          gradientTop: '#0D1117',
          gradientBottom: '#161B22',
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // Verifikasi createLinearGradient dipanggil
      const gradOps = targetCanvas.operations.filter((op) => op.method === 'createLinearGradient');
      assert.ok(gradOps.length >= 1, 'createLinearGradient harus dipanggil minimal untuk area chart/container');

      // Verifikasi color stops untuk gradientTop dan gradientBottom
      const colorStopOps = targetCanvas.operations.filter((op) => op.method === 'addColorStop');
      assert.ok(colorStopOps.some((op) => op.args[0] === 0 && op.args[1] === '#0D1117'), 'Stop 0 harus gradientTop');
      assert.ok(colorStopOps.some((op) => op.args[0] === 1 && op.args[1] === '#161B22'), 'Stop 1 harus gradientBottom');
    });

    test('c. compositeSnapshot dengan mode "theme" mengabaikan gradien dan menggunakan options.backgroundColor', () => {
      const sourceCanvas = createMockCanvasWithGradient(600, 400);
      const targetCanvas = createMockCanvasWithGradient(1, 1);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 20,
        backgroundColor: '#0F0F0F',
        customBackground: {
          mode: 'theme',
          solidColor: '#123456',
          gradientTop: '#000000',
          gradientBottom: '#FFFFFF',
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // createLinearGradient TIDAK boleh dipanggil karena mode adalah 'theme'
      const gradOps = targetCanvas.operations.filter((op) => op.method === 'createLinearGradient');
      assert.equal(gradOps.length, 0, 'Tidak boleh memanggil createLinearGradient jika mode "theme"');

      // fillStyle harus menggunakan options.backgroundColor
      const fillOps = targetCanvas.operations.filter((op) => op.method === 'fill');
      assert.ok(fillOps.some((op) => op.args[0] === '#0F0F0F'), 'Harus mengisi latar belakang menggunakan options.backgroundColor');
    });
  });
});
