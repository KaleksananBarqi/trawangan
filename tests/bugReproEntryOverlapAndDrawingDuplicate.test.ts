import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import { renderDedicatedThesisSidePanel } from '../src/lib/services/chartSnapshotService';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';

function createMockCanvasContext() {
  const textCalls: Array<{ text: string; x: number; y: number; font: string; textAlign: string }> = [];
  let currentFont = '10px sans-serif';
  let currentTextAlign = 'left';
  let currentBaseline = 'alphabetic';

  return {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    quadraticCurveTo() {},
    roundRect() {},
    rect() {},
    stroke() {},
    fill() {},
    clip() {},
    setLineDash() {},
    fillRect() {},
    set font(f: string) { currentFont = f; },
    get font() { return currentFont; },
    set textAlign(a: string) { currentTextAlign = a; },
    get textAlign() { return currentTextAlign; },
    set textBaseline(b: string) { currentBaseline = b; },
    get textBaseline() { return currentBaseline; },
    set fillStyle(_: any) {},
    set strokeStyle(_: any) {},
    set lineWidth(_: any) {},
    measureText(text: string) {
      // Monospace 11px memiliki rata-rata lebar 7-8px per char
      // Sans-serif 9px proporsional memiliki rata-rata lebar 5px per char
      const isMonospace11 = currentFont.includes('11px') || currentFont.includes('JetBrains Mono');
      const charWidth = isMonospace11 ? 7.5 : 5.0;
      return { width: text.length * charWidth };
    },
    fillText(text: string, x: number, y: number) {
      textCalls.push({
        text: String(text),
        x,
        y,
        font: currentFont,
        textAlign: currentTextAlign
      });
    },
    getTextCalls() {
      return textCalls;
    }
  };
}

function createMockDrawingWorkspace(initialDrawings: any[] = []) {
  let mockDrawings: any[] = [...initialDrawings];
  let idSeq = 1;

  const mockChart = {
    data: () => [{ time: 1700000000000, close: 604 }],
    drawings: {
      all: () => [...mockDrawings],
      add: (type: string, init: any) => {
        const d = { id: `dw-${idSeq++}`, type, ...init };
        mockDrawings.push(d);
        return d;
      },
      create: (init: any) => {
        const d = { id: `dw-${idSeq++}`, ...init };
        mockDrawings.push(d);
        return d;
      },
      fromJSON: (doc: any) => {
        mockDrawings = [...(doc?.drawings || [])];
      },
      toJSON: () => ({
        version: 1,
        drawings: mockDrawings.map((d) => ({ ...d }))
      }),
      removeMany: (ids: string[]) => {
        mockDrawings = mockDrawings.filter((d) => !ids.includes(d.id));
      }
    }
  };

  const mockWorkspace = {
    active: { chart: mockChart, symbol: 'BINANCE:XMRUSDT', timeframe: '15m' },
    cells: () => [mockWorkspace.active]
  };

  return {
    mockWorkspace,
    getDrawings: () => mockDrawings,
    setDrawings: (drawings: any[]) => { mockDrawings = [...drawings]; }
  };
}

