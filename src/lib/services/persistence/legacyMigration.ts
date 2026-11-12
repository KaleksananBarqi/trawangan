// Migrasi satu kali kunci legacy localStorage (Bucket A & B) ke adapter persisten SQLite saat bootstrap()
import type { ProviderConfig, SavedTradingPlanRecord } from '../../types/market';
import { DEFAULT_PROVIDERS } from '../market/constants';
import type { AppPreferenceKey, PersistenceAdapter } from './types';

export interface LegacyStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface PreferenceMigrationRule {
  legacyKey: string;
  targetKey: AppPreferenceKey;
  normalize: (raw: string) => string | null;
}

const DEFAULT_PROVIDER_BY_ID = new Map<string, ProviderConfig>(
  DEFAULT_PROVIDERS.map((p) => [p.id, p])
);

/**
 * Daftar allowlist eksplisit kunci legacy Bucket A, Bucket B, dan kunci yatim vault.
 * Kunci Bucket C (`trawangan_workspace_pending_*`, `trawangan_macro_cache_meta_v1`,
 * `trawangan_macro_metadata_v1`) sengaja TIDAK pernah disentuh di sini.
 */
export const LEGACY_MIGRATION_ALLOWLIST: readonly string[] = [
  'trawangan_app_settings',
  'trawangan_autosave_workspace',
  'trawangan_chart_default_config',
  'trawangan_last_workspace_id',
  'trawangan_providers',
  'trawangan_left_rail_collapsed',
  'trawangan_right_dock_state',
  'trawangan_pine_panel_width',
  'trawangan_right_panel_width',
  'trawangan_right_plan_width',
  'trawangan_drawings_last_used',
  'trawangan_drawings_favorites',
  'trawangan_drawings_fav_pos',
  'trawangan_fav_indicators',
  'trawangan_recent_searches',
  'trawangan_trade_plan_vault',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonSafe(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function parseLegacyBoolean(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return undefined;
}

function normalizeBooleanJson(raw: string): string | null {
  const parsed = parseLegacyBoolean(raw);
  return parsed === undefined ? null : JSON.stringify(parsed);
}

function normalizePositiveNumberJson(raw: string): string | null {
  const parsedJson = parseJsonSafe(raw);
  const candidate = parsedJson.ok ? Number(parsedJson.value) : Number(raw.trim());
  if (!Number.isFinite(candidate) || candidate <= 0) return null;
  return JSON.stringify(Math.round(candidate));
}

function normalizePlainObjectJson(raw: string): string | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok || !isPlainObject(parsed.value)) return null;
  return JSON.stringify(parsed.value);
}

function normalizeArrayJson(raw: string): string | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok || !Array.isArray(parsed.value)) return null;
  return JSON.stringify(parsed.value);
}

function normalizeAnyValidJson(raw: string): string | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok) return null;
  return JSON.stringify(parsed.value);
}

function normalizeWorkspaceIdJson(raw: string): string | null {
  let cleanId = raw.trim();
  if (cleanId.startsWith('"') && cleanId.endsWith('"')) {
    const parsed = parseJsonSafe(cleanId);
    if (parsed.ok && typeof parsed.value === 'string') {
      cleanId = parsed.value.trim();
    }
  }
  return cleanId.length > 0 ? JSON.stringify(cleanId) : null;
}

const PREFERENCE_MIGRATION_RULES: readonly PreferenceMigrationRule[] = [
  {
    legacyKey: 'trawangan_chart_default_config',
    targetKey: 'chart_default_config',
    normalize: normalizeAnyValidJson,
  },
  {
    legacyKey: 'trawangan_last_workspace_id',
    targetKey: 'last_active_workspace_id',
    normalize: normalizeWorkspaceIdJson,
  },
  {
    legacyKey: 'trawangan_left_rail_collapsed',
    targetKey: 'left_rail_collapsed',
    normalize: normalizeBooleanJson,
  },
  {
    legacyKey: 'trawangan_right_dock_state',
    targetKey: 'right_dock_state',
    normalize: normalizePlainObjectJson,
  },
  {
    legacyKey: 'trawangan_pine_panel_width',
    targetKey: 'pine_panel_width',
    normalize: normalizePositiveNumberJson,
  },
  {
    legacyKey: 'trawangan_right_panel_width',
    targetKey: 'right_panel_width',
    normalize: normalizePositiveNumberJson,
  },
  {
    legacyKey: 'trawangan_right_plan_width',
    targetKey: 'right_plan_width',
    normalize: normalizePositiveNumberJson,
  },
  {
    legacyKey: 'trawangan_drawings_last_used',
    targetKey: 'drawings_last_used',
    normalize: normalizePlainObjectJson,
  },
  {
    legacyKey: 'trawangan_drawings_favorites',
    targetKey: 'drawings_favorites',
    normalize: normalizeArrayJson,
  },
  {
    legacyKey: 'trawangan_drawings_fav_pos',
    targetKey: 'drawings_fav_pos',
    normalize: normalizePlainObjectJson,
  },
  {
    legacyKey: 'trawangan_fav_indicators',
    targetKey: 'fav_indicators',
    normalize: normalizeArrayJson,
  },
  {
    legacyKey: 'trawangan_recent_searches',
    targetKey: 'recent_searches',
    normalize: normalizeArrayJson,
  },
];

