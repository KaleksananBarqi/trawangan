import test from 'node:test';
import assert from 'node:assert/strict';

test.describe('Persistent Price Line Guard Seam Suite (#22)', () => {
  test('1. Patch priceScale harus menyertakan currentPriceLine agar Vela tidak menimpa showPriceLine', () => {
    // Simulasi konfigurasi patch yang dibuat oleh kontrol skala harga
    const state = { mode: 'log', invert: true };
    let showCurrentPriceLine: any = true;

    const patch: any = { priceScale: {} };
    if (state.mode === 'log') {
      patch.priceScale.log = true;
      patch.priceScale.mode = 'price';
    } else {
      patch.priceScale.mode = state.mode;
      patch.priceScale.log = false;
    }
    patch.priceScale.invert = state.invert;
    // Guard yang diterapkan:
    patch.priceScale.currentPriceLine = showCurrentPriceLine !== false;

    assert.equal(patch.priceScale.currentPriceLine, true);
    assert.equal(patch.priceScale.log, true);
    assert.equal(patch.priceScale.invert, true);
  });

  test('2. Mock scene renderer: applyConfig tidak boleh menghilangkan scene.showPriceLine', () => {
    // Simulasi perilaku internal Vela
    const mockScene = { showPriceLine: true };
    const mockRenderer = {
      scene: mockScene,
      applyConfig(next: any) {
        if (next.priceScale) {
          // Perilaku asli Vela:
          this.scene.showPriceLine = next.priceScale.currentPriceLine;
        }
      },
    };

    // 1. Tanpa guard: jika patch hanya membawa { priceScale: { log: true } }
    const badPatch: any = { priceScale: { log: true } };
    mockRenderer.applyConfig(badPatch);
    assert.equal(mockScene.showPriceLine, undefined); // Memastikan bahwa tanpa guard, garis akan hilang

    // 2. Dengan Persistent Price Line Guard:
    const safePatch: any = {
      priceScale: {
        log: true,
        currentPriceLine: true,
      },
    };
    mockRenderer.applyConfig(safePatch);
    assert.equal(mockScene.showPriceLine, true); // Terlindungi: garis tetap aktif!
  });

  test('3. EnforceCurrentPriceLine memulihkan scene yang ter-reset', () => {
    const mockCells = [
      { chart: { renderer: { scene: { showPriceLine: undefined as any } } } },
      { chart: { renderer: { scene: { showPriceLine: false as any } } } },
    ];

    const showCurrentPriceLine = true;
    for (const cell of mockCells) {
      const native = cell.chart.renderer;
      if (native?.scene) {
        native.scene.showPriceLine = showCurrentPriceLine;
      }
    }

    assert.equal(mockCells[0].chart.renderer.scene.showPriceLine, true);
    assert.equal(mockCells[1].chart.renderer.scene.showPriceLine, true);
  });

  test('4. Defensive Interceptor pada applyConfig: otomatis menyuntikkan currentPriceLine jika diabaikan oleh patch parsial', () => {
    const mockScene = { showPriceLine: true };
    const mockNative: any = {
      scene: mockScene,
      applyConfig(next: any) {
        if (next.priceScale) {
          this.scene.showPriceLine = next.priceScale.currentPriceLine;
        }
      },
    };

    // Pasang defensive interceptor
    let showCurrentPriceLine = true;
    const originalApplyConfig = mockNative.applyConfig.bind(mockNative);
    mockNative.applyConfig = function (patch: any) {
      if (patch) {
        if (!patch.priceScale) {
          patch.priceScale = {};
        }
        if (patch.priceScale.currentPriceLine === undefined) {
          patch.priceScale.currentPriceLine = showCurrentPriceLine !== false;
        }
      }
      const res = originalApplyConfig(patch);
      if (this.scene) {
        this.scene.showPriceLine = showCurrentPriceLine !== false;
      }
      return res;
    };

    // Uji: Patch tanpa priceScale (misal perubahan tema atau margin)
    mockNative.applyConfig({ margins: { top: 15 } });
    assert.equal(mockScene.showPriceLine, true, 'showPriceLine harus tetap true meski patch hanya berisi margins');

    // Uji: Patch dengan priceScale parsial tanpa currentPriceLine (misal toggle log scale)
    mockNative.applyConfig({ priceScale: { log: true } });
    assert.equal(mockScene.showPriceLine, true, 'showPriceLine harus tetap true meski patch hanya berisi log scale');

    // Uji: Saat user sengaja mematikan showCurrentPriceLine
    showCurrentPriceLine = false;
    mockNative.applyConfig({ priceScale: { log: false } });
    assert.equal(mockScene.showPriceLine, false, 'showPriceLine harus false jika user sengaja mematikannya');
  });

  test('5. Lifecycle Auto-Healing: Event market:changed dan cell:created memulihkan garis harga dan invalidate scheduler', () => {
    let invalidateLevel = 0;
    const mockCell = {
      chart: {
        renderer: {
          renderer: {
            scene: { showPriceLine: undefined as any },
            scheduler: {
              invalidate(level: number) {
                invalidateLevel = level;
              },
            },
            set(key: string, val: any) {
              if (key === 'currentPriceLine') {
                this.scene.showPriceLine = val;
              }
            },
          },
        },
        events: new Map<string, Function>(),
        on(event: string, fn: Function) {
          this.events.set(event, fn);
        },
      },
    };

    // Fungsi enforce helper
    const showCurrentPriceLine: boolean = true;
    function enforceCurrentPriceLineOnCell(cell: any) {
      const native = cell?.chart?.renderer?.renderer;
      if (native?.scene) {
        native.scene.showPriceLine = showCurrentPriceLine !== false;
      }
      if (typeof native?.set === 'function') {
        native.set('currentPriceLine', showCurrentPriceLine !== false);
      }
      if (native?.scheduler?.invalidate) {
        native.scheduler.invalidate(4);
      }
    }

    // Pasang listener market:changed
    mockCell.chart.on('market:changed', () => {
      enforceCurrentPriceLineOnCell(mockCell);
    });

    // Simulasikan pergantian market/timeframe
    const onMarketChanged = mockCell.chart.events.get('market:changed');
    assert.ok(onMarketChanged, 'Listener market:changed harus terpasang');
    onMarketChanged();

    assert.equal(mockCell.chart.renderer.renderer.scene.showPriceLine, true);
    assert.equal(invalidateLevel, 4, 'Scheduler invalidate level 4 (chrome overlay) harus dipanggil');
  });

  test('6. ChartSessionController Seam: otomatis menerapkan interceptor dan menegakkan price line', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');

    let invalidated = false;
    const mockScene = { showPriceLine: undefined as any };
    const mockNative: any = {
      scene: mockScene,
      scheduler: {
        invalidate: () => { invalidated = true; }
      },
      applyConfig(next: any) {
        if (next.priceScale) {
          this.scene.showPriceLine = next.priceScale.currentPriceLine;
        }
      }
    };

    const mockCell = {
      chart: {
        renderer: { renderer: mockNative },
        on: () => {}
      }
    };

    const mockWs = {
      cells: () => [mockCell],
      active: mockCell,
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      showCurrentPriceLine: true
    });

    controller.attach({ nodeType: 1 } as any);

    // Initial attach must enforce showPriceLine = true
    assert.equal(mockScene.showPriceLine, true);
    assert.equal(invalidated, true);

    // Partial patch without priceScale.currentPriceLine must be intercepted and kept true
    mockNative.applyConfig({ priceScale: { log: true } });
    assert.equal(mockScene.showPriceLine, true, 'Patch log scale tidak boleh mematikan showPriceLine');

    // Toggling off intentionally via controller
    controller.setShowCurrentPriceLine(false);
    assert.equal(mockScene.showPriceLine, false);

    // Toggling back on
    controller.setShowCurrentPriceLine(true);
    assert.equal(mockScene.showPriceLine, true);

    controller.destroy();
  });
});

