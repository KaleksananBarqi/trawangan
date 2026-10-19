/**
 * Utilitas untuk Serialisasi dan Deserialisasi Item Watchlist Sadar Bursa (Exchange-Aware)
 */

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
  return clean.replace(/[^a-z0-9_-]/g, '') || 'binance';
}

/**
 * Mengurai string watchlist mentah menjadi { providerId, symbol }
 * Mendukung kompatibilitas mundur untuk data warisan tanpa prefix bursa.
 */
export function parseWatchlistEntry(rawEntry: string): ParsedWatchlistEntry {
  if (!rawEntry || rawEntry.startsWith('#section:')) return { providerId: 'binance', symbol: '' };
  const trimmed = rawEntry.trim();

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const p = normalizeProviderId(parts[0]);
    const s = parts[1].trim().toUpperCase();
    return { providerId: p, symbol: s };
  }

  const upper = trimmed.toUpperCase();
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
  const cleanSym = symbol.trim().replace(/^[A-Za-z0-9_-]+:/, '').toUpperCase();
  const providerId = normalizeProviderId(
    rawProvider || (symbol.includes(':') ? symbol.split(':')[0] : 'binance')
  );
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

