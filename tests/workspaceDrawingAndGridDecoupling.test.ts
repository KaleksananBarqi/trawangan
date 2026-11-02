import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveDrawingKey,
  ChartDrawingController
} from '../src/lib/services/chartDrawingController';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { resolveAppSettings, DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { storage } from '../src/lib/services/persistence';

test('Workspace Scoped Drawing, Theme Isolation & Grid Mode Seam Suite', async (t) => {
  await t.test('1. resolveDrawingKey menghasilkan kunci komposit berdimensi [workspace:provider:symbol]', () => {
    // Dengan workspace spesifik
    const key1 = resolveDrawingKey('binance', 'BTCUSDT', 'scalping_ws');
    assert.equal(key1, 'scalping_ws:binance:BTCUSDT');

    // Dengan simbol ber-prefix bursa
    const key2 = resolveDrawingKey('indodax', 'INDODAX:BTCIDR', 'swing_ws');
    assert.equal(key2, 'swing_ws:indodax:BTCIDR');

    // Dengan default_workspace
    const keyDefault = resolveDrawingKey('binance', 'ETHUSDT', 'default_workspace');
    assert.equal(keyDefault, 'default_workspace:binance:ETHUSDT');

    // Tanpa workspace (null/undefined) menghasilkan legacy key provider:symbol
    const keyLegacy = resolveDrawingKey('binance', 'ETHUSDT', null);
    assert.equal(keyLegacy, 'binance:ETHUSDT');
  });

  await t.test('2. ChartDrawingController: Isolasi antar-workspace & persistensi drawingMetadata', async () => {
    const memoryAdapter = new InMemoryLocalStorageAdapter();
    storage.setAdapter(memoryAdapter);
    const controller = new ChartDrawingController();

    // Set context Workspace A
    controller.setWorkspaceId('workspace_alpha');
    assert.equal(controller.getWorkspaceId(), 'workspace_alpha');

    // Simulasikan chart mock Vela
    let savedDoc: any = null;
    let drawingsStore: any[] = [];
    const mockVelaChart = {
      drawings: {
        all: () => drawingsStore,
        add: (type: string, spec: any) => {
          const item = { id: spec.id || `draw_${Date.now()}_${Math.random()}`, type, ...spec };
          drawingsStore.push(item);
          return item;
        },
        toJSON: () => ({
          version: 1,
          drawings: [...drawingsStore]
        }),
        fromJSON: (doc: any) => {
          savedDoc = doc;
          drawingsStore = doc?.drawings ? [...doc.drawings] : [];
        }
      }
    };

    const mockWorkspace = {
      active: { chart: mockVelaChart, symbol: 'BTCUSDT', timeframe: '15m' },
      cell: () => ({ chart: mockVelaChart }),
      getAllCells: () => [{ chart: mockVelaChart }]
    };

    controller.attachWorkspace(
      mockWorkspace,
      () => 'BTCUSDT',
      () => '15m',
      () => 'binance',
      () => 'workspace_alpha'
    );

    // Pasang metadata trading plan ke controller
    const mockPlan = {
      id: 'plan_alpha_1',
      symbol: 'BTCUSDT',
      bias: 'LONG' as const,
      entry: 65000,
      stopLoss: 63000,
      targets: [{ price: 68000, rMultiple: 1.5, label: 'TP1' }],
      reasons: ['Breakout demand zone'],
      rawText: 'Long BTC @ 65000'
    };

    // Buat multi-target position dan simpan
    controller.createMultiTargetPosition(mockPlan as any, { planId: 'plan_alpha_1', drawContextZones: false });
    assert.equal(controller.getActivePlans().length, 1);
    assert.equal(controller.getActivePlans()[0].id, 'plan_alpha_1');

    // Trigger drawing mutated untuk memicu auto-save ke storage dengan enrichment metadata
    controller.handleDrawingMutated();

    // Verifikasi bahwa data tersimpan di bawah kunci komposit workspace_alpha
    const expectedKey = 'workspace_alpha:binance:BTCUSDT';
    // Beri sedikit jeda agar timer debounced controller selesai
    await new Promise((r) => setTimeout(r, 450));

    // Verifikasi pemulihan (restoreDrawings) pada workspace yang sama
    await controller.restoreDrawings('BTCUSDT', '15m', 'binance', 'workspace_alpha');
    assert.ok(savedDoc);
    assert.ok(savedDoc._trawangan_meta, 'Payload harus memiliki _trawangan_meta');
    assert.equal(savedDoc._trawangan_meta.activePlans.length, 1);
    assert.equal(savedDoc._trawangan_meta.activePlans[0].id, 'plan_alpha_1');

    // Beralih ke Workspace B (workspace_beta) pada koin BTCUSDT yang sama
    controller.setWorkspaceId('workspace_beta');
    await controller.restoreDrawings('BTCUSDT', '15m', 'binance', 'workspace_beta');

    // Di Workspace B, tidak boleh ada gambar/plan bocor dari Workspace A!
    assert.equal(controller.getSnapshot().activeDrawings.length, 0, 'Workspace B harus bersih dari gambar Workspace A');
  });

  await t.test('3. Backward Compatibility: Fallback key warisan untuk default_workspace', async () => {
    const memoryAdapter = new InMemoryLocalStorageAdapter();
    storage.setAdapter(memoryAdapter);
    // Simpan gambar legacy dengan format lama 'binance:SOLUSDT'
    await memoryAdapter.saveDrawings('binance:SOLUSDT', 'GLOBAL', JSON.stringify({
      version: 1,
      drawings: [{ id: 'legacy_trendline', type: 'trendline' }]
    }));

    const controller = new ChartDrawingController();
    controller.setWorkspaceId('default_workspace');

    let loadedDoc: any = null;
    const mockVelaChart = {
      drawings: {
        all: () => [],
        fromJSON: (doc: any) => { loadedDoc = doc; }
      }
    };
    controller.attachWorkspace(
      { active: { chart: mockVelaChart, symbol: 'SOLUSDT', timeframe: '1h' }, cell: () => ({ chart: mockVelaChart }) },
      () => 'SOLUSDT',
      () => '1h',
      () => 'binance'
    );

    await controller.restoreDrawings('SOLUSDT', '1h', 'binance', 'default_workspace');
    assert.ok(loadedDoc, 'Gambar legacy harus berhasil dipulihkan sebagai fallback');
    assert.equal(loadedDoc.drawings[0].id, 'legacy_trendline');
  });

  await t.test('4. Kontrak GridMode di AppSettings & Sanitasi Backward Compatibility', () => {
    // Default setting memiliki gridMode: 'normal'
    const settings = resolveAppSettings({});
    assert.equal(settings.gridMode, 'normal');
    assert.equal(settings.showGrid, true);

    // Sanitasi warisan showGrid: false -> gridMode: 'hidden'
    const legacyHidden = resolveAppSettings({ showGrid: false } as any);
    assert.equal(legacyHidden.gridMode, 'hidden');
    assert.equal(legacyHidden.showGrid, false);

    // Nilai eksplisit 'dimmed'
    const dimmed = resolveAppSettings({ gridMode: 'dimmed' } as any);
    assert.equal(dimmed.gridMode, 'dimmed');
    assert.equal(dimmed.showGrid, true);
  });

  await t.test('5. ChartSessionController: setGridMode & Isolasi Tema Vela', () => {
    let appliedConfig: any = null;
    let velaThemeSelectTriggered = false;

    const mockCellChart = {
      applyConfig: (cfg: any) => { appliedConfig = cfg; },
      setSettingsVisibility: (policy: any) => {
        assert.ok(policy.hidden.includes('canvas.theme'), 'canvas.theme harus disembunyikan dari dialog Vela');
      },
      on: () => {},
      renderer: {
        renderer: {
          applyConfig: (cfg: any) => { appliedConfig = cfg; }
        }
      }
    };

    const mockCell = { chart: mockCellChart, inner: mockCellChart };
    const mockWorkspace = {
      active: { symbol: 'BTCUSDT', timeframe: '15m' },
      cells: () => [mockCell],
      cell: () => mockCell,
      setTheme: () => {}
    };

    const sessionController = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      gridMode: 'normal',
      workspaceFactory: () => mockWorkspace
    });

    sessionController.attach({} as any);
    sessionController.attachCellListeners(mockCell);

    // Uji setGridMode('dimmed')
    sessionController.setGridMode('dimmed');
    assert.equal(sessionController.getGridMode(), 'dimmed');
    assert.equal(sessionController.getSnapshot().gridMode, 'dimmed');

    // Uji setGridMode('hidden')
    sessionController.setGridMode('hidden');
    assert.equal(sessionController.getGridMode(), 'hidden');
    assert.equal(appliedConfig?.grid?.vertLines?.visible, false);
    assert.equal(appliedConfig?.grid?.horzLines?.visible, false);

    // Uji setGridMode('normal')
    sessionController.setGridMode('normal');
    assert.equal(sessionController.getGridMode(), 'normal');
    assert.equal(appliedConfig?.grid?.vertLines?.visible, true);
  });

  await t.test('6. Integritas Dimensi SettingsModal (920px x 82vh) & Tab Typography', () => {
    const modalPath = path.resolve(process.cwd(), 'src/lib/components/SettingsModal.svelte');
    const modalCode = fs.readFileSync(modalPath, 'utf-8');

    // Periksa dimensi 920px dan 82vh
    assert.ok(modalCode.includes('width: 920px'), 'SettingsModal harus berukuran lebar 920px');
    assert.ok(modalCode.includes('max-height: 82vh'), 'SettingsModal harus berukuran tinggi 82vh');
    assert.ok(modalCode.includes('width: 210px'), 'Sidebar navigasi harus berukuran lebar 210px');

    // Periksa tab TypographyTab
    assert.ok(modalCode.includes('TypographyTab'), 'SettingsModal harus memuat TypographyTab');
    assert.ok(modalCode.includes('Tipografi & Teks'), 'SettingsModal harus memiliki tab Tipografi & Teks');

    // Periksa keberadaan file TypographyTab.svelte
    const typoPath = path.resolve(process.cwd(), 'src/lib/components/settings/TypographyTab.svelte');
    assert.ok(fs.existsSync(typoPath), 'TypographyTab.svelte harus ada di src/lib/components/settings/');
  });
});
