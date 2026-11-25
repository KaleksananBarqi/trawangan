/**
 * Upstream Attribution Ledger (`src/lib/constants/attributions.ts`)
 *
 * Sumber kebenaran tunggal untuk atribusi seluruh engine, pustaka open-source,
 * aset visual (ikon, logo ticker, bendera), tipografi, dan sumber data publik
 * yang digunakan oleh `trawangan` (`ADR-0033`).
 */

import type { AppLanguage } from '../types/market';
import { trInstant } from '../i18n';

export type AttributionCategoryId = 'engines' | 'assets' | 'typography' | 'data_sources';

export interface LocalizedText {
  jv: string;
  id: string;
  en: string;
}

export interface AttributionCategoryMeta {
  id: AttributionCategoryId;
  title: LocalizedText;
  subtitle: LocalizedText;
}

export interface AttributionEntry {
  id: string;
  category: AttributionCategoryId;
  name: string;
  packageOrScope: string;
  author: string;
  license: string;
  url: string;
  role: LocalizedText;
}

export const ATTRIBUTION_CATEGORIES: readonly AttributionCategoryMeta[] = [
  {
    id: 'engines',
    title: {
      jv: 'Core Engine, Scripting & Runtime Native',
      id: 'Engine Inti, Scripting & Runtime Native',
      en: 'Core Engines, Scripting & Native Runtime',
    },
    subtitle: {
      jv: 'Mesin grafik WebGL2, transpiler Pine Script v6, shell Rust Tauri v2, editor kode, lan database SQLite.',
      id: 'Mesin grafik WebGL2, transpiler Pine Script v6, shell Rust Tauri v2, editor kode, dan database SQLite.',
      en: 'WebGL2 charting engine, Pine Script v6 runtime, Tauri v2 Rust host, code editor, and embedded SQLite.',
    },
  },
  {
    id: 'assets',
    title: {
      jv: 'Aset Visual, Ikonografi & Logo Multi-Aset',
      id: 'Aset Visual, Ikonografi & Logo Multi-Aset',
      en: 'Visual Assets, Iconography & Multi-Asset Logos',
    },
    subtitle: {
      jv: 'Paket ikon UI, logo token kripto, logo saham global/IDX, bendera mata uang, lan vektor orisinal trawangan.',
      id: 'Paket ikon UI, logo token kripto, logo saham global/IDX, bendera mata uang, dan vektor orisinal trawangan.',
      en: 'UI vector icons, crypto token logos, global/IDX equity marks, currency flags, and original trawangan vectors.',
    },
  },
  {
    id: 'typography',
    title: {
      jv: 'Tipografi & Sintesis Audio',
      id: 'Tipografi & Sintesis Audio',
      en: 'Typography & Audio Synthesis',
    },
    subtitle: {
      jv: 'Huruf terbuka SIL OFL-1.1 gawe antarmuka lan angka rega tabular, plus audio alert Web Audio API.',
      id: 'Font terbuka SIL OFL-1.1 untuk antarmuka dan angka harga tabular, serta audio alert Web Audio API.',
      en: 'SIL OFL-1.1 open fonts for UI and tabular price scales, plus zero-asset Web Audio API alert chimes.',
    },
  },
  {
    id: 'data_sources',
    title: {
      jv: 'Sumber Data Pasar, Makro & Kalender Publik',
      id: 'Sumber Data Pasar, Makro & Kalender Publik',
      en: 'Public Market Data, Macro & Calendar Sources',
    },
    subtitle: {
      jv: 'Koneksi langsung tanpa server tengah nang bursa kripto, API kalibrasi makro, saham/komoditas, lan kalender ekonomi.',
      id: 'Koneksi langsung tanpa server perantara ke bursa kripto, API kalibrasi makro, saham/komoditas, dan kalender ekonomi.',
      en: 'Direct-to-client feeds across crypto exchanges, macro calibration APIs, equities/commodities, and economic calendars.',
    },
  },
] as const;

