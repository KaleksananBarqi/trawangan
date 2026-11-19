import { universalFetch } from './httpClient';
import { STANDARD_MACRO_CALENDAR_EVENTS } from './macroCalendarCatalog';
import { storage } from './persistence';
import type { IPersistenceService } from './persistence/types';
import type { MacroCalendarEvent, MacroImpact } from './timelineMarksController';

export type MacroScopeFilter = 'us_crypto' | 'all' | 'major';
export type MacroCategoryFilter = 'all' | 'macro' | 'central_bank' | 'inflation' | 'employment';

export interface MacroEventsFilter {
  scope?: MacroScopeFilter;
  category?: MacroCategoryFilter;
}

export interface MacroScheduleGroup {
  key: string;
  label: string;
  kind: 'earlier' | 'today' | 'upcoming';
  defaultCollapsed: boolean;
  events: MacroCalendarEvent[];
}

export interface MacroEventsState {
  events: MacroCalendarEvent[];
  lastFetchedAt: number | null;
  isLoading: boolean;
  error: string | null;
}

interface PersistedMacroCache {
  fetchedAt: number;
  events: MacroCalendarEvent[];
}

export interface TimelineMacroSyncTarget {
  loadMacroEvents(events: MacroCalendarEvent[]): void;
}

export const FOREX_FACTORY_WEEKLY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
export const MACRO_EVENTS_CACHE_TTL_MS = 30 * 60 * 1000;

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  CHF: 'CH',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  CNY: 'CN',
  IDR: 'ID',
};

const IMPACT_RANK: Record<MacroImpact, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SHORT_TITLE_RULES: Array<[RegExp, string]> = [
  [/initial jobless claims/i, 'Claims'],
  [/non[- ]?farm payroll/i, 'NFP'],
  [/\bfomc\b/i, 'FOMC'],
  [/fed chair|powell/i, 'Powell'],
  [/\bcore cpi\b/i, 'Core CPI'],
  [/\bcpi\b/i, 'US CPI'],
  [/\bcore pce\b/i, 'Core PCE'],
  [/\bpce\b/i, 'PCE'],
  [/\bppi\b/i, 'PPI'],
  [/\bgdp\b/i, 'GDP'],
  [/retail sales/i, 'Retail Sales'],
  [/\becb\b/i, 'ECB Rate'],
  [/\bboe\b/i, 'BOE Rate'],
  [/\bboj\b/i, 'BOJ Rate'],
  [/unemployment rate/i, 'Unemployment'],
  [/ism manufacturing/i, 'ISM Mfg'],
  [/ism services/i, 'ISM Svc'],
];

function classifyCategory(title: string): string {
  const t = title.toLowerCase();
  if (/(fomc|fed|powell|ecb|boe|boj|rba|boc|snb|rbnz|rate decision|monetary policy|minutes|lagarde|bailey|ueda)/.test(t)) {
    return 'central_bank';
  }
  if (/(cpi|ppi|pce|inflation|price index|hicp)/.test(t)) {
    return 'inflation';
  }
  if (/(nfp|payroll|unemployment|jobless|employment|jolts|adp|hourly earnings)/.test(t)) {
    return 'employment';
  }
  return 'growth';
}

