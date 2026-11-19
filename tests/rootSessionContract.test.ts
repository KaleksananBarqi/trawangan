import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

describe('Root Shell & Chart.svelte Session Controller Contract (#218)', () => {
  const chartSveltePath = path.resolve(process.cwd(), 'src/lib/components/Chart.svelte');
  const pageSveltePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');

  test('1. Chart.svelte hanya mengekspor getSessionController dan narrow view handle (tanpa pass-through wrapper)', () => {
    const chartSrc = fs.readFileSync(chartSveltePath, 'utf8');
    const exportedFns = [...chartSrc.matchAll(/^\s*export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/gm)].map(
      (m) => m[1]
    );

    const allowedExports = new Set([
      'getSessionController',
      'getLastHoveredPrice',
      'getChartScreenshotCanvas',
      'openChartSettings',
      'focusTimestamp',
    ]);

    const redundantExports = exportedFns.filter((name) => !allowedExports.has(name));
    assert.deepEqual(
      redundantExports,
      [],
      `Chart.svelte masih memiliki export function pass-through yang harus dipangkas: ${redundantExports.join(', ')}`
    );

    for (const required of allowedExports) {
      assert.ok(
        exportedFns.includes(required),
        `Chart.svelte harus tetap mengekspor ${required}`
      );
    }
  });

  test('2. +page.svelte menggunakan ChartSessionController dan ChartViewHandle tanpa chartComponent: any', () => {
    const pageSrc = fs.readFileSync(pageSveltePath, 'utf8');

    assert.equal(
      /\bchartComponent\b/.test(pageSrc),
      false,
      '+page.svelte tidak boleh lagi mereferensikan chartComponent (untyped any)'
    );

    assert.ok(
      /ChartSessionController\s*\|\s*null/.test(pageSrc),
      '+page.svelte harus mendeklarasikan state bertipe ChartSessionController | null'
    );
    assert.ok(
      /ChartViewHandle\s*\|\s*null/.test(pageSrc),
      '+page.svelte harus mendeklarasikan state bertipe ChartViewHandle | null'
    );
    assert.ok(
      pageSrc.includes('bind:sessionController={sessionController}'),
      '+page.svelte harus mengikat bind:sessionController={sessionController} pada <Chart>'
    );
  });

  test('3. ChartSessionController menangani operasi command dispatcher & shell secara langsung', () => {
    let resetViewCalls = 0;
    let appliedPriceStyle = 'candles';
    let appliedInvert = false;

    const fakeRenderer = {
      getPriceScaleState: () => ({ invert: appliedInvert, autoScale: true }),
      applyConfig: (patch: { priceScale?: { invert?: boolean } }) => {
        if (patch?.priceScale?.invert !== undefined) {
          appliedInvert = !!patch.priceScale.invert;
        }
      },
      scene: {
        showPriceLine: true,
        showCountdown: false,
        panes: new Map(),
        orderedPanes: () => [],
      },
    };

    const fakeCell = {
      resetView: () => {
        resetViewCalls++;
      },
      setPriceStyle: (style: string) => {
        appliedPriceStyle = style;
      },
      chart: {
        renderer: fakeRenderer,
      },
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1x1',
      providerId: 'binance',
    });

    // Inject mock workspace minimal melalui attachCellListeners / internal seam publik
    (controller as unknown as { workspace: unknown }).workspace = {
      active: fakeCell,
      cells: [fakeCell],
    };

    controller.fitChart();
    assert.equal(resetViewCalls, 1, 'fitChart() harus memanggil resetView pada cell aktif');

    const nextStyle = controller.cyclePriceStyle();
    assert.notEqual(nextStyle, 'candles', 'cyclePriceStyle() harus beralih ke gaya lilin berikutnya');
    assert.equal(appliedPriceStyle, nextStyle);

    const prevScale = controller.getPriceScaleState();
    const ok = controller.applyPriceScaleState({ ...prevScale, invert: !prevScale?.invert });
    assert.equal(ok, true);
    assert.equal(appliedInvert, true);

    controller.destroy();
  });
});
