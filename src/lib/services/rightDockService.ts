export type RightDockTab = 'watchlist' | 'alerts' | 'objects';

export interface RightDockState {
  isOpen: boolean;
  activeTab: RightDockTab | null;
  lastOpenedTab: RightDockTab;
}

class RightDockService {
  private state: RightDockState = {
    isOpen: true,
    activeTab: 'watchlist',
    lastOpenedTab: 'watchlist'
  };

  private listeners: Set<(state: RightDockState) => void> = new Set();

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('trawangan_right_dock_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.isOpen === 'boolean' && parsed.lastOpenedTab) {
            this.state = {
              isOpen: parsed.isOpen,
              activeTab: parsed.isOpen ? (parsed.activeTab || parsed.lastOpenedTab) : null,
              lastOpenedTab: parsed.lastOpenedTab || 'watchlist'
            };
          }
        }
      } catch (_) {}
    }
  }

  private savePersistence() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('trawangan_right_dock_state', JSON.stringify({
          isOpen: this.state.isOpen,
          activeTab: this.state.activeTab,
          lastOpenedTab: this.state.lastOpenedTab
        }));
      } catch (_) {}
    }
  }

  public getSnapshot(): RightDockState {
    return { ...this.state };
  }

  public resetState() {
    this.state = {
      isOpen: true,
      activeTab: 'watchlist',
      lastOpenedTab: 'watchlist'
    };
    this.notify();
  }

  public toggleTab(tab: RightDockTab) {
    if (this.state.isOpen && this.state.activeTab === tab) {
      // Click-to-close saat tab yang sama diklik
      this.state.isOpen = false;
      this.state.activeTab = null;
    } else {
      // Buka drawer atau ganti tab aktif secara instan
      this.state.isOpen = true;
      this.state.activeTab = tab;
      this.state.lastOpenedTab = tab;
    }
    this.savePersistence();
    this.notify();
  }

  public openTab(tab: RightDockTab) {
    this.state.isOpen = true;
    this.state.activeTab = tab;
    this.state.lastOpenedTab = tab;
    this.savePersistence();
    this.notify();
  }

  public close() {
    if (this.state.isOpen) {
      this.state.isOpen = false;
      this.state.activeTab = null;
      this.savePersistence();
      this.notify();
    }
  }

  public toggleHider() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.openTab(this.state.lastOpenedTab || 'watchlist');
    }
  }

  public subscribe(listener: (state: RightDockState) => void): () => void {
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

export const rightDockService = new RightDockService();
