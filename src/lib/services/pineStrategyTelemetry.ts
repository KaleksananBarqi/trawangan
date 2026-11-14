/**
 * Pine Strategy Execution Markers & Performance Telemetry Surface (Ticket #199)
 *
 * Mengelola penangkapan telemetri performa kuantitatif (StrategyState),
 * ekstraksi round-trip trade ledger (StrategyTrade[]), dan normalisasi on-chart
 * trade execution markers (TradeExecution[]) untuk dirender pada WebGL2 canvas grafik.
 */

/**
 * Status broker strategi kuantitatif pada bar komputasi terakhir.
 * Desain netral sesuai kontrak @luxalgo/vela.
 */
export interface StrategyState {
  /** Jumlah kontrak yang sedang terbuka (positif = long, negatif = short, 0 = flat). */
  position: number;
  /** Harga rata-rata eksekusi posisi yang masih terbuka (0 jika flat). */
  avgPrice: number;
  /** Total ekuitas akun (modal awal + realized PnL + unrealized PnL). */
  equity: number;
  /** Laba/rugi berjalan (floating unrealized PnL) dari posisi terbuka saat ini. */
  openPnl: number;
  /** Laba/rugi terealisasi kumulatif (grossProfit dikurangi grossLoss). */
  netPnl: number;
  /** Total akumulasi keuntungan dari seluruh transaksi yang menang. */
  grossProfit: number;
  /** Total akumulasi kerugian dari seluruh transaksi yang kalah. */
  grossLoss: number;
  /** Jumlah transaksi berstatus menang. */
  wins: number;
  /** Jumlah transaksi berstatus kalah. */
  losses: number;
  /** Jumlah transaksi impas (break-even). */
  even: number;
  /** Penurunan ekuitas puncak-ke-lembah terbesar (Max Drawdown moneter). */
  maxDrawdown: number;
  /** Kenaikan ekuitas lembah-ke-puncak terbesar (Max Runup moneter). */
  maxRunup: number;
  /** Modal awal akun strategi. */
  initialCapital: number;
}

/**
 * Satu titik eksekusi order (fill) dalam sebuah transaksi strategi.
 */
export interface StrategyFill {
  /** Identifier order dari skrip (Pine strategy.entry / strategy.exit / strategy.order). */
  id: string;
  /** Waktu pembukaan bar saat order terisi (epoch ms). */
  time: number;
  /** Harga eksekusi riil dari order. */
  price: number;
  /** Catatan atau komentar opsional dari order. */
  comment?: string;
}

/**
 * Satu siklus transaksi round-trip (entry dan exit penutup jika ada).
 */
export interface StrategyTrade {
  /** ID unik transaksi yang stabil sepanjang eksekusi skrip. */
  id: string;
  /** Arah transaksi: 'long' atau 'short'. */
  side: 'long' | 'short';
  /** Kuantitas lot/kontrak (magnitudo positif). */
  qty: number;
  /** Data eksekusi pembukaan posisi (entry fill). */
  entry: StrategyFill;
  /** Data eksekusi penutupan posisi (exit fill, tidak ada jika masih terbuka). */
  exit?: StrategyFill;
  /** Menandakan apakah transaksi masih aktif/terbuka. */
  open: boolean;
  /** Laba/rugi bersih terealisasi dari transaksi round-trip ini. */
  pnl?: number;
  /** Biaya komisi transaksi (jika dihitung oleh broker emulator). */
  commission?: number;
  /** Adverse excursion maksimum selama masa transaksi (drawdown per-trade). */
  maxDrawdown?: number;
  /** Favorable excursion maksimum selama masa transaksi (runup per-trade). */
  maxRunup?: number;
}

/**
 * Unit penanda eksekusi transaksi yang dilukis di atas kanvas lilin grafik (on-chart marker).
 * Selalu dirender pada PRICE pane:
 * - Buy: Panah ke atas di bawah bar lilin.
 * - Sell: Panah ke bawah di atas bar lilin.
 */
