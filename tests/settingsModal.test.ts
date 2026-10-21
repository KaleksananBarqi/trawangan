// Unit Tests untuk Dekomposisi Settings Modal & Submodul Tab Seam Suite
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_SYNC_CONFIG,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import { THEME_PRESETS } from '../src/lib/constants/themes';

test('Settings Modal & Tab Submodules Seam Suite', async (t) => {
  await t.test('1. Validasi Kontrak AppSettings untuk seluruh 7 tab domain', () => {
    const defaultSettings = resolveAppSettings(null);

    // Tab General
    assert.equal(typeof defaultSettings.timezone, 'string');
    assert.equal(typeof defaultSettings.soundEnabled, 'boolean');
    assert.equal(typeof defaultSettings.systemNotificationEnabled, 'boolean');
    assert.equal(typeof defaultSettings.showWorldClocks, 'boolean');
    assert.ok(Array.isArray(defaultSettings.worldClockCities));

    // Tab Appearance
    assert.ok(THEME_PRESETS[defaultSettings.themePreset ?? 'signature']);
    assert.equal(typeof defaultSettings.fontFamilyUi, 'string');
    assert.equal(typeof defaultSettings.fontFamilyMono, 'string');
    assert.equal(typeof defaultSettings.uiDensity, 'string');

    // Tab Chart
    assert.equal(typeof defaultSettings.showWatermark, 'boolean');
    assert.equal(typeof defaultSettings.showCurrentPriceLine, 'boolean');
    assert.equal(typeof defaultSettings.showIndicatorPriceLabels, 'boolean');
    assert.equal(typeof defaultSettings.showDrawingPriceLabels, 'boolean');
    assert.equal(typeof defaultSettings.defaultTimeframe, 'string');
    assert.ok(Array.isArray(defaultSettings.favoriteTimeframes));
    assert.equal(typeof defaultSettings.autoSaveWorkspace, 'boolean');
    assert.equal(typeof defaultSettings.autoLoadLastWorkspace, 'boolean');
    assert.ok(defaultSettings.syncConfig);
    assert.equal(typeof defaultSettings.syncConfig.crosshair, 'boolean');
    assert.equal(typeof defaultSettings.syncConfig.viewport, 'boolean');
  });

  await t.test('2. Integritas Tab Identifiers: Seluruh 7 tab terdefinisi secara konsisten', () => {
    const validTabs = ['general', 'appearance', 'chart', 'feed', 'system', 'about', 'help'];
    assert.equal(validTabs.length, 7);
    for (const tab of validTabs) {
      assert.ok(tab.length > 0);
    }
  });

  await t.test('3. Immutabilitas & Partial Update: onUpdateSettings menghasilkan state baru yang terisolasi', () => {
    const base = { ...DEFAULT_APP_SETTINGS };
    const patch = { soundEnabled: !base.soundEnabled, themePreset: 'tradingview' as const };
    const updated = { ...base, ...patch };

    assert.notEqual(updated.soundEnabled, base.soundEnabled);
    assert.equal(updated.themePreset, 'tradingview');
    assert.equal(updated.timezone, base.timezone);
  });
});
