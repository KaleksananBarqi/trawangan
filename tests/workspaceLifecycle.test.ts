import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWorkspaceFingerprint,
  type WorkspaceFingerprintInput,
} from '../src/lib/services/persistence/workspaceService';
import {
  executeWorkspaceLoadPipeline,
  WorkspaceAutoSaveCoordinator,
  type WorkspaceChartPort,
  type WorkspacePlanPort,
  type WorkspaceShellPort,
} from '../src/lib/services/workspaceLifecycle';

describe('Workspace Lifecycle & Auto-Save Guard Engine Suite (Candidate #4)', () => {
  describe('1. Comprehensive Workspace Fingerprint Engine', () => {
    const baseInput: WorkspaceFingerprintInput = {
      id: 'ws-1',
      name: 'Scalping Layout',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'binance',
      indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
      paneWeights: [2, 1],
      priceScaleState: { mode: 'normal', auto: true },
      priceStyle: 'candles',
      barSpacing: 8,
      showVolume: true,
      activeRightDockPanel: 'watchlist',
      syncConfig: { crosshair: true, timeframe: false, interval: false },
      activePlans: [{ id: 'plan-1', symbol: 'BTCUSDT', side: 'long', entryPrice: 65000, stopLoss: 64000, takeProfits: [{ id: 'tp-1', price: 68000, percent: 100 }], active: true }],
      showThesisCards: true,
    };

    test('menghasilkan fingerprint identik untuk data input bernilai sama', () => {
      const fp1 = computeWorkspaceFingerprint(baseInput);
      const fp2 = computeWorkspaceFingerprint({ ...baseInput });
      assert.strictEqual(fp1, fp2);
    });

    test('mendeteksi perubahan pada paneWeights', () => {
      const fpBase = computeWorkspaceFingerprint(baseInput);
      const fpChanged = computeWorkspaceFingerprint({ ...baseInput, paneWeights: [3, 1] });
      assert.notStrictEqual(fpBase, fpChanged);
    });

    test('mendeteksi perubahan pada priceScaleState', () => {
      const fpBase = computeWorkspaceFingerprint(baseInput);
      const fpChanged = computeWorkspaceFingerprint({
        ...baseInput,
        priceScaleState: { mode: 'log', auto: false },
      });
      assert.notStrictEqual(fpBase, fpChanged);
    });

    test('mendeteksi perubahan pada visual chart (priceStyle & barSpacing)', () => {
      const fpBase = computeWorkspaceFingerprint(baseInput);
      const fpDiffStyle = computeWorkspaceFingerprint({ ...baseInput, priceStyle: 'heikinashi' });
      const fpDiffZoom = computeWorkspaceFingerprint({ ...baseInput, barSpacing: 14 });
      assert.notStrictEqual(fpBase, fpDiffStyle);
      assert.notStrictEqual(fpBase, fpDiffZoom);
    });

    test('mendeteksi penambahan, perubahan, atau penghapusan Multi-Target Trading Plans', () => {
      const fpBase = computeWorkspaceFingerprint(baseInput);
      const fpNewPlan = computeWorkspaceFingerprint({
        ...baseInput,
        activePlans: [
          ...baseInput.activePlans!,
          { id: 'plan-2', symbol: 'ETHUSDT', side: 'short', entryPrice: 3500, stopLoss: 3600, takeProfits: [], active: true },
        ],
      });
      const fpNoPlans = computeWorkspaceFingerprint({ ...baseInput, activePlans: [] });
      assert.notStrictEqual(fpBase, fpNewPlan);
      assert.notStrictEqual(fpBase, fpNoPlans);
    });

    test('mendeteksi perubahan visibilitas kartu tesis (showThesisCards)', () => {
      const fpBase = computeWorkspaceFingerprint(baseInput);
      const fpThesisOff = computeWorkspaceFingerprint({ ...baseInput, showThesisCards: false });
      assert.notStrictEqual(fpBase, fpThesisOff);
    });

    test('mempertahankan kompatibilitas penuh dengan pemanggilan legacy 6 argumen posisi', () => {
      const fpLegacy1 = computeWorkspaceFingerprint(
        'ws-1',
        'BTCUSDT',
        '15m',
        '1',
        'binance',
        [{ title: 'RSI', source: 'plot(rsi)', visible: true }]
      );
      const fpLegacy2 = computeWorkspaceFingerprint(
        'ws-1',
        'BTCUSDT',
        '15m',
        '1',
        'binance',
        [{ title: 'RSI', source: 'plot(rsi)', visible: true }]
      );
      assert.strictEqual(fpLegacy1, fpLegacy2);
      assert.ok(fpLegacy1.includes('ws-1:BTCUSDT:15m:1:binance#[RSI:plot(rsi):true::]'));
    });
  });

  describe('2. WorkspaceAutoSaveCoordinator', () => {
    test('mengabaikan penyimpanan berulang jika fingerprint identik dengan yang sudah tersimpan', async () => {
      let saveCount = 0;
      const coordinator = new WorkspaceAutoSaveCoordinator({
        debounceMs: 20,
        onSave: async () => {
          saveCount++;
        },
      });

      const input: WorkspaceFingerprintInput = {
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
      };

      const fp = coordinator.trigger(input);
      assert.ok(fp);
      coordinator.setSavedFingerprint(fp);

      const triggerAgain = coordinator.trigger(input);
      assert.strictEqual(triggerAgain, null, 'Pemicu kedua dengan fingerprint sama harus diabaikan');
      coordinator.cancel();
    });

    test('mengeksekusi penyimpanan setelah waktu debounce terpenuhi', async () => {
      let savedData: WorkspaceFingerprintInput | null = null;
      const coordinator = new WorkspaceAutoSaveCoordinator({
        debounceMs: 30,
        onSave: async (data) => {
          savedData = data;
        },
      });

      const input: WorkspaceFingerprintInput = {
        symbol: 'SOLUSDT',
        timeframe: '1h',
        layout: '2',
      };

      coordinator.trigger(input);
      assert.strictEqual(savedData, null, 'Belum boleh tersimpan sebelum waktu debounce');

      await new Promise((r) => setTimeout(r, 60));
      assert.ok(savedData);
      assert.strictEqual((savedData as WorkspaceFingerprintInput).symbol, 'SOLUSDT');
    });

    test('cancel() membatalkan timer debounce yang sedang berjalan', async () => {
      let saved = false;
      const coordinator = new WorkspaceAutoSaveCoordinator({
        debounceMs: 30,
        onSave: async () => {
          saved = true;
        },
      });

      coordinator.trigger({ symbol: 'BTCUSDT', timeframe: '15m', layout: '1' });
      coordinator.cancel();

      await new Promise((r) => setTimeout(r, 50));
      assert.strictEqual(saved, false, 'Simpan tidak boleh berjalan jika di-cancel');
    });
  });

  describe('3. executeWorkspaceLoadPipeline', () => {
    test('menjalankan pipeline restorasi lengkap secara deterministik', async () => {
      const indicatorCallHistory: string[] = [];
      const appliedScales: any[] = [];
      let restoredPlans: any[] = [];
      let restoredThesisCards = false;

      const mockChart: WorkspaceChartPort = {
        clearAllIndicators: () => {
          indicatorCallHistory.push('clearAll');
        },
        addPineIndicator: async (source, title) => {
          indicatorCallHistory.push(`add:${title}`);
        },
        getActiveIndicators: () => [{ title: 'MACD', source: 'plot(macd)', visible: true }],
        toggleIndicatorVisibility: () => {},
        setPriceStyle: (style) => appliedScales.push(`style:${style}`),
        setBarSpacing: (bs) => appliedScales.push(`bs:${bs}`),
        applyPriceScaleState: (st) => appliedScales.push(`scale:${st.mode}`),
        applyPaneWeights: (pw) => appliedScales.push(`pane:${pw.join(',')}`),
      };

      const mockPlan: WorkspacePlanPort = {
        setWorkspaceId: () => {},
        clearAllPlans: () => {},
        restorePlans: (plans, showThesis) => {
          restoredPlans = plans;
          restoredThesisCards = showThesis ?? true;
        },
        getActivePlans: () => restoredPlans,
        isThesisCardsVisible: () => restoredThesisCards,
        flushDrawings: async () => {},
      };

      const mockShell: WorkspaceShellPort = {
        openRightDockTab: () => {},
        closeRightDock: () => {},
      };

      const changedEvents: string[] = [];

      const workspaceToLoad: any = {
        id: 'ws-test',
        name: 'Pro Trader Layout',
        symbol: 'SOLUSDT',
        timeframe: '4h',
        layout: '1',
        providerId: 'bitunix',
        indicators: [
          { title: 'MACD', source: 'plot(macd)', visible: true },
          { title: 'EMA 200', source: 'plot(ema)', visible: false },
        ],
        paneWeights: [2, 1],
        priceScaleState: { mode: 'log' },
        priceStyle: 'bars',
        barSpacing: 12,
        activePlans: [{ id: 'plan-xyz', symbol: 'SOLUSDT' }],
        showThesisCards: true,
      };

      const res = await executeWorkspaceLoadPipeline({
        workspace: workspaceToLoad,
        chart: mockChart,
        plan: mockPlan,
        shell: mockShell,
        activeProviderId: 'binance',
        onProviderChange: async (pId) => {
          changedEvents.push(`provider:${pId}`);
        },
        onSymbolChange: async (sym) => {
          changedEvents.push(`symbol:${sym}`);
        },
        onTimeframeChange: (tf) => changedEvents.push(`tf:${tf}`),
        onLayoutChange: (l) => changedEvents.push(`layout:${l}`),
        onSyncIndicators: () => changedEvents.push('syncIndicators'),
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.indicatorCount, 2);
      assert.ok(res.fingerprint.length > 0);

      // Verifikasi urutan eksekusi: double barrier clean-slate
      assert.strictEqual(indicatorCallHistory[0], 'clearAll', 'Clean-slate tahap 1');
      assert.strictEqual(indicatorCallHistory[1], 'clearAll', 'Clean-slate tahap 2 (Double-barrier)');
      assert.ok(indicatorCallHistory.includes('add:MACD'));
      assert.ok(indicatorCallHistory.includes('add:EMA 200'));

      // Verifikasi event perubahan navigasi
      assert.ok(changedEvents.includes('provider:bitunix'));
      assert.ok(changedEvents.includes('symbol:SOLUSDT'));
      assert.ok(changedEvents.includes('tf:4h'));
      assert.ok(changedEvents.includes('syncIndicators'));

      // Verifikasi restorasi skala dan plan
      assert.ok(appliedScales.includes('style:bars'));
      assert.ok(appliedScales.includes('bs:12'));
      assert.ok(appliedScales.includes('scale:log'));
      assert.ok(appliedScales.includes('pane:2,1'));
      assert.strictEqual(restoredPlans.length, 1);
      assert.strictEqual(restoredPlans[0].id, 'plan-xyz');
      assert.strictEqual(restoredThesisCards, true);
    });
  });
});
