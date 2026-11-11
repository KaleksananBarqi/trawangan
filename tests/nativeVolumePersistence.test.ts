import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { createMockChartContainer } from './helpers/mockChartContainer';

describe('Fase 2: Persistensi Volume Native (heightPct, placement, visibility)', () => {
  it('1. syncNativeVolumeColors mempertahankan inputs.heightPct yang dikustomisasi pengguna dan tidak menimpa ke 0.15', () => {
    const controller = new ChartSessionController();

    let volInputs: Record<string, any> = { upColor: '#111', downColor: '#222', heightPct: 8 };
    let lastNativeData: any = null;

    const volHandle = {
      id: 'native_0',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      inputValues: () => ({ ...volInputs }),
      setInputs: (patch: Record<string, any>) => {
        volInputs = { ...volInputs, ...patch };
      },
      setVisible: (v: boolean) => {
        volHandle.visible = v;
      },
    };

    const mockCell = {
      id: 'cell_0',
      symbol: 'binance:BTCUSDT',
      timeframe: '15',
      chart: {
        indicators: () => [volHandle],
        renderer: {
          scene: { volumeLayer: { heightFrac: 0.08 } },
          setNativeData: (type: string, data: any) => {
            if (type === 'volume') lastNativeData = data;
          },
          applyConfig: () => {},
        },
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => () => {},
    };

    controller.attach(createMockChartContainer(), { workspaceFactory: () => mockWs });
    controller.syncNativeVolumeColors(mockCell, false);

    assert.equal(volInputs.heightPct, 8, 'heightPct pada handle wajib tetap 8');
    assert.ok(lastNativeData, 'setNativeData volume dipanggil untuk menyelaraskan warna');
    assert.equal(
      lastNativeData.heightFrac,
      0.08,
      'heightFrac yang dikirim ke renderer wajib mengikuti heightPct/100 (0.08), bukan 0.15 hardcoded'
    );
  });

  it('2. getNativeIndicators membaca type, inputs (heightPct), visible, dan placement (overlay vs own-pane)', () => {
    const controller = new ChartSessionController();

    let volPaneId = 'price';
    let volInputs: Record<string, any> = { heightPct: 12, upColor: '#0f0', downColor: '#f00' };
    const volHandle = {
      id: 'native_vol',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      inputValues: () => ({ ...volInputs }),
      setInputs: (p: any) => { volInputs = { ...volInputs, ...p }; },
      setVisible: (v: boolean) => { volHandle.visible = v; },
    };

    const mockCell = {
      id: 'cell_0',
      chart: {
        indicators: () => [volHandle],
        panes: {
          list: () =>
            volPaneId === 'price'
              ? [{ id: 'price', kind: 'price', order: 0, collapsed: false, maximized: false, indicators: [{ id: 'native_vol', title: 'Volume', ownScale: false }] }]
              : [
                  { id: 'price', kind: 'price', order: 0, collapsed: false, maximized: false, indicators: [] },
                  { id: volPaneId, kind: 'study', order: 1, collapsed: false, maximized: false, indicators: [{ id: 'native_vol', title: 'Volume', ownScale: false }] },
                ],
        },
        renderer: { applyConfig: () => {} },
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => () => {},
    };

    controller.attach(createMockChartContainer(), { workspaceFactory: () => mockWs });

    const snapOverlay = controller.getNativeIndicators();
    assert.equal(snapOverlay.length, 1);
    assert.equal(snapOverlay[0].type, 'volume');
    assert.equal(snapOverlay[0].placement, 'overlay');
    assert.equal(snapOverlay[0].inputs?.heightPct, 12);
    assert.equal(snapOverlay[0].visible, true);

    // Simulasi volume dipindah ke pane bawah terpisah
    volPaneId = 'pane-native_vol';
    const snapOwnPane = controller.getNativeIndicators();
    assert.equal(snapOwnPane[0].placement, 'own-pane');
  });

  it('3. applyNativeIndicators memulihkan heightPct, visible, dan placement (memindah volume ke pane baru)', async () => {
    const controller = new ChartSessionController();

    let volPaneId = 'price';
    let volInputs: Record<string, any> = { heightPct: 20 };
    const moveCalls: Array<{ id: string; target: any }> = [];

    const volHandle = {
      id: 'native_vol',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      inputValues: () => ({ ...volInputs }),
      setInputs: (p: any) => { volInputs = { ...volInputs, ...p }; },
      setVisible: (v: boolean) => { volHandle.visible = v; },
    };

    const mockCell = {
      id: 'cell_0',
      volumeHidden: false,
      chart: {
        indicators: () => [volHandle],
        panes: {
          list: () =>
            volPaneId === 'price'
              ? [{ id: 'price', kind: 'price', order: 0, collapsed: false, maximized: false, indicators: [{ id: 'native_vol', title: 'Volume', ownScale: false }] }]
              : [
                  { id: 'price', kind: 'price', order: 0, collapsed: false, maximized: false, indicators: [] },
                  { id: volPaneId, kind: 'study', order: 1, collapsed: false, maximized: false, indicators: [{ id: 'native_vol', title: 'Volume', ownScale: false }] },
                ],
          moveIndicator: (id: string, target: any) => {
            moveCalls.push({ id, target });
            if (target === 'price' || target?.pane === 'price') {
              volPaneId = 'price';
            } else if (target?.newPane) {
              volPaneId = `pane-${id}`;
            }
          },
        },
        renderer: { applyConfig: () => {} },
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => () => {},
    };

    controller.attach(createMockChartContainer(), { workspaceFactory: () => mockWs });

    await controller.applyNativeIndicators([
      {
        type: 'volume',
        inputs: { heightPct: 9 },
        visible: true,
        placement: 'own-pane',
      },
    ]);

    assert.equal(volInputs.heightPct, 9, 'heightPct harus dipulihkan menjadi 9');
    assert.equal(volHandle.visible, true);
    assert.equal(moveCalls.length, 1);
    assert.deepEqual(moveCalls[0], { id: 'native_vol', target: { newPane: true } });

    // Kembalikan ke overlay dan sembunyikan
    await controller.applyNativeIndicators([
      {
        type: 'volume',
        inputs: { heightPct: 7 },
        visible: false,
        placement: 'overlay',
      },
    ]);
    assert.equal(volInputs.heightPct, 7);
    assert.equal(volHandle.visible, false);
    assert.equal(volPaneId, 'price');
  });
});