export interface TradeExecution {
  /** Waktu bar lilin tempat marker berlabuh (epoch ms). */
  time: number;
  /** Harga eksekusi order tempat penanda harga diletakkan. */
  price: number;
  /** Arah eksekusi pasar ('buy' untuk beli, 'sell' untuk jual). */
  side: 'buy' | 'sell';
  /** Jenis aksi eksekusi: 'entry' (buka posisi) atau 'exit' (tutup posisi). */
  kind: 'entry' | 'exit';
  /** Teks label samping panah (komentar order atau ID order). */
  label?: string;
  /** Kuantitas yang dieksekusi (signed string di renderer: +buy, -sell). */
  qty?: number;
  /** ID round-trip terkait untuk pengelompokan entry & exit. */
  tradeId?: string;
}

/**
 * Struktur payload telemetri lengkap strategi kuantitatif yang dipancarkan.
 */
export interface StrategyTelemetryPayload {
  /** Identifier unik indikator/skrip strategi. */
  indicatorId: string;
  /** Judul skrip strategi seperti dideklarasikan di `strategy("Title", ...)`. */
  scriptTitle?: string;
  /** Identifier sel grafik tempat skrip dijalankan. */
  cellId?: string;
  /** Status ringkasan broker kuantitatif terkini. */
  state: StrategyState;
  /** Buku besar riwayat transaksi round-trip. */
  trades: StrategyTrade[];
  /** Daftar marker eksekusi on-chart untuk dilukis pada renderer. */
  tradeExecutions: TradeExecution[];
  /** Timestamp kapan data telemetri ini diambil/diperbarui. */
  timestamp: number;
}

/**
 * Pengonversi angka aman: mengembalikan 0 jika nilai bernilai NaN/null/undefined.
 */
function toNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Mem-parsing data mentah dari konteks eksekusi menjadi objek StrategyState terstandarisasi.
 * Mendukung format camelCase Vela maupun snake_case PineTS.
 */
export function parseStrategyState(raw: any): StrategyState {
  if (!raw || typeof raw !== 'object') {
    return {
      position: 0,
      avgPrice: 0,
      equity: 0,
      openPnl: 0,
      netPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      wins: 0,
      losses: 0,
      even: 0,
      maxDrawdown: 0,
      maxRunup: 0,
      initialCapital: 0,
    };
  }

  const s = raw;
  const initialCap = toNum(s.initialCapital ?? s.initial_capital, 0);
  const net = toNum(s.netPnl ?? s.netprofit, 0);
  const eq = toNum(s.equity, initialCap > 0 ? initialCap + net : 0);

  return {
    position: toNum(s.position ?? s.position_size, 0),
    avgPrice: toNum(s.avgPrice ?? s.position_avg_price, 0),
    equity: eq,
    openPnl: toNum(s.openPnl ?? s.openprofit, 0),
    netPnl: net,
    grossProfit: toNum(s.grossProfit ?? s.grossprofit, 0),
    grossLoss: toNum(s.grossLoss ?? s.grossloss, 0),
    wins: toNum(s.wins ?? s.wintrades, 0),
    losses: toNum(s.losses ?? s.losstrades, 0),
    even: toNum(s.even ?? s.eventrades, 0),
    maxDrawdown: toNum(s.maxDrawdown ?? s.max_drawdown, 0),
    maxRunup: toNum(s.maxRunup ?? s.max_runup, 0),
    initialCapital: initialCap,
  };
}

/**
 * Mengonversi daftar transaksi mentah (baik format Vela StrategyTrade maupun PineTS raw trades)
 * menjadi array StrategyTrade[] yang dinormalisasi.
 */
