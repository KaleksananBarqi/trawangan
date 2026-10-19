import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';

describe('ChartDrawingController Granular Layer Operations Seam Suite', () => {
  function createMockWorkspace() {
    const drawingsList = [
      { id: 'd-1', type: 'trendline', visible: true, locked: false },
      { id: 'd-2', type: 'hline', visible: true, locked: false },
      { id: 'd-3', type: 'rectangle', visible: false, locked: true },
    ];

    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      show: (id: string, visible: boolean) => {
        calls.push(`show:${id}:${visible}`);
        const found = drawingsList.find((d) => d.id === id);
        if (found) found.visible = visible;
      },
      lock: (id: string, locked: boolean) => {
        calls.push(`lock:${id}:${locked}`);
        const found = drawingsList.find((d) => d.id === id);
        if (found) found.locked = locked;
      },
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        const idx = drawingsList.findIndex((d) => d.id === id);
        if (idx !== -1) drawingsList.splice(idx, 1);
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        for (const id of ids) {
          const idx = drawingsList.findIndex((d) => d.id === id);
          if (idx !== -1) drawingsList.splice(idx, 1);
        }
      },
      select: (id: string) => {
        calls.push(`select:${id}`);
      },
      deselect: () => {
        calls.push('deselect');
      },
      toJSON: () => ({ drawings: drawingsList }),
    };

    const listeners: Record<string, Function[]> = {};

    const mockChart = {
      drawings: mockDrawings,
      on: (event: string, fn: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      },
      off: (event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((f) => f !== fn);
        }
      },
      trigger: (event: string, ...args: any[]) => {
        if (listeners[event]) {
          listeners[event].forEach((fn) => fn(...args));
        }
      },
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [{ chart: mockChart }],
    };

    return { mockWorkspace, mockChart, calls, drawingsList };
  }

  test('1. Toggle Visibilitas Individual: Membalikkan status visible per drawing id', () => {
    const { mockWorkspace, calls, drawingsList } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    // d-1 awalnya visible = true, harus jadi show:d-1:false
    controller.toggleDrawingVisibility('d-1');
    assert.ok(calls.includes('show:d-1:false'));

    // d-3 awalnya visible = false, harus jadi show:d-3:true
    controller.toggleDrawingVisibility('d-3');
    assert.ok(calls.includes('show:d-3:true'));
  });

  test('2. Toggle Kunci Individual: Membalikkan status lock per drawing id', () => {
    const { mockWorkspace, calls } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    // d-1 awalnya locked = false, harus jadi lock:d-1:true
    controller.toggleDrawingLock('d-1');
    assert.ok(calls.includes('lock:d-1:true'));

    // d-3 awalnya locked = true, harus jadi lock:d-3:false
    controller.toggleDrawingLock('d-3');
    assert.ok(calls.includes('lock:d-3:false'));
  });

  test('3. Hapus Individual: Menghapus drawing dari canvas dan notify', () => {
    const { mockWorkspace, calls, drawingsList } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    controller.deleteDrawing('d-2');
    assert.ok(calls.includes('removeMany:d-2') || calls.includes('remove:d-2'));
  });

  test('4. Seleksi Objek Gambar: Memanggil select pada drawing engine dan mengupdate selectedDrawingId', () => {
    const { mockWorkspace, calls } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    controller.selectDrawing('d-1');
    assert.ok(calls.includes('select:d-1'));
    assert.equal(controller.getSelectedDrawingId(), 'd-1');

    // Deselect
    controller.selectDrawing(null);
    assert.ok(calls.includes('deselect'));
    assert.equal(controller.getSelectedDrawingId(), null);
  });

  test('5. Sinkronisasi Dua Arah: Event drawing:select dari kanvas mengupdate state controller', () => {
    const { mockWorkspace, mockChart } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    mockChart.trigger('drawing:select', { id: 'd-3' });
    assert.equal(controller.getSelectedDrawingId(), 'd-3');

    mockChart.trigger('drawing:deselect');
    assert.equal(controller.getSelectedDrawingId(), null);
  });

  test('6. Aksi Massal: bulkHide, bulkLock, dan bulkDelete', async () => {
    const { mockWorkspace, calls } = createMockWorkspace();
    const controller = new ChartDrawingController();
    controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m');

    controller.bulkHideDrawings(true);
    assert.ok(calls.some((c) => c.startsWith('show:')));

    controller.bulkLockDrawings(true);
    assert.ok(calls.some((c) => c.startsWith('lock:')));

    await controller.bulkDeleteDrawings();
    assert.ok(calls.some((c) => c.startsWith('removeMany:')));
  });
});