export const UPSTREAM_ATTRIBUTION_LEDGER: readonly AttributionEntry[] = [
  // 1. Core Engines, Scripting & Runtime Native
  {
    id: 'luxalgo-vela',
    category: 'engines',
    name: 'Vela Charting Engine',
    packageOrScope: '@luxalgo/vela (v0.8.3)',
    author: 'LuxAlgo',
    license: 'Apache-2.0 + NOTICE',
    url: 'https://velacharts.dev',
    role: {
      jv: 'Engine kanvas grafik WebGL2 120 FPS, multi-chart workspace, alat gambar teknikal, lan overlay native.',
      id: 'Engine kanvas grafik WebGL2 120 FPS, workspace multi-chart, alat gambar teknikal, dan overlay native.',
      en: '120 FPS WebGL2 financial charting canvas, multi-chart workspace, technical drawing tools, and native overlays.',
    },
  },
  {
    id: 'luxalgo-pinets',
    category: 'engines',
    name: 'PineTS & Vela-PineTS',
    packageOrScope: 'pinets (v0.11.0) · @luxalgo/vela-pinets (v0.2.15)',
    author: 'LuxAlgo',
    license: 'AGPL-3.0-only',
    url: 'https://github.com/LuxAlgo/PineTS',
    role: {
      jv: 'Transpiler AST lan runtime Pine Script v6 sing mlaku terisolasi nang Web Worker lokal.',
      id: 'Transpiler AST dan runtime Pine Script v6 yang berjalan terisolasi di dalam Web Worker lokal.',
      en: 'Pine Script v6 AST transpiler and runtime engine executed locally inside an isolated Web Worker.',
    },
  },
  {
    id: 'acorn-astring',
    category: 'engines',
    name: 'Acorn, Acorn-Walk & Astring',
    packageOrScope: 'acorn · acorn-walk · astring',
    author: 'Marijn Haverbeke, Ingvar Stepanyan & David Bonnet',
    license: 'MIT',
    url: 'https://github.com/acornjs/acorn',
    role: {
      jv: 'Parser AST JavaScript lan generator kode sing nyokong transpiler PineTS.',
      id: 'Parser AST JavaScript dan generator kode yang mendukung transpiler PineTS.',
      en: 'Fast JavaScript AST parser, walker, and code generator powering PineTS transpilation.',
    },
  },
  {
    id: 'tauri-v2',
    category: 'engines',
    name: 'Tauri v2 & Official Plugins',
    packageOrScope: 'tauri · @tauri-apps/api · opener · notification · updater · process · single-instance',
    author: 'The Tauri Programme (Commons Conservancy)',
    license: 'Apache-2.0 / MIT',
    url: 'https://v2.tauri.app',
    role: {
      jv: 'Host aplikasi desktop native lintas OS sing super entheng (~45 MB RAM) tanpa bloat Electron.',
      id: 'Host aplikasi desktop native lintas OS ultra-ringan (~45 MB RAM) tanpa overhead Electron.',
      en: 'Ultra-lightweight cross-platform native desktop shell (~45 MB RAM) without Electron bloat.',
    },
  },
  {
    id: 'rust-ecosystem',
    category: 'engines',
    name: 'Rust Core & Ecosystem Crates',
    packageOrScope: 'tokio · reqwest · serde · serde_json · sha2 · hex · chrono · dirs · base64 · rfd',
    author: 'The Rust Project Developers & Crate Authors',
    license: 'MIT / Apache-2.0',
    url: 'https://www.rust-lang.org',
    role: {
      jv: 'Runtime asinkron aman memori, jaringan HTTP/WebSocket langsung, enkripsi HMAC/SHA256, lan dialog file OS.',
      id: 'Runtime asinkron aman memori, jaringan HTTP/WebSocket langsung, penandatanganan HMAC/SHA256, dan dialog file OS.',
      en: 'Memory-safe async runtime, direct HTTP/WebSocket networking, HMAC/SHA256 signing, and native file dialogs.',
    },
  },
  {
    id: 'sqlite-rusqlite',
    category: 'engines',
    name: 'SQLite & Rusqlite',
    packageOrScope: 'rusqlite (bundled SQLite3)',
    author: 'D. Richard Hipp (SQLite Consortium) & Rusqlite Developers',
    license: 'Public Domain / MIT',
    url: 'https://github.com/rusqlite/rusqlite',
    role: {
      jv: 'Database SQLite lokal tertanam gawe cache candle historis, workspace, watchlist, lan Trade Plan Vault.',
      id: 'Database SQLite lokal tertanam untuk cache candle historis, workspace, watchlist, dan Trade Plan Vault.',
      en: 'Embedded 100% offline SQLite storage for historical candle caches, workspaces, watchlists, and Trade Plan Vault.',
    },
  },
  {
    id: 'svelte-5',
    category: 'engines',
    name: 'Svelte 5 (Runes), SvelteKit & Vite',
    packageOrScope: 'svelte · @sveltejs/kit · vite · @sveltejs/adapter-static',
    author: 'Rich Harris, Evan You & Contributors',
    license: 'MIT',
    url: 'https://svelte.dev',
    role: {
      jv: 'Compiler antarmuka reaktif tanpa Virtual DOM lan bundler modern cepet pol.',
      id: 'Compiler antarmuka reaktif tanpa Virtual DOM dan toolchain build modern.',
      en: 'Zero-VDOM reactive UI compiler and fast frontend build toolchain.',
    },
  },
  {
    id: 'codemirror-6',
    category: 'engines',
    name: 'CodeMirror 6',
    packageOrScope: 'codemirror · @codemirror/view · state · language · commands',
    author: 'Marijn Haverbeke & Contributors',
    license: 'MIT',
    url: 'https://codemirror.net',
    role: {
      jv: 'Editor kode modular gawe Side-by-Side Pine Script v6 IDE lengkap karo penyorotan sintaksis.',
      id: 'Editor kode modular untuk Side-by-Side Pine Script v6 IDE beserta penyorotan sintaksis.',
      en: 'Extensible code editor powering the Side-by-Side Pine Script v6 IDE with syntax highlighting.',
    },
  },

  // 2. Visual Assets, Iconography & Multi-Asset Logos
  {
    id: 'lucide-icons',
    category: 'assets',
    name: 'Lucide Icons',
    packageOrScope: '@lucide/svelte · lucide-svelte',
    author: 'Lucide Contributors (fork of Feather Icons by Cole Bemis)',
    license: 'ISC / MIT',
    url: 'https://lucide.dev',
    role: {
      jv: 'Ikonografi vektor geometris resik nang kabeh toolbar gambar, dock, header, lan modal setelan.',
      id: 'Ikonografi vektor geometris bersih di seluruh toolbar gambar, dock, header, dan modal pengaturan.',
      en: 'Clean geometric vector iconography across drawing toolbars, docks, headers, and settings modals.',
    },
  },
  {
    id: 'web3icons',
    category: 'assets',
    name: 'Web3Icons',
    packageOrScope: '@0xa3k5/web3icons (static/icons/coins/ & CDN)',
    author: '0xa3k5 & Contributors',
    license: 'MIT',
    url: 'https://github.com/0xa3k5/web3icons',
    role: {
      jv: 'Koleksi ikon SVG token lan aset kripto utama gawe tampilan lokal offline-resilient.',
      id: 'Koleksi ikon SVG token dan aset kripto utama untuk tampilan lokal yang tahan offline.',
      en: 'Primary curated SVG cryptocurrency and token icon set bundled for offline-resilient display.',
    },
  },
  {
    id: 'spothq-crypto-icons',
    category: 'assets',
    name: 'Cryptocurrency Icons',
    packageOrScope: 'spothq/cryptocurrency-icons',
    author: 'SpotHQ & Contributors',
    license: 'MIT / CC0-1.0',
    url: 'https://github.com/spothq/cryptocurrency-icons',
    role: {
      jv: 'Set ikon vektor SVG koin kripto cadangan tingkat loro nang SymbolLogo Engine.',
      id: 'Set ikon vektor SVG koin kripto cadangan lapis kedua pada SymbolLogo Engine.',
      en: 'Secondary SVG cryptocurrency vector icon fallback set inside SymbolLogo Engine.',
    },
  },
  {
    id: 'circle-flags',
    category: 'assets',
    name: 'Circle Flags',
    packageOrScope: 'HatScripts/circle-flags (static/icons/flags/ & fiat)',
    author: 'HatScripts & Contributors',
    license: 'MIT',
    url: 'https://github.com/HatScripts/circle-flags',
    role: {
      jv: 'Ikon bendera negara lan mata uang fiat bundar gawe indeks pasar, forex, IDR, USD, lan EUR.',
      id: 'Ikon bendera negara dan mata uang fiat bulat untuk indeks pasar, forex, IDR, USD, dan EUR.',
      en: 'Circular SVG country and fiat currency flags for market indices, forex, IDR, USD, and EUR badges.',
    },
  },
  {
    id: 'global-stock-logos',
    category: 'assets',
    name: 'Global Stock Logos',
    packageOrScope: 'MrChartist/global-stock-logos (static/icons/stocks/)',
    author: 'MrChartist',
    license: 'Open Curated Repository (Fair Use)',
    url: 'https://github.com/MrChartist/global-stock-logos',
    role: {
      jv: 'Logo vektor SVG perusahaan saham global & AS kanggo identitas emiten.',
      id: 'Logo vektor SVG perusahaan saham global & AS sebagai penanda emiten.',
      en: 'Vector SVG company logos for major global and US equity tickers.',
    },
  },
  {
    id: 'ticker-logos-collections',
    category: 'assets',
    name: 'Ticker Logos, Financial Icons & IDX Favicons',
    packageOrScope: 'davidepalazzo/ticker-logos · nvstly/icons · ShaadyEmad/ticker-logos · IDX_COMPANY_DOMAINS',
    author: 'Davide Palazzo, NVSTly, Shaady Emad & Emiten IDX',
    license: 'MIT / Open Curated / Fair Use',
    url: 'https://github.com/davidepalazzo/ticker-logos',
    role: {
      jv: 'Logo cadangan multi-tingkat gawe saham AS, ETF, koin kripto tambahan, lan favicon domain resmi emiten IDX.',
      id: 'Logo cadangan multi-tingkat untuk saham AS, ETF, token kripto tambahan, serta favicon domain resmi emiten IDX.',
      en: 'Multi-tier fallback icons for US equities, ETFs, extended crypto tokens, and official IDX issuer domain favicons.',
    },
  },
  {
    id: 'trawangan-original-assets',
    category: 'assets',
    name: 'trawangan Original Vectors & 37 Theme Presets',
    packageOrScope: 'static/icons/commodities · indices · logo-icon.svg · themes.ts',
    author: 'Kaleksanan Barqi Aji Massani',
    license: 'Apache-2.0',
    url: 'https://github.com/KaleksananBarqi/trawangan',
    role: {
      jv: 'Ikon SVG komoditas (GOLD, SILVER, OIL, NATGAS, COPPER), indeks makro (TOTAL..USDT.D), logo monogram, lan 37 preset tema (31 tema Jawa + Warta Abang).',
      id: 'Ikon SVG komoditas (GOLD, SILVER, OIL, NATGAS, COPPER), indeks makro (TOTAL..USDT.D), logo monogram, dan 37 preset tema (31 tema Jawa + Warta Abang).',
      en: 'In-house SVG icons for commodities and macro indices (TOTAL..USDT.D), brand monogram, and 37 official theme presets.',
    },
  },

  // 3. Typography & Audio Synthesis
  {
    id: 'plus-jakarta-sans',
    category: 'typography',
    name: 'Plus Jakarta Sans',
    packageOrScope: '--font-brand · --font-ui',
    author: 'Gumpita Rahayu / Tokotype',
    license: 'OFL-1.1 (SIL Open Font License)',
    url: 'https://github.com/tokotype/PlusJakartaSans',
    role: {
      jv: 'Huruf geometris humanis utama gawe wordmark lowercase trawangan lan teks antarmuka UI.',
      id: 'Font geometris humanis utama untuk wordmark lowercase trawangan dan teks antarmuka UI.',
      en: 'Primary geometric humanist typeface for the lowercase trawangan wordmark and UI navigation.',
    },
  },
  {
    id: 'jetbrains-mono',
    category: 'typography',
    name: 'JetBrains Mono',
    packageOrScope: '--font-code · .mono-nums',
    author: 'JetBrains s.r.o. (Philipp Nurullin & Konstantin Bulenkov)',
    license: 'OFL-1.1 (SIL Open Font License)',
    url: 'https://www.jetbrains.com/lp/mono/',
    role: {
      jv: 'Huruf monospasi tabular gawe sumbu rega, metrik R-multiple, telemetri FPS/RAM, lan kode Pine Script.',
      id: 'Font monospasi tabular untuk sumbu harga, metrik R-multiple, telemetri FPS/RAM, dan kode Pine Script.',
      en: 'Tabular monospace typeface for price scales, R-multiples, FPS/RAM telemetry, and Pine Script code.',
    },
  },
  {
    id: 'web-audio-synthesizer',
    category: 'typography',
    name: 'Web Audio API Chime Synthesizer',
    packageOrScope: 'soundService.ts (Oscillator A5 -> E6 & D5 -> A5)',
    author: 'trawangan (Browser Web Audio API Standard)',
    license: 'Apache-2.0 / W3C Web Audio',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
    role: {
      jv: 'Sintesis swara notifikasi Price Alert secara lokal tanpa file MP3/WAV eksternal blas.',
      id: 'Sintesis suara notifikasi Price Alert secara prosedural lokal tanpa file audio eksternal.',
      en: 'Zero-asset procedural Web Audio API chime synthesis for Price Alert notifications.',
    },
  },

  // 4. Public Market Data, Macro & Calendar Sources
  {
    id: 'coingecko-defillama',
    category: 'data_sources',
    name: 'CoinGecko & DefiLlama Open APIs',
    packageOrScope: 'api.coingecko.com · stablecoins.llama.fi',
    author: 'CoinGecko & DefiLlama',
    license: 'Public Market Data API',
    url: 'https://defillama.com',
    role: {
      jv: 'Kalibrasi kapitalisasi pasar global lan histori supply stablecoin gawe sintesis lokal Crypto Macro Index (TOTAL, TOTAL2, TOTAL3, OTHERS, BTC.D, ETH.D, USDT.D).',
      id: 'Kalibrasi kapitalisasi pasar global dan histori suplai stablecoin untuk sintesis lokal Crypto Macro Index (TOTAL, TOTAL2, TOTAL3, OTHERS, BTC.D, ETH.D, USDT.D).',
      en: 'Global market-cap calibration and historical stablecoin supply series powering local Crypto Macro Index synthesis.',
    },
  },
  {
    id: 'exchange-direct-feeds',
    category: 'data_sources',
    name: 'Direct Crypto Exchange Public Feeds',
    packageOrScope: 'Binance · Indodax · Bitunix · Hyperliquid · Coinbase Exchange',
    author: 'Respective Exchange Operators',
    license: 'Public REST & WebSocket Market Data',
    url: 'https://www.binance.com',
    role: {
      jv: 'Aliran data candle OHLCV lan orderbook live langsung teko bursa tanpa server perantara.',
      id: 'Aliran data candle OHLCV dan ticker live langsung dari bursa publik tanpa server perantara.',
      en: 'Direct zero-middleware public REST and WebSocket OHLCV candlestick and ticker streams.',
    },
  },
  {
    id: 'yahoo-forexfactory',
    category: 'data_sources',
    name: 'Yahoo Finance & Fair Economy (ForexFactory) Calendar',
    packageOrScope: 'query1.finance.yahoo.com · nfs.faireconomy.media',
    author: 'Yahoo Finance & Fair Economy, Inc.',
    license: 'Public Market & Economic Calendar Data',
    url: 'https://finance.yahoo.com',
    role: {
      jv: 'Data saham IDX, emas COMEX, indeks AS (DELAYED 15M), plus jadwal rilis kalender makroekonomi mingguan.',
      id: 'Data saham IDX, emas COMEX, indeks AS (DELAYED 15M), serta jadwal kalender makroekonomi mingguan.',
      en: 'Delayed (~15m) equity/commodity/index feeds (IDX, COMEX, US) plus weekly macroeconomic event schedules.',
    },
  },
] as const;

