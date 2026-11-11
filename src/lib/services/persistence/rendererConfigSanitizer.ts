/**
 * Utilitas sanitasi & structural clone untuk `rendererConfig` chart agar isolasi K3
 * (pengaturan tema global di `AppSettings` vs gaya lokal sel/workspace) terjaga bersih.
 */

export interface ActiveThemeCandleColors {
  upColor?: string;
  downColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
}

const GLOBAL_ROOT_KEYS = new Set(['layout', 'grid', 'timeScale']);

function isPlainRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeColorValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Mengkloning nilai struktur plain JSON/config dalam satu lintasan memori tanpa `JSON.parse(JSON.stringify)`.
 */
export function cloneRendererConfigValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    seen.set(value as object, out);
    for (let i = 0; i < value.length; i++) {
      out[i] = cloneRendererConfigValue(value[i], seen);
    }
    return out as unknown as T;
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  const out: Record<string, unknown> = {};
  seen.set(value as object, out);
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (entry !== undefined) {
      out[key] = cloneRendererConfigValue(entry, seen);
    }
  }
  return out as T;
}

function stripGlobalKeysInPlace(target: Record<string, any>): void {
  for (const key of GLOBAL_ROOT_KEYS) {
    delete target[key];
  }

  if (isPlainRecord(target.panes)) {
    delete target.panes.separatorColor;
    if (Object.keys(target.panes).length === 0) {
      delete target.panes;
    }
  }

  if (isPlainRecord(target.priceScale)) {
    delete target.priceScale.currentPriceLine;
    delete target.priceScale.borderColor;
    if (Object.keys(target.priceScale).length === 0) {
      delete target.priceScale;
    }
  }

  if (isPlainRecord(target.crosshair)) {
    delete target.crosshair.color;
    delete target.crosshair.labelBackground;
    if (Object.keys(target.crosshair).length === 0) {
      delete target.crosshair;
    }
  }
}

function stripThemeInheritedColors(
  target: Record<string, any>,
  prop: string,
  themeColor?: string
): void {
  if (!themeColor) return;
  const current = normalizeColorValue(target[prop]);
  const expected = normalizeColorValue(themeColor);
  if (current && expected && current === expected) {
    delete target[prop];
  }
}

/**
 * Menyaring `rendererConfig` sebelum diterapkan ke renderer (`applyConfig` / `applyState`):
 * menghapus seluruh kunci domain global K3 agar dokumen lama tidak menimpa tema, grid, atau timezone aktif.
 */
export function sanitizeRendererConfigForApply(
  config: unknown
): Record<string, unknown> | undefined {
  if (!isPlainRecord(config)) return undefined;
  const cloned = cloneRendererConfigValue(config) as Record<string, any>;
  stripGlobalKeysInPlace(cloned);
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

/**
 * Menyaring `rendererConfig` sebelum disimpan ke snapshot workspace atau `chartDefaultConfig`:
 * - Selalu membuang kunci global K3 (`layout`, `grid`, `timeScale`, `panes.separatorColor`,
 *   `priceScale.currentPriceLine`, `priceScale.borderColor`, `crosshair.color`, `crosshair.labelBackground`).
 * - Pada `candles`/`bars`, warna yang sama persis dengan Theme Preset aktif dibuang agar pergantian tema global
 *   tetap mewariskan warnanya, sedangkan warna/atribut kustom eksplisit dipertahankan.
 */
export function sanitizeRendererConfigForPersistence(
  rawConfig: unknown,
  activeThemeColors?: ActiveThemeCandleColors | null
): Record<string, unknown> | undefined {
  if (!isPlainRecord(rawConfig)) return undefined;
  const cloned = cloneRendererConfigValue(rawConfig) as Record<string, any>;
  stripGlobalKeysInPlace(cloned);

  if (activeThemeColors) {
    if (isPlainRecord(cloned.candles)) {
      stripThemeInheritedColors(cloned.candles, 'upColor', activeThemeColors.upColor);
      stripThemeInheritedColors(cloned.candles, 'downColor', activeThemeColors.downColor);
      stripThemeInheritedColors(cloned.candles, 'borderUpColor', activeThemeColors.borderUpColor);
      stripThemeInheritedColors(cloned.candles, 'borderDownColor', activeThemeColors.borderDownColor);
      stripThemeInheritedColors(cloned.candles, 'wickUpColor', activeThemeColors.wickUpColor);
      stripThemeInheritedColors(cloned.candles, 'wickDownColor', activeThemeColors.wickDownColor);
      if (Object.keys(cloned.candles).length === 0) {
        delete cloned.candles;
      }
    }

    if (isPlainRecord(cloned.bars)) {
      stripThemeInheritedColors(cloned.bars, 'upColor', activeThemeColors.upColor);
      stripThemeInheritedColors(cloned.bars, 'downColor', activeThemeColors.downColor);
      if (Object.keys(cloned.bars).length === 0) {
        delete cloned.bars;
      }
    }
  }

  return Object.keys(cloned).length > 0 ? cloned : undefined;
}
