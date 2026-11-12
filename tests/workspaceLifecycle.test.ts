import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWorkspaceFingerprint,
  type WorkspaceFingerprintInput,
} from '../src/lib/services/persistence/workspaceService';
import {
  buildWorkspaceSnapshotPayload,
  executeWorkspaceLoadPipeline,
  restoreWorkspaceChartAndPlans,
  WorkspaceAutoSaveCoordinator,
  type WorkspaceChartPort,
  type WorkspacePlanPort,
  type WorkspaceShellPort,
} from '../src/lib/services/workspaceLifecycle';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

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
        setPriceStyle: (style) => {
          appliedScales.push(`style:${style}`);
        },
        setBarSpacing: (bs) => {
          appliedScales.push(`bs:${bs}`);
        },
        applyPriceScaleState: (st) => {
          appliedScales.push(`scale:${st.mode}`);
        },
        applyPaneWeights: (pw) => {
          appliedScales.push(`pane:${pw.join(',')}`);
        },
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

  describe('4. ChartDrawingController.restoreAllCellDrawings & Otoritas _trawangan_meta (#191)', () => {
    test('restoreAllCellDrawings mengembalikan { hasAuthoritativePlanMeta: true } untuk single-cell & multi-cell meski activePlans kosong []', async () => {
      const adapter = new InMemoryLocalStorageAdapter({ memoryOnly: true });
      const persistence = new PersistenceService(adapter);

      // Single-cell: memiliki _trawangan_meta dengan activePlans: []
      await adapter.saveDrawings(
        'ws_auth_empty:binance:BTCUSDT',
        'GLOBAL',
        JSON.stringify({
          version: 1,
          drawings: [],
          _trawangan_meta: {
            drawingMetadata: {},
            activePlans: [],
            planDrawingIds: [],
            timestamp: 1000,
          },
        })
      );
      // Single-cell legacy tanpa _trawangan_meta
      await adapter.saveDrawings(
        'ws_legacy:binance:BTCUSDT',
        'GLOBAL',
        JSON.stringify({
          version: 1,
          drawings: [{ id: 'd_leg', type: 'trendline' }],
        })
      );

      let singleDrawings: any[] = [];
      const singleMockWs = {
        active: {
          chart: {
            drawings: {
              all: () => singleDrawings,
              fromJSON: (doc: any) => {
                singleDrawings = doc?.drawings ? [...doc.drawings] : [];
              },
              removeMany: (ids: string[]) => {
                singleDrawings = singleDrawings.filter((d) => !ids.includes(d.id));
              },
            },
          },
        },
        cells: () => [],
      };

      const singleCtrl = new ChartDrawingController(persistence);
      singleCtrl.setWorkspaceId('ws_auth_empty');
      singleCtrl.attachWorkspace(
        singleMockWs,
        () => 'BTCUSDT',
        () => '15m',
        () => 'binance'
      );

      const resAuthEmpty = await singleCtrl.restoreAllCellDrawings('ws_auth_empty');
      assert.deepStrictEqual(resAuthEmpty, { hasAuthoritativePlanMeta: true });

      singleCtrl.setWorkspaceId('ws_legacy');
      const resLegacy = await singleCtrl.restoreAllCellDrawings('ws_legacy');
      assert.deepStrictEqual(resLegacy, { hasAuthoritativePlanMeta: false });

      singleCtrl.setWorkspaceId('ws_missing');
      const resMissing = await singleCtrl.restoreAllCellDrawings('ws_missing');
      assert.deepStrictEqual(resMissing, { hasAuthoritativePlanMeta: false });

      // Multi-cell: sel 1 tanpa _trawangan_meta, sel 2 punya _trawangan_meta (activePlans: [])
      await adapter.saveDrawings(
        'ws_multi_mixed:binance:BTCUSDT',
        'GLOBAL',
        JSON.stringify({ version: 1, drawings: [{ id: 'd_btc', type: 'hline' }] })
      );
      await adapter.saveDrawings(
        'ws_multi_mixed:binance:ETHUSDT',
        'GLOBAL',
        JSON.stringify({
          version: 1,
          drawings: [],
          _trawangan_meta: {
            drawingMetadata: {},
            activePlans: [],
            planDrawingIds: [],
            timestamp: 2000,
          },
        })
      );

      let c1Drawings: any[] = [];
      let c2Drawings: any[] = [];
      const cell1 = {
        id: 'c1',
        symbol: 'binance:BTCUSDT',
        timeframe: '15m',
        chart: {
          drawings: {
            all: () => c1Drawings,
            fromJSON: (doc: any) => { c1Drawings = doc?.drawings ? [...doc.drawings] : []; },
          },
        },
      };
      const cell2 = {
        id: 'c2',
        symbol: 'binance:ETHUSDT',
        timeframe: '15m',
        chart: {
          drawings: {
            all: () => c2Drawings,
            fromJSON: (doc: any) => { c2Drawings = doc?.drawings ? [...doc.drawings] : []; },
          },
        },
      };
      const multiMockWs = {
        active: cell1,
        cells: () => [cell1, cell2],
      };

      const multiCtrl = new ChartDrawingController(persistence);
      multiCtrl.setWorkspaceId('ws_multi_mixed');
      multiCtrl.attachWorkspace(
        multiMockWs,
        () => 'BTCUSDT',
        () => '15m',
        () => 'binance'
      );

      const resMultiMixed = await multiCtrl.restoreAllCellDrawings('ws_multi_mixed');
      assert.deepStrictEqual(resMultiMixed, { hasAuthoritativePlanMeta: true });

      multiCtrl.setWorkspaceId('ws_multi_none');
      const resMultiNone = await multiCtrl.restoreAllCellDrawings('ws_multi_none');
      assert.deepStrictEqual(resMultiNone, { hasAuthoritativePlanMeta: false });
    });

    test('restoreWorkspaceChartAndPlans melarang w.activePlans basi menimpa kanvas jika _trawangan_meta otoritatif dan tetap menerapkan showThesisCards', async () => {
      const mockChart: WorkspaceChartPort = {
        clearAllIndicators: () => {},
        addPineIndicator: async () => {},
        getActiveIndicators: () => [],
        toggleIndicatorVisibility: () => {},
        setPriceStyle: () => {},
        setBarSpacing: () => {},
        applyPriceScaleState: () => {},
        applyPaneWeights: () => {},
      };

      let restorePlansCalled = 0;
      let resetCalled = 0;
      let clearAllCalled = 0;
      const thesisVisibleCalls: boolean[] = [];

      const mockPlan: WorkspacePlanPort = {
        setWorkspaceId: () => {},
        clearAllPlans: () => { clearAllCalled++; },
        resetInMemoryPlanState: () => { resetCalled++; },
        restorePlans: () => { restorePlansCalled++; },
        restoreAllCellDrawings: async () => ({ hasAuthoritativePlanMeta: true }),
        setThesisCardsVisible: (visible: boolean) => { thesisVisibleCalls.push(visible); },
        getActivePlans: () => [],
        getAllActivePlans: () => [],
        isThesisCardsVisible: () => thesisVisibleCalls[thesisVisibleCalls.length - 1] ?? true,
      };

      await restoreWorkspaceChartAndPlans({
        workspace: {
          id: 'ws-auth-empty',
          name: 'Auth Empty',
          schemaVersion: 2,
          symbol: 'BTCUSDT',
          timeframe: '15m',
          layout: '1',
          providerId: 'binance',
          indicators: [],
          activePlans: [{ id: 'stale-plan-1', symbol: 'BTCUSDT', bias: 'bullish', entry: 65000, stopLoss: 64000, targets: [] } as any],
          showThesisCards: false,
          timestamp: Date.now(),
        },
        chart: mockChart,
        plan: mockPlan,
        restoreCellDrawings: true,
        resetPlansWhenEmpty: true,
      });

      assert.strictEqual(restorePlansCalled, 0, 'w.activePlans basi tidak boleh dipulihkan saat _trawangan_meta otoritatif');
      assert.strictEqual(resetCalled, 0, 'resetInMemoryPlanState tidak boleh dipanggil ulang saat _trawangan_meta otoritatif');
      assert.strictEqual(clearAllCalled, 0, 'clearAllPlans tidak boleh dipanggil');
      assert.deepStrictEqual(thesisVisibleCalls, [false], 'showThesisCards workspace tetap wajib diterapkan');

      // Saat w.showThesisCards tidak didefinisikan, default true tetap diterapkan
      await restoreWorkspaceChartAndPlans({
        workspace: {
          id: 'ws-auth-default-cards',
          name: 'Auth Default Cards',
          schemaVersion: 2,
          symbol: 'BTCUSDT',
          timeframe: '15m',
          layout: '1',
          providerId: 'binance',
          indicators: [],
          activePlans: [{ id: 'stale-plan-2', symbol: 'BTCUSDT' } as any],
          timestamp: Date.now(),
        },
        chart: mockChart,
        plan: mockPlan,
        restoreCellDrawings: true,
        resetPlansWhenEmpty: true,
      });
      assert.strictEqual(restorePlansCalled, 0);
      assert.deepStrictEqual(thesisVisibleCalls, [false, true]);
    });

    test('restoreWorkspaceChartAndPlans tetap fallback ke w.activePlans pada workspace warisan tanpa _trawangan_meta, dan reset memori saat kosong', async () => {
      const mockChart: WorkspaceChartPort = {
        clearAllIndicators: () => {},
        addPineIndicator: async () => {},
        getActiveIndicators: () => [],
        toggleIndicatorVisibility: () => {},
        setPriceStyle: () => {},
        setBarSpacing: () => {},
        applyPriceScaleState: () => {},
        applyPaneWeights: () => {},
      };

      const restoredCalls: Array<{ plans: any[]; showThesisCards?: boolean }> = [];
      let resetCalled = 0;
      let clearAllCalled = 0;

      const legacyPlanPort: WorkspacePlanPort = {
        setWorkspaceId: () => {},
        clearAllPlans: () => { clearAllCalled++; },
        resetInMemoryPlanState: () => { resetCalled++; },
        restorePlans: (plans, showThesisCards) => {
          restoredCalls.push({ plans, showThesisCards });
        },
        restoreAllCellDrawings: async () => ({ hasAuthoritativePlanMeta: false }),
        getActivePlans: () => [],
        getAllActivePlans: () => [],
        isThesisCardsVisible: () => true,
      };

      const legacyPlan = { id: 'legacy-plan-1', symbol: 'ETHUSDT' };
      await restoreWorkspaceChartAndPlans({
        workspace: {
          id: 'ws-legacy-fallback',
          name: 'Legacy Fallback',
          schemaVersion: 2,
          symbol: 'ETHUSDT',
          timeframe: '1h',
          layout: '1',
          providerId: 'binance',
          indicators: [],
          activePlans: [legacyPlan as any],
          showThesisCards: false,
          timestamp: Date.now(),
        },
        chart: mockChart,
        plan: legacyPlanPort,
        restoreCellDrawings: true,
        resetPlansWhenEmpty: true,
      });

      assert.strictEqual(restoredCalls.length, 1);
      assert.deepStrictEqual(restoredCalls[0], { plans: [legacyPlan], showThesisCards: false });

      // Saat tidak ada _trawangan_meta dan w.activePlans kosong, reset in-memory berjalan tanpa clearAllPlans
      await restoreWorkspaceChartAndPlans({
        workspace: {
          id: 'ws-legacy-empty',
          name: 'Legacy Empty',
          schemaVersion: 2,
          symbol: 'ETHUSDT',
          timeframe: '1h',
          layout: '1',
          providerId: 'binance',
          indicators: [],
          activePlans: [],
          timestamp: Date.now(),
        },
        chart: mockChart,
        plan: legacyPlanPort,
        restoreCellDrawings: true,
        resetPlansWhenEmpty: true,
      });

      assert.strictEqual(resetCalled, 1, 'resetInMemoryPlanState wajib berjalan saat legacy kosong');
      assert.strictEqual(clearAllCalled, 0, 'clearAllPlans tidak boleh dipanggil saat resetInMemoryPlanState tersedia');
    });

    test('buildWorkspaceSnapshotPayload tetap mengisi activePlans untuk paritas fingerprint Workspace Auto-Save Guard', () => {
      const samplePlans = [
        {
          id: 'plan-fp-1',
          symbol: 'BTCUSDT',
          bias: 'bullish',
          entry: 65000,
          stopLoss: 64000,
          targets: [{ id: 'tp1', label: 'TP1', price: 68000 }],
        },
      ];
      let currentPlans = [...samplePlans];
      const mockPlan: Partial<WorkspacePlanPort> = {
        getAllActivePlans: () => currentPlans,
        getActivePlans: () => currentPlans,
        isThesisCardsVisible: () => true,
      };

      const payloadWithPlan = buildWorkspaceSnapshotPayload({
        id: 'ws-fp',
        name: 'FP Parity',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
        providerId: 'binance',
        plan: mockPlan,
      });
      assert.deepStrictEqual(payloadWithPlan.activePlans, samplePlans);

      currentPlans = [];
      const payloadAfterDelete = buildWorkspaceSnapshotPayload({
        id: 'ws-fp',
        name: 'FP Parity',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
        providerId: 'binance',
        plan: mockPlan,
      });
      assert.deepStrictEqual(payloadAfterDelete.activePlans, []);
      assert.notStrictEqual(
        computeWorkspaceFingerprint(payloadWithPlan as WorkspaceFingerprintInput),
        computeWorkspaceFingerprint(payloadAfterDelete as WorkspaceFingerprintInput),
        'Fingerprint wajib berubah ketika activePlans di kanvas dihapus'
      );
    });
  });
});
