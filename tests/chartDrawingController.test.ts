// Unit Tests untuk Deep ChartDrawingController
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartDrawingController,
  isAABBOverlap,
  extractDrawingBounds,
  checkDrawingIntersectsBounds
} from '../src/lib/services/chartDrawingController';
import { CommandDispatcher, createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';

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

  await t.test('15. finishGestureStroke kembali ke kursor mouse biasa dan menyeleksi objek gambar yang baru dibuat (#104, #106)', () => {
    const controller = new ChartDrawingController();
    const createdDrawings: any[] = [];
    let selectedId: string | null = null;
    const mockDrawings = {
      create: (spec: any) => {
        const id = `item-${createdDrawings.length + 1}`;
        const item = { id, ...spec };
        createdDrawings.push(item);
        return item;
      },
      all: () => createdDrawings,
      select: (id: any) => { selectedId = id; },
      deselect: () => { selectedId = null; },
      remove: (id: any) => {
        const idx = createdDrawings.findIndex(d => d.id === id);
        if (idx !== -1) createdDrawings.splice(idx, 1);
      },
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
    assert.equal(createdDrawings.length, 1);

    // Tool HARUS kembali ke 'cursor' (mouse biasa) agar user dapat langsung mengatur gambar tersebut (drag, resize, handles)
    assert.equal(controller.getSnapshot().activeTool, 'cursor');
    // Objek yang baru dibuat HARUS terseleksi
    assert.equal(controller.getSelectedDrawingId(), createdDrawings[0].id);
    assert.equal(selectedId, createdDrawings[0].id);

    // Saat Tab ditekan untuk siklus kandidat, tool tetap 'cursor' dan objek baru tetap terseleksi
    const lastCreation = controller.getLastGestureCreation();
    if (lastCreation && lastCreation.candidates.length > 1) {
      controller.cycleGestureCandidate();
      assert.equal(controller.getSnapshot().activeTool, 'cursor');
      const updatedCreation = controller.getLastGestureCreation();
      assert.equal(controller.getSelectedDrawingId(), updatedCreation?.drawingId);
    }

    // Saat Esc ditekan untuk membatalkan pembuatan objek gestur, tool tetap 'cursor' dan seleksi dibatalkan
    controller.cancelGestureCreation();
    assert.equal(controller.getSnapshot().activeTool, 'cursor');
    assert.equal(controller.getSelectedDrawingId(), null);

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

    // Setelah goresan selesai, kursor kembali ke mouse biasa ('cursor') dan objek terseleksi
    assert.equal(controller.getSnapshot().activeTool, 'cursor');
    assert.equal(controller.isHoldingGesture(), false);
    assert.ok(controller.getSelectedDrawingId());
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

  await t.test('17. Tiket #138: Deletion shortcut (draw-delete) menghapus objek yang sedang dipilih dan membersihkan seleksi', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [
      { id: 'd-1', type: 'trendline' },
      { id: 'd-2', type: 'box' }
    ];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      select: (id: string) => calls.push(`select:${id}`),
      deselect: () => calls.push('deselect'),
      undo: () => calls.push('undo'),
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    const unbind = controller.bindToDispatcher(dispatcher);

    // Seleksi drawing d-1
    controller.selectDrawing('d-1');
    assert.equal(controller.getSelectedDrawingId(), 'd-1');

    // Tekan tombol Delete
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    // Objek d-1 harus terhapus, seleksi menjadi null, d-2 tetap ada, undo tidak boleh dipanggil
    assert.ok(calls.includes('removeMany:d-1') || calls.includes('remove:d-1'), 'd-1 harus dihapus');
    assert.equal(controller.getSelectedDrawingId(), null, 'Seleksi harus dibersihkan setelah dihapus');
    assert.equal(drawingsList.length, 1, 'Hanya tersisa 1 drawing');
    assert.equal(drawingsList[0].id, 'd-2', 'd-2 harus tetap ada');
    assert.ok(!calls.includes('undo'), 'Global undo tidak boleh dipanggil saat menghapus drawing');

    // Seleksi drawing d-2 dan tekan tombol Backspace
    controller.selectDrawing('d-2');
    assert.equal(controller.getSelectedDrawingId(), 'd-2');

    dispatcher.dispatch({
      key: 'Backspace',
      code: 'Backspace',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    assert.ok(calls.includes('removeMany:d-2') || calls.includes('remove:d-2'), 'd-2 harus dihapus');
    assert.equal(controller.getSelectedDrawingId(), null);
    assert.equal(drawingsList.length, 0);
    assert.ok(!calls.includes('undo'), 'Global undo tidak boleh dipanggil saat Backspace');

    unbind();
  });

  await t.test('18. Tiket #138: Deletion shortcut (draw-delete) saat TIDAK ada objek yang dipilih melakukan safe no-op tanpa memanggil undo', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [{ id: 'd-1', type: 'trendline' }];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      undo: () => calls.push('undo'),
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: { drawings: mockDrawings } },
      cells: () => [{ chart: { drawings: mockDrawings } }]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    const dispatcher = createDefaultCommandDispatcher();
    const unbind = controller.bindToDispatcher(dispatcher);

    assert.equal(controller.getSelectedDrawingId(), null, 'Awalnya tidak ada objek yang dipilih');

    // Tekan tombol Delete saat tidak ada objek yang dipilih
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    // Tekan tombol Backspace saat tidak ada objek yang dipilih
    dispatcher.dispatch({
      key: 'Backspace',
      code: 'Backspace',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    // Tidak boleh ada pemanggilan remove, removeMany, atau undo
    assert.equal(calls.length, 0, 'Tidak boleh ada aksi penghapusan atau undo yang dijalankan');
    assert.equal(drawingsList.length, 1, 'Objek gambar yang ada tidak boleh terhapus');
    assert.equal(drawingsList[0].id, 'd-1');

    unbind();
  });

  await t.test('19. Tiket #138: Objek gambar dari trading plan (planId) hanya terhapus node spesifiknya saat dihapus', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || `draw_${drawingsList.length + 1}` };
        drawingsList.push(item);
        calls.push(`create:${item.id}`);
        return item;
      },
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      select: (id: string) => calls.push(`select:${id}`),
      deselect: () => calls.push('deselect'),
      undo: () => calls.push('undo'),
      on: () => {},
      off: () => {}
    };

    const baseTime = 1700000000000;
    const interval15m = 15 * 60 * 1000;
    const mockChart = {
      drawings: mockDrawings,
      data: () => [
        { time: baseTime - interval15m, close: 81000 },
        { time: baseTime, close: 81200 }
      ],
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [{ chart: mockChart }]
    };

    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'BTCUSDT',
      () => '15m',
      () => 'binance'
    );

    const dispatcher = createDefaultCommandDispatcher();
    const unbind = controller.bindToDispatcher(dispatcher);

    // Buat trading plan dengan 2 TP dan 1 context zone
    const mockPlan: any = {
      id: 'plan_test_123',
      symbol: 'BTCUSDT',
      bias: 'bearish',
      entry: 81200,
      stopLoss: 81400,
      targets: [
        { price: 80355, label: 'TP1', rMultiple: 4.22 },
        { price: 79429, label: 'TP2', rMultiple: 8.85 }
      ],
      contextZones: [
        { low: 81180, high: 81240, label: 'FVG LTF' }
      ]
    };

    const result = controller.createMultiTargetPosition(mockPlan, { barSpanPerTarget: 20 });
    assert.ok(result);
    assert.equal(result.drawingIds.length, 3, 'Plan harus menghasilkan 3 drawing (TP1, TP2, FVG box)');
    assert.equal(drawingsList.length, 3);
    assert.equal(controller.getActivePlans().length, 1, 'Harus ada 1 plan aktif');

    const tp1Id = result.drawingIds[0];
    const tp2Id = result.drawingIds[1];
    const fvgBoxId = result.drawingIds[2];

    // Seleksi hanya TP2
    controller.selectDrawing(tp2Id);
    assert.equal(controller.getSelectedDrawingId(), tp2Id);

    // Hapus TP2 via Delete key
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    // Verifikasi: Hanya TP2 yang terhapus!
    assert.ok(calls.includes(`removeMany:${tp2Id}`) || calls.includes(`remove:${tp2Id}`));
    assert.equal(drawingsList.some((d) => d.id === tp2Id), false, 'TP2 harus terhapus');
    assert.equal(drawingsList.some((d) => d.id === tp1Id), true, 'TP1 harus tetap ada');
    assert.equal(drawingsList.some((d) => d.id === fvgBoxId), true, 'FVG box harus tetap ada');
    assert.equal(drawingsList.length, 2, 'Tersisa 2 drawing untuk plan ini');

    // Rencana perdagangan masih ada di getActivePlans karena TP1 dan FVG box masih ada
    assert.equal(controller.getActivePlans().length, 1, 'Plan harus tetap ada selama masih ada node yang tersisa');

    // Sekarang hapus TP1
    controller.selectDrawing(tp1Id);
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    assert.equal(drawingsList.some((d) => d.id === tp1Id), false, 'TP1 harus terhapus');
    assert.equal(drawingsList.length, 1);
    assert.equal(controller.getActivePlans().length, 1, 'Plan masih ada karena FVG box tersisa');

    // Terakhir hapus FVG box
    controller.selectDrawing(fvgBoxId);
    dispatcher.dispatch({
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as any);

    assert.equal(drawingsList.length, 0, 'Semua drawing telah terhapus');
    // Seluruh node drawing dari plan sudah terhapus, activePlans sekarang harus bersih
    assert.equal(controller.getActivePlans().length, 0, 'Plan harus bersih ketika semua node gambar terhapus');

    unbind();
  });

  await t.test('20. Tiket #141: Drawing Duplication Engine (duplicateSelectedDrawing) dan Undo/Redo Timeline', () => {
    const controller = new ChartDrawingController();
    let drawingsList: any[] = [];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => drawingsList,
      create: (spec: any) => {
        const item = { ...spec, id: spec.id || `draw_${drawingsList.length + 1}` };
        drawingsList.push(item);
        calls.push(`create:${item.id}`);
        return item;
      },
      add: (type: string, spec: any) => {
        const item = { ...spec, id: spec.id || `draw_${drawingsList.length + 1}`, type };
        drawingsList.push(item);
        calls.push(`add:${item.id}`);
        return item;
      },
      remove: (id: string) => {
        calls.push(`remove:${id}`);
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        calls.push(`removeMany:${ids.join(',')}`);
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      select: (id: string) => calls.push(`select:${id}`),
      deselect: () => calls.push('deselect'),
      undo: () => calls.push('undo'),
      on: () => {},
      off: () => {}
    };

    const mockChart = {
      drawings: mockDrawings,
      data: () => [{ time: 1700000000000, close: 50000 }, { time: 1700000060000, close: 50100 }],
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '1m' },
      cells: () => [{ chart: mockChart }]
    };

    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'BTCUSDT',
      () => '1m',
      () => 'binance'
    );

    // 1. Memanggil saat tidak ada drawing terpilih mengembalikan null tanpa error
    assert.equal(controller.getSelectedDrawingId(), null);
    const noopResult = controller.duplicateSelectedDrawing();
    assert.equal(noopResult, null, 'Harus mengembalikan null saat tidak ada drawing terpilih');
    assert.equal(drawingsList.length, 0);

    // 2. Buat objek gambar awal
    const originalDrawing = {
      id: 'draw_orig_1',
      type: 'trendline',
      anchors: [
        { time: 1700000000000, price: 50000 },
        { time: 1700000060000, price: 50500 }
      ],
      style: { color: '#f59e0b', lineWidth: 2 },
      text: { content: 'Breakout Line' },
      metadata: { note: 'Key resistance' }
    };
    drawingsList.push(originalDrawing);

    // Seleksi drawing awal
    controller.selectDrawing('draw_orig_1');
    assert.equal(controller.getSelectedDrawingId(), 'draw_orig_1');

    // 3. Panggil duplicateSelectedDrawing
    let notifiedNewSelection = false;
    const unsub = controller.subscribe((state) => {
      if (state.selectedDrawingId && state.selectedDrawingId !== 'draw_orig_1') {
        notifiedNewSelection = true;
      }
    });

    const newId = controller.duplicateSelectedDrawing();
    assert.ok(newId, 'Harus mengembalikan ID drawing baru');
    assert.notEqual(newId, 'draw_orig_1', 'ID baru tidak boleh sama dengan ID lama');
    assert.equal(controller.getSelectedDrawingId(), newId, 'Drawing hasil klon harus otomatis menjadi selectedDrawingId');
    assert.equal(drawingsList.length, 2, 'Jumlah drawing di kanvas harus bertambah');
    assert.ok(notifiedNewSelection, 'Subscriber controller harus menerima notifikasi seleksi baru');

    // Periksa objek hasil klon
    const cloned = drawingsList.find((d) => d.id === newId);
    assert.ok(cloned, 'Objek klon harus tersimpan di chart drawings');
    assert.equal(cloned.type, 'trendline');
    assert.deepEqual(cloned.style, originalDrawing.style);
    assert.deepEqual(cloned.text, originalDrawing.text);
    assert.equal(cloned.metadata.note, 'Key resistance');

    // Koordinat anchors harus memiliki offset spasial
    assert.ok(cloned.anchors[0].price !== originalDrawing.anchors[0].price, 'Harga anchor 0 harus memiliki offset');
    assert.ok(cloned.anchors[1].price !== originalDrawing.anchors[1].price, 'Harga anchor 1 harus memiliki offset');
    assert.ok(cloned.anchors[0].time !== originalDrawing.anchors[0].time, 'Waktu anchor 0 harus memiliki offset');

    // 4. Undo (Ctrl+Z) membatalkan duplikasi (menghapus hasil clone)
    controller.undo();
    assert.equal(drawingsList.some((d) => d.id === newId), false, 'Drawing hasil klon harus terhapus setelah undo');
    assert.equal(drawingsList.length, 1, 'Hanya drawing asli yang tersisa');
    assert.equal(drawingsList[0].id, 'draw_orig_1');
    assert.equal(controller.getSelectedDrawingId(), null, 'selectedDrawingId harus direset saat clone di-undo');

    // 5. Redo (Ctrl+Y) memulihkan kembali hasil clone
    controller.redo();
    assert.equal(drawingsList.length, 2, 'Drawing hasil klon harus kembali setelah redo');
    assert.ok(drawingsList.some((d) => d.id === newId), 'Drawing hasil klon harus ada kembali');

    unsub();
  });

  await t.test('21. Transparansi Tinggi & Pewarnaan Kotak Context Zone Berdasarkan Polaritas (Fill 0.04 & Border 0.25)', () => {
    let drawingsList: any[] = [];
    const calls: string[] = [];

    const mockDrawings = {
      all: () => [...drawingsList],
      create: (spec: any) => {
        const id = spec.id || `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const item = { ...spec, id };
        drawingsList.push(item);
        calls.push(`create:${id}`);
        return item;
      },
      remove: (id: string) => {
        drawingsList = drawingsList.filter((d) => d.id !== id);
      },
      removeMany: (ids: string[]) => {
        drawingsList = drawingsList.filter((d) => !ids.includes(d.id));
      },
      select: () => {},
      deselect: () => {},
      undo: () => {},
      on: () => {},
      off: () => {}
    };

    const baseTime = 1700000000000;
    const interval15m = 15 * 60 * 1000;
    const mockChart = {
      drawings: mockDrawings,
      data: () => [
        { time: baseTime - interval15m, close: 2260 },
        { time: baseTime, close: 2266.8 }
      ],
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: { chart: mockChart, symbol: 'ETHUSDT', timeframe: '15m' },
      cells: () => [{ chart: mockChart }]
    };

    const controller = new ChartDrawingController();
    controller.attachWorkspace(
      mockWorkspace as any,
      () => 'ETHUSDT',
      () => '15m',
      () => 'binance'
    );

    const testPlan: any = {
      id: 'plan_transparency_test',
      symbol: 'ETHUSDT',
      bias: 'bullish',
      entry: 2266.8,
      stopLoss: 2247.5,
      targets: [
        { price: 2308.52, label: 'TP1', rMultiple: 2.16 }
      ],
      contextZones: [
        { low: 2281.62, high: 2303.5, label: '4H OB Bear', polarity: 'bear' },
        { low: 2249.77, high: 2275.99, label: '1H FVG Bull', polarity: 'bull' },
        { low: 2275.99, high: 2278.67, label: 'IDM', polarity: 'neutral' }
      ]
    };

    const res = controller.createMultiTargetPosition(testPlan);
    assert.ok(res);
    assert.equal(res.drawingIds.length, 4, '1 Target stage + 3 context zones = 4 drawing items');

    const bearBox = drawingsList.find((d) => d.metadata?.zoneLabel === '4H OB Bear');
    assert.ok(bearBox, 'Kotak 4H OB Bear harus terbuat');
    assert.equal(bearBox.style.fillColor, 'transparent', 'Bearish box fill harus 100% transparan');
    assert.equal(bearBox.style.lineColor, 'rgba(255, 105, 180, 0.4)', 'Bearish border harus alpha 0.4');
    assert.equal(bearBox.text.color, '#FF69B4');
    assert.equal(bearBox.text.align, 'center');
    assert.equal(bearBox.text.valign, 'middle');
    assert.equal(bearBox.text.halign, 'center');
    assert.equal(bearBox.metadata.polarity, 'bear');

    const bullBox = drawingsList.find((d) => d.metadata?.zoneLabel === '1H FVG Bull');
    assert.ok(bullBox, 'Kotak 1H FVG Bull harus terbuat');
    assert.equal(bullBox.style.fillColor, 'transparent', 'Bullish box fill harus 100% transparan');
    assert.equal(bullBox.style.lineColor, 'rgba(0, 255, 136, 0.4)', 'Bullish border harus alpha 0.4');
    assert.equal(bullBox.text.color, '#00FF88');
    assert.equal(bullBox.text.align, 'center');
    assert.equal(bullBox.text.valign, 'middle');
    assert.equal(bullBox.text.halign, 'center');
    assert.equal(bullBox.metadata.polarity, 'bull');

    const neutralBox = drawingsList.find((d) => d.metadata?.zoneLabel === 'IDM');
    assert.ok(neutralBox, 'Kotak IDM harus terbuat');
    assert.equal(neutralBox.style.fillColor, 'transparent', 'Neutral box fill harus 100% transparan');
    assert.equal(neutralBox.style.lineColor, 'rgba(160, 160, 160, 0.4)', 'Neutral border harus alpha 0.4');
    assert.equal(neutralBox.text.color, '#A0A0A0');
    assert.equal(neutralBox.text.align, 'center');
    assert.equal(neutralBox.text.valign, 'middle');
    assert.equal(neutralBox.text.halign, 'center');
    assert.equal(neutralBox.metadata.polarity, 'neutral');
  });

  await t.test('29. Multi-Pane Gesture Drawing Support (Volume & Oscillator Sub-Panes)', () => {
    const controller = new ChartDrawingController();
    const createdDrawings: any[] = [];

    // Mock projector dengan multi-pane resolution:
    // price: y 0..350
    // pane-volume: y 351..450
    // pane-stoch: y 451..550
    const mockProjector = {
      paneIdAtY: (y: number) => {
        if (y <= 350) return 'price';
        if (y <= 450) return 'pane-volume';
        return 'pane-stoch';
      },
      pxToPoint: (x: number, y: number, paneId: string) => {
        if (paneId === 'pane-stoch') {
          return { time: 1700000000 + x * 60, price: 100 - (y - 450) };
        }
        if (paneId === 'pane-volume') {
          return { time: 1700000000 + x * 60, price: (450 - y) * 1000 };
        }
        return { time: 1700000000 + x * 60, price: 50000 - y * 10 };
      },
      xOf: (time: number) => (time - 1700000000) / 60,
      yOf: (price: number, paneId: string) => {
        if (paneId === 'pane-stoch') return 450 + (100 - price);
        if (paneId === 'pane-volume') return 450 - price / 1000;
        return (50000 - price) / 10;
      }
    };

    const mockDrawings = {
      create: (spec: any) => {
        const item = { ...spec, id: `dw-${createdDrawings.length + 1}` };
        createdDrawings.push(item);
        return item;
      },
      add: (type: string, spec: any) => {
        const item = { ...spec, type, id: `dw-${createdDrawings.length + 1}` };
        createdDrawings.push(item);
        return item;
      },
      all: () => createdDrawings,
      get: (id: string) => createdDrawings.find((d) => d.id === id),
      removeMany: (ids: string[]) => {
        const remaining = createdDrawings.filter((d) => !ids.includes(d.id));
        createdDrawings.length = 0;
        createdDrawings.push(...remaining);
      },
      on: () => {},
      off: () => {}
    };

    const mockWorkspace = {
      active: {
        chart: {
          drawings: mockDrawings,
          renderer: {
            drawingProjector: () => mockProjector
          }
        }
      },
      cells: () => [
        {
          chart: {
            drawings: mockDrawings,
            renderer: {
              drawingProjector: () => mockProjector
            }
          }
        }
      ]
    };

    controller.attachWorkspace(mockWorkspace as any, () => 'BTCUSDT', () => '15m');
    controller.setTool('gesture');

    // 1. Gesture stroke di sub-pane Stochastic (y = 500, range 451..550)
    controller.startGestureStroke(100, 500);
    controller.addGesturePoint(200, 501);
    controller.addGesturePoint(300, 500);
    controller.addGesturePoint(400, 500);

    const stochResult = controller.finishGestureStroke({
      canvasWidth: 800,
      canvasHeight: 600,
      // Walaupun dikirimi wicks lilin chart utama (y=100..200), sub-pane tidak boleh snap ke lilin
      wicks: [{ highY: 100, lowY: 200 }] as any
    });

    assert.ok(stochResult, 'Hasil pengenalan gestur harus valid');
    assert.equal(stochResult.tool, 'hline');
    const createdStochDrawing = createdDrawings[createdDrawings.length - 1];
    assert.ok(createdStochDrawing, 'Drawing di sub-pane stoch harus terbuat');
    assert.equal(createdStochDrawing.paneId, 'pane-stoch', 'paneId drawing harus pane-stoch');
    assert.ok(Array.isArray(createdStochDrawing.anchors), 'anchors harus terkonversi');
    // Di Stochastic y=500: price = 100 - (500 - 450) = 50
    assert.equal(createdStochDrawing.anchors[0].price, 50);

    // 2. Siklus kandidat Tab harus mempertahankan target paneId
    const hudState = controller.getLastGestureCreation();
    assert.ok(hudState, 'HUD state harus aktif');
    assert.equal(hudState.paneId, 'pane-stoch', 'HUD state harus menyimpan paneId pane-stoch');

    const cycled = controller.cycleGestureCandidate();
    assert.equal(cycled, true);
    const cycledDrawing = createdDrawings[createdDrawings.length - 1];
    assert.equal(cycledDrawing.paneId, 'pane-stoch', 'Cycled candidate harus tetap di pane-stoch');

    // 3. Gesture stroke di sub-pane Volume (y = 400, range 351..450)
    controller.setTool('gesture');
    controller.startGestureStroke(100, 400);
    controller.addGesturePoint(300, 400);
    controller.addGesturePoint(300, 430);
    controller.addGesturePoint(100, 430);
    controller.addGesturePoint(100, 400);

    const volResult = controller.finishGestureStroke();
    assert.ok(volResult);
    assert.equal(volResult.tool, 'box');
    const createdVolDrawing = createdDrawings[createdDrawings.length - 1];
    assert.equal(createdVolDrawing.paneId, 'pane-volume', 'Box drawing harus memiliki pane-volume');

    // 4. Scribble to Erase di sub-pane Volume hanya menghapus drawing di pane-volume
    const initialCount = createdDrawings.length;
    controller.setTool('gesture');
    // Gambar scribble zigzag bolak-balik di area volume (y: 390..440, x: 100..300)
    controller.startGestureStroke(100, 410);
    controller.addGesturePoint(280, 415);
    controller.addGesturePoint(110, 420);
    controller.addGesturePoint(270, 422);
    controller.addGesturePoint(105, 425);
    controller.addGesturePoint(275, 428);

    const scribbleResult = controller.finishGestureStroke();
    assert.ok(scribbleResult);
    assert.equal(scribbleResult.tool, 'scribble');
    // Box di volume terhapus, tetapi drawing di stoch tetap ada
    assert.equal(createdDrawings.some((d) => d.paneId === 'pane-volume'), false, 'Box volume harus terhapus');
    assert.equal(createdDrawings.some((d) => d.paneId === 'pane-stoch'), true, 'Drawing stoch harus tetap bertahan');
  });
});



