/**
 * TradingPlanLifecycle — Deep Module untuk Siklus Hidup Rencana Perdagangan (Trading Plan Lifecycle)
 *
 * Mengenkapsulasi:
 * 1. Proyeksi Multi-Target Position Plan (staged position boxes), Dual-Entry Plan (entry_zone box),
 *    dan Context Zone (dengan Zone Polarity otomatis).
 * 2. Rekonsiliasi mutasi kanvas dua arah (Bidirectional Sync) termasuk pergeseran proporsional (Delta-Shift)
 *    pada Dual-Entry Plan (E1, E2, Entry Zone, Blended Entry, riskAmount, riskPercent, rMultiple, rMultipleByEntry)
 *    serta sinkronisasi Plan-Linked Auto-Alerts.
 * 3. Deduplikasi & relinking deterministik saat pemulihan gambar dari penyimpanan (tryRelinkPlanDrawings).
 * 4. Pembersihan rencana yatim (orphan cleanup) dengan perlindungan Exchange-Aware Drawing Isolation.
 * 5. Rekonsiliasi transisi Undo/Redo dan serialisasi envelope (_trawangan_meta).
 * 6. Evaluasi status pasar live (evaluatePlanMarketStatus).
 */

import type { SavedTradingPlanRecord } from '../types/market';
import { alertService } from './alertService';
import { saveTradingPlanToHistory } from './persistence';
import {
  inferZonePolarity,
  type ParsedTradingPlan,
  type ZonePolarity
} from './planParserService';
import { getAdaptiveTickSize, roundToTickSize } from './priceSnapService';

export const CONTEXT_ZONE_STYLES = {
  bull: {
    fillColor: 'transparent',
    lineColor: 'rgba(0, 255, 136, 0.4)',
    textColor: '#00FF88'
  },
  bear: {
    fillColor: 'transparent',
    lineColor: 'rgba(255, 105, 180, 0.4)',
    textColor: '#FF69B4'
  },
  neutral: {
    fillColor: 'transparent',
    lineColor: 'rgba(160, 160, 160, 0.4)',
    textColor: '#A0A0A0'
  }
} as const;

export const ENTRY_ZONE_STYLES = {
  bull: {
    fillColor: 'transparent',
    lineColor: 'rgba(0, 255, 136, 0.6)',
    textColor: '#00FF88'
  },
  bear: {
    fillColor: 'transparent',
    lineColor: 'rgba(255, 105, 180, 0.6)',
    textColor: '#FF69B4'
  },
  neutral: {
    fillColor: 'transparent',
    lineColor: 'rgba(255, 204, 0, 0.6)',
    textColor: '#FFCC00'
  }
} as const;

/**
 * Membandingkan dua simbol instrumen perdagangan dengan normalisasi nama dan toleransi sufiks kontrak (.P / PERP)
 */
export function isSamePlanSymbol(symA?: string, symB?: string): boolean {
  if (!symA || !symB) return false;
  const cleanA = symA.replace(/^[^:]+:/, '').trim().toUpperCase();
  const cleanB = symB.replace(/^[^:]+:/, '').trim().toUpperCase();
  if (cleanA === cleanB) return true;
  const strip = (s: string) => s.replace(/\.P$|-PERP$|PERP$/i, '').replace(/[-_/]/g, '');
  return strip(cleanA) === strip(cleanB);
}

export type ActiveTradingPlan = ParsedTradingPlan & {
  id: string;
  symbol?: string;
};

export interface ApplyPlanOptions {
  planId?: string;
  anchorTime?: number;
  barSpanPerTarget?: number;
  paneId?: string;
  drawContextZones?: boolean;
  autoCreateAlerts?: boolean;
  skipVaultSave?: boolean;
  createdAt?: number;
}

export interface AppliedPlanResult {
  planId: string;
  plan: ActiveTradingPlan;
  drawingIds: string[];
  drawings: any[];
}

export type PlanMarketPhase =
  | 'target_reached'
  | 'stopped_out'
  | 'in_entry_zone'
  | 'in_profit'
  | 'waiting_trigger';

export interface LivePlanEvaluation {
  phase: PlanMarketPhase;
  label: string;
  badgeClass: 'status-tp' | 'status-sl' | 'status-running' | 'status-waiting';
  diffPct: number;
  diffPctText: string;
}

export interface SerializedPlanEnvelope {
  drawingMetadata: Record<string, any>;
  activePlans: ActiveTradingPlan[];
  planDrawingIds: Array<[string, string[]]>;
  timestamp: number;
}

export interface PlanUndoTransaction {
  plan: ActiveTradingPlan;
  drawingIds: string[];
  drawings: any[];
  autoCreateAlerts: boolean;
}

export interface TradingPlanExecutionContext {
  hasActiveCanvas: boolean;
  symbol: string;
  providerId: string;
  timeframe: string;
  deltaT: number;
  latestCandleTime: number;
}

/**
 * SEAM: Local-substitutable port antara TradingPlanLifecycle dan host kanvas/storage/alert.
 */
export interface TradingPlanHostPort {
  getContext(): TradingPlanExecutionContext;
  ensureSymbolReady?(symbol: string): Promise<void>;
  getCanvasDrawings(): any[];
  createCanvasDrawing(spec: Record<string, any>): any | null;
  removeCanvasDrawings(ids: string[]): void;
  recordUndoAction?(tx: PlanUndoTransaction): void;
  saveToVault?(record: SavedTradingPlanRecord): void;
  addPlanAlerts?(plan: ActiveTradingPlan, symbol: string): void;
  syncPlanAlertPrices?(plan: ActiveTradingPlan): void;
  deleteAlertsByPlanId?(planId: string): void;
  onStateChanged?(): void;
}

/**
 * Membangun teks label kotak Entry Zone untuk Dual-Entry Plan
 */
export function formatEntryZoneLabel(
  entries: NonNullable<ParsedTradingPlan['entries']>,
  minEntry: number,
  maxEntry: number
): string {
  const e1 = entries.find((e) => e.id === 'e1');
  const e2 = entries.find((e) => e.id === 'e2');
  return e1 && e2
    ? `Entry Zone: ${minEntry} - ${maxEntry} (E1: ${e1.price} · E2: ${e2.price})`
    : `Entry Zone: ${minEntry} - ${maxEntry}`;
}

