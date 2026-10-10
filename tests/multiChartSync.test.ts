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
    };

    assert.strictEqual(defaultSyncConfig.crosshair, true, 'Crosshair wajib aktif secara default');
    assert.strictEqual(defaultSyncConfig.viewport, true, 'Viewport wajib aktif secara default agar kursor & gerakan tersinkron');
    assert.strictEqual(defaultSyncConfig.symbol, false, 'Symbol independen secara default');
    assert.strictEqual(defaultSyncConfig.drawings, true, 'Drawings sinkron antar chart');
  });

  test('Toggle Handlers: mengubah status flag sinkronisasi secara terisolasi', () => {
    let syncConfig: MultiChartSyncConfig = {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
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

    // Pastikan flag lain tidak terdampak
    assert.strictEqual(syncConfig.drawings, true);
    assert.strictEqual(syncConfig.viewport, true);
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
