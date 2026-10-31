import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultCommandDispatcher,
  DEFAULT_COMMANDS,
  type CommandDefinition
} from '../src/lib/services/commandDispatcher';
import {
  isTradingPlanText,
  parseTradingPlan,
  type ParsedTradingPlan
} from '../src/lib/services/planParserService';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';

describe('Ticket 3 (#112): Import Plan Modal, Canvas Smart Paste & Shortcut Integration', () => {
  describe('1. Command Dispatcher Registry & Keystroke Matcher (Ctrl+Shift+P)', () => {
    it('mendaftarkan perintah open-import-plan dalam DEFAULT_COMMANDS dengan spesifikasi yang tepat', () => {
      const cmd = DEFAULT_COMMANDS.find((c) => c.id === 'open-import-plan');
      assert.ok(cmd, 'Perintah open-import-plan harus terdaftar di DEFAULT_COMMANDS');
      assert.equal(cmd?.id, 'open-import-plan');
      assert.equal(cmd?.category, 'Alat Gambar & Anotasi');
      assert.deepEqual(cmd?.keys, ['Ctrl', 'Shift', 'P']);
      assert.equal(cmd?.desc, 'Buka modal Import Trading Plan (Long/Short bertingkat)');
      assert.equal(cmd?.allowInInput, false);
      assert.equal(cmd?.match?.ctrlOrMeta, true);
      assert.equal(cmd?.match?.shift, true);
      assert.equal(cmd?.match?.key, 'p');
      assert.equal(cmd?.match?.code, 'KeyP');
    });

    it('createDefaultCommandDispatcher memicu handler saat Ctrl+Shift+P atau Cmd+Shift+P ditekan', () => {
      const dispatcher = createDefaultCommandDispatcher();
      let triggered = false;

      dispatcher.bindHandler('open-import-plan', () => {
        triggered = true;
      });

      // 1. Windows/Linux: Ctrl + Shift + P
      triggered = false;
      const eventCtrlShiftP = {
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        key: 'p',
        code: 'KeyP',
        target: null,
      } as unknown as KeyboardEvent;
      const handled1 = dispatcher.dispatch(eventCtrlShiftP);
      assert.equal(handled1, true);
      assert.equal(triggered, true);

      // 2. macOS: Cmd + Shift + P
      triggered = false;
      const eventCmdShiftP = {
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: true,
        key: 'p',
        code: 'KeyP',
        target: null,
      } as unknown as KeyboardEvent;
      const handled2 = dispatcher.dispatch(eventCmdShiftP);
      assert.equal(handled2, true);
      assert.equal(triggered, true);

      // 3. Shift key sering membuat key menjadi uppercase 'P'
      triggered = false;
      const eventUppercaseP = {
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        key: 'P',
        code: 'KeyP',
        target: null,
      } as unknown as KeyboardEvent;
      const handled3 = dispatcher.dispatch(eventUppercaseP);
      assert.equal(handled3, true);
      assert.equal(triggered, true);
    });

    it('mengabaikan kombinasi tanpa Shift atau tanpa Ctrl/Cmd', () => {
      const dispatcher = createDefaultCommandDispatcher();
      let triggered = false;

      dispatcher.bindHandler('open-import-plan', () => {
        triggered = true;
      });

      // Hanya Ctrl+P (tanpa shift) -> tidak boleh trigger open-import-plan
      const eventCtrlP = {
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        key: 'p',
        code: 'KeyP',
        target: null,
      } as unknown as KeyboardEvent;
      const handled1 = dispatcher.dispatch(eventCtrlP);
      assert.equal(handled1, false);
      assert.equal(triggered, false);

      // Hanya Shift+P (tanpa ctrl) -> tidak boleh trigger
      const eventShiftP = {
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        key: 'P',
        code: 'KeyP',
        target: null,
      } as unknown as KeyboardEvent;
      const handled2 = dispatcher.dispatch(eventShiftP);
      assert.equal(handled2, false);
      assert.equal(triggered, false);
    });

    it('menolak eksekusi jika fokus sedang berada pada input/textarea (allowInInput: false)', () => {
      const dispatcher = createDefaultCommandDispatcher();
      let triggered = false;

      dispatcher.bindHandler('open-import-plan', () => {
        triggered = true;
      });

      const fakeTextarea = {
        tagName: 'TEXTAREA',
        isContentEditable: false,
        closest: () => null,
      };

      const eventInInput = {
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        key: 'p',
        code: 'KeyP',
        target: fakeTextarea,
      } as unknown as KeyboardEvent;

      const handled = dispatcher.dispatch(eventInInput);
      assert.equal(handled, false);
      assert.equal(triggered, false);
    });
  });

  describe('2. Smart Canvas Paste Detection Helper (isTradingPlanText)', () => {
    const validMarkdown = `
|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Entry|81200.0 (Limit sell)|
|Stop Loss|81400.0|
|TP1|80355.4|
|TP2|79429.0|
`;

    const validBulletText = `
Trading Plan:
- Bias: Bullish
- Entry: 65000
- SL: 64200
- TP1: 67000
- TP2: 69000
`;

    it('mendeteksi format tabel markdown sebagai trading plan', () => {
      assert.equal(isTradingPlanText(validMarkdown), true);
    });

    it('mendeteksi teks plain berpoin dengan singkatan SL dan TP sebagai trading plan', () => {
      assert.equal(isTradingPlanText(validBulletText), true);
    });

    it('mendeteksi variasi kata Stop Loss dan Target Price', () => {
      const text = `
Direction / Bias: Bearish
Entry Price: 50000
Stop Loss Level: 51000
Target 1: 48000
Target 2: 46000
`;
      assert.equal(isTradingPlanText(text), true);
    });

    it('menolak teks acak atau parsial yang tidak memenuhi kriteria minimal', () => {
      assert.equal(isTradingPlanText(''), false);
      assert.equal(isTradingPlanText('   '), false);
      assert.equal(isTradingPlanText('Halo dunia, Bitcoin sedang naik kencang!'), false);
      // Hanya ada Entry dan SL tanpa Bias dan TP
      assert.equal(isTradingPlanText('Entry: 65000, Stop Loss: 64000'), false);
      // Hanya ada Bias dan Entry
      assert.equal(isTradingPlanText('Bias: Bullish, Entry: 65000'), false);
    });
  });

  describe('3. Simulasi Alur onApply: Parser ke Multi-Target Drawing Engine', () => {
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

    it('mengurai trading plan dan menerapkan multi-target position ke drawing controller', () => {
      const planText = `
|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Entry|81200.0|
|Stop Loss|81400.0|
|TP1|80355.4|
|R multiple TP1|4.22R|
|TP2|79429.0|
|R multiple TP2|8.85R|
`;
      const plan = parseTradingPlan(planText);
      assert.equal(plan.validation.valid, true);

      const baseTime = 1700000000000;
      const { controller, mockDrawings, getDrawings } = createMockChartWorkspace({
        candles: [
          { time: baseTime - 900000 },
          { time: baseTime },
        ],
      });

      // Eksekusi alur onApply
      const result = controller.createMultiTargetPosition(plan);
      assert.ok(result, 'createMultiTargetPosition harus mengembalikan hasil valid');
      assert.equal(result?.drawingIds.length, 2);
      assert.equal(mockDrawings.all().length, 2);

      // Verifikasi metadata drawing
      const d1 = mockDrawings.all()[0];
      assert.equal(d1.type, 'position');
      assert.equal(d1.metadata?.bias, 'bearish');
      assert.equal(d1.metadata?.stageIndex, 1);
      assert.equal(d1.anchors[2].price, 80355.4);
    });

    it('menolak rencana perdagangan dengan bias tidak konsisten saat sanity check gagal', () => {
      const invalidPlanText = `
|**Parameter**|**Nilai**|
|---|---|
|Bias|Bullish|
|Entry|81200.0|
|Stop Loss|81500.0| <!-- SL di atas Entry untuk Bullish adalah tidak valid -->
|TP1|82000.0|
`;
      const plan = parseTradingPlan(invalidPlanText);
      assert.equal(plan.validation.valid, false);
      assert.ok(plan.validation.errors.length > 0);

      const { controller } = createMockChartWorkspace();
      const result = controller.createMultiTargetPosition(plan);
      assert.equal(result, null, 'Tidak boleh membuat gambar jika plan tidak valid');
    });
  });
});