export const TRADEMARK_DISCLAIMER: LocalizedText = {
  jv: 'Sanggahan Merek Dagang: Kabeh jeneng bursa, ticker saham, logo token kripto, bendera negara, lan ikon perusahaan emiten (kalebu IDX lan AS) iku tetep dadi hak cipta lan merek dagang pemilik asline masing-masing. Panggunaan nang jero trawangan murni kanggo identifikasi instrumen analisis (nominative fair use) lan ora nuduhake afiliasi utawa sponsor resmi.',
  id: 'Sanggahan Merek Dagang: Seluruh nama bursa, ticker saham, logo aset kripto, dan logo emiten perusahaan (termasuk IDX dan AS) tetap merupakan hak cipta dan merek dagang pemilik masing-masing. Penggunaannya di dalam trawangan semata-mata untuk identifikasi instrumen analisis (nominative fair use) dan tidak menyiratkan afiliasi atau dukungan resmi.',
  en: 'Trademark Disclaimer: All exchange names, equity tickers, cryptocurrency logos, and corporate issuer emblems (including IDX and US equities) remain the trademarks and copyrights of their respective owners. Their display inside trawangan is strictly for nominative instrument identification and does not imply affiliation or endorsement.',
};

export function getAttributionsByCategory(
  category: AttributionCategoryId
): readonly AttributionEntry[] {
  return UPSTREAM_ATTRIBUTION_LEDGER.filter((entry) => entry.category === category);
}

export function resolveLocalizedAttributionText(
  text: LocalizedText,
  lang: AppLanguage
): string {
  return trInstant(text.jv, text.id, text.en, lang);
}
