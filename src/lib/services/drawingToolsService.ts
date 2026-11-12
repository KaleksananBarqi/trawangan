import type { DrawingToolType } from '../types/market.js';
import { storage } from './persistence';
import type { IPersistenceService } from './persistence/types';

export type DrawingToolId = DrawingToolType;

export type DrawingGroupId =
  | 'lines'
  | 'channels_pitchforks'
  | 'fib_gann'
  | 'waves_harmonics'
  | 'shapes_brushes'
  | 'measure_volume'
  | 'annotations';

export interface DrawingToolItem {
  id: DrawingToolId;
  label: string;
  category: DrawingGroupId;
  shortcut?: string;
  description?: string;
  tags?: string[];
}

export interface DrawingToolGroup {
  id: DrawingGroupId;
  label: string;
  defaultTool: DrawingToolId;
  tools: DrawingToolItem[];
}

export const DRAWING_TOOL_GROUPS: DrawingToolGroup[] = [
  {
    id: 'lines',
    label: 'Garis & Ray',
    defaultTool: 'trendline',
    tools: [
      { id: 'trendline', label: 'Trend Line', category: 'lines', shortcut: 'Alt + T', tags: ['garis', 'tren', 'support', 'resistance'] },
      { id: 'ray', label: 'Ray', category: 'lines', tags: ['sinar', 'proyeksi'] },
      { id: 'infoline', label: 'Info Line', category: 'lines', tags: ['garis', 'informasi', 'sudut'] },
      { id: 'extendedline', label: 'Extended Line', category: 'lines', tags: ['garis', 'tak terhingga', 'panjang'] },
      { id: 'trendangle', label: 'Trend Angle', category: 'lines', tags: ['derajat', 'sudut'] },
      { id: 'hline', label: 'Horizontal Line', category: 'lines', shortcut: 'Alt + H', tags: ['horizontal', 'level', 'snr'] },
      { id: 'hray', label: 'Horizontal Ray', category: 'lines', shortcut: 'Alt + J', tags: ['horizontal', 'level'] },
      { id: 'vline', label: 'Vertical Line', category: 'lines', shortcut: 'Alt + V', tags: ['vertikal', 'waktu', 'tanggal'] },
      { id: 'crossline', label: 'Cross Line', category: 'lines', shortcut: 'Alt + C', tags: ['silang', 'titik'] },
      { id: 'arrow', label: 'Arrow', category: 'lines', shortcut: 'Alt + A', tags: ['panah', 'arah'] },
    ],
  },
  {
    id: 'channels_pitchforks',
    label: 'Saluran & Pitchfork',
    defaultTool: 'parallelchannel',
    tools: [
      { id: 'parallelchannel', label: 'Parallel Channel', category: 'channels_pitchforks', tags: ['saluran', 'kanal', 'tren'] },
      { id: 'regressionchannel', label: 'Regression Channel', category: 'channels_pitchforks', tags: ['regresi', 'linier'] },
      { id: 'flattopbottom', label: 'Flat Top/Bottom', category: 'channels_pitchforks', tags: ['flat', 'horizontal', 'konsolidasi'] },
      { id: 'disjointchannel', label: 'Disjoint Channel', category: 'channels_pitchforks', tags: ['saluran', 'kanal'] },
      { id: 'pitchfork', label: 'Andrews Pitchfork', category: 'channels_pitchforks', tags: ['garpu', 'median line', 'andrews'] },
      { id: 'schiffpitchfork', label: 'Schiff Pitchfork', category: 'channels_pitchforks', tags: ['garpu', 'schiff'] },
      { id: 'modifiedschiffpitchfork', label: 'Modified Schiff Pitchfork', category: 'channels_pitchforks', tags: ['garpu', 'schiff'] },
      { id: 'insidepitchfork', label: 'Inside Pitchfork', category: 'channels_pitchforks', tags: ['garpu', 'inside'] },
    ],
  },
  {
    id: 'fib_gann',
    label: 'Fibonacci & Gann',
    defaultTool: 'fibretracement',
    tools: [
      { id: 'fibretracement', label: 'Fib Retracement', category: 'fib_gann', shortcut: 'Alt + F', tags: ['fib', 'golden ratio', 'koreksi'] },
      { id: 'fibextension', label: 'Trend-Based Fib Extension', category: 'fib_gann', tags: ['fib', 'ekstensi', 'target'] },
      { id: 'fibextensiontrend', label: 'Fib Extension Trend', category: 'fib_gann', tags: ['fib', 'tren'] },
      { id: 'fibchannel', label: 'Fib Channel', category: 'fib_gann', tags: ['fib', 'saluran'] },
      { id: 'fibtimezones', label: 'Fib Time Zones', category: 'fib_gann', tags: ['fib', 'siklus', 'waktu'] },
      { id: 'fibfan', label: 'Fib Speed Resistance Fan', category: 'fib_gann', tags: ['fib', 'kipas'] },
      { id: 'fibspeedfan', label: 'Fib Speed Fan', category: 'fib_gann', tags: ['fib', 'kecepatan'] },
      { id: 'trendfibtime', label: 'Trend-Based Fib Time', category: 'fib_gann', tags: ['fib', 'waktu'] },
      { id: 'fibcircles', label: 'Fib Circles', category: 'fib_gann', tags: ['fib', 'lingkaran'] },
      { id: 'fibarcs', label: 'Fib Arcs', category: 'fib_gann', tags: ['fib', 'busur'] },
      { id: 'fibwedge', label: 'Fib Wedge', category: 'fib_gann', tags: ['fib', 'baji'] },
      { id: 'fibspiral', label: 'Fib Spiral', category: 'fib_gann', tags: ['fib', 'spiral', 'keong'] },
      { id: 'gannbox', label: 'Gann Box', category: 'fib_gann', tags: ['gann', 'kotak', 'geometri'] },
      { id: 'gannsquare', label: 'Gann Square', category: 'fib_gann', tags: ['gann', 'kuadrat'] },
      { id: 'gannfan', label: 'Gann Fan', category: 'fib_gann', tags: ['gann', 'kipas', 'derajat'] },
      { id: 'dedekind', label: 'Dedekind Tessellation', category: 'fib_gann', tags: ['dedekind', 'matematika'] },
      { id: 'sonic', label: 'Sonic Ratios', category: 'fib_gann', tags: ['sonic', 'gelombang'] },
      { id: 'supersonic', label: 'Supersonic Ratios', category: 'fib_gann', tags: ['supersonic', 'rasio'] },
      { id: 'goldensonic', label: 'Golden Sonic', category: 'fib_gann', tags: ['golden', 'sonic'] },
      { id: 'goldensupersonic', label: 'Golden Supersonic', category: 'fib_gann', tags: ['golden', 'supersonic'] },
    ],
  },
  {
    id: 'waves_harmonics',
    label: 'Pola Harmonik & Elliott Wave',
    defaultTool: 'elliottimpulse',
    tools: [
      { id: 'elliottimpulse', label: 'Elliott Impulse Wave (12345)', category: 'waves_harmonics', tags: ['elliott', 'impuls', '12345', 'gelombang'] },
      { id: 'elliottcorrection', label: 'Elliott Correction Wave (ABC)', category: 'waves_harmonics', tags: ['elliott', 'koreksi', 'abc'] },
      { id: 'xabcd', label: 'XABCD Pattern', category: 'waves_harmonics', tags: ['harmonik', 'xabcd'] },
      { id: 'cypher', label: 'Cypher Pattern', category: 'waves_harmonics', tags: ['harmonik', 'cypher'] },
      { id: 'gartley', label: 'Gartley Pattern', category: 'waves_harmonics', tags: ['harmonik', 'gartley'] },
      { id: 'bat', label: 'Bat Pattern', category: 'waves_harmonics', tags: ['harmonik', 'bat', 'kelelawar'] },
      { id: 'butterfly', label: 'Butterfly Pattern', category: 'waves_harmonics', tags: ['harmonik', 'butterfly', 'kupu-kupu'] },
      { id: 'crab', label: 'Crab Pattern', category: 'waves_harmonics', tags: ['harmonik', 'crab', 'kepiting'] },
      { id: 'shark', label: 'Shark Pattern', category: 'waves_harmonics', tags: ['harmonik', 'shark', 'hiu'] },
      { id: 'abcd', label: 'ABCD Pattern', category: 'waves_harmonics', tags: ['harmonik', 'abcd'] },
      { id: 'headshoulders', label: 'Head and Shoulders', category: 'waves_harmonics', tags: ['pola', 'hns', 'kepala bahu'] },
    ],
  },
  {
    id: 'shapes_brushes',
    label: 'Bentuk & Kuas',
    defaultTool: 'box',
    tools: [
      { id: 'box', label: 'Rectangle (Order Block / Supply Demand)', category: 'shapes_brushes', tags: ['kotak', 'persegi', 'order block', 'fvg', 'snr'] },
      { id: 'freehand', label: 'Brush (Freehand Drawing)', category: 'shapes_brushes', tags: ['kuas', 'pensil', 'coret', 'brush'] },
      { id: 'highlighter', label: 'Highlighter (Stabilo)', category: 'shapes_brushes', tags: ['stabilo', 'sorot', 'highlighter'] },
      { id: 'polyline', label: 'Polyline', category: 'shapes_brushes', tags: ['garis bertingkat', 'polyline'] },
      { id: 'path', label: 'Path', category: 'shapes_brushes', tags: ['alur', 'lintasan'] },
      { id: 'rotatedrect', label: 'Rotated Rectangle', category: 'shapes_brushes', tags: ['persegi miring', 'rotasi'] },
      { id: 'circle', label: 'Circle', category: 'shapes_brushes', tags: ['lingkaran', 'bulat'] },
      { id: 'ellipse', label: 'Ellipse', category: 'shapes_brushes', tags: ['lonjong', 'elips'] },
      { id: 'triangle', label: 'Triangle', category: 'shapes_brushes', tags: ['segitiga'] },
      { id: 'curve', label: 'Curve', category: 'shapes_brushes', tags: ['lengkung'] },
      { id: 'arc', label: 'Arc', category: 'shapes_brushes', tags: ['busur'] },
    ],
  },
  {
    id: 'measure_volume',
    label: 'Proyeksi, Pengukuran & Volume',
    defaultTool: 'position',
    tools: [
      { id: 'position', label: 'Risk/Reward Position (Long/Short)', category: 'measure_volume', shortcut: 'Alt + R', tags: ['posisi', 'rr', 'risk reward', 'target', 'stop loss'] },
      { id: 'datepricerange', label: 'Date & Price Range', category: 'measure_volume', tags: ['rentang', 'persentase', 'pip', 'periode'] },
      { id: 'measure', label: 'Measure Ruler', category: 'measure_volume', shortcut: 'Shift + Drag', tags: ['penggaris', 'ukur', 'jarak'] },
      { id: 'magnifier', label: 'Magnifier (Kaca Pembesar)', category: 'measure_volume', tags: ['zoom', 'detail', 'perbesar'] },
      { id: 'anchoredvwap', label: 'Anchored VWAP', category: 'measure_volume', tags: ['vwap', 'volume', 'tertambat', 'average price'] },
      { id: 'fixedrangevp', label: 'Fixed Range Volume Profile (FRVP)', category: 'measure_volume', tags: ['frvp', 'volume profile', 'poc', 'value area'] },
    ],
  },
  {
    id: 'annotations',
    label: 'Teks & Catatan Anotasi',
    defaultTool: 'text',
    tools: [
      { id: 'text', label: 'Text Note', category: 'annotations', shortcut: 'Alt + N', tags: ['teks', 'tulisan', 'catatan'] },
      { id: 'callout', label: 'Callout (Balon Teks)', category: 'annotations', tags: ['balon', 'panggilan', 'penjelasan'] },
      { id: 'note', label: 'Sticky Note', category: 'annotations', tags: ['sticky', 'memo'] },
      { id: 'pricenote', label: 'Price Note', category: 'annotations', tags: ['catatan harga', 'level'] },
      { id: 'comment', label: 'Comment', category: 'annotations', tags: ['komentar', 'obrolan'] },
      { id: 'pricelabel', label: 'Price Label', category: 'annotations', tags: ['label harga', 'badge'] },
      { id: 'signpost', label: 'Signpost', category: 'annotations', tags: ['plang', 'tanda'] },
      { id: 'arrowmarkup', label: 'Arrow Up (Bullish Marker)', category: 'annotations', tags: ['panah atas', 'beli', 'long'] },
      { id: 'arrowmarkdown', label: 'Arrow Down (Bearish Marker)', category: 'annotations', tags: ['panah bawah', 'jual', 'short'] },
      { id: 'flagmark', label: 'Flag Mark', category: 'annotations', tags: ['bendera', 'tanda'] },
      { id: 'iconstamp', label: 'Icon Stamp', category: 'annotations', tags: ['stempel', 'ikon'] },
    ],
  },
];

