import type { WorkspaceMode } from '../types/market';

export type RightDockTab = 'watchlist' | 'alerts' | 'objects';
export type { WorkspaceMode };

export interface WorkspaceShellState {
  isLeftRailCollapsed: boolean;
  isRightDockOpen: boolean;
  activeRightDockTab: RightDockTab | null;
  lastOpenedRightDockTab: RightDockTab;
  workspaceMode: WorkspaceMode;
}

const STORAGE_KEY_LEFT = 'trawangan_left_rail_collapsed';
const STORAGE_KEY_RIGHT = 'trawangan_right_dock_state';

/**
 * Modul Tunggal (Deep Module) Pengelola Shell Tata Letak Workspace Trawangan
 * 
 * Mengenkapsulasi status rel bilah gambar kiri (drawing toolbar),
 * dock panel kanan (watchlist, alerts, object tree), serta mode tampilan terminal/pine.
 * Menghilangkan duplikasi listener dan menyatukan logika persistensi localStorage.
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

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence() {
    if (typeof localStorage === 'undefined') return;
    try {
      const savedLeft = localStorage.getItem(STORAGE_KEY_LEFT);
      if (savedLeft !== null) {
        this.state.isLeftRailCollapsed = savedLeft === 'true';
      }
    } catch (_) {}

    try {
      const savedRight = localStorage.getItem(STORAGE_KEY_RIGHT);
      if (savedRight) {
        const parsed = JSON.parse(savedRight);
        if (parsed && typeof parsed.isOpen === 'boolean' && parsed.lastOpenedTab) {
          this.state.isRightDockOpen = parsed.isOpen;
          this.state.activeRightDockTab = parsed.isOpen ? (parsed.activeTab || parsed.lastOpenedTab) : null;
          this.state.lastOpenedRightDockTab = parsed.lastOpenedTab || 'watchlist';
        }
      }
    } catch (_) {}
  }

  private savePersistence() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_LEFT, String(this.state.isLeftRailCollapsed));
      localStorage.setItem(
        STORAGE_KEY_RIGHT,
        JSON.stringify({
          isOpen: this.state.isRightDockOpen,
          activeTab: this.state.activeRightDockTab,
          lastOpenedTab: this.state.lastOpenedRightDockTab,
        })
      );
    } catch (_) {}
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
