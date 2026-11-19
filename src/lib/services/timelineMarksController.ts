/**
 * TimelineMarksController — Pengendali Penanda Waktu Grafik (Timeline Marks Controller)
 *
 * Mengelola siklus hidup penanda peristiwa pada sumbu waktu horizontal (@luxalgo/vela chart.marks)
 * yang mencakup:
 * 1. Kalender Makroekonomi (Macro Events: FOMC, CPI, NFP, GDP, dll.)
 * 2. Titik Eksekusi Trading Plan (Trade Executions: Entry, Take Profit, Stop Loss)
 * 3. Catatan Jurnal & Tesis Analisis Trader (Journal Notes)
 *
 * Mendukung pengelompokan otomatis (zoom clustering), tooltip saat hover, popover interaktif saat klik,
 * serta pembersihan otomatis penanda usang (stale marks purge) saat berganti simbol/pasar.
 * Sesuai spesifikasi ADR dan Ticket #198.
 */

import type { ParsedTradingPlan } from './planParserService';
import type { PriceAlert } from '../types/market';
import { isSameSymbol } from './instrumentIdentity';
import { STANDARD_MACRO_CALENDAR_EVENTS } from './macroCalendarCatalog';
import { storage } from './persistence';

export type StandardMarkGroupId = 'macro' | 'trades' | 'journal';
export type MacroImpact = 'high' | 'medium' | 'low';

export interface MarkGlyph {
  shape?: 'circle' | 'square' | 'diamond' | 'pin';
  color: string;
  letter?: string;
  icon?: string;
}

export type MarkPanelItem =
  | { type: 'text'; text: string }
  | { type: 'field'; label: string; value: string }
  | { type: 'button'; label: string; primary?: boolean; close?: boolean; run(): void };

export type MarkContent =
  | { text: string }
  | { html: string }
  | { panel: { items: MarkPanelItem[] } };

export type MarkContentSource = MarkContent | (() => MarkContent | Promise<MarkContent>);

export interface TimelineMark {
  id: string;
  time: number;
  title?: string;
  glyph: MarkGlyph;
  tooltip?: string;
  group?: string;
  content?: MarkContentSource;
  symbol?: string;
}

export interface MarkGroup {
  id: string;
  label: string;
  visible?: boolean;
  parent?: string;
}

export interface MarkClickEvent {
  id: string;
  ids: string[];
  time: number;
  group?: string;
}

export interface MacroCalendarEvent {
  id: string;
  title: string;
  timestamp: number;
  impact: MacroImpact;
  country?: string;
  currency?: string;
  actual?: string | number;
  forecast?: string | number;
  previous?: string | number;
  unit?: string;
  category?: string;
  description?: string;
  relevantSymbols?: string[];
}

export interface TradeExecutionMarkerData {
  id: string;
  symbol: string;
  time: number;
  type: 'entry' | 'tp' | 'sl';
  side?: 'buy' | 'sell';
  price: number;
  size?: number | string;
  rMultiple?: number;
  planId?: string;
  label?: string;
  notes?: string;
}

export interface JournalMarkNote {
  id: string;
  symbol: string;
  time: number;
  title: string;
  note: string;
  tags?: string[];
  author?: string;
}

/**
 * Palet warna standar untuk glyph penanda waktu
 */
export const MARK_COLORS = {
  macroHigh: '#ef4444',
  macroMedium: '#f59e0b',
  macroLow: '#3b82f6',
  tradeEntry: '#10b981',
  tradeTp: '#06b6d4',
  tradeSl: '#f43f5e',
  journal: '#8b5cf6'
} as const;

/**
 * Definisi grup terstandarisasi untuk timeline marks
 */
export const STANDARD_MARK_GROUPS: readonly MarkGroup[] = [
  // Grup Utama Makroekonomi
  { id: 'macro', label: 'Macro Events', visible: true },
  { id: 'macro.high', label: 'High Impact', parent: 'macro', visible: true },
  { id: 'macro.medium', label: 'Medium Impact', parent: 'macro', visible: true },
  { id: 'macro.low', label: 'Low Impact', parent: 'macro', visible: true },

  // Grup Utama Eksekusi Trading
  { id: 'trades', label: 'Trade Executions', visible: true },
  { id: 'trades.entry', label: 'Entry Fills', parent: 'trades', visible: true },
  { id: 'trades.tp', label: 'Take Profit', parent: 'trades', visible: true },
  { id: 'trades.sl', label: 'Stop Loss', parent: 'trades', visible: true },

  // Grup Utama Catatan Jurnal
  { id: 'journal', label: 'Journal Notes', visible: true }
] as const;

