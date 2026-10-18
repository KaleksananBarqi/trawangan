// Unit & Seam Tests untuk Tiket #66: Deterministic Provider Switching and Search Result Navigation
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Logika resolver bursa deterministik yang diekstrak untuk pengujian seam
 */
export function resolveTargetProvider(
  newSym: string,
  providerHint?: string,
  currentProvider: string = 'binance'
): string {
  const clean = newSym.trim().toUpperCase();
  const hint = providerHint ? providerHint.trim().toLowerCase() : '';

  if (hint) {
    if (hint.includes('indodax') || hint === 'indodax') return 'indodax';
    if (hint.includes('bitunix') || hint === 'bitunix') return 'bitunix';
    if (hint.includes('binance') || hint === 'binance') return 'binance';
    if (hint.includes('hyperliquid') || hint === 'hyperliquid') return 'hyperliquid';
    if (hint.includes('coinbase') || hint === 'coinbase') return 'coinbase';
    return hint;
  }

  // Jika tanpa hint, infer dari konvensi simbol
  if (clean.endsWith('IDR')) {
    return 'indodax';
  }
  if (clean.endsWith('.P') && currentProvider === 'indodax') {
    return 'bitunix';
  }
  if (clean.includes('USDT') && currentProvider === 'indodax') {
    return 'binance';
  }

  return currentProvider;
}

describe('Tiket #66: Deterministic Provider Switching and Search Result Navigation', () => {
  it('1. Beralih dari Bitunix ke Binance secara deterministik saat koin Binance dipilih', () => {
    // Kondisi bug sebelumnya: saat di bitunix, memilih koin Binance tetap tertahan di bitunix
    const target = resolveTargetProvider('BTCUSDT', 'Binance Official Public', 'bitunix');
    assert.equal(target, 'binance');

    const target2 = resolveTargetProvider('ETHUSDT', 'binance', 'bitunix');
    assert.equal(target2, 'binance');
  });

  it('2. Beralih dari Binance ke Bitunix secara deterministik saat koin Bitunix dipilih', () => {
    const target = resolveTargetProvider('BTCUSDT.P', 'Bitunix Futures', 'binance');
    assert.equal(target, 'bitunix');

    const target2 = resolveTargetProvider('SOLUSDT.P', 'bitunix', 'binance');
    assert.equal(target2, 'bitunix');
  });

  it('3. Beralih ke Indodax saat koin IDR atau provider hint Indodax dipilih dari bursa manapun', () => {
    assert.equal(resolveTargetProvider('BTCIDR', 'Indodax Spot', 'bitunix'), 'indodax');
    assert.equal(resolveTargetProvider('BTCIDR', undefined, 'binance'), 'indodax');
    assert.equal(resolveTargetProvider('ETHIDR', undefined, 'bitunix'), 'indodax');
  });

  it('4. Mempertahankan bursa aktif jika koin kuotasi kompatibel dan tanpa hint bursa lain', () => {
    assert.equal(resolveTargetProvider('ETHUSDT', undefined, 'bitunix'), 'bitunix');
    assert.equal(resolveTargetProvider('ETHUSDT', undefined, 'binance'), 'binance');
  });
});
