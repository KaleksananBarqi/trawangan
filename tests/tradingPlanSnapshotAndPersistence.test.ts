import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import {
  drawPriceScaleBadgesOnCanvas,
  drawThesisCardOnCanvas,
  renderScreenshotCanvasWithOverlay
} from '../src/lib/services/chartSnapshotOverlayService';
import type { PriceScaleBadge } from '../src/lib/services/priceScaleLabelService';

describe('Ticket 6 (#116): Snapshot Overlay Compositing & Workspace Persistence Suite', () => {
  const sampleMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 78300.0 (Tunggu harga masuk FVG MTF 78200.0 - 78377.9) |
| Alasan Entry | Unfilled Bearish FVG [FAKTA] |
| Stop Loss | 78900.0 |
| Alasan SL | Di atas MTF Swing High 78776.5 [FAKTA] |
| TP1 | 77300.0 |
| R multiple TP1 | 1.66R |
| TP2 | 76270.0 |
| R multiple TP2 | 3.38R |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** Medium-High
* **Skenario Invalidasi:** Jika harga agresif menembus level 78776.5 dengan candle 1H ditutup kuat.
`.trim();

  function createMock2DContext() {
    const drawOps: Array<{ op: string; args: any[] }> = [];
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
      fill: () => drawOps.push({ op: 'fill', args: [] }),
      stroke: () => drawOps.push({ op: 'stroke', args: [] }),
      clip: () => drawOps.push({ op: 'clip', args: [] }),
      fillText: (text: string, x: number, y: number) => drawOps.push({ op: 'fillText', args: [text, x, y] }),
      drawImage: (...args: any[]) => drawOps.push({ op: 'drawImage', args }),
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillStyle: '#ffffff',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'middle'
    } as any;

    return { ctx, drawOps };
  }

  function createMockChartWorkspace() {
    let drawingsList: any[] = [];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || `mock_${drawingsList.length + 1}` };
        drawingsList.push(item);
        calls.push(`create:${item.id}`);
        return item;
      },
      add: (type: string, spec: any) => {
        const item = { ...spec, type, id: spec.id || `mock_${drawingsList.length + 1}` };
        drawingsList.push(item);
        calls.push(`add:${item.id}`);
        return item;
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        drawingsList = drawingsList.filter((d) => d.id !== id);
      }
    };

    const mockChart = {
      drawings: mockDrawings,
      data: () => [{ time: 1700000000000, close: 78000 }]
    };

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      {
        active: { chart: mockChart },
        cells: [{ chart: mockChart }]
      },
      () => 'BTCUSDT',
      () => '15m',
      () => 'binance'
    );

    return { controller, mockDrawings, calls, getDrawings: () => drawingsList };
  }

  describe('1. Snapshot Overlay Rendering (Price Badges & Thesis Card)', () => {
    it('merender Price Scale Badges ke kanvas snapshot dengan koordinat dan warna yang tepat', () => {
      const { ctx, drawOps } = createMock2DContext();
      const badges: PriceScaleBadge[] = [
        { id: 'b1', price: 78300, label: '$78,300', title: 'ENTRY', color: '#ff69b4', bgColor: '#ff69b4', kind: 'entry' },
        { id: 'b2', price: 78900, label: '$78,900', title: 'SL', color: '#ef4444', bgColor: '#ef4444', kind: 'stop_loss' },
        { id: 'b3', price: 77300, label: '$77,300', title: 'TP1 (1.66R)', color: '#10b981', bgColor: '#10b981', kind: 'take_profit' },
      ];

      const getPriceY = (p: number) => (p === 78300 ? 200 : p === 78900 ? 100 : 350);
      const formatPrice = (p: number | null) => (p ? p.toFixed(1) : '--');

      drawPriceScaleBadgesOnCanvas(ctx, badges, 2, 2, 1920, getPriceY, formatPrice);

      const fillTextOps = drawOps.filter((op) => op.op === 'fillText');
      assert.equal(fillTextOps.length, 3, 'Harus merender 3 teks badge');
      assert.ok(fillTextOps.some((op) => String(op.args[0]).includes('ENTRY') && String(op.args[0]).includes('78,300')));
      assert.ok(fillTextOps.some((op) => String(op.args[0]).includes('SL') && String(op.args[0]).includes('78,900')));
      assert.ok(fillTextOps.some((op) => String(op.args[0]).includes('TP1 (1.66R)') && String(op.args[0]).includes('77,300')));
    });

    it('merender Floating Thesis Card ke kanvas snapshot dengan teks entri, invalidasi, dan target', () => {
      const { ctx, drawOps } = createMock2DContext();
      const plan = parseTradingPlan(sampleMarkdown);
      const planWithId = { ...plan, id: 'plan_test_1' };

      const formatPrice = (p: number | null) => (p ? p.toFixed(1) : '--');

      drawThesisCardOnCanvas(ctx, planWithId, 2, 2, formatPrice, 16, 56, 340);

      const textRendered = drawOps
        .filter((op) => op.op === 'fillText')
        .map((op) => String(op.args[0]));

      assert.ok(textRendered.includes('BEARISH'), 'Harus merender badge bias BEARISH');
      assert.ok(textRendered.includes('Medium-High'), 'Harus merender badge probabilitas Medium-High');
      assert.ok(textRendered.some((t) => t.includes('78300.0')), 'Harus memuat harga entry');
      assert.ok(textRendered.some((t) => t.includes('78900.0')), 'Harus memuat harga stop loss');
      assert.ok(textRendered.some((t) => t.includes('TP1:')), 'Harus memuat TP1');
      assert.ok(textRendered.some((t) => t.includes('TP2:')), 'Harus memuat TP2');
    });

    it('Ticket 4 (#123): Merender kartu tesis berfidelitas penuh (judul seksi, zone pills, skenario batal, reasons, dan sinkronisasi geometri)', () => {
      const { ctx, drawOps } = createMock2DContext();
      const plan = parseTradingPlan(sampleMarkdown);
      const planWithId = { ...plan, id: 'plan_hf_1' };
      const formatPrice = (p: number | null) => (p ? p.toFixed(1) : '--');

      // Gambar dengan koordinat dan dimensi kustom dari layar kerja
      drawThesisCardOnCanvas(ctx, planWithId, 2, 2, formatPrice, 120, 80, 400, 500, false);

      const textRendered = drawOps
        .filter((op) => op.op === 'fillText')
        .map((op) => String(op.args[0]));

      // 1. Verifikasi Judul Seksi Terstruktur
      assert.ok(textRendered.some((t) => t.includes('KATALIS ENTRY')), 'Harus memuat judul KATALIS ENTRY');
      assert.ok(textRendered.some((t) => t.includes('INVALIDASI & STOP LOSS')), 'Harus memuat judul INVALIDASI & STOP LOSS');
      assert.ok(textRendered.some((t) => t.includes('TARGET LIKUIDITAS')), 'Harus memuat judul TARGET LIKUIDITAS');

      // 2. Verifikasi Skenario Batal Box
      assert.ok(textRendered.includes('SKENARIO BATAL'), 'Harus memuat badge SKENARIO BATAL');

      // 3. Verifikasi R-Multiple Badges
      assert.ok(textRendered.some((t) => t.includes('+1.66R')), 'Harus memuat badge +1.66R');
      assert.ok(textRendered.some((t) => t.includes('+3.38R')), 'Harus memuat badge +3.38R');

      // 4. Verifikasi Tombol Interaktif Window TIDAK dirender
      assert.ok(!textRendered.includes('X'), 'Tidak boleh ada tombol close X');
      assert.ok(!textRendered.includes('−'), 'Tidak boleh ada tombol minimize');

      // 5. Verifikasi Koordinat X yang Digunakan (scaledX = 120 * 2 = 240)
      const fillOps = drawOps.filter((op) => op.op === 'moveTo' || op.op === 'fillText');
      assert.ok(fillOps.some((op) => typeof op.args[1] === 'number' && op.args[1] >= 240));
    });
  });

  describe('2. Workspace Persistence (Restore & Clear Plans)', () => {
    it('memulihkan seluruh rencana posisi (restorePlans) dan visibilitas kartu tesis secara atomik', () => {
      const { controller, getDrawings } = createMockChartWorkspace();
      const plan = parseTradingPlan(sampleMarkdown);
      const planRecord = { ...plan, id: 'plan_workspace_1' };

      assert.equal(controller.getActivePlans().length, 0);

      // Restore plans ke kanvas
      controller.restorePlans([planRecord], true);

      assert.equal(controller.getActivePlans().length, 1);
      assert.equal(controller.getActivePlans()[0].id, 'plan_workspace_1');
      assert.equal(controller.isThesisCardsVisible(), true);

      // Gambar harus terbentuk di chart (2 stage posisi + 1 context zone FVG = 3)
      assert.equal(getDrawings().length, 3);

      // Clear seluruh plan (saat switch ke workspace kosong)
      controller.clearAllPlans();
      assert.equal(controller.getActivePlans().length, 0);
      assert.equal(getDrawings().length, 0);
    });

    it('restorePlans tidak menduplikasi jika plan ID sudah terdaftar', () => {
      const { controller, getDrawings } = createMockChartWorkspace();
      const plan = parseTradingPlan(sampleMarkdown);
      const planRecord = { ...plan, id: 'plan_dup_1' };

      controller.restorePlans([planRecord], true);
      assert.equal(getDrawings().length, 3);

      // Panggilan kedua dengan ID yang sama diabaikan agar tidak duplikat
      controller.restorePlans([planRecord], true);
      assert.equal(controller.getActivePlans().length, 1);
      assert.equal(getDrawings().length, 3);
    });
  });
});
