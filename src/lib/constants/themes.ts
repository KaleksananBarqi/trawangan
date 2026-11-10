import type { ColorModePreference, CustomThemeDefinition, CustomThemePalette, ThemePresetId, ThemeId, UiDensity } from '../types/market';
import { deriveBorderColor, deriveSurfaceColor, ensureReadableTextColor, isDarkColor, mixColors, withAlpha } from '../utils/colorUtils';

export type { ThemeId };

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  mode: 'dark' | 'light';
  description: string;
  isCustom?: boolean;
  tokens: {
    bgDarkest: string;
    bgSurface: string;
    bgContainer: string;
    bgPanel: string;
    bgElevated: string;
    bgHover: string;
    bgSecondary?: string;
    borderHairline: string;
    borderSubtle: string;
    brandPrimary: string;
    brandCyan: string;
    bullColor: string;
    bullGlow: string;
    bearColor: string;
    bearGlow: string;
    textMain: string;
    textMuted: string;
    textPrimary?: string;
  };
  chart: {
    background: string;
    gridColor: string;
    textColor: string;
    borderColor: string;
    upColor: string;
    downColor: string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
  };
}

interface BuiltInThemeSeed {
  id: ThemePresetId;
  name: string;
  badge: string;
  mode: 'dark' | 'light';
  description: string;
  brandPrimary: string;
  brandCyan?: string;
  candles: {
    bullBody: string;
    bullWick: string;
    bullBorder: string;
    bearBody: string;
    bearWick: string;
    bearBorder: string;
  };
  general: {
    background: string;
    foreground: string;
    textColor: string;
  };
}

/**
 * Membangun ThemeConfig lengkap untuk preset bawaan dari 9 atribut palet inti
 * dengan menurunkan warna permukaan, batas, dan teks sekunder secara deterministik.
 */
function createBuiltInPreset(seed: BuiltInThemeSeed): ThemeConfig {
  const bg = seed.general.background;
  const isDark = seed.mode === 'dark';
  const text = ensureReadableTextColor(bg, seed.general.textColor);
  const fg = seed.general.foreground;

  const bgContainer = deriveSurfaceColor(bg, 0.05);
  const bgPanel = deriveSurfaceColor(bg, isDark ? 0.08 : 0.085);
  const bgElevated = deriveSurfaceColor(bg, 0.12);
  const bgHover = deriveSurfaceColor(bg, 0.16);
  const bgSecondary = deriveSurfaceColor(bg, isDark ? 0.07 : 0.06);

  const borderHairline = isDark ? deriveSurfaceColor(bg, 0.14) : deriveBorderColor(bg, 0.14);
  const borderSubtle = isDark ? deriveSurfaceColor(bg, 0.10) : deriveBorderColor(bg, 0.10);
  const textMuted = mixColors(text, bg, 0.35);

  return {
    id: seed.id,
    name: seed.name,
    badge: seed.badge,
    mode: seed.mode,
    description: seed.description,
    tokens: {
      bgDarkest: bg,
      bgSurface: bg,
      bgContainer,
      bgPanel,
      bgElevated,
      bgHover,
      bgSecondary,
      borderHairline,
      borderSubtle,
      brandPrimary: seed.brandPrimary,
      brandCyan: seed.brandCyan || seed.brandPrimary,
      bullColor: seed.candles.bullBody,
      bullGlow: withAlpha(seed.candles.bullBody, isDark ? 0.22 : 0.28),
      bearColor: seed.candles.bearBody,
      bearGlow: withAlpha(seed.candles.bearBody, isDark ? 0.25 : 0.28),
      textMain: text,
      textMuted,
      textPrimary: text,
    },
    chart: {
      background: bg,
      gridColor: withAlpha(fg, isDark ? 0.08 : 0.09),
      textColor: text,
      borderColor: borderHairline,
      upColor: seed.candles.bullBody,
      downColor: seed.candles.bearBody,
      borderUpColor: seed.candles.bullBorder,
      borderDownColor: seed.candles.bearBorder,
      wickUpColor: seed.candles.bullWick,
      wickDownColor: seed.candles.bearWick,
    },
  };
}

