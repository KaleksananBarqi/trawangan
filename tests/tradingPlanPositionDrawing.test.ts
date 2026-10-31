import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { parseTradingPlan, type ParsedTradingPlan } from '../src/lib/services/planParserService';

describe('Ticket 2 (#111): Staged Multi-Target Position Drawing Engine', () => {
  const sampleMarkdown = `
|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Entry|81200.0 (Limit sell di dalam area FVG LTF 81182.2 - 81236.7)|
|Alasan Entry|Respek terhadap unfilled Bearish FVG LTF [FAKTA]|
|Stop Loss|81400.0|
|Alasan SL|Di atas swing high 81380.0 dengan buffer 20 poin [FAKTA]|
|TP1|80355.4|
|R multiple TP1|4.22R|
|Alasan TP1|Swing low terdekat 15m [INFERENSI]|
|TP2|79429.0|
|R multiple TP2|8.85R|
|Alasan TP2|Draw on liquidity SSL utama harian [SPEKULASI]|
`;

  function createMockChartWorkspace(options?: {
    candles?: Array<{ time: number; close?: number }>;
    timeframe?: string;
  }) {
    let drawingsList: any[] = [];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || `pos_mock_${drawingsList.length + 1}` };
        drawingsList.push(item);
        calls.push(`create:${item.id}`);
        return item;
      },
      add: (type: string, spec: any) => {
        const item = { ...spec, type, id: spec.id || `pos_mock_${drawingsList.length + 1}` };
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
      },
      select: (id: string) => calls.push(`select:${id}`),
      deselect: () => calls.push('deselect'),
      on: () => {},
      off: () => {},
      toJSON: () => ({ version: 1, drawings: drawingsList }),
      fromJSON: (doc: any) => {
        drawingsList = [...(doc.drawings || [])];
      }
    };

    const mockChart: any = {
      drawings: mockDrawings,
      on: () => {},
      off: () => {}
    };

    if (options?.candles) {
      mockChart.data = () => options.candles;
    }

    const tf = options?.timeframe || '15m';
    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: tf },
      cells: () => [{ chart: mockChart }]
    };

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'BTCUSDT',
      () => tf,
      () => 'binance'
    );

    return { controller, mockDrawings, mockChart, calls, getDrawings: () => drawingsList };
  }

  it('1. Pembuatan Staged Position Multi-Target (TP1 & TP2) dengan koordinat dan label presisi', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    assert.equal(plan.validation.valid, true);

    const baseTime = 1700000000000;
    const interval15m = 15 * 60 * 1000; // 900,000 ms
    const span = 25; // 25 lilin per stage

    const { controller, getDrawings } = createMockChartWorkspace({
      candles: [
        { time: baseTime - interval15m },
        { time: baseTime }
      ]
    });

    const result = controller.createMultiTargetPosition(plan, { barSpanPerTarget: span });
    assert.ok(result, 'Hasil createMultiTargetPosition tidak boleh null');
    // 2 target TP + 1 auto-draw context zone (FVG)
    assert.equal(result.drawingIds.length, 3, 'Harus membuat 3 drawing id (2 target TP + 1 FVG context box)');
    assert.equal(result.drawings.length, 3, 'Harus menghasilkan 3 objek drawing');

    const drawings = getDrawings();
    assert.equal(drawings.length, 3);

    const positionDrawings = drawings.filter((d) => d.type === 'position');
    const contextDrawings = drawings.filter((d) => d.type === 'box');
    assert.equal(positionDrawings.length, 2, 'Harus ada 2 drawing posisi bertingkat');
    assert.equal(contextDrawings.length, 1, 'Harus ada 1 drawing zona konteks FVG');

    const [stage1, stage2] = positionDrawings;

    // Evaluasi Stage 1 (TP1)
    const expectedT0 = baseTime;
    const expectedT1 = baseTime + span * interval15m;
    assert.equal(stage1.type, 'position');
    assert.equal(stage1.showPrices, true);
    assert.equal(stage1.showTargetLabel, true);
    assert.equal(stage1.showStopLabel, true);
    assert.equal(stage1.targetLabel, 'TP1 (4.22R)');

    assert.equal(stage1.anchors.length, 3);
    assert.deepEqual(stage1.anchors[0], { time: expectedT0, price: 81200 }); // Entry
    assert.deepEqual(stage1.anchors[1], { time: expectedT1, price: 81400 }); // Stop Loss
    assert.deepEqual(stage1.anchors[2], { time: expectedT1, price: 80355.4 }); // TP1

    // Evaluasi Stage 2 (TP2)
    const expectedT2 = expectedT1 + span * interval15m;
    assert.equal(stage2.type, 'position');
    assert.equal(stage2.showPrices, true);
    assert.equal(stage2.showTargetLabel, true);
    assert.equal(stage2.showStopLabel, true);
    assert.equal(stage2.targetLabel, 'TP2 (8.85R)');

    assert.equal(stage2.anchors.length, 3);
    assert.deepEqual(stage2.anchors[0], { time: expectedT1, price: 81200 }); // Entry identik berlanjut dari t1
    assert.deepEqual(stage2.anchors[1], { time: expectedT2, price: 81400 }); // Stop Loss identik
    assert.deepEqual(stage2.anchors[2], { time: expectedT2, price: 79429 }); // TP2

    // Evaluasi Context Zone (FVG Box)
    const fvgBox = contextDrawings[0];
    assert.equal(fvgBox.metadata?.role, 'context_zone');
    assert.equal(fvgBox.metadata?.low, 81182.2);
    assert.equal(fvgBox.metadata?.high, 81236.7);
    assert.equal(fvgBox.anchors[0].price, 81236.7);
    assert.equal(fvgBox.anchors[1].price, 81182.2);

    // Evaluasi jika drawContextZones dimatikan secara eksplisit
    const { controller: ctrl2, getDrawings: getDrawings2 } = createMockChartWorkspace();
    const resultNoZones = ctrl2.createMultiTargetPosition(plan, { drawContextZones: false });
    assert.ok(resultNoZones);
    assert.equal(resultNoZones.drawings.length, 2, 'Hanya 2 posisi tanpa FVG box bila dimatikan');
    assert.equal(getDrawings2().length, 2);

    // Evaluasi Metadata Konsistensi
    assert.ok(stage1.metadata.planId, 'planId wajib ada');
    assert.equal(stage1.metadata.planId, stage2.metadata.planId, 'Kedua stage harus berbagi planId yang sama');
    assert.equal(stage1.metadata.stageIndex, 1);
    assert.equal(stage2.metadata.stageIndex, 2);
    assert.equal(stage1.metadata.bias, 'bearish');
    assert.equal(stage2.metadata.bias, 'bearish');
    assert.equal(stage1.metadata.targetLabel, 'TP1');
    assert.equal(stage2.metadata.targetLabel, 'TP2');
    assert.equal(stage1.metadata.rMultiple, 4.22);
    assert.equal(stage2.metadata.rMultiple, 8.85);
  });

  it('2. Opsi kustom anchorTime, barSpanPerTarget, dan paneId dihormati', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    const { controller, getDrawings } = createMockChartWorkspace();

    const customAnchor = 1715000000000;
    const customSpan = 10;
    const customPane = 'price-subpane';

    const result = controller.createMultiTargetPosition(plan, {
      anchorTime: customAnchor,
      barSpanPerTarget: customSpan,
      paneId: customPane
    });

    assert.ok(result);
    const drawings = getDrawings();
    assert.equal(drawings[0].paneId, customPane);

    // Default deltaT fallback untuk timeframe '15m' = 900,000 ms
    const expectedT1 = customAnchor + customSpan * 900000;
    assert.equal(drawings[0].anchors[0].time, customAnchor);
    assert.equal(drawings[0].anchors[1].time, expectedT1);
    assert.equal(drawings[0].anchors[2].time, expectedT1);

    const expectedT2 = expectedT1 + customSpan * 900000;
    assert.equal(drawings[1].anchors[0].time, expectedT1);
    assert.equal(drawings[1].anchors[1].time, expectedT2);
    assert.equal(drawings[1].anchors[2].time, expectedT2);
  });

  it('3. Fallback estimasi deltaT jika data lilin kosong dan penanganan timeframe jam (1h)', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    const { controller, getDrawings } = createMockChartWorkspace({
      timeframe: '1h'
    });

    const fixedAnchor = 1720000000000;
    const result = controller.createMultiTargetPosition(plan, {
      anchorTime: fixedAnchor,
      barSpanPerTarget: 20
    });

    assert.ok(result);
    const drawings = getDrawings();
    // 1h = 3,600,000 ms; 20 lilin = 72,000,000 ms
    const expectedT1 = fixedAnchor + 20 * 3600000;
    assert.equal(drawings[0].anchors[1].time, expectedT1);
    const expectedT2 = expectedT1 + 20 * 3600000;
    assert.equal(drawings[1].anchors[1].time, expectedT2);
  });

  it('4. Penyimpanan narasi kualitatif dan contextZones ke dalam metadata drawing', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    const { controller, getDrawings } = createMockChartWorkspace();

    controller.createMultiTargetPosition(plan);
    const drawings = getDrawings();

    const stage1 = drawings[0];
    assert.ok(stage1.metadata.reasons, 'Reasons harus tersimpan');
    assert.equal(stage1.metadata.reasons.entry, 'Respek terhadap unfilled Bearish FVG LTF [FAKTA]');
    assert.equal(stage1.metadata.reasons.stopLoss, 'Di atas swing high 81380.0 dengan buffer 20 poin [FAKTA]');
    assert.equal(stage1.metadata.reasons.tp1, 'Swing low terdekat 15m [INFERENSI]');

    assert.ok(Array.isArray(stage1.metadata.contextZones));
    assert.equal(stage1.metadata.contextZones.length, 1);
    assert.equal(stage1.metadata.contextZones[0].low, 81182.2);
    assert.equal(stage1.metadata.contextZones[0].high, 81236.7);
    assert.ok(stage1.metadata.rawPlanText.includes('|Entry|81200.0'));
  });

  it('5. Transaksi Undo/Redo Atomik: Seluruh stage drawing dihapus dan dipulihkan serentak', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    const { controller, calls, getDrawings } = createMockChartWorkspace();

    const created = controller.createMultiTargetPosition(plan);
    assert.ok(created);
    // 2 target position + 1 context zone
    assert.equal(getDrawings().length, 3);
    assert.equal(controller.getActivePlans().length, 1);
    const [id1, id2, id3] = created.drawingIds;

    // 1. Panggil Undo (Ctrl+Z) -> Seluruh drawing stage harus dihapus serentak
    controller.undo();
    assert.equal(getDrawings().length, 0, 'Seluruh stage drawing harus dihapus dari chart saat undo');
    assert.equal(controller.getActivePlans().length, 0, 'activePlans harus kosong saat undo');
    assert.ok(
      calls.some((c) => c.includes('removeMany') && c.includes(id1) && c.includes(id2)),
      'removeMany harus dipanggil serentak untuk seluruh drawing ID'
    );

    // 2. Panggil Redo (Ctrl+Y) -> Seluruh drawing stage harus dipulihkan serentak
    controller.redo();
    assert.equal(getDrawings().length, 3, 'Seluruh drawing stage harus dipulihkan kembali saat redo');
    assert.equal(controller.getActivePlans().length, 1, 'activePlans harus kembali terdaftar saat redo');
    assert.equal(getDrawings()[0].id, id1);
    assert.equal(getDrawings()[1].id, id2);
    assert.equal(getDrawings()[2].id, id3);

    // 3. Panggil Undo kembali
    controller.undo();
    assert.equal(getDrawings().length, 0, 'Seluruh drawing harus terhapus kembali saat undo kedua');
    assert.equal(controller.getActivePlans().length, 0);
  });

  it('6. Sanity Guard & Proteksi Rencana Tidak Valid (Invalid Plan Rejection)', () => {
    const { controller, getDrawings } = createMockChartWorkspace();

    // Rencana dengan bias neutral atau tidak ada target
    const invalidPlan: ParsedTradingPlan = {
      bias: 'neutral',
      entry: 81200,
      stopLoss: 81400,
      targets: [],
      riskAmount: 200,
      reasons: {},
      contextZones: [],
      rawText: '',
      validation: { valid: false, errors: ['Invalid bias', 'No targets'], warnings: [] }
    };

    const res = controller.createMultiTargetPosition(invalidPlan);
    assert.equal(res, null, 'Plan tidak valid harus menghasilkan null');
    assert.equal(getDrawings().length, 0, 'Tidak boleh ada drawing yang dibuat untuk plan tidak valid');

    // Controller tanpa workspace terpasang
    const detachedController = new ChartDrawingController();
    const validPlan = parseTradingPlan(sampleMarkdown);
    const detachedRes = detachedController.createMultiTargetPosition(validPlan);
    assert.equal(detachedRes, null, 'Controller tanpa chart terpasang harus menghasilkan null');
  });

  it('7. Dukungan Multi-Target Fleksibel >= 3 Target (Bullish TP1, TP2, TP3)', () => {
    const bullishMarkdown = `
Bias: Bullish
Entry: 2500
Stop Loss: 2400
TP1: 2700 (2.00R)
TP2: 2900 (4.00R)
TP3: 3100 (6.00R)
`;
    const plan = parseTradingPlan(bullishMarkdown);
    assert.equal(plan.validation.valid, true);
    assert.equal(plan.targets.length, 3);

    const { controller, getDrawings } = createMockChartWorkspace({
      timeframe: '1h'
    });

    const fixedAnchor = 1700000000000;
    const span = 15;
    const deltaT = 3600000; // 1 jam

    const result = controller.createMultiTargetPosition(plan, {
      anchorTime: fixedAnchor,
      barSpanPerTarget: span
    });

    assert.ok(result);
    assert.equal(result.drawingIds.length, 3);
    assert.equal(result.drawings.length, 3);

    const drawings = getDrawings();
    assert.equal(drawings.length, 3);

    // Cek keterkaitan sekuensial waktu
    const t0 = fixedAnchor;
    const t1 = t0 + span * deltaT;
    const t2 = t1 + span * deltaT;
    const t3 = t2 + span * deltaT;

    // Stage 1
    assert.equal(drawings[0].anchors[0].time, t0);
    assert.equal(drawings[0].anchors[1].time, t1);
    assert.equal(drawings[0].anchors[2].price, 2700);
    assert.equal(drawings[0].targetLabel, 'TP1 (2.00R)');

    // Stage 2
    assert.equal(drawings[1].anchors[0].time, t1);
    assert.equal(drawings[1].anchors[1].time, t2);
    assert.equal(drawings[1].anchors[2].price, 2900);
    assert.equal(drawings[1].targetLabel, 'TP2 (4.00R)');

    // Stage 3
    assert.equal(drawings[2].anchors[0].time, t2);
    assert.equal(drawings[2].anchors[1].time, t3);
    assert.equal(drawings[2].anchors[2].price, 3100);
    assert.equal(drawings[2].targetLabel, 'TP3 (6.00R)');

    // Seluruh stage berbagi Entry dan Stop Loss yang sama
    for (const d of drawings) {
      assert.equal(d.anchors[0].price, 2500); // Entry
      assert.equal(d.anchors[1].price, 2400); // Stop Loss
    }
  });

  it('8. Registry Active Plans, Toggle Thesis Cards, dan Remove Plan (#115)', () => {
    const plan = parseTradingPlan(sampleMarkdown);
    const { controller, getDrawings } = createMockChartWorkspace();

    const created = controller.createMultiTargetPosition(plan);
    assert.ok(created);

    // Verifikasi registry activePlans
    const activePlans = controller.getActivePlans();
    assert.equal(activePlans.length, 1);
    const planId = activePlans[0].id;
    assert.ok(planId);
    assert.equal(activePlans[0].bias, 'bearish');

    // Verifikasi state default showThesisCards
    assert.equal(controller.isThesisCardsVisible(), true);

    // Toggle visibilitas Thesis Cards
    const visible1 = controller.toggleThesisCardsVisible();
    assert.equal(visible1, false);
    assert.equal(controller.isThesisCardsVisible(), false);

    const visible2 = controller.toggleThesisCardsVisible();
    assert.equal(visible2, true);
    assert.equal(controller.isThesisCardsVisible(), true);

    // Explicit setThesisCardsVisible
    controller.setThesisCardsVisible(false);
    assert.equal(controller.isThesisCardsVisible(), false);

    // Remove plan via planId
    controller.removePlan(planId);
    assert.equal(controller.getActivePlans().length, 0);
  });
});
