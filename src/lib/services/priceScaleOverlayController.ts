import type { PriceAlert, ActiveIndicatorInfo } from '../types/market';
import {
  extractDrawingPriceBadges,
  extractIndicatorPriceBadges,
  type PriceScaleBadge
} from './priceScaleLabelService';

export interface OverlayPositionsSnapshot {
  alertYPositions: Record<string, number | null>;
  drawingBadgeYPositions: Record<string, number | null>;
  indicatorBadgeYPositions: Record<string, number | null>;
  drawingPriceBadges: PriceScaleBadge[];
  indicatorPriceBadges: PriceScaleBadge[];
}

type OverlaySubscriber = (snapshot: OverlayPositionsSnapshot) => void;

/**
 * PriceScaleOverlayController - Deep Module untuk Penyelarasan Posisi Badge & Alert
 * Mengenkapsulasi kalkulasi matematis harga-ke-koordinat-pixel (Price-to-Y math),
 * pelacakan mutasi live pointer dragging, serta penjadwalan loop 60 FPS requestAnimationFrame.
 */
export class PriceScaleOverlayController {
  private chartContainer: HTMLElement | null = null;
  private workspace: any = null;

  private alerts: PriceAlert[] = [];
  private activeSymbol = '';

  private activeDrawings: any[] = [];
  private showDrawingLabels = true;
  private activeIndicators: ActiveIndicatorInfo[] = [];
  private showIndicatorLabels = true;

  private alertYPositions: Record<string, number | null> = {};
  private drawingBadgeYPositions: Record<string, number | null> = {};
  private indicatorBadgeYPositions: Record<string, number | null> = {};
  private drawingPriceBadges: PriceScaleBadge[] = [];
  private indicatorPriceBadges: PriceScaleBadge[] = [];

  private rafId: number | null = null;
  private subscribers = new Set<OverlaySubscriber>();

  /**
   * Mengaitkan elemen container chart dan objek workspace Vela
   */
  attachChart(container: HTMLElement | null, workspace: any): () => void {
    this.chartContainer = container;
    this.workspace = workspace;

    this.scheduleUpdate();

    return () => {
      if (this.chartContainer === container) {
        this.chartContainer = null;
      }
      if (this.workspace === workspace) {
        this.workspace = null;
      }
      if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    };
  }

  /**
   * Format harga dengan mikro-presisi kripto yang tepat
   */
  formatPrice(p: number | null): string {
    if (p === null || p === undefined || isNaN(p)) return '--';
    if (p >= 1000) {
      return p.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }

  /**
   * Helper internal untuk mendapatkan instans Coords dari Vela Chart Renderer
   */
  private getChartCoords(chart: any): any {
    if (!chart) return null;
    return (
      chart.renderer?.renderer?.coords ||
      chart.renderer?.coords ||
      chart.coords ||
      null
    );
  }

  /**
   * Hitung koordinat pixel Y presisi untuk harga target pada grafik
   */
  getPriceY(targetPrice: number): number | null {
    if (!this.workspace || !this.workspace.active) return null;
    try {
      const activeChart = this.workspace.active.chart as any;
      if (!activeChart) return null;

      const coords = this.getChartCoords(activeChart);
      const renderer =
        activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane =
        renderer?.pricePane ||
        (renderer?.panes && renderer.panes[0]) ||
        (renderer?.paneNodeAtY ? renderer.paneNodeAtY(50) : null);

      if (coords && typeof coords.priceToY === 'function') {
        const scale = pane?.scale || activeChart.scale;
        const bounds = pane?.bounds || activeChart.bounds;
        const y = coords.priceToY(targetPrice, scale, bounds);
        if (typeof y === 'number' && !isNaN(y)) {
          const top = bounds?.top ?? 0;
          const height = bounds?.height ?? 9999;
          if (y < top - 24 || y > top + height + 24) {
            return null;
          }
          return Math.round(y);
        }
      }
    } catch (_) {}
    return null;
  }

  /**
   * Hitung harga tepat dari koordinat pixel Y mouse
   */
  getPriceFromClientY(clientY: number): number | null {
    if (!this.chartContainer || !this.workspace || !this.workspace.active) {
      return null;
    }
    try {
      const rect = this.chartContainer.getBoundingClientRect();
      const localY = clientY - rect.top;
      const activeChart = this.workspace.active.chart as any;
      const coords = this.getChartCoords(activeChart);
      const renderer =
        activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane =
        renderer?.pricePane ||
        (renderer?.paneNodeAtY
          ? renderer.paneNodeAtY(localY)
          : renderer?.panes?.[0]);

      if (coords && typeof coords.yToPrice === 'function' && pane) {
        const scale = pane.scale || activeChart.scale;
        const bounds = pane.bounds || activeChart.bounds;
        if (scale && bounds) {
          const p = coords.yToPrice(localY, scale, bounds);
          if (typeof p === 'number' && !isNaN(p) && p > 0) {
            return p;
          }
        }
      }
    } catch (err) {
      console.warn('Gagal menghitung harga dari koordinat Y:', err);
    }
    return null;
  }

  /**
   * Perbarui daftar alerts dan simbol aktif
   */
  updateAlerts(alerts: PriceAlert[], activeSymbol: string): void {
    this.alerts = alerts;
    this.activeSymbol = activeSymbol;
    this.recomputeAlertPositions();
    this.notify();
  }

  /**
   * Perbarui koleksi objek gambar aktif
   */
  updateDrawings(drawings: any[], showPriceLabels = true): void {
    this.activeDrawings = drawings;
    this.showDrawingLabels = showPriceLabels;
    this.scheduleUpdate();
  }

  /**
   * Perbarui daftar indikator aktif
   */
  updateIndicators(indicators: ActiveIndicatorInfo[], showPriceLabels = true): void {
    this.activeIndicators = indicators;
    this.showIndicatorLabels = showPriceLabels;
    this.scheduleUpdate();
  }

  /**
   * Jadwalkan komputasi ulang posisi Y pada animation frame berikutnya (60 FPS sync)
   */
  scheduleUpdate(): void {
    if (this.rafId !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      this.computeAllPositions();
      this.notify();
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.computeAllPositions();
      this.notify();
    });
  }