export const THEME_PRESETS: Record<ThemePresetId, ThemeConfig> = {
  signature: {
    id: 'signature',
    name: 'trawangan (Signature)',
    badge: 'DEFAULT',
    mode: 'dark',
    description: 'Cyber-Monochrome: Ultra Dark #0F0F0F, Pure White Bull & Hot Pink Bear',
    tokens: {
      bgDarkest: '#0F0F0F',
      bgSurface: '#0F0F0F',
      bgContainer: '#141414',
      bgPanel: '#171717',
      bgElevated: '#1E1E1E',
      bgHover: '#262626',
      bgSecondary: '#171717',
      borderHairline: '#242424',
      borderSubtle: '#222222',
      brandPrimary: '#FF69B4',
      brandCyan: '#FF69B4',
      bullColor: '#F7F7F7',
      bullGlow: 'rgba(247, 247, 247, 0.22)',
      bearColor: '#FF69B4',
      bearGlow: 'rgba(255, 105, 180, 0.25)',
      textMain: '#F7F7F7',
      textMuted: '#A3A3A3',
      textPrimary: '#F7F7F7',
    },
    chart: {
      background: '#0F0F0F',
      gridColor: 'rgba(255, 255, 255, 0.05)',
      textColor: '#A3A3A3',
      borderColor: '#242424',
      upColor: '#F7F7F7',
      downColor: '#FF69B4',
      borderUpColor: '#F7F7F7',
      borderDownColor: '#CC5A7F',
      wickUpColor: '#F7F7F7',
      wickDownColor: '#FF69B4',
    },
  },
  binance: {
    id: 'binance',
    name: 'Binance Classic',
    badge: 'GOLD/RED',
    mode: 'dark',
    description: 'Platform standar Binance dengan kanvas Dark Charcoal, Hijau Emerald & Crimson',
    tokens: {
      bgDarkest: '#181A20',
      bgSurface: '#181A20',
      bgContainer: '#1E2329',
      bgPanel: '#2B313A',
      bgElevated: '#2B313A',
      bgHover: '#333A44',
      bgSecondary: '#1E2329',
      borderHairline: '#2B313A',
      borderSubtle: '#252930',
      brandPrimary: '#F0B90B',
      brandCyan: '#0ECB81',
      bullColor: '#0ECB81',
      bullGlow: 'rgba(14, 203, 129, 0.22)',
      bearColor: '#F6465D',
      bearGlow: 'rgba(246, 70, 93, 0.22)',
      textMain: '#EAECEF',
      textMuted: '#848E9C',
      textPrimary: '#EAECEF',
    },
    chart: {
      background: '#181A20',
      gridColor: '#20242B',
      textColor: '#848E9C',
      borderColor: '#2B313A',
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    },
  },
  bitunix: {
    id: 'bitunix',
    name: 'Bitunix Neon',
    badge: 'CYAN/ROSE',
    mode: 'dark',
    description: 'Gaya visual Bitunix dengan aksen Neon Cyan, Emerald Bull & Rose Bear',
    tokens: {
      bgDarkest: '#0D1117',
      bgSurface: '#0D1117',
      bgContainer: '#131922',
      bgPanel: '#19222E',
      bgElevated: '#1F2A38',
      bgHover: '#263345',
      bgSecondary: '#131922',
      borderHairline: '#202B3C',
      borderSubtle: '#1C2533',
      brandPrimary: '#38BDF8',
      brandCyan: '#38BDF8',
      bullColor: '#00F090',
      bullGlow: 'rgba(0, 240, 144, 0.22)',
      bearColor: '#FF3B69',
      bearGlow: 'rgba(255, 59, 105, 0.22)',
      textMain: '#F1F5F9',
      textMuted: '#94A3B8',
      textPrimary: '#F1F5F9',
    },
    chart: {
      background: '#0D1117',
      gridColor: '#17202B',
      textColor: '#94A3B8',
      borderColor: '#202B3C',
      upColor: '#00F090',
      downColor: '#FF3B69',
      borderUpColor: '#00F090',
      borderDownColor: '#FF3B69',
      wickUpColor: '#00F090',
      wickDownColor: '#FF3B69',
    },
  },
  tradingview: {
    id: 'tradingview',
    name: 'TradingView Pro',
    badge: 'NAVY/TEAL',
    mode: 'dark',
    description: 'Skema warna legendaris Midnight Slate dengan Teal Green & Crimson',
    tokens: {
      bgDarkest: '#131722',
      bgSurface: '#131722',
      bgContainer: '#1E222D',
      bgPanel: '#242835',
      bgElevated: '#2A2E39',
      bgHover: '#363C4E',
      bgSecondary: '#1E222D',
      borderHairline: '#2A2E39',
      borderSubtle: '#242835',
      brandPrimary: '#2962FF',
      brandCyan: '#089981',
      bullColor: '#089981',
      bullGlow: 'rgba(8, 153, 129, 0.22)',
      bearColor: '#F23645',
      bearGlow: 'rgba(242, 54, 69, 0.22)',
      textMain: '#D1D4DC',
      textMuted: '#787B86',
      textPrimary: '#D1D4DC',
    },
    chart: {
      background: '#131722',
      gridColor: '#1E222D',
      textColor: '#787B86',
      borderColor: '#2A2E39',
      upColor: '#089981',
      downColor: '#F23645',
      borderUpColor: '#089981',
      borderDownColor: '#F23645',
      wickUpColor: '#089981',
      wickDownColor: '#F23645',
    },
  },
  coinglass: {
    id: 'coinglass',
    name: 'Coinglass Dark',
    badge: 'JET/CYAN',
    mode: 'dark',
    description: 'Tema Jet Black ala Coinglass data terminal dengan kontras analitis tinggi',
    tokens: {
      bgDarkest: '#0B0E11',
      bgSurface: '#0B0E11',
      bgContainer: '#12161A',
      bgPanel: '#181E24',
      bgElevated: '#1F2730',
      bgHover: '#28323E',
      bgSecondary: '#12161A',
      borderHairline: '#1E252D',
      borderSubtle: '#181F26',
      brandPrimary: '#26A69A',
      brandCyan: '#00B4D8',
      bullColor: '#26A69A',
      bullGlow: 'rgba(38, 166, 154, 0.22)',
      bearColor: '#EF5350',
      bearGlow: 'rgba(239, 83, 80, 0.22)',
      textMain: '#E0E6ED',
      textMuted: '#8492A6',
      textPrimary: '#E0E6ED',
    },
    chart: {
      background: '#0B0E11',
      gridColor: '#161B22',
      textColor: '#8492A6',
      borderColor: '#1E252D',
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderUpColor: '#26A69A',
      borderDownColor: '#EF5350',
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    },
  },
  red_folder: {
    id: 'red_folder',
    name: 'Warta Abang',
    badge: 'LIGHT/ABANG',
    mode: 'light',
    description: 'Tema Koran & Warta Analisis Terang: Latar Krem Hangat #EAEAE5, Teks Merah Marun #4E1112, Lilin Rose & Crimson',
    tokens: {
      bgDarkest: '#EAEAE5',
      bgSurface: '#EAEAE5',
      bgContainer: '#E1E1DB',
      bgPanel: '#DADAD3',
      bgElevated: '#D3D3CC',
      bgHover: '#CACAC2',
      bgSecondary: '#E1E1DB',
      borderHairline: '#C9C9C1',
      borderSubtle: '#C1C1B8',
      brandPrimary: '#941B1E',
      brandCyan: '#4E1112',
      bullColor: '#CF9F9F',
      bullGlow: 'rgba(207, 159, 159, 0.28)',
      bearColor: '#941B1E',
      bearGlow: 'rgba(148, 27, 30, 0.25)',
      textMain: '#4E1112',
      textMuted: '#7A4C4C',
      textPrimary: '#4E1112',
    },
    chart: {
      background: '#EAEAE5',
      gridColor: 'rgba(78, 17, 18, 0.08)',
      textColor: '#4E1112',
      borderColor: '#C9C9C1',
      upColor: '#CF9F9F',
      downColor: '#941B1E',
      borderUpColor: '#B17575',
      borderDownColor: '#591B1B',
      wickUpColor: '#7A4C4C',
      wickDownColor: '#7A4C4C',
    },
  },
  ngrembaka: createBuiltInPreset({
    id: 'ngrembaka',
    name: 'Ngrembaka',
    badge: 'LIGHT/EMERALD',
    mode: 'light',
    description: 'Latar putih hangat dengan lilin hijau zamrud dan lumut segar',
    brandPrimary: '#4CC374',
    brandCyan: '#046908',
    candles: {
      bullBody: '#4CC374',
      bullWick: '#419E65',
      bullBorder: '#409B63',
      bearBody: '#046908',
      bearWick: '#055027',
      bearBorder: '#034F06',
    },
    general: {
      background: '#FDF7F7',
      foreground: '#2F3331',
      textColor: '#2F3331',
    },
  }),
  kopi_tubruk: createBuiltInPreset({
    id: 'kopi_tubruk',
    name: 'Kopi Tubruk',
    badge: 'LIGHT/KOPI',
    mode: 'light',
    description: 'Nuansa krem susu hangat dan cokelat kopi sangrai khas Jawa',
    brandPrimary: '#9B4E2A',
    brandCyan: '#563C2F',
    candles: {
      bullBody: '#CEAF87',
      bullWick: '#B26E30',
      bullBorder: '#BC9465',
      bearBody: '#9B4E2A',
      bearWick: '#B26E30',
      bearBorder: '#854212',
    },
    general: {
      background: '#FCF5E3',
      foreground: '#563C2F',
      textColor: '#563C2F',
    },
  }),
  pundi_arta: createBuiltInPreset({
    id: 'pundi_arta',
    name: 'Pundi Arta',
    badge: 'DARK/SAGE',
    mode: 'dark',
    description: 'Latar hijau hutan malam dengan lilin hijau sage lembut',
    brandPrimary: '#7DAE7E',
    brandCyan: '#AAC0AC',
    candles: {
      bullBody: '#AAC0AC',
      bullWick: '#92A393',
      bullBorder: '#D6DAD6',
      bearBody: '#7DAE7E',
      bearWick: '#92A393',
      bearBorder: '#056B69',
    },
    general: {
      background: '#031E04',
      foreground: '#D6DAD6',
      textColor: '#D6DAD6',
    },
  }),
  geni_mrengkang: createBuiltInPreset({
    id: 'geni_mrengkang',
    name: 'Geni Mrengkang',
    badge: 'LIGHT/CORAL',
    mode: 'light',
    description: 'Latar krem lembut berpadu sorot jingga api dan koral terang',
    brandPrimary: '#F74808',
    brandCyan: '#E84307',
    candles: {
      bullBody: '#F87C4E',
      bullWick: '#F87C4E',
      bullBorder: '#DF6743',
      bearBody: '#F74808',
      bearWick: '#F74808',
      bearBorder: '#C43805',
    },
    general: {
      background: '#FCF2EA',
      foreground: '#E84307',
      textColor: '#E84307',
    },
  }),
  rega_pasar: createBuiltInPreset({
    id: 'rega_pasar',
    name: 'Rega Pasar',
    badge: 'LIGHT/STEEL',
    mode: 'light',
    description: 'Kanvas biru langit pucat dengan kontras biru baja dan merah koral',
    brandPrimary: '#437EB0',
    brandCyan: '#3F78A8',
    candles: {
      bullBody: '#437EB0',
      bullWick: '#228BF7',
      bullBorder: '#3E65DB',
      bearBody: '#F76045',
      bearWick: '#C65959',
      bearBorder: '#D83E05',
    },
    general: {
      background: '#ECFCFD',
      foreground: '#3F78A8',
      textColor: '#3F78A8',
    },
  }),
  watu_putih: createBuiltInPreset({
    id: 'watu_putih',
    name: 'Watu Putih',
    badge: 'LIGHT/MONO',
    mode: 'light',
    description: 'Skema monokrom terang bersih dengan lilin arang dan kelabu',
    brandPrimary: '#494A4D',
    brandCyan: '#2F3033',
    candles: {
      bullBody: '#494A4D',
      bullWick: '#4C4D50',
      bullBorder: '#393A3D',
      bearBody: '#A4A5A8',
      bearWick: '#858689',
      bearBorder: '#757679',
    },
    general: {
      background: '#FCFCFA',
      foreground: '#2F3033',
      textColor: '#2F3033',
    },
  }),
  samodra_wengi: createBuiltInPreset({
    id: 'samodra_wengi',
    name: 'Samodra Wengi',
    badge: 'DARK/NAVY',
    mode: 'dark',
    description: 'Biru samudra malam pekat dengan lilin biru elektrik dan jingga',
    brandPrimary: '#08B9F7',
    brandCyan: '#248CF5',
    candles: {
      bullBody: '#08B9F7',
      bullWick: '#248CF5',
      bullBorder: '#0694C5',
      bearBody: '#F76146',
      bearWick: '#F54808',
      bearBorder: '#D63E06',
    },
    general: {
      background: '#040638',
      foreground: '#AAC9FA',
      textColor: '#AAC9FA',
    },
  }),
  undhuh_dana: createBuiltInPreset({
    id: 'undhuh_dana',
    name: 'Undhuh Dana',
    badge: 'DARK/TEAL',
    mode: 'dark',
    description: 'Latar arang gelap dengan nuansa toska teduh dan hijau sabak',
    brandPrimary: '#5A999B',
    brandCyan: '#068584',
    candles: {
      bullBody: '#068584',
      bullWick: '#5A999B',
      bullBorder: '#5A999B',
      bearBody: '#335454',
      bearWick: '#335454',
      bearBorder: '#2A4747',
    },
    general: {
      background: '#17191A',
      foreground: '#C9CDCE',
      textColor: '#C9CDCE',
    },
  }),
  laku_batin: createBuiltInPreset({
    id: 'laku_batin',
    name: 'Laku Batin',
    badge: 'LIGHT/SLATE',
    mode: 'light',
    description: 'Monokrom abu-abu netral seimbang di atas kanvas terang sejuk',
    brandPrimary: '#656568',
    brandCyan: '#2E2F31',
    candles: {
      bullBody: '#7B7C7E',
      bullWick: '#656568',
      bullBorder: '#6B6C6E',
      bearBody: '#A4A4A6',
      bearWick: '#656568',
      bearBorder: '#ABABAD',
    },
    general: {
      background: '#F2F3F4',
      foreground: '#2E2F31',
      textColor: '#2E2F31',
    },
  }),
  pasar_esuk: createBuiltInPreset({
    id: 'pasar_esuk',
    name: 'Pasar Esuk',
    badge: 'LIGHT/ASH',
    mode: 'light',
    description: 'Kanvas pagi terang dengan lilin arang gelap dan kelabu muda',
    brandPrimary: '#48494C',
    brandCyan: '#2D2E30',
    candles: {
      bullBody: '#48494C',
      bullWick: '#646568',
      bullBorder: '#38393C',
      bearBody: '#A5A6A8',
      bearWick: '#ACACAE',
      bearBorder: '#858688',
    },
    general: {
      background: '#F1F2F3',
      foreground: '#2D2E30',
      textColor: '#2D2E30',
    },
  }),
  segara_jero: createBuiltInPreset({
    id: 'segara_jero',
    name: 'Segara Jero',
    badge: 'DARK/ABYSS',
    mode: 'dark',
    description: 'Biru palung laut pekat dengan kilau perak dan biru samudra',
    brandPrimary: '#248CF5',
    brandCyan: '#AAC9F8',
    candles: {
      bullBody: '#DADCE0',
      bullWick: '#9B9CAE',
      bullBorder: '#D2D4D8',
      bearBody: '#248CF5',
      bearWick: '#9B9CAE',
      bearBorder: '#1B67C4',
    },
    general: {
      background: '#04051F',
      foreground: '#AAC9F8',
      textColor: '#AAC9F8',
    },
  }),
  getih_segara: createBuiltInPreset({
    id: 'getih_segara',
    name: 'Getih Segara',
    badge: 'DARK/MAROON',
    mode: 'dark',
    description: 'Merah marun malam pekat dengan lilin rose kelam dan dusty',
    brandPrimary: '#CEAEAE',
    brandCyan: '#AC7D7D',
    candles: {
      bullBody: '#CEAEAE',
      bullWick: '#9B8B8B',
      bullBorder: '#BAA3A3',
      bearBody: '#AC7D7D',
      bearWick: '#9B8B8B',
      bearBorder: '#8A6B6B',
    },
    general: {
      background: '#1E0D0D',
      foreground: '#F8D4D4',
      textColor: '#F8D4D4',
    },
  }),
  tutup_sasi: createBuiltInPreset({
    id: 'tutup_sasi',
    name: 'Tutup Sasi',
    badge: 'DARK/INDIGO',
    mode: 'dark',
    description: 'Indigo malam dengan perpaduan perak dingin dan biru keabuan',
    brandPrimary: '#9AB2F8',
    brandCyan: '#D2D3E3',
    candles: {
      bullBody: '#D2D3E3',
      bullWick: '#666786',
      bullBorder: '#C2C3D3',
      bearBody: '#9AA2CA',
      bearWick: '#666786',
      bearBorder: '#7B83AA',
    },
    general: {
      background: '#050520',
      foreground: '#9AB2F8',
      textColor: '#9AB2F8',
    },
  }),
  gading_ijo: createBuiltInPreset({
    id: 'gading_ijo',
    name: 'Gading Ijo',
    badge: 'LIGHT/IVORY',
    mode: 'light',
    description: 'Kanvas kuning gading lembut dengan hijau daun dan merah koral',
    brandPrimary: '#1F8420',
    brandCyan: '#2FC630',
    candles: {
      bullBody: '#2FC630',
      bullWick: '#2FC630',
      bullBorder: '#259926',
      bearBody: '#F75F43',
      bearWick: '#F75F43',
      bearBorder: '#C44C37',
    },
    general: {
      background: '#F7F7CD',
      foreground: '#1F8420',
      textColor: '#1F8420',
    },
  }),
  kilat_wengi: createBuiltInPreset({
    id: 'kilat_wengi',
    name: 'Kilat Wengi',
    badge: 'DARK/NEON',
    mode: 'dark',
    description: 'Hitam malam kontras tinggi dengan hijau mint neon dan jingga api',
    brandPrimary: '#08F296',
    brandCyan: '#F74706',
    candles: {
      bullBody: '#08F296',
      bullWick: '#08F296',
      bullBorder: '#06CC82',
      bearBody: '#F74706',
      bearWick: '#F74706',
      bearBorder: '#C43605',
    },
    general: {
      background: '#050607',
      foreground: '#DADCE0',
      textColor: '#DADCE0',
    },
  }),
  sekar_jambon: createBuiltInPreset({
    id: 'sekar_jambon',
    name: 'Sekar Jambon',
    badge: 'LIGHT/ROSE',
    mode: 'light',
    description: 'Latar merah muda pucat dengan aksen magenta dan jambon lembut',
    brandPrimary: '#BE147F',
    brandCyan: '#F765AF',
    candles: {
      bullBody: '#F8B0BC',
      bullWick: '#C4567A',
      bullBorder: '#DF9495',
      bearBody: '#F765AF',
      bearWick: '#F765AF',
      bearBorder: '#C4567A',
    },
    general: {
      background: '#FCECF1',
      foreground: '#BE147F',
      textColor: '#BE147F',
    },
  }),
  kuning_kunir: createBuiltInPreset({
    id: 'kuning_kunir',
    name: 'Kuning Kunir',
    badge: 'LIGHT/KUNIR',
    mode: 'light',
    description: 'Kanvas putih bersih dengan perpaduan emas kunir dan merah cabai',
    brandPrimary: '#C46817',
    brandCyan: '#EABD12',
    candles: {
      bullBody: '#EABD12',
      bullWick: '#EB9714',
      bullBorder: '#CCA510',
      bearBody: '#E04A3B',
      bearWick: '#B9372A',
      bearBorder: '#A9382C',
    },
    general: {
      background: '#FAFCFC',
      foreground: '#C46817',
      textColor: '#C46817',
    },
  }),
  mas_kencana: createBuiltInPreset({
    id: 'mas_kencana',
    name: 'Mas Kencana',
    badge: 'LIGHT/EMAS',
    mode: 'light',
    description: 'Latar batu kapur hangat dengan kilau emas kencana dan perunggu',
    brandPrimary: '#B1810E',
    brandCyan: '#563C2F',
    candles: {
      bullBody: '#D39E22',
      bullWick: '#B99A3D',
      bullBorder: '#B1810E',
      bearBody: '#B1810E',
      bearWick: '#85610A',
      bearBorder: '#85610A',
    },
    general: {
      background: '#E1DFDA',
      foreground: '#563C2F',
      textColor: '#563C2F',
    },
  }),
  tengah_wengi: createBuiltInPreset({
    id: 'tengah_wengi',
    name: 'Tengah Wengi',
    badge: 'DARK/SILVER',
    mode: 'dark',
    description: 'Monokrom hitam pekat tengah malam dengan lilin perak dan abu-abu',
    brandPrimary: '#CDCFD1',
    brandCyan: '#A3A4A6',
    candles: {
      bullBody: '#CDCFD1',
      bullWick: '#CDCFD1',
      bullBorder: '#B8BABC',
      bearBody: '#A3A4A6',
      bearWick: '#A3A4A6',
      bearBorder: '#87888A',
    },
    general: {
      background: '#060608',
      foreground: '#DADCE0',
      textColor: '#DADCE0',
    },
  }),
  wangsit_lembah: createBuiltInPreset({
    id: 'wangsit_lembah',
    name: 'Wangsit Lembah',
    badge: 'LIGHT/MOSS',
    mode: 'light',
    description: 'Kanvas terang kabut dengan aksen hijau lumut tua dan kelabu',
    brandPrimary: '#2C4B4B',
    brandCyan: '#51662D',
    candles: {
      bullBody: '#2C4B4B',
      bullWick: '#51662D',
      bullBorder: '#3A5A5A',
      bearBody: '#A3A4A4',
      bearWick: '#646565',
      bearBorder: '#8A8B8B',
    },
    general: {
      background: '#ECECEC',
      foreground: '#2A4848',
      textColor: '#2A4848',
    },
  }),
  dana_lestari: createBuiltInPreset({
    id: 'dana_lestari',
    name: 'Dana Lestari',
    badge: 'LIGHT/OLIVE',
    mode: 'light',
    description: 'Latar krem gading tenang dengan palet hijau zaitun mapan',
    brandPrimary: '#50662D',
    brandCyan: '#563C30',
    candles: {
      bullBody: '#50662D',
      bullWick: '#798D43',
      bullBorder: '#475927',
      bearBody: '#668821',
      bearWick: '#7E9E46',
      bearBorder: '#55751D',
    },
    general: {
      background: '#F1F1D6',
      foreground: '#563C30',
      textColor: '#563C30',
    },
  }),
  peken_ijo: createBuiltInPreset({
    id: 'peken_ijo',
    name: 'Peken Ijo',
    badge: 'LIGHT/MINT',
    mode: 'light',
    description: 'Putih mint segar dengan lilin hijau daun dan merah koral',
    brandPrimary: '#1F8320',
    brandCyan: '#2FC530',
    candles: {
      bullBody: '#2FC530',
      bullWick: '#2FC530',
      bullBorder: '#259826',
      bearBody: '#F66045',
      bearWick: '#F66045',
      bearBorder: '#C34D38',
    },
    general: {
      background: '#EFFCF6',
      foreground: '#1F8320',
      textColor: '#1F8320',
    },
  }),
  surya_baskara: createBuiltInPreset({
    id: 'surya_baskara',
    name: 'Surya Baskara',
    badge: 'DARK/ORANGE',
    mode: 'dark',
    description: 'Latar malam terminal finansial dengan aksen oranye surya dan abu',
    brandPrimary: '#F78A3E',
    brandCyan: '#B5B3AC',
    candles: {
      bullBody: '#F78A3E',
      bullWick: '#894E24',
      bullBorder: '#F78A3E',
      bearBody: '#B5B3AC',
      bearWick: '#894E24',
      bearBorder: '#B5B3AC',
    },
    general: {
      background: '#11131B',
      foreground: '#F8F9FC',
      textColor: '#F8F9FC',
    },
  }),
  paring_eling: createBuiltInPreset({
    id: 'paring_eling',
    name: 'Paring Eling',
    badge: 'LIGHT/RUST',
    mode: 'light',
    description: 'Krem hangat dengan palet tembaga dan merah bata berkarakter',
    brandPrimary: '#AA2121',
    brandCyan: '#834012',
    candles: {
      bullBody: '#CA641C',
      bullWick: '#C57F3B',
      bullBorder: '#B25918',
      bearBody: '#AA2121',
      bearWick: '#9E2828',
      bearBorder: '#961D1D',
    },
    general: {
      background: '#FBF0E9',
      foreground: '#834012',
      textColor: '#834012',
    },
  }),
  sapu_tirta: createBuiltInPreset({
    id: 'sapu_tirta',
    name: 'Sapu Tirta',
    badge: 'DARK/ICE',
    mode: 'dark',
    description: 'Arang gelap dengan nuansa biru es pucat dan biru samudra',
    brandPrimary: '#248CF5',
    brandCyan: '#AAD9E0',
    candles: {
      bullBody: '#AAD9E0',
      bullWick: '#A8E7E8',
      bullBorder: '#96BEBF',
      bearBody: '#248CF5',
      bearWick: '#6190E6',
      bearBorder: '#1E75C4',
    },
    general: {
      background: '#131416',
      foreground: '#AAD9E0',
      textColor: '#AAD9E0',
    },
  }),
  lembayung_awan: createBuiltInPreset({
    id: 'lembayung_awan',
    name: 'Lembayung Awan',
    badge: 'LIGHT/VIOLET',
    mode: 'light',
    description: 'Kanvas lavender lembut dengan perpaduan ungu lembayung dan plum',
    brandPrimary: '#755CB8',
    brandCyan: '#46047B',
    candles: {
      bullBody: '#8D6BD4',
      bullWick: '#B251CB',
      bullBorder: '#755CB8',
      bearBody: '#850585',
      bearWick: '#8E06CB',
      bearBorder: '#720475',
    },
    general: {
      background: '#E2E2F7',
      foreground: '#46047B',
      textColor: '#46047B',
    },
  }),
  kopi_klotok: createBuiltInPreset({
    id: 'kopi_klotok',
    name: 'Kopi Klotok',
    badge: 'LIGHT/LATTE',
    mode: 'light',
    description: 'Krem susu hangat berpadu cokelat kayu manis kopi tradisional',
    brandPrimary: '#874537',
    brandCyan: '#834012',
    candles: {
      bullBody: '#CBB2A2',
      bullWick: '#874537',
      bullBorder: '#804133',
      bearBody: '#874537',
      bearWick: '#874537',
      bearBorder: '#804133',
    },
    general: {
      background: '#F4E8DE',
      foreground: '#834012',
      textColor: '#834012',
    },
  }),
  rame_sore: createBuiltInPreset({
    id: 'rame_sore',
    name: 'Rame Sore',
    badge: 'DARK/EMERALD',
    mode: 'dark',
    description: 'Hitam arang malam dengan lilin hijau zamrud dan merah tegas',
    brandPrimary: '#06AF4D',
    brandCyan: '#D92323',
    candles: {
      bullBody: '#06AF4D',
      bullWick: '#838487',
      bullBorder: '#61B466',
      bearBody: '#D92323',
      bearWick: '#838487',
      bearBorder: '#EE4E5B',
    },
    general: {
      background: '#0F1014',
      foreground: '#F7F8FA',
      textColor: '#F7F8FA',
    },
  }),
  ayem_tentrem: createBuiltInPreset({
    id: 'ayem_tentrem',
    name: 'Ayem Tentrem',
    badge: 'DARK/FROST',
    mode: 'dark',
    description: 'Gelap teduh dengan lilin putih salju cyan dan biru baja',
    brandPrimary: '#D8F8F9',
    brandCyan: '#437DAE',
    candles: {
      bullBody: '#D8F8F9',
      bullWick: '#D8F8F9',
      bullBorder: '#B9D3D3',
      bearBody: '#437DAE',
      bearWick: '#437DAE',
      bearBorder: '#38658D',
    },
    general: {
      background: '#161719',
      foreground: '#D8F8F9',
      textColor: '#D8F8F9',
    },
  }),
  banyu_segara: createBuiltInPreset({
    id: 'banyu_segara',
    name: 'Banyu Segara',
    badge: 'LIGHT/TOSKA',
    mode: 'light',
    description: 'Putih awan bersih dengan paduan hijau toska laut dan terakota',
    brandPrimary: '#15997F',
    brandCyan: '#28394A',
    candles: {
      bullBody: '#18B596',
      bullWick: '#15997F',
      bullBorder: '#15997F',
      bearBody: '#DF493A',
      bearWick: '#B83629',
      bearBorder: '#B83629',
    },
    general: {
      background: '#E7ECEE',
      foreground: '#28394A',
      textColor: '#28394A',
    },
  }),
  wates_dhuwur: createBuiltInPreset({
    id: 'wates_dhuwur',
    name: 'Wates Dhuwur',
    badge: 'DARK/GRAPHITE',
    mode: 'dark',
    description: 'Monokrom grafit gelap dengan gradasi abu-abu arang dan perak',
    brandPrimary: '#AAABAD',
    brandCyan: '#DADCE0',
    candles: {
      bullBody: '#AAABAD',
      bullWick: '#9A9B9D',
      bullBorder: '#CACBCE',
      bearBody: '#565759',
      bearWick: '#464749',
      bearBorder: '#3B3C3E',
    },
    general: {
      background: '#151517',
      foreground: '#DADCE0',
      textColor: '#DADCE0',
    },
  }),
};

