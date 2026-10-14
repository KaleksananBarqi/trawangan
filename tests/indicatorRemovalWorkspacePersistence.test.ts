import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IndicatorRegistry } from '../src/lib/services/indicatorRegistry';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import type { SavedWorkspace } from '../src/lib/types/market';

describe('Regression & Integration: Hapus Indikator -> Save Workspace -> Load Workspace', () => {
  let adapter: InMemoryLocalStorageAdapter;
  let persistence: PersistenceService;
  let registry: IndicatorRegistry;

  beforeEach(() => {
    adapter = new InMemoryLocalStorageAdapter();
    adapter.clearMemory();
    persistence = new PersistenceService(adapter);
    registry = new IndicatorRegistry();
  });

  it('1. Native chart indicator:removed event MUST remove indicator from indicatorHandles & getActiveIndicators()', () => {
    const mockCell1Handle = {
      id: 'ind_pine_123',
      title: 'Relative Strength Index',
      source: '//@version=5\nindicator("RSI")',
      visible: true,
      remove: () => {},
    };

    // Daftarkan indikator ke registry
    registry.register({
      id: mockCell1Handle.id,
      handle: mockCell1Handle,
      handles: [mockCell1Handle],
      title: mockCell1Handle.title,
      source: mockCell1Handle.source,
      visible: true,
      inputs: { period: 14 },
    });

    let chartIndicatorsList: any[] = [mockCell1Handle];
    const mockActiveChart = {
      indicators: () => chartIndicatorsList,
    };

    // Awalnya ada 1 indikator
    assert.equal(registry.getActiveIndicators(mockActiveChart).length, 1);
    assert.equal(registry.getActiveIndicators(mockActiveChart)[0].title, 'Relative Strength Index');

    // USER MENGHAPUS INDIKATOR DARI CHART (klik 'x' pada legend chart)
    chartIndicatorsList = []; // Native engine menghapus dari list-nya

    // Event 'indicator:removed' dipancarkan oleh Vela ke listener
    const removedKey = registry.handleRemovedEvent('ind_pine_123', true);
    assert.equal(removedKey, 'ind_pine_123');

    // EXPECTATION: getActiveIndicators() harus KOSONG (0) karena indikator sudah dihapus
    const activeAfterDelete = registry.getActiveIndicators(mockActiveChart);
    assert.equal(activeAfterDelete.length, 0);
    assert.equal(registry.size, 0);
  });

  it('2. Multi-cell workspace: Menghapus indikator di cell ke-2 harus membersihkan seluruh cell & indicatorHandles', () => {
    let cell1Removed = false;
    let cell2Removed = false;

    const mockCell1Handle = {
      id: 'ind_cell_1',
      title: 'Bollinger Bands',
      remove: () => { cell1Removed = true; },
    };
    const mockCell2Handle = {
      id: 'ind_cell_2',
      title: 'Bollinger Bands',
      remove: () => { cell2Removed = true; },
    };

    registry.register({
      id: 'ind_cell_1',
      handle: mockCell1Handle,
      handles: [mockCell1Handle, mockCell2Handle],
      title: 'Bollinger Bands',
      visible: true,
    });

    const mockCells = [
      { chart: { indicators: () => (cell1Removed ? [] : [mockCell1Handle]) } },
      { chart: { indicators: () => (cell2Removed ? [] : [mockCell2Handle]) } },
    ];

    // User mengklik tombol hapus di cell 2 (ID: 'ind_cell_2')
    const removed = registry.removeIndicator('ind_cell_2', true, () => mockCells);

    assert.equal(removed, true);
    assert.equal(cell1Removed, true, 'Cell 1 handle harus di-remove saat sync indikator aktif');
    assert.equal(cell2Removed, true, 'Cell 2 handle harus di-remove');
    assert.equal(registry.size, 0, 'Registry internal harus bersih');
  });

  it('3. Auto-Pruning: Jika indicator terhapus di engine chart, getActiveIndicators() otomatis membersihkannya', () => {
    const mockHandle = {
      id: 'macd_1',
      title: 'MACD',
      source: '//@version=5\nindicator("MACD")',
      visible: true,
    };

    registry.register({
      id: mockHandle.id,
      handle: mockHandle,
      handles: [mockHandle],
      title: mockHandle.title,
      source: mockHandle.source,
      visible: true,
    });

    // Chart mock mengembalikan list kosong (indikator sudah hilang dari chart)
    const mockChart = {
      indicators: () => [],
    };

    const activeList = registry.getActiveIndicators(mockChart, () => [{ chart: mockChart }]);
    assert.equal(activeList.length, 0, 'Indikator yang hilang di chart harus di-prune');
    assert.equal(registry.size, 0, 'Registry harus di-prune menjadi 0');
  });

  it('4. Siklus Penuh: Hapus indikator -> Simpan Workspace -> Muat Workspace', async () => {
    // 1. Simpan workspace awal dengan 1 indikator
    const initialWorkspace: Omit<SavedWorkspace, 'id' | 'timestamp'> = {
      name: 'Strategy Workspace',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      layout: '1',
      indicators: [
        {
          title: 'MACD Custom',
          source: '//@version=5\nindicator("MACD")',
          visible: true,
          inputs: { fast: 12, slow: 26 },
        },
      ],
    };

    const saved = await persistence.saveWorkspace(initialWorkspace);
    assert.equal(saved.indicators?.length, 1);
    assert.equal(saved.indicators?.[0].title, 'MACD Custom');

    // 2. Setup registry dengan indikator tersebut
    const macdHandle = {
      id: 'macd_1',
      title: 'MACD Custom',
      remove: () => {},
    };
    registry.register({
      id: 'macd_1',
      handle: macdHandle,
      handles: [macdHandle],
      title: 'MACD Custom',
      source: '//@version=5\nindicator("MACD")',
      visible: true,
      inputs: { fast: 12, slow: 26 },
    });

    let mockChartIndicators: any[] = [macdHandle];
    const mockChart = {
      indicators: () => mockChartIndicators,
    };

    // User menghapus indikator di chart
    mockChartIndicators = []; // Engine chart menghapus
    registry.handleRemovedEvent('macd_1', true, () => [{ chart: mockChart }]);

    // 3. User menekan "Simpan Workspace" (handleSaveWorkspace)
    const freshIndicators = registry.getActiveIndicators(mockChart, () => [{ chart: mockChart }]);
    assert.equal(freshIndicators.length, 0);

    // Simpan workspace dengan indikator terbaru
    await persistence.saveWorkspace({
      id: saved.id,
      name: 'Strategy Workspace',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      layout: '1',
      indicators: freshIndicators.map((i) => ({
        title: i.title,
        source: i.source,
        visible: i.visible,
        inputs: i.inputs,
        props: i.props,
      })),
    });

    // 4. Muat kembali workspace (handleLoadWorkspace)
    const loadedList = await persistence.loadWorkspaces();
    const loadedWorkspace = loadedList.find((w) => w.id === saved.id);

    // VERIFIKASI AKHIR:
    assert.ok(loadedWorkspace);
    assert.equal(
      loadedWorkspace.indicators?.length ?? 0,
      0,
      `Workspace yang dimuat harus memiliki 0 indikator, tetapi ditemukan: ${loadedWorkspace.indicators?.map(i => i.title).join(', ')}`
    );
  });
});