export function parseStrategyTrades(rawTrades: any[]): StrategyTrade[] {
  if (!Array.isArray(rawTrades)) return [];

  const out: StrategyTrade[] = [];

  for (let idx = 0; idx < rawTrades.length; idx++) {
    const item = rawTrades[idx];
    if (!item || typeof item !== 'object') continue;

    // Skenario 1: Format bawaan Vela StrategyTrade (memiliki struktur item.entry)
    if (item.entry && typeof item.entry === 'object' && item.entry.price !== undefined) {
      const entryPrice = toNum(item.entry.price);
      const entryTime = toNum(item.entry.time);
      const qty = Math.abs(toNum(item.qty, 1));
      const side: 'long' | 'short' = item.side === 'short' ? 'short' : 'long';
      const isOpen = Boolean(item.open || !item.exit);

      const entryFill: StrategyFill = {
        id: String(item.entry.id || `entry_${idx + 1}`),
        time: entryTime,
        price: entryPrice,
        ...(item.entry.comment ? { comment: String(item.entry.comment) } : {}),
      };

      let exitFill: StrategyFill | undefined;
      if (!isOpen && item.exit && typeof item.exit === 'object') {
        exitFill = {
          id: String(item.exit.id || `exit_${idx + 1}`),
          time: toNum(item.exit.time),
          price: toNum(item.exit.price),
          ...(item.exit.comment ? { comment: String(item.exit.comment) } : {}),
        };
      }

      out.push({
        id: String(item.id || `trade_${idx + 1}`),
        side,
        qty,
        entry: entryFill,
        exit: exitFill,
        open: isOpen,
        ...(item.pnl !== undefined ? { pnl: toNum(item.pnl) } : {}),
        ...(item.commission !== undefined ? { commission: toNum(item.commission) } : {}),
        ...(item.maxDrawdown !== undefined ? { maxDrawdown: toNum(item.maxDrawdown) } : {}),
        ...(item.maxRunup !== undefined ? { maxRunup: toNum(item.maxRunup) } : {}),
      });
      continue;
    }

    // Skenario 2: Format mentah PineTS (entry_price, entry_time, size, status, dsb)
    const rawEntryPrice = toNum(item.entry_price ?? item.price);
    const rawEntryTime = toNum(item.entry_time ?? item.time);
    const rawSize = toNum(item.size, 1);
    const side: 'long' | 'short' = rawSize >= 0 ? 'long' : 'short';
    const qty = Math.abs(rawSize);

    if (rawEntryPrice <= 0 && rawEntryTime <= 0) continue;

    const isOpen = item.status === 'open' || item.exit_price === undefined || item.exit_time === undefined;

    const entryFill: StrategyFill = {
      id: String(item.entry_id || item.id || `entry_${idx + 1}`),
      time: rawEntryTime,
      price: rawEntryPrice,
      ...(item.entry_comment ? { comment: String(item.entry_comment) } : {}),
    };

    let exitFill: StrategyFill | undefined;
    if (!isOpen) {
      exitFill = {
        id: String(item.exit_id || `exit_${idx + 1}`),
        time: toNum(item.exit_time),
        price: toNum(item.exit_price),
        ...(item.exit_comment ? { comment: String(item.exit_comment) } : {}),
      };
    }

    out.push({
      id: String(item.id || `trade_${idx + 1}`),
      side,
      qty,
      entry: entryFill,
      exit: exitFill,
      open: isOpen,
      ...(item.profit !== undefined ? { pnl: toNum(item.profit) } : {}),
      ...(item.max_drawdown !== undefined ? { maxDrawdown: toNum(item.max_drawdown) } : {}),
      ...(item.max_runup !== undefined ? { maxRunup: toNum(item.max_runup) } : {}),
    });
  }

  return out;
}

/**
 * Mengonversi daftar transaksi round-trip (StrategyTrade[]) menjadi TradeExecution[]
 * on-chart marker unit untuk dilukis di kanvas WebGL2:
 * - Buy entries: panah menghadap ke atas di bawah lilin (side: 'buy', kind: 'entry').
 * - Buy exits: panah menghadap ke bawah di atas lilin (side: 'sell', kind: 'exit').
 * - Short entries: panah menghadap ke bawah di atas lilin (side: 'sell', kind: 'entry').
 * - Short exits: panah menghadap ke atas di bawah lilin (side: 'buy', kind: 'exit').
 */