export const UI_FONT_OPTIONS = [
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Default Brand)', css: "'Plus Jakarta Sans', sans-serif" },
  { id: 'Inter', label: 'Inter (Clean & Neutral)', css: "'Inter', sans-serif" },
  { id: 'Roboto', label: 'Roboto (Google Standard)', css: "'Roboto', sans-serif" },
  { id: 'System', label: 'System Default (Segoe UI / OS Native)', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
];

export const MONO_FONT_OPTIONS = [
  { id: 'JetBrains Mono', label: 'JetBrains Mono (Default Data)', css: "'JetBrains Mono', monospace" },
  { id: 'Fira Code', label: 'Fira Code (Programming Ligatures)', css: "'Fira Code', monospace" },
  { id: 'Consolas', label: 'Consolas (Windows Classic Terminal)', css: "'Consolas', monospace" },
];

export const DENSITY_OPTIONS: { id: UiDensity; label: string; fontSize: string }[] = [
  { id: 'compact', label: 'Compact (11px)', fontSize: '11px' },
  { id: 'regular', label: 'Regular (12px)', fontSize: '12px' },
  { id: 'comfortable', label: 'Comfortable (13.5px)', fontSize: '13.5px' },
];

export const FONT_SIZE_PRESETS = [
  { size: 10, label: '10px (Kecil)', desc: 'Layar laptop kompak' },
  { size: 11, label: '11px (Kompak)', desc: 'Densitas data tinggi' },
  { size: 12, label: '12px (Standar)', desc: 'Default seimbang 1080p' },
  { size: 14, label: '14px (Besar)', desc: 'Monitor 2K / 1440p' },
  { size: 16, label: '16px (Ekstra)', desc: 'Monitor 4K / TV' },
];

