// Modul Telemetri Real-Time Trawangan: Memantau FPS, Latensi Jaringan, dan Penggunaan RAM Nyata
import type { TelemetryData } from '../types/telemetry';
import { universalFetch } from './httpClient';

export type { TelemetryData };

export type TelemetryListener = (data: TelemetryData) => void;

export class TelemetryService {
  private listeners = new Set<TelemetryListener>();

  private state: TelemetryData = {
    fps: 60,
    latencyMs: null,
    memoryMb: 45.0,
    jsHeapMb: null,
    nativeProcessMb: null,
    packetDrops: 0,
    providerName: 'Binance',
    isOnline: true
  };

  private isRunning = false;
  private activeProviderId = 'binance';

  // Loop & Timer Handles
  private rafId: number | null = null;
  private lastRafTime = 0;
  private frameCount = 0;
  private fpsWindowStart = 0;

  private pingTimer: any = null;
  private memoryTimer: any = null;

  constructor() {
    // Inisialisasi awal
  }

  public getSnapshot(): TelemetryData {
    return { ...this.state };
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    // Langsung kirim snapshot terkini ke subscriber baru
    listener(this.getSnapshot());

    if (!this.isRunning && typeof window !== 'undefined') {
      this.start();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  public setActiveProvider(providerId: string): void {
    this.activeProviderId = providerId;
    this.state.providerName = this.getProviderDisplayName(providerId);
    this.notify();
    // Segera ukur ping untuk provider baru
    if (this.isRunning) {
      this.measurePing().catch(() => {});
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (typeof window === 'undefined') return;

    // 1. Jalankan loop pengukur FPS real-time
    this.initFpsLoop();

    // 2. Jalankan polling pengukuran latensi jaringan
    this.measurePing().catch(() => {});
    this.pingTimer = setInterval(() => {
      this.measurePing().catch(() => {});
    }, 4000);

    // 3. Jalankan polling pengukuran memori RAM
    this.measureMemory().catch(() => {});
    this.memoryTimer = setInterval(() => {
      this.measureMemory().catch(() => {});
    }, 2500);
  }

  public stop(): void {
    this.isRunning = false;

    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
  }

  // ─── Kalkulator FPS Real-Time via requestAnimationFrame ───

  private initFpsLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;

    this.frameCount = 0;
    this.fpsWindowStart = performance.now();
    this.lastRafTime = this.fpsWindowStart;

    const tick = (now: number) => {
      if (!this.isRunning) return;

      this.frameCount++;
      const elapsed = now - this.fpsWindowStart;

      // Hitung ulang rolling FPS setiap 600ms untuk stabilitas pembacaan
      if (elapsed >= 600) {
        const measuredFps = Math.round((this.frameCount * 1000) / elapsed);
        // Batasi rentang wajar (misal 1 - 360 FPS)
        const clampedFps = Math.max(1, Math.min(360, measuredFps));

        if (this.state.fps !== clampedFps) {
          this.state.fps = clampedFps;
          this.notify();
        }

        this.frameCount = 0;
        this.fpsWindowStart = now;
      }

      this.lastRafTime = now;
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  // ─── Pengukur Latensi Jaringan (Ping RTT) Real-Time ───

  public async measurePing(): Promise<void> {
    const pingUrl = this.getPingUrl(this.activeProviderId);
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const res = await universalFetch(pingUrl, {
        timeoutMs: 3500,
      });

      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = Math.max(1, Math.round(end - start));

      // Jika server merespons (baik 200 maupun kode status lain asalkan server reachable)
      this.state.latencyMs = elapsed;
      this.state.isOnline = res.ok || res.status > 0;
      this.notify();
    } catch {
      // Gagal ping / timeout / offline
      this.state.packetDrops += 1;
      this.state.latencyMs = null;
      this.state.isOnline = false;
      this.notify();
    }
  }

  // ─── Pengukur Memori RAM Real-Time ───

  public async measureMemory(): Promise<void> {
    let jsHeap: number | null = null;
    let nativeProcess: number | null = null;

    // 1. Periksa Webview Chromium heap
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      if (typeof mem.usedJSHeapSize === 'number') {
        jsHeap = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
      }
    }

    // 2. Jika di Tauri desktop, baca memori proses Windows via Tauri IPC
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const procMem = await invoke<{ working_set_bytes: number; private_bytes: number }>(
          'get_process_memory'
        );
        if (procMem && procMem.working_set_bytes > 0) {
          nativeProcess = Math.round((procMem.working_set_bytes / (1024 * 1024)) * 10) / 10;
        }
      } catch (err) {
        console.warn('[TelemetryService] Gagal memanggil get_process_memory:', err);
      }
    }

    this.state.jsHeapMb = jsHeap;
    this.state.nativeProcessMb = nativeProcess;

    if (nativeProcess !== null) {
      this.state.memoryMb = nativeProcess;
    } else if (jsHeap !== null) {
      this.state.memoryMb = jsHeap;
    }

    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private getPingUrl(providerId: string): string {
    if (providerId === 'indodax') {
      return 'https://indodax.com/api/ticker/btc_idr';
    }
    if (providerId === 'bitunix') {
      return 'https://fapi.bitunix.com/api/v1/futures/market/trading_pairs';
    }
    // Default: Binance spot ping endpoint yang sangat ringan dan cepat
    return 'https://api.binance.com/api/v3/ping';
  }

  private getProviderDisplayName(providerId: string): string {
    switch (providerId) {
      case 'binance':
        return 'Binance';
      case 'indodax':
        return 'Indodax';
      case 'bitunix':
        return 'Bitunix';
      case 'hyperliquid':
        return 'Hyperliquid';
      case 'coinbase':
        return 'Coinbase';
      default:
        return 'Custom Feed';
    }
  }
}

export const telemetryService = new TelemetryService();
