import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTimeframeDurationMs,
  calculateHistoricalWindow,
  isTargetInReplayBounds,
} from '../src/lib/services/replay/historicalRange';

describe('Replay Historical Range & On-Demand Window Calculator', () => {
  it('1. getTimeframeDurationMs: mengembalikan durasi milidetik per bar dengan tepat', () => {
    assert.equal(getTimeframeDurationMs('1m'), 60 * 1000);
    assert.equal(getTimeframeDurationMs('5m'), 5 * 60 * 1000);
    assert.equal(getTimeframeDurationMs('15m'), 15 * 60 * 1000);
    assert.equal(getTimeframeDurationMs('1h'), 3600 * 1000);
    assert.equal(getTimeframeDurationMs('4h'), 4 * 3600 * 1000);
    assert.equal(getTimeframeDurationMs('1D'), 24 * 3600 * 1000);
    assert.equal(getTimeframeDurationMs('1W'), 7 * 24 * 3600 * 1000);
    assert.equal(getTimeframeDurationMs('1M'), 30 * 24 * 3600 * 1000);
  });

  it('2. calculateHistoricalWindow: menghitung window mundur 500 bar dan maju 1000 bar dari targetEpoch', () => {
    const targetEpoch = 1754006400000; // Contoh tanggal lampau (misal Agustus 2025)
    const window1h = calculateHistoricalWindow(targetEpoch, '1h', 500, 1000);

    const oneHourMs = 3600 * 1000;
    assert.equal(window1h.from, targetEpoch - 500 * oneHourMs);
    assert.equal(window1h.to, targetEpoch + 1000 * oneHourMs);
    assert.equal(window1h.target, targetEpoch);
    assert.equal(window1h.backBars, 500);
    assert.equal(window1h.forwardBars, 1000);
  });

  it('3. calculateHistoricalWindow: memastikan window.to tidak melebihi waktu sekarang saat dekat dengan hari ini', () => {
    const now = Date.now();
    const targetEpoch = now - 10 * 60 * 1000; // 10 menit lalu
    const window1m = calculateHistoricalWindow(targetEpoch, '1m', 100, 1000);

    assert.ok(window1m.to <= now + 60000); // Tidak melebihi waktu saat ini
    assert.equal(window1m.from, targetEpoch - 100 * 60 * 1000);
  });

  it('4. isTargetInReplayBounds: mengevaluasi apakah tanggal target berada dalam bounds yang ter-load', () => {
    const bounds = { first: 1000000, last: 2000000 };
    assert.equal(isTargetInReplayBounds(1500000, bounds), true);
    assert.equal(isTargetInReplayBounds(500000, bounds), false); // Lebih lampau dari bounds.first
    assert.equal(isTargetInReplayBounds(2500000, bounds), false); // Lebih baru dari bounds.last
    assert.equal(isTargetInReplayBounds(1500000, null), false);
  });
});
