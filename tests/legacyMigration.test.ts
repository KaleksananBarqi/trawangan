import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { TauriSqliteAdapter } from '../src/lib/services/persistence/tauriSqliteAdapter';
import type {
  AppPreferenceKey,
  AppPreferenceRecord,
  PersistenceAdapter,
} from '../src/lib/services/persistence/types';
import type {
  MultiWatchlistRegistry,
  PineScriptRecord,
  PriceAlert,
  ProviderConfig,
  SavedTradingPlanRecord,
  SavedWorkspace,
} from '../src/lib/types/market';

interface MockSqliteOptions {
  initialPreferences?: Record<string, string>;
  initialProviders?: ProviderConfig[];
  initialTradingPlans?: SavedTradingPlanRecord[];
  failPreferenceKeys?: Set<string>;
  failProviderWrite?: boolean;
  failTradingPlanWrite?: boolean;
}

class MockSqlitePersistenceAdapter implements PersistenceAdapter {
  public preferences = new Map<string, string>();
  public providers: ProviderConfig[] = [];
  public tradingPlans: SavedTradingPlanRecord[] = [];
  public setPreferenceCalls: Array<{ key: AppPreferenceKey; valueJson: string }> = [];
  public saveProviderCalls: ProviderConfig[] = [];
  public setActiveProviderCalls: string[] = [];
  private failPreferenceKeys: Set<string>;
  private failProviderWrite: boolean;
  private failTradingPlanWrite: boolean;

  constructor(options: MockSqliteOptions = {}) {
    if (options.initialPreferences) {
      for (const [k, v] of Object.entries(options.initialPreferences)) {
        this.preferences.set(k, v);
      }
    }
    this.providers = (options.initialProviders ?? []).map((p) => ({ ...p }));
    this.tradingPlans = (options.initialTradingPlans ?? []).map((p) => ({ ...p }));
    this.failPreferenceKeys = options.failPreferenceKeys ?? new Set();
    this.failProviderWrite = Boolean(options.failProviderWrite);
    this.failTradingPlanWrite = Boolean(options.failTradingPlanWrite);
  }

  async loadDrawings(): Promise<string | null> { return null; }
  async saveDrawings(): Promise<void> {}
  async clearDrawings(): Promise<void> {}
  async cloneWorkspaceDrawings(): Promise<number> { return 0; }
  async listWorkspaces(): Promise<SavedWorkspace[]> { return []; }
  async upsertWorkspace(): Promise<void> {}
  async deleteWorkspace(): Promise<void> {}
  async listAlerts(): Promise<PriceAlert[]> { return []; }
  async replaceAlerts(): Promise<void> {}
  async listTradingPlans(): Promise<SavedTradingPlanRecord[]> {
    if (this.failTradingPlanWrite) {
      throw new Error('Simulasi gagal baca/tulis trading_plans SQLite');
    }
    return this.tradingPlans.map((p) => ({ ...p }));
  }
  async upsertTradingPlan(record: SavedTradingPlanRecord): Promise<void> {
    if (this.failTradingPlanWrite) {
      throw new Error('Simulasi gagal upsert trading_plan SQLite');
    }
    this.tradingPlans = [record, ...this.tradingPlans.filter((p) => p.id !== record.id)];
  }
  async deleteTradingPlan(): Promise<void> {}
  async clearTradingPlans(): Promise<void> { this.tradingPlans = []; }
  async loadWatchlist(): Promise<string[] | null> { return null; }
  async saveWatchlist(): Promise<void> {}
  async loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null> { return null; }
  async saveWatchlistRegistry(): Promise<void> {}
  async loadScripts(): Promise<PineScriptRecord[]> { return []; }
  async saveScript(): Promise<void> {}
  async deleteScript(): Promise<void> {}

  async getPreference(key: AppPreferenceKey): Promise<string | null> {
    return this.preferences.get(key) ?? null;
  }