export const MIN_FONT_SIZE = 9;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 12;

export interface EffectiveVolumeColors {
  upColor: string;
  downColor: string;
  maColor: string;
}

/**
 * Membangun konfigurasi Palet Kustom dari Theme Preset tertentu sebagai titik mula (template)
 */
export function buildCustomPaletteFromPreset(
  presetId: ThemeId = 'signature',
  savedUserThemes?: CustomThemeDefinition[]
): CustomThemePalette {
  const p = resolveThemeConfig(presetId, savedUserThemes);
  return {
    enabled: true,
    candles: {
      bullBody: p.chart.upColor,
      bullWick: p.chart.wickUpColor || p.chart.upColor,
      bullBorder: p.chart.borderUpColor || deriveBorderColor(p.chart.upColor),
      bearBody: p.chart.downColor,
      bearWick: p.chart.wickDownColor || p.chart.downColor,
      bearBorder: p.chart.borderDownColor || deriveBorderColor(p.chart.downColor),
    },
    general: {
      background: p.chart.background || p.tokens.bgDarkest,
      foreground: p.tokens.bgPanel || p.tokens.bgContainer,
      textColor: p.chart.textColor || p.tokens.textMain,
    },
  };
}

/**
 * Menghitung warna efektif volume (bull, bear, dan MA) berdasarkan tema aktif
 * dengan memprioritaskan kustomisasi lilin pengguna jika tersedia.
 */
