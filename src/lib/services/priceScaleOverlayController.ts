import type { PriceAlert, ActiveIndicatorInfo } from '../types/market';
import {
  extractDrawingPriceBadges,
  extractIndicatorPriceBadges,
  formatPriceLabel,
  type PriceScaleBadge
} from './priceScaleLabelService';
import { parseAdaptiveSymbol } from './market/symbolSearchService';
import { isSameInstrument } from './instrumentIdentity';

export interface OverlayPositionsSnapshot {
  tick: number;
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
  private continuousSyncTimer: any = null;
  private tick = 0;
  private subscribers = new Set<OverlaySubscriber>();

  /**
   * Mengaitkan elemen container chart dan objek workspace Vela
   */
  attachChart(container: HTMLElement | null, workspace: any): () => void {
    this.chartContainer = container;
    this.workspace = workspace;

    // Pasang listener event workspace/chart jika tersedia
    const cleanupEvents = this.wireWorkspaceEvents(workspace);
    this.scheduleUpdate();

    return () => {
      cleanupEvents?.();
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
   * Daftarkan pendengar event viewport & drawing pada workspace Vela untuk menjaga
   * koordinat overlay selalu tersinkronisasi 1:1 dengan sumbu harga kanvas
   */
  private wireWorkspaceEvents(workspace: any): (() => void) | null {
    if (!workspace) return null;
    const cleanups: Array<() => void> = [];

    const onMotion = () => {
      this.scheduleContinuousSync(150);
    };

    try {
      if (typeof workspace.events?.on === 'function') {
        const u1 = workspace.events.on('viewport:changed', onMotion);
        const u2 = workspace.events.on('drawing:created', onMotion);
        const u3 = workspace.events.on('drawing:edited', onMotion);
        const u4 = workspace.events.on('cell:active', onMotion);
        const u5 = workspace.events.on('layout:changed', onMotion);
        if (typeof u1 === 'function') cleanups.push(u1);
        if (typeof u2 === 'function') cleanups.push(u2);
        if (typeof u3 === 'function') cleanups.push(u3);
        if (typeof u4 === 'function') cleanups.push(u4);
        if (typeof u5 === 'function') cleanups.push(u5);
      }

      const activeChart = workspace.active?.chart;
      if (activeChart && typeof activeChart.on === 'function') {
        const uChartVp = activeChart.on('viewport:changed', onMotion);
        const uChartBar = activeChart.on('bar', onMotion);
        const uChartPane = activeChart.on('pane:changed', onMotion);
        if (typeof uChartVp === 'function') cleanups.push(uChartVp);
        if (typeof uChartBar === 'function') cleanups.push(uChartBar);
        if (typeof uChartPane === 'function') cleanups.push(uChartPane);
      }
    } catch (_) {}

    return () => {
      for (const fn of cleanups) {
        try { fn(); } catch (_) {}
      }
    };
  }

  /**
   * Mengambil quote currency dari simbol aktif
   */
  private getQuoteCurrency(): string {
    const s = (this.activeSymbol || '').toUpperCase();
    const parsed = parseAdaptiveSymbol(s);
    return parsed.quoteAsset || 'USDT';
  }

  /**
   * Format harga dengan mikro-presisi kripto yang tepat dan lokalisasi mata uang
   */
  formatPrice(p: number | null, quoteCurrency?: string): string {
    if (p === null || p === undefined || isNaN(p)) return '--';
    const quote = quoteCurrency || this.getQuoteCurrency();
    return formatPriceLabel(p, quote);
  }

  /**
   * Mengambil elemen plot kanvas utama tempat garis harga digambar untuk menghitung
   * offset vertikal relatif terhadap chartContainer
   */
  private getPlotElement(activeChart: any): HTMLElement | null {
    const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
    return (
      renderer?.plot ||
      renderer?.dataCanvas ||
      renderer?.chromeCanvas ||
      renderer?.wrapper ||
      this.workspace?.active?.host ||
      null
    );
  }

  /**
   * Menghitung offset vertikal (top offset) antara kanvas plot Vela dan container overlay (.chart-wrapper)
   */
  private getPlotVerticalOffset(activeChart: any): number {
    if (!this.chartContainer) return 0;
    try {
      const plotEl = this.getPlotElement(activeChart);
      if (
        plotEl &&
        typeof plotEl.getBoundingClientRect === 'function' &&
        typeof this.chartContainer.getBoundingClientRect === 'function'
      ) {
        const plotRect = plotEl.getBoundingClientRect();
        const containerRect = this.chartContainer.getBoundingClientRect();
        if (plotRect && containerRect) {
          return plotRect.top - containerRect.top;
        }
      }
    } catch (_) {}
    return 0;
  }

  /**
   * Resolusi harga pane secara robust dari Vela scene atau renderer fallback
   */
  private getPricePane(activeChart: any, renderer: any): any {
    if (!activeChart && !renderer) return null;
    return (
      renderer?.scene?.panes?.get?.('price') ||
      renderer?.scene?.panes?.get?.('PRICE') ||
      renderer?.scene?.orderedPanes?.()?.find?.((p: any) => p.kind === 'price') ||
      renderer?.pricePane ||
      (renderer?.panes && renderer.panes[0]) ||
      (renderer?.paneNodeAtY ? renderer.paneNodeAtY(50) : null) ||
      null
    );
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
      const pane = this.getPricePane(activeChart, renderer);

      if (coords && typeof coords.priceToY === 'function') {
        const scale = pane?.scale || activeChart.scale;
        const bounds = pane?.bounds || activeChart.bounds;
        const rawY = coords.priceToY(targetPrice, scale, bounds);
        if (typeof rawY === 'number' && !isNaN(rawY)) {
          const top = bounds?.top ?? 0;
          const height = bounds?.height ?? 9999;
          if (rawY < top - 24 || rawY > top + height + 24) {
            return null;
          }
          const plotOffset = this.getPlotVerticalOffset(activeChart);
          return Math.round(rawY + plotOffset);
        }
      }
    } catch (_) {}
    return null;
  }

  /**
   * Hitung koordinat pixel X untuk timestamp tertentu
   */
  getTimeX(targetTime: number): number | null {
    if (!this.workspace || !this.workspace.active) return null;
    try {
      const activeChart = this.workspace.active.chart as any;
      if (!activeChart) return null;

      const coords = this.getChartCoords(activeChart);
      const renderer =
        activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane = this.getPricePane(activeChart, renderer);

      if (coords && typeof coords.timeToX === 'function') {
        const scale = activeChart.timeScale || activeChart.scale;
        const bounds = pane?.bounds || activeChart.bounds;
        const x = coords.timeToX(targetTime, scale, bounds);
        if (typeof x === 'number' && !isNaN(x)) {
          return Math.round(x);
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
      const activeChart = this.workspace.active.chart as any;
      const plotEl = this.getPlotElement(activeChart) || this.chartContainer;
      const rect = plotEl.getBoundingClientRect();
      const localY = clientY - rect.top;

      const coords = this.getChartCoords(activeChart);
      const renderer =
        activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane =
        this.getPricePane(activeChart, renderer) ||
        (renderer?.paneNodeAtY ? renderer.paneNodeAtY(localY) : null);

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
   * Jadwalkan sinkronisasi berkelanjutan selama durasi ms tertentu (misal saat auto-scale/pan/zoom easing berjalan)
   */
  scheduleContinuousSync(durationMs = 200): void {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loop = () => {
      this.computeAllPositions();
      this.notify();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - startTime < durationMs) {
        if (typeof requestAnimationFrame === 'function') {
          this.continuousSyncTimer = requestAnimationFrame(loop);
        }
      } else {
        this.continuousSyncTimer = null;
      }
    };

    if (this.continuousSyncTimer) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.continuousSyncTimer);
      }
      this.continuousSyncTimer = null;
    }

    if (typeof requestAnimationFrame === 'function') {
      this.continuousSyncTimer = requestAnimationFrame(loop);
    } else {
      this.scheduleUpdate();
    }
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
    const quote = this.getQuoteCurrency();

    // 1. Drawing price badges
    if (this.showDrawingLabels && this.activeDrawings.length > 0) {
      this.drawingPriceBadges = extractDrawingPriceBadges(this.activeDrawings, undefined, quote);
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
      this.indicatorPriceBadges = extractIndicatorPriceBadges(this.activeIndicators, undefined, quote);
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
    this.tick++;
  }

  private recomputeAlertPositions(): void {
    const matchingAlerts = this.alerts.filter((a) => isSameInstrument(a.symbol, this.activeSymbol));

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
      tick: this.tick,
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
    if (this.continuousSyncTimer !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.continuousSyncTimer);
      this.continuousSyncTimer = null;
    }
    this.subscribers.clear();
  }
}

/**
 * Singleton instance dari PriceScaleOverlayController
 */
export const priceScaleOverlayController = new PriceScaleOverlayController();
