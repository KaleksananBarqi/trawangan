import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compositeSnapshot,
  calculateCompositeDimensions,
  calculateThesisPanelHeight,
  SNAPSHOT_SIDE_PANEL_WIDTH,
  SNAPSHOT_SIDE_PANEL_GAP,
  renderDedicatedThesisSidePanel,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import { THEME_PRESETS } from '../src/lib/constants/themes';

/**
 * Mock kanvas 2D untuk merekam seluruh operasi perenderan grafis kanvas komposit.
 */
function createMockCanvas(width = 800, height = 600) {
  const operations: Array<{ method: string; args: any[]; fillStyle?: string; strokeStyle?: string; font?: string; textAlign?: string }> = [];
  let _fillStyle = '#000000';
  let _strokeStyle = '#000000';
  let _lineWidth = 1;
  let _font = '10px sans-serif';
  let _textAlign = 'left';
  let _textBaseline = 'alphabetic';
  let _globalAlpha = 1;

  const ctx: any = {
    get fillStyle() { return _fillStyle; },
    set fillStyle(val: string) { _fillStyle = val; },
    get strokeStyle() { return _strokeStyle; },
    set strokeStyle(val: string) { _strokeStyle = val; },
    get lineWidth() { return _lineWidth; },
    set lineWidth(val: number) { _lineWidth = val; },
    get font() { return _font; },
    set font(val: string) { _font = val; },
    get textAlign() { return _textAlign; },
    set textAlign(val: string) { _textAlign = val; },
    get textBaseline() { return _textBaseline; },
    set textBaseline(val: string) { _textBaseline = val; },
    get globalAlpha() { return _globalAlpha; },
    set globalAlpha(val: number) { _globalAlpha = val; },

    save: () => operations.push({ method: 'save', args: [] }),
    restore: () => operations.push({ method: 'restore', args: [] }),
    beginPath: () => operations.push({ method: 'beginPath', args: [] }),
    closePath: () => operations.push({ method: 'closePath', args: [] }),
    moveTo: (x: number, y: number) => operations.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => operations.push({ method: 'lineTo', args: [x, y] }),
    arc: (...args: any[]) => operations.push({ method: 'arc', args }),
    arcTo: (...args: any[]) => operations.push({ method: 'arcTo', args }),
    roundRect: (...args: any[]) => operations.push({ method: 'roundRect', args }),
    rect: (...args: any[]) => operations.push({ method: 'rect', args }),
    fill: () => operations.push({ method: 'fill', args: [], fillStyle: _fillStyle }),
    stroke: () => operations.push({ method: 'stroke', args: [], strokeStyle: _strokeStyle }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (x: number, y: number, w: number, h: number) =>
      operations.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: _fillStyle }),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      operations.push({ method: 'strokeRect', args: [x, y, w, h], strokeStyle: _strokeStyle }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth], font: _font, fillStyle: _fillStyle, textAlign: _textAlign }),
    strokeText: (text: string, x: number, y: number) =>
      operations.push({ method: 'strokeText', args: [text, x, y], strokeStyle: _strokeStyle }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    measureText: (text: string) => ({ width: text.length * 8 }),
    translate: (...args: any[]) => operations.push({ method: 'translate', args }),
    rotate: (...args: any[]) => operations.push({ method: 'rotate', args }),
    setLineDash: (...args: any[]) => operations.push({ method: 'setLineDash', args }),
  };

  const canvas: any = {
    width,
    height,
    getContext: () => ctx,
    toDataURL: (type = 'image/png') => `data:${type};base64,mockData`,
    toBlob: (cb: (b: any) => void) => cb(null),
    operations,
  };

  return canvas;
}

describe('Ticket #134: Dedicated Thesis Side Panel 2D Renderer & Unified Attribution Bar Suite', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 78500.0,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-11-01T10:00:00Z'),
  };

  const sampleShortPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 78300.0 |
| Alasan Entry | Rejection Bearish FVG [FAKTA] pada TF 15m |
| Stop Loss | 78900.0 |
| Alasan SL | Swing High invalidation [FAKTA] |
| TP1 | 77300.0 |
| R multiple TP1 | 1.66R |
| TP2 | 76270.0 |
| R multiple TP2 | 3.38R |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** High
* **Skenario Invalidasi:** Penutupan candle 1H di atas 78900.
`.trim();

  const sampleLongPlanMarkdown = `
