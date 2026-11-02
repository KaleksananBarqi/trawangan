import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompositeDimensions,
  calculateThesisPanelHeight,
  SNAPSHOT_SIDE_PANEL_WIDTH,
  SNAPSHOT_SIDE_PANEL_GAP,
  renderScreenshotCanvasWithOverlay,
  type SnapshotOptions,
  type SnapshotMetadata,
  type SnapshotThesisLayout,
  type OverlayRenderContext
} from '../src/lib/services/chartSnapshotService';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import type { PriceScaleBadge } from '../src/lib/services/priceScaleLabelService';
import { THEME_PRESETS } from '../src/lib/constants/themes';

describe('Ticket #133: Core Side-by-Side Dimension Engine & Clean Canvas Separation Suite', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 78500.0,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-11-01T10:00:00Z'),
  };

  const sampleShortPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 78300.0 |
| Alasan Entry | Rejection Bearish FVG [FAKTA] |
| Stop Loss | 78900.0 |
| Alasan SL | Swing High invalidation [FAKTA] |
| TP1 | 77300.0 |
| R multiple TP1 | 1.66R |
| TP2 | 76270.0 |
| R multiple TP2 | 3.38R |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** High
* **Skenario Invalidasi:** Penutupan candle 1H di atas 78900.
`.trim();

  const sampleLongPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 68250.0 (Konfirmasi Sweep Liquidity Asia Range + CHoCH M5) |
| Alasan Entry | Terbentuk bullish order block baru pada timeframe 15m setelah sweep liquidity sesi Asia di level 68100.0 [FAKTA]. Struktur pasar internal beralih dari bearish ke bullish (CHoCH) dengan displacement volume tinggi [INFERENSI]. Menunggu pull-back korektif ke area FVG 50% discount zone untuk entry optimal dengan probabilitas tinggi [SPEKULASI]. |
| Stop Loss | 67450.0 |
| Alasan SL | Terletak di bawah swing low struktural 4H 67520.0 dengan buffer volatilitas 70 poin untuk menghindari wick hunting oleh market maker [FAKTA]. |
| TP1 | 69800.0 |
| R multiple TP1 | 1.93R |
| Alasan TP1 | Likuiditas buy-side equal highs 1H dan level resistensi psikologis harian [FAKTA]. |
| TP2 | 71500.0 |
| R multiple TP2 | 4.06R |
| Alasan TP2 | Area unmitigated weekly imbalance dan proyeksi target ekstensi Fibonacci 1.618 [INFERENSI]. |
| TP3 | 73200.0 |
| R multiple TP3 | 6.18R |
| Alasan TP3 | All-Time-High range expansion run [SPEKULASI]. |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** Sangat Tinggi (A+) didukung oleh konfluensi DXY melemah dan open interest futures meningkat signifikan.
* **Skenario Invalidasi:** Jika harga ditutup di bawah level 67450.0 pada candle 1H, tesis struktur bullish gugur seketika karena order block harian gagal menahan tekanan jual institusional, menandakan kelanjutan distribusi makro ke support mingguan berikutnya.
`.trim();

  function createMock2DCanvas(width = 1000, height = 600) {
    const drawOps: Array<{ op: string; args: any[]; fillStyle?: string; strokeStyle?: string }> = [];
    let _fillStyle = '#ffffff';
    let _strokeStyle = '#000000';

    const ctx = {
      save: () => drawOps.push({ op: 'save', args: [] }),
      restore: () => drawOps.push({ op: 'restore', args: [] }),
      beginPath: () => drawOps.push({ op: 'beginPath', args: [] }),
      closePath: () => drawOps.push({ op: 'closePath', args: [] }),
      moveTo: (x: number, y: number) => drawOps.push({ op: 'moveTo', args: [x, y] }),
      lineTo: (x: number, y: number) => drawOps.push({ op: 'lineTo', args: [x, y] }),
      quadraticCurveTo: (...args: any[]) => drawOps.push({ op: 'quadraticCurveTo', args }),
      arc: (...args: any[]) => drawOps.push({ op: 'arc', args }),
      setLineDash: (...args: any[]) => drawOps.push({ op: 'setLineDash', args }),
      fill: () => drawOps.push({ op: 'fill', args: [], fillStyle: _fillStyle }),
      stroke: () => drawOps.push({ op: 'stroke', args: [], strokeStyle: _strokeStyle }),
      clip: () => drawOps.push({ op: 'clip', args: [] }),
      fillText: (text: string, x: number, y: number) => drawOps.push({ op: 'fillText', args: [text, x, y], fillStyle: _fillStyle }),
      drawImage: (...args: any[]) => drawOps.push({ op: 'drawImage', args }),
      measureText: (text: string) => ({ width: text.length * 8 }),
      get fillStyle() { return _fillStyle; },
      set fillStyle(val: string) { _fillStyle = val; },
      get strokeStyle() { return _strokeStyle; },
      set strokeStyle(val: string) { _strokeStyle = val; },
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'middle'
    } as any;

    const canvas = {
      width,
      height,
      getContext: (type: string) => (type === '2d' ? ctx : null),
      drawOps,
      ctx
    } as any;

    return { canvas, ctx, drawOps };
  }

  describe('1. Kontrak Tipe SnapshotThesisLayout & Default Settings', () => {
    it('SnapshotThesisLayout mendukung nilai "side-panel", "overlay", dan "hidden"', () => {
      const layout1: SnapshotThesisLayout = 'side-panel';
      const layout2: SnapshotThesisLayout = 'overlay';
      const layout3: SnapshotThesisLayout = 'hidden';

      assert.equal(layout1, 'side-panel');
      assert.equal(layout2, 'overlay');
      assert.equal(layout3, 'hidden');
    });

    it('resolveAppSettings menginisialisasi snapshotThesisLayout dengan default "side-panel"', () => {
      const resolved = resolveAppSettings({});
      assert.equal(resolved.snapshotThesisLayout, 'side-panel');
      assert.equal(DEFAULT_APP_SETTINGS.snapshotThesisLayout, 'side-panel');
    });

    it('resolveAppSettings mempertahankan preferensi pengguna yang tersimpan secara deterministik', () => {
      assert.equal(resolveAppSettings({ snapshotThesisLayout: 'overlay' }).snapshotThesisLayout, 'overlay');
      assert.equal(resolveAppSettings({ snapshotThesisLayout: 'hidden' }).snapshotThesisLayout, 'hidden');
      assert.equal(resolveAppSettings({ snapshotThesisLayout: 'side-panel' }).snapshotThesisLayout, 'side-panel');
      // Nilai invalid fallback ke default 'side-panel'
      assert.equal(resolveAppSettings({ snapshotThesisLayout: 'invalid' as any }).snapshotThesisLayout, 'side-panel');
    });
  });

  describe('2. calculateCompositeDimensions: Tata Letak Side-Panel Dinamis', () => {
    it('menghitung lebar komposit dengan tambahan side-panel (~380px) dan jarak gap saat thesisLayout === "side-panel"', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        tradingPlan: { ...parsedPlan, id: 'plan_1' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // Lebar total: (sourceWidth + gap (16) + panelWidth (380) + padding * 2 (48)) * scale (2)
      // (1000 + 16 + 380 + 48) * 2 = 1444 * 2 = 2888
      assert.equal(dim.width, 2888);
      // Chart X dan Y
      assert.equal(dim.chartX, 48); // 24 * 2
      assert.equal(dim.chartY, 48); // 24 * 2
      assert.equal(dim.chartWidth, 2000); // 1000 * 2
      // Koordinat Panel Samping
      assert.equal(dim.panelX, 2080); // (24 + 1000 + 16) * 2
      assert.equal(dim.panelY, 48);
      assert.equal(dim.panelWidth, 760); // 380 * 2
      assert.equal(dim.panelGap, 32); // 16 * 2
    });

    it('mendukung kustomisasi sidePanelWidth dan sidePanelGap melalui SnapshotOptions', () => {
      const sourceW = 800;
      const sourceH = 500;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 20,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        sidePanelWidth: 400,
        sidePanelGap: 20,
        tradingPlan: { ...parsedPlan, id: 'plan_1' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // (800 + 20 + 400 + 40) * 1 = 1260
      assert.equal(dim.width, 1260);
      assert.equal(dim.panelX, 840); // 20 + 800 + 20
      assert.equal(dim.panelWidth, 400);
      assert.equal(dim.panelGap, 20);
    });

    it('mendukung kalkulasi dimensi side-panel pada mode clean tanpa outer padding dan attribution bar', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'clean',
        scale: 2,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        tradingPlan: { ...parsedPlan, id: 'plan_clean_1' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // (1000 + 16 + 380) * 2 = 1396 * 2 = 2792
      assert.equal(dim.width, 2792);
      assert.equal(dim.chartX, 0);
      assert.equal(dim.chartY, 0);
      assert.equal(dim.chartWidth, 2000);
      assert.equal(dim.panelX, 2032); // (1000 + 16) * 2
      assert.equal(dim.panelY, 0);
      assert.equal(dim.panelWidth, 760);
      assert.equal(dim.attributionHeight, 0);
    });

    it('memperluas tinggi vertikal kanvas komposit secara dinamis jika narasi tesis membutuhkan ruang lebih tinggi dari chart', () => {
      const sourceW = 1000;
      const sourceH = 400; // Grafik relatif pendek (400px)
      const parsedLongPlan = parseTradingPlan(sampleLongPlanMarkdown);

      const requiredHeight = calculateThesisPanelHeight(parsedLongPlan, SNAPSHOT_SIDE_PANEL_WIDTH);
      assert.ok(requiredHeight > 400, `Tinggi narasi tesis (${requiredHeight}px) harus lebih besar dari chart height (400px)`);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        tradingPlan: { ...parsedLongPlan, id: 'plan_long_1' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // Tinggi komposit harus mengakomodasi requiredHeight + padding * 2 + attributionHeight (60)
      const expectedTotalH = requiredHeight + 48 + 60;
      assert.equal(dim.height, expectedTotalH);
      // Posisi chart tetap top-aligned dengan rasio 1:1 tanpa peregangan vertikal (chartHeight tetap 400)
      assert.equal(dim.chartY, 24);
      assert.equal(dim.chartHeight, 400);
      // Tinggi panel samping mencakup tinggi dinamis yang diperlukan
      assert.equal(dim.panelHeight, requiredHeight);
      // Attribution bar berada di bawah elemen tertinggi
      assert.equal(dim.attributionY, 24 + requiredHeight);
    });

    it('menggunakan options.activePlans jika options.tradingPlan tidak disuplai langsung', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        activePlans: [{ ...parsedPlan, id: 'active_plan_from_array' }]
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);
      // Harus mengenali activePlans dan menghitung lebar panel samping
      assert.equal(dim.width, 1000 + 16 + 380 + 48);
      assert.ok(dim.panelWidth && dim.panelWidth > 0);
    });

    it('mendukung options.plan sebagai fallback terdepresiasi jika tradingPlan tidak disediakan', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 1,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        plan: { ...parsedPlan, id: 'plan_fallback_deprecated' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);
      assert.equal(dim.width, 1000 + 16 + 380 + 48);
      assert.ok(dim.panelWidth && dim.panelWidth > 0);
    });

    it('multi-plan: activePlans[0] berfungsi sebagai primary active trading plan (Spec #132 / Q10)', () => {
      const sourceW = 1000;
      const sourceH = 400; // Pilih sourceHeight lebih rendah agar perbedaan tinggi panel terlihat jelas
      const parsedPlan1 = parseTradingPlan(sampleShortPlanMarkdown);
      const parsedPlan2 = parseTradingPlan(sampleLongPlanMarkdown);

      const h1 = calculateThesisPanelHeight(parsedPlan1, SNAPSHOT_SIDE_PANEL_WIDTH);
      const h2 = calculateThesisPanelHeight(parsedPlan2, SNAPSHOT_SIDE_PANEL_WIDTH);
      assert.notEqual(h1, h2, 'Kedua plan harus memiliki tinggi kalkulasi yang berbeda');

      const optionsWithPlan1First: SnapshotOptions = {
        mode: 'clean',
        scale: 1,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        activePlans: [
          { ...parsedPlan1, id: 'primary_plan' },
          { ...parsedPlan2, id: 'secondary_plan' }
        ]
      };

      const dim1 = calculateCompositeDimensions(sourceW, sourceH, optionsWithPlan1First);
      assert.equal(dim1.panelHeight, Math.max(sourceH, h1));

      const optionsWithPlan2First: SnapshotOptions = {
        mode: 'clean',
        scale: 1,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        activePlans: [
          { ...parsedPlan2, id: 'secondary_plan' },
          { ...parsedPlan1, id: 'primary_plan' }
        ]
      };

      const dim2 = calculateCompositeDimensions(sourceW, sourceH, optionsWithPlan2First);
      assert.equal(dim2.panelHeight, Math.max(sourceH, h2));
    });
  });

  describe('3. calculateCompositeDimensions: Fallback Anggun ke Single-Chart', () => {
    it('fallback ke dimensi single-chart standar jika tidak ada trading plan aktif meski thesisLayout === "side-panel"', () => {
      const sourceW = 1000;
      const sourceH = 600;

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'side-panel',
        tradingPlan: null,
        activePlans: []
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      // (1000 + 48) * 2 = 2096
      assert.equal(dim.width, 2096);
      // (600 + 48 + 60) * 2 = 1416
      assert.equal(dim.height, 1416);
      assert.equal(dim.panelWidth, undefined);
      assert.equal(dim.panelX, undefined);
    });

    it('fallback ke dimensi single-chart standar jika thesisLayout === "overlay" meski trading plan aktif ada', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'overlay',
        tradingPlan: { ...parsedPlan, id: 'plan_overlay' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      assert.equal(dim.width, 2096);
      assert.equal(dim.height, 1416);
      assert.equal(dim.panelWidth, undefined);
    });

    it('fallback ke dimensi single-chart standar jika thesisLayout === "hidden"', () => {
      const sourceW = 1000;
      const sourceH = 600;
      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);

      const options: SnapshotOptions = {
        mode: 'branded',
        scale: 2,
        padding: 24,
        metadata: baseMetadata,
        thesisLayout: 'hidden',
        tradingPlan: { ...parsedPlan, id: 'plan_hidden' }
      };

      const dim = calculateCompositeDimensions(sourceW, sourceH, options);

      assert.equal(dim.width, 2096);
      assert.equal(dim.height, 1416);
      assert.equal(dim.panelWidth, undefined);
    });
  });

  describe('4. renderScreenshotCanvasWithOverlay: Isolasi Kanvas Bersih & Badge Sumbu Harga', () => {
    it('melewatkan perenderan FloatingThesisCard di atas baseCanvas saat thesisLayout === "side-panel", namun tetap merender Price Scale Badges', () => {
      const { canvas: mockBase } = createMock2DCanvas(800, 600);
      const { canvas: mockTarget, drawOps } = createMock2DCanvas(800, 600);

      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
      const activePlan = { ...parsedPlan, id: 'plan_iso_1' };

      const badges: PriceScaleBadge[] = [
        { id: 'badge_entry', kind: 'entry', price: 78300, label: 'Entry 78300', title: 'ENTRY', bgColor: '#3b82f6', color: '#ffffff' },
        { id: 'badge_sl', kind: 'stop_loss', price: 78900, label: 'SL 78900', title: 'SL', bgColor: '#ef4444', color: '#ffffff' },
        { id: 'badge_tp1', kind: 'take_profit', price: 77300, label: 'TP 77300', title: 'TP1', bgColor: '#10b981', color: '#ffffff' }
      ];

      const formatPrice = (p: number | null) => (p != null ? p.toFixed(1) : '--');

      const context: OverlayRenderContext = {
        baseCanvas: mockBase,
        targetCanvas: mockTarget,
        containerWidth: 800,
        containerHeight: 600,
        drawingPriceBadges: badges,
        showDrawingPriceLabels: true,
        activePlans: [activePlan],
        showThesisCards: true,
        thesisLayout: 'side-panel',
        getPriceY: (p) => (p === 78300 ? 300 : p === 78900 ? 150 : 450),
        formatPrice,
        themeConfig: THEME_PRESETS.signature
      };

      renderScreenshotCanvasWithOverlay(context);

      // 1. Memastikan baseCanvas digambar ke target canvas
      const drawImageOp = drawOps.find((op) => op.op === 'drawImage');
      assert.ok(drawImageOp, 'drawImage harus dipanggil untuk menyalin baseCanvas');

      // 2. Memastikan Price Scale Badges (Entry, SL, TP) tetap dirender pada sumbu kanan
      const fillTexts = drawOps.filter((op) => op.op === 'fillText').map((op) => String(op.args[0]));
      assert.ok(fillTexts.some((t) => t.includes('ENTRY')), 'Badge ENTRY harus tetap dirender di sumbu harga');
      assert.ok(fillTexts.some((t) => t.includes('SL')), 'Badge SL harus tetap dirender di sumbu harga');
      assert.ok(fillTexts.some((t) => t.includes('TP1')), 'Badge TP1 harus tetap dirender di sumbu harga');

      // 3. Memastikan Floating Thesis Card TIDAK dirender di atas kanvas grafik lilin
      // (Tidak boleh ada teks narasi rencana seperti 'Rejection Bearish FVG' atau badge 'BEARISH' dari thesis card)
      assert.equal(fillTexts.some((t) => t.includes('Rejection Bearish FVG')), false, 'Teks narasi tesis tidak boleh digambar di atas chart saat side-panel aktif');
      assert.equal(fillTexts.some((t) => t.includes('BEARISH')), false, 'Badge tesis floating tidak boleh digambar di atas chart saat side-panel aktif');
    });

    it('tetap menggambar FloatingThesisCard di atas baseCanvas saat thesisLayout === "overlay"', () => {
      const { canvas: mockBase } = createMock2DCanvas(800, 600);
      const { canvas: mockTarget, drawOps } = createMock2DCanvas(800, 600);

      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
      const activePlan = { ...parsedPlan, id: 'plan_overlay_1' };
      const formatPrice = (p: number | null) => (p != null ? p.toFixed(1) : '--');

      const context: OverlayRenderContext = {
        baseCanvas: mockBase,
        targetCanvas: mockTarget,
        containerWidth: 800,
        containerHeight: 600,
        drawingPriceBadges: [],
        showDrawingPriceLabels: false,
        activePlans: [activePlan],
        showThesisCards: true,
        thesisLayout: 'overlay',
        getPriceY: () => 100,
        formatPrice,
        themeConfig: THEME_PRESETS.signature
      };

      renderScreenshotCanvasWithOverlay(context);

      const fillTexts = drawOps.filter((op) => op.op === 'fillText').map((op) => String(op.args[0]));
      assert.ok(fillTexts.some((t) => t.includes('BEARISH')), 'Badge BEARISH harus digambar pada mode overlay');
    });

    it('tidak menggambar FloatingThesisCard saat thesisLayout === "hidden"', () => {
      const { canvas: mockBase } = createMock2DCanvas(800, 600);
      const { canvas: mockTarget, drawOps } = createMock2DCanvas(800, 600);

      const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
      const activePlan = { ...parsedPlan, id: 'plan_hidden_1' };
      const formatPrice = (p: number | null) => (p != null ? p.toFixed(1) : '--');

      const context: OverlayRenderContext = {
        baseCanvas: mockBase,
        targetCanvas: mockTarget,
        containerWidth: 800,
        containerHeight: 600,
        drawingPriceBadges: [],
        showDrawingPriceLabels: false,
        activePlans: [activePlan],
        showThesisCards: true,
        thesisLayout: 'hidden',
        getPriceY: () => 100,
        formatPrice,
        themeConfig: THEME_PRESETS.signature
      };

      renderScreenshotCanvasWithOverlay(context);

      const fillTexts = drawOps.filter((op) => op.op === 'fillText').map((op) => String(op.args[0]));
      assert.equal(fillTexts.some((t) => t.includes('BEARISH')), false, 'Tesis tidak boleh digambar pada mode hidden');
    });
  });

  describe('5. Canvas Helper Encapsulation (#155: Seam Leakage Elimination)', () => {
    it('memastikan internal canvas helpers tidak bocor ke antarmuka publik chartSnapshotService', async () => {
      const snapshotModule = await import('../src/lib/services/chartSnapshotService');
      assert.strictEqual((snapshotModule as any).colorToRgba, undefined, 'colorToRgba tidak boleh diekspor ke publik');
      assert.strictEqual((snapshotModule as any).wrapCanvasText, undefined, 'wrapCanvasText tidak boleh diekspor ke publik');
    });
  });
});