export function resolveEffectiveVolumeColors(
  themePresetId: ThemePresetId | string = 'signature',
  customPaletteOrColors?: CustomThemePalette | { bullColor?: string; bearColor?: string },
  legacyCustomColors?: { bullColor?: string; bearColor?: string },
  savedUserThemes?: CustomThemeDefinition[]
): EffectiveVolumeColors {
  const cfg = resolveThemeConfig(themePresetId, savedUserThemes);

  let up = cfg.chart.upColor;
  let down = cfg.chart.downColor;

  if (customPaletteOrColors) {
    if ('candles' in customPaletteOrColors && customPaletteOrColors.candles) {
      if (customPaletteOrColors.candles.bullBody) up = customPaletteOrColors.candles.bullBody;
      if (customPaletteOrColors.candles.bearBody) down = customPaletteOrColors.candles.bearBody;
    } else if ('bullColor' in customPaletteOrColors || 'bearColor' in customPaletteOrColors) {
      const legacy = customPaletteOrColors as { bullColor?: string; bearColor?: string };
      if (legacy.bullColor) up = legacy.bullColor;
      if (legacy.bearColor) down = legacy.bearColor;
    }
  }

  if (legacyCustomColors) {
    if (legacyCustomColors.bullColor) up = legacyCustomColors.bullColor;
    if (legacyCustomColors.bearColor) down = legacyCustomColors.bearColor;
  }

  return {
    upColor: up,
    downColor: down,
    maColor: cfg.tokens.brandPrimary || cfg.tokens.brandCyan || '#ff9800',
  };
}

