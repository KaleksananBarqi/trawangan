import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartSessionController } from '../src/lib/services/chartSessionController';
import { toVelaTimeframe } from '../src/lib/utils/timeframeAdapter';

function createMockWorkspace() {
  let activeSymbol = 'binance:BTCUSDT';
  let activeTimeframe = '15';
  let currentLayout = '1';
  const listeners = new Map<string, Function[]>();

  const cellsList: any[] = [];

  function makeCell(id: string) {
    return {
      id,
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      setSymbol(s: string) {
        this.symbol = s;
        activeSymbol = s;
      },
      setTimeframe(tf: string) {
        this.timeframe = tf;
        activeTimeframe = tf;
      },
      chart: {
        getVisibleRange: () => ({ from: 1000, to: 2000 }),
        setVisibleRange: () => {},
        indicators: () => [],
        addIndicator: () => ({ id: 'h1', setVisible: () => {} }),
      }
    };
  }

  cellsList.push(makeCell('cell_1'));

  return {
    cells: () => cellsList,
    cell: (id: string) => cellsList.find((c) => c.id === id),
    active: cellsList[0],
    setLayout(l: string) {
      currentLayout = l;
      if (l === '2' && cellsList.length === 1) {
        cellsList.push(makeCell('cell_2'));
      } else if (l === '1' && cellsList.length > 1) {
        cellsList.splice(1);
      }
    },
    sync: {
      set: () => {},
    },
    on(event: string, fn: Function) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    getActiveSymbol: () => activeSymbol,
    getActiveTimeframe: () => activeTimeframe,
    getCurrentLayout: () => currentLayout,
  };
}

test.describe('Reproduction: Timeframe, Symbol, and Layout reactivity seam', () => {
  test('REPRO 1: Changing timeframe must propagate to workspace cells', () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach({ nodeType: 1 } as any);
    assert.equal(mockWs.getActiveTimeframe(), '15');

    // User switches timeframe to 1h
    controller.setTimeframe('1h');

    assert.equal(controller.getSnapshot().timeframe, '1h');
    assert.equal(mockWs.getActiveTimeframe(), toVelaTimeframe('1h'), 'Workspace active cell timeframe must match 1h (60)');
  });

  test('REPRO 2: setSymbol with timeframe must update both symbol AND timeframe on workspace', async () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach({ nodeType: 1 } as any);

    // Call setSymbol with timeframe '4h' (simulating Chart.svelte $effect)
    await controller.setSymbol('ETHUSDT', '4h', 'binance');

    assert.equal(controller.getSnapshot().symbol, 'ETHUSDT');
    assert.equal(mockWs.getActiveSymbol(), 'binance:ETHUSDT');
    // In current implementation this will FAIL because setSymbol never touches timeframe on cells!
    assert.equal(mockWs.getActiveTimeframe(), toVelaTimeframe('4h'), 'Workspace cell must have updated timeframe from setSymbol');
  });

  test('REPRO 3: Changing layout to 2 must update workspace layout and cells', () => {
    let mockWs: any = null;
    const controller = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      layout: '1',
      workspaceFactory: () => {
        mockWs = createMockWorkspace();
        return mockWs;
      }
    });

    controller.attach({ nodeType: 1 } as any);
    assert.equal(mockWs.getCurrentLayout(), '1');

    // Switch layout to 2
    controller.setLayout('2');

    assert.equal(controller.getSnapshot().layout, '2');
    assert.equal(mockWs.getCurrentLayout(), '2');
    assert.equal(mockWs.cells().length, 2);
  });
});