export function resolveLegacyLocalStorage(): LegacyStorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const store = (globalThis as { localStorage?: LegacyStorageLike }).localStorage;
      if (store && typeof store.getItem === 'function' && typeof store.removeItem === 'function') {
        return store;
      }
    }
  } catch {
    // Abaikan apabila akses localStorage dibatasi oleh lingkungan runtime
  }
  return null;
}

function safeGetItem(storage: LegacyStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(storage: LegacyStorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Abaikan galat hapus localStorage
  }
}

async function migrateAppSettings(
  adapter: PersistenceAdapter,
  preferenceCache: Map<string, string>,
  legacyStorage: LegacyStorageLike
): Promise<void> {
  const rawSettings = safeGetItem(legacyStorage, 'trawangan_app_settings');
  const rawAutoSave = safeGetItem(legacyStorage, 'trawangan_autosave_workspace');
  if (rawSettings === null && rawAutoSave === null) return;

  const parsedAutoSave = parseLegacyBoolean(rawAutoSave);
  const existingSettingsRaw = preferenceCache.get('app_settings');

  if (existingSettingsRaw !== undefined) {
    // SQLite sudah memiliki app_settings; jangan timpa nilai yang lebih baru.
    // Hanya gabungkan autoSaveWorkspace bila belum disetel pada objek SQLite.
    const existingParsed = parseJsonSafe(existingSettingsRaw);
    if (
      existingParsed.ok &&
      isPlainObject(existingParsed.value) &&
      existingParsed.value.autoSaveWorkspace === undefined &&
      parsedAutoSave !== undefined
    ) {
      const mergedJson = JSON.stringify({
        ...existingParsed.value,
        autoSaveWorkspace: parsedAutoSave,
      });
      try {
        await adapter.setPreference('app_settings', mergedJson);
        preferenceCache.set('app_settings', mergedJson);
        if (rawAutoSave !== null) safeRemoveItem(legacyStorage, 'trawangan_autosave_workspace');
        if (rawSettings !== null) safeRemoveItem(legacyStorage, 'trawangan_app_settings');
      } catch (err) {
        console.warn('[PersistenceService] Gagal menggabungkan trawangan_autosave_workspace ke SQLite:', err);
      }
      return;
    }

    if (rawSettings !== null) safeRemoveItem(legacyStorage, 'trawangan_app_settings');
    if (rawAutoSave !== null) safeRemoveItem(legacyStorage, 'trawangan_autosave_workspace');
    return;
  }

  let candidateSettings: Record<string, unknown> | null = null;
  if (rawSettings !== null) {
    const parsedSettings = parseJsonSafe(rawSettings);
    if (parsedSettings.ok && isPlainObject(parsedSettings.value)) {
      candidateSettings = { ...parsedSettings.value };
      if (candidateSettings.autoSaveWorkspace === undefined && parsedAutoSave !== undefined) {
        candidateSettings.autoSaveWorkspace = parsedAutoSave;
      }
    } else {
      // Hapus payload legacy app_settings yang rusak, lalu selamatkan autoSaveWorkspace bila valid
      safeRemoveItem(legacyStorage, 'trawangan_app_settings');
    }
  }

  if (candidateSettings === null && parsedAutoSave !== undefined) {
    candidateSettings = { autoSaveWorkspace: parsedAutoSave };
  }

  if (candidateSettings === null) {
    if (rawAutoSave !== null) safeRemoveItem(legacyStorage, 'trawangan_autosave_workspace');
    return;
  }

  const serialized = JSON.stringify(candidateSettings);
  try {
    await adapter.setPreference('app_settings', serialized);
    preferenceCache.set('app_settings', serialized);
    if (rawSettings !== null) safeRemoveItem(legacyStorage, 'trawangan_app_settings');
    if (rawAutoSave !== null) safeRemoveItem(legacyStorage, 'trawangan_autosave_workspace');
  } catch (err) {
    console.warn('[PersistenceService] Gagal migrasi trawangan_app_settings ke SQLite:', err);
  }
}

