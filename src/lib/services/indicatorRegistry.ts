import type { ActiveIndicatorInfo } from '../types/market';

export interface ManagedIndicatorEntry {
  id: string;
  title: string;
  source?: string;
  handle?: any;
  handles: any[];
  visible: boolean;
  inputs?: Record<string, any>;
  props?: Record<string, any>;
}

/**
 * IndicatorRegistry - Manajer Siklus Hidup dan Persistensi Indikator Chart
 * Bertanggung jawab melacak instance handle Pine/native di multi-cell workspace,
 * sinkronisasi penghapusan menyeluruh, dan mencegah residu/zombie indicators saat load workspace.
 */
export class IndicatorRegistry {
  private entries = new Map<string, ManagedIndicatorEntry>();

  /**
   * Mendaftarkan atau memperbarui indikator baru
   */
  register(entry: ManagedIndicatorEntry): void {
    if (!entry || !entry.id) return;
    this.entries.set(entry.id, {
      ...entry,
      handles: Array.isArray(entry.handles) ? entry.handles : (entry.handle ? [entry.handle] : []),
      visible: entry.visible ?? true,
    });
  }

  /**
   * Mencari entri berdasarkan ID utama, ID handle spesifik, atau judul
   */
  findEntry(idOrHandleId: string): { key: string; entry: ManagedIndicatorEntry } | null {
    if (!idOrHandleId) return null;

    if (this.entries.has(idOrHandleId)) {
      return { key: idOrHandleId, entry: this.entries.get(idOrHandleId)! };
    }

    for (const [key, entry] of this.entries.entries()) {
      if (
        entry.id === idOrHandleId ||
        (Array.isArray(entry.handles) && entry.handles.some((h: any) => h?.id === idOrHandleId)) ||
        entry.title === idOrHandleId
      ) {
        return { key, entry };
      }
    }

    return null;
  }

  /**
   * Menangani event 'indicator:removed' dari engine native Vela
   * Mengeliminasi zombie indicator di memori dan menyelaraskan ke seluruh cell
   */
  handleRemovedEvent(
    removedId?: string,
    syncAllCells: boolean = true,
    getAllCells?: () => any[]
  ): string | null {
    if (!removedId) return null;

    const matched = this.findEntry(removedId);
    if (!matched) {
      // Hapus jika ada key yang sama
      this.entries.delete(removedId);
      return removedId;
    }

    const { key, entry } = matched;

    if (syncAllCells) {
      // 1. Hapus handle di cell lain jika sinkronisasi aktif
      for (const h of entry.handles || []) {
        if (h && h.id !== removedId) {
          try {
            if (typeof h.remove === 'function') h.remove();
          } catch (_) {}
        }
      }

      // 2. Bersihkan instance di cell jika ada
      if (typeof getAllCells === 'function') {
        const cells = getAllCells();
        for (const cell of cells as any[]) {
          if (Array.isArray(cell?.instances)) {
            const idx = cell.instances.findIndex(
              (it: any) =>
                it?.handle?.id === removedId ||
                entry.handles.some((h: any) => h?.id === it?.handle?.id) ||
                it?.title === entry.title
            );
            if (idx >= 0) {
              const snapshot = cell.instances[idx];
              if (typeof cell.dropInstance === 'function') {
                try { cell.dropInstance(snapshot); } catch (_) {}
              } else {
                cell.instances.splice(idx, 1);
              }
            }
          }
        }
      }

      this.entries.delete(key);
      return key;
    } else {
      // Sinkronisasi nonaktif: Hapus hanya handle untuk cell yang bersangkutan
      entry.handles = entry.handles.filter((h: any) => h?.id !== removedId);
      if (entry.handles.length === 0 || entry.handle?.id === removedId) {
        this.entries.delete(key);
        return key;
      }
      return null;
    }
  }

