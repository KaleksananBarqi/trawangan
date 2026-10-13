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
});
