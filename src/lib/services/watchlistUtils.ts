/**
 * Utilitas untuk Serialisasi dan Deserialisasi Item Watchlist Sadar Bursa (Exchange-Aware)
 */

import {
  canonicalizeMacroIndexSymbol,
  hasExplicitNonMacroProvider,
  isMacroProviderAlias,
} from './macroIndexCatalog';

export interface ParsedWatchlistEntry {
  providerId: string;
  symbol: string;
}

/**
 * Normalisasi id provider dari string sembarang (misal: 'Binance Official Public' -> 'binance')
 */
export function normalizeProviderId(rawProvider?: string): string {
  if (!rawProvider) return 'binance';
  const clean = rawProvider.trim().toLowerCase();
  if (clean.includes('indodax') || clean === 'indodax') return 'indodax';
  if (clean.includes('bitunix') || clean === 'bitunix') return 'bitunix';
  if (clean.includes('binance') || clean === 'binance') return 'binance';
  if (clean.includes('hyperliquid') || clean === 'hyperliquid') return 'hyperliquid';
  if (clean.includes('coinbase') || clean === 'coinbase') return 'coinbase';
  if (clean.includes('yahoo') || clean === 'yahoo') return 'yahoo';
  if (clean.includes('macro') || clean === 'macro') return 'macro';
  return clean.replace(/[^a-z0-9_-]/g, '') || 'binance';
}

/**
 * Mengurai string watchlist mentah menjadi { providerId, symbol }
 * Mendukung kompatibilitas mundur untuk data warisan tanpa prefix bursa.
 */
export function parseWatchlistEntry(rawEntry: string): ParsedWatchlistEntry {
  if (!rawEntry) return { providerId: 'binance', symbol: '' };
  const trimmed = rawEntry.trim();
  if (!trimmed || trimmed.startsWith('#section:')) return { providerId: 'binance', symbol: '' };

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const p = normalizeProviderId(parts[0]);
    const rawSym = parts.slice(1).join(':').trim().toUpperCase();
    if (isMacroProviderAlias(p)) {
      const macroSym = canonicalizeMacroIndexSymbol(rawSym);
      return { providerId: 'macro', symbol: macroSym || rawSym };
    }
    if (!hasExplicitNonMacroProvider(trimmed)) {
      const macroSym = canonicalizeMacroIndexSymbol(rawSym);
      if (macroSym) {
        return { providerId: 'macro', symbol: macroSym };
      }
    }
    return { providerId: p, symbol: rawSym };
  }

  const upper = trimmed.toUpperCase();
  const macroSym = canonicalizeMacroIndexSymbol(upper);
  if (macroSym) {
    return { providerId: 'macro', symbol: macroSym };
  }
  // Legacy Fallback
  if (upper.endsWith('IDR')) {
    return { providerId: 'indodax', symbol: upper };
  }
  return { providerId: 'binance', symbol: upper };
}

/**
 * Menghasilkan string terstandarisasi provider:symbol (misal: 'binance:BTCUSDT')
 */
export function formatWatchlistEntry(symbol: string, rawProvider?: string): string {
  if (!symbol || symbol.startsWith('#section:')) return '';
  const explicitNonMacro = hasExplicitNonMacroProvider(symbol, rawProvider);
  const rawHasColon = symbol.includes(':');
  const colonPrefix = rawHasColon ? normalizeProviderId(symbol.split(':')[0]) : '';
  const cleanSym = symbol.trim().replace(/^[A-Za-z0-9_-]+:/, '').toUpperCase();

  if (!explicitNonMacro && (!rawHasColon || isMacroProviderAlias(colonPrefix))) {
    const macroSym = canonicalizeMacroIndexSymbol(cleanSym);
    if (macroSym) {
      return `macro:${macroSym}`;
    }
  }

  const resolvedProviderRaw =
    rawHasColon && colonPrefix.startsWith('custom')
      ? colonPrefix
      : rawProvider || (rawHasColon ? symbol.split(':')[0] : 'binance');
  const providerId = normalizeProviderId(resolvedProviderRaw);
  return `${providerId}:${cleanSym}`;
}

// ─── Pembatas Kategori Watchlist (Section Dividers) ───

export interface WatchlistSectionToken {
  id: string;
  name: string;
  isCollapsed: boolean;
}

/**
 * Memeriksa apakah suatu item watchlist merupakan pembatas kategori/seksi
 */
export function isSectionToken(item: string): boolean {
  return typeof item === 'string' && item.startsWith('#section:');
}