async function migrateMappedPreferences(
  adapter: PersistenceAdapter,
  preferenceCache: Map<string, string>,
  legacyStorage: LegacyStorageLike
): Promise<void> {
  for (const rule of PREFERENCE_MIGRATION_RULES) {
    const raw = safeGetItem(legacyStorage, rule.legacyKey);
    if (raw === null) continue;

    if (preferenceCache.has(rule.targetKey)) {
      safeRemoveItem(legacyStorage, rule.legacyKey);
      continue;
    }

    const normalized = rule.normalize(raw);
    if (normalized === null) {
      safeRemoveItem(legacyStorage, rule.legacyKey);
      continue;
    }

    try {
      await adapter.setPreference(rule.targetKey, normalized);
      preferenceCache.set(rule.targetKey, normalized);
      safeRemoveItem(legacyStorage, rule.legacyKey);
    } catch (err) {
      console.warn(`[PersistenceService] Gagal migrasi "${rule.legacyKey}" ke SQLite:`, err);
    }
  }
}

function parseLegacyProviders(raw: string): ProviderConfig[] | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok || !Array.isArray(parsed.value)) return null;

  const result: ProviderConfig[] = [];
  for (const item of parsed.value) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || item.id.trim().length === 0) continue;
    result.push({
      id: item.id.trim(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name : item.id.trim(),
      rest_url: typeof item.rest_url === 'string' ? item.rest_url : '',
      ws_url: typeof item.ws_url === 'string' ? item.ws_url : '',
      is_active: Boolean(item.is_active),
    });
  }
  return result;
}

function hasPersistedProviderOverrides(
  sqliteProviders: ProviderConfig[],
  hasExistingPreferences = false
): boolean {
  if (!Array.isArray(sqliteProviders) || sqliteProviders.length === 0) {
    return false;
  }

  if (hasExistingPreferences) {
    // SQLite sudah memiliki app_preferences dari sesi sebelumnya; anggap status provider aktif saat ini disengaja
    return true;
  }

  for (const p of sqliteProviders) {
    if (!p || typeof p.id !== 'string') continue;
    const def = DEFAULT_PROVIDER_BY_ID.get(p.id);
    if (!def) {
      // Sudah ada provider kustom di SQLite
      return true;
    }
    if (p.id !== 'binance' && p.is_active) {
      // Pengguna sudah memilih provider aktif selain default awal di SQLite
      return true;
    }
    if (p.rest_url !== def.rest_url || p.ws_url !== def.ws_url) {
      // Konfigurasi endpoint bawaan sudah dimodifikasi di SQLite
      return true;
    }
  }

  return false;
}

