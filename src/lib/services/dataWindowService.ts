/**
 * Layanan DataWindow Inspector untuk Trawangan
 *
 * Mengelola subscription snapshot DataWindowReadout dari chart Vela (chart.renderer.dataWindowReadout())
 * saat kursor crosshair bergerak di atas grafik historis maupun real-time.
 * Mempertahankan data candle terakhir jika kursor meninggalkan kanvas agar panel tetap informatif.
 */

export interface DataWindowRow {
  label: string;
  value: string;
  color: string;
}

export interface DataWindowOHLC {
  o: string;
  h: string;
  l: string;
  c: string;
  vol?: string;
  up: boolean;
}

export interface DataWindowGroup {
  name: string;
  rows: DataWindowRow[];
}

export interface DataWindowReadout {
  date: string;
  time: string;
  ohlc: DataWindowOHLC | null;
  groups: DataWindowGroup[];
}

export interface DataWindowState {
  readout: DataWindowReadout | null;
  isHovered: boolean;
  hasData: boolean;
}

export interface DataWindowSection {
  title: string;
  lines: Array<{
    label: string;
    value: string;
    color?: string;
  }>;
}

/**
 * Format readout menjadi barisan grup terstruktur untuk tampilan antarmuka
 */
export function formatDataWindowSections(readout: DataWindowReadout | null): DataWindowSection[] {
  if (!readout) return [];
  const sections: DataWindowSection[] = [];

  // 1. Time Section
  if (readout.date || readout.time) {
    sections.push({
      title: 'Time',
      lines: [
        { label: 'Date', value: readout.date || '—', color: '' },
        { label: 'Time', value: readout.time || '—', color: '' },
      ],
    });
  }

  // 2. Price / OHLCV Section
  if (readout.ohlc) {
    const ohlc = readout.ohlc;
    const color = ohlc.up ? 'var(--bull-color, #089981)' : 'var(--bear-color, #f23645)';
    const lines = [
      { label: 'Open', value: ohlc.o, color },
      { label: 'High', value: ohlc.h, color },
      { label: 'Low', value: ohlc.l, color },
      { label: 'Close', value: ohlc.c, color },
    ];
    if (ohlc.vol !== undefined && ohlc.vol !== '') {
      lines.push({ label: 'Volume', value: ohlc.vol, color });
    }
    sections.push({ title: 'Price', lines });
  }

  // 3. Indicator Groups
  if (readout.groups && readout.groups.length > 0) {
    for (const group of readout.groups) {
      if (group.rows && group.rows.length > 0) {
        sections.push({
          title: group.name,
          lines: group.rows.map((r) => ({
            label: r.label,
            value: r.value,
            color: r.color,
          })),
        });
      }
    }
  }

  return sections;
}

const REFRESH_EVENTS = [
  'bar',
  'context:changed',
  'indicator:added',
  'indicator:removed',
  'indicator:visibility',
  'indicator:moved',
  'pane:changed',
  'market:changed',
  'history:complete',
];

export class DataWindowService {
  private state: DataWindowState = {
    readout: null,
    isHovered: false,
    hasData: false,
  };

  private lastValidReadout: DataWindowReadout | null = null;
  private listeners: Set<(state: DataWindowState) => void> = new Set();
  private attachedChartCleanups: (() => void)[] = [];

  /**
   * Mengambil snapshot state saat ini
   */
  public getSnapshot(): DataWindowState {
    return { ...this.state };
  }

