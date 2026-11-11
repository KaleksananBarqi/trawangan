import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { computeWorkspaceFingerprint } from '../src/lib/services/persistence/workspaceService';
import { executeWorkspaceLoadPipeline, type WorkspaceChartPort, type WorkspacePlanPort } from '../src/lib/services/workspaceLifecycle';

describe('Fase 4: Migrasi Drawing saat Save As, Fingerprint Plan & Reset Memori Plan', () => {
  it('1. cloneWorkspaceDrawings: menyalin seluruh gambar & _trawangan_meta dari default_workspace ke workspace baru', async () => {
    const adapter = new InMemoryLocalStorageAdapter();
    const service = new PersistenceService(adapter);

    await adapter.saveDrawings(
      'default_workspace:binance:BTCUSDT',
      'GLOBAL',
      JSON.stringify({ version: 1, drawings: [{ id: 'd1', type: 'hline' }], _trawangan_meta: { activePlans: [{ id: 'p1' }] } })
    );
    await adapter.saveDrawings(
      'default_workspace:indodax:BTCIDR',
      'GLOBAL',
      JSON.stringify({ version: 1, drawings: [{ id: 'd2', type: 'trendline' }] })
    );
    // Drawing milik workspace lain tidak boleh ikut tersalin
    await adapter.saveDrawings(
      'ws_other:binance:ETHUSDT',
      'GLOBAL',
      JSON.stringify({ version: 1, drawings: [{ id: 'd3', type: 'box' }] })
    );

    const copied = await (service as any).cloneWorkspaceDrawings('default_workspace', '1700001234567');
    assert.equal(copied, 2);

    const btcDoc = await service.loadDrawings('1700001234567:binance:BTCUSDT', 'GLOBAL');
    assert.equal(btcDoc?.drawings?.length, 1);
    assert.equal(btcDoc?.drawings?.[0]?.id, 'd1');
    assert.equal(btcDoc?._trawangan_meta?.activePlans?.[0]?.id, 'p1');

    const idrDoc = await service.loadDrawings('1700001234567:indodax:BTCIDR', 'GLOBAL');
    assert.equal(idrDoc?.drawings?.[0]?.id, 'd2');

    const otherLeak = await service.loadDrawings('1700001234567:binance:ETHUSDT', 'GLOBAL');
    assert.equal(otherLeak, null);
  });

  it('2. computeWorkspaceFingerprint: mendeteksi perubahan ParsedTradingPlan (bias/entry/targets) dan field v2', () => {
    const base = {
      id: 'ws-1',
      name: 'Swing',
      symbol: 'BTCUSDT',
      timeframe: '4h',
      layout: '1',
      providerId: 'binance',
      paneLayout: [{ signature: 'price', weight: 3 }, { signature: 'Volume', weight: 0.8 }],
      nativeIndicators: [{ type: 'volume', inputs: { heightPct: 10 }, visible: true, placement: 'overlay' as const }],
      activePlans: [
        {
          id: 'plan-1',
          symbol: 'BTCUSDT',
          bias: 'bullish',
          entry: 65000,
          stopLoss: 64000,
          targets: [{ id: 'tp1', label: 'TP1', price: 68000 }],
        },
      ],
    };

    const fpBase = computeWorkspaceFingerprint(base);
    const fpChangedEntry = computeWorkspaceFingerprint({
      ...base,
      activePlans: [{ ...base.activePlans[0], entry: 65500 }],
    });
    const fpChangedTarget = computeWorkspaceFingerprint({
      ...base,
      activePlans: [{ ...base.activePlans[0], targets: [{ id: 'tp1', label: 'TP1', price: 69000 }] }],
    });
    const fpChangedPane = computeWorkspaceFingerprint({
      ...base,
      paneLayout: [{ signature: 'price', weight: 3 }, { signature: 'Volume', weight: 0.4 }],
    });
    const fpChangedVolPct = computeWorkspaceFingerprint({
      ...base,
      nativeIndicators: [{ type: 'volume', inputs: { heightPct: 6 }, visible: true, placement: 'overlay' as const }],
    });

    assert.notEqual(fpBase, fpChangedEntry, 'Perubahan entry ParsedTradingPlan wajib ubah fingerprint');
    assert.notEqual(fpBase, fpChangedTarget, 'Perubahan targets ParsedTradingPlan wajib ubah fingerprint');
    assert.notEqual(fpBase, fpChangedPane, 'Perubahan paneLayout wajib ubah fingerprint');
    assert.notEqual(fpBase, fpChangedVolPct, 'Perubahan heightPct volume wajib ubah fingerprint');
  });

  it('3. executeWorkspaceLoadPipeline: saat activePlans kosong, hanya reset memori plan tanpa menghapus kanvas', async () => {
    let clearedCanvasPlans = false;
    let resetMemoryCalled = false;

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

    const mockPlan: WorkspacePlanPort = {
      setWorkspaceId: () => {},
      clearAllPlans: () => { clearedCanvasPlans = true; },
      resetInMemoryPlanState: () => { resetMemoryCalled = true; },
      restorePlans: () => {},
      getActivePlans: () => [],
      getAllActivePlans: () => [{ id: 'other-coin-plan', symbol: 'ETHUSDT' }],
      isThesisCardsVisible: () => true,
    };

    await executeWorkspaceLoadPipeline({
      workspace: {
        id: 'ws-empty-plan',
        name: 'Clean Chart',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
        indicators: [],
        activePlans: [],
        timestamp: Date.now(),
      },
      chart: mockChart,
      plan: mockPlan,
      activeProviderId: 'binance',
      onProviderChange: async () => {},
      onSymbolChange: async () => {},
      onTimeframeChange: () => {},
      onLayoutChange: () => {},
      onSyncIndicators: () => {},
    });

    assert.equal(resetMemoryCalled, true, 'Harus memanggil resetInMemoryPlanState');
    assert.equal(clearedCanvasPlans, false, 'Tidak boleh memanggil clearAllPlans yang menghapus visual kanvas');
  });
});
