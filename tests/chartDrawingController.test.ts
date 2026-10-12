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
});
