import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  compositeSnapshot,
  drawSecurityWatermark,
  resolveWatermarkColors,
  resolveAttributionBarColors,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';
import { THEME_PRESETS } from '../src/lib/constants/themes';

/**
 * Mock 2D Canvas Context untuk pengujian snapshot komposit di Node.js
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
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(val: string) {
      state.fillStyle = val;
      operations.push({ method: 'setFillStyle', args: [val] });
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(val: string) {
      state.strokeStyle = val;
      operations.push({ method: 'setStrokeStyle', args: [val] });
    },
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
    roundRect: (...args: any[]) => operations.push({ method: 'roundRect', args }),
    rect: (...args: any[]) => operations.push({ method: 'rect', args }),
    fill: () => operations.push({ method: 'fill', args: [state.fillStyle] }),
    stroke: () => operations.push({ method: 'stroke', args: [state.strokeStyle] }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (...args: any[]) => operations.push({ method: 'fillRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({
        method: 'fillText',
        args: [text, x, y, maxWidth, state.font, state.fillStyle, state.globalAlpha]
      }),
    strokeText: (text: string, x: number, y: number) =>
      operations.push({
        method: 'strokeText',
        args: [text, x, y, state.strokeStyle, state.lineWidth]
      }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    translate: (x: number, y: number) => operations.push({ method: 'translate', args: [x, y] }),
    rotate: (angle: number) => operations.push({ method: 'rotate', args: [angle] }),
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 3,
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

describe('Ticket #147: Semantic CSS Context Menu & Adaptive Watermark Contrast Suite', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 67420.5,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-11-02T12:00:00Z'),
  };

  describe('1. Chart Context Menu Semantic Styling Refactoring', () => {
    const sveltePath = path.resolve(process.cwd(), 'src/lib/components/ChartContextMenu.svelte');
    const svelteContent = fs.readFileSync(sveltePath, 'utf8');

    test('ChartContextMenu.svelte tidak memuat latar belakang gelap hardcoded (rgba(16, 20, 29))', () => {
      assert.doesNotMatch(
        svelteContent,
        /rgba\(\s*16\s*,\s*20\s*,\s*29/i,
        'ChartContextMenu tidak boleh menggunakan rgba(16, 20, 29) hardcoded'
      );
    });

    test('ChartContextMenu.svelte menggunakan token semantik CSS (--bg-panel, --text-main, --bg-hover, --border-medium)', () => {
      assert.match(svelteContent, /var\(--bg-panel/i, 'Wajib menggunakan token --bg-panel');
      assert.match(svelteContent, /var\(--text-main/i, 'Wajib menggunakan token --text-main');
      assert.match(svelteContent, /var\(--bg-hover/i, 'Wajib menggunakan token --bg-hover');
      assert.match(svelteContent, /var\(--border-medium/i, 'Wajib menggunakan token --border-medium');
    });

    test('ChartContextMenu.svelte menggunakan token semantik untuk surfaces dan dividers (--bg-elevated, --border-subtle)', () => {
      assert.match(svelteContent, /var\(--bg-elevated/i, 'Wajib menggunakan token --bg-elevated');
      assert.match(svelteContent, /var\(--border-subtle/i, 'Wajib menggunakan token --border-subtle');
    });
  });

  describe('2. resolveWatermarkColors Helper Unit Tests', () => {
    test('Mengembalikan teks putih (rgba(255, 255, 255, 0.9)) dan garis tepi gelap (rgba(0, 0, 0, 0.5)) untuk latar gelap (e.g. #0F0F0F, #181A20, #131722)', () => {
      const darkBgs = ['#0F0F0F', '#181A20', '#131722', '#000000', '#1E1E1E'];
      for (const bg of darkBgs) {
        const colors = resolveWatermarkColors(bg);
        assert.equal(colors.fill, 'rgba(255, 255, 255, 0.9)', `Background ${bg} harus menghasilkan fill putih transparan (rgba(255, 255, 255, 0.9))`);
        assert.equal(colors.stroke, 'rgba(0, 0, 0, 0.5)', `Background ${bg} harus menghasilkan dark stroke rgba(0, 0, 0, 0.5)`);
      }
    });

    test('Mengembalikan teks kontras gelap (rgba(20, 20, 20, 0.85)) dan garis tepi terang (rgba(255, 255, 255, 0.6)) untuk latar terang (e.g. #EDEDE9, #FFFFFF, #F5F5F5)', () => {
      const lightBgs = ['#EDEDE9', '#FFFFFF', '#F5F5F5', '#FAFAFA', '#E5E7EB'];
      for (const bg of lightBgs) {
        const colors = resolveWatermarkColors(bg);
        assert.equal(colors.fill, 'rgba(20, 20, 20, 0.85)', `Background ${bg} harus menghasilkan fill gelap (rgba(20, 20, 20, 0.85))`);
        assert.equal(colors.stroke, 'rgba(255, 255, 255, 0.6)', `Background ${bg} harus menghasilkan light stroke rgba(255, 255, 255, 0.6)`);
      }
    });

    test('Fallback cerdas ke skema latar gelap ketika parameter kosong atau undefined', () => {
      const defaultColors = resolveWatermarkColors(undefined as any);
      assert.equal(defaultColors.fill, 'rgba(255, 255, 255, 0.9)');
      assert.equal(defaultColors.stroke, 'rgba(0, 0, 0, 0.5)');
    });
  });

  describe('3. drawSecurityWatermark Adaptive Contrast Execution', () => {
    test('drawSecurityWatermark menerapkan warna kontras sesuai backgroundHex yang diberikan', () => {
      const mockCanvasDark = createMockCanvas(800, 600);
      const dim = {
        width: 800,
        height: 600,
        chartX: 0,
        chartY: 0,
        chartWidth: 800,
        chartHeight: 600,
        attributionY: 550,
        attributionHeight: 50
      };

      // Uji latar gelap
      drawSecurityWatermark(
        mockCanvasDark.getContext('2d'),
        dim,
        { enabled: true, text: 'SEC-DARK', opacity: 0.15 },
        undefined,
        1,
        '#0F0F0F'
      );

      const darkFillOp = mockCanvasDark.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'SEC-DARK'
      );
      assert.ok(darkFillOp, 'fillText harus terpanggil untuk watermark');
      assert.equal(darkFillOp.args[5], 'rgba(255, 255, 255, 0.9)', 'Watermark pada latar gelap harus menggunakan fill rgba(255, 255, 255, 0.9)');

      const darkStrokeOp = mockCanvasDark.operations.find(
        (op) => op.method === 'strokeText' && op.args[0] === 'SEC-DARK'
      );
      assert.ok(darkStrokeOp, 'strokeText harus terpanggil untuk watermark');
      assert.equal(darkStrokeOp.args[3], 'rgba(0, 0, 0, 0.5)', 'Watermark pada latar gelap harus stroke gelap');

      // Uji latar terang
      const mockCanvasLight = createMockCanvas(800, 600);
      drawSecurityWatermark(
        mockCanvasLight.getContext('2d'),
        dim,
        { enabled: true, text: 'SEC-LIGHT', opacity: 0.15 },
        undefined,
        1,
        '#EDEDE9'
      );

      const lightFillOp = mockCanvasLight.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'SEC-LIGHT'
      );
      assert.ok(lightFillOp, 'fillText harus terpanggil untuk watermark');
      assert.equal(lightFillOp.args[5], 'rgba(20, 20, 20, 0.85)', 'Watermark pada latar terang harus menggunakan fill rgba(20, 20, 20, 0.85)');

      const lightStrokeOp = mockCanvasLight.operations.find(
        (op) => op.method === 'strokeText' && op.args[0] === 'SEC-LIGHT'
      );
      assert.ok(lightStrokeOp, 'strokeText harus terpanggil untuk watermark');
      assert.equal(lightStrokeOp.args[3], 'rgba(255, 255, 255, 0.6)', 'Watermark pada latar terang harus stroke terang');
    });
  });

  describe('4. compositeSnapshot Adaptive Watermark Contrast Integration', () => {
    test('compositeSnapshot menggunakan warna adaptif pada tema terang (light theme preset / background)', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1280, height: 720 };

      compositeSnapshot(source, {
        mode: 'branded',
        backgroundColor: '#EDEDE9',
        metadata: baseMetadata,
        watermark: {
          enabled: true,
          text: 'LIGHT THEME WATERMARK',
          opacity: 0.15
        }
      }, mockCanvas);

      const fillTextOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'LIGHT THEME WATERMARK'
      );
      assert.ok(fillTextOp, 'Watermark harus dirender pada screenshot komposit');
      assert.equal(fillTextOp.args[5], 'rgba(20, 20, 20, 0.85)', 'Watermark pada tema terang harus berwarna gelap rgba(20, 20, 20, 0.85)');

      const strokeTextOp = mockCanvas.operations.find(
        (op) => op.method === 'strokeText' && op.args[0] === 'LIGHT THEME WATERMARK'
      );
      assert.ok(strokeTextOp, 'Stroke watermark harus dirender');
      assert.equal(strokeTextOp.args[3], 'rgba(255, 255, 255, 0.6)', 'Stroke pada tema terang harus stroke terang');
    });

    test('compositeSnapshot menggunakan warna adaptif pada custom solid background terang', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1280, height: 720 };

      compositeSnapshot(source, {
        mode: 'branded',
        customBackground: {
          mode: 'solid',
          solidColor: '#FFFFFF'
        },
        metadata: baseMetadata,
        watermark: {
          enabled: true,
          text: 'WHITE BG WATERMARK',
          opacity: 0.15
        }
      }, mockCanvas);

      const fillTextOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'WHITE BG WATERMARK'
      );
      assert.ok(fillTextOp, 'Watermark harus dirender pada custom white background');
      assert.equal(fillTextOp.args[5], 'rgba(20, 20, 20, 0.85)', 'Watermark pada solid white background harus fill gelap');
    });

    test('compositeSnapshot mempertahankan warna putih (rgba(255, 255, 255, 0.9)) pada latar gelap default (#0F0F0F)', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1280, height: 720 };

      compositeSnapshot(source, {
        mode: 'branded',
        backgroundColor: '#0F0F0F',
        metadata: baseMetadata,
        watermark: {
          enabled: true,
          text: 'DARK BG WATERMARK',
          opacity: 0.15
        }
      }, mockCanvas);

      const fillTextOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'DARK BG WATERMARK'
      );
      assert.ok(fillTextOp, 'Watermark harus dirender pada dark background');
      assert.equal(fillTextOp.args[5], 'rgba(255, 255, 255, 0.9)', 'Watermark pada dark background harus fill putih transparan');
    });
  });

  describe('5. Attribution Bar Adaptive Contrast (Light vs Dark Frame Background)', () => {
    test('resolveAttributionBarColors menghasilkan teks putih dan abu-abu terang pada latar gelap', () => {
      const darkColors = resolveAttributionBarColors('#0F0F0F', THEME_PRESETS.signature);
      assert.equal(darkColors.isDark, true);
      assert.equal(darkColors.textPrimary, '#FFFFFF');
      assert.equal(darkColors.textSecondary, '#B0B0B0');
      assert.equal(darkColors.dotSeparator, 'rgba(255, 255, 255, 0.25)');
      assert.equal(darkColors.outerBorder, 'rgba(255, 255, 255, 0.08)');
    });

    test('resolveAttributionBarColors menghasilkan teks kontras gelap pada latar terang (Red Folder News / #EDEDE9)', () => {
      const lightColors = resolveAttributionBarColors('#EDEDE9', THEME_PRESETS.red_folder);
      assert.equal(lightColors.isDark, false);
      assert.equal(lightColors.textPrimary, THEME_PRESETS.red_folder.tokens.textMain);
      assert.equal(lightColors.textSecondary, THEME_PRESETS.red_folder.tokens.textMuted);
      assert.equal(lightColors.dotSeparator, 'rgba(0, 0, 0, 0.25)');
      assert.equal(lightColors.outerBorder, THEME_PRESETS.red_folder.tokens.borderHairline);
    });

    test('compositeSnapshot merender teks Attribution Bar dengan warna kontras gelap pada tema terang (#EDEDE9)', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const source = { width: 1280, height: 720 };

      compositeSnapshot(source, {
        mode: 'branded',
        backgroundColor: '#EDEDE9',
        themeConfig: THEME_PRESETS.red_folder,
        metadata: {
          ...baseMetadata,
          lastPrice: 2282.07
        },
        userProfile: {
          username: 'arthex1204',
          handle: '@arthex1204',
          bio: 'WANBDYORLCH/YA'
        }
      }, mockCanvas);

      // 1. Teks Username harus menggunakan textMain tema terang (burgundy #4A0E0F)
      const usernameOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'arthex1204'
      );
      assert.ok(usernameOp, 'Username harus digambar di attribution bar');
      assert.equal(usernameOp.args[5], THEME_PRESETS.red_folder.tokens.textMain, 'Username pada latar terang tidak boleh berwarna putih #FFFFFF');

      // 2. Teks Handle (@arthex1204) harus menggunakan warna kontras gelap
      const handleOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === '@arthex1204'
      );
      assert.ok(handleOp, 'Handle harus digambar di attribution bar');
      assert.equal(handleOp.args[5], THEME_PRESETS.red_folder.tokens.textMuted, 'Handle pada latar terang tidak boleh pudar #9E9E9E');

      // 3. Teks instrumen (BTCUSDT · 15m · BINANCE)
      const instOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && typeof op.args[0] === 'string' && op.args[0].includes('BTCUSDT')
      );
      assert.ok(instOp, 'Instrumen badge harus digambar');
      assert.equal(instOp.args[5], THEME_PRESETS.red_folder.tokens.textMuted, 'Instrumen pada latar terang tidak boleh abu-abu terang #B0B0B0');

      // 4. Harga pasar
      const priceOp = mockCanvas.operations.find(
        (op) => op.method === 'fillText' && typeof op.args[0] === 'string' && op.args[0].includes('2,282.07')
      );
      assert.ok(priceOp, 'Harga pasar harus digambar');
      assert.equal(priceOp.args[5], THEME_PRESETS.red_folder.tokens.textMain, 'Harga pada latar terang tidak boleh putih #FFFFFF');

      // 5. Outer border stroke harus menggunakan borderHairline tema terang
      const outerStrokeOp = mockCanvas.operations.find(
        (op) => op.method === 'setStrokeStyle' && op.args[0] === THEME_PRESETS.red_folder.tokens.borderHairline
      );
      assert.ok(outerStrokeOp, 'Garis border luar harus menggunakan warna border tema terang');
    });
  });
});
