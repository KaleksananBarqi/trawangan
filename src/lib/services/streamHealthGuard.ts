// Modul Deep Stream Health Guard & Watchdog Resiliensi
// Menjaga keaktifan live stream WebSocket/polling seluruh provider (termasuk provider bawaan Vela),
// menyediakan backoff eksponensial, deteksi silent freeze, dan pemulihan terkoordinasi.

import type { FeedConnectionState } from './market/types';

export interface StreamHealthSink {
  reportStreamState(
    sourceKey: string,
    providerId: string,
    state: FeedConnectionState,
    message?: string
  ): void;
  clearStreamState?(sourceKey: string): void;
}

export interface ManagedStreamHandle {
  reconnect: () => void | Promise<void>;
  stop: () => void;
}

export interface StreamGuardWrapperOptions {
  healthSink?: StreamHealthSink;
  watchdogCheckMs?: number;
  staleStreamMs?: number;
  minResubscribeGapMs?: number;
  enableStaleWatchdog?: boolean;
  syncTimeoutMs?: number;
}

export interface PollingSubscriptionOptions<TBar> {
  sourceKey: string;
  providerId: string;
  pollIntervalMs: number;
  maxBackoffMs?: number;
  healthSink?: StreamHealthSink;
  fetchLatest: () => Promise<TBar | null>;
  onBar: (bar: TBar) => void;
  onRegister?: (handle: ManagedStreamHandle) => () => void;
}

function unrefTimer(timer: any): void {
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
}

/**
 * Menghitung jeda backoff eksponensial dengan batas maksimum
 */
export function computeExponentialBackoffMs(
  attempt: number,
  baseMs = 1000,
  maxMs = 15000
): number {
  const safeAttempt = Math.max(0, attempt);
  return Math.min(baseMs * Math.pow(2, safeAttempt), maxMs);
}

/**
 * Koordinator sesi stream untuk menghubungkan tombol Coba Ulang & event 'online' ke seluruh cell chart aktif
 */
export class StreamGuardCoordinator {
  private handles = new Set<ManagedStreamHandle>();
  private healthSink?: StreamHealthSink;
  private reconnecting = false;

  constructor(healthSink?: StreamHealthSink) {
    this.healthSink = healthSink;
  }

  public setHealthSink(sink?: StreamHealthSink): void {
    this.healthSink = sink;
  }

  public getHealthSink(): StreamHealthSink | undefined {
    return this.healthSink;
  }

  public register(handle: ManagedStreamHandle): () => void {
    this.handles.add(handle);
    return () => {
      this.handles.delete(handle);
    };
  }

  public activeCount(): number {
    return this.handles.size;
  }

  /**
   * Memaksa penyambungan ulang seluruh stream aktif secara seketika
   */
  public async reconnectAll(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    try {
      const snapshot = Array.from(this.handles);
      await Promise.allSettled(snapshot.map((h) => Promise.resolve(h.reconnect())));
    } finally {
      this.reconnecting = false;
    }
  }

  public clear(): void {
    for (const h of Array.from(this.handles)) {
      try {
        h.stop();
      } catch (_) {}
    }
    this.handles.clear();
  }
}

/**
 * Menjalankan loop polling aman dengan kunci anti-tumpang-tindih, backoff kegagalan, dan pelaporan ke Guard
 */
