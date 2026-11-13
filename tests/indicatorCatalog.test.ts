import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IndicatorCatalogService,
  ensureNativeIndicatorsRegistered,
  type UnifiedIndicatorDescriptor,
} from '../src/lib/services/indicatorCatalogService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import type { PineScriptRecord } from '../src/lib/types/market';

describe('Unified Indicator Catalog & 76 Native Indicators Suite (#194)', () => {
  let catalogService: IndicatorCatalogService;

  beforeEach(() => {
    catalogService = new IndicatorCatalogService();
  });

  describe('1. Catalog Enumeration & Metadata Integrity', () => {
    test('memastikan seluruh 76 indikator native Vela berhasil diindeks', () => {
      const natives = catalogService.getNativeIndicators();
      assert.strictEqual(natives.length, 76, 'Wajib memuat tepat 76 native indicators bawaan Vela');

      // Validasi integritas setiap entri native
      for (const item of natives) {
        assert.strictEqual(item.kind, 'native', `Kind harus 'native' untuk ${item.id}`);
        assert.ok(item.id.startsWith('native:'), `ID harus diawali 'native:' (${item.id})`);
        assert.ok(item.nativeType && item.nativeType.length > 0, `nativeType wajib ada untuk ${item.id}`);
        assert.ok(item.title && item.title.length > 0, `title tidak boleh kosong untuk ${item.id}`);
        assert.ok(item.category && item.category.length > 0, `category wajib terdefinisi untuk ${item.id}`);
      }
    });

    test('memverifikasi pemetaan kategori indikator native ke 6 famili utama', () => {
      const natives = catalogService.getNativeIndicators();
      const categories = new Set(natives.map((i) => i.category));

      // Seluruh 6 famili kategori native wajib ada
      assert.ok(categories.has('Profile'), 'Kategori Profile wajib ada');
      assert.ok(categories.has('Volume'), 'Kategori Volume wajib ada');
      assert.ok(categories.has('Trend'), 'Kategori Trend wajib ada');
      assert.ok(categories.has('Volatility'), 'Kategori Volatility wajib ada');
      assert.ok(categories.has('Momentum'), 'Kategori Momentum wajib ada');
      assert.ok(categories.has('Signals'), 'Kategori Signals wajib ada');

      // Verifikasi studi kunci berada di kategori yang tepat
      const vpvr = natives.find((i) => i.nativeType === 'vpvr');
      assert.ok(vpvr, 'VPVR harus ada di katalog native');
      assert.strictEqual(vpvr.category, 'Profile', 'VPVR harus berada dalam kategori Profile');
      assert.strictEqual(vpvr.shortTitle, 'VRVP');

      const atr = natives.find((i) => i.nativeType === 'average-true-range');
      assert.ok(atr, 'ATR harus ada');
      assert.strictEqual(atr.category, 'Volatility', 'ATR harus Volatility');
      assert.strictEqual(atr.shortTitle, 'ATR');

      const psar = natives.find((i) => i.nativeType === 'parabolic-sar');
      assert.ok(psar, 'Parabolic SAR harus ada');
      assert.strictEqual(psar.category, 'Trend', 'Parabolic SAR harus Trend');

      const rsi = natives.find((i) => i.nativeType === 'rsi');
      assert.ok(rsi, 'RSI harus ada');
      assert.strictEqual(rsi.category, 'Momentum', 'RSI harus Momentum');

      const obv = natives.find((i) => i.nativeType === 'on-balance-volume');
      assert.ok(obv, 'OBV harus ada');
      assert.strictEqual(obv.category, 'Volume', 'OBV harus Volume');

      const fractal = natives.find((i) => i.nativeType === 'williams-fractal');
      assert.ok(fractal, 'Williams Fractal harus ada');
      assert.strictEqual(fractal.category, 'Signals', 'Williams Fractal harus Signals');
    });

    test('memuat 7 Pine Presets resmi secara harmonis', () => {
      const presets = catalogService.getPinePresets();
      assert.strictEqual(presets.length, 7, 'Harus memuat tepat 7 preset Pine resmi');

      for (const p of presets) {
        assert.strictEqual(p.kind, 'pine');
        assert.ok(p.sourceCode && p.sourceCode.includes('//@version'));
      }
    });

    test('mengagregasi Native + Pine Presets + Skrip Kustom pengguna secara utuh', () => {
      const dummyCustomScripts: PineScriptRecord[] = [
        {
          id: 'script-custom-1',
          title: 'My Custom Breakout',
          code: '//@version=5\nindicator("My Custom Breakout")',
          is_overlay: true,
          created_at: 1710000000000,
          updated_at: 1710000000000,
        },
        {
          id: 'script-custom-2',
          title: 'Liquidity Hunter Oscillator',
          code: '//@version=5\nindicator("Liquidity Hunter")',
          is_overlay: false,
          created_at: 1710000000000,
          updated_at: 1710000000000,
        },
      ];

      const all = catalogService.getAllIndicators(dummyCustomScripts);
      assert.strictEqual(
        all.length,
        76 + 7 + 2,
        'Total indikator gabungan harus 85 (76 Native + 7 Presets + 2 Kustom)'
      );
    });
  });

  describe('2. Real-time Search & Filter Engine', () => {
    test('filter kategori: memfilter daftar berdasarkan tab kategori aktif', () => {
      const all = catalogService.getAllIndicators();

      const trendItems = catalogService.filterIndicators(all, { category: 'Trend' });
      assert.ok(trendItems.length > 0);
      assert.ok(trendItems.every((i) => i.category === 'Trend'));

      const profileItems = catalogService.filterIndicators(all, { category: 'Profile' });
      assert.strictEqual(profileItems.length, 2, 'Profile harus mencakup VPVR dan Pivot Points');
      assert.ok(profileItems.some((i) => i.nativeType === 'vpvr'));
      assert.ok(profileItems.some((i) => i.nativeType === 'pivot-points'));
    });

    test('pencarian teks: menemukan indikator berdasarkan title dan shortTitle', () => {
      const all = catalogService.getAllIndicators();

      // Cari berdasarkan singkatan shortTitle 'VRVP'
      const searchVrvp = catalogService.filterIndicators(all, { searchQuery: 'VRVP' });
      assert.ok(searchVrvp.length >= 1);
      assert.strictEqual(searchVrvp[0].nativeType, 'vpvr');

      // Cari 'Bollinger'
      const searchBb = catalogService.filterIndicators(all, { searchQuery: 'Bollinger' });
      assert.ok(searchBb.length >= 3, 'Harus mencakup BB, %B, dan Bandwidth');

      // Cari 'Keltner'
      const searchKc = catalogService.filterIndicators(all, { searchQuery: 'Keltner' });
      assert.ok(searchKc.length >= 1);
      assert.ok(searchKc.some((i) => i.nativeType === 'keltner-channels'));
    });

    test('pencarian teks word boundary: tidak false-positive pada kata deskripsi', () => {
      const all = catalogService.getAllIndicators();
      const searchRsi = catalogService.filterIndicators(all, { searchQuery: 'RSI' });

      // Harus mencakup RSI, Stoch RSI, Connors RSI, dsb.
      assert.ok(searchRsi.some((i) => i.title === 'Relative Strength Index'));
      assert.ok(searchRsi.some((i) => i.title === 'Stochastic RSI'));
      assert.ok(searchRsi.some((i) => i.title === 'Connors RSI'));

      // TIDAK BOLEH mencakup Standard Deviation hanya karena kata 'dispersi'
      assert.ok(!searchRsi.some((i) => i.nativeType === 'standard-deviation'));
    });

    test('filter jenis (kind): memisahkan native vs pine', () => {
      const all = catalogService.getAllIndicators();

      const nativeOnly = catalogService.filterIndicators(all, { kind: 'native' });
      assert.strictEqual(nativeOnly.length, 76);
      assert.ok(nativeOnly.every((i) => i.kind === 'native'));

      const pineOnly = catalogService.filterIndicators(all, { kind: 'pine' });
      assert.strictEqual(pineOnly.length, 7);
      assert.ok(pineOnly.every((i) => i.kind === 'pine'));
    });
  });

  describe('3. Favorit & Urutan Paling Atas (Priority Sorting)', () => {
    test('indikator favorit diurutkan di bagian paling atas', () => {
      const all = catalogService.getAllIndicators();
      const favIds = ['native:vpvr', 'native:sma'];

      const sorted = catalogService.filterIndicators(all, { favoriteIds: favIds });
      assert.ok(sorted.length > 2);

      // 2 item pertama harus item favorit
      const firstTwoIds = [sorted[0].id, sorted[1].id];
      assert.ok(firstTwoIds.includes('native:vpvr'));
      assert.ok(firstTwoIds.includes('native:sma'));
    });

    test('tab Favorit hanya menampilkan indikator yang dibintangi pengguna', () => {
      const all = catalogService.getAllIndicators();
      const favIds = ['native:average-true-range', 'rsi'];

      const favOnly = catalogService.filterIndicators(all, {
        favoritesOnly: true,
        favoriteIds: favIds,
      });

      assert.strictEqual(favOnly.length, 2);
      assert.ok(favOnly.some((i) => i.nativeType === 'average-true-range'));
      assert.ok(favOnly.some((i) => i.id === 'rsi'));
    });
  });

  describe('4. ChartSessionController & IndicatorRegistry Execution Routing', () => {
    function createMockWorkspace() {
      let cell1Indicators: any[] = [];
      let cell2Indicators: any[] = [];
      let removedCalls: string[] = [];

      const createCell = (cellId: string, indicatorsStore: any[]) => ({
        id: cellId,
        chart: {
          id: cellId,
          addNativeIndicator: (type: string, options: any) => {
            const handle: any = {
              id: `native_${type}_${cellId}_${Math.random()}`,
              nativeType: type,
              title: options?.title || type,
              visible: true,
              inputs: options?.inputs || {},
              remove: () => {
                removedCalls.push(handle.id);
                const idx = indicatorsStore.findIndex((x) => x.id === handle.id);
                if (idx !== -1) indicatorsStore.splice(idx, 1);
              },
              setVisible: (v: boolean) => { handle.visible = v; },
              setInputs: (i: any) => { handle.inputs = { ...handle.inputs, ...i }; },
            };
            indicatorsStore.push(handle);
            return handle;
          },
          addIndicator: (code: string, options: any) => {
            const handle: any = {
              id: `pine_${cellId}_${Math.random()}`,
              title: options?.title || 'Pine Indicator',
              source: code,
              visible: true,
              inputs: options?.inputs || {},
              remove: () => {
                removedCalls.push(handle.id);
                const idx = indicatorsStore.findIndex((x) => x.id === handle.id);
                if (idx !== -1) indicatorsStore.splice(idx, 1);
              },
              setVisible: (v: boolean) => { handle.visible = v; },
              setInputs: (i: any) => { handle.inputs = { ...handle.inputs, ...i }; },
            };
            indicatorsStore.push(handle);
            return handle;
          },
          indicators: () => indicatorsStore,
        },
      });

      const cell1 = createCell('c1', cell1Indicators);
      const cell2 = createCell('c2', cell2Indicators);

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

    test('addNativeIndicator memasang indikator native ke seluruh sel aktif dan mendaftar di IndicatorRegistry', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });

      controller.attach({ nodeType: 1 } as any);

      // Panggil addNativeIndicator untuk 'average-true-range'
      const ok = await controller.addNativeIndicator('average-true-range', { inputs: { length: 14 } }, 'ATR (14)');
      assert.strictEqual(ok, true);

      // Pastikan kedua sel di workspace memiliki handle native
      assert.strictEqual(harness.getCell1Indicators().length, 1);
      assert.strictEqual(harness.getCell2Indicators().length, 1);
      assert.strictEqual(harness.getCell1Indicators()[0].nativeType, 'average-true-range');
      assert.strictEqual(harness.getCell2Indicators()[0].nativeType, 'average-true-range');

      // Pastikan tercatat di getActiveIndicators()
      const active = controller.getActiveIndicators();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].title, 'ATR (14)');

      // Hapus indikator dan verifikasi kedua sel terbebas dari zombie indicator
      controller.removeIndicator(active[0].id);
      assert.strictEqual(harness.getCell1Indicators().length, 0);
      assert.strictEqual(harness.getCell2Indicators().length, 0);
      assert.strictEqual(harness.getRemovedCalls().length, 2, 'Kedua handle cell harus di-remove()');
      assert.strictEqual(controller.getActiveIndicators().length, 0);
    });

    test('addIndicator polimorfik mendelegasikan secara tepat: native -> addNativeIndicator, pine -> addIndicator', async () => {
      const harness = createMockWorkspace();
      let nativeCalled = 0;
      let pineCalled = 0;

      // Pantau pemanggilan
      const origNative = harness.cell1.chart.addNativeIndicator;
      harness.cell1.chart.addNativeIndicator = (type: string, opts: any) => {
        nativeCalled++;
        return origNative(type, opts);
      };

      const origPine = harness.cell1.chart.addIndicator;
      harness.cell1.chart.addIndicator = (code: string, opts: any) => {
        pineCalled++;
        return origPine(code, opts);
      };

      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
      });
      controller.attach({ nodeType: 1 } as any);

      // 1. Eksekusi descriptor Native (VPVR)
      const vpvrDesc = catalogService.findIndicator('native:vpvr');
      assert.ok(vpvrDesc);
      const okNative = await controller.addIndicator(vpvrDesc);
      assert.strictEqual(okNative, true);
      assert.strictEqual(nativeCalled, 1, 'Wajib memanggil addNativeIndicator');
      assert.strictEqual(pineCalled, 0, 'Tidak boleh memanggil addIndicator untuk native study');

      // 2. Eksekusi descriptor Pine (RSI Preset)
      const rsiPreset = catalogService.findIndicator('rsi');
      assert.ok(rsiPreset);
      const okPine = await controller.addIndicator(rsiPreset);
      assert.strictEqual(okPine, true);
      assert.strictEqual(nativeCalled, 1);
      assert.strictEqual(pineCalled, 1, 'Wajib memanggil addIndicator untuk Pine preset');

      // Verifikasi kedua indikator hidup di registry
      const active = controller.getActiveIndicators();
      assert.strictEqual(active.length, 2);
    });

    test('addNativeIndicatorToCell memasang hanya ke sel spesifik ketika syncConfig.indicators nonaktif', async () => {
      const harness = createMockWorkspace();
      const controller = new ChartSessionController({
        workspaceFactory: () => harness.mockWs,
        syncConfig: { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: false },
      });
      controller.attach({ nodeType: 1 } as any);

      const ok = await controller.addNativeIndicatorToCell(harness.cell2, 'supertrend', {}, 'SuperTrend');
      assert.strictEqual(ok, true);

      // Hanya sel 2 yang dipasang
      assert.strictEqual(harness.getCell1Indicators().length, 0);
      assert.strictEqual(harness.getCell2Indicators().length, 1);
      assert.strictEqual(harness.getCell2Indicators()[0].nativeType, 'supertrend');
    });
  });
});
