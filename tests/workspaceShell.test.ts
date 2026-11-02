import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkspaceShellService } from '../src/lib/services/workspaceShellService';

const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      memoryStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete memoryStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
    },
  };
}

describe('WorkspaceShell Deep Module Suite (#154: Unified Left Rail, Right Dock & Mode)', () => {
  let shell: WorkspaceShellService;

  beforeEach(() => {
    localStorage.clear();
    shell = new WorkspaceShellService();
    shell.resetState();
  });

  describe('1. Initial State & Defaults', () => {
    it('menginisialisasi rel kiri terbuka, dock kanan terbuka di watchlist, dan mode terminal', () => {
      const snap = shell.getSnapshot();
      assert.strictEqual(snap.isLeftRailCollapsed, false);
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'watchlist');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'watchlist');
      assert.strictEqual(snap.workspaceMode, 'terminal');
    });
  });

  describe('2. Left Toolbar Rail State & Persistence', () => {
    it('toggleLeftRail: membalik status collapse rel kiri dan memperbarui localStorage', () => {
      shell.toggleLeftRail();
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, true);
      assert.strictEqual(localStorage.getItem('trawangan_left_rail_collapsed'), 'true');

      shell.toggleLeftRail();
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, false);
      assert.strictEqual(localStorage.getItem('trawangan_left_rail_collapsed'), 'false');
    });

    it('setLeftRailCollapsed: menetapkan status collapse rel kiri secara eksplisit', () => {
      shell.setLeftRailCollapsed(true);
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, true);

      shell.setLeftRailCollapsed(false);
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, false);
    });
  });

  describe('3. Right Dock Rail State, Tabs & Persistence', () => {
    it('toggleRightDockTab: mengganti tab aktif jika tab berbeda diklik', () => {
      shell.toggleRightDockTab('alerts');
      let snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'alerts');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'alerts');

      shell.toggleRightDockTab('objects');
      snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'objects');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'objects');
    });

    it('Click-to-Close: mengklik tab aktif yang sedang terbuka akan menutup drawer panel', () => {
      shell.toggleRightDockTab('watchlist');
      const snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, false);
      assert.strictEqual(snap.activeRightDockTab, null);
      assert.strictEqual(snap.lastOpenedRightDockTab, 'watchlist');
    });

    it('openRightDockTab: membuka drawer ke tab yang ditentukan', () => {
      shell.closeRightDock();
      assert.strictEqual(shell.getSnapshot().isRightDockOpen, false);

      shell.openRightDockTab('alerts');
      const snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'alerts');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'alerts');
    });

    it('closeRightDock: menutup dock kanan secara deterministik', () => {
      shell.closeRightDock();
      const snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, false);
      assert.strictEqual(snap.activeRightDockTab, null);
    });

    it('toggleRightDockHider: membuka kembali tab terakhir atau menutup jika terbuka', () => {
      shell.openRightDockTab('objects');
      shell.toggleRightDockHider();
      let snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, false);
      assert.strictEqual(snap.lastOpenedRightDockTab, 'objects');

      shell.toggleRightDockHider();
      snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'objects');
    });

    it('menyimpan status dock kanan ke localStorage dalam format terstruktur', () => {
      shell.openRightDockTab('alerts');
      const raw = localStorage.getItem('trawangan_right_dock_state');
      assert.ok(raw);
      const parsed = JSON.parse(raw!);
      assert.strictEqual(parsed.isOpen, true);
      assert.strictEqual(parsed.activeTab, 'alerts');
      assert.strictEqual(parsed.lastOpenedTab, 'alerts');
    });
  });

  describe('4. Workspace Mode Transitions', () => {
    it('setWorkspaceMode: mengubah mode antara terminal dan pine', () => {
      shell.setWorkspaceMode('pine');
      assert.strictEqual(shell.getSnapshot().workspaceMode, 'pine');

      shell.setWorkspaceMode('terminal');
      assert.strictEqual(shell.getSnapshot().workspaceMode, 'terminal');
    });

    it('toggleWorkspaceMode: membalik mode workspace secara siklis', () => {
      shell.toggleWorkspaceMode();
      assert.strictEqual(shell.getSnapshot().workspaceMode, 'pine');

      shell.toggleWorkspaceMode();
      assert.strictEqual(shell.getSnapshot().workspaceMode, 'terminal');
    });
  });

  describe('5. Unified Subscription Lifecycle', () => {
    it('memberitahu listener saat rel kiri atau dock kanan berubah', () => {
      let callCount = 0;
      let lastSnap = shell.getSnapshot();

      const unsub = shell.subscribe((s) => {
        callCount++;
        lastSnap = s;
      });

      shell.toggleLeftRail();
      assert.strictEqual(callCount, 1);
      assert.strictEqual(lastSnap.isLeftRailCollapsed, true);

      shell.toggleRightDockTab('alerts');
      assert.strictEqual(callCount, 2);
      assert.strictEqual(lastSnap.activeRightDockTab, 'alerts');

      shell.setWorkspaceMode('pine');
      assert.strictEqual(callCount, 3);
      assert.strictEqual(lastSnap.workspaceMode, 'pine');

      unsub();
      shell.toggleLeftRail();
      assert.strictEqual(callCount, 3);
    });
  });

  describe('6. Persistence Restoration on Fresh Instance', () => {
    it('memulihkan status dari localStorage saat instansiasi baru', () => {
      localStorage.setItem('trawangan_left_rail_collapsed', 'true');
      localStorage.setItem(
        'trawangan_right_dock_state',
        JSON.stringify({
          isOpen: true,
          activeTab: 'objects',
          lastOpenedTab: 'objects',
        })
      );

      const restoredShell = new WorkspaceShellService();
      const snap = restoredShell.getSnapshot();
      assert.strictEqual(snap.isLeftRailCollapsed, true);
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'objects');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'objects');
    });
  });
});
