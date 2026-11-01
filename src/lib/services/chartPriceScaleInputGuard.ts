/**
 * chartPriceScaleInputGuard.ts
 *
 * Mengenkapsulasi proteksi input pada sumbu skala harga (price scale / y-axis),
 * sumbu skala waktu (time scale / x-axis), dan separator sub-pane.
 *
 * Masalah:
 * Pada engine grafik @luxalgo/vela, InputController.onDown memanggil
 * `this.deps.drawingsClaim?.(x, y)` sebelum mengevaluasi region kursor.
 * Jika terdapat objek drawing (seperti Horizontal Line, Ray, Extended Line,
 * Rectangle/Box, atau Position tool) yang hit-testing-nya melewati batas area plot
 * (misal hline yang mengecek |py - y| <= tol tanpa membatasi koordinat X),
 * maka saat pengguna mengklik angka-angka harga di sumbu kanan untuk memperpanjang
 * grafik secara vertikal (drag price scale) atau double-click untuk reset skala,
 * objek gambar di belakangnya akan mengklaim pointerdown (`region = 'drawing'`).
 *
 * Solusi:
 * Mencegat (intercept) delegasi `drawingsClaim`, `drawingsCursor`, `drawingsDblClick`,
 * dan `drawingsDeleteAt` pada `native.input.deps` (serta `native.userDrawings`) agar
 * selalu mengembalikan false / null ketika koordinat kursor (x, y) berada di luar
 * data area (area plot utama grafik). Dengan demikian, klik dan drag pada sumbu harga
 * selalu diarahkan ke `beginPriceScale` / `priceScaleBy` / `resetPriceScale`.
 */

export function attachPriceScaleInputGuard(cellOrChart: any): void {
  if (!cellOrChart) return;
  const chart = cellOrChart.chart || cellOrChart.inner || cellOrChart;
  const renderer = chart?.renderer;
  const native = renderer?.renderer || renderer;
  if (!native) return;

  if (native.__priceScaleInputGuardAttached) return;

  const input = native.input;
  if (!input || !input.deps) {
    // Jika input belum terpasang (misal sebelum kanvas di-mount ke DOM),
    // pasang interceptor pada mount() agar otomatis terproteksi saat kanvas aktif.
    if (typeof native.mount === 'function' && !native.__priceScaleMountIntercepted) {
      const origMount = native.mount.bind(native);
      native.mount = function (mountContainer: any) {
        const res = origMount(mountContainer);
        try {
          attachPriceScaleInputGuard(cellOrChart);
        } catch (_) {}
        return res;
      };
      native.__priceScaleMountIntercepted = true;
    }
    return;
  }

  const deps = input.deps;

  /**
   * Memeriksa apakah suatu koordinat kanvas (x, y) berada di luar area data plot
   * (yaitu di sumbu skala harga di kanan, sumbu waktu di bawah, atau separator sub-pane).
   */
  const isOutsideDataArea = (x: number, y: number): boolean => {
    // 1. Periksa via regionAt bawaan InputController jika tersedia
    if (typeof input.regionAt === 'function') {
      try {
        const region = input.regionAt(x, y);
        if (region !== 'data') return true;
      } catch (_) {}
    }

    // 2. Periksa batas koordinat lebar & tinggi plot (data area) dari Coords
    const c = typeof deps.getCoords === 'function' ? deps.getCoords() : native.coords;
    if (c) {
      if (typeof c.width === 'number' && x > c.width) return true;
      if (typeof c.height === 'number' && y > c.height) return true;
      if (x < 0 || y < 0) return true;
    }

    return false;
  };

  // Intercept drawingsClaim: jangan izinkan drawing mengklaim klik jika berada di sumbu harga / waktu / separator
  const origDrawingsClaim = deps.drawingsClaim;
  if (typeof origDrawingsClaim === 'function') {
    deps.drawingsClaim = function (x: number, y: number) {
      if (isOutsideDataArea(x, y)) {
        return false;
      }
      return origDrawingsClaim.call(deps, x, y);
    };
  }

  // Intercept drawingsCursor: pastikan kursor di atas sumbu harga tetap ns-resize, sumbu waktu ew-resize
  const origDrawingsCursor = deps.drawingsCursor;
  if (typeof origDrawingsCursor === 'function') {
    deps.drawingsCursor = function (x: number, y: number) {
      if (isOutsideDataArea(x, y)) {
        return null;
      }
      return origDrawingsCursor.call(deps, x, y);
    };
  }

  // Intercept drawingsDblClick: double click di sumbu harga harus resetPriceScale, bukan mengedit drawing
  const origDrawingsDblClick = deps.drawingsDblClick;
  if (typeof origDrawingsDblClick === 'function') {
    deps.drawingsDblClick = function (x: number, y: number) {
      if (isOutsideDataArea(x, y)) {
        return false;
      }
      return origDrawingsDblClick.call(deps, x, y);
    };
  }

  // Intercept drawingsDeleteAt: middle click di sumbu harga tidak boleh menghapus drawing
  const origDrawingsDeleteAt = deps.drawingsDeleteAt;
  if (typeof origDrawingsDeleteAt === 'function') {
    deps.drawingsDeleteAt = function (x: number, y: number) {
      if (isOutsideDataArea(x, y)) {
        return false;
      }
      return origDrawingsDeleteAt.call(deps, x, y);
    };
  }

  // Intercept drawingsPointerDown & drawingsPointerMove secara defensif
  const origDrawingsPointerDown = deps.drawingsPointerDown;
  if (typeof origDrawingsPointerDown === 'function') {
    deps.drawingsPointerDown = function (x: number, y: number, ...args: any[]) {
      if (isOutsideDataArea(x, y)) {
        return;
      }
      return origDrawingsPointerDown.call(deps, x, y, ...args);
    };
  }

  const origDrawingsPointerMove = deps.drawingsPointerMove;
  if (typeof origDrawingsPointerMove === 'function') {
    deps.drawingsPointerMove = function (x: number, y: number, ...args: any[]) {
      if (isOutsideDataArea(x, y)) {
        return;
      }
      return origDrawingsPointerMove.call(deps, x, y, ...args);
    };
  }

  // Intercept juga pada userDrawings langsung jika instans tersedia di native renderer
  if (native.userDrawings) {
    const ud = native.userDrawings;
    const origUdClaim = ud.claim;
    if (typeof origUdClaim === 'function') {
      ud.claim = function (x: number, y: number) {
        if (isOutsideDataArea(x, y)) return false;
        return origUdClaim.call(ud, x, y);
      };
    }

    const origUdCursorAt = ud.cursorAt;
    if (typeof origUdCursorAt === 'function') {
      ud.cursorAt = function (x: number, y: number) {
        if (isOutsideDataArea(x, y)) return null;
        return origUdCursorAt.call(ud, x, y);
      };
    }

    const origUdDblClick = ud.dblClick;
    if (typeof origUdDblClick === 'function') {
      ud.dblClick = function (x: number, y: number) {
        if (isOutsideDataArea(x, y)) return false;
        return origUdDblClick.call(ud, x, y);
      };
    }
  }

  native.__priceScaleInputGuardAttached = true;
}