5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 68250.0 (Konfirmasi Sweep Liquidity Asia Range + CHoCH M5) |
| Alasan Entry | Terbentuk bullish order block baru pada timeframe 15m setelah sweep liquidity sesi Asia di level 68100.0 [FAKTA]. Struktur pasar internal beralih dari bearish ke bullish (CHoCH) dengan displacement volume tinggi [INFERENSI]. Menunggu pull-back korektif ke area FVG 50% discount zone untuk entry optimal dengan probabilitas tinggi [SPEKULASI]. |
| Stop Loss | 67450.0 |
| Alasan SL | Terletak di bawah swing low struktural 4H 67520.0 dengan buffer volatilitas 70 poin untuk menghindari wick hunting oleh market maker [FAKTA]. |
| TP1 | 69800.0 |
| R multiple TP1 | 1.93R |
| Alasan TP1 | Likuiditas buy-side equal highs 1H dan level resistensi psikologis harian [FAKTA]. |
| TP2 | 71500.0 |
| R multiple TP2 | 4.06R |
| Alasan TP2 | Area unmitigated weekly imbalance dan proyeksi target ekstensi Fibonacci 1.618 [INFERENSI]. |
| TP3 | 73200.0 |
| R multiple TP3 | 6.18R |
| Alasan TP3 | All-Time-High range expansion run [SPEKULASI]. |

