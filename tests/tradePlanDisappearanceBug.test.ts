import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { parseTradingPlan } from '../src/lib/services/planParserService';

const btcPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Pair | BTCUSDT |
| Bias | Bearish |
| Entry | 77640.0 |
| Stop Loss | 77850.0 |
| TP1 | 77050.0 |
| R multiple TP1 | 2.81R |
| TP2 | 76250.0 |
| R multiple TP2 | 6.62R |
`.trim();

function createMockChartWorkspace(initialSymbol = 'BTCUSDT') {
  let currentSymbol = initialSymbol;
  let drawingsList: any[] = [];

  const mockDrawings = {
    all: () => drawingsList,
    create: (spec: any) => {
      const item = { ...spec, id: spec.id || `mock_${drawingsList.length + 1}` };
      drawingsList.push(item);
      return item;
    },
    remove: (id: string) => {
      drawingsList = drawingsList.filter((d) => d.id !== id);
    },
    removeMany: (ids: string[]) => {
      drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
    },
    clear: () => {
      drawingsList = [];
    },
    fromJSON: (doc: any) => {
      drawingsList = (doc?.drawings || []).map((d: any) => ({ ...d }));
    },
    toJSON: () => ({ version: 1, drawings: [...drawingsList] })
  };

  const mockWorkspace = {
    active: {
      symbol: currentSymbol,
      timeframe: '15m',
      chart: {
        drawings: mockDrawings,
        timeScale: () => ({
          coordinateToTime: () => 1700000000000,
          timeToCoordinate: () => 100
        }),
        priceScale: () => ({
          coordinateToPrice: () => 77000,
          priceToCoordinate: () => 200
        })
      }
    }
  };

  const controller = new ChartDrawingController();
  controller.attachWorkspace(
    mockWorkspace,
    () => currentSymbol,
    () => '15m',
    () => 'binance'
  );

  return {
    controller,
    setSymbol: (newSym: string) => {
      currentSymbol = newSym;
      mockWorkspace.active.symbol = newSym;
    },
    getSymbol: () => currentSymbol,
    mockDrawings,
    getDrawings: () => drawingsList
  };
}

describe('Reproduksi Bug: Trade plan hilang setelah ganti simbol atau ganti workspace', () => {
  it('Bug 1: Auto-save workspace saat ganti simbol tidak boleh mengosongkan activePlans', () => {
    const harness = createMockChartWorkspace('BTCUSDT');
    const plan = parseTradingPlan(btcPlanMarkdown);

    // 1. User membuat trade plan di BTCUSDT
    harness.controller.createMultiTargetPosition(plan);
    assert.equal(harness.controller.getAllActivePlans().length, 1, 'Harus ada 1 plan di memori controller');

    // 2. User berganti simbol ke SOLUSDT
    harness.setSymbol('SOLUSDT');

    // 3. Auto-save workspace mengeksekusi penyimpanan state workspace.
    // Di kode lama (+page.svelte:1135 & 963), kode memanggil:
    // const plansToSave = harness.controller.getActivePlans(); // BUG: terfilter simbol aktif (SOLUSDT) sehingga return []
    // Seharusnya memanggil getAllActivePlans():
    const buggySavedPlans = harness.controller.getActivePlans();
    
    // Asersi bahwa buggySavedPlans kosong (ini adalah bug-nya!)
    assert.equal(buggySavedPlans.length, 0, 'Repro: getActivePlans() mengembalikan array kosong saat di koin lain');

    // Asersi apa yang semestinya tersimpan: seluruh plan lintas koin harus tetap tersimpan!
    const correctSavedPlans = harness.controller.getAllActivePlans();
    assert.equal(correctSavedPlans.length, 1, 'getAllActivePlans() harus mempertahankan plan BTCUSDT');
  });

  it('Bug 2: Memuat workspace tanpa plan tidak boleh memanggil clearAllPlans() yang merusak gambar canvas', () => {
    const harness = createMockChartWorkspace('BTCUSDT');
    const plan = parseTradingPlan(btcPlanMarkdown);

    // 1. User memiliki trade plan di BTCUSDT
    harness.controller.createMultiTargetPosition(plan);
    assert.equal(harness.getDrawings().length, 2, 'Harus ada 2 drawing di kanvas');

    // 2. Pengguna berganti ke workspace lain yang belum memiliki plan (activePlans: undefined atau [])
    // Di kode lama (+page.svelte:1073), blok `else` memanggil:
    harness.controller.clearAllPlans();

    // 3. clearAllPlans() memanggil removePlan() yang menghapus drawing dari chart
    assert.equal(harness.controller.getAllActivePlans().length, 0, 'Plan di controller bersih');
    assert.equal(
      harness.getDrawings().length,
      0,
      'Repro: clearAllPlans() telah menghapus seluruh gambar visual dari canvas!'
    );
  });
});
