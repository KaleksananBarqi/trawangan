/**
 * Unit & Integration Tests untuk Worker-Isolated Strategy Backtest (Ticket #220 / Spec #210)
 *
 * Menguji dua seam utama:
 * 1. Ekstraktor telemetri kanonikal (`extractStrategyTelemetryPayload` & `telemetryToPerformanceSummary`)
 * 2. Pipeline backtest terisolasi (`runPineStrategyBacktest`) via `ScriptingEngine` / headless Node adapter
 *    serta paritas metriknya terhadap telemetri live `PineRuntimeCoordinator`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PineRuntimeCoordinator,
  extractStrategyTelemetryPayload,
  telemetryToPerformanceSummary,
} from '../src/lib/services/pineRuntimeCoordinator';
import { PineEngine } from '@luxalgo/vela-pinets';
import type { ScriptingEngine } from '@luxalgo/vela/plugin';
import { runPineStrategyBacktest } from '../src/lib/services/strategyEngine';
import type { Candle } from '../src/lib/types/market';

const SAMPLE_CANDLES: Candle[] = [
  { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
  { time: 2000, open: 102, high: 110, low: 100, close: 108, volume: 12 },
  { time: 3000, open: 108, high: 115, low: 105, close: 112, volume: 15 },
  { time: 4000, open: 112, high: 114, low: 98, close: 100, volume: 20 },
  { time: 5000, open: 100, high: 102, low: 90, close: 92, volume: 18 },
];

const SAMPLE_STRATEGY = `//@version=6
strategy("Test Strat", overlay=true, initial_capital=10000)
if bar_index == 1
    strategy.entry("Long", strategy.long)
if bar_index == 3
    strategy.close("Long")
`;

test('telemetryToPerformanceSummary menghitung metrik StrategyBacktestReport dan equityCurve dari payload kanonikal', () => {
  const context = {
    strategy: {
      initialCapital: 10000,
      netPnl: 150,
      grossProfit: 250,
      grossLoss: 100,
      equity: 10150,
      openPnl: 0,
      position: 0,
      avgPrice: 0,
      wins: 1,
      losses: 1,
      even: 0,
      maxDrawdown: 100,
      maxRunup: 250,
    },
    trades: [
      {
        id: 'trade_1',
        side: 'long',
        qty: 2,
        entry: { id: 'Long1', time: 1000, price: 100, comment: 'Buy 1' },
        exit: { id: 'Exit1', time: 2000, price: 225, comment: 'TP1' },
        open: false,
        pnl: 250,
        maxDrawdown: 10,
        maxRunup: 250,
      },
      {
        id: 'trade_2',
        side: 'short',
        qty: 1,
        entry: { id: 'Short1', time: 3000, price: 200, comment: 'Sell 1' },
        exit: { id: 'Exit2', time: 4000, price: 300, comment: 'SL1' },
        open: false,
        pnl: -100,
        maxDrawdown: 100,
        maxRunup: 5,
      },
    ],
  };

  const payload = extractStrategyTelemetryPayload('strat-1', context, 'Alpha Strat');
  assert.ok(payload, 'Payload telemetri tidak boleh null');

  const report = telemetryToPerformanceSummary(payload);

  assert.equal(report.strategyTitle, 'Alpha Strat');
  assert.equal(report.initialCapital, 10000);
  assert.equal(report.netProfit, 150);
  assert.equal(report.netProfitPercent, 1.5);
  assert.equal(report.grossProfit, 250);
  assert.equal(report.grossLoss, 100);
  assert.equal(report.profitFactor, 2.5);
  assert.equal(report.winRate, 50);
  assert.equal(report.totalTrades, 2);
  assert.equal(report.winningTrades, 1);
  assert.equal(report.losingTrades, 1);
  assert.equal(report.evenTrades, 0);
  assert.equal(report.maxDrawdown, 100);
  assert.equal(report.maxDrawdownPercent, 1);
  assert.equal(report.equity, 10150);
  assert.equal(report.openTrades, 0);
  assert.equal(report.currentPosition.direction, 'flat');
  assert.equal(report.trades.length, 2);
  assert.equal(report.trades[0].profit, 250);
  assert.equal(report.trades[1].profit, -100);

  // Verifikasi kurva ekuitas: modal awal -> +250 -> -100
  assert.deepEqual(report.equityCurve, [
    { time: 1000, equity: 10000 },
    { time: 2000, equity: 10250 },
    { time: 4000, equity: 10150 },
  ]);
});

test('runPineStrategyBacktest mendelegasikan eksekusi ke worker engine saat Worker tersedia dan membersihkan sesi', async () => {
  let prepareCalls = 0;
  let executeCalls = 0;
  let stopCalls = 0;
  let terminateCalls = 0;

  const fakeEngine: ScriptingEngine & { terminate: () => void } = {
    language: 'pine',
    capabilities: { streaming: true, visibleRange: false, inputs: true, props: true },
    async prepare(source, instanceId) {
      prepareCalls++;
      return {
        language: 'pine',
        inputs: [],
        meta: { title: 'Worker Strat', overlay: true },
        reactsToViewport: false,
        token: { source, instanceId },
      };
    },
    execute(req, handlers) {
      executeCalls++;
      assert.equal(req.mode, 'static');
      queueMicrotask(() => {
        handlers.onModel({} as any);
        handlers.onDone?.();
      });
      return {
        async getContext() {
          return {
            language: 'pine',
            phase: 'idle',
            barIndex: 4,
            meta: { title: 'Worker Strat', overlay: true },
            plots: {},
            variables: {},
            strategy: {
              initialCapital: 5000,
              netPnl: 120,
              grossProfit: 120,
              grossLoss: 0,
              equity: 5120,
              openPnl: 0,
              position: 0,
              avgPrice: 0,
              wins: 1,
              losses: 0,
              even: 0,
              maxDrawdown: 15,
              maxRunup: 120,
            },
            trades: [
              {
                id: 'w1',
                side: 'long',
                qty: 1,
                entry: { id: 'L', time: 1000, price: 100 },
                exit: { id: 'X', time: 2000, price: 220 },
                open: false,
                pnl: 120,
              },
            ],
            warnings: [],
          };
        },
        stop() {
          stopCalls++;
        },
        update() {},
        setVisibleRange() {},
        notifyBars() {},
      };
    },
    terminate() {
      terminateCalls++;
    },
  };

  const coordinator = new PineRuntimeCoordinator();
  // Override createWorkerEngine untuk memverifikasi jalur worker tanpa DOM Web Worker nyata
  coordinator.createWorkerEngine = () => fakeEngine as any;

  const originalWorker = (globalThis as any).Worker;
  (globalThis as any).Worker = function FakeWorker() {};
  try {
    const res = await runPineStrategyBacktest(SAMPLE_STRATEGY, SAMPLE_CANDLES, {
      symbol: 'ETHUSDT',
      timeframe: '4h',
      coordinator,
    });

    assert.equal(res.success, true);
    assert.equal(res.isStrategy, true);
    assert.equal(res.summary?.netProfit, 120);
    assert.equal(res.summary?.profitFactor, 999);
    assert.equal(prepareCalls, 1);
    assert.equal(executeCalls, 1);
    assert.equal(stopCalls, 1);
    assert.equal(terminateCalls, 1);
  } finally {
    if (originalWorker === undefined) {
      delete (globalThis as any).Worker;
    } else {
      (globalThis as any).Worker = originalWorker;
    }
  }
});

test('metrik runPineStrategyBacktest identik dengan telemetri live PineRuntimeCoordinator untuk candle yang sama', async () => {
  const backtestRes = await runPineStrategyBacktest(SAMPLE_STRATEGY, SAMPLE_CANDLES, {
    symbol: 'BTCUSDT',
    timeframe: '1h',
  });
  assert.equal(backtestRes.success, true);
  assert.ok(backtestRes.summary);

  // Simulasikan eksekusi live chart via PineEngine + PineRuntimeCoordinator.syncStrategyFromContext
  const engine = new PineEngine();
  const prepared = await engine.prepare(SAMPLE_STRATEGY, 'live-strat');
  const bars = SAMPLE_CANDLES.map((c) => ({ ...c, volume: c.volume ?? 0 }));
  const liveCtx = await new Promise<any>((resolve, reject) => {
    const session = engine.execute(
      { prepared, market: { symbol: 'BTCUSDT', timeframe: '1h' }, bars, mode: 'static' },
      {
        onModel: () => {},
        onError: reject,
        onDone: async () => {
          const ctx = await session.getContext?.(['strategy', 'trades']);
          session.stop();
          resolve(ctx);
        },
      }
    );
  });

  const coordinator = new PineRuntimeCoordinator();
  const livePayload = coordinator.syncStrategyFromContext(
    'live-strat',
    liveCtx,
    prepared.meta.title
  );
  assert.ok(livePayload);

  const liveReport = telemetryToPerformanceSummary(livePayload);
  assert.deepEqual(backtestRes.summary, liveReport);
});

test('runPineStrategyBacktest menolak skrip indicator() non-strategi dan input kosong secara bersih', async () => {
  const indCode = `//@version=6
indicator("Plain EMA", overlay=true)
plot(close)
`;
  const indRes = await runPineStrategyBacktest(indCode, SAMPLE_CANDLES);
  assert.equal(indRes.success, true);
  assert.equal(indRes.isStrategy, false);
  assert.ok(indRes.error?.includes('indicator()'));

  const emptyCodeRes = await runPineStrategyBacktest('   ', SAMPLE_CANDLES);
  assert.equal(emptyCodeRes.success, false);
  assert.equal(emptyCodeRes.isStrategy, false);

  const emptyCandlesRes = await runPineStrategyBacktest(SAMPLE_STRATEGY, []);
  assert.equal(emptyCandlesRes.success, false);
  assert.equal(emptyCandlesRes.isStrategy, false);
});

test('runPineStrategyBacktest mengeksekusi strategi via pipeline ScriptingEngine dan menghasilkan equityCurve', async () => {
  const res = await runPineStrategyBacktest(SAMPLE_STRATEGY, SAMPLE_CANDLES, {
    symbol: 'BTCUSDT',
    timeframe: '1h',
  });

  assert.equal(res.success, true);
  assert.equal(res.isStrategy, true);
  assert.equal(res.scriptTitle, 'Test Strat');
  assert.ok(res.summary, 'Summary backtest harus tersedia');
  assert.equal(res.summary.initialCapital, 10000);
  assert.equal(res.summary.netProfit, -8);
  assert.equal(res.summary.totalTrades, 1);
  assert.equal(res.summary.losingTrades, 1);
  assert.equal(res.summary.trades.length, 1);
  assert.ok(Array.isArray(res.summary.equityCurve), 'equityCurve harus berupa array');
  assert.deepEqual(res.summary.equityCurve, [
    { time: 3000, equity: 10000 },
    { time: 5000, equity: 9992 },
  ]);
});
