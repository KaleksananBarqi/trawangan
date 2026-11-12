import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWorkspace,
  computePaneSignature,
  WORKSPACE_SCHEMA_VERSION,
} from '../src/lib/services/persistence/workspaceSchema';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

describe('Fase 1: Skema SavedWorkspace v2 & Migrasi Backward-Compatible', () => {
  it('1. computePaneSignature: menghasilkan signature deterministik untuk pane harga dan sub-pane indikator', () => {
    assert.equal(computePaneSignature({ kind: 'price', indicators: [{ title: 'EMA' }] }), 'price');
    assert.equal(
      computePaneSignature({
        kind: 'study',
        indicators: [{ title: 'RSI' }, { title: 'MACD' }],
      }),
      'MACD|RSI'
    );
    assert.equal(
      computePaneSignature({
        kind: 'study',
        indicators: [{ title: 'Volume' }],
      }),
      'Volume'
    );
    assert.equal(computePaneSignature({ kind: 'study', indicators: [] }), 'study:empty');
  });

  it('2. normalizeWorkspace: menaikkan dokumen v1 menjadi v2 dan mengisi cells[0] serta fallback paneWeights', () => {
    const legacyV1: any = {
      id: 'ws_v1_1',
      name: 'Legacy Scalping',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '2v',
      providerId: 'binance',
      paneWeights: [3, 1.5],
      priceScaleState: { mode: 'log', log: true, invert: false, auto: true, manualScale: null },
      priceStyle: 'candles',
      barSpacing: 11,
      showVolume: true,
      indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
      timestamp: 1700000000000,
    };

    const normalized = normalizeWorkspace(legacyV1);
    assert.equal(normalized.schemaVersion, WORKSPACE_SCHEMA_VERSION);
    assert.equal(normalized.name, 'Legacy Scalping');
    assert.deepEqual(normalized.paneWeights, [3, 1.5]);
    assert.ok(Array.isArray(normalized.cells) && normalized.cells.length >= 1);
    assert.equal(normalized.cells![0].symbol, 'BTCUSDT');
    assert.equal(normalized.cells![0].timeframe, '15m');
    assert.equal(normalized.cells![0].providerId, 'binance');
    assert.equal(normalized.cells![0].barSpacing, 11);
    assert.equal(normalized.cells![0].priceScaleState?.log, true);
    assert.deepEqual(normalized.cells![0].paneLayout, [
      { signature: 'price', weight: 3 },
      { signature: 'RSI', weight: 1.5 },
    ]);
  });

  it('3. normalizeWorkspace: mempertahankan field v2 dan properti masa depan/ekstra dengan aman', () => {
    const v2Doc: any = {
      id: 'ws_v2_1',
      name: 'Modern Layout',
      schemaVersion: 2,
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
      providerId: 'bybit',
      paneLayout: [
        { signature: 'price', weight: 4, collapsed: false },
        { signature: 'Volume', weight: 0.6, collapsed: false },
      ],
      nativeIndicators: [
        { type: 'volume', inputs: { heightPct: 8 }, visible: true, placement: 'overlay' },
      ],
      indicators: [],
      futureExtraField: { custom: true },
      timestamp: 1700000005000,
    };

    const normalized = normalizeWorkspace(v2Doc) as any;
    assert.equal(normalized.schemaVersion, 2);
    assert.deepEqual(normalized.paneLayout, v2Doc.paneLayout);
    assert.deepEqual(normalized.nativeIndicators, v2Doc.nativeIndicators);
    assert.deepEqual(normalized.futureExtraField, { custom: true });
  });

  it('4. PersistenceService.loadWorkspaces: otomatis menormalkan workspace v1 menjadi v2 saat dimuat', async () => {
    const adapter = new InMemoryLocalStorageAdapter();
    const service = new PersistenceService(adapter);

    const legacyWs: any = {
      id: 'legacy_ws',
      name: 'Old Setup',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      layout: '1',
      paneWeights: [3, 1],
      indicators: [{ title: 'Stoch', source: 'plot(1)', visible: true }],
      timestamp: 12345,
    };
    await adapter.upsertWorkspace(legacyWs);

    const loaded = await service.loadWorkspaces();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].schemaVersion, WORKSPACE_SCHEMA_VERSION);
    assert.equal(loaded[0].cells?.[0].symbol, 'SOLUSDT');
    assert.equal(loaded[0].paneLayout?.[1].signature, 'Stoch');
    assert.equal(loaded[0].paneLayout?.[1].weight, 1);
  });

  it('5. normalizeWorkspace: menyalin root indicators ke cells[0] saat syncConfig.indicators === false dan menghindarinya saat synced', () => {
    const legacyPerCellV1: any = {
      id: 'ws_v1_ind_false',
      name: 'Per-Cell v1',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
      providerId: 'binance',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
      indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
      timestamp: 1700000000000,
    };

    const normalizedPerCell = normalizeWorkspace(legacyPerCellV1);
    assert.equal(normalizedPerCell.cells?.[0]?.indicators?.length, 1);
    assert.equal(normalizedPerCell.cells?.[0]?.indicators?.[0]?.title, 'RSI');

    // Jika syncConfig.indicators aktif (true/default), cells[0].indicators tidak diduplikasi dari root
    const syncedDoc = normalizeWorkspace({
      ...legacyPerCellV1,
      id: 'ws_v1_ind_true',
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    });
    assert.equal(syncedDoc.cells?.[0]?.indicators, undefined);
  });
});