function normalizeImpact(rawImpact: unknown): MacroImpact | null {
  if (typeof rawImpact !== 'string') return null;
  const v = rawImpact.trim().toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  if (v === 'low') return 'low';
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/**
 * Mengonversi payload JSON kalender ekonomi ForexFactory ke format MacroCalendarEvent.
 * Hanya menyertakan event ekonomi berdampak (high/medium/low), tanpa artikel berita atau hari libur.
 */
export function parseForexFactoryEvents(rawItems: unknown): MacroCalendarEvent[] {
  if (!Array.isArray(rawItems)) return [];
  const results: MacroCalendarEvent[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const dateStr = typeof record.date === 'string' ? record.date.trim() : '';
    const impact = normalizeImpact(record.impact);
    if (!title || !dateStr || !impact) continue;

    const timestamp = Date.parse(dateStr);
    if (!Number.isFinite(timestamp)) continue;

    const currency = typeof record.country === 'string' ? record.country.trim().toUpperCase() : 'USD';
    const country = CURRENCY_TO_COUNTRY[currency] ?? currency;
    const forecast = typeof record.forecast === 'string' && record.forecast.trim() ? record.forecast.trim() : undefined;
    const previous = typeof record.previous === 'string' && record.previous.trim() ? record.previous.trim() : undefined;
    const actual = typeof record.actual === 'string' && record.actual.trim() ? record.actual.trim() : undefined;

    results.push({
      id: `ff_${currency.toLowerCase()}_${timestamp}_${slugify(title)}`,
      title,
      timestamp,
      impact,
      country,
      currency,
      forecast,
      previous,
      actual,
      category: classifyCategory(title),
    });
  }

  return results;
}

/**
 * Menggabungkan event live dengan katalog fallback offline tanpa duplikasi.
 * Data live diprioritaskan bila judul dan waktu rilisnya berdekatan (<= 1 jam).
 */
export function mergeMacroEvents(
  liveEvents: readonly MacroCalendarEvent[],
  fallbackEvents: readonly MacroCalendarEvent[] = STANDARD_MACRO_CALENDAR_EVENTS
): MacroCalendarEvent[] {
  const merged: MacroCalendarEvent[] = liveEvents.map((e) => ({ ...e }));

  for (const fb of fallbackEvents) {
    const fbNorm = fb.title.trim().toLowerCase();
    const exists = merged.some(
      (ev) =>
        ev.id === fb.id ||
        (ev.title.trim().toLowerCase() === fbNorm && Math.abs(ev.timestamp - fb.timestamp) <= 3_600_000)
    );
    if (!exists) {
      merged.push({ ...fb });
    }
  }

  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Memfilter daftar event berdasarkan scope pasar dan kategori makroekonomi.
 */
export function filterMacroEvents(
  events: readonly MacroCalendarEvent[],
  filter: MacroEventsFilter = {}
): MacroCalendarEvent[] {
  const scope = filter.scope ?? 'us_crypto';
  const category = filter.category ?? 'all';

  return events.filter((ev) => {
    if (scope === 'major' && ev.impact !== 'high') {
      return false;
    }
    if (scope === 'us_crypto') {
      const isUs = ev.country === 'US' || ev.currency === 'USD';
      const hasCrypto = Array.isArray(ev.relevantSymbols) && ev.relevantSymbols.length > 0;
      if (!isUs && !hasCrypto) return false;
    }

    if (category === 'all') return true;
    const evCat = (ev.category ?? 'macro').toLowerCase();
    if (category === 'macro') {
      return evCat === 'macro' || evCat === 'growth';
    }
    return evCat === category;
  });
}

/**
 * Mencari event masa depan terdekat untuk ditampilkan pada pill StatusBar.
 * Memprioritaskan event High/Medium impact jika tersedia.
 */
export function getNextUpcomingEvent(
  events: readonly MacroCalendarEvent[],
  nowMs: number = Date.now(),
  filter: MacroEventsFilter = { scope: 'us_crypto', category: 'all' }
): MacroCalendarEvent | null {
  const filtered = filterMacroEvents(events, filter).filter((e) => e.timestamp > nowMs);
  if (filtered.length === 0) return null;

  const highOrMedium = filtered.filter((e) => e.impact === 'high' || e.impact === 'medium');
  const pool = highOrMedium.length > 0 ? highOrMedium : filtered;

  return [...pool].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
  })[0];
}

/**
 * Memformat durasi hitung mundur rilis event (contoh: `5h 33m`, `25m`, `6d 5h`).
 */
export function formatEventCountdown(targetMs: number, nowMs: number = Date.now()): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 60_000) return '< 1m';

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Mempersingkat judul event untuk tampilan StatusBar yang ringkas.
 */
export function formatShortEventName(title: string): string {
  const clean = title.trim();
  for (const [pattern, shortName] of SHORT_TITLE_RULES) {
    if (pattern.test(clean)) return shortName;
  }
  const stripped = clean.replace(/^US\s+/i, '').replace(/\s*\([^)]*\)/g, '').trim();
  if (stripped.length <= 16) return stripped;
  return `${stripped.slice(0, 14).trimEnd()}…`;
}

function getDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayGroupLabel(ms: number, prefix?: string): string {
  const formatted = new Date(ms).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return prefix ? `${prefix} · ${formatted}` : formatted;
}

/**
 * Mengelompokkan event ke grup `Earlier this week`, `Today`, dan tanggal mendatang.
 */
export function groupEventsBySchedule(
  events: readonly MacroCalendarEvent[],
  nowMs: number = Date.now(),
  filter: MacroEventsFilter = {}
): MacroScheduleGroup[] {
  const filtered = filterMacroEvents(events, filter).sort((a, b) => a.timestamp - b.timestamp);
  const todayStart = getStartOfDayMs(nowMs);
  const tomorrowStart = todayStart + 86_400_000;
  const sevenDaysAgo = todayStart - 7 * 86_400_000;

  const earlier: MacroCalendarEvent[] = [];
  const today: MacroCalendarEvent[] = [];
  const upcomingMap = new Map<string, { label: string; events: MacroCalendarEvent[] }>();

  for (const ev of filtered) {
    if (ev.timestamp < todayStart) {
      if (ev.timestamp >= sevenDaysAgo) {
        earlier.push(ev);
      }
      continue;
    }
    if (ev.timestamp < tomorrowStart) {
      today.push(ev);
      continue;
    }

    const key = getDayKey(ev.timestamp);
    let bucket = upcomingMap.get(key);
    if (!bucket) {
      bucket = { label: formatDayGroupLabel(ev.timestamp), events: [] };
      upcomingMap.set(key, bucket);
    }
    bucket.events.push(ev);
  }

  const groups: MacroScheduleGroup[] = [];
  if (earlier.length > 0) {
    groups.push({
      key: 'earlier',
      label: 'Earlier this week',
      kind: 'earlier',
      defaultCollapsed: true,
      events: earlier,
    });
  }
  if (today.length > 0) {
    groups.push({
      key: 'today',
      label: formatDayGroupLabel(todayStart, 'Today'),
      kind: 'today',
      defaultCollapsed: false,
      events: today,
    });
  }
  for (const [key, bucket] of upcomingMap.entries()) {
    groups.push({
      key,
      label: bucket.label,
      kind: 'upcoming',
      defaultCollapsed: false,
      events: bucket.events,
    });
  }

  return groups;
}

