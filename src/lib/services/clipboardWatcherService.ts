/**
 * Clipboard Watcher Service - Deep Module untuk Pemantauan Papan Klip Pasif
 * Mendeteksi penyalinan tautan platform charting secara non-intrusif saat jendela Trawangan aktif/fokus.
 */

import { parseExternalChartUrl, type ParsedChartTarget } from './urlInterceptorService';

export interface ClipboardWatcherOptions {
  readClipboard?: () => Promise<string>;
  onDetected: (target: ParsedChartTarget, rawText: string) => void;
  enabled?: boolean;
}

export class ClipboardWatcherService {
  private lastProcessedText = '';
  private enabled = true;
  private readClipboardFn: () => Promise<string>;
  private onDetectedFn: (target: ParsedChartTarget, rawText: string) => void;
  private isChecking = false;

  constructor(options: ClipboardWatcherOptions) {
    this.enabled = options.enabled ?? true;
    this.onDetectedFn = options.onDetected;
    this.readClipboardFn =
      options.readClipboard ||
      (async () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          try {
            return await navigator.clipboard.readText();
          } catch (_) {
            return '';
          }
        }
        return '';
      });
  }

  /**
   * Mengaktifkan atau menonaktifkan watcher
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Reset hash teks terakhir (misal setelah dialog ditutup)
   */
  resetLastProcessed(): void {
    this.lastProcessedText = '';
  }

  /**
   * Memeriksa teks clipboard terkini dan memicu deteksi jika cocok
   */
  async checkClipboard(): Promise<void> {
    if (!this.enabled || this.isChecking) return;
    this.isChecking = true;

    try {
      const text = await this.readClipboardFn();
      if (!text || typeof text !== 'string') return;
      const trimmed = text.trim();

      // Cek apakah teks ini sudah pernah diproses
      if (trimmed === this.lastProcessedText) return;
      this.lastProcessedText = trimmed;

      const target = parseExternalChartUrl(trimmed);
      if (target) {
        this.onDetectedFn(target, trimmed);
      }
    } catch (_) {
      // Abaikan error permission clipboard
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Memasang listener window focus untuk otomatis memeriksa saat jendela aktif
   */
  attachFocusListener(): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleFocus = () => {
      this.checkClipboard();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }
}