export function createPollingSubscription<TBar>(
  opts: PollingSubscriptionOptions<TBar>
): () => void {
  const maxBackoffMs = opts.maxBackoffMs ?? 30000;
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(() => {
      timer = null;
      void runPoll();
    }, delayMs);
    unrefTimer(timer);
  };

  const runPoll = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const latest = await opts.fetchLatest();
      if (stopped) return;

      consecutiveFailures = 0;
      opts.healthSink?.reportStreamState(opts.sourceKey, opts.providerId, 'connected');
      if (latest) {
        opts.onBar(latest);
      }
      scheduleNext(opts.pollIntervalMs);
    } catch (err: any) {
      if (stopped) return;
      consecutiveFailures++;
      const nextDelay = computeExponentialBackoffMs(
        consecutiveFailures - 1,
        Math.min(opts.pollIntervalMs, 2000),
        maxBackoffMs
      );
      const state: FeedConnectionState = consecutiveFailures >= 3 ? 'blocked' : 'stalled';
      const errDetail = err?.message ? ` (${err.message})` : '';
      opts.healthSink?.reportStreamState(
        opts.sourceKey,
        opts.providerId,
        state,
        `Polling candle ${opts.providerId.toUpperCase()} terganggu${errDetail}.`
      );
      scheduleNext(nextDelay);
    } finally {
      inFlight = false;
    }
  };

  const unregister = opts.onRegister?.({
    reconnect: () => {
      if (stopped) return;
      consecutiveFailures = 0;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      void runPoll();
    },
    stop: () => {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  });

  // Jadwalkan tick pertama segera setelah loop subscriber aktif
  scheduleNext(opts.pollIntervalMs);

  return () => {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    opts.healthSink?.clearStreamState?.(opts.sourceKey);
    unregister?.();
  };
}

/**
 * Membungkus Vela DataProvider agar kebal terhadap silent WebSocket drop (seperti hilangnya
 * watchdog stall di BinanceProvider/HyperliquidProvider/CoinbaseProvider bawaan Vela)
 * dan terhubung ke mekanisme reconnect terpusat ChartSessionController.
 */