// Mapping pencarian cepat
const TOOL_INDEX: Map<DrawingToolId, DrawingToolItem> = new Map();
const ALL_SUPPORTED_TOOLS: DrawingToolItem[] = [];

for (const group of DRAWING_TOOL_GROUPS) {
  for (const tool of group.tools) {
    TOOL_INDEX.set(tool.id, tool);
    ALL_SUPPORTED_TOOLS.push(tool);
  }
}

// ─── Preferensi Alat Gambar In-Memory & Sinkronisasi PersistenceService ───
const DEFAULT_FAVORITES: DrawingToolId[] = ['trendline', 'hline', 'fibretracement', 'box', 'position', 'freehand'];

export interface FavoritesBarPosition {
  x: number;
  y: number;
}

export interface DrawingToolsPreferenceState {
  lastUsed: Record<DrawingGroupId, DrawingToolId>;
  favorites: DrawingToolId[];
  favoritesBarPosition: FavoritesBarPosition;
}

function buildDefaultLastUsed(): Record<DrawingGroupId, DrawingToolId> {
  const defaults = {} as Record<DrawingGroupId, DrawingToolId>;
  for (const group of DRAWING_TOOL_GROUPS) {
    defaults[group.id] = group.defaultTool;
  }
  return defaults;
}

function getDefaultFavoritesBarPosition(): FavoritesBarPosition {
  // Default: di samping toolbar kiri, kira-kira vertikal tengah
  const defaultY = typeof window !== 'undefined' ? Math.round(window.innerHeight / 2 - 18) : 300;
  return { x: 52, y: defaultY };
}

