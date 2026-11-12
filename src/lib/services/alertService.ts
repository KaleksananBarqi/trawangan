import type { PriceAlert, AlertCondition, AlertFrequency } from '../types/market';
import type { ParsedTradingPlan } from './planParserService';
import { loadAlerts, saveAlerts } from './persistence';
import { playAlertChime, playSuccessPip } from './soundService';
import { sendWindowsAlertNotification } from './systemNotificationService';
import { roundToTickSize } from './priceSnapService';
import { normalizeSymbolForMatching, isSameInstrument } from './instrumentIdentity';
import { buildAutoAlertLabel } from './alertFormHelper';

type TriggerListener = (alert: PriceAlert, actualPrice: number) => void;
type AlertChangeListener = (alerts: PriceAlert[]) => void;

class AlertService {
  private alerts: PriceAlert[] = [];
  private previousPrices = new Map<string, number>();
  private triggerListeners = new Set<TriggerListener>();
  private changeListeners = new Set<AlertChangeListener>();
  private isLoaded = false;
  private soundEnabled = true;
  private systemNotificationEnabled = true;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;
    try {
      const saved = await loadAlerts();
      if (Array.isArray(saved)) {
        this.alerts = saved.map((a: any) => ({
          ...a,
          frequency: a.frequency || 'once',
          condition: a.condition || 'crossing',
        }));
      }
      this.isLoaded = true;
      this.notifyChanges();
    } catch (err) {
      console.warn('Gagal memuat daftar alert dari storage:', err);
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setSystemNotificationEnabled(enabled: boolean) {
    this.systemNotificationEnabled = enabled;
  }

  public getAlerts(): PriceAlert[] {
    return [...this.alerts];
  }

  public getAlertsForSymbol(symbol: string): PriceAlert[] {
    return this.alerts.filter((a) => isSameInstrument(a.symbol, symbol));
  }

  /**
   * Mengembalikan daftar simbol unik dari seluruh alert yang berstatus aktif dan belum terpicu
   */
  public getActiveAlertSymbols(): string[] {
    const activeSymbols = new Set<string>();
    for (const alert of this.alerts) {
      if (alert.active && !alert.triggered && alert.symbol) {
        const clean = normalizeSymbolForMatching(alert.symbol);
        if (clean) {
          activeSymbols.add(clean);
        }
      }
    }
    return Array.from(activeSymbols);
  }

  public subscribe(listener: AlertChangeListener): () => void {
    this.changeListeners.add(listener);
    listener(this.getAlerts());
    return () => this.changeListeners.delete(listener);
  }

  public onTrigger(listener: TriggerListener): () => void {
    this.triggerListeners.add(listener);
    return () => this.triggerListeners.delete(listener);
  }

  private notifyChanges() {
    const copy = this.getAlerts();
    for (const listener of this.changeListeners) {
      listener(copy);
    }
  }

  private async save() {
    this.notifyChanges();
    try {
      await saveAlerts(this.alerts);
    } catch (err) {
      console.warn('Gagal menyimpan alerts ke storage:', err);
    }
  }

  /**
   * Tambah alert baru
   */
  public async addAlert(params: {
    symbol: string;
    targetPrice: number;
    condition?: AlertCondition;
    frequency?: AlertFrequency;
    label?: string;
    planId?: string;
    planRole?: 'entry' | 'sl' | string;
  }): Promise<PriceAlert> {
    const cleanSymbol = params.symbol.trim().toUpperCase();
    const cleanTargetPrice = roundToTickSize(params.targetPrice, undefined, cleanSymbol);
    const newAlert: PriceAlert = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      symbol: cleanSymbol,
      targetPrice: cleanTargetPrice,
      condition: params.condition || 'crossing',
      frequency: params.frequency || 'once',
      label: params.label?.trim() || buildAutoAlertLabel(cleanSymbol, cleanTargetPrice),
      active: true,
      triggered: false,
      createdAt: Date.now(),
      ...(params.planId ? { planId: params.planId } : {}),
      ...(params.planRole ? { planRole: params.planRole } : {}),
    };

    this.alerts = [newAlert, ...this.alerts];
    await this.save();
    playSuccessPip();
    return newAlert;
  }