### 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** Sangat Tinggi (A+) didukung oleh konfluensi DXY melemah dan open interest futures meningkat signifikan.
* **Skenario Invalidasi:** Jika harga ditutup di bawah level 67450.0 pada candle 1H, tesis struktur bullish gugur seketika karena order block harian gagal menahan tekanan jual institusional, menandakan kelanjutan distribusi makro ke support mingguan berikutnya.
`.trim();

  it('1. compositeSnapshot merender panel tesis di sisi kanan saat thesisLayout === "side-panel" dan plan aktif tersedia', () => {
    const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 2,
      padding: 24,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'plan-1' },
      metadata: baseMetadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Verifikasi chart digambar di sisi kiri (chartX, chartY, chartWidth, chartHeight)
    const drawImageOps = targetCanvas.operations.filter((op: any) => op.method === 'drawImage');
    const chartDrawOp = drawImageOps.find((op: any) => op.args[0] === sourceCanvas);
    assert.ok(chartDrawOp, 'Grafik sumber harus digambar via drawImage');
    assert.equal(chartDrawOp.args[1], 24 * 2, 'chartX harus sesuai padding');
    assert.equal(chartDrawOp.args[2], 24 * 2, 'chartY harus sesuai padding');
    assert.equal(chartDrawOp.args[3], 1000 * 2, 'chartWidth harus mempertahankan rasio 1:1');
    assert.equal(chartDrawOp.args[4], 600 * 2, 'chartHeight harus mempertahankan rasio 1:1');

    // Verifikasi teks-teks dari tesis muncul di canvas
    const fillTextOps = targetCanvas.operations.filter((op: any) => op.method === 'fillText');
    const texts = fillTextOps.map((op: any) => op.args[0]);

    // Verifikasi Bias badge & Entry
    assert.ok(texts.some((t: string) => t.includes('BEARISH')), 'Harus merender badge BEARISH');
    assert.ok(texts.some((t: string) => t.includes('78,300.0') || t.includes('78300')), 'Harus merender harga entry');

    // Verifikasi Invalidasi & SL
    assert.ok(texts.some((t: string) => t.includes('-1.00R')), 'Harus merender badge -1.00R pada stop loss');
    assert.ok(texts.some((t: string) => t.includes('78,900.0') || t.includes('78900')), 'Harus merender harga stop loss');

    // Verifikasi Target Likuiditas
    assert.ok(texts.some((t: string) => t.includes('TP1')), 'Harus merender label TP1');
    assert.ok(texts.some((t: string) => t.includes('+1.66R') || t.includes('1.66R')), 'Harus merender badge R multiple TP1');
    assert.ok(texts.some((t: string) => t.includes('TP2')), 'Harus merender label TP2');
    assert.ok(texts.some((t: string) => t.includes('+3.38R') || t.includes('3.38R')), 'Harus merender badge R multiple TP2');
  });

  it('2. Thesis side panel merender seluruh seksi terstruktur: Header, Katalis Entry, Invalidasi, Target, dan Unit Risiko', () => {
    const parsedPlan = parseTradingPlan(sampleLongPlanMarkdown);
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      thesisLayout: 'side-panel',
      plan: { ...parsedPlan, id: 'plan-long' },
      metadata: baseMetadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    const fillTextOps = targetCanvas.operations.filter((op: any) => op.method === 'fillText');
    const texts = fillTextOps.map((op: any) => op.args[0]);

    // Header: Bias BULLISH dan Confidence Level
    assert.ok(texts.some((t: string) => t.includes('BULLISH')), 'Header harus memuat bias BULLISH');
    assert.ok(texts.some((t: string) => t.includes('Sangat Tinggi') || t.includes('A+')), 'Header harus memuat confidence level');

    // Katalis Entry: Multi-timeframe pills / context zones dan tag epistemik
    assert.ok(texts.some((t: string) => t.includes('KATALIS ENTRY')), 'Harus memuat seksi Katalis Entry');
    assert.ok(texts.some((t: string) => t.includes('[FAKTA]') || t.includes('FAKTA')), 'Harus merender tag FAKTA');
    assert.ok(texts.some((t: string) => t.includes('[INFERENSI]') || t.includes('INFERENSI')), 'Harus merender tag INFERENSI');
    assert.ok(texts.some((t: string) => t.includes('[SPEKULASI]') || t.includes('SPEKULASI')), 'Harus merender tag SPEKULASI');

    // Invalidasi: Skenario batal
    assert.ok(texts.some((t: string) => t.includes('INVALIDASI') || t.includes('STOP LOSS')), 'Harus memuat seksi Invalidasi/SL');
    assert.ok(texts.some((t: string) => t.includes('SKENARIO BATAL') || t.includes('67450')), 'Harus memuat skenario invalidasi');

    // Target Likuiditas: Multi-target bertingkat (TP1, TP2, TP3)
    assert.ok(texts.some((t: string) => t.includes('TARGET LIKUIDITAS')), 'Harus memuat seksi Target Likuiditas');
    assert.ok(texts.some((t: string) => t.includes('TP3')), 'Harus memuat TP3');
    assert.ok(texts.some((t: string) => t.includes('6.18R')), 'Harus memuat R multiple 6.18R');

    // Unit Risiko (R) & Catatan Probabilitas
    assert.ok(texts.some((t: string) => t.includes('Unit Risiko') || t.includes('800')), 'Harus memuat unit risiko');
  });

  it('3. Tema visual dinamis: Mengadopsi token tema (Signature, Binance, Bitunix, TradingView)', () => {
    const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
    const sourceCanvas = createMockCanvas(800, 500);

    // Uji dengan THEME_PRESETS.binance (Emerald Bull #0ECB81, Crimson Bear #F6465D)
    const targetBinance = createMockCanvas(1, 1);
    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      thesisLayout: 'side-panel',
      activePlans: [{ ...parsedPlan, id: 'binance-plan' }],
      themeConfig: THEME_PRESETS.binance,
      metadata: baseMetadata,
    }, targetBinance);

    // Periksa warna bearColor Binance (#F6465D) diterapkan untuk badge Bearish
    const binanceBearFill = targetBinance.operations.find(
      (op: any) => op.method === 'fillText' && op.args[0] === 'BEARISH' && op.fillStyle === THEME_PRESETS.binance.tokens.bearColor
    );
    assert.ok(binanceBearFill, 'Badge BEARISH harus menggunakan bearColor tema Binance');

    // Uji dengan THEME_PRESETS.bitunix (Bull #00F090, Bear #FF3B69, Cyan #38BDF8)
    const targetBitunix = createMockCanvas(1, 1);
    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'bitunix-plan' },
      themeConfig: THEME_PRESETS.bitunix,
      metadata: baseMetadata,
    }, targetBitunix);

    const bitunixBearFill = targetBitunix.operations.find(
      (op: any) => op.method === 'fillText' && op.args[0] === 'BEARISH' && op.fillStyle === THEME_PRESETS.bitunix.tokens.bearColor
    );
    assert.ok(bitunixBearFill, 'Badge BEARISH harus menggunakan bearColor tema Bitunix');

    // Uji dengan THEME_PRESETS.tradingview (Teal Bull #089981, Red Bear #F23645)
    const targetTV = createMockCanvas(1, 1);
    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'tv-plan' },
      themeConfig: THEME_PRESETS.tradingview,
      metadata: baseMetadata,
    }, targetTV);

    const tvBearFill = targetTV.operations.find(
      (op: any) => op.method === 'fillText' && op.args[0] === 'BEARISH' && op.fillStyle === THEME_PRESETS.tradingview.tokens.bearColor
    );
    assert.ok(tvBearFill, 'Badge BEARISH harus menggunakan bearColor tema TradingView');
  });

  it('4. Anti-distorsi & Top-alignment: Grafik mempertahankan rasio 1:1 saat tinggi kanvas bertambah karena panel tesis panjang', () => {
    const longPlan = parseTradingPlan(sampleLongPlanMarkdown);
    const sourceCanvas = createMockCanvas(800, 450); // Tinggi chart hanya 450px
    const targetCanvas = createMockCanvas(1, 1);

    const requiredPanelH = calculateThesisPanelHeight(longPlan, SNAPSHOT_SIDE_PANEL_WIDTH);
    assert.ok(requiredPanelH > 450, `Tinggi panel tesis (${requiredPanelH}px) harus lebih besar dari tinggi chart (450px)`);

    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      padding: 24,
      thesisLayout: 'side-panel',
      tradingPlan: { ...longPlan, id: 'long-plan' },
      metadata: baseMetadata,
    }, targetCanvas);

    // Canvas height bertambah sesuai requiredPanelH + padding + attributionBar
    const expectedHeight = requiredPanelH + 24 * 2 + 60;
    assert.equal(targetCanvas.height, expectedHeight);

    // Chart drawImage TIDAK boleh di-stretch ke requiredPanelH, harus tetap 450px dan top-aligned di y=24
    const drawImageOps = targetCanvas.operations.filter((op: any) => op.method === 'drawImage');
    const chartDrawOp = drawImageOps.find((op: any) => op.args[0] === sourceCanvas);
    assert.ok(chartDrawOp);
    assert.equal(chartDrawOp.args[1], 24, 'chartX harus di y=24 (padding)');
    assert.equal(chartDrawOp.args[2], 24, 'chartY harus di y=24 (top-aligned)');
    assert.equal(chartDrawOp.args[3], 800, 'chartWidth harus tetap 800px');
    assert.equal(chartDrawOp.args[4], 450, 'chartHeight harus tetap 450px (tidak distorsi)');
  });

  it('5. Unified Attribution Bar membentang selebar total komposit (Grafik + Side Panel)', () => {
    const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);
    const padding = 24;

    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      padding,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'plan-attribution' },
      metadata: { ...baseMetadata, lastPrice: 78500.0 },
    }, targetCanvas);

    const dim = calculateCompositeDimensions(1000, 600, {
      mode: 'branded',
      scale: 1,
      padding,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'plan-attribution' },
      metadata: baseMetadata,
    });

    // Periksa Attribution Bar Y
    const fillTextOps = targetCanvas.operations.filter((op: any) => op.method === 'fillText');
    
    // Brand 'trawangan' di sisi kiri attribution bar sejajar dengan chartX
    const brandTextOp = fillTextOps.find((op: any) => op.args[0] === 'trawangan');
    assert.ok(brandTextOp, 'Teks trawangan harus ada');
    const expectedAttrY = dim.attributionY + dim.attributionHeight / 2;
    assert.equal(brandTextOp.args[2], expectedAttrY, 'Attribution bar harus berada di posisi Y terpadu');

    // Sisi kanan attribution bar (URL dan harga) harus berada di ujung kanan panel tesis
    const expectedRightX = dim.panelX! + dim.panelWidth!;
    const urlOp = fillTextOps.find((op: any) => op.args[0] === 'kaleksananbarqi.github.io/trawangan');
    assert.ok(urlOp, 'Brand URL harus ada di sisi kanan');
    assert.equal(urlOp.args[1], expectedRightX, 'Brand URL harus rata kanan dengan sisi kanan panel tesis');
  });

  it('6. Security Watermark terisolasi dan strictly bounded/clipped ke area kanvas grafik di sisi kiri', () => {
    const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'branded',
      scale: 1,
      padding: 24,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'plan-wm' },
      watermark: { enabled: true, text: 'SECURE_TRADER_WATERMARK' },
      metadata: baseMetadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Periksa bahwa operasi clip watermark hanya mencakup area chart (chartX, chartY, chartWidth, chartHeight)
    const rectOps = targetCanvas.operations.filter((op: any) => op.method === 'rect');
    const watermarkClipRect = rectOps.find((op: any) =>
      op.args[0] === 24 && op.args[1] === 24 && op.args[2] === 1000 && op.args[3] === 600
    );
    assert.ok(watermarkClipRect, 'Watermark harus diklip tepat pada batas area grafik');

    // Periksa teks watermark digambar
    const wmTextOp = targetCanvas.operations.find((op: any) =>
      op.method === 'fillText' && op.args[0] === 'SECURE_TRADER_WATERMARK'
    );
    assert.ok(wmTextOp, 'Teks watermark harus digambar');
  });

  it('7. Clean Chart Export mode merender chart dan side panel tanpa outer border padding maupun attribution bar', () => {
    const parsedPlan = parseTradingPlan(sampleShortPlanMarkdown);
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);

    const options: SnapshotOptions = {
      mode: 'clean',
      scale: 1,
      thesisLayout: 'side-panel',
      tradingPlan: { ...parsedPlan, id: 'clean-plan' },
      metadata: baseMetadata,
    };

    compositeSnapshot(sourceCanvas, options, targetCanvas);

    // Dimensi bersih: lebar = sourceWidth + gap + panelWidth, tinggi = max(sourceHeight, panelHeight)
    assert.equal(targetCanvas.width, 1000 + SNAPSHOT_SIDE_PANEL_GAP + SNAPSHOT_SIDE_PANEL_WIDTH);

    // Chart digambar di (0, 0) tanpa padding luar
    const drawImageOps = targetCanvas.operations.filter((op: any) => op.method === 'drawImage');
    const chartDrawOp = drawImageOps.find((op: any) => op.args[0] === sourceCanvas);
    assert.ok(chartDrawOp);
    assert.equal(chartDrawOp.args[1], 0, 'Clean mode chartX harus 0');
    assert.equal(chartDrawOp.args[2], 0, 'Clean mode chartY harus 0');
    assert.equal(chartDrawOp.args[3], 1000);
    assert.equal(chartDrawOp.args[4], 600);

    // Side panel digambar di sisi kanan (1000 + gap, 0)
    const fillTextOps = targetCanvas.operations.filter((op: any) => op.method === 'fillText');
    const texts = fillTextOps.map((op: any) => op.args[0]);
    assert.ok(texts.some((t: string) => t.includes('BEARISH')), 'Clean mode tetap merender panel tesis');

    // Attribution bar TIDAK boleh ada di clean mode
    assert.ok(!texts.some((t: string) => t === 'trawangan'), 'Clean mode tidak boleh memuat brand trawangan attribution');
    assert.ok(!texts.some((t: string) => t === 'kaleksananbarqi.github.io/trawangan'), 'Clean mode tidak boleh memuat URL');
  });

  it('8. Fallback anggun: Jika thesisLayout !== "side-panel" atau tidak ada plan aktif, side panel tidak digambar', () => {
    const sourceCanvas = createMockCanvas(1000, 600);
    const targetCanvas = createMockCanvas(1, 1);

    // Kasus layout !== 'side-panel'
    compositeSnapshot(sourceCanvas, {
      mode: 'branded',
      scale: 1,
      thesisLayout: 'overlay',
      metadata: baseMetadata,
    }, targetCanvas);

    assert.equal(targetCanvas.width, 1000 + 48, 'Lebar harus single-chart');

    const fillTextOps = targetCanvas.operations.filter((op: any) => op.method === 'fillText');
    const texts = fillTextOps.map((op: any) => op.args[0]);
    assert.ok(!texts.some((t: string) => t.includes('KATALIS ENTRY')), 'Tidak boleh ada panel samping tesis');
  });
});
