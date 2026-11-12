import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMacroCompactValue } from '../src/lib/services/macroIndexCatalog';
import { formatMacroTickValue, resolveMacroAxisMode } from '../src/lib/services/macroVelaAxisAdapter';
import {
  formatPriceLabel,
  formatPriceWithQuoteSymbol,
} from '../src/lib/services/priceScaleLabelService';
import { getAdaptiveTickSize, roundToTickSize } from '../src/lib/services/priceSnapService';
import {
  buildAutoAlertLabel,
  computeTickAlignedAlertPrice,
  parseAlertPriceInput,
} from '../src/lib/services/alertFormHelper';
import { formatSnapshotPrice } from '../src/lib/services/chartSnapshotService';

describe('ADR-0024: Pemformatan Nilai Makro, Sumbu Vela, Tick Size, & Zero Regresi Reguler', () => {
  test('1. formatMacroCompactValue dan formatMacroTickValue menyesuaikan zoom tanpa duplikasi tick', () => {
    const capSamples = [2.65e12, 1.08e12, 850.5e9, 45.25e9, 12.5e6];
    for (const val of capSamples) {
      const label = formatMacroCompactValue(val, 'USD');
      assert.ok(label.length <= 7, `Label "${label}" terlalu panjang untuk sumbu 64px`);
    }
    assert.equal(formatMacroCompactValue(2.65e12, 'TOTAL'), '2.65T');
    assert.equal(formatMacroCompactValue(850.5e9, 'TOTAL3'), '850.5B');
    assert.equal(formatMacroCompactValue(45.25e9, 'OTHERS'), '45.25B');
    assert.equal(formatMacroCompactValue(56.84, 'BTC.D'), '56.84%');

    assert.equal(resolveMacroAxisMode('TOTAL'), 'macro_usd');
    assert.equal(resolveMacroAxisMode('BTC.D'), 'macro_percent');
    assert.equal(resolveMacroAxisMode('BTCUSDT'), null);

    // Zoom dalam pada Triliunan (step < 10B) menambah 1 digit presisi agar label tick unik
    assert.equal(formatMacroTickValue(2.654e12, 'macro_usd', 2e9), '2.654T');
    assert.equal(formatMacroTickValue(2.654e12, 'macro_usd', 5e10), '2.65T');
    assert.equal(formatMacroTickValue(56.842, 'macro_percent', 0.005), '56.842%');
    assert.equal(formatMacroTickValue(56.842, 'macro_percent', 0.05), '56.84%');
  });

  test('2. priceScaleLabelService & chartSnapshotService memformat makro sekaligus mempertahankan format IDR/BTC/USDT', () => {
    assert.equal(formatPriceLabel(2.65e12, undefined, 'TOTAL'), '2.65T');
    assert.equal(formatPriceLabel(56.84, undefined, 'BTC.D'), '56.84%');
    assert.equal(formatPriceLabel(2.65e12, 'MACRO_USD'), '2.65T');
    assert.equal(formatPriceLabel(56.84, '%'), '56.84%');

    assert.equal(formatPriceWithQuoteSymbol(2.65e12, 'USD', 'TOTAL'), '$2.65T');
    assert.equal(formatPriceWithQuoteSymbol(56.84, '%', 'BTC.D'), '56.84%');

    // Snapshot formatter
    assert.equal(formatSnapshotPrice(2.65e12, undefined, 'TOTAL'), '2.65T');
    assert.equal(formatSnapshotPrice(56.84, undefined, 'BTC.D'), '56.84%');
    assert.equal(formatSnapshotPrice(68500.5), formatPriceLabel(68500.5));
    assert.equal(formatSnapshotPrice(1500000, 'IDR'), formatPriceLabel(1500000, 'IDR'));

    // Zero regresi pada pair reguler
    assert.equal(formatPriceLabel(68500.1, 'USDT', 'BTCUSDT'), '68,500.10');
    assert.equal(formatPriceWithQuoteSymbol(68500.1, 'USDT', 'BTCUSDT'), '$68,500.10');
    assert.equal(formatPriceWithQuoteSymbol(1500000, 'IDR', 'BTCIDR'), 'Rp 1.500.000');
    assert.equal(formatPriceWithQuoteSymbol(0.032, 'BTC', 'ETHBTC'), '0.03200000 ₿');
  });

  test('3. priceSnapService dan alertFormHelper menangani input T/B/M/% & tick size makro tanpa merusak pair biasa', () => {
    assert.equal(getAdaptiveTickSize(2.65e12, undefined, 'TOTAL'), 1e9);
    assert.equal(getAdaptiveTickSize(850e9, undefined, 'TOTAL2'), 1e8);
    assert.equal(getAdaptiveTickSize(56.84, undefined, 'BTC.D'), 0.01);
    assert.equal(roundToTickSize(2_654_499_999_999, undefined, 'TOTAL'), 2_654_000_000_000);
    assert.equal(roundToTickSize(56.8439, undefined, 'BTC.D'), 56.84);

    // Zero regresi pair biasa
    assert.equal(roundToTickSize(68500.1234, undefined, 'BTCUSDT'), 68500.12);
    assert.equal(roundToTickSize(1.23456, undefined, 'XRPUSDT'), 1.2346);

    assert.equal(parseAlertPriceInput('2.65T'), 2.65e12);
    assert.equal(parseAlertPriceInput('$850.5B'), 850.5e9);
    assert.equal(parseAlertPriceInput('12.5M'), 12.5e6);
    assert.equal(parseAlertPriceInput('56.84%'), 56.84);
    assert.equal(parseAlertPriceInput('1.450.000,50'), 1450000.5);
    assert.equal(parseAlertPriceInput('65,432.10'), 65432.1);

    assert.equal(buildAutoAlertLabel('TOTAL', '2.65T'), 'Target TOTAL @ $2.65T');
    assert.equal(buildAutoAlertLabel('BTC.D', 56.84), 'Target BTC.D @ 56.84%');

    const alignedCap = computeTickAlignedAlertPrice(2.6514e12, false, undefined, 'TOTAL');
    assert.equal(alignedCap.price, 2.651e12);
    assert.equal(alignedCap.formattedText, '2.651T');

    const alignedDom = computeTickAlignedAlertPrice(56.844, false, undefined, 'BTC.D');
    assert.equal(alignedDom.price, 56.84);
    assert.equal(alignedDom.formattedText, '56.84');
  });
});