  /**
   * Membangun daftar spesifikasi alert untuk suatu Trade Plan (Single maupun Dual-Entry + SL + TP1..TPn).
   */
  private buildExpectedPlanAlertSpecs(
    plan: ParsedTradingPlan & { symbol?: string },
    fallbackSymbol = 'BTCUSDT'
  ): Array<{
    planRole: string;
    symbol: string;
    targetPrice: number;
    condition: AlertCondition;
    label: string;
    orderOffset: number;
  }> {
    if (!plan || !plan.entry || !plan.stopLoss) return [];
    const symbol = (plan.symbol || fallbackSymbol || 'BTCUSDT').trim().toUpperCase();
    const isBearish = plan.bias === 'bearish' || plan.stopLoss > plan.entry;
    const biasTag = isBearish ? 'SHORT PLAN' : 'LONG PLAN';
    const hasEntries = Array.isArray(plan.entries) && plan.entries.length > 0;
    const specs: Array<{
      planRole: string;
      symbol: string;
      targetPrice: number;
      condition: AlertCondition;
      label: string;
      orderOffset: number;
    }> = [];

    // 1. Titik Entry (Blended / Utama)
    const cleanEntry = roundToTickSize(plan.entry, undefined, symbol);
    const entryLabel = hasEntries
      ? `⚡ [${biasTag}] Blended Entry @ ${cleanEntry}`
      : `⚡ [${biasTag}] Entry @ ${cleanEntry}`;
    specs.push({
      planRole: 'entry',
      symbol,
      targetPrice: cleanEntry,
      condition: 'crossing',
      label: entryLabel,
      orderOffset: 0,
    });

    // 1b. Level Dual-Entry (E1, E2, dst.)
    if (hasEntries) {
      plan.entries!.forEach((e, idx) => {
        if (typeof e.price !== 'number' || isNaN(e.price) || e.price <= 0) return;
        const cleanPrice = roundToTickSize(e.price, undefined, symbol);
        const weightBadge = typeof e.weight === 'number' ? ` (${Math.round(e.weight * 100)}%)` : '';
        const levelLabel = e.label || `Entry ${idx + 1}`;
        specs.push({
          planRole: e.id,
          symbol,
          targetPrice: cleanPrice,
          condition: 'crossing',
          label: `⚡ [${biasTag}] ${levelLabel}${weightBadge} @ ${cleanPrice}`,
          orderOffset: idx + 1,
        });
      });
    }

    // 2. Titik Stop Loss (SL)
    const cleanSL = roundToTickSize(plan.stopLoss, undefined, symbol);
    specs.push({
      planRole: 'sl',
      symbol,
      targetPrice: cleanSL,
      condition: isBearish ? 'crossing_up' : 'crossing_down',
      label: `🛡️ [${biasTag}] Stop Loss (-1.00R) @ ${cleanSL}`,
      orderOffset: 1,
    });

    // 3. Setiap Target Profit (TP1..TPn)
    if (Array.isArray(plan.targets)) {
      for (let i = 0; i < plan.targets.length; i++) {
        const tgt = plan.targets[i];
        if (!tgt || typeof tgt.price !== 'number' || isNaN(tgt.price) || tgt.price <= 0) continue;
        const cleanTp = roundToTickSize(tgt.price, undefined, symbol);
        const tpName = tgt.label || `TP${i + 1}`;
        const rBadge =
          typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)
            ? ` (+${tgt.rMultiple.toFixed(2)}R)`
            : '';

        specs.push({
          planRole: `tp${i + 1}`,
          symbol,
          targetPrice: cleanTp,
          condition: isBearish ? 'crossing_down' : 'crossing_up',
          label: `🎯 [${biasTag}] ${tpName}${rBadge} @ ${cleanTp}`,
          orderOffset: 2 + i,
        });
      }
    }

