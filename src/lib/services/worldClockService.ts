/**
 * World Clock & Market Session Service
 * Menyediakan kalkulasi waktu bursa dunia, penentuan status sesi pasar (TSE, LSE, NYSE),
 * serta sinkronisasi zona waktu antar-komponen terminal Trawangan.
 */

export interface MarketHours {
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
}

export interface SupportedWorldCity {
  id: string;
  label: string;
  shortCode: string;
  pillCode: string;
  timezone: string;
  marketName: string;
  marketHours: MarketHours;
  accentColor: string;
  optional?: boolean;
}

export interface TimelineSegment24h {
  startPct: number;
  endPct: number;
}

export interface MarketSessionItem {
  id: string;
  label: string;
  shortCode: string;
  pillCode: string;
  timezone: string;
  marketName: string;
  accentColor: string;
  isOpen: boolean;
  statusText: 'OPEN' | 'CLOSED';
  minutesUntilNextTransition: number;
  countdownText: string;
  sessionProgressRatio: number;
  timelineSegments24h: TimelineSegment24h[];
  referenceHoursText: string;
  localTimeText: string;
}

export interface MarketSessionsSummary {
  sessions: MarketSessionItem[];
  nowCursorPct: number;
  referenceTz: string;
  featuredSession: MarketSessionItem | null;
  featuredPillText: string;
}

export interface WorldClockItem {
  id: string;
  label: string;
  shortCode: string;
  timezone: string;
  marketName: string;
  time: string; // HH:mm
  fullTime: string; // HH:mm:ss
  dateStr: string; // e.g. "Rab, 21 Okt 2026"
  isOpen: boolean;
  marketStatusText: 'OPEN' | 'CLOSED';
  marketHoursDesc: string;
}

export const DEFAULT_WORLD_CLOCK_CITIES: string[] = [
  'Asia/Tokyo',
  'Europe/London',
  'America/New_York',
];

export const SUPPORTED_WORLD_CITIES: SupportedWorldCity[] = [
  {
    id: 'tokyo',
    label: 'Tokyo',
    shortCode: 'TYO',
    pillCode: 'TYO',
    timezone: 'Asia/Tokyo',
    marketName: 'TSE',
    marketHours: {
      openHour: 9,
      openMinute: 0,
      closeHour: 15,
      closeMinute: 30,
    },
    accentColor: '#f97316',
  },
  {
    id: 'london',
    label: 'London',
    shortCode: 'LON',
    pillCode: 'LDN',
    timezone: 'Europe/London',
    marketName: 'LSE',
    marketHours: {
      openHour: 8,
      openMinute: 0,
      closeHour: 16,
      closeMinute: 30,
    },
    accentColor: '#3b82f6',
  },
  {
    id: 'new_york',
    label: 'New York',
    shortCode: 'NY',
    pillCode: 'NY',
    timezone: 'America/New_York',
    marketName: 'NYSE',
    marketHours: {
      openHour: 9,
      openMinute: 30,
      closeHour: 16,
      closeMinute: 0,
    },
    accentColor: '#10b981',
  },
  {
    id: 'jakarta',
    label: 'Jakarta',
    shortCode: 'JKT',
    pillCode: 'JKT',
    timezone: 'Asia/Jakarta',
    marketName: 'IDX',
    marketHours: {
      openHour: 9,
      openMinute: 0,
      closeHour: 16,
      closeMinute: 15,
    },
    accentColor: '#ec4899',
    optional: true,
  },
  {
    id: 'sydney',
    label: 'Sydney',
    shortCode: 'SYD',
    pillCode: 'SYD',
    timezone: 'Australia/Sydney',
    marketName: 'ASX',
    marketHours: {
      openHour: 10,
      openMinute: 0,
      closeHour: 16,
      closeMinute: 0,
    },
    accentColor: '#8b5cf6',
    optional: true,
  },
];

const SESSION_DISPLAY_ORDER = ['new_york', 'london', 'tokyo', 'jakarta', 'sydney'];
const WEEKDAY_INDEX_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Memeriksa apakah bursa aktif (Open) pada waktu lokal bursa tersebut.
 * Sabtu dan Minggu selalu Closed.
 */