/**
 * Memformat angka harga dengan pemisah ribuan
 */
function formatNumberWithCommas(val: number): string {
  if (!Number.isFinite(val)) return '0';
  const parts = val.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/**
 * Mengonversi acara makroekonomi menjadi TimelineMark Vela
 */
export function formatMacroTimelineMark(event: MacroCalendarEvent): TimelineMark {
  const isHigh = event.impact === 'high';
  const isMedium = event.impact === 'medium';
  const color = isHigh ? '#f3f4f6' : isMedium ? '#d1d5db' : '#9ca3af';
  const group = isHigh ? 'macro.high' : isMedium ? 'macro.medium' : 'macro.low';

  const tooltipParts: string[] = [];
  if (event.country) tooltipParts.push(`[${event.country}]`);
  tooltipParts.push(event.title);
  if (event.actual !== undefined && event.actual !== '') {
    tooltipParts.push(`• Act: ${event.actual}${event.unit || ''}`);
  }
  if (event.forecast !== undefined && event.forecast !== '') {
    tooltipParts.push(`• Fc: ${event.forecast}${event.unit || ''}`);
  }

  const items: MarkPanelItem[] = [
    { type: 'text', text: event.description || event.title }
  ];

  if (event.actual !== undefined && event.actual !== '') {
    items.push({ type: 'field', label: 'Actual', value: `${event.actual}${event.unit || ''}` });
  }
  if (event.forecast !== undefined && event.forecast !== '') {
    items.push({ type: 'field', label: 'Forecast', value: `${event.forecast}${event.unit || ''}` });
  }
  if (event.previous !== undefined && event.previous !== '') {
    items.push({ type: 'field', label: 'Previous', value: `${event.previous}${event.unit || ''}` });
  }
  if (event.impact) {
    items.push({ type: 'field', label: 'Impact', value: event.impact.toUpperCase() });
  }
  if (event.country) {
    items.push({ type: 'field', label: 'Country', value: event.country });
  }

  return {
    id: `macro_${event.id}`,
    time: event.timestamp,
    title: event.title,
    group,
    // Render sebagai titik putih bersih tanpa teks agar selaras dengan gaya OpenMarket
    glyph: {
      shape: 'circle',
      color
    },
    tooltip: tooltipParts.join(' '),
    content: {
      panel: { items }
    }
  };
}

/**
 * Mengonversi data eksekusi order trading menjadi TimelineMark Vela
 */
export function formatTradeExecutionTimelineMark(trade: TradeExecutionMarkerData): TimelineMark {
  const isEntry = trade.type === 'entry';
  const isTp = trade.type === 'tp';
  const isSl = trade.type === 'sl';

  const group = isEntry ? 'trades.entry' : isTp ? 'trades.tp' : 'trades.sl';
  const shape = isEntry ? 'diamond' : isTp ? 'pin' : 'square';
  const color = isEntry ? MARK_COLORS.tradeEntry : isTp ? MARK_COLORS.tradeTp : MARK_COLORS.tradeSl;
  const letter = isEntry ? 'E' : isTp ? 'TP' : 'SL';

  const formattedPrice = formatNumberWithCommas(trade.price);
  const title = trade.label || (isEntry ? 'Order Entry Filled' : isTp ? 'Take Profit Triggered' : 'Stop Loss Hit');

  const tooltipParts: string[] = [
    `[${title}]`,
    `$${formattedPrice}`
  ];
  if (trade.rMultiple !== undefined) {
    tooltipParts.push(`(${trade.rMultiple >= 0 ? '+' : ''}${trade.rMultiple}R)`);
  }

  const items: MarkPanelItem[] = [
    { type: 'text', text: trade.notes || `Eksekusi order ${title} pada simbol ${trade.symbol}.` },
    { type: 'field', label: 'Price', value: `$${formattedPrice}` }
  ];

  if (trade.side) {
    items.push({ type: 'field', label: 'Side', value: trade.side.toUpperCase() });
  }
  if (trade.size !== undefined) {
    items.push({ type: 'field', label: 'Size', value: String(trade.size) });
  }
  if (trade.rMultiple !== undefined) {
    items.push({ type: 'field', label: 'R-Multiple', value: `${trade.rMultiple}R` });
  }
  if (trade.planId) {
    items.push({ type: 'field', label: 'Plan ID', value: trade.planId });
  }

  return {
    id: `trade_${trade.type}_${trade.id}`,
    time: trade.time,
    title,
    group,
    glyph: {
      shape,
      color,
      letter
    },
    tooltip: tooltipParts.join(' '),
    content: {
      panel: { items }
    },
    symbol: trade.symbol
  };
}

/**
 * Memformat seluruh level trading plan (Entry, TP, SL) menjadi koleksi TimelineMark
 */
export function formatPlanLevelTimelineMarks(
  plan: ParsedTradingPlan & { id?: string; symbol?: string; createdAt?: number },
  alerts: PriceAlert[] = [],
  baseTime: number = Date.now()
): TimelineMark[] {
  const marks: TimelineMark[] = [];
  const planSymbol = plan.symbol || 'BTCUSDT';
  const planId = plan.id || 'active_plan';

  // 1. Eksekusi Entry
  const entryAlert = alerts.find(
    (a) => a.planRole === 'entry' || (a.planId === planId && a.label?.toLowerCase().includes('e'))
  );
  const entryTime = entryAlert?.triggeredAt || plan.createdAt || baseTime;

  marks.push(
    formatTradeExecutionTimelineMark({
      id: `${planId}_entry`,
      symbol: planSymbol,
      time: entryTime,
      type: 'entry',
      side: plan.bias === 'bearish' ? 'sell' : 'buy',
      price: plan.entry,
      planId,
      label: `Entry (${plan.bias.toUpperCase()})`,
      notes: plan.reasons?.entry || plan.rawText?.slice(0, 100) || 'Trading plan entry fill'
    })
  );

  // 2. Target Take Profit (TP1, TP2, ...)
  if (Array.isArray(plan.targets)) {
    plan.targets.forEach((tp, idx) => {
      const tpAlert = alerts.find(
        (a) => (a.planId === planId && a.label?.toLowerCase().includes(`tp${idx + 1}`)) ||
               (a.targetPrice === tp.price && a.triggered)
      );
      // Hanya generate timeline mark jika TP telah terpicu dengan timestamp aktual
      const tpTime = tpAlert?.triggeredAt || (tpAlert?.triggered ? (tpAlert.createdAt || baseTime) : (tp as any).triggeredAt);

      if (tpTime !== undefined) {
        marks.push(
          formatTradeExecutionTimelineMark({
            id: `${planId}_tp_${tp.id || idx + 1}`,
            symbol: planSymbol,
            time: tpTime,
            type: 'tp',
            side: plan.bias === 'bearish' ? 'buy' : 'sell',
            price: tp.price,
            rMultiple: tp.rMultiple,
            planId,
            label: tp.label || `TP${idx + 1}`,
            notes: tp.reason || `Target take profit ${tp.label || idx + 1}`
          })
        );
      }
    });
  }

  // 3. Stop Loss (SL)
  if (plan.stopLoss) {
    const slAlert = alerts.find(
      (a) => a.planRole === 'sl' || (a.planId === planId && a.label?.toLowerCase().includes('sl'))
    );
    // Hanya generate timeline mark jika SL telah terpicu dengan timestamp aktual
    const slTime = slAlert?.triggeredAt || (slAlert?.triggered ? (slAlert.createdAt || baseTime) : (plan as any).slTriggeredAt);

    if (slTime !== undefined) {
      marks.push(
        formatTradeExecutionTimelineMark({
          id: `${planId}_sl`,
          symbol: planSymbol,
          time: slTime,
          type: 'sl',
          side: plan.bias === 'bearish' ? 'buy' : 'sell',
          price: plan.stopLoss,
          rMultiple: -1.0,
          planId,
          label: 'Stop Loss',
          notes: plan.reasons?.sl || 'Stop loss level invalidation'
        })
      );
    }
  }

  return marks;
}

/**
 * Mengonversi catatan jurnal trader menjadi TimelineMark Vela
 */
export function formatJournalTimelineMark(note: JournalMarkNote): TimelineMark {
  const items: MarkPanelItem[] = [
    { type: 'text', text: note.note }
  ];

  if (note.tags && note.tags.length > 0) {
    items.push({ type: 'field', label: 'Tags', value: note.tags.join(', ') });
  }
  if (note.author) {
    items.push({ type: 'field', label: 'Author', value: note.author });
  }

  return {
    id: `journal_${note.id}`,
    time: note.time,
    title: note.title,
    group: 'journal',
    glyph: {
      shape: 'square',
      color: MARK_COLORS.journal,
      letter: 'J'
    },
    tooltip: `[Journal] ${note.title} • ${new Date(note.time).toLocaleDateString()}`,
    content: {
      panel: { items }
    },
    symbol: note.symbol
  };
}

/**
 * Controller utama untuk mengelola penanda waktu pada kanvas grafik Vela
 */
export class TimelineMarksController {
  private attachedCharts = new Set<any>();
  private groups = new Map<string, MarkGroup>();
  private groupVisibility = new Map<string, boolean>();

  // Penyimpanan internal data event & penanda
  private macroEvents: MacroCalendarEvent[] = [...STANDARD_MACRO_CALENDAR_EVENTS];
  private tradeExecutions: TradeExecutionMarkerData[] = [];
  private journalNotes: JournalMarkNote[] = [];
  private loadedPlans = new Map<
    string,
    { plan: ParsedTradingPlan & { id?: string; symbol?: string; createdAt?: number }; alerts: PriceAlert[] }
  >();
  private activeMarks: TimelineMark[] = [];

  private currentSymbol: string = 'BTCUSDT';
  private currentProviderId: string = 'binance';
  private macroHighImpactOnly: boolean = false;

  private clickListeners = new Set<(event: MarkClickEvent) => void>();
  private changeSubscribers = new Set<(marks: TimelineMark[]) => void>();
  private unsubs: Array<() => void> = [];

  constructor() {
    this.registerStandardGroups();
  }

  /**
   * Mendaftarkan grup standar awal
   */
  private registerStandardGroups(): void {
    for (const grp of STANDARD_MARK_GROUPS) {
      this.groups.set(grp.id, { ...grp });
      this.groupVisibility.set(grp.id, grp.visible ?? true);
    }
  }

  /**
   * Menghubungkan controller ke instance chart, cell, atau workspace Vela
   */
  public attach(chartOrTarget: any): void {
    if (!chartOrTarget) return;

    // Jika target adalah Workspace Vela dengan fungsi cells()
    if (typeof chartOrTarget.cells === 'function') {
      const ws = chartOrTarget;
      const initialCells = ws.cells() || [];
      for (const c of initialCells) {
        this.attachSingleCellOrChart(c);
      }

      if (typeof ws.on === 'function') {
        const uCreated = ws.on('cell:created', ({ id }: { id: string }) => {
          const c = ws.cell ? ws.cell(id) : null;
          if (c) {
            this.attachSingleCellOrChart(c);
          }
        });
        if (typeof uCreated === 'function') {
          this.unsubs.push(uCreated);
        }
      }
      return;
    }

    // Single cell atau single chart
    this.attachSingleCellOrChart(chartOrTarget);
  }

  /**
   * Menghubungkan satu cell atau satu chart ke controller
   */
  public attachSingleCellOrChart(target: any): void {
    if (!target) return;
    const chart = target.chart || target.inner || target;
    if (!chart) return;

    if (this.attachedCharts.has(chart)) {
      return;
    }
    this.attachedCharts.add(chart);

    // Pasang listener mark:click jika didukung
    if (typeof chart.on === 'function') {
      const unsub = chart.on('mark:click', (evt: MarkClickEvent) => {
        this.handleClick(evt);
      });
      if (typeof unsub === 'function') {
        this.unsubs.push(unsub);
      }
    }

    // Daftarkan grup yang sudah terdefinisi ke chart.marks
    this.syncGroupsToChart(chart);

    // Sinkronkan penanda aktif ke chart
    this.syncMarksToChart(chart);
  }

  /**
   * Melepaskan seluruh chart yang terhubung
   */
  public detach(): void {
    for (const u of this.unsubs) {
      try {
        u();
      } catch (err) {
        console.warn('[TimelineMarksController] Gagal menjalankan fungsi unsub saat detach:', err);
      }
    }
    this.unsubs = [];
    this.attachedCharts.clear();
  }

  /**
   * Mengecek apakah controller sedang terhubung ke minimal satu chart
   */
  public isAttached(): boolean {
    return this.attachedCharts.size > 0;
  }

  /**
   * Mendaftarkan grup baru ke controller dan seluruh chart aktif
   */
  public defineGroup(group: MarkGroup): this {
    if (!group || !group.id) return this;
    this.groups.set(group.id, { ...group });
    if (!this.groupVisibility.has(group.id)) {
      this.groupVisibility.set(group.id, group.visible ?? true);
    }

    for (const chart of this.attachedCharts) {
      const marksControl = chart.marks;
      if (marksControl && typeof marksControl.defineGroup === 'function') {
        try {
          marksControl.defineGroup(group);
        } catch (err) {
          console.warn(`[TimelineMarksController] Gagal defineGroup ${group.id}:`, err);
        }
      }
    }
    return this;
  }

  /**
   * Mengambil daftar semua grup terdefinisi
   */
  public getGroups(): MarkGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Mengatur visibilitas suatu grup pada seluruh chart
   */
  public setGroupVisible(id: string, visible: boolean = true): this {
    this.groupVisibility.set(id, visible);

    for (const chart of this.attachedCharts) {
      const marksControl = chart.marks;
      if (marksControl && typeof marksControl.setGroupVisible === 'function') {
        try {
          marksControl.setGroupVisible(id, visible);
        } catch (err) {
          console.warn(`[TimelineMarksController] Gagal setGroupVisible ${id}:`, err);
        }
      }
    }

    this.notifySubscribers();
    return this;
  }

  /**
   * Memeriksa visibilitas efektif suatu grup (memperhitungkan hierarki parent-child)
   */
  public isGroupVisible(id: string): boolean {
    let currentId: string | undefined = id;
    while (currentId) {
      const isVis = this.groupVisibility.get(currentId) ?? true;
      if (!isVis) return false;
      const grp = this.groups.get(currentId);
      currentId = grp?.parent;
    }
    return true;
  }

  /**
   * Menambahkan satu penanda ke controller dan seluruh chart aktif
   */
  public addMark(mark: TimelineMark): this {
    if (!mark || !mark.id) return this;
    const existingIdx = this.activeMarks.findIndex((m) => m.id === mark.id);
    if (existingIdx !== -1) {
      this.activeMarks[existingIdx] = mark;
    } else {
      this.activeMarks.push(mark);
    }

    for (const chart of this.attachedCharts) {
      const marksControl = chart.marks;
      if (marksControl && typeof marksControl.add === 'function') {
        try {
          marksControl.add(mark);
        } catch (err) {
          console.warn(`[TimelineMarksController] Gagal add mark ${mark.id}:`, err);
        }
      }
    }

    this.notifySubscribers();
    return this;
  }

  /**
   * Mengganti seluruh penanda aktif (replace whole set)
   */
  public setMarks(marks: readonly TimelineMark[]): this {
    this.activeMarks = [...marks];
    this.syncMarksToChart();
    this.notifySubscribers();
    return this;
  }

  /**
   * Menghapus penanda berdasarkan ID
   */
  public removeMark(id: string): this {
    this.activeMarks = this.activeMarks.filter((m) => m.id !== id);

    for (const chart of this.attachedCharts) {
      const marksControl = chart.marks;
      if (marksControl && typeof marksControl.remove === 'function') {
        try {
          marksControl.remove(id);
        } catch (err) {
          console.warn(`[TimelineMarksController] Gagal remove mark ${id}:`, err);
        }
      }
    }

    this.notifySubscribers();
    return this;
  }

  /**
   * Membersihkan semua penanda (atau berdasarkan filter grup)
   */
  public clearMarks(groupFilter?: string): this {
    if (groupFilter) {
      this.activeMarks = this.activeMarks.filter((m) => m.group !== groupFilter);
      this.syncMarksToChart();
    } else {
      this.activeMarks = [];
      for (const chart of this.attachedCharts) {
        const marksControl = chart.marks;
        if (marksControl && typeof marksControl.clear === 'function') {
          try {
            marksControl.clear();
          } catch (err) {
            console.warn('[TimelineMarksController] Gagal clear marks:', err);
          }
        }
      }
    }
    this.notifySubscribers();
    return this;
  }

  /**
   * Mengambil seluruh penanda yang sedang aktif di memori
   */
  public getActiveMarks(): TimelineMark[] {
    return [...this.activeMarks];
  }

  /**
   * Memuat acara makroekonomi ke penyimpanan controller
   */
  public loadMacroEvents(events: MacroCalendarEvent[]): void {
    if (!Array.isArray(events)) return;
    this.macroEvents = [...events];
    this.syncForMarket(this.currentSymbol, this.currentProviderId);
  }

  /**
   * Memuat data eksekusi order trading ke controller
   */
  public loadTradeExecution(trade: TradeExecutionMarkerData): void {
    if (!trade || !trade.id) return;
    const idx = this.tradeExecutions.findIndex((t) => t.id === trade.id);
    if (idx !== -1) {
      this.tradeExecutions[idx] = trade;
    } else {
      this.tradeExecutions.push(trade);
    }
    this.syncForMarket(this.currentSymbol, this.currentProviderId);
  }

  /**
   * Memuat trading plan ke controller dan mengonversi levelnya menjadi marks
   */
  public loadTradePlan(
    plan: ParsedTradingPlan & { id?: string; symbol?: string; createdAt?: number },
    alerts: PriceAlert[] = []
  ): void {
    if (!plan) return;
    const planId = plan.id || `${plan.symbol || 'plan'}_${plan.entry || Date.now()}`;
    this.loadedPlans.set(planId, { plan, alerts });

    // Hapus marks lama dari plan yang sama
    const planPrefix = `trade_entry_${plan.id || ''}`;
    this.activeMarks = this.activeMarks.filter((m) => !m.id.startsWith(planPrefix));

    const planMarks = formatPlanLevelTimelineMarks(plan, alerts);
    const planSymbol = plan.symbol || 'BTCUSDT';
    if (isSameSymbol(planSymbol, this.currentSymbol)) {
      for (const m of planMarks) {
        this.activeMarks.push(m);
      }
      this.syncMarksToChart();
      this.notifySubscribers();
    }
  }

  /**
   * Memuat sekumpulan trading plan ke controller
   */
  public loadTradePlans(
    plans: Array<ParsedTradingPlan & { id?: string; symbol?: string; createdAt?: number }>,
    alerts: PriceAlert[] = []
  ): void {
    if (!Array.isArray(plans)) return;
    for (const plan of plans) {
      const planId = plan.id || `${plan.symbol || 'plan'}_${plan.entry || Date.now()}`;
      this.loadedPlans.set(planId, { plan, alerts });
    }
    this.syncForMarket(this.currentSymbol, this.currentProviderId);
  }

  /**
   * Memuat catatan jurnal trader ke controller
   */
  public loadJournalNotes(notes: JournalMarkNote[]): void {
    if (!Array.isArray(notes)) return;
    this.journalNotes = [...notes];
    this.syncForMarket(this.currentSymbol, this.currentProviderId);
  }

  public hydrateFromPersistence(): void {
    try {
      const saved = storage.getUiPreferenceSync<boolean | string>('macro_marks_high_impact_only');
      if (saved === true || saved === 'true') {
        this.setMacroHighImpactOnly(true, false);
      }
    } catch {
      // Abaikan jika persistence belum ter-bootstrap pada unit test terisolasi
    }
  }

  public setMacroHighImpactOnly(highOnly: boolean, persist: boolean = true): void {
    const next = Boolean(highOnly);
    if (this.macroHighImpactOnly !== next) {
      this.macroHighImpactOnly = next;
      this.setGroupVisible('macro.medium', !next);
      this.setGroupVisible('macro.low', !next);
      this.syncForMarket(this.currentSymbol, this.currentProviderId);
    }
    if (persist) {
      void storage.setUiPreference('macro_marks_high_impact_only', next).catch(() => {});
    }
  }

  public isMacroHighImpactOnly(): boolean {
    return this.macroHighImpactOnly;
  }

  /**
   * Menyelaraskan penanda untuk pasar / simbol tertentu
   * Membersihkan penanda usang (stale marks) dan memuat penanda yang relevan untuk pasar baru
   */
  public syncForMarket(symbol: string, providerId?: string): void {
    if (!symbol) return;
    this.currentSymbol = symbol;
    if (providerId) this.currentProviderId = providerId;

    const matchedMarks: TimelineMark[] = [];

    // 1. Filter Acara Makroekonomi (Mendukung Wildcard * / ALL atau array kosong untuk peristiwa menyeluruh)
    for (const evt of this.macroEvents) {
      if (this.macroHighImpactOnly && evt.impact !== 'high') continue;
      if (
        !evt.relevantSymbols ||
        evt.relevantSymbols.length === 0 ||
        evt.relevantSymbols.includes('*') ||
        evt.relevantSymbols.includes('ALL') ||
        evt.relevantSymbols.some((sym) => isSameSymbol(sym, symbol))
      ) {
        matchedMarks.push(formatMacroTimelineMark(evt));
      }
    }

    // 2. Filter Eksekusi Trading
    for (const trade of this.tradeExecutions) {
      if (isSameSymbol(trade.symbol, symbol)) {
        matchedMarks.push(formatTradeExecutionTimelineMark(trade));
      }
    }

    // 3. Filter Level Trading Plans Aktif
    for (const { plan, alerts } of this.loadedPlans.values()) {
      const planSymbol = plan.symbol || 'BTCUSDT';
      if (isSameSymbol(planSymbol, symbol)) {
        matchedMarks.push(...formatPlanLevelTimelineMarks(plan, alerts));
      }
    }

    // 4. Filter Catatan Jurnal
    for (const note of this.journalNotes) {
      if (isSameSymbol(note.symbol, symbol)) {
        matchedMarks.push(formatJournalTimelineMark(note));
      }
    }

    // Ganti total penanda aktif (membersihkan stale marks)
    this.setMarks(matchedMarks);
  }

  /**
   * Mendaftarkan callback saat pengguna mengeklik glyph penanda waktu
   */
  public onMarkClick(cb: (event: MarkClickEvent) => void): () => void {
    this.clickListeners.add(cb);
    return () => this.clickListeners.delete(cb);
  }

  /**
   * Mendaftarkan langganan pembaruan penanda
   */
  public subscribe(fn: (marks: TimelineMark[]) => void): () => void {
    this.changeSubscribers.add(fn);
    fn(this.getActiveMarks());
    return () => this.changeSubscribers.delete(fn);
  }

  /**
   * Pembersihan menyeluruh (Teardown Lifecycle)
   */
  public destroy(): void {
    this.clearMarks();
    this.detach();
    this.clickListeners.clear();
    this.changeSubscribers.clear();
    this.macroEvents = [];
    this.tradeExecutions = [];
    this.journalNotes = [];
    this.loadedPlans.clear();
    this.activeMarks = [];
  }

  // ─── Helpers Internal ───

  private syncGroupsToChart(targetChart?: any): void {
    const charts = targetChart ? [targetChart] : Array.from(this.attachedCharts);

    for (const chart of charts) {
      const marksControl = chart?.marks;
      if (!marksControl || typeof marksControl.defineGroup !== 'function') continue;

      for (const grp of this.groups.values()) {
        try {
          marksControl.defineGroup(grp);
          const isVis = this.groupVisibility.get(grp.id) ?? true;
          if (typeof marksControl.setGroupVisible === 'function') {
            marksControl.setGroupVisible(grp.id, isVis);
          }
        } catch (err) {
          console.warn(`[TimelineMarksController] Gagal mendefinisikan grup ${grp.id}:`, err);
        }
      }
    }
  }

  private syncMarksToChart(targetChart?: any): void {
    const charts = targetChart ? [targetChart] : Array.from(this.attachedCharts);

    for (const chart of charts) {
      const marksControl = chart?.marks;
      if (!marksControl) continue;

      try {
        if (typeof marksControl.set === 'function') {
          marksControl.set(this.activeMarks);
        } else if (typeof marksControl.clear === 'function' && typeof marksControl.add === 'function') {
          marksControl.clear();
          for (const m of this.activeMarks) {
            marksControl.add(m);
          }
        }
      } catch (err) {
        console.warn('[TimelineMarksController] Gagal menyelaraskan penanda ke chart:', err);
      }
    }
  }

  private handleClick(event: MarkClickEvent): void {
    for (const cb of this.clickListeners) {
      try {
        cb(event);
      } catch (err) {
        console.warn('[TimelineMarksController] Error pada click listener:', err);
      }
    }
  }

  private notifySubscribers(): void {
    const snapshot = this.getActiveMarks();
    for (const fn of this.changeSubscribers) {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('[TimelineMarksController] Error pada subscriber:', err);
      }
    }
  }
}

/**
 * Singleton instance bawaan untuk kemudahan integrasi di seluruh UI Trawangan
 */
export const timelineMarksController = new TimelineMarksController();
