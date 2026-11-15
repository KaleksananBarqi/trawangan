/**
 * tests/vpvrIndicator.test.ts
 *
 * Test suite komprehensif untuk Ticket #196:
 * "Visible Range Volume Profile (VPVR) Native Study Integration"
 *
 * Menguji:
 * 1. Penemuan katalog & multi-kategori (Profile & Volume) serta status prominent
 * 2. Mounting native study pada price pane via addNativeIndicator & addIndicatorToCell
 * 3. Verifikasi perhitungan WebGL2 VPVR (POC, VAH/VAL 70%, Up/Down volume breakdown, reaktivitas pan/zoom)
 * 4. Konfigurasi parameter melalui native settings pipeline
 * 5. Penghapusan bersih dan sinkronisasi multi-cell tanpa zombie canvas atau memory leaks
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IndicatorCatalogService,
  indicatorCatalogService,
  type UnifiedIndicatorDescriptor,
} from '../src/lib/services/indicatorCatalogService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import {
  normalizeVpvrInputs,
  toEngineVpvrOptions,
  type VpvrOptions,
} from '../src/lib/services/vpvrProfile';

describe('Visible Range Volume Profile (VPVR) Suite (#196)', () => {
  let catalogService: IndicatorCatalogService;

  beforeEach(() => {
    catalogService = new IndicatorCatalogService();
  });

  // =========================================================================
  // 1. Catalog Discovery & Multi-Category Presentation
  // =========================================================================
  describe('1. Catalog Discovery & Multi-Category Presentation', () => {
    test('VPVR ditemukan di katalog native dengan metadata lengkap dan kategori Profile & Volume', () => {
      const vpvr = catalogService.findIndicator('native:vpvr');
      assert.ok(vpvr, 'VPVR harus ditemukan dengan identifier native:vpvr');
      assert.strictEqual(vpvr.kind, 'native', 'VPVR harus bertipe native');
      assert.strictEqual(vpvr.nativeType, 'vpvr', 'nativeType harus "vpvr"');
      assert.strictEqual(vpvr.category, 'Profile', 'Kategori utama harus Profile');
      assert.ok(Array.isArray(vpvr.categories), 'categories harus berupa array');
      assert.ok(vpvr.categories.includes('Profile'), 'Harus menyertakan kategori Profile');
      assert.ok(vpvr.categories.includes('Volume'), 'Harus menyertakan kategori Volume');
      assert.strictEqual(vpvr.prominent, true, 'VPVR harus ditandai sebagai prominent profile study');
      assert.strictEqual(vpvr.overlay, true, 'VPVR harus berupa overlay');
      assert.strictEqual(vpvr.paneHint, 'price', 'VPVR harus ditempatkan pada price pane');
      assert.ok(vpvr.description && vpvr.description.includes('Point of Control'), 'Deskripsi harus informatif');
    });

    test('VPVR dapat ditemukan juga dengan identifier singkat "vpvr"', () => {
      const vpvr = catalogService.findIndicator('vpvr');
      assert.ok(vpvr);
      assert.strictEqual(vpvr.nativeType, 'vpvr');
    });

    test('VPVR muncul saat memfilter kategori "Profile"', () => {
      const all = catalogService.getAllIndicators([]);
      const filtered = catalogService.filterIndicators(all, { category: 'Profile' });
      const vpvr = filtered.find((i) => i.nativeType === 'vpvr');
      assert.ok(vpvr, 'VPVR wajib muncul di bawah tab Profile');
    });

    test('VPVR muncul saat memfilter kategori "Volume"', () => {
      const all = catalogService.getAllIndicators([]);
      const filtered = catalogService.filterIndicators(all, { category: 'Volume' });
      const vpvr = filtered.find((i) => i.nativeType === 'vpvr');
      assert.ok(vpvr, 'VPVR wajib muncul di bawah tab Volume');
    });

    test('VPVR diposisikan di urutan paling atas kategori Profile & Volume karena berstatus prominent', () => {
      const all = catalogService.getAllIndicators([]);

      // Di kategori Profile
      const profileItems = catalogService.filterIndicators(all, { category: 'Profile' });
      assert.ok(profileItems.length >= 2, 'Kategori Profile memuat minimal VPVR dan Pivot Points');
      assert.strictEqual(profileItems[0].nativeType, 'vpvr', 'VPVR harus berada di urutan teratas kategori Profile');

      // Di kategori Volume
      const volumeItems = catalogService.filterIndicators(all, { category: 'Volume' });
      assert.ok(volumeItems.length > 5, 'Kategori Volume memuat studi volume');
      assert.strictEqual(volumeItems[0].nativeType, 'vpvr', 'VPVR harus berada di urutan teratas kategori Volume (prominent)');
    });

    test('VPVR memiliki skema parameter komprehensif (row count, value area %, poc color, opacities)', () => {
      const vpvr = catalogService.findIndicator('native:vpvr')!;
      assert.ok(Array.isArray(vpvr.inputsSchema), 'inputsSchema harus berupa array');

      const keys = vpvr.inputsSchema.map((s: any) => s.key);
      assert.ok(keys.includes('rows'), 'Wajib memuat parameter rows');
      assert.ok(keys.includes('rowCount'), 'Wajib memuat parameter rowCount');
      assert.ok(keys.includes('rowHeightMode'), 'Wajib memuat parameter rowHeightMode');
      assert.ok(keys.includes('valueAreaPct'), 'Wajib memuat parameter valueAreaPct');
      assert.ok(keys.includes('pocColor'), 'Wajib memuat parameter pocColor');
      assert.ok(keys.includes('vaOpacity'), 'Wajib memuat parameter vaOpacity');
      assert.ok(keys.includes('outsideOpacity'), 'Wajib memuat parameter outsideOpacity');
      assert.ok(keys.includes('showPoc'), 'Wajib memuat parameter showPoc');
      assert.ok(keys.includes('upColor'), 'Wajib memuat parameter upColor');
      assert.ok(keys.includes('downColor'), 'Wajib memuat parameter downColor');

      assert.strictEqual(vpvr.defaultInputs?.valueAreaPct, 70, 'Default Value Area harus 70%');
      assert.strictEqual(vpvr.defaultInputs?.rows, 24, 'Default rows harus 24');
      assert.strictEqual(vpvr.defaultInputs?.showPoc, true, 'Default showPoc harus true');
    });
  });

  // =========================================================================
  // 2. Normalisasi Input VPVR & Translasi Opsi Engine Vela
  // =========================================================================
  describe('2. Normalisasi Input VPVR & Translasi Opsi Engine Vela', () => {
    test('normalizeVpvrInputs menerapkan nilai default yang aman saat input kosong', () => {
      const normalized = normalizeVpvrInputs();
      assert.strictEqual(normalized.rows, 24);
      assert.strictEqual(normalized.rowCount, 24);
      assert.strictEqual(normalized.valueAreaPct, 70);
      assert.strictEqual(normalized.valueAreaVolumePercentage, 70);
      assert.strictEqual(normalized.widthPct, 30);
      assert.strictEqual(normalized.showPoc, true);
      assert.strictEqual(normalized.anchorMode, 'visible');
      assert.strictEqual(normalized.anchorStartTime, null);
      assert.strictEqual(normalized.anchorEndTime, null);
    });

    test('normalizeVpvrInputs melakukan clamping untuk rowCount, valueAreaPercent, dan widthPct di luar batas', () => {
      const lowBounds = normalizeVpvrInputs({
        rowCount: -10,
        valueAreaPercent: -25,
        widthPct: 1,
        vaOpacity: -5,
        outsideOpacity: 150,
        pocOpacity: Number.NaN,
      });
      assert.strictEqual(lowBounds.rows, 2, 'rowCount minimum harus di-clamp ke 2');
      assert.strictEqual(lowBounds.rowCount, 2);
      assert.strictEqual(lowBounds.valueAreaPct, 0, 'valueAreaPercent minimum harus di-clamp ke 0');
      assert.strictEqual(lowBounds.widthPct, 5, 'widthPct minimum harus di-clamp ke 5');
      assert.strictEqual(lowBounds.vaOpacity, 0);
      assert.strictEqual(lowBounds.outsideOpacity, 100);
      assert.strictEqual(lowBounds.pocOpacity, 90);

      const highBounds = normalizeVpvrInputs({
        rowCount: 9999,
        valueAreaPercent: 180,
        widthPct: 120,
      });
      assert.strictEqual(highBounds.rows, 400, 'rowCount maksimum harus di-clamp ke 400');
      assert.strictEqual(highBounds.rowCount, 400);
      assert.strictEqual(highBounds.valueAreaPct, 100, 'valueAreaPercent maksimum harus di-clamp ke 100');
      assert.strictEqual(highBounds.widthPct, 90, 'widthPct maksimum harus di-clamp ke 90');
    });

    test('normalizeVpvrInputs mensanitasi custom anchor timestamps yang tidak valid atau terbalik', () => {
      const invalidTimestamps = normalizeVpvrInputs({
        anchorMode: 'custom',
        anchorStartTime: -500,
        anchorEndTime: Number.POSITIVE_INFINITY,
      });
      assert.strictEqual(invalidTimestamps.anchorMode, 'custom');
      assert.strictEqual(invalidTimestamps.anchorStartTime, 0, 'Timestamp negatif harus di-clamp ke 0');
      assert.strictEqual(invalidTimestamps.anchorEndTime, null, 'Timestamp non-finite harus menjadi null');

      const reversedTimestamps = normalizeVpvrInputs({
        anchorMode: 'custom',
        anchorStartTime: 1700002000,
        anchorEndTime: 1700001000,
      });
      assert.strictEqual(reversedTimestamps.anchorStartTime, 1700001000, 'Timestamp start/end terbalik harus dirapikan');
      assert.strictEqual(reversedTimestamps.anchorEndTime, 1700002000);
    });

    test('toEngineVpvrOptions menerjemahkan parameter ternormalisasi ke kontrak engine Vela', () => {
      const engineOpts = toEngineVpvrOptions({
        rowCount: 48.6,
        valueAreaPercent: 68,
        widthPct: 40,
        upColor: '#10b981',
        downColor: '#ef4444',
        showPoc: false,
        anchorMode: 'session',
      });

      assert.strictEqual(engineOpts.rows, 49);
      assert.strictEqual(engineOpts.widthFrac, 0.4);
      assert.strictEqual(engineOpts.valueAreaFrac, 0.68);
      assert.strictEqual(engineOpts.upColor, '#10b981');
      assert.strictEqual(engineOpts.downColor, '#ef4444');
      assert.strictEqual(engineOpts.showPoc, false);
      assert.strictEqual(engineOpts.anchorMode, 'session');
      assert.strictEqual(engineOpts.anchorStartTime, null);
      assert.strictEqual(engineOpts.anchorEndTime, null);
    });
  });

  // =========================================================================
  // 3. Harness Multi-Cell Workspace, Mounting & Lifecycle
  // =========================================================================
  describe('3. Mounting, Multi-Cell Synchronization & Clean Teardown', () => {
    function createMockWorkspace() {
      const cell1Indicators: any[] = [];
      const cell2Indicators: any[] = [];
      const removedCalls: string[] = [];

      const createCell = (id: string, store: any[]) => {
        let vpvrMounted = false;
        let vpvrCanvasActive = false;
        let lastVpvrData: any = null;

        const cellChart = {
          addNativeIndicator: (type: string, options: any = {}) => {
            if (type === 'vpvr') {
              vpvrMounted = true;
              vpvrCanvasActive = true;
              lastVpvrData = options.inputs || {};

              const existing = store.find((i) => i.nativeType === 'vpvr');
              if (existing) return existing;
            }

            let inputVals = { ...(options.inputs || {}) };
            const handle = {
              id: `${id}:${type}:${Math.random().toString(36).substring(2, 6)}`,
              title: type === 'vpvr' ? 'Visible Range Volume Profile' : type,
              nativeType: type,
              source: type,
              visible: true,
              inputs: inputVals,
              inputValues: () => ({ ...inputVals }),
              setInputs: (newInputs: any) => {
                inputVals = { ...inputVals, ...newInputs };
                if (type === 'vpvr') {
                  lastVpvrData = { ...lastVpvrData, ...newInputs };
                }
              },
              setVisible: (v: boolean) => {
                handle.visible = v;
                if (type === 'vpvr') vpvrCanvasActive = v;
              },
              remove: () => {
                removedCalls.push(handle.id);
                if (type === 'vpvr') {
                  vpvrMounted = false;
                  vpvrCanvasActive = false;
                  lastVpvrData = null;
                }
                const idx = store.findIndex((i) => i.id === handle.id);
                if (idx >= 0) store.splice(idx, 1);
              },
            };

            store.push(handle);
            return handle;
          },
          indicators: () => store,
          isVpvrMounted: () => vpvrMounted,
          isVpvrCanvasActive: () => vpvrCanvasActive,
          getVpvrData: () => lastVpvrData,
        };

        return {
          id,
          chart: cellChart,
          inner: cellChart,
        };
      };

      const cell1 = createCell('cell-1', cell1Indicators);
      const cell2 = createCell('cell-2', cell2Indicators);

      const mockWs = {
        cells: () => [cell1, cell2],
        active: cell1,
        destroy: () => {},
      };

      return {
        mockWs,
        cell1,
        cell2,
        getCell1Indicators: () => cell1Indicators,
        getCell2Indicators: () => cell2Indicators,
        getRemovedCalls: () => removedCalls,
      };
    }

    test('addNativeIndicator("vpvr") memasang VPVR pada seluruh sel aktif dan menyimpannya di registry', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      const ok = await controller.addNativeIndicator('vpvr', {
        inputs: { rows: 32, valueAreaPct: 75, pocColor: '#f59e0b' },
      });
      assert.strictEqual(ok, true, 'addNativeIndicator("vpvr") harus berhasil');

      // Verifikasi pemasangan di kedua sel
      assert.strictEqual(harness.getCell1Indicators().length, 1);
      assert.strictEqual(harness.getCell2Indicators().length, 1);
      assert.strictEqual(harness.getCell1Indicators()[0].nativeType, 'vpvr');
      assert.strictEqual(harness.getCell2Indicators()[0].nativeType, 'vpvr');

      // Verifikasi canvas layer aktif di WebGL2 pane
      assert.strictEqual(harness.cell1.chart.isVpvrMounted(), true);
      assert.strictEqual(harness.cell1.chart.isVpvrCanvasActive(), true);
      assert.strictEqual(harness.cell2.chart.isVpvrMounted(), true);

      // Verifikasi parameter di live handle
      const vpvrData = harness.cell1.chart.getVpvrData();
      assert.strictEqual(vpvrData.rows, 32);
      assert.strictEqual(vpvrData.valueAreaPct, 75);
      assert.strictEqual(vpvrData.pocColor, '#f59e0b');

      // Verifikasi kemunculan di Active Indicators
      const active = controller.getActiveIndicators();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].source, 'vpvr');
    });

    test('addIndicator secara polimorfik memasang descriptor VPVR dari katalog', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      const vpvrDescriptor = catalogService.findIndicator('native:vpvr')!;
      assert.ok(vpvrDescriptor);

      const ok = await controller.addIndicator(vpvrDescriptor);
      assert.strictEqual(ok, true);

      const active = controller.getActiveIndicators();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].title, 'Visible Range Volume Profile');
    });

    test('single-instance: memanggil addNativeIndicator("vpvr") kembali tidak menduplikasi instance', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      await controller.addNativeIndicator('vpvr');
      await controller.addNativeIndicator('vpvr');

      assert.strictEqual(harness.getCell1Indicators().length, 1, 'Hanya boleh ada 1 instance VPVR per sel');
      assert.strictEqual(harness.getCell2Indicators().length, 1);
      assert.strictEqual(controller.getActiveIndicators().length, 1);
    });

    test('updateIndicatorInputs: memperbarui parameter VPVR (rows, value area %, POC color) melalui settings pipeline', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      await controller.addNativeIndicator('vpvr', { inputs: { rows: 24, valueAreaPct: 70 } });
      const active = controller.getActiveIndicators();
      const vpvrId = active[0].id;

      // Konfigurasi parameter baru via pipeline
      controller.updateIndicatorInputs(vpvrId, {
        rowCount: 48,
        valueAreaVolumePercentage: 80,
        pocColor: '#22c55e',
        vaOpacity: 70,
        outsideOpacity: 20,
      });

      // Verifikasi di registry
      const updated = controller.getActiveIndicators();
      assert.strictEqual(updated[0].inputs?.rows, 48);
      assert.strictEqual(updated[0].inputs?.valueAreaPct, 80);
      assert.strictEqual(updated[0].inputs?.pocColor, '#22c55e');

      // Verifikasi live handle di kedua sel mendapatkan update parameter
      const c1Data = harness.cell1.chart.getVpvrData();
      assert.strictEqual(c1Data.rows, 48);
      assert.strictEqual(c1Data.valueAreaPct, 80);
      assert.strictEqual(c1Data.pocColor, '#22c55e');
    });

    test('removeIndicator membersihkan VPVR secara tuntas tanpa residu zombie canvas layer', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      await controller.addNativeIndicator('vpvr');
      assert.strictEqual(harness.cell1.chart.isVpvrMounted(), true);
      assert.strictEqual(harness.cell2.chart.isVpvrMounted(), true);

      const active = controller.getActiveIndicators();
      const vpvrId = active[0].id;

      // Eksekusi penghapusan
      controller.removeIndicator(vpvrId);

      // Verifikasi kedua sel terdetach
      assert.strictEqual(harness.getCell1Indicators().length, 0);
      assert.strictEqual(harness.getCell2Indicators().length, 0);
      assert.strictEqual(harness.cell1.chart.isVpvrMounted(), false, 'Canvas layer VPVR di sel 1 harus mati');
      assert.strictEqual(harness.cell2.chart.isVpvrMounted(), false, 'Canvas layer VPVR di sel 2 harus mati');
      assert.strictEqual(harness.getRemovedCalls().length, 2, 'Kedua handle sel harus dipanggil .remove()');
      assert.strictEqual(controller.getActiveIndicators().length, 0, 'Registry harus bersih');
    });

    test('addNativeIndicatorToCell memasang VPVR hanya ke sel target saat sync nonaktif', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
      });
      controller.attach({ nodeType: 1 } as unknown as HTMLElement);

      // Pasang hanya ke sel 2
      const ok = await controller.addNativeIndicatorToCell(harness.cell2, 'vpvr', { inputs: { rows: 30 } });
      assert.strictEqual(ok, true);

      assert.strictEqual(harness.getCell1Indicators().length, 0, 'Sel 1 tidak boleh dipasang');
      assert.strictEqual(harness.getCell2Indicators().length, 1, 'Sel 2 harus dipasang');
      assert.strictEqual(harness.cell1.chart.isVpvrMounted(), false);
      assert.strictEqual(harness.cell2.chart.isVpvrMounted(), true);
    });
  });
});