export function isMarketSessionOpen(
  date: Date,
  timezone: string,
  hours: MarketHours
): boolean {
  try {
    // Ekstrak hari dalam seminggu, jam, dan menit di zona waktu bursa
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    let weekday = '';
    let hour = 0;
    let minute = 0;

    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value;
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }

    // Akhir pekan (Sabtu / Minggu) tutup
    if (weekday === 'Sat' || weekday === 'Sun') {
      return false;
    }

    const currentMinutes = hour * 60 + minute;
    const openMinutes = hours.openHour * 60 + hours.openMinute;
    const closeMinutes = hours.closeHour * 60 + hours.closeMinute;

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return false;
  }
}

/**
 * Format rentang jam operasional bursa (HH:mm - HH:mm)
 */
export function formatMarketHours(hours: MarketHours): string {
  const openHPad = String(hours.openHour).padStart(2, '0');
  const openMinPad = String(hours.openMinute).padStart(2, '0');
  const closeHPad = String(hours.closeHour).padStart(2, '0');
  const closeMinPad = String(hours.closeMinute).padStart(2, '0');
  return `${openHPad}:${openMinPad} - ${closeHPad}:${closeMinPad}`;
}

/**
 * Format waktu lokal perangkat pengguna secara konsisten dengan separator titik dua standar (HH:mm:ss)
 * dan deteksi singkatan zona waktu dinamis sistem.
 */
export function formatLocalClockTime(
  date: Date = new Date(),
  timezone?: string
): { time: string; tzLabel: string } {
  try {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    if (timezone) timeOptions.timeZone = timezone;

    const time = new Intl.DateTimeFormat('en-GB', timeOptions).format(date);

    const tzOptions: Intl.DateTimeFormatOptions = { timeZoneName: 'short' };
    if (timezone) tzOptions.timeZone = timezone;

    const parts = new Intl.DateTimeFormat('id-ID', tzOptions).formatToParts(date);
    const tzLabel = parts.find((p) => p.type === 'timeZoneName')?.value || 'LOKAL';

    return { time, tzLabel };
  } catch {
    const fallbackTime = date.toTimeString().split(' ')[0] || '--:--:--';
    return { time: fallbackTime, tzLabel: 'LOKAL' };
  }
}

/**
 * Format waktu dan tanggal untuk suatu zona waktu
 */
export function formatWorldClockTime(
  date: Date,
  timezone: string
): { time: string; fullTime: string; dateStr: string } {
  try {
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);

    const [hh, mm, ss] = timeParts.split(':');
    const time = `${hh}:${mm}`;
    const fullTime = `${hh}:${mm}:${ss}`;

    const dateStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);

    return { time, fullTime, dateStr };
  } catch {
    return { time: '--:--', fullTime: '--:--:--', dateStr: '' };
  }
}

/**
 * Menghasilkan snapshot instan seluruh jam dunia yang aktif
 */
export function getWorldClockSnapshot(
  date: Date = new Date(),
  activeTimezones: string[] = DEFAULT_WORLD_CLOCK_CITIES
): WorldClockItem[] {
  const result: WorldClockItem[] = [];

  for (const tz of activeTimezones) {
    const cityMeta = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === tz);
    if (!cityMeta) continue;

    const { time, fullTime, dateStr } = formatWorldClockTime(date, tz);
    const isOpen = isMarketSessionOpen(date, tz, cityMeta.marketHours);
    const marketHoursDesc = formatMarketHours(cityMeta.marketHours);

    result.push({
      id: cityMeta.id,
      label: cityMeta.label,
      shortCode: cityMeta.shortCode,
      timezone: cityMeta.timezone,
      marketName: cityMeta.marketName,
      time,
      fullTime,
      dateStr,
      isOpen,
      marketStatusText: isOpen ? 'OPEN' : 'CLOSED',
      marketHoursDesc,
    });
  }

  return result;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const out: ZonedParts = {
    year: 1970,
    month: 1,
    day: 1,
    weekdayIndex: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };

  for (const part of parts) {
    if (part.type === 'year') out.year = parseInt(part.value, 10);
    else if (part.type === 'month') out.month = parseInt(part.value, 10);
    else if (part.type === 'day') out.day = parseInt(part.value, 10);
    else if (part.type === 'weekday') out.weekdayIndex = WEEKDAY_INDEX_MAP[part.value] ?? 0;
    else if (part.type === 'hour') out.hour = parseInt(part.value, 10) % 24;
    else if (part.type === 'minute') out.minute = parseInt(part.value, 10);
    else if (part.type === 'second') out.second = parseInt(part.value, 10);
  }

  return out;
}

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const p = getZonedParts(date, timezone);
  const zonedUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const actualSecMs = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((zonedUtcMs - actualSecMs) / 60000);
}