/**
 * Pengelola state preferensi alat gambar (last used, favorit, dan posisi floating bar).
 * Tidak melakukan pembacaan `localStorage` saat evaluasi awal modul; seluruh persistensi
 * dihidrasi dan disimpan melalui `PersistenceService` (`UiPreferenceKey`).
 */
export class DrawingToolsPreferenceStore {
  private memoryLastUsed: Record<DrawingGroupId, DrawingToolId> = buildDefaultLastUsed();
  private memoryFavorites: Set<DrawingToolId> = new Set(DEFAULT_FAVORITES);
  private memoryFavBarPos: FavoritesBarPosition | null = null;
  private listeners: Set<(state: DrawingToolsPreferenceState) => void> = new Set();
  private persistence: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'>;

  constructor(persistence: Pick<IPersistenceService, 'getUiPreferenceSync' | 'setUiPreference'> = storage) {
    this.persistence = persistence;
  }

  /**
   * Menghidrasi state in-memory dari cache PersistenceService setelah `bootstrap()` selesai
   * dan memberitahu seluruh komponen UI yang berlangganan.
   */
  public hydrateFromPersistence(): void {
    const savedLastUsed = this.persistence.getUiPreferenceSync<Record<string, DrawingToolId>>('drawings_last_used');
    if (savedLastUsed && typeof savedLastUsed === 'object' && !Array.isArray(savedLastUsed)) {
      const next = buildDefaultLastUsed();
      for (const group of DRAWING_TOOL_GROUPS) {
        const candidate = savedLastUsed[group.id];
        if (typeof candidate === 'string' && TOOL_INDEX.has(candidate)) {
          next[group.id] = candidate;
        }
      }
      this.memoryLastUsed = next;
    }

    const savedFavorites = this.persistence.getUiPreferenceSync<unknown>('drawings_favorites');
    if (Array.isArray(savedFavorites)) {
      this.memoryFavorites = new Set(
        savedFavorites.filter((id): id is DrawingToolId => typeof id === 'string' && TOOL_INDEX.has(id as DrawingToolId))
      );
    }

    const savedPos = this.persistence.getUiPreferenceSync<FavoritesBarPosition>('drawings_fav_pos');
    if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
      this.memoryFavBarPos = { x: savedPos.x, y: savedPos.y };
    }

