import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import type { CellSnapshot, SavedWorkspace } from '../src/lib/types/market';

/**
 * Helper untuk membuat mock cell chart Vela dengan kemampuan countdown dan wallclock
 */
function createMockVelaCell(id: string, initialCountdown = false) {
  let countdown = initialCountdown;
  let wallClock: any = null;
  const appliedConfigs: any[] = [];
  const scene = {
    showCountdown: countdown,
    showPriceLine: true,
  };

  const native: any = {
    scene,
    getConfig: () => ({
      priceScale: {
        countdown,
        currentPriceLine: true,
      }
    }),
    applyConfig: (cfg: any) => {
      appliedConfigs.push(cfg);
      if (cfg?.priceScale?.countdown !== undefined) {
        countdown = Boolean(cfg.priceScale.countdown);
        scene.showCountdown = countdown;
      }
    },
    set: (prop: string, val: any) => {
      if (prop === 'countdown') {
        countdown = Boolean(val);
        scene.showCountdown = countdown;
      }
    },
    setWallClock: (clock: any) => {
      wallClock = clock;
    },
    scheduler: {
      invalidate: () => {}
    }
  };

  const cell: any = {
    id,
    symbol: 'binance:BTCUSDT',
    timeframe: '15m',
    chart: {
      id,
      renderer: {
        renderer: native,
        setWallClock: (clock: any) => native.setWallClock(clock)
      }
    }
  };

  return {
    cell,
    native,
    getCountdown: () => countdown,
    getWallClock: () => wallClock,
    getAppliedConfigs: () => appliedConfigs,
  };
}

