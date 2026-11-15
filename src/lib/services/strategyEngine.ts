/**
 * Engine Backtest Strategi Pine Script Terisolasi Worker (Ticket #220 / Spec #210)
 *
 * Menjalankan evaluasi backtest strategi Pine Script v5/v6 di luar main UI thread
 * menggunakan pipeline worker `PineRuntimeCoordinator` (`TrawanganPineWorkerEngine`)
 * sesuai ADR-0003 §2.C, dengan adapter headless Node (`PineEngine`) untuk pengujian unit.
 *
 * Seluruh metrik `StrategyBacktestReport` dan daftar transaksi dihitung melalui
 * ekstraktor telemetri kanonikal (`extractStrategyTelemetryPayload` +
 * `telemetryToPerformanceSummary`) agar identik dengan telemetri strategi live di grafik.
 */

import { PineEngine } from '@luxalgo/vela-pinets';
import type { EngineContextSnapshot, ExecutionSession, OHLCV, ScriptingEngine } from '@luxalgo/vela/plugin';
import type { Candle, StrategyBacktestReport } from '../types/market';
import {
  PineRuntimeCoordinator,
  pineRuntimeCoordinator,
  extractStrategyTelemetryPayload,
  telemetryToPerformanceSummary,
} from './pineRuntimeCoordinator';

export interface StrategyBacktestResult {
  success: boolean;
  isStrategy: boolean;
  scriptTitle?: string;
  summary?: StrategyBacktestReport;
  error?: string;
  executionTimeMs: number;
}

export interface PineStrategyBacktestOptions {
  symbol?: string;
  timeframe?: string;
  /** Injeksi ScriptingEngine opsional (misal untuk pengujian atau worker kustom) */
  engine?: ScriptingEngine;
  /** Koordinator runtime opsional (default: pineRuntimeCoordinator) */
  coordinator?: PineRuntimeCoordinator;
}

type TerminableScriptingEngine = ScriptingEngine & { terminate?: () => void };

/**
 * Memilih engine eksekusi: worker engine di browser, atau adapter PineEngine headless di Node.
 */
function resolveBacktestEngine(
  options: PineStrategyBacktestOptions,
  coordinator: PineRuntimeCoordinator
): { engine: TerminableScriptingEngine; ownsEngine: boolean } {
  if (options.engine) {
    return { engine: options.engine, ownsEngine: false };
  }

  if (typeof Worker !== 'undefined') {
    return { engine: coordinator.createWorkerEngine(), ownsEngine: true };
  }

  return { engine: new PineEngine(), ownsEngine: true };
}

/**
 * Menjalankan eksekusi statis satu kali pada ScriptingEngine dan mengambil snapshot konteks.
 */
function executeStaticForContext(
  engine: ScriptingEngine,
  prepared: Awaited<ReturnType<ScriptingEngine['prepare']>>,
  bars: OHLCV[],
  symbol: string,
  timeframe: string,
  coordinator: PineRuntimeCoordinator
): Promise<EngineContextSnapshot | null> {
  return new Promise((resolve, reject) => {
    let session: ExecutionSession | null = null;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        session?.stop();
      } catch {
        // Abaikan error saat menghentikan sesi
      }
      fn();
    };

    session = engine.execute(
      {
        prepared,
        market: { symbol, timeframe },
        bars,
        fetchSeries: coordinator.getFetchSeriesAdapter(),
        mode: 'static',
      },
      {
        onModel: () => {
          // Model visual tidak dirender pada backtest headless editor
        },
        onError: (err) => {
          finish(() => reject(err));
        },
        onDone: async () => {
          try {
            const ctx = session?.getContext
              ? await session.getContext(['strategy', 'trades'])
              : null;
            finish(() => resolve(ctx));
          } catch (err) {
            finish(() => reject(err));
          }
        },
      }
    );
  });
}

/**
 * Menjalankan evaluasi backtest Pine Script di luar main UI thread melalui pipeline
 * PineRuntimeCoordinator dan mengembalikan laporan StrategyBacktestReport kanonikal.
 */
export async function runPineStrategyBacktest(
  code: string,
  candles: Candle[],
  options: PineStrategyBacktestOptions = {}
): Promise<StrategyBacktestResult> {
  const startTime = performance.now();

  if (!code || !code.trim()) {
    return {
      success: false,
      isStrategy: false,
      error: 'Kode Pine Script kosong.',
      executionTimeMs: 0,
    };
  }

  if (!candles || candles.length === 0) {
    return {
      success: false,
      isStrategy: false,
      error: 'Data candle pasar tidak tersedia untuk backtesting.',
      executionTimeMs: 0,
    };
  }

  const coordinator = options.coordinator ?? pineRuntimeCoordinator;
  const { engine, ownsEngine } = resolveBacktestEngine(options, coordinator);
  const instanceId = `backtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbol = options.symbol || 'BTCUSDT';
  const timeframe = options.timeframe || '1h';

  try {
    const prepared = await engine.prepare(code, instanceId);

    const bars: OHLCV[] = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
    }));

    const ctx = await executeStaticForContext(engine, prepared, bars, symbol, timeframe, coordinator);
    const executionTimeMs = Math.round(performance.now() - startTime);

    if (!ctx?.strategy) {
      return {
        success: true,
        isStrategy: false,
        scriptTitle: prepared.meta?.title || undefined,
        error:
          'Skrip yang dimasukkan merupakan indikator visual (indicator()), bukan strategi kuantitatif (strategy()). Gunakan fungsi strategy("Nama Strategi", ...) untuk mengaktifkan backtesting.',
        executionTimeMs,
      };
    }

    const title = prepared.meta?.title || ctx.meta?.title || 'Pine Strategy';
    const payload = extractStrategyTelemetryPayload(instanceId, ctx, title);
    if (!payload) {
      return {
        success: false,
        isStrategy: true,
        error: 'Gagal mengekstrak telemetri strategi dari konteks eksekusi.',
        executionTimeMs,
      };
    }

    const summary = telemetryToPerformanceSummary(payload);

    return {
      success: true,
      isStrategy: true,
      scriptTitle: summary.strategyTitle,
      summary,
      executionTimeMs,
    };
  } catch (err: unknown) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      isStrategy: false,
      error: message,
      executionTimeMs,
    };
  } finally {
    if (ownsEngine && typeof engine.terminate === 'function') {
      try {
        engine.terminate();
      } catch {
        // Abaikan error terminasi worker
      }
    }
  }
}
