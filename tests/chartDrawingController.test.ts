// Unit Tests untuk Deep ChartDrawingController
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartDrawingController,
  isAABBOverlap,
  extractDrawingBounds,
  checkDrawingIntersectsBounds
} from '../src/lib/services/chartDrawingController';
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

  await t.test('12. Integrasi Pembuatan Objek Gambar Geometris Kompleks (box, ellipse, arrow, fibretracement, path) dari Gesture (#105)', () => {
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

    // 1. Box Gesture Stroke
    controller.startGestureStroke(100, 100);
    controller.addGesturePoint(300, 100);
    controller.addGesturePoint(300, 250);
    controller.addGesturePoint(100, 250);
    controller.addGesturePoint(100, 100);
    const boxRes = controller.finishGestureStroke();
    assert.ok(boxRes);
    assert.equal(boxRes.tool, 'box');
    assert.equal(createdDrawings[createdDrawings.length - 1].type, 'box');

    // 2. Ellipse Gesture Stroke
    controller.setTool('gesture');
    controller.startGestureStroke(280, 150);
    for (let i = 1; i <= 36; i++) {
      const angleRad = (i / 36) * 2 * Math.PI;
      controller.addGesturePoint(
        Math.round(200 + 80 * Math.cos(angleRad)),
        Math.round(150 + 50 * Math.sin(angleRad))
      );
    }
    const ellipseRes = controller.finishGestureStroke();
    assert.ok(ellipseRes);
    assert.equal(ellipseRes.tool, 'ellipse');
    assert.equal(createdDrawings[createdDrawings.length - 1].type, 'ellipse');

    // 3. Arrow Gesture Stroke
    controller.setTool('gesture');
    controller.startGestureStroke(100, 200);
    controller.addGesturePoint(250, 200);
    controller.addGesturePoint(400, 200);
    controller.addGesturePoint(370, 170); // terminal hook
    const arrowRes = controller.finishGestureStroke();
    assert.ok(arrowRes);
    assert.equal(arrowRes.tool, 'arrow');
    assert.equal(createdDrawings[createdDrawings.length - 1].type, 'arrow');

    // 4. Fib Retracement Gesture Stroke (Z-Shape)
    controller.setTool('gesture');
    controller.startGestureStroke(100, 100);
    controller.addGesturePoint(200, 100);
    controller.addGesturePoint(300, 100);
    controller.addGesturePoint(220, 200);
    controller.addGesturePoint(150, 300);
    controller.addGesturePoint(250, 300);
    controller.addGesturePoint(350, 300);
    const fibRes = controller.finishGestureStroke({
      wicks: [{ highY: 95, lowY: 150 }, { highY: 260, lowY: 305 }],
      wickSnapRadius: 20
    });
    assert.ok(fibRes);
    assert.equal(fibRes.tool, 'fibretracement');
    assert.equal(createdDrawings[createdDrawings.length - 1].type, 'fibretracement');
    assert.equal(createdDrawings[createdDrawings.length - 1].points[0].y, 95);
    assert.equal(createdDrawings[createdDrawings.length - 1].points[1].y, 305);

    // 5. Path Gesture Stroke (Polyline > 2 belokan)
    controller.setTool('gesture');
    controller.startGestureStroke(100, 100);
    controller.addGesturePoint(200, 220);
    controller.addGesturePoint(260, 140);
    controller.addGesturePoint(360, 320);
    controller.addGesturePoint(460, 200);
    const pathRes = controller.finishGestureStroke();
    assert.ok(pathRes);
    assert.equal(pathRes.tool, 'path');
    assert.equal(createdDrawings[createdDrawings.length - 1].type, 'path');
    assert.ok(createdDrawings[createdDrawings.length - 1].points.length >= 4);
  });

  await t.test('13. Eksekusi Penghapusan Objek Gambar via Scribble Gesture dan Pemulihan Undo Stack (#106)', () => {
    const controller = new ChartDrawingController();

    let existingDrawings: any[] = [
      { id: 'd-target', type: 'trendline', points: [{ x: 100, y: 100 }, { x: 200, y: 120 }] },
      { id: 'd-other', type: 'trendline', points: [{ x: 500, y: 500 }, { x: 600, y: 600 }] }
    ];

    const calls: string[] = [];
    const mockDrawings = {
      all: () => existingDrawings,
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        existingDrawings = existingDrawings.filter((d) => !ids.includes(d.id));
      },
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        existingDrawings = existingDrawings.filter((d) => d.id !== id);
      },
      create: (spec: any) => {
        existingDrawings.push(spec);
        return spec;
      },
      undo: () => {
        calls.push('undo');
      },
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    controller.setTool('gesture');

    // Buat goresan zigzag scribble di atas d-target (x: 100..200, y: 100..125)
    controller.startGestureStroke(100, 100);
    controller.addGesturePoint(200, 105);
    controller.addGesturePoint(105, 110);
    controller.addGesturePoint(195, 115);
    controller.addGesturePoint(110, 120);
    controller.addGesturePoint(200, 125);

    const res = controller.finishGestureStroke();
    assert.ok(res);
    assert.equal(res.tool, 'scribble');

    // d-target harus dihapus karena beririsan dengan scribbleBounds
    assert.ok(calls.some((c) => c.includes('remove') && c.includes('d-target')));
    assert.equal(existingDrawings.some((d) => d.id === 'd-target'), false);
    // d-other tidak tersentuh
    assert.equal(existingDrawings.some((d) => d.id === 'd-other'), true);

    // Tekan Undo (Ctrl+Z) -> d-target harus dipulihkan
    controller.undo();
    assert.ok(calls.includes('undo'));
    assert.equal(existingDrawings.some((d) => d.id === 'd-target'), true, 'd-target harus dipulihkan setelah undo');
  });

  await t.test('14. Floating HUD & Tab Candidate Cycling serta Esc Cancel (#106)', () => {
    const controller = new ChartDrawingController();

    let createdDrawings: any[] = [];
    const deletedIds: string[] = [];

    const mockDrawings = {
      all: () => createdDrawings,
      create: (spec: any) => {
        const id = spec.id || `gen-${Date.now()}-${Math.random()}`;
        const item = { id, ...spec };
        createdDrawings.push(item);
        return item;
      },
      remove: (id: string) => {
        deletedIds.push(id);
        createdDrawings = createdDrawings.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        deletedIds.push(...ids);
        createdDrawings = createdDrawings.filter((d) => !ids.includes(d.id));
      },
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    controller.setTool('gesture');

    // Buat goresan ray/trendline yang memiliki kandidat alternatif
    controller.startGestureStroke(200, 300);
    controller.addGesturePoint(500, 250);
    controller.addGesturePoint(750, 200);
    controller.addGesturePoint(970, 180);

    const res = controller.finishGestureStroke({
      canvasWidth: 1000,
      rightMarginThreshold: 50
    });

    assert.ok(res);
    assert.equal(res.tool, 'ray');
    assert.ok(res.candidates.length > 1);

    // HUD harus aktif
    assert.equal(controller.isGestureHUDActive(), true);
    const creationState = controller.getLastGestureCreation();
    assert.ok(creationState);
    assert.equal(creationState.candidateIndex, 0);
    assert.equal(creationState.candidates[0].tool, 'ray');

    const firstDrawingId = creationState.drawingId;
    assert.ok(firstDrawingId);

    // 1. Tekan Tab untuk cycle ke kandidat berikutnya (misal trendline)
    const cycled = controller.cycleGestureCandidate();
    assert.equal(cycled, true);

    const secondCreation = controller.getLastGestureCreation();
    assert.ok(secondCreation);
    assert.equal(secondCreation.candidateIndex, 1);
    assert.notEqual(secondCreation.drawingId, firstDrawingId);
    assert.ok(deletedIds.includes(firstDrawingId!));
    assert.equal(createdDrawings.length, 1);
    assert.equal(createdDrawings[0].type, secondCreation.candidates[1].tool);

    // 2. Tekan Esc untuk membatalkan gambar yang baru dibuat
    const secondDrawingId = secondCreation.drawingId;
    const cancelled = controller.cancelGestureCreation();
    assert.equal(cancelled, true);

    // Drawing baru harus dihapus dan HUD tertutup
    assert.ok(deletedIds.includes(secondDrawingId!));
    assert.equal(createdDrawings.length, 0);
    assert.equal(controller.isGestureHUDActive(), false);
    assert.equal(controller.getLastGestureCreation(), null);
  });

  await t.test('15. finishGestureStroke memilih alat gambar yang dikenali dan mengubah kursor (#104, #106)', () => {
    const controller = new ChartDrawingController();
    const createdDrawings: any[] = [];
    const mockDrawings = {
      create: (spec: any) => {
        const id = `item-${createdDrawings.length + 1}`;
        const item = { id, ...spec };
        createdDrawings.push(item);
        return item;
      },
      all: () => createdDrawings,
      on: () => {},
      off: () => {}
    };
    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };
    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');

    // Skenario A: Mode Gesture diaktifkan (via Shift+D atau Toolbar)
    controller.setTool('gesture');
    assert.equal(controller.isGestureModeActive, true);
    assert.equal(controller.isHoldingGesture(), false);

    // Goresan pertama (horizontal line)
    controller.startGestureStroke(100, 100);
    controller.addGesturePoint(300, 102);
    const stroke1 = controller.finishGestureStroke();
    assert.ok(stroke1);
    // Tool HARUS berubah ke alat hasil pengenalan gestur ('hline'), bukan tertahan di 'gesture'
    assert.equal(controller.getSnapshot().activeTool, 'hline');
    assert.equal(createdDrawings.length, 1);

    // Saat Tab ditekan untuk siklus kandidat, tool harus ikut diperbarui
    const lastCreation = controller.getLastGestureCreation();
    if (lastCreation && lastCreation.candidates.length > 1) {
      const nextCandidate = lastCreation.candidates[1];
      controller.cycleGestureCandidate();
      assert.equal(controller.getSnapshot().activeTool, nextCandidate.tool);
    }

    // Saat Esc ditekan untuk membatalkan pembuatan objek gestur, tool kembali ke 'cursor'
    controller.cancelGestureCreation();
    assert.equal(controller.getSnapshot().activeTool, 'cursor');

    // Skenario B: Transient Hold Mode (Tahan tombol shortcut)
    controller.setTool('cursor');
    assert.equal(controller.getSnapshot().activeTool, 'cursor');

    controller.setTransientGestureHold(true);
    assert.equal(controller.isHoldingGesture(), true);
    assert.equal(controller.isGestureModeActive, false);
    assert.equal(controller.getSnapshot().activeTool, 'gesture');

    // Tarik goresan saat menahan tombol
    controller.startGestureStroke(50, 50);
    controller.addGesturePoint(250, 50);
    const strokeHold = controller.finishGestureStroke();
    assert.ok(strokeHold);

    // Setelah goresan selesai, alat yang dikenali langsung terpilih ('hline')
    assert.equal(controller.getSnapshot().activeTool, 'hline');
    assert.equal(controller.isHoldingGesture(), false);
  });

  await t.test('16. Helper isAABBOverlap dan extractDrawingBounds mengeliminasi duplikasi kode', () => {
    // 1. extractDrawingBounds dari berbagai struktur
    const bBounds = extractDrawingBounds({ bounds: { minX: 10, maxX: 50, minY: 20, maxY: 60 } });
    assert.deepEqual(bBounds, { minX: 10, maxX: 50, minY: 20, maxY: 60 });

    const bPoints = extractDrawingBounds({ points: [{ x: 5, y: 15 }, { x: 25, y: 35 }] });
    assert.deepEqual(bPoints, { minX: 5, maxX: 25, minY: 15, maxY: 35 });

    const bAnchors = extractDrawingBounds({ anchors: [{ x: 100, y: 200 }, { x: 150, y: 250 }] });
    assert.deepEqual(bAnchors, { minX: 100, maxX: 150, minY: 200, maxY: 250 });

    const bCoords = extractDrawingBounds({ x1: 10, y1: 20, x2: 30, y2: 40 });
    assert.deepEqual(bCoords, { minX: 10, maxX: 30, minY: 20, maxY: 40 });

    const bBox = extractDrawingBounds({ x: 50, y: 60, width: 40, height: 30 });
    assert.deepEqual(bBox, { minX: 50, maxX: 90, minY: 60, maxY: 90 });

    assert.equal(extractDrawingBounds(null), null);

    // 2. isAABBOverlap deteksi overlap vs disjoint
    const boxA = { minX: 10, maxX: 50, minY: 10, maxY: 50 };
    const boxOverlap = { minX: 40, maxX: 80, minY: 40, maxY: 80 };
    const boxDisjoint = { minX: 100, maxX: 120, minY: 100, maxY: 120 };

    assert.equal(isAABBOverlap(boxA, boxOverlap), true);
    assert.equal(isAABBOverlap(boxA, boxDisjoint), false);
  });
});


