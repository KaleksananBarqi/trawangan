import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { THEME_PRESETS } from '../src/lib/constants/themes';

// Mock container dan workspace untuk mengamati pemanggilan applyConfig pada cell renderer
function createMockWorkspaceWithRendererWatcher() {
  const appliedConfigs: any[] = [];
  let appliedWorkspaceTheme: any = null;

  const mockCell = {
    id: 'cell_main',
    symbol: 'binance:BTCUSDT',
    timeframe: '15',
    chart: {
      renderer: {
        renderer: {
          applyConfig(patch: any) {
            appliedConfigs.push(patch);
          },
          getConfig() {
            return {
              candles: {
                upColor: '#F7F7F7',
                downColor: '#FF69B4',
              }
            };
          }
        }
      }
    }
  };

  const ws = {
    cells: () => [mockCell],
    cell: (id: string) => (id === 'cell_main' ? mockCell : null),
    active: mockCell,
    setTheme(themeObj: any) {
      appliedWorkspaceTheme = themeObj;
    },
    on: () => {},
    off: () => {},
    destroy: () => {},
    setLayout: () => {},
  };

  return { ws, mockCell, appliedConfigs, getAppliedWorkspaceTheme: () => appliedWorkspaceTheme };
}

test('Tiket 1: setTheme harus memanggil applyConfig dengan konfigurasi lengkap candles dan bars pada sel WebGL2', () => {
  const { ws, appliedConfigs, getAppliedWorkspaceTheme } = createMockWorkspaceWithRendererWatcher();
  const mockContainer: any = {
    nodeType: 1,
    clientWidth: 1000,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const controller = new ChartSessionController({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    workspaceFactory: () => ws,
  });

  controller.attach(mockContainer);

  // 1. Terapkan tema Signature
  controller.setTheme('signature');

  // Pastikan workspace.setTheme terpanggil untuk background dsb.
  const wsTheme = getAppliedWorkspaceTheme();
  assert.ok(wsTheme, 'workspace.setTheme harus dipanggil');
  assert.equal(wsTheme.background, '#0F0F0F');

  // Pastikan applyConfig terpanggil dengan blok candles dan bars
  const signatureConfig = appliedConfigs.find((c) => c.candles !== undefined);
  assert.ok(signatureConfig, 'applyConfig harus dipanggil dengan properti candles');
  assert.equal(signatureConfig.candles.upColor, THEME_PRESETS.signature.chart.upColor);
  assert.equal(signatureConfig.candles.downColor, THEME_PRESETS.signature.chart.downColor);
  assert.equal(signatureConfig.candles.borderUpColor, THEME_PRESETS.signature.chart.borderUpColor);
  assert.equal(signatureConfig.candles.borderDownColor, THEME_PRESETS.signature.chart.borderDownColor);
  assert.equal(signatureConfig.candles.wickUpColor, THEME_PRESETS.signature.chart.wickUpColor);
  assert.equal(signatureConfig.candles.wickDownColor, THEME_PRESETS.signature.chart.wickDownColor);
  assert.equal(signatureConfig.bars.upColor, THEME_PRESETS.signature.chart.upColor);
  assert.equal(signatureConfig.bars.downColor, THEME_PRESETS.signature.chart.downColor);

  // 2. Beralih ke tema Binance Classic
  appliedConfigs.length = 0;
  controller.setTheme('binance');

  const binanceConfig = appliedConfigs.find((c) => c.candles !== undefined);
  assert.ok(binanceConfig, 'applyConfig harus dipanggil saat beralih ke tema binance');
  assert.equal(binanceConfig.candles.upColor, THEME_PRESETS.binance.chart.upColor);
  assert.equal(binanceConfig.candles.downColor, THEME_PRESETS.binance.chart.downColor);
  assert.equal(binanceConfig.candles.borderUpColor, THEME_PRESETS.binance.chart.borderUpColor);
  assert.equal(binanceConfig.candles.borderDownColor, THEME_PRESETS.binance.chart.borderDownColor);
  assert.equal(binanceConfig.bars.upColor, THEME_PRESETS.binance.chart.upColor);
  assert.equal(binanceConfig.bars.downColor, THEME_PRESETS.binance.chart.downColor);

  controller.destroy();
});

test('Tiket 2: setTheme dengan customCandleColors harus meng-override warna candle dan menurunkan border 15%', () => {
  const { ws, appliedConfigs } = createMockWorkspaceWithRendererWatcher();
  const mockContainer: any = {
    nodeType: 1,
    clientWidth: 1000,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const controller = new ChartSessionController({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    workspaceFactory: () => ws,
  });

  controller.attach(mockContainer);

  // 1. Terapkan custom color pada tema signature
  appliedConfigs.length = 0;
  controller.setTheme('signature', 12, {
    bullColor: '#00F090',
    bearColor: '#FF3B69',
  });

  const customConfig = appliedConfigs.find((c) => c.candles !== undefined);
  assert.ok(customConfig, 'applyConfig harus dipanggil saat custom color diterapkan');
  assert.equal(customConfig.candles.upColor, '#00F090');
  assert.equal(customConfig.candles.downColor, '#FF3B69');
  assert.equal(customConfig.candles.wickUpColor, '#00F090');
  assert.equal(customConfig.candles.wickDownColor, '#FF3B69');
  // Border dihitung 15% lebih gelap secara otomatis
  assert.equal(customConfig.candles.borderUpColor, '#00CC7A'); // 240 * 0.85 = 204 -> CC
  assert.equal(customConfig.candles.borderDownColor, '#D93259'); // 255*0.85=217(D9), 59*0.85=50(32), 105*0.85=89(59)

  // 2. Bersihkan custom color (Reset ke tema)
  appliedConfigs.length = 0;
  controller.setTheme('signature', 12, {});

  const resetConfig = appliedConfigs.find((c) => c.candles !== undefined);
  assert.ok(resetConfig, 'applyConfig harus dipanggil saat reset custom colors');
  assert.equal(resetConfig.candles.upColor, THEME_PRESETS.signature.chart.upColor);
  assert.equal(resetConfig.candles.downColor, THEME_PRESETS.signature.chart.downColor);
  assert.equal(resetConfig.candles.borderUpColor, THEME_PRESETS.signature.chart.borderUpColor);
  assert.equal(resetConfig.candles.borderDownColor, THEME_PRESETS.signature.chart.borderDownColor);

  controller.destroy();
});

test('Tiket 3: resetSettingsToFactory harus memulihkan lilin ke Theme Preset aktif', async () => {
  const { ws, appliedConfigs } = createMockWorkspaceWithRendererWatcher();
  const mockContainer: any = {
    nodeType: 1,
    clientWidth: 1000,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const controller = new ChartSessionController({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    themePreset: 'binance',
    workspaceFactory: () => ws,
  });

  controller.attach(mockContainer);
  controller.setTheme('binance');

  // Bersihkan log konfigurasi sebelumnya
  appliedConfigs.length = 0;

  // Lakukan resetSettingsToFactory
  await controller.resetSettingsToFactory();

  // Pastikan applyConfig dipanggil ulang dengan tema binance aktif
  const lastConfig = appliedConfigs[appliedConfigs.length - 1];
  assert.ok(lastConfig, 'applyConfig harus dipanggil setelah factory reset');
  assert.equal(lastConfig.candles.upColor, THEME_PRESETS.binance.chart.upColor);
  assert.equal(lastConfig.candles.downColor, THEME_PRESETS.binance.chart.downColor);

  controller.destroy();
});


