// Pengujian Unit Layanan Quick Chart Tabs (ChartTabsService)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChartTabsService, type ChartTabsState } from '../chartTabsService';
import type { IPersistenceService, UiPreferenceKey } from '../persistence/types';

function createMockPersistence(initialState: ChartTabsState | null = null) {
  const store = new Map<string, unknown>();
  if (initialState) {
    store.set('chart_tabs_state', initialState);
  }
  let setCalls = 0;

  const mock: Pick<IPersistenceService, 'bootstrap' | 'getUiPreferenceSync' | 'setUiPreference'> = {
    async bootstrap() {},
    getUiPreferenceSync<T>(key: UiPreferenceKey): T | null {
      return (store.get(key) as T) ?? null;
    },
    async setUiPreference<T>(key: UiPreferenceKey, value: T): Promise<void> {
      setCalls += 1;
      store.set(key, value);
    },
  };

  return {
    mock,
    getSavedState: () => store.get('chart_tabs_state') as ChartTabsState | undefined,
    getSetCalls: () => setCalls,
  };
}

describe('ChartTabsService (#227)', () => {
  test('bootstrap membuat 1 tab default ketika storage kosong', async () => {
    const { mock } = createMockPersistence(null);
    const service = new ChartTabsService(mock);

    const state = await service.bootstrap({
      symbol: 'BTCUSDT.P',
      providerId: 'binance',
      timeframe: '15m',
    });

    assert.equal(state.tabs.length, 1);
    assert.equal(state.tabs[0].symbol, 'BTCUSDT.P');
    assert.equal(state.tabs[0].providerId, 'binance');
    assert.equal(state.tabs[0].timeframe, '15m');
    assert.equal(state.activeTabId, state.tabs[0].id);
  });

  test('bootstrap memulihkan state tersimpan dari chart_tabs_state', async () => {
    const saved: ChartTabsState = {
      tabs: [
        { id: 't1', symbol: 'ETHUSDT.P', providerId: 'bitunix', timeframe: '1h' },
        { id: 't2', symbol: 'SOLUSDT', providerId: 'binance', timeframe: '5m' },
      ],
      activeTabId: 't2',
    };
    const { mock } = createMockPersistence(saved);
    const service = new ChartTabsService(mock);

    const state = await service.bootstrap();

    assert.equal(state.tabs.length, 2);
    assert.equal(state.activeTabId, 't2');
    assert.equal(service.getActiveTab().symbol, 'SOLUSDT');
  });

  test('openOrFocusTab memfokuskan tab yang sudah ada alih-alih menduplikasi', async () => {
    const saved: ChartTabsState = {
      tabs: [
        { id: 't1', symbol: 'BTCUSDT.P', providerId: 'binance', timeframe: '15m' },
        { id: 't2', symbol: 'MMTUSDT.P', providerId: 'bitunix', timeframe: '1h' },
      ],
      activeTabId: 't1',
    };
    const { mock, getSavedState } = createMockPersistence(saved);
    const service = new ChartTabsService(mock);
    await service.bootstrap();

    // Buka pasangan yang sama (case-insensitive)
    const focused = service.openOrFocusTab({
      symbol: 'mmtusdt.p',
      providerId: 'BITUNIX',
      timeframe: '4h',
    });

    assert.equal(focused.id, 't2');
    assert.equal(service.getTabs().length, 2);
    assert.equal(service.getState().activeTabId, 't2');
    assert.equal(focused.timeframe, '4h');
    assert.equal(getSavedState()?.activeTabId, 't2');
  });

  test('openOrFocusTab membuat tab baru di kanan jika belum ada', async () => {
    const { mock } = createMockPersistence(null);
    const service = new ChartTabsService(mock);
    await service.bootstrap({ symbol: 'BTCUSDT', providerId: 'binance', timeframe: '15m' });

    const created = service.openOrFocusTab({
      symbol: 'HYPEUSDT.P',
      providerId: 'hyperliquid',
      timeframe: '5m',
    });

    const tabs = service.getTabs();
    assert.equal(tabs.length, 2);
    assert.equal(tabs[1].id, created.id);
    assert.equal(tabs[1].symbol, 'HYPEUSDT.P');
    assert.equal(tabs[1].providerId, 'hyperliquid');
    assert.equal(service.getState().activeTabId, created.id);
  });

  test('syncActiveTab memperbarui simbol, provider, dan timeframe pada tab aktif', async () => {
    const { mock, getSavedState } = createMockPersistence(null);
    const service = new ChartTabsService(mock);
    await service.bootstrap({ symbol: 'BTCUSDT', providerId: 'binance', timeframe: '15m' });

    const updated = service.syncActiveTab({
      symbol: 'SOLUSDT.P',
      providerId: 'bitunix',
      timeframe: '1h',
    });

    assert.ok(updated);
    assert.equal(updated.symbol, 'SOLUSDT.P');
    assert.equal(updated.providerId, 'bitunix');
    assert.equal(updated.timeframe, '1h');
    assert.equal(getSavedState()?.tabs[0].symbol, 'SOLUSDT.P');
  });

  test('addNewTab menambah tab baru dan langsung mengaktifkannya', async () => {
    const { mock } = createMockPersistence(null);
    const service = new ChartTabsService(mock);
    await service.bootstrap({ symbol: 'BTCUSDT', providerId: 'binance', timeframe: '15m' });

    const added = service.addNewTab();

    assert.equal(service.getTabs().length, 2);
    assert.equal(service.getState().activeTabId, added.id);
  });

  test('closeTab menjaga minimal 1 tab tetap ada (guard min 1 tab)', async () => {
    const { mock } = createMockPersistence(null);
    const service = new ChartTabsService(mock);
    const init = await service.bootstrap({ symbol: 'BTCUSDT', providerId: 'binance', timeframe: '15m' });

    // Tidak boleh menutup tab terakhir
    const closedLast = service.closeTab(init.tabs[0].id);
    assert.equal(closedLast, false);
    assert.equal(service.getTabs().length, 1);

    // Tambah tab kedua lalu tutup tab aktif
    const second = service.addNewTab({ symbol: 'ETHUSDT', providerId: 'binance', timeframe: '1h' });
    assert.equal(service.getTabs().length, 2);
    assert.equal(service.getState().activeTabId, second.id);

    const closedSecond = service.closeTab(second.id);
    assert.equal(closedSecond, true);
    assert.equal(service.getTabs().length, 1);
    assert.equal(service.getState().activeTabId, init.tabs[0].id);
  });

  test('reorderTabs menggeser urutan tab dan memvalidasi indeks', async () => {
    const saved: ChartTabsState = {
      tabs: [
        { id: 't1', symbol: 'BTCUSDT', providerId: 'binance', timeframe: '15m' },
        { id: 't2', symbol: 'ETHUSDT', providerId: 'binance', timeframe: '15m' },
        { id: 't3', symbol: 'SOLUSDT', providerId: 'binance', timeframe: '15m' },
      ],
      activeTabId: 't1',
    };
    const { mock } = createMockPersistence(saved);
    const service = new ChartTabsService(mock);
    await service.bootstrap();

    const ok = service.reorderTabs(0, 2);
    assert.equal(ok, true);
    assert.deepEqual(
      service.getTabs().map((t) => t.id),
      ['t2', 't3', 't1']
    );

    // Indeks tidak valid ditolak
    assert.equal(service.reorderTabs(-1, 1), false);
    assert.equal(service.reorderTabs(0, 5), false);
    assert.equal(service.reorderTabs(1, 1), false);
  });
});
