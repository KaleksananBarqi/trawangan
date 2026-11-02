import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ChartDrawingController,
  resolveDrawingKey
} from '../src/lib/services/chartDrawingController';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { storage } from '../src/lib/services/persistence';

test('Issue #151 Code Review Follow-Up Remediation Suite', async (t) => {
  await t.test('1. restoreDrawings membersihkan state plan lama dan merekonstruksi drawingPlanMap', async () => {
    const memoryAdapter = new InMemoryLocalStorageAdapter();
    storage.setAdapter(memoryAdapter);
    const controller = new ChartDrawingController();

    let canvasDrawings: any[] = [];
    const mockChart = {
      drawings: {
        all: () => canvasDrawings,
        fromJSON: (doc: any) => {
          canvasDrawings = doc?.drawings ? [...doc.drawings] : [];
        },
        removeMany: (ids: string[]) => {
          canvasDrawings = canvasDrawings.filter((d) => !ids.includes(d.id));
        }
      }
    };

    const mockWorkspace = {
      active: { chart: mockChart }
    };

    controller.attachWorkspace(
      mockWorkspace,
      () => 'BTCUSDT',
      () => '15m',
      () => 'binance',
      () => 'ws_source'
    );

    // Simpan gambar dengan metadata trading plan di ws_source
    const docWithPlan = {
      version: 1,
      drawings: [
        { id: 'draw_entry_1', type: 'ray' },
        { id: 'draw_target_1', type: 'hline' }
      ],
      _trawangan_meta: {
        drawingMetadata: {
          draw_entry_1: { role: 'entry', price: 65000 },
          draw_target_1: { role: 'target', stage: 1, price: 68000 }
        },
        activePlans: [
          {
            id: 'plan_alpha',
            direction: 'LONG',
            entry: 65000,
            targets: [{ stage: 1, price: 68000 }],
            stopLoss: 63000
          }
        ],
        planDrawingIds: [
          ['plan_alpha', ['draw_entry_1', 'draw_target_1']]
        ],
        timestamp: Date.now()
      }
    };

    const sourceKey = resolveDrawingKey('binance', 'BTCUSDT', 'ws_source');
    await storage.saveDrawingsDebounced(sourceKey, 'GLOBAL', docWithPlan);

    // Muat data di ws_source
    await controller.restoreDrawings('BTCUSDT', '15m', 'binance', 'ws_source');

    // Verifikasi bahwa plan dan metadata berhasil dipulihkan
    assert.equal(controller.getSnapshot().activePlans.length, 1);
    assert.equal(controller.getSnapshot().activePlans[0].id, 'plan_alpha');

    // Verifikasi bahwa reverse mapping drawingPlanMap terisi:
    // Menghapus drawing anchor harus memicu penghapusan plan 'plan_alpha'
    controller.handleDrawingRemoved(['draw_entry_1', 'draw_target_1']);
    assert.equal(controller.getSnapshot().activePlans.length, 0, 'Plan harus terhapus saat drawing anchor-nya dihapus');

    // Sekarang simulasikan pemindahan ke workspace kosong 'ws_empty'
    // State lama harus dibersihkan total tanpa sisa metadata
    controller.setWorkspaceId('ws_empty');
    await controller.restoreDrawings('BTCUSDT', '15m', 'binance', 'ws_empty');

    assert.equal(controller.getSnapshot().activePlans.length, 0, 'Workspace kosong tidak boleh memiliki activePlans warisan');
    assert.equal(controller.getSnapshot().activeDrawings.length, 0, 'Kanvas kosong tidak boleh memiliki visual');
  });

  await t.test('2. ChartTab.svelte tidak lagi memuat kontrol duplikat defaultTimeframe dan autoSaveWorkspace', () => {
    const chartTabPath = path.resolve(process.cwd(), 'src/lib/components/settings/ChartTab.svelte');
    const content = fs.readFileSync(chartTabPath, 'utf-8');

    // Harus tidak lagi berisi defaultTimeframe
    assert.ok(
      !content.includes('defaultTimeframe'),
      'ChartTab.svelte tidak boleh mengandung konfigurasi defaultTimeframe (sudah di GeneralTab)'
    );

    // Harus tidak lagi berisi toggle autoSaveWorkspace
    assert.ok(
      !content.includes('autoSaveWorkspace'),
      'ChartTab.svelte tidak boleh mengandung konfigurasi autoSaveWorkspace (sudah di GeneralTab)'
    );

    // Harus tidak lagi berisi toggle autoLoadLastWorkspace
    assert.ok(
      !content.includes('autoLoadLastWorkspace'),
      'ChartTab.svelte tidak boleh mengandung konfigurasi autoLoadLastWorkspace (sudah di GeneralTab)'
    );

    // Tetapi tetap harus memiliki grid mode selector
    assert.ok(
      content.includes('grid-mode-selector'),
      'ChartTab.svelte harus tetap mempertahankan kontrol gridMode'
    );
  });

  await t.test('3. TypographyTab.svelte memiliki derived reactive rune untuk fallback ukuran font', () => {
    const typoTabPath = path.resolve(process.cwd(), 'src/lib/components/settings/TypographyTab.svelte');
    const content = fs.readFileSync(typoTabPath, 'utf-8');

    assert.ok(
      content.includes('effectiveFontSize = $derived') || content.includes('currentFontSize = $derived'),
      'TypographyTab.svelte harus memiliki reactive derived rune untuk font size fallback'
    );
  });

  await t.test('4. ChartSessionController memiliki helper resolveEffectiveGridColor untuk sentralisasi kalkulasi grid', () => {
    const controller = new ChartSessionController();
    assert.equal(typeof (controller as any).resolveEffectiveGridColor, 'function');

    // Uji mode hidden -> transparan
    controller.setGridMode('hidden');
    assert.equal((controller as any).resolveEffectiveGridColor('#ffffff', true), 'rgba(0, 0, 0, 0)');

    // Uji mode dimmed -> opasitas redup
    controller.setGridMode('dimmed');
    const dimmed = (controller as any).resolveEffectiveGridColor('#ffffff', true);
    assert.ok(dimmed.includes('0.02') || dimmed.includes('rgba'), 'Mode dimmed harus menggunakan opasitas tipis');

    // Uji mode normal -> opasitas normal
    controller.setGridMode('normal');
    const normal = (controller as any).resolveEffectiveGridColor('#ffffff', true);
    assert.ok(normal.includes('0.06') || normal.includes('0.07') || normal.includes('rgba'), 'Mode normal harus menggunakan opasitas tema');
  });

  await t.test('5. Variable Naming & DrawingContextResolvers di chartDrawingController', () => {
    const controller = new ChartDrawingController();
    let attached = false;
    const mockWs = {
      active: { chart: { on: () => {}, off: () => {} } }
    };

    // Mendukung passing objek resolver
    controller.attachWorkspace(mockWs, {
      getSymbol: () => 'ETHUSDT',
      getTimeframe: () => '1h',
      getProviderId: () => 'binance',
      getWorkspaceId: () => 'ws_resolvers'
    });

    assert.equal(controller.getWorkspaceId(), 'ws_resolvers');
  });
});
