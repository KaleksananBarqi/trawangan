import type { ThemePresetId, UiDensity } from '../types/market';

export interface ThemeConfig {
  id: ThemePresetId;
  name: string;
  badge: string;
  description: string;
  tokens: {
    bgDarkest: string;
    bgSurface: string;
    bgContainer: string;
    bgPanel: string;
    bgElevated: string;
    bgHover: string;
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

export const THEME_PRESETS: Record<ThemePresetId, ThemeConfig> = {
  signature: {
    id: 'signature',
    name: 'trawangan (Signature)',
    badge: 'DEFAULT',
    description: 'Cyber-Monochrome: Ultra Dark #0F0F0F, Pure White Bull & Hot Pink Bear',
    tokens: {
      bgDarkest: '#0F0F0F',
      bgSurface: '#0F0F0F',
      bgContainer: '#141414',
      bgPanel: '#171717',
      bgElevated: '#1E1E1E',
      bgHover: '#262626',
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
    description: 'Platform standar Binance dengan kanvas Dark Charcoal, Hijau Emerald & Crimson',
    tokens: {
      bgDarkest: '#181A20',
      bgSurface: '#181A20',
      bgContainer: '#1E2329',
      bgPanel: '#2B313A',
      bgElevated: '#2B313A',
      bgHover: '#333A44',
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
    description: 'Gaya visual Bitunix dengan aksen Neon Cyan, Emerald Bull & Rose Bear',
    tokens: {
      bgDarkest: '#0D1117',
      bgSurface: '#0D1117',
      bgContainer: '#131922',
      bgPanel: '#19222E',
      bgElevated: '#1F2A38',
      bgHover: '#263345',
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
    description: 'Skema warna legendaris Midnight Slate dengan Teal Green & Crimson',
    tokens: {
      bgDarkest: '#131722',
      bgSurface: '#131722',
      bgContainer: '#1E222D',
      bgPanel: '#242835',
      bgElevated: '#2A2E39',
      bgHover: '#363C4E',
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
    description: 'Tema Jet Black ala Coinglass data terminal dengan kontras analitis tinggi',
    tokens: {
      bgDarkest: '#0B0E11',
      bgSurface: '#0B0E11',
      bgContainer: '#12161A',
      bgPanel: '#181E24',
      bgElevated: '#1F2730',
      bgHover: '#28323E',
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

