import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PineAlertBridge,
  type PineAlertPayload,
  type PineWarningPayload,
  type PineAlertRecord,
  type PineWarningRecord,
} from '../src/lib/services/pineAlertBridge';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

// Mock EventEmitter sederhana untuk mengemulasi Vela Chart
class MockVelaChart {
  public listeners: Record<string, ((payload: any) => void)[]> = {};

  public on(event: string, callback: (payload: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.off(event, callback);
    };
  }

  public off(event: string, callback: (payload: any) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  public emit(event: string, payload?: any): void {
    const list = this.listeners[event];
    if (list) {
      for (const cb of [...list]) {
        cb(payload);
      }
    }
  }
}

describe('Pine Script Alert & Warning Telemetry Bridge Suite (#202)', () => {
  let bridge: PineAlertBridge;
  let mockChart: MockVelaChart;
  let dispatchedDesktopNotifications: { title: string; body: string }[];
  let dispatchedPineAlerts: any[];

  beforeEach(() => {
    dispatchedDesktopNotifications = [];
    dispatchedPineAlerts = [];

    const mockAlertService: any = {
      isSoundEnabled: () => true,
      isSystemNotificationEnabled: () => true,
      dispatchPineAlert: (event: any) => {
        dispatchedPineAlerts.push(event);
        return {
          id: event.id,
          symbol: event.symbol,
          targetPrice: 0,
          condition: 'crossing',
          frequency: event.freq || 'once',
          label: event.message,
          active: false,
          triggered: true,
          createdAt: event.timestamp,
          triggeredAt: event.timestamp,
          planRole: 'pine_alert',
        };
      },
    };

    bridge = new PineAlertBridge({
      alertService: mockAlertService,
      desktopNotificationSender: async (opts) => {
        dispatchedDesktopNotifications.push(opts);
        return true;
      },
    });

    mockChart = new MockVelaChart();
  });

  describe('1. Telemetry Listener & Event Alert Capture', () => {
    test('menangkap event alert dari Pine Script worker engine melalui chart.on("alert")', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      const receivedAlerts: PineAlertRecord[] = [];
      bridge.onAlert((alert) => {
        receivedAlerts.push(alert);
      });

      const payload: PineAlertPayload = {
        id: 'alt_123',
        message: 'RSI melampaui level 70 (Overbought)',
        title: 'RSI Alert',
        indicator: 'RSI Divergence Pro',
        indicatorId: 'ind_rsi_1',
        time: 1731550000000,
        barIndex: 142,
        freq: 'once',
      };

      mockChart.emit('alert', payload);

      const receivedAlert = receivedAlerts[0];
      assert.ok(receivedAlert, 'Alert harus diterima oleh subscriber bridge');
      assert.strictEqual(receivedAlert.id, 'alt_123');
      assert.strictEqual(receivedAlert.indicatorTitle, 'RSI Alert');
      assert.strictEqual(receivedAlert.symbol, 'BTCUSDT');
      assert.strictEqual(receivedAlert.message, 'RSI melampaui level 70 (Overbought)');
      assert.strictEqual(receivedAlert.barIndex, 142);
      assert.strictEqual(receivedAlert.timestamp, 1731550000000);
    });

    test('melakukan fallback cerdas jika id, title, atau timestamp tidak disediakan dalam payload', () => {
      bridge.attach(mockChart, { symbol: 'ETHUSDT' });

      const receivedAlerts: PineAlertRecord[] = [];
      bridge.onAlert((alert) => {
        receivedAlerts.push(alert);
      });

      const payload: PineAlertPayload = {
        message: 'MA 20 Cross Under MA 50',
        indicator: 'Custom Moving Average',
      };

      const before = Date.now();
      mockChart.emit('alert', payload);
      const after = Date.now();

      const receivedAlert = receivedAlerts[0];
      assert.ok(receivedAlert);
      assert.ok(receivedAlert.id.startsWith('alt_pine_'), 'ID fallback harus diawali alt_pine_');
      assert.strictEqual(receivedAlert.indicatorTitle, 'Custom Moving Average');
      assert.strictEqual(receivedAlert.symbol, 'ETHUSDT');
      assert.strictEqual(receivedAlert.message, 'MA 20 Cross Under MA 50');
      assert.ok(receivedAlert.timestamp >= before && receivedAlert.timestamp <= after);
    });

    test('menyimpan riwayat alert di memori bridge dan dapat diakses via getAlertHistory()', () => {
      bridge.attach(mockChart, { symbol: 'SOLUSDT' });

      mockChart.emit('alert', { message: 'Alert 1', title: 'Script A', time: 1000 });
      mockChart.emit('alert', { message: 'Alert 2', title: 'Script B', time: 2000 });

      const history = bridge.getAlertHistory();
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].message, 'Alert 1');
      assert.strictEqual(history[1].message, 'Alert 2');
    });
  });

  describe('2. Telemetry Listener & Event Warning Capture', () => {
    test('menangkap runtime script warning melalui chart.on("warning") dan memformat pesan untuk konsol Pine', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      const receivedWarnings: PineWarningRecord[] = [];
      bridge.onWarning((warning) => {
        receivedWarnings.push(warning);
      });

      const payload: PineWarningPayload = {
        message: 'Penyebut nol pada pembagian (division by zero)',
        method: 'ta.rsi',
        bar: 88,
        indicator: 'My Volatility Oscillator',
        indicatorId: 'ind_vol_1',
      };

      mockChart.emit('warning', payload);

      const receivedWarning = receivedWarnings[0];
      assert.ok(receivedWarning, 'Warning harus diterima oleh subscriber bridge');
      assert.strictEqual(receivedWarning.message, 'Penyebut nol pada pembagian (division by zero)');
      assert.strictEqual(receivedWarning.method, 'ta.rsi');
      assert.strictEqual(receivedWarning.bar, 88);
      assert.strictEqual(receivedWarning.indicatorTitle, 'My Volatility Oscillator');
      assert.strictEqual(receivedWarning.symbol, 'BTCUSDT');

      const formatted = bridge.formatWarningMessage(receivedWarning);
      assert.ok(formatted.includes('My Volatility Oscillator'));
      assert.ok(formatted.includes('ta.rsi()'));
      assert.ok(formatted.includes('bar 88'));
    });

    test('menyimpan riwayat runtime warnings di memori bridge', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      mockChart.emit('warning', { message: 'Array index out of bounds: index 10 size 5', bar: 24 });

      const warnings = bridge.getWarningHistory();
      assert.strictEqual(warnings.length, 1);
      assert.strictEqual(warnings[0].bar, 24);
      assert.ok(warnings[0].message.includes('Array index out of bounds'));
    });
  });

  describe('3. In-App Toast & Desktop Push Notification Dispatch', () => {
    test('meneruskan alert ke alertService.dispatchPineAlert untuk in-app toast notification', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      mockChart.emit('alert', {
        id: 'alt_pine_99',
        title: 'SuperTrend Buy Signal',
        message: 'Buy triggered on bar close',
        indicator: 'SuperTrend ATR',
        time: 1731551000000,
      });

      assert.strictEqual(dispatchedPineAlerts.length, 1);
      assert.strictEqual(dispatchedPineAlerts[0].symbol, 'BTCUSDT');
      assert.strictEqual(dispatchedPineAlerts[0].message, 'Buy triggered on bar close');
      assert.strictEqual(dispatchedPineAlerts[0].indicatorTitle, 'SuperTrend Buy Signal');
    });

    test('mengirim notifikasi push desktop native jika izin dan pengaturan sistem aktif', async () => {
      bridge.attach(mockChart, { symbol: 'ETHUSDT' });

      mockChart.emit('alert', {
        title: 'Breakout Alert',
        message: 'Resistance level 3500 broken',
        indicator: 'Channel Breakout',
      });

      // Berikan waktu microtask untuk asynchronous dispatch
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(dispatchedDesktopNotifications.length, 1);
      assert.ok(dispatchedDesktopNotifications[0].title.includes('ETHUSDT'));
      assert.ok(dispatchedDesktopNotifications[0].title.includes('Breakout Alert'));
      assert.strictEqual(dispatchedDesktopNotifications[0].body, 'Resistance level 3500 broken');
    });

    test('tidak mengirim notifikasi desktop jika systemNotificationEnabled bernilai false', async () => {
      const mockDisabledService: any = {
        isSoundEnabled: () => true,
        isSystemNotificationEnabled: () => false,
        dispatchPineAlert: () => {},
      };

      const customBridge = new PineAlertBridge({
        alertService: mockDisabledService,
        desktopNotificationSender: async (opts) => {
          dispatchedDesktopNotifications.push(opts);
          return true;
        },
      });

      customBridge.attach(mockChart, { symbol: 'ETHUSDT' });

      mockChart.emit('alert', {
        title: 'Silent Alert',
        message: 'Should not push to OS',
      });

      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(dispatchedDesktopNotifications.length, 0);
    });
  });

  describe('4. Lifecycle Attachment, Detachment & Indicator Cleanup', () => {
    test('detach() melepas listener dari chart sehingga event tidak lagi diproses', () => {
      const unsub = bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      let count = 0;
      bridge.onAlert(() => count++);

      mockChart.emit('alert', { message: 'Alert Sebelum Detach' });
      assert.strictEqual(count, 1);

      // Lepas listener via unsub atau bridge.detach()
      unsub();

      mockChart.emit('alert', { message: 'Alert Sesudah Detach' });
      assert.strictEqual(count, 1, 'Event sesudah detach tidak boleh diproses');
    });

    test('handleIndicatorRemoved(id) membersihkan riwayat telemetri indikator tanpa memory leak', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      mockChart.emit('alert', {
        id: 'alt_a',
        indicatorId: 'ind_alpha',
        title: 'Alpha',
        message: 'A',
      });
      mockChart.emit('alert', {
        id: 'alt_b',
        indicatorId: 'ind_beta',
        title: 'Beta',
        message: 'B',
      });
      mockChart.emit('warning', {
        indicatorId: 'ind_alpha',
        message: 'Warning Alpha',
        bar: 1,
      });

      assert.strictEqual(bridge.getAlertHistory().length, 2);
      assert.strictEqual(bridge.getWarningHistory().length, 1);

      // Hapus indikator ind_alpha
      bridge.handleIndicatorRemoved('ind_alpha');

      const remainingAlerts = bridge.getAlertHistory();
      const remainingWarnings = bridge.getWarningHistory();

      assert.strictEqual(remainingAlerts.length, 1);
      assert.strictEqual(remainingAlerts[0].indicatorId, 'ind_beta');
      assert.strictEqual(remainingWarnings.length, 0);
    });

    test('clearHistory() membersihkan seluruh riwayat alert dan warning', () => {
      bridge.attach(mockChart, { symbol: 'BTCUSDT' });

      mockChart.emit('alert', { message: 'A1' });
      mockChart.emit('warning', { message: 'W1', bar: 2 });

      bridge.clearHistory();

      assert.strictEqual(bridge.getAlertHistory().length, 0);
      assert.strictEqual(bridge.getWarningHistory().length, 0);
    });
  });

  describe('5. Integrasi Lifecycle ChartSessionController', () => {
    test('attachCellListeners mengaitkan bridge, memperbarui simbol saat market:changed, membersihkan saat indicator:removed, dan melepas saat destroy()', () => {
      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        pineAlertBridge: bridge,
      });

      const mockCell: any = {
        id: 'cell_1',
        symbol: 'BTCUSDT',
        chart: mockChart,
      };

      controller.attachCellListeners(mockCell);

      // 1. Event alert & warning tertangkap dengan simbol awal
      mockChart.emit('alert', {
        id: 'alt_ctrl_1',
        indicatorId: 'ind_1',
        title: 'EMA Cross',
        message: 'Golden Cross',
      });
      mockChart.emit('warning', {
        indicatorId: 'ind_1',
        message: 'Division by zero',
        bar: 10,
      });

      assert.strictEqual(bridge.getAlertHistory().length, 1);
      assert.strictEqual(bridge.getAlertHistory()[0].symbol, 'BTCUSDT');
      assert.strictEqual(bridge.getWarningHistory().length, 1);

      // 2. Perubahan simbol sel via market:changed memperbarui konteks simbol
      mockCell.symbol = 'ETHUSDT';
      mockChart.emit('market:changed');
      mockChart.emit('alert', {
        id: 'alt_ctrl_2',
        indicatorId: 'ind_2',
        title: 'MACD',
        message: 'Bullish',
      });
      assert.strictEqual(bridge.getAlertHistory().length, 2);
      assert.strictEqual(bridge.getAlertHistory()[1].symbol, 'ETHUSDT');

      // 3. Penghapusan indikator membersihkan riwayat indikator terkait
      mockChart.emit('indicator:removed', { id: 'ind_1' });
      assert.strictEqual(bridge.getAlertHistory().length, 1);
      assert.strictEqual(bridge.getAlertHistory()[0].indicatorId, 'ind_2');
      assert.strictEqual(bridge.getWarningHistory().length, 0);

      // 4. destroy() melepas listener dari chart tanpa memory leak
      (controller as any).workspace = {
        cells: () => [mockCell],
        destroy: () => {},
      };
      controller.destroy();

      mockChart.emit('alert', {
        id: 'alt_after_destroy',
        message: 'Should be ignored',
      });
      assert.strictEqual(bridge.getAlertHistory().length, 1);
    });
  });
});
