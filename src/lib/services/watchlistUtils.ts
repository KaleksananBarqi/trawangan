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
  if (!rawEntry) return { providerId: 'binance', symbol: '' };
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
  if (!symbol) return '';
  const cleanSym = symbol.trim().replace(/^[A-Za-z0-9_-]+:/, '').toUpperCase();
  const providerId = normalizeProviderId(
    rawProvider || (symbol.includes(':') ? symbol.split(':')[0] : 'binance')
  );
  return `${providerId}:${cleanSym}`;
}
