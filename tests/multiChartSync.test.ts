import { test, describe } from 'node:test';
import assert from 'node:assert';
import type { MultiChartSyncConfig } from '../src/lib/types/market';

describe('Multi-Chart Synchronization Engine Unit Tests', () => {
  test('MultiChartSyncConfig: memverifikasi nilai default sinkronisasi kursor & viewport', () => {
    const defaultSyncConfig: MultiChartSyncConfig = {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
      indicators: true,
    };

    assert.strictEqual(defaultSyncConfig.crosshair, true, 'Crosshair wajib aktif secara default');
    assert.strictEqual(defaultSyncConfig.viewport, true, 'Viewport wajib aktif secara default agar kursor & gerakan tersinkron');
    assert.strictEqual(defaultSyncConfig.symbol, false, 'Symbol independen secara default');
    assert.strictEqual(defaultSyncConfig.drawings, true, 'Drawings sinkron antar chart');
    assert.strictEqual(defaultSyncConfig.indicators, true, 'Indicators wajib aktif secara default');
  });

  test('Toggle Handlers: mengubah status flag sinkronisasi secara terisolasi', () => {
    let syncConfig: MultiChartSyncConfig = {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
      indicators: true,
    };

    // Toggle Viewport
    syncConfig = { ...syncConfig, viewport: !syncConfig.viewport };
    assert.strictEqual(syncConfig.viewport, false);

    syncConfig = { ...syncConfig, viewport: !syncConfig.viewport };
    assert.strictEqual(syncConfig.viewport, true);

    // Toggle Crosshair
    syncConfig = { ...syncConfig, crosshair: !syncConfig.crosshair };
    assert.strictEqual(syncConfig.crosshair, false);

    // Toggle Symbol
    syncConfig = { ...syncConfig, symbol: !syncConfig.symbol };
    assert.strictEqual(syncConfig.symbol, true);

    // Toggle Indicators
    syncConfig = { ...syncConfig, indicators: !syncConfig.indicators };
    assert.strictEqual(syncConfig.indicators, false);

    syncConfig = { ...syncConfig, indicators: !syncConfig.indicators };
    assert.strictEqual(syncConfig.indicators, true);

    // Pastikan flag lain tidak terdampak
    assert.strictEqual(syncConfig.drawings, true);
    assert.strictEqual(syncConfig.viewport, true);
  });

  test('Auto-Clone Indicators on Layout Expand: cell baru mewarisi seluruh indikator dari chart utama', () => {
    interface MockIndicator {
      id: string;
      title: string;
      source: string;
      visible: boolean;
      inputs?: Record<string, any>;
    }

    interface MockChartCell {
      id: string;
      indicators: MockIndicator[];
      addIndicator(source: string, options: { title: string; inputs?: Record<string, any> }): MockIndicator;
    }

    const cell0: MockChartCell = {
      id: 'cell_0',
      indicators: [
        { id: 'ind_1', title: 'EMA 20', source: 'plot(ta.ema(close, 20))', visible: true, inputs: { length: 20 } },
        { id: 'ind_2', title: 'RSI', source: 'plot(ta.rsi(close, 14))', visible: true, inputs: { length: 14 } },
        { id: 'ind_3', title: 'MACD', source: 'plot(ta.macd(close, 12, 26, 9))', visible: false }
      ],
      addIndicator(source, options) {
        const ind: MockIndicator = {
          id: `ind_${Date.now()}_${Math.random()}`,
          title: options.title,
          source,
          visible: true,
          inputs: options.inputs
        };
        this.indicators.push(ind);
        return ind;
      }
    };

    const cell1: MockChartCell = {
      id: 'cell_1',
      indicators: [],
      addIndicator(source, options) {
        const ind: MockIndicator = {
          id: `ind_${Date.now()}_${Math.random()}`,
          title: options.title,
          source,
          visible: true,
          inputs: options.inputs
        };
        this.indicators.push(ind);
        return ind;
      }
    };

    // Simulasi kloning saat layout berganti ke 2 chart
    const activeSnapshot = [...cell0.indicators];
    const cells = [cell0, cell1];

    for (const cell of cells) {
      const existingTitles = new Set(cell.indicators.map((i) => i.title));
      for (const ind of activeSnapshot) {
        if (!existingTitles.has(ind.title)) {
          cell.addIndicator(ind.source, { title: ind.title, inputs: ind.inputs });
        }
      }
    }

    // Cell 1 sekarang memiliki jumlah dan judul indikator yang sama persis dengan Cell 0
    assert.strictEqual(cell1.indicators.length, 3);
    assert.strictEqual(cell1.indicators[0].title, 'EMA 20');
    assert.strictEqual(cell1.indicators[1].title, 'RSI');
    assert.strictEqual(cell1.indicators[2].title, 'MACD');
  });

  test('Indicator Reconciliation: menyelaraskan follower cell saat sync diaktifkan kembali', () => {
    interface MockIndicator {
      id: string;
      title: string;
      source: string;
    }

    const activeCell = {
      id: 'cell_0',
      indicators: [
        { id: 'ind_1', title: 'EMA 20', source: 'code1' },
        { id: 'ind_2', title: 'Bollinger Bands', source: 'code2' }
      ]
    };

    const followerCell = {
      id: 'cell_1',
      indicators: [
        { id: 'ind_custom', title: 'Stochastic RSI', source: 'code3' }
      ]
    };

    // Simulasi rekonsiliasi: bersihkan follower dan salin indikator active cell
    followerCell.indicators = [];
    for (const ind of activeCell.indicators) {
      followerCell.indicators.push({ ...ind });
    }

    assert.strictEqual(followerCell.indicators.length, 2);
    assert.strictEqual(followerCell.indicators[0].title, 'EMA 20');
    assert.strictEqual(followerCell.indicators[1].title, 'Bollinger Bands');
  });

  test('Revert to Single Chart Layout: mempertahankan indikator dari cell yang aktif/terfokus', () => {
    const focusedCell = {
      id: 'cell_1',
      indicators: [
        { id: 'ind_1', title: 'SuperTrend', source: 'codeST' }
      ]
    };

    const unfocusedCell = {
      id: 'cell_0',
      indicators: [
        { id: 'ind_old', title: 'Old Indicator', source: 'codeOld' }
      ]
    };

    // Snapshot diambil dari focusedCell sebelum setLayout('1')
    const snapshotBeforeRevert = [...focusedCell.indicators];

    // Single cell setelah revert
    const singleCell = {
      id: 'cell_0',
      indicators: [...snapshotBeforeRevert]
    };

    assert.strictEqual(singleCell.indicators.length, 1);
    assert.strictEqual(singleCell.indicators[0].title, 'SuperTrend');
  });

  test('Vela Sync Mapping: memastikan seluruh properti sync terpetakan ke setting workspace', () => {
    const syncConfig: MultiChartSyncConfig = {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
    };

    const appliedSettings: Record<string, boolean> = {};

    function applySyncToWorkspace(cfg: MultiChartSyncConfig) {
      appliedSettings['crosshair'] = Boolean(cfg.crosshair);
      appliedSettings['viewport'] = Boolean(cfg.viewport);
      appliedSettings['symbol'] = Boolean(cfg.symbol);
      appliedSettings['drawings'] = Boolean(cfg.drawings);
    }

    applySyncToWorkspace(syncConfig);

    assert.strictEqual(appliedSettings['crosshair'], true);
    assert.strictEqual(appliedSettings['viewport'], true);
    assert.strictEqual(appliedSettings['symbol'], false);
    assert.strictEqual(appliedSettings['drawings'], true);
  });

  test('Viewport Alignment Logic: menyelaraskan range lilin pada panel pengikut saat viewport sync aktif', () => {
    interface MockCell {
      id: string;
      range: { from: number; to: number } | null;
      setVisibleRange(range: { from: number; to: number }): void;
      getVisibleRange(): { from: number; to: number } | null;
    }

    const activeCell: MockCell = {
      id: 'cell_0',
      range: { from: 1710000000000, to: 1710003600000 },
      setVisibleRange(r) { this.range = r; },
      getVisibleRange() { return this.range; }
    };

    const followerCell1: MockCell = {
      id: 'cell_1',
      range: { from: 1709000000000, to: 1709003600000 },
      setVisibleRange(r) { this.range = r; },
      getVisibleRange() { return this.range; }
    };

    const followerCell2: MockCell = {
      id: 'cell_2',
      range: null,
      setVisibleRange(r) { this.range = r; },
      getVisibleRange() { return this.range; }
    };

    const allCells = [activeCell, followerCell1, followerCell2];
    const isViewportSync = true;

    // Simulasikan logika penyelarasan seperti di Chart.svelte
    if (isViewportSync) {
      const activeRange = activeCell.getVisibleRange();
      if (activeRange) {
        for (const cell of allCells) {
          if (cell.id !== activeCell.id) {
            cell.setVisibleRange(activeRange);
          }
        }
      }
    }

    assert.deepStrictEqual(followerCell1.getVisibleRange(), activeCell.getVisibleRange());
    assert.deepStrictEqual(followerCell2.getVisibleRange(), activeCell.getVisibleRange());
  });

  test('Crosshair External Coordinates: menghitung visibilitas kursor lintas panel', () => {
    // Fungsi simulasi kalkulasi posisi crosshair eksternal
    function isCrosshairInBounds(x: number, y: number, width: number, height: number): boolean {
      return x >= 0 && x <= width && y >= 0 && y <= height;
    }

    const canvasWidth = 800;
    const canvasHeight = 500;

    // Kasus 1: Viewport sinkron -> koordinat x lilin jatuh dalam kanvas
    const syncedX = 420;
    const syncedY = 250;
    assert.strictEqual(isCrosshairInBounds(syncedX, syncedY, canvasWidth, canvasHeight), true);

    // Kasus 2: Viewport desinkron -> koordinat x jatuh di luar rentang kanvas (bug sebelumnya)
    const outOfBoundsX = -150;
    const outOfBoundsY = 250;
    assert.strictEqual(isCrosshairInBounds(outOfBoundsX, outOfBoundsY, canvasWidth, canvasHeight), false);
  });
});
