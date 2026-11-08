/**
 * Pengujian Unit & Integrasi untuk Deep Module `thesisOverlayEngine`
 *
 * Menguji:
 * 1. Pass 0: `tokenizeEpistemicText`, `deriveThesisSurfacePalette`, dan `buildThesisPresentationModel`
 *    (Dual-Entry E1/E2 + bobot %, Setup Status, Confluence Score, Zone Polarity, sub-badge R-multiple E1,
 *    persentase risiko pada Unit Risiko (R), dan ekstraksi otomatis pil TF).
 * 2. Pass 1: `measureThesisOverlayLayout` — invariant 0px height drift dengan `calculateThesisPanelHeight`
 *    serta pertumbuhan dinamis tinggi saat pil Dual-Entry dan Context Zones membungkus ke beberapa baris.
 * 3. Pass 2: `drawMeasuredThesisLayout` & paritas penuh antara `drawThesisCardOnCanvas` (`floating-card`)
 *    dan `renderDedicatedThesisSidePanel` (`side-panel`), termasuk lencana epistemik berwarna (`[FAKTA]`,
 *    `[INFERENSI]`, `[SPEKULASI]`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeEpistemicText,
  deriveThesisSurfacePalette,
  buildThesisPresentationModel,
  measureThesisOverlayLayout,
  renderThesisOverlayOnCanvas
} from '../src/lib/services/thesisOverlayEngine';
import {
  calculateThesisPanelHeight,
  drawThesisCardOnCanvas,
  renderDedicatedThesisSidePanel,
  SNAPSHOT_SIDE_PANEL_WIDTH
} from '../src/lib/services/chartSnapshotService';
import type { ParsedTradingPlan } from '../src/lib/services/planParserService';
import { THEME_PRESETS } from '../src/lib/constants/themes';

function createRichDualEntryPlan(): ParsedTradingPlan {
  return {
    bias: 'bullish',
    entry: 94900,
    entries: [
      {
        id: 'e1',
        label: 'E1',
        style: 'aggressive',
        price: 95500,
        weight: 0.4,
        reason: 'Reaksi awal order block H1 [FAKTA].'
      },
      {
        id: 'e2',
        label: 'E2',
        style: 'moderate',
        price: 94500,
        weight: 0.6,
        reason: 'Mitigasi penuh FVG H4 [INFERENSI].'
      }
    ],
    stopLoss: 93500,
    targets: [
      {
        id: 'tp1',
        label: 'TP1',
        price: 97300,
        rMultiple: 1.71,
        rMultipleByEntry: { e1: 0.9, e2: 2.8 },
        reason: 'Resistance minor internal H1 [FAKTA].'
      },
      {
        id: 'tp2',
        label: 'TP2',
        price: 99700,
        rMultiple: 3.43,
        rMultipleByEntry: { e1: 2.1, e2: 5.2 },
        reason: 'Target likuiditas eksternal mingguan [SPEKULASI]!'
      }
    ],
    riskAmount: 1400,
    riskPercent: 1.25,
    setupStatus: 'Menunggu Konfirmasi',
    confluenceScore: { score: 8.5, max: 10 },
    reasons: {
      entry:
        'Terbentuk bullish order block pada timeframe H4 dan H1 setelah sweep likuiditas sesi Asia [FAKTA]. Struktur internal beralih bullish dengan displacement volume tinggi [INFERENSI]. Menunggu retest area FVG discount zone [SPEKULASI]!',
      stopLoss:
        'Penutupan candle H4 di bawah swing low 93500 membatalkan skenario struktural [FAKTA].',
      tp1: 'Resistance minor internal H1 [FAKTA].',
      tp2: 'Target likuiditas eksternal mingguan [SPEKULASI]!'
    },
    contextZones: [
      { label: 'Area Demand H4', low: 94200, high: 94800, polarity: 'bull' },
      { label: 'Area Supply H4', low: 99500, high: 100200, polarity: 'bear' },
      { label: 'Zona IDM Likuiditas', low: 95100, high: 95300, polarity: 'neutral' }
    ],
    rawText: 'Dual-Entry Plan Mock',
    validation: { valid: true, errors: [], warnings: [] },
    conclusion: {
      probability: 'Tinggi (A+)',
      probabilityNotes:
        'Konfluensi struktur H4 valid [FAKTA], didukung likuiditas bawah terambil [INFERENSI].',
      invalidationScenario:
        'Jika harga menembus 93500 dengan volume tinggi pada sesi NY [INFERENSI], maka potensi kapitulasi menuju support mingguan [SPEKULASI].'
    },
    definition: 'Rencana posisi Dual-Entry dengan alokasi 40% E1 agresif dan 60% E2 moderat.'
  };
}

function createRecordingCanvasContext() {
  const fillTexts: Array<{
    text: string;
    x: number;
    y: number;
    fillStyle: string;
    font: string;
    textAlign: string;
  }> = [];
  const fills: Array<{ fillStyle: string }> = [];
  const strokes: Array<{ strokeStyle: string; lineWidth: number }> = [];

  const ctx: any = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    roundRect() {},
    rect() {},
    clip() {},
    fill() {
      fills.push({ fillStyle: String(this.fillStyle) });
    },
    stroke() {
      strokes.push({ strokeStyle: String(this.strokeStyle), lineWidth: Number(this.lineWidth) });
    },
    fillRect() {
      fills.push({ fillStyle: String(this.fillStyle) });
    },
    strokeRect() {},
    fillText(text: string, x: number, y: number) {
      fillTexts.push({
        text: String(text),
        x,
        y,
        fillStyle: String(this.fillStyle),
        font: String(this.font),
        textAlign: String(this.textAlign)
      });
    },
    measureText(text: string) {
      return { width: String(text).length * 7 };
    }
  };

  return { ctx, fillTexts, fills, strokes };
}

describe('Thesis Overlay Engine Suite (Pass 0, Pass 1, Pass 2 & Paritas Tiga Jalur)', () => {
  describe('1. Pass 0: tokenizeEpistemicText (Safe View-Model Tokenization tanpa {@html})', () => {
    it('memecah tag [FAKTA], [INFERENSI], dan [SPEKULASI] beserta tanda baca pengikut menjadi segmen terstruktur tanpa injeksi HTML', () => {
      const raw =
        'Struktur H4 valid [FAKTA], mitigasi FVG [INFERENSI]. Potensi reli lanjutan [SPEKULASI]! <script>alert(1)</script>';
      const segments = tokenizeEpistemicText(raw);

      const fullJoined = segments
        .map((s) => (s.type === 'text' ? s.content : `${s.label}${s.trailingPunct || ''}`))
        .join('');
      assert.ok(!fullJoined.includes('<script>'), 'Tag HTML berbahaya harus dilucuti');

      const badges = segments.filter(
        (s): s is Extract<(typeof segments)[number], { type: 'badge' }> => s.type === 'badge'
      );
      assert.equal(badges.length, 3);
      assert.deepEqual(
        badges.map((b) => ({ kind: b.kind, label: b.label, trailingPunct: b.trailingPunct })),
        [
          { kind: 'fakta', label: '[FAKTA]', trailingPunct: ',' },
          { kind: 'inferensi', label: '[INFERENSI]', trailingPunct: '.' },
          { kind: 'spekulasi', label: '[SPEKULASI]', trailingPunct: '!' }
        ]
      );
    });
  });

  describe('2. Pass 0: buildThesisPresentationModel (Kebenaran Tunggal Semafor & Dual-Entry)', () => {
    it('membangun model presentasi lengkap untuk Dual-Entry, Setup Status, Confluence Score, R-multiple E1, dan Risk Percent', () => {
      const plan = createRichDualEntryPlan();
      const vm = buildThesisPresentationModel(plan, { variant: 'side-panel' });

      assert.equal(vm.entrySection.title, 'BLENDED ENTRY');
      assert.equal(vm.header.setupStatusBadge, 'Menunggu Konfirmasi');
      assert.equal(vm.header.confluenceBadge?.shortText, '8.5/10');
      assert.equal(vm.header.confluenceBadge?.fullText, 'Skor 8.5/10');

      // Pil Dual-Entry E1 & E2 beserta bobot %
      assert.equal(vm.entrySection.dualEntries.length, 2);
      assert.ok(vm.entrySection.dualEntries[0].pillText.includes('E1:'));
      assert.ok(vm.entrySection.dualEntries[0].pillText.includes('(40%)'));
      assert.ok(vm.entrySection.dualEntries[1].pillText.includes('E2:'));
      assert.ok(vm.entrySection.dualEntries[1].pillText.includes('(60%)'));

      // Pil Zona Konteks dengan Polaritas (bullish, bearish, neutral)
      assert.equal(vm.entrySection.contextZones.length, 3);
      assert.equal(vm.entrySection.contextZones[0].polarity, 'bullish');
      assert.equal(vm.entrySection.contextZones[1].polarity, 'bearish');
      assert.equal(vm.entrySection.contextZones[2].polarity, 'neutral');

      // Ekstraksi otomatis pil Timeframe
      assert.ok(
        vm.entrySection.timeframePills.includes('TF H4') ||
          vm.entrySection.timeframePills.includes('TF H1')
      );

      // Sub-badge R-multiple E1 pada item Target Profit
      assert.equal(vm.targetsSection.items.length, 2);
      assert.equal(vm.targetsSection.items[0].rBadge?.e1SubText, '(0.9R E1)');
      assert.ok(vm.targetsSection.items[0].rBadge?.combinedText.includes('(0.9R E1)'));

      // Footer Unit Risiko (R) mencakup persentase risiko
      assert.ok(vm.riskFooter);
      assert.equal(vm.riskFooter.riskPercentText, '(1.25%)');
      assert.ok(vm.riskFooter.combinedRiskValue?.includes('(1.25%)'));
    });
  });

  describe('3. Pass 1: measureThesisOverlayLayout & Invariant 0px Height Drift', () => {
    it('menjamin 0px drift antara calculateThesisPanelHeight dan measureThesisOverlayLayout.outerBox.h', () => {
      const plan = createRichDualEntryPlan();
      const panelHeight = calculateThesisPanelHeight(plan, SNAPSHOT_SIDE_PANEL_WIDTH);
      const layout = measureThesisOverlayLayout(plan, {
        variant: 'side-panel',
        x: 0,
        y: 0,
        width: SNAPSHOT_SIDE_PANEL_WIDTH,
        scaleX: 1,
        scaleY: 1,
        coordsAreScaled: true
      });

      assert.equal(panelHeight, Math.ceil(layout.outerBox.h));
      assert.ok(panelHeight > 500, `Tinggi panel Dual-Entry kaya harus > 500px, didapat ${panelHeight}px`);
    });

    it('memperluas tinggi tata letak secara akurat ketika pil Dual-Entry dan Zona Konteks membungkus ke beberapa baris', () => {
      const basePlan: ParsedTradingPlan = {
        bias: 'bullish',
        entry: 95000,
        stopLoss: 94000,
        targets: [{ id: 'tp1', label: 'TP1', price: 97000, rMultiple: 2 }],
        riskAmount: 1000,
        reasons: { entry: 'Alasan singkat [FAKTA].', stopLoss: 'SL singkat.' },
        contextZones: [],
        rawText: '',
        validation: { valid: true, errors: [], warnings: [] }
      };

      const richPlan: ParsedTradingPlan = {
        ...basePlan,
        setupStatus: 'Aktif / Triggered',
        confluenceScore: { score: 9, max: 10 },
        entries: [
          { id: 'e1', label: 'E1', price: 95200, weight: 0.5, style: 'aggressive' },
          { id: 'e2', label: 'E2', price: 94800, weight: 0.5, style: 'moderate' }
        ],
        contextZones: [
          { label: 'Demand Mayor H4', low: 94500, high: 94900, polarity: 'bull' },
          { label: 'Supply Eksternal D1', low: 98000, high: 98800, polarity: 'bear' },
          { label: 'Liquidity Pool', low: 94100, high: 94300, polarity: 'neutral' }
        ]
      };

      const baseH = calculateThesisPanelHeight(basePlan, SNAPSHOT_SIDE_PANEL_WIDTH);
      const richH = calculateThesisPanelHeight(richPlan, SNAPSHOT_SIDE_PANEL_WIDTH);

      assert.ok(
        richH > baseH + 40,
        `Rencana dengan pil Dual-Entry & Context Zones harus lebih tinggi secara signifikan (${richH}px vs ${baseH}px)`
      );
    });
  });

  describe('4. Pass 2: Paritas Penuh antara Floating Card & Side Panel di Canvas2D', () => {
    it('renderDedicatedThesisSidePanel kini merender pil Dual-Entry (E1/E2 + bobot %), Setup Status, Confluence Score, sub-badge E1 R-multiple, dan lencana epistemik', () => {
      const plan = createRichDualEntryPlan();
      const { ctx, fillTexts } = createRecordingCanvasContext();

      renderDedicatedThesisSidePanel(
        ctx,
        plan,
        0,
        0,
        SNAPSHOT_SIDE_PANEL_WIDTH,
        850,
        1,
        THEME_PRESETS.signature
      );

      const renderedStrings = fillTexts.map((t) => t.text);

      // Header & Metadata baru pada Side Panel
      assert.ok(renderedStrings.some((t) => t.includes('BLENDED ENTRY')), 'Judul seksi entry harus memuat BLENDED ENTRY');
      assert.ok(renderedStrings.some((t) => t === 'Menunggu Konfirmasi'), 'Side-panel harus merender Setup Status badge');
      assert.ok(renderedStrings.some((t) => t.includes('8.5/10')), 'Side-panel harus merender Confluence Score badge');

      // Pil E1 dan E2 dengan bobot %
      assert.ok(
        renderedStrings.some((t) => t.startsWith('E1:') && t.includes('(40%)')),
        'Side-panel harus merender pil E1 beserta bobot (40%)'
      );
      assert.ok(
        renderedStrings.some((t) => t.startsWith('E2:') && t.includes('(60%)')),
        'Side-panel harus merender pil E2 beserta bobot (60%)'
      );

      // Lencana epistemik berwarna pada Side Panel
      const faktaCalls = fillTexts.filter((t) => t.text === '[FAKTA]');
      const inferensiCalls = fillTexts.filter((t) => t.text === '[INFERENSI]');
      const spekulasiCalls = fillTexts.filter((t) => t.text === '[SPEKULASI]');
      assert.ok(faktaCalls.length >= 2, 'Harus merender lencana [FAKTA]');
      assert.ok(inferensiCalls.length >= 2, 'Harus merender lencana [INFERENSI]');
      assert.ok(spekulasiCalls.length >= 2, 'Harus merender lencana [SPEKULASI]');
      assert.equal(faktaCalls[0].fillStyle.toUpperCase(), '#38BDF8');
      assert.equal(inferensiCalls[0].fillStyle.toUpperCase(), '#FACC15');
      assert.equal(spekulasiCalls[0].fillStyle.toUpperCase(), '#FB923C');

      // Sub-badge R-multiple E1 pada TP dan persentase risiko pada Unit Risiko (R)
      assert.ok(
        renderedStrings.some((t) => t.includes('E1)')),
        'Side-panel harus merender sub-badge R-multiple terhadap E1 pada baris TP'
      );
      assert.ok(
        renderedStrings.some((t) => t.includes('(1.25%)')),
        'Side-panel harus merender persentase risiko pada footer Unit Risiko (R)'
      );
    });

    it('drawThesisCardOnCanvas (floating-card) kini merender lencana epistemik berwarna ([FAKTA], [INFERENSI], [SPEKULASI]), sub-badge R-multiple E1, dan Risk Percent', () => {
      const plan = createRichDualEntryPlan();
      const { ctx, fillTexts } = createRecordingCanvasContext();

      drawThesisCardOnCanvas(
        ctx,
        { ...plan, id: 'plan-dual-1' },
        1,
        1,
        (p) => (p != null ? `$${p.toLocaleString('en-US')}` : '-'),
        16,
        56,
        360,
        undefined,
        false,
        THEME_PRESETS.signature
      );

      const renderedStrings = fillTexts.map((t) => t.text);

      // Lencana epistemik berwarna pada Floating Card
      const faktaCalls = fillTexts.filter((t) => t.text === '[FAKTA]');
      const inferensiCalls = fillTexts.filter((t) => t.text === '[INFERENSI]');
      const spekulasiCalls = fillTexts.filter((t) => t.text === '[SPEKULASI]');
      assert.ok(faktaCalls.length >= 2, 'Floating card snapshot harus merender lencana [FAKTA] terpisah');
      assert.ok(inferensiCalls.length >= 2, 'Floating card snapshot harus merender lencana [INFERENSI] terpisah');
      assert.ok(spekulasiCalls.length >= 2, 'Floating card snapshot harus merender lencana [SPEKULASI] terpisah');
      assert.equal(faktaCalls[0].fillStyle.toUpperCase(), '#38BDF8');
      assert.equal(inferensiCalls[0].fillStyle.toUpperCase(), '#FACC15');
      assert.equal(spekulasiCalls[0].fillStyle.toUpperCase(), '#FB923C');

      // Sub-badge R-multiple E1 dan persentase risiko
      assert.ok(
        renderedStrings.some((t) => t.includes('E1)')),
        'Floating card snapshot harus merender sub-badge R-multiple terhadap E1'
      );
      assert.ok(
        renderedStrings.some((t) => t.includes('(1.25%)')),
        'Floating card snapshot harus merender persentase risiko pada footer Unit Risiko (R)'
      );
    });

    it('deriveThesisSurfacePalette dan renderThesisOverlayOnCanvas menghormati kontras ADR-0019 pada tema kustom berlatar gelap dengan bgSecondary terang', () => {
      const darkChartLightPanelTheme = {
        ...THEME_PRESETS.signature,
        chart: {
          ...THEME_PRESETS.signature.chart,
          background: '#0B0E14'
        },
        tokens: {
          ...THEME_PRESETS.signature.tokens,
          bgSecondary: '#F8FAFC',
          textMain: '#F8FAFC'
        }
      };

      const palette = deriveThesisSurfacePalette(darkChartLightPanelTheme, 'bullish', 'side-panel');
      assert.notEqual(palette.surfaceBg.toUpperCase(), '#F8FAFC');

      const plan = createRichDualEntryPlan();
      const { ctx, fillTexts } = createRecordingCanvasContext();
      const layout = renderThesisOverlayOnCanvas(ctx, plan, {
        variant: 'side-panel',
        x: 0,
        y: 0,
        width: SNAPSHOT_SIDE_PANEL_WIDTH,
        themeConfig: darkChartLightPanelTheme,
        measureCtx: ctx
      });

      assert.ok(layout.outerBox.h > 500);
      assert.ok(fillTexts.length > 20);
    });
  });
});
