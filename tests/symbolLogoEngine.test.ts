import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCoinLogoUrl,
  getMonogramInitials,
  getMonogramColor,
  LOCAL_COIN_SVGS,
} from '../src/lib/services/symbolLogoService';

describe('Ticket 3 (#89): Hybrid Asset Logo Engine & Local SVG Bundling', () => {
  describe('1. Local SVG Bundle Coverage', () => {
    test('Daftar koin lokal mencakup aset-aset kripto utama dan kuotasi populer', () => {
      const requiredCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'USDT', 'USDC', 'IDR'];
      for (const coin of requiredCoins) {
        assert.ok(
          LOCAL_COIN_SVGS.has(coin.toUpperCase()),
          `LOCAL_COIN_SVGS harus mencakup ${coin}`
        );
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

    test('resolveCoinLogoUrl mengembalikan CDN fallback untuk koin di luar bundle lokal', () => {
      const rareToken = 'EXOTICTOKEN';
      const url = resolveCoinLogoUrl(rareToken);
      assert.ok(url.primary.includes('jsdelivr.net') || url.primary.includes('spothq'));
      assert.equal(url.isLocal, false);
    });
  });

  describe('2. Monogram Initials & Deterministic Colors', () => {
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
      assert.ok(color1.startsWith('hsl') || color1.startsWith('#'));

      const colorEth = getMonogramColor('ETH');
      assert.notEqual(color1, colorEth, 'Koin berbeda sebaiknya menghasilkan warna berbeda');
    });
  });
});
