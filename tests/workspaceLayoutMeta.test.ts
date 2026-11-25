import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTI_CHART_LAYOUT_OPTIONS,
  formatMultiChartLayoutLabel,
} from '../src/lib/utils/workspaceLayoutMeta';

/**
 * Pengujian single source of truth metadata tata letak multi-chart Vela (#232)
 */
describe('Workspace Layout Meta & Vela 2-Split Mapping', () => {
  it('1. MULTI_CHART_LAYOUT_OPTIONS memetakan 2 Horisontal (Atas & Bawah) ke 2v dan 2 Vertikal (Kiri & Kanan) ke 2h', () => {
    assert.deepEqual(MULTI_CHART_LAYOUT_OPTIONS, [
      { id: '1', label: '1 Chart', desc: 'Single viewport', iconKey: 'single' },
      { id: '2v', label: '2 Horisontal', desc: 'Atas & Bawah', iconKey: 'rows' },
      { id: '2h', label: '2 Vertikal', desc: 'Kiri & Kanan', iconKey: 'cols' },
      { id: '4', label: '4 Grid', desc: 'Quad viewport', iconKey: 'grid' },
    ]);
  });

  it('2. formatMultiChartLayoutLabel memformat label snapshot frame konsisten dengan orientasi kanvas Vela', () => {
    assert.equal(formatMultiChartLayoutLabel('2v'), '2-SPLIT HORIZONTAL');
    assert.equal(formatMultiChartLayoutLabel('2h'), '2-SPLIT VERTICAL');
    assert.equal(formatMultiChartLayoutLabel('4'), '4-GRID');
    assert.equal(formatMultiChartLayoutLabel('6-tall'), 'LAYOUT 6-TALL');
    assert.equal(formatMultiChartLayoutLabel('1'), 'LAYOUT 1');
  });
});
