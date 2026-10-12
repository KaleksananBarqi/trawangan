/**
 * Indodax Spot Market Data Provider untuk Vela WebGL2 Engine
 * Mendukung pembacaan candle historis kline (history_v2) dan pasangan kripto IDR & USDT
 */

import { isMonthlyTimeframe } from '../utils/timeframeAdapter';
import type { OHLCV, SymbolDescriptor, SymbolInfo } from './bitunixProvider';

export class IndodaxProvider {
  private activeSubscriptions = new Map<string, { timer: any; callback: (b: OHLCV) => void }>();

  info() {
    return {
      name: 'indodax',
      displayName: 'Indodax',
      description: 'Indodax Spot (IDR & USDT pairs)',
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  /**
   * Menormalkan format simbol pair ke identifier Indodax (huruf kecil tanpa pemisah, misal: 'btcidr')
   */
  normalizePair(sym: string): string {
    if (!sym) return 'btcidr';
    let clean = sym.replace(/^indodax:/i, '').replace(/[\/\-_]/g, '').toLowerCase();
    // Jika tidak ada akhiran idr atau usdt, defaultkan ke idr
    if (!clean.endsWith('idr') && !clean.endsWith('usdt')) {
      clean = `${clean}idr`;
    }
    return clean;
  }

  /**
   * Mengonversi timeframe Vela / TradingView ke parameter tf Indodax (1, 5, 15, 30, 60, 240, 1D, 1W, 1M)
   */
  mapTimeframe(tf: string): string {
    if (isMonthlyTimeframe(tf)) {
      return '1M';
    }
    const clean = tf.toLowerCase();
    switch (clean) {
      case '1':
      case '1m':
        return '1';
      case '5':
      case '5m':
        return '5';
      case '15':
      case '15m':
        return '15';
      case '30':
      case '30m':
        return '30';
      case '60':
      case '1h':
      case 'h':
        return '60';
      case '240':
      case '4h':
        return '240';
      case '1d':
      case 'd':
        return '1D';
      case '1w':
      case 'w':
        return '1W';
      default:
        if (clean.endsWith('d')) return '1D';
        if (clean.endsWith('w')) return '1W';
        if (clean.endsWith('m') && parseInt(clean, 10) > 60) return '240';
        return '15';
    }
  }

  /**
   * Mengonversi payload mentah history_v2 Indodax ke format Vela OHLCV (waktu dalam milidetik, terurut menaik)
   */
  transformKlineData(rawData: any[]): OHLCV[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const bars: OHLCV[] = rawData.map((item: any) => {
      const rawTime = typeof item.Time === 'string' ? parseInt(item.Time, 10) : Number(item.Time);
      // Indodax mengembalikan epoch dalam detik; Vela membutuhkan milidetik
      const timeMs = rawTime < 1e11 ? rawTime * 1000 : rawTime;

      return {
        time: timeMs,
        open: parseFloat(item.Open),
        high: parseFloat(item.High),
        low: parseFloat(item.Low),
        close: parseFloat(item.Close),
        volume: item.Volume ? parseFloat(item.Volume) : 0,
      };
    });

    // Urutkan ascending (waktu terlama ke terbaru)
    bars.sort((a, b) => a.time - b.time);
    return bars;
  }

  /**
   * Mengambil candle historis dari Indodax Public TradingView API
   */
  async getBars(ticker: string, timeframe: string, range: any): Promise<OHLCV[]> {
    const pair = this.normalizePair(ticker);
    const tf = this.mapTimeframe(timeframe);

    const nowSec = Math.floor(Date.now() / 1000);
    const countBack = Math.min(Math.max(range?.countBack || 300, 100), 1000);

    // Hitung estimasi rentang waktu mundur berdasarkan timeframe
    let secondsPerBar = 900; // default 15m
    if (tf === '1') secondsPerBar = 60;
    else if (tf === '5') secondsPerBar = 300;
    else if (tf === '15') secondsPerBar = 900;
    else if (tf === '30') secondsPerBar = 1800;
    else if (tf === '60') secondsPerBar = 3600;
    else if (tf === '240') secondsPerBar = 14400;
    else if (tf === '1D') secondsPerBar = 86400;
    else if (tf === '1W') secondsPerBar = 604800;
    else if (tf === '1M') secondsPerBar = 2592000;

    const fromSec = range?.from && range.from > 0
      ? (range.from > 1e11 ? Math.floor(range.from / 1000) : range.from)
      : nowSec - countBack * secondsPerBar;

    const toSec = range?.to && range.to > 0
      ? (range.to > 1e11 ? Math.floor(range.to / 1000) : range.to)
      : nowSec;

    const url = `https://indodax.com/tradingview/history_v2?symbol=${pair}&tf=${tf}&from=${fromSec}&to=${toSec}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Indodax HTTP Error: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return this.transformKlineData(data);
      }
    } catch (err) {
      console.warn(`[IndodaxProvider] Gagal fetch kline ${pair}:`, err);
    }

    return [];
  }

  /**
   * Mengembalikan metadata simbol untuk legend dan skala Vela
   */
  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const pair = this.normalizePair(ticker).toUpperCase();
    const isIdr = pair.endsWith('IDR');
    const base = pair.replace(/IDR$/i, '').replace(/USDT$/i, '');

    return {
      tickerid: `INDODAX:${pair}`,
      name: pair,
      ticker: pair,
      description: `${base}/${isIdr ? 'IDR' : 'USDT'} (Indodax Spot)`,
      type: 'crypto',
      session: '24x7',
      exchange: 'INDODAX',
      listed_exchange: 'INDODAX',
      timezone: 'Asia/Jakarta',
      minmov: 1,
      // Untuk pasangan IDR bernilai besar (BTC/IDR), gunakan skala bilangan bulat; untuk mikro koin gunakan desimal
      pricescale: isIdr && (base === 'BTC' || base === 'ETH') ? 1 : 100,
      has_intraday: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
      volume_precision: 4,
    };
  }

  /**
   * Daftar katalog simbol utama Indodax
   */
  async listSymbols(): Promise<SymbolDescriptor[]> {
    return [
      { symbol: 'BTCIDR', ticker: 'BTCIDR', description: 'Bitcoin / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'ETHIDR', ticker: 'ETHIDR', description: 'Ethereum / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'USDTIDR', ticker: 'USDTIDR', description: 'Tether / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'SOLIDR', ticker: 'SOLIDR', description: 'Solana / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'DOGEIDR', ticker: 'DOGEIDR', description: 'Dogecoin / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'XRPIDR', ticker: 'XRPIDR', description: 'Ripple / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'ADAIDR', ticker: 'ADAIDR', description: 'Cardano / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'PEPEIDR', ticker: 'PEPEIDR', description: 'Pepe / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'SHIBIDR', ticker: 'SHIBIDR', description: 'Shiba Inu / Indonesian Rupiah', type: 'crypto' },
      { symbol: 'BNBIDR', ticker: 'BNBIDR', description: 'BNB / Indonesian Rupiah', type: 'crypto' },
    ];
  }

  /**
   * Polling berkala streaming update bar
   */
  subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): () => void {
    const subKey = `${ticker}_${timeframe}_${Date.now()}`;
    const timer = setInterval(async () => {
      try {
        const bars = await this.getBars(ticker, timeframe, { from: 0, to: 0, countBack: 2 });
        if (bars.length > 0) {
          onBar(bars[bars.length - 1]);
        }
      } catch (_) {
        // Polling silent error
      }
    }, 4000);

    this.activeSubscriptions.set(subKey, { timer, callback: onBar });

    return () => {
      clearInterval(timer);
      this.activeSubscriptions.delete(subKey);
    };
  }
}