describe('Bug 1 Repro: Teks Entry nabrak angka harga Entry di Dedicated Thesis Side Panel', () => {
  it('label "Entry" tidak boleh tumpang tindih dengan angka harga entry di header', () => {
    const rawPlan = `
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 601.50 |
| Alasan Entry | Multi-timeframe PD Array [FAKTA] |
| Stop Loss | 597.00 |
| Alasan SL | Di bawah Swing Low [FAKTA] |
| TP1 | 607.50 |
| R multiple TP1 | 1.33R |
| TP2 | 611.20 |
| R multiple TP2 | 2.16R |

### Kesimpulan
* **Probabilitas Setup:** Medium
    `.trim();

    const plan = parseTradingPlan(rawPlan);
    const ctx = createMockCanvasContext();

    renderDedicatedThesisSidePanel(ctx as any, plan as any, 100, 50, 380, 600, 1);

    const calls = ctx.getTextCalls();
    const entryPriceCall = calls.find((c) => c.text === '601.50');
    const entryLabelCall = calls.find((c) => c.text === 'Entry');

    assert.ok(entryPriceCall, `Angka harga entry harus dirender. Teks terdaftar: ${calls.map(c => c.text).join(', ')}`);
    assert.ok(entryLabelCall, 'Label "Entry" harus dirender');

    // Evaluasi koordinat X teks Entry vs Harga Entry
    // Jika textAlign == 'right':
    // Koordinat x adalah batas KANAN teks tersebut.
    // Teks harga entry berakhir di entryPriceCall.x.
    // Jika monospace lebar 601.50 adalah 6 * 7.5 = 45px.
    // Tepi kiri harga entry adalah entryPriceCall.x - 45px.
    // Tepi kanan label "Entry" (entryLabelCall.x) HARUS berada di sebelah kiri dari tepi kiri harga entry!
    const entryPriceWidth = '601.50'.length * 7.5; // perkiraan lebar harga dengan font monospace 11px
    const entryPriceLeftEdge = entryPriceCall.x - entryPriceWidth;

    // Batas kanan label Entry TIDAK BOLEH lebih besar daripada batas kiri harga entry!
    assert.ok(
      entryLabelCall.x <= entryPriceLeftEdge,
      `Teks "Entry" (kanan: ${entryLabelCall.x}) menabrak harga entry (kiri: ${entryPriceLeftEdge})!`
    );
  });
});

