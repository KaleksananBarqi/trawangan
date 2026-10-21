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
  timezone: string;
  marketName: string;
  marketHours: MarketHours;
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
    timezone: 'Asia/Tokyo',
    marketName: 'TSE',
    marketHours: {
      openHour: 9,
      openMinute: 0,
      closeHour: 15,
      closeMinute: 30,
    },
  },
  {
    id: 'london',
    label: 'London',
    shortCode: 'LON',
    timezone: 'Europe/London',
    marketName: 'LSE',
    marketHours: {
      openHour: 8,
      openMinute: 0,
      closeHour: 16,
      closeMinute: 30,
    },
  },
  {
    id: 'new_york',
    label: 'New York',
    shortCode: 'NY',
    timezone: 'America/New_York',
    marketName: 'NYSE',
    marketHours: {
      openHour: 9,
      openMinute: 30,
      closeHour: 16,
      closeMinute: 0,
    },
  },
];

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

    const openMinPad = String(cityMeta.marketHours.openMinute).padStart(2, '0');
    const closeMinPad = String(cityMeta.marketHours.closeMinute).padStart(2, '0');
    const openHPad = String(cityMeta.marketHours.openHour).padStart(2, '0');
    const closeHPad = String(cityMeta.marketHours.closeHour).padStart(2, '0');
    const marketHoursDesc = `${openHPad}:${openMinPad} - ${closeHPad}:${closeMinPad}`;

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