export function tradesToTradeExecutions(trades: Array<StrategyTrade | any>): TradeExecution[] {
  if (!Array.isArray(trades)) return [];

  const executions: TradeExecution[] = [];

  for (const t of trades) {
    if (!t || typeof t !== 'object') continue;

    // Jika item sudah berformat TradeExecution (time, price, side, kind)
    if (t.time !== undefined && t.price !== undefined && t.side && t.kind) {
      executions.push({
        time: toNum(t.time),
        price: toNum(t.price),
        side: t.side === 'sell' ? 'sell' : 'buy',
        kind: t.kind === 'exit' ? 'exit' : 'entry',
        ...(t.label ? { label: String(t.label) } : {}),
        ...(t.qty !== undefined ? { qty: Math.abs(toNum(t.qty)) } : {}),
        ...(t.tradeId ? { tradeId: String(t.tradeId) } : {}),
      });
      continue;
    }

    // Format StrategyTrade standar
    if (t.entry && typeof t.entry === 'object') {
      const isLong = t.side !== 'short';
      const tradeQty = Math.abs(toNum(t.qty, 1));
      const tradeId = String(t.id || '');

      // 1. Entry marker
      executions.push({
        time: toNum(t.entry.time),
        price: toNum(t.entry.price),
        side: isLong ? 'buy' : 'sell',
        kind: 'entry',
        label: t.entry.comment || t.entry.id,
        qty: tradeQty,
        ...(tradeId ? { tradeId } : {}),
      });

      // 2. Exit marker (jika transaksi sudah tertutup / memiliki data exit)
      if (!t.open && t.exit && typeof t.exit === 'object') {
        executions.push({
          time: toNum(t.exit.time),
          price: toNum(t.exit.price),
          side: isLong ? 'sell' : 'buy',
          kind: 'exit',
          label: t.exit.comment || t.exit.id,
          qty: tradeQty,
          ...(tradeId ? { tradeId } : {}),
        });
      }
    }
  }

  return executions;
}

/**
 * Service pengelola telemetri performa dan marker eksekusi strategi Pine Script.
 */
export class PineStrategyTelemetryService {
  private telemetryMap = new Map<string, StrategyTelemetryPayload>();
  private subscribers = new Set<(payload: StrategyTelemetryPayload) => void>();

  /**
   * Menyimpan atau memperbarui data telemetri untuk sebuah strategi
   */
  public recordTelemetry(payload: StrategyTelemetryPayload): void {
    if (!payload || !payload.indicatorId) return;
    this.telemetryMap.set(payload.indicatorId, payload);
    this.notifySubscribers(payload);
  }

  /**
   * Mengambil data telemetri strategi.
   * Jika indicatorId diabaikan, mengembalikan telemetri strategi yang paling baru diperbarui.
   */
  public getTelemetry(indicatorId?: string): StrategyTelemetryPayload | null {
    if (indicatorId) {
      return this.telemetryMap.get(indicatorId) || null;
    }
    if (this.telemetryMap.size === 0) return null;

    // Ambil yang paling mutakhir (timestamp tertinggi)
    let latest: StrategyTelemetryPayload | null = null;
    for (const item of this.telemetryMap.values()) {
      if (!latest || item.timestamp >= latest.timestamp) {
        latest = item;
      }
    }
    return latest;
  }

  /**
   * Mengambil seluruh rekam telemetri strategi aktif
   */
  public getAllTelemetry(): StrategyTelemetryPayload[] {
    return Array.from(this.telemetryMap.values());
  }

  /**
   * Mengambil marker eksekusi transaksi (on-chart markers)
   */
  public getTradeExecutions(indicatorId?: string): TradeExecution[] {
    if (indicatorId) {
      return this.telemetryMap.get(indicatorId)?.tradeExecutions || [];
    }
    const allExecs: TradeExecution[] = [];
    for (const record of this.telemetryMap.values()) {
      allExecs.push(...record.tradeExecutions);
    }
    return allExecs;
  }

  /**
   * Membersihkan data telemetri.
   * Jika indicatorId ditentukan, hanya menghapus entri untuk indikator tersebut.
   * Jika tidak ditentukan, membersihkan seluruh data telemetri.
   */
  public clearTelemetry(indicatorId?: string): void {
    if (indicatorId) {
      this.telemetryMap.delete(indicatorId);
    } else {
      this.telemetryMap.clear();
    }
  }

  /**
   * Berlangganan event pembaruan telemetri strategi
   */
  public subscribe(listener: (payload: StrategyTelemetryPayload) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(payload: StrategyTelemetryPayload): void {
    for (const listener of this.subscribers) {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Error in subscriber callback:', err);
      }
    }
  }

