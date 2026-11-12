import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAppSettings } from '../src/lib/constants/defaults';
import { storage } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import {
  getLastActiveWorkspaceId,
  setLastActiveWorkspaceId,
} from '../src/lib/services/persistence/workspaceService';

describe('Workspace Startup Auto-Load & Persistence Seam', () => {
  let adapter: InMemoryLocalStorageAdapter;

  beforeEach(async () => {
    adapter = new InMemoryLocalStorageAdapter();
    storage.setAdapter(adapter);
    await storage.bootstrap();
  });

  it('1. resolveAppSettings: menyertakan autoLoadLastWorkspace dengan default true', () => {
    const settings = resolveAppSettings({});
    assert.equal(settings.autoLoadLastWorkspace, true);

    const customSettings = resolveAppSettings({ autoLoadLastWorkspace: false });
    assert.equal(customSettings.autoLoadLastWorkspace, false);
  });

  it('2. getLastActiveWorkspaceId & setLastActiveWorkspaceId: menyimpan dan membaca ID workspace terakhir secara persisten tanpa localStorage', async () => {
    assert.equal(getLastActiveWorkspaceId(), null);

    await setLastActiveWorkspaceId('ws_crypto_scalping_123');
    assert.equal(getLastActiveWorkspaceId(), 'ws_crypto_scalping_123');

    // Simulasi muat ulang bootstrap dengan adapter yang sama
    storage.setAdapter(adapter);
    await storage.bootstrap();
    assert.equal(getLastActiveWorkspaceId(), 'ws_crypto_scalping_123');

    await setLastActiveWorkspaceId(null);
    assert.equal(getLastActiveWorkspaceId(), null);
  });

  it('3. setLastActiveWorkspaceId: membersihkan ID jika string kosong atau undefined diberikan', async () => {
    await setLastActiveWorkspaceId('ws_test');
    assert.equal(getLastActiveWorkspaceId(), 'ws_test');

    await setLastActiveWorkspaceId('');
    assert.equal(getLastActiveWorkspaceId(), null);

    await setLastActiveWorkspaceId('ws_test_2');
    await setLastActiveWorkspaceId(undefined);
    assert.equal(getLastActiveWorkspaceId(), null);
  });

  it('4. saveWorkspace & loadWorkspaces: menyimpan dan memulihkan proporsi sub-pane dan status skala harga secara utuh', async () => {
    const { saveWorkspace, loadWorkspaces, deleteWorkspace } = await import('../src/lib/services/persistence');

    const testWorkspace = {
      name: 'Scalping Layout Pro',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      providerId: 'indodax',
      paneWeights: [3, 1.25], // Proporsi chart lilin 3, indikator Stochastic 1.25
      priceScaleState: {
        mode: 'price' as const,
        auto: false,
        manualScale: { min: 65000, max: 71000 },
      },
      priceStyle: 'heikinashi',
      barSpacing: 14.5,
      activeRightDockPanel: 'pineIde',
      syncConfig: {
        crosshair: true,
        symbol: false,
        timeframe: true,
        viewport: true,
        drawings: false,
      },
      indicators: [
        {
          title: 'Stochastic Oscillator',
          source: 'pine',
          visible: true,
          inputs: { periodK: 14, periodD: 3, smoothK: 3 },
        },
      ],
    };

    const saved = await saveWorkspace(testWorkspace);
    assert.ok(saved.id);
    assert.equal(saved.name, 'Scalping Layout Pro');
    assert.deepEqual(saved.paneWeights, [3, 1.25]);
    assert.equal(saved.providerId, 'indodax');
    assert.deepEqual(saved.priceScaleState?.manualScale, { min: 65000, max: 71000 });
    assert.equal(saved.priceStyle, 'heikinashi');
    assert.equal(saved.barSpacing, 14.5);
    assert.equal(saved.activeRightDockPanel, 'pineIde');
    assert.equal(saved.syncConfig?.symbol, false);
    assert.equal(saved.syncConfig?.timeframe, true);

    const allWorkspaces = await loadWorkspaces();
    const loaded = allWorkspaces.find((w) => w.id === saved.id);
    assert.ok(loaded);
    assert.deepEqual(loaded.paneWeights, [3, 1.25]);
    assert.equal(loaded.providerId, 'indodax');
    assert.deepEqual(loaded.priceScaleState?.manualScale, { min: 65000, max: 71000 });
    assert.equal(loaded.priceStyle, 'heikinashi');
    assert.equal(loaded.barSpacing, 14.5);
    assert.equal(loaded.activeRightDockPanel, 'pineIde');

    // Bersihkan
    await deleteWorkspace(saved.id);
  });

  it('5. Tiket #182: +page.svelte membaca/menyimpan appSettings & autoSaveWorkspace via PersistenceService tanpa localStorage', () => {
    const pageSrc = fs.readFileSync(path.resolve('src/routes/+page.svelte'), 'utf8');
    assert.ok(pageSrc.includes('storage.bootstrap()'), '+page.svelte harus memanggil storage.bootstrap()');
    assert.ok(pageSrc.includes('storage.getSettingsSync()'), '+page.svelte harus membaca appSettings via storage.getSettingsSync()');
    assert.ok(pageSrc.includes('storage.saveSettings('), '+page.svelte harus menyimpan appSettings via storage.saveSettings(...)');
    assert.equal(pageSrc.includes('trawangan_app_settings'), false, '+page.svelte tidak boleh membaca/menulis trawangan_app_settings di localStorage');
    assert.equal(pageSrc.includes('trawangan_autosave_workspace'), false, '+page.svelte tidak boleh membaca/menulis trawangan_autosave_workspace di localStorage');
  });
});

