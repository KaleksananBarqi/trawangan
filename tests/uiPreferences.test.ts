import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import {
  readClampedPanelWidth,
  loadFavoriteIndicatorIds,
  toggleFavoriteIndicatorId,
  loadRecentSymbolSearches,
  recordRecentSymbolSearch,
  clearRecentSymbolSearches,
} from '../src/lib/services/persistence/uiPreferencesHelper';

describe('UI Preferences Helper Seam Suite (#184: Panel Widths, Fav Indicators & Recent Searches)', () => {
  let adapter: InMemoryLocalStorageAdapter;
  let persistence: PersistenceService;

  beforeEach(() => {
    adapter = new InMemoryLocalStorageAdapter();
    persistence = new PersistenceService(adapter);
  });

  it('readClampedPanelWidth membaca dan meng-clamp pine_panel_width, right_panel_width, serta right_plan_width', async () => {
    await adapter.setPreference('pine_panel_width', JSON.stringify(1200));
    await adapter.setPreference('right_panel_width', JSON.stringify(100));
    await adapter.setPreference('right_plan_width', JSON.stringify(440));
    await persistence.bootstrap();

    assert.equal(readClampedPanelWidth('pine_panel_width', 340, 900, persistence), 900);
    assert.equal(readClampedPanelWidth('right_panel_width', 270, 620, persistence), 270);
    assert.equal(readClampedPanelWidth('right_plan_width', 310, 680, persistence), 440);
  });

  it('fav_indicators: memuat daftar favorit pasca-bootstrap dan toggle menambah/menghapus secara persisten', async () => {
    await adapter.setPreference('fav_indicators', JSON.stringify(['rsi', 'macd']));
    const loaded = await loadFavoriteIndicatorIds(persistence);
    assert.deepEqual(loaded, ['rsi', 'macd']);

    const afterAdd = await toggleFavoriteIndicatorId('ema', loaded, persistence);
    assert.deepEqual(afterAdd, ['rsi', 'macd', 'ema']);
    assert.deepEqual(persistence.getUiPreferenceSync<string[]>('fav_indicators'), ['rsi', 'macd', 'ema']);

    const afterRemove = await toggleFavoriteIndicatorId('rsi', afterAdd, persistence);
    assert.deepEqual(afterRemove, ['macd', 'ema']);
    assert.deepEqual(JSON.parse((await adapter.getPreference('fav_indicators')) || '[]'), ['macd', 'ema']);
  });

  it('recent_searches: memuat riwayat, deduplikasi uppercase maks 5 item, dan clear menghapus key via removeUiPreference', async () => {
    await adapter.setPreference('recent_searches', JSON.stringify(['BTCUSDT', 'ETHUSDT']));
    const loaded = await loadRecentSymbolSearches(persistence);
    assert.deepEqual(loaded, ['BTCUSDT', 'ETHUSDT']);

    let current = loaded;
    for (const sym of ['solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'ethusdt']) {
      current = await recordRecentSymbolSearch(sym, current, persistence);
    }

    assert.deepEqual(current, ['ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'BNBUSDT', 'SOLUSDT']);
    assert.deepEqual(
      persistence.getUiPreferenceSync<string[]>('recent_searches'),
      ['ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'BNBUSDT', 'SOLUSDT']
    );

    const cleared = await clearRecentSymbolSearches(persistence);
    assert.deepEqual(cleared, []);
    assert.equal(persistence.getUiPreferenceSync<string[]>('recent_searches'), null);
    assert.equal(await adapter.getPreference('recent_searches'), null);
  });
});
