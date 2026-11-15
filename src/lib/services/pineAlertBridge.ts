/**
 * Pine Script Alert & Warning Telemetry Bridge (Ticket #202)
 *
 * Menjembatani event runtime 'alert' dan 'warning' dari Pine Script worker engine
 * ke sistem alert trawangan (in-app toast, audio cue), notifikasi desktop sistem
 * (@tauri-apps/plugin-notification), dan konsol output Pine Editor.
 */

import { alertService } from './alertService';
import {
  dispatchExternalAlertNotifications,
  sendDesktopNotification,
  type AlertNotificationEvent,
  type NotificationChannelsConfig,
} from './systemNotificationService';

export interface PineAlertPayload {
  /** Identifier unik alert (opsional dari engine) */
  id?: string;
  /** Pesan kustom alert (argumen alert("...") atau alertcondition) */
  message: string;
  /** Judul alert spesifik jika didefinisikan */
  title?: string;
  /** Timestamp bar atau pemicuan (epoch ms) */
  time?: number;
  /** Indeks bar lilin saat alert terpicu */
  barIndex?: number;
  /** Frekuensi pemicuan ('once', 'all', 'bar') */
  freq?: string;
  /** Judul tampilan indikator (indicator display title) */
  indicator?: string;
  /** ID unik instance indikator jika tersedia */
  indicatorId?: string;
}

export interface PineWarningPayload {
  /** Pesan peringatan non-fatal dari runtime (division by zero, index out of bounds, dll.) */
  message: string;
  /** Nama method atau fungsi yang memicu peringatan */
  method?: string;
  /** Indeks bar saat runtime script memicu peringatan */
  bar?: number;
  /** Judul indikator jika tersedia */
  indicator?: string;
  /** ID unik instance indikator jika tersedia */
  indicatorId?: string;
  /** Timestamp terjadinya peringatan */
  time?: number;
}

export interface PineAlertRecord {
  id: string;
  indicatorId?: string;
  indicatorTitle: string;
  symbol: string;
  message: string;
  timestamp: number;
  barIndex?: number;
  freq?: string;
}

export interface PineWarningRecord {
  id: string;
  indicatorId?: string;
  indicatorTitle?: string;
  symbol: string;
  message: string;
  method?: string;
  bar?: number;
  timestamp: number;
}

export interface PineAlertBridgeOptions {
  alertService?: typeof alertService;
  desktopNotificationSender?: (opts: { title: string; body: string; icon?: string }) => Promise<boolean>;
  externalNotificationDispatcher?: (event: AlertNotificationEvent, config: NotificationChannelsConfig) => void;
  onAlert?: (alert: PineAlertRecord) => void;
  onWarning?: (warning: PineWarningRecord) => void;
}

export class PineAlertBridge {
  private attachedCharts = new Map<any, () => void>();
  private alertHistory: PineAlertRecord[] = [];
  private warningHistory: PineWarningRecord[] = [];
  private alertSubscribers = new Set<(alert: PineAlertRecord) => void>();
  private warningSubscribers = new Set<(warning: PineWarningRecord) => void>();
  private mutedIndicatorIds = new Set<string>();
  private readonly options: PineAlertBridgeOptions;

  constructor(options: PineAlertBridgeOptions = {}) {
    this.options = options;
    if (options.onAlert) {
      this.alertSubscribers.add(options.onAlert);
    }
    if (options.onWarning) {
      this.warningSubscribers.add(options.onWarning);
    }
  }

