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
});
