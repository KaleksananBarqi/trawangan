import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Indicator Lifecycle & Memory Stacking Prevention', () => {
  test('Indicator Stacking: Menambahkan indikator dengan judul yang sama harus menghapus instance lama', () => {
    // Simulasi registry indicator handles di Chart.svelte
    const indicatorHandles = new Map<string, any>();
    let removeCallCount = 0;

    // Fake chart cell
    const createFakeHandle = (id: string, title: string) => ({
      id,
      title,
      remove: () => {
        removeCallCount++;
      },
    });

    // Implementasi lama (rentan stacking) vs implementasi baru (deduplikasi bersih)
    function addIndicatorOld(title: string, id: string) {
      const handle = createFakeHandle(id, title);
      indicatorHandles.set(id, { handle, title });
      return handle;
    }

    function addIndicatorWithCleanup(title: string, id: string) {
      // Cari dan bersihkan indikator yang memiliki title yang sama
      for (const [existingId, item] of indicatorHandles.entries()) {
        if (item.title === title) {
          if (typeof item.handle?.remove === 'function') {
            item.handle.remove();
          }
          indicatorHandles.delete(existingId);
        }
      }
      const handle = createFakeHandle(id, title);
      indicatorHandles.set(id, { handle, title });
      return handle;
    }

    // Jalankan implementasi baru
    addIndicatorWithCleanup('My RSI Indicator', 'ind_1');
    assert.strictEqual(indicatorHandles.size, 1);
    assert.strictEqual(removeCallCount, 0);

    // Saat user mengedit skrip dan menekan Save / Compile lagi
    addIndicatorWithCleanup('My RSI Indicator', 'ind_2');
    assert.strictEqual(indicatorHandles.size, 1, 'Instance lama harus digantikan, bukan menumpuk');
    assert.strictEqual(removeCallCount, 1, 'Handle lama harus dipanggil .remove() untuk mematikan worker');
    assert.strictEqual(indicatorHandles.get('ind_2')?.title, 'My RSI Indicator');
  });

  test('Multi-Cell Workspace: Semua cell handle harus dilacak dan dibersihkan saat remove', () => {
    const indicatorHandles = new Map<string, { title: string; handles: any[] }>();
    let totalRemoved = 0;

    const createCellHandle = (cellId: string) => ({
      cellId,
      remove: () => {
        totalRemoved++;
      },
    });

    function addIndicatorMultiCell(title: string, id: string, cells: string[]) {
      // Bersihkan jika sudah ada
      for (const [existingId, item] of indicatorHandles.entries()) {
        if (item.title === title) {
          for (const h of item.handles) {
            h.remove();
          }
          indicatorHandles.delete(existingId);
        }
      }

      const handles = cells.map((cellId) => createCellHandle(cellId));
      indicatorHandles.set(id, { title, handles });
    }

    function removeIndicator(id: string) {
      const item = indicatorHandles.get(id);
      if (item) {
        for (const h of item.handles) {
          h.remove();
        }
        indicatorHandles.delete(id);
      }
    }

    // Skenario 4-cell layout
    const cells = ['cell_1', 'cell_2', 'cell_3', 'cell_4'];
    addIndicatorMultiCell('Custom EMA', 'ema_1', cells);
    assert.strictEqual(indicatorHandles.size, 1);
    assert.strictEqual(indicatorHandles.get('ema_1')?.handles.length, 4);

    // Save ulang skrip yang sama
    addIndicatorMultiCell('Custom EMA', 'ema_2', cells);
    assert.strictEqual(totalRemoved, 4, 'Ke-4 handle cell lama harus di-remove agar worker tidak bocor');
    assert.strictEqual(indicatorHandles.size, 1);

    // Hapus indikator
    removeIndicator('ema_2');
    assert.strictEqual(totalRemoved, 8, 'Ke-4 handle aktif harus di-remove saat indikator dihapus');
    assert.strictEqual(indicatorHandles.size, 0);
  });

  test('3. ChartSessionController Seam: addPineIndicator, deduplication, and removal directly on controller', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');

    let removedCell1Count = 0;
    let removedCell2Count = 0;
    let cell1Indicators: any[] = [];
    let cell2Indicators: any[] = [];

    const cell1: any = {
      id: 'c1',
      chart: {
        addIndicator: (_code: string, opts: any) => {
          const h: any = {
            id: 'ind_h1_' + Date.now() + Math.random(),
            title: opts.title,
            remove: () => {
              removedCell1Count++;
              cell1Indicators = cell1Indicators.filter((x) => x !== h);
            }
          };
          cell1Indicators.push(h);
          return h;
        },
        indicators: () => cell1Indicators
      }
    };

    const cell2: any = {
      id: 'c2',
      chart: {
        addIndicator: (_code: string, opts: any) => {
          const h: any = {
            id: 'ind_h2_' + Date.now() + Math.random(),
            title: opts.title,
            remove: () => {
              removedCell2Count++;
              cell2Indicators = cell2Indicators.filter((x) => x !== h);
            }
          };
          cell2Indicators.push(h);
          return h;
        },
        indicators: () => cell2Indicators
      }
    };

    const mockWs = {
      cells: () => [cell1, cell2],
      active: cell1,
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true }
    });

    controller.attach({ nodeType: 1 } as any);

    // 1. Tambah indikator pertama
    const ok1 = await controller.addPineIndicator('plot(close)', 'Test MACD');
    assert.strictEqual(ok1, true);
    let active = controller.getActiveIndicators();
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].title, 'Test MACD');
    assert.strictEqual(removedCell1Count, 0);

    // 2. Re-compile skrip yang sama (Deduplikasi)
    const ok2 = await controller.addPineIndicator('plot(close * 2)', 'Test MACD');
    assert.strictEqual(ok2, true);
    active = controller.getActiveIndicators();
    assert.strictEqual(active.length, 1, 'Instance harus tetap 1 setelah deduplikasi');
    assert.strictEqual(removedCell1Count, 1, 'Handle lama pada cell 1 harus di-remove');
    assert.strictEqual(removedCell2Count, 1, 'Handle lama pada cell 2 harus di-remove');

    // 3. Remove indicator
    controller.removeIndicator(active[0].id);
    active = controller.getActiveIndicators();
    assert.strictEqual(active.length, 0, 'Indikator harus bersih setelah di-remove');
    assert.strictEqual(removedCell1Count, 2);
    assert.strictEqual(removedCell2Count, 2);

    controller.destroy();
  });
});
