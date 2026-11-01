import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { attachPriceScaleInputGuard } from '../src/lib/services/chartSessionController';

describe('Price Scale & Axis Input Guard Suite (Bug: Clicking Price Scale Intercepted by Background Drawings)', () => {
  function createMockCellWithVelaInput() {
    const coords = { width: 800, height: 500 };
    const events: string[] = [];

    // Simulasi drawing object (misal hline atau position box) yang membentang melewati x > 800
    const rawDrawingClaim = (x: number, y: number) => {
      // Objek berada di y = 250, Vela hline / ray / box mengklaim true jika y dekat 250 tanpa cek batas x
      return Math.abs(y - 250) <= 6;
    };

    const deps: any = {
      getCoords: () => coords,
      drawingsClaim: rawDrawingClaim,
      drawingsCursor: (x: number, y: number) => (rawDrawingClaim(x, y) ? 'pointer' : null),
      drawingsDblClick: (x: number, y: number) => rawDrawingClaim(x, y),
      drawingsDeleteAt: (x: number, y: number) => rawDrawingClaim(x, y),
      drawingsPointerDown: (x: number, y: number) => {
        events.push(`drawing:pointerdown:${x},${y}`);
      },
      drawingsPointerMove: (x: number, y: number) => {
        events.push(`drawing:pointermove:${x},${y}`);
      },
      beginPriceScale: (x: number, y: number) => {
        events.push(`priceScale:begin:${x},${y}`);
      },
      priceScaleBy: (dy: number) => {
        events.push(`priceScale:by:${dy}`);
      },
      resetPriceScale: (x: number, y: number) => {
        events.push(`priceScale:reset:${x},${y}`);
      },
      resetView: () => {
        events.push('view:reset');
      },
      beginPaneResize: (y: number) => {
        events.push(`paneResize:begin:${y}`);
      },
    };

    const input: any = {
      deps,
      drawings: true,
      region: 'data',
      startX: 0,
      startY: 0,
      regionAt(x: number, y: number) {
        if (x > coords.width && y <= coords.height) return 'price';
        if (y > coords.height && x <= coords.width) return 'time';
        return 'data';
      },
      // Simulasi persis algoritma InputController.onDown di @luxalgo/vela
      onDown(e: { x: number; y: number; button: number }) {
        if (e.button !== 0) return;
        const { x, y } = e;
        this.startX = x;
        this.startY = y;

        if (this.drawings && this.deps.drawingsClaim?.(x, y)) {
          this.region = 'drawing';
          this.deps.drawingsPointerDown?.(x, y);
          return;
        }

        this.region = this.regionAt(x, y);
        if (this.region === 'price') this.deps.beginPriceScale(x, y);
      },
      onMove(e: { x: number; y: number }) {
        const { x, y } = e;
        if (this.region === 'price') {
          this.deps.priceScaleBy(y - this.startY);
        } else if (this.region === 'drawing') {
          this.deps.drawingsPointerMove?.(x, y);
        }
      },
      doubleActivate(x: number, y: number) {
        if (this.drawings && this.deps.drawingsDblClick?.(x, y)) return;
        const region = this.regionAt(x, y);
        if (region === 'price') this.deps.resetPriceScale(x, y);
        else if (region === 'time') this.deps.resetView();
      },
      getCursor(x: number, y: number) {
        const drawCursor = this.deps.drawingsCursor?.(x, y);
        const r = this.regionAt(x, y);
        return drawCursor ?? (r === 'price' ? 'ns-resize' : r === 'time' ? 'ew-resize' : '');
      }
    };

    const mockCell = {
      chart: {
        renderer: {
          renderer: {
            input,
            coords
          }
        }
      }
    };

    return { mockCell, input, deps, events };
  }

  test('1. Klik pada sumbu harga (price scale) saat ada objek di belakangnya harus memulai priceScale dragging, bukan seleksi drawing', () => {
    const { mockCell, input, events } = createMockCellWithVelaInput();

    // Pasang guard
    attachPriceScaleInputGuard(mockCell);

    // User mengklik tab harga di sebelah kanan (x = 850, y = 250)
    input.onDown({ x: 850, y: 250, button: 0 });

    assert.equal(input.region, 'price', 'Region harus menjadi "price" agar skala harga bisa diregangkan');
    assert.ok(events.includes('priceScale:begin:850,250'), 'beginPriceScale harus dipanggil saat klik pada tab harga');
    assert.equal(events.some((ev) => ev.startsWith('drawing:pointerdown')), false, 'Drawing di belakang skala harga TIDAK boleh menerima pointerdown');

    // User menggeser mouse vertikal untuk meregangkan skala chart ("memperpanjang chart")
    input.onMove({ x: 850, y: 300 });
    assert.ok(events.includes('priceScale:by:50'), 'priceScaleBy harus dipanggil untuk menyesuaikan skala vertikal chart');
  });

  test('2. Kursor mouse di atas skala harga tidak boleh berubah menjadi pointer objek', () => {
    const { mockCell, input } = createMockCellWithVelaInput();

    attachPriceScaleInputGuard(mockCell);

    // Posisi di skala harga (x = 850, y = 250)
    const cursorOnPriceScale = input.getCursor(850, 250);
    assert.equal(cursorOnPriceScale, 'ns-resize', 'Kursor di atas sumbu harga harus tetap ns-resize');

    // Posisi di dalam kanvas data (x = 400, y = 250) di atas objek gambar
    const cursorOnPlot = input.getCursor(400, 250);
    assert.equal(cursorOnPlot, 'pointer', 'Kursor di atas objek di area grafik utama harus tetap pointer');
  });

  test('3. Double-click pada skala harga harus me-reset skala harga, bukan memicu aksi drawing', () => {
    const { mockCell, input, events } = createMockCellWithVelaInput();

    attachPriceScaleInputGuard(mockCell);

    input.doubleActivate(850, 250);
    assert.ok(events.includes('priceScale:reset:850,250'), 'Double click pada tab harga harus memanggil resetPriceScale');
  });

  test('4. Klik pada area grafik (data area) tetap dapat memilih dan menggerakkan gambar secara normal', () => {
    const { mockCell, input, events } = createMockCellWithVelaInput();

    attachPriceScaleInputGuard(mockCell);

    // User mengklik objek di area chart (x = 400, y = 250)
    input.onDown({ x: 400, y: 250, button: 0 });

    assert.equal(input.region, 'drawing', 'Di dalam data area, klik pada objek harus diklaim oleh drawing');
    assert.ok(events.includes('drawing:pointerdown:400,250'), 'Drawing pointerdown harus dipanggil');

    input.onMove({ x: 410, y: 260 });
    assert.ok(events.includes('drawing:pointermove:410,260'), 'Drawing pointermove harus dipanggil');
  });

  test('5. Sumbu waktu (time scale x = 400, y = 520) juga terlindung dari claim drawing', () => {
    const { mockCell, input, events } = createMockCellWithVelaInput();

    // Misal ada drawing (seperti garis vertikal) di x = 400
    input.deps.drawingsClaim = (x: number, y: number) => x === 400;

    attachPriceScaleInputGuard(mockCell);

    input.onDown({ x: 400, y: 520, button: 0 });
    assert.equal(input.region, 'time', 'Region pada sumbu bawah harus time, bukan drawing');
  });
});