/**
 * Memformat seksi menjadi token terstandarisasi: #section:<id>:<name>:<isCollapsed>
 */
export function formatSectionToken(name: string, id?: string, isCollapsed = false): string {
  const sectionId = id || `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanName = (name || 'KATEGORI').trim().replace(/[:#]/g, '') || 'KATEGORI';
  return `#section:${sectionId}:${cleanName}:${isCollapsed ? '1' : '0'}`;
}

/**
 * Mengurai token seksi menjadi objek WatchlistSectionToken
 */
export function parseSectionToken(token: string): WatchlistSectionToken | null {
  if (!isSectionToken(token)) return null;
  const parts = token.slice(9).split(':');
  if (parts.length < 2) return null;
  const id = parts[0];
  const name = parts[1];
  const isCollapsed = parts[2] === '1';
  return { id, name, isCollapsed };
}

/**
 * Menyisipkan simbol ke dalam kategori/seksi tertentu dalam daftar watchlist linier.
 * - Jika targetSectionId dispesifikasi: menyisipkan di akhir grup seksi tersebut (sebelum seksi berikutnya).
 * - Jika targetSectionId null: menyisipkan sebelum pembatas seksi pertama (grup tanpa kategori).
 * - Jika targetSectionId tidak didefinisikan: menyisipkan ke seksi terbuka terakhir atau akhir daftar.
 */
export function insertSymbolIntoSection(
  items: string[],
  newEntry: string,
  targetSectionId?: string | null
): string[] {
  const filtered = items.filter((s) => s !== newEntry);

  if (targetSectionId === null) {
    const firstSecIdx = filtered.findIndex(isSectionToken);
    if (firstSecIdx === -1) {
      return [newEntry, ...filtered];
    }
    const next = [...filtered];
    next.splice(firstSecIdx, 0, newEntry);
    return next;
  }

  if (targetSectionId) {
    const secIdx = filtered.findIndex((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        return parsed?.id === targetSectionId;
      }
      return false;
    });

    if (secIdx !== -1) {
      let insertIdx = filtered.length;
      for (let i = secIdx + 1; i < filtered.length; i++) {
        if (isSectionToken(filtered[i])) {
          insertIdx = i;
          break;
        }
      }
      const next = [...filtered];
      next.splice(insertIdx, 0, newEntry);
      return next;
    }
  }

  // Fallback default: cari seksi terbuka (tidak collapsed) terakhir
  let lastOpenSecIdx = -1;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (isSectionToken(filtered[i])) {
      const parsed = parseSectionToken(filtered[i]);
      if (parsed && !parsed.isCollapsed) {
        lastOpenSecIdx = i;
        break;
      }
    }
  }

  if (lastOpenSecIdx !== -1) {
    let insertIdx = filtered.length;
    for (let i = lastOpenSecIdx + 1; i < filtered.length; i++) {
      if (isSectionToken(filtered[i])) {
        insertIdx = i;
        break;
      }
    }
    const next = [...filtered];
    next.splice(insertIdx, 0, newEntry);
    return next;
  }

  // Jika belum ada kategori sama sekali, letakkan di paling atas daftar (US-10 & Tiket #75)
  const firstSecIdx = filtered.findIndex(isSectionToken);
  if (firstSecIdx === -1) {
    return [newEntry, ...filtered];
  }

  return [...filtered, newEntry];
}

/**
 * Memindahkan suatu item ke seksi/kategori tertentu (atau ke tanpa kategori).
 */
export function moveItemToSection(
  items: string[],
  itemToMove: string,
  targetSectionId: string | null
): string[] {
  if (!items.includes(itemToMove)) return items;
  return insertSymbolIntoSection(items, itemToMove, targetSectionId);
}

/**
 * Menata ulang urutan item (Drag & Drop Reordering) secara deterministik.
 */
export function reorderWatchlistItems(
  items: string[],
  sourceIndex: number,
  targetIndex: number,
  position: 'before' | 'after' = 'before'
): string[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return items;
  }

  const result = [...items];
  const [removed] = result.splice(sourceIndex, 1);

  let insertIdx = targetIndex;
  if (sourceIndex < targetIndex) {
    insertIdx = position === 'after' ? targetIndex : targetIndex - 1;
  } else {
    insertIdx = position === 'after' ? targetIndex + 1 : targetIndex;
  }

  insertIdx = Math.max(0, Math.min(insertIdx, result.length));
  result.splice(insertIdx, 0, removed);
  return result;
}

