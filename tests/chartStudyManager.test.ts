import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChartStudyManager, type StudyDescriptor, type CellStudySnapshot } from '../src/lib/services/chartStudyManager';
import { IndicatorRegistry } from '../src/lib/services/indicatorRegistry';
import { ChartSessionController } from '../src/lib/services/chartSessionController';

/**
 * Fake cell engine adapter ringan untuk menguji ChartStudyManager pada public seam
 * tanpa ketergantungan DOM/WebGL2 maupun mutasi properti privat controller.
 */
function createFakeCell(id: string) {
  const mounted: any[] = [];
  const panes: any[] = [{ id: 'price', kind: 'price', indicators: [] as any[], heightWeight: 3 }];
  const volumeLayer = { upColor: '#26a69a', downColor: '#ef5350', heightFrac: 0.15 };
  const nativeDataCalls: Array<{ type: string; data: any }> = [];
  let seq = 0;

  const chart = {
    indicators: () => [...mounted],
    addIndicator: (source: string, options: any = {}) => {
      seq += 1;
      const handle = {
        id: `pine-${id}-${seq}`,
        title: options.title || 'Custom',
        source,
        language: options.language || 'pine',
        visible: true,
        _inputs: { ...(options.inputs || {}) },
        _props: { ...(options.props || {}) },
        paneId: options.overlay ? 'price' : `pane-${seq}`,
        inputValues: function () { return { ...this._inputs }; },
        propValues: function () { return { ...this._props }; },
        setInputs: function (vals: Record<string, any>) { this._inputs = { ...this._inputs, ...vals }; },
        setProps: function (vals: Record<string, any>) { this._props = { ...this._props, ...vals }; },
        setVisible: function (v: boolean) { this.visible = v; },
        remove: function () {
          const idx = mounted.indexOf(this);
          if (idx >= 0) mounted.splice(idx, 1);
          for (const p of panes) {
            p.indicators = p.indicators.filter((it: any) => it.id !== this.id);
          }
        },
      };
      mounted.push(handle);
      if (options.overlay) {
        panes[0].indicators.push({ id: handle.id, title: handle.title });
      } else {
        panes.push({ id: handle.paneId, kind: 'study', indicators: [{ id: handle.id, title: handle.title }], heightWeight: 1 });
      }
      return handle;
    },
    addNativeIndicator: (type: string, options: any = {}) => {
      seq += 1;
      const handle = {
        id: `native-${id}-${type}-${seq}`,
        title: options.title || type.toUpperCase(),
        nativeType: type,
        visible: true,
        _inputs: { ...(options.inputs || {}) },
        _props: { ...(options.props || {}) },
        paneId: 'price',
        inputValues: function () { return { ...this._inputs }; },
        propValues: function () { return { ...this._props }; },
        setInputs: function (vals: Record<string, any>) { this._inputs = { ...this._inputs, ...vals }; },
        setProps: function (vals: Record<string, any>) { this._props = { ...this._props, ...vals }; },
        setVisible: function (v: boolean) { this.visible = v; },
        remove: function () {
          const idx = mounted.indexOf(this);
          if (idx >= 0) mounted.splice(idx, 1);
          for (const p of panes) {
            p.indicators = p.indicators.filter((it: any) => it.id !== this.id);
          }
        },
      };
      mounted.push(handle);
      panes[0].indicators.push({ id: handle.id, title: handle.title });
      return handle;
    },
    panes: {
      list: () => panes.map((p) => ({ ...p, indicators: [...p.indicators] })),
      moveIndicator: (handleId: string, target: string | { newPane: boolean }) => {
        const ind = mounted.find((m) => m.id === handleId);
        if (!ind) return;
        for (const p of panes) {
          p.indicators = p.indicators.filter((it: any) => it.id !== handleId);
        }
        if (typeof target === 'object' && target.newPane) {
          const newPaneId = `pane-native-${handleId}`;
          ind.paneId = newPaneId;
          panes.push({ id: newPaneId, kind: 'study', indicators: [{ id: ind.id, title: ind.title }], heightWeight: 1 });
        } else {
          ind.paneId = 'price';
          panes[0].indicators.push({ id: ind.id, title: ind.title });
        }
      },
    },
    renderer: {
      scene: { volumeLayer },
      setNativeData: (type: string, data: any) => {
        nativeDataCalls.push({ type, data });
        if (type === 'volume') {
          if (data.upColor) volumeLayer.upColor = data.upColor;
          if (data.downColor) volumeLayer.downColor = data.downColor;
          if (typeof data.heightFrac === 'number') volumeLayer.heightFrac = data.heightFrac;
        }
      },
    },
  };

  return {
    id,
    chart,
    mounted,
    volumeLayer,
    nativeDataCalls,
  };
}