async function migrateProviders(
  adapter: PersistenceAdapter,
  currentProviders: ProviderConfig[],
  legacyStorage: LegacyStorageLike,
  hasExistingPreferences = false
): Promise<ProviderConfig[] | null> {
  const rawProviders = safeGetItem(legacyStorage, 'trawangan_providers');
  if (rawProviders === null) return null;

  const legacyProviders = parseLegacyProviders(rawProviders);
  if (legacyProviders === null || legacyProviders.length === 0) {
    safeRemoveItem(legacyStorage, 'trawangan_providers');
    return null;
  }

  const sqliteById = new Map<string, ProviderConfig>(
    currentProviders.filter((p) => p && typeof p.id === 'string').map((p) => [p.id, p])
  );
  const sqliteHasOverrides = hasPersistedProviderOverrides(
    currentProviders,
    hasExistingPreferences
  );

  try {
    let wroteToSqlite = false;

    if (sqliteHasOverrides) {
      // Jangan pernah menimpa provider/status aktif SQLite; hanya selamatkan provider kustom yang belum ada
      for (const legacy of legacyProviders) {
        if (!DEFAULT_PROVIDER_BY_ID.has(legacy.id) && !sqliteById.has(legacy.id)) {
          await adapter.saveProvider({ ...legacy, is_active: false });
          wroteToSqlite = true;
        }
      }
    } else {
      const activeLegacy = legacyProviders.find((p) => p.is_active) ?? null;

      for (const legacy of legacyProviders) {
        if (activeLegacy && legacy.id === activeLegacy.id) continue;
        const existing = sqliteById.get(legacy.id);
        const isCustom = !DEFAULT_PROVIDER_BY_ID.has(legacy.id);
        const isModifiedEndpoint =
          existing !== undefined &&
          (existing.rest_url !== legacy.rest_url || existing.ws_url !== legacy.ws_url);
        const isModifiedDefaultNotSeeded =
          existing === undefined &&
          (() => {
            const def = DEFAULT_PROVIDER_BY_ID.get(legacy.id);
            return Boolean(def && (def.rest_url !== legacy.rest_url || def.ws_url !== legacy.ws_url));
          })();

        if (isCustom || isModifiedEndpoint || isModifiedDefaultNotSeeded || currentProviders.length === 0) {
          await adapter.saveProvider({ ...legacy, is_active: false });
          wroteToSqlite = true;
        }
      }

      if (activeLegacy) {
        const existingActive = sqliteById.get(activeLegacy.id);
        const needsSave =
          !existingActive ||
          !DEFAULT_PROVIDER_BY_ID.has(activeLegacy.id) ||
          existingActive.rest_url !== activeLegacy.rest_url ||
          existingActive.ws_url !== activeLegacy.ws_url;

        if (needsSave) {
          await adapter.saveProvider({ ...activeLegacy, is_active: true });
          wroteToSqlite = true;
        } else if (!existingActive.is_active) {
          await adapter.setActiveProvider(activeLegacy.id);
          wroteToSqlite = true;
        }
      }
    }

    const updatedProviders = wroteToSqlite ? await adapter.loadProviders() : null;
    safeRemoveItem(legacyStorage, 'trawangan_providers');
    return updatedProviders;
  } catch (err) {
    console.warn('[PersistenceService] Gagal migrasi trawangan_providers ke SQLite:', err);
    return null;
  }
}

async function cleanupOrphanTradingPlanVault(
  adapter: PersistenceAdapter,
  legacyStorage: LegacyStorageLike
): Promise<void> {
  const rawVault = safeGetItem(legacyStorage, 'trawangan_trade_plan_vault');
  if (rawVault === null) return;

  const parsed = parseJsonSafe(rawVault);
  const validRecords: SavedTradingPlanRecord[] =
    parsed.ok && Array.isArray(parsed.value)
      ? parsed.value.filter(
          (item): item is SavedTradingPlanRecord =>
            isPlainObject(item) &&
            typeof item.id === 'string' &&
            item.id.trim().length > 0 &&
            isPlainObject(item.plan)
        )
      : [];

  try {
    if (validRecords.length > 0) {
      const existingPlans = await adapter.listTradingPlans();
      if (existingPlans.length === 0) {
        for (const record of validRecords) {
          await adapter.upsertTradingPlan(record);
        }
      }
    }
    safeRemoveItem(legacyStorage, 'trawangan_trade_plan_vault');
  } catch (err) {
    console.warn('[PersistenceService] Gagal membersihkan/migrasi trawangan_trade_plan_vault:', err);
  }
}

export interface LegacyMigrationResult {
  providers: ProviderConfig[];
}

/**
 * Menjalankan migrasi satu kali kunci legacy Bucket A & B serta pembersihan kunci yatim
 * `trawangan_trade_plan_vault` ke adapter persisten (non-InMemoryLocalStorageAdapter).
 */
export async function migrateLegacyLocalStorage(params: {
  adapter: PersistenceAdapter;
  preferenceCache: Map<string, string>;
  currentProviders: ProviderConfig[];
  legacyStorage?: LegacyStorageLike | null;
}): Promise<LegacyMigrationResult> {
  const legacyStorage =
    params.legacyStorage === undefined ? resolveLegacyLocalStorage() : params.legacyStorage;

  if (!legacyStorage) {
    return { providers: params.currentProviders };
  }

  // Tangkap keberadaan app_preferences SQLite sebelum migrasi preferensi mengisi preferenceCache
  const hasExistingPreferences = params.preferenceCache.size > 0;

  await migrateAppSettings(params.adapter, params.preferenceCache, legacyStorage);
  await migrateMappedPreferences(params.adapter, params.preferenceCache, legacyStorage);
  const migratedProviders = await migrateProviders(
    params.adapter,
    params.currentProviders,
    legacyStorage,
    hasExistingPreferences
  );
  await cleanupOrphanTradingPlanVault(params.adapter, legacyStorage);

  return {
    providers: migratedProviders ?? params.currentProviders,
  };
}
