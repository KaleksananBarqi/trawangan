import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppSettings } from '../src/lib/constants/defaults';
import {
  getLastActiveWorkspaceId,
  setLastActiveWorkspaceId,
} from '../src/lib/services/persistence/workspaceService';

// Mock sederhana localStorage di lingkungan testing headless
const mockStore: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStore[k] || null,
  setItem: (k: string, v: string) => { mockStore[k] = String(v); },
  removeItem: (k: string) => { delete mockStore[k]; },
  clear: () => {
    for (const k in mockStore) delete mockStore[k];
  },
};

describe('Workspace Startup Auto-Load & Persistence Seam', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it('1. resolveAppSettings: menyertakan autoLoadLastWorkspace dengan default true', () => {
    const settings = resolveAppSettings({});
    assert.equal(settings.autoLoadLastWorkspace, true);

    const customSettings = resolveAppSettings({ autoLoadLastWorkspace: false });
    assert.equal(customSettings.autoLoadLastWorkspace, false);
  });

  it('2. getLastActiveWorkspaceId & setLastActiveWorkspaceId: menyimpan dan membaca ID workspace terakhir secara persisten', () => {
    assert.equal(getLastActiveWorkspaceId(), null);

    setLastActiveWorkspaceId('ws_crypto_scalping_123');
    assert.equal(getLastActiveWorkspaceId(), 'ws_crypto_scalping_123');

    setLastActiveWorkspaceId(null);
    assert.equal(getLastActiveWorkspaceId(), null);
  });

  it('3. setLastActiveWorkspaceId: membersihkan ID jika string kosong atau undefined diberikan', () => {
    setLastActiveWorkspaceId('ws_test');
    assert.equal(getLastActiveWorkspaceId(), 'ws_test');

    setLastActiveWorkspaceId('');
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
});

