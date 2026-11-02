import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderScreenshotCanvasWithOverlay, type OverlayRenderContext, type PriceScaleBadge } from '../src/lib/services/chartSnapshotService';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import { THEME_PRESETS } from '../src/lib/constants/themes';

function createStrictMockCanvas(width = 800, height = 600) {
  const lineToCalls: Array<{ x: any; y: any; argCount: number }> = [];

  const ctx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (...args: any[]) => {
      if (args.length < 2) {
        throw new TypeError("Failed to execute 'moveTo' on 'CanvasRenderingContext2D': 2 arguments required");
      }
    },
    lineTo: (...args: any[]) => {
      if (args.length < 2) {
        throw new TypeError("lineTo@[native code]: Failed to execute 'lineTo' on 'CanvasRenderingContext2D': 2 arguments required, but only " + args.length + " present.");
      }
      lineToCalls.push({ x: args[0], y: args[1], argCount: args.length });
    },
    arcTo: (...args: any[]) => {
      if (args.length < 5) {
        throw new TypeError("Failed to execute 'arcTo' on 'CanvasRenderingContext2D': 5 arguments required");
      }
    },
    quadraticCurveTo: (...args: any[]) => {
      if (args.length < 4) {
        throw new TypeError("Failed to execute 'quadraticCurveTo' on 'CanvasRenderingContext2D': 4 arguments required");
      }
    },
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    drawImage: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'middle'
  } as any;

  const canvas = {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? ctx : null)
  } as any;

  return { canvas, ctx, lineToCalls };
}

describe('Bug Repro: Screenshot Runtime Error on lineTo', () => {
  it('harus merender screenshot overlay tanpa Runtime Error lineTo saat menggambar price scale badge', () => {
    const { canvas: mockBase } = createStrictMockCanvas(800, 600);
    const { canvas: mockTarget, lineToCalls } = createStrictMockCanvas(800, 600);

    const badges: PriceScaleBadge[] = [
      { id: 'b1', kind: 'entry', price: 100, label: 'Entry 100', title: 'ENTRY', bgColor: '#3b82f6', color: '#ffffff' }
    ];

    const context: OverlayRenderContext = {
      baseCanvas: mockBase,
      targetCanvas: mockTarget,
      containerWidth: 800,
      containerHeight: 600,
      drawingPriceBadges: badges,
      showDrawingPriceLabels: true,
      activePlans: [],
      showThesisCards: false,
      thesisLayout: 'overlay',
      getPriceY: () => 300,
      formatPrice: (p) => String(p),
      themeConfig: THEME_PRESETS.signature
    };

    // Ini memicu drawPriceScaleBadgesOnCanvas -> drawRoundedRect dengan radius objek { tl, bl, tr, br }
    // Pada implementasi dengan bug, lineTo dipanggil dengan hanya 1 argumen sehingga melempar error.
    assert.doesNotThrow(() => {
      renderScreenshotCanvasWithOverlay(context);
    }, /lineTo@\[native code\]/);
  });

  it('harus merender screenshot overlay dengan thesis card tanpa Runtime Error lineTo pada header rounded rect', () => {
    const { canvas: mockBase } = createStrictMockCanvas(800, 600);
    const { canvas: mockTarget } = createStrictMockCanvas(800, 600);

    const plan = {
      ...parseTradingPlan(`5. Trading Plan\n| Parameter | Nilai |\n| --- | --- |\n| Bias | Bullish |\n| Entry | 100 |`),
      id: 'plan_1'
    };

    const context: OverlayRenderContext = {
      baseCanvas: mockBase,
      targetCanvas: mockTarget,
      containerWidth: 800,
      containerHeight: 600,
      drawingPriceBadges: [],
      showDrawingPriceLabels: false,
      activePlans: [plan],
      showThesisCards: true,
      thesisLayout: 'overlay',
      getPriceY: () => 300,
      formatPrice: (p) => String(p),
      themeConfig: THEME_PRESETS.signature
    };

    // Header kartu thesis juga menggunakan drawRoundedRect dengan radius objek { tl, tr, br, bl }
    assert.doesNotThrow(() => {
      renderScreenshotCanvasWithOverlay(context);
    }, /lineTo@\[native code\]/);
  });

  it('harus merender screenshot overlay dengan jalur quadraticCurveTo fallback tanpa Runtime Error lineTo', () => {
    const { canvas: mockBase } = createStrictMockCanvas(800, 600);
    const { canvas: mockTarget, ctx } = createStrictMockCanvas(800, 600);
    // Hapus arcTo untuk menguji jalur fallback quadraticCurveTo
    delete (ctx as any).arcTo;

    const badges: PriceScaleBadge[] = [
      { id: 'b1', kind: 'entry', price: 100, label: 'Entry 100', title: 'ENTRY', bgColor: '#3b82f6', color: '#ffffff' }
    ];

    const context: OverlayRenderContext = {
      baseCanvas: mockBase,
      targetCanvas: mockTarget,
      containerWidth: 800,
      containerHeight: 600,
      drawingPriceBadges: badges,
      showDrawingPriceLabels: true,
      activePlans: [],
      showThesisCards: false,
      thesisLayout: 'overlay',
      getPriceY: () => 300,
      formatPrice: (p) => String(p),
      themeConfig: THEME_PRESETS.signature
    };

    assert.doesNotThrow(() => {
      renderScreenshotCanvasWithOverlay(context);
    }, /lineTo@\[native code\]/);
  });
});