interface ResolvedWatchlistTarget {
  providerId: string;
  symbol: string;
  entry: string;
}

/**
 * Mengurai target (symbol, providerId) menjadi bentuk kanonik providerId:symbol.
 * Jika providerId diabaikan, menggunakan fallback parseWatchlistEntry (termasuk inferensi IDR -> indodax).
 */
function resolveWatchlistTarget(symbol: string, providerId?: string): ResolvedWatchlistTarget | null {
  if (!symbol || typeof symbol !== 'string') return null;
  const trimmed = symbol.trim();
  if (!trimmed || isSectionToken(trimmed)) return null;

  const hasExplicitProvider = typeof providerId === 'string' && providerId.trim().length > 0;
  let targetProvider: string;
  let cleanSymbol: string;

  if (hasExplicitProvider) {
    targetProvider = normalizeProviderId(providerId);
    cleanSymbol = trimmed.includes(':') ? parseWatchlistEntry(trimmed).symbol : trimmed.toUpperCase();
  } else {
    const parsed = parseWatchlistEntry(trimmed);
    targetProvider = parsed.providerId;
    cleanSymbol = parsed.symbol;
  }

  if (!cleanSymbol) return null;
  const entry = formatWatchlistEntry(cleanSymbol, targetProvider);
  if (!entry) return null;

  return {
    providerId: targetProvider,
    symbol: cleanSymbol,
    entry,
  };
}

/**
 * Memeriksa apakah sebuah entri watchlist cocok dengan target kanonik,
 * sambil mengabaikan baris kosong dan token pembatas kategori (#section:).
 */
function matchesWatchlistTarget(item: unknown, target: ResolvedWatchlistTarget): boolean {
  if (typeof item !== 'string') return false;
  const trimmedItem = item.trim();
  if (!trimmedItem || isSectionToken(trimmedItem)) return false;
  if (trimmedItem === target.entry) return true;

  const parsed = parseWatchlistEntry(trimmedItem);
  return parsed.symbol === target.symbol && parsed.providerId === target.providerId;
}

/**
 * Memeriksa apakah pasangan (symbol, providerId) sudah terdaftar dalam watchlist aktif.
 * Mendukung entri kanonik provider:symbol, format legacy tanpa prefix, serta mengabaikan token #section:.
 */
export function isSymbolInWatchlist(
  items: string[],
  symbol: string,
  providerId?: string
): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const target = resolveWatchlistTarget(symbol, providerId);
  if (!target) return false;

  return items.some((item) => matchesWatchlistTarget(item, target));
}

/**
 * Menghapus seluruh entri yang cocok dengan target (symbol, providerId) dari watchlist
 * (baik format kanonik maupun entri legacy tanpa prefix), sambil menjaga token #section:.
 * Jika providerId tidak disertakan, fallback ke parseWatchlistEntry (termasuk inferensi IDR -> indodax).
 */
export function removeSymbolFromWatchlist(
  items: string[],
  symbol: string,
  providerId?: string
): string[] {
  const currentItems = Array.isArray(items) ? items : [];
  const target = resolveWatchlistTarget(symbol, providerId);
  if (!target) {
    return [...currentItems];
  }

  return currentItems.filter((item) => !matchesWatchlistTarget(item, target));
}

export interface ToggleWatchlistResult {
  items: string[];
  added: boolean;
  entry: string;
}

/**
 * Menambahkan atau menghapus pasangan (symbol, providerId) dari daftar watchlist secara murni.
 * Saat ditambahkan, entri kanonik disisipkan di grup atas tanpa kategori melalui insertSymbolIntoSection(..., null).
 * Saat dihapus, seluruh kecocokan entri kanonik maupun legacy tanpa prefix dibersihkan tanpa menyentuh #section:.
 */
export function toggleSymbolInWatchlist(
  items: string[],
  symbol: string,
  providerId?: string
): ToggleWatchlistResult {
  const currentItems = Array.isArray(items) ? items : [];
  const target = resolveWatchlistTarget(symbol, providerId);
  if (!target) {
    return { items: [...currentItems], added: false, entry: '' };
  }

  if (currentItems.some((item) => matchesWatchlistTarget(item, target))) {
    return {
      items: currentItems.filter((item) => !matchesWatchlistTarget(item, target)),
      added: false,
      entry: target.entry,
    };
  }

  const next = insertSymbolIntoSection(currentItems, target.entry, null);
  return { items: next, added: true, entry: target.entry };
}