  /**
   * Mengaitkan listener event 'alert' dan 'warning' pada instance chart Vela.
   * Mengembalikan fungsi unregister untuk chart tersebut.
   */
  public attach(chart: any, context: { symbol?: string; cellId?: string } = {}): () => void {
    if (!chart || typeof chart.on !== 'function') {
      return () => {};
    }

    // Lepas listener lama jika instance chart sudah pernah di-attach sebelumnya
    this.detach(chart);

    const alertHandler = (payload: PineAlertPayload) => {
      this.handleAlert(payload, context);
    };

    const warningHandler = (payload: PineWarningPayload) => {
      this.handleWarning(payload, context);
    };

    let unsubAlert: any = null;
    let unsubWarning: any = null;

    try {
      unsubAlert = chart.on('alert', alertHandler);
      unsubWarning = chart.on('warning', warningHandler);
    } catch (err) {
      console.warn('[PineAlertBridge] Gagal mendaftarkan event listener pada chart:', err);
    }

    const cleanup = () => {
      if (typeof unsubAlert === 'function') {
        try { unsubAlert(); } catch (_) {}
      } else if (typeof chart.off === 'function') {
        try { chart.off('alert', alertHandler); } catch (_) {}
      }

      if (typeof unsubWarning === 'function') {
        try { unsubWarning(); } catch (_) {}
      } else if (typeof chart.off === 'function') {
        try { chart.off('warning', warningHandler); } catch (_) {}
      }

      this.attachedCharts.delete(chart);
    };

    this.attachedCharts.set(chart, cleanup);
    return cleanup;
  }

  /**
   * Melepas pendengar event dari chart tertentu atau seluruh chart yang terpasang
   */
  public detach(chart?: any): void {
    if (chart) {
      const cleanup = this.attachedCharts.get(chart);
      if (cleanup) {
        cleanup();
      }
    } else {
      for (const cleanup of this.attachedCharts.values()) {
        try { cleanup(); } catch (_) {}
      }
      this.attachedCharts.clear();
    }
  }

  /**
   * Mengatur status mute alert untuk indikator tertentu
   */
  public setIndicatorAlertMuted(indicatorId: string, muted: boolean): void {
    if (!indicatorId) return;
    if (muted) {
      this.mutedIndicatorIds.add(indicatorId);
    } else {
      this.mutedIndicatorIds.delete(indicatorId);
    }
  }

  /**
   * Memeriksa apakah alert untuk indikator tertentu sedang di-mute
   */
  public isIndicatorAlertMuted(indicatorId: string): boolean {
    if (!indicatorId) return false;
    return this.mutedIndicatorIds.has(indicatorId);
  }

  /**
   * Memproses payload event 'alert' yang dipancarkan oleh worker engine Pine Script
   */
  public handleAlert(payload: PineAlertPayload, context: { symbol?: string; cellId?: string } = {}): PineAlertRecord | null {
    // Abaikan alert jika indikator sumber sedang di-mute
    if (payload.indicatorId && this.isIndicatorAlertMuted(payload.indicatorId)) {
      return null;
    }

    const timestamp = payload.time || Date.now();
    const id = payload.id || `alt_pine_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const indicatorTitle = payload.title || payload.indicator || 'Pine Script Alert';
    const symbol = (context.symbol || 'CHART').toUpperCase();

    const record: PineAlertRecord = {
      id,
      indicatorId: payload.indicatorId,
      indicatorTitle,
      symbol,
      message: payload.message || '',
      timestamp,
      barIndex: payload.barIndex,
      freq: payload.freq,
    };

    // Simpan ke riwayat lokal (pertahankan maksimal 100 entri terbaru)
    this.alertHistory.push(record);
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    // Beritahu seluruh pelanggan event internal
    for (const sub of this.alertSubscribers) {
      try {
        sub(record);
      } catch (err) {
        console.warn('[PineAlertBridge] Kesalahan pada alert subscriber:', err);
      }
    }

    // Teruskan ke alertService untuk in-app toast & audio cue
    const svc = this.options.alertService || alertService;
    try {
      svc.dispatchPineAlert({
        id: record.id,
        symbol: record.symbol,
        message: record.message,
        indicatorTitle: record.indicatorTitle,
        timestamp: record.timestamp,
        freq: record.freq,
        barIndex: record.barIndex,
      });
    } catch (err) {
      console.warn('[PineAlertBridge] Gagal meneruskan ke alertService:', err);
    }

    // Kirim notifikasi desktop native OS jika diizinkan
    const isSysNotifActive = svc.isSystemNotificationEnabled ? svc.isSystemNotificationEnabled() : true;
    if (isSysNotifActive) {
      const sender = this.options.desktopNotificationSender || sendDesktopNotification;
      const title = `🔔 [${record.symbol}] ${record.indicatorTitle}`;
      const body = record.message;
      void sender({ title, body }).catch((err) => {
        console.warn('[PineAlertBridge] Gagal mengirim push notification desktop:', err);
      });
    }

    // Kirim notifikasi ke kanal eksternal (Telegram & Discord) secara paralel & non-blocking
    const channelsConfig = svc.getNotificationChannelsConfig
      ? svc.getNotificationChannelsConfig()
      : {};
    const externalDispatcher =
      this.options.externalNotificationDispatcher || dispatchExternalAlertNotifications;
    externalDispatcher(
      {
        kind: 'pine',
        symbol: record.symbol,
        indicatorTitle: record.indicatorTitle,
        label: record.message,
        timestamp: record.timestamp,
      },
      channelsConfig
    );

    return record;
  }

  /**
   * Memproses payload event 'warning' yang dipancarkan oleh runtime Pine Script
   */
  public handleWarning(payload: PineWarningPayload, context: { symbol?: string; cellId?: string } = {}): PineWarningRecord {
    const timestamp = payload.time || Date.now();
    const id = `warn_pine_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const symbol = (context.symbol || 'CHART').toUpperCase();

    const record: PineWarningRecord = {
      id,
      indicatorId: payload.indicatorId,
      indicatorTitle: payload.indicator,
      symbol,
      message: payload.message || '',
      method: payload.method,
      bar: payload.bar,
      timestamp,
    };

    // Simpan ke riwayat lokal (pertahankan maksimal 100 entri terbaru)
    this.warningHistory.push(record);
    if (this.warningHistory.length > 100) {
      this.warningHistory.shift();
    }

    // Beritahu seluruh pelanggan event warning
    for (const sub of this.warningSubscribers) {
      try {
        sub(record);
      } catch (err) {
        console.warn('[PineAlertBridge] Kesalahan pada warning subscriber:', err);
      }
    }

    return record;
  }

