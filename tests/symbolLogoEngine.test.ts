import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveCoinLogoUrl,
  resolveQuoteLogoUrl,
  shouldShowDualAssetBadge,
  classifySymbolForLogo,
  getMonogramInitials,
  getMonogramColor,
  LOCAL_COIN_SVGS,
} from '../src/lib/services/symbolLogoService';
import {
  buildLogoCacheKey,
  clearLogoCache,
  getCachedLogoLookup,
  recordLogoFailure,
  recordLogoSuccess,
} from '../src/lib/services/symbolLogoCache';

describe('Ticket 3 (#89) & Multi-Asset Logo Engine', () => {
  describe('1. Local Asset Bundle Coverage & Quality', () => {
    test('Daftar koin lokal mencakup aset-aset kripto utama dan kuotasi populer', () => {
      const requiredCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'USDT', 'USDC', 'IDR'];
      for (const coin of requiredCoins) {
        assert.ok(
          LOCAL_COIN_SVGS.has(coin.toUpperCase()),
          `LOCAL_COIN_SVGS harus mencakup ${coin}`
        );
      }
    });

    test('Seluruh SVG lokal di static/icons/coins/ bukan placeholder teks lingkaran lama', () => {
      const coinsDir = path.join(process.cwd(), 'static', 'icons', 'coins');
      const svgFiles = fs.readdirSync(coinsDir).filter((f) => f.endsWith('.svg'));
      assert.ok(svgFiles.length >= 50, 'Minimal 50 SVG koin lokal harus tersedia');
      for (const file of svgFiles) {
        const content = fs.readFileSync(path.join(coinsDir, file), 'utf-8');
        assert.ok(!content.includes('<text'), `${file} masih berisi placeholder <text>`);
      }
    });

    test('resolveCoinLogoUrl mengembalikan path lokal untuk koin yang ada di bundle lokal', () => {
      const btcUrl = resolveCoinLogoUrl('BTC');
      assert.equal(btcUrl.primary, '/icons/coins/btc.svg');
      assert.ok(btcUrl.isLocal);

      const ethUrl = resolveCoinLogoUrl('ETH');
      assert.equal(ethUrl.primary, '/icons/coins/eth.svg');
      assert.ok(ethUrl.isLocal);

      const idrUrl = resolveCoinLogoUrl('IDR');
      assert.equal(idrUrl.primary, '/icons/coins/idr.svg');
    });

    test('resolveCoinLogoUrl mengembalikan multi-tier CDN fallback (web3icons + ticker-logos) untuk koin non-lokal', () => {
      const url = resolveCoinLogoUrl('EXOTICTOKEN');
      assert.equal(url.isLocal, false);
      assert.ok(url.primary.includes('web3icons'));
      assert.ok(url.fallbacks.some((u) => u.includes('davidepalazzo/ticker-logos')));
      assert.ok(url.fallbacks.some((u) => u.includes('spothq/cryptocurrency-icons')));
    });
  });

  describe('2. Multi-Asset Class Routing & Ticker Collision Guard', () => {
    test('Membedakan saham IDX, saham US, indeks bursa, komoditas, dan forex dengan akurat', () => {
      const bbca = resolveCoinLogoUrl('BBCA', { symbol: 'BBCA.JK', provider: 'Yahoo Finance' });
      assert.equal(bbca.assetClass, 'stock');
      assert.equal(bbca.isLocal, true);
      assert.ok(bbca.primary.startsWith('/icons/stocks/bbca.'));
      assert.equal(bbca.needsContrastBacking, true);

      const aapl = resolveCoinLogoUrl('AAPL', { symbol: 'AAPL', provider: 'Yahoo Finance' });
      assert.equal(aapl.assetClass, 'stock');
      assert.equal(aapl.isLocal, true);
      assert.ok(aapl.primary.startsWith('/icons/stocks/aapl.'));

      const unknownStock = resolveCoinLogoUrl('UNKNWN', { symbol: 'UNKNWN', provider: 'Yahoo Finance' });
      assert.equal(unknownStock.assetClass, 'stock');
      assert.equal(unknownStock.isLocal, false);
      assert.ok(unknownStock.primary.includes('davidepalazzo/ticker-logos'));

      const ihsg = resolveCoinLogoUrl('JKSE', { symbol: '^JKSE', provider: 'Yahoo Finance' });
      assert.equal(ihsg.assetClass, 'market-index');
      assert.equal(ihsg.primary, '/icons/flags/id.svg');

      const gold = resolveCoinLogoUrl('GC', { symbol: 'GC=F', provider: 'Yahoo Finance' });
      assert.equal(gold.assetClass, 'commodity');
      assert.equal(gold.primary, '/icons/commodities/gold.svg');

      const eurusd = resolveCoinLogoUrl('EUR', { symbol: 'EUR/USD', provider: 'Yahoo Finance' });
      assert.equal(eurusd.assetClass, 'forex');
      assert.equal(eurusd.primary, '/icons/flags/eu.svg');
      assert.equal(eurusd.secondaryResolution?.primary, '/icons/flags/us.svg');
      assert.ok(eurusd.secondaryResolution?.fallbacks.some((u) => u.includes('circle-flags')));

      const quoteRes = resolveQuoteLogoUrl('USD', eurusd);
      assert.equal(quoteRes?.primary, '/icons/flags/us.svg');
      assert.equal(shouldShowDualAssetBadge('EUR', 'USD', eurusd, false), true);
      assert.equal(shouldShowDualAssetBadge('JKSE', 'IDR', ihsg, false), false);
    });

    test('Mencegah bentrok ticker kembar (mis. SOL crypto vs SOL saham & COINUSDT tanpa provider)', () => {
      assert.equal(classifySymbolForLogo('SOL', { symbol: 'SOLUSDT', provider: 'Binance Spot' }), 'crypto');
      assert.equal(classifySymbolForLogo('SOL', { symbol: 'SOL', provider: 'Yahoo Finance' }), 'stock');
      assert.equal(classifySymbolForLogo('COIN', { symbol: 'COINUSDT' }), 'crypto');
      assert.equal(classifySymbolForLogo('COIN', { symbol: 'COIN' }), 'stock');
    });
  });

  describe('3. Positive & Negative Cache Behavior', () => {
    test('Menyimpan URL sukses dan negative-cache untuk mencegah spam 404', () => {
      clearLogoCache();
      const key = buildLogoCacheKey('stock', 'RARESTOCK99');
      recordLogoSuccess(key, 'https://example.com/rare.png');
      const hit = getCachedLogoLookup(key);
      assert.equal(hit.hit, true);
      assert.equal(hit.url, 'https://example.com/rare.png');
      assert.equal(hit.failed, false);

      const failKey = buildLogoCacheKey('crypto', 'DEADCOIN99');
      recordLogoFailure(failKey);
      const resAfterFail = resolveCoinLogoUrl('DEADCOIN99');
      assert.equal(resAfterFail.primary, '');
      assert.equal(resAfterFail.fallbacks.length, 0);
      clearLogoCache();
    });
  });

  describe('4. Monogram Initials & Deterministic Colors', () => {
    test('getMonogramInitials menghasilkan inisial yang bersih dan ringkas (maks 4 karakter)', () => {
      assert.equal(getMonogramInitials('BTC'), 'BTC');
      assert.equal(getMonogramInitials('ETH'), 'ETH');
      assert.equal(getMonogramInitials('1000SATS'), 'SATS');
      assert.equal(getMonogramInitials('DOGECOIN'), 'DOGE');
    });

    test('getMonogramColor deterministik (menghasilkan warna yang sama untuk simbol yang sama)', () => {
      const color1 = getMonogramColor('BTC');
      const color2 = getMonogramColor('BTC');
      assert.equal(color1, color2);
      assert.ok(
        color1.startsWith('hsl') || color1.startsWith('#') || color1.startsWith('linear-gradient'),
        'Warna monogram harus berupa nilai warna CSS yang valid atau linear-gradient'
      );

      const colorEth = getMonogramColor('ETH');
      assert.notEqual(color1, colorEth, 'Koin berbeda sebaiknya menghasilkan warna berbeda');
    });
  });
});
