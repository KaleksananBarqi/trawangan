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

interface PlotProjectionContext {
  coords: any;
  scale: any;
  bounds: any;
  top: number;
  height: number;
  plotOffset: number;
}

function areYMapsEqual(
  a: Record<string, number | null>,
  b: Record<string, number | null>
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function areBadgeArraysEqual(a: PriceScaleBadge[], b: PriceScaleBadge[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ba = a[i];
    const bb = b[i];
    if (
      ba.id !== bb.id ||
      ba.price !== bb.price ||
      ba.label !== bb.label ||
      ba.color !== bb.color ||
      ba.bgColor !== bb.bgColor ||
      ba.kind !== bb.kind ||
      ba.title !== bb.title
    ) {
      return false;
    }
  }
  return true;
}

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
  private drawingsDirty = false;
  private indicatorsDirty = false;
  private lastExtractedDrawingQuote = '';
  private lastExtractedIndicatorQuote = '';
  private tick = 0;
  private subscribers = new Set<OverlaySubscriber>();

  /**
   * Mengaitkan elemen container chart dan objek workspace Vela
   */
  attachChart(container: HTMLElement | null, workspace: any): () => void {
    this.chartContainer = container;
    this.workspace = workspace;
    this.drawingsDirty = true;
    this.indicatorsDirty = true;

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
      if (this.continuousSyncTimer !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.continuousSyncTimer);
        this.continuousSyncTimer = null;
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

    // Event bar tick hanya perlu menyegarkan badge indikator 1x pada frame berikutnya
    // tanpa menyalakan continuous 150ms rAF easing loop secara permanen.
    const onBar = () => {
      this.indicatorsDirty = true;
      this.scheduleUpdate();
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
        const subscribeChartEvent = (eventName: string, handler: () => void) => {
          const unsub = activeChart.on(eventName, handler);
          if (typeof unsub === 'function') {
            cleanups.push(unsub);
          } else if (typeof activeChart.off === 'function') {
            cleanups.push(() => activeChart.off(eventName, handler));
          }
        };
        subscribeChartEvent('viewport:changed', onMotion);
        subscribeChartEvent('bar', onBar);
        subscribeChartEvent('history:complete', onBar);
        subscribeChartEvent('data', onBar);
        subscribeChartEvent('indicator:inputs', onBar);
        subscribeChartEvent('pane:changed', onMotion);
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
   * Membangun konteks proyeksi plot satu kali per frame agar pembacaan layout DOM
   * (`getBoundingClientRect`) tidak diulang-ulang pada setiap item overlay.
   */
  private buildProjectionContext(): PlotProjectionContext | null {
    if (!this.workspace || !this.workspace.active) return null;
    try {
      const activeChart = this.workspace.active.chart as any;
      if (!activeChart) return null;

      const coords = this.getChartCoords(activeChart);
      if (!coords || typeof coords.priceToY !== 'function') return null;

      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane = this.getPricePane(activeChart, renderer);
      const scale = pane?.scale || activeChart.scale;
      const bounds = pane?.bounds || activeChart.bounds;
      const top = bounds?.top ?? 0;
      const height = bounds?.height ?? 9999;
      const plotOffset = this.getPlotVerticalOffset(activeChart);

      return { coords, scale, bounds, top, height, plotOffset };
    } catch (_) {
      return null;
    }
  }

  private projectPriceToY(targetPrice: number, ctx: PlotProjectionContext | null): number | null {
    if (!ctx) return null;
    try {
      const rawY = ctx.coords.priceToY(targetPrice, ctx.scale, ctx.bounds);
      if (typeof rawY === 'number' && !isNaN(rawY)) {
        if (rawY < ctx.top - 24 || rawY > ctx.top + ctx.height + 24) {
          return null;
        }
        return Math.round(rawY + ctx.plotOffset);
      }
    } catch (_) {}
    return null;
  }

  /**
   * Hitung koordinat pixel Y presisi untuk harga target pada grafik
   */
  getPriceY(targetPrice: number): number | null {
    return this.projectPriceToY(targetPrice, this.buildProjectionContext());
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
    const sameInputs = this.alerts === alerts && this.activeSymbol === activeSymbol;
    const prevMap = this.alertYPositions;
    this.alerts = alerts;
    this.activeSymbol = activeSymbol;
    this.recomputeAlertPositions();
    if (sameInputs && areYMapsEqual(prevMap, this.alertYPositions)) {
      return;
    }
    this.notify();
  }

  /**
   * Perbarui koleksi objek gambar aktif
   */
  updateDrawings(drawings: any[], showPriceLabels = true): void {
    this.activeDrawings = drawings;
    this.showDrawingLabels = showPriceLabels;
    this.drawingsDirty = true;
    this.scheduleUpdate();
  }

  /**
   * Perbarui daftar indikator aktif
   */
  updateIndicators(indicators: ActiveIndicatorInfo[], showPriceLabels = true): void {
    this.activeIndicators = indicators;
    this.showIndicatorLabels = showPriceLabels;
    this.indicatorsDirty = true;
    this.scheduleUpdate();
  }

  /**
   * Jadwalkan sinkronisasi berkelanjutan selama durasi ms tertentu (misal saat auto-scale/pan/zoom easing berjalan)
   */
  scheduleContinuousSync(durationMs = 200): void {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loop = () => {
      if (this.computeAllPositions()) {
        this.notify();
      }
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
      if (this.computeAllPositions()) {
        this.notify();
      }
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.computeAllPositions()) {
        this.notify();
      }
    });
  }

  /**
   * Komputasi posisi seluruh badge dan alert dalam satu pass konteks proyeksi.
   * Mengembalikan `true` hanya apabila ada perubahan posisi atau daftar badge dibanding frame sebelumnya.
   */
  private computeAllPositions(): boolean {
    const quote = this.getQuoteCurrency();
    const ctx = this.buildProjectionContext();

    // 1. Drawing price badges
    let nextDrawingBadges: PriceScaleBadge[];
    let nextDrawingMap: Record<string, number | null>;
    if (this.showDrawingLabels && this.activeDrawings.length > 0) {
      if (this.drawingsDirty || this.lastExtractedDrawingQuote !== quote) {
        nextDrawingBadges = extractDrawingPriceBadges(this.activeDrawings, undefined, quote);
        this.drawingsDirty = false;
        this.lastExtractedDrawingQuote = quote;
      } else {
        nextDrawingBadges = this.drawingPriceBadges;
      }
      nextDrawingMap = {};
      for (const b of nextDrawingBadges) {
        nextDrawingMap[b.id] = this.projectPriceToY(b.price, ctx);
      }
    } else {
      nextDrawingBadges = [];
      nextDrawingMap = {};
      this.drawingsDirty = false;
    }

    // 2. Indicator price badges (lewati ekstraksi mahal jika hanya drawing yang berubah)
    let nextIndicatorBadges: PriceScaleBadge[];
    let nextIndicatorMap: Record<string, number | null>;
    if (this.showIndicatorLabels && this.activeIndicators.length > 0) {
      if (this.indicatorsDirty || this.lastExtractedIndicatorQuote !== quote) {
        nextIndicatorBadges = extractIndicatorPriceBadges(this.activeIndicators, undefined, quote);
        this.indicatorsDirty = false;
        this.lastExtractedIndicatorQuote = quote;
      } else {
        nextIndicatorBadges = this.indicatorPriceBadges;
      }
      nextIndicatorMap = {};
      for (const b of nextIndicatorBadges) {
        nextIndicatorMap[b.id] = this.projectPriceToY(b.price, ctx);
      }
    } else {
      nextIndicatorBadges = [];
      nextIndicatorMap = {};
      this.indicatorsDirty = false;
    }

    // 3. Alerts positions
    const nextAlertMap = this.computeAlertPositionMap(ctx);

    const changed =
      !areBadgeArraysEqual(this.drawingPriceBadges, nextDrawingBadges) ||
      !areBadgeArraysEqual(this.indicatorPriceBadges, nextIndicatorBadges) ||
      !areYMapsEqual(this.drawingBadgeYPositions, nextDrawingMap) ||
      !areYMapsEqual(this.indicatorBadgeYPositions, nextIndicatorMap) ||
      !areYMapsEqual(this.alertYPositions, nextAlertMap);

    if (!changed) {
      return false;
    }

    this.drawingPriceBadges = nextDrawingBadges;
    this.drawingBadgeYPositions = nextDrawingMap;
    this.indicatorPriceBadges = nextIndicatorBadges;
    this.indicatorBadgeYPositions = nextIndicatorMap;
    this.alertYPositions = nextAlertMap;
    this.tick++;
    return true;
  }

  private computeAlertPositionMap(ctx: PlotProjectionContext | null): Record<string, number | null> {
    const matchingAlerts = this.alerts.filter((a) => isSameInstrument(a.symbol, this.activeSymbol));
    const pos: Record<string, number | null> = {};
    for (const a of matchingAlerts) {
      pos[a.id] = this.projectPriceToY(a.targetPrice, ctx);
    }
    return pos;
  }

  private recomputeAlertPositions(): void {
    const ctx = this.buildProjectionContext();
    this.alertYPositions = this.computeAlertPositionMap(ctx);
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
