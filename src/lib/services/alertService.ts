import type { PriceAlert, AlertCondition, AlertFrequency } from '../types/market';
import type { ParsedTradingPlan } from './planParserService';
import { loadAlerts, saveAlerts } from './persistence';
import { playAlertChime, playSuccessPip } from './soundService';
import { sendWindowsAlertNotification } from './systemNotificationService';
import { roundToTickSize } from './priceSnapService';

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
    const clean = symbol.replace('.P', '').toUpperCase();
    return this.alerts.filter((a) => {
      const aClean = a.symbol.replace('.P', '').toUpperCase();
      return aClean === clean;
    });
  }

  /**
   * Mengembalikan daftar simbol unik dari seluruh alert yang berstatus aktif dan belum terpicu
   */
  public getActiveAlertSymbols(): string[] {
    const activeSymbols = new Set<string>();
    for (const alert of this.alerts) {
      if (alert.active && !alert.triggered && alert.symbol) {
        const clean = alert.symbol.trim().toUpperCase();
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
    const cleanTargetPrice = roundToTickSize(params.targetPrice);
    const newAlert: PriceAlert = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      symbol: params.symbol.toUpperCase(),
      targetPrice: cleanTargetPrice,
      condition: params.condition || 'crossing',
      frequency: params.frequency || 'once',
      label: params.label?.trim() || `Target ${params.symbol} @ ${cleanTargetPrice}`,
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
   * Provisikan sekumpulan Plan-Linked Auto-Alerts (Entry, SL, dan TP1..TPn) secara atomik
   * ketika sebuah Trade Plan diterapkan ke grafik (ADR-0019)
   */
  public async addPlanAlerts(
    plan: ParsedTradingPlan & { id?: string; symbol?: string },
    fallbackSymbol = 'BTCUSDT'
  ): Promise<PriceAlert[]> {
    if (!plan || !plan.entry || !plan.stopLoss) return [];
    const planId = plan.id || `plan_${Date.now()}`;
    const symbol = (plan.symbol || fallbackSymbol || 'BTCUSDT').trim().toUpperCase();
    const isBearish = plan.bias === 'bearish' || plan.stopLoss > plan.entry;
    const biasTag = isBearish ? 'SHORT PLAN' : 'LONG PLAN';
    const now = Date.now();

    // Bersihkan alert aktif lama dengan planId yang sama agar tidak duplikat
    this.alerts = this.alerts.filter((a) => !(a.planId === planId && !a.triggered));

    const created: PriceAlert[] = [];

    // 1. Alert Titik Entry (Blended / Utama)
    const cleanEntry = roundToTickSize(plan.entry);
    const hasEntries = Array.isArray(plan.entries) && plan.entries.length > 0;
    const entryLabel = hasEntries ? `⚡ [${biasTag}] Blended Entry @ ${cleanEntry}` : `⚡ [${biasTag}] Entry @ ${cleanEntry}`;
    created.push({
      id: `alt_${now}_entry_${Math.random().toString(36).slice(2, 6)}`,
      symbol,
      targetPrice: cleanEntry,
      condition: 'crossing',
      frequency: 'once',
      label: entryLabel,
      active: true,
      triggered: false,
      createdAt: now,
      planId,
      planRole: 'entry',
    });

    // 1b. Alert Level-Level Entry (E1, E2, dst.) jika tersedia (ADR-0020)
    if (hasEntries) {
      plan.entries!.forEach((e, idx) => {
        if (typeof e.price !== 'number' || isNaN(e.price) || e.price <= 0) return;
        const cleanPrice = roundToTickSize(e.price);
        const weightBadge = typeof e.weight === 'number' ? ` (${Math.round(e.weight * 100)}%)` : '';
        const levelLabel = e.label || `Entry ${idx + 1}`;
        created.push({
          id: `alt_${now}_${e.id}_${Math.random().toString(36).slice(2, 6)}`,
          symbol,
          targetPrice: cleanPrice,
          condition: 'crossing',
          frequency: 'once',
          label: `⚡ [${biasTag}] ${levelLabel}${weightBadge} @ ${cleanPrice}`,
          active: true,
          triggered: false,
          createdAt: now + idx + 1,
          planId,
          planRole: e.id,
        });
      });
    }

    // 2. Alert Titik Stop Loss (SL)
    const cleanSL = roundToTickSize(plan.stopLoss);
    created.push({
      id: `alt_${now}_sl_${Math.random().toString(36).slice(2, 6)}`,
      symbol,
      targetPrice: cleanSL,
      condition: isBearish ? 'crossing_up' : 'crossing_down',
      frequency: 'once',
      label: `🛡️ [${biasTag}] Stop Loss (-1.00R) @ ${cleanSL}`,
      active: true,
      triggered: false,
      createdAt: now + 1,
      planId,
      planRole: 'sl',
    });

    // 3. Alert Setiap Target Profit (TP1..TPn)
    if (Array.isArray(plan.targets)) {
      for (let i = 0; i < plan.targets.length; i++) {
        const tgt = plan.targets[i];
        if (!tgt || typeof tgt.price !== 'number' || isNaN(tgt.price) || tgt.price <= 0) continue;
        const cleanTp = roundToTickSize(tgt.price);
        const tpName = tgt.label || `TP${i + 1}`;
        const rBadge =
          typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)
            ? ` (+${tgt.rMultiple.toFixed(2)}R)`
            : '';

        created.push({
          id: `alt_${now}_tp${i + 1}_${Math.random().toString(36).slice(2, 6)}`,
          symbol,
          targetPrice: cleanTp,
          condition: isBearish ? 'crossing_down' : 'crossing_up',
          frequency: 'once',
          label: `🎯 [${biasTag}] ${tpName}${rBadge} @ ${cleanTp}`,
          active: true,
          triggered: false,
          createdAt: now + 2 + i,
          planId,
          planRole: `tp${i + 1}`,
        });
      }
    }

    this.alerts = [...created, ...this.alerts];
    await this.save();
    playSuccessPip();
    return created;
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
        const cleanEntry = roundToTickSize(plan.entry);
        const hasEntries = Array.isArray(plan.entries) && plan.entries.length > 0;
        const entryLabel = hasEntries ? `⚡ [${biasTag}] Blended Entry @ ${cleanEntry}` : `⚡ [${biasTag}] Entry @ ${cleanEntry}`;
        if (a.targetPrice !== cleanEntry) {
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
          const cleanPrice = roundToTickSize(matched.price);
          const weightBadge = typeof matched.weight === 'number' ? ` (${Math.round(matched.weight * 100)}%)` : '';
          const levelLabel = matched.label || a.planRole.toUpperCase();
          if (a.targetPrice !== cleanPrice) {
            changed = true;
            return {
              ...a,
              targetPrice: cleanPrice,
              label: `⚡ [${biasTag}] ${levelLabel}${weightBadge} @ ${cleanPrice}`,
            };
          }
        }
      } else if (a.planRole === 'sl' && typeof plan.stopLoss === 'number') {
        const cleanSL = roundToTickSize(plan.stopLoss);
        if (a.targetPrice !== cleanSL) {
          changed = true;
          return {
            ...a,
            targetPrice: cleanSL,
            label: `🛡️ [${biasTag}] Stop Loss (-1.00R) @ ${cleanSL}`,
          };
        }
      } else if (a.planRole?.startsWith('tp') && Array.isArray(plan.targets)) {
        const idx = parseInt(a.planRole.slice(2), 10) - 1;
        const tgt = plan.targets[idx];
        if (tgt && typeof tgt.price === 'number') {
          const cleanTp = roundToTickSize(tgt.price);
          const tpName = tgt.label || `TP${idx + 1}`;
          const rBadge =
            typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)
              ? ` (+${tgt.rMultiple.toFixed(2)}R)`
              : '';
          if (a.targetPrice !== cleanTp) {
            changed = true;
            return {
              ...a,
              targetPrice: cleanTp,
              label: `🎯 [${biasTag}] ${tpName}${rBadge} @ ${cleanTp}`,
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
    if (typeof cleanUpdates.targetPrice === 'number') {
      cleanUpdates.targetPrice = roundToTickSize(cleanUpdates.targetPrice);
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

    const normSym = symbol.replace('.P', '').toUpperCase();
    const prevPrice = this.previousPrices.get(normSym);
    this.previousPrices.set(normSym, currentPrice);

    const triggeredList: PriceAlert[] = [];

    let hasChanges = false;
    this.alerts = this.alerts.map((alert) => {
      const aNorm = alert.symbol.replace('.P', '').toUpperCase();
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
