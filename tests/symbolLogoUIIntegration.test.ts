import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseAdaptiveSymbol } from '../src/lib/services/market/symbolSearchService';
import { resolveCoinLogoUrl, getMonogramInitials, getMonogramColor } from '../src/lib/services/symbolLogoService';

describe('Ticket 4 (#90): End-to-End Symbol Logo UI Integration Suite', () => {
  test('Integrasi simbol pair beragam format menghasilkan logo dan badge yang tepat', () => {
    // 1. Standar crypto quote (ETHBTC)
    const ethBtc = parseAdaptiveSymbol('ETHBTC');
    const ethLogo = resolveCoinLogoUrl(ethBtc.baseAsset);
    const btcBadge = resolveCoinLogoUrl(ethBtc.quoteAsset);
    assert.equal(ethBtc.baseAsset, 'ETH');
    assert.equal(ethBtc.quoteAsset, 'BTC');
    assert.ok(ethLogo.primary.includes('eth.svg'));
    assert.ok(btcBadge.primary.includes('btc.svg'));

    // 2. Fiat / IDR quote (BTCIDR)
    const btcIdr = parseAdaptiveSymbol('BTCIDR');
    const idrBadge = resolveCoinLogoUrl(btcIdr.quoteAsset);
    assert.equal(btcIdr.quoteAsset, 'IDR');
    assert.ok(idrBadge.primary.includes('idr.svg'));

    // 3. Exotic token tanpa bundle lokal (RESOLV)
    const resolv = parseAdaptiveSymbol('RESOLVUSDT');
    const resolvLogo = resolveCoinLogoUrl(resolv.baseAsset);
    assert.equal(resolv.baseAsset, 'RESOLV');
    assert.equal(resolvLogo.isLocal, false);
    assert.ok(resolvLogo.primary.includes('jsdelivr.net'));
    assert.equal(getMonogramInitials('RESOLV'), 'RESO');
    assert.ok(getMonogramColor('RESOLV').startsWith('hsl'));
  });

  test('Seluruh file UI utama telah mengimpor SymbolLogo dan parseAdaptiveSymbol', () => {
    const rootDir = process.cwd();
    const files = [
      'src/lib/components/Header.svelte',
      'src/lib/components/header/QuickSymbolsDropdown.svelte',
      'src/lib/components/SymbolSearchModal.svelte',
      'src/lib/components/WatchlistPanel.svelte',
    ];

    for (const f of files) {
      const fullPath = path.join(rootDir, f);
      assert.ok(fs.existsSync(fullPath), `File ${f} harus ada`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.includes('SymbolLogo'),
        `File ${f} harus mengimpor dan menggunakan SymbolLogo`
      );
    }
  });
});
