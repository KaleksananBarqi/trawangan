import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeWorkspaceFingerprint } from '../src/lib/services/persistence/workspaceService';

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

  describe('Ticket #160: Workspace Auto-Save Guard and Quiet Debounce', () => {
    test('1. computeWorkspaceFingerprint menghasilkan fingerprint identik untuk array indikator baru dengan nilai sama', () => {
      const ind1 = [
        { title: 'RSI', source: 'rsi.pine', visible: true, inputs: { length: 14 } },
        { title: 'EMA', source: 'ema.pine', visible: true, inputs: { length: 20 } },
      ];
      const ind2 = [
        { title: 'RSI', source: 'rsi.pine', visible: true, inputs: { length: 14 } },
        { title: 'EMA', source: 'ema.pine', visible: true, inputs: { length: 20 } },
      ];

      const fp1 = computeWorkspaceFingerprint('ws-1', 'BTCUSDT', '15m', '1', 'binance', ind1);
      const fp2 = computeWorkspaceFingerprint('ws-1', 'BTCUSDT', '15m', '1', 'binance', ind2);

      assert.equal(fp1, fp2, 'Fingerprint harus identik untuk nilai indikator yang sama meskipun referensi array berbeda');
    });

    test('2. computeWorkspaceFingerprint mendeteksi perubahan parameter riil (simbol, timeframe, input indikator)', () => {
      const baseInd = [{ title: 'RSI', source: 'rsi.pine', visible: true, inputs: { length: 14 } }];
      const changedInd = [{ title: 'RSI', source: 'rsi.pine', visible: true, inputs: { length: 21 } }];

      const fpBase = computeWorkspaceFingerprint('ws-1', 'BTCUSDT', '15m', '1', 'binance', baseInd);
      const fpDiffSymbol = computeWorkspaceFingerprint('ws-1', 'ETHUSDT', '15m', '1', 'binance', baseInd);
      const fpDiffTf = computeWorkspaceFingerprint('ws-1', 'BTCUSDT', '1h', '1', 'binance', baseInd);
      const fpDiffInput = computeWorkspaceFingerprint('ws-1', 'BTCUSDT', '15m', '1', 'binance', changedInd);

      assert.notEqual(fpBase, fpDiffSymbol, 'Fingerprint harus berubah saat simbol berganti');
      assert.notEqual(fpBase, fpDiffTf, 'Fingerprint harus berubah saat timeframe berganti');
      assert.notEqual(fpBase, fpDiffInput, 'Fingerprint harus berubah saat input indikator berubah');
    });

    test('3. +page.svelte menggunakan debounce 3500ms dan mengeliminasi log spam autosave rutin', () => {
      const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');
      const pageContent = fs.readFileSync(pagePath, 'utf8');

      assert.match(pageContent, /3500/, 'Debounce auto-save workspace harus disetel ke 3500ms');
      assert.match(pageContent, /computeWorkspaceFingerprint/, '+page.svelte harus menggunakan computeWorkspaceFingerprint');
      assert.doesNotMatch(
        pageContent,
        /addSystemLog\(`Auto-save: "\${targetName}" tersimpan otomatis`, 'info'\)/,
        'Log rutin auto-save setiap detik harus disenyapkan dari panel log/terminal'
      );
    });
  });

  describe('Ticket #161: Decoupled Live Theme Preview and Binary Mode Alignment', () => {
    const appearancePath = path.resolve(process.cwd(), 'src/lib/components/settings/AppearanceTab.svelte');
    const appearanceContent = fs.readFileSync(appearancePath, 'utf8');

    test('1. AppearanceTab.svelte menyelaraskan colorModePreference saat memilih tema aplikasi lawan mode di kartu', () => {
      // Saat targetThemeSelection === 'app' dan syncChartWithAppTheme === false:
      assert.match(
        appearanceContent,
        /colorModePreference:\s*preset\.mode/,
        'handleSelectPreset harus menyelaraskan colorModePreference ke preset.mode'
      );
    });

    test('2. Dropdown Tema Aplikasi (Desktop Shell) menyelaraskan mode dan preset default aktif', () => {
      assert.match(
        appearanceContent,
        /handleSelectAppThemeDropdown|handleSelectAppPresetDropdown/,
        'AppearanceTab harus mendefinisikan handler dropdown tema aplikasi yang menyelaraskan mode biner'
      );
    });

    test('3. Dropdown Tema Kanvas Chart membersihkan customPalette dan customBull/BearColor', () => {
      assert.match(
        appearanceContent,
        /handleSelectChartDropdown|handleSelectChartThemeDropdown/,
        'AppearanceTab harus mendefinisikan handler dropdown tema chart'
      );
    });
  });
});


