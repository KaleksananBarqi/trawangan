import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { IndicatorCatalogService } from '../src/lib/services/indicatorCatalogService';
import { resolveEffectiveVolumeColors, THEME_PRESETS } from '../src/lib/constants/themes';
import { createMockChartContainer } from './helpers/mockChartContainer';

describe('Sinkronisasi Warna Native Volume Overlay dengan Tema Aktif', () => {
  it('1. addNativeIndicator("volume") menyematkan upColor dan downColor tema aktif secara otomatis', async () => {
    const controller = new ChartSessionController();

    let capturedInputs: any = null;
    let addNativeCalled = false;

    const mockCell = {
      id: 'cell_theme_vol',
      chart: {
        addNativeIndicator: (type: string, options: any) => {
          addNativeCalled = true;
          capturedInputs = options?.inputs;
          return {
            id: `native:${type}`,
            title: 'Volume',
            nativeType: type,
            inputValues: () => ({ ...capturedInputs }),
            setInputs: (patch: any) => {
              capturedInputs = { ...capturedInputs, ...patch };
            },
          };
        },
        indicators: () => [],
        renderer: {
          applyConfig: () => {},
          setNativeData: () => {},
        },
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => () => {},
    };

    controller.attach(createMockChartContainer(), {
      workspaceFactory: () => mockWs,
      themePreset: 'signature',
    });

    const expectedTheme = resolveEffectiveVolumeColors('signature');
    const ok = await controller.addNativeIndicator('volume');

    assert.equal(ok, true, 'addNativeIndicator("volume") berhasil dieksekusi');
    assert.equal(addNativeCalled, true, 'chart.addNativeIndicator dipanggil');
    assert.ok(capturedInputs, 'options.inputs tersedia');
    assert.equal(
      capturedInputs.upColor,
      expectedTheme.upColor,
      `upColor harus mengikuti tema Signature (${expectedTheme.upColor}), bukan default Vela (#26a69a)`
    );
    assert.equal(
      capturedInputs.downColor,
      expectedTheme.downColor,
      `downColor harus mengikuti tema Signature (${expectedTheme.downColor}), bukan default Vela (#ef5350)`
    );
  });

  it('2. setTheme() memperbarui upColor dan downColor pada indikator native volume di chart dan registry', () => {
    const controller = new ChartSessionController();

    let volInputs: Record<string, any> = { upColor: '#F7F7F7', downColor: '#FF69B4', heightPct: 15 };
    let lastNativeData: any = null;

    const volHandle = {
      id: 'native:volume',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      inputValues: () => ({ ...volInputs }),
      setInputs: (patch: Record<string, any>) => {
        volInputs = { ...volInputs, ...patch };
      },
    };

    const mockCell = {
      id: 'cell_vol_sync',
      chart: {
        indicators: () => [volHandle],
        renderer: {
          scene: { volumeLayer: { heightFrac: 0.15 } },
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
      setTheme: () => {},
    };

    controller.attach(createMockChartContainer(), {
      workspaceFactory: () => mockWs,
      themePreset: 'signature',
    });

    // Registrasikan indikator ke registry
    (controller as any).indicatorRegistry.register({
      id: 'native:volume',
      handle: volHandle,
      handles: [volHandle],
      title: 'Volume',
      source: 'volume',
      visible: true,
      inputs: { ...volInputs },
    });

    // Ganti tema ke 'emerald'
    const emeraldColors = resolveEffectiveVolumeColors('emerald');
    controller.setTheme('emerald');

    // Verifikasi pembaruan pada handle chart
    assert.equal(
      volInputs.upColor,
      emeraldColors.upColor,
      `volInputs.upColor harus diperbarui ke tema emerald (${emeraldColors.upColor})`
    );
    assert.equal(
      volInputs.downColor,
      emeraldColors.downColor,
      `volInputs.downColor harus diperbarui ke tema emerald (${emeraldColors.downColor})`
    );

    // Verifikasi pembaruan pada WebGL renderer layer
    assert.ok(lastNativeData, 'renderer.setNativeData volume dipanggil');
    assert.equal(lastNativeData.upColor, emeraldColors.upColor);
    assert.equal(lastNativeData.downColor, emeraldColors.downColor);

    // Verifikasi entri tersimpan di registry
    const regInputs = controller.getIndicatorInputs('native:volume');
    assert.equal(regInputs.upColor, emeraldColors.upColor, 'Registry inputs upColor tersinkron');
    assert.equal(regInputs.downColor, emeraldColors.downColor, 'Registry inputs downColor tersinkron');
  });

  it('3. applyNativeIndicators menyelaraskan nilai default Vela lama ke tema aktif', async () => {
    const controller = new ChartSessionController();

    let appliedInputs: any = null;
    const volHandle = {
      id: 'native:volume',
      nativeType: 'volume',
      title: 'Volume',
      visible: true,
      inputValues: () => ({ ...appliedInputs }),
      setInputs: (p: any) => {
        appliedInputs = { ...appliedInputs, ...p };
      },
      update: (p: any) => {
        appliedInputs = { ...appliedInputs, ...p };
      },
    };

    const mockCell = {
      id: 'cell_restore',
      chart: {
        indicators: () => [volHandle],
        renderer: {
          applyConfig: () => {},
          setNativeData: () => {},
        },
      },
    };

    const mockWs = {
      cells: () => [mockCell],
      cell: () => mockCell,
      active: mockCell,
      on: () => () => {},
    };

    controller.attach(createMockChartContainer(), {
      workspaceFactory: () => mockWs,
      themePreset: 'signature',
    });

    const signatureColors = resolveEffectiveVolumeColors('signature');

    // Snapshot dengan default bawaan Vela lama (#26a69a & #ef5350)
    await controller.applyNativeIndicators(
      [
        {
          type: 'volume',
          inputs: {
            upColor: '#26a69a',
            downColor: '#ef5350',
            heightPct: 20,
          },
          visible: true,
          placement: 'overlay',
        },
      ],
      mockCell
    );

    assert.equal(
      appliedInputs.upColor,
      signatureColors.upColor,
      `upColor harus dinormalisasi dari default Vela ke warna Signature (${signatureColors.upColor})`
    );
    assert.equal(
      appliedInputs.downColor,
      signatureColors.downColor,
      `downColor harus dinormalisasi dari default Vela ke warna Signature (${signatureColors.downColor})`
    );
    assert.equal(appliedInputs.heightPct, 20, 'heightPct tetap dipertahankan');
  });

  it('4. IndicatorCatalogService menghasilkan default inputs dan skema yang selaras tema untuk volume', () => {
    const catalog = new IndicatorCatalogService();
    const natives = catalog.getNativeIndicators();

    const vol = natives.find((n) => n.id === 'native:volume');
    assert.ok(vol, 'Indikator native:volume tersedia di katalog');

    const expectedTheme = resolveEffectiveVolumeColors('signature');
    assert.equal(
      vol.defaultInputs?.upColor,
      expectedTheme.upColor,
      'Catalog default upColor selaras dengan tema'
    );
    assert.equal(
      vol.defaultInputs?.downColor,
      expectedTheme.downColor,
      'Catalog default downColor selaras dengan tema'
    );

    const upItem = (vol.inputsSchema as any[])?.find((i: any) => i.key === 'upColor');
    const downItem = (vol.inputsSchema as any[])?.find((i: any) => i.key === 'downColor');

    assert.ok(upItem, 'Skema upColor ditemukan');
    assert.ok(downItem, 'Skema downColor ditemukan');
    assert.equal(upItem.defval, expectedTheme.upColor, 'defval skema upColor selaras tema');
    assert.equal(downItem.defval, expectedTheme.downColor, 'defval skema downColor selaras tema');
  });
});