  /**
   * Mengekstrak telemetri dari event ScriptRun milik Vela runtime
   */
  public async extractFromScriptRun(run: any, cellId?: string): Promise<StrategyTelemetryPayload | null> {
    if (!run || !run.id) return null;

    // Pastikan run berkaitan dengan strategi kuantitatif
    const isStrategy = run.kind === 'strategy' || Boolean(run.strategy) || typeof run.trades === 'function';
    if (!isStrategy) return null;

    const state = parseStrategyState(run.strategy);

    let rawTrades: any[] = [];
    if (typeof run.trades === 'function') {
      try {
        rawTrades = (await run.trades()) || [];
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Gagal mengambil riwayat transaksi dari run.trades():', err);
        rawTrades = [];
      }
    } else if (Array.isArray(run.trades)) {
      rawTrades = run.trades;
    }

    const trades = parseStrategyTrades(rawTrades);
    const tradeExecutions = tradesToTradeExecutions(trades);

    const payload: StrategyTelemetryPayload = {
      indicatorId: String(run.id),
      scriptTitle: run.title ? String(run.title) : undefined,
      cellId: cellId ? String(cellId) : undefined,
      state,
      trades,
      tradeExecutions,
      timestamp: Date.now(),
    };

    this.recordTelemetry(payload);
    return payload;
  }

  /**
   * Mengekstrak telemetri dari hasil pemanggilan handle.context() atau objek broker engine
   */
  public extractFromContext(
    indicatorId: string,
    context: any,
    title?: string,
    cellId?: string
  ): StrategyTelemetryPayload | null {
    if (!indicatorId || !context || typeof context !== 'object') return null;

    const rawStrat = context.strategy || context;
    const state = parseStrategyState(rawStrat);

    const rawTrades = Array.isArray(context.trades)
      ? context.trades
      : Array.isArray(rawStrat.closedtrades) || Array.isArray(rawStrat.opentrades)
      ? [...(rawStrat.closedtrades || []), ...(rawStrat.opentrades || [])]
      : [];

    const trades = parseStrategyTrades(rawTrades);
    const tradeExecutions = tradesToTradeExecutions(trades);

    const payload: StrategyTelemetryPayload = {
      indicatorId,
      scriptTitle: title,
      cellId,
      state,
      trades,
      tradeExecutions,
      timestamp: Date.now(),
    };

    this.recordTelemetry(payload);
    return payload;
  }

  /**
   * Mengalirkan (route) marker eksekusi transaksi ke renderer chart atau cell WebGL2
   */
  public routeTradeMarkersToCell(
    cellOrChart: any,
    indicatorId: string,
    executions: TradeExecution[]
  ): boolean {
    if (!cellOrChart) return false;

    const chart = cellOrChart.chart || cellOrChart.inner || cellOrChart;
    const renderer = chart?.renderer || chart;

    let routed = false;

    // 1. Pastikan fitur tradeMarkers pada konfigurasi renderer diaktifkan
    if (renderer && typeof renderer.applyConfig === 'function') {
      try {
        renderer.applyConfig({
          trades: {
            visible: true,
            labels: true,
            qty: true,
          },
        });
        routed = true;
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Gagal menerapkan konfigurasi trades ke renderer:', err);
      }
    } else if (chart && typeof chart.applyConfig === 'function') {
      try {
        chart.applyConfig({
          trades: {
            visible: true,
            labels: true,
            qty: true,
          },
        });
        routed = true;
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Gagal menerapkan konfigurasi trades ke chart:', err);
      }
    }

    // 2. Hubungkan marker ke model indikator di scene jika tersedia
    try {
      const scene = renderer?.scene || chart?.scene;
      if (scene?.indicators && typeof scene.indicators.get === 'function') {
        const model = scene.indicators.get(indicatorId);
        if (model) {
          model.trades = executions;
          routed = true;
        }
      }
    } catch (err) {
      console.warn(`[PineStrategyTelemetry] Gagal menambatkan trade markers ke scene untuk indikator ${indicatorId}:`, err);
    }

    // 3. Minta re-render visual jika diperlukan
    if (typeof chart?.requestRender === 'function') {
      try {
        chart.requestRender();
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Gagal memanggil chart.requestRender():', err);
      }
    } else if (typeof renderer?.render === 'function') {
      try {
        renderer.render();
      } catch (err) {
        console.warn('[PineStrategyTelemetry] Gagal memanggil renderer.render():', err);
      }
    }

    return routed;
  }
}

/** Instance singleton untuk kemudahan akses global jika diperlukan */
export const pineStrategyTelemetry = new PineStrategyTelemetryService();
