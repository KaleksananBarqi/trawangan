import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PriceScaleOverlayController } from '../src/lib/services/priceScaleOverlayController';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { WorkspaceAutoSaveCoordinator } from '../src/lib/services/workspaceLifecycle';
import type { ActiveIndicatorInfo, PriceAlert } from '../src/lib/types/market';

describe('Bug 2 Regression: Performa Drag Long/Short saat Indikator & Auto-Save Aktif', () => {
  it('1. PriceScaleOverlayController: event bar/history/indicator hanya 1 frame tanpa continuous loop & guard updateAlerts akurat', () => {
    const controller = new PriceScaleOverlayController();
    const chartListeners = new Map<string, Set<() => void>>();

    let containerRectCalls = 0;
    let plotRectCalls = 0;
    let indicatorValueReads = 0;

    const mockContainer = {
      getBoundingClientRect: () => {
        containerRectCalls++;
        return { left: 0, top: 0, width: 800, height: 600 };
      },
    };
    const mockPlot = {
      getBoundingClientRect: () => {
        plotRectCalls++;
        return { left: 0, top: 20, width: 800, height: 580 };
      },
    };
    const mockChart: any = {
      renderer: {
        renderer: {
          coords: { priceToY: (p: number) => 600 - p },
          plot: mockPlot,
          pricePane: { scale: {}, bounds: { top: 0, height: 600 } },
        },
      },
      on: (ev: string, fn: () => void) => {
        if (!chartListeners.has(ev)) chartListeners.set(ev, new Set());
        chartListeners.get(ev)!.add(fn);
        return () => chartListeners.get(ev)?.delete(fn);
      },
    };
    const mockWorkspace: any = {
      active: { chart: mockChart },
      events: { on: () => () => {} },
    };

    const unsubChart = controller.attachChart(mockContainer as any, mockWorkspace);

    // Pasang indikator dengan getter pengintai pada lastValue
    const indicators: ActiveIndicatorInfo[] = Array.from({ length: 5 }, (_, i) => {
      const val = 100 + i * 10;
      const item: any = {
        id: `ind_${i}`,
        title: `EMA ${i}`,
        visible: true,
        color: '#38bdf8',
      };
      Object.defineProperty(item, 'lastValue', {
        enumerable: true,
        get() {
          indicatorValueReads++;
          return val;
        },
      });
      return item;
    });

    // Pasang beberapa alerts & drawings
    const alerts: PriceAlert[] = Array.from({ length: 4 }, (_, i) => ({
      id: `alt_${i}`,
      symbol: 'BTCUSDT',
      targetPrice: 110 + i * 10,
      condition: 'crossing',
      frequency: 'once',
      label: `Alert ${i}`,
      active: true,
      triggered: false,
      createdAt: i + 1,
    }));
    const drawings = Array.from({ length: 3 }, (_, i) => ({
      id: `pos_${i}`,
      type: 'position',
      visible: true,
      anchors: [
        { time: 1, price: 200 + i },
        { time: 2, price: 180 + i },
        { time: 2, price: 250 + i },
      ],
    }));

    controller.updateAlerts(alerts, 'BTCUSDT');
    controller.updateIndicators(indicators, true);
    controller.updateDrawings(drawings, true);

    // Uji perilaku observabel rAF tanpa monkeypatching private method:
    const origRaf = globalThis.requestAnimationFrame;
    const origCancel = globalThis.cancelAnimationFrame;
    const queuedRafs: Array<{ id: number; cb: FrameRequestCallback }> = [];
    let rafSeq = 1;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = rafSeq++;
      queuedRafs.push({ id, cb });
      return id;
    };
    (globalThis as any).cancelAnimationFrame = (id: number) => {
      const idx = queuedRafs.findIndex((q) => q.id === id);
      if (idx >= 0) queuedRafs.splice(idx, 1);
    };

    try {
      // Event data ('bar', 'history:complete', 'indicator:inputs') terpasang & hanya menjadwalkan 1 frame (bukan continuous loop)
      const barHandlers = chartListeners.get('bar') || new Set();
      const historyHandlers = chartListeners.get('history:complete') || new Set();
      const indInputHandlers = chartListeners.get('indicator:inputs') || new Set();
      assert.ok(barHandlers.size > 0);
      assert.ok(historyHandlers.size > 0);
      assert.ok(indInputHandlers.size > 0);

      for (let i = 0; i < 10; i++) {
        for (const h of barHandlers) h();
      }
      assert.equal(queuedRafs.length, 1, '10 event bar beruntun hanya boleh menjadwalkan 1 rAF');
      const barFrame = queuedRafs.shift()!;
      barFrame.cb(16.7);
      assert.equal(queuedRafs.length, 0, 'Event bar tidak boleh menjadwalkan rAF berkelanjutan setelah 1 frame selesai');

      // history:complete & indicator:inputs harus menandai badge indikator agar direfresh pada 1 frame berikutnya
      const readsBeforeHistory = indicatorValueReads;
      for (const h of historyHandlers) h();
      assert.equal(queuedRafs.length, 1);
      queuedRafs.shift()!.cb(16.7);
      assert.ok(indicatorValueReads > readsBeforeHistory, 'history:complete harus menyegarkan indikator');
      assert.equal(queuedRafs.length, 0);

      const readsBeforeInputs = indicatorValueReads;
      for (const h of indInputHandlers) h();
      assert.equal(queuedRafs.length, 1);
      queuedRafs.shift()!.cb(16.7);
      assert.ok(indicatorValueReads > readsBeforeInputs, 'indicator:inputs harus menyegarkan indikator');
      assert.equal(queuedRafs.length, 0);

      // Bandingkan dengan viewport:changed yang memang menjadwalkan loop rAF berkelanjutan (scheduleContinuousSync)
      const vpHandlers = chartListeners.get('viewport:changed') || new Set();
      assert.ok(vpHandlers.size > 0);
      for (const h of vpHandlers) h();
      assert.equal(queuedRafs.length, 1);
      const vpFrame1 = queuedRafs.shift()!;
      vpFrame1.cb(performance.now());
      assert.equal(queuedRafs.length, 1, 'viewport:changed harus melanjutkan sinkronisasi rAF selagi durasi easing belum habis');
      queuedRafs.length = 0;
    } finally {
      (globalThis as any).requestAnimationFrame = origRaf;
      (globalThis as any).cancelAnimationFrame = origCancel;
    }

    // Uji dragging Long/Short (hanya drawing yang berubah, indikator tetap sama):
    containerRectCalls = 0;
    plotRectCalls = 0;
    const readsBeforeDrag = indicatorValueReads;

    drawings[0].anchors[0].price = 205;
    controller.updateDrawings([...drawings], true);

    assert.equal(
      indicatorValueReads,
      readsBeforeDrag,
      'updateDrawings saat drag tidak boleh mengekstrak ulang indicator price badges'
    );
    assert.equal(
      containerRectCalls,
      1,
      'Container getBoundingClientRect() hanya boleh dibaca 1x per frame computeAllPositions()'
    );
    assert.equal(
      plotRectCalls,
      1,
      'Plot getBoundingClientRect() hanya boleh dibaca 1x per frame computeAllPositions()'
    );

    // Uji equality guard pada rAF frame & updateAlerts no-op guard:
    let snapshotNotifications = 0;
    const unsub = controller.subscribe(() => {
      snapshotNotifications++;
    });
    const notificationsAfterSub = snapshotNotifications;
    const tickBeforeNoop = controller.getSnapshot().tick;

    controller.updateDrawings([...drawings], true);
    assert.equal(
      controller.getSnapshot().tick,
      tickBeforeNoop,
      'Frame tanpa perubahan nilai badge/koordinat tidak boleh menaikkan tick'
    );
    assert.equal(
      snapshotNotifications,
      notificationsAfterSub,
      'Frame tanpa perubahan nilai tidak boleh memicu notifikasi subscriber baru'
    );

    // Panggilan updateAlerts beruntun dengan referensi alerts, activeSymbol, & posisi identik tidak boleh spam notify()
    controller.updateAlerts(alerts, 'BTCUSDT');
    assert.equal(
      snapshotNotifications,
      notificationsAfterSub,
      'updateAlerts no-op dengan referensi & posisi identik tidak boleh memicu notify()'
    );

    unsub();
    unsubChart();
    controller.destroy();
  });

  it('2. ChartDrawingController: drawing:draft terisolasi via subscribeDraft & stabilitas referensi activePlans/geometries terjaga', () => {
    const chartListeners = new Map<string, Set<(payload?: any) => void>>();
    const drawingsList: any[] = [
      {
        id: 'pos_manual_1',
        type: 'position',
        anchors: [
          { time: 1000, price: 65000 },
          { time: 2000, price: 64000 },
          { time: 2000, price: 68000 },
        ],
      },
    ];

    const unsubChartListeners: Array<{ ev: string; fn: any }> = [];
    const mockChart: any = {
      drawings: {
        all: () => drawingsList,
        setSnapMode: () => {},
        setStayMode: () => {},
        setTool: () => {},
        setMode: () => {},
        toJSON: () => ({ version: 1, drawings: drawingsList }),
      },
      on: (ev: string, fn: () => void) => {
        if (!chartListeners.has(ev)) chartListeners.set(ev, new Set());
        chartListeners.get(ev)!.add(fn);
      },
      off: (ev: string, fn: () => void) => {
        unsubChartListeners.push({ ev, fn });
        chartListeners.get(ev)?.delete(fn);
      },
    };
    const mockWorkspace: any = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [{ chart: mockChart }],
    };

    // Stub requestAnimationFrame secara terkontrol untuk menguji rAF coalescing
    const origRaf = globalThis.requestAnimationFrame;
    const origCancel = globalThis.cancelAnimationFrame;
    const queuedRafs: Array<{ id: number; cb: FrameRequestCallback }> = [];
    let rafSeq = 1;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = rafSeq++;
      queuedRafs.push({ id, cb });
      return id;
    };
    (globalThis as any).cancelAnimationFrame = (id: number) => {
      const idx = queuedRafs.findIndex((q) => q.id === id);
      if (idx >= 0) queuedRafs.splice(idx, 1);
    };

    try {
      const ctrl = new ChartDrawingController();
      const unsubWorkspace = ctrl.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m', () => 'binance');
      ctrl.setThesisCardGeometry('plan_1', { x: 20, y: 60, width: 320 });

      let fullNotifyCount = 0;
      let latestFullState: any = null;
      const unsubFull = ctrl.subscribe((s) => {
        fullNotifyCount++;
        latestFullState = s;
      });

      let draftNotifyCount = 0;
      let latestDraftDrawings: any[] = [];
      const unsubDraft = ctrl.subscribeDraft((d) => {
        draftNotifyCount++;
        latestDraftDrawings = d;
      });

      const plansRefBefore = latestFullState.activePlans;
      const geomsRefBefore = latestFullState.thesisCardGeometries;

      // Mode 'cursor' saat handle Long/Short di-drag: drawing:draft menandai isDraftInteractionActive()
      ctrl.setTool('cursor');
      assert.equal(ctrl.isDraftInteractionActive(), false);
      const fullCountBeforeDraft = fullNotifyCount;
      const draftCountBeforeDrag = draftNotifyCount;

      // Simulasikan 15x event drawing:draft beruntun dari drag Long/Short dalam 1 frame
      const draftHandlers = Array.from(chartListeners.get('drawing:draft') || []);
      assert.ok(draftHandlers.length > 0);
      for (let i = 0; i < 15; i++) {
        drawingsList[0].anchors[2].price = 68000 + i * 10;
        for (const h of draftHandlers) h();
      }

      assert.equal(
        ctrl.isDraftInteractionActive(),
        true,
        'isDraftInteractionActive harus aktif selama drag handle di mode cursor'
      );

      // rAF coalescing: hanya boleh menjadwalkan 1 frame callback meski ada 15 event
      assert.equal(queuedRafs.length, 1, 'Multiple drawing:draft harus digabung dalam 1 rAF');
      assert.equal(fullNotifyCount, fullCountBeforeDraft, 'drawing:draft belum boleh memicu full notify sebelum atau sesudah rAF');

      // Eksekusi frame rAF
      const frame = queuedRafs.shift()!;
      frame.cb(16.7);

      assert.equal(draftNotifyCount, draftCountBeforeDrag + 1, 'subscribeDraft menerima tepat 1 update per frame');
      assert.equal(latestDraftDrawings[0].anchors[2].price, 68140);
      assert.equal(
        fullNotifyCount,
        fullCountBeforeDraft,
        'drawing:draft rAF tidak boleh memicu full subscribe() (+page.svelte re-render / auto-save)'
      );

      // Saat tool atau seleksi gambar berubah, activePlans & thesisCardGeometries tetap menjaga referensi identik
      ctrl.selectDrawing('pos_manual_1');
      assert.ok(fullNotifyCount > fullCountBeforeDraft);
      assert.equal(
        latestFullState.activePlans,
        plansRefBefore,
        'Referensi activePlans harus stabil jika plan tidak berubah'
      );
      assert.equal(
        latestFullState.thesisCardGeometries,
        geomsRefBefore,
        'Referensi thesisCardGeometries harus stabil jika geometri tidak berubah'
      );

      // Pastikan pending draft rAF & status draftInteractionActive dibersihkan saat drawing:edited masuk
      for (const h of draftHandlers) h();
      assert.equal(queuedRafs.length, 1);
      const editedHandlers = Array.from(chartListeners.get('drawing:edited') || []);
      for (const h of editedHandlers) h();
      assert.equal(queuedRafs.length, 0, 'drawing:edited wajib membatalkan pending draft rAF');
      assert.equal(ctrl.isDraftInteractionActive(), false);

      // Pastikan teardown attachWorkspace melepaskan semua listener chart & membatalkan draft rAF tertunda
      for (const h of draftHandlers) h();
      assert.equal(queuedRafs.length, 1);
      assert.equal(ctrl.isDraftInteractionActive(), true);
      unsubWorkspace();
      assert.equal(queuedRafs.length, 0, 'Teardown attachWorkspace wajib membatalkan pending draft rAF');
      assert.equal(ctrl.isDraftInteractionActive(), false);
      assert.ok(
        unsubChartListeners.some((entry) => entry.ev === 'drawing:draft'),
        'Teardown attachWorkspace wajib melepas listener chart via chart.off()'
      );
      assert.equal(chartListeners.get('drawing:draft')?.size ?? 0, 0);

      unsubFull();
      unsubDraft();
    } finally {
      (globalThis as any).requestAnimationFrame = origRaf;
      (globalThis as any).cancelAnimationFrame = origCancel;
    }
  });

  it('3. WorkspaceAutoSaveCoordinator.triggerDeferred menunda builder hingga flush', async () => {
    let buildCalls = 0;
    let saveCalls = 0;
    let currentLayout = '1';

    const coordinator = new WorkspaceAutoSaveCoordinator({
      debounceMs: 1500,
      onSave: async () => {
        saveCalls++;
      },
    });

    const builder = () => {
      buildCalls++;
      return {
        id: 'ws_perf',
        name: 'Perf WS',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: currentLayout,
        indicators: [],
      };
    };

    // Panggil 25x saat drag berlangsung -> builder & save tidak boleh dieksekusi sama sekali
    for (let i = 0; i < 25; i++) {
      coordinator.triggerDeferred(builder);
    }
    assert.equal(coordinator.isPending(), true);
    assert.equal(buildCalls, 0, 'triggerDeferred tidak boleh memanggil builder mahal secara sinkron');
    assert.equal(saveCalls, 0);

    // Flush satu kali -> builder & save berjalan tepat 1x
    const flushed1 = await coordinator.flushNow();
    assert.equal(flushed1, true);
    assert.equal(buildCalls, 1);
    assert.equal(saveCalls, 1);

    // Trigger lagi tanpa perubahan aktual -> builder dieksekusi di flush, namun fingerprint sama sehingga save dilewati
    coordinator.triggerDeferred(builder);
    const flushed2 = await coordinator.flushNow();
    assert.equal(flushed2, false);
    assert.equal(buildCalls, 2);
    assert.equal(saveCalls, 1);

    coordinator.cancel();
  });
});
