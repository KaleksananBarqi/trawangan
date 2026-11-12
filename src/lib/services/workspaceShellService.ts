import type { WorkspaceMode } from '../types/market';
import { storage } from './persistence';
import type { IPersistenceService } from './persistence/types';

export type RightDockTab = 'watchlist' | 'alerts' | 'objects' | 'plan';
export type { WorkspaceMode };

interface PersistedRightDockState {
  isOpen: boolean;
  activeTab: RightDockTab | null;
  lastOpenedTab: RightDockTab;
}

const VALID_RIGHT_DOCK_TABS: ReadonlySet<RightDockTab> = new Set([
  'watchlist',
  'alerts',
  'objects',
  'plan',
]);

function isValidRightDockTab(tab: unknown): tab is RightDockTab {
  return typeof tab === 'string' && VALID_RIGHT_DOCK_TABS.has(tab as RightDockTab);
}

export interface WorkspaceShellState {
  isLeftRailCollapsed: boolean;
  isRightDockOpen: boolean;
  activeRightDockTab: RightDockTab | null;
  lastOpenedRightDockTab: RightDockTab;
  workspaceMode: WorkspaceMode;
}

/**
 * Modul Tunggal (Deep Module) Pengelola Shell Tata Letak Workspace Trawangan
 *
 * Mengenkapsulasi status rel bilah gambar kiri (drawing toolbar),
 * dock panel kanan (watchlist, alerts, object tree), serta mode tampilan terminal/pine.
 * Menghilangkan duplikasi listener dan menyatukan logika persistensi via PersistenceService.
 */
export class WorkspaceShellService {
  private state: WorkspaceShellState = {
    isLeftRailCollapsed: false,
    isRightDockOpen: true,
    activeRightDockTab: 'watchlist',
    lastOpenedRightDockTab: 'watchlist',
    workspaceMode: 'terminal',
  };

  private listeners: Set<(state: WorkspaceShellState) => void> = new Set();
  private persistence: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'>;

  constructor(persistence: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'> = storage) {
    this.persistence = persistence;
    this.loadPersistence();
  }

  private loadPersistence() {
    try {
      const savedLeft = this.persistence.getUiPreferenceSync<boolean | string>('left_rail_collapsed');
      if (savedLeft !== null) {
        this.state.isLeftRailCollapsed = typeof savedLeft === 'boolean' ? savedLeft : savedLeft === 'true';
      }
    } catch (_) {}

    try {
      const savedRight = this.persistence.getUiPreferenceSync<PersistedRightDockState>('right_dock_state');
      if (savedRight && typeof savedRight.isOpen === 'boolean') {
        // Sanitasi nilai tab tersimpan agar data lama/rusak tetap jatuh aman ke 'watchlist'
        const lastOpened = isValidRightDockTab(savedRight.lastOpenedTab)
          ? savedRight.lastOpenedTab
          : 'watchlist';
        const active = isValidRightDockTab(savedRight.activeTab) ? savedRight.activeTab : lastOpened;
        this.state.isRightDockOpen = savedRight.isOpen;
        this.state.lastOpenedRightDockTab = lastOpened;
        this.state.activeRightDockTab = savedRight.isOpen ? active : null;
      }
    } catch (_) {}
  }

  /**
   * Memuat ulang state shell dari cache PersistenceService setelah startup bootstrap() selesai.
   */
  public reloadFromPersistence(): void {
    this.loadPersistence();
    this.notify();
  }

  private savePersistence() {
    void this.persistence
      .setUiPreference('left_rail_collapsed', this.state.isLeftRailCollapsed)
      .catch(() => {});
    void this.persistence
      .setUiPreference<PersistedRightDockState>('right_dock_state', {
        isOpen: this.state.isRightDockOpen,
        activeTab: this.state.activeRightDockTab,
        lastOpenedTab: this.state.lastOpenedRightDockTab,
      })
      .catch(() => {});
  }

  public getSnapshot(): WorkspaceShellState {
    return { ...this.state };
  }

  public resetState() {
    this.state = {
      isLeftRailCollapsed: false,
      isRightDockOpen: true,
      activeRightDockTab: 'watchlist',
      lastOpenedRightDockTab: 'watchlist',
      workspaceMode: 'terminal',
    };
    this.notify();
  }

  // --- Kontrol Rel Gambar Kiri (Left Rail) ---

  public toggleLeftRail() {
    this.state.isLeftRailCollapsed = !this.state.isLeftRailCollapsed;
    this.savePersistence();
    this.notify();
  }

  public setLeftRailCollapsed(collapsed: boolean) {
    if (this.state.isLeftRailCollapsed !== collapsed) {
      this.state.isLeftRailCollapsed = collapsed;
      this.savePersistence();
      this.notify();
    }
  }

  // --- Kontrol Dock Kanan (Right Dock) ---

  public toggleRightDockTab(tab: RightDockTab) {
    if (this.state.isRightDockOpen && this.state.activeRightDockTab === tab) {
      // Klik pada tab yang sedang aktif akan melipat drawer
      this.state.isRightDockOpen = false;
      this.state.activeRightDockTab = null;
    } else {
      // Buka drawer atau ganti tab aktif langsung
      this.state.isRightDockOpen = true;
      this.state.activeRightDockTab = tab;
      this.state.lastOpenedRightDockTab = tab;
    }
    this.savePersistence();
    this.notify();
  }

  public openRightDockTab(tab: RightDockTab) {
    this.state.isRightDockOpen = true;
    this.state.activeRightDockTab = tab;
    this.state.lastOpenedRightDockTab = tab;
    this.savePersistence();
    this.notify();
  }

  public closeRightDock() {
    if (this.state.isRightDockOpen) {
      this.state.isRightDockOpen = false;
      this.state.activeRightDockTab = null;
      this.savePersistence();
      this.notify();
    }
  }

  public toggleRightDockHider() {
    if (this.state.isRightDockOpen) {
      this.closeRightDock();
    } else {
      this.openRightDockTab(this.state.lastOpenedRightDockTab || 'watchlist');
    }
  }

  // --- Kontrol Mode Workspace ('terminal' | 'pine') ---

  public setWorkspaceMode(mode: WorkspaceMode) {
    if (this.state.workspaceMode !== mode) {
      this.state.workspaceMode = mode;
      this.notify();
    }
  }

  public toggleWorkspaceMode() {
    this.setWorkspaceMode(this.state.workspaceMode === 'pine' ? 'terminal' : 'pine');
  }

  // --- Mekanisme Langganan State Reaktif ---

  public subscribe(listener: (state: WorkspaceShellState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}

export const workspaceShellService = new WorkspaceShellService();