    this.notify();
  }

  public getSnapshot(): DrawingToolsPreferenceState {
    return {
      lastUsed: { ...this.memoryLastUsed },
      favorites: Array.from(this.memoryFavorites),
      favoritesBarPosition: this.getFavoritesBarPosition(),
    };
  }

  public subscribe(listener: (state: DrawingToolsPreferenceState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public getLastUsedTool(groupId: DrawingGroupId): DrawingToolId {
    return this.memoryLastUsed[groupId] || 'trendline';
  }

  public setLastUsedTool(groupId: DrawingGroupId, toolId: DrawingToolId): void {
    this.memoryLastUsed[groupId] = toolId;
    void this.persistence.setUiPreference('drawings_last_used', { ...this.memoryLastUsed }).catch(() => {});
    this.notify();
  }

  public getFavoriteTools(): DrawingToolId[] {
    return Array.from(this.memoryFavorites);
  }

  public isToolFavorite(toolId: DrawingToolId): boolean {
    return this.memoryFavorites.has(toolId);
  }

  public toggleFavoriteTool(toolId: DrawingToolId): boolean {
    let isNowFavorite = false;
    if (this.memoryFavorites.has(toolId)) {
      this.memoryFavorites.delete(toolId);
      isNowFavorite = false;
    } else {
      this.memoryFavorites.add(toolId);
      isNowFavorite = true;
    }
    void this.persistence
      .setUiPreference('drawings_favorites', Array.from(this.memoryFavorites))
      .catch(() => {});
    this.notify();
    return isNowFavorite;
  }

  public getFavoritesBarPosition(): FavoritesBarPosition {
    if (this.memoryFavBarPos) {
      return { ...this.memoryFavBarPos };
    }
    return getDefaultFavoritesBarPosition();
  }

  public saveFavoritesBarPosition(pos: FavoritesBarPosition): void {
    this.memoryFavBarPos = { x: pos.x, y: pos.y };
    void this.persistence.setUiPreference('drawings_fav_pos', { ...this.memoryFavBarPos }).catch(() => {});
    this.notify();
  }
}

export const drawingToolsPreferences = new DrawingToolsPreferenceStore(storage);

export function hydrateDrawingToolsFromPersistence(): void {
  drawingToolsPreferences.hydrateFromPersistence();
}

export function subscribeDrawingToolsPreferences(
  listener: (state: DrawingToolsPreferenceState) => void
): () => void {
  return drawingToolsPreferences.subscribe(listener);
}

export function getLastUsedTool(groupId: DrawingGroupId): DrawingToolId {
  return drawingToolsPreferences.getLastUsedTool(groupId);
}

export function setLastUsedTool(groupId: DrawingGroupId, toolId: DrawingToolId): void {
  drawingToolsPreferences.setLastUsedTool(groupId, toolId);
}

export function getFavoriteTools(): DrawingToolId[] {
  return drawingToolsPreferences.getFavoriteTools();
}

export function isToolFavorite(toolId: DrawingToolId): boolean {
  return drawingToolsPreferences.isToolFavorite(toolId);
}

export function toggleFavoriteTool(toolId: DrawingToolId): boolean {
  return drawingToolsPreferences.toggleFavoriteTool(toolId);
}

// ─── Readers & Search ───

export function getToolMeta(toolId: DrawingToolId): DrawingToolItem | null {
  return TOOL_INDEX.get(toolId) || null;
}

export function getAllSupportedTools(): DrawingToolItem[] {
  return ALL_SUPPORTED_TOOLS;
}

export function searchDrawingTools(query: string): DrawingToolItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_SUPPORTED_TOOLS;

  return ALL_SUPPORTED_TOOLS.filter((tool) => {
    if (tool.id.toLowerCase().includes(q)) return true;
    if (tool.label.toLowerCase().includes(q)) return true;
    if (tool.tags && tool.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

// ─── Floating Favorites Bar Position ───

export function clampFavoritesBarPosition(
  pos: FavoritesBarPosition,
  barWidth: number = 220,
  barHeight: number = 36,
  windowWidth: number = 1920,
  windowHeight: number = 1080
): FavoritesBarPosition {
  const maxX = Math.max(0, windowWidth - barWidth);
  const maxY = Math.max(0, windowHeight - barHeight);

  const clampedX = Math.min(Math.max(0, pos.x), maxX);
  const clampedY = Math.min(Math.max(0, pos.y), maxY);

  return { x: Math.round(clampedX), y: Math.round(clampedY) };
}

export function getFavoritesBarPosition(): FavoritesBarPosition {
  return drawingToolsPreferences.getFavoritesBarPosition();
}

export function saveFavoritesBarPosition(pos: FavoritesBarPosition): void {
  drawingToolsPreferences.saveFavoritesBarPosition(pos);
}

// ─── Quick Stamp Preset Palette (Target, Warning, Breakout, Pin, Flag) ───

export interface StampPreset {
  id: string;
  tool: 'iconstamp' | 'flagmark';
  label: string;
  emoji: string;
  glyph: string;
  color: string;
  description: string;
}

export const STAMP_PRESETS: StampPreset[] = [
  {
    id: 'target',
    tool: 'iconstamp',
    label: 'Target Profit',
    emoji: '🎯',
    glyph: '★',
    color: '#10b981',
    description: 'Level sasaran harga atau take-profit'
  },
  {
    id: 'warning',
    tool: 'iconstamp',
    label: 'Warning / Stop',
    emoji: '⚠️',
    glyph: '▲',
    color: '#ef4444',
    description: 'Zona bahaya, invalidasi atau stop loss'
  },
  {
    id: 'breakout',
    tool: 'iconstamp',
    label: 'Breakout Surge',
    emoji: '🚀',
    glyph: '➤',
    color: '#06b6d4',
    description: 'Titik penembusan resistensi atau lonjakan momentum'
  },
  {
    id: 'pin',
    tool: 'iconstamp',
    label: 'Key Pivot Pin',
    emoji: '📌',
    glyph: '●',
    color: '#f59e0b',
    description: 'Titik penting pivot atau struktur pasar'
  },
  {
    id: 'flag',
    tool: 'flagmark',
    label: 'Market Flag',
    emoji: '🚩',
    glyph: '⚑',
    color: '#8b5cf6',
    description: 'Penanda peristiwa penting atau catatan sentimen'
  }
];

export function getStampPresets(): StampPreset[] {
  return [...STAMP_PRESETS];
}


