// Layanan Engine Evaluasi dan Manajemen Price Alert Real-Time
import type { PriceAlert, AlertCondition, AlertFrequency } from '../types/market';
import { fetchAlerts, persistAlerts } from './drawingStorage';
import { playAlertChime, playSuccessPip } from './soundService';
import { sendWindowsAlertNotification } from './systemNotificationService';

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
      const saved = await fetchAlerts();
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
      await persistAlerts(this.alerts);
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
  }): Promise<PriceAlert> {
    const newAlert: PriceAlert = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      symbol: params.symbol.toUpperCase(),
      targetPrice: params.targetPrice,
      condition: params.condition || 'crossing',
      frequency: params.frequency || 'once',
      label: params.label?.trim() || `Target ${params.symbol} @ ${params.targetPrice}`,
      active: true,
      triggered: false,
      createdAt: Date.now(),
    };

    this.alerts = [newAlert, ...this.alerts];
    await this.save();
    playSuccessPip();
    return newAlert;
  }

  /**
   * Perbarui alert yang sudah ada
   */
  public async updateAlert(id: string, updates: Partial<PriceAlert>): Promise<void> {
    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        return { ...a, ...updates };
      }
      return a;
    });
    await this.save();
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