/**
 * Serialisasi objek CustomThemePalette ke JSON yang rapi
 */
export function serializeCustomPaletteJson(palette: CustomThemePalette): string {
  return JSON.stringify(palette, null, 2);
}

/**
 * Serialisasi objek CustomThemePalette ke format daftar teks (ala chartthemes.com)
 */
export function serializeCustomPaletteText(palette: CustomThemePalette): string {
  return [
    'Candle colors:',
    `Bearish body: ${palette.candles.bearBody}`,
    `Bearish wick: ${palette.candles.bearWick}`,
    `Bearish border: ${palette.candles.bearBorder}`,
    `Bullish body: ${palette.candles.bullBody}`,
    `Bullish wick: ${palette.candles.bullWick}`,
    `Bullish border: ${palette.candles.bullBorder}`,
    '',
    'General colors:',
    `Background color: ${palette.general.background}`,
    `Foreground: ${palette.general.foreground}`,
    `Text color: ${palette.general.textColor}`,
  ].join('\n');
}

/**
 * Parser toleran untuk membaca salinan teks maupun JSON palet tema dari clipboard
 */
export function parseCustomPaletteFromText(input: string): CustomThemePalette | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Coba JSON parse
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.candles && parsed.general) {
        return {
          enabled: true,
          candles: {
            bullBody: parsed.candles.bullBody || '#D4A5A5',
            bullWick: parsed.candles.bullWick || '#7F4F4F',
            bullBorder: parsed.candles.bullBorder || '#B87B7B',
            bearBody: parsed.candles.bearBody || '#9B1D20',
            bearWick: parsed.candles.bearWick || '#7F4F4F',
            bearBorder: parsed.candles.bearBorder || '#5E1D1D',
          },
          general: {
            background: parsed.general.background || '#edede9',
            foreground: parsed.general.foreground || '#4A0E0F',
            textColor: parsed.general.textColor || '#4A0E0F',
          },
        };
      }
    } catch (_) {}
  }

  // 2. Coba parse key-value plain-text (case-insensitive)
  const lines = trimmed.split('\n');
  const dict: Record<string, string> = {};

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const k = parts[0].trim().toLowerCase();
      const v = parts.slice(1).join(':').trim();
      const hexMatch = v.match(/#[0-9A-Fa-f]{3,8}/);
      if (hexMatch) {
        dict[k] = hexMatch[0];
      }
    }
  }

  // Cek apakah minimal ada 3 key utama yang cocok
  const hasCandles = dict['bearish body'] || dict['bullish body'] || dict['bear body'] || dict['bull body'];
  const hasGeneral = dict['background color'] || dict['background'] || dict['text color'] || dict['text'];

  if (hasCandles || hasGeneral) {
    const bullBody = dict['bullish body'] || dict['bull body'] || '#D4A5A5';
    const bearBody = dict['bearish body'] || dict['bear body'] || '#9B1D20';

    return {
      enabled: true,
      candles: {
        bullBody,
        bullWick: dict['bullish wick'] || dict['bull wick'] || bullBody,
        bullBorder: dict['bullish border'] || dict['bull border'] || deriveBorderColor(bullBody),
        bearBody,
        bearWick: dict['bearish wick'] || dict['bear wick'] || bearBody,
        bearBorder: dict['bearish border'] || dict['bear border'] || deriveBorderColor(bearBody),
      },
      general: {
        background: dict['background color'] || dict['background'] || '#edede9',
        foreground: dict['foreground'] || dict['panel'] || '#4A0E0F',
        textColor: dict['text color'] || dict['text'] || '#4A0E0F',
      },
    };
  }

  return null;
}

export interface EffectiveThemeColors {
  background: string;
  foreground: string;
  textColor: string;
  isDark: boolean;
}

/**
 * Memeriksa apakah suatu ID tema merupakan preset resmi bawaan Trawangan (#149)
 */