describe('ChartStudyManager Deep Cell-Aware Lifecycle (#215)', () => {
  let registry: IndicatorRegistry;
  let manager: ChartStudyManager;

  beforeEach(() => {
    registry = new IndicatorRegistry();
    manager = new ChartStudyManager(registry);
  });

  it('1. Mengelola add, update inputs (termasuk clamping VPVR), visibility toggle, dan remove secara seragam pada cell aktif maupun non-aktif', async () => {
    const activeCell = createFakeCell('c1');
    const backgroundCell = createFakeCell('c2');

    // Tambahkan Pine study ke backgroundCell langsung
    const pineDesc: StudyDescriptor = {
      language: 'pine',
      title: 'EMA 21',
      source: '//@version=5\nindicator("EMA 21", overlay=true)\nplot(ta.ema(close, 21))',
      inputs: { length: 21 },
    };
    const pineHandle = await manager.addStudy(backgroundCell, pineDesc);
    assert.ok(pineHandle, 'addStudy harus mengembalikan handle Pine');
    assert.strictEqual(backgroundCell.mounted.length, 1);
    assert.strictEqual(activeCell.mounted.length, 0);
    assert.strictEqual(backgroundCell.mounted[0].language, 'pine');

    // Tambahkan Native VPVR study ke activeCell dengan input out-of-bounds
    const vpvrDesc: StudyDescriptor = {
      language: 'native',
      nativeType: 'vpvr',
      title: 'Volume Profile Visible Range',
      inputs: { rowCount: 999, valueAreaPct: 150, widthPct: 2 },
    };
    const mountedVpvr = await manager.addStudy(activeCell, vpvrDesc);
    assert.ok(mountedVpvr, 'addStudy harus mengembalikan handle VPVR');
    assert.strictEqual(activeCell.mounted.length, 1);

    const vpvrHandle = activeCell.mounted[0];
    assert.strictEqual(vpvrHandle.nativeType, 'vpvr');
    const normalized = vpvrHandle.inputValues();
    assert.strictEqual(normalized.rows, 400, 'rowCount > 400 harus di-clamp ke 400');
    assert.strictEqual(normalized.valueAreaPct, 100, 'valueAreaPct > 100 harus di-clamp ke 100');
    assert.strictEqual(normalized.widthPct, 5, 'widthPct < 5 harus di-clamp ke 5');

    // Update inputs VPVR via public seam
    const updated = manager.updateStudyInputs(vpvrHandle.id, { rowCount: 1, valueAreaPct: -10 });
    assert.strictEqual(updated, true);
    assert.strictEqual(vpvrHandle.inputValues().rows, 2, 'rowCount < 2 harus di-clamp ke 2');
    assert.strictEqual(vpvrHandle.inputValues().valueAreaPct, 0, 'valueAreaPct < 0 harus di-clamp ke 0');

    // Toggle visibility
    const nextVis = manager.toggleStudyVisibility(vpvrHandle.id, false);
    assert.strictEqual(nextVis, false);
    assert.strictEqual(vpvrHandle.visible, false);

    // Remove study
    const removed = manager.removeStudy(vpvrHandle.id, [activeCell, backgroundCell], false);
    assert.strictEqual(removed, true);
    assert.strictEqual(activeCell.mounted.length, 0);
    assert.strictEqual(backgroundCell.mounted.length, 1, 'Pine study di backgroundCell tidak boleh terhapus');
  });

  it('2. Menyinkronkan warna Native Volume Overlay lintas sel saat warna candle berubah tanpa menimpa heightPct', async () => {
    const cell1 = createFakeCell('c1');
    const cell2 = createFakeCell('c2');

    await manager.addStudyToCells([cell1, cell2], {
      language: 'native',
      nativeType: 'volume',
      title: 'Volume',
      inputs: { heightPct: 28 },
    });

    manager.syncVolumeColors([cell1, cell2], {
      themePreset: 'obsidian-pink',
      customCandleColors: { bullColor: '#00ffaa', bearColor: '#ff0077' },
    });

    for (const cell of [cell1, cell2]) {
      assert.strictEqual(cell.volumeLayer.upColor, '#00ffaa');
      assert.strictEqual(cell.volumeLayer.downColor, '#ff0077');
      assert.strictEqual(cell.volumeLayer.heightFrac, 0.28, 'heightPct harus dipertahankan sebagai heightFrac');
      assert.strictEqual(cell.mounted[0].inputValues().upColor, '#00ffaa');
      assert.strictEqual(cell.mounted[0].inputValues().downColor, '#ff0077');
    }
  });

  it('3. Menghitung Pane Signature deterministik untuk price pane dan sub-pane study', async () => {
    const cell = createFakeCell('c1');
    await manager.addStudy(cell, {
      language: 'pine',
      title: 'RSI',
      source: '//@version=5\nindicator("RSI", overlay=false)\nplot(ta.rsi(close, 14))',
    });

    const layout = manager.getPaneLayout(cell);
    assert.strictEqual(layout.length, 2);
    assert.strictEqual(layout[0].signature, 'price');
    assert.strictEqual(layout[1].signature, 'RSI');
  });

  it('4. cloneStudiesToCells mempertahankan descriptor Pine dan Native (VPVR), normalized inputs, props, dan visibility pada seluruh target cell', async () => {
    const sourceCell = createFakeCell('c1');
    const targetCellA = createFakeCell('c2');
    const targetCellB = createFakeCell('c3');

    await manager.addStudy(sourceCell, {
      language: 'pine',
      title: 'EMA 50',
      source: '//@version=5\nindicator("EMA 50", overlay=true)\nplot(ta.ema(close, 50))',
      inputs: { length: 50 },
      props: { color: '#ffaa00' },
      visible: false,
    });
    await manager.addStudy(sourceCell, {
      language: 'native',
      nativeType: 'vpvr',
      title: 'Volume Profile Visible Range',
      inputs: { rowCount: 48, valueAreaPct: 75, showPoc: true },
      visible: true,
    });

    const snapshot = manager.captureCellStudies(sourceCell);
    await manager.cloneStudiesToCells(snapshot.unified, [sourceCell, targetCellA, targetCellB]);

    for (const target of [targetCellA, targetCellB]) {
      assert.strictEqual(target.mounted.length, 2, 'Target cell harus memiliki 2 study hasil clone');

      const clonedPine = target.mounted.find((m) => m.title === 'EMA 50');
      assert.ok(clonedPine, 'Pine study harus ter-clone');
      assert.strictEqual(clonedPine.language, 'pine');
      assert.strictEqual(clonedPine.visible, false);
      assert.deepStrictEqual(clonedPine.inputValues(), { length: 50 });
      assert.deepStrictEqual(clonedPine.propValues(), { color: '#ffaa00' });

      const clonedVpvr = target.mounted.find((m) => m.nativeType === 'vpvr');
      assert.ok(clonedVpvr, 'Native VPVR study harus ter-clone sebagai native, bukan pine');
      assert.strictEqual(clonedVpvr.visible, true);
      assert.strictEqual(clonedVpvr.inputValues().rows, 48);
      assert.strictEqual(clonedVpvr.inputValues().valueAreaPct, 75);
      assert.strictEqual(clonedVpvr.inputValues().showPoc, true);
    }
  });

  it('5. captureCellStudies dan restoreCellStudies melakukan round-trip Pine dan Native studies secara lossless', async () => {
    const srcCell = createFakeCell('src');
    const dstCell = createFakeCell('dst');

    await manager.addStudy(srcCell, {
      language: 'pine',
      title: 'RSI 14',
      source: '//@version=5\nindicator("RSI 14", overlay=false)\nplot(ta.rsi(close, 14))',
      inputs: { length: 14 },
      props: { linewidth: 2 },
      visible: true,
    });

    await manager.addStudy(srcCell, {
      language: 'native',
      nativeType: 'vpvr',
      title: 'VPVR',
      inputs: { rowCount: 32, valueAreaPct: 68, showPoc: false },
      placement: 'overlay',
      visible: false,
    });

    await manager.addStudy(srcCell, {
      language: 'native',
      nativeType: 'volume',
      title: 'Volume',
      inputs: { heightPct: 22 },
      placement: 'own-pane',
      visible: true,
    });

    const captured = manager.captureCellStudies(srcCell);
    assert.strictEqual(captured.pine.length, 1);
    assert.strictEqual(captured.native.length, 2);

    await manager.restoreCellStudies(dstCell, captured);
    const reCaptured = manager.captureCellStudies(dstCell);

    assert.strictEqual(reCaptured.pine.length, 1);
    assert.strictEqual(reCaptured.pine[0].title, 'RSI 14');
    assert.deepStrictEqual(reCaptured.pine[0].inputs, { length: 14 });
    assert.deepStrictEqual(reCaptured.pine[0].props, { linewidth: 2 });
    assert.strictEqual(reCaptured.pine[0].visible, true);

    const restoredVpvr = reCaptured.native.find((n) => n.type === 'vpvr');
    assert.ok(restoredVpvr, 'VPVR harus dipulihkan');
    assert.strictEqual(restoredVpvr.visible, false);
    assert.strictEqual(restoredVpvr.placement, 'overlay');
    assert.strictEqual((restoredVpvr.inputs as any).rows, 32);
    assert.strictEqual((restoredVpvr.inputs as any).valueAreaPct, 68);
    assert.strictEqual((restoredVpvr.inputs as any).showPoc, false);

    const restoredVol = reCaptured.native.find((n) => n.type === 'volume');
    assert.ok(restoredVol, 'Volume harus dipulihkan');
    assert.strictEqual(restoredVol.placement, 'own-pane');
    assert.strictEqual((restoredVol.inputs as any).heightPct, 22);
  });

  it('6. Integrasi ChartSessionController.cloneIndicatorsToCells mempertahankan studi Pine dan Native (VPVR)', async () => {
    const cell1 = createFakeCell('c1');
    const cell2 = createFakeCell('c2');

    // Simulasikan workspace 2 sel dengan syncConfig.indicators nonaktif saat penambahan awal
    const controller = new ChartSessionController({
      workspaceFactory: () => ({
        active: cell1,
        cells: () => [cell1, cell2],
        layout: '2h',
        destroy: () => {},
      }),
      syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
    });
    controller.attach({ nodeType: 1 } as unknown as HTMLElement);

    await controller.addPineIndicatorToCell(
      cell1,
      '//@version=5\nindicator("EMA 20", overlay=true)\nplot(ta.ema(close, 20))',
      'EMA 20',
      { length: 20 }
    );
    await controller.addNativeIndicatorToCell(
      cell1,
      'vpvr',
      { inputs: { rowCount: 36, valueAreaPct: 72 } },
      'Volume Profile Visible Range'
    );

    const activeSnapshot = controller.getActiveIndicators();
    assert.strictEqual(activeSnapshot.length, 2);

    // Clone ke seluruh cell melalui public seam controller
    await controller.cloneIndicatorsToCells(activeSnapshot);

    assert.strictEqual(cell2.mounted.length, 2, 'cell2 harus menerima hasil clone Pine dan Native VPVR');
    const clonedPine = cell2.mounted.find((m) => m.title === 'EMA 20');
    assert.ok(clonedPine, 'EMA 20 harus ter-clone ke cell2');
    assert.strictEqual(clonedPine.language, 'pine');

    const clonedVpvr = cell2.mounted.find((m) => m.nativeType === 'vpvr');
    assert.ok(clonedVpvr, 'VPVR harus ter-clone ke cell2 sebagai native indicator');
    assert.strictEqual(clonedVpvr.inputValues().rows, 36);
    assert.strictEqual(clonedVpvr.inputValues().valueAreaPct, 72);
  });
});
