// Unit & Integration Tests untuk System Theme Bridge dan Header Color Mode Switcher (Tiket #148)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import {
  resolveEffectiveThemePreset,
  getNextColorMode,
  THEME_PRESETS
} from '../src/lib/constants/themes';
import type { ColorModePreference, AppSettings } from '../src/lib/types/market';

describe('Tiket #148: System Theme Bridge and Header Color Mode Switcher Suite', () => {
  describe('1. resolveEffectiveThemePreset Helper Unit Tests', () => {
    test('preferensi "dark" selalu menghasilkan activeDarkPreset', () => {
      const preset = resolveEffectiveThemePreset(
        'dark',
        false, // system is light
        'signature',
        'bitunix',
        'red_folder'
      );
      assert.equal(preset, 'bitunix', 'Mode dark harus mengembalikan activeDarkPreset');
    });

    test('preferensi "light" selalu menghasilkan activeLightPreset', () => {
      const preset = resolveEffectiveThemePreset(
        'light',
        true, // system is dark
        'signature',
        'signature',
        'red_folder'
      );
      assert.equal(preset, 'red_folder', 'Mode light harus mengembalikan activeLightPreset');
    });

    test('preferensi "system" dengan systemIsDark = true menghasilkan activeDarkPreset', () => {
      const preset = resolveEffectiveThemePreset(
        'system',
        true,
        'signature',
        'binance',
        'red_folder'
      );
      assert.equal(preset, 'binance', 'System dark harus mengembalikan activeDarkPreset');
    });

    test('preferensi "system" dengan systemIsDark = false menghasilkan activeLightPreset', () => {
      const preset = resolveEffectiveThemePreset(
        'system',
        false,
        'signature',
        'signature',
        'red_folder'
      );
      assert.equal(preset, 'red_folder', 'System light harus mengembalikan activeLightPreset');
    });

    test('fallback aman jika darkPreset atau lightPreset tidak didefinisikan', () => {
      // Dark fallback
      const darkFallback = resolveEffectiveThemePreset(
        'dark',
        true,
        'tradingview',
        undefined as any,
        undefined as any
      );
      assert.equal(darkFallback, 'tradingview', 'Fallback harus digunakan jika darkPreset kosong');

      // Light fallback default ke red_folder
      const lightFallback = resolveEffectiveThemePreset(
        'light',
        false,
        'signature',
        undefined as any,
        undefined as any
      );
      assert.equal(lightFallback, 'red_folder', 'Default light fallback harus red_folder');
    });

    test('default parameter: tanpa argumen menghasilkan preset default aman', () => {
      const result = resolveEffectiveThemePreset();
      assert.equal(result, 'signature');
    });
  });

  describe('2. AppSettings & resolveAppSettings Seam Suite', () => {
    test('DEFAULT_APP_SETTINGS memuat konfigurasi mode warna bawaan', () => {
      assert.equal(DEFAULT_APP_SETTINGS.colorModePreference, 'system');
      assert.equal(DEFAULT_APP_SETTINGS.activeDarkPreset, 'signature');
      assert.equal(DEFAULT_APP_SETTINGS.activeLightPreset, 'red_folder');
    });

    test('resolveAppSettings(null) menyertakan nilai default mode warna', () => {
      const resolved = resolveAppSettings(null);
      assert.equal(resolved.colorModePreference, 'system');
      assert.equal(resolved.activeDarkPreset, 'signature');
      assert.equal(resolved.activeLightPreset, 'red_folder');
    });

    test('resolveAppSettings({}) mengisi nilai default untuk preferensi kosong', () => {
      const resolved = resolveAppSettings({});
      assert.equal(resolved.colorModePreference, 'system');
      assert.equal(resolved.activeDarkPreset, 'signature');
      assert.equal(resolved.activeLightPreset, 'red_folder');
    });

    test('resolveAppSettings mempertahankan preferensi tersimpan yang valid', () => {
      const saved: Partial<AppSettings> = {
        colorModePreference: 'dark',
        activeDarkPreset: 'tradingview',
        activeLightPreset: 'red_folder',
      };
      const resolved = resolveAppSettings(saved);
      assert.equal(resolved.colorModePreference, 'dark');
      assert.equal(resolved.activeDarkPreset, 'tradingview');
      assert.equal(resolved.activeLightPreset, 'red_folder');
    });

    test('resolveAppSettings menormalkan nilai colorModePreference yang tidak valid menjadi "system"', () => {
      const invalidSaved = {
        colorModePreference: 'neon_invalid' as any,
        activeDarkPreset: 'signature',
      };
      const resolved = resolveAppSettings(invalidSaved);
      assert.equal(resolved.colorModePreference, 'system');
    });
  });

  describe('3. getNextColorMode Cycle Logic Unit Tests', () => {
    test('siklus pergantian mode warna: dark -> light -> system -> dark', () => {
      assert.equal(getNextColorMode('dark'), 'light');
      assert.equal(getNextColorMode('light'), 'system');
      assert.equal(getNextColorMode('system'), 'dark');
    });

    test('siklus 3 kali dari mode awal kembali ke mode awal', () => {
      let mode: ColorModePreference = 'dark';
      mode = getNextColorMode(mode);
      assert.equal(mode, 'light');
      mode = getNextColorMode(mode);
      assert.equal(mode, 'system');
      mode = getNextColorMode(mode);
      assert.equal(mode, 'dark');
    });

    test('input tidak dikenal fallback ke dark', () => {
      assert.equal(getNextColorMode('unknown' as any), 'dark');
    });
  });

  describe('4. Header Component Mode Switcher Integration & Markup Contract', () => {
    const headerPath = path.resolve(process.cwd(), 'src/lib/components/Header.svelte');
    const headerContent = fs.readFileSync(headerPath, 'utf8');

    test('Header.svelte mengimpor ikon Moon, Sun, dan Monitor dari @lucide/svelte', () => {
      assert.match(headerContent, /Moon/, 'Header harus mengimpor ikon Moon');
      assert.match(headerContent, /Sun/, 'Header harus mengimpor ikon Sun');
      assert.match(headerContent, /Monitor/, 'Header harus mengimpor ikon Monitor');
    });

    test('Header.svelte mendefinisikan prop colorModePreference dan handler pergantian mode', () => {
      assert.match(
        headerContent,
        /colorModePreference/,
        'Header props harus mendukung colorModePreference'
      );
      assert.match(
        headerContent,
        /onCycleColorMode|onColorModeChange/,
        'Header props harus mendukung callback pergantian mode warna'
      );
    });

    test('Header.svelte merender tombol switcher dengan kelas .color-mode-btn', () => {
      assert.match(
        headerContent,
        /class="[^"]*color-mode-btn[^"]*"/,
        'Header harus menyertakan tombol dengan class color-mode-btn'
      );
    });

    test('Header.svelte menampilkan ikon Moon pada mode dark, Sun pada mode light, dan Monitor pada mode system', () => {
      assert.match(
        headerContent,
        /<Moon/,
        'Header harus merender Moon saat mode dark'
      );
      assert.match(
        headerContent,
        /<Sun/,
        'Header harus merender Sun saat mode light'
      );
      assert.match(
        headerContent,
        /<Monitor/,
        'Header harus merender Monitor saat mode system'
      );
    });
  });

  describe('5. AppearanceTab Settings UI Contract for Mode Preference and Defaults', () => {
    const tabPath = path.resolve(process.cwd(), 'src/lib/components/settings/AppearanceTab.svelte');
    const tabContent = fs.readFileSync(tabPath, 'utf8');

    test('AppearanceTab.svelte menyediakan kontrol pemilihan colorModePreference (system, dark, light)', () => {
      assert.match(
        tabContent,
        /colorModePreference/,
        'AppearanceTab harus mengelola colorModePreference'
      );
      assert.match(
        tabContent,
        /Ikuti Sistem|Mode Gelap|Mode Terang/i,
        'AppearanceTab harus memiliki label opsi untuk Ikuti Sistem, Gelap, dan Terang'
      );
    });

    test('AppearanceTab.svelte menyediakan pemilih preset default gelap (activeDarkPreset)', () => {
      assert.match(
        tabContent,
        /activeDarkPreset/,
        'AppearanceTab harus menyediakan kontrol pemilihan activeDarkPreset'
      );
    });

    test('AppearanceTab.svelte menyediakan pemilih preset default terang (activeLightPreset)', () => {
      assert.match(
        tabContent,
        /activeLightPreset/,
        'AppearanceTab harus menyediakan kontrol pemilihan activeLightPreset'
      );
    });
  });

  describe('6. Root Page (+page.svelte) System Theme Bridge Seam', () => {
    const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    test('+page.svelte mendengarkan media query matchMedia("(prefers-color-scheme: dark)")', () => {
      assert.match(
        pageContent,
        /prefers-color-scheme:\s*dark/,
        '+page.svelte harus memiliki listener matchMedia untuk prefers-color-scheme: dark'
      );
    });

    test('+page.svelte menggunakan resolveEffectiveThemePreset untuk menentukan preset aktif', () => {
      assert.match(
        pageContent,
        /resolveEffectiveThemePreset/,
        '+page.svelte harus memanggil resolveEffectiveThemePreset'
      );
    });

    test('+page.svelte meneruskan handler mode warna ke Header', () => {
      assert.match(
        pageContent,
        /<Header[\s\S]*?colorModePreference[\s\S]*?\/>/,
        '+page.svelte harus meneruskan colorModePreference ke Header'
      );
    });
  });
});
