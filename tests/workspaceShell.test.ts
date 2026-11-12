import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkspaceShellService } from '../src/lib/services/workspaceShellService';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

describe('WorkspaceShell Deep Module Suite (#154 & #184: Unified Left Rail, Right Dock & Mode)', () => {
  let adapter: InMemoryLocalStorageAdapter;
  let persistence: PersistenceService;
  let shell: WorkspaceShellService;

  beforeEach(() => {
    adapter = new InMemoryLocalStorageAdapter();
    persistence = new PersistenceService(adapter);
    shell = new WorkspaceShellService(persistence);
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
    it('toggleLeftRail: membalik status collapse rel kiri dan memperbarui PersistenceService (left_rail_collapsed)', () => {
      shell.toggleLeftRail();
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, true);
      assert.strictEqual(persistence.getUiPreferenceSync<boolean>('left_rail_collapsed'), true);

      shell.toggleLeftRail();
      assert.strictEqual(shell.getSnapshot().isLeftRailCollapsed, false);
      assert.strictEqual(persistence.getUiPreferenceSync<boolean>('left_rail_collapsed'), false);
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

      shell.toggleRightDockTab('plan');
      snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'plan');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'plan');
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

      shell.closeRightDock();
      shell.openRightDockTab('plan');
      const planSnap = shell.getSnapshot();
      assert.strictEqual(planSnap.isRightDockOpen, true);
      assert.strictEqual(planSnap.activeRightDockTab, 'plan');
      assert.strictEqual(planSnap.lastOpenedRightDockTab, 'plan');
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

    it('menyimpan status dock kanan ke PersistenceService (right_dock_state) dalam format terstruktur', async () => {
      shell.openRightDockTab('alerts');
      const cached = persistence.getUiPreferenceSync<{
        isOpen: boolean;
        activeTab: string | null;
        lastOpenedTab: string;
      }>('right_dock_state');
      assert.ok(cached);
      assert.strictEqual(cached!.isOpen, true);
      assert.strictEqual(cached!.activeTab, 'alerts');
      assert.strictEqual(cached!.lastOpenedTab, 'alerts');

      // Pastikan juga tersimpan ke adapter persisten di balik PersistenceService
      await new Promise((r) => setTimeout(r, 0));
      const persistedRaw = await adapter.getPreference('right_dock_state');
      assert.ok(persistedRaw);
      const persisted = JSON.parse(persistedRaw!);
      assert.strictEqual(persisted.activeTab, 'alerts');
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

  describe('6. Persistence Restoration on Fresh Instance & Post-Bootstrap Hydration', () => {
    it('memulihkan status dari PersistenceService saat instansiasi baru pasca-bootstrap', async () => {
      await adapter.setPreference('left_rail_collapsed', JSON.stringify(true));
      await adapter.setPreference(
        'right_dock_state',
        JSON.stringify({
          isOpen: true,
          activeTab: 'objects',
          lastOpenedTab: 'objects',
        })
      );

      const freshPersistence = new PersistenceService(adapter);
      await freshPersistence.bootstrap();

      const restoredShell = new WorkspaceShellService(freshPersistence);
      const snap = restoredShell.getSnapshot();
      assert.strictEqual(snap.isLeftRailCollapsed, true);
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'objects');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'objects');
    });

    it('memulihkan tab plan dan memberitahu subscriber via reloadFromPersistence() setelah bootstrap', async () => {
      await adapter.setPreference('left_rail_collapsed', JSON.stringify(true));
      await adapter.setPreference(
        'right_dock_state',
        JSON.stringify({
          isOpen: true,
          activeTab: 'plan',
          lastOpenedTab: 'plan',
        })
      );

      const delayedPersistence = new PersistenceService(adapter);
      const preBootstrapShell = new WorkspaceShellService(delayedPersistence);
      // Sebelum bootstrap: jatuh ke default aman tanpa menyentuh global localStorage
      assert.strictEqual(preBootstrapShell.getSnapshot().activeRightDockTab, 'watchlist');
      assert.strictEqual(preBootstrapShell.getSnapshot().isLeftRailCollapsed, false);

      let notifiedSnap = preBootstrapShell.getSnapshot();
      let notifyCount = 0;
      preBootstrapShell.subscribe((s) => {
        notifyCount += 1;
        notifiedSnap = s;
      });

      await delayedPersistence.bootstrap();
      preBootstrapShell.reloadFromPersistence();

      assert.strictEqual(notifyCount, 1);
      assert.strictEqual(notifiedSnap.isLeftRailCollapsed, true);
      assert.strictEqual(notifiedSnap.isRightDockOpen, true);
      assert.strictEqual(notifiedSnap.activeRightDockTab, 'plan');
      assert.strictEqual(notifiedSnap.lastOpenedRightDockTab, 'plan');
    });
  });
});