function formatMinutesAsHHmm(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Format durasi menit menjadi string ringkas seperti "5m", "4h 12m", atau "1d 14h"
 */
export function formatDurationCompact(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const mins = safeMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

function evaluateSessionTiming(
  date: Date,
  timezone: string,
  hours: MarketHours
): {
  isOpen: boolean;
  minutesUntilNextTransition: number;
  sessionProgressRatio: number;
} {
  const parts = getZonedParts(date, timezone);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const openMinutes = hours.openHour * 60 + hours.openMinute;
  const closeMinutes = hours.closeHour * 60 + hours.closeMinute;
  const isWeekend = parts.weekdayIndex === 0 || parts.weekdayIndex === 6;

  if (!isWeekend && currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    const remaining = closeMinutes - currentMinutes;
    const duration = Math.max(1, closeMinutes - openMinutes);
    return {
      isOpen: true,
      minutesUntilNextTransition: remaining,
      sessionProgressRatio: Math.min(1, Math.max(0, (currentMinutes - openMinutes) / duration)),
    };
  }

  let minutesUntilOpen: number;
  if (!isWeekend && currentMinutes < openMinutes) {
    minutesUntilOpen = openMinutes - currentMinutes;
  } else {
    // Hitung jumlah hari menuju hari kerja berikutnya (Senin bila Jumat/Sabtu/Minggu)
    let daysToNextWeekday = 1;
    if (parts.weekdayIndex === 5) daysToNextWeekday = 3;
    else if (parts.weekdayIndex === 6) daysToNextWeekday = 2;
    else if (parts.weekdayIndex === 0) daysToNextWeekday = 1;

    minutesUntilOpen = daysToNextWeekday * 1440 - currentMinutes + openMinutes;
  }

  const approachRatio =
    minutesUntilOpen <= 60 ? Math.min(1, Math.max(0, (60 - minutesUntilOpen) / 60)) : 0;

  return {
    isOpen: false,
    minutesUntilNextTransition: minutesUntilOpen,
    sessionProgressRatio: approachRatio,
  };
}

function computeTimelineSegments24h(
  date: Date,
  sessionTz: string,
  hours: MarketHours,
  referenceTz: string
): { segments: TimelineSegment24h[]; referenceHoursText: string } {
  const sessionOffset = getTimezoneOffsetMinutes(date, sessionTz);
  const refOffset = getTimezoneOffsetMinutes(date, referenceTz);
  const delta = refOffset - sessionOffset;

  const openRef = (((hours.openHour * 60 + hours.openMinute + delta) % 1440) + 1440) % 1440;
  const closeRef = (((hours.closeHour * 60 + hours.closeMinute + delta) % 1440) + 1440) % 1440;
  const referenceHoursText = `${formatMinutesAsHHmm(openRef)} - ${formatMinutesAsHHmm(closeRef)}`;

  if (openRef < closeRef) {
    return {
      segments: [{ startPct: (openRef / 1440) * 100, endPct: (closeRef / 1440) * 100 }],
      referenceHoursText,
    };
  }

  // Tangani segmen yang melewati tengah malam (wrap-around 00:00)
  const segments: TimelineSegment24h[] = [];
  if (closeRef > 0) {
    segments.push({ startPct: 0, endPct: (closeRef / 1440) * 100 });
  }
  if (openRef < 1440) {
    segments.push({ startPct: (openRef / 1440) * 100, endPct: 100 });
  }

  return { segments, referenceHoursText };
}

/**
 * Menghasilkan ringkasan sesi pasar lengkap untuk pill StatusBar, kartu timeline 24 jam,
 * dan popover detail MARKET SESSIONS.
 */
export function getMarketSessionsSummary(
  now: Date = new Date(),
  referenceTz: string = 'UTC',
  activeTimezones: string[] = DEFAULT_WORLD_CLOCK_CITIES
): MarketSessionsSummary {
  const safeRefTz = referenceTz || 'UTC';
  const refParts = getZonedParts(now, safeRefTz);
  const nowCursorPct = ((refParts.hour * 60 + refParts.minute) / 1440) * 100;

  const activeSet = new Set(activeTimezones.length > 0 ? activeTimezones : DEFAULT_WORLD_CLOCK_CITIES);
  const orderedCities = SUPPORTED_WORLD_CITIES.filter((c) => activeSet.has(c.timezone)).sort(
    (a, b) => SESSION_DISPLAY_ORDER.indexOf(a.id) - SESSION_DISPLAY_ORDER.indexOf(b.id)
  );

  const sessions: MarketSessionItem[] = orderedCities.map((city) => {
    const timing = evaluateSessionTiming(now, city.timezone, city.marketHours);
    const { segments, referenceHoursText } = computeTimelineSegments24h(
      now,
      city.timezone,
      city.marketHours,
      safeRefTz
    );
    const { time } = formatWorldClockTime(now, city.timezone);
    const durationStr = formatDurationCompact(timing.minutesUntilNextTransition);

    return {
      id: city.id,
      label: city.label,
      shortCode: city.shortCode,
      pillCode: city.pillCode,
      timezone: city.timezone,
      marketName: city.marketName,
      accentColor: city.accentColor,
      isOpen: timing.isOpen,
      statusText: timing.isOpen ? 'OPEN' : 'CLOSED',
      minutesUntilNextTransition: timing.minutesUntilNextTransition,
      countdownText: timing.isOpen ? `Closes in ${durationStr}` : `Opens in ${durationStr}`,
      sessionProgressRatio: timing.sessionProgressRatio,
      timelineSegments24h: segments,
      referenceHoursText,
      localTimeText: time,
    };
  });

  // Prioritas featured pill:
  // 1) Sesi yang akan buka <= 60 menit; 2) Sesi yang sedang OPEN; 3) Sesi terdekat berikutnya
  const openingSoon = sessions
    .filter((s) => !s.isOpen && s.minutesUntilNextTransition <= 60)
    .sort((a, b) => a.minutesUntilNextTransition - b.minutesUntilNextTransition);

  const openSessions = sessions
    .filter((s) => s.isOpen)
    .sort((a, b) => a.minutesUntilNextTransition - b.minutesUntilNextTransition);

  const nextOpening = sessions
    .filter((s) => !s.isOpen)
    .sort((a, b) => a.minutesUntilNextTransition - b.minutesUntilNextTransition);

  let featuredSession: MarketSessionItem | null = null;
  let featuredPillText = 'Market Sessions';

  if (openingSoon.length > 0) {
    featuredSession = openingSoon[0];
    featuredPillText = `${featuredSession.pillCode} opens ${formatDurationCompact(featuredSession.minutesUntilNextTransition)}`;
  } else if (openSessions.length > 0) {
    featuredSession = openSessions[0];
    featuredPillText = `${featuredSession.pillCode} closes ${formatDurationCompact(featuredSession.minutesUntilNextTransition)}`;
  } else if (nextOpening.length > 0) {
    featuredSession = nextOpening[0];
    featuredPillText = `${featuredSession.pillCode} opens ${formatDurationCompact(featuredSession.minutesUntilNextTransition)}`;
  }

  return {
    sessions,
    nowCursorPct,
    referenceTz: safeRefTz,
    featuredSession,
    featuredPillText,
  };
}