  /**
   * Mendaftarkan listener untuk pembaruan state
   */
  public subscribe(listener: (state: DataWindowState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[DataWindowService] Kesalahan pada subscriber listener:', err);
      }
    }
  }

  /**
   * Menetapkan readout secara manual (berguna untuk pengujian atau fallback langsung)
   */
  public setReadout(readout: DataWindowReadout | null, isHovered = true): void {
    if (readout && (readout.ohlc || readout.date || (readout.groups && readout.groups.length > 0))) {
      this.lastValidReadout = readout;
      this.state = {
        readout,
        isHovered,
        hasData: true,
      };
    } else if (this.lastValidReadout) {
      // Pertahankan data bar/candle terakhir jika snapshot baru kosong (kursor keluar kanvas)
      this.state = {
        readout: this.lastValidReadout,
        isHovered: false,
        hasData: true,
      };
    } else {
      this.state = {
        readout: null,
        isHovered: false,
        hasData: false,
      };
    }
    this.notify();
  }

  /**
   * Menangani peristiwa kursor meninggalkan kanvas chart
   * Memastikan readout tetap menyajikan bar terakhir alih-alih mengosongkan panel
   */
  public handleMouseLeave(): void {
    if (this.state.readout || this.lastValidReadout) {
      this.state = {
        readout: this.state.readout || this.lastValidReadout,
        isHovered: false,
        hasData: true,
      };
      this.notify();
    }
  }

  /**
   * Mengambil readout terbaru dari instance chart aktif
   */
  public updateFromChart(chart: any): void {
    if (!chart) return;
    try {
      const readout: DataWindowReadout | null =
        (typeof chart.renderer?.dataWindowReadout === 'function' && chart.renderer.dataWindowReadout()) ||
        (typeof chart.dataWindowReadout === 'function' && chart.dataWindowReadout()) ||
        (typeof chart.renderer?.getDataWindowReadout === 'function' && chart.renderer.getDataWindowReadout()) ||
        null;

      if (readout && (readout.ohlc || readout.date || (readout.groups && readout.groups.length > 0))) {
        this.lastValidReadout = readout;
        this.state = {
          readout,
          isHovered: true,
          hasData: true,
        };
        this.notify();
      } else if (this.lastValidReadout) {
        // Pertahankan candle terakhir
        this.state = {
          readout: this.lastValidReadout,
          isHovered: false,
          hasData: true,
        };
        this.notify();
      }
    } catch (err) {
      console.warn('[DataWindowService] Gagal membaca dataWindowReadout dari chart:', err);
    }
  }

  /**
   * Mengaitkan listener crosshair dan event lifecycle pada instans chart
   */
  public attachChart(chart: any, containerElement?: HTMLElement | null): () => void {
    this.detachChart();

    if (!chart) {
      return () => {};
    }

    const cleanups: (() => void)[] = [];

    // 1. Dengarkan pergerakan kursor crosshair
    const onCrosshair = () => {
      this.updateFromChart(chart);
    };

    if (chart.renderer && typeof chart.renderer.onCrosshairMove === 'function') {
      const unsub = chart.renderer.onCrosshairMove(onCrosshair);
      if (typeof unsub === 'function') cleanups.push(unsub);
    } else if (typeof chart.onCrosshairMove === 'function') {
      const unsub = chart.onCrosshairMove(onCrosshair);
      if (typeof unsub === 'function') cleanups.push(unsub);
    }

    // 2. Dengarkan event refresh (bar, indikator, market switch, dsb.)
    if (typeof chart.on === 'function') {
      for (const ev of REFRESH_EVENTS) {
        try {
          const unsub = chart.on(ev, onCrosshair);
          if (typeof unsub === 'function') cleanups.push(unsub);
        } catch (_) {}
      }
    }

    // 3. Pasang listener mouseleave / pointerleave pada kontainer jika tersedia
    if (containerElement && typeof containerElement.addEventListener === 'function') {
      const onLeave = () => {
        // Vela's dataWindowReadout automatically points to the latest bar when cursor leaves
        this.updateFromChart(chart);
        this.handleMouseLeave();
      };
      containerElement.addEventListener('pointerleave', onLeave);
      containerElement.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        containerElement.removeEventListener('pointerleave', onLeave);
        containerElement.removeEventListener('mouseleave', onLeave);
      });
    }

    // Lakukan pembaruan awal saat attach
    this.updateFromChart(chart);

    const detach = () => {
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (_) {}
      }
    };

    this.attachedChartCleanups.push(detach);
    return detach;
  }

  /**
   * Mengaitkan listener ke instans Vela Workspace (menangani active cell switching)
   */
  public attachWorkspace(workspace: any, containerElement?: HTMLElement | null): () => void {
    this.detachChart();
    if (!workspace) return () => {};

    const cleanups: (() => void)[] = [];
    let currentCellCleanup: (() => void) | null = null;

    const bindActiveCell = () => {
      if (currentCellCleanup) {
        currentCellCleanup();
        currentCellCleanup = null;
      }
      const activeChart = workspace.active?.chart || workspace.active?.inner || null;
      if (activeChart) {
        currentCellCleanup = this.attachChart(activeChart, containerElement);
      }
    };

    // Dengarkan event perpindahan sel aktif
    if (typeof workspace.on === 'function') {
      try {
        const unsub = workspace.on('cell:active', bindActiveCell);
        if (typeof unsub === 'function') cleanups.push(unsub);
      } catch (_) {}
    }

    bindActiveCell();

    const detachWorkspace = () => {
      if (currentCellCleanup) {
        currentCellCleanup();
        currentCellCleanup = null;
      }
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (_) {}
      }
    };

    this.attachedChartCleanups.push(detachWorkspace);
    return detachWorkspace;
  }

  /**
   * Melepas semua listener chart/workspace yang terhubung
   */
  public detachChart(): void {
    for (const cleanup of this.attachedChartCleanups) {
      try {
        cleanup();
      } catch (_) {}
    }
    this.attachedChartCleanups = [];
  }

  /**
   * Mengosongkan data dan mereset state
   */
  public clear(): void {
    this.lastValidReadout = null;
    this.state = {
      readout: null,
      isHovered: false,
      hasData: false,
    };
    this.notify();
  }

  /**
   * Membersihkan seluruh resource dan subscription
   */
  public destroy(): void {
    this.detachChart();
    this.clear();
    this.listeners.clear();
  }
}

export const dataWindowService = new DataWindowService();