/**
 * Menghitung ulang metrik risiko dan R-multiple (Blended Entry maupun Dual-Entry e1/e2) secara in-place pada plan
 */
export function recalculatePlanRiskAndTargets(plan: ActiveTradingPlan): void {
  const risk = Math.abs(plan.entry - plan.stopLoss);
  plan.riskAmount = parseFloat(risk.toFixed(8));
  if (plan.entry > 0) {
    plan.riskPercent = parseFloat(((risk / plan.entry) * 100).toFixed(2));
  }

  const isBearish = plan.bias === 'bearish' || plan.stopLoss > plan.entry;

  if (Array.isArray(plan.entries) && plan.entries.length > 0) {
    for (const entryLevel of plan.entries) {
      if (typeof entryLevel.price === 'number' && !isNaN(entryLevel.price)) {
        entryLevel.riskAmount = parseFloat(Math.abs(entryLevel.price - plan.stopLoss).toFixed(8));
      }
    }
  }

  if (!Array.isArray(plan.targets)) return;

  for (let i = 0; i < plan.targets.length; i++) {
    const tgt = plan.targets[i];
    if (!tgt || typeof tgt.price !== 'number' || isNaN(tgt.price)) continue;

    tgt.distance = parseFloat(Math.abs(tgt.price - plan.entry).toFixed(8));
    if (risk > 0) {
      const rawR = isBearish
        ? (plan.entry - tgt.price) / risk
        : (tgt.price - plan.entry) / risk;
      tgt.rMultiple = parseFloat(rawR.toFixed(2));
    }

    if (Array.isArray(plan.entries) && plan.entries.length > 0) {
      const rByEntry: Record<string, number> = { ...(tgt.rMultipleByEntry || {}) };
      for (const entryLevel of plan.entries) {
        if (typeof entryLevel.price === 'number' && !isNaN(entryLevel.price)) {
          const entryRisk = Math.abs(entryLevel.price - plan.stopLoss);
          if (entryRisk > 0) {
            const rawLevelR = isBearish
              ? (entryLevel.price - tgt.price) / entryRisk
              : (tgt.price - entryLevel.price) / entryRisk;
            rByEntry[entryLevel.id] = parseFloat(rawLevelR.toFixed(2));
          }
        }
      }
      tgt.rMultipleByEntry = rByEntry;
    }
  }
}

/**
 * Evaluasi deterministik harga pasar live terhadap level Entry, Dual-Entry Zone, Stop Loss, dan Multi-Target
 */
export function evaluatePlanMarketStatus(
  planOrRecord: ParsedTradingPlan | SavedTradingPlanRecord | null | undefined,
  currentPrice: number | null | undefined,
  activeSymbol?: string
): LivePlanEvaluation | null {
  if (!planOrRecord || currentPrice === null || currentPrice === undefined || currentPrice <= 0) {
    return null;
  }

  const isSavedRecord = 'plan' in planOrRecord && planOrRecord.plan !== undefined;
  const plan: ParsedTradingPlan = isSavedRecord
    ? (planOrRecord as SavedTradingPlanRecord).plan
    : (planOrRecord as ParsedTradingPlan);
  const recordSymbol = isSavedRecord
    ? (planOrRecord as SavedTradingPlanRecord).symbol || plan?.symbol
    : plan?.symbol;

  if (activeSymbol && recordSymbol && !isSamePlanSymbol(recordSymbol, activeSymbol)) {
    return null;
  }

  if (!plan || !plan.entry || !plan.stopLoss) return null;

  const isBull = plan.bias !== 'bearish';
  const diffPct = ((currentPrice - plan.entry) / plan.entry) * 100;
  const sign = diffPct >= 0 ? '+' : '';
  const diffPctText = `${sign}${diffPct.toFixed(2)}% dari Entry`;

  const sortedTargets = [...(plan.targets || [])]
    .filter((t) => typeof t.price === 'number' && !isNaN(t.price))
    .sort((a, b) => (isBull ? b.price - a.price : a.price - b.price));

  for (const t of sortedTargets) {
    if ((isBull && currentPrice >= t.price) || (!isBull && currentPrice <= t.price)) {
      return {
        phase: 'target_reached',
        label: `Di Area / Lewat ${t.label || t.id.toUpperCase()}`,
        badgeClass: 'status-tp',
        diffPct,
        diffPctText
      };
    }
  }

  if ((isBull && currentPrice <= plan.stopLoss) || (!isBull && currentPrice >= plan.stopLoss)) {
    return {
      phase: 'stopped_out',
      label: 'Di Area / Lewat Stop Loss',
      badgeClass: 'status-sl',
      diffPct,
      diffPctText
    };
  }

  // Jika ada Dual-Entry Plan, periksa apakah harga saat ini berada di dalam Entry Zone
  if (Array.isArray(plan.entries) && plan.entries.length > 1) {
    const entryPrices = plan.entries
      .map((e) => e.price)
      .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);
    if (entryPrices.length >= 2) {
      const minE = Math.min(...entryPrices);
      const maxE = Math.max(...entryPrices);
      if (currentPrice >= minE && currentPrice <= maxE) {
        return {
          phase: 'in_entry_zone',
          label: 'Di Dalam Entry Zone (Menjemput Limit)',
          badgeClass: 'status-waiting',
          diffPct,
          diffPctText
        };
      }
    }
  }

  if ((isBull && currentPrice >= plan.entry) || (!isBull && currentPrice <= plan.entry)) {
    return {
      phase: 'in_profit',
      label: 'Berjalan Menuju Target (In Profit)',
      badgeClass: 'status-running',
      diffPct,
      diffPctText
    };
  }

  return {
    phase: 'waiting_trigger',
    label: 'Antara Entry & SL / Menunggu Trigger',
    badgeClass: 'status-waiting',
    diffPct,
    diffPctText
  };
}

/**
 * Implementasi Deep Module TradingPlanLifecycle
 */
