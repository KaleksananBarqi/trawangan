import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppSettings, DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import { ChartTabsService } from '../src/lib/services/chartTabsService';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { attachMainPaneOpacityAdapter } from '../src/lib/services/mainPaneOpacityAdapter';
import { resolveAlertLineTone } from '../src/lib/services/alertLineStyleHelper';

describe('AppSettings defaults & clamping (hollowCandles, mainPaneObjectsOpacity, showAlertLines)', () => {
  it('menyediakan nilai default yang aman dan menormalkan mainPaneObjectsOpacity', () => {
    const def = resolveAppSettings();
    assert.equal(def.hollowCandles, false);
    assert.equal(def.mainPaneObjectsOpacity, 1);
    assert.equal(def.showAlertLines, true);
    assert.equal(DEFAULT_APP_SETTINGS.showAlertLines, true);

    const low = resolveAppSettings({
      mainPaneObjectsOpacity: -2,
      hollowCandles: true,
      showAlertLines: false,
    });
    assert.equal(low.mainPaneObjectsOpacity, 0.1);
    assert.equal(low.hollowCandles, true);
    assert.equal(low.showAlertLines, false);

    const high = resolveAppSettings({ mainPaneObjectsOpacity: 5 });
    assert.equal(high.mainPaneObjectsOpacity, 1);

    const invalid = resolveAppSettings({ mainPaneObjectsOpacity: Number.NaN });
    assert.equal(invalid.mainPaneObjectsOpacity, 1);
  });
});

describe('ChartTabsService navigation helpers', () => {
  const memoryPersistence = {
    bootstrap: async () => {},
    getUiPreferenceSync: () => null,
    setUiPreference: async () => {},
  };

  it('mendukung cycleTab maju/mundur secara siklik dan focusTabByIndex (Alt+9 ke tab terakhir)', () => {
    const svc = new ChartTabsService(memoryPersistence as any);
    const t1 = svc.getActiveTab();
    const t2 = svc.addNewTab({ symbol: 'ETHUSDT', providerId: 'binance', timeframe: '1h' });
    const t3 = svc.addNewTab({ symbol: 'SOLUSDT', providerId: 'binance', timeframe: '4h' });

    assert.equal(svc.getActiveTab().id, t3.id);

    // Cycle maju dari terakhir -> kembali ke tab pertama
    svc.cycleTab(1);
    assert.equal(svc.getActiveTab().id, t1.id);

    // Cycle mundur dari pertama -> lompat ke tab terakhir
    svc.cycleTab(-1);
    assert.equal(svc.getActiveTab().id, t3.id);

    // Jump 1-based
    svc.focusTabByIndex(2);
    assert.equal(svc.getActiveTab().id, t2.id);

    // Alt+9 selalu ke tab terakhir
    svc.focusTabByIndex(9);
    assert.equal(svc.getActiveTab().id, t3.id);

    // Indeks di luar jangkauan mengembalikan null
    assert.equal(svc.focusTabByIndex(5), null);
  });
});

