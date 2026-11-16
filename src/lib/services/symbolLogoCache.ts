// Cache resolusi logo eksternal agar pemuatan ulang instan dan mencegah spam 404 berulang.
import type { AssetLogoClass } from './symbolLogoService';

const STORAGE_KEY = 'trawangan:logo-cache:v1';
const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 600;

interface CacheEntry {
  url?: string;
  failed?: boolean;
  ts: number;
}

const memoryCache = new Map<string, CacheEntry>();
let hydrated = false;

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  if (!hasStorage()) return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.ts !== 'number') continue;
      const ttl = entry.failed ? NEGATIVE_TTL_MS : POSITIVE_TTL_MS;
      if (now - entry.ts < ttl) {
        memoryCache.set(key, entry);
      }
    }
  } catch {
    // Abaikan data storage yang korup
  }
}

function persistCache(): void {
  if (!hasStorage()) return;
  try {
    if (memoryCache.size > MAX_CACHE_ENTRIES) {
      const oldest = Array.from(memoryCache.entries())
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(0, memoryCache.size - MAX_CACHE_ENTRIES);
      for (const [key] of oldest) {
        memoryCache.delete(key);
      }
    }
    const serialized = Object.fromEntries(memoryCache.entries());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Abaikan jika kuota storage penuh
  }
}

export function buildLogoCacheKey(assetClass: AssetLogoClass, symbolKey: string): string {
  return `${assetClass}:${symbolKey.trim().toUpperCase()}`;
}

export function getCachedLogoLookup(cacheKey: string): { hit: boolean; url: string | null; failed: boolean } {
  hydrateOnce();
  const entry = memoryCache.get(cacheKey);
  if (!entry) return { hit: false, url: null, failed: false };

  const ttl = entry.failed ? NEGATIVE_TTL_MS : POSITIVE_TTL_MS;
  if (Date.now() - entry.ts >= ttl) {
    memoryCache.delete(cacheKey);
    persistCache();
    return { hit: false, url: null, failed: false };
  }

  return {
    hit: true,
    url: entry.url ?? null,
    failed: Boolean(entry.failed),
  };
}

export function recordLogoSuccess(cacheKey: string, url: string): void {
  if (!cacheKey || !url) return;
  hydrateOnce();
  memoryCache.set(cacheKey, { url, ts: Date.now() });
  persistCache();
}

export function recordLogoFailure(cacheKey: string): void {
  if (!cacheKey) return;
  hydrateOnce();
  memoryCache.set(cacheKey, { failed: true, ts: Date.now() });
  persistCache();
}

export function clearLogoCache(): void {
  memoryCache.clear();
  hydrated = true;
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Abaikan error storage
    }
  }
}
