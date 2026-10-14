import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBorderColor } from '../src/lib/utils/colorUtils';

test('colorUtils: deriveBorderColor menghitung warna border 15% lebih gelap secara deterministik', () => {
  // Pure White (#FFFFFF) dikurangi 15% -> 255 * 0.85 = 216.75 -> 217 -> #D9D9D9
  const whiteBorder = deriveBorderColor('#FFFFFF', 0.15);
  assert.equal(whiteBorder.toUpperCase(), '#D9D9D9');

  // Ivory White (#F7F7F7) -> 247 * 0.85 = 209.95 -> 210 -> #D2D2D2
  const ivoryBorder = deriveBorderColor('#F7F7F7', 0.15);
  assert.equal(ivoryBorder.toUpperCase(), '#D2D2D2');

  // Hot Pink (#FF69B4) -> R: 255*0.85=217 (#D9), G: 105*0.85=89.25->89 (#59), B: 180*0.85=153 (#99) -> #D95999
  const pinkBorder = deriveBorderColor('#FF69B4', 0.15);
  assert.equal(pinkBorder.toUpperCase(), '#D95999');

  // Mendukung short hex 3-digit (#FFF -> #D9D9D9)
  const shortHexBorder = deriveBorderColor('#FFF', 0.15);
  assert.equal(shortHexBorder.toUpperCase(), '#D9D9D9');

  // Fallback anggun jika hex tidak valid
  const invalidFallback = deriveBorderColor('invalid-color', 0.15);
  assert.equal(invalidFallback, 'invalid-color');
});
