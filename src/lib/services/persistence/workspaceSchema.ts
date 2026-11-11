import type {
  CellSnapshot,
  PaneLayoutEntry,
  SavedWorkspace,
  SavedWorkspaceIndicator,
} from '../../types/market';

export const WORKSPACE_SCHEMA_VERSION = 2;

export interface PaneSignatureSource {
  id?: string;
  kind?: 'price' | 'study' | string;
  indicators?: Array<{ title?: string; shorttitle?: string }>;
}

/**
 * Menghasilkan identitas deterministik untuk satu pane di chart (stabil meski urutan pane bergeser).
 * Pane utama harga selalu menggunakan signature `'price'`.
 */
export function computePaneSignature(pane: PaneSignatureSource): string {
  if (!pane) return 'study:empty';
  if (pane.kind === 'price' || pane.id === 'price') {
    return 'price';
  }
  const titles = (pane.indicators || [])
    .map((ind) => (ind?.title || ind?.shorttitle || '').trim())
    .filter((t) => t.length > 0)
    .sort((a, b) => a.localeCompare(b));

  if (titles.length === 0) {
    return 'study:empty';
  }
  return titles.join('|');
}

function buildFallbackPaneLayoutFromWeights(
  paneWeights: number[] | undefined,
  indicators: SavedWorkspaceIndicator[] | undefined
): PaneLayoutEntry[] | undefined {
  if (!Array.isArray(paneWeights) || paneWeights.length === 0) {
    return undefined;
  }

  // Ambil daftar judul indikator non-overlay yang kemungkinan membentuk sub-pane berurutan
  const nonOverlayTitles = (indicators || [])
    .filter((ind) => {
      const src = ind?.source || '';
      return !src.includes('overlay=true') && !src.includes('overlay = true');
    })
    .map((ind) => (ind?.title || '').trim())
    .filter(Boolean);

  return paneWeights
    .filter((w) => typeof w === 'number' && Number.isFinite(w) && w > 0)
    .map((weight, idx) => {
      if (idx === 0) {
        return { signature: 'price', weight };
      }
      const matchedTitle = nonOverlayTitles[idx - 1];
      return {
        signature: matchedTitle || `study:${idx}`,
        weight,
      };
    });
}

/**
 * Menormalkan dokumen SavedWorkspace dari versi lama (v1) ke skema v2 secara idempoten.
 * Mempertahankan field ekstra yang belum dikenal agar tetap aman untuk forward-compatibility.
 */
export function normalizeWorkspace(raw: any): SavedWorkspace {
  const base: Record<string, any> = raw && typeof raw === 'object' ? { ...raw } : {};

  const symbol = typeof base.symbol === 'string' && base.symbol.trim() ? base.symbol.trim() : 'BTCUSDT';
  const timeframe = typeof base.timeframe === 'string' && base.timeframe.trim() ? base.timeframe.trim() : '15m';
  const layout = typeof base.layout === 'string' && base.layout.trim() ? base.layout.trim() : '1';
  const providerId = typeof base.providerId === 'string' && base.providerId.trim() ? base.providerId.trim() : 'binance';
  const indicators: SavedWorkspaceIndicator[] = Array.isArray(base.indicators) ? base.indicators : [];

  const paneLayout: PaneLayoutEntry[] | undefined =
    Array.isArray(base.paneLayout) && base.paneLayout.length > 0
      ? base.paneLayout
      : buildFallbackPaneLayoutFromWeights(base.paneWeights, indicators);

  const primaryCell: CellSnapshot = {
    symbol,
    timeframe,
    providerId,
    ...(base.priceStyle ? { priceStyle: base.priceStyle } : {}),
    ...(typeof base.barSpacing === 'number' ? { barSpacing: base.barSpacing } : {}),
    ...(base.priceScaleState !== undefined ? { priceScaleState: base.priceScaleState } : {}),
    ...(paneLayout ? { paneLayout } : {}),
    ...(Array.isArray(base.nativeIndicators) ? { nativeIndicators: base.nativeIndicators } : {}),
    ...(base.visibleRange !== undefined ? { visibleRange: base.visibleRange } : {}),
  };

  let cells: CellSnapshot[];
  if (Array.isArray(base.cells) && base.cells.length > 0) {
    cells = base.cells.map((c: any, idx: number) => ({
      ...(idx === 0 ? primaryCell : {}),
      ...(c && typeof c === 'object' ? c : {}),
      symbol: c?.symbol || symbol,
      timeframe: c?.timeframe || timeframe,
      providerId: c?.providerId || providerId,
    }));
  } else {
    cells = [primaryCell];
  }

  return {
    ...base,
    id: typeof base.id === 'string' ? base.id : String(base.id || ''),
    name: typeof base.name === 'string' && base.name.trim() ? base.name : 'Workspace',
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    symbol,
    timeframe,
    layout,
    providerId,
    indicators,
    ...(paneLayout ? { paneLayout } : {}),
    cells,
    timestamp: typeof base.timestamp === 'number' ? base.timestamp : Date.now(),
  } as SavedWorkspace;
}
