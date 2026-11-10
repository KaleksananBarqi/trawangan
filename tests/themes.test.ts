import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
import { DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import { assembleThemeCssBundle } from '../src/lib/services/themeEngine';
import {
  isDarkColor,
  generateVelaThemeTokens,
  deriveBorderColor,
  ensureReadableTextColor,
  getRelativeLuminance,
  getContrastRatio,
  resolveContrastTextColor,
  resolveReadableBullText
} from '../src/lib/utils/colorUtils';

describe('trawangan Theme Presets & Typography System Unit Tests', () => {
  const EXPECTED_PRESET_IDS = [
    'signature',
    'binance',
    'bitunix',
    'tradingview',
    'coinglass',
    'red_folder',
    'ngrembaka',
    'kopi_tubruk',
    'pundi_arta',
    'geni_mrengkang',
    'rega_pasar',
    'watu_putih',
    'samodra_wengi',
    'undhuh_dana',
    'laku_batin',
    'pasar_esuk',
    'segara_jero',
    'getih_segara',
    'tutup_sasi',
    'gading_ijo',
    'kilat_wengi',
    'sekar_jambon',
    'kuning_kunir',
    'mas_kencana',
    'tengah_wengi',
    'wangsit_lembah',
    'dana_lestari',
    'peken_ijo',
    'surya_baskara',
    'paring_eling',
    'sapu_tirta',
    'lembayung_awan',
    'kopi_klotok',
    'rame_sore',
    'ayem_tentrem',
    'banyu_segara',
    'wates_dhuwur',
  ];

  test('Memastikan seluruh 37 preset tema terdaftar secara lengkap (6 bawaan + 31 tema Jawa)', () => {
    const presetKeys = Object.keys(THEME_PRESETS);
    assert.deepEqual(presetKeys.sort(), [...EXPECTED_PRESET_IDS].sort());
    assert.equal(presetKeys.length, 37);

    const uniqueNames = new Set<string>();
    const hex6Regex = /^#[0-9A-Fa-f]{6}$/;

    for (const [key, preset] of Object.entries(THEME_PRESETS)) {
      assert.equal(preset.id, key);
      assert.ok(preset.name.length > 0);
      assert.ok(preset.description.trim().length > 0, `${key}.description harus non-kosong`);
      assert.ok(!uniqueNames.has(preset.name), `Nama preset duplikat: ${preset.name}`);
      uniqueNames.add(preset.name);

      assert.match(preset.tokens.bgDarkest, hex6Regex, `${key}.tokens.bgDarkest harus hex 6 digit`);
      assert.match(preset.chart.background, hex6Regex, `${key}.chart.background harus hex 6 digit`);
      assert.match(preset.chart.textColor, hex6Regex, `${key}.chart.textColor harus hex 6 digit`);
      assert.match(preset.chart.upColor, hex6Regex, `${key}.chart.upColor harus hex 6 digit`);
      assert.match(preset.chart.downColor, hex6Regex, `${key}.chart.downColor harus hex 6 digit`);
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

  test('Preset red_folder (Warta Abang) memenuhi spesifikasi tema terang versi Jawa yang telah digeser warnanya', () => {
    const rf = THEME_PRESETS.red_folder;

    assert.equal(rf.name, 'Warta Abang');
    assert.equal(rf.mode, 'light');
    assert.equal(rf.chart.background, '#EAEAE5');
    assert.equal(rf.chart.textColor, '#4E1112');

    // Lilin Bullish (Rose tergeser)
    assert.equal(rf.chart.upColor, '#CF9F9F');
    assert.equal(rf.chart.wickUpColor, '#7A4C4C');
    assert.equal(rf.chart.borderUpColor, '#B17575');

    // Lilin Bearish (Crimson tergeser)
    assert.equal(rf.chart.downColor, '#941B1E');
    assert.equal(rf.chart.wickDownColor, '#7A4C4C');
    assert.equal(rf.chart.borderDownColor, '#591B1B');

    // Atribut Visual Umum
    assert.equal(rf.tokens.bgDarkest, '#EAEAE5');
    assert.equal(rf.tokens.textMain, '#4E1112');
  });

  test('Kategorisasi Terang/Gelap dan keterbacaan teks konsisten untuk seluruh 37 preset', () => {
    const darkPresets = Object.values(THEME_PRESETS).filter((p) => p.mode === 'dark');
    const lightPresets = Object.values(THEME_PRESETS).filter((p) => p.mode === 'light');

    assert.equal(darkPresets.length, 18, 'Harus ada tepat 18 tema gelap (5 legacy + 13 Jawa)');
    assert.equal(lightPresets.length, 19, 'Harus ada tepat 19 tema terang (1 Warta Abang + 18 Jawa)');

    const legacyIds = new Set(['signature', 'binance', 'bitunix', 'tradingview', 'coinglass']);

    for (const preset of Object.values(THEME_PRESETS)) {
      const expectedDark = preset.mode === 'dark';
      assert.equal(
        isDarkColor(preset.chart.background),
        expectedDark,
        `${preset.id} chart.background (${preset.chart.background}) tidak cocok dengan mode=${preset.mode}`
      );
      assert.equal(
        isDarkColor(preset.tokens.bgDarkest),
        expectedDark,
        `${preset.id} tokens.bgDarkest (${preset.tokens.bgDarkest}) tidak cocok dengan mode=${preset.mode}`
      );
      assert.equal(
        ensureReadableTextColor(preset.tokens.bgDarkest, preset.tokens.textMain),
        preset.tokens.textMain,
        `${preset.id} textMain (${preset.tokens.textMain}) terbaca terbalik terhadap bgDarkest (${preset.tokens.bgDarkest})`
      );
      if (!legacyIds.has(preset.id)) {
        assert.equal(
          ensureReadableTextColor(preset.chart.background, preset.chart.textColor),
          preset.chart.textColor,
          `${preset.id} chart.textColor (${preset.chart.textColor}) terbaca terbalik terhadap chart.background (${preset.chart.background})`
        );
      }
    }
  });

  test('Seluruh 32 preset Jawa memiliki variasi warna berbeda (shifted) pada seluruh 8 atribut dari referensi web mentah', () => {
    interface RawWebThemeRef {
      bg: string;
      text: string;
      bullBody: string;
      bullWick: string;
      bullBorder: string;
      bearBody: string;
      bearWick: string;
      bearBorder: string;
    }

    const rawWebReferences: Record<string, RawWebThemeRef> = {
      red_folder: {
        bg: '#EDEDE9', text: '#4A0E0F',
        bullBody: '#D4A5A5', bullWick: '#7F4F4F', bullBorder: '#B87B7B',
        bearBody: '#9B1D20', bearWick: '#7F4F4F', bearBorder: '#5E1D1D',
      },
      ngrembaka: {
        bg: '#FFFAFA', text: '#333333',
        bullBody: '#50C878', bullWick: '#45A46A', bullBorder: '#45A46A',
        bearBody: '#006400', bearWick: '#004B23', bearBorder: '#004B00',
      },
      kopi_tubruk: {
        bg: '#FFF8E7', text: '#5C4033',
        bullBody: '#D2B48C', bullWick: '#B87333', bullBorder: '#C19A6B',
        bearBody: '#A0522D', bearWick: '#B87333', bearBorder: '#8B4513',
      },
      pundi_arta: {
        bg: '#001A00', text: '#DCDCDC',
        bullBody: '#B0C4B1', bullWick: '#98A898', bullBorder: '#DCDCDC',
        bearBody: '#82B382', bearWick: '#98A898', bearBorder: '#006666',
      },
      geni_mrengkang: {
        bg: '#FFF5EE', text: '#FF4500',
        bullBody: '#FF7F50', bullWick: '#FF7F50', bullBorder: '#E66A46',
        bearBody: '#FF4500', bearWick: '#FF4500', bearBorder: '#CC3700',
      },
      rega_pasar: {
        bg: '#F0FFFF', text: '#4682B4',
        bullBody: '#4682B4', bullWick: '#1E90FF', bullBorder: '#4169E1',
        bearBody: '#FF6347', bearWick: '#CD5C5C', bearBorder: '#E03D00',
      },
      watu_putih: {
        bg: '#FFFFFF', text: '#333333',
        bullBody: '#4D4D4D', bullWick: '#505050', bullBorder: '#3D3D3D',
        bearBody: '#A9A9A9', bearWick: '#8A8A8A', bearBorder: '#7A7A7A',
      },
      samodra_wengi: {
        bg: '#000033', text: '#B0CFFF',
        bullBody: '#00BFFF', bullWick: '#1E90FF', bullBorder: '#009ACD',
        bearBody: '#FF6347', bearWick: '#FF4500', bearBorder: '#E03D00',
      },
      undhuh_dana: {
        bg: '#1A1A1A', text: '#CFCFCF',
        bullBody: '#008080', bullWick: '#5F9EA0', bullBorder: '#5F9EA0',
        bearBody: '#2F4F4F', bearWick: '#2F4F4F', bearBorder: '#2F4F4F',
      },
      laku_batin: {
        bg: '#F5F5F5', text: '#333333',
        bullBody: '#808080', bullWick: '#696969', bullBorder: '#707070',
        bearBody: '#A9A9A9', bearWick: '#696969', bearBorder: '#B0B0B0',
      },
      pasar_esuk: {
        bg: '#F5F5F5', text: '#333333',
        bullBody: '#4D4D4D', bullWick: '#696969', bullBorder: '#3D3D3D',
        bearBody: '#A9A9A9', bearWick: '#B0B0B0', bearBorder: '#8A8A8A',
      },
      segara_jero: {
        bg: '#00001A', text: '#B0CFFF',
        bullBody: '#E0E0E0', bullWick: '#A0A0B0', bullBorder: '#D8D8D8',
        bearBody: '#1E90FF', bearWick: '#A0A0B0', bearBorder: '#176ACC',
      },
      getih_segara: {
        bg: '#1A0A0A', text: '#FFDADA',
        bullBody: '#D3B3B3', bullWick: '#A09090', bullBorder: '#C0A8A8',
        bearBody: '#B28282', bearWick: '#A09090', bearBorder: '#907070',
      },
      tutup_sasi: {
        bg: '#00001A', text: '#A0B8FF',
        bullBody: '#D8D8E8', bullWick: '#6B6B8B', bullBorder: '#C8C8D8',
        bearBody: '#A0A8D0', bearWick: '#6B6B8B', bearBorder: '#8088B0',
      },
      gading_ijo: {
        bg: '#FAFAD2', text: '#228B22',
        bullBody: '#32CD32', bullWick: '#32CD32', bullBorder: '#28A028',
        bearBody: '#FF6347', bearWick: '#FF6347', bearBorder: '#CC503A',
      },
      kilat_wengi: {
        bg: '#000000', text: '#E0E0E0',
        bullBody: '#00FA9A', bullWick: '#00FA9A', bullBorder: '#00D486',
        bearBody: '#FF4500', bearWick: '#FF4500', bearBorder: '#CC3700',
      },
      sekar_jambon: {
        bg: '#FFF0F5', text: '#C71585',
        bullBody: '#FFB6C1', bullWick: '#CC5A7F', bullBorder: '#E69A9A',
        bearBody: '#FF69B4', bearWick: '#FF69B4', bearBorder: '#CC5A7F',
      },
      kuning_kunir: {
        bg: '#FDFEFE', text: '#E67E22',
        bullBody: '#F1C40F', bullWick: '#F39C12', bullBorder: '#D4AC0D',
        bearBody: '#E74C3C', bearWick: '#C0392B', bearBorder: '#B03A2E',
      },
      mas_kencana: {
        bg: '#E5E3DF', text: '#5C4033',
        bullBody: '#DAA520', bullWick: '#C0A040', bullBorder: '#B8860B',
        bearBody: '#B8860B', bearWick: '#8B6508', bearBorder: '#8B6508',
      },
      tengah_wengi: {
        bg: '#000000', text: '#E0E0E0',
        bullBody: '#D3D3D3', bullWick: '#D3D3D3', bullBorder: '#BEBEBE',
        bearBody: '#A9A9A9', bearWick: '#A9A9A9', bearBorder: '#8C8C8C',
      },
      wangsit_lembah: {
        bg: '#F0F0F0', text: '#2F4F4F',
        bullBody: '#2F4F4F', bullWick: '#556B2F', bullBorder: '#3E5F5F',
        bearBody: '#A9A9A9', bearWick: '#696969', bearBorder: '#909090',
      },
      dana_lestari: {
        bg: '#F5F5DC', text: '#5C4033',
        bullBody: '#556B2F', bullWick: '#7F9446', bullBorder: '#4B5E29',
        bearBody: '#6B8E23', bearWick: '#84A54A', bearBorder: '#5A7B1F',
      },
      peken_ijo: {
        bg: '#F5FFFA', text: '#228B22',
        bullBody: '#32CD32', bullWick: '#32CD32', bullBorder: '#28A028',
        bearBody: '#FF6347', bearWick: '#FF6347', bearBorder: '#CC503A',
      },
      surya_baskara: {
        bg: '#0E1017', text: '#FFFFFF',
        bullBody: '#FF8F40', bullWick: '#8F5125', bullBorder: '#FF8F40',
        bearBody: '#BBB9B2', bearWick: '#8F5125', bearBorder: '#BBB9B2',
      },
      paring_eling: {
        bg: '#FFF5EE', text: '#8B4513',
        bullBody: '#D2691E', bullWick: '#CD853F', bullBorder: '#BA5E1A',
        bearBody: '#B22222', bearWick: '#A52A2A', bearBorder: '#9E1E1E',
      },
      sapu_tirta: {
        bg: '#101010', text: '#B0E0E6',
        bullBody: '#B0E0E6', bullWick: '#AFEEEE', bullBorder: '#9CC5C5',
        bearBody: '#1E90FF', bearWick: '#6495ED', bearBorder: '#1A7ACC',
      },
      lembayung_awan: {
        bg: '#E6E6FA', text: '#4B0082',
        bullBody: '#9370DB', bullWick: '#BA55D3', bullBorder: '#7A60BF',
        bearBody: '#8B008B', bearWick: '#9400D3', bearBorder: '#78007A',
      },
      kopi_klotok: {
        bg: '#F8EDE3', text: '#8B4513',
        bullBody: '#D0B8A8', bullWick: '#8D493A', bullBorder: '#8D493A',
        bearBody: '#8D493A', bearWick: '#8D493A', bearBorder: '#8D493A',
      },
      rame_sore: {
        bg: '#0C0D10', text: '#FFFFFF',
        bullBody: '#00B54C', bullWick: '#88898B', bullBorder: '#66BB6A',
        bearBody: '#E12020', bearWick: '#88898B', bearBorder: '#F7525F',
      },
      ayem_tentrem: {
        bg: '#141414', text: '#E0FFFF',
        bullBody: '#E0FFFF', bullWick: '#E0FFFF', bullBorder: '#C0D9D9',
        bearBody: '#4682B4', bearWick: '#4682B4', bearBorder: '#3B6A93',
      },
      banyu_segara: {
        bg: '#ECF0F1', text: '#2C3E50',
        bullBody: '#1ABC9C', bullWick: '#16A085', bullBorder: '#16A085',
        bearBody: '#E74C3C', bearWick: '#C0392B', bearBorder: '#C0392B',
      },
      wates_dhuwur: {
        bg: '#121212', text: '#E0E0E0',
        bullBody: '#B0B0B0', bullWick: '#A0A0A0', bullBorder: '#D0D0D0',
        bearBody: '#5A5A5A', bearWick: '#4A4A4A', bearBorder: '#3F3F3F',
      },
    };

    assert.equal(Object.keys(rawWebReferences).length, 32);

    for (const [id, raw] of Object.entries(rawWebReferences)) {
      const preset = THEME_PRESETS[id as keyof typeof THEME_PRESETS];
      assert.ok(preset, `Preset ${id} harus ada`);
      const pairs: Array<[string, string, string]> = [
        ['chart.background', preset.chart.background, raw.bg],
        ['chart.textColor', preset.chart.textColor, raw.text],
        ['chart.upColor', preset.chart.upColor, raw.bullBody],
        ['chart.wickUpColor', preset.chart.wickUpColor, raw.bullWick],
        ['chart.borderUpColor', preset.chart.borderUpColor, raw.bullBorder],
        ['chart.downColor', preset.chart.downColor, raw.bearBody],
        ['chart.wickDownColor', preset.chart.wickDownColor, raw.bearWick],
        ['chart.borderDownColor', preset.chart.borderDownColor, raw.bearBorder],
      ];
      for (const [field, actual, original] of pairs) {
        assert.notEqual(
          actual.toUpperCase(),
          original.toUpperCase(),
          `${id}.${field} (${actual}) tidak boleh identik mentah dengan referensi web (${original})`
        );
      }
    }
  });

  test('Sinkronisasi CSS & Kepatuhan Kontras WCAG AA: seluruh preset di src/styles/theme.css memiliki token valid & kontras >= 4.5:1', () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/theme.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    for (const [id, preset] of Object.entries(THEME_PRESETS)) {
      if (id === 'signature') continue;
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockRegex = new RegExp(`\\[data-theme="${escapedId}"\\]\\s*\\{([\\s\\S]*?)\\}`);
      const match = cssContent.match(blockRegex);
      assert.ok(match, `Selector [data-theme="${id}"] wajib ada di src/styles/theme.css`);

      const block = match[1];
      assert.match(block, new RegExp(`--bg-darkest:\\s*${preset.tokens.bgDarkest}`, 'i'));
      assert.match(block, new RegExp(`--text-main:\\s*${preset.tokens.textMain}`, 'i'));
      assert.match(block, new RegExp(`--bull-color:\\s*${preset.tokens.bullColor}`, 'i'));
      assert.match(block, new RegExp(`--bear-color:\\s*${preset.tokens.bearColor}`, 'i'));
      assert.match(block, new RegExp(`--brand-primary:\\s*${preset.tokens.brandPrimary}`, 'i'));

      const bullTextMatch = block.match(/--bull-text:\s*(#[0-9A-Fa-f]{6})/);
      const bullTextCss = bullTextMatch ? bullTextMatch[1] : preset.tokens.bullColor;
      const expectedBullText = resolveReadableBullText(
        preset.tokens.bgSurface,
        preset.tokens.bgPanel,
        preset.tokens.bullColor,
        preset.mode === 'dark'
      );
      assert.equal(
        bullTextCss.toUpperCase(),
        expectedBullText.toUpperCase(),
        `${id} --bull-text CSS (${bullTextCss}) harus selaras dengan resolveReadableBullText (${expectedBullText})`
      );

      assert.ok(
        getContrastRatio(bullTextCss, preset.tokens.bgDarkest) >= 4.5,
        `${id} --bull-text (${bullTextCss}) gagal WCAG AA terhadap bgDarkest (${preset.tokens.bgDarkest})`
      );
      assert.ok(
        getContrastRatio(bullTextCss, preset.tokens.bgPanel) >= 4.5,
        `${id} --bull-text (${bullTextCss}) gagal WCAG AA terhadap bgPanel (${preset.tokens.bgPanel})`
      );

      const onBrandMatch = block.match(/--on-brand-primary:\s*(#[0-9A-Fa-f]{6})/);
      const onBullMatch = block.match(/--on-bull-color:\s*(#[0-9A-Fa-f]{6})/);
      const onBearMatch = block.match(/--on-bear-color:\s*(#[0-9A-Fa-f]{6})/);
      assert.ok(onBrandMatch && onBullMatch && onBearMatch, `${id} wajib mendeklarasikan token --on-*`);
      assert.equal(onBrandMatch[1].toUpperCase(), resolveContrastTextColor(preset.tokens.brandPrimary).toUpperCase());
      assert.equal(onBullMatch[1].toUpperCase(), resolveContrastTextColor(preset.tokens.bullColor).toUpperCase());
      assert.equal(onBearMatch[1].toUpperCase(), resolveContrastTextColor(preset.tokens.bearColor).toUpperCase());

      if (preset.mode === 'light') {
        assert.match(block, /color-scheme:\s*light;/);
      }
    }
  });

  test('WCAG Contrast Engine: utilitas WCAG dan themeEngine memancarkan --bull-text >= 4.5:1 pada palet kustom terang bermasalah', () => {
    assert.ok(getRelativeLuminance('#FFFFFF') > 0.99);
    assert.ok(getRelativeLuminance('#000000') < 0.01);
    assert.ok(getContrastRatio('#FFFFFF', '#000000') > 20.9);
    assert.equal(resolveContrastTextColor('#F6465D'), '#0A0A0A');
    assert.equal(resolveContrastTextColor('#941B1E'), '#FFFFFF');

    const problematicLightCases = [
      { name: 'Lavender Violet Light', bg: '#E2E2F7', text: '#46047B', bull: '#8D6BD4', bear: '#850585' },
      { name: 'Amber Light', bg: '#FBF0E9', text: '#834012', bull: '#CA641C', bear: '#AA2121' },
      { name: 'Steel Sky Light', bg: '#ECFCFD', text: '#3F78A8', bull: '#437EB0', bear: '#F76045' },
      { name: 'Soft Slate Light', bg: '#F2F3F4', text: '#2E2F31', bull: '#7B7C7E', bear: '#A4A4A6' },
      { name: 'Rose Pastel Light', bg: '#EAEAE5', text: '#4E1112', bull: '#CF9F9F', bear: '#941B1E' },
    ];

    for (const c of problematicLightCases) {
      const bundle = assembleThemeCssBundle(
        {
          ...DEFAULT_APP_SETTINGS,
          colorModePreference: 'light',
          themePreset: 'red_folder',
          chartThemePreset: 'red_folder',
          syncChartWithAppTheme: true,
          customPalette: {
            enabled: true,
            candles: {
              bullBody: c.bull,
              bullWick: c.bull,
              bullBorder: c.bull,
              bearBody: c.bear,
              bearWick: c.bear,
              bearBorder: c.bear,
            },
            general: {
              background: c.bg,
              foreground: c.text,
              textColor: c.text,
            },
          },
        },
        { systemIsDark: false }
      );

      const emittedBullText = bundle.rootCssVariables['--bull-text'];
      const emittedBg = bundle.rootCssVariables['--bg-darkest'];
      const emittedPanel = bundle.rootCssVariables['--bg-panel'];

      assert.ok(emittedBullText && emittedBg && emittedPanel);
      assert.ok(
        getContrastRatio(emittedBullText, emittedBg) >= 4.5,
        `${c.name} custom --bull-text (${emittedBullText}) gagal WCAG AA terhadap --bg-darkest (${emittedBg})`
      );
      assert.ok(
        getContrastRatio(emittedBullText, emittedPanel) >= 4.5,
        `${c.name} custom --bull-text (${emittedBullText}) gagal WCAG AA terhadap --bg-panel (${emittedPanel})`
      );
    }
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

    // Mode Preset Red Folder (Warta Abang)
    const rfColors = resolveEffectiveThemeColors('red_folder');
    assert.equal(rfColors.background, '#EAEAE5');
    assert.equal(rfColors.textColor, '#4E1112');
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

  test('buildCustomPaletteFromPreset mendukung preset bawaan maupun preset kustom pengguna', () => {
    const userThemes = [
      {
        id: 'user_theme_custom_1',
        name: 'Custom Ocean',
        mode: 'dark' as const,
        createdAt: 1000,
        updatedAt: 1000,
        palette: {
          enabled: true,
          candles: {
            bullBody: '#11AAFF',
            bullWick: '#11AAFF',
            bullBorder: '#0088CC',
            bearBody: '#FF4466',
            bearWick: '#FF4466',
            bearBorder: '#CC2244',
          },
          general: {
            background: '#050A14',
            foreground: '#0D1626',
            textColor: '#D0E0F0',
          },
        },
      },
    ];

    const builtPalette = buildCustomPaletteFromPreset('user_theme_custom_1', userThemes);
    assert.equal(builtPalette.candles.bullBody, '#11AAFF');
    assert.equal(builtPalette.candles.bearBody, '#FF4466');
    assert.equal(builtPalette.general.background, '#050A14');
    assert.equal(builtPalette.general.textColor, '#D0E0F0');
  });
});