export function wrapProviderWithStreamGuard<T extends Record<string, any>>(
  inner: T,
  providerId: string,
  coordinator: StreamGuardCoordinator,
  options: StreamGuardWrapperOptions = {}
): T {
  const healthSink = options.healthSink ?? coordinator.getHealthSink();
  const isMarketHoursRestricted = providerId === 'yahoo';
  const enableStaleWatchdog = options.enableStaleWatchdog ?? !isMarketHoursRestricted;
  const staleStreamMs = options.staleStreamMs ?? 30000;
  const watchdogCheckMs = options.watchdogCheckMs ?? 5000;
  const minResubscribeGapMs = options.minResubscribeGapMs ?? Math.max(40, Math.floor(staleStreamMs * 0.8));
  const syncTimeoutMs = options.syncTimeoutMs ?? Math.max(3000, staleStreamMs);

  const wrapper: Record<string, any> = {};

  // Salin & delegasikan seluruh method DataProvider tanpa memodifikasi instance asli
  const seenKeys = new Set<string>();
  let proto: any = inner;
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor' || seenKeys.has(key)) continue;
      seenKeys.add(key);
      const val = (inner as any)[key];
      if (typeof val === 'function') {
        wrapper[key] = (...args: any[]) => val.apply(inner, args);
      } else if (val !== undefined) {
        wrapper[key] = val;
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  wrapper.subscribe = (
    ticker: string,
    timeframe: string,
    onBar: (bar: any) => void,
    opts?: any
  ) => {
    const subKey = `chart:${providerId}:${ticker}:${timeframe}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    let stopped = false;
    let lastBarAt = Date.now();
    let lastResubscribeAt = 0;
    let consecutiveStalls = 0;
    let innerUnsub: (() => void) | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let isRecovering = false;

    const guardedOnBar = (bar: any) => {
      if (stopped || !bar) return;
      lastBarAt = Date.now();
      consecutiveStalls = 0;
      healthSink?.reportStreamState(subKey, providerId, 'connected');
      onBar(bar);
    };

    const startInner = () => {
      if (stopped) return;
      try {
        innerUnsub?.();
      } catch (_) {}
      innerUnsub = null;

      if (typeof inner.subscribe === 'function') {
        innerUnsub = inner.subscribe(ticker, timeframe, guardedOnBar, opts);
      }
    };

    const fetchTailBarsWithTimeout = async (): Promise<any[]> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Timeout sinkronisasi tail ${syncTimeoutMs}ms`));
          }, syncTimeoutMs);
          unrefTimer(timeoutHandle);
        });
        return await Promise.race([
          Promise.resolve(inner.getBars(ticker, timeframe, { countBack: 5, limit: 5 })),
          timeoutPromise,
        ]);
      } finally {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }
      }
    };

    const syncTailBars = async (fromWatchdog = false): Promise<boolean> => {
      if (stopped) return false;
      if (typeof inner.getBars !== 'function') {
        if (fromWatchdog) {
          consecutiveStalls++;
          const state: FeedConnectionState = consecutiveStalls >= 3 ? 'blocked' : 'stalled';
          healthSink?.reportStreamState(
            subKey,
            providerId,
            state,
            `Aliran candle ${providerId.toUpperCase()} (${ticker}) terhenti sementara, menghubungkan ulang...`
          );
        }
        return false;
      }

      try {
        const tailBars = await fetchTailBarsWithTimeout();
        if (stopped) return false;

        const last =
          Array.isArray(tailBars) && tailBars.length > 0 ? tailBars[tailBars.length - 1] : null;
        const isValidTail =
          Boolean(last) &&
          Number.isFinite(Number(last.close)) &&
          Number(last.close) > 0;

        if (!isValidTail) {
          if (fromWatchdog) {
            consecutiveStalls++;
            const state: FeedConnectionState = consecutiveStalls >= 3 ? 'blocked' : 'stalled';
            healthSink?.reportStreamState(
              subKey,
              providerId,
              state,
              `Gagal menyinkronkan candle ${ticker} pada ${providerId.toUpperCase()} (data kosong).`
            );
          }
          return false;
        }

        // Tail REST berhasil & valid: reset penghitung stall agar pair sepi likuiditas tidak memicu false-alarm blocked
        lastBarAt = Date.now();
        consecutiveStalls = 0;
        healthSink?.reportStreamState(subKey, providerId, 'connected');

        const tailSlice = tailBars.slice(-3);
        for (const b of tailSlice) {
          onBar(b);
        }
        return true;
      } catch (_err: any) {
        if (!stopped) {
          consecutiveStalls++;
          const state: FeedConnectionState = consecutiveStalls >= 3 ? 'blocked' : 'stalled';
          healthSink?.reportStreamState(
            subKey,
            providerId,
            state,
            `Gagal menyinkronkan candle ${ticker} pada ${providerId.toUpperCase()}.`
          );
        }
        return false;
      }
    };

    const forceReconnect = async (fromWatchdog = false) => {
      if (stopped || isRecovering) return;
      isRecovering = true;
      try {
        lastResubscribeAt = Date.now();
        if (typeof inner.reconnectAll === 'function') {
          inner.reconnectAll();
        } else {
          startInner();
        }
        await syncTailBars(fromWatchdog);
      } finally {
        isRecovering = false;
      }
    };

    startInner();

    const unregister = coordinator.register({
      reconnect: () => forceReconnect(false),
      stop: () => {
        stopped = true;
        if (watchdogTimer !== null) {
          clearInterval(watchdogTimer);
          watchdogTimer = null;
        }
        try {
          innerUnsub?.();
        } catch (_) {}
        innerUnsub = null;
        healthSink?.clearStreamState?.(subKey);
      },
    });

    if (enableStaleWatchdog) {
      watchdogTimer = setInterval(() => {
        if (stopped) return;
        // Jika browser mem-background-kan tab, tunggu tab visible/online daripada spam reconnect
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        const now = Date.now();
        const silentDuration = now - lastBarAt;
        const sinceLastRecover = now - lastResubscribeAt;
        if (silentDuration >= staleStreamMs && sinceLastRecover >= minResubscribeGapMs) {
          // Jika getBars tersedia, tunggu verifikasi syncTailBars sebelum menaikkan alert stall/blocked
          void forceReconnect(true);
        }
      }, watchdogCheckMs);
      unrefTimer(watchdogTimer);
    }

    return () => {
      stopped = true;
      if (watchdogTimer !== null) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      try {
        innerUnsub?.();
      } catch (_) {}
      innerUnsub = null;
      healthSink?.clearStreamState?.(subKey);
      unregister();
    };
  };

  return wrapper as T;
}
