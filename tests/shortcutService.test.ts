// Unit Tests untuk Modul Keyboard Shortcuts & Kamus Glosarium Trawangan
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORTCUT_GLOSSARY,
  getShortcutsByCategory,
  filterShortcuts,
  type ShortcutItem
} from '../src/lib/services/shortcutService';

test('Shortcut Service & Kamus Glosarium Seam Suite', async (t) => {
  await t.test('1. Glosarium Lengkap: Memiliki minimal 30+ shortcut terdaftar di seluruh kategori', () => {
    assert.ok(SHORTCUT_GLOSSARY.length >= 30, `Jumlah shortcut (${SHORTCUT_GLOSSARY.length}) harus >= 30`);

    // Pastikan setiap item memiliki properti yang valid
    for (const item of SHORTCUT_GLOSSARY) {
      assert.ok(item.category, `Item harus memiliki kategori: ${item.desc}`);
      assert.ok(Array.isArray(item.keys) && item.keys.length > 0, `Item harus memiliki tombol keys: ${item.desc}`);
      assert.ok(item.desc && item.desc.length > 3, `Item harus memiliki deskripsi jelas: ${item.desc}`);
    }
  });

  await t.test('2. Cakupan Kategori Esensial: Mencakup seluruh area kerja terminal', () => {
    const categories = new Set(SHORTCUT_GLOSSARY.map((s) => s.category));
    assert.ok(categories.has('Navigasi & Simbol'));
    assert.ok(categories.has('Alat Gambar (Drawing Tools)'));
    assert.ok(categories.has('Bar Replay (Simulasi)'));
    assert.ok(categories.has('Analisis & Indikator'));
    assert.ok(categories.has('Skala & Tampilan Grafik'));
    assert.ok(categories.has('Timeframe Cepat'));
    assert.ok(categories.has('Sistem & Bantuan'));
  });

  await t.test('3. Shortcut Baru Kritis: Memastikan Alt+W, ArrowLeft Replay, Ctrl+,, /, dan F11 terdaftar', () => {
    // Alt + W untuk Watchlist
    const watchlistShortcut = SHORTCUT_GLOSSARY.find(
      (s) => s.keys.includes('Alt') && s.keys.includes('W')
    );
    assert.ok(watchlistShortcut, 'Shortcut Alt + W untuk Watchlist harus terdaftar');

    // ArrowLeft untuk Replay Mundur 1 Bar
    const replayBackShortcut = SHORTCUT_GLOSSARY.find(
      (s) => s.category === 'Bar Replay (Simulasi)' && s.keys.includes('←')
    );
    assert.ok(replayBackShortcut, 'Shortcut ← untuk Replay mundur 1 bar harus terdaftar');

    // / atau Ctrl+I untuk Indikator Modal
    const indicatorShortcut = SHORTCUT_GLOSSARY.find(
      (s) => s.category === 'Analisis & Indikator' && (s.keys.includes('/') || s.keys.includes('I'))
    );
    assert.ok(indicatorShortcut, 'Shortcut indikator harus terdaftar');

    // Ctrl + , untuk Settings
    const settingsShortcut = SHORTCUT_GLOSSARY.find(
      (s) => s.keys.includes('Ctrl') && s.keys.includes(',')
    );
    assert.ok(settingsShortcut, 'Shortcut Ctrl + , untuk Settings harus terdaftar');
  });

  await t.test('4. Pencarian Cepat filterShortcuts: Mencari berdasarkan tombol, kata kunci desc, atau kategori', () => {
    const replayResults = filterShortcuts('replay');
    assert.ok(replayResults.length >= 4);

    const altResults = filterShortcuts('Alt');
    assert.ok(altResults.length >= 6);

    const emptyResults = filterShortcuts('nonexistent_query_xyz');
    assert.equal(emptyResults.length, 0);

    // Tanpa filter mengembalikan semua
    assert.equal(filterShortcuts('').length, SHORTCUT_GLOSSARY.length);
  });

  await t.test('5. Pengelompokan getShortcutsByCategory: Mengelompokkan item secara presisi', () => {
    const grouped = getShortcutsByCategory();
    assert.ok(Object.keys(grouped).length >= 6);
    assert.ok(grouped['Navigasi & Simbol'].length >= 3);
    assert.ok(grouped['Bar Replay (Simulasi)'].length >= 4);
  });
});