    return specs;
  }

  /**
   * Memeriksa apakah suatu Trade Plan memiliki minimal satu alert aktif yang belum terpicu.
   */
  public hasActiveAlertsForPlan(planId: string): boolean {
    if (!planId) return false;
    return this.alerts.some((a) => a.planId === planId && !a.triggered);
  }

  /**
   * Provisikan sekumpulan Plan-Linked Auto-Alerts (Entry, SL, dan TP1..TPn) secara atomik
   * ketika sebuah Trade Plan diterapkan ke grafik (ADR-0019)
   */
  public async addPlanAlerts(
    plan: ParsedTradingPlan & { id?: string; symbol?: string },
    fallbackSymbol = 'BTCUSDT'
  ): Promise<PriceAlert[]> {
    const specs = this.buildExpectedPlanAlertSpecs(plan, fallbackSymbol);
    if (specs.length === 0) return [];
    const planId = plan.id || `plan_${Date.now()}`;
    const now = Date.now();

    // Bersihkan alert aktif lama dengan planId yang sama agar tidak duplikat
    this.alerts = this.alerts.filter((a) => !(a.planId === planId && !a.triggered));

    const created: PriceAlert[] = specs.map((spec) => ({
      id: `alt_${now}_${spec.planRole}_${Math.random().toString(36).slice(2, 6)}`,
      symbol: spec.symbol,
      targetPrice: spec.targetPrice,
      condition: spec.condition,
      frequency: 'once',
      label: spec.label,
      active: true,
      triggered: false,
      createdAt: now + spec.orderOffset,
      planId,
      planRole: spec.planRole,
    }));

    this.alerts = [...created, ...this.alerts];
    await this.save();
    playSuccessPip();
    return created;
  }

  /**
   * Merekonsiliasi seluruh alert terkait Trade Plan saat diedit in-place:
   * - Memperbarui harga, kondisi arah (crossing_up/down), label, dan simbol pada role yang masih ada
   * - Menambahkan alert baru untuk role tambahan (mis. TP baru atau pindah ke Dual-Entry)
   * - Menghapus alert non-triggered untuk role yang dihapus, atau menghapus semuanya jika `enabled === false`
   */
  public async reconcilePlanAlerts(
    plan: ParsedTradingPlan & { id: string; symbol?: string },
    options?: { enabled?: boolean; fallbackSymbol?: string }
  ): Promise<PriceAlert[]> {
    if (!plan || !plan.id) return [];

    if (options?.enabled === false) {
      await this.deleteAlertsByPlanId(plan.id);
      return [];
    }

    const specs = this.buildExpectedPlanAlertSpecs(plan, options?.fallbackSymbol || 'BTCUSDT');
    if (specs.length === 0) return [];

    const expectedByRole = new Map(specs.map((s) => [s.planRole, s]));
    const matchedRoles = new Set<string>();
    const existingActiveCount = this.alerts.filter((a) => a.planId === plan.id && !a.triggered).length;
    let changed = false;

    const nextAlerts: PriceAlert[] = [];
    for (const a of this.alerts) {
      if (a.planId !== plan.id || a.triggered) {
        nextAlerts.push(a);
        continue;
      }

      const role = a.planRole;
      const spec = role ? expectedByRole.get(role) : undefined;
      if (!spec || (role && matchedRoles.has(role))) {
        // Role ini tidak ada lagi pada plan hasil edit (mis. TP dikurangi atau turun ke Single Entry)
        changed = true;
        continue;
      }

      if (role) matchedRoles.add(role);

      if (
        a.symbol !== spec.symbol ||
        a.targetPrice !== spec.targetPrice ||
        a.condition !== spec.condition ||
        a.label !== spec.label
      ) {
        changed = true;
        nextAlerts.push({
          ...a,
          symbol: spec.symbol,
          targetPrice: spec.targetPrice,
          condition: spec.condition,
          label: spec.label,
        });
      } else {
        nextAlerts.push(a);
      }
    }

    const now = Date.now();
    const created: PriceAlert[] = [];
    for (const spec of specs) {
      if (!matchedRoles.has(spec.planRole)) {
        changed = true;
        created.push({
          id: `alt_${now}_${spec.planRole}_${Math.random().toString(36).slice(2, 6)}`,
          symbol: spec.symbol,
          targetPrice: spec.targetPrice,
          condition: spec.condition,
          frequency: 'once',
          label: spec.label,
          active: true,
          triggered: false,
          createdAt: now + spec.orderOffset,
          planId: plan.id,
          planRole: spec.planRole,
        });
      }
    }

    if (changed) {
      this.alerts = [...created, ...nextAlerts];
      await this.save();
      if (existingActiveCount === 0 && created.length > 0) {
        playSuccessPip();
      }
    }

    return this.alerts.filter((a) => a.planId === plan.id && !a.triggered);
  }

  /**
   * Menghapus seluruh alert aktif (yang belum terpicu) yang terikat pada suatu Trade Plan (`planId`)
   * Dipanggil otomatis ketika Trade Plan dihapus atau dibatalkan (Undo) dari kanvas (ADR-0019)
   */
  public async deleteAlertsByPlanId(planId: string): Promise<number> {
    if (!planId) return 0;
    const beforeCount = this.alerts.length;
    this.alerts = this.alerts.filter((a) => !(a.planId === planId && !a.triggered));
    const removedCount = beforeCount - this.alerts.length;
    if (removedCount > 0) {
      await this.save();
    }
    return removedCount;
  }

  /**
   * Menyinkronkan harga target alert yang terikat pada Trade Plan jika pengguna menggeser kotak posisi di kanvas
   */
  public async syncPlanAlertPrices(plan: ParsedTradingPlan & { id: string }): Promise<void> {
    if (!plan || !plan.id) return;
    const isBearish = plan.bias === 'bearish' || plan.stopLoss > plan.entry;
    const biasTag = isBearish ? 'SHORT PLAN' : 'LONG PLAN';
    let changed = false;

    this.alerts = this.alerts.map((a) => {
      if (a.planId !== plan.id || a.triggered) return a;
      if (a.planRole === 'entry' && typeof plan.entry === 'number') {
        const cleanEntry = roundToTickSize(plan.entry, undefined, a.symbol);
        const hasEntries = Array.isArray(plan.entries) && plan.entries.length > 0;
        const entryLabel = hasEntries ? `⚡ [${biasTag}] Blended Entry @ ${cleanEntry}` : `⚡ [${biasTag}] Entry @ ${cleanEntry}`;
        if (a.targetPrice !== cleanEntry || a.label !== entryLabel) {
          changed = true;
          return {
            ...a,
            targetPrice: cleanEntry,
            label: entryLabel,
          };
        }
      } else if (Array.isArray(plan.entries) && (a.planRole === 'e1' || a.planRole === 'e2')) {
        const matched = plan.entries.find((e) => e.id === a.planRole);
        if (matched && typeof matched.price === 'number') {
          const cleanPrice = roundToTickSize(matched.price, undefined, a.symbol);
          const weightBadge = typeof matched.weight === 'number' ? ` (${Math.round(matched.weight * 100)}%)` : '';
          const levelLabel = matched.label || a.planRole.toUpperCase();
          const newLabel = `⚡ [${biasTag}] ${levelLabel}${weightBadge} @ ${cleanPrice}`;
          if (a.targetPrice !== cleanPrice || a.label !== newLabel) {
            changed = true;
            return {
              ...a,
              targetPrice: cleanPrice,
              label: newLabel,
            };
          }
        }
      } else if (a.planRole === 'sl' && typeof plan.stopLoss === 'number') {
        const cleanSL = roundToTickSize(plan.stopLoss, undefined, a.symbol);
        const newLabel = `🛡️ [${biasTag}] Stop Loss (-1.00R) @ ${cleanSL}`;
        if (a.targetPrice !== cleanSL || a.label !== newLabel) {
          changed = true;
          return {
            ...a,
            targetPrice: cleanSL,
            label: newLabel,
          };
        }
      } else if (a.planRole?.startsWith('tp') && Array.isArray(plan.targets)) {
        const idx = parseInt(a.planRole.slice(2), 10) - 1;
        const tgt = plan.targets[idx];
        if (tgt && typeof tgt.price === 'number') {
          const cleanTp = roundToTickSize(tgt.price, undefined, a.symbol);
          const tpName = tgt.label || `TP${idx + 1}`;
          const rBadge =
            typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)
              ? ` (+${tgt.rMultiple.toFixed(2)}R)`
              : '';
          const newLabel = `🎯 [${biasTag}] ${tpName}${rBadge} @ ${cleanTp}`;
          if (a.targetPrice !== cleanTp || a.label !== newLabel) {
            changed = true;
            return {
              ...a,
              targetPrice: cleanTp,
              label: newLabel,
            };
          }
        }
      }
      return a;
    });

    if (changed) {
      await this.save();
    }
  }

  /**
   * Perbarui alert yang sudah ada
   */
  public async updateAlert(id: string, updates: Partial<PriceAlert>): Promise<PriceAlert | null> {
    let updatedTarget: PriceAlert | null = null;
    const cleanUpdates = { ...updates };
    if (typeof cleanUpdates.symbol === 'string') {
      const normalizedSymbol = cleanUpdates.symbol.trim().toUpperCase();
      if (normalizedSymbol) {
        cleanUpdates.symbol = normalizedSymbol;
      } else {
        delete cleanUpdates.symbol;
      }
    }
    if (typeof cleanUpdates.targetPrice === 'number') {
      const existingAlert = this.alerts.find((a) => a.id === id);
      const refSymbol = cleanUpdates.symbol || existingAlert?.symbol;
      cleanUpdates.targetPrice = roundToTickSize(cleanUpdates.targetPrice, undefined, refSymbol);
    }

    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        updatedTarget = { ...a, ...cleanUpdates };
        return updatedTarget;
      }
      return a;
    });
    await this.save();
    playSuccessPip();
    return updatedTarget;
  }

  /**
   * Toggle status aktif / jeda
   */
  public async toggleAlertActive(id: string): Promise<void> {
    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        const nextActive = !a.active;
        return {
          ...a,
          active: nextActive,
          // Jika diaktifkan kembali dari kondisi triggered, reset triggered flag
          triggered: nextActive && a.triggered ? false : a.triggered,
        };
      }
      return a;
    });
    await this.save();
  }

  /**
   * Hapus alert berdasarkan ID
   */
  public async deleteAlert(id: string): Promise<void> {
    this.alerts = this.alerts.filter((a) => a.id !== id);
    await this.save();
  }

  /**
   * Hapus seluruh alert (digunakan untuk reset total atau pengujian)
   */
  public async clearAllAlerts(): Promise<void> {
    this.alerts = [];
    this.previousPrices.clear();
    await this.save();
  }

  /**
   * Reset alert yang sudah triggered menjadi aktif kembali
   */
  public async resetTriggeredAlert(id: string): Promise<void> {
    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        return { ...a, active: true, triggered: false };
      }
      return a;
    });
    await this.save();
  }

  /**
   * Evaluasi harga real-time terhadap seluruh alert aktif untuk simbol tersebut
   */
  public evaluateAlerts(symbol: string, currentPrice: number): PriceAlert[] {
    if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) return [];

    const normSym = normalizeSymbolForMatching(symbol);
    const prevPrice = this.previousPrices.get(normSym);
    this.previousPrices.set(normSym, currentPrice);

    const triggeredList: PriceAlert[] = [];

    let hasChanges = false;
    this.alerts = this.alerts.map((alert) => {
      const aNorm = normalizeSymbolForMatching(alert.symbol);
      if (aNorm !== normSym || !alert.active || alert.triggered) {
        return alert;
      }

      const target = alert.targetPrice;
      let isMet = false;

      switch (alert.condition) {
        case 'crossing_up':
        case 'above':
          if (prevPrice !== undefined) {
            isMet = prevPrice < target && currentPrice >= target;
          } else {
            isMet = currentPrice >= target;
          }
          break;

        case 'crossing_down':
        case 'below':
          if (prevPrice !== undefined) {
            isMet = prevPrice > target && currentPrice <= target;
          } else {
            isMet = currentPrice <= target;
          }
          break;

        case 'crossing':
          if (prevPrice !== undefined) {
            const wasBelow = prevPrice < target && currentPrice >= target;
            const wasAbove = prevPrice > target && currentPrice <= target;
            isMet = wasBelow || wasAbove;
          } else {
            isMet = Math.abs(currentPrice - target) / target < 0.0005;
          }
          break;

        case 'greater_than':
          isMet = currentPrice >= target;
          break;

        case 'less_than':
          isMet = currentPrice <= target;
          break;

        default:
          isMet = currentPrice >= target;
      }

      if (isMet) {
        hasChanges = true;
        const updatedAlert: PriceAlert = {
          ...alert,
          triggered: true,
          triggeredAt: Date.now(),
          triggeredPrice: currentPrice,
          active: alert.frequency === 'every_time', // Jika every_time, tetap aktif
        };

        triggeredList.push(updatedAlert);
        return updatedAlert;
      }

      return alert;
    });

    if (hasChanges) {
      this.save();
      if (this.soundEnabled && triggeredList.length > 0) {
        playAlertChime();
      }
      if (this.systemNotificationEnabled && triggeredList.length > 0) {
        for (const t of triggeredList) {
          sendWindowsAlertNotification({
            symbol: t.symbol,
            targetPrice: t.targetPrice,
            actualPrice: currentPrice,
            condition: t.condition,
            label: t.label,
          });
        }
      }
      for (const t of triggeredList) {
        for (const listener of this.triggerListeners) {
          listener(t, currentPrice);
        }
      }
    }

    return triggeredList;
  }
}

// Export singleton instance
export const alertService = new AlertService();
