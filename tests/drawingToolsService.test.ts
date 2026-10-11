import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAWING_TOOL_GROUPS,
  getToolMeta,
  getAllSupportedTools,
  getLastUsedTool,
  setLastUsedTool,
  getFavoriteTools,
  toggleFavoriteTool,
  searchDrawingTools,
  type DrawingToolId,
  type DrawingGroupId,
} from '../src/lib/services/drawingToolsService.js';

describe('Drawing Tools Service & Catalog Suite', () => {
  it('1. Katalog: Mendefinisikan seluruh grup kategori gambar teknikal secara komprehensif', () => {
    assert.ok(DRAWING_TOOL_GROUPS.length >= 7, 'Minimal ada 7 grup utama');
    const groupIds = DRAWING_TOOL_GROUPS.map((g) => g.id);
    assert.ok(groupIds.includes('lines'));
    assert.ok(groupIds.includes('channels_pitchforks'));
    assert.ok(groupIds.includes('fib_gann'));
    assert.ok(groupIds.includes('waves_harmonics'));
    assert.ok(groupIds.includes('shapes_brushes'));
    assert.ok(groupIds.includes('measure_volume'));
    assert.ok(groupIds.includes('annotations'));
  });

  it('2. Cakupan Tools: Memuat lebih dari 70 tools menggambar yang didukung Vela', () => {
    const allTools = getAllSupportedTools();
    assert.ok(allTools.length >= 70, `Total tools harus >= 70, saat ini: ${allTools.length}`);

    // Periksa beberapa tool penting TradingView
    const toolIds = allTools.map((t) => t.id);
    assert.ok(toolIds.includes('trendline'), 'Harus menyertakan trendline');
    assert.ok(toolIds.includes('parallelchannel'), 'Harus menyertakan parallelchannel');
    assert.ok(toolIds.includes('fibretracement'), 'Harus menyertakan fibretracement');
    assert.ok(toolIds.includes('elliottimpulse'), 'Harus menyertakan elliottimpulse');
    assert.ok(toolIds.includes('headshoulders'), 'Harus menyertakan headshoulders');
    assert.ok(toolIds.includes('gartley'), 'Harus menyertakan gartley');
    assert.ok(toolIds.includes('anchoredvwap'), 'Harus menyertakan anchoredvwap');
    assert.ok(toolIds.includes('fixedrangevp'), 'Harus menyertakan fixedrangevp');
    assert.ok(toolIds.includes('freehand'), 'Harus menyertakan freehand brush');
    assert.ok(toolIds.includes('highlighter'), 'Harus menyertakan highlighter');
    assert.ok(toolIds.includes('measure'), 'Harus menyertakan measure');
  });

  it('3. getToolMeta: Mengembalikan detail tool termasuk label dan shortcut jika ada', () => {
    const trendlineMeta = getToolMeta('trendline');
    assert.ok(trendlineMeta);
    assert.equal(trendlineMeta?.label, 'Trend Line');
    assert.equal(trendlineMeta?.shortcut, 'Alt + T');

    const hlineMeta = getToolMeta('hline');
    assert.ok(hlineMeta);
    assert.equal(hlineMeta?.shortcut, 'Alt + H');

    const unknown = getToolMeta('unknown_tool' as any);
    assert.equal(unknown, null);
  });

  it('4. Last Used Tool Memory: Mengingat tool terakhir per grup', () => {
    // Default awal untuk grup 'lines' adalah 'trendline'
    assert.equal(getLastUsedTool('lines'), 'trendline');

    // Ubah ke 'horizontal ray'
    setLastUsedTool('lines', 'hray');
    assert.equal(getLastUsedTool('lines'), 'hray');

    // Ubah grup 'fib_gann' ke 'fibfan'
    setLastUsedTool('fib_gann', 'fibfan');
    assert.equal(getLastUsedTool('fib_gann'), 'fibfan');
  });

  it('5. Favorites Management: Toggle favorite dan query daftar tools favorit', () => {
    // Awalnya default favorit atau kosong
    const initialFavs = getFavoriteTools();
    assert.ok(Array.isArray(initialFavs));

    // Tambahkan 'elliottimpulse' ke favorit
    const isAdded = toggleFavoriteTool('elliottimpulse');
    assert.equal(isAdded, true);
    assert.ok(getFavoriteTools().includes('elliottimpulse'));

    // Toggle kembali untuk menghapus
    const isRemoved = toggleFavoriteTool('elliottimpulse');
    assert.equal(isRemoved, false);
    assert.ok(!getFavoriteTools().includes('elliottimpulse'));
  });

  it('6. Search & Filter: Menemukan tools berdasarkan label atau ID', () => {
    const fibResults = searchDrawingTools('fib');
    assert.ok(fibResults.length >= 8, 'Pencarian "fib" harus menemukan banyak tool fibonacci');

    const elliottResults = searchDrawingTools('elliott');
    assert.ok(elliottResults.length >= 2, 'Pencarian "elliott" harus menemukan gelombang elliott');

    const vwapResults = searchDrawingTools('vwap');
    assert.equal(vwapResults.length, 1);
    assert.equal(vwapResults[0].id, 'anchoredvwap');
  });
});