  /**
   * Komputasi posisi seluruh badge dan alert
   */
  private computeAllPositions(): void {
    // 1. Drawing price badges
    if (this.showDrawingLabels && this.activeDrawings.length > 0) {
      this.drawingPriceBadges = extractDrawingPriceBadges(this.activeDrawings);
      const drawMap: Record<string, number | null> = {};
      for (const b of this.drawingPriceBadges) {
        drawMap[b.id] = this.getPriceY(b.price);
      }
      this.drawingBadgeYPositions = drawMap;
    } else {
      this.drawingPriceBadges = [];
      this.drawingBadgeYPositions = {};
    }

    // 2. Indicator price badges
    if (this.showIndicatorLabels && this.activeIndicators.length > 0) {
      this.indicatorPriceBadges = extractIndicatorPriceBadges(this.activeIndicators);
      const indMap: Record<string, number | null> = {};
      for (const b of this.indicatorPriceBadges) {
        indMap[b.id] = this.getPriceY(b.price);
      }
      this.indicatorBadgeYPositions = indMap;
    } else {
      this.indicatorPriceBadges = [];
      this.indicatorBadgeYPositions = {};
    }

    // 3. Alerts positions
    this.recomputeAlertPositions();
  }

  private recomputeAlertPositions(): void {
    const cleanSym = this.activeSymbol.replace('.P', '').toUpperCase();
    const matchingAlerts = this.alerts.filter(
      (a) => a.symbol.replace('.P', '').toUpperCase() === cleanSym
    );

    const pos: Record<string, number | null> = {};
    for (const a of matchingAlerts) {
      pos[a.id] = this.getPriceY(a.targetPrice);
    }
    this.alertYPositions = pos;
  }

  /**
   * Mengambil snapshot posisi dan badge saat ini
   */
  getSnapshot(): OverlayPositionsSnapshot {
    return {
      alertYPositions: { ...this.alertYPositions },
      drawingBadgeYPositions: { ...this.drawingBadgeYPositions },
      indicatorBadgeYPositions: { ...this.indicatorBadgeYPositions },
      drawingPriceBadges: [...this.drawingPriceBadges],
      indicatorPriceBadges: [...this.indicatorPriceBadges]
    };
  }

  /**
   * Berlangganan perubahan posisi overlay
   */
  subscribe(fn: OverlaySubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const fn of this.subscribers) {
      try {
        fn(snap);
      } catch (err) {
        console.error('Error pada subscriber PriceScaleOverlayController:', err);
      }
    }
  }

  /**
   * Bersihkan resource controller saat unmount
   */
  destroy(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.subscribers.clear();
  }
}

/**
 * Singleton instance dari PriceScaleOverlayController
 */
export const priceScaleOverlayController = new PriceScaleOverlayController();
