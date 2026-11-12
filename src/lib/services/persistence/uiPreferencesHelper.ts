// Helper persistensi preferensi UI (lebar panel, favorit indikator, dan riwayat pencarian simbol)
import { clampPanelWidth } from '../panelResizeHelper';
import { storage } from './index';
import type { IPersistenceService, UiPreferenceKey } from './types';

type WidthPreferenceKey = Extract<
  UiPreferenceKey,
  'pine_panel_width' | 'right_panel_width' | 'right_plan_width'
>;

const MAX_RECENT_SEARCHES = 5;

/**
 * Membaca lebar panel tersimpan dari cache PersistenceService dan melakukan clamping ke batas aman.
 */
export function readClampedPanelWidth(
  key: WidthPreferenceKey,
  minWidth: number,
  maxCap: number,
  persistence: Pick<IPersistenceService, 'getUiPreferenceSync'> = storage
): number | null {
  const raw = persistence.getUiPreferenceSync<number | string>(key);
  if (raw === null) return null;
  const parsed = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (Number.isNaN(parsed)) return null;
  return clampPanelWidth(parsed, minWidth, maxCap);
}

/**
 * Memuat daftar ID indikator favorit dari PersistenceService setelah bootstrap().
 */
export async function loadFavoriteIndicatorIds(
  persistence: Pick<IPersistenceService, 'bootstrap' | 'getUiPreferenceSync'> = storage
): Promise<string[]> {
  await persistence.bootstrap();
  const saved = persistence.getUiPreferenceSync<unknown>('fav_indicators');
  if (!Array.isArray(saved)) return [];
  return saved.filter((id): id is string => typeof id === 'string');
}

/**
 * Menambah atau menghapus ID indikator dari daftar favorit lalu menyimpannya ke PersistenceService.
 */
export async function toggleFavoriteIndicatorId(
  id: string,
  currentIds: string[],
  persistence: Pick<IPersistenceService, 'setUiPreference'> = storage
): Promise<string[]> {
  const nextIds = currentIds.includes(id)
    ? currentIds.filter((item) => item !== id)
    : [...currentIds, id];
  await persistence.setUiPreference('fav_indicators', nextIds);
  return nextIds;
}

/**
 * Memuat riwayat pencarian simbol terbaru (maksimal 5 entri) dari PersistenceService setelah bootstrap().
 */
export async function loadRecentSymbolSearches(
  persistence: Pick<IPersistenceService, 'bootstrap' | 'getUiPreferenceSync'> = storage
): Promise<string[]> {
  await persistence.bootstrap();
  const stored = persistence.getUiPreferenceSync<unknown>('recent_searches');
  if (!Array.isArray(stored)) return [];
  return stored.filter((sym): sym is string => typeof sym === 'string').slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Mencatat simbol yang baru dipilih ke posisi teratas riwayat pencarian (maksimal 5 entri, deduplikasi uppercase).
 */
export async function recordRecentSymbolSearch(
  symbol: string,
  currentRecent: string[],
  persistence: Pick<IPersistenceService, 'setUiPreference'> = storage
): Promise<string[]> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return currentRecent;
  const filtered = currentRecent.filter((s) => s.toUpperCase() !== clean);
  const next = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  await persistence.setUiPreference('recent_searches', next);
  return next;
}

/**
 * Menghapus seluruh riwayat pencarian simbol dari PersistenceService.
 */
export async function clearRecentSymbolSearches(
  persistence: Pick<IPersistenceService, 'removeUiPreference'> = storage
): Promise<string[]> {
  await persistence.removeUiPreference('recent_searches');
  return [];
}
