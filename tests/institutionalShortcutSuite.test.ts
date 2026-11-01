import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { rightDockService } from '../src/lib/services/rightDockService';
import { getAdaptiveTickSize } from '../src/lib/services/priceSnapService';

describe('Institutional Shortcut & Productivity Suite Seam Tests (#137)', () => {
  test('1. Command Dispatcher memuat seluruh pintasan institusional baru dengan allowInInput: false', () => {
    const dispatcher = createDefaultCommandDispatcher();
    const commands = dispatcher.getCommands();

    const expectedShortcuts = [
      { id: 'toggle-objects-tree', keys: ['Alt', 'O'] },
      { id: 'duplicate-selected-drawing', keys: ['Ctrl', 'D'] },
      { id: 'toggle-hide-drawings', keys: ['Alt', 'K'] },
      { id: 'toggle-lock-drawings', keys: ['Alt', 'L'] },
      { id: 'clear-all-drawings', keys: ['Ctrl', 'Del'] },
      { id: 'invert-price-scale', keys: ['Alt', 'I'] },
      { id: 'draw-delete', keys: ['Del', 'Backspace'] },
    ];

    for (const expected of expectedShortcuts) {
      const found = commands.find((c) => c.id === expected.id);
      assert.ok(found, `Perintah ${expected.id} harus terdaftar di command dispatcher`);
      assert.deepEqual(found.keys, expected.keys, `Tombol untuk ${expected.id} harus sesuai`);
      assert.equal(found.allowInInput, false, `${expected.id} harus ditekan/disupresi saat fokus pada input`);
    }
  });

  test('2. Alt+O: Smart Toggle Object Tree & perpindahan mode terminal dari Pine Script', () => {
    const dispatcher = createDefaultCommandDispatcher();
    let workspaceMode = 'pine';

    // Handler yang sama seperti di +page.svelte
    dispatcher.bindHandler('toggle-objects-tree', () => {
      if (workspaceMode === 'pine' || (workspaceMode as string) === 'pinescript') {
        workspaceMode = 'terminal';
      }
      rightDockService.toggleTab('objects');
    });

    // 1. Jalankan Alt+O
    const dispatched = dispatcher.dispatch({
      key: 'o',
      code: 'KeyO',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(dispatched, true);
    assert.equal(workspaceMode, 'terminal', 'Alt+O harus mengembalikan workspace ke mode terminal');
    assert.equal(rightDockService.getSnapshot().activeTab, 'objects', 'Tab harus terbuka ke objects');
    assert.equal(rightDockService.getSnapshot().isOpen, true);

    // 2. Jalankan Alt+O lagi: smart toggle menutup dock
    dispatcher.dispatch({
      key: 'o',
      code: 'KeyO',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(rightDockService.getSnapshot().isOpen, false, 'Alt+O kedua kali harus menutup dock drawer');
  });

  test('3. Ctrl+D: Duplikasi objek gambar terpilih dengan pergeseran spasial lembut dan seleksi otomatis', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [
      {
        id: 'trend-1',
        type: 'trendline',
        paneId: 'price',
        anchors: [
          { time: 1000, price: 50000 },
          { time: 2000, price: 51000 }
        ],
        style: { color: '#2962ff', width: 2 }
      }
    ];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || 'clone_1' };
        drawingsList.push(item);
        return item;
      },
      select: (id: string) => {},
      deselect: () => {},
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      undo: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    controller.bindToDispatcher(dispatcher);

    // Kasus A: Tidak ada seleksi -> no-op
    assert.equal(controller.getSelectedDrawingId(), null);
    const noopResult = controller.duplicateSelectedDrawing();
    assert.equal(noopResult, null);
    assert.equal(drawingsList.length, 1);

    // Kasus B: Seleksi trend-1 dan tekan Ctrl+D
    controller.selectDrawing('trend-1');
    assert.equal(controller.getSelectedDrawingId(), 'trend-1');

    dispatcher.dispatch({
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(drawingsList.length, 2, 'Jumlah gambar harus bertambah menjadi 2');
    const clone = drawingsList[1];
    assert.notEqual(clone.id, 'trend-1', 'ID klon harus unik dan berbeda dari sumber');
    assert.equal(controller.getSelectedDrawingId(), clone.id, 'Klon baru harus langsung menjadi seleksi aktif');

    // Periksa bahwa koordinat harga bergeser sedikit (5 tick = 0.05 pada harga 50k)
    const expectedPriceOffset = getAdaptiveTickSize(50000) * 5;
    assert.equal(clone.anchors[0].price, 50000 - expectedPriceOffset, 'Harga harus memiliki pergeseran spasial lembut');
    assert.equal(clone.style.color, '#2962ff', 'Gaya visual harus disalin utuh');

    // Undo harus menghapus klon
    assert.equal(controller.getSnapshot().canUndo, true);
    controller.undo();
    assert.equal(drawingsList.length, 1, 'Undo harus membatalkan duplikasi');
  });

  test('4. Alt+K (Toggle Hide) dan Alt+L (Toggle Lock) memutasi status controller', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [{ id: 'd-1', visible: true, locked: false }];
    const showCalls: Array<{ id: string; visible: boolean }> = [];
    const lockCalls: Array<{ id: string; locked: boolean }> = [];

    const mockDrawings = {
      all: () => drawingsList,
      show: (id: string, visible: boolean) => showCalls.push({ id, visible }),
      lock: (id: string, locked: boolean) => lockCalls.push({ id, locked }),
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    controller.bindToDispatcher(dispatcher);

    // 1. Alt+K -> Toggle Hide
    dispatcher.dispatch({
      key: 'k',
      code: 'KeyK',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(controller.getSnapshot().isHidden, true);
    assert.ok(showCalls.some((c) => c.id === 'd-1' && c.visible === false));

    // 2. Alt+L -> Toggle Lock
    dispatcher.dispatch({
      key: 'l',
      code: 'KeyL',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(controller.getSnapshot().isLocked, true);
    assert.ok(lockCalls.some((c) => c.id === 'd-1' && c.locked === true));
  });

  test('5. Alt+I: Pintasan Invert Price Scale membalikkan orientasi sumbu skala harga', () => {
    const dispatcher = createDefaultCommandDispatcher();
    let priceScaleState = { mode: 'price', log: false, invert: false };
    let logEvent = '';

    dispatcher.bindHandler('invert-price-scale', () => {
      priceScaleState.invert = !priceScaleState.invert;
      logEvent = `Invert: ${priceScaleState.invert}`;
    });

    dispatcher.dispatch({
      key: 'i',
      code: 'KeyI',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(priceScaleState.invert, true);
    assert.equal(logEvent, 'Invert: true');

    // Balikkan kembali
    dispatcher.dispatch({
      key: 'i',
      code: 'KeyI',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(priceScaleState.invert, false);
  });
});
