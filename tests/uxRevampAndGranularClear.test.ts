import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { parseTradingPlan } from '../src/lib/services/planParserService';

describe('Ticket 7 (#117): UX Revamp - Plan Ingestion, Object Tree & Granular Delete Seam Suite', () => {
  const sampleBearishMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 78300.0 |
| Stop Loss | 78900.0 |
| TP1 | 77300.0 |
| TP2 | 76270.0 |
`.trim();

  const sampleBullishMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 75000.0 |
| Stop Loss | 74000.0 |
| TP1 | 76500.0 |
| TP2 | 78000.0 |
`.trim();

  function createMockChartWorkspace() {
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
      clear: () => {
        calls.push('clear');
        drawingsList = [];
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
      data: () => [{ time: 1700000000000, close: 78000 }],
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [{ chart: mockChart }]
    };

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'BTCUSDT',
      () => '15m',
      () => 'binance'
    );

    return { controller, mockDrawings, mockChart, calls, getDrawings: () => drawingsList };
  }

  it('1. Menambahkan Trading Plan mendaftarkan entitas dan drawing terkait di controller', () => {
    const { controller } = createMockChartWorkspace();

    const plan = parseTradingPlan(sampleBearishMarkdown);
    assert.ok(plan);
    const pos = controller.createMultiTargetPosition(plan, { anchorTime: 1700000000000 });
    assert.ok(pos);

    const activePlans = controller.getActivePlans();
    assert.equal(activePlans.length, 1);
    assert.equal(typeof activePlans[0].id, 'string');
    assert.ok(activePlans[0].id.length > 0);
    assert.equal(activePlans[0].bias, 'bearish');
  });

  it('2. removePlan menghapus plan spesifik dan drawing terkait tanpa mengganggu plan lain', () => {
    const { controller } = createMockChartWorkspace();

    const plan1 = parseTradingPlan(sampleBearishMarkdown);
    const plan2 = parseTradingPlan(sampleBullishMarkdown);
    assert.ok(plan1 && plan2);

    controller.createMultiTargetPosition(plan1, { anchorTime: 1700000000000 });
    controller.createMultiTargetPosition(plan2, { anchorTime: 1700000000000 });

    let activePlans = controller.getActivePlans();
    assert.equal(activePlans.length, 2);

    const plan1Id = activePlans[0].id;
    const plan2Id = activePlans[1].id;

    controller.removePlan(plan1Id);
    activePlans = controller.getActivePlans();
    assert.equal(activePlans.length, 1);
    assert.equal(activePlans[0].id, plan2Id);
  });

  it('3. toggleThesisCardsVisible membalikkan status visibilitas kartu tesis', () => {
    const controller = new ChartDrawingController();
    assert.equal(controller.isThesisCardsVisible(), true);

    const res1 = controller.toggleThesisCardsVisible();
    assert.equal(res1, false);
    assert.equal(controller.isThesisCardsVisible(), false);

    const res2 = controller.toggleThesisCardsVisible();
    assert.equal(res2, true);
    assert.equal(controller.isThesisCardsVisible(), true);
  });

  it('4. clearAll membersihkan seluruh drawing di canvas dan controller', async () => {
    const { controller } = createMockChartWorkspace();

    const plan = parseTradingPlan(sampleBearishMarkdown);
    assert.ok(plan);
    controller.createMultiTargetPosition(plan, { anchorTime: 1700000000000 });

    assert.ok(controller.getSnapshot().activeDrawings.length > 0);

    await controller.clearAll();
    assert.equal(controller.getSnapshot().activeDrawings.length, 0);
  });
});