describe('Bug 2 Repro: Buka trawangan setelah di-close menyebabkan objek duplikat', () => {
  it('memulihkan plans saat kanvas sudah berisi drawings dari storage tidak boleh menduplikasi drawings di kanvas', () => {
    const { mockWorkspace, getDrawings } = createMockDrawingWorkspace();

    // Sesi 1: Pengguna membuka aplikasi, mengimpor trading plan
    const controllerSession1 = new ChartDrawingController();
    controllerSession1.attachWorkspace(
      mockWorkspace,
      () => 'XMRUSDT',
      () => '15m',
      () => 'binance'
    );

    const rawPlan = `
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 601.50 |
| Alasan Entry | Multi-timeframe PD Array [FAKTA] |
| Stop Loss | 597.00 |
| Alasan SL | Di bawah Swing Low [FAKTA] |
| TP1 | 607.50 |
| R multiple TP1 | 1.33R |
| TP2 | 611.20 |
| R multiple TP2 | 2.16R |
| Context Zone 1 | 600.00 - 601.50 (15m Bullish FVG) |

### Kesimpulan
* **Probabilitas Setup:** Medium
    `.trim();

    const plan = parseTradingPlan(rawPlan);
    const planId = 'plan_xmr_test_1';
    const planRecord = { ...plan, id: planId };

    // Buat posisi bertingkat dan context zones
    const created = controllerSession1.createMultiTargetPosition(planRecord, { planId });
    assert.ok(created, 'createMultiTargetPosition harus berhasil');
    const initialDrawingCount = getDrawings().length;
    assert.equal(initialDrawingCount, 3, 'Harus ada 3 drawing di sesi pertama');

    // Simulasikan auto-save gambar ke storage (doc)
    const savedDrawingsDoc = mockWorkspace.active.chart.drawings.toJSON();
    // Simulasikan workspace saving activePlans
    const savedActivePlans = controllerSession1.getActivePlans();
    assert.equal(savedActivePlans.length, 1);

    // ==========================================
    // Sesi 2: Pengguna menutup aplikasi (close) lalu membuka kembali (open)
    // ==========================================
    const controllerSession2 = new ChartDrawingController();
    controllerSession2.attachWorkspace(
      mockWorkspace,
      () => 'XMRUSDT',
      () => '15m',
      () => 'binance'
    );

    // Langkah 1 startup: restoreDrawings dipanggil (memuat drawings dari storage ke kanvas)
    mockWorkspace.active.chart.drawings.fromJSON(savedDrawingsDoc);
    controllerSession2.handleDrawingDraft();

    assert.equal(getDrawings().length, 3, 'Kanvas memuat 3 drawings dari storage');

    // Langkah 2 startup: handleLoadWorkspace memanggil restorePlans dengan savedActivePlans
    controllerSession2.restorePlans(savedActivePlans, true);

    // VERIFIKASI: Jumlah drawings di kanvas TIDAK BOLEH menjadi 6 (duplikat)!
    assert.equal(
      getDrawings().length,
      initialDrawingCount,
      `Drawings terduplikasi setelah startup! Diharapkan ${initialDrawingCount}, tetapi menjadi ${getDrawings().length}`
    );
  });

  it('Self-Healing: membersihkan duplikat warisan jika sebelumnya sudah terlanjur tercemar duplikat', () => {
    const taintedDrawings = [
      { id: 'dw-1', type: 'position', paneId: 'price', anchors: [{ time: 100, price: 601.50 }, { time: 200, price: 597.00 }, { time: 200, price: 607.50 }] },
      { id: 'dw-2', type: 'position', paneId: 'price', anchors: [{ time: 200, price: 601.50 }, { time: 300, price: 597.00 }, { time: 300, price: 611.20 }] },
      { id: 'dw-3', type: 'box', paneId: 'price', anchors: [{ time: 100, price: 601.50 }, { time: 300, price: 600.00 }] },
      // Duplikat warisan:
      { id: 'dw-4', type: 'position', paneId: 'price', anchors: [{ time: 100, price: 601.50 }, { time: 200, price: 597.00 }, { time: 200, price: 607.50 }] },
      { id: 'dw-5', type: 'position', paneId: 'price', anchors: [{ time: 200, price: 601.50 }, { time: 300, price: 597.00 }, { time: 300, price: 611.20 }] },
      { id: 'dw-6', type: 'box', paneId: 'price', anchors: [{ time: 100, price: 601.50 }, { time: 300, price: 600.00 }] },
    ];

    const { mockWorkspace, getDrawings } = createMockDrawingWorkspace(taintedDrawings);

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      mockWorkspace,
      () => 'XMRUSDT',
      () => '15m',
      () => 'binance'
    );

    assert.equal(getDrawings().length, 6, 'Sebelum restore, ada 6 drawings tercemar duplikat');

    const plan = parseTradingPlan(`
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 601.50 |
| Stop Loss | 597.00 |
| TP1 | 607.50 |
| TP2 | 611.20 |
| Context Zone 1 | 600.00 - 601.50 (15m Bullish FVG) |
    `);
    const planRecord = { ...plan, id: 'plan_xmr_self_healing' };

    controller.restorePlans([planRecord], true);

    // Duplikat harus tereliminasi, menyisakan tepat 3 drawing unik
    assert.equal(getDrawings().length, 3, 'Duplikat warisan harus dibersihkan secara otomatis');
  });

  it('Mendukung koin sub-dollar (PEPE / SHIB) tanpa salah mengidentifikasi target stage yang berbeda sebagai duplikat', () => {
    // Pada PEPE, harga berorde 0.0000095
    const pepeDrawings = [
      { id: 'dw-p1', type: 'position', paneId: 'price', anchors: [{ time: 100, price: 0.0000095 }, { time: 200, price: 0.0000090 }, { time: 200, price: 0.0000105 }] },
      { id: 'dw-p2', type: 'position', paneId: 'price', anchors: [{ time: 200, price: 0.0000095 }, { time: 300, price: 0.0000090 }, { time: 300, price: 0.0000120 }] },
    ];

    const { mockWorkspace, getDrawings } = createMockDrawingWorkspace(pepeDrawings);

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      mockWorkspace,
      () => 'PEPEUSDT',
      () => '15m',
      () => 'binance'
    );

    const plan = parseTradingPlan(`
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 0.0000095 |
| Stop Loss | 0.0000090 |
| TP1 | 0.0000105 |
| TP2 | 0.0000120 |
    `);
    const planRecord = { ...plan, id: 'plan_pepe_subdollar', symbol: 'PEPEUSDT' };

    controller.restorePlans([planRecord], true);

    // Kedua stage TP1 dan TP2 tidak boleh terhapus atau tertukar
    assert.equal(getDrawings().length, 2, 'Kedua stage TP1 dan TP2 koin sub-dollar harus tetap utuh');
    assert.equal(controller.getActivePlans().length, 1);
  });
});