export class TradingPlanLifecycle {
  private activePlans = new Map<string, ActiveTradingPlan>();
  private planDrawingIds = new Map<string, Set<string>>();
  private drawingMetadata = new Map<string, any>();
  private drawingPlanMap = new Map<string, string>();
  private showThesisCards = true;
  private isProjecting = false;

  constructor(private readonly host: TradingPlanHostPort) {}

  private saveVault(record: SavedTradingPlanRecord): void {
    if (this.host.saveToVault) {
      this.host.saveToVault(record);
    } else {
      saveTradingPlanToHistory(record);
    }
  }

  private createAlerts(plan: ActiveTradingPlan, symbol: string): void {
    if (this.host.addPlanAlerts) {
      this.host.addPlanAlerts(plan, symbol);
    } else {
      alertService.addPlanAlerts(plan, symbol);
    }
  }

  private syncAlerts(plan: ActiveTradingPlan): void {
    if (this.host.syncPlanAlertPrices) {
      this.host.syncPlanAlertPrices(plan);
    } else {
      alertService.syncPlanAlertPrices(plan);
    }
  }

  private removeAlerts(planId: string): void {
    if (this.host.deleteAlertsByPlanId) {
      this.host.deleteAlertsByPlanId(planId);
    } else {
      alertService.deleteAlertsByPlanId(planId);
    }
  }

  private notifyChanged(): void {
    this.host.onStateChanged?.();
  }

