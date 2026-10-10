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
  DEFAULT_FONT_SIZE
} from '../src/lib/constants/themes';

describe('trawangan Theme Presets & Typography System Unit Tests', () => {
  test('Memastikan seluruh 5 preset tema terdaftar secara lengkap', () => {
    const presetKeys = Object.keys(THEME_PRESETS);
    assert.deepEqual(presetKeys.sort(), ['binance', 'bitunix', 'coinglass', 'signature', 'tradingview'].sort());

    for (const [key, preset] of Object.entries(THEME_PRESETS)) {
      assert.equal(preset.id, key);
      assert.ok(preset.name.length > 0);
      assert.ok(preset.tokens.bgDarkest.startsWith('#'));
      assert.ok(preset.chart.upColor.startsWith('#'));
      assert.ok(preset.chart.downColor.startsWith('#'));
    }
  });

  test('Preset signature memenuhi spesifikasi warna trawangan Cyber-Monochrome', () => {
    const signature = THEME_PRESETS.signature;

    // Kanvas True Dark
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
});
