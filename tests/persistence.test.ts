import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { PersistenceService } from '../src/lib/services/persistence/index';
import type { PriceAlert, PineScriptRecord } from '../src/lib/types/market';

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

  test('Quick Symbols Config: memuat default dan menyimpan konfigurasi kustom', async () => {
    const initial = await service.loadQuickSymbolsConfig();
    assert.strictEqual(initial.mode, 'watchlist');
    assert.strictEqual(initial.maxDisplayCount, 5);

    const custom = {
      mode: 'custom' as const,
      customSymbols: ['SOLUSDT', 'SUIUSDT'],
      maxDisplayCount: 2,
    };

    await service.saveQuickSymbolsConfig(custom);
    const loaded = await service.loadQuickSymbolsConfig();
    assert.deepStrictEqual(loaded, custom);
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
});