describe('Price Axis Countdown Bar Timer & WallClock Synchronization Suite (#201)', () => {
  test('1. Default status countdown: isPriceScaleCountdownEnabled() bernilai false secara default', () => {
    const mock = createMockVelaCell('cell_1', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    assert.strictEqual(
      controller.isPriceScaleCountdownEnabled(),
      false,
      'Countdown wajib nonaktif secara default'
    );
  });

  test('2. setPriceScaleCountdown: mengaktifkan countdown pada cell aktif dan memperbarui native config Vela', () => {
    const mock = createMockVelaCell('cell_1', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    let persistReason: string | null = null;
    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      onPersistableStateChange: (reason) => {
        persistReason = reason;
      }
    });
    controller.attach({ nodeType: 1 } as any);

    // Aktifkan countdown
    controller.setPriceScaleCountdown(true);

    assert.strictEqual(
      controller.isPriceScaleCountdownEnabled(),
      true,
      'isPriceScaleCountdownEnabled wajib mengembalikan true setelah diaktifkan'
    );
    assert.strictEqual(
      mock.getCountdown(),
      true,
      'Mock cell countdown internal wajib berubah menjadi true'
    );
    assert.strictEqual(
      mock.native.scene.showCountdown,
      true,
      'Vela native scene.showCountdown wajib true'
    );
    assert.strictEqual(
      persistReason,
      'priceScaleCountdown',
      'Event persistableChange wajib dipancarkan saat status countdown berubah'
    );

    // Nonaktifkan countdown kembali
    controller.setPriceScaleCountdown(false);
    assert.strictEqual(controller.isPriceScaleCountdownEnabled(), false);
    assert.strictEqual(mock.getCountdown(), false);
    assert.strictEqual(mock.native.scene.showCountdown, false);
  });

  test('3. Multi-Chart sync: setPriceScaleCountdown memperbarui seluruh cell pada grid', () => {
    const mock1 = createMockVelaCell('cell_1', false);
    const mock2 = createMockVelaCell('cell_2', false);
    const mockWs = {
      cells: () => [mock1.cell, mock2.cell],
      active: mock1.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    controller.setPriceScaleCountdown(true);

    assert.strictEqual(mock1.getCountdown(), true, 'Cell 1 wajib aktif');
    assert.strictEqual(mock2.getCountdown(), true, 'Cell 2 wajib aktif');
    assert.strictEqual(mock1.native.scene.showCountdown, true);
    assert.strictEqual(mock2.native.scene.showCountdown, true);
  });

  test('4. interceptApplyConfig menjaga priceScale.countdown agar tidak tertimpa saat applyConfig parsial', () => {
    const mock = createMockVelaCell('cell_1', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);
    controller.setPriceScaleCountdown(true);

    // Panggil applyConfig parsial tanpa menyebut priceScale.countdown
    mock.native.applyConfig({
      priceScale: { mode: 'log' }
    });

    assert.strictEqual(
      mock.native.scene.showCountdown,
      true,
      'showCountdown tidak boleh tertimpa menjadi undefined/false oleh applyConfig parsial'
    );
  });

  test('5. Sinkronisasi WallClock: setWallClock meneruskan clock pulse central ke semua cell', () => {
    const mock1 = createMockVelaCell('cell_1', false);
    const mock2 = createMockVelaCell('cell_2', false);
    const mockWs = {
      cells: () => [mock1.cell, mock2.cell],
      active: mock1.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    const dummyClock = {
      onTick: (cb: (now: number) => void) => () => {}
    };

    controller.setWallClock(dummyClock);

    assert.strictEqual(
      mock1.getWallClock(),
      dummyClock,
      'Cell 1 wajib menerima dummyClock via setWallClock'
    );
    assert.strictEqual(
      mock2.getWallClock(),
      dummyClock,
      'Cell 2 wajib menerima dummyClock via setWallClock'
    );
  });

  test('6. Workspace persistence: snapshot menangkap dan memulihkan priceScaleCountdown', async () => {
    const mock = createMockVelaCell('cell_1', false);
    const mockWs: any = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      applyState: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    controller.setPriceScaleCountdown(true);

    const cellsSnapshot = controller.getCellsSnapshot();
    assert.strictEqual(
      cellsSnapshot[0]?.priceScaleCountdown,
      true,
      'CellSnapshot wajib menyimpan priceScaleCountdown: true'
    );

    // Simulasikan pemulihan applyCellsSnapshot
    const restoreSnap: CellSnapshot[] = [
      {
        symbol: 'binance:BTCUSDT',
        timeframe: '15m',
        providerId: 'binance',
        priceScaleCountdown: true
      }
    ];

    await controller.applyCellsSnapshot(restoreSnap);
    assert.strictEqual(
      controller.isPriceScaleCountdownEnabled(),
      true,
      'Status countdown wajib dipulihkan saat applyCellsSnapshot'
    );
  });

  test('7. AppSettings default: showPriceScaleCountdown tersedia dan bernilai false secara default', () => {
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.showPriceScaleCountdown,
      false,
      'DEFAULT_APP_SETTINGS.showPriceScaleCountdown wajib bernilai false'
    );
  });

  test('8. Inisialisasi Controller: priceScaleCountdown: true mengaktifkan countdown secara otomatis saat attach', () => {
    const mock = createMockVelaCell('cell_init', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
      priceScaleCountdown: true,
    });
    controller.attach({ nodeType: 1 } as any);

    assert.strictEqual(
      controller.isPriceScaleCountdownEnabled(),
      true,
      'Countdown wajib aktif sejak awal sesuai opsi inisialisasi'
    );
    assert.strictEqual(
      mock.getCountdown(),
      true,
      'Mock cell wajib aktif saat attachCellListeners dijalankan'
    );
  });

  test('9. Full Workspace State: saveWorkspaceState dan loadWorkspaceState menjaga keutuhan priceScaleCountdown', async () => {
    const mock = createMockVelaCell('cell_ws', false);
    const mockWs: any = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      applyState: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    controller.setPriceScaleCountdown(true);
    const savedState = controller.saveWorkspaceState('Countdown Workspace');

    assert.strictEqual(
      savedState.priceScaleCountdown,
      true,
      'saveWorkspaceState wajib menyertakan priceScaleCountdown: true'
    );

    // Muat pada controller baru
    const mock2 = createMockVelaCell('cell_ws_2', false);
    const mockWs2: any = {
      cells: () => [mock2.cell],
      active: mock2.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      applyState: () => {},
      destroy: () => {}
    };
    const controller2 = new ChartSessionController({
      workspaceFactory: () => mockWs2,
    });
    controller2.attach({ nodeType: 1 } as any);

    await controller2.loadWorkspaceState({
      ...savedState,
      id: 'ws_countdown_test',
      timestamp: Date.now()
    } as SavedWorkspace);

    assert.strictEqual(
      controller2.isPriceScaleCountdownEnabled(),
      true,
      'loadWorkspaceState wajib memulihkan priceScaleCountdown: true'
    );
  });

  test('10. getSnapshot(): mengembalikan status priceScaleCountdown yang akurat', () => {
    const mock = createMockVelaCell('cell_snap', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);

    assert.strictEqual(controller.getSnapshot().priceScaleCountdown, false);

    controller.setPriceScaleCountdown(true);
    assert.strictEqual(controller.getSnapshot().priceScaleCountdown, true);
  });

  test('11. Central WallClock default: tanpa opsi wallClock, semua cell lintas controller berbagi satu instance SecondClock sentral', () => {
    const mock1 = createMockVelaCell('cell_wc_1', false);
    const mock2 = createMockVelaCell('cell_wc_2', false);
    const mockWs1 = {
      cells: () => [mock1.cell],
      active: mock1.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };
    const mockWs2 = {
      cells: () => [mock2.cell],
      active: mock2.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller1 = new ChartSessionController({ workspaceFactory: () => mockWs1 });
    const controller2 = new ChartSessionController({ workspaceFactory: () => mockWs2 });
    controller1.attach({ nodeType: 1 } as any);
    controller2.attach({ nodeType: 1 } as any);

    const wc1 = mock1.getWallClock();
    const wc2 = mock2.getWallClock();

    assert.ok(wc1, 'Cell 1 wajib otomatis terhubung ke central WallClock saat attach');
    assert.strictEqual(typeof wc1.onTick, 'function', 'Central WallClock wajib mengimplementasikan onTick()');
    assert.strictEqual(
      wc1,
      wc2,
      'Seluruh cell lintas controller wajib berbagi satu instance central WallClock yang sama'
    );
  });

  test('12. applyPriceScaleState menjaga status countdown tetap aktif saat mode skala berubah', () => {
    const mock = createMockVelaCell('cell_ps', false);
    const mockWs = {
      cells: () => [mock.cell],
      active: mock.cell,
      sync: { set: () => {} },
      setLayout: () => {},
      destroy: () => {}
    };

    const controller = new ChartSessionController({
      workspaceFactory: () => mockWs,
    });
    controller.attach({ nodeType: 1 } as any);
    controller.setPriceScaleCountdown(true);

    controller.applyPriceScaleState({ mode: 'log', auto: true });

    assert.strictEqual(
      mock.native.scene.showCountdown,
      true,
      'applyPriceScaleState tidak boleh menghapus status showCountdown'
    );
    assert.strictEqual(
      mock.getCountdown(),
      true,
      'priceScale.countdown di config wajib tetap true setelah applyPriceScaleState'
    );
  });
});
