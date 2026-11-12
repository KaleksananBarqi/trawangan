import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMacroCompactValue } from '../src/lib/services/macroIndexCatalog';
import {
  resolveMacroAxisMode,
  syncCellMacroVelaAxis,
} from '../src/lib/services/macroVelaAxisAdapter';
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
  test('1. formatMacroCompactValue menyesuaikan zoom tanpa duplikasi tick', () => {
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
    assert.equal(formatMacroCompactValue(2.654e12, 'TOTAL', 2e9), '2.654T');
    assert.equal(formatMacroCompactValue(2.654e12, 'TOTAL', 5e10), '2.65T');
    assert.equal(formatMacroCompactValue(850.123e9, 'TOTAL3', 5e7), '850.123B');
    assert.equal(formatMacroCompactValue(56.842, 'BTC.D', 0.005), '56.842%');
    assert.equal(formatMacroCompactValue(56.842, 'BTC.D', 0.05), '56.84%');
  });

  test('2. priceScaleLabelService & chartSnapshotService memformat makro sekaligus mempertahankan format IDR/BTC/USDT', () => {
    assert.equal(formatPriceLabel(2.65e12, undefined, 'TOTAL'), '2.65T');
    assert.equal(formatPriceLabel(56.84, undefined, 'BTC.D'), '56.84%');
    assert.equal(formatPriceLabel(2.65e12, 'USD', 'TOTAL'), '2.65T');
    assert.equal(formatPriceLabel(56.84, '%'), '56.84%');
    // Tanpa simbol makro, quote 'USD' memakai formatter reguler (bukan sentinel MAGIK MACRO_USD).
    assert.equal(formatPriceLabel(68500.1, 'USD'), '68,500.10');

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

  test('4. macroVelaAxisAdapter menghitung kontras WCAG hex 3-digit & crosshair chip secara dinamis', () => {
    const chipCalls: Array<{ text: string; bg: string; over: string }> = [];
    const fillStylesUsed: string[] = [];
    const fakePane = {
      kind: 'price',
      bounds: { top: 0, height: 200 },
      scale: {},
      axisFormat: 'price',
    };
    const fakeCtx: any = {
      _fillStyle: '',
      set fillStyle(v: string) {
        this._fillStyle = v;
        fillStylesUsed.push(v);
      },
      get fillStyle() {
        return this._fillStyle;
      },
      strokeStyle: '',
      lineWidth: 1,
      textBaseline: 'middle',
      textAlign: 'start',
      setLineDash: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillRect: () => {},
      fillText: () => {},
      measureText: (txt: string) => ({ width: txt.length * 6 }),
    };
    let activeUpColor = '#FFF';
    const native: any = {
      scene: {
        scaleMode: 'price',
        showPriceLabel: true,
        showPriceLine: false,
        showCountdown: false,
        bars: [{ time: 1_700_000_000_000, close: 2.65e12 }],
        panes: new Map([['price', fakePane]]),
      },
      coords: {
        priceToY: () => 100,
        yToPrice: () => 2.65e12,
        barInterval: 0,
      },
      set: () => {},
      scheduler: { invalidate: () => {} },
      crosshairLayer: {
        chip(_ctx: any, _x: number, _y: number, text: string, bg: string, _align: string, _below?: boolean, over = '#000000') {
          chipCalls.push({ text, bg, over });
        },
      },
      chrome: {
        priceElementColor: () => activeUpColor,
        drawPriceLineAndCountdown() {},
      },
    };
    const fakeCell = { chart: { renderer: { renderer: native } } };

    syncCellMacroVelaAxis(fakeCell, 'macro_usd');

    // Crosshair chip wajib menghitung kontras terhadap bg (hex 3-digit #FFF & #000) alih-alih hardcode #000000
    native.crosshairLayer.chip(fakeCtx, 100, 100, 'raw', '#FFF', 'left', false, '#000000');
    native.crosshairLayer.chip(fakeCtx, 100, 100, 'raw', '#000', 'left', false, '#000000');
    assert.equal(chipCalls[0].text, '2.65T');
    assert.equal(chipCalls[0].over, '#0A0A0A');
    assert.equal(chipCalls[1].over, '#FFFFFF');

    // Badge harga terakhir untuk short hex #FFF & #000 wajib memakai teks gelap vs terang WCAG
    native.chrome.drawPriceLineAndCountdown(fakeCtx, native.scene, native.coords, { upColor: '#FFF' }, 500, fakePane);
    assert.equal(fillStylesUsed.includes('#0A0A0A'), true);

    fillStylesUsed.length = 0;
    activeUpColor = '#000';
    native.chrome.drawPriceLineAndCountdown(fakeCtx, native.scene, native.coords, { upColor: '#000' }, 500, fakePane);
    assert.equal(fillStylesUsed.includes('#FFFFFF'), true);
  });
});
