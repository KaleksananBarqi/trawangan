#!/usr/bin/env node
/**
 * Script kurasi dan sinkronisasi aset ikon lokal ke `static/icons/`
 * serta pembuatan manifest TypeScript `src/lib/services/symbolLogoManifest.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STATIC_ICONS = path.join(ROOT, 'static', 'icons');
const COINS_DIR = path.join(STATIC_ICONS, 'coins');
const STOCKS_DIR = path.join(STATIC_ICONS, 'stocks');
const FLAGS_DIR = path.join(STATIC_ICONS, 'flags');
const COMMODITIES_DIR = path.join(STATIC_ICONS, 'commodities');
const INDICES_DIR = path.join(STATIC_ICONS, 'indices');
const MANIFEST_PATH = path.join(ROOT, 'src', 'lib', 'services', 'symbolLogoManifest.ts');

const TOP_CRYPTO = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'SUI', 'LINK',
  'PEPE', 'SHIB', 'NEAR', 'APT', 'DOT', 'RENDER', 'TAO', 'FET', 'INJ', 'ARB',
  'OP', 'POL', 'MATIC', 'LTC', 'BCH', 'KAS', 'SEI', 'TIA', 'WIF', 'BONK',
  'FLOKI', 'ENA', 'PENDLE', 'AAVE', 'UNI', 'TON', 'TRX', 'ATOM', 'FTM', 'ALGO',
  'HYPE', 'ONDO', 'JUP', 'PYTH', 'WLD', 'STX', 'IMX', 'GRT', 'FIL', 'HBAR',
  'ICP', 'XLM', 'ETC', 'MKR', 'LDO', 'RUNE', 'AR', 'GALA', 'SAND', 'MANA',
  'AXS', 'CHZ', 'CRV', 'DYDX', 'GMX', 'COMP', 'SNX', '1INCH', 'ENS', 'BLUR',
  'STRK', 'ZK', 'EIGEN', 'ZRO', 'BOME', 'POPCAT', 'MEW', 'NOT', 'DOGS', 'JASMY',
  'NEO', 'VET', 'EOS', 'XTZ', 'THETA', 'FLOW', 'EGLD', 'QNT', 'KAVA', 'MINA',
  'ROSE', 'ZEC', 'DASH', 'XMR', 'CAKE', 'RAY', 'ORCA', 'USDT', 'USDC', 'DAI',
  'FDUSD', 'USD1', 'USDE', 'S'
];

const TOP_US_STOCKS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'AVGO', 'LLY',
  'JPM', 'V', 'UNH', 'XOM', 'MA', 'COST', 'HD', 'PG', 'JNJ', 'NFLX',
  'AMD', 'CRM', 'BAC', 'ABBV', 'CVX', 'KO', 'MRK', 'ORCL', 'WMT', 'PEP',
  'ADBE', 'CSCO', 'ACN', 'TMO', 'MCD', 'INTC', 'PLTR', 'COIN', 'MSTR', 'DIS',
  'NKE', 'BABA', 'TSM', 'ASML', 'SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV'
];

// Peta ticker IDX (tanpa .JK) ke domain resmi emiten untuk penarikan logo resolusi tinggi
export const IDX_DOMAINS = {
  BBCA: 'bca.co.id',
  BBRI: 'bri.co.id',
  BMRI: 'bankmandiri.co.id',
  BBNI: 'bni.co.id',
  TLKM: 'telkom.co.id',
  ASII: 'astra.co.id',
  GOTO: 'gotocompany.com',
  ICBP: 'indofoodcbp.com',
  INDF: 'indofood.com',
  UNVR: 'unilever.co.id',
  ADRO: 'adaro.com',
  AMMN: 'amman.co.id',
  BREN: 'baritorenewables.co.id',
  BRPT: 'barito-pacific.com',
  ANTM: 'antam.com',
  MDKA: 'merdekacoppergold.com',
  INCO: 'vale.com',
  PTBA: 'ptba.co.id',
  ITMG: 'itmg.co.id',
  PGAS: 'pgn.co.id',
  UNTR: 'unitedtractors.com',
  KLBF: 'kalbe.co.id',
  CPIN: 'cp.co.id',
  JPFA: 'japfacomfeed.co.id',
  MYOR: 'mayora.com',
  AMRT: 'alfamartku.com',
  ACES: 'aceshardware.co.id',
  MAPI: 'map.co.id',
  EXCL: 'xlaxiata.co.id',
  ISAT: 'ioh.co.id',
  TOWR: 'ptsmn.co.id',
  TBIG: 'tower-bersama.com',
  JSMR: 'jasamarga.com',
  SMGR: 'sig.id',
  INTP: 'indocement.co.id',
  BSDE: 'sinarmasland.com',
  CTRA: 'ciputra.com',
  PWON: 'pakuwonjati.com',
  INKP: 'asiapulppaper.com',
  TKIM: 'asiapulppaper.com',
  TPIA: 'chandra-asri.com',
  MEDC: 'medcoenergi.com',
  AKRA: 'akr.co.id',
  BRIS: 'bankbsi.co.id',
  ARTO: 'jago.com',
  BBTN: 'btn.co.id',
  BNGA: 'cimbniaga.co.id',
  BDMN: 'danamon.co.id',
  PGEO: 'pertamina.com',
  CUAN: 'petrindo.co.id'
};

const FLAGS = ['us', 'id', 'jp', 'gb', 'eu', 'cn', 'hk', 'de', 'fr', 'au', 'ca', 'ch', 'sg', 'kr', 'in'];

function ensureDirs() {
  for (const dir of [COINS_DIR, STOCKS_DIR, FLAGS_DIR, COMMODITIES_DIR, INDICES_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchBuffer(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return { buf, ct };
  } catch {
    return null;
  }
}

function isValidSvg(buf) {
  const txt = buf.toString('utf8', 0, Math.min(buf.length, 300)).trim();
  return txt.includes('<svg');
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const US_STOCK_FALLBACK_DOMAINS = {
  'BRK-B': 'berkshirehathaway.com',
  IWM: 'ishares.com',
  DIA: 'ssga.com',
  GLD: 'spdrgoldshares.com',
  SLV: 'ishares.com',
};

function clearDir(dir) {
  for (const f of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, f));
  }
}

async function downloadFirstValidAsset(destDir, baseName, urlPrefix, candidates) {
  for (const url of candidates) {
    const res = await fetchBuffer(url);
    if (!res) continue;
    const svg = isValidSvg(res.buf);
    if (url.endsWith('.svg') && !svg) continue;
    const ext = svg ? 'svg' : 'png';
    const fileName = `${baseName.toLowerCase()}.${ext}`;
    fs.writeFileSync(path.join(destDir, fileName), res.buf);
    return `${urlPrefix}/${fileName}`;
  }
  return null;
}

function buildDomainIconUrls(domain) {
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://www.google.com/s2/favicons?domain=www.${domain}&sz=128`,
    `https://unavatar.io/${domain}?fallback=false`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

async function syncCrypto() {
  clearDir(COINS_DIR);
  const saved = {};

  await mapLimit(TOP_CRYPTO, 10, async (sym) => {
    const upper = sym.toUpperCase();
    const lower = sym.toLowerCase();
    const resolved = await downloadFirstValidAsset(COINS_DIR, lower, '/icons/coins', [
      `https://raw.githubusercontent.com/0xa3k5/web3icons/main/packages/core/src/svgs/tokens/background/${upper}.svg`,
      `https://raw.githubusercontent.com/0xa3k5/web3icons/main/packages/core/src/svgs/tokens/branded/${upper}.svg`,
      `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${lower}.svg`,
      `https://cdn.jsdelivr.net/gh/davidepalazzo/ticker-logos@main/crypto_icons/${upper}.png`,
    ]);
    if (resolved) saved[upper] = resolved;
  });

  const fiatSvgs = {
    IDR: 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/id.svg',
    USD: 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/us.svg',
    EUR: 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/european_union.svg',
  };
  for (const [code, url] of Object.entries(fiatSvgs)) {
    const resolved = await downloadFirstValidAsset(COINS_DIR, code, '/icons/coins', [url]);
    if (resolved) saved[code] = resolved;
  }

  return saved;
}

async function syncStocks() {
  clearDir(STOCKS_DIR);
  const saved = {};

  await mapLimit(TOP_US_STOCKS, 10, async (ticker) => {
    const upper = ticker.toUpperCase();
    const candidates = [
      `https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/${upper}.svg`,
      `https://cdn.jsdelivr.net/gh/davidepalazzo/ticker-logos@main/ticker_icons/${upper}.png`,
      `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${upper}.png`,
    ];
    if (US_STOCK_FALLBACK_DOMAINS[upper]) {
      candidates.push(...buildDomainIconUrls(US_STOCK_FALLBACK_DOMAINS[upper]));
    }
    const resolved = await downloadFirstValidAsset(STOCKS_DIR, upper, '/icons/stocks', candidates);
    if (resolved) saved[upper] = resolved;
  });

  await mapLimit(Object.entries(IDX_DOMAINS), 8, async ([ticker, domain]) => {
    const upper = ticker.toUpperCase();
    const resolved = await downloadFirstValidAsset(
      STOCKS_DIR,
      upper,
      '/icons/stocks',
      buildDomainIconUrls(domain)
    );
    if (resolved) saved[upper] = resolved;
  });

  return saved;
}

async function syncFlags() {
  const saved = {};
  await mapLimit(FLAGS, 8, async (code) => {
    const remoteCode = code === 'eu' ? 'european_union' : code;
    const url = `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${remoteCode}.svg`;
    const res = await fetchBuffer(url);
    if (res && isValidSvg(res.buf)) {
      const fileName = `${code}.svg`;
      fs.writeFileSync(path.join(FLAGS_DIR, fileName), res.buf);
      saved[code.toUpperCase()] = `/icons/flags/${fileName}`;
    }
  });
  return saved;
}

function writeSpecialVectorIcons() {
  const commodities = {
    GOLD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="55%" stop-color="#EAB308"/><stop offset="100%" stop-color="#A16207"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="#1C1917"/><path d="M16 41l6-14h20l6 14H16z" fill="url(#g)"/><path d="M22 27l4-8h12l4 8H22z" fill="#FEF08A" opacity="0.9"/><path d="M18 41h28l-2 5H20l-2-5z" fill="#CA8A04"/></svg>`,
    SILVER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F8FAFC"/><stop offset="55%" stop-color="#94A3B8"/><stop offset="100%" stop-color="#475569"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="#0F172A"/><path d="M16 41l6-14h20l6 14H16z" fill="url(#s)"/><path d="M22 27l4-8h12l4 8H22z" fill="#E2E8F0" opacity="0.9"/><path d="M18 41h28l-2 5H20l-2-5z" fill="#64748B"/></svg>`,
    OIL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#111827"/><path d="M32 14c-7 10-14 17-14 25a14 14 0 0 0 28 0c0-8-7-15-14-25z" fill="#38BDF8" opacity="0.2"/><path d="M32 16c-6 9-12 15-12 22a12 12 0 0 0 24 0c0-7-6-13-12-22zm-4 24a5 5 0 0 1-2-6c0 3 1 5 4 6h-2z" fill="#F59E0B"/></svg>`,
    NATGAS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0C192C"/><path d="M33 13c3 8-2 12 3 18 3 4 7 6 7 12a11 11 0 1 1-22 0c0-7 5-12 8-17 2-4 3-8 4-13z" fill="#38BDF8"/><path d="M32 32c2 4 4 6 4 10a5 5 0 1 1-10 0c0-4 3-7 6-10z" fill="#E0F2FE"/></svg>`,
    COPPER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDBA74"/><stop offset="60%" stop-color="#C2410C"/><stop offset="100%" stop-color="#7C2D12"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="#1C1412"/><rect x="17" y="22" width="30" height="20" rx="5" fill="url(#c)"/><circle cx="32" cy="32" r="6" fill="#FFEDD5" opacity="0.85"/></svg>`
  };

  const commodityMap = {};
  for (const [key, svg] of Object.entries(commodities)) {
    const fileName = `${key.toLowerCase()}.svg`;
    fs.writeFileSync(path.join(COMMODITIES_DIR, fileName), svg);
    commodityMap[key] = `/icons/commodities/${fileName}`;
  }

  const macroIndices = {
    TOTAL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0F172A"/><circle cx="32" cy="32" r="18" fill="none" stroke="#38BDF8" stroke-width="2.5"/><ellipse cx="32" cy="32" rx="9" ry="18" fill="none" stroke="#38BDF8" stroke-width="2"/><path d="M14 32h36M17 23h30M17 41h30" stroke="#38BDF8" stroke-width="2"/></svg>`,
    TOTAL2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#1E1B4B"/><path d="M32 14a18 18 0 1 0 18 18H32V14z" fill="#818CF8"/><path d="M36 14v14h14a14 14 0 0 0-14-14z" fill="#34D399"/></svg>`,
    TOTAL3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#172554"/><rect x="17" y="32" width="7" height="15" rx="2" fill="#60A5FA"/><rect x="28.5" y="23" width="7" height="24" rx="2" fill="#34D399"/><rect x="40" y="16" width="7" height="31" rx="2" fill="#A78BFA"/></svg>`,
    OTHERS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#18181B"/><circle cx="22" cy="24" r="6" fill="#F472B6"/><circle cx="42" cy="24" r="6" fill="#38BDF8"/><circle cx="32" cy="41" r="6" fill="#34D399"/></svg>`,
    'BTC.D': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#271608"/><circle cx="32" cy="32" r="20" fill="#F7931A"/><path d="M37 28.5c.6-4-2.5-6.2-6.7-7.6l1.4-5.5-3.3-.8-1.3 5.4-2.7-.6 1.4-5.4-3.4-.8-1.4 5.5-6.6-1.6-.9 3.6s2.5.6 2.4.6c1.4.3 1.6 1.2 1.6 1.9l-3.8 15.2c-.2.5-.6 1.2-1.7.9l-2.4-.6-1.6 3.8 6.3 1.6-1.4 5.6 3.3.8 1.4-5.5 2.7.7-1.4 5.5 3.4.8 1.4-5.6c5.8 1.1 10.1.7 11.9-4.5 1.5-4.2-.1-6.6-3.1-8.2 2.2-.5 3.9-2 4.3-5z" fill="#FFF"/><circle cx="49" cy="49" r="11" fill="#0F172A" stroke="#F7931A" stroke-width="2"/><text x="49" y="53" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="#FFF" text-anchor="middle">%</text></svg>`,
    'ETH.D': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#171E36"/><circle cx="32" cy="32" r="20" fill="#627EEA"/><path d="M32 17l-9 15 9 5.3 9-5.3-9-15zm0 23.3l-9-5.3 9 12.6 9-12.6-9 5.3z" fill="#FFF"/><circle cx="49" cy="49" r="11" fill="#0F172A" stroke="#627EEA" stroke-width="2"/><text x="49" y="53" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="#FFF" text-anchor="middle">%</text></svg>`,
    'USDT.D': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0B241E"/><circle cx="32" cy="32" r="20" fill="#26A17B"/><path d="M22 21h20v4.5h-7.5v3.7c5.2.3 9.1 1.4 9.1 2.8s-3.9 2.5-9.1 2.8V45h-5V34.8c-5.2-.3-9.1-1.4-9.1-2.8s3.9-2.5 9.1-2.8v-3.7H22V21z" fill="#FFF"/><circle cx="49" cy="49" r="11" fill="#0F172A" stroke="#26A17B" stroke-width="2"/><text x="49" y="53" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="#FFF" text-anchor="middle">%</text></svg>`,
  };

  const indexMap = {};
  for (const [key, svg] of Object.entries(macroIndices)) {
    const fileName = `${key.toLowerCase().replace('.', '')}.svg`;
    fs.writeFileSync(path.join(INDICES_DIR, fileName), svg);
    indexMap[key] = `/icons/indices/${fileName}`;
  }

  return { commodityMap, indexMap };
}

function generateManifest({ coins, stocks, flags, commodityMap, indexMap }) {
  const content = `// File ini di-generate otomatis oleh scripts/sync-asset-icons.mjs

export const LOCAL_COIN_ICON_PATHS: Record<string, string> = ${JSON.stringify(coins, null, 2)};

export const LOCAL_STOCK_ICON_PATHS: Record<string, string> = ${JSON.stringify(stocks, null, 2)};

export const LOCAL_FLAG_ICON_PATHS: Record<string, string> = ${JSON.stringify(flags, null, 2)};

export const LOCAL_COMMODITY_ICON_PATHS: Record<string, string> = ${JSON.stringify(commodityMap, null, 2)};

export const LOCAL_MACRO_INDEX_ICON_PATHS: Record<string, string> = ${JSON.stringify(indexMap, null, 2)};

export const IDX_COMPANY_DOMAINS: Record<string, string> = ${JSON.stringify(IDX_DOMAINS, null, 2)};
`;
  fs.writeFileSync(MANIFEST_PATH, content, 'utf8');
}

async function main() {
  ensureDirs();
  console.log('Menarik Top 100 Crypto (web3icons)...');
  const coins = await syncCrypto();
  console.log(`Crypto lokal tersimpan: ${Object.keys(coins).length}`);

  console.log('Menarik Top 100 Saham (US + IDX)...');
  const stocks = await syncStocks();
  console.log(`Saham lokal tersimpan: ${Object.keys(stocks).length}`);

  console.log('Menarik bendera SVG (circle-flags)...');
  const flags = await syncFlags();
  console.log(`Bendera lokal tersimpan: ${Object.keys(flags).length}`);

  console.log('Menulis ikon vektor komoditas & indeks makro...');
  const { commodityMap, indexMap } = writeSpecialVectorIcons();

  generateManifest({ coins, stocks, flags, commodityMap, indexMap });
  console.log('Manifest selesai dibuat:', MANIFEST_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
