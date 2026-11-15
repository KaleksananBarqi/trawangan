/**
 * Unit & Integration Tests untuk PineRuntimeCoordinator (Ticket #219 / Spec #210)
 *
 * Menguji seam publik PineRuntimeCoordinator:
 * 1. Pengikatan cell tunggal (attachCell / disposeCell) yang menyatukan telemetri strategi,
 *    marker eksekusi on-chart, alert terdeduplikasi, dan runtime warning.
 * 2. Pembersihan terpadu saat indicator:removed dan market:changed.
 * 3. Resolusi dan caching inter-symbol fetchSeries untuk request.security().
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PineRuntimeCoordinator,
  type StrategyTelemetryPayload,
  type PineAlertRecord,
  type PineWarningRecord,
} from '../src/lib/services/pineRuntimeCoordinator';

function createMockCell(id = 'cell_1', symbol = 'BTCUSDT') {
  const listeners = new Map<string, Set<Function>>();
  let appliedConfig: any = {};
  const sceneIndicators = new Map<string, any>();

  const chart = {
    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
    },
    emit(event: string, payload?: any) {
      const fns = listeners.get(event);
      if (fns) {
        for (const fn of [...fns]) fn(payload);
      }
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
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
      scene: {
        indicators: sceneIndicators,
      },
      render() {},
    },
    requestRender() {},
  };

  return {
    id,
    symbol,
    chart,
    sceneIndicators,
  };
}

describe('PineRuntimeCoordinator (#219)', () => {
  test('script:run memperbarui marker strategi sekaligus mengirim alert & warning terdeduplikasi ke AlertService', async () => {
    const dispatchedAlerts: any[] = [];
    const mockAlertService = {
      dispatchPineAlert(params: any) {
        dispatchedAlerts.push(params);
        return params;
      },
      isSystemNotificationEnabled() {
        return false;
      },
    };

    const telemetryEvents: StrategyTelemetryPayload[] = [];
    const alertEvents: PineAlertRecord[] = [];
    const warningEvents: PineWarningRecord[] = [];

    const coordinator = new PineRuntimeCoordinator({
      alertService: mockAlertService as any,
      onTelemetry: (p) => telemetryEvents.push(p),
      onAlert: (a) => alertEvents.push(a),
      onWarning: (w) => warningEvents.push(w),
    });

    const cell = createMockCell('cell_alpha', 'BTCUSDT');
    cell.sceneIndicators.set('strat_1', { id: 'strat_1', trades: [] });

    coordinator.attachCell(cell);

    const runPayload = {
      id: 'strat_1',
      title: 'Unified Strategy',
      kind: 'strategy',
      strategy: {
        position: 1,
        avgPrice: 50000,
        equity: 10500,
        openPnl: 200,
        netPnl: 300,
        grossProfit: 500,
        grossLoss: 200,
        wins: 2,
        losses: 1,
        even: 0,
        maxDrawdown: 100,
        maxRunup: 400,
        initialCapital: 10000,
      },
      trades: async () => [
        {
          id: 'tr_1',
          side: 'long',
          qty: 1,
          entry: { id: 'Long_1', time: 1700000000000, price: 50000, comment: 'Buy' },
          open: true,
        },
      ],
      alerts: [
        {
          indicatorId: 'strat_1',
          title: 'Unified Strategy',
          message: 'Buy Signal Triggered',
          barIndex: 42,
          time: 1700000000000,
          freq: 'once_per_bar',
        },
      ],
      warnings: [
        {
          indicatorId: 'strat_1',
          indicator: 'Unified Strategy',
          message: 'Division by zero guarded',
          bar: 42,
        },
      ],
    };

    // Emit pertama
    cell.chart.emit('script:run', runPayload);
    await new Promise((r) => setTimeout(r, 15));

    assert.strictEqual(telemetryEvents.length, 1);
    assert.strictEqual(telemetryEvents[0].indicatorId, 'strat_1');
    assert.strictEqual(cell.sceneIndicators.get('strat_1').trades.length, 1);
    assert.strictEqual(cell.chart.getAppliedConfig().trades?.visible, true);

    assert.strictEqual(dispatchedAlerts.length, 1);
    assert.strictEqual(dispatchedAlerts[0].message, 'Buy Signal Triggered');
    assert.strictEqual(dispatchedAlerts[0].symbol, 'BTCUSDT');
    assert.strictEqual(alertEvents.length, 1);
    assert.strictEqual(warningEvents.length, 1);

    // Emit ulang pada bar yang sama: alert harus terdeduplikasi, tidak dikirim ulang
    cell.chart.emit('script:run', runPayload);
    await new Promise((r) => setTimeout(r, 15));

    assert.strictEqual(dispatchedAlerts.length, 1, 'Alert pada bar yang sama harus terdeduplikasi');
    assert.strictEqual(alertEvents.length, 1);

    coordinator.dispose();
  });

  test('indicator:removed membersihkan telemetri, trade markers, dan state deduplikasi alert dalam satu langkah', async () => {
    const dispatchedAlerts: any[] = [];
    const mockAlertService = {
      dispatchPineAlert(params: any) {
        dispatchedAlerts.push(params);
        return params;
      },
      isSystemNotificationEnabled() {
        return false;
      },
    };

    const coordinator = new PineRuntimeCoordinator({
      alertService: mockAlertService as any,
    });

    const cell = createMockCell('cell_rm', 'ETHUSDT');
    cell.sceneIndicators.set('strat_rm', { id: 'strat_rm', trades: [] });
    coordinator.attachCell(cell);

    const runPayload = {
      id: 'strat_rm',
      title: 'Removable Strategy',
      kind: 'strategy',
      strategy: { netPnl: 150, initialCapital: 1000 },
      trades: async () => [
        { id: 't1', side: 'long', qty: 1, entry: { id: 'E1', time: 1000, price: 2000 }, open: true },
      ],
      alerts: [
        { indicatorId: 'strat_rm', message: 'Entry Alert', barIndex: 10 },
      ],
    };

    cell.chart.emit('script:run', runPayload);
    await new Promise((r) => setTimeout(r, 15));

    assert.ok(coordinator.telemetry.getTelemetry('strat_rm'));
    assert.strictEqual(cell.sceneIndicators.get('strat_rm').trades.length, 1);
    assert.strictEqual(dispatchedAlerts.length, 1);

    // Hapus indikator
    cell.chart.emit('indicator:removed', { id: 'strat_rm' });

    assert.strictEqual(coordinator.telemetry.getTelemetry('strat_rm'), null);
    assert.strictEqual(cell.sceneIndicators.get('strat_rm').trades.length, 0);
    assert.strictEqual(coordinator.alertBridge.getAlertHistory().length, 0);

    // Jalankan lagi pada bar yang sama setelah dihapus -> dedupe sudah bersih sehingga alert boleh terkirim lagi
    cell.chart.emit('script:run', runPayload);
    await new Promise((r) => setTimeout(r, 15));
    assert.strictEqual(dispatchedAlerts.length, 2);

    coordinator.dispose();
  });

  test('market:changed membersihkan telemetri, marker, deduplikasi sel, dan memperbarui simbol sel', async () => {
    const dispatchedAlerts: any[] = [];
    const mockAlertService = {
      dispatchPineAlert(params: any) {
        dispatchedAlerts.push(params);
        return params;
      },
      isSystemNotificationEnabled() {
        return false;
      },
    };

    const coordinator = new PineRuntimeCoordinator({
      alertService: mockAlertService as any,
    });

    const cell = createMockCell('cell_mkt', 'BTCUSDT');
    cell.sceneIndicators.set('strat_mkt', { id: 'strat_mkt', trades: [] });
    coordinator.attachCell(cell);

    cell.chart.emit('script:run', {
      id: 'strat_mkt',
      title: 'Market Strategy',
      kind: 'strategy',
      strategy: { netPnl: 250, initialCapital: 1000 },
      trades: async () => [
        { id: 't1', side: 'long', qty: 1, entry: { id: 'E1', time: 1000, price: 60000 }, open: true },
      ],
      alerts: [{ indicatorId: 'strat_mkt', message: 'Cross', barIndex: 5 }],
    });
    await new Promise((r) => setTimeout(r, 15));

    assert.strictEqual(dispatchedAlerts[0].symbol, 'BTCUSDT');
    assert.strictEqual(cell.sceneIndicators.get('strat_mkt').trades.length, 1);

    // Ubah simbol sel dan emit market:changed
    cell.symbol = 'SOLUSDT';
    cell.chart.emit('market:changed');

    assert.strictEqual(coordinator.telemetry.getTelemetry('strat_mkt'), null);
    assert.strictEqual(cell.sceneIndicators.get('strat_mkt').trades.length, 0);

    // Emit alert dengan barIndex sama di simbol baru -> tidak terblokir dedupe lama dan memakai simbol SOLUSDT
    cell.chart.emit('alert', { indicatorId: 'strat_mkt', message: 'Cross', barIndex: 5 });
    assert.strictEqual(dispatchedAlerts.length, 2);
    assert.strictEqual(dispatchedAlerts[1].symbol, 'SOLUSDT');

    coordinator.dispose();
  });

  test('fetchSeries menyelesaikan dan meng-cache bar simbol/timeframe sekunder', async () => {
    let networkCalls = 0;
    const coordinator = new PineRuntimeCoordinator({
      fetchSeriesOptions: {
        sqliteLoader: async () => [],
        sqliteSaver: async () => {},
        networkFetcher: async (symbol, interval) => {
          networkCalls++;
          return [
            { time: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
            { time: 2000, open: 11, high: 13, low: 10, close: 12, volume: 150 },
          ];
        },
      },
    });

    const fetchSeries = coordinator.getFetchSeriesAdapter();
    const bars1 = await fetchSeries('BINANCE:ETHUSDT', '60');
    const bars2 = await fetchSeries('BINANCE:ETHUSDT', '60');

    assert.strictEqual(bars1.length, 2);
    assert.strictEqual(bars1[0].close, 11);
    assert.strictEqual(bars2.length, 2);
    assert.strictEqual(networkCalls, 1, 'Pemanggilan kedua harus dilayani dari cache memori');

    const engine = coordinator.createWorkerEngine();
    assert.ok(engine);
    engine.terminate?.();
    coordinator.dispose();
  });

  test('clearAll() membersihkan telemetri, riwayat alert/warning, deduplikasi, dan marker scene tanpa melepas sel', async () => {
    const dispatchedAlerts: any[] = [];
    const mockAlertService = {
      dispatchPineAlert(params: any) {
        dispatchedAlerts.push(params);
        return params;
      },
      isSystemNotificationEnabled() {
        return false;
      },
    };

    const coordinator = new PineRuntimeCoordinator({
      alertService: mockAlertService as any,
    });

    const cell = createMockCell('cell_clear', 'BTCUSDT');
    cell.sceneIndicators.set('strat_clear', { id: 'strat_clear', trades: [] });
    coordinator.attachCell(cell);

    cell.chart.emit('script:run', {
      id: 'strat_clear',
      title: 'Clear Strategy',
      kind: 'strategy',
      strategy: { netPnl: 100, initialCapital: 1000 },
      trades: async () => [
        { id: 't1', side: 'long', qty: 1, entry: { id: 'E1', time: 1000, price: 50000 }, open: true },
      ],
      alerts: [{ indicatorId: 'strat_clear', message: 'Signal', barIndex: 10 }],
      warnings: [{ indicatorId: 'strat_clear', message: 'Warn', time: 1000 }],
    });
    await new Promise((r) => setTimeout(r, 15));

    assert.ok(coordinator.telemetry.getTelemetry('strat_clear'));
    assert.strictEqual(coordinator.alertBridge.getAlertHistory().length, 1);
    assert.strictEqual(coordinator.alertBridge.getWarningHistory().length, 1);
    assert.strictEqual(cell.sceneIndicators.get('strat_clear').trades.length, 1);

    coordinator.clearAll();

    assert.strictEqual(coordinator.telemetry.getTelemetry('strat_clear'), null);
    assert.strictEqual(coordinator.alertBridge.getAlertHistory().length, 0);
    assert.strictEqual(coordinator.alertBridge.getWarningHistory().length, 0);
    assert.strictEqual(cell.sceneIndicators.get('strat_clear').trades.length, 0);

    // Sel masih terikat sehingga alert dengan barIndex sama dapat dipancarkan ulang setelah clearAll
    cell.chart.emit('alert', { indicatorId: 'strat_clear', message: 'Signal', barIndex: 10 });
    assert.strictEqual(dispatchedAlerts.length, 2);

    coordinator.dispose();
  });
});