  async setPreference(key: AppPreferenceKey, valueJson: string): Promise<void> {
    this.setPreferenceCalls.push({ key, valueJson });
    if (this.failPreferenceKeys.has(key)) {
      throw new Error(`Simulasi gagal menulis app_preferences "${key}"`);
    }
    JSON.parse(valueJson);
    this.preferences.set(key, valueJson);
  }

  async deletePreference(key: AppPreferenceKey): Promise<void> {
    this.preferences.delete(key);
  }

  async loadAllPreferences(): Promise<AppPreferenceRecord[]> {
    return Array.from(this.preferences.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value_json]) => ({ key, value_json, updated_at: 1700000000000 }));
  }

  async loadProviders(): Promise<ProviderConfig[]> {
    return this.providers.map((p) => ({ ...p }));
  }

  async saveProvider(provider: ProviderConfig): Promise<void> {
    this.saveProviderCalls.push({ ...provider });
    if (this.failProviderWrite) {
      throw new Error('Simulasi gagal menyimpan provider SQLite');
    }
    if (provider.is_active) {
      this.providers = this.providers.map((p) => ({ ...p, is_active: false }));
    }
    this.providers = [...this.providers.filter((p) => p.id !== provider.id), { ...provider }];
  }

  async setActiveProvider(id: string): Promise<void> {
    this.setActiveProviderCalls.push(id);
    if (this.failProviderWrite) {
      throw new Error('Simulasi gagal aktivasi provider SQLite');
    }
    this.providers = this.providers.map((p) => ({ ...p, is_active: p.id === id }));
  }

  async deleteProvider(id: string): Promise<void> {
    this.providers = this.providers.filter((p) => p.id !== id);
  }
}

function createFakeLocalStorage(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial));
  const ops: Array<{ op: 'getItem' | 'setItem' | 'removeItem' | 'key'; key: string | number }> = [];

  const api = {
    get length() {
      return store.size;
    },
    key(index: number) {
      ops.push({ op: 'key', key: index });
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      ops.push({ op: 'getItem', key });
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      ops.push({ op: 'setItem', key });
      store.set(key, String(value));
    },
    removeItem(key: string) {
      ops.push({ op: 'removeItem', key });
      store.delete(key);
    },
  };

  return { store, ops, api };
}

function withFakeWindowLocalStorage<T>(
  fakeStorage: Storage | { getItem: (k: string) => string | null; removeItem: (k: string) => void },
  fn: () => Promise<T>
): Promise<T> {
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = { ...(prevWindow || {}), localStorage: fakeStorage };
  return fn().finally(() => {
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  });
}

