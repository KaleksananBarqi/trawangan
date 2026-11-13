import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PineStrategyTelemetryService,
  parseStrategyState,
  parseStrategyTrades,
  tradesToTradeExecutions,
  type StrategyState,
  type StrategyTrade,
  type TradeExecution,
  type StrategyTelemetryPayload,
} from '../src/lib/services/pineStrategyTelemetry';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

describe('Pine Strategy Execution Markers & Performance Telemetry Surface Suite (#199)', () => {
  let telemetryService: PineStrategyTelemetryService;

  beforeEach(() => {
    telemetryService = new PineStrategyTelemetryService();
  });

  describe('1. StrategyState Parsing & Normalization', () => {
    test('mem-parsing format Vela camelCase secara akurat', () => {
      const raw = {
        position: 2.5,
        avgPrice: 65420.5,
        equity: 115200.75,
        openPnl: 1250.25,
        netPnl: 15200.75,
        grossProfit: 22400.0,
        grossLoss: 7199.25,
        wins: 14,
        losses: 6,
        even: 2,
        maxDrawdown: 3450.5,
        maxRunup: 18200.0,
        initialCapital: 100000.0,
      };

      const state = parseStrategyState(raw);
      assert.strictEqual(state.position, 2.5);
      assert.strictEqual(state.avgPrice, 65420.5);
      assert.strictEqual(state.equity, 115200.75);
      assert.strictEqual(state.openPnl, 1250.25);
      assert.strictEqual(state.netPnl, 15200.75);
      assert.strictEqual(state.grossProfit, 22400.0);
      assert.strictEqual(state.grossLoss, 7199.25);
      assert.strictEqual(state.wins, 14);
      assert.strictEqual(state.losses, 6);
      assert.strictEqual(state.even, 2);
      assert.strictEqual(state.maxDrawdown, 3450.5);
      assert.strictEqual(state.maxRunup, 18200.0);
      assert.strictEqual(state.initialCapital, 100000.0);
    });

    test('mem-parsing format PineTS snake_case secara harmonis', () => {
      const raw = {
        position_size: -1.0,
        position_avg_price: 3420.0,
        equity: 10500.0,
        openprofit: -50.0,
        netprofit: 500.0,
        grossprofit: 1200.0,
        grossloss: 700.0,
        wintrades: 5,
        losstrades: 3,
        eventrades: 1,
        max_drawdown: 350.0,
        max_runup: 800.0,
        initial_capital: 10000.0,
      };

      const state = parseStrategyState(raw);
      assert.strictEqual(state.position, -1.0);
      assert.strictEqual(state.avgPrice, 3420.0);
      assert.strictEqual(state.equity, 10500.0);
      assert.strictEqual(state.openPnl, -50.0);
      assert.strictEqual(state.netPnl, 500.0);
      assert.strictEqual(state.grossProfit, 1200.0);
      assert.strictEqual(state.grossLoss, 700.0);
      assert.strictEqual(state.wins, 5);
      assert.strictEqual(state.losses, 3);
      assert.strictEqual(state.even, 1);
      assert.strictEqual(state.maxDrawdown, 350.0);
      assert.strictEqual(state.maxRunup, 800.0);
      assert.strictEqual(state.initialCapital, 10000.0);
    });

    test('memberikan nilai default 0 dan fallback aman saat data null atau tidak lengkap', () => {
      const state = parseStrategyState(null);
      assert.strictEqual(state.position, 0);
      assert.strictEqual(state.avgPrice, 0);
      assert.strictEqual(state.equity, 0);
      assert.strictEqual(state.netPnl, 0);
      assert.strictEqual(state.wins, 0);
      assert.strictEqual(state.initialCapital, 0);

      const partial = parseStrategyState({ netPnl: 100 });
      assert.strictEqual(partial.netPnl, 100);
      assert.strictEqual(partial.grossProfit, 0);
      assert.strictEqual(partial.losses, 0);
    });
  });

  describe('2. Trade Extraction & TradeExecution Marker Normalization', () => {
    test('mengonversi round-trip trades menjadi TradeExecution markers dengan orientasi arah panah yang tepat', () => {
      const trades: StrategyTrade[] = [
        {
          id: 'trade_1',
          side: 'long',
          qty: 1.5,
          entry: { id: 'Long_Entry', time: 1700000000000, price: 50000, comment: 'EMA Cross Buy' },
          exit: { id: 'TP_Hit', time: 1700000060000, price: 52000, comment: 'Take Profit' },
          open: false,
          pnl: 3000,
        },
        {
          id: 'trade_2',
          side: 'short',
          qty: 0.8,
          entry: { id: 'Short_Entry', time: 1700000120000, price: 51500, comment: 'RSI Overbought' },
          exit: { id: 'SL_Hit', time: 1700000180000, price: 52200, comment: 'Stop Loss' },
          open: false,
          pnl: -560,
        },
        {
          id: 'trade_3',
          side: 'long',
          qty: 2.0,
          entry: { id: 'Active_Long', time: 1700000240000, price: 52100 },
          open: true,
        },
      ];

      const executions = tradesToTradeExecutions(trades);
      assert.strictEqual(executions.length, 5, '3 transaksi (2 closed, 1 open) menghasilkan total 5 marker eksekusi');

      // Trade 1: Long entry (Buy entry: up arrow below bar)
      const t1Entry = executions[0];
      assert.strictEqual(t1Entry.side, 'buy');
      assert.strictEqual(t1Entry.kind, 'entry');
      assert.strictEqual(t1Entry.time, 1700000000000);
      assert.strictEqual(t1Entry.price, 50000);
      assert.strictEqual(t1Entry.label, 'EMA Cross Buy');
      assert.strictEqual(t1Entry.qty, 1.5);
      assert.strictEqual(t1Entry.tradeId, 'trade_1');

      // Trade 1: Long exit (Sell exit: down arrow above bar)
      const t1Exit = executions[1];
      assert.strictEqual(t1Exit.side, 'sell');
      assert.strictEqual(t1Exit.kind, 'exit');
      assert.strictEqual(t1Exit.time, 1700000060000);
      assert.strictEqual(t1Exit.price, 52000);
      assert.strictEqual(t1Exit.label, 'Take Profit');
      assert.strictEqual(t1Exit.qty, 1.5);

      // Trade 2: Short entry (Sell entry: down arrow above bar)
      const t2Entry = executions[2];
      assert.strictEqual(t2Entry.side, 'sell');
      assert.strictEqual(t2Entry.kind, 'entry');
      assert.strictEqual(t2Entry.time, 1700000120000);
      assert.strictEqual(t2Entry.price, 51500);
      assert.strictEqual(t2Entry.label, 'RSI Overbought');
      assert.strictEqual(t2Entry.qty, 0.8);

      // Trade 2: Short exit (Buy exit: up arrow below bar)
      const t2Exit = executions[3];
      assert.strictEqual(t2Exit.side, 'buy');
      assert.strictEqual(t2Exit.kind, 'exit');
      assert.strictEqual(t2Exit.time, 1700000180000);
      assert.strictEqual(t2Exit.price, 52200);
      assert.strictEqual(t2Exit.label, 'Stop Loss');

      // Trade 3: Active long entry tanpa exit
      const t3Entry = executions[4];
      assert.strictEqual(t3Entry.side, 'buy');
      assert.strictEqual(t3Entry.kind, 'entry');
      assert.strictEqual(t3Entry.label, 'Active_Long');
    });

    test('mengonversi daftar raw closedtrades & opentrades dari PineTS menjadi StrategyTrade[]', () => {
      const rawPineTrades = [
        {
          id: 'trade_1',
          size: 1.0,
          entry_price: 3000,
          entry_time: 1000,
          entry_comment: 'Long Start',
          exit_price: 3200,
          exit_time: 2000,
          exit_comment: 'Long End',
          profit: 200,
          status: 'closed',
        },
        {
          id: 'trade_2',
          size: -2.0,
          entry_price: 3200,
          entry_time: 3000,
          entry_id: 'Short_Open',
          status: 'open',
        },
      ];

      const parsed = parseStrategyTrades(rawPineTrades);
      assert.strictEqual(parsed.length, 2);

      assert.strictEqual(parsed[0].id, 'trade_1');
      assert.strictEqual(parsed[0].side, 'long');
      assert.strictEqual(parsed[0].qty, 1.0);
      assert.strictEqual(parsed[0].entry.price, 3000);
      assert.strictEqual(parsed[0].exit?.price, 3200);
      assert.strictEqual(parsed[0].open, false);
      assert.strictEqual(parsed[0].pnl, 200);

      assert.strictEqual(parsed[1].id, 'trade_2');
      assert.strictEqual(parsed[1].side, 'short');
      assert.strictEqual(parsed[1].qty, 2.0);
      assert.strictEqual(parsed[1].open, true);
      assert.strictEqual(parsed[1].exit, undefined);
    });
  });

  describe('3. Telemetry Service Store & Subscriber Notification', () => {
    test('menyimpan, mengambil, dan memperbarui telemetri per-indicatorId', () => {
      const payload1: StrategyTelemetryPayload = {
        indicatorId: 'ind_strategy_1',
        scriptTitle: 'Dual EMA Cross',
        state: parseStrategyState({ netPnl: 1500, initialCapital: 10000 }),
        trades: [],
        tradeExecutions: [],
        timestamp: Date.now(),
      };

      telemetryService.recordTelemetry(payload1);

      const retrieved = telemetryService.getTelemetry('ind_strategy_1');
      assert.ok(retrieved);
      assert.strictEqual(retrieved?.scriptTitle, 'Dual EMA Cross');
      assert.strictEqual(retrieved?.state.netPnl, 1500);

      // Ambil default saat indicatorId dihilangkan (mengembalikan strategi terbaru)
      const latest = telemetryService.getTelemetry();
      assert.strictEqual(latest?.indicatorId, 'ind_strategy_1');
    });

    test('memberitahukan subscriber saat telemetri baru dicatat', () => {
      let notifiedPayload: StrategyTelemetryPayload | null = null;
      const unsub = telemetryService.subscribe((p) => {
        notifiedPayload = p;
      });

      const payload: StrategyTelemetryPayload = {
        indicatorId: 'strat_alpha',
        scriptTitle: 'Alpha 1',
        state: parseStrategyState({ netPnl: 250 }),
        trades: [],
        tradeExecutions: [],
        timestamp: Date.now(),
      };

      telemetryService.recordTelemetry(payload);
      assert.ok(notifiedPayload);
      assert.strictEqual((notifiedPayload as StrategyTelemetryPayload).indicatorId, 'strat_alpha');

      // Unsubscribe bekerja
      notifiedPayload = null;
      unsub();
      telemetryService.recordTelemetry({ ...payload, indicatorId: 'strat_beta' });
      assert.strictEqual(notifiedPayload, null);
    });

    test('membersihkan telemetri dengan aman via clearTelemetry', () => {
      telemetryService.recordTelemetry({
        indicatorId: 'strat_1',
        state: parseStrategyState({ netPnl: 100 }),
        trades: [],
        tradeExecutions: [],
        timestamp: 1,
      });
      telemetryService.recordTelemetry({
        indicatorId: 'strat_2',
        state: parseStrategyState({ netPnl: 200 }),
        trades: [],
        tradeExecutions: [],
        timestamp: 2,
      });

      assert.strictEqual(telemetryService.getAllTelemetry().length, 2);

      // Hapus hanya strat_1
      telemetryService.clearTelemetry('strat_1');
      assert.strictEqual(telemetryService.getTelemetry('strat_1'), null);
      assert.ok(telemetryService.getTelemetry('strat_2'));

      // Hapus seluruhnya
      telemetryService.clearTelemetry();
      assert.strictEqual(telemetryService.getAllTelemetry().length, 0);
    });
  });

  describe('4. Ekstraksi dari ScriptRun & Context Object', () => {
    test('extractFromScriptRun mengekstrak state, memanggil run.trades(), dan mengonversi execution markers', async () => {
      const mockTrades: StrategyTrade[] = [
        {
          id: 'rt_1',
          side: 'long',
          qty: 0.5,
          entry: { id: 'Buy_Dip', time: 1600000000, price: 40000 },
          open: true,
        },
      ];

      const mockRun = {
        id: 'strat_run_1',
        title: 'Dip Buyer Strategy',
        kind: 'strategy',
        strategy: {
          position: 0.5,
          avgPrice: 40000,
          equity: 10200,
          openPnl: 200,
          netPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          wins: 0,
          losses: 0,
          even: 0,
          maxDrawdown: 50,
          maxRunup: 250,
          initialCapital: 10000,
        },
        trades: async () => mockTrades,
      };

      const extracted = await telemetryService.extractFromScriptRun(mockRun, 'cell_0');
      assert.ok(extracted);
      assert.strictEqual(extracted.indicatorId, 'strat_run_1');
      assert.strictEqual(extracted.scriptTitle, 'Dip Buyer Strategy');
      assert.strictEqual(extracted.state.equity, 10200);
      assert.strictEqual(extracted.trades.length, 1);
      assert.strictEqual(extracted.tradeExecutions.length, 1);
      assert.strictEqual(extracted.tradeExecutions[0].side, 'buy');
      assert.strictEqual(extracted.tradeExecutions[0].kind, 'entry');

      // Terdaftar di internal store
      assert.ok(telemetryService.getTelemetry('strat_run_1'));
    });

    test('extractFromContext mengekstrak dari snapshot handle.context()', () => {
      const mockContext = {
        strategy: {
          position_size: 1.2,
          position_avg_price: 2500,
          equity: 52000,
          netprofit: 2000,
        },
        trades: [
          {
            id: 'ctx_t1',
            size: 1.2,
            entry_price: 2500,
            entry_time: 5000,
            entry_id: 'L1',
            status: 'open',
          },
        ],
      };

      const extracted = telemetryService.extractFromContext('strat_ctx_1', mockContext, 'Context Strategy');
      assert.ok(extracted);
      assert.strictEqual(extracted.indicatorId, 'strat_ctx_1');
      assert.strictEqual(extracted.state.position, 1.2);
      assert.strictEqual(extracted.state.avgPrice, 2500);
      assert.strictEqual(extracted.trades.length, 1);
      assert.strictEqual(extracted.tradeExecutions.length, 1);
      assert.strictEqual(extracted.tradeExecutions[0].price, 2500);
    });
  });

  describe('5. ChartSessionController Strategy Telemetry & Lifecycle Integration', () => {
    function createMockCell(id: string = 'cell-0') {
      const listeners = new Map<string, Function[]>();
      let appliedConfig: any = {};
      const indicatorsMap = new Map<string, any>();

      const chart = {
        on(event: string, fn: Function) {
          const list = listeners.get(event) || [];
          list.push(fn);
          listeners.set(event, list);
          return () => {
            const arr = listeners.get(event) || [];
            listeners.set(event, arr.filter((h) => h !== fn));
          };
        },
        emit(event: string, payload: any) {
          for (const fn of listeners.get(event) || []) {
            fn(payload);
          }
        },
        applyConfig(cfg: any) {
          appliedConfig = { ...appliedConfig, ...cfg };
        },
        getAppliedConfig() {
          return appliedConfig;
        },
        renderer: {
          applyConfig(cfg: any) {
            appliedConfig = { ...appliedConfig, ...cfg };
          },
          getAppliedConfig() {
            return appliedConfig;
          },
          onConfigChanged(fn: Function) {
            return () => {};
          },
        },
        indicators() {
          return Array.from(indicatorsMap.values());
        },
        indicatorsMap,
        addIndicator(src: string, opts: any) {
          const id = opts?.id || `ind_${Math.random().toString(36).substring(7)}`;
          const handle = {
            id,
            title: opts?.title || 'Strategy',
            source: src,
            context: async () => ({
              strategy: {
                netPnl: 750,
                initialCapital: 10000,
                position: 1,
                avgPrice: 60000,
              },
              trades: [
                {
                  id: 't_init',
                  side: 'long',
                  qty: 1,
                  entry: { id: 'Init_Buy', time: 1000, price: 60000 },
                  open: true,
                },
              ],
            }),
            remove() {
              indicatorsMap.delete(id);
              chart.emit('indicator:removed', { id });
            },
          };
          indicatorsMap.set(id, handle);
          return handle;
        },
      };

      return {
        id,
        chart,
        inner: chart,
      };
    }

    test('saat Pine script strategy dijalankan, konfigurasi tradeMarkers diaktifkan di renderer', async () => {
      const cell = createMockCell();
      const mockWorkspace = {
        cell: () => cell,
        active: cell,
        setLayout: () => {},
        on: (ev: string, fn: Function) => cell.chart.on(ev, fn),
        off: () => {},
        destroy: () => {},
      };

      let telemetryReceived: StrategyTelemetryPayload | null = null;
      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace as any,
        onStrategyTelemetry: (p) => {
          telemetryReceived = p;
        },
      });

      const container = {} as any;
      controller.attach(container);

      // Tambahkan Pine Script berjenis strategy
      const stratCode = '//@version=6\nstrategy("Momentum Alpha", overlay=true)\nstrategy.entry("Long", strategy.long)';
      await controller.addPineIndicator(stratCode, 'Momentum Alpha');

      // Pastikan konfigurasi trades di renderer diaktifkan
      const cfg = cell.chart.getAppliedConfig();
      assert.strictEqual(cfg.trades?.visible, true, 'trades.visible harus diaktifkan');
      assert.strictEqual(cfg.trades?.labels, true, 'trades.labels harus aktif');
      assert.strictEqual(cfg.trades?.qty, true, 'trades.qty harus aktif');

      controller.destroy();
    });

    test('menangani event script:run, memperbarui telemetri, dan memancarkan onStrategyTelemetry', async () => {
      const cell = createMockCell();
      const mockWorkspace = {
        cell: () => cell,
        active: cell,
        setLayout: () => {},
        on: (ev: string, fn: Function) => cell.chart.on(ev, fn),
        off: () => {},
        destroy: () => {},
      };

      let captured: StrategyTelemetryPayload | null = null;
      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace as any,
        onStrategyTelemetry: (p) => {
          captured = p;
        },
      });

      const container = {} as any;
      controller.attach(container);

      // Simulasikan emisi event script:run dari Vela runtime
      const runPayload = {
        id: 'strat_alpha_1',
        title: 'Super Strategy',
        kind: 'strategy',
        strategy: {
          position: 1.5,
          avgPrice: 62000,
          equity: 12500,
          openPnl: 500,
          netPnl: 2000,
          grossProfit: 3000,
          grossLoss: 1000,
          wins: 4,
          losses: 1,
          even: 0,
          maxDrawdown: 400,
          maxRunup: 2200,
          initialCapital: 10000,
        },
        trades: async () => [
          {
            id: 'tr_1',
            side: 'long' as const,
            qty: 1.5,
            entry: { id: 'Buy_Signal', time: 100000, price: 61500, comment: 'Breakout Buy' },
            open: true,
          },
        ],
      };

      cell.chart.emit('script:run', runPayload);

      // Berikan tick loop async
      await new Promise((resolve) => setTimeout(resolve, 10));

      assert.ok(captured, 'onStrategyTelemetry harus dipanggil');
      const payload = captured as StrategyTelemetryPayload;
      assert.strictEqual(payload.indicatorId, 'strat_alpha_1');
      assert.strictEqual(payload.state.netPnl, 2000);
      assert.strictEqual(payload.trades.length, 1);
      assert.strictEqual(payload.tradeExecutions.length, 1);
      assert.strictEqual(payload.tradeExecutions[0].label, 'Breakout Buy');

      // Ambil telemetri via controller API
      const tel = controller.getStrategyTelemetry('strat_alpha_1');
      assert.ok(tel);
      assert.strictEqual(tel?.state.grossProfit, 3000);

      controller.destroy();
    });

    test('recompute: saat strategi dihitung ulang, data lama digantikan secara bersih tanpa residu', async () => {
      const cell = createMockCell();
      const mockWorkspace = {
        cell: () => cell,
        active: cell,
        setLayout: () => {},
        on: (ev: string, fn: Function) => cell.chart.on(ev, fn),
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace as any,
      });

      controller.attach({} as any);

      // Run 1: 1 trade
      cell.chart.emit('script:run', {
        id: 'strat_recompute',
        title: 'Recompute Test',
        kind: 'strategy',
        strategy: { netPnl: 100, initialCapital: 1000 },
        trades: async () => [
          {
            id: 't1',
            side: 'long' as const,
            qty: 1,
            entry: { id: 'E1', time: 1000, price: 100 },
            open: true,
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      let tel = controller.getStrategyTelemetry('strat_recompute');
      assert.strictEqual(tel?.trades.length, 1);
      assert.strictEqual(tel?.state.netPnl, 100);

      // Run 2: Recomputed dengan 2 trade berbeda dan PnL 250
      cell.chart.emit('script:run', {
        id: 'strat_recompute',
        title: 'Recompute Test',
        kind: 'strategy',
        strategy: { netPnl: 250, initialCapital: 1000 },
        trades: async () => [
          {
            id: 't2_new',
            side: 'short' as const,
            qty: 2,
            entry: { id: 'E2', time: 2000, price: 200 },
            open: true,
          },
          {
            id: 't3_new',
            side: 'long' as const,
            qty: 1,
            entry: { id: 'E3', time: 3000, price: 300 },
            open: true,
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      tel = controller.getStrategyTelemetry('strat_recompute');
      assert.strictEqual(tel?.trades.length, 2, 'Harus memuat tepat 2 transaksi baru, bukan akumulasi');
      assert.strictEqual(tel?.state.netPnl, 250);
      assert.strictEqual(tel?.trades[0].id, 't2_new');

      controller.destroy();
    });

    test('cleanup on removal: saat indikator dihapus, telemetri dan trade markers dibersihkan', async () => {
      const cell = createMockCell();
      const mockWorkspace = {
        cell: () => cell,
        active: cell,
        setLayout: () => {},
        on: (ev: string, fn: Function) => cell.chart.on(ev, fn),
        off: () => {},
        destroy: () => {},
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => mockWorkspace as any,
      });

      controller.attach({} as any);

      // Catat telemetri untuk strategi
      cell.chart.emit('script:run', {
        id: 'strat_to_remove',
        title: 'Removable Strategy',
        kind: 'strategy',
        strategy: { netPnl: 500, initialCapital: 5000 },
        trades: async () => [
          {
            id: 'del_1',
            side: 'long' as const,
            qty: 1,
            entry: { id: 'E1', time: 100, price: 50 },
            open: true,
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      assert.ok(controller.getStrategyTelemetry('strat_to_remove'));

      // Hapus indikator via event indicator:removed
      cell.chart.emit('indicator:removed', { id: 'strat_to_remove' });

      // Verifikasi telemetri telah dibersihkan
      assert.strictEqual(controller.getStrategyTelemetry('strat_to_remove'), null, 'Telemetri harus terhapus');
      assert.strictEqual(controller.getAllStrategyTelemetry().length, 0);

      controller.destroy();
    });
  });
});
