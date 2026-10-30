// Unit & Integration Tests untuk Draw by Holding Visual Cheatsheet Modal & Toolbar Integration (Tiket #107)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DRAW_BY_HOLDING_CARDS,
  type GestureCheatsheetCard
} from '../src/lib/constants/gestureCheatsheet.js';
import {
  SHORTCUT_GLOSSARY,
  filterShortcuts,
  getShortcutsByCategory
} from '../src/lib/services/shortcutService.js';
import { commandDispatcher } from '../src/lib/services/commandDispatcher.js';

test('Tiket #107: Draw by Holding Visual Cheatsheet Modal & Toolbar Integration Suite', async (t) => {
  await t.test('1. Glosarium Kartu Visual: DRAW_BY_HOLDING_CARDS memuat persis 13 kartu bergaya OpenMarket', () => {
    assert.equal(DRAW_BY_HOLDING_CARDS.length, 13, 'Harus memiliki tepat 13 kartu interaksi visual');

    const expectedCardIds = [
      'trendline',
      'ray',
      'horizontal',
      'vertical',
      'rectangle',
      'ellipse',
      'fib',
      'path',
      'arrow',
      'scribble',
      'tab',
      'quickdrag',
      'esc'
    ];

    const actualCardIds = DRAW_BY_HOLDING_CARDS.map((c) => c.id);
    assert.deepEqual(actualCardIds, expectedCardIds, 'Urutan dan ID ke-13 kartu harus sesuai dengan spesifikasi Tiket #107');

    // Pastikan setiap kartu memiliki metadata judul, subjudul inggris, dan deskripsi indonesia
    for (const card of DRAW_BY_HOLDING_CARDS) {
      assert.ok(card.id, `ID kartu tidak boleh kosong: ${JSON.stringify(card)}`);
      assert.ok(card.title && card.title.length > 0, `Judul kartu harus terisi: ${card.id}`);
      assert.ok(card.subtitle && card.subtitle.length > 0, `Subtitle kartu harus terisi: ${card.id}`);
      assert.ok(card.descId && card.descId.length > 0, `Deskripsi bahasa indonesia harus terisi: ${card.id}`);
    }
  });

  await t.test('2. Integritas Konten Spesifik 13 Kartu: Verifikasi judul dan deskripsi dwibahasa', () => {
    const cardMap = new Map<string, GestureCheatsheetCard>(
      DRAW_BY_HOLDING_CARDS.map((c) => [c.id, c])
    );

    // 1. Trend Line
    const trendline = cardMap.get('trendline')!;
    assert.equal(trendline.title, 'Trend Line');
    assert.match(trendline.subtitle, /straight stroke/i);
    assert.match(trendline.descId, /garis lurus miring/i);

    // 2. Ray
    const ray = cardMap.get('ray')!;
    assert.equal(ray.title, 'Ray');
    assert.match(ray.subtitle, /price axis/i);
    assert.match(ray.descId, /sumbu harga/i);

    // 3. Horizontal Line
    const horizontal = cardMap.get('horizontal')!;
    assert.equal(horizontal.title, 'Horizontal Line');
    assert.match(horizontal.subtitle, /lands on the wick/i);
    assert.match(horizontal.descId, /ekor lilin/i);

    // 4. Vertical Line
    const vertical = cardMap.get('vertical')!;
    assert.equal(vertical.title, 'Vertical Line');
    assert.match(vertical.subtitle, /upright stroke/i);
    assert.match(vertical.descId, /tegak lurus/i);

    // 5. Rectangle
    const rectangle = cardMap.get('rectangle')!;
    assert.equal(rectangle.title, 'Rectangle');
    assert.match(rectangle.subtitle, /four sides/i);
    assert.match(rectangle.descId, /empat sisi/i);

    // 6. Ellipse
    const ellipse = cardMap.get('ellipse')!;
    assert.equal(ellipse.title, 'Ellipse');
    assert.match(ellipse.subtitle, /round loop/i);
    assert.match(ellipse.descId, /lingkaran|oval/i);

    // 7. Fib Retracement
    const fib = cardMap.get('fib')!;
    assert.equal(fib.title, 'Fib Retracement');
    assert.match(fib.subtitle, /swing to swing/i);
    assert.match(fib.descId, /3 ayunan/i);

    // 8. Path
    const path = cardMap.get('path')!;
    assert.equal(path.title, 'Path');
    assert.match(path.subtitle, /sharp turns/i);
    assert.match(path.descId, /sudut tajam/i);

    // 9. Arrow
    const arrow = cardMap.get('arrow')!;
    assert.equal(arrow.title, 'Arrow');
    assert.match(arrow.subtitle, /shaft with a hook/i);
    assert.match(arrow.descId, /panah/i);

    // 10. Scribble
    const scribble = cardMap.get('scribble')!;
    assert.equal(scribble.title, 'Scribble');
    assert.match(scribble.subtitle, /zig-zag.*gone/i);
    assert.match(scribble.descId, /menghapus/i);

    // 11. Tab
    const tab = cardMap.get('tab')!;
    assert.equal(tab.title, 'Tab');
    assert.match(tab.subtitle, /other reading/i);
    assert.match(tab.descId, /ganti kandidat/i);
    assert.equal(tab.badge, 'Tab');

    // 12. Quick drag
    const quickdrag = cardMap.get('quickdrag')!;
    assert.equal(quickdrag.title, 'Quick drag');
    assert.match(quickdrag.subtitle, /still pans/i);
    assert.match(quickdrag.descId, /geser/i);

    // 13. Esc
    const esc = cardMap.get('esc')!;
    assert.equal(esc.title, 'Esc');
    assert.match(esc.subtitle, /removes it/i);
    assert.match(esc.descId, /batalkan/i);
    assert.equal(esc.badge, 'Esc');
  });

  await t.test('3. Glosarium Shortcut: Shift+D dan ~ terdaftar resmi di Alat Gambar (Drawing Tools)', () => {
    const drawingShortcuts = getShortcutsByCategory()['Alat Gambar (Drawing Tools)'] || [];

    // Verifikasi Shift + D
    const shiftD = drawingShortcuts.find(
      (s) => s.id === 'toggle-gesture-mode' && s.keys.includes('Shift') && s.keys.includes('D')
    );
    assert.ok(shiftD, 'Pintasan Shift+D harus terdaftar pada Alat Gambar');
    assert.match(shiftD.desc, /gestur/i);

    // Verifikasi ~ (Transient Hold)
    const tilde = drawingShortcuts.find(
      (s) => s.id === 'transient-gesture-hold' && s.keys.includes('~')
    );
    assert.ok(tilde, 'Pintasan ~ (Transient Hold) harus terdaftar pada Alat Gambar');
    assert.match(tilde.desc, /transient hold|gestur/i);

    // Verifikasi pencarian filterShortcuts
    const filterByTilde = filterShortcuts('~');
    assert.ok(filterByTilde.some((s) => s.id === 'transient-gesture-hold'));

    const filterByGesture = filterShortcuts('gesture');
    assert.ok(filterByGesture.some((s) => s.id === 'toggle-gesture-mode'));
  });

  await t.test('4. Integritas Berkas Komponen DrawByHoldingModal.svelte', () => {
    const componentPath = resolve('src/lib/components/DrawByHoldingModal.svelte');
    assert.ok(existsSync(componentPath), 'Berkas DrawByHoldingModal.svelte harus ada di src/lib/components/');

    const content = readFileSync(componentPath, 'utf-8');

    // Menggunakan Svelte 5 runes
    assert.match(content, /\$props\(\)/, 'Harus menggunakan Svelte 5 $props()');
    assert.match(content, /isOpen:\s*boolean/, 'Harus menerima prop isOpen');
    assert.match(content, /onClose:\s*\(\)\s*=>\s*void/, 'Harus menerima prop onClose');

    // Header modal dan deskripsi bahasa Indonesia
    assert.match(content, /Draw by holding/, 'Header modal harus mencantumkan judul "Draw by holding"');
    assert.match(content, /Tahan tombol.*~.*atau aktifkan mode.*Shift\+D/i, 'Deskripsi header harus memuat petunjuk tombol ~ dan Shift+D');
    assert.match(content, /onkeydown=\{handleKeydown\}/, 'Harus menangani event keyboard window');

    // Tombol got it dan ilustrasi
    assert.match(content, /Mengerti \(Got it\)/, 'Harus memiliki tombol "Mengerti (Got it)"');
    assert.match(content, /DRAW_BY_HOLDING_CARDS/, 'Harus mengiterasi DRAW_BY_HOLDING_CARDS');
    assert.match(content, /data-card-id=\{card\.id\}/, 'Setiap kartu harus memiliki atribut data-card-id');
  });

  await t.test('5. Integritas Integrasi Toolbar Bilah Kiri (DrawingToolbar.svelte)', () => {
    const toolbarPath = resolve('src/lib/components/DrawingToolbar.svelte');
    const content = readFileSync(toolbarPath, 'utf-8');

    // Memastikan prop onOpenGestureGuide didefinisikan
    assert.match(content, /onOpenGestureGuide\?: \(\) => void;/, 'Toolbar harus mendefinisikan prop onOpenGestureGuide');

    // Memastikan pemicu tombol bantuan gesture disediakan
    assert.match(content, /toolbar-gesture-help-cue/, 'Toolbar harus memiliki cue tombol ? saat mode gesture aktif');
    assert.match(content, /gesture-help-btn/, 'Submenu flyout pointer harus memiliki tombol ? untuk membuka panduan gesture');
    assert.match(content, /onOpenGestureGuide\?\.\(\)/, 'Harus memanggil onOpenGestureGuide saat diklik');
  });

  await t.test('6. Integritas Cheatsheet Modal & HelpTab', () => {
    const cheatsheetPath = resolve('src/lib/components/ShortcutCheatsheetModal.svelte');
    const cheatsheetContent = readFileSync(cheatsheetPath, 'utf-8');

    assert.match(cheatsheetContent, /onOpenGestureGuide\?: \(\) => void;/, 'Cheatsheet modal harus menerima onOpenGestureGuide');
    assert.match(cheatsheetContent, /Buka Panduan Goresan \(Draw by Holding\)\.\.\./, 'Cheatsheet modal harus memiliki tombol pintas panduan goresan');

    const helpTabPath = resolve('src/lib/components/settings/HelpTab.svelte');
    const helpTabContent = readFileSync(helpTabPath, 'utf-8');
    assert.match(helpTabContent, /Draw by Holding \(Gesture Engine\)/, 'HelpTab harus memiliki kartu panduan Draw by Holding');
  });

  await t.test('7. Integrasi Halaman Utama (+page.svelte)', () => {
    const pagePath = resolve('src/routes/+page.svelte');
    const pageContent = readFileSync(pagePath, 'utf-8');

    assert.match(pageContent, /import DrawByHoldingModal from '\.\.\/lib\/components\/DrawByHoldingModal\.svelte';/, 'Harus meng-import DrawByHoldingModal');
    assert.match(pageContent, /isDrawByHoldingModalOpen/, 'Harus memiliki state isDrawByHoldingModalOpen');
    assert.match(pageContent, /<DrawByHoldingModal/, 'Harus merender DrawByHoldingModal di template');
  });
});