describe('Tiket #185: Migrasi Satu Kali Legacy localStorage & Proteksi Bucket C', () => {
  it('Slice 1: memigrasikan Bucket A (termasuk avatar ~2.5 MB & autosave merge), Bucket B, providers, dan membersihkan orphan vault saat bootstrap SQLite', async () => {
    const largeAvatar = `data:image/png;base64,${'B'.repeat(2_500_000)}`;
    const legacySettings = {
      theme: 'light',
      timezone: 'Asia/Jakarta',
      userProfile: {
        username: 'Pak Budi',
        handle: '@pakbudi',
        avatarDataUrl: largeAvatar,
      },
    };
    const legacyProviders: ProviderConfig[] = [
      {
        id: 'binance',
        name: 'Binance Official Public',
        rest_url: 'https://api.binance.com',
        ws_url: 'wss://stream.binance.com:9443',
        is_active: false,
      },
      {
        id: 'custom-legacy-1',
        name: 'Node Nusantara',
        rest_url: 'https://node.nusantara.local',
        ws_url: 'wss://node.nusantara.local/ws',
        is_active: true,
      },
    ];

    const fake = createFakeLocalStorage({
      trawangan_app_settings: JSON.stringify(legacySettings),
      trawangan_autosave_workspace: 'false',
      trawangan_chart_default_config: JSON.stringify({ candles: { upColor: '#22c55e' } }),
      trawangan_last_workspace_id: 'ws_legacy_99',
      trawangan_providers: JSON.stringify(legacyProviders),
      trawangan_left_rail_collapsed: 'true',
      trawangan_right_dock_state: JSON.stringify({
        isOpen: false,
        activeTab: null,
        lastOpenedTab: 'objects',
      }),
      trawangan_pine_panel_width: '540',
      trawangan_right_panel_width: '380',
      trawangan_right_plan_width: '460',
      trawangan_drawings_last_used: JSON.stringify({ lines: 'ray' }),
      trawangan_drawings_favorites: JSON.stringify(['trendline', 'fibretracement']),
      trawangan_drawings_fav_pos: JSON.stringify({ x: 88, y: 210 }),
      trawangan_fav_indicators: JSON.stringify(['rsi', 'vwap']),
      trawangan_recent_searches: JSON.stringify(['BTCUSDT', 'SOLUSDT']),
      trawangan_trade_plan_vault: JSON.stringify([
        {
          id: 'vault_legacy_1',
          symbol: 'BTCUSDT',
          providerId: 'binance',
          timeframe: '1h',
          createdAt: 1000,
          updatedAt: 2000,
          rawText: 'LONG BTC',
          plan: { symbol: 'BTCUSDT', bias: 'long', entry: 60000, stopLoss: 59000, targets: [] },
        },
      ]),
    });

    // Simulasikan tabel providers SQLite baru yang baru saja di-seed default oleh Rust seed_defaults
    const adapter = new MockSqlitePersistenceAdapter({
      initialProviders: [
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: true,
        },
        {
          id: 'hyperliquid',
          name: 'Hyperliquid DEX Perpetuals',
          rest_url: 'https://api.hyperliquid.xyz',
          ws_url: 'wss://api.hyperliquid.xyz/ws',
          is_active: false,
        },
        {
          id: 'coinbase',
          name: 'Coinbase Exchange Spot',
          rest_url: 'https://api.exchange.coinbase.com',
          ws_url: 'wss://ws-feed.exchange.coinbase.com',
          is_active: false,
        },
        {
          id: 'bitunix',
          name: 'Bitunix Futures',
          rest_url: 'https://fapi.bitunix.com',
          ws_url: 'wss://fapi.bitunix.com/public/',
          is_active: false,
        },
      ],
    });

    const service = new PersistenceService(adapter);

    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    assert.equal(service.isBootstrapped(), true);

    // Seluruh Bucket A & B harus terbaca sinkron langsung pasca-bootstrap()
    const syncedSettings = service.getSettingsSync();
    assert.equal(syncedSettings?.theme, 'light');
    assert.equal(syncedSettings?.autoSaveWorkspace, false);
    assert.equal(syncedSettings?.userProfile?.avatarDataUrl?.length, largeAvatar.length);
    assert.deepEqual(service.getChartDefaultConfigSync(), { candles: { upColor: '#22c55e' } });
    assert.equal(service.getLastActiveWorkspaceIdSync(), 'ws_legacy_99');

    assert.equal(service.getUiPreferenceSync<boolean>('left_rail_collapsed'), true);
    assert.deepEqual(service.getUiPreferenceSync('right_dock_state'), {
      isOpen: false,
      activeTab: null,
      lastOpenedTab: 'objects',
    });
    assert.equal(service.getUiPreferenceSync<number>('pine_panel_width'), 540);
    assert.equal(service.getUiPreferenceSync<number>('right_panel_width'), 380);
    assert.equal(service.getUiPreferenceSync<number>('right_plan_width'), 460);
    assert.deepEqual(service.getUiPreferenceSync('drawings_last_used'), { lines: 'ray' });
    assert.deepEqual(service.getUiPreferenceSync('drawings_favorites'), ['trendline', 'fibretracement']);
    assert.deepEqual(service.getUiPreferenceSync('drawings_fav_pos'), { x: 88, y: 210 });
    assert.deepEqual(service.getUiPreferenceSync('fav_indicators'), ['rsi', 'vwap']);
    assert.deepEqual(service.getUiPreferenceSync('recent_searches'), ['BTCUSDT', 'SOLUSDT']);

    // Providers termigrasi dan cache sinkron langsung mencerminkan provider aktif baru
    const syncedProviders = service.getProvidersSync();
    assert.equal(syncedProviders.find((p) => p.id === 'custom-legacy-1')?.is_active, true);
    assert.equal(syncedProviders.find((p) => p.id === 'binance')?.is_active, false);

    // Vault lama yang belum ada di SQLite ikut terselamatkan lalu kunci yatim dibersihkan
    assert.equal((await service.loadTradingPlanHistory()).length, 1);

    // Seluruh 16 kunci legacy allowlist sudah dihapus dari localStorage
    assert.equal(fake.store.size, 0);
  });

  it('Slice 2a: data SQLite yang sudah ada tidak pernah tertimpa oleh sisa localStorage usang', async () => {
    const sqliteSettings = {
      theme: 'dark',
      timezone: 'UTC',
      autoSaveWorkspace: true,
    };
    const sqliteChartCfg = { candles: { upColor: '#00ff88' } };
    const sqliteDockState = { isOpen: true, activeTab: 'watchlist', lastOpenedTab: 'watchlist' };
    const sqlitePlanRecord: SavedTradingPlanRecord = {
      id: 'vault_sqlite_1',
      symbol: 'ETHUSDT',
      providerId: 'binance',
      timeframe: '4h',
      createdAt: 5000,
      updatedAt: 6000,
      rawText: 'SHORT ETH',
      plan: { symbol: 'ETHUSDT', bias: 'short', entry: 3500, stopLoss: 3600, targets: [] } as any,
    };

    const adapter = new MockSqlitePersistenceAdapter({
      initialPreferences: {
        app_settings: JSON.stringify(sqliteSettings),
        chart_default_config: JSON.stringify(sqliteChartCfg),
        last_active_workspace_id: JSON.stringify('ws_sqlite_terbaru'),
        left_rail_collapsed: JSON.stringify(false),
        right_dock_state: JSON.stringify(sqliteDockState),
        pine_panel_width: JSON.stringify(620),
        right_panel_width: JSON.stringify(340),
        right_plan_width: JSON.stringify(410),
        drawings_last_used: JSON.stringify({ lines: 'trendline' }),
        drawings_favorites: JSON.stringify(['hline']),
        drawings_fav_pos: JSON.stringify({ x: 60, y: 120 }),
        fav_indicators: JSON.stringify(['ema']),
        recent_searches: JSON.stringify(['ETHUSDT']),
      },
      initialProviders: [
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: false,
        },
        {
          id: 'hyperliquid',
          name: 'Hyperliquid DEX Perpetuals',
          rest_url: 'https://api.hyperliquid.xyz',
          ws_url: 'wss://api.hyperliquid.xyz/ws',
          is_active: true,
        },
        {
          id: 'custom-sqlite',
          name: 'SQLite Custom Baru',
          rest_url: 'https://new.sqlite.local',
          ws_url: '',
          is_active: false,
        },
      ],
      initialTradingPlans: [sqlitePlanRecord],
    });

    const fake = createFakeLocalStorage({
      trawangan_app_settings: JSON.stringify({ theme: 'light', timezone: 'Asia/Tokyo', autoSaveWorkspace: false }),
      trawangan_autosave_workspace: 'false',
      trawangan_chart_default_config: JSON.stringify({ candles: { upColor: '#ff0000' } }),
      trawangan_last_workspace_id: 'ws_stale_lama',
      trawangan_providers: JSON.stringify([
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: true,
        },
        {
          id: 'custom-sqlite',
          name: 'Nama Lama Basi',
          rest_url: 'https://old.stale.local',
          ws_url: '',
          is_active: true,
        },
      ]),
      trawangan_left_rail_collapsed: 'true',
      trawangan_right_dock_state: JSON.stringify({ isOpen: false, activeTab: null, lastOpenedTab: 'plan' }),
      trawangan_pine_panel_width: '400',
      trawangan_right_panel_width: '290',
      trawangan_right_plan_width: '330',
      trawangan_drawings_last_used: JSON.stringify({ lines: 'extended' }),
      trawangan_drawings_favorites: JSON.stringify(['box']),
      trawangan_drawings_fav_pos: JSON.stringify({ x: 99, y: 99 }),
      trawangan_fav_indicators: JSON.stringify(['macd']),
      trawangan_recent_searches: JSON.stringify(['DOGEUSDT']),
      trawangan_trade_plan_vault: JSON.stringify([
        {
          id: 'vault_stale_old',
          symbol: 'BTCUSDT',
          providerId: 'binance',
          timeframe: '15m',
          createdAt: 100,
          updatedAt: 100,
          rawText: 'OLD',
          plan: { symbol: 'BTCUSDT', bias: 'long', entry: 10000, stopLoss: 9000, targets: [] },
        },
      ]),
    });

    const service = new PersistenceService(adapter);
    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    // Nol penulisan preference atau provider ke SQLite karena seluruhnya sudah ada di SQLite
    assert.equal(adapter.setPreferenceCalls.length, 0);
    assert.equal(adapter.saveProviderCalls.length, 0);
    assert.equal(adapter.setActiveProviderCalls.length, 0);

    // Seluruh nilai SQLite tetap otoritatif
    assert.deepEqual(service.getSettingsSync(), sqliteSettings);
    assert.deepEqual(service.getChartDefaultConfigSync(), sqliteChartCfg);
    assert.equal(service.getLastActiveWorkspaceIdSync(), 'ws_sqlite_terbaru');
    assert.equal(service.getUiPreferenceSync<boolean>('left_rail_collapsed'), false);
    assert.deepEqual(service.getUiPreferenceSync('right_dock_state'), sqliteDockState);
    assert.equal(service.getUiPreferenceSync<number>('pine_panel_width'), 620);
    assert.equal(service.getUiPreferenceSync<number>('right_panel_width'), 340);
    assert.equal(service.getUiPreferenceSync<number>('right_plan_width'), 410);
    assert.deepEqual(service.getUiPreferenceSync('recent_searches'), ['ETHUSDT']);

    const providers = service.getProvidersSync();
    assert.equal(providers.find((p) => p.id === 'hyperliquid')?.is_active, true);
    assert.equal(providers.find((p) => p.id === 'binance')?.is_active, false);
    assert.equal(providers.find((p) => p.id === 'custom-sqlite')?.rest_url, 'https://new.sqlite.local');
    assert.equal(providers.find((p) => p.id === 'custom-sqlite')?.is_active, false);

    const plans = await service.loadTradingPlanHistory();
    assert.equal(plans.length, 1);
    assert.equal(plans[0].id, 'vault_sqlite_1');

    // Sisa kunci usang tetap dibersihkan dari localStorage
    assert.equal(fake.store.size, 0);
  });

  it('Slice 2b: menggabungkan trawangan_autosave_workspace ke SQLite app_settings tanpa menimpa field lain & menyelamatkan custom provider yang hilang', async () => {
    const adapter = new MockSqlitePersistenceAdapter({
      initialPreferences: {
        // app_settings sudah ada di SQLite tetapi belum memiliki autoSaveWorkspace
        app_settings: JSON.stringify({ theme: 'light', timezone: 'Asia/Jakarta' }),
      },
      initialProviders: [
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: false,
        },
        {
          id: 'coinbase',
          name: 'Coinbase Exchange Spot',
          rest_url: 'https://api.exchange.coinbase.com',
          ws_url: 'wss://ws-feed.exchange.coinbase.com',
          is_active: true,
        },
      ],
    });

    const fake = createFakeLocalStorage({
      trawangan_app_settings: JSON.stringify({ theme: 'dark', timezone: 'UTC' }),
      trawangan_autosave_workspace: 'false',
      trawangan_providers: JSON.stringify([
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: true,
        },
        {
          id: 'custom-missing-1',
          name: 'Custom Tertinggal',
          rest_url: 'https://missing.example.com',
          ws_url: '',
          is_active: true,
        },
      ]),
    });

    const service = new PersistenceService(adapter);
    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    // theme & timezone SQLite tidak tertimpa, hanya autoSaveWorkspace yang digabungkan
    assert.deepEqual(service.getSettingsSync(), {
      theme: 'light',
      timezone: 'Asia/Jakarta',
      autoSaveWorkspace: false,
    });

    // coinbase tetap aktif di SQLite; custom-missing-1 diimpor tanpa merebut status aktif
    const providers = service.getProvidersSync();
    assert.equal(providers.find((p) => p.id === 'coinbase')?.is_active, true);
    assert.equal(providers.find((p) => p.id === 'custom-missing-1')?.is_active, false);
    assert.equal(providers.find((p) => p.id === 'custom-missing-1')?.rest_url, 'https://missing.example.com');
    assert.equal(fake.store.size, 0);
  });

  it('Slice 3: mempertahankan kunci legacy di localStorage apabila penulisan SQLite gagal/reject', async () => {
    const adapter = new MockSqlitePersistenceAdapter({
      failPreferenceKeys: new Set(['app_settings', 'pine_panel_width', 'last_active_workspace_id']),
      failProviderWrite: true,
      failTradingPlanWrite: true,
    });

    const fake = createFakeLocalStorage({
      trawangan_app_settings: JSON.stringify({ theme: 'light' }),
      trawangan_autosave_workspace: 'false',
      trawangan_last_workspace_id: 'ws_keep_on_error',
      trawangan_pine_panel_width: '512',
      trawangan_right_panel_width: '360', // ini harus berhasil dimigrasi & dihapus
      trawangan_providers: JSON.stringify([
        {
          id: 'custom-fail-1',
          name: 'Custom Gagal',
          rest_url: 'https://fail.example.com',
          ws_url: '',
          is_active: true,
        },
      ]),
      trawangan_trade_plan_vault: JSON.stringify([
        {
          id: 'vault_fail_1',
          symbol: 'BTCUSDT',
          providerId: 'binance',
          timeframe: '15m',
          createdAt: 1000,
          updatedAt: 1000,
          rawText: 'LONG BTC',
          plan: { symbol: 'BTCUSDT', bias: 'long', entry: 50000, stopLoss: 49000, targets: [] },
        },
      ]),
    });

    const service = new PersistenceService(adapter);
    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    assert.equal(service.isBootstrapped(), true);

    // Kunci yang gagal ditulis wajib tetap aman di localStorage dan tidak masuk cache memori
    assert.ok(fake.store.has('trawangan_app_settings'));
    assert.ok(fake.store.has('trawangan_autosave_workspace'));
    assert.ok(fake.store.has('trawangan_last_workspace_id'));
    assert.ok(fake.store.has('trawangan_pine_panel_width'));
    assert.ok(fake.store.has('trawangan_providers'));
    assert.ok(fake.store.has('trawangan_trade_plan_vault'));

    assert.equal(service.getSettingsSync(), null);
    assert.equal(service.getLastActiveWorkspaceIdSync(), null);
    assert.equal(service.getUiPreferenceSync('pine_panel_width'), null);
    assert.equal(service.getProvidersSync().some((p) => p.id === 'custom-fail-1'), false);

    // Kunci yang penulisan SQLite-nya berhasil tetap termigrasi dan dibersihkan
    assert.equal(fake.store.has('trawangan_right_panel_width'), false);
    assert.equal(service.getUiPreferenceSync<number>('right_panel_width'), 360);
  });

  it('Slice 4a: kunci Bucket C (Exit Flush & Macro Cache) tidak pernah dibaca, diiterasi, dimigrasi, ataupun dihapus oleh bootstrap()', async () => {
    const adapter = new MockSqlitePersistenceAdapter();
    const pendingPayload = JSON.stringify({ updatedAt: 999999, workspace: { id: 'ws_1' } });
    const macroMetaPayload = JSON.stringify({ 'TOTAL:1D': 1700000000000 });
    const macroMetadataPayload = JSON.stringify({ updatedAt: 1700000000000, totalMarketCap: 3e12 });

    const fake = createFakeLocalStorage({
      trawangan_workspace_pending_ws_1: pendingPayload,
      trawangan_macro_cache_meta_v1: macroMetaPayload,
      trawangan_macro_metadata_v1: macroMetadataPayload,
      trawangan_fav_indicators: JSON.stringify(['rsi']),
    });

    const service = new PersistenceService(adapter);
    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    // Bucket B termigrasi dan terhapus
    assert.deepEqual(service.getUiPreferenceSync('fav_indicators'), ['rsi']);
    assert.equal(fake.store.has('trawangan_fav_indicators'), false);

    // Bucket C utuh 100% dan tidak pernah tersentuh operasi getItem/removeItem/key
    assert.equal(fake.store.get('trawangan_workspace_pending_ws_1'), pendingPayload);
    assert.equal(fake.store.get('trawangan_macro_cache_meta_v1'), macroMetaPayload);
    assert.equal(fake.store.get('trawangan_macro_metadata_v1'), macroMetadataPayload);

    const touchedBucketCOps = fake.ops.filter(
      (entry) =>
        entry.op === 'key' ||
        (typeof entry.key === 'string' &&
          (entry.key.startsWith('trawangan_workspace_pending_') ||
            entry.key === 'trawangan_macro_cache_meta_v1' ||
            entry.key === 'trawangan_macro_metadata_v1'))
    );
    assert.deepEqual(touchedBucketCOps, []);
  });

  it('Slice 4b: mode Web (InMemoryLocalStorageAdapter) tidak pernah menghapus trawangan_providers atau trawangan_trade_plan_vault saat bootstrap()', async () => {
    const providersPayload = JSON.stringify([
      {
        id: 'custom-web-1',
        name: 'Web Custom',
        rest_url: 'https://web.example.com',
        ws_url: '',
        is_active: true,
      },
    ]);
    const vaultPayload = JSON.stringify([
      {
        id: 'web_vault_1',
        symbol: 'BTCUSDT',
        providerId: 'binance',
        timeframe: '1h',
        createdAt: 1000,
        updatedAt: 1000,
        rawText: 'LONG',
        plan: { symbol: 'BTCUSDT', bias: 'long', entry: 50000, stopLoss: 49000, targets: [] },
      },
    ]);

    const fake = createFakeLocalStorage({
      trawangan_providers: providersPayload,
      trawangan_trade_plan_vault: vaultPayload,
      trawangan_app_settings: JSON.stringify({ theme: 'dark' }),
    });

    const prevGlobalLs = (globalThis as any).localStorage;
    (globalThis as any).localStorage = fake.api;
    try {
      const webAdapter = new InMemoryLocalStorageAdapter();
      const webService = new PersistenceService(webAdapter);
      await withFakeWindowLocalStorage(fake.api, async () => {
        await webService.bootstrap();
      });

      assert.equal(fake.store.get('trawangan_providers'), providersPayload);
      assert.equal(fake.store.get('trawangan_trade_plan_vault'), vaultPayload);
      assert.ok(fake.store.has('trawangan_app_settings'));
      assert.equal(webService.getProvidersSync().some((p) => p.id === 'custom-web-1'), true);
    } finally {
      if (prevGlobalLs === undefined) {
        delete (globalThis as any).localStorage;
      } else {
        (globalThis as any).localStorage = prevGlobalLs;
      }
    }
  });

  it('Slice 4c: integrasi TauriSqliteAdapter dengan mock IPC menjalankan migrasi satu kali hanya pada bootstrap pertama', async () => {
    const sqlitePrefs = new Map<string, string>();
    const sqliteProviders: ProviderConfig[] = [
      {
        id: 'binance',
        name: 'Binance Official Public',
        rest_url: 'https://api.binance.com',
        ws_url: 'wss://stream.binance.com:9443',
        is_active: true,
      },
    ];
    let setPrefCalls = 0;

    const fake = createFakeLocalStorage({
      trawangan_autosave_workspace: 'false',
      trawangan_recent_searches: JSON.stringify(['BTCUSDT']),
      trawangan_workspace_pending_ws_active: JSON.stringify({ updatedAt: 1234 }),
    });

    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = {
      localStorage: fake.api,
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args?: any) => {
          if (cmd === 'load_all_app_preferences') {
            return Array.from(sqlitePrefs.entries()).map(([key, value_json]) => ({
              key,
              value_json,
              updated_at: 1000,
            }));
          }
          if (cmd === 'set_app_preference') {
            setPrefCalls += 1;
            sqlitePrefs.set(args.key, args.valueJson);
            return null;
          }
          if (cmd === 'get_data_providers') {
            return sqliteProviders.map((p) => ({ ...p }));
          }
          if (cmd === 'list_trading_plans') return [];
          return null;
        },
      },
    };

    try {
      const tauriService = new PersistenceService(new TauriSqliteAdapter());
      await tauriService.bootstrap();

      assert.equal(setPrefCalls, 2);
      assert.deepEqual(tauriService.getSettingsSync(), { autoSaveWorkspace: false });
      assert.deepEqual(tauriService.getUiPreferenceSync('recent_searches'), ['BTCUSDT']);
      assert.equal(fake.store.has('trawangan_autosave_workspace'), false);
      assert.equal(fake.store.has('trawangan_recent_searches'), false);
      assert.ok(fake.store.has('trawangan_workspace_pending_ws_active'));

      // Bootstrap kedua (mis. instance service baru pada sesi berikutnya) idempoten tanpa migrasi ulang
      const secondSession = new PersistenceService(new TauriSqliteAdapter());
      await secondSession.bootstrap();
      assert.equal(setPrefCalls, 2);
      assert.deepEqual(secondSession.getSettingsSync(), { autoSaveWorkspace: false });
      assert.deepEqual(secondSession.getUiPreferenceSync('recent_searches'), ['BTCUSDT']);
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = prevWindow;
      }
    }
  });

  it('Slice 4d: migrasi standalone trawangan_autosave_workspace & aktivasi preset TS non-Rust (indodax) dari trawangan_providers', async () => {
    const adapter = new MockSqlitePersistenceAdapter({
      initialProviders: [
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: true,
        },
        {
          id: 'hyperliquid',
          name: 'Hyperliquid DEX Perpetuals',
          rest_url: 'https://api.hyperliquid.xyz',
          ws_url: 'wss://api.hyperliquid.xyz/ws',
          is_active: false,
        },
      ],
    });

    const fake = createFakeLocalStorage({
      trawangan_autosave_workspace: 'false',
      trawangan_providers: JSON.stringify([
        {
          id: 'binance',
          name: 'Binance Official Public',
          rest_url: 'https://api.binance.com',
          ws_url: 'wss://stream.binance.com:9443',
          is_active: false,
        },
        {
          id: 'indodax',
          name: 'Indodax Official Spot (IDR)',
          rest_url: 'https://indodax.com',
          ws_url: '',
          is_active: true,
        },
      ]),
    });

    const service = new PersistenceService(adapter);
    await withFakeWindowLocalStorage(fake.api, async () => {
      await service.bootstrap();
    });

    assert.deepEqual(service.getSettingsSync(), { autoSaveWorkspace: false });
    const providers = service.getProvidersSync();
    assert.equal(providers.find((p) => p.id === 'indodax')?.is_active, true);
    assert.equal(providers.find((p) => p.id === 'binance')?.is_active, false);
    assert.equal(fake.store.size, 0);
  });
});
