import { describe, test } from 'node:test';
import assert from 'node:assert';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { TauriSqliteAdapter, type TauriInvokeFn } from '../src/lib/services/persistence/tauriSqliteAdapter';

/**
 * Helper lokal untuk memasang mock globalThis.localStorage dan mencatat setiap aksesnya.
 */
async function withTrackedLocalStorage(
  initialEntries: Record<string, string>,
  fn: (calls: string[]) => Promise<void>
): Promise<void> {
  const prevLocalStorage = (globalThis as any).localStorage;
  const store = new Map<string, string>(Object.entries(initialEntries));
  const calls: string[] = [];

  (globalThis as any).localStorage = {
    get length() {
      calls.push('length');
      return store.size;
    },
    key(index: number) {
      calls.push(`key:${index}`);
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      calls.push(`getItem:${key}`);
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      calls.push(`setItem:${key}`);
      store.set(key, value);
    },
    removeItem(key: string) {
      calls.push(`removeItem:${key}`);
      store.delete(key);
    },
    clear() {
      calls.push('clear');
      store.clear();
    },
  };

  try {
    await fn(calls);
  } finally {
    if (prevLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = prevLocalStorage;
    }
  }
}

describe('TauriSqliteAdapter (Mocked invokeFn & Fail-Loud Semantics)', () => {
  test('Drawings & clone: mengirim IPC command/payload tepat, mempertahankan "", dan fail-loud tanpa menyentuh localStorage', async () => {
    const invoked: Array<{ cmd: string; args: unknown }> = [];

    await withTrackedLocalStorage(
      {
        'trawangan_drawings_BTCUSDT_15m': '{"shapes":[{"id":"ghost-ls"}]}',
      },
      async (lsCalls) => {
        const mockInvoke: TauriInvokeFn = (async (cmd: string, args?: unknown) => {
          invoked.push({ cmd, args });
          if (cmd === 'load_chart_drawings') {
            const payload = args as { symbol: string; timeframe: string };
            if (payload.symbol === 'EMPTY') return '';
            if (payload.symbol === 'MISSING') return null;
            return '{"shapes":[{"id":"sqlite-1"}]}';
          }
          if (cmd === 'clone_workspace_drawings') return 3;
          return undefined;
        }) as TauriInvokeFn;

        const adapter = new TauriSqliteAdapter(mockInvoke);

        assert.strictEqual(await adapter.loadDrawings('BTCUSDT', '15m'), '{"shapes":[{"id":"sqlite-1"}]}');
        assert.strictEqual(await adapter.loadDrawings('EMPTY', '1h'), '');
        assert.strictEqual(await adapter.loadDrawings('MISSING', '1h'), null);

        await adapter.saveDrawings('BTCUSDT', '15m', '{"shapes":[]}');
        await adapter.clearDrawings('BTCUSDT', '15m');
        const cloned = await adapter.cloneWorkspaceDrawings('ws_a', 'ws_b');
        assert.strictEqual(cloned, 3);

        assert.deepStrictEqual(invoked, [
          { cmd: 'load_chart_drawings', args: { symbol: 'BTCUSDT', timeframe: '15m' } },
          { cmd: 'load_chart_drawings', args: { symbol: 'EMPTY', timeframe: '1h' } },
          { cmd: 'load_chart_drawings', args: { symbol: 'MISSING', timeframe: '1h' } },
          { cmd: 'save_chart_drawings', args: { symbol: 'BTCUSDT', timeframe: '15m', dataJson: '{"shapes":[]}' } },
          { cmd: 'clear_chart_drawings', args: { symbol: 'BTCUSDT', timeframe: '15m' } },
          { cmd: 'clone_workspace_drawings', args: { fromWsId: 'ws_a', toWsId: 'ws_b' } },
        ]);

        // Saat invoke gagal, seluruh operasi drawings wajib fail-loud tanpa fallback ke localStorage
        const failingInvoke: TauriInvokeFn = (async () => {
          throw new Error('SQLITE_BUSY: database is locked');
        }) as TauriInvokeFn;
        const failingAdapter = new TauriSqliteAdapter(failingInvoke);

        await assert.rejects(() => failingAdapter.loadDrawings('BTCUSDT', '15m'), /SQLITE_BUSY/);
        await assert.rejects(() => failingAdapter.saveDrawings('BTCUSDT', '15m', '{}'), /SQLITE_BUSY/);
        await assert.rejects(() => failingAdapter.clearDrawings('BTCUSDT', '15m'), /SQLITE_BUSY/);
        await assert.rejects(() => failingAdapter.cloneWorkspaceDrawings('ws_a', 'ws_b'), /SQLITE_BUSY/);

        assert.deepStrictEqual(lsCalls, [], 'TauriSqliteAdapter tidak boleh membaca atau menulis localStorage');
      }
    );
  });

  test('Watchlist & Registry: proyeksi [] yang sah dipertahankan dan error IPC fail-loud tanpa fallback localStorage', async () => {
    const invoked: Array<{ cmd: string; args: unknown }> = [];
    let currentRegistry: Record<string, unknown> | null = {
      activeWatchlistId: 'empty_wl',
      watchlists: [
        {
          id: 'empty_wl',
          name: 'Kosong Eksplisit',
          items: ['#section:sec_1:Hanya Seksi:0'],
          isPreset: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    };

    await withTrackedLocalStorage(
      {
        trawangan_user_watchlist: JSON.stringify(['DOGEUSDT']),
        trawangan_watchlist_registry: JSON.stringify({
          activeWatchlistId: 'ghost',
          watchlists: [{ id: 'ghost', name: 'Ghost', items: ['SHIBUSDT'], isPreset: false, createdAt: 1, updatedAt: 1 }],
        }),
      },
      async (lsCalls) => {
        const mockInvoke: TauriInvokeFn = (async (cmd: string, args?: unknown) => {
          invoked.push({ cmd, args });
          if (cmd === 'load_watchlist_registry') {
            return currentRegistry;
          }
          if (cmd === 'save_watchlist_registry') {
            const payload = args as { registryJson: string };
            currentRegistry = JSON.parse(payload.registryJson);
            return null;
          }
          return null;
        }) as TauriInvokeFn;

        const adapter = new TauriSqliteAdapter(mockInvoke);

        // Watchlist aktif dengan 0 simbol harus mengembalikan [] (bukan null)
        assert.deepStrictEqual(await adapter.loadWatchlist(), []);

        // Jika registry belum ada (null), loadWatchlist() dan loadWatchlistRegistry() mengembalikan null
        currentRegistry = null;
        assert.strictEqual(await adapter.loadWatchlistRegistry(), null);
        assert.strictEqual(await adapter.loadWatchlist(), null);

        // saveWatchlist saat registry belum ada membuat registry default dan mengirim save_watchlist_registry
        await adapter.saveWatchlist(['BTCUSDT', 'ETHUSDT']);
        assert.deepStrictEqual(await adapter.loadWatchlist(), ['BTCUSDT', 'ETHUSDT']);

        // saveWatchlistRegistry mengirim registryJson ter-serialize
        await adapter.saveWatchlistRegistry({
          activeWatchlistId: 'custom',
          watchlists: [
            { id: 'custom', name: 'Custom', items: [], isPreset: false, createdAt: 2000, updatedAt: 2000 },
          ],
        });
        assert.deepStrictEqual(await adapter.loadWatchlist(), []);

        assert.ok(invoked.some((c) => c.cmd === 'save_watchlist_registry'));

        // Fail-loud saat load_watchlist_registry atau save_watchlist_registry reject
        const failingLoadInvoke: TauriInvokeFn = (async () => {
          throw new Error('IPC_READ_FAIL');
        }) as TauriInvokeFn;
        const failingLoadAdapter = new TauriSqliteAdapter(failingLoadInvoke);

        await assert.rejects(() => failingLoadAdapter.loadWatchlist(), /IPC_READ_FAIL/);
        await assert.rejects(() => failingLoadAdapter.loadWatchlistRegistry(), /IPC_READ_FAIL/);
        await assert.rejects(() => failingLoadAdapter.saveWatchlist(['SOLUSDT']), /IPC_READ_FAIL/);

        const failingSaveInvoke: TauriInvokeFn = (async (cmd: string) => {
          if (cmd === 'load_watchlist_registry') return null;
          throw new Error('IPC_WRITE_FAIL');
        }) as TauriInvokeFn;
        const failingSaveAdapter = new TauriSqliteAdapter(failingSaveInvoke);

        await assert.rejects(() => failingSaveAdapter.saveWatchlist(['SOLUSDT']), /IPC_WRITE_FAIL/);
        await assert.rejects(
          () =>
            failingSaveAdapter.saveWatchlistRegistry({
              activeWatchlistId: 'default',
              watchlists: [],
            }),
          /IPC_WRITE_FAIL/
        );

        assert.deepStrictEqual(lsCalls, [], 'Operasi watchlist SQLite tidak boleh menyentuh localStorage');
      }
    );
  });

  test('Pine Scripts: mengirim command/payload tepat, mengembalikan [] jika kosong, dan fail-loud tanpa fallback localStorage', async () => {
    const invoked: Array<{ cmd: string; args: unknown }> = [];
    const sampleScript = {
      id: 'pine_1',
      title: 'EMA Cross',
      code: '//@version=6\nindicator("EMA")',
      is_overlay: true,
      created_at: 1000,
      updated_at: 2000,
    };

    await withTrackedLocalStorage(
      {
        trawangan_scripts: JSON.stringify([{ ...sampleScript, id: 'ghost_script' }]),
      },
      async (lsCalls) => {
        let returnEmpty = true;
        const mockInvoke: TauriInvokeFn = (async (cmd: string, args?: unknown) => {
          invoked.push({ cmd, args });
          if (cmd === 'get_saved_scripts') {
            return returnEmpty ? [] : [sampleScript];
          }
          return undefined;
        }) as TauriInvokeFn;

        const adapter = new TauriSqliteAdapter(mockInvoke);
        assert.deepStrictEqual(await adapter.loadScripts(), []);

        returnEmpty = false;
        assert.deepStrictEqual(await adapter.loadScripts(), [sampleScript]);
        await adapter.saveScript(sampleScript);
        await adapter.deleteScript('pine_1');

        assert.deepStrictEqual(invoked, [
          { cmd: 'get_saved_scripts', args: undefined },
          { cmd: 'get_saved_scripts', args: undefined },
          { cmd: 'save_script', args: { script: sampleScript } },
          { cmd: 'delete_script', args: { id: 'pine_1' } },
        ]);

        const failingAdapter = new TauriSqliteAdapter((async () => {
          throw new Error('SCRIPT_IPC_ERR');
        }) as TauriInvokeFn);

        await assert.rejects(() => failingAdapter.loadScripts(), /SCRIPT_IPC_ERR/);
        await assert.rejects(() => failingAdapter.saveScript(sampleScript), /SCRIPT_IPC_ERR/);
        await assert.rejects(() => failingAdapter.deleteScript('pine_1'), /SCRIPT_IPC_ERR/);

        assert.strictEqual('fallbackAdapter' in adapter, false, 'fallbackAdapter harus dihapus dari TauriSqliteAdapter');
        assert.deepStrictEqual(lsCalls, [], 'Operasi Pine scripts SQLite tidak boleh menyentuh localStorage');
      }
    );
  });

  test('Workspaces, Alerts, Trading Plans, Preferences, dan Providers: exact IPC command/args, retensi ""/[]/null, dan fail-loud', async () => {
    const invoked: Array<{ cmd: string; args: unknown }> = [];
    const sampleWorkspace = {
      id: 'ws_1',
      name: 'Main',
      schemaVersion: 2,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      indicators: [],
      providerId: 'binance',
      timestamp: 1000,
    };
    const sampleAlert = {
      id: 'alt_1',
      symbol: 'BTCUSDT',
      targetPrice: 70000,
      condition: 'crossing' as const,
      frequency: 'once' as const,
      label: 'Breakout',
      active: true,
      triggered: false,
      createdAt: 1000,
    };
    const samplePlan = {
      id: 'plan_1',
      symbol: 'BTCUSDT',
      providerId: 'binance',
      timeframe: '15m',
      createdAt: 1000,
      updatedAt: 1000,
      rawText: 'LONG BTC',
      plan: {
        bias: 'LONG',
        entry: 65000,
        stopLoss: 64000,
        targets: [{ price: 68000, label: 'TP1' }],
      },
    };
    const sampleProvider = {
      id: 'custom-1',
      name: 'Custom Node',
      rest_url: 'https://node.example.com',
      ws_url: '',
      is_active: false,
    };

    await withTrackedLocalStorage(
      {
        trawangan_workspaces: JSON.stringify([{ id: 'ghost_ws', name: 'Ghost' }]),
        trawangan_pref_app_settings: '{"theme":"light"}',
      },
      async (lsCalls) => {
        const mockInvoke: TauriInvokeFn = (async (cmd: string, args?: unknown) => {
          invoked.push({ cmd, args });
          if (cmd === 'list_workspaces') {
            return [JSON.stringify(sampleWorkspace), '{CORRUPT_JSON', JSON.stringify(null)];
          }
          if (cmd === 'list_price_alerts') return [];
          if (cmd === 'list_trading_plans') return [samplePlan];
          if (cmd === 'get_app_preference') {
            const payload = args as { key: string };
            if (payload.key === 'app_settings') return '';
            if (payload.key === 'chart_default_config') return undefined;
            return null;
          }
          if (cmd === 'load_all_app_preferences') {
            return [{ key: 'app_settings', value_json: '', updated_at: 123 }];
          }
          if (cmd === 'get_data_providers') return [sampleProvider];
          return undefined;
        }) as TauriInvokeFn;

        const adapter = new TauriSqliteAdapter(mockInvoke);

        // Workspaces (baris JSON korup dan null diskip tanpa menelan error IPC)
        const workspaces = await adapter.listWorkspaces();
        assert.strictEqual(workspaces.length, 1);
        assert.strictEqual(workspaces[0].id, 'ws_1');
        await adapter.upsertWorkspace(sampleWorkspace as any);
        await adapter.deleteWorkspace('ws_1');

        // Alerts
        assert.deepStrictEqual(await adapter.listAlerts(), []);
        await adapter.replaceAlerts([sampleAlert]);

        // Trading Plans
        assert.deepStrictEqual(await adapter.listTradingPlans(), [samplePlan]);
        await adapter.upsertTradingPlan(samplePlan as any);
        await adapter.deleteTradingPlan('plan_1');
        await adapter.clearTradingPlans();

        // Preferences (retensi "" dan normalisasi undefined -> null)
        assert.strictEqual(await adapter.getPreference('app_settings'), '');
        assert.strictEqual(await adapter.getPreference('chart_default_config'), null);
        assert.strictEqual(await adapter.getPreference('last_active_workspace_id'), null);
        await adapter.setPreference('app_settings', '{}');
        await adapter.deletePreference('app_settings');
        assert.deepStrictEqual(await adapter.loadAllPreferences(), [
          { key: 'app_settings', value_json: '', updated_at: 123 },
        ]);

        // Providers
        assert.deepStrictEqual(await adapter.loadProviders(), [sampleProvider]);
        await adapter.saveProvider(sampleProvider);
        await adapter.setActiveProvider('custom-1');
        await adapter.deleteProvider('custom-1');

        assert.deepStrictEqual(invoked, [
          { cmd: 'list_workspaces', args: undefined },
          { cmd: 'upsert_workspace', args: { workspaceJson: JSON.stringify(sampleWorkspace) } },
          { cmd: 'delete_workspace', args: { id: 'ws_1' } },
          { cmd: 'list_price_alerts', args: undefined },
          { cmd: 'replace_price_alerts', args: { alertsJson: JSON.stringify([sampleAlert]) } },
          { cmd: 'list_trading_plans', args: undefined },
          { cmd: 'upsert_trading_plan', args: { planRecordJson: JSON.stringify(samplePlan) } },
          { cmd: 'delete_trading_plan', args: { id: 'plan_1' } },
          { cmd: 'clear_trading_plans', args: undefined },
          { cmd: 'get_app_preference', args: { key: 'app_settings' } },
          { cmd: 'get_app_preference', args: { key: 'chart_default_config' } },
          { cmd: 'get_app_preference', args: { key: 'last_active_workspace_id' } },
          { cmd: 'set_app_preference', args: { key: 'app_settings', valueJson: '{}' } },
          { cmd: 'delete_app_preference', args: { key: 'app_settings' } },
          { cmd: 'load_all_app_preferences', args: undefined },
          { cmd: 'get_data_providers', args: undefined },
          { cmd: 'add_or_update_provider', args: { provider: sampleProvider } },
          { cmd: 'set_active_data_provider', args: { id: 'custom-1' } },
          { cmd: 'delete_data_provider', args: { id: 'custom-1' } },
        ]);

        // Fail-loud untuk seluruh metode domain saat invoke reject
        const failingAdapter = new TauriSqliteAdapter((async () => {
          throw new Error('SQLITE_IOERR');
        }) as TauriInvokeFn);

        await assert.rejects(() => failingAdapter.listWorkspaces(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.upsertWorkspace(sampleWorkspace as any), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.deleteWorkspace('ws_1'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.listAlerts(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.replaceAlerts([sampleAlert]), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.listTradingPlans(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.upsertTradingPlan(samplePlan as any), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.deleteTradingPlan('plan_1'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.clearTradingPlans(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.getPreference('app_settings'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.setPreference('app_settings', '{}'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.deletePreference('app_settings'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.loadAllPreferences(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.loadProviders(), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.saveProvider(sampleProvider), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.setActiveProvider('custom-1'), /SQLITE_IOERR/);
        await assert.rejects(() => failingAdapter.deleteProvider('custom-1'), /SQLITE_IOERR/);

        assert.deepStrictEqual(lsCalls, [], 'Tidak boleh ada operasi SQLite yang menyentuh localStorage');
      }
    );
  });

  test('Konstruktor default (tanpa invokeFn): jembatan @tauri-apps/api/core via window.__TAURI_INTERNALS__.invoke bekerja dan fail-loud tanpa localStorage', async () => {
    const prevWindow = (globalThis as any).window;
    const bridgeCalls: Array<{ cmd: string; args: unknown }> = [];
    let shouldFail = false;

    await withTrackedLocalStorage(
      {
        trawangan_drawings_BTCUSDT_15m: '{"shapes":[{"id":"ghost"}]}',
        trawangan_user_watchlist: JSON.stringify(['DOGEUSDT']),
      },
      async (lsCalls) => {
        (globalThis as any).window = {
          __TAURI_INTERNALS__: {
            invoke: async (cmd: string, args?: unknown) => {
              bridgeCalls.push({ cmd, args });
              if (shouldFail) {
                throw new Error('TAURI_BRIDGE_REJECTED');
              }
              if (cmd === 'load_chart_drawings') return '';
              if (cmd === 'load_watchlist_registry') {
                return {
                  activeWatchlistId: 'default',
                  watchlists: [
                    {
                      id: 'default',
                      name: 'Kosong',
                      items: [],
                      isPreset: false,
                      createdAt: 1000,
                      updatedAt: 1000,
                    },
                  ],
                };
              }
              return null;
            },
          },
        };

        try {
          const adapter = new TauriSqliteAdapter();
          const service = new PersistenceService(adapter);

          assert.strictEqual(await adapter.loadDrawings('BTCUSDT', '15m'), '');
          assert.deepStrictEqual(await service.loadWatchlist(), []);
          assert.deepStrictEqual(bridgeCalls, [
            { cmd: 'load_chart_drawings', args: { symbol: 'BTCUSDT', timeframe: '15m' } },
            { cmd: 'load_watchlist_registry', args: {} },
          ]);

          shouldFail = true;
          await assert.rejects(() => adapter.loadDrawings('BTCUSDT', '15m'), /TAURI_BRIDGE_REJECTED/);
          await assert.rejects(() => service.loadWatchlist(), /TAURI_BRIDGE_REJECTED/);

          assert.deepStrictEqual(lsCalls, [], 'Jalur default TauriSqliteAdapter tidak boleh menyentuh localStorage');
        } finally {
          if (prevWindow === undefined) {
            delete (globalThis as any).window;
          } else {
            (globalThis as any).window = prevWindow;
          }
        }
      }
    );
  });
});
