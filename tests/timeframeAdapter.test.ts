import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toVelaTimeframe,
  fromVelaTimeframe,
  toExchangeInterval,
  isMonthlyTimeframe,
} from '../src/lib/utils/timeframeAdapter';

describe('Timeframe Adapter & TradingView Standardization', () => {
  it('1. toVelaTimeframe: mengonversi 1M TradingView ke format M Vela tanpa tertukar ke 1m', () => {
    assert.equal(toVelaTimeframe('1M'), 'M');
    assert.equal(toVelaTimeframe('1m'), '1m');
    assert.equal(toVelaTimeframe('5m'), '5m');
    assert.equal(toVelaTimeframe('15m'), '15m');
    assert.equal(toVelaTimeframe('1h'), '1h');
    assert.equal(toVelaTimeframe('4h'), '4h');
    assert.equal(toVelaTimeframe('1D'), 'D');
    assert.equal(toVelaTimeframe('D'), 'D');
    assert.equal(toVelaTimeframe('1W'), 'W');
    assert.equal(toVelaTimeframe('W'), 'W');
  });

  it('2. fromVelaTimeframe: mengonversi format internal Vela (M, D, W, 1) kembali ke standar TradingView (1M, 1D, 1W, 1m)', () => {
    assert.equal(fromVelaTimeframe('M'), '1M');
    assert.equal(fromVelaTimeframe('1mo'), '1M');
    assert.equal(fromVelaTimeframe('D'), '1D');
    assert.equal(fromVelaTimeframe('W'), '1W');
    assert.equal(fromVelaTimeframe('1'), '1m');
    assert.equal(fromVelaTimeframe('60'), '1h');
    assert.equal(fromVelaTimeframe('240'), '4h');
    assert.equal(fromVelaTimeframe('15m'), '15m');
    assert.equal(fromVelaTimeframe('1M'), '1M');
  });

  it('3. toExchangeInterval: memetakan interval klines REST API untuk bursa Binance dan Bitunix', () => {
    assert.equal(toExchangeInterval('1M', 'binance'), '1M');
    assert.equal(toExchangeInterval('1M', 'bitunix'), '1M');
    assert.equal(toExchangeInterval('1m', 'binance'), '1m');
    assert.equal(toExchangeInterval('1D', 'binance'), '1d');
    assert.equal(toExchangeInterval('1W', 'binance'), '1w');
  });

  it('4. isMonthlyTimeframe: mendeteksi timeframe bulanan secara akurat', () => {
    assert.equal(isMonthlyTimeframe('1M'), true);
    assert.equal(isMonthlyTimeframe('M'), true);
    assert.equal(isMonthlyTimeframe('1mo'), true);
    assert.equal(isMonthlyTimeframe('1m'), false);
    assert.equal(isMonthlyTimeframe('15m'), false);
  });
});
