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
