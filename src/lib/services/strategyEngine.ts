import { Indicator, PineTS } from 'pinets';
import type { Candle, StrategyPerformanceSummary, StrategyTradeRecord } from '../types/market';

export interface StrategyBacktestResult {
  success: boolean;
  isStrategy: boolean;
  scriptTitle?: string;
  summary?: StrategyPerformanceSummary;
  error?: string;
  executionTimeMs: number;
}

/**
 * Menjalankan evaluasi backtest Pine Script v6 secara instan dan mengembalikan
 * telemetri performa kuantitatif serta daftar seluruh transaksi (trade ledger).
 */
export async function runPineStrategyBacktest(
  code: string,
  candles: Candle[]
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

  try {
    // 1. Parsing dan analisis tipe deklarasi Pine Script
    const indicator = new Indicator(code);
    await indicator.prepare();

    const declType = indicator.getDeclarationType?.();
    const isStrategy = declType === 'strategy';

    if (!isStrategy) {
      const execMs = Math.round(performance.now() - startTime);
      return {
        success: true,
        isStrategy: false,
        error: 'Skrip yang dimasukkan merupakan indikator visual (indicator()), bukan strategi kuantitatif (strategy()). Gunakan fungsi strategy("Nama Strategi", ...) untuk mengaktifkan backtesting.',
        executionTimeMs: execMs,
      };
    }

    // 2. Format candle ke representasi PineTS
    const pineCandles = candles.map((c) => ({
      openTime: c.time,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // 3. Eksekusi PineTS Runtime Engine
    const pine = new PineTS(pineCandles);
    const ctx = await pine.run(indicator);
    const strat = ctx.strategy;

    const initialCapital = Number(strat?.initial_capital) || 1000;
    const netProfit = Number(strat?.netprofit) || 0;
    const grossProfit = Number(strat?.grossprofit) || 0;
    const grossLoss = Number(strat?.grossloss) || 0;
    const equity = Number(strat?.equity) || initialCapital + netProfit;
    const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

    // Profit Factor: Rasio Gross Profit terhadap Gross Loss
    let profitFactor = 0;
    if (grossLoss > 0) {
      profitFactor = parseFloat((grossProfit / grossLoss).toFixed(2));
    } else if (grossProfit > 0) {
      profitFactor = 999.0;
    }

    const wintrades = Number(strat?.wintrades) || 0;
    const losstrades = Number(strat?.losstrades) || 0;
    const eventrades = Number(strat?.eventrades) || 0;

    const closedTradesRaw = Array.isArray(strat?.closedtrades) ? strat.closedtrades : [];
    const openTradesRaw = Array.isArray(strat?.opentrades) ? strat.opentrades : [];
    const totalClosed = closedTradesRaw.length;
    const winRate = totalClosed > 0 ? parseFloat(((wintrades / totalClosed) * 100).toFixed(1)) : 0;

    // Drawdown
    const maxDrawdown = Number(strat?.max_drawdown) || 0;
    let maxDrawdownPercent = Number(strat?.max_drawdown_percent_value) || 0;
    if (maxDrawdownPercent === 0 && initialCapital > 0 && maxDrawdown > 0) {
      maxDrawdownPercent = (maxDrawdown / initialCapital) * 100;
    }
    maxDrawdownPercent = parseFloat(maxDrawdownPercent.toFixed(2));

    // Posisi Berjalan Terkini
    const positionSize = Number(strat?.position_size) || 0;
    const avgPrice = Number(strat?.position_avg_price) || 0;
    const openPnl = Number(strat?.openprofit) || 0;
    const openPnlPercent = initialCapital > 0 ? (openPnl / initialCapital) * 100 : 0;

    const currentPosition = {
      size: positionSize,
      avgPrice,
      direction: (positionSize > 0 ? 'long' : positionSize < 0 ? 'short' : 'flat') as 'flat' | 'long' | 'short',
      unrealizedPnl: openPnl,
      unrealizedPnlPercent: parseFloat(openPnlPercent.toFixed(2)),
    };

    // 4. Transformasi Trade Ledger ke StrategyTradeRecord
    const allTradesRaw = [...closedTradesRaw, ...openTradesRaw];
    allTradesRaw.sort((a, b) => (Number(a.entry_time) || 0) - (Number(b.entry_time) || 0));

    const formattedTrades: StrategyTradeRecord[] = allTradesRaw.map((t, idx) => {
      const sizeVal = Number(t.size) || 0;
      const entryPrice = Number(t.entry_price) || 0;
      const exitPrice = t.exit_price !== undefined ? Number(t.exit_price) : undefined;
      const profit = t.profit !== undefined ? Number(t.profit) : undefined;

      let profitPercent: number | undefined = undefined;
      if (profit !== undefined && entryPrice > 0 && Math.abs(sizeVal) > 0) {
        const notionalCost = Math.abs(sizeVal) * entryPrice;
        if (notionalCost > 0) {
          profitPercent = parseFloat(((profit / notionalCost) * 100).toFixed(2));
        }
      }

      return {
        id: String(t.id || `trade_${idx + 1}`),
        tradeNum: idx + 1,
        direction: sizeVal >= 0 ? 'long' : 'short',
        entryPrice,
        entryTime: Number(t.entry_time) || 0,
        entryComment: t.entry_comment || t.entry_id || 'Entry',
        exitPrice,
        exitTime: t.exit_time !== undefined ? Number(t.exit_time) : undefined,
        exitComment: t.exit_comment || t.exit_id || (t.status === 'open' ? 'Open Position' : 'Exit'),
        size: Math.abs(sizeVal),
        profit: profit !== undefined ? parseFloat(profit.toFixed(2)) : undefined,
        profitPercent,
        status: t.status === 'open' ? 'open' : 'closed',
        maxDrawdown: t.max_drawdown !== undefined ? parseFloat(Number(t.max_drawdown).toFixed(2)) : undefined,
        maxRunup: t.max_runup !== undefined ? parseFloat(Number(t.max_runup).toFixed(2)) : undefined,
      };
    });

    const strategyTitle = strat?.config?.title || 'Pine Strategy';

    const summary: StrategyPerformanceSummary = {
      strategyTitle,
      netProfit: parseFloat(netProfit.toFixed(2)),
      netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      profitFactor,
      winRate,
      totalTrades: totalClosed,
      winningTrades: wintrades,
      losingTrades: losstrades,
      evenTrades: eventrades,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      maxDrawdownPercent,
      initialCapital,
      equity: parseFloat(equity.toFixed(2)),
      openTrades: openTradesRaw.length,
      currentPosition,
      trades: formattedTrades,
    };

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      isStrategy: true,
      scriptTitle: strategyTitle,
      summary,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      isStrategy: true,
      error: err?.message || String(err),
      executionTimeMs,
    };
  }
}