  /**
   * Memformat data warning menjadi pesan konsol yang terstruktur dan mudah dipahami
   */
  public formatWarningMessage(record: PineWarningRecord): string {
    const title = record.indicatorTitle ? `[${record.indicatorTitle}] ` : '';
    const methodStr = record.method ? ` di ${record.method}()` : '';
    const barStr = typeof record.bar === 'number' && record.bar >= 0 ? ` (bar ${record.bar})` : '';
    return `⚠️ Peringatan: ${title}${record.message}${methodStr}${barStr}`;
  }

  /**
   * Membersihkan telemetri milik indikator tertentu ketika indikator dihapus dari grafik
   */
  public handleIndicatorRemoved(indicatorId: string): void {
    if (!indicatorId) return;
    this.alertHistory = this.alertHistory.filter((a) => a.indicatorId !== indicatorId);
    this.warningHistory = this.warningHistory.filter((w) => w.indicatorId !== indicatorId);
    this.mutedIndicatorIds.delete(indicatorId);
  }

  /**
   * Mengambil seluruh riwayat alert aktif
   */
  public getAlertHistory(): PineAlertRecord[] {
    return [...this.alertHistory];
  }

  /**
   * Mengambil seluruh riwayat warning aktif
   */
  public getWarningHistory(): PineWarningRecord[] {
    return [...this.warningHistory];
  }

  /**
   * Membersihkan seluruh riwayat alert dan warning
   */
  public clearHistory(): void {
    this.alertHistory = [];
    this.warningHistory = [];
  }

  /**
   * Berlangganan event alert baru
   */
  public onAlert(listener: (alert: PineAlertRecord) => void): () => void {
    this.alertSubscribers.add(listener);
    return () => {
      this.alertSubscribers.delete(listener);
    };
  }

  /**
   * Berlangganan event runtime warning baru
   */
  public onWarning(listener: (warning: PineWarningRecord) => void): () => void {
    this.warningSubscribers.add(listener);
    return () => {
      this.warningSubscribers.delete(listener);
    };
  }
}

// Instance singleton utama untuk aplikasi
export const pineAlertBridge = new PineAlertBridge();
