/**
 * Bitunix Futures Market Data Provider untuk Vela WebGL2 Engine
 * Mendukung pembacaan candle historis kline dan streaming data pasar
 */

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BarRange {
  from?: number;
  to?: number;
  countBack?: number;
  session?: string;
}

export interface SymbolDescriptor {
  symbol: string;
  ticker: string;
  description?: string;
  type?: string;
}

export interface SymbolInfo {
  ticker: string;
  name?: string;
  tickerid?: string;
  description?: string;
  type?: string;
  session?: string;
  exchange?: string;
  listed_exchange?: string;
  timezone?: string;
  minmov?: number;
  pricescale?: number;
  has_intraday?: boolean;
  supported_resolutions?: string[];
  volume_precision?: number;
  [key: string]: unknown;
}

export class BitunixProvider {
  private activeSubscriptions = new Map<string, { timer: any; callback: (b: OHLCV) => void }>();

  info() {
    return {
      name: 'bitunix',
      displayName: 'Bitunix',
      description: 'Bitunix Futures (USDT-margined Perpetuals)',
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  /**
   * Konversi timeframe Vela ke parameter interval Bitunix API
   */
  private mapTimeframe(tf: string): string {
    const clean = tf.toLowerCase();
    switch (clean) {
      case '1':
      case '1m':
        return '1m';
      case '3':
      case '3m':
        return '3m';
      case '5':
      case '5m':
        return '5m';
      case '15':
      case '15m':
        return '15m';
      case '30':
      case '30m':
        return '30m';
      case '60':
      case '1h':
      case 'h':
        return '1h';
      case '120':
      case '2h':
        return '2h';
      case '240':
      case '4h':
        return '4h';
      case '360':
      case '6h':
        return '6h';
      case '720':
      case '12h':
        return '12h';
      case '1d':
      case 'd':
        return '1d';
      case '1w':
      case 'w':
        return '1w';
      default:
        return '1h';
    }
  }

  /**
   * Mengambil candle historis dari Bitunix Futures REST API
   */
  async getBars(ticker: string, timeframe: string, range: any): Promise<OHLCV[]> {
    const clean = ticker.replace(/^bitunix:/i, '').replace(/\.P$/i, '').toUpperCase();
    const symbol = clean.endsWith('USDT') ? clean : `${clean}USDT`;
    const interval = this.mapTimeframe(timeframe);
    const limit = Math.min(Math.max(range?.countBack || 300, 100), 500);

    const url = `https://fapi.bitunix.com/api/v1/futures/market/kline?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Bitunix HTTP Error: ${res.statusText}`);
      }
      const json = await res.json();
      if (json && json.code === 0 && Array.isArray(json.data)) {
        // Data Bitunix terurut secara descending (terbaru di indeks 0)
        // Vela membutuhkan array terurut secara ascending (terlama ke terbaru)
        const bars: OHLCV[] = json.data.map((item: any) => ({
          time: typeof item.time === 'string' ? parseInt(item.time, 10) : item.time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: item.baseVol ? parseFloat(item.baseVol) : (item.quoteVol ? parseFloat(item.quoteVol) : 0),
        }));

        bars.sort((a, b) => a.time - b.time);
        return bars;
      }
    } catch (err) {
      console.warn('BitunixProvider getBars gagal, coba fallback Binance Futures:', err);
      // Fallback ke Binance Futures jika koneksi direct bitunix terkendala
      try {
        const binanceUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const bRes = await fetch(binanceUrl);
        if (bRes.ok) {
          const bData = await bRes.json();
          return bData.map((d: any[]) => ({
            time: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          }));
        }
      } catch (fbErr) {
        console.error('Semua data feed futures gagal:', fbErr);
      }
    }

    return [];
  }

  /**
   * Mengembalikan metadata simbol untuk legend dan status Vela
   */
  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const clean = ticker.replace(/^bitunix:/i, '').replace(/\.P$/i, '').toUpperCase();
    const symbol = clean.endsWith('USDT') ? clean : `${clean}USDT`;

    return {
      tickerid: `BITUNIX:${symbol}`,
      name: symbol,
      ticker: symbol,
      description: `${clean} Perpetual Contract (Bitunix)`,
      type: 'crypto',
      session: '24x7',
      exchange: 'BITUNIX',
      listed_exchange: 'BITUNIX',
      timezone: 'Etc/UTC',
      minmov: 1,
      pricescale: symbol.includes('BTC') || symbol.includes('ETH') ? 100 : 10000,
      has_intraday: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W'],
      volume_precision: 3,
    };
  }

  /**
   * Katalog simbol Bitunix
   */
  async listSymbols(): Promise<SymbolDescriptor[]> {
    return [
      { symbol: 'BTCUSDT', ticker: 'BTCUSDT', description: 'Bitcoin / TetherUS Perp', type: 'crypto' },
      { symbol: 'ETHUSDT', ticker: 'ETHUSDT', description: 'Ethereum / TetherUS Perp', type: 'crypto' },
      { symbol: 'SOLUSDT', ticker: 'SOLUSDT', description: 'Solana / TetherUS Perp', type: 'crypto' },
      { symbol: 'BNBUSDT', ticker: 'BNBUSDT', description: 'BNB / TetherUS Perp', type: 'crypto' },
      { symbol: 'XRPUSDT', ticker: 'XRPUSDT', description: 'Ripple / TetherUS Perp', type: 'crypto' },
      { symbol: 'DOGEUSDT', ticker: 'DOGEUSDT', description: 'Dogecoin / TetherUS Perp', type: 'crypto' },
      { symbol: 'ADAUSDT', ticker: 'ADAUSDT', description: 'Cardano / TetherUS Perp', type: 'crypto' },
      { symbol: 'AVAXUSDT', ticker: 'AVAXUSDT', description: 'Avalanche / TetherUS Perp', type: 'crypto' },
      { symbol: 'SUIUSDT', ticker: 'SUIUSDT', description: 'Sui / TetherUS Perp', type: 'crypto' },
      { symbol: 'LINKUSDT', ticker: 'LINKUSDT', description: 'Chainlink / TetherUS Perp', type: 'crypto' },
    ];
  }

  /**
   * Live streaming update bar polling fallback
   */
  subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): () => void {
    const subKey = `${ticker}_${timeframe}_${Date.now()}`;
    const timer = setInterval(async () => {
      try {
        const bars = await this.getBars(ticker, timeframe, { from: 0, to: 0, countBack: 2 });
        if (bars.length > 0) {
          onBar(bars[bars.length - 1]);
        }
      } catch (err) {
        // Abaikan error polling berkala
      }
    }, 4000);

    this.activeSubscriptions.set(subKey, { timer, callback: onBar });

    return () => {
      clearInterval(timer);
      this.activeSubscriptions.delete(subKey);
    };
  }
}
