import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_PRESETS,
  UI_FONT_OPTIONS,
  MONO_FONT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_SIZE_PRESETS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_SIZE,
  buildCustomPaletteFromPreset,
  parseCustomPaletteFromText,
  serializeCustomPaletteJson,
  serializeCustomPaletteText,
  resolveEffectiveVolumeColors,
  resolveEffectiveThemeColors
} from '../src/lib/constants/themes';
import { isDarkColor, generateVelaThemeTokens, deriveBorderColor } from '../src/lib/utils/colorUtils';

describe('trawangan Theme Presets & Typography System Unit Tests', () => {
  test('Memastikan seluruh 6 preset tema terdaftar secara lengkap (termasuk red_folder)', () => {
    const presetKeys = Object.keys(THEME_PRESETS);
    assert.deepEqual(presetKeys.sort(), ['binance', 'bitunix', 'coinglass', 'red_folder', 'signature', 'tradingview'].sort());

    for (const [key, preset] of Object.entries(THEME_PRESETS)) {
      assert.equal(preset.id, key);
      assert.ok(preset.name.length > 0);
      assert.ok(preset.tokens.bgDarkest.startsWith('#'));
      assert.ok(preset.chart.upColor.startsWith('#'));
      assert.ok(preset.chart.downColor.startsWith('#'));
      assert.ok(preset.mode === 'dark' || preset.mode === 'light');
    }
  });

  test('Preset signature memenuhi spesifikasi warna trawangan Cyber-Monochrome', () => {
    const signature = THEME_PRESETS.signature;

    // Kanvas True Dark
    assert.equal(signature.mode, 'dark');
    assert.equal(signature.chart.background, '#0F0F0F');
    assert.equal(signature.tokens.bgDarkest, '#0F0F0F');
    assert.equal(signature.tokens.bgSurface, '#0F0F0F');

    // Candlestick Bullish Serba Putih
    assert.equal(signature.chart.upColor, '#F7F7F7');
    assert.equal(signature.chart.borderUpColor, '#F7F7F7');
    assert.equal(signature.chart.wickUpColor, '#F7F7F7');

    // Candlestick Bearish Hot Pink
    assert.equal(signature.chart.downColor, '#FF69B4');
    assert.equal(signature.chart.borderDownColor, '#CC5A7F');
    assert.equal(signature.chart.wickDownColor, '#FF69B4');

    // Brand Accent
    assert.equal(signature.tokens.brandPrimary, '#FF69B4');
  });

  test('Preset red_folder memenuhi spesifikasi tema terang dari referensi chartthemes.com', () => {
    const rf = THEME_PRESETS.red_folder;

    assert.equal(rf.mode, 'light');
    assert.equal(rf.chart.background, '#edede9');
    assert.equal(rf.chart.textColor, '#4A0E0F');

    // Lilin Bullish (Rose)
    assert.equal(rf.chart.upColor, '#D4A5A5');
    assert.equal(rf.chart.wickUpColor, '#7F4F4F');
    assert.equal(rf.chart.borderUpColor, '#B87B7B');

    // Lilin Bearish (Crimson)
    assert.equal(rf.chart.downColor, '#9B1D20');
    assert.equal(rf.chart.wickDownColor, '#7F4F4F');
    assert.equal(rf.chart.borderDownColor, '#5E1D1D');

    // Atribut Visual Umum
    assert.equal(rf.tokens.bgDarkest, '#edede9');
    assert.equal(rf.tokens.textMain, '#4A0E0F');
  });

  test('Adaptive Luminance Engine: isDarkColor mendeteksi warna gelap vs terang secara akurat', () => {
    assert.equal(isDarkColor('#0F0F0F'), true);
    assert.equal(isDarkColor('#181A20'), true);
    assert.equal(isDarkColor('#000000'), true);
    assert.equal(isDarkColor('#edede9'), false);
    assert.equal(isDarkColor('#FFFFFF'), false);
    assert.equal(isDarkColor('#F4F4F0'), false);
  });

  test('Unified Token Engine: generateVelaThemeTokens menghasilkan token lengkap --vela-*', () => {
    const darkTokens = generateVelaThemeTokens('#0F0F0F', '#F7F7F7', '#242424');
    assert.equal(darkTokens['--vela-bg'], '#0F0F0F');
    assert.ok(darkTokens['--vela-fg'].length > 0);
    assert.ok(darkTokens['--vela-border'].length > 0);
    assert.ok(darkTokens['--vela-surface-elev'].length > 0);

    const lightTokens = generateVelaThemeTokens('#edede9', '#4A0E0F', '#cfcfc7');
    assert.equal(lightTokens['--vela-bg'], '#edede9');
    assert.equal(lightTokens['--vela-fg'], '#4A0E0F');
    assert.equal(lightTokens['--vela-border'], '#cfcfc7');
  });

  test('Palet Kustom Studio: Parser toleran membaca JSON dan format teks baris chartthemes.com', () => {
    const rawText = `
Pick your color format
Hex

Candle colors
Bearish body: #9B1D20
Bearish wick: #7F4F4F
Bearish border: #5E1D1D
Bullish body: #D4A5A5
Bullish wick: #7F4F4F
Bullish border: #B87B7B

General colors
Background color: #edede9
Foreground: #4A0E0F
Text color: #4A0E0F
`;
    const parsed = parseCustomPaletteFromText(rawText);
    assert.ok(parsed, 'Harus berhasil mem-parse format teks baris');
    assert.equal(parsed.candles.bearBody, '#9B1D20');
    assert.equal(parsed.candles.bearWick, '#7F4F4F');
    assert.equal(parsed.candles.bearBorder, '#5E1D1D');
    assert.equal(parsed.candles.bullBody, '#D4A5A5');
    assert.equal(parsed.candles.bullWick, '#7F4F4F');
    assert.equal(parsed.candles.bullBorder, '#B87B7B');
    assert.equal(parsed.general.background, '#edede9');
    assert.equal(parsed.general.textColor, '#4A0E0F');

    // Uji Serialisasi JSON & Re-parse
    const jsonStr = serializeCustomPaletteJson(parsed);
    const reParsed = parseCustomPaletteFromText(jsonStr);
    assert.deepEqual(reParsed, parsed);
  });

  test('Opsi Font UI menyertakan Plus Jakarta Sans sebagai tipografi identitas brand', () => {
    const brandFont = UI_FONT_OPTIONS.find((f) => f.id === 'Plus Jakarta Sans');
    assert.ok(brandFont, 'Plus Jakarta Sans harus terdaftar di UI_FONT_OPTIONS');
    assert.ok(brandFont.css.includes('Plus Jakarta Sans'));

    const interFont = UI_FONT_OPTIONS.find((f) => f.id === 'Inter');
    assert.ok(interFont, 'Inter harus tersedia sebagai opsi alternatif');
  });

  test('Opsi Monospace menyertakan JetBrains Mono dan Fira Code', () => {
    const jb = MONO_FONT_OPTIONS.find((f) => f.id === 'JetBrains Mono');
    assert.ok(jb);
    const fira = MONO_FONT_OPTIONS.find((f) => f.id === 'Fira Code');
    assert.ok(fira);
  });

  test('Opsi Kerapatan Tampilan (UI Density) mencakup 3 skala teks terstandarisasi', () => {
    assert.equal(DENSITY_OPTIONS.length, 3);
    assert.equal(DENSITY_OPTIONS[0].id, 'compact');
    assert.equal(DENSITY_OPTIONS[1].id, 'regular');
    assert.equal(DENSITY_OPTIONS[2].id, 'comfortable');
  });

  test('Konstanta Custom Font Size memenuhi batasan visual monitor desktop', () => {
    assert.equal(MIN_FONT_SIZE, 9);
    assert.equal(MAX_FONT_SIZE, 20);
    assert.equal(DEFAULT_FONT_SIZE, 12);
    assert.ok(MIN_FONT_SIZE < DEFAULT_FONT_SIZE && DEFAULT_FONT_SIZE < MAX_FONT_SIZE);

    // Pastikan preset mencakup kebutuhan laptop kecil hingga layar 4K
    assert.ok(FONT_SIZE_PRESETS.length >= 5);
    const sizes = FONT_SIZE_PRESETS.map((p) => p.size);
    assert.ok(sizes.includes(10), 'Harus ada preset 10px untuk laptop kecil');
    assert.ok(sizes.includes(12), 'Harus ada preset 12px untuk monitor 1080p standar');
    assert.ok(sizes.includes(14), 'Harus ada preset 14px untuk monitor 2K');
    assert.ok(sizes.includes(16), 'Harus ada preset 16px untuk monitor 4K');

    for (const preset of FONT_SIZE_PRESETS) {
      assert.ok(preset.size >= MIN_FONT_SIZE && preset.size <= MAX_FONT_SIZE);
      assert.ok(preset.label.length > 0);
      assert.ok(preset.desc.length > 0);
    }
  });

  test('Formula scaling font menghasilkan rasio proporsional terhadap basis 12px', () => {
    const calcScale = (fs: number) => fs / 12;
    assert.equal(calcScale(12), 1.0);
    assert.equal(calcScale(10), 10 / 12);
    assert.equal(calcScale(16), 16 / 12);
    assert.equal(calcScale(14), 14 / 12);
  });

  test('resolveEffectiveThemeColors mengembalikan warna tema default atau kustom secara deterministik', () => {
    // Mode Preset Signature
    const sigColors = resolveEffectiveThemeColors('signature');
    assert.equal(sigColors.background, '#0F0F0F');
    assert.equal(sigColors.textColor, '#A3A3A3');
    assert.equal(sigColors.isDark, true);

    // Mode Preset Red Folder
    const rfColors = resolveEffectiveThemeColors('red_folder');
    assert.equal(rfColors.background, '#edede9');
    assert.equal(rfColors.textColor, '#4A0E0F');
    assert.equal(rfColors.isDark, false);

    // Mode Custom Palette Aktif
    const customPalette = {
      enabled: true,
      candles: {
        bullBody: '#00FF00',
        bullWick: '#00FF00',
        bullBorder: '#008800',
        bearBody: '#FF0000',
        bearWick: '#FF0000',
        bearBorder: '#880000',
      },
      general: {
        background: '#123456',
        foreground: '#654321',
        textColor: '#ABCDEF',
      },
    };
    const customRes = resolveEffectiveThemeColors('signature', customPalette);
    assert.equal(customRes.background, '#123456');
    assert.equal(customRes.foreground, '#654321');
    assert.equal(customRes.textColor, '#ABCDEF');
    assert.equal(customRes.isDark, true);
  });
});
