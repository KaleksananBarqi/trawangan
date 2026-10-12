export interface LeftToolbarState {
  isCollapsed: boolean;
}

class LeftToolbarService {
  private state: LeftToolbarState = {
    isCollapsed: false,
  };

  private listeners: Set<(state: LeftToolbarState) => void> = new Set();

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('trawangan_left_rail_collapsed');
        if (saved !== null) {
          this.state.isCollapsed = saved === 'true';
        }
      } catch (_) {}
    }
  }

  private savePersistence() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('trawangan_left_rail_collapsed', String(this.state.isCollapsed));
      } catch (_) {}
    }
  }

  public getSnapshot(): LeftToolbarState {
    return { ...this.state };
  }

  public resetState() {
    this.state = {
      isCollapsed: false,
    };
    this.notify();
  }

  public toggleCollapse() {
    this.state.isCollapsed = !this.state.isCollapsed;
    this.savePersistence();
    this.notify();
  }

  public setCollapsed(collapsed: boolean) {
    if (this.state.isCollapsed !== collapsed) {
      this.state.isCollapsed = collapsed;
      this.savePersistence();
      this.notify();
    }
  }

  public handleKeydown(event: KeyboardEvent): boolean {
    if (event.altKey && (event.key === 't' || event.key === 'T')) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      this.toggleCollapse();
      return true;
    }
    return false;
  }

  public subscribe(listener: (state: LeftToolbarState) => void): () => void {
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

export const leftToolbarService = new LeftToolbarService();