  /**
   * Proyeksi sinkron ParsedTradingPlan ke kanvas menjadi Staged Position Boxes, Entry Zone, dan Context Zone
   */
  projectPlan(
    plan: ParsedTradingPlan & { id?: string },
    options?: ApplyPlanOptions
  ): AppliedPlanResult | null {
    if (!plan) return null;
    if (plan.validation && !plan.validation.valid) return null;
    if (!plan.entry || !plan.stopLoss || !plan.targets || plan.targets.length === 0) {
      return null;
    }

    const ctx = this.host.getContext();
    if (!ctx.hasActiveCanvas) {
      return null;
    }

    const deltaT = ctx.deltaT > 0 ? ctx.deltaT : 3600000;
    const t0 = options?.anchorTime || ctx.latestCandleTime || Date.now();
    const span = options?.barSpanPerTarget && options.barSpanPerTarget > 0 ? options.barSpanPerTarget : 25;
    const paneId = options?.paneId || 'price';

    const planId =
      options?.planId ||
      plan.id ||
      `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdDrawings: any[] = [];
    const createdDrawingIds: string[] = [];

    this.isProjecting = true;
    try {
      // 1. Gambar kotak posisi bertingkat (Staged Position Boxes)
    for (let i = 0; i < plan.targets.length; i++) {
      const target = plan.targets[i];
      if (typeof target.price !== 'number' || isNaN(target.price)) continue;

      const startTime = t0 + i * span * deltaT;
      const endTime = startTime + span * deltaT;

      const rMultipleFormatted =
        typeof target.rMultiple === 'number' && !isNaN(target.rMultiple)
          ? `${target.label || `TP${i + 1}`} (${target.rMultiple.toFixed(2)}R)`
          : target.label || `TP${i + 1}`;

      const stageDrawingSpec: any = {
        type: 'position',
        paneId,
        showPrices: true,
        showTargetLabel: true,
        showStopLabel: true,
        targetLabel: rMultipleFormatted,
        anchors: [
          { time: startTime, price: plan.entry },
          { time: endTime, price: plan.stopLoss },
          { time: endTime, price: target.price }
        ],
        metadata: {
          planId,
          stageIndex: i + 1,
          targetLabel: target.label || `TP${i + 1}`,
          rMultiple: target.rMultiple,
          bias: plan.bias,
          reasons: plan.reasons,
          contextZones: plan.contextZones,
          rawPlanText: plan.rawText,
          lastEntry: plan.entry,
          lastStop: plan.stopLoss,
          lastTarget: target.price
        }
      };

      const created = this.host.createCanvasDrawing(stageDrawingSpec);
      if (created) {
        const id = created.id || stageDrawingSpec.id;
        const drawingRecord = {
          ...stageDrawingSpec,
          ...created,
          id
        };
        createdDrawings.push(drawingRecord);
        if (id) {
          createdDrawingIds.push(id);
          this.drawingMetadata.set(id, stageDrawingSpec.metadata);
          this.drawingPlanMap.set(id, planId);
        }
      }
    }

    // 1b. Gambar kotak arsiran zona entry (Dual-Entry Zone) jika ada beberapa level entry (ADR-0020)
    if (Array.isArray(plan.entries) && plan.entries.length > 1) {
      const entryPrices = plan.entries
        .map((e) => e.price)
        .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);
      if (entryPrices.length >= 2) {
        const minEntry = Math.min(...entryPrices);
        const maxEntry = Math.max(...entryPrices);
        const lastEndTime = t0 + plan.targets.length * span * deltaT;
        const isBear = plan.bias === 'bearish' || plan.stopLoss > plan.entry;
        const zoneStyle = isBear ? ENTRY_ZONE_STYLES.bear : ENTRY_ZONE_STYLES.bull;
        const labelText = formatEntryZoneLabel(plan.entries, minEntry, maxEntry);

        const entryBoxSpec: any = {
          type: 'box',
          paneId,
          anchors: [
            { time: t0, price: maxEntry },
            { time: lastEndTime, price: minEntry }
          ],
          style: {
            fillColor: zoneStyle.fillColor,
            lineColor: zoneStyle.lineColor,
            lineWidth: 1
          },
          text: {
            value: labelText,
            color: zoneStyle.textColor,
            halign: 'center',
            valign: 'middle',
            align: 'center'
          },
          metadata: {
            planId,
            role: 'entry_zone',
            entries: plan.entries.map((e) => ({ ...e })),
            minEntry,
            maxEntry
          }
        };

        const createdEntryBox = this.host.createCanvasDrawing(entryBoxSpec);
        if (createdEntryBox) {
          const boxId = createdEntryBox.id || entryBoxSpec.id;
          const boxRecord = { ...entryBoxSpec, ...createdEntryBox, id: boxId };
          createdDrawings.push(boxRecord);
          if (boxId) {
            createdDrawingIds.push(boxId);
            this.drawingMetadata.set(boxId, entryBoxSpec.metadata);
            this.drawingPlanMap.set(boxId, planId);
          }
        }
      }
    }

    // 2. Gambar kotak zona FVG / Context Zone transparan otomatis (#115)
    if (
      options?.drawContextZones !== false &&
      Array.isArray(plan.contextZones) &&
      plan.contextZones.length > 0
    ) {
      const lastEndTime = t0 + plan.targets.length * span * deltaT;

      for (const zone of plan.contextZones) {
        if (
          typeof zone.low !== 'number' ||
          typeof zone.high !== 'number' ||
          isNaN(zone.low) ||
          isNaN(zone.high)
        ) {
          continue;
        }

        const zonePol: ZonePolarity = zone.polarity || inferZonePolarity(zone.label);
        const zoneStyle = CONTEXT_ZONE_STYLES[zonePol] || CONTEXT_ZONE_STYLES.neutral;

        const boxSpec: any = {
          type: 'box',
          paneId,
          anchors: [
            { time: t0, price: zone.high },
            { time: lastEndTime, price: zone.low }
          ],
          style: {
            fillColor: zoneStyle.fillColor,
            lineColor: zoneStyle.lineColor,
            lineWidth: 1
          },
          text: {
            value: zone.label || 'FVG Zone',
            color: zoneStyle.textColor,
            halign: 'center',
            valign: 'middle',
            align: 'center'
          },
          metadata: {
            planId,
            role: 'context_zone',
            zoneLabel: zone.label,
            low: zone.low,
            high: zone.high,
            polarity: zonePol
          }
        };

        const createdBox = this.host.createCanvasDrawing(boxSpec);
        if (createdBox) {
          const boxId = createdBox.id || boxSpec.id;
          const boxRecord = { ...boxSpec, ...createdBox, id: boxId };
          createdDrawings.push(boxRecord);
          if (boxId) {
            createdDrawingIds.push(boxId);
            this.drawingMetadata.set(boxId, boxSpec.metadata);
            this.drawingPlanMap.set(boxId, planId);
          }
        }
      }
    }
    } finally {
      this.isProjecting = false;
    }

    if (createdDrawings.length === 0) {
      return null;
    }

    const targetSymbol = plan.symbol || ctx.symbol || 'BTCUSDT';
    const planRecord: ActiveTradingPlan = {
      ...plan,
      id: planId,
      symbol: targetSymbol,
      entries: Array.isArray(plan.entries) ? plan.entries.map((e) => ({ ...e })) : undefined,
      targets: Array.isArray(plan.targets)
        ? plan.targets.map((t) => ({
            ...t,
            rMultipleByEntry: t.rMultipleByEntry ? { ...t.rMultipleByEntry } : undefined
          }))
        : []
    };

    this.activePlans.set(planId, planRecord);
    this.planDrawingIds.set(planId, new Set(createdDrawingIds));

    // Simpan otomatis ke Trade Plan Vault (kecuali saat restore / re-plot dari vault)
    if (!options?.skipVaultSave) {
      try {
        this.saveVault({
          id: planId,
          symbol: targetSymbol,
          providerId: ctx.providerId || 'binance',
          timeframe: ctx.timeframe || '15m',
          createdAt: options?.createdAt || Date.now(),
          updatedAt: Date.now(),
          rawText: plan.rawText || '',
          plan: planRecord
        });
      } catch (err) {
        console.warn('Gagal menyimpan Trade Plan ke Trade Plan Vault:', err);
      }
    }

    // Pasang Plan-Linked Auto-Alerts jika diaktifkan
    if (options?.autoCreateAlerts) {
      try {
        this.createAlerts(planRecord, targetSymbol);
      } catch (err) {
        console.warn('Gagal membuat Plan-Linked Auto-Alerts:', err);
      }
    }

    // Catat aksi ke undo history host
    this.host.recordUndoAction?.({
      plan: planRecord,
      drawingIds: createdDrawingIds,
      drawings: createdDrawings,
      autoCreateAlerts: Boolean(options?.autoCreateAlerts)
    });

    this.notifyChanged();

    return {
      planId,
      plan: planRecord,
      drawingIds: createdDrawingIds,
      drawings: createdDrawings
    };
  }

  /**
   * Menerapkan rencana perdagangan secara deterministik (menunggu kesiapan simbol jika lintas simbol, tanpa setTimeout arbitrer)
   */
  async applyPlan(
    plan: ParsedTradingPlan & { id?: string },
    options?: ApplyPlanOptions
  ): Promise<AppliedPlanResult | null> {
    if (!plan) return null;
    const ctx = this.host.getContext();
    const targetSymbol = plan.symbol || ctx.symbol;
    if (
      targetSymbol &&
      ctx.symbol &&
      !isSamePlanSymbol(targetSymbol, ctx.symbol) &&
      typeof this.host.ensureSymbolReady === 'function'
    ) {
      await this.host.ensureSymbolReady(targetSymbol);
    }
    return this.projectPlan({ ...plan, symbol: targetSymbol }, options);
  }

  /**
   * Shortcut ergonomis untuk me-replot SavedTradingPlanRecord dari Trade Plan Vault
   */
  async replotFromVault(
    record: SavedTradingPlanRecord,
    withAlerts = false
  ): Promise<AppliedPlanResult | null> {
    if (!record?.plan) return null;
    const ctx = this.host.getContext();
    const targetSymbol = record.symbol || record.plan.symbol || ctx.symbol;
    return this.applyPlan(
      {
        ...record.plan,
        symbol: targetSymbol
      },
      {
        autoCreateAlerts: withAlerts,
        skipVaultSave: true
      }
    );
  }

  /**
   * Dapatkan daftar rencana perdagangan aktif yang terfilter sesuai simbol aktif
   */
  getActivePlans(symbolFilter?: string): ActiveTradingPlan[] {
    const all = Array.from(this.activePlans.values());
    const filter =
      symbolFilter !== undefined ? symbolFilter : this.host.getContext().symbol;

    if (!filter || filter === '*' || filter.toUpperCase() === 'ALL') {
      return all;
    }
    return all.filter((p) => !p.symbol || isSamePlanSymbol(p.symbol, filter));
  }

  /**
   * Dapatkan seluruh rencana perdagangan tanpa filter simbol
   */
  getAllActivePlans(): ActiveTradingPlan[] {
    return Array.from(this.activePlans.values());
  }

  isThesisCardsVisible(): boolean {
    return this.showThesisCards;
  }

  setThesisCardsVisible(visible: boolean): void {
    this.showThesisCards = visible;
    this.notifyChanged();
  }

  toggleThesisCardsVisible(): boolean {
    this.showThesisCards = !this.showThesisCards;
    this.notifyChanged();
    return this.showThesisCards;
  }

  /**
   * Hapus satu rencana perdagangan beserta seluruh staged position, entry_zone, context_zone, dan Plan-Linked Auto-Alerts
   */
  removePlan(planId: string): void {
    const drawingIdSet = this.planDrawingIds.get(planId) || new Set<string>();
    const currentDrawings = this.host.getCanvasDrawings() || [];
    const toDelete = currentDrawings.filter(
      (d) => d && (d.metadata?.planId === planId || drawingIdSet.has(d.id))
    );
    const idsToDelete = Array.from(
      new Set([...Array.from(drawingIdSet), ...toDelete.map((d) => d.id).filter(Boolean)])
    );

    this.activePlans.delete(planId);
    this.planDrawingIds.delete(planId);
    for (const id of idsToDelete) {
      this.drawingMetadata.delete(id);
      this.drawingPlanMap.delete(id);
    }

    this.removeAlerts(planId);

    if (idsToDelete.length > 0) {
      this.host.removeCanvasDrawings(idsToDelete);
    }
    this.notifyChanged();
  }

  /**
   * Bersihkan seluruh rencana perdagangan aktif beserta gambarnya dari kanvas
   */
  clearAllPlans(): void {
    const planIds = Array.from(this.activePlans.keys());
    for (const pid of planIds) {
      this.removePlan(pid);
    }
    this.activePlans.clear();
    this.planDrawingIds.clear();
    this.drawingMetadata.clear();
    this.drawingPlanMap.clear();
    this.notifyChanged();
  }

  /**
   * Bersihkan state in-memory rencana dan metadata (misal saat clearAll atau sebelum restoreDrawings)
   */
  resetInMemoryState(deleteAlerts = false): void {
    if (deleteAlerts) {
      for (const pid of this.activePlans.keys()) {
        this.removeAlerts(pid);
      }
    }
    this.activePlans.clear();
    this.planDrawingIds.clear();
    this.drawingMetadata.clear();
    this.drawingPlanMap.clear();
  }

  /**
   * Bersihkan relasi drawing ketika drawing tertentu dihapus secara individual dari kanvas
   */
  unlinkDrawingIds(ids: string[]): void {
    for (const id of ids) {
      this.drawingMetadata.delete(id);
      const planId = this.drawingPlanMap.get(id);
      if (planId) {
        this.drawingPlanMap.delete(id);
        const planDrawingSet = this.planDrawingIds.get(planId);
        if (planDrawingSet) {
          planDrawingSet.delete(id);
        }
      }
    }
  }

  /**
   * Tempelkan kembali metadata yang tersimpan ke daftar objek drawing kanvas
   */
  reattachMetadataToDrawings(drawings: any[]): void {
    if (!Array.isArray(drawings)) return;
    for (const d of drawings) {
      if (d && d.id) {
        if (d.metadata && typeof d.metadata === 'object' && d.metadata.planId && !this.drawingMetadata.has(d.id)) {
          this.drawingMetadata.set(d.id, d.metadata);
          this.drawingPlanMap.set(d.id, d.metadata.planId);
        }
        if (this.drawingMetadata.has(d.id)) {
          d.metadata = { ...(this.drawingMetadata.get(d.id) || {}), ...(d.metadata || {}) };
        }
        if (this.drawingPlanMap.has(d.id) && (!d.metadata || !d.metadata.planId)) {
          d.metadata = { ...(d.metadata || {}), planId: this.drawingPlanMap.get(d.id) };
        }
      }
    }
  }

  /**
   * Rekonsiliasi transisi Undo / Redo untuk aksi pembuatan rencana perdagangan
   */
  reconcileUndoTransition(direction: 'undo' | 'redo', tx: PlanUndoTransaction): void {
    if (!tx?.plan) return;
    const planId = tx.plan.id;
    if (direction === 'undo') {
      this.activePlans.delete(planId);
      this.planDrawingIds.delete(planId);
      for (const id of tx.drawingIds) {
        this.drawingMetadata.delete(id);
        this.drawingPlanMap.delete(id);
      }
      this.removeAlerts(planId);
    } else {
      this.activePlans.set(planId, tx.plan);
      this.planDrawingIds.set(planId, new Set(tx.drawingIds));
      for (const d of tx.drawings) {
        if (d?.id) {
          if (d.metadata) {
            this.drawingMetadata.set(d.id, d.metadata);
          }
          this.drawingPlanMap.set(d.id, planId);
        }
      }
      if (tx.autoCreateAlerts) {
        const curSym = this.host.getContext().symbol || 'BTCUSDT';
        this.createAlerts(tx.plan, tx.plan.symbol || curSym);
      }
    }
  }

  /**
   * Menautkan kembali gambar posisi, entry zone, dan context zone yang sudah ada pada kanvas
   * ke entitas plan aktif, sekaligus membersihkan duplikat gambar kembar.
   */
  tryRelinkPlanDrawings(plan: ActiveTradingPlan, curSym: string): boolean {
    if (plan.symbol && !isSamePlanSymbol(plan.symbol, curSym)) {
      return false;
    }

    const currentDrawings = this.host.getCanvasDrawings();
    if (!Array.isArray(currentDrawings) || currentDrawings.length === 0) return false;

    const isPriceMatch = (actual: number, expected: number): boolean => {
      if (actual === expected) return true;
      const tick = getAdaptiveTickSize(expected);
      return Math.abs(actual - expected) <= tick * 1.5;
    };

    const planId = plan.id;
    const targetPrices = (plan.targets || [])
      .map((t) => t.price)
      .filter((p): p is number => typeof p === 'number');
    const matchedDrawingIds: string[] = [];
    const duplicatesToRemove: string[] = [];
    const matchedTargetIndices = new Set<number>();

    // 1. Cari drawing position yang cocok dengan Entry & Stop Loss
    for (const d of currentDrawings) {
      if (!d || d.type !== 'position' || !Array.isArray(d.anchors) || d.anchors.length < 3) continue;

      const entryPrice = d.anchors[0]?.price;
      const stopLossPrice = d.anchors[1]?.price;
      const targetPrice = d.anchors[2]?.price;
      if (
        typeof entryPrice !== 'number' ||
        typeof stopLossPrice !== 'number' ||
        typeof targetPrice !== 'number'
      ) {
        continue;
      }

      if (isPriceMatch(entryPrice, plan.entry) && isPriceMatch(stopLossPrice, plan.stopLoss)) {
        let matchedIdx = -1;
        for (let i = 0; i < targetPrices.length; i++) {
          if (isPriceMatch(targetPrice, targetPrices[i])) {
            matchedIdx = i;
            break;
          }
        }

        if (matchedIdx !== -1) {
          if (matchedTargetIndices.has(matchedIdx)) {
            if (d.id) duplicatesToRemove.push(d.id);
          } else {
            matchedTargetIndices.add(matchedIdx);
            if (d.id) matchedDrawingIds.push(d.id);

            const stageTarget = plan.targets[matchedIdx];
            const meta = {
              planId,
              stageIndex: matchedIdx + 1,
              targetLabel: stageTarget?.label || `TP${matchedIdx + 1}`,
              rMultiple: stageTarget?.rMultiple,
              bias: plan.bias,
              reasons: plan.reasons,
              contextZones: plan.contextZones,
              rawPlanText: plan.rawText,
              lastEntry: plan.entry,
              lastStop: plan.stopLoss,
              lastTarget: stageTarget?.price
            };
            d.metadata = meta;
            if (d.id) {
              this.drawingMetadata.set(d.id, meta);
              this.drawingPlanMap.set(d.id, planId);
            }
          }
        }
      }
    }

    if (matchedDrawingIds.length === 0) return false;

    // 1b. Cari drawing entry_zone (Dual-Entry Plan) yang cocok
    if (Array.isArray(plan.entries) && plan.entries.length > 1) {
      const entryPrices = plan.entries
        .map((e) => e.price)
        .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);
      if (entryPrices.length >= 2) {
        const expectedMin = Math.min(...entryPrices);
        const expectedMax = Math.max(...entryPrices);
        let matchedEntryZone = false;

        for (const d of currentDrawings) {
          if (!d || d.type !== 'box' || !Array.isArray(d.anchors) || d.anchors.length < 2) continue;
          const pA = d.anchors[0]?.price;
          const pB = d.anchors[1]?.price;
          if (typeof pA !== 'number' || typeof pB !== 'number') continue;
          const boxHigh = Math.max(pA, pB);
          const boxLow = Math.min(pA, pB);

          if (
            d.metadata?.role === 'entry_zone' ||
            (isPriceMatch(boxHigh, expectedMax) && isPriceMatch(boxLow, expectedMin))
          ) {
            if (matchedEntryZone) {
              if (d.id) duplicatesToRemove.push(d.id);
            } else {
              matchedEntryZone = true;
              if (d.id) matchedDrawingIds.push(d.id);
              const meta = {
                planId,
                role: 'entry_zone',
                entries: plan.entries.map((e) => ({ ...e })),
                minEntry: expectedMin,
                maxEntry: expectedMax
              };
              d.metadata = meta;
              if (d.id) {
                this.drawingMetadata.set(d.id, meta);
                this.drawingPlanMap.set(d.id, planId);
              }
            }
          }
        }
      }
    }

    // 2. Cari drawing context zones (box) yang cocok
    if (Array.isArray(plan.contextZones) && plan.contextZones.length > 0) {
      const matchedZoneIndices = new Set<number>();
      for (const d of currentDrawings) {
        if (!d || d.type !== 'box' || !Array.isArray(d.anchors) || d.anchors.length < 2) continue;
        if (d.metadata?.role === 'entry_zone') continue;
        const anchorPriceA = d.anchors[0]?.price;
        const anchorPriceB = d.anchors[1]?.price;
        if (typeof anchorPriceA !== 'number' || typeof anchorPriceB !== 'number') continue;

        const boxHigh = Math.max(anchorPriceA, anchorPriceB);
        const boxLow = Math.min(anchorPriceA, anchorPriceB);

        for (let i = 0; i < plan.contextZones.length; i++) {
          const zone = plan.contextZones[i];
          if (typeof zone.high !== 'number' || typeof zone.low !== 'number') continue;
          if (isPriceMatch(boxHigh, zone.high) && isPriceMatch(boxLow, zone.low)) {
            if (matchedZoneIndices.has(i)) {
              if (d.id) duplicatesToRemove.push(d.id);
            } else {
              matchedZoneIndices.add(i);
              if (d.id) matchedDrawingIds.push(d.id);
              const zonePol: ZonePolarity = zone.polarity || inferZonePolarity(zone.label);
              const meta = {
                planId,
                role: 'context_zone',
                zoneLabel: zone.label,
                low: zone.low,
                high: zone.high,
                polarity: zonePol
              };
              d.metadata = meta;
              if (d.id) {
                this.drawingMetadata.set(d.id, meta);
                this.drawingPlanMap.set(d.id, planId);
              }
            }
            break;
          }
        }
      }
    }

    if (duplicatesToRemove.length > 0) {
      this.host.removeCanvasDrawings(duplicatesToRemove);
    }

    const targetSymbol = plan.symbol || curSym;
    const planRecord: ActiveTradingPlan = { ...plan, id: planId, symbol: targetSymbol };
    this.activePlans.set(planId, planRecord);
    this.planDrawingIds.set(planId, new Set(matchedDrawingIds));

    return true;
  }

  /**
   * Pulihkan koleksi rencana perdagangan aktif ke kanvas (Workspace Persistence)
   */
  restorePlans(plans: ActiveTradingPlan[], showCards = true): void {
    if (!Array.isArray(plans) || plans.length === 0) return;
    this.showThesisCards = showCards;
    const curSym = this.host.getContext().symbol || 'BTCUSDT';
    for (const plan of plans) {
      if (!this.activePlans.has(plan.id)) {
        const relinked = this.tryRelinkPlanDrawings(plan, curSym);
        if (!relinked) {
          this.projectPlan(
            {
              ...plan,
              symbol: plan.symbol || curSym
            },
            {
              planId: plan.id,
              drawContextZones: true,
              skipVaultSave: true,
              autoCreateAlerts: false
            }
          );
        }
      }
    }
    this.notifyChanged();
  }

  /**
   * Rekonsiliasi penuh saat objek gambar di kanvas mengalami mutasi (drag anchor, hapus drawing, dsb):
   * - Menempelkan kembali metadata
   * - Menjalankan Bidirectional Sync termasuk pergeseran proporsional (Delta-Shift) pada Dual-Entry Plan (Q1)
   * - Memperbarui kotak Entry Zone, riskAmount, riskPercent, rMultiple, & rMultipleByEntry
   * - Menyinkronkan Plan-Linked Auto-Alerts
   * - Membersihkan rencana yatim (orphan cleanup) dengan tetap menjaga isolasi simbol
   */
  reconcileCanvasMutation(activeDrawings?: any[]): SerializedPlanEnvelope {
    const drawings = activeDrawings ?? this.host.getCanvasDrawings() ?? [];
    this.reattachMetadataToDrawings(drawings);
    if (this.isProjecting) {
      return this.toPersistedEnvelope();
    }

    // 1. Bidirectional Sync: Sinkronkan mutasi koordinat anchor posisi ke objek activePlans
    for (const drawing of drawings) {
      if (drawing && drawing.type === 'position' && drawing.metadata?.planId) {
        const planId = drawing.metadata.planId;
        const plan = this.activePlans.get(planId);
        if (plan && Array.isArray(drawing.anchors) && drawing.anchors.length >= 3) {
          const sanitize = (val: unknown) =>
            typeof val === 'number' && !isNaN(val) ? roundToTickSize(val) : undefined;
          const prices = typeof drawing.prices === 'function' ? drawing.prices() : null;
          const currentEntry = sanitize(prices?.entry ?? drawing.anchors[0]?.price);
          const currentStop = sanitize(prices?.stop ?? drawing.anchors[1]?.price);
          const currentTarget = sanitize(prices?.target ?? drawing.anchors[2]?.price);

          const stageIndex =
            typeof drawing.metadata.stageIndex === 'number' ? drawing.metadata.stageIndex - 1 : 0;
          const meta = drawing.metadata;
          const prevEntry = typeof meta.lastEntry === 'number' ? meta.lastEntry : plan.entry;
          const prevStop = typeof meta.lastStop === 'number' ? meta.lastStop : plan.stopLoss;
          const prevTarget =
            typeof meta.lastTarget === 'number' ? meta.lastTarget : plan.targets[stageIndex]?.price;

          let planChanged = false;

          // A. Deteksi perubahan Stop Loss pada drawing ini
          if (typeof currentStop === 'number' && currentStop > 0 && currentStop !== prevStop) {
            plan.stopLoss = currentStop;
            meta.lastStop = currentStop;
            planChanged = true;

            for (const sibling of drawings) {
              if (
                sibling &&
                sibling.type === 'position' &&
                sibling.metadata?.planId === planId &&
                Array.isArray(sibling.anchors) &&
                sibling.anchors[1]
              ) {
                sibling.anchors[1].price = currentStop;
                if (sibling.metadata) sibling.metadata.lastStop = currentStop;
                if (this.drawingMetadata.has(sibling.id)) {
                  this.drawingMetadata.get(sibling.id).lastStop = currentStop;
                }
              }
            }
          }

          // B. Deteksi perubahan Entry pada drawing ini (+ Delta-Shift proporsional untuk Dual-Entry Plan)
          if (typeof currentEntry === 'number' && currentEntry > 0 && currentEntry !== prevEntry) {
            const deltaP = currentEntry - prevEntry;
            plan.entry = currentEntry;
            meta.lastEntry = currentEntry;
            planChanged = true;

            // Sinkronkan entry ke seluruh sibling position drawings milik plan yang sama
            for (const sibling of drawings) {
              if (
                sibling &&
                sibling.type === 'position' &&
                sibling.metadata?.planId === planId &&
                Array.isArray(sibling.anchors) &&
                sibling.anchors[0]
              ) {
                sibling.anchors[0].price = currentEntry;
                if (sibling.metadata) sibling.metadata.lastEntry = currentEntry;
                if (this.drawingMetadata.has(sibling.id)) {
                  this.drawingMetadata.get(sibling.id).lastEntry = currentEntry;
                }
              }
            }

            // Delta-Shift pada Dual-Entry Plan (E1, E2, dan kotak Entry Zone)
            if (Array.isArray(plan.entries) && plan.entries.length > 0) {
              for (const entryLevel of plan.entries) {
                if (typeof entryLevel.price === 'number' && !isNaN(entryLevel.price)) {
                  entryLevel.price = roundToTickSize(entryLevel.price + deltaP);
                }
              }

              const shiftedPrices = plan.entries
                .map((e) => e.price)
                .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);

              if (shiftedPrices.length >= 2) {
                const newMinEntry = Math.min(...shiftedPrices);
                const newMaxEntry = Math.max(...shiftedPrices);
                const newLabel = formatEntryZoneLabel(plan.entries, newMinEntry, newMaxEntry);

                for (const sibling of drawings) {
                  if (
                    sibling &&
                    sibling.type === 'box' &&
                    sibling.metadata?.planId === planId &&
                    sibling.metadata?.role === 'entry_zone'
                  ) {
                    if (Array.isArray(sibling.anchors) && sibling.anchors.length >= 2) {
                      sibling.anchors[0].price = newMaxEntry;
                      sibling.anchors[1].price = newMinEntry;
                    }
                    if (sibling.text) {
                      sibling.text.value = newLabel;
                    }
                    const updatedEntryMeta = {
                      ...sibling.metadata,
                      entries: plan.entries.map((e) => ({ ...e })),
                      minEntry: newMinEntry,
                      maxEntry: newMaxEntry
                    };
                    sibling.metadata = updatedEntryMeta;
                    if (sibling.id) {
                      this.drawingMetadata.set(sibling.id, updatedEntryMeta);
                    }
                  }
                }
              }
            }
          }

          // C. Deteksi perubahan Target pada drawing ini
          if (plan.targets && plan.targets[stageIndex]) {
            if (
              typeof currentTarget === 'number' &&
              currentTarget > 0 &&
              currentTarget !== prevTarget
            ) {
              plan.targets[stageIndex].price = currentTarget;
              meta.lastTarget = currentTarget;
              if (this.drawingMetadata.has(drawing.id)) {
                this.drawingMetadata.get(drawing.id).lastTarget = currentTarget;
              }
              planChanged = true;
            }
          }

          if (meta.lastEntry === undefined) meta.lastEntry = plan.entry;
          if (meta.lastStop === undefined) meta.lastStop = plan.stopLoss;
          if (meta.lastTarget === undefined && plan.targets[stageIndex]) {
            meta.lastTarget = plan.targets[stageIndex].price;
          }

          // D. Hitung ulang riskAmount, riskPercent, rMultiple, & rMultipleByEntry jika ada harga yang berubah
          if (planChanged) {
            recalculatePlanRiskAndTargets(plan);
            this.syncAlerts(plan);

            for (const sibling of drawings) {
              if (
                sibling &&
                sibling.type === 'position' &&
                sibling.metadata?.planId === planId
              ) {
                const sIdx =
                  typeof sibling.metadata.stageIndex === 'number'
                    ? sibling.metadata.stageIndex - 1
                    : 0;
                if (plan.targets[sIdx] && typeof plan.targets[sIdx].rMultiple === 'number') {
                  const updatedR = plan.targets[sIdx].rMultiple!;
                  sibling.metadata.rMultiple = updatedR;
                  if (this.drawingMetadata.has(sibling.id)) {
                    this.drawingMetadata.get(sibling.id).rMultiple = updatedR;
                  }
                  const baseLabel = sibling.metadata.targetLabel || `TP${sIdx + 1}`;
                  sibling.targetLabel = `${baseLabel} (${updatedR.toFixed(2)}R)`;
                }
              }
            }
          }
        }
      }
    }

    // 2. Orphan Cleanup: Hapus rencana hanya jika SEMUA drawing miliknya sudah tidak ada di kanvas
    //    DAN rencana tersebut milik simbol aktif saat ini.
    const curSym = this.host.getContext().symbol || 'BTCUSDT';
    const existingDrawingIds = new Set(drawings.map((d: any) => d?.id).filter(Boolean));

    for (const [pid, drawingIdSet] of Array.from(this.planDrawingIds.entries())) {
      const plan = this.activePlans.get(pid);
      if (plan && plan.symbol && !isSamePlanSymbol(plan.symbol, curSym)) {
        continue;
      }
      if (!drawingIdSet || drawingIdSet.size === 0) {
        this.activePlans.delete(pid);
        this.planDrawingIds.delete(pid);
        this.removeAlerts(pid);
      } else {
        const hasAnyDrawing = Array.from(drawingIdSet).some((did) => existingDrawingIds.has(did));
        if (!hasAnyDrawing) {
          this.activePlans.delete(pid);
          this.planDrawingIds.delete(pid);
          this.removeAlerts(pid);
        }
      }
    }

    const activePlanIds = new Set(drawings.map((d: any) => d?.metadata?.planId).filter(Boolean));
    for (const [pid, plan] of Array.from(this.activePlans.entries())) {
      if (plan && plan.symbol && !isSamePlanSymbol(plan.symbol, curSym)) {
        continue;
      }
      if (!this.planDrawingIds.has(pid) && !activePlanIds.has(pid)) {
        this.activePlans.delete(pid);
        this.removeAlerts(pid);
      }
    }

    return this.toPersistedEnvelope();
  }

  /**
   * Mengekstrak envelope metadata (_trawangan_meta) untuk disimpan bersama dokumen kanvas
   */
  toPersistedEnvelope(): SerializedPlanEnvelope {
    const metaObj: Record<string, any> = {};
    for (const [id, meta] of this.drawingMetadata.entries()) {
      metaObj[id] = meta;
    }
    const plansArr = Array.from(this.activePlans.values());
    const planDrawingEntries: Array<[string, string[]]> = Array.from(
      this.planDrawingIds.entries()
    ).map(([k, set]) => [k, Array.from(set)]);

    return {
      drawingMetadata: metaObj,
      activePlans: plansArr,
      planDrawingIds: planDrawingEntries,
      timestamp: Date.now()
    };
  }

  /**
   * Hidrasi state rencana dari payload _trawangan_meta yang dimuat dari storage
   */
  hydrateFromEnvelope(meta?: Partial<SerializedPlanEnvelope> | null): void {
    if (!meta) return;
    if (meta.drawingMetadata && typeof meta.drawingMetadata === 'object') {
      for (const [id, m] of Object.entries(meta.drawingMetadata)) {
        this.drawingMetadata.set(id, m);
      }
    }
    if (Array.isArray(meta.activePlans)) {
      for (const p of meta.activePlans) {
        if (p && p.id) {
          this.activePlans.set(p.id, p);
        }
      }
    }
    if (Array.isArray(meta.planDrawingIds)) {
      for (const [k, ids] of meta.planDrawingIds) {
        if (k && Array.isArray(ids)) {
          this.planDrawingIds.set(k, new Set(ids));
          for (const did of ids) {
            this.drawingPlanMap.set(did, k);
          }
        }
      }
    }
  }

  /**
   * Evaluasi status pasar live terhadap rencana atau record vault
   */
  evaluateMarketStatus(
    planOrRecord: ParsedTradingPlan | SavedTradingPlanRecord | null | undefined,
    currentPrice: number | null | undefined,
    activeSymbol?: string
  ): LivePlanEvaluation | null {
    return evaluatePlanMarketStatus(
      planOrRecord,
      currentPrice,
      activeSymbol ?? this.host.getContext().symbol
    );
  }
}