describe('CommandDispatcher navigation & tab shortcuts', () => {
  function makeKeyEvent(init: Omit<Partial<KeyboardEvent>, 'target'> & { target?: any }): KeyboardEvent {
    return {
      key: '',
      code: '',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: () => {},
      stopPropagation: () => {},
      ...init,
    } as unknown as KeyboardEvent;
  }

  it('mendaftarkan dan mengeksekusi shortcut navigasi, tab, timeframe, dan toggle alert lines', () => {
    const dispatcher = createDefaultCommandDispatcher();
    const calls: string[] = [];

    const ids = [
      'new-chart-tab',
      'close-chart-tab',
      'next-chart-tab',
      'prev-chart-tab',
      'jump-chart-tab-1',
      'jump-chart-tab-9',
      'toggle-alerts-dock',
      'toggle-datawindow-dock',
      'toggle-events-dock',
      'toggle-right-dock-hider',
      'toggle-alert-lines',
      'prev-favorite-timeframe',
      'next-favorite-timeframe',
      'scroll-to-realtime',
      'prev-chart-cell',
      'next-chart-cell',
      'draw-hline',
      'create-alert-cursor',
    ];
    for (const id of ids) {
      dispatcher.bindHandler(id, () => {
        calls.push(id);
      });
    }

    assert.equal(dispatcher.dispatch(makeKeyEvent({ ctrlKey: true, key: 't', code: 'KeyT' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ ctrlKey: true, key: 'w', code: 'KeyW' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ ctrlKey: true, key: 'Tab', code: 'Tab' })), true);
    assert.equal(
      dispatcher.dispatch(makeKeyEvent({ ctrlKey: true, shiftKey: true, key: 'Tab', code: 'Tab' })),
      true
    );
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: '1', code: 'Digit1' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: '9', code: 'Digit9' })), true);
    assert.equal(
      dispatcher.dispatch(makeKeyEvent({ altKey: true, shiftKey: true, key: 'A', code: 'KeyA' })),
      true
    );
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: 'd', code: 'KeyD' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: 'c', code: 'KeyC' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: '\\', code: 'Backslash' })), true);
    assert.equal(
      dispatcher.dispatch(makeKeyEvent({ altKey: true, shiftKey: true, key: 'H', code: 'KeyH' })),
      true
    );
    assert.equal(dispatcher.dispatch(makeKeyEvent({ key: '[', code: 'BracketLeft' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ key: ']', code: 'BracketRight' })), true);
    assert.equal(
      dispatcher.dispatch(
        makeKeyEvent({ altKey: true, shiftKey: true, key: 'ArrowRight', code: 'ArrowRight' })
      ),
      true
    );
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: '[', code: 'BracketLeft' })), true);
    assert.equal(dispatcher.dispatch(makeKeyEvent({ altKey: true, key: ']', code: 'BracketRight' })), true);

    assert.deepEqual(calls, [
      'new-chart-tab',
      'close-chart-tab',
      'next-chart-tab',
      'prev-chart-tab',
      'jump-chart-tab-1',
      'jump-chart-tab-9',
      'toggle-alerts-dock',
      'toggle-datawindow-dock',
      'toggle-events-dock',
      'toggle-right-dock-hider',
      'toggle-alert-lines',
      'prev-favorite-timeframe',
      'next-favorite-timeframe',
      'scroll-to-realtime',
      'prev-chart-cell',
      'next-chart-cell',
    ]);
  });

  it('menahan shortcut [ dan ] saat fokus berada di dalam elemen input', () => {
    const dispatcher = createDefaultCommandDispatcher();
    let count = 0;
    dispatcher.bindHandler('prev-favorite-timeframe', () => {
      count += 1;
    });
    dispatcher.bindHandler('next-favorite-timeframe', () => {
      count += 1;
    });

    assert.equal(
      dispatcher.dispatch(makeKeyEvent({ key: '[', code: 'BracketLeft', target: { tagName: 'INPUT' } })),
      false
    );
    assert.equal(
      dispatcher.dispatch(makeKeyEvent({ key: ']', code: 'BracketRight', target: { tagName: 'TEXTAREA' } })),
      false
    );
    assert.equal(count, 0);
  });
});

describe('Hollow Candles configuration & priceElementColor guard', () => {
  it('membuat body bullish transparan sambil menjaga bars & chrome priceElementColor tetap solid', () => {
    const applyConfigCalls: any[] = [];
    const chrome = {
      priceElementColor(_scene: any, _coords: any, theme: any) {
        return theme.upColor;
      },
    };
    const fakeCell = {
      id: 'c1',
      chart: {
        applyConfig(cfg: any) {
          applyConfigCalls.push(cfg);
        },
        renderer: {
          chrome,
          scheduler: { invalidate: () => {} },
          applyConfig(cfg: any) {
            applyConfigCalls.push(cfg);
          },
        },
      },
    };
    const fakeWorkspace = {
      active: fakeCell,
      getCells: () => [fakeCell],
      setTheme: () => {},
    };

    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      hollowCandles: false,
      workspaceFactory: () => fakeWorkspace,
    });
    (controller as any).workspace = fakeWorkspace;
    controller.attachCellListeners(fakeCell);

    controller.applyReactiveProps({ hollowCandles: true, customBullColor: '#00ff88' });
    const lastCandleCall = [...applyConfigCalls].reverse().find((c) => c?.candles);
    assert.equal(lastCandleCall?.candles?.upColor, 'rgba(0, 0, 0, 0)');
    assert.equal(lastCandleCall?.candles?.borderVisible, true);
    assert.equal(lastCandleCall?.candles?.wickUpColor, '#00ff88');
    assert.equal(lastCandleCall?.bars?.upColor, '#00ff88');

    const recordedChromeColor = chrome.priceElementColor({}, {}, { upColor: 'rgba(0, 0, 0, 0)' });
    assert.equal(recordedChromeColor, '#00ff88');

    // Mematikan hollowCandles mengembalikan upColor solid dan me-reset borderVisible secara eksplisit
    controller.applyReactiveProps({ hollowCandles: false });
    const restoredCall = [...applyConfigCalls].reverse().find((c) => c?.candles);
    assert.equal(restoredCall?.candles?.upColor, '#00ff88');
    assert.equal(restoredCall?.candles?.borderVisible, true);
  });
});