export interface MacroEventsServiceDeps {
  persistence?: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'>;
  fetcher?: () => Promise<unknown>;
  now?: () => number;
}

async function defaultForexFactoryFetcher(): Promise<unknown> {
  const res = await universalFetch(FOREX_FACTORY_WEEKLY_URL, {
    method: 'GET',
    timeoutMs: 8000,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} saat mengambil kalender ekonomi`);
  }
  return res.json();
}

/**
 * Layanan kalender makroekonomi live dengan cache SQLite (`app_preferences`, TTL 30 menit)
 * dan sinkronisasi otomatis ke TimelineMarksController.
 */
export class MacroEventsService {
  private state: MacroEventsState = {
    events: mergeMacroEvents([], STANDARD_MACRO_CALENDAR_EVENTS),
    lastFetchedAt: null,
    isLoading: false,
    error: null,
  };
  private listeners = new Set<(state: MacroEventsState) => void>();
  private timelineTargets = new Set<TimelineMacroSyncTarget>();
  private inFlightRefresh: Promise<MacroCalendarEvent[]> | null = null;

  private persistence: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'>;
  private fetcher: () => Promise<unknown>;
  private now: () => number;

  constructor(deps: MacroEventsServiceDeps = {}) {
    this.persistence = deps.persistence ?? storage;
    this.fetcher = deps.fetcher ?? defaultForexFactoryFetcher;
    this.now = deps.now ?? (() => Date.now());
    this.hydrateFromCache();
  }

  private hydrateFromCache(): void {
    try {
      const cached = this.persistence.getUiPreferenceSync<PersistedMacroCache>('macro_events_cache');
      if (cached && Array.isArray(cached.events) && cached.events.length > 0) {
        this.state.events = mergeMacroEvents(cached.events, STANDARD_MACRO_CALENDAR_EVENTS);
        this.state.lastFetchedAt = typeof cached.fetchedAt === 'number' ? cached.fetchedAt : null;
      }
    } catch {
      // Abaikan error cache agar tetap fallback ke katalog bawaan
    }
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private syncTimelineTargets(): void {
    for (const target of this.timelineTargets) {
      target.loadMacroEvents(this.state.events);
    }
  }

  public getSnapshot(): MacroEventsState {
    return {
      ...this.state,
      events: [...this.state.events],
    };
  }

  public getEvents(): MacroCalendarEvent[] {
    return [...this.state.events];
  }

  public subscribe(listener: (state: MacroEventsState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public attachTimelineController(controller: TimelineMacroSyncTarget): () => void {
    this.timelineTargets.add(controller);
    controller.loadMacroEvents(this.state.events);
    return () => {
      this.timelineTargets.delete(controller);
    };
  }

  public async refresh(force = false): Promise<MacroCalendarEvent[]> {
    const currentNow = this.now();
    if (
      !force &&
      this.state.lastFetchedAt !== null &&
      currentNow - this.state.lastFetchedAt < MACRO_EVENTS_CACHE_TTL_MS
    ) {
      return this.getEvents();
    }

    if (this.inFlightRefresh) {
      return this.inFlightRefresh;
    }

    this.state.isLoading = true;
    this.state.error = null;
    this.notify();

    this.inFlightRefresh = (async () => {
      try {
        const raw = await this.fetcher();
        const liveEvents = parseForexFactoryEvents(raw);
        const merged = mergeMacroEvents(liveEvents, STANDARD_MACRO_CALENDAR_EVENTS);
        const fetchedAt = this.now();

        this.state.events = merged;
        this.state.lastFetchedAt = fetchedAt;
        this.state.error = null;

        void this.persistence
          .setUiPreference<PersistedMacroCache>('macro_events_cache', {
            fetchedAt,
            events: liveEvents,
          })
          .catch(() => {});

        this.syncTimelineTargets();
        return this.getEvents();
      } catch (err) {
        this.state.error = err instanceof Error ? err.message : String(err);
        return this.getEvents();
      } finally {
        this.state.isLoading = false;
        this.inFlightRefresh = null;
        this.notify();
      }
    })();

    return this.inFlightRefresh;
  }
}

export const macroEventsService = new MacroEventsService();
