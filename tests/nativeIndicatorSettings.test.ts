import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureNativeIndicatorsRegistered,
  type UnifiedIndicatorDescriptor,
  IndicatorCatalogService,
} from '../src/lib/services/indicatorCatalogService';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { IndicatorRegistry } from '../src/lib/services/indicatorRegistry';
import { getNativeIndicator, nativeIndicatorDescriptors } from '@luxalgo/vela';
import type { NativeIndicatorSnapshot } from '../src/lib/types/market';

describe('Native Indicator Settings Dialog & Persistence Suite (#195)', () => {
  beforeEach(() => {
    ensureNativeIndicatorsRegistered();
  });

  describe('1. Native Input Schema Extraction & Typed Schema Parsing', () => {
    test('mengekstrak skema input dari descriptor native Vela untuk seluruh keluarga indikator', () => {
      const descriptors = nativeIndicatorDescriptors();
      assert.ok(descriptors.length >= 76, 'Harus ada minimal 76 deskriptor indikator native');

      // 1. Uji SMA (tipe: int, string/source, color)
      const sma = getNativeIndicator('sma');
      assert.ok(sma, 'SMA descriptor wajib ditemukan');
      const smaSchema = sma.inputsSchema();
      assert.ok(Array.isArray(smaSchema), 'SMA inputsSchema harus berupa array');

      const lengthInput = smaSchema.find((s) => s.key === 'length');
      assert.ok(lengthInput, 'SMA harus memiliki input length');
      assert.strictEqual(lengthInput.type, 'int', 'Length harus bertipe int');
      assert.strictEqual(lengthInput.defval, 20, 'Default length SMA adalah 20');
      assert.strictEqual(lengthInput.min, 1, 'Min length SMA adalah 1');

      const sourceInput = smaSchema.find((s) => s.key === 'source');
      assert.ok(sourceInput, 'SMA harus memiliki input source');
      assert.ok(sourceInput.options && sourceInput.options.length > 0, 'Source harus memiliki pilihan options');
      assert.ok(sourceInput.options.includes('Close'), 'Options source harus mencakup Close');

      const colorInput = smaSchema.find((s) => s.key === 'color');
      assert.ok(colorInput, 'SMA harus memiliki input color');
      assert.strictEqual(colorInput.type, 'color', 'Color input harus bertipe color');

      // 2. Uji RSI (tipe: int, float, color)
      const rsi = getNativeIndicator('rsi');
      assert.ok(rsi, 'RSI descriptor wajib ditemukan');
      const rsiSchema = rsi.inputsSchema();
      const overbought = rsiSchema.find((s) => s.key === 'overbought');
      assert.ok(overbought, 'RSI harus memiliki input overbought');
      assert.strictEqual(overbought.type, 'float', 'Overbought harus bertipe float');
      assert.strictEqual(overbought.defval, 70, 'Default overbought adalah 70');

      // 3. Uji Bollinger Bands (tipe: int, float/mult, color/basisColor)
      const bb = getNativeIndicator('bollinger-bands');
      assert.ok(bb, 'Bollinger Bands descriptor wajib ditemukan');
      const bbSchema = bb.inputsSchema();
      const mult = bbSchema.find((s) => s.key === 'mult');
      assert.ok(mult, 'BB harus memiliki input mult');
      assert.strictEqual(mult.type, 'float');
      assert.strictEqual(mult.defval, 2);

      // 4. Uji VPVR / Volume (tipe: bool, int)
      const vpvr = getNativeIndicator('vpvr');
      assert.ok(vpvr, 'VPVR descriptor wajib ditemukan');
      const vpvrSchema = vpvr.inputsSchema();
      const poc = vpvrSchema.find((s) => s.key === 'showPoc');
      assert.ok(poc, 'VPVR harus memiliki input showPoc bertipe bool');
      assert.strictEqual(poc.type, 'bool');
      assert.strictEqual(poc.defval, true);
    });

    test('memverifikasi ketersediaan handle.descriptor.inputs dan handle.inputs pada native handle', async () => {
      const controller = new ChartSessionController();
      let capturedHandle: any = null;

      const mockChart = {
        addNativeIndicator: (type: string, options: any) => {
          const desc = getNativeIndicator(type);
          const handle = {
            id: `test-ind-${type}`,
            title: desc?.title || type,
            nativeType: type,
            inputs: desc?.inputsSchema() || [],
            visible: true,
            _inputs: { ...(desc?.defaultInputs() || {}), ...(options?.inputs || {}) },
            inputValues: function() { return { ...this._inputs }; },
            setInputs: function(vals: any) { this._inputs = { ...this._inputs, ...vals }; },
          };
          capturedHandle = handle;
          return handle;
        },
        indicators: () => (capturedHandle ? [capturedHandle] : []),
      };

      const mockCell = {
        chart: mockChart,
        id: 'cell-0',
      };

      (controller as any).workspace = {
        active: mockCell,
      };
      (controller as any).getAllCells = () => [mockCell];

      const ok = await controller.addNativeIndicator('rsi', { inputs: { length: 21 } });
      assert.ok(ok, 'Berhasil menambahkan native RSI');
      assert.ok(capturedHandle, 'Handle native berhasil dibuat');

      // Verifikasi pengayaan handle oleh ChartSessionController
      assert.strictEqual(typeof capturedHandle.update, 'function', 'Handle wajib memiliki method update()');
      assert.ok(capturedHandle.descriptor, 'Handle wajib memiliki referensi descriptor');
      assert.ok(Array.isArray(capturedHandle.descriptor.inputs), 'handle.descriptor.inputs harus terdefinisi sebagai array');
      assert.strictEqual(capturedHandle.descriptor.type, 'rsi');

      // Ambil schema via controller API publik
      const extractedSchema = controller.getIndicatorInputSchema(capturedHandle.id);
      assert.ok(Array.isArray(extractedSchema) && extractedSchema.length > 0, 'Schema berhasil diekstrak via controller');
      assert.ok(extractedSchema.some((s) => s.key === 'length'));
    });
  });

  describe('2. Update Dispatching & Reactive Execution (handle.update)', () => {
    test('memanggil handle.update(newInputs) memperbarui parameter dan memicu recompute', async () => {
      const controller = new ChartSessionController();
      let lastAppliedInputs: any = null;

      const mockHandle: any = {
        id: 'rsi-study-1',
        title: 'Relative Strength Index',
        nativeType: 'rsi',
        inputs: getNativeIndicator('rsi')?.inputsSchema() || [],
        visible: true,
        _stored: { length: 14, overbought: 70 },
        inputValues: function() { return { ...this._stored }; },
        setInputs: function(vals: any) {
          this._stored = { ...this._stored, ...vals };
          lastAppliedInputs = { ...this._stored };
        },
      };

      const mockChart = {
        addNativeIndicator: () => mockHandle,
        indicators: () => [mockHandle],
      };

      const mockCell = { chart: mockChart, id: 'cell-0' };
      (controller as any).workspace = { active: mockCell };
      (controller as any).getAllCells = () => [mockCell];

      await controller.addNativeIndicator('rsi');

      // 1. Panggil langsung handle.update
      assert.strictEqual(typeof mockHandle.update, 'function');
      mockHandle.update({ length: 25, overbought: 80 });

      assert.deepStrictEqual(lastAppliedInputs, { length: 25, overbought: 80 }, 'setInputs harus dipanggil oleh handle.update');
      assert.strictEqual(mockHandle.inputValues().length, 25);

      // 2. Panggil via controller.updateIndicatorInputs
      let persistEmitted = false;
      (controller as any).onPersistableStateChange = () => { persistEmitted = true; };

      const updateOk = controller.updateIndicatorInputs('rsi-study-1', { length: 30 });
      assert.ok(updateOk, 'Pembaruan input via controller berhasil');
      assert.strictEqual(mockHandle.inputValues().length, 30);
      assert.ok(persistEmitted, 'Persistable change harus terpancar saat parameter diubah');
    });

    test('propagasi pembaruan input ke seluruh sel multi-chart jika sinkronisasi aktif', async () => {
      const controller = new ChartSessionController();

      const cell0Handle: any = {
        id: 'sma-c0',
        title: 'SMA',
        nativeType: 'sma',
        visible: true,
        _val: 20,
        inputValues() { return { length: this._val }; },
        setInputs(v: any) { if (v.length) this._val = v.length; },
      };

      const cell1Handle: any = {
        id: 'sma-c1',
        title: 'SMA',
        nativeType: 'sma',
        visible: true,
        _val: 20,
        inputValues() { return { length: this._val }; },
        setInputs(v: any) { if (v.length) this._val = v.length; },
      };

      const cell0 = {
        id: 'cell-0',
        chart: {
          addNativeIndicator: () => cell0Handle,
          indicators: () => [cell0Handle],
        },
      };

      const cell1 = {
        id: 'cell-1',
        chart: {
          addNativeIndicator: () => cell1Handle,
          indicators: () => [cell1Handle],
        },
      };

      (controller as any).workspace = { active: cell0 };
      (controller as any).getAllCells = () => [cell0, cell1];
      controller.syncLayout({ indicators: true });

      await controller.addNativeIndicator('sma');

      // Ubah parameter indikator
      controller.updateIndicatorInputs(cell0Handle.id, { length: 50 });

      // Verifikasi kedua sel menerima pembaruan parameter
      assert.strictEqual(cell0Handle.inputValues().length, 50, 'Cell 0 harus menerima length 50');
      assert.strictEqual(cell1Handle.inputValues().length, 50, 'Cell 1 harus menerima length 50');
    });
  });

  describe('3. Dialog Revert on Cancel Semantics', () => {
    test('membatalkan dialog pengaturan mengembalikan parameter ke snapshot awal', async () => {
      const controller = new ChartSessionController();

      const initialInputs = { length: 14, overbought: 70, oversold: 30 };
      let currentLiveInputs = { ...initialInputs };

      const mockHandle: any = {
        id: 'rsi-revert-test',
        title: 'RSI',
        nativeType: 'rsi',
        inputValues() { return { ...currentLiveInputs }; },
        setInputs(v: any) { currentLiveInputs = { ...currentLiveInputs, ...v }; },
      };

      const mockCell = {
        id: 'cell-0',
        chart: {
          addNativeIndicator: () => mockHandle,
          indicators: () => [mockHandle],
        },
      };

      (controller as any).workspace = { active: mockCell };
      (controller as any).getAllCells = () => [mockCell];

      await controller.addNativeIndicator('rsi');

      // Simulasi pembukaan dialog settings:
      // 1. Simpan snapshot awal sebelum trader menggeser input
      const snapshotBeforeEdit = { ...mockHandle.inputValues() };
      assert.strictEqual(snapshotBeforeEdit.length, 14);

      // 2. Trader mengubah nilai input secara interaktif (live typing / slider)
      mockHandle.update({ length: 99, overbought: 90 });
      assert.strictEqual(currentLiveInputs.length, 99);
      assert.strictEqual(currentLiveInputs.overbought, 90);

      // 3. Trader menekan "Batal" (Cancel / Escape) tanpa Apply
      // Logika revert: kembalikan ke snapshotBeforeEdit
      mockHandle.update(snapshotBeforeEdit);
      controller.updateIndicatorInputs(mockHandle.id, snapshotBeforeEdit);

      // 4. Verifikasi bahwa nilai telah kembali ke kondisi awal
      assert.strictEqual(currentLiveInputs.length, 14, 'Panjang RSI harus kembali ke 14 setelah dibatalkan');
      assert.strictEqual(currentLiveInputs.overbought, 70, 'Overbought harus kembali ke 70');
      assert.strictEqual(currentLiveInputs.oversold, 30, 'Oversold harus tetap 30');
    });
  });

  describe('4. Workspace Persistence Serialization & Deserialization', () => {
    test('customized input values tertangkap di snapshot workspace dan dikembalikan saat restore', async () => {
      const controller = new ChartSessionController();

      let liveInputs = {
        length: 50,
        source: 'High',
        color: '#ff9800',
      };

      const mockHandle = {
        id: 'sma-persist-test',
        title: 'Simple Moving Average',
        nativeType: 'sma',
        visible: true,
        inputValues: () => ({ ...liveInputs }),
        setInputs: (v: any) => { liveInputs = { ...liveInputs, ...v }; },
      };

      const mockChart = {
        addNativeIndicator: (type: string, opts: any) => {
          if (opts?.inputs) {
            liveInputs = { ...liveInputs, ...opts.inputs };
          }
          return mockHandle;
        },
        indicators: () => [mockHandle],
        panes: {
          list: () => [{ id: 'price', kind: 'price', indicators: [{ id: 'sma-persist-test' }] }],
        },
      };

      const mockCell = {
        id: 'cell-0',
        chart: mockChart,
      };

      (controller as any).workspace = { active: mockCell };
      (controller as any).getAllCells = () => [mockCell];

      await controller.addNativeIndicator('sma', { inputs: liveInputs });

      // 1. Ambil snapshot native indicators
      const nativeSnapshots = controller.getNativeIndicators(mockCell);
      assert.strictEqual(nativeSnapshots.length, 1, 'Harus ada 1 native indicator snapshot');
      const snap = nativeSnapshots[0];
      assert.strictEqual(snap.type, 'sma');
      assert.ok(snap.inputs, 'Snapshot wajib membawa field inputs');
      assert.strictEqual(snap.inputs.length, 50, 'Snapshot harus mencatat length = 50');
      assert.strictEqual(snap.inputs.source, 'High', 'Snapshot harus mencatat source = High');
      assert.strictEqual(snap.inputs.color, '#ff9800');
      assert.strictEqual(snap.placement, 'overlay');

      // 2. Simulasi restore workspace pada instance grafik baru
      let restoredInputs: any = null;
      const freshChart = {
        addNativeIndicator: (type: string, options: any) => {
          restoredInputs = { ...(options?.inputs || {}) };
          return {
            id: 'fresh-sma',
            nativeType: type,
            visible: true,
            setInputs: (v: any) => { restoredInputs = { ...restoredInputs, ...v }; },
          };
        },
        indicators: () => [],
      };

      const freshCell = {
        id: 'cell-fresh',
        chart: freshChart,
      };

      // Terapkan snapshot ke cell baru
      await controller.applyNativeIndicators(nativeSnapshots, freshCell);

      assert.ok(restoredInputs, 'Restored inputs harus terisi');
      assert.strictEqual(restoredInputs.length, 50, 'Panjang restored harus 50');
      assert.strictEqual(restoredInputs.source, 'High', 'Source restored harus High');
      assert.strictEqual(restoredInputs.color, '#ff9800');
    });

    test('applyNativeIndicators memperbarui handle yang sudah ada di chart', async () => {
      const controller = new ChartSessionController();

      let volumeInputs = { heightPct: 20, upColor: '#089981' };

      const existingVolumeHandle = {
        id: 'volume-native-inst',
        title: 'Volume',
        nativeType: 'volume',
        visible: true,
        inputValues: () => ({ ...volumeInputs }),
        setInputs: (v: any) => { volumeInputs = { ...volumeInputs, ...v }; },
      };

      const mockChart = {
        indicators: () => [existingVolumeHandle],
      };

      const mockCell = {
        id: 'cell-0',
        chart: mockChart,
      };

      (controller as any).workspace = { active: mockCell };
      (controller as any).getAllCells = () => [mockCell];

      const snapshotToRestore: NativeIndicatorSnapshot[] = [
        {
          type: 'volume',
          inputs: { heightPct: 35, upColor: '#00ffcc' },
          visible: true,
          placement: 'overlay',
        },
      ];

      await controller.applyNativeIndicators(snapshotToRestore, mockCell);

      assert.strictEqual(volumeInputs.heightPct, 35, 'Tinggi volume harus diperbarui menjadi 35');
      assert.strictEqual(volumeInputs.upColor, '#00ffcc', 'Warna volume upColor harus diperbarui menjadi #00ffcc');
    });
  });
});
