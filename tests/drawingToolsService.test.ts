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
  clampFavoritesBarPosition,
  STAMP_PRESETS,
  getStampPresets,
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

  it('7. Floating Favorites Bar Position Clamping: Membatasi posisi agar tidak keluar layar', () => {
    // Skenario normal dalam batas
    const clamped1 = clampFavoritesBarPosition({ x: 100, y: 150 }, 200, 36, 1920, 1080);
    assert.deepEqual(clamped1, { x: 100, y: 150 });

    // Skenario keluar batas kiri / atas (negatif)
    const clamped2 = clampFavoritesBarPosition({ x: -50, y: -20 }, 200, 36, 1920, 1080);
    assert.deepEqual(clamped2, { x: 0, y: 0 });

    // Skenario keluar batas kanan / bawah
    const clamped3 = clampFavoritesBarPosition({ x: 2000, y: 1200 }, 200, 36, 1920, 1080);
    assert.deepEqual(clamped3, { x: 1720, y: 1044 });
  });

  it('8. Zero-Omission Suite: 100% dari seluruh 76 DrawingTypeKey Vela terdaftar tanpa ada yang diabaikan (#47)', () => {
    const allTools = getAllSupportedTools();
    const registeredIds = new Set(allTools.map((t) => t.id));

    // Daftar kanonikal seluruh 76 jenis gambar dari engine Vela (@luxalgo/vela)
    const canonicalVelaTypes: DrawingToolId[] = [
      'trendline', 'hline', 'ray', 'extendedline', 'vline', 'hray', 'crossline', 'infoline', 'trendangle',
      'box', 'text', 'note', 'pricenote', 'comment', 'pricelabel', 'signpost',
      'parallelchannel', 'disjointchannel', 'flattopbottom', 'regressionchannel',
      'anchoredvwap', 'fixedrangevp',
      'pitchfork', 'schiffpitchfork', 'modifiedschiffpitchfork', 'insidepitchfork',
      'arrow', 'callout', 'ellipse', 'triangle', 'polyline', 'freehand', 'highlighter', 'circle', 'rotatedrect', 'path', 'arc', 'curve',
      'arrowmarkup', 'arrowmarkdown', 'flagmark', 'iconstamp',
      'fibretracement', 'fibextension', 'fibextensiontrend', 'fibfan', 'fibtimezones', 'fibchannel', 'fibspeedfan', 'trendfibtime', 'fibcircles', 'fibarcs', 'fibwedge', 'fibspiral',
      'gannfan', 'gannbox', 'gannsquare', 'dedekind', 'sonic', 'supersonic', 'goldensonic', 'goldensupersonic',
      'datepricerange', 'position', 'magnifier',
      'xabcd', 'abcd', 'elliottimpulse', 'elliottcorrection', 'headshoulders', 'gartley', 'bat', 'butterfly', 'crab', 'shark', 'cypher'
    ];

    assert.equal(canonicalVelaTypes.length, 76, 'Jumlah jenis gambar kanonikal Vela harus tepat 76');

    const missingTypes: string[] = [];
    for (const type of canonicalVelaTypes) {
      if (!registeredIds.has(type)) {
        missingTypes.push(type);
      }
    }

    assert.deepEqual(missingTypes, [], `Seluruh tool Vela harus terdaftar. Missing: ${missingTypes.join(', ')}`);
  });

  it('9. Integritas Metadata: Setiap tool memiliki label yang jelas, kategori valid, dan tags pencarian (#47)', () => {
    const allTools = getAllSupportedTools();
    const seenIds = new Set<string>();

    for (const tool of allTools) {
      assert.ok(tool.id, 'Tool ID tidak boleh kosong');
      assert.ok(!seenIds.has(tool.id), `Duplikasi tool ID terdeteksi: ${tool.id}`);
      seenIds.add(tool.id);

      assert.ok(tool.label && tool.label.length >= 2, `Label tool ${tool.id} harus informatif`);
      assert.ok(tool.category, `Kategori tool ${tool.id} harus terdefinisi`);
      assert.ok(Array.isArray(tool.tags) && tool.tags.length > 0, `Tool ${tool.id} harus memiliki tags pencarian`);
    }
  });

  it('10. Quick Stamp Palette: Menyediakan preset stempel visual lengkap (Target, Warning, Breakout, Pin, Flag) (#47)', () => {
    const presets = getStampPresets();
    assert.ok(presets.length >= 5, 'Minimal menyediakan 5 preset stempel');

    const presetIds = presets.map((p) => p.id);
    assert.ok(presetIds.includes('target'), 'Harus ada preset target');
    assert.ok(presetIds.includes('warning'), 'Harus ada preset warning');
    assert.ok(presetIds.includes('breakout'), 'Harus ada preset breakout');
    assert.ok(presetIds.includes('pin'), 'Harus ada preset pin');
    assert.ok(presetIds.includes('flag'), 'Harus ada preset flag');

    for (const p of presets) {
      assert.ok(p.tool === 'iconstamp' || p.tool === 'flagmark', `Tool untuk preset ${p.id} harus iconstamp atau flagmark`);
      assert.ok(p.emoji, `Emoji untuk preset ${p.id} harus ada`);
      assert.ok(p.glyph, `Glyph untuk preset ${p.id} harus ada`);
      assert.ok(p.color.startsWith('#'), `Color untuk preset ${p.id} harus kode hex yang valid`);
      assert.ok(p.label, `Label untuk preset ${p.id} harus ada`);
    }
  });
});


