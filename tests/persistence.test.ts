import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { TauriSqliteAdapter } from '../src/lib/services/persistence/tauriSqliteAdapter';
import * as persistenceModule from '../src/lib/services/persistence/index';
import { PersistenceService } from '../src/lib/services/persistence/index';
import type { PriceAlert, PineScriptRecord, AppSettings } from '../src/lib/types/market';
import { resolveAppSettings } from '../src/lib/constants/defaults';

describe('Deep Persistence Module Unit Tests', () => {
  let adapter: InMemoryLocalStorageAdapter;
  let service: PersistenceService;

  beforeEach(() => {
    adapter = new InMemoryLocalStorageAdapter();
    adapter.clearMemory();
    service = new PersistenceService(adapter);
  });

  test('Watchlist: mengembalikan default simbol jika kosong dan dapat disimpan', async () => {
    const initial = await service.loadWatchlist();
    assert.ok(Array.isArray(initial));
    assert.strictEqual(initial.length, 10);
    assert.strictEqual(initial[0], 'BTCUSDT');

    const updated = ['BTCUSDT', 'SOLUSDT', 'ETHUSDT'];
    await service.saveWatchlist(updated);

    const loaded = await service.loadWatchlist();
    assert.deepStrictEqual(loaded, updated);
  });

  test('Drawings: menyimpan dokumen secara debounced dan dapat dihapus', async () => {
    const sym = 'BTCUSDT';
    const tf = '15m';

    const empty = await service.loadDrawings(sym, tf);
    assert.strictEqual(empty, null);

    const mockDoc = { shapes: [{ id: 'trendline_1', x1: 10, y1: 20 }] };
    service.saveDrawingsDebounced(sym, tf, mockDoc, 50);

    // Tunggu timer debounce selesai
    await new Promise((resolve) => setTimeout(resolve, 80));

    const loaded = await service.loadDrawings(sym, tf);
    assert.deepStrictEqual(loaded, mockDoc);

    await service.clearDrawings(sym, tf);
    const cleared = await service.loadDrawings(sym, tf);
    assert.strictEqual(cleared, null);
  });

  test('Price Alerts: dapat menyimpan dan memuat daftar alert', async () => {
    const emptyAlerts = await service.loadAlerts();
    assert.deepStrictEqual(emptyAlerts, []);

    const mockAlerts: PriceAlert[] = [
      {
        id: 'alt_1',
        symbol: 'BTCUSDT',
        targetPrice: 70000,
        condition: 'crossing',
        frequency: 'once',
        label: 'Breakout 70k',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      },
    ];

    await service.saveAlerts(mockAlerts);
    const loaded = await service.loadAlerts();
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, 'alt_1');
    assert.strictEqual(loaded[0].targetPrice, 70000);
  });

  test('Workspaces: alur CRUD penyimpanan dan penghapusan tata letak workspace', async () => {
    const initial = await service.loadWorkspaces();
    assert.deepStrictEqual(initial, []);

    const created = await service.saveWorkspace({
      name: 'Scalping Setup',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      layout: '2x1',
      indicators: [{ title: 'EMA Ribbon', visible: true }],
    });

    assert.ok(created.id);
    assert.strictEqual(created.name, 'Scalping Setup');

    const listAfterSave = await service.loadWorkspaces();
    assert.strictEqual(listAfterSave.length, 1);
    assert.strictEqual(listAfterSave[0].name, 'Scalping Setup');

    await service.deleteWorkspace(created.id);
    const listAfterDelete = await service.loadWorkspaces();
    assert.strictEqual(listAfterDelete.length, 0);
  });

  test('Workspaces: deleteWorkspace membersihkan drawings scoped tanpa menyentuh default_workspace atau workspace lain', async () => {
    const ws1 = await service.saveWorkspace({
      id: 'ws_target',
      name: 'Target',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      indicators: [],
    });
    const ws2 = await service.saveWorkspace({
      id: 'ws_keep',
      name: 'Keep',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      layout: '1',
      indicators: [],
    });

    await adapter.saveDrawings(`${ws1.id}:binance:BTCUSDT`, 'GLOBAL', JSON.stringify({ drawings: [{ id: 'a' }] }));
    await adapter.saveDrawings('default_workspace:binance:BTCUSDT', 'GLOBAL', JSON.stringify({ drawings: [{ id: 'b' }] }));
    await adapter.saveDrawings(`${ws2.id}:binance:ETHUSDT`, 'GLOBAL', JSON.stringify({ drawings: [{ id: 'c' }] }));

    await service.deleteWorkspace(ws1.id);

    assert.strictEqual(await service.loadDrawings(`${ws1.id}:binance:BTCUSDT`, 'GLOBAL'), null);
    assert.ok(await service.loadDrawings('default_workspace:binance:BTCUSDT', 'GLOBAL'));
    assert.ok(await service.loadDrawings(`${ws2.id}:binance:ETHUSDT`, 'GLOBAL'));
  });

  test('Pine Scripts: CRUD skrip kustom indikator', async () => {
    const scriptsEmpty = await service.loadScripts();
    assert.deepStrictEqual(scriptsEmpty, []);

    const script: PineScriptRecord = {
      id: 'pine_rsi_custom',
      title: 'Custom RSI v2',
      code: '//@version=5\nindicator("Custom RSI v2")',
      is_overlay: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await service.saveScript(script);
    const loadedList = await service.loadScripts();
    assert.strictEqual(loadedList.length, 1);
    assert.strictEqual(loadedList[0].title, 'Custom RSI v2');

    await service.deleteScript('pine_rsi_custom');
    const emptyAgain = await service.loadScripts();
    assert.strictEqual(emptyAgain.length, 0);
  });

  test('App Settings: menyimpan dan memuat preferensi pengguna', async () => {
    const initial = await service.loadSettings();
    assert.strictEqual(initial, null);

    const settings = {
      timezone: 'Asia/Tokyo',
      soundEnabled: false,
      showGrid: true,
    };

    await service.saveSettings(settings);
    const loaded = await service.loadSettings();
    assert.deepStrictEqual(loaded, settings);
  });

  test('App Settings: menyimpan dan memuat syncConfig serta autoSaveWorkspace secara persisten', async () => {
    const settings: AppSettings = {
      timezone: 'Asia/Jakarta',
      soundEnabled: true,
      showWatermark: true,
      showGrid: true,
      showReplayBar: false,
      defaultTimeframe: '1h',
      autoSaveWorkspace: false,
      syncConfig: {
        crosshair: false,
        viewport: true,
        symbol: true,
        drawings: false,
        indicators: false,
      },
    };

    await service.saveSettings(settings);
    const loaded = await service.loadSettings();
    assert.deepStrictEqual(loaded, settings);
    assert.strictEqual(loaded?.autoSaveWorkspace, false);
    assert.strictEqual(loaded?.syncConfig?.symbol, true);
    assert.strictEqual(loaded?.syncConfig?.crosshair, false);
  });

  test('App Settings: resolveAppSettings mengembalikan nilai default untuk field yang belum ada', () => {
    // Saat data dari storage kosong atau parsial lama tanpa syncConfig & autoSaveWorkspace
    const partialSettings: Partial<AppSettings> = {
      timezone: 'UTC',
      soundEnabled: false,
    };

    const resolved = resolveAppSettings(partialSettings);
    assert.strictEqual(resolved.timezone, 'UTC');
    assert.strictEqual(resolved.soundEnabled, false);
    assert.strictEqual(resolved.autoSaveWorkspace, true, 'Default autoSaveWorkspace harus true');
    assert.strictEqual(resolved.defaultTimeframe, '15m', 'Default defaultTimeframe harus 15m');
    assert.strictEqual(resolved.showCurrentPriceLine, true, 'Default showCurrentPriceLine harus true');
    assert.strictEqual(resolved.showIndicatorPriceLabels, true, 'Default showIndicatorPriceLabels harus true');
    assert.strictEqual(resolved.showDrawingPriceLabels, true, 'Default showDrawingPriceLabels harus true');
    assert.deepStrictEqual(resolved.syncConfig, {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
      indicators: true,
    });
  });


  test('Chart Default Config: menyimpan, memuat, dan menghapus konfigurasi default grafik', async () => {
    const initial = await service.loadChartDefaultConfig();
    assert.strictEqual(initial, null);

    const mockChartConfig = {
      series: { style: 'candles', spacing: 1.2 },
      candles: {
        upColor: '#10b981',
        downColor: '#ef4444',
        bodyVisible: true,
        borderVisible: true,
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickVisible: true,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      },
      animations: {
        zoom: true,
        pan: true,
        autoscale: false,
      },
    };

    await service.saveChartDefaultConfig(mockChartConfig);
    const loaded = await service.loadChartDefaultConfig();
    assert.deepStrictEqual(loaded, mockChartConfig);

    await service.clearChartDefaultConfig();
    const cleared = await service.loadChartDefaultConfig();
    assert.strictEqual(cleared, null);
  });

  test('Price Alerts: menjaga urutan batch replacement & field Plan-Linked Auto-Alerts', async () => {
    await service.saveAlerts([
      {
        id: 'a-2',
        symbol: 'ETHUSDT',
        targetPrice: 3100,
        condition: 'crossing_up',
        frequency: 'once',
        label: 'TP1',
        active: true,
        triggered: false,
        createdAt: 2000,
        planId: 'plan-77',
        planRole: 'tp1',
      },
      {
        id: 'a-1',
        symbol: 'BTCUSDT',
        targetPrice: 88000,
        condition: 'crossing_down',
        frequency: 'every_time',
        label: 'SL',
        active: false,
        triggered: true,
        createdAt: 1000,
        triggeredAt: 2500,
        triggeredPrice: 87990,
        planId: 'plan-77',
        planRole: 'sl',
      },
    ]);

    const loaded = await service.loadAlerts();
    assert.strictEqual(loaded.length, 2);
    assert.strictEqual(loaded[0].id, 'a-2');
    assert.strictEqual(loaded[0].planRole, 'tp1');
    assert.strictEqual(loaded[1].id, 'a-1');
    assert.strictEqual(loaded[1].triggeredAt, 2500);

    await service.saveAlerts([
      {
        id: 'a-3',
        symbol: 'SOLUSDT',
        targetPrice: 200,
        condition: 'crossing',
        frequency: 'once',
        label: 'Baru',
        active: true,
        triggered: false,
        createdAt: 3000,
      },
    ]);
    const replaced = await service.loadAlerts();
    assert.strictEqual(replaced.length, 1);
    assert.strictEqual(replaced[0].id, 'a-3');
  });

  test('Trade Plan Vault: deduplikasi, batas 200 entri terbaru, delete satu entri, dan clear', async () => {
    await service.clearTradingPlanHistory();

    // Simpan lebih dari 200 plan berbeda (entry berbeda agar tidak terdeduplikasi)
    for (let i = 0; i < 205; i++) {
      await service.saveTradingPlanToHistory({
        id: `vault_${i}`,
        symbol: 'BTCUSDT',
        providerId: 'binance',
        timeframe: '15m',
        rawText: `Plan ${i}`,
        plan: {
          bias: 'LONG',
          entry: 50000 + i,
          stopLoss: 49000,
          targets: [{ price: 52000 + i, label: 'TP1' }],
        } as any,
      });
    }

    const capped = await service.loadTradingPlanHistory();
    assert.strictEqual(capped.length, 200);
    assert.strictEqual(capped[0].id, 'vault_204');
    assert.ok(!capped.some((p) => p.id === 'vault_0'));

    // Deduplikasi berdasarkan signature sama memperbarui entri yang ada
    const updated = await service.saveTradingPlanToHistory({
      symbol: 'BTCUSDT.P',
      providerId: 'binance',
      timeframe: '1h',
      rawText: 'Plan 204 revised',
      plan: {
        bias: 'LONG',
        entry: 50204,
        stopLoss: 49000,
        targets: [{ price: 52204, label: 'TP1' }],
      } as any,
    });
    assert.strictEqual(updated.id, 'vault_204');
    const afterDedupe = await service.loadTradingPlanHistory();
    assert.strictEqual(afterDedupe.length, 200);
    assert.strictEqual(afterDedupe[0].timeframe, '1h');

    // Delete satu entri
    const afterDelete = await service.deleteTradingPlanFromHistory('vault_204');
    assert.strictEqual(afterDelete.length, 199);
    assert.ok(!afterDelete.some((p) => p.id === 'vault_204'));

    // Clear penuh
    await service.clearTradingPlanHistory();
    const afterClear = await service.loadTradingPlanHistory();
    assert.strictEqual(afterClear.length, 0);
  });

  test('Watchlist: loadWatchlist/saveWatchlist memproyeksikan registry kanonik tanpa menghapus token #section saat simbol identik', async () => {
    await service.saveWatchlistRegistry({
      activeWatchlistId: 'default',
      watchlists: [
        {
          id: 'default',
          name: 'Daftar Utama',
          items: ['#section:sec_1:TOP:0', 'binance:BTCUSDT', 'binance:ETHUSDT'],
          isPreset: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    assert.deepStrictEqual(await service.loadWatchlist(), ['binance:BTCUSDT', 'binance:ETHUSDT']);

    // saveWatchlist dengan simbol non-section sama mempertahankan token #section
    await service.saveWatchlist(['binance:BTCUSDT', 'binance:ETHUSDT']);
    const afterSame = await service.loadWatchlistRegistry();
    assert.deepStrictEqual(afterSame?.watchlists[0].items, [
      '#section:sec_1:TOP:0',
      'binance:BTCUSDT',
      'binance:ETHUSDT',
    ]);

    // saveWatchlist dengan daftar berbeda memperbarui item watchlist aktif
    await service.saveWatchlist(['binance:SOLUSDT']);
    assert.deepStrictEqual(await service.loadWatchlist(), ['binance:SOLUSDT']);
  });

  test('Tiket #179: app_preferences menyimpan settings & chart default config dan menghapus lewat real DELETE (bukan sentinel "")', async () => {
    await service.saveSettings({ theme: 'light', autoSaveWorkspace: false });
    assert.strictEqual((await service.loadSettings())?.theme, 'light');
    assert.strictEqual(
      await adapter.getPreference('app_settings'),
      JSON.stringify({ theme: 'light', autoSaveWorkspace: false })
    );

    const cfg = { series: { style: 'candles' } };
    await service.saveChartDefaultConfig(cfg);
    assert.deepStrictEqual(await service.loadChartDefaultConfig(), cfg);
    assert.ok(await adapter.getPreference('chart_default_config'));

    await service.clearChartDefaultConfig();
    assert.strictEqual(await adapter.getPreference('chart_default_config'), null);
    assert.strictEqual(await service.loadChartDefaultConfig(), null);
  });

  test('Workspaces: cloneWorkspaceDrawings di InMemoryAdapter memiliki parity case-insensitive seperti SQLite', async () => {
    await adapter.saveDrawings('Default_Workspace:binance:BTCUSDT', 'GLOBAL', JSON.stringify({ shapes: [42] }));
    const copied = await service.cloneWorkspaceDrawings('default_workspace', 'WS_MixedCopy');
    assert.strictEqual(copied, 1);
    const loaded = await service.loadDrawings('ws_mixedcopy:binance:BTCUSDT', 'GLOBAL');
    assert.deepStrictEqual(loaded, { shapes: [42] });
  });

  test('Tiket #180: kontrak warisan loadLayoutSlot dan saveLayoutSlot telah dihapus sepenuhnya dari service & adapter', () => {
    assert.strictEqual('loadLayoutSlot' in persistenceModule, false);
    assert.strictEqual('saveLayoutSlot' in persistenceModule, false);
    assert.strictEqual('loadLayoutSlot' in service, false);
    assert.strictEqual('saveLayoutSlot' in service, false);
    assert.strictEqual('loadLayoutSlot' in adapter, false);
    assert.strictEqual('saveLayoutSlot' in adapter, false);

    const tauriAdapter = new TauriSqliteAdapter();
    assert.strictEqual('loadLayoutSlot' in tauriAdapter, false);
    assert.strictEqual('saveLayoutSlot' in tauriAdapter, false);
  });
});