export function isBuiltInTheme(themeId: ThemeId): boolean {
  return Object.prototype.hasOwnProperty.call(THEME_PRESETS, themeId);
}

let registeredUserThemes: CustomThemeDefinition[] = [];

/**
 * Mendaftarkan koleksi tema pengguna ke modul themes secara reaktif (#149)
 */
export function registerUserThemes(themes: CustomThemeDefinition[]): void {
  registeredUserThemes = Array.isArray(themes) ? [...themes] : [];
}

/**
 * Mengambil daftar tema pengguna yang terdaftar saat ini (#149)
 */
export function getRegisteredUserThemes(): CustomThemeDefinition[] {
  return [...registeredUserThemes];
}

/**
 * Mengonversi CustomThemeDefinition menjadi ThemeConfig lengkap (#149, ADR-0019)
 * Menurunkan warna surface kartu/panel secara matematis dari background (Adaptive Luminance)
 * dan menggunakan general.foreground sesuai filosofi chart untuk aksen garis grid/border halus.
 */
export function buildThemeConfigFromUserTheme(def: CustomThemeDefinition): ThemeConfig {
  const { id, name, mode, palette } = def;
  const fallbackIsDark = mode === 'dark';
  const bg = palette.general?.background || (fallbackIsDark ? '#0F0F0F' : '#edede9');
  const isDark = isDarkColor(bg);
  const rawFg = palette.general?.foreground || (isDark ? '#FFFFFF' : '#4A0E0F');
  const text = ensureReadableTextColor(bg, palette.general?.textColor || (isDark ? '#F7F7F7' : '#4A0E0F'));

  // Surface diturunkan langsung dari background chart agar kartu/panel dan Thesis tidak pernah tabrakan warna
  const bgContainer = deriveSurfaceColor(bg, 0.05);
  const bgPanel = deriveSurfaceColor(bg, 0.08);
  const bgElevated = deriveSurfaceColor(bg, 0.12);
  const bgSecondary = deriveSurfaceColor(bg, 0.07);

  const up = palette.candles?.bullBody || (isDark ? '#F7F7F7' : '#D4A5A5');
  const down = palette.candles?.bearBody || (isDark ? '#FF69B4' : '#9B1D20');
  const wickUp = palette.candles?.bullWick || up;
  const wickDown = palette.candles?.bearWick || down;
  const borderUp = palette.candles?.bullBorder || deriveBorderColor(up);
  const borderDown = palette.candles?.bearBorder || deriveBorderColor(down);

  const borderHairline = isDark ? withAlpha(text, 0.14) : deriveBorderColor(bg, 0.15);
  const borderSubtle = isDark ? withAlpha(text, 0.10) : deriveBorderColor(bg, 0.10);
  const bgHover = deriveSurfaceColor(bg, 0.15);
  const textMuted = withAlpha(text, 0.65);
  const gridColor = withAlpha(rawFg, isDark ? 0.07 : 0.09);

  return {
    id,
    name,
    badge: 'CUSTOM',
    mode,
    description: `Preset kustom pengguna: ${name} (${isDark ? 'Gelap' : 'Terang'})`,
    isCustom: true,
    tokens: {
      bgDarkest: bg,
      bgSurface: bg,
      bgContainer,
      bgPanel,
      bgElevated,
      bgHover,
      bgSecondary,
      borderHairline,
      borderSubtle,
      brandPrimary: up,
      brandCyan: up,
      bullColor: up,
      bullGlow: withAlpha(up, 0.22),
      bearColor: down,
      bearGlow: withAlpha(down, 0.25),
      textMain: text,
      textMuted,
      textPrimary: text,
    },
    chart: {
      background: bg,
      gridColor,
      textColor: text,
      borderColor: borderHairline,
      upColor: up,
      downColor: down,
      borderUpColor: borderUp,
      borderDownColor: borderDown,
      wickUpColor: wickUp,
      wickDownColor: wickDown,
    },
  };
}

/**
 * Menyelesaikan ThemeConfig berdasarkan ID tema (baik preset resmi bawaan maupun preset pengguna) (#149)
 */
export function resolveThemeConfig(
  themeId: ThemeId = 'signature',
  savedUserThemes?: CustomThemeDefinition[]
): ThemeConfig {
  if (!themeId || typeof themeId !== 'string') {
    return THEME_PRESETS.signature;
  }
  if (isBuiltInTheme(themeId)) {
    return THEME_PRESETS[themeId as ThemePresetId];
  }

  const themesToSearch = savedUserThemes || registeredUserThemes;
  const userDef = themesToSearch.find((t) => t.id === themeId);
  if (userDef) {
    return buildThemeConfigFromUserTheme(userDef);
  }

  return THEME_PRESETS.signature;
}

/**
 * Membuat entitas CustomThemeDefinition baru dari palet kustom pengguna (#149)
 */
