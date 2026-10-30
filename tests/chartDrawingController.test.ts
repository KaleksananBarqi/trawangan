// Unit Tests untuk Deep ChartDrawingController
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { CommandDispatcher } from '../src/lib/services/commandDispatcher';

test('ChartDrawingController Deep Module Suite', async (t) => {
  await t.test('1. Nilai default state controller valid', () => {
    const controller = new ChartDrawingController();
    const state = controller.getSnapshot();

    assert.equal(state.activeTool, null);
    assert.equal(state.snapMode, 'off');
    assert.equal(state.stayMode, false);
    assert.equal(state.isLocked, false);
    assert.equal(state.isHidden, false);
    assert.deepEqual(state.activeDrawings, []);
  });

  await t.test('2. Transisi mode alat dan toggle state bereaksi secara deterministik', () => {
    const controller = new ChartDrawingController();
    let updatesCount = 0;
    const unsub = controller.subscribe(() => {
      updatesCount++;
    });

    // Pilih tool
    controller.setTool('trendline');
    assert.equal(controller.getSnapshot().activeTool, 'trendline');

    // Cycle snap mode (off -> weak -> strong -> off)
    assert.equal(controller.cycleSnapMode(), 'weak');
    assert.equal(controller.cycleSnapMode(), 'strong');
    assert.equal(controller.cycleSnapMode(), 'off');

    // Toggle stay mode
    assert.equal(controller.toggleStayMode(), true);
    assert.equal(controller.getSnapshot().stayMode, true);
    assert.equal(controller.toggleStayMode(), false);

    // Toggle lock
    assert.equal(controller.toggleLock(), true);
    assert.equal(controller.getSnapshot().isLocked, true);
    assert.equal(controller.toggleLock(), false);

    // Toggle hide
    assert.equal(controller.toggleHide(), true);
    assert.equal(controller.getSnapshot().isHidden, true);
    assert.equal(controller.toggleHide(), false);

    assert.ok(updatesCount > 5);
    unsub();
  });

  await t.test('3. Mock Vela Workspace & Chart adapter mendelegasikan aksi gambar dengan benar', async () => {
    const controller = new ChartDrawingController();

    const calls: string[] = [];
    const mockDrawings = {
      setMode: (mode: string | null) => calls.push(`setMode:${mode}`),
      setTool: (tool: string | null) => calls.push(`setTool:${tool}`),
      setSnapMode: (mode: string) => calls.push(`setSnapMode:${mode}`),
      setStayMode: (stay: boolean) => calls.push(`setStayMode:${stay}`),
      undo: () => calls.push('undo'),
      redo: () => calls.push('redo'),
      all: () => [{ id: 'd1', type: 'trendline' }],
      removeMany: (ids: string[]) => calls.push(`removeMany:${ids.join(',')}`),
      lock: (id: string, lock: boolean) => calls.push(`lock:${id}:${lock}`),
      show: (id: string, show: boolean) => calls.push(`show:${id}:${show}`),
      fromJSON: (doc: any) => calls.push(`fromJSON:${JSON.stringify(doc)}`),
      toJSON: () => ({ version: 1, items: [] })
    };

    const mockChart = {
      drawings: mockDrawings,
      on: (_ev: string, _fn: any) => {}
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [mockWorkspace.active]
    };

    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'BTCUSDT',
      () => '15m'
    );

    controller.setTool('measure');
    assert.ok(calls.includes('setMode:measure'));

    controller.setTool('trendline');
    assert.ok(calls.includes('setTool:trendline'));

    controller.setTool('cursor');
    assert.ok(calls.includes('setTool:null'));

    controller.setSnapMode('weak');
    assert.ok(calls.includes('setSnapMode:weak'));

    controller.setStayMode(true);
    assert.ok(calls.includes('setStayMode:true'));

    controller.undo();
    assert.ok(calls.includes('undo'));

    controller.redo();
    assert.ok(calls.includes('redo'));

    controller.setLock(true);
    assert.ok(calls.includes('lock:d1:true'));

    controller.setHide(true);
    assert.ok(calls.includes('show:d1:false'));
  });

  await t.test('4. Integrasi CommandDispatcher mengarahkan shortcut ke aksi controller', () => {
    const controller = new ChartDrawingController();
    const dispatcher = new CommandDispatcher();

    // Daftarkan commands standar
    dispatcher.register({
      id: 'draw-hline',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'H'],
      desc: 'Horizontal Line',
      match: { alt: true, key: 'h' }
    });
    dispatcher.register({
      id: 'draw-fibonacci',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'F'],
      desc: 'Fib Retracement',
      match: { alt: true, key: 'f' }
    });
    dispatcher.register({
      id: 'draw-measure',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'M'],
      desc: 'Measure tool',
      match: { alt: true, key: 'm' }
    });
    dispatcher.register({
      id: 'cancel-action',
      category: 'Navigasi & Simbol',
      keys: ['Esc'],
      desc: 'Cancel tool',
      match: { key: 'escape' }
    });

    const unbind = controller.bindToDispatcher(dispatcher);

    // Tekan Alt+H
    const hlineEv = { key: 'h', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyH' } as any;
    dispatcher.dispatch(hlineEv);
    assert.equal(controller.getSnapshot().activeTool, 'hline');

    // Tekan Alt+F
    const fibEv = { key: 'f', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyF' } as any;
    dispatcher.dispatch(fibEv);
    assert.equal(controller.getSnapshot().activeTool, 'fibretracement');

    // Tekan Alt+M
    const measureEv = { key: 'm', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyM' } as any;
    dispatcher.dispatch(measureEv);
    assert.equal(controller.getSnapshot().activeTool, 'measure');

    // Tekan Esc untuk membatalkan
    const escEv = { key: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, code: 'Escape' } as any;
    dispatcher.dispatch(escEv);
    assert.equal(controller.getSnapshot().activeTool, null);

    unbind();
  });

  await t.test('5. Hand-Pull Mode mengisolasi canvas pan dan menonaktifkan claim gambar pada seluruh sel', () => {
    const controller = new ChartDrawingController();

    const mockNative1 = { input: { drawings: true } };
    const mockNative2 = { input: { drawings: true } };

    const mockCell1 = { chart: { renderer: { renderer: mockNative1 }, drawings: { setMode: () => {}, setTool: () => {} } } };
    const mockCell2 = { chart: { renderer: { renderer: mockNative2 }, drawings: { setMode: () => {}, setTool: () => {} } } };

    const mockWorkspace = {
      active: mockCell1,
      cells: () => [mockCell1, mockCell2]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');

    // Aktifkan handpull
    controller.setTool('handpull');
    assert.equal(controller.isHandpullMode(), true);
    assert.equal(controller.getSnapshot().activeTool, 'handpull');
    assert.equal(mockNative1.input.drawings, false, 'Cell 1 drawings claim harus dimatikan saat handpull');
    assert.equal(mockNative2.input.drawings, false, 'Cell 2 drawings claim harus dimatikan saat handpull');

    // Kembalikan ke trendline
    controller.setTool('trendline');
    assert.equal(controller.isHandpullMode(), false);
    assert.equal(controller.getSnapshot().activeTool, 'trendline');
    assert.equal(mockNative1.input.drawings, true, 'Cell 1 drawings claim harus dipulihkan');
    assert.equal(mockNative2.input.drawings, true, 'Cell 2 drawings claim harus dipulihkan');
  });

  await t.test('6. Toggle Hand-Pull & Shortcut H beralih secara deterministik', () => {
    const controller = new ChartDrawingController();
    const dispatcher = new CommandDispatcher();

    dispatcher.register({
      id: 'draw-handpull',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['H'],
      desc: 'Hand-Pull Mode',
      match: {
        customMatch: (e) => (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.altKey && !e.metaKey
      }
    });

    const unbind = controller.bindToDispatcher(dispatcher);

    // Default cursor/null
    assert.equal(controller.getSnapshot().activeTool, null);

    // Tekan H pertama kali -> handpull
    const hKeyEv = { key: 'h', code: 'KeyH', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } as any;
    dispatcher.dispatch(hKeyEv);
    assert.equal(controller.getSnapshot().activeTool, 'handpull');

    // Tekan H kedua kali -> kembali ke cursor
    dispatcher.dispatch(hKeyEv);
    assert.equal(controller.getSnapshot().activeTool, 'cursor');

    unbind();
  });

  await t.test('7. Spacebar Hold Temporary Hand-Pull menyimpan dan memulihkan tool sebelumnya', () => {
    const controller = new ChartDrawingController();

    // User sedang memilih alat gambar trendline
    controller.setTool('trendline');
    assert.equal(controller.getSnapshot().activeTool, 'trendline');

    // User menekan dan menahan Spacebar (keydown)
    controller.setSpaceTemporaryHandpull(true);
    assert.equal(controller.getSnapshot().activeTool, 'handpull');
    assert.equal(controller.isHandpullMode(), true);

    // User melepaskan Spacebar (keyup) -> harus kembali ke trendline
    controller.setSpaceTemporaryHandpull(false);
    assert.equal(controller.getSnapshot().activeTool, 'trendline');
    assert.equal(controller.isHandpullMode(), false);
  });

  await t.test('8. Interactive Single-Item Eraser Mode (#46) mendelegasikan setMode("eraser") dan mengelola siklus hidupnya', () => {
    const controller = new ChartDrawingController();

    const modeCalls: Array<string | null> = [];
    const mockDrawings = {
      setMode: (mode: string | null) => modeCalls.push(mode),
      setTool: (_tool: string | null) => {},
      on: () => {},
      all: () => []
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');

    // Aktifkan Eraser mode
    controller.setTool('eraser');
    assert.equal(controller.isEraserMode(), true);
    assert.equal(controller.getSnapshot().activeTool, 'eraser');
    assert.equal(modeCalls[modeCalls.length - 1], 'eraser', 'Harus memanggil setMode("eraser") pada engine Vela');

    // Toggle Eraser kembali ke cursor
    controller.toggleEraser();
    assert.equal(controller.isEraserMode(), false);
    assert.equal(controller.getSnapshot().activeTool, 'cursor');
    assert.equal(modeCalls[modeCalls.length - 1], null, 'Harus memanggil setMode(null) saat keluar dari eraser');

    // Toggle Eraser aktif kembali
    controller.toggleEraser();
    assert.equal(controller.isEraserMode(), true);
    assert.equal(modeCalls[modeCalls.length - 1], 'eraser');

    // Ganti ke tool lain (misal hline) otomatis membersihkan eraser mode
    controller.setTool('hline');
    assert.equal(controller.isEraserMode(), false);
    assert.equal(modeCalls[modeCalls.length - 1], null);
  });

  await t.test('9. Toggle Shortcut Shift+D dan Mode Gesture (#104)', () => {
    const controller = new ChartDrawingController();
    const dispatcher = new CommandDispatcher();

    dispatcher.register({
      id: 'toggle-gesture-mode',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Shift', 'D'],
      desc: 'Gesture Draw Mode',
      match: {
        shift: true,
        ctrlOrMeta: false,
        alt: false,
        key: ['d', 'D'],
        code: 'KeyD'
      }
    });

    const unbind = controller.bindToDispatcher(dispatcher);

    assert.equal(controller.isGestureMode(), false);
    assert.equal(controller.getSnapshot().activeTool, null);

    // Tekan Shift+D pertama kali -> gesture mode aktif
    const shiftDEv = {
      key: 'D',
      code: 'KeyD',
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false
    } as any;

    dispatcher.dispatch(shiftDEv);
    assert.equal(controller.isGestureMode(), true);
    assert.equal(controller.getSnapshot().activeTool, 'gesture');

    // Tekan Shift+D kedua kali -> toggle kembali ke cursor
    dispatcher.dispatch(shiftDEv);
    assert.equal(controller.isGestureMode(), false);
    assert.equal(controller.getSnapshot().activeTool, 'cursor');

    unbind();
  });

  await t.test('10. Transient Hold tombol pemicu gestur (~ / Backquote) (#104)', () => {
    const controller = new ChartDrawingController();

    // User sedang memilih alat trendline
    controller.setTool('trendline');
    assert.equal(controller.getSnapshot().activeTool, 'trendline');
    assert.equal(controller.isGestureMode(), false);

    // User menekan dan menahan tombol pemicu (~ / Backquote)
    controller.setTransientGestureHold(true);
    assert.equal(controller.isGestureMode(), true);
    assert.equal(controller.isHoldingGesture(), true);
    assert.equal(controller.getSnapshot().activeTool, 'gesture');

    // User melepas tombol pemicu gestur -> tool dipulihkan ke trendline
    controller.setTransientGestureHold(false);
    assert.equal(controller.isGestureMode(), false);
    assert.equal(controller.isHoldingGesture(), false);
    assert.equal(controller.getSnapshot().activeTool, 'trendline');
  });

  await t.test('11. Siklus Live Stroke Buffer & Pembuatan Drawing Otomatis saat Gesture Selesai (#104)', () => {
    const controller = new ChartDrawingController();

    const createdDrawings: any[] = [];
    const mockDrawings = {
      create: (spec: any) => createdDrawings.push(spec),
      all: () => createdDrawings,
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    controller.setTool('gesture');

    // Rekam deretan koordinat horizontal stroke
    controller.startGestureStroke(100, 200);
    controller.addGesturePoint(200, 201);
    controller.addGesturePoint(300, 200);
    controller.addGesturePoint(400, 202);

    assert.equal(controller.getLiveGestureStroke().length, 4);

    // Selesaikan stroke
    const result = controller.finishGestureStroke();
    assert.ok(result);
    assert.equal(result.tool, 'hline');
    assert.equal(createdDrawings.length, 1);
    assert.equal(createdDrawings[0].type, 'hline');
    assert.equal(controller.getLiveGestureStroke().length, 0);
  });
});