  /**
   * Menghapus indikator secara eksplisit (dari UI Object Tree / legend / script)
   */
  removeIndicator(
    id: string,
    syncAllCells: boolean = true,
    getAllCells?: () => any[]
  ): boolean {
    const matched = this.findEntry(id);
    const targetCells = typeof getAllCells === 'function' ? getAllCells() : [];

    if (matched) {
      const { key, entry } = matched;
      if (syncAllCells) {
        for (const h of entry.handles || []) {
          try {
            if (typeof h?.remove === 'function') h.remove();
          } catch (_) {}
        }

        for (const cell of targetCells as any[]) {
          if (Array.isArray(cell?.instances)) {
            const idx = cell.instances.findIndex(
              (it: any) =>
                it?.handle?.id === id ||
                entry.handles.some((h: any) => h?.id === it?.handle?.id) ||
                it?.title === entry.title
            );
            if (idx >= 0) {
              const snapshot = cell.instances[idx];
              if (typeof cell.dropInstance === 'function') {
                try { cell.dropInstance(snapshot); } catch (_) {}
              } else {
                cell.instances.splice(idx, 1);
              }
            }
          }

          const chart = cell?.chart || cell?.inner;
          if (chart && typeof chart.indicators === 'function') {
            for (const nativeInd of Array.from(chart.indicators() || []) as any[]) {
              if (
                nativeInd &&
                (nativeInd.id === id ||
                  entry.handles.some((h: any) => h?.id === nativeInd.id) ||
                  nativeInd.title === entry.title)
              ) {
                try { nativeInd.remove(); } catch (_) {}
              }
            }
          }
        }

        this.entries.delete(key);
        this.entries.delete(id);
      } else {
        // Hapus hanya dari cell aktif
        if (targetCells.length > 0) {
          const activeCell = targetCells[0];
          const chart = activeCell?.chart || activeCell?.inner;
          if (chart && typeof chart.indicators === 'function') {
            for (const nativeInd of Array.from(chart.indicators() || []) as any[]) {
              if (nativeInd && (nativeInd.id === id || nativeInd.title === entry.title)) {
                try { nativeInd.remove(); } catch (_) {}
              }
            }
          }
        }

        entry.handles = entry.handles.filter((h: any) => h?.id !== id && h !== entry.handle);
        if (entry.handles.length === 0) {
          this.entries.delete(key);
          this.entries.delete(id);
        }
      }
      return true;
    }

    // Fallback: hapus langsung dari native chart jika tidak terdaftar di Map
    let anyRemoved = false;
    for (const cell of targetCells as any[]) {
      const chart = cell?.chart || cell?.inner;
      if (chart && typeof chart.indicators === 'function') {
        for (const nativeInd of Array.from(chart.indicators() || []) as any[]) {
          if (nativeInd && (nativeInd.id === id || nativeInd.title === id)) {
            try {
              nativeInd.remove();
              anyRemoved = true;
            } catch (_) {}
          }
        }
      }
    }
    this.entries.delete(id);
    return anyRemoved;
  }

  /**
   * Menghapus seluruh indikator di registry dan cell workspace
   */
  clearAll(getAllCells?: () => any[]): void {
    for (const entry of this.entries.values()) {
      for (const h of entry.handles || []) {
        try {
          if (typeof h?.remove === 'function') h.remove();
        } catch (_) {}
      }
    }
    this.entries.clear();

    if (typeof getAllCells === 'function') {
      const cells = getAllCells();
      for (const cell of cells as any[]) {
        if (Array.isArray(cell?.instances)) {
          for (const it of [...cell.instances]) {
            try {
              if (typeof cell.dropInstance === 'function') {
                cell.dropInstance(it);
              } else if (it?.handle && typeof it.handle.remove === 'function') {
                it.handle.remove();
              }
            } catch (_) {}
          }
          cell.instances.length = 0;
        }

        const chart = cell?.chart || cell?.inner;
        if (chart && typeof chart.indicators === 'function') {
          for (const h of Array.from(chart.indicators() || []) as any[]) {
            if (h?.nativeType === 'volume') continue;
            try {
              if (typeof h?.remove === 'function') h.remove();
            } catch (_) {}
          }
        }
      }
    }
  }

  /**
   * Toggle status visibilitas indikator
   */
  toggleVisibility(id: string, syncAllCells: boolean = true): boolean | null {
    const matched = this.findEntry(id);
    if (!matched) return null;

    const { entry } = matched;
    const next = !(entry.visible ?? entry.handle?.visible ?? true);
    entry.visible = next;

    const list = syncAllCells ? entry.handles : (entry.handle ? [entry.handle] : entry.handles);
    for (const h of list || []) {
      try {
        if (typeof h?.setVisible === 'function') h.setVisible(next);
      } catch (_) {}
    }
    return next;
  }

