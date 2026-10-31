import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController, isSameSymbol } from '../src/lib/services/chartDrawingController';
import { parseTradingPlan } from '../src/lib/services/planParserService';

describe('Revisi Trading Plan: Isolasi Simbol Koin & Eliminasi Floating Restore Pill', () => {
  const btcPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 77640.0 |
| Alasan Entry | Menangkap aksi manipulasi stop run [FAKTA] |
| Stop Loss | 77850.0 |
| Alasan SL | Ditempatkan di atas toleransi manipulasi [INFERENSI] |
| TP1 | 77050.0 |
| R multiple TP1 | 2.81R |
| TP2 | 76250.0 |
| R multiple TP2 | 6.62R |
  `.trim();

  const solPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Pair | SOLUSDT |
| Bias | Bullish |
| Entry | 185.50 |
| Stop Loss | 180.00 |
| TP1 | 195.00 |
| R multiple TP1 | 1.73R |
  `.trim();

  function createMockChartWorkspace(initialSymbol = 'BTCUSDT') {
    let currentSymbol = initialSymbol;
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
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
        calls.push(`remove:${id}`);
      },
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
        calls.push(`removeMany:${ids.length}`);
      },
      clear: () => {
        drawingsList = [];
        calls.push('clear');
      },
      fromJSON: (doc: any) => {
        drawingsList = (doc?.drawings || []).map((d: any) => ({ ...d }));
        calls.push('fromJSON');
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
      mockDrawings,
      getDrawings: () => drawingsList,
      calls
    };
  }

  describe('1. Utilitas Normalisasi & Pembanding Simbol (isSameSymbol)', () => {
    it('mencocokkan simbol identik dan case-insensitive', () => {
      assert.equal(isSameSymbol('BTCUSDT', 'BTCUSDT'), true);
      assert.equal(isSameSymbol('btcusdt', 'BTCUSDT'), true);
      assert.equal(isSameSymbol('BTCUSDT', 'btcusdt'), true);
    });

    it('mengabaikan prefix bursa / provider saat mencocokkan simbol', () => {
      assert.equal(isSameSymbol('binance:BTCUSDT', 'BTCUSDT'), true);
      assert.equal(isSameSymbol('BTCUSDT', 'binance:BTCUSDT'), true);
      assert.equal(isSameSymbol('BINANCE:SOLUSDT', 'binance:SOLUSDT'), true);
    });

    it('menangani sufiks kontrak perpetual (.P / -PERP / PERP)', () => {
      assert.equal(isSameSymbol('BTCUSDT.P', 'BTCUSDT'), true);
      assert.equal(isSameSymbol('BTCUSDT', 'BTCUSDT.P'), true);
      assert.equal(isSameSymbol('SOLUSDT-PERP', 'SOLUSDT'), true);
    });

    it('membedakan koin berbeda secara deterministik', () => {
      assert.equal(isSameSymbol('BTCUSDT', 'SOLUSDT'), false);
      assert.equal(isSameSymbol('ETHUSDT', 'BTCUSDT'), false);
      assert.equal(isSameSymbol('SOLUSDT', 'BTCUSDT.P'), false);
    });
  });

  describe('2. Parser Ekstraksi Simbol Koin', () => {
    it('mengekstrak koin dari tabel parameter (Pair: SOLUSDT)', () => {
      const plan = parseTradingPlan(solPlanMarkdown);
      assert.equal(plan.symbol, 'SOLUSDT');
    });

    it('mengekstrak koin dari teks heading atau pola koin crypto', () => {
      const textWithHeading = `
# BTCUSDT.P 15m Analysis
${btcPlanMarkdown}
      `.trim();
      const plan = parseTradingPlan(textWithHeading);
      assert.equal(plan.symbol, 'BTCUSDT.P');
    });
  });

  describe('3. Isolasi Multi-Koin pada ChartDrawingController', () => {
    it('mengaitkan plan dengan koin aktif saat dibuat jika plan tidak memiliki simbol', () => {
      const { controller } = createMockChartWorkspace('BTCUSDT');
      const plan = parseTradingPlan(btcPlanMarkdown);

      const res = controller.createMultiTargetPosition(plan);
      assert.ok(res, 'createMultiTargetPosition harus berhasil');

      const activePlans = controller.getActivePlans();
      assert.equal(activePlans.length, 1);
      assert.equal(activePlans[0].symbol, 'BTCUSDT');
    });

    it('menyaring getActivePlans sesuai koin/simbol aktif dan menyembunyikannya pada koin lain', () => {
      const { controller, setSymbol } = createMockChartWorkspace('BTCUSDT');
      const btcPlan = parseTradingPlan(btcPlanMarkdown);

      // Buat setup di BTCUSDT
      controller.createMultiTargetPosition(btcPlan);
      assert.equal(controller.getActivePlans().length, 1);
      assert.equal(controller.getSnapshot().activePlans.length, 1);

      // Simulasikan perpindahan simbol ke SOLUSDT
      setSymbol('SOLUSDT');

      // Pada SOLUSDT, activePlans harus kosong
      const solPlans = controller.getActivePlans();
      assert.equal(solPlans.length, 0, 'Setup BTC tidak boleh muncul saat koin aktif adalah SOLUSDT');
      assert.equal(controller.getSnapshot().activePlans.length, 0, 'Snapshot controller harus kosong untuk SOLUSDT');

      // Buat setup baru di SOLUSDT
      const solPlan = parseTradingPlan(solPlanMarkdown);
      controller.createMultiTargetPosition(solPlan);

      // Sekarang SOLUSDT memiliki 1 setup (setup SOL)
      const solActive = controller.getActivePlans();
      assert.equal(solActive.length, 1);
      assert.equal(solActive[0].symbol, 'SOLUSDT');

      // Kembali ke BTCUSDT
      setSymbol('BTCUSDT');
      const btcActive = controller.getActivePlans();
      assert.equal(btcActive.length, 1, 'Setup BTC harus muncul kembali saat kembali ke BTCUSDT');
      assert.equal(btcActive[0].symbol, 'BTCUSDT');

      // Verifikasi getAllActivePlans menyimpan kedua setup lintas koin
      const allPlans = controller.getAllActivePlans();
      assert.equal(allPlans.length, 2, 'getAllActivePlans harus menyimpan total 2 plan (BTC & SOL)');
    });

    it('handleDrawingMutated tidak menghapus plan koin lain saat pengguna berada di koin berbeda', () => {
      const { controller, setSymbol, mockDrawings } = createMockChartWorkspace('BTCUSDT');
      const btcPlan = parseTradingPlan(btcPlanMarkdown);
      controller.createMultiTargetPosition(btcPlan);

      assert.equal(controller.getAllActivePlans().length, 1);

      // Beralih ke SOLUSDT dan kosongkan kanvas visual Vela
      setSymbol('SOLUSDT');
      mockDrawings.clear();

      // Trigger mutasi gambar di kanvas SOLUSDT (yang saat ini tidak punya drawing BTC)
      controller.handleDrawingMutated();

      // Setup BTC harus tetap tersimpan aman di controller dan tidak terhapus
      assert.equal(controller.getAllActivePlans().length, 1, 'Setup BTC tidak boleh terhapus oleh mutasi di koin SOLUSDT');

      // Kembali ke BTCUSDT
      setSymbol('BTCUSDT');
      assert.equal(controller.getActivePlans().length, 1);
    });
  });

  describe('4. Eliminasi Floating Restore Pill & Kontrol Visibilitas Layer', () => {
    it('mengontrol visibilitas kartu tesis secara programatik tanpa restore pill mengapung', () => {
      const { controller } = createMockChartWorkspace('BTCUSDT');
      const btcPlan = parseTradingPlan(btcPlanMarkdown);
      controller.createMultiTargetPosition(btcPlan);

      assert.equal(controller.isThesisCardsVisible(), true);

      // Sembunyikan kartu tesis (misal dari tombol hide di card atau tab Layer)
      controller.setThesisCardsVisible(false);
      assert.equal(controller.isThesisCardsVisible(), false);
      assert.equal(controller.getSnapshot().showThesisCards, false);

      // Pulihkan kembali kartu tesis (hanya via toggle di tab Layer)
      controller.toggleThesisCardsVisible();
      assert.equal(controller.isThesisCardsVisible(), true);
      assert.equal(controller.getSnapshot().showThesisCards, true);
    });
  });
});
