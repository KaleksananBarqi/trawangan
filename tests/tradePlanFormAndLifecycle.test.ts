/**
 * Pengujian komprehensif fitur Form Trade Plan Panel Kanan & Siklus Hidup Edit In-Place:
 * 1. Round-trip serializer (`serializeTradingPlanToMarkdown` -> `parseTradingPlan`) untuk Single Entry,
 *    Dual Entry, Zona Konteks kustom, alasan per-TP, konfluensi, `probabilityNotes` lossless, & invalidasi.
 * 2. Konversi bolak-balik draf form (`planToFormDraft` <-> `buildParsedPlanFromFormDraft`), kalkulasi
 *    `computeRiskPercent`, `preservedEntryLabels`, pembulatan `tickSize`, dan validasi Sanity Guard.
 * 3. Helper sinkronisasi 2-arah `resolveSubModeTransition` lintas tab `Riwayat` & finalisasi kanonik
 *    `finalizePlanFromTabSubmission` dari `'form'` maupun `'text'`.
 * 4. Mutasi in-place `TradingPlanLifecycle.updatePlan` (read-only symbol pinning) & `replaceExistingOnSymbol`.
 * 5. Integrasi ketat `ChartDrawingController.updateTradingPlan` (`UpdatePlanOptions`, `handleDrawingMutated()`,
 *    Undo/Redo atomik `PlanUpdateUndoTransaction` tanpa orphan drawings).
 * 6. Rekonsiliasi Plan-Linked Auto-Alerts (`hasActiveAlertsForPlan` & `reconcilePlanAlerts`).
 * 7. Helper modular `panelResizeHelper` (`clampPanelWidth`, `adjustPanelWidthByKeyboard`,
 *    `startEdgeResizeSession`, dan `cancel()` cleanup).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTradingPlan,
  type ParsedTradingPlan
} from '../src/lib/services/planParserService';
import {
  buildParsedPlanFromFormDraft,
  computeRiskPercent,
  createEmptyPlanFormDraft,
  finalizePlanFromTabSubmission,
  planToFormDraft,
  resolveSubModeTransition,
  serializeTradingPlanToMarkdown
} from '../src/lib/services/tradePlanFormService';
import {
  TradingPlanLifecycle,
  type TradingPlanHostPort,
  type TradingPlanExecutionContext,
  type PlanUndoTransaction,
  type ActiveTradingPlan
} from '../src/lib/services/tradingPlanLifecycle';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { alertService } from '../src/lib/services/alertService';
import {
  adjustPanelWidthByKeyboard,
  clampPanelWidth,
  startEdgeResizeSession,
  type ResizeWindowTarget
} from '../src/lib/services/panelResizeHelper';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import type { SavedTradingPlanRecord } from '../src/lib/types/market';

class InMemoryPlanEditHost implements TradingPlanHostPort {
  public drawings: any[] = [];
  public symbol = 'BTCUSDT';
  public providerId = 'binance';
  public timeframe = '15m';
  public deltaT = 900_000;
  public latestCandleTime = 1_700_000_000_000;
  public hasActiveCanvas = true;

  public vaultRecords: SavedTradingPlanRecord[] = [];
  public undoTransactions: PlanUndoTransaction[] = [];
  public ensuredSymbols: string[] = [];
  public alertsMap = new Map<string, boolean>();
  public reconcileCalls: Array<{
    planId: string;
    enabled: boolean;
    bias: string;
    entry: number;
    stopLoss: number;
    tpCount: number;
  }> = [];
  public deletedAlertPlanIds: string[] = [];
  public stateChangedCount = 0;

  private nextId = 1;

  getContext(): TradingPlanExecutionContext {
    return {
      hasActiveCanvas: this.hasActiveCanvas,
      symbol: this.symbol,
      providerId: this.providerId,
      timeframe: this.timeframe,
      deltaT: this.deltaT,
      latestCandleTime: this.latestCandleTime
    };
  }

  async ensureSymbolReady(targetSymbol: string): Promise<void> {
    this.ensuredSymbols.push(targetSymbol);
    this.symbol = targetSymbol;
  }

  getCanvasDrawings(): any[] {
    return this.drawings;
  }

  createCanvasDrawing(spec: Record<string, any>): any | null {
    const id = spec.id || `draw_${this.nextId++}`;
    const rec = structuredClone({ ...spec, id });
    this.drawings.push(rec);
    return rec;
  }

  removeCanvasDrawings(ids: string[]): void {
    const set = new Set(ids);
    this.drawings = this.drawings.filter((d) => !set.has(d.id));
  }

  recordUndoAction(tx: PlanUndoTransaction): void {
    this.undoTransactions.push(structuredClone(tx));
  }

  saveToVault(record: SavedTradingPlanRecord): void {
    const idx = this.vaultRecords.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      this.vaultRecords[idx] = structuredClone(record);
    } else {
      this.vaultRecords.push(structuredClone(record));
    }
  }

  hasActiveAlerts(planId: string): boolean {
    return Boolean(this.alertsMap.get(planId));
  }

  addPlanAlerts(plan: ActiveTradingPlan, _symbol: string): void {
    this.alertsMap.set(plan.id, true);
  }

  reconcilePlanAlerts(
    plan: ActiveTradingPlan,
    options: { enabled: boolean; fallbackSymbol: string }
  ): void {
    this.alertsMap.set(plan.id, options.enabled);
    this.reconcileCalls.push({
      planId: plan.id,
      enabled: options.enabled,
      bias: plan.bias,
      entry: plan.entry,
      stopLoss: plan.stopLoss,
      tpCount: plan.targets.length
    });
  }

  deleteAlertsByPlanId(planId: string): void {
    this.alertsMap.set(planId, false);
    this.deletedAlertPlanIds.push(planId);
  }

  onStateChanged(): void {
    this.stateChangedCount++;
  }
}

describe('Trade Plan Right Panel Form, Markdown Serializer & In-Place Update Suite', () => {
  describe('1. Form Builder, Lossless Markdown Round-Trip & Sync Helpers', () => {
    it('melakukan round-trip lossless untuk Single-Entry Plan beserta Zona Konteks kustom, alasan TP, & Kesimpulan', () => {
      const draft = createEmptyPlanFormDraft('BTCUSDT');
      draft.bias = 'bearish';
      draft.setupStatus = 'Menunggu Konfirmasi (Valid)';
      draft.entryMode = 'single';
      draft.entry = '81200';
      draft.stopLoss = '81400';
      draft.riskPercent = '1.25';
      draft.entryReason = 'Respek Bearish FVG LTF [FAKTA] setelah sweep buy-side [INFERENSI]';
      draft.stopLossReason = 'Di atas swing high 81380 dengan buffer 20 poin [FAKTA]';
      draft.targets = [
        { id: 'tp1', label: 'TP1', price: '80355.4', reason: 'Swing low internal 15m [INFERENSI]' },
        { id: 'tp2', label: 'TP2', price: '79429.0', reason: 'External SSL Harian [SPEKULASI]' }
      ];
      draft.contextZones = [
        {
          id: 'z1',
          label: 'POI Supply Ekstrem H4',
          polarity: 'bear',
          low: '81182.2',
          high: '81236.7',
          kind: 'SUPPLY'
        },
        {
          id: 'z2',
          label: 'Demand Support HTF',
          polarity: 'bull',
          low: '79380',
          high: '79460',
          kind: 'OB'
        }
      ];
      draft.definition = 'Setup counter-trend di premium array.';
      draft.confluenceScore = '7';
      draft.confluenceMax = '10';
      draft.probability = 'Tinggi';
      draft.probabilityNotes = 'Sejalan orderflow 4H [INFERENSI]';
      draft.invalidationScenario = 'Close H1 solid di atas 81450 [FAKTA]';

      const built = buildParsedPlanFromFormDraft(draft);
      assert.equal(built.validation.valid, true);
      assert.equal(built.bias, 'bearish');
      assert.equal(built.symbol, 'BTCUSDT');
      assert.equal(built.entry, 81200);
      assert.equal(built.stopLoss, 81400);
      assert.equal(built.riskAmount, 200);
      assert.equal(built.riskPercent, 1.25);
      assert.equal(built.targets.length, 2);
      assert.equal(built.targets[0].rMultiple, 4.22);
      assert.equal(built.targets[1].rMultiple, 8.86);

      // Pastikan Zona Konteks diletakkan SEBELUM heading Kesimpulan agar terurai ulang dengan utuh
      const idxZones = built.rawText.indexOf('### Zona Konteks');
      const idxKesimpulan = built.rawText.indexOf('### Kesimpulan');
      assert.ok(idxZones > 0 && idxKesimpulan > idxZones, 'Zona Konteks harus terbit sebelum ### Kesimpulan');

      // Parse ulang Markdown hasil serialisasi & pastikan label zona kustom tetap utuh
      const reparsed = parseTradingPlan(built.rawText);
      assert.equal(reparsed.validation.valid, true);
      assert.equal(reparsed.bias, 'bearish');
      assert.equal(reparsed.symbol, 'BTCUSDT');
      assert.equal(reparsed.setupStatus, 'Menunggu Konfirmasi (Valid)');
      assert.equal(reparsed.entry, 81200);
      assert.equal(reparsed.stopLoss, 81400);
      assert.equal(reparsed.riskPercent, 1.25);
      assert.equal(reparsed.targets.length, 2);
      assert.equal(reparsed.targets[0].price, 80355.4);
      assert.equal(reparsed.targets[1].price, 79429);
      assert.equal(reparsed.targets[0].reason, 'Swing low internal 15m [INFERENSI]');
      assert.equal(reparsed.reasons.entry, draft.entryReason);
      assert.equal(reparsed.reasons.stopLoss, draft.stopLossReason);
      assert.equal(reparsed.contextZones.length, 2);
      assert.equal(reparsed.contextZones[0].label, 'POI Supply Ekstrem H4');
      assert.equal(reparsed.contextZones[1].label, 'Demand Support HTF');
      assert.equal(reparsed.confluenceScore?.score, 7);
      assert.equal(reparsed.confluenceScore?.max, 10);
      assert.equal(reparsed.conclusion?.probability, 'Tinggi');
      assert.equal(reparsed.conclusion?.probabilityNotes, 'Sejalan orderflow 4H [INFERENSI]');
      assert.equal(reparsed.conclusion?.invalidationScenario, 'Close H1 solid di atas 81450 [FAKTA]');
      assert.equal(reparsed.definition, 'Setup counter-trend di premium array.');
    });

    it('menjaga probabilityNotes lossless tanpa menyisipkan "Sedang" saat probability kosong', () => {
      const draft = createEmptyPlanFormDraft('BTCUSDT');
      draft.bias = 'bullish';
      draft.entry = '62000';
      draft.stopLoss = '61000';
      draft.targets = [{ id: 'tp1', label: 'TP1', price: '65000', reason: '' }];
      draft.probability = '';
      draft.probabilityNotes = 'Menunggu sweep minor low London session [INFERENSI]';

      const built = buildParsedPlanFromFormDraft(draft);
      assert.equal(built.conclusion?.probability, undefined);
      assert.equal(built.conclusion?.probabilityNotes, 'Menunggu sweep minor low London session [INFERENSI]');
      assert.ok(!built.rawText.includes('Probabilitas Keberhasilan**: Sedang'));
      assert.ok(built.rawText.includes('Catatan Probabilitas'));

      const reparsed = parseTradingPlan(built.rawText);
      assert.equal(reparsed.conclusion?.probability, undefined);
      assert.equal(reparsed.conclusion?.probabilityNotes, 'Menunggu sweep minor low London session [INFERENSI]');

      const backToDraft = planToFormDraft(reparsed, 'BTCUSDT');
      assert.equal(backToDraft.probability, '');
      assert.equal(backToDraft.probabilityNotes, 'Menunggu sweep minor low London session [INFERENSI]');
    });

    it('menghitung Blended Entry, preservedEntryLabels, & computeRiskPercent secara akurat', () => {
      assert.equal(computeRiskPercent(2000, 1900), 5);
      assert.equal(computeRiskPercent(0, 1900), undefined);
      assert.equal(computeRiskPercent(2000, 2000), undefined);

      const draft = createEmptyPlanFormDraft('ETHUSDT');
      draft.bias = 'bullish';
      draft.entryMode = 'dual';
      draft.e1Price = '2000';
      draft.e1WeightPct = '40';
      draft.e2Price = '1950';
      draft.e2WeightPct = '60';
      draft.preservedEntryLabels = { e1: 'E1 Sweep (40%)', e2: 'E2 Core Demand (60%)' };
      draft.stopLoss = '1900';
      draft.targets = [
        { id: 'tp1', label: 'TP1', price: '2150', reason: 'Mid-range EQH' },
        { id: 'tp2', label: 'TP2', price: '2300', reason: 'External BSL' }
      ];

      const built = buildParsedPlanFromFormDraft(draft);
      assert.equal(built.validation.valid, true);
      // Blended = (0.4 * 2000) + (0.6 * 1950) = 1970
      assert.equal(built.entry, 1970);
      assert.equal(built.entries?.length, 2);
      assert.equal(built.entries?.[0].label, 'E1 Sweep (40%)');
      assert.equal(built.entries?.[1].label, 'E2 Core Demand (60%)');
      assert.equal(built.riskAmount, 70);
      assert.equal(built.targets[0].rMultiple, 2.57);
      assert.equal(built.targets[0].rMultipleByEntry?.e1, 1.5);
      assert.equal(built.targets[0].rMultipleByEntry?.e2, 4);

      const reparsed = parseTradingPlan(built.rawText);
      assert.equal(reparsed.validation.valid, true);
      assert.equal(reparsed.entries?.length, 2);
      assert.equal(reparsed.entries?.[0].price, 2000);
      assert.equal(reparsed.entries?.[1].price, 1950);
      assert.equal(reparsed.entry, 1970);
      assert.equal(reparsed.targets[0].rMultipleByEntry?.e1, 1.5);

      const roundTrippedDraft = planToFormDraft(reparsed, 'ETHUSDT');
      assert.equal(roundTrippedDraft.entryMode, 'dual');
      assert.equal(roundTrippedDraft.e1Price, '2000');
      assert.equal(roundTrippedDraft.e2Price, '1950');
      assert.equal(roundTrippedDraft.e1WeightPct, '40');
      assert.equal(roundTrippedDraft.e2WeightPct, '60');
      assert.equal(roundTrippedDraft.preservedEntryLabels?.e1, 'E1 Sweep (40%)');
      assert.equal(roundTrippedDraft.preservedEntryLabels?.e2, 'E2 Core Demand (60%)');
    });

    it('resolveSubModeTransition menjaga sinkronisasi 2-arah Form <-> Teks bahkan setelah melewati tab Riwayat', () => {
      const formDraft = createEmptyPlanFormDraft('BTCUSDT');
      formDraft.bias = 'bullish';
      formDraft.entry = '64500';
      formDraft.stopLoss = '63500';
      formDraft.targets = [{ id: 'tp1', label: 'TP1', price: '67500', reason: '' }];
      const previewPlan = buildParsedPlanFromFormDraft(formDraft);

      // Form -> History
      const toHistory = resolveSubModeTransition({
        currentSubMode: 'form',
        nextSubMode: 'history',
        lastEditedSource: 'form',
        textBuffer: 'stale-old-text',
        formPreviewPlan: previewPlan,
        currentFormSymbol: 'BTCUSDT',
        activeSymbol: 'BTCUSDT'
      });
      assert.equal(toHistory.nextSubMode, 'history');
      assert.equal(toHistory.shouldRefreshHistory, true);

      // History -> Text (karena lastEditedSource === 'form', textBuffer harus diregenerasi dari formPreviewPlan!)
      const historyToText = resolveSubModeTransition({
        currentSubMode: 'history',
        nextSubMode: 'text',
        lastEditedSource: 'form',
        textBuffer: 'stale-old-text',
        formPreviewPlan: previewPlan,
        currentFormSymbol: 'BTCUSDT',
        activeSymbol: 'BTCUSDT'
      });
      assert.equal(historyToText.nextSubMode, 'text');
      assert.ok(historyToText.nextTextBuffer?.includes('64500'));
      assert.equal(historyToText.shouldFocusTextArea, true);

      // Sebaliknya: Text diedit -> History -> Form => Form harus dihidrasi ulang dari textBuffer!
      const editedText = historyToText.nextTextBuffer!.replace('67500', '69000');
      const historyToForm = resolveSubModeTransition({
        currentSubMode: 'history',
        nextSubMode: 'form',
        lastEditedSource: 'text',
        textBuffer: editedText,
        formPreviewPlan: previewPlan,
        currentFormSymbol: 'BTCUSDT',
        activeSymbol: 'BTCUSDT'
      });
      assert.equal(historyToForm.nextSubMode, 'form');
      assert.equal(historyToForm.nextFormDraft?.targets[0].price, '69000');
    });

    it('finalizePlanFromTabSubmission menghasilkan rawText kanonik dan harga ter-align tickSize dari sub-mode Form & Teks', () => {
      const draft = createEmptyPlanFormDraft('SOLUSDT');
      draft.bias = 'bullish';
      draft.entry = '150.124';
      draft.stopLoss = '145.006';
      draft.targets = [{ id: 'tp1', label: 'TP1', price: '165.494', reason: 'Target R' }];

      const formPreview = buildParsedPlanFromFormDraft(draft);
      const fromForm = finalizePlanFromTabSubmission({
        subMode: 'form',
        textBuffer: '',
        effectiveFormDraft: draft,
        previewPlan: formPreview,
        activeSymbol: 'SOLUSDT',
        chartTickSize: 0.01
      });
      assert.equal(fromForm.plan.entry, 150.12);
      assert.equal(fromForm.plan.stopLoss, 145.01);
      assert.equal(fromForm.plan.targets[0].price, 165.49);
      assert.ok(fromForm.plan.rawText.includes('| Parameter | Nilai |'));
      assert.ok(fromForm.plan.rawText.includes('### Zona Konteks') === false);
      assert.ok(fromForm.plan.rawText.includes('150.12'));

      // Dari Teks mentah bullet -> finalize harus menghasilkan Markdown tabel kanonikal yang seragam
      const bulletInput = '- Bias: Bearish\n- Entry: 2100.123\n- SL: 2150.678\n- TP1: 1950.444\n';
      const textPreview = parseTradingPlan(bulletInput);
      const fromText = finalizePlanFromTabSubmission({
        subMode: 'text',
        textBuffer: bulletInput,
        effectiveFormDraft: draft,
        previewPlan: textPreview,
        activeSymbol: 'ETHUSDT',
        chartTickSize: 0.01
      });
      assert.equal(fromText.plan.symbol, 'ETHUSDT');
      assert.equal(fromText.plan.entry, 2100.12);
      assert.equal(fromText.plan.stopLoss, 2150.68);
      assert.equal(fromText.plan.targets[0].price, 1950.44);
      assert.ok(fromText.plan.rawText.includes('| Parameter | Nilai |'));
      assert.ok(fromText.plan.rawText.includes('| Symbol | ETHUSDT |'));
      assert.ok(fromText.plan.rawText.includes('2100.12'));
      assert.ok(fromText.plan.rawText.includes('2150.68'));
      assert.ok(fromText.plan.rawText.includes('1950.44'));
    });

    it('membulatkan harga sesuai tickSize saat roundPrices aktif dan memblokir setup tidak valid lewat Sanity Guard', () => {
      const draft = createEmptyPlanFormDraft('SOLUSDT');
      draft.bias = 'bullish';
      draft.entryMode = 'single';
      draft.entry = '150.124';
      draft.stopLoss = '145.006';
      draft.targets = [{ id: 'tp1', label: 'TP1', price: '165.494', reason: '' }];

      const rounded = buildParsedPlanFromFormDraft(draft, { tickSize: 0.01, roundPrices: true });
      assert.equal(rounded.validation.valid, true);
      assert.equal(rounded.entry, 150.12);
      assert.equal(rounded.stopLoss, 145.01);
      assert.equal(rounded.targets[0].price, 165.49);

      // Uji Sanity Guard: SL di atas Entry untuk Bullish harus gagal
      const badDraft = createEmptyPlanFormDraft('SOLUSDT');
      badDraft.bias = 'bullish';
      badDraft.entry = '150';
      badDraft.stopLoss = '155';
      badDraft.targets = [{ id: 'tp1', label: 'TP1', price: '170', reason: '' }];

      const invalidPlan = buildParsedPlanFromFormDraft(badDraft);
      assert.equal(invalidPlan.validation.valid, false);
      assert.ok(invalidPlan.validation.errors.length > 0);
    });
  });

  describe('2. TradingPlanLifecycle: updatePlan In-Place, Read-Only Symbol Pinning & replaceExistingOnSymbol', () => {
    let host: InMemoryPlanEditHost;
    let lifecycle: TradingPlanLifecycle;

    beforeEach(() => {
      host = new InMemoryPlanEditHost();
      lifecycle = new TradingPlanLifecycle(host);
    });

    it('memperbarui plan aktif secara in-place sambil mempertahankan planId, koordinat X stage, dan custom riskPercent', () => {
      const initialDraft = createEmptyPlanFormDraft('BTCUSDT');
      initialDraft.bias = 'bullish';
      initialDraft.entry = '60000';
      initialDraft.stopLoss = '59000';
      initialDraft.targets = [
        { id: 'tp1', label: 'TP1', price: '62000', reason: 'Minor high' },
        { id: 'tp2', label: 'TP2', price: '64000', reason: 'Major high' }
      ];
      const initialPlan = buildParsedPlanFromFormDraft(initialDraft);

      const projected = lifecycle.projectPlan(initialPlan, {
        planId: 'plan_edit_1',
        autoCreateAlerts: true
      });
      assert.ok(projected);

      // Simulasikan pengguna telah menggeser lebar horizontal kotak posisi di kanvas
      const posDrawingsBefore = host.drawings.filter((d) => d.type === 'position');
      assert.equal(posDrawingsBefore.length, 2);
      posDrawingsBefore[0].anchors[0].time = 1_700_050_000_000;
      posDrawingsBefore[0].anchors[2].time = 1_700_090_000_000;
      posDrawingsBefore[1].anchors[0].time = 1_700_090_000_000;
      posDrawingsBefore[1].anchors[2].time = 1_700_140_000_000;

      // Edit melalui form: ubah menjadi Dual Entry, naikkan SL, tambah TP3 + zona konteks + custom riskPercent 1.75%
      const editedDraft = planToFormDraft(projected.plan, 'BTCUSDT');
      editedDraft.entryMode = 'dual';
      editedDraft.e1Price = '60200';
      editedDraft.e1WeightPct = '50';
      editedDraft.e2Price = '59600';
      editedDraft.e2WeightPct = '50';
      editedDraft.stopLoss = '58900';
      editedDraft.riskPercent = '1.75';
      editedDraft.targets = [
        { id: 'tp1', label: 'TP1', price: '62500', reason: 'Updated TP1' },
        { id: 'tp2', label: 'TP2', price: '64500', reason: 'Updated TP2' },
        { id: 'tp3', label: 'TP3', price: '67000', reason: 'Extended TP3' }
      ];
      editedDraft.contextZones = [
        { id: 'z1', label: 'Bullish FVG', polarity: 'bull', low: '59500', high: '59800', kind: 'FVG' }
      ];
      const editedPlan = buildParsedPlanFromFormDraft(editedDraft);

      const updated = lifecycle.updatePlan('plan_edit_1', editedPlan, { autoCreateAlerts: false });
      assert.ok(updated);
      assert.equal(updated.planId, 'plan_edit_1');
      assert.equal(updated.plan.entry, 59900);
      assert.equal(updated.plan.stopLoss, 58900);
      assert.equal(updated.plan.riskPercent, 1.75);
      assert.equal(updated.plan.targets.length, 3);

      // Koordinat waktu stage 1 dan stage 2 harus diwarisi, stage 3 melanjutkan setelah stage 2
      const posDrawingsAfter = host.drawings
        .filter((d) => d.type === 'position')
        .sort((a, b) => a.metadata.stageIndex - b.metadata.stageIndex);
      assert.equal(posDrawingsAfter.length, 3);
      assert.equal(posDrawingsAfter[0].anchors[0].time, 1_700_050_000_000);
      assert.equal(posDrawingsAfter[0].anchors[2].time, 1_700_090_000_000);
      assert.equal(posDrawingsAfter[1].anchors[0].time, 1_700_090_000_000);
      assert.equal(posDrawingsAfter[1].anchors[2].time, 1_700_140_000_000);
      assert.equal(posDrawingsAfter[2].anchors[0].time, 1_700_140_000_000);

      // Dual entry box + Context zone box ikut tercipta
      assert.equal(host.drawings.filter((d) => d.metadata?.role === 'entry_zone').length, 1);
      assert.equal(host.drawings.filter((d) => d.metadata?.role === 'context_zone').length, 1);

      // Record Vault diperbarui pada ID yang sama (tidak duplikat)
      assert.equal(host.vaultRecords.length, 1);
      assert.equal(host.vaultRecords[0].id, 'plan_edit_1');

      // Reconcile Alerts dipanggil dengan autoCreateAlerts: false
      assert.equal(host.reconcileCalls.length, 1);
      assert.equal(host.reconcileCalls[0].enabled, false);

      // Transaksi undo bertipe 'update' terekam lengkap sesuai PlanUpdateUndoTransaction
      const lastTx = host.undoTransactions[host.undoTransactions.length - 1];
      assert.equal(lastTx.action, 'update');
      if (lastTx.action === 'update') {
        assert.equal(lastTx.previousPlan.entry, 60000);
        assert.ok(lastTx.previousDrawings.length > 0);
      }
      assert.equal(lastTx.plan.entry, 59900);
    });

    it('mengunci simbol pada existingPlan.symbol saat updatePlan dipanggil (read-only symbol pinning)', () => {
      const btcDraft = createEmptyPlanFormDraft('BTCUSDT');
      btcDraft.bias = 'bullish';
      btcDraft.entry = '65000';
      btcDraft.stopLoss = '64000';
      btcDraft.targets = [{ id: 'tp1', label: 'TP1', price: '68000', reason: '' }];
      lifecycle.projectPlan(buildParsedPlanFromFormDraft(btcDraft), { planId: 'plan_pin_sym' });

      // Walaupun payload pembaruan menyisipkan simbol berbeda (ETHUSDT), updatePlan tetap menempel pada BTCUSDT
      const patchedDraft = createEmptyPlanFormDraft('ETHUSDT');
      patchedDraft.bias = 'bullish';
      patchedDraft.entry = '65200';
      patchedDraft.stopLoss = '64200';
      patchedDraft.targets = [{ id: 'tp1', label: 'TP1', price: '69000', reason: '' }];

      const updated = lifecycle.updatePlan('plan_pin_sym', buildParsedPlanFromFormDraft(patchedDraft), {
        autoCreateAlerts: false,
        skipVaultSave: true
      });
      assert.ok(updated);
      assert.equal(updated.plan.symbol, 'BTCUSDT');
      assert.deepEqual(host.ensuredSymbols, []);
      assert.equal(lifecycle.getActivePlans('BTCUSDT').length, 1);
      assert.equal(lifecycle.getActivePlans('ETHUSDT').length, 0);
    });

    it('replaceExistingOnSymbol menggantikan plan lama pada simbol yang sama tanpa menghapus simbol lain', () => {
      const ethDraft = createEmptyPlanFormDraft('ETHUSDT');
      ethDraft.bias = 'bullish';
      ethDraft.entry = '2000';
      ethDraft.stopLoss = '1950';
      ethDraft.targets = [{ id: 'tp1', label: 'TP1', price: '2150', reason: '' }];
      host.symbol = 'ETHUSDT';
      lifecycle.projectPlan(buildParsedPlanFromFormDraft(ethDraft), { planId: 'plan_eth_keep' });

      host.symbol = 'BTCUSDT';
      const btcOld = createEmptyPlanFormDraft('BTCUSDT.P');
      btcOld.bias = 'bearish';
      btcOld.entry = '80000';
      btcOld.stopLoss = '81000';
      btcOld.targets = [{ id: 'tp1', label: 'TP1', price: '77000', reason: '' }];
      lifecycle.projectPlan(buildParsedPlanFromFormDraft(btcOld), { planId: 'plan_btc_old' });

      // Terapkan plan baru pada BTCUSDT dengan replaceExistingOnSymbol: true
      const btcNew = createEmptyPlanFormDraft('BTCUSDT');
      btcNew.bias = 'bullish';
      btcNew.entry = '79000';
      btcNew.stopLoss = '78000';
      btcNew.targets = [{ id: 'tp1', label: 'TP1', price: '82000', reason: '' }];
      const replaced = lifecycle.projectPlan(buildParsedPlanFromFormDraft(btcNew), {
        planId: 'plan_btc_new',
        replaceExistingOnSymbol: true
      });
      assert.ok(replaced);

      const allIds = lifecycle.getAllActivePlans().map((p) => p.id).sort();
      assert.deepEqual(allIds, ['plan_btc_new', 'plan_eth_keep']);
    });
  });

  describe('3. ChartDrawingController: updateTradingPlan In-Place, handleDrawingMutated() & Undo/Redo Zero-Orphan', () => {
    function createMockChartController() {
      let drawingsList: any[] = [];
      let listeners: Record<string, Array<(e?: any) => void>> = {};
      let toJsonCalls = 0;

      const mockDrawings = {
        all: () => drawingsList,
        create: (spec: any) => {
          const item = structuredClone({ ...spec, id: spec.id || `d_${drawingsList.length + 1}` });
          drawingsList.push(item);
          return item;
        },
        add: (type: string, spec: any) => {
          const item = structuredClone({ ...spec, type, id: spec.id || `d_${drawingsList.length + 1}` });
          drawingsList.push(item);
          return item;
        },
        removeMany: (ids: string[]) => {
          const s = new Set(ids);
          drawingsList = drawingsList.filter((d) => !s.has(d.id));
        },
        remove: (id: string) => {
          drawingsList = drawingsList.filter((d) => d.id !== id);
        },
        select: () => {},
        deselect: () => {},
        on: (ev: string, fn: any) => {
          listeners[ev] = listeners[ev] || [];
          listeners[ev].push(fn);
        },
        off: () => {},
        toJSON: () => {
          toJsonCalls++;
          return { version: 1, drawings: drawingsList };
        },
        fromJSON: (doc: any) => {
          drawingsList = [...(doc.drawings || [])];
        }
      };

      const baseTime = 1_700_000_000_000;
      const mockChart: any = {
        drawings: mockDrawings,
        data: () => [{ time: baseTime - 900_000 }, { time: baseTime }],
        on: () => {},
        off: () => {}
      };
      const mockWorkspace: any = {
        active: { chart: mockChart, symbol: 'BTCUSDT', timeframe: '15m' },
        cells: () => [{ chart: mockChart }]
      };

      const controller = new ChartDrawingController();
      controller.attachWorkspace(mockWorkspace, () => 'BTCUSDT', () => '15m', () => 'binance');
      return {
        controller,
        mockDrawings,
        getToJsonCalls: () => toJsonCalls
      };
    }

    afterEach(async () => {
      await alertService.deleteAlertsByPlanId('plan_ctrl_undo_1');
    });

    it('updateTradingPlan mendelegasikan updatePlan, memicu handleDrawingMutated(), serta undo/redo tanpa orphan drawings', async () => {
      const { controller, mockDrawings, getToJsonCalls } = createMockChartController();

      let stateNotifications = 0;
      let latestActiveDrawingsCount = 0;
      const unsub = controller.subscribe((state) => {
        stateNotifications++;
        latestActiveDrawingsCount = state.activeDrawings.length;
      });

      const d1 = createEmptyPlanFormDraft('BTCUSDT');
      d1.bias = 'bullish';
      d1.entry = '70000';
      d1.stopLoss = '69000';
      d1.targets = [{ id: 'tp1', label: 'TP1', price: '73000', reason: '' }];
      const created = await controller.applyTradingPlan(
        { ...buildParsedPlanFromFormDraft(d1), id: 'plan_ctrl_undo_1' },
        { autoCreateAlerts: false, skipVaultSave: true }
      );
      assert.ok(created);
      assert.equal(mockDrawings.all().filter((d) => d.type === 'position').length, 1);

      // Geser anchor waktu stage 1 agar kita bisa pastikan X-coordinate dipertahankan
      const stageBefore = mockDrawings.all().find((d) => d.type === 'position');
      stageBefore.anchors[0].time = 1_700_020_000_000;
      stageBefore.anchors[2].time = 1_700_080_000_000;

      const jsonCallsBeforeUpdate = getToJsonCalls();
      const notificationsBeforeUpdate = stateNotifications;

      // Edit in-place menjadi Bearish Dual-Entry + 2 TP + zona konteks
      const d2 = createEmptyPlanFormDraft('BTCUSDT');
      d2.bias = 'bearish';
      d2.entryMode = 'dual';
      d2.e1Price = '71000';
      d2.e1WeightPct = '50';
      d2.e2Price = '71500';
      d2.e2WeightPct = '50';
      d2.stopLoss = '72200';
      d2.targets = [
        { id: 'tp1', label: 'TP1', price: '69000', reason: 'TP1 Bear' },
        { id: 'tp2', label: 'TP2', price: '67000', reason: 'TP2 Bear' }
      ];
      d2.contextZones = [
        { id: 'z1', label: 'Supply Bearish', polarity: 'bear', low: '71100', high: '71400', kind: 'FVG' }
      ];

      const updated = await controller.updateTradingPlan(
        'plan_ctrl_undo_1',
        buildParsedPlanFromFormDraft(d2),
        { autoCreateAlerts: true, skipVaultSave: true }
      );
      assert.ok(updated);
      assert.equal(updated.planId, 'plan_ctrl_undo_1');
      assert.equal(controller.getActivePlans('BTCUSDT')[0].bias, 'bearish');

      // handleDrawingMutated() harus dipanggil dan memicu persistensi toJSON + notify subscriber + sync activeDrawings
      assert.ok(getToJsonCalls() > jsonCallsBeforeUpdate, 'handleDrawingMutated() harus memanggil toJSON');
      assert.ok(stateNotifications > notificationsBeforeUpdate);

      const afterUpdateDrawings = mockDrawings.all();
      const posUpdated = afterUpdateDrawings
        .filter((d) => d.type === 'position')
        .sort((a, b) => a.metadata.stageIndex - b.metadata.stageIndex);
      assert.equal(posUpdated.length, 2);
      assert.equal(posUpdated[0].anchors[0].time, 1_700_020_000_000);
      assert.equal(posUpdated[0].anchors[2].time, 1_700_080_000_000);
      assert.equal(afterUpdateDrawings.filter((d) => d.metadata?.role === 'entry_zone').length, 1);
      assert.equal(afterUpdateDrawings.filter((d) => d.metadata?.role === 'context_zone').length, 1);
      assert.equal(latestActiveDrawingsCount, afterUpdateDrawings.length);
      assert.equal(alertService.hasActiveAlertsForPlan('plan_ctrl_undo_1'), true);

      // Undo edit -> harus mengembalikan 1 position Bullish 70000 & membersihkan entry_zone/context_zone tanpa orphan
      controller.undo();
      const afterUndoPlans = controller.getActivePlans('BTCUSDT');
      assert.equal(afterUndoPlans.length, 1);
      assert.equal(afterUndoPlans[0].bias, 'bullish');
      assert.equal(afterUndoPlans[0].entry, 70000);
      assert.equal(mockDrawings.all().filter((d) => d.type === 'position').length, 1);
      assert.equal(mockDrawings.all().filter((d) => d.metadata?.role === 'entry_zone').length, 0);
      assert.equal(mockDrawings.all().filter((d) => d.metadata?.role === 'context_zone').length, 0);
      assert.equal(mockDrawings.all().length, 1);
      assert.equal(mockDrawings.all()[0].anchors[2].price, 73000);
      assert.equal(alertService.hasActiveAlertsForPlan('plan_ctrl_undo_1'), false);

      // Redo edit -> kembali ke Bearish Dual-Entry (2 position + 1 entry_zone + 1 context_zone) & alert aktif
      controller.redo();
      const afterRedoPlans = controller.getActivePlans('BTCUSDT');
      assert.equal(afterRedoPlans[0].bias, 'bearish');
      assert.equal(afterRedoPlans[0].entry, 71250);
      assert.equal(mockDrawings.all().filter((d) => d.type === 'position').length, 2);
      assert.equal(mockDrawings.all().filter((d) => d.metadata?.role === 'entry_zone').length, 1);
      assert.equal(mockDrawings.all().filter((d) => d.metadata?.role === 'context_zone').length, 1);
      assert.equal(mockDrawings.all().length, 4);
      assert.equal(alertService.hasActiveAlertsForPlan('plan_ctrl_undo_1'), true);

      unsub();
    });
  });

  describe('4. AlertService: hasActiveAlertsForPlan & reconcilePlanAlerts', () => {
    const planId = `plan_reconcile_test_${Date.now()}`;

    afterEach(async () => {
      // Pastikan seluruh alert pengujian (termasuk yang triggered) dibersihkan dari memori
      const leftover = alertService.getAlerts().filter((a) => a.planId === planId);
      for (const a of leftover) {
        await alertService.deleteAlert(a.id);
      }
    });

    it('memperbarui harga/kondisi saat bias berubah, menambah/menghapus stage alert, dan menonaktifkan jika enabled: false', async () => {
      const initialPlan: ParsedTradingPlan & { id: string; symbol: string } = {
        ...buildParsedPlanFromFormDraft({
          ...createEmptyPlanFormDraft('BTCUSDT'),
          bias: 'bullish',
          entry: '50000',
          stopLoss: '49000',
          targets: [
            { id: 'tp1', label: 'TP1', price: '52000', reason: '' },
            { id: 'tp2', label: 'TP2', price: '54000', reason: '' }
          ]
        }),
        id: planId,
        symbol: 'BTCUSDT'
      };

      assert.equal(alertService.hasActiveAlertsForPlan(planId), false);
      const initialCreated = await alertService.addPlanAlerts(initialPlan, 'BTCUSDT');
      assert.equal(initialCreated.length, 4); // entry, sl, tp1, tp2
      assert.equal(alertService.hasActiveAlertsForPlan(planId), true);

      const tp1Before = initialCreated.find((a) => a.planRole === 'tp1');
      assert.equal(tp1Before?.condition, 'crossing_up');

      // Tambahkan 1 alert yang sudah berstatus triggered untuk memverifikasi tidak ikut terhapus
      const historicalTriggered = await alertService.addAlert({
        symbol: 'BTCUSDT',
        targetPrice: 48000,
        condition: 'crossing_down',
        frequency: 'once',
        label: 'Historis Triggered',
        planId,
        planRole: 'historical_test'
      });
      await alertService.updateAlert(historicalTriggered.id, { triggered: true, active: false });

      // Edit: Flip menjadi Bearish Dual-Entry dengan 1 TP saja
      const dualDraft = createEmptyPlanFormDraft('BTCUSDT');
      dualDraft.bias = 'bearish';
      dualDraft.entryMode = 'dual';
      dualDraft.e1Price = '51000';
      dualDraft.e1WeightPct = '40';
      dualDraft.e2Price = '51500';
      dualDraft.e2WeightPct = '60';
      dualDraft.stopLoss = '52200';
      dualDraft.targets = [{ id: 'tp1', label: 'TP1', price: '49500', reason: '' }];

      const reconciled = await alertService.reconcilePlanAlerts(
        { ...buildParsedPlanFromFormDraft(dualDraft), id: planId, symbol: 'BTCUSDT' },
        { enabled: true, fallbackSymbol: 'BTCUSDT' }
      );

      // Harus ada: entry, e1, e2, sl, tp1 (5 alert; tp2 hilang, e1 & e2 bertambah)
      const roles = reconciled.map((a) => a.planRole).sort();
      assert.deepEqual(roles, ['e1', 'e2', 'entry', 'sl', 'tp1']);
      const slAlert = reconciled.find((a) => a.planRole === 'sl');
      const tp1Alert = reconciled.find((a) => a.planRole === 'tp1');
      assert.equal(slAlert?.condition, 'crossing_up');
      assert.equal(tp1Alert?.condition, 'crossing_down');
      assert.equal(tp1Alert?.targetPrice, 49500);

      // Matikan alert lewat enabled: false -> aktif habis, tapi historicalTriggered tetap aman
      await alertService.reconcilePlanAlerts(
        { ...buildParsedPlanFromFormDraft(dualDraft), id: planId, symbol: 'BTCUSDT' },
        { enabled: false, fallbackSymbol: 'BTCUSDT' }
      );
      assert.equal(alertService.hasActiveAlertsForPlan(planId), false);
      assert.ok(
        alertService.getAlerts().some((a) => a.id === historicalTriggered.id && a.triggered),
        'Alert historis yang sudah triggered harus tetap dipertahankan'
      );
    });
  });

  describe('5. panelResizeHelper: Clamping, Keyboard Resize & Cleanup on Cancel', () => {
    it('clampPanelWidth dan adjustPanelWidthByKeyboard menghormati batas min, max, shift multiplier, dan tepi panel', () => {
      assert.equal(clampPanelWidth(200, 270, 620, 1280, 0.58), 270);
      assert.equal(clampPanelWidth(900, 270, 620, 1280, 0.58), 620);
      // Viewport sempit (600px * 0.58 = 348px) membatasi lebar meski maxCap = 620
      assert.equal(clampPanelWidth(500, 270, 620, 600, 0.58), 348);

      // Tombol ArrowLeft memperlebar drawer kanan (left-edge) sebanyak 16px, atau 40px dengan Shift
      assert.equal(adjustPanelWidthByKeyboard('ArrowLeft', false, 360, 310, 680, 'left-edge'), 376);
      assert.equal(adjustPanelWidthByKeyboard('ArrowLeft', true, 360, 310, 680, 'left-edge'), 400);
      assert.equal(adjustPanelWidthByKeyboard('ArrowRight', false, 360, 310, 680, 'left-edge'), 344);
      assert.equal(adjustPanelWidthByKeyboard('Enter', false, 360, 310, 680, 'left-edge'), null);
    });

    it('startEdgeResizeSession menangani pointermove/pointerup ke PersistenceService serta membersihkan seluruh listener saat cancel()', async () => {
      const listeners = new Map<string, Set<(ev: any) => void>>();
      const mockWindow: ResizeWindowTarget = {
        innerWidth: 1440,
        addEventListener: (type, fn) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        },
        removeEventListener: (type, fn) => {
          listeners.get(type)?.delete(fn);
        }
      };

      const adapter = new InMemoryLocalStorageAdapter();
      const persistence = new PersistenceService(adapter);

      let latestWidth = 360;
      let endedCommit: boolean | null = null;

      const session = startEdgeResizeSession({
        startClientX: 1000,
        startWidth: 360,
        minWidth: 310,
        maxCap: 680,
        viewportMaxRatio: 0.58,
        edge: 'left-edge',
        preferenceKey: 'right_plan_width',
        dispatchResizeEvent: false,
        windowTarget: mockWindow,
        persistence,
        onResize: (w) => {
          latestWidth = w;
        },
        onEnd: (_w, committed) => {
          endedCommit = committed;
        }
      });

      assert.equal(listeners.get('pointermove')?.size, 1);
      assert.equal(listeners.get('pointerup')?.size, 1);
      assert.equal(listeners.get('pointercancel')?.size, 1);

      // Tarik 80px ke kiri => 360 + 80 = 440
      for (const fn of listeners.get('pointermove') || []) {
        fn({ clientX: 920 });
      }
      assert.equal(latestWidth, 440);

      // Lepas pointer => simpan ke PersistenceService & lepas seluruh listener
      for (const fn of listeners.get('pointerup') || []) {
        fn({});
      }
      assert.equal(endedCommit, true);
      assert.equal(persistence.getUiPreferenceSync<number>('right_plan_width'), 440);
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(await adapter.getPreference('right_plan_width'), '440');
      assert.equal(listeners.get('pointermove')?.size, 0);
      assert.equal(listeners.get('pointerup')?.size, 0);
      assert.equal(listeners.get('pointercancel')?.size, 0);

      // Uji cancel() pada sesi kedua: seluruh listener harus langsung dilepas tanpa menyimpan ke PersistenceService
      endedCommit = null;
      const cancelSession = startEdgeResizeSession({
        startClientX: 900,
        startWidth: 300,
        minWidth: 270,
        maxCap: 620,
        preferenceKey: 'right_panel_width',
        dispatchResizeEvent: false,
        windowTarget: mockWindow,
        persistence,
        onResize: (w) => {
          latestWidth = w;
        },
        onEnd: (_w, committed) => {
          endedCommit = committed;
        }
      });
      assert.equal(listeners.get('pointermove')?.size, 1);
      cancelSession.cancel();
      assert.equal(endedCommit, false);
      assert.equal(persistence.getUiPreferenceSync<number>('right_panel_width'), null);
      assert.equal(await adapter.getPreference('right_panel_width'), null);
      assert.equal(listeners.get('pointermove')?.size, 0);
      assert.equal(listeners.get('pointerup')?.size, 0);
      assert.equal(listeners.get('pointercancel')?.size, 0);
      session.cancel();
    });
  });
});
