import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeByKey } from '../src/lib/utils/dedupeByKey';
import {
  extractDrawingPriceBadges,
  extractIndicatorPriceBadges,
} from '../src/lib/services/priceScaleLabelService';

describe('Each-Key Deduplication Guard Suite', () => {
  test('dedupeByKey mempertahankan urutan kemunculan pertama dan membuang key duplikat', () => {
    const input = [
      { id: 'a', label: 'first-a' },
      { id: 'b', label: 'first-b' },
      { id: 'a', label: 'second-a' },
      { id: 'c', label: 'first-c' },
      { id: 'b', label: 'second-b' },
    ];

    const result = dedupeByKey(input, (item) => item.id);
    assert.deepStrictEqual(result, [
      { id: 'a', label: 'first-a' },
      { id: 'b', label: 'first-b' },
      { id: 'c', label: 'first-c' },
    ]);
  });

  test('extractDrawingPriceBadges menjamin id badge unik walau drawing input mengandung id kembar', () => {
    const dupDrawings = [
      {
        id: 'pos-1',
        type: 'position',
        visible: true,
        anchors: [{ price: 150 }, { price: 140 }, { price: 180 }],
      },
      {
        id: 'pos-1',
        type: 'position',
        visible: true,
        anchors: [{ price: 150 }, { price: 140 }, { price: 180 }],
      },
      {
        id: 'hline-1',
        type: 'hline',
        visible: true,
        anchors: [{ price: 160 }],
      },
      {
        id: 'hline-1',
        type: 'hline',
        visible: true,
        anchors: [{ price: 161 }],
      },
    ];

    const badges = extractDrawingPriceBadges(dupDrawings, undefined, 'USDT', 'SOLUSDT.P');
    const ids = badges.map((b) => b.id);
    assert.strictEqual(new Set(ids).size, ids.length, `Badge id harus unik, ditemukan: ${ids.join(', ')}`);
  });

  test('extractIndicatorPriceBadges menjamin id badge unik walau indikator input mengandung id kembar', () => {
    const dupIndicators = [
      { id: 'ema-20', title: 'EMA 20', lastValue: 155.5, visible: true },
      { id: 'ema-20', title: 'EMA 20', lastValue: 156.0, visible: true },
      { id: 'rsi-14', title: 'RSI 14', lastValue: 61.2, visible: true },
    ];

    const badges = extractIndicatorPriceBadges(dupIndicators, undefined, 'USDT', 'SOLUSDT.P');
    const ids = badges.map((b) => b.id);
    assert.deepStrictEqual(ids, ['ind_ema-20', 'ind_rsi-14']);
  });
});
