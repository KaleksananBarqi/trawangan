// Pengujian Unit Layanan Derivatives Telemetry Strip (#227)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DerivativesTelemetryService,
  isPerpetualInstrument,
  formatCompactUsd,
  formatFundingRatePct,
  formatFundingCountdown,
} from '../market/derivativesTelemetryService';
import type { UniversalFetchOptions, UniversalResponse } from '../httpClient';

function makeJsonResponse(data: unknown, ok = true, status = 200): UniversalResponse {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : `HTTP ${status}`,
    text: async () => JSON.stringify(data),
    json: async <T = any>() => data as T,
  };
}

describe('DerivativesTelemetryService (#227)', () => {
  test('isPerpetualInstrument mendeteksi kontrak .P dan menyaring Spot/Saham/Macro', () => {
    assert.equal(isPerpetualInstrument('BTCUSDT.P', 'binance'), true);
    assert.equal(isPerpetualInstrument('MMTUSDT.P', 'bitunix'), true);
    assert.equal(isPerpetualInstrument('HYPE', 'hyperliquid'), true);
    assert.equal(isPerpetualInstrument('BTC-PERP', 'hyperliquid'), true);

    // Spot, Saham Yahoo, Indodax, dan Macro harus false
    assert.equal(isPerpetualInstrument('BTCUSDT', 'binance'), false);
    assert.equal(isPerpetualInstrument('PURR/USDC', 'hyperliquid'), false);
    assert.equal(isPerpetualInstrument('BBCA.JK', 'yahoo'), false);
    assert.equal(isPerpetualInstrument('BTCIDR', 'indodax'), false);
    assert.equal(isPerpetualInstrument('TOTAL3', 'macro'), false);
    assert.equal(isPerpetualInstrument('BTCUSDT.P', 'yahoo'), false);
  });

  test('helper formatting angka ringkas USD, funding rate, dan countdown HH:MM:SS', () => {
    assert.equal(formatCompactUsd(1_110_000_000), '$1.11B');
    assert.equal(formatCompactUsd(639_210_000), '$639.21M');
    assert.equal(formatCompactUsd(45_200), '$45.20K');
    assert.equal(formatCompactUsd(null), '--');

    assert.equal(formatFundingRatePct(0.000025), '+0.0025%');
    assert.equal(formatFundingRatePct(-0.0001), '-0.0100%');
    assert.equal(formatFundingRatePct(null), '--');

    const now = 1_700_000_000_000;
    const target = now + (2 * 3600 + 5 * 60 + 9) * 1000;
    assert.equal(formatFundingCountdown(target, now), '02:05:09');
    assert.equal(formatFundingCountdown(now - 1000, now), '00:00:00');
    assert.equal(formatFundingCountdown(null, now), '--:--:--');
  });

  test('fetchSnapshot menormalisasi data Binance Futures (.P)', async () => {
    const mockFetch = async (url: string): Promise<UniversalResponse> => {
      if (url.includes('/fapi/v1/premiumIndex')) {
        return makeJsonResponse({
          symbol: 'BTCUSDT',
          markPrice: '90000.00',
          lastFundingRate: '0.00010000',
          nextFundingTime: 1_700_003_600_000,
        });
      }
      if (url.includes('/fapi/v1/openInterest')) {
        return makeJsonResponse({
          symbol: 'BTCUSDT',
          openInterest: '12345.00',
        });
      }
      if (url.includes('/fapi/v1/ticker/24hr')) {
        return makeJsonResponse({
          symbol: 'BTCUSDT',
          lastPrice: '90050.50',
          priceChangePercent: '2.45',
          quoteVolume: '639210000.00',
        });
      }
      return makeJsonResponse({}, false, 404);
    };

    const service = new DerivativesTelemetryService({
      fetchFn: mockFetch,
      nowFn: () => 1_700_000_000_000,
    });

    const snap = await service.fetchSnapshot('BTCUSDT.P', 'binance');

    assert.equal(snap.isPerpetual, true);
    assert.equal(snap.showOpenInterest, true);
    assert.equal(snap.showFunding, true);
    assert.equal(snap.price, 90050.5);
    assert.equal(snap.change24hPct, 2.45);
    assert.equal(snap.volume24hUsd, 639_210_000);
    assert.equal(snap.openInterestUsd, 12345 * 90000);
    assert.equal(snap.fundingRate, 0.0001);
    assert.equal(snap.countdownText, '01:00:00');
  });

  test('fetchSnapshot menormalisasi data Bitunix Futures (.P)', async () => {
    const mockFetch = async (url: string): Promise<UniversalResponse> => {
      if (url.includes('/futures/market/tickers')) {
        return makeJsonResponse({
          code: 0,
          data: [
            {
              symbol: 'MMTUSDT',
              lastPrice: '1.25',
              open: '1.00',
              quoteVol: '48500000',
              openInterest: '1200000',
            },
          ],
        });
      }
      if (url.includes('/futures/market/funding_rate')) {
        return makeJsonResponse({
          code: 0,
          data: {
            symbol: 'MMTUSDT',
            fundingRate: '0.000025',
            nextFundingTime: 1_700_000_359_000,
          },
        });
      }
      return makeJsonResponse({}, false, 404);
    };

    const service = new DerivativesTelemetryService({
      fetchFn: mockFetch,
      nowFn: () => 1_700_000_000_000,
    });

    const snap = await service.fetchSnapshot('MMTUSDT.P', 'bitunix');

    assert.equal(snap.isPerpetual, true);
    assert.equal(snap.showOpenInterest, true);
    assert.equal(snap.showFunding, true);
    assert.equal(snap.price, 1.25);
    assert.equal(snap.change24hPct, 25);
    assert.equal(snap.volume24hUsd, 48_500_000);
    assert.equal(snap.openInterestUsd, 1_200_000 * 1.25);
    assert.equal(snap.fundingRate, 0.000025);
    assert.equal(snap.countdownText, '00:05:59');
  });

  test('fetchSnapshot menormalisasi data Hyperliquid (POST metaAndAssetCtxs)', async () => {
    const mockFetch = async (url: string, opts?: UniversalFetchOptions): Promise<UniversalResponse> => {
      assert.equal(url, 'https://api.hyperliquid.xyz/info');
      assert.equal(opts?.method, 'POST');
      return makeJsonResponse([
        { universe: [{ name: 'BTC' }, { name: 'HYPE' }] },
        [
          {
            markPx: '90000',
            prevDayPx: '88000',
            dayNtlVlm: '100000000',
            openInterest: '1000',
            funding: '0.0000125',
          },
          {
            markPx: '25.0',
            prevDayPx: '20.0',
            dayNtlVlm: '52000000',
            openInterest: '2000000',
            funding: '-0.00005',
          },
        ],
      ]);
    };

    const now = new Date('2026-11-19T10:45:00.000Z').getTime();
    const service = new DerivativesTelemetryService({
      fetchFn: mockFetch,
      nowFn: () => now,
    });

    const snap = await service.fetchSnapshot('HYPEUSDT.P', 'hyperliquid');

    assert.equal(snap.isPerpetual, true);
    assert.equal(snap.showOpenInterest, true);
    assert.equal(snap.showFunding, true);
    assert.equal(snap.price, 25);
    assert.equal(snap.change24hPct, 25);
    assert.equal(snap.volume24hUsd, 52_000_000);
    assert.equal(snap.openInterestUsd, 50_000_000);
    assert.equal(snap.fundingRate, -0.00005);
    assert.equal(snap.countdownText, '00:15:00');
  });

  test('fetchSnapshot menyembunyikan Open Interest & Funding untuk instrumen Spot/Saham/Macro', async () => {
    let calledUrls: string[] = [];
    const mockFetch = async (url: string): Promise<UniversalResponse> => {
      calledUrls.push(url);
      if (url.includes('/api/v3/ticker/24hr')) {
        return makeJsonResponse({
          symbol: 'BTCUSDT',
          lastPrice: '89900',
          priceChangePercent: '1.20',
          quoteVolume: '320000000',
        });
      }
      return makeJsonResponse({}, false, 404);
    };

    const service = new DerivativesTelemetryService({ fetchFn: mockFetch });

    const spotSnap = await service.fetchSnapshot('BTCUSDT', 'binance');
    assert.equal(spotSnap.isPerpetual, false);
    assert.equal(spotSnap.showOpenInterest, false);
    assert.equal(spotSnap.showFunding, false);
    assert.equal(spotSnap.openInterestUsd, null);
    assert.equal(spotSnap.fundingRate, null);
    assert.equal(spotSnap.volume24hUsd, 320_000_000);

    calledUrls = [];
    const stockSnap = await service.fetchSnapshot('BBCA.JK', 'yahoo');
    assert.equal(stockSnap.isPerpetual, false);
    assert.equal(stockSnap.showOpenInterest, false);
    assert.equal(stockSnap.showFunding, false);
    assert.equal(calledUrls.length, 0);
  });
});