  /**
   * Memperbarui input parameter indikator di registry dan pada live handle jika didukung
   */
  updateInputs(id: string, inputs: Record<string, any>): boolean {
    const matched = this.findEntry(id);
    if (!matched) return false;

    const { entry } = matched;
    entry.inputs = { ...(entry.inputs || {}), ...inputs };

    for (const h of entry.handles || []) {
      try {
        if (typeof h?.setInputs === 'function') {
          h.setInputs(inputs);
        } else if (typeof h?.updateInputs === 'function') {
          h.updateInputs(inputs);
        }
      } catch (_) {}
    }
    return true;
  }

  /**
   * Mendapatkan daftar indikator aktif yang valid dan hidup
   * Secara cerdas memangkas (*auto-prune*) indikator yang sudah dihapus dari engine chart
   */
  getActiveIndicators(
    activeChart?: any,
    getAllCells?: () => any[]
  ): ActiveIndicatorInfo[] {
    const list: ActiveIndicatorInfo[] = [];

    // Kumpulkan seluruh ID dan judul indikator yang benar-benar aktif di chart
    const allCells = typeof getAllCells === 'function' ? getAllCells() : [];
    const chartList = allCells.map((c: any) => c?.chart || c?.inner).filter(Boolean);
    if (activeChart && !chartList.includes(activeChart)) {
      chartList.push(activeChart);
    }

    const liveIndicatorsMap = new Map<string, any>();
    const liveTitles = new Set<string>();
    let hasLiveQuery = false;

    for (const chart of chartList) {
      if (typeof chart?.indicators === 'function') {
        hasLiveQuery = true;
        const nativeList = Array.from(chart.indicators() || []);
        for (const ind of nativeList as any[]) {
          if (ind?.id) liveIndicatorsMap.set(ind.id, ind);
          if (ind?.title) liveTitles.add(ind.title);
        }
      }
    }

    // Iterasi entri registry
    const toDelete: string[] = [];

    for (const [key, item] of this.entries.entries()) {
      // Jika chart sudah siap dan terkueri, pastikan indikator masih hidup
      if (hasLiveQuery) {
        const isAlive =
          liveIndicatorsMap.has(key) ||
          liveIndicatorsMap.has(item.id) ||
          (Array.isArray(item.handles) && item.handles.some((h: any) => h?.id && liveIndicatorsMap.has(h.id))) ||
          liveTitles.has(item.title);

        if (!isAlive) {
          // Indikator sudah dihapus di chart canvas/renderer! Prune dari memory
          toDelete.push(key);
          continue;
        }
      }

      // Ambil live handle terbaik untuk membaca input & prop values
      let liveHandle = liveIndicatorsMap.get(key) || liveIndicatorsMap.get(item.id);
      if (!liveHandle && Array.isArray(item.handles)) {
        liveHandle = item.handles.find((h: any) => h?.id && liveIndicatorsMap.has(h.id));
      }
      if (!liveHandle) {
        liveHandle = item.handle;
      }

      let inputs: Record<string, any> | undefined = undefined;
      let props: Record<string, any> | undefined = undefined;

      try {
        if (liveHandle && typeof liveHandle.inputValues === 'function') {
          const vals = liveHandle.inputValues();
          if (vals && Object.keys(vals).length > 0) inputs = vals;
        }
      } catch (_) {}

      try {
        if (liveHandle && typeof liveHandle.propValues === 'function') {
          const pvals = liveHandle.propValues();
          if (pvals && Object.keys(pvals).length > 0) props = pvals;
        }
      } catch (_) {}

      if (!inputs && item.inputs) inputs = item.inputs;
      if (!props && item.props) props = item.props;

      if (inputs) item.inputs = inputs;
      if (props) item.props = props;

      list.push({
        id: item.id || key,
        title: item.title || liveHandle?.title || 'Indicator',
        source: item.source || liveHandle?.source,
        visible: item.visible ?? liveHandle?.visible ?? true,
        inputs: inputs || item.inputs,
        props: props || item.props,
      });
    }

    // Eksekusi auto-pruning untuk indikator yang telah mati
    for (const deadKey of toDelete) {
      this.entries.delete(deadKey);
    }

    return list;
  }

  /**
   * Mengembalikan jumlah entri indikator tersimpan di registry
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Mengosongkan internal map
   */
  clear(): void {
    this.entries.clear();
  }
}
