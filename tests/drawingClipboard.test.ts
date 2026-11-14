import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';

describe('Ticket #206: Drawing Object Clipboard & Direct Settings Interaction Suite', () => {
  test('1. Command Dispatcher memuat pintasan copy-selected-drawing (Ctrl+C) dan paste-drawing (Ctrl+V) dengan allowInInput: false', () => {
    const dispatcher = createDefaultCommandDispatcher();
    const commands = dispatcher.getCommands();

    const copyCmd = commands.find((c) => c.id === 'copy-selected-drawing');
    assert.ok(copyCmd, 'Perintah copy-selected-drawing harus terdaftar di dispatcher');
    assert.equal(copyCmd.category, 'Alat Gambar (Drawing Tools)');
    assert.deepEqual(copyCmd.keys, ['Ctrl', 'C']);
    assert.equal(copyCmd.allowInInput, false, 'copy-selected-drawing harus disupresi saat input menerima fokus');
    assert.deepEqual(copyCmd.match, { ctrlOrMeta: true, alt: false, shift: false, key: 'c', code: 'KeyC' });

    const pasteCmd = commands.find((c) => c.id === 'paste-drawing');
    assert.ok(pasteCmd, 'Perintah paste-drawing harus terdaftar di dispatcher');
    assert.equal(pasteCmd.category, 'Alat Gambar (Drawing Tools)');
    assert.deepEqual(pasteCmd.keys, ['Ctrl', 'V']);
    assert.equal(pasteCmd.allowInInput, false, 'paste-drawing harus disupresi saat input menerima fokus');
    assert.deepEqual(pasteCmd.match, { ctrlOrMeta: true, alt: false, shift: false, key: 'v', code: 'KeyV' });

    const dupCmd = commands.find((c) => c.id === 'duplicate-selected-drawing');
    assert.ok(dupCmd, 'Perintah duplicate-selected-drawing harus terdaftar di dispatcher');
    assert.deepEqual(dupCmd.keys, ['Ctrl', 'D']);
    assert.equal(dupCmd.allowInInput, false);
    assert.deepEqual(dupCmd.match, { ctrlOrMeta: true, alt: false, shift: false, key: 'd', code: 'KeyD' });
  });

  test('2. Input suppression: Ctrl+C, Ctrl+V, dan Ctrl+D diabaikan saat elemen input atau textarea aktif', () => {
    const dispatcher = createDefaultCommandDispatcher();
    let copyTriggered = false;
    let pasteTriggered = false;
    let dupTriggered = false;

    dispatcher.bindHandler('copy-selected-drawing', () => { copyTriggered = true; });
    dispatcher.bindHandler('paste-drawing', () => { pasteTriggered = true; });
    dispatcher.bindHandler('duplicate-selected-drawing', () => { dupTriggered = true; });

    const inputTarget = { tagName: 'INPUT', isContentEditable: false, closest: () => null };

    const copySuppressed = dispatcher.dispatch({
      key: 'c',
      code: 'KeyC',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: inputTarget,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(copySuppressed, false, 'Ctrl+C dalam input tidak boleh di-intercept oleh dispatcher');
    assert.equal(copyTriggered, false);

    const pasteSuppressed = dispatcher.dispatch({
      key: 'v',
      code: 'KeyV',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: inputTarget,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(pasteSuppressed, false, 'Ctrl+V dalam input tidak boleh di-intercept oleh dispatcher');
    assert.equal(pasteTriggered, false);

    const dupSuppressed = dispatcher.dispatch({
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: inputTarget,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(dupSuppressed, false, 'Ctrl+D dalam input tidak boleh di-intercept oleh dispatcher');
    assert.equal(dupTriggered, false);
  });

  test('3. Ctrl+C (Copy) menyalin data serialisasi drawing ke internal clipboard dan memanggil chart.drawings.copyToClipboard', () => {
    const controller = new ChartDrawingController();
    const mockDrawingItem = {
      id: 'trend-123',
      type: 'trendline',
      paneId: 'price',
      anchors: [
        { time: 1000000, price: 65000 },
        { time: 1060000, price: 66000 }
      ],
      style: { color: '#00ffcc', width: 2, lineStyle: 0 }
    };

    let copyToClipboardArg: string[] | null = null;
    const mockDrawings = {
      all: () => [mockDrawingItem],
      copyToClipboard: (ids: string[]) => {
        copyToClipboardArg = ids;
      },
      select: () => {},
      deselect: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    controller.bindToDispatcher(dispatcher);

    // Saat tidak ada objek yang dipilih -> copySelectedDrawing mengembalikan false
    assert.equal(controller.copySelectedDrawing(), false);
    assert.equal(controller.getDrawingClipboard(), null);

    // Pilih objek trend-123
    controller.selectDrawing('trend-123');
    assert.equal(controller.getSelectedDrawingId(), 'trend-123');

    // Eksekusi Ctrl+C via dispatcher pada kanvas
    const dispatched = dispatcher.dispatch({
      key: 'c',
      code: 'KeyC',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(dispatched, true, 'Ctrl+C pada kanvas harus tertangani');
    assert.deepEqual(copyToClipboardArg, ['trend-123'], 'chart.drawings.copyToClipboard harus dipanggil dengan ID drawing');
    const clipboardData = controller.getDrawingClipboard();
    assert.ok(clipboardData, 'Internal clipboard harus menyimpan drawing yang disalin');
    assert.equal(clipboardData.id, 'trend-123');
    assert.equal(clipboardData.style.color, '#00ffcc');
  });

  test('4. Ctrl+V (Paste) menempelkan drawing dengan offset spasial dan memanggil chart.drawings.paste', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [
      {
        id: 'fib-1',
        type: 'fibonacci',
        paneId: 'price',
        anchors: [
          { time: 1000000, price: 50000 },
          { time: 1060000, price: 52000 }
        ],
        style: { color: '#ffaa00', width: 1 }
      }
    ];

    let nativePasteCalled = false;
    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || 'clone_fib' };
        drawingsList.push(item);
        return item;
      },
      copyToClipboard: () => {},
      paste: () => {
        nativePasteCalled = true;
      },
      select: () => {},
      deselect: () => {},
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      }
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    controller.bindToDispatcher(dispatcher);

    // Salin fib-1
    controller.selectDrawing('fib-1');
    controller.copySelectedDrawing();

    // Tempelkan melalui shortcut Ctrl+V via dispatcher
    const dispatched = dispatcher.dispatch({
      key: 'v',
      code: 'KeyV',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    assert.equal(dispatched, true, 'Ctrl+V pada kanvas harus tertangani');
    assert.equal(nativePasteCalled, true, 'chart.drawings.paste harus dipanggil');
    assert.equal(drawingsList.length, 2, 'Daftar drawing harus bertambah 1');

    const pasted = drawingsList[1];
    assert.notEqual(pasted.id, 'fib-1', 'ID hasil tempel harus unik');
    assert.equal(controller.getSelectedDrawingId(), pasted.id, 'Objek baru harus otomatis terpilih');
    assert.equal(pasted.style.color, '#ffaa00', 'Atribut style harus dipertahankan');

    // Verifikasi offset spasial
    assert.notEqual(pasted.anchors[0].price, 50000, 'Harga anchor harus bergeser dengan offset');
    assert.notEqual(pasted.anchors[0].time, 1000000, 'Waktu anchor harus bergeser dengan offset');

    // Pembatalan (Undo) harus menghapus drawing hasil paste
    controller.undo();
    assert.equal(drawingsList.length, 1, 'Undo harus menghapus drawing hasil paste');
  });

  test('5. Penempelan berulang (consecutive pastes) menambah akumulasi offset spasial', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [
      {
        id: 'box-1',
        type: 'box',
        paneId: 'price',
        anchors: [
          { time: 1000, price: 100 },
          { time: 2000, price: 120 }
        ],
        style: { color: '#ffffff' }
      }
    ];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        drawingsList.push(spec);
        return spec;
      },
      select: () => {},
      deselect: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    controller.selectDrawing('box-1');
    controller.copySelectedDrawing();

    // Paste ke-1
    const id1 = controller.pasteDrawing();
    assert.ok(id1);
    const paste1 = drawingsList.find((d) => d.id === id1);

    // Paste ke-2
    const id2 = controller.pasteDrawing();
    assert.ok(id2);
    const paste2 = drawingsList.find((d) => d.id === id2);

    assert.notEqual(paste1.anchors[0].price, paste2.anchors[0].price, 'Paste ke-2 harus bergeser lebih jauh dibanding Paste ke-1');
    assert.notEqual(paste1.anchors[0].time, paste2.anchors[0].time, 'Waktu paste ke-2 harus bergeser lebih jauh');
  });

  test('6. Ctrl+D (Duplicate) memanggil chart.drawings.duplicate dan menduplikasi drawing terpilih', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [
      {
        id: 'ray-1',
        type: 'ray',
        paneId: 'price',
        anchors: [
          { time: 5000, price: 300 },
          { time: 6000, price: 310 }
        ],
        style: { color: '#0088ff' }
      }
    ];

    let nativeDuplicateCalledWith: string[] | null = null;
    const mockDrawings = {
      all: () => drawingsList,
      duplicate: (ids: string[]) => {
        nativeDuplicateCalledWith = ids;
      },
      create: (spec: any) => {
        drawingsList.push(spec);
        return spec;
      },
      select: () => {},
      deselect: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    controller.bindToDispatcher(dispatcher);

    controller.selectDrawing('ray-1');

    const dispatched = dispatcher.dispatch({
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

    assert.equal(dispatched, true);
    assert.deepEqual(nativeDuplicateCalledWith, ['ray-1'], 'chart.drawings.duplicate harus dipanggil dengan ID drawing');
    assert.equal(drawingsList.length, 2, 'Jumlah drawing harus menjadi 2');
  });

  test('7. Double-click drawing memanggil chart.drawings.openSettings(drawingId)', () => {
    const controller = new ChartDrawingController();
    let openedSettingsId: string | null = null;

    const mockDrawings = {
      all: () => [{ id: 'trend-99' }],
      openSettings: (id: string) => {
        openedSettingsId = id;
      },
      select: () => {},
      deselect: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');

    // 1. Panggil langsung openDrawingSettings dengan id eksplisit
    const openedExplicit = controller.openDrawingSettings('trend-99');
    assert.equal(openedExplicit, true);
    assert.equal(openedSettingsId, 'trend-99');

    // 2. Reset dan uji handleDrawingDblClick dengan seleksi aktif
    openedSettingsId = null;
    controller.selectDrawing('trend-99');
    const dblClickHandled = controller.handleDrawingDblClick();
    assert.equal(dblClickHandled, true);
    assert.equal(openedSettingsId, 'trend-99', 'Double click harus memanggil chart.drawings.openSettings');

    // 3. Tanpa id dan tanpa seleksi -> mengembalikan false
    controller.selectDrawing(null as any);
    assert.equal(controller.openDrawingSettings(), false);
  });
});
