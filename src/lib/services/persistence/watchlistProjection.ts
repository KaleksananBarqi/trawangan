// Helper murni proyeksi MultiWatchlistRegistry <-> daftar simbol non-#section:
import type { MultiWatchlistRegistry } from '../../types/market';

export function extractActiveWatchlistSymbols(registry: MultiWatchlistRegistry | null): string[] | null {
  if (!registry || !Array.isArray(registry.watchlists) || registry.watchlists.length === 0) {
    return null;
  }
  const active =
    registry.watchlists.find((w) => w.id === registry.activeWatchlistId) ||
    registry.watchlists[0];
  return active.items.filter((item) => !item.startsWith('#section:'));
}

export function buildUpdatedWatchlistRegistry(
  existing: MultiWatchlistRegistry | null,
  symbols: string[],
  now = Date.now()
): MultiWatchlistRegistry | null {
  if (!existing || !Array.isArray(existing.watchlists) || existing.watchlists.length === 0) {
    return {
      activeWatchlistId: 'default',
      watchlists: [
        {
          id: 'default',
          name: 'Daftar Utama',
          items: [...symbols],
          isPreset: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  let activeIdx = existing.watchlists.findIndex((w) => w.id === existing.activeWatchlistId);
  if (activeIdx === -1) activeIdx = 0;

  const currentActive = existing.watchlists[activeIdx];
  const currentSymbols = currentActive.items.filter((item) => !item.startsWith('#section:'));
  const sameSymbols =
    currentSymbols.length === symbols.length &&
    currentSymbols.every((sym, idx) => sym === symbols[idx]);

  // Pertahankan token #section: jika daftar simbol aktif identik
  if (sameSymbols) return null;

  const nextWatchlists = existing.watchlists.map((w, idx) =>
    idx === activeIdx ? { ...w, items: [...symbols], updatedAt: now } : w
  );
  return {
    activeWatchlistId: currentActive.id,
    watchlists: nextWatchlists,
  };
}
