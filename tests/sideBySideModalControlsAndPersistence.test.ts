// Unit & Integration Tests untuk Ticket #135:
// Snapshot Preview Modal Controls, Preference Persistence & Quick Shortcut Integration
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'svelte/compiler';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import type { AppSettings, SnapshotThesisLayout } from '../src/lib/types/market';
import {
  calculateCompositeDimensions,
  compositeSnapshot,
  renderScreenshotCanvasWithOverlay,
  type SnapshotOptions,
  type SnapshotMetadata,
  type OverlayRenderContext
} from '../src/lib/services/chartSnapshotService';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import { parseTradingPlan, type ParsedTradingPlan } from '../src/lib/services/planParserService';

// Mock Canvas 2D untuk pengujian node environment
function createMockCanvas(width = 1200, height = 800): any {
  const drawCalls: string[] = [];
  const ctx: any = {
    save: () => drawCalls.push('save'),
    restore: () => drawCalls.push('restore'),
    beginPath: () => drawCalls.push('beginPath'),
    closePath: () => drawCalls.push('closePath'),
    moveTo: (x: number, y: number) => drawCalls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => drawCalls.push(`lineTo(${x},${y})`),
    arc: () => drawCalls.push('arc'),
    arcTo: () => drawCalls.push('arcTo'),
    quadraticCurveTo: () => drawCalls.push('quadraticCurveTo'),
    roundRect: () => drawCalls.push('roundRect'),
    rect: () => drawCalls.push('rect'),
    fill: () => drawCalls.push(`fill(${ctx.fillStyle})`),
    stroke: () => drawCalls.push(`stroke(${ctx.strokeStyle})`),
    clip: () => drawCalls.push('clip'),
    fillRect: (x: number, y: number, w: number, h: number) => drawCalls.push(`fillRect(${x},${y},${w},${h})`),
    strokeRect: (x: number, y: number, w: number, h: number) => drawCalls.push(`strokeRect(${x},${y},${w},${h})`),
    fillText: (text: string, x: number, y: number) => drawCalls.push(`fillText(${text},${x},${y})`),
    drawImage: (img: any, ...args: number[]) => drawCalls.push(`drawImage(${args.join(',')})`),
    measureText: (text: string) => ({ width: text.length * 9 }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    fillStyle: '#000',
    strokeStyle: '#fff',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  };
  return {
    width,
    height,
    getContext: () => ctx,
    toDataURL: (mime = 'image/png') => `data:${mime};base64,mockPngBase64`,
    toBlob: (cb: (blob: Blob | null) => void) => {
      cb(new Blob(['mockPngData'], { type: 'image/png' }));
    },
    getDrawCalls: () => drawCalls,
  };
}

const samplePlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 67250.0 |
| Alasan Entry | Bullish Divergence 4H [FAKTA] + FVG Retest [INFERENSI] |
| Stop Loss | 66500.0 |
| Alasan SL | Swing Low invalidation [FAKTA] |
| TP1 | 68500.0 |
| R multiple TP1 | 1.66R |
| TP2 | 69800.0 |
| R multiple TP2 | 3.4R |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** High
* **Skenario Invalidasi:** Penutupan lilin 1H di bawah 66,500
`.trim();

const parsedPlan = parseTradingPlan(samplePlanMarkdown);
const samplePlan: ParsedTradingPlan & { id: string } = {
  ...parsedPlan,
  id: 'plan-135-test',
  symbol: 'BTCUSDT'
};

test('Ticket #135: Snapshot Preview Modal Controls, Persistence & Quick Shortcut Integration', async (t) => {
  const modalFilePath = path.resolve('src/lib/components/SnapshotPreviewModal.svelte');
  const modalSource = fs.readFileSync(modalFilePath, 'utf8');

  const chartFilePath = path.resolve('src/lib/components/Chart.svelte');
  const chartSource = fs.readFileSync(chartFilePath, 'utf8');

  const pageFilePath = path.resolve('src/routes/+page.svelte');
  const pageSource = fs.readFileSync(pageFilePath, 'utf8');

  await t.test('1. AppSettings & PersistenceService: snapshotThesisLayout persistence', async () => {
    assert.strictEqual(
      DEFAULT_APP_SETTINGS.snapshotThesisLayout,
      'side-panel',
      'DEFAULT_APP_SETTINGS.snapshotThesisLayout harus default ke "side-panel"'
    );

    const resolvedDefault = resolveAppSettings({});
    assert.strictEqual(
      resolvedDefault.snapshotThesisLayout,
      'side-panel',
      'resolveAppSettings tanpa input harus menghasilkan "side-panel"'
    );

    const resolvedOverlay = resolveAppSettings({ snapshotThesisLayout: 'overlay' });
    assert.strictEqual(resolvedOverlay.snapshotThesisLayout, 'overlay');

    const resolvedHidden = resolveAppSettings({ snapshotThesisLayout: 'hidden' });
    assert.strictEqual(resolvedHidden.snapshotThesisLayout, 'hidden');

    const resolvedInvalid = resolveAppSettings({ snapshotThesisLayout: 'invalid' as any });
    assert.strictEqual(
      resolvedInvalid.snapshotThesisLayout,
      'side-panel',
      'Nilai snapshotThesisLayout yang tidak valid harus fallback ke "side-panel"'
    );

    // PersistenceService seam test
    const adapter = new InMemoryLocalStorageAdapter();
    const persistence = new PersistenceService(adapter);

    const settingsToSave: Partial<AppSettings> = {
      ...DEFAULT_APP_SETTINGS,
      snapshotThesisLayout: 'overlay',
    };
    await persistence.saveSettings(settingsToSave);

    const loadedSettings = await persistence.loadSettings();
    assert.strictEqual(
      loadedSettings?.snapshotThesisLayout,
      'overlay',
      'PersistenceService harus memuat kembali snapshotThesisLayout yang disimpan'
    );
  });

  await t.test('2. SnapshotPreviewModal.svelte: Static Analysis & Controls Verification', () => {
    // Verifikasi kompilasi svelte
    const compiled = compile(modalSource, { generate: 'client' });
    assert.ok(compiled.js.code, 'SnapshotPreviewModal.svelte harus berhasil dikompilasi oleh Svelte');

    // Props activePlans & showThesisCards
    assert.match(
      modalSource,
      /activePlans\s*(\?:\s*Array|:)/,
      'SnapshotPreviewModal harus menerima prop activePlans'
    );
    assert.match(
      modalSource,
      /showThesisCards\s*(\?:\s*boolean|:)/,
      'SnapshotPreviewModal harus menerima prop showThesisCards'
    );

    // Section header "TATA LETAK TESIS"
    assert.match(
      modalSource,
      /TATA LETAK TESIS/,
      'Sidebar SnapshotPreviewModal harus memiliki judul seksi "TATA LETAK TESIS"'
    );

    // 3 opsi pilihan
    assert.match(
      modalSource,
      /Side Panel \(Samping Kanan\)/,
      'Harus menyertakan pilihan "Side Panel (Samping Kanan)"'
    );
    assert.match(
      modalSource,
      /Overlay di Atas Grafik/,
      'Harus menyertakan pilihan judul "Overlay di Atas Grafik"'
    );
    assert.match(
      modalSource,
      /Mengambang di atas lilin grafik/,
      'Harus menyertakan deskripsi "Mengambang di atas lilin grafik"'
    );
    assert.match(
      modalSource,
      /Sembunyikan|Sembunyikan Tesis/,
      'Harus menyertakan pilihan "Sembunyikan" atau "Sembunyikan Tesis"'
    );

    // Nilai layout 'side-panel', 'overlay', 'hidden'
    assert.match(modalSource, /['"]side-panel['"]/);
    assert.match(modalSource, /['"]overlay['"]/);
    assert.match(modalSource, /['"]hidden['"]/);

    // Persistensi perubahan snapshotThesisLayout pada onUpdateSettings
    assert.match(
      modalSource,
      /snapshotThesisLayout:\s*thesisLayout/,
      'persistChanges harus menyertakan snapshotThesisLayout: thesisLayout ke onUpdateSettings'
    );
  });

  await t.test('3. Reaktivitas Dimensi & Komposit saat Mengubah Tata Letak Tesis', () => {
    const baseW = 1200;
    const baseH = 800;

    const metadata: SnapshotMetadata = {
      symbol: 'BTCUSDT',
      timeframe: '1H',
      providerId: 'binance',
      lastPrice: 67250,
      timestamp: Date.now(),
    };

    // 1. Mode 'side-panel': Lebar bertambah (+380px panel + gap)
    const dimSidePanel = calculateCompositeDimensions(baseW, baseH, {
      mode: 'branded',
      scaleMultiplier: 1,
      metadata,
      thesisLayout: 'side-panel',
      activePlans: [samplePlan],
      tradingPlan: samplePlan,
    });

    assert.ok(
      dimSidePanel.width > baseW + 350,
      `Dimensi side-panel (${dimSidePanel.width}) harus lebih lebar daripada single chart (${baseW})`
    );
    assert.ok(dimSidePanel.panelX !== undefined, 'dimSidePanel harus menyertakan panelX');
    assert.ok(dimSidePanel.panelWidth !== undefined, 'dimSidePanel harus menyertakan panelWidth');

    // 2. Mode 'overlay': Kembali ke dimensi single chart (tanpa side panel)
    const dimOverlay = calculateCompositeDimensions(baseW, baseH, {
      mode: 'branded',
      scaleMultiplier: 1,
      metadata,
      thesisLayout: 'overlay',
      activePlans: [samplePlan],
      tradingPlan: samplePlan,
    });

    assert.strictEqual(
      dimOverlay.width,
      baseW + 24 * 2, // base width + padding kiri/kanan
      'Dimensi overlay harus setara dengan single chart standar (1248px)'
    );
    assert.strictEqual(
      dimOverlay.panelX,
      undefined,
      'Mode overlay tidak boleh memiliki koordinat panel samping'
    );

    // 3. Mode 'hidden': Kembali ke dimensi single chart
    const dimHidden = calculateCompositeDimensions(baseW, baseH, {
      mode: 'branded',
      scaleMultiplier: 1,
      metadata,
      thesisLayout: 'hidden',
      activePlans: [samplePlan],
      tradingPlan: samplePlan,
    });

    assert.strictEqual(dimHidden.width, dimOverlay.width);
    assert.strictEqual(dimHidden.panelX, undefined);

    // 4. Fallback jika activePlans kosong meskipun thesisLayout === 'side-panel'
    const dimNoPlan = calculateCompositeDimensions(baseW, baseH, {
      mode: 'branded',
      scaleMultiplier: 1,
      metadata,
      thesisLayout: 'side-panel',
      activePlans: [],
      tradingPlan: null,
    });

    assert.strictEqual(
      dimNoPlan.width,
      baseW + 24 * 2,
      'Jika tidak ada active plan, dimensi harus fallback anggun ke single-chart'
    );
    assert.strictEqual(dimNoPlan.panelX, undefined);
  });

  await t.test('4. Chart.svelte & Overlay Service: Isolasi Kanvas Bersih saat Side-Panel', () => {
    // Periksa bahwa Chart.svelte getChartScreenshotCanvas menerima thesisLayout
    assert.match(
      chartSource,
      /getChartScreenshotCanvas\s*\(\s*scope[^)]*thesisLayout/,
      'Chart.svelte getChartScreenshotCanvas harus menerima parameter opsional thesisLayout'
    );

    // Verifikasi pemanggilan renderScreenshotCanvasWithOverlay di Chart.svelte menyertakan thesisLayout
    assert.match(
      chartSource,
      /thesisLayout[,:\s]/,
      'Chart.svelte harus meneruskan thesisLayout ke renderScreenshotCanvasWithOverlay'
    );

    // Pengujian perilaku renderScreenshotCanvasWithOverlay:
    const mockCanvas = createMockCanvas(1000, 600);
    const mockTarget = createMockCanvas(1000, 600);

    // Saat thesisLayout === 'side-panel', floating thesis card dilewati
    renderScreenshotCanvasWithOverlay({
      baseCanvas: mockCanvas,
      targetCanvas: mockTarget,
      containerWidth: 1000,
      containerHeight: 600,
      drawingPriceBadges: [],
      showDrawingPriceLabels: true,
      activePlans: [samplePlan],
      showThesisCards: true,
      thesisLayout: 'side-panel',
      getPriceY: () => 100,
      formatPrice: (p) => String(p),
    });

    const callsSidePanel = mockTarget.getDrawCalls();
    const hasThesisCardCalls = callsSidePanel.some((c: string) => c.includes('BULLISH') || c.includes('BEARISH') || c.includes('ENTRY'));
    assert.strictEqual(
      hasThesisCardCalls,
      false,
      'Pada mode side-panel, renderScreenshotCanvasWithOverlay TIDAK boleh menggambar kartu tesis pada kanvas chart'
    );

    // Saat thesisLayout === 'overlay', floating thesis card DIGAMBAR
    const mockTargetOverlay = createMockCanvas(1000, 600);
    renderScreenshotCanvasWithOverlay({
      baseCanvas: mockCanvas,
      targetCanvas: mockTargetOverlay,
      containerWidth: 1000,
      containerHeight: 600,
      drawingPriceBadges: [],
      showDrawingPriceLabels: true,
      activePlans: [samplePlan],
      showThesisCards: true,
      thesisLayout: 'overlay',
      getPriceY: () => 100,
      formatPrice: (p) => String(p),
    });

    const callsOverlay = mockTargetOverlay.getDrawCalls();
    const hasOverlayThesisCalls = callsOverlay.some((c: string) => c.includes('BULLISH') || c.includes('BEARISH') || c.includes('ENTRY'));
    assert.strictEqual(
      hasOverlayThesisCalls,
      true,
      'Pada mode overlay, renderScreenshotCanvasWithOverlay HARUS menggambar kartu tesis mengambang di atas grafik'
    );

    // Saat thesisLayout === 'hidden', floating thesis card DILEWATI
    const mockTargetHidden = createMockCanvas(1000, 600);
    renderScreenshotCanvasWithOverlay({
      baseCanvas: mockCanvas,
      targetCanvas: mockTargetHidden,
      containerWidth: 1000,
      containerHeight: 600,
      drawingPriceBadges: [],
      showDrawingPriceLabels: true,
      activePlans: [samplePlan],
      showThesisCards: true,
      thesisLayout: 'hidden',
      getPriceY: () => 100,
      formatPrice: (p) => String(p),
    });

    const callsHidden = mockTargetHidden.getDrawCalls();
    const hasHiddenThesisCalls = callsHidden.some((c: string) => c.includes('BULLISH') || c.includes('BEARISH') || c.includes('ENTRY'));
    assert.strictEqual(
      hasHiddenThesisCalls,
      false,
      'Pada mode hidden, renderScreenshotCanvasWithOverlay TIDAK boleh menggambar kartu tesis'
    );
  });

  await t.test('5. Quick Snapshot (Ctrl+Shift+S) Flow: Adopsi snapshotThesisLayout & Graceful Fallback', () => {
    // Periksa bahwa getQuickSnapshotOptions di +page.svelte menyertakan snapshotThesisLayout dan activePlans
    assert.match(
      pageSource,
      /snapshotThesisLayout/,
      '+page.svelte harus mereferensikan snapshotThesisLayout'
    );

    // Periksa bahwa getChartScreenshotCanvas dipanggil dengan thesisLayout
    assert.match(
      pageSource,
      /getChartScreenshotCanvas(?:\?\.)?\s*\(\s*scope\s*,\s*thesisLayout\s*\)/,
      '+page.svelte harus meneruskan thesisLayout ke getChartScreenshotCanvas saat quick snapshot'
    );

    // Periksa bahwa SnapshotPreviewModal di +page.svelte menerima activePlans dan showThesisCards
    assert.match(
      pageSource,
      /<SnapshotPreviewModal[^>]*activePlans=/,
      '<SnapshotPreviewModal> di +page.svelte harus dihubungkan dengan activePlans'
    );
  });
});
