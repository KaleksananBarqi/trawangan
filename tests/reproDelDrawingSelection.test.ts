import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';

describe('Drawing Canvas Selection & Delete Key Seam Suite', () => {
  test('1. Klik objek di kanvas (drawing:selected), lalu tekan Del menghapus objek tersebut', () => {
    const controller = new ChartDrawingController();
    let drawingsList = [
      { id: 'drawing-abc', type: 'trendline', anchors: [{ time: 1000, price: 100 }] }
    ];

    const listeners: Record<string, (payload?: any) => void> = {};

    const mockDrawings = {
      all: () => drawingsList,
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      select: (id: string) => {},
      deselect: () => {},
    };

    const mockChart = {
      drawings: mockDrawings,
      on: (event: string, fn: (payload?: any) => void) => {
        listeners[event] = fn;
      },
      off: (event: string) => {
        delete listeners[event];
      }
    };

    const mockWorkspace = {
      active: { chart: mockChart },
      cells: () => [{ chart: mockChart }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();

    dispatcher.bindHandler('draw-delete', () => {
      controller.deleteSelectedDrawing();
    });

    // 1. User klik gambar di kanvas -> Vela memancarkan 'drawing:selected'
    assert.ok(listeners['drawing:selected'], 'ChartDrawingController harus mendengarkan drawing:selected');
    listeners['drawing:selected']({ id: 'drawing-abc', ids: ['drawing-abc'] });
    assert.equal(controller.getSelectedDrawingId(), 'drawing-abc');

    // 2. User tekan Del di keyboard
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(drawingsList.length, 0, 'Objek gambar terpilih harus terhapus');
    assert.equal(controller.getSelectedDrawingId(), null, 'Seleksi harus kembali null');
  });

  test('2. Tekan Backspace juga menghapus objek gambar yang sedang dipilih', () => {
    const controller = new ChartDrawingController();
    let drawingsList = [
      { id: 'drawing-xyz', type: 'box', anchors: [{ time: 2000, price: 200 }] }
    ];

    const listeners: Record<string, (payload?: any) => void> = {};

    const mockDrawings = {
      all: () => drawingsList,
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      select: () => {},
      deselect: () => {},
    };

    const mockChart = {
      drawings: mockDrawings,
      on: (event: string, fn: (payload?: any) => void) => {
        listeners[event] = fn;
      },
      off: (event: string) => {
        delete listeners[event];
      }
    };

    const mockWorkspace = {
      active: { chart: mockChart },
      cells: () => [{ chart: mockChart }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();

    dispatcher.bindHandler('draw-delete', () => {
      controller.deleteSelectedDrawing();
    });

    listeners['drawing:selected']({ id: 'drawing-xyz', ids: ['drawing-xyz'] });
    assert.equal(controller.getSelectedDrawingId(), 'drawing-xyz');

    // Tekan Backspace
    dispatcher.dispatch({
      key: 'Backspace',
      code: 'Backspace',
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(drawingsList.length, 0, 'Backspace harus menghapus gambar terpilih');
  });

  test('3. Deselect (klik kanvas kosong) diikuti Del tidak menghapus apa-apa (safe no-op)', () => {
    const controller = new ChartDrawingController();
    let drawingsList = [
      { id: 'drawing-keep', type: 'hline', anchors: [{ time: 1000, price: 50 }] }
    ];

    const listeners: Record<string, (payload?: any) => void> = {};

    const mockDrawings = {
      all: () => drawingsList,
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      select: () => {},
      deselect: () => {},
    };

    const mockChart = {
      drawings: mockDrawings,
      on: (event: string, fn: (payload?: any) => void) => {
        listeners[event] = fn;
      },
      off: () => {}
    };

    controller.attachWorkspace({ active: { chart: mockChart } } as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();

    dispatcher.bindHandler('draw-delete', () => {
      controller.deleteSelectedDrawing();
    });

    // 1. Pilih gambar
    listeners['drawing:selected']({ id: 'drawing-keep', ids: ['drawing-keep'] });
    assert.equal(controller.getSelectedDrawingId(), 'drawing-keep');

    // 2. Klik kanvas kosong -> Vela memancarkan deselect { id: null, ids: [] }
    listeners['drawing:selected']({ id: null, ids: [] });
    assert.equal(controller.getSelectedDrawingId(), null);

    // 3. Tekan Del
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(drawingsList.length, 1, 'Gambar tidak boleh terhapus saat tidak ada seleksi');
  });

  test('4. Fallback ke engine selectedIds jika event belum terpicu', () => {
    const controller = new ChartDrawingController();
    let drawingsList = [
      { id: 'drawing-fallback', type: 'trendline' }
    ];

    const mockDrawings = {
      all: () => drawingsList,
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      ctrl: {
        selectedIds: ['drawing-fallback']
      }
    };

    const mockChart = {
      drawings: mockDrawings,
      on: () => {},
      off: () => {}
    };

    controller.attachWorkspace({ active: { chart: mockChart } } as any, () => 'BTCUSDT', () => '15m');

    // Meskipun event belum dipanggil, getSelectedDrawingId harus membaca selectedIds dari engine
    assert.equal(controller.getSelectedDrawingId(), 'drawing-fallback');

    const deleted = controller.deleteSelectedDrawing();
    assert.deepEqual(deleted, ['drawing-fallback']);
    assert.equal(drawingsList.length, 0);
  });
});
