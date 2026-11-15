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
    if (typeof entry === 'number' && !Number.isFinite(entry)) continue;
    if (entry !== undefined) {
      out[key] = cloneRendererConfigValue(entry, seen);
    }
  }
  return out as T;
}

function isFiniteInRange(value: unknown, min: number, max: number, maxInclusive = true): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < min) return false;
  return maxInclusive ? value <= max : value < max;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeMarginsRecord(margins: unknown): Record<string, number> | undefined {
  if (!isPlainRecord(margins)) return undefined;
  const out: Record<string, number> = {};
  if (isFiniteInRange(margins.top, 0, 1, false)) {
    out.top = margins.top;
  }
  if (isFiniteInRange(margins.bottom, 0, 1, false)) {
    out.bottom = margins.bottom;
  }
  if (typeof out.top === 'number' && typeof out.bottom === 'number' && out.top + out.bottom >= 1) {
    return undefined;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeCandleOrBarGroup(group: unknown): Record<string, any> | undefined {
  if (!isPlainRecord(group)) return undefined;
  const out: Record<string, any> = {};
  const boolKeys = ['bodyVisible', 'borderVisible', 'wickVisible'];
  const colorKeys = ['upColor', 'downColor', 'borderUpColor', 'borderDownColor', 'wickUpColor', 'wickDownColor'];

  for (const key of boolKeys) {
    if (typeof group[key] === 'boolean') {
      out[key] = group[key];
    }
  }
  for (const key of colorKeys) {
    if (isNonEmptyString(group[key])) {
      out[key] = group[key];
    }
  }
  for (const [key, val] of Object.entries(group)) {
    if (!boolKeys.includes(key) && !colorKeys.includes(key) && val !== undefined) {
      out[key] = val;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Membuang atau menormalkan properti rendererConfig yang malformed atau di luar rentang valid
 * sebelum mencapai session port atau renderer.
 */
function sanitizeRendererPropertiesInPlace(target: Record<string, any>): void {
  if ('margins' in target) {
    const cleanMargins = sanitizeMarginsRecord(target.margins);
    if (cleanMargins) {
      target.margins = cleanMargins;
    } else {
      delete target.margins;
    }
  }

  if ('barSpacing' in target && !isFiniteInRange(target.barSpacing, 0.5, 500)) {
    delete target.barSpacing;
  }

  if ('priceScale' in target) {
    if (!isPlainRecord(target.priceScale)) {
      delete target.priceScale;
    } else {
      const ps = target.priceScale;
      if ('autoScale' in ps && typeof ps.autoScale !== 'boolean') delete ps.autoScale;
      if ('log' in ps && typeof ps.log !== 'boolean') delete ps.log;
      if ('inverted' in ps && typeof ps.inverted !== 'boolean') delete ps.inverted;
      if ('mode' in ps && !isNonEmptyString(ps.mode) && !isFiniteInRange(ps.mode, 0, 10)) {
        delete ps.mode;
      }
      if ('scaleMargins' in ps) {
        const cleanScaleMargins = sanitizeMarginsRecord(ps.scaleMargins);
        if (cleanScaleMargins) {
          ps.scaleMargins = cleanScaleMargins;
        } else {
          delete ps.scaleMargins;
        }
      }
      if (Object.keys(ps).length === 0) {
        delete target.priceScale;
      }
    }
  }

  if ('crosshair' in target) {
    if (!isPlainRecord(target.crosshair)) {
      delete target.crosshair;
    } else {
      const ch = target.crosshair;
      if ('width' in ch && !isFiniteInRange(ch.width, 0.5, 20)) delete ch.width;
      if ('opacity' in ch && !isFiniteInRange(ch.opacity, 0, 1)) delete ch.opacity;
      if ('style' in ch && !isNonEmptyString(ch.style)) delete ch.style;
      if (Object.keys(ch).length === 0) {
        delete target.crosshair;
      }
    }
  }

  for (const groupKey of ['candles', 'bars'] as const) {
    if (groupKey in target) {
      const cleanGroup = sanitizeCandleOrBarGroup(target[groupKey]);
      if (cleanGroup) {
        target[groupKey] = cleanGroup;
      } else {
        delete target[groupKey];
      }
    }
  }

  if ('series' in target) {
    if (!isPlainRecord(target.series)) {
      delete target.series;
    } else {
      if ('style' in target.series && !isNonEmptyString(target.series.style)) {
        delete target.series.style;
      }
      if (Object.keys(target.series).length === 0) {
        delete target.series;
      }
    }
  }
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
  sanitizeRendererPropertiesInPlace(cloned);
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
  sanitizeRendererPropertiesInPlace(cloned);

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
