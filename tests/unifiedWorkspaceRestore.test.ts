import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { sanitizeRendererConfigForApply } from '../src/lib/services/persistence/rendererConfigSanitizer';
import {
  restoreCellThroughPipeline,
  restoreWorkspaceChartAndPlans,
  type WorkspaceChartPort,
} from '../src/lib/services/workspaceLifecycle';
import { createMockChartContainer } from './helpers/mockChartContainer';
import type { SavedWorkspace } from '../src/lib/types/market';

describe('Ticket #213: Unified 5-Step Cell & Workspace Restoration Pipeline', () => {
  describe('1. Sanitasi properti rendererConfig yang malformed / out-of-range', () => {
    test('membuang properti out-of-range dan malformed sambil mempertahankan properti valid', () => {
      const dirtyConfig: Record<string, any> = {
        layout: { background: '#111111' },
        margins: { top: -0.2, bottom: 1.4 },
        priceScale: {
          mode: 'log',
          autoScale: 'yes', // malformed: bukan boolean
          scaleMargins: { top: 0.6, bottom: 0.5 }, // out-of-range: top + bottom >= 1
        },
        crosshair: {
          width: Number.NaN, // malformed: NaN
          opacity: 2.5, // out-of-range: > 1
          style: 'dashed', // valid
        },
        candles: {
          upColor: 12345, // malformed: bukan string
          downColor: '', // malformed: string kosong
          bodyVisible: 'true', // malformed: bukan boolean
          wickVisible: false, // valid
        },
        bars: {
          upColor: '   ', // malformed: whitespace
        },
        series: {
          style: 99, // malformed: bukan string
        },
      };

      const sanitized = sanitizeRendererConfigForApply(dirtyConfig);
      assert.ok(sanitized, 'Konfigurasi dengan sebagian properti valid tidak boleh menjadi undefined');
      assert.equal(sanitized.layout, undefined, 'Kunci global layout wajib dibuang');
      assert.equal(sanitized.margins, undefined, 'margins out-of-range wajib dibuang');
      assert.deepEqual(sanitized.priceScale, { mode: 'log' }, 'Hanya priceScale.mode valid yang bertahan');
      assert.deepEqual(sanitized.crosshair, { style: 'dashed' }, 'Hanya crosshair.style valid yang bertahan');
      assert.deepEqual(sanitized.candles, { wickVisible: false }, 'Hanya candles.wickVisible valid yang bertahan');
      assert.equal(sanitized.bars, undefined, 'bars kosong setelah sanitasi wajib dibuang');
      assert.equal(sanitized.series, undefined, 'series kosong setelah sanitasi wajib dibuang');
    });
  });

  describe('2. Single-chart & legacy v1 restore melalui unified 5-step pipeline', () => {
    test('restoreWorkspaceChartAndPlans menyaring rendererConfig sebelum session port dan menjalankan 5-step order (paneLayout setelah semua studi mount)', async () => {
      const events: string[] = [];
      let receivedRendererConfig: any = null;

      const mockChart: WorkspaceChartPort = {
        captureWorkspaceSnapshot: () => ({ indicators: [] }),
        applyWorkspaceSnapshot: async (snapshot, opts) => {
          const primaryCell = snapshot.cells?.[0] ?? {
            symbol: snapshot.symbol || 'ETHUSDT',
            timeframe: snapshot.timeframe || '1h',
            providerId: snapshot.providerId || 'binance',
            rendererConfig: snapshot.rendererConfig,
            priceStyle: snapshot.priceStyle,
            priceScaleCountdown: snapshot.priceScaleCountdown,
            paneLayout: snapshot.paneLayout,
            nativeIndicators: snapshot.nativeIndicators,
            priceScaleState: snapshot.priceScaleState,
            barSpacing: snapshot.barSpacing,
            visibleRange: snapshot.visibleRange ?? undefined,
          };
          await restoreCellThroughPipeline(
            primaryCell,
            {
              applyRendererConfig: (cfg) => {
                receivedRendererConfig = cfg;
                events.push('step2:rendererConfig');
              },
              setPriceStyle: (style) => events.push(`step2:priceStyle:${style}`),
              setPriceScaleCountdown: (enabled) => events.push(`step2:countdown:${enabled}`),
              addPineIndicator: async (ind) => {
                await new Promise((r) => setTimeout(r, 5));
                events.push(`pine:${ind.title}`);
              },
              applyNativeIndicators: async (entries) => {
                await new Promise((r) => setTimeout(r, 5));
                events.push(`step3:native:${entries.length}`);
              },
              onSyncIndicators: opts?.onSyncIndicators,
              applyPaneLayout: async (entries) => {
                events.push(`step4:paneLayout:${entries.map((e) => e.signature).join(',')}`);
                return true;
              },
              applyPaneWeights: () => {
                events.push('step4:paneWeights');
              },
              applyPriceScaleState: () => {
                events.push('step5:priceScale');
              },
              setBarSpacing: () => {
                events.push('step5:barSpacing');
              },
              applyVisibleRange: () => {
                events.push('step5:visibleRange');
                return true;
              },
            },
            {
              indicators: snapshot.indicators,
              fallbackPaneWeights: snapshot.paneWeights,
            }
          );
        },
      };

      // Legacy v1 workspace: tanpa schemaVersion, tanpa cells[], memakai paneWeights & root rendererConfig
      const legacyV1Workspace = {
        id: 'ws-v1-legacy',
        name: 'Legacy V1',
        symbol: 'ETHUSDT',
        timeframe: '1h',
        layout: '1',
        providerId: 'binance',
        rendererConfig: {
          layout: { background: '#000000' },
          margins: { top: -1, bottom: 2 },
          crosshair: { width: NaN, style: 'solid' },
        },
        priceStyle: 'hollow_candles',
        priceScaleCountdown: true,
        indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
        nativeIndicators: [{ type: 'volume', ownPane: true, heightPct: 22 }],
        paneWeights: [3, 1],
        priceScaleState: { mode: 'normal' },
        barSpacing: 10,
        visibleRange: { from: 1000, to: 2000, atLiveEdge: false },
        timestamp: Date.now(),
      } as unknown as SavedWorkspace;

      await restoreWorkspaceChartAndPlans({
        workspace: legacyV1Workspace,
        chart: mockChart,
        onSyncIndicators: () => events.push('step3:syncIndicators'),
        restoreCellDrawings: false,
      });

      // 1. rendererConfig wajib sudah disanitasi sebelum menyentuh session port
      assert.deepEqual(
        receivedRendererConfig,
        { crosshair: { style: 'solid' } },
        'Out-of-range/malformed/global rendererConfig wajib disanitasi sebelum mencapai session port'
      );

      // 2. Pane Signature layout (hasil migrasi v1 -> v2) wajib diterapkan SETELAH semua studi Pine & Native selesai mount
      const pineIdx = events.indexOf('pine:RSI');
      const nativeIdx = events.indexOf('step3:native:1');
      const paneIdx = events.findIndex((e) => e.startsWith('step4:paneLayout:'));
      const vrIdx = events.indexOf('step5:visibleRange');

      assert.ok(pineIdx >= 0, 'Pine indicator harus dimuat');
      assert.ok(nativeIdx > pineIdx, 'Native indicator dimuat setelah Pine');
      assert.ok(paneIdx > nativeIdx, 'Pane Signature layout wajib diterapkan setelah semua studi selesai mount');
      assert.ok(vrIdx > paneIdx, 'Viewport visibleRange wajib diterapkan setelah Pane Signature layout');
      assert.ok(
        events[paneIdx].includes('price,RSI'),
        `Legacy v1 paneWeights harus bermigrasi ke Pane Signature (actual: ${events[paneIdx]})`
      );
    });
  });

  describe('3. Multi-chart Cell Snapshot restore melalui unified 5-step pipeline', () => {
    test('ChartSessionController.loadWorkspaceState memulihkan multi-cell dengan sanitasi rendererConfig dan paneLayout setelah studi selesai mount', async () => {
      const cellEvents: Record<string, string[]> = { c1: [], c2: [] };
      const finalConfigs: Record<string, any> = {};

      function createCellMock(id: string, sym: string) {
        let currentConfig: Record<string, any> = {
          priceScale: { autoScale: true },
        };
        finalConfigs[id] = currentConfig;
        const makeScenePane = (paneId: string) => {
          let _weight = 1;
          return {
            id: paneId,
            collapsed: false,
            get heightWeight() {
              return _weight;
            },
            set heightWeight(w: number) {
              _weight = w;
              cellEvents[id].push(`step4:paneWeight:${paneId}:${w}`);
            },
          };
        };
        const panesList = [{ id: 'price', kind: 'price', indicators: [] }];
        const scenePanes = new Map<string, any>([['price', makeScenePane('price')]]);
        const cell: any = {
          id,
          symbol: sym,
          timeframe: '15m',
          setSymbol: (s: string) => {
            cell.symbol = s;
            cellEvents[id].push(`step1:symbol:${s}`);
          },
          setTimeframe: (tf: string) => {
            cell.timeframe = tf;
            cellEvents[id].push(`step1:tf:${tf}`);
          },
          chart: {
            indicators: () => [],
            panes: { list: () => panesList },
            addIndicator: async (arg: any, opts?: any) => {
              const title = (typeof arg === 'object' ? arg?.title : opts?.title) || (id === 'c1' ? 'MACD' : 'RSI');
              const studyPaneId = `study_${title}`;
              panesList.push({ id: studyPaneId, kind: 'study', indicators: [{ title }] } as any);
              scenePanes.set(studyPaneId, makeScenePane(studyPaneId));
              cellEvents[id].push(`step3:pine:${title}`);
            },
            setPriceStyle: (style: string) => cellEvents[id].push(`step2:priceStyle:${style}`),
            setPriceScaleCountdown: (enabled: boolean) => cellEvents[id].push(`step2:countdown:${enabled}`),
            setBarSpacing: (bs: number) => cellEvents[id].push(`step5:barSpacing:${bs}`),
            renderer: {
              renderer: {
                coords: {
                  getViewport: () => ({ barSpacing: 8 }),
                  setViewport: (vp: any) => cellEvents[id].push(`step5:barSpacing:${vp.barSpacing}`),
                },
                getConfig: () => currentConfig,
                applyConfig: (cfg: Record<string, any>) => {
                  const merged: Record<string, any> = { ...currentConfig };
                  for (const [k, v] of Object.entries(cfg)) {
                    if (v && typeof v === 'object' && !Array.isArray(v) && merged[k] && typeof merged[k] === 'object') {
                      merged[k] = { ...merged[k], ...v };
                    } else {
                      merged[k] = v;
                    }
                  }
                  currentConfig = merged;
                  finalConfigs[id] = currentConfig;
                  cellEvents[id].push('step2:rendererConfig');
                },
                scene: {
                  panes: scenePanes,
                  orderedPanes: () => Array.from(scenePanes.values()),
                  setPaneHeightWeight: (paneId: string, weight: number) => {
                    cellEvents[id].push(`step4:paneWeight:${paneId}:${weight}`);
                  },
                },
              },
            },
          },
          on: () => () => {},
        };
        return cell;
      }

      const c1 = createCellMock('c1', 'binance:BTCUSDT');
      const c2 = createCellMock('c2', 'binance:ETHUSDT');
      const fakeWorkspace: any = {
        active: c1,
        cells: () => [c1, c2],
        layout: '2v',
        setLayout: () => {},
        setActiveCell: () => {},
        applyState: () => {},
        on: () => () => {},
      };

      const controller = new ChartSessionController({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        workspaceFactory: () => fakeWorkspace,
      });
      controller.attach(createMockChartContainer(1200, 720));

      const multiCellWs: SavedWorkspace = {
        id: 'ws-multi-213',
        name: 'Multi 213',
        schemaVersion: 2,
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '2v',
        providerId: 'binance',
        indicators: [],
        syncConfig: {
          crosshair: true,
          viewport: false,
          symbol: false,
          timeframe: false,
          indicators: false,
          style: false,
          drawings: false,
        },
        cells: [
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            providerId: 'binance',
            priceStyle: 'candles',
            priceScaleCountdown: true,
            rendererConfig: {
              margins: { top: -0.5, bottom: 0.9 },
              candles: { wickVisible: false, upColor: 123 },
            },
            indicators: [{ title: 'MACD', source: 'plot(macd)', visible: true }],
            paneLayout: [
              { signature: 'price', weight: 3 },
              { signature: 'MACD', weight: 1 },
            ],
            barSpacing: 14,
          },
          {
            symbol: 'SOLUSDT',
            timeframe: '1h',
            providerId: 'binance',
            priceStyle: 'bars',
            priceScaleCountdown: false,
            rendererConfig: {
              crosshair: { width: Number.POSITIVE_INFINITY, style: 'dotted' },
            },
            indicators: [{ title: 'RSI', source: 'plot(rsi)', visible: true }],
            paneLayout: [
              { signature: 'price', weight: 2 },
              { signature: 'RSI', weight: 1 },
            ],
            barSpacing: 9,
          },
        ],
        timestamp: Date.now(),
      };

      await controller.loadWorkspaceState(multiCellWs);

      // Verifikasi sanitasi rendererConfig pada kedua sel (out-of-range/malformed dibuang)
      assert.deepEqual(finalConfigs.c1?.margins, { bottom: 0.9 }, 'c1 margins.top out-of-range wajib dibuang, bottom valid bertahan');
      assert.equal(finalConfigs.c1?.candles?.upColor, undefined, 'c1 candles.upColor malformed wajib dibuang');
      assert.equal(finalConfigs.c1?.candles?.wickVisible, false, 'c1 candles.wickVisible valid bertahan');
      assert.equal(finalConfigs.c2?.crosshair?.width, undefined, 'c2 crosshair.width Infinity wajib dibuang');
      assert.equal(finalConfigs.c2?.crosshair?.style, 'dotted', 'c2 crosshair.style valid bertahan');

      // Verifikasi urutan 5-step pada c2: studi mount sebelum paneLayout, dan barSpacing setelahnya
      const c2PineIdx = cellEvents.c2.indexOf('step3:pine:RSI');
      const c2PaneIdx = cellEvents.c2.findIndex((e) => e.startsWith('step4:paneWeight:'));
      const c2BarIdx = cellEvents.c2.indexOf('step5:barSpacing:9');
      assert.ok(c2PineIdx >= 0, 'c2 harus memuat indikator RSI');
      assert.ok(c2PaneIdx > c2PineIdx, 'c2 Pane Signature height weight wajib diterapkan setelah RSI selesai mount');
      assert.ok(c2BarIdx > c2PaneIdx, 'c2 barSpacing wajib diterapkan setelah Pane Signature layout');

      controller.destroy();
    });
  });
});