export function createUserTheme(
  name: string,
  mode: 'dark' | 'light',
  palette: CustomThemePalette,
  id?: string
): CustomThemeDefinition {
  const trimmedName = name.trim() || 'Tema Kustom';
  const themeId = id || `user_theme_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  return {
    id: themeId,
    name: trimmedName,
    mode,
    palette: JSON.parse(JSON.stringify(palette)),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Mengubah nama tema pengguna tersimpan (#149)
 * Mencegah pengubahan nama preset resmi bawaan.
 */
export function renameUserTheme(
  themes: CustomThemeDefinition[],
  themeId: ThemeId,
  newName: string
): CustomThemeDefinition[] {
  if (isBuiltInTheme(themeId)) {
    throw new Error(`Tidak dapat mengubah nama preset resmi bawaan: ${themeId}`);
  }
  const cleanName = newName.trim();
  if (!cleanName) return themes;
  const now = Date.now();
  return themes.map((t) => {
    if (t.id === themeId) {
      return {
        ...t,
        name: cleanName,
        updatedAt: now,
      };
    }
    return t;
  });
}

/**
 * Menghapus tema pengguna dari koleksi tersimpan (#149)
 * Mencegah penghapusan preset resmi bawaan.
 */
export function deleteUserTheme(
  themes: CustomThemeDefinition[],
  themeId: ThemeId
): CustomThemeDefinition[] {
  if (isBuiltInTheme(themeId)) {
    throw new Error(`Tidak dapat menghapus preset resmi bawaan: ${themeId}`);
  }
  return themes.filter((t) => t.id !== themeId);
}

/**
 * Memperbarui palet warna tema pengguna tertentu secara immutable (#158)
 */
export function updateUserThemePalette(
  themes: CustomThemeDefinition[],
  themeId: string,
  newPalette: CustomThemePalette,
  mode?: 'dark' | 'light'
): CustomThemeDefinition[] {
  return themes.map((t) => {
    if (t.id === themeId) {
      return {
        ...t,
        palette: JSON.parse(JSON.stringify(newPalette)),
        ...(mode ? { mode } : {}),
      };
    }
    return t;
  });
}

/**
 * Menentukan fallback tema aktif yang aman jika tema yang dihapus sedang digunakan (#149)
 */
export function resolveDeletedThemeFallback(
  deletedId: string,
  activeId?: string,
  fallbackId: string = 'signature'
): string {
  if (activeId === deletedId) {
    return fallbackId;
  }
  return activeId || fallbackId;
}

/**
 * Menyelesaikan tema kanvas grafik efektif berdasarkan status sinkronisasi dengan aplikasi
 * serta Chart Mode Preset Memory (`activeDarkChartPreset` & `activeLightChartPreset`) (#149, ADR-0019)
 */
export function resolveEffectiveChartThemePreset(
  syncWithApp: boolean,
  effectiveAppPreset: ThemeId,
  chartThemePreset?: ThemeId,
  preference?: ColorModePreference,
  systemIsDark: boolean = true,
  darkChartPreset?: ThemeId,
  lightChartPreset?: ThemeId
): ThemeId {
  if (syncWithApp) {
    return effectiveAppPreset;
  }

  // Jika parameter memori mode warna kanvas disertakan, selesaikan sesuai mode tampilan aktif
  if (preference !== undefined && (darkChartPreset || lightChartPreset)) {
    const isLightMode = preference === 'light' || (preference === 'system' && !systemIsDark);
    if (isLightMode) {
      return lightChartPreset || chartThemePreset || 'red_folder';
    }
    return darkChartPreset || chartThemePreset || 'signature';
  }

  return chartThemePreset || 'signature';
}

/**
 * Menghasilkan paket token CSS khusus Kartu Thesis (`--chart-thesis-*`) yang diturunkan
 * langsung dari latar belakang Chart Canvas Theme aktif (Chart-Dominant Thesis Surface, ADR-0019)
 */
export function generateChartThesisThemeTokens(chartThemeConfig: ThemeConfig): Record<string, string> {
  const chartBg = chartThemeConfig?.chart?.background || chartThemeConfig?.tokens?.bgDarkest || '#0F0F0F';
  const isDark = isDarkColor(chartBg);
  const surfaceHex = deriveSurfaceColor(chartBg, 0.07);
  const elevatedHex = deriveSurfaceColor(chartBg, 0.11);
  const rawText = chartThemeConfig?.tokens?.textMain || chartThemeConfig?.chart?.textColor;
  const textMain = ensureReadableTextColor(chartBg, rawText);
  const textMuted = withAlpha(textMain, 0.68);
  const borderSubtle = isDark ? withAlpha(textMain, 0.12) : deriveBorderColor(chartBg, 0.14);
  const borderHairline = isDark ? withAlpha(textMain, 0.18) : deriveBorderColor(chartBg, 0.18);
  const bullColor = chartThemeConfig?.chart?.upColor || chartThemeConfig?.tokens?.bullColor || '#00FF88';
  const bearColor = chartThemeConfig?.chart?.downColor || chartThemeConfig?.tokens?.bearColor || '#FF69B4';
  const brandCyan = chartThemeConfig?.tokens?.brandCyan || '#38BDF8';

  return {
    '--chart-thesis-bg': withAlpha(surfaceHex, 0.94),
    '--chart-thesis-bg-solid': surfaceHex,
    '--chart-thesis-bg-elevated': withAlpha(elevatedHex, 0.65),
    '--chart-thesis-header-bg': isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
    '--chart-thesis-item-bg': isDark ? withAlpha(chartBg, 0.48) : withAlpha(chartBg, 0.55),
    '--chart-thesis-border': borderSubtle,
    '--chart-thesis-border-hairline': borderHairline,
    '--chart-thesis-text': textMain,
    '--chart-thesis-text-muted': textMuted,
    '--chart-thesis-bull': bullColor,
    '--chart-thesis-bull-glow': withAlpha(bullColor, 0.16),
    '--chart-thesis-bear': bearColor,
    '--chart-thesis-bear-glow': withAlpha(bearColor, 0.16),
    '--chart-thesis-cyan': brandCyan,
    '--chart-thesis-shadow': isDark
      ? '0 10px 30px rgba(0, 0, 0, 0.65)'
      : '0 10px 28px rgba(0, 0, 0, 0.18)',
  };
}

/**
 * Menghitung warna efektif tema (background, foreground, textColor, dan status isDark)
 * dengan memperhitungkan fallback ke preset aktif atau user theme jika palet kustom tidak aktif atau parsial.
 */
export function resolveEffectiveThemeColors(
  themePreset: ThemeId = 'signature',
  customPalette?: CustomThemePalette | null,
  savedUserThemes?: CustomThemeDefinition[]
): EffectiveThemeColors {
  const cfg = resolveThemeConfig(themePreset, savedUserThemes);
  const isCustomActive = Boolean(customPalette && customPalette.enabled !== false && customPalette.candles && customPalette.general);
  const background = isCustomActive && customPalette?.general?.background
    ? customPalette.general.background
    : (cfg.chart?.background || cfg.tokens?.bgDarkest || '#0F0F0F');
  const isDark = isDarkColor(background);
  const rawForeground = isCustomActive && customPalette?.general?.foreground
    ? customPalette.general.foreground
    : (cfg.tokens?.bgContainer || cfg.tokens?.bgPanel || '#1A1A1A');
  const foreground = isDarkColor(rawForeground) === isDark
    ? rawForeground
    : deriveSurfaceColor(background, 0.07);
  const rawText = isCustomActive && customPalette?.general?.textColor
    ? customPalette.general.textColor
    : (cfg.chart?.textColor || cfg.tokens?.textMain || '#F7F7F7');
  const textColor = ensureReadableTextColor(background, rawText);

  return { background, foreground, textColor, isDark };
}

/**
 * Menyelesaikan ThemePresetId efektif berdasarkan preferensi mode warna pengguna,
 * status prefers-color-scheme OS, dan fallback preset (#148).
 * - 'dark': Selalu mengembalikan darkPreset (fallback ke fallback || 'signature')
 * - 'light': Selalu mengembalikan lightPreset (fallback ke 'red_folder')
 * - 'system': Mengembalikan darkPreset jika systemIsDark bernilai true, sebaliknya lightPreset
 */
export function resolveEffectiveThemePreset(
  preference: ColorModePreference = 'system',
  systemIsDark: boolean = true,
  fallback: ThemeId = 'signature',
  darkPreset?: ThemeId,
  lightPreset?: ThemeId
): ThemeId {
  const safeFallback = fallback && typeof fallback === 'string' ? fallback : 'signature';
  const effectiveDark = (darkPreset && typeof darkPreset === 'string' ? darkPreset : safeFallback) || 'signature';
  const effectiveLight = (lightPreset && typeof lightPreset === 'string' ? lightPreset : (safeFallback === 'red_folder' ? safeFallback : 'red_folder')) || 'red_folder';

  if (preference === 'dark') {
    return effectiveDark;
  }
  if (preference === 'light') {
    return effectiveLight;
  }
  return systemIsDark ? effectiveDark : effectiveLight;
}

/**
 * Menghitung mode warna berikutnya dalam siklus toggle satu-klik pada Header (#148):
 * dark -> light -> system -> dark
 */
export function getNextColorMode(current: ColorModePreference): ColorModePreference {
  switch (current) {
    case 'dark':
      return 'light';
    case 'light':
      return 'system';
    case 'system':
    default:
      return 'dark';
  }
}