describe('MainPaneOpacityAdapter isolation', () => {
  it('hanya meredupkan objek non-candle pada pane price dan menjaga candle serta sub-pane tetap 100%', () => {
    const recordedAlphas: Record<string, number> = {};
    const batch = { alpha: 1 };
    const ctx = { globalAlpha: 1 };

    const renderer = {
      backend: {
        emitCandles(b: any) {
          recordedAlphas.candles = b.alpha;
        },
        emitSeries(b: any, _spec: any, pane: any) {
          recordedAlphas[`series_${pane.id}`] = b.alpha;
        },
        emitFill(b: any, _m: any, _f: any, pane: any) {
          recordedAlphas[`fill_${pane.id}`] = b.alpha;
        },
      },
      indicatorSlices: {
        paintEntry(c: any, entry: any) {
          recordedAlphas[`slice_${entry.pane.id}`] = c.globalAlpha;
        },
      },
      userDrawings: {
        painter: {
          paintOne(c: any, d: any) {
            recordedAlphas[`drawing_${d.paneId ?? 'price'}`] = c.globalAlpha;
          },
        },
      },
      volumeRenderer: {
        ctx,
        render(args: any) {
          recordedAlphas[`volume_${args.fillPane ? 'own' : 'price'}`] = this.ctx.globalAlpha;
        },
      },
      vpvrRenderer: {
        ctx,
        render(_args?: any) {
          recordedAlphas.vpvr = this.ctx.globalAlpha;
        },
      },
      scheduler: { invalidate: () => {} },
    };

    const handle = attachMainPaneOpacityAdapter(renderer, 0.35);
    assert.ok(Math.abs(handle.getOpacity() - 0.35) < 1e-6);

    renderer.backend.emitCandles(batch);
    renderer.backend.emitSeries(batch, {}, { id: 'price', kind: 'price' });
    renderer.backend.emitSeries(batch, {}, { id: 'rsi_1', kind: 'indicator' });
    renderer.backend.emitFill(batch, {}, {}, { id: 'price', kind: 'price' });
    renderer.indicatorSlices.paintEntry(ctx, { pane: { id: 'price', kind: 'price' } });
    renderer.indicatorSlices.paintEntry(ctx, { pane: { id: 'macd_1', kind: 'indicator' } });
    renderer.userDrawings.painter.paintOne(ctx, { paneId: 'price' });
    renderer.userDrawings.painter.paintOne(ctx, { paneId: 'rsi_1' });
    renderer.volumeRenderer.render({ fillPane: false });
    renderer.volumeRenderer.render({ fillPane: true });
    renderer.vpvrRenderer.render({});

    assert.equal(recordedAlphas.candles, 1);
    assert.ok(Math.abs(recordedAlphas.series_price - 0.35) < 1e-6);
    assert.ok(Math.abs(recordedAlphas.fill_price - 0.35) < 1e-6);
    assert.equal(recordedAlphas.series_rsi_1, 1);
    assert.ok(Math.abs(recordedAlphas.slice_price - 0.35) < 1e-6);
    assert.equal(recordedAlphas.slice_macd_1, 1);
    assert.ok(Math.abs(recordedAlphas.drawing_price - 0.35) < 1e-6);
    assert.equal(recordedAlphas.drawing_rsi_1, 1);
    assert.ok(Math.abs(recordedAlphas.volume_price - 0.35) < 1e-6);
    assert.equal(recordedAlphas.volume_own, 1);
    assert.ok(Math.abs(recordedAlphas.vpvr - 0.35) < 1e-6);
    assert.equal(batch.alpha, 1);
    assert.equal(ctx.globalAlpha, 1);
  });
});

describe('resolveAlertLineTone', () => {
  it('memetakan kondisi dan status alert ke tone tema yang tepat', () => {
    assert.equal(resolveAlertLineTone({ condition: 'crossing_up', triggered: false }), 'bull');
    assert.equal(resolveAlertLineTone({ condition: 'above', triggered: false }), 'bull');
    assert.equal(resolveAlertLineTone({ condition: 'crossing_down', triggered: false }), 'bear');
    assert.equal(resolveAlertLineTone({ condition: 'below', triggered: false }), 'bear');
    assert.equal(resolveAlertLineTone({ condition: 'crossing', triggered: false }), 'neutral');
    assert.equal(resolveAlertLineTone({ condition: 'crossing_up', triggered: true }), 'bear');
    assert.equal(
      resolveAlertLineTone({ condition: 'crossing', triggered: false, planRole: 'tp1' }),
      'bull'
    );
    assert.equal(
      resolveAlertLineTone({ condition: 'crossing', triggered: false, planRole: 'sl' }),
      'bear'
    );
  });
});
