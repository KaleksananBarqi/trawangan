import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spec #158: Theming, Context Menu, Watermark & Auto-Save Guard Suite', () => {
  describe('Ticket #159: Chart Context Menu Pruning and Centralized Settings Access', () => {
    const contextMenuPath = path.resolve(process.cwd(), 'src/lib/components/ChartContextMenu.svelte');
    const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');

    test('1. ChartContextMenu.svelte tidak memuat opsi Pengaturan Grafik atau trigger dialog Vela', () => {
      assert.doesNotMatch(
        contextMenuContent,
        /Pengaturan Grafik/i,
        'ChartContextMenu tidak boleh memuat teks "Pengaturan Grafik"'
      );
      assert.doesNotMatch(
        contextMenuContent,
        /handleOpenSettingsClick/i,
        'ChartContextMenu tidak boleh mendefinisikan atau memanggil handleOpenSettingsClick'
      );
      assert.doesNotMatch(
        contextMenuContent,
        /SlidersHorizontal/i,
        'ChartContextMenu tidak boleh mengimpor atau menggunakan icon SlidersHorizontal'
      );
    });

    test('2. ChartContextMenu.svelte mempertahankan aksi analitikal (Alert, Horizontal Line, Copy Price, Reset Scale)', () => {
      assert.match(contextMenuContent, /handleCreateAlertClick/, 'Wajib mempertahankan handleCreateAlertClick');
      assert.match(contextMenuContent, /handleDrawLineClick/, 'Wajib mempertahankan handleDrawLineClick');
      assert.match(contextMenuContent, /handleCopyPrice/, 'Wajib mempertahankan handleCopyPrice');
      assert.match(contextMenuContent, /handleResetScale/, 'Wajib mempertahankan handleResetScale');
      assert.match(contextMenuContent, /Alt\+Z/, 'Wajib mempertahankan label shortcut Alt+Z');
    });
  });
});
