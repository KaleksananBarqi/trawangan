/**
/**
 * Modul Pengelola Sesi Pasar (Market Session & Extended Hours Shading)
 * Mendukung pemisahan Regular Trading Hours (RTH) vs Extended Trading Hours (ETH),
 * token warna tematik WebGL2 Vela, serta kalkulasi zona shading pre/post-market.
 */

// Token warna tematik sesuai spesifikasi Vela WebGL2
export const SESSION_PRE = '#f97316';
export const SESSION_POST = '#0ea5e9';
export const SESSION_OFF = '#9ca3af';

export type MarketSession = 'regular' | 'extended';
export type SessionZone = [number, number];

export interface SessionZones {
  pre: SessionZone[];
  post: SessionZone[];
  extended: SessionZone[];
}

export interface SessionWindow {
  start: number; // Menit dari awal hari (0 - 1440)
  end: number;   // Menit dari awal hari (0 - 1440)
}

export interface SessionSpec {
  regular: SessionWindow;
  extended: SessionWindow;
  overnight: boolean;
  timezone: string;
}

export interface SessionRendererConfig {
  sessions: {
    premarketColor: string;
    postmarketColor: string;
    extendedColor: string;
  };
}

export interface MarketSessionState {
  session: MarketSession;
  sessionAvailable: boolean;
  currentSymbol?: string;
  currentProviderId?: string;
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/**
 * Membuat konfigurasi warna sesi WebGL2 untuk engine renderer Vela
 */
export function createSessionRendererConfig(options?: {
  preColor?: string;
  postColor?: string;
  extendedColor?: string;
}): SessionRendererConfig {
  return {
    sessions: {
      premarketColor: options?.preColor ?? SESSION_PRE,
      postmarketColor: options?.postColor ?? SESSION_POST,
      extendedColor: options?.extendedColor ?? SESSION_POST,
    },
  };
}

/**
 * Memeriksa apakah provider atau simbol tertentu mendukung sesi perdagangan (RTH/ETH)
 * Feed kripto continuous 24/7 (Binance, Indodax, Bitunix, Coinbase, dsb) mengembalikan false.
 */
export function isSessionSupported(symbol: string, providerId?: string): boolean {
  if (!symbol) return false;
  const prov = (providerId || '').toLowerCase();

  // Venue continuous kripto tidak memiliki jam bursa / session shading
  if (
    prov === 'binance' ||
    prov === 'indodax' ||
    prov === 'bitunix' ||
    prov === 'coinbase' ||
    prov === 'hyperliquid' ||
    prov === 'custom'
  ) {
    return false;
  }

  const clean = symbol.replace(/^(yahoo|binance|indodax|bitunix|coinbase|macro):/i, '').trim().toUpperCase();

  // Kripto pairs (USDT, BUSD, USDC, IDR, BTC, ETH) diabaikan secara aman
  if (
    clean.endsWith('USDT') ||
    clean.endsWith('USDC') ||
    clean.endsWith('BUSD') ||
    clean.endsWith('IDR') ||
    clean.includes('USDT.P') ||
    clean.includes('-USD')
  ) {
    return false;
  }

  // Yahoo Finance Equities & Indices (Saham US, ETF, dan Indeks global)
  if (prov === 'yahoo' || symbol.toLowerCase().startsWith('yahoo:')) {
    // Bursa Indonesia (.JK) hanya memiliki sesi reguler (tidak ada pre/post market retail)
    if (clean.endsWith('.JK') || clean === '^JKSE') {
      return true;
    }
    // Komoditas futures (=F) memiliki jam trading overnight
    if (clean.includes('=F')) {
      return true;
    }
    // US Equities & Indices (^GSPC, ^IXIC, AAPL, TSLA, SPY, QQQ, dll)
    return true;
  }

  return false;
}

/**
 * Mengambil spesifikasi sesi pasar berdasarkan simbol dan provider
 */
export function getSymbolSessionSpec(symbol: string, providerId?: string): SessionSpec | null {
  if (!isSessionSupported(symbol, providerId)) {
    return null;
  }

  const clean = symbol.replace(/^(yahoo|binance|indodax|bitunix|coinbase|macro):/i, '').trim().toUpperCase();

  // Bursa Efek Indonesia (.JK dan ^JKSE): 09:00 - 16:15 WIB
  if (clean.endsWith('.JK') || clean === '^JKSE') {
    return {
      regular: { start: 9 * 60, end: 16 * 60 + 15 },
      extended: { start: 9 * 60, end: 16 * 60 + 15 },
      overnight: false,
      timezone: 'Asia/Jakarta',
    };
  }

  // Kontrak berjangka komoditas COMEX/NYMEX (=F): Overnight
  if (clean.includes('=F')) {
    return {
      regular: { start: 9 * 60 + 30, end: 16 * 60 },
      extended: { start: 18 * 60, end: 17 * 60 },
      overnight: true,
      timezone: 'America/New_York',
    };
  }

  // Default US Equities & Indices:
  // Regular (RTH): 09:30 - 16:00 ET (570 s/d 960 menit)
  // Extended (ETH): 04:00 - 20:00 ET (240 s/d 1200 menit, pre 04:00-09:30, post 16:00-20:00)
  return {
    regular: { start: 9 * 60 + 30, end: 16 * 60 },
    extended: { start: 4 * 60, end: 20 * 60 },
    overnight: false,
    timezone: 'America/New_York',
  };
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getCivilFormatter(tz: string): Intl.DateTimeFormat | null {
  const cached = dtfCache.get(tz);
  if (cached) return cached;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    dtfCache.set(tz, dtf);
    return dtf;
  } catch {
    return null;
  }
}

function getCivilParts(dtf: Intl.DateTimeFormat, ms: number) {
  const parts = dtf.formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    weekday: get('weekday'),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

function mergeAbuttingBands(bands: SessionZone[]): SessionZone[] {
  const sorted = [...bands].sort((a, b) => a[0] - b[0]);
  const out: SessionZone[] = [];
  for (const [s, e] of sorted) {
    if (e <= s) continue;
    const last = out[out.length - 1];
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

/**
 * Menghitung pita zona sesi pasar (pre-market, post-market, extended)
 * untuk jendela waktu dari epoch ms 'from' hingga 'to'.
 */
export function expandSessionZones(spec: SessionSpec, from: number, to: number): SessionZones {
  const pre: SessionZone[] = [];
  const post: SessionZone[] = [];
  const extended: SessionZone[] = [];

  const dtf = getCivilFormatter(spec.timezone);
  if (!dtf || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return { pre, post, extended };
  }

  const seen = new Set<number>();
  for (let cursor = from - DAY_MS; cursor < to + DAY_MS; cursor += DAY_MS) {
    const civil = getCivilParts(dtf, cursor);
    const key = civil.year * 10000 + civil.month * 100 + civil.day;
    if (!Number.isFinite(key) || seen.has(key)) continue;
    seen.add(key);

    const sunday = civil.weekday === 'Sun';
    if (civil.weekday === 'Sat' || (sunday && !spec.overnight)) {
      continue;
    }

    const naive = Date.UTC(civil.year, civil.month - 1, civil.day);
    const noonGuess = naive + 720 * MINUTE_MS;
    const atNoon = getCivilParts(dtf, noonGuess);
    const offset = Date.UTC(atNoon.year, atNoon.month - 1, atNoon.day, atNoon.hour, atNoon.minute) - noonGuess;
    const at = (minutes: number) => naive + minutes * MINUTE_MS - offset;

    if (spec.overnight) {
      if (!sunday) {
        extended.push([at(0), at(spec.regular.start)]);
        if (spec.regular.end < spec.extended.end) {
          extended.push([at(spec.regular.end), at(spec.extended.end)]);
        }
      }
      if (civil.weekday !== 'Fri') {
        extended.push([at(spec.extended.start), at(1440)]);
      }
      continue;
    }

    // Pre-market: dari awal extended hingga awal regular
    if (spec.extended.start < spec.regular.start) {
      const start = at(spec.extended.start);
      const end = at(spec.regular.start);
      if (end > start && end > from && start < to) {
        pre.push([start, end]);
      }
    }
    // Post-market: dari akhir regular hingga akhir extended
    if (spec.regular.end < spec.extended.end) {
      const start = at(spec.regular.end);
      const end = at(spec.extended.end);
      if (end > start && end > from && start < to) {
        post.push([start, end]);
      }
    }
  }

  return {
    pre: mergeAbuttingBands(pre),
    post: mergeAbuttingBands(post),
    extended: mergeAbuttingBands(extended),
  };
}

/**
 * Service State Singleton untuk manajemen sesi pasar global
 */
class MarketSessionService {
  private session: MarketSession = 'regular';
  private sessionAvailable = false;
  private currentSymbol?: string;
  private currentProviderId?: string;
  private listeners = new Set<(state: MarketSessionState) => void>();

  public getSession(): MarketSession {
    return this.session;
  }

  public setSession(session: MarketSession): void {
    if (this.session === session) return;
    this.session = session;
    this.notify();
  }

  public toggleSession(): MarketSession {
    const next: MarketSession = this.session === 'regular' ? 'extended' : 'regular';
    this.setSession(next);
    return next;
  }

  public isSessionAvailable(): boolean {
    return this.sessionAvailable;
  }

  public setSessionAvailable(available: boolean): void {
    if (this.sessionAvailable === available) return;
    this.sessionAvailable = available;
    this.notify();
  }

  public updateContext(symbol: string, providerId?: string): void {
    this.currentSymbol = symbol;
    this.currentProviderId = providerId;
    const available = isSessionSupported(symbol, providerId);
    this.setSessionAvailable(available);
  }

  public getSnapshot(): MarketSessionState {
    return {
      session: this.session,
      sessionAvailable: this.sessionAvailable,
      currentSymbol: this.currentSymbol,
      currentProviderId: this.currentProviderId,
    };
  }

  public subscribe(fn: (state: MarketSessionState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  public reset(): void {
    this.session = 'regular';
    this.sessionAvailable = false;
    this.currentSymbol = undefined;
    this.currentProviderId = undefined;
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('[MarketSessionService] Listener error:', err);
      }
    }
  }
}

export const marketSessionService = new MarketSessionService();
