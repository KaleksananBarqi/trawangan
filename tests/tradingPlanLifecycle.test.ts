/**
 * Pengujian mendalam untuk modul TradingPlanLifecycle:
 * - Proyeksi Multi-Target Position Plan, Dual-Entry Plan (entry_zone), dan Context Zone (Zone Polarity)
 * - Rekonsiliasi mutasi kanvas (Bidirectional Sync) termasuk pergeseran proporsional (Delta-Shift)
 *   pada E1/E2 dan kotak Entry Zone ketika garis Blended Entry digeser di kanvas
 * - Kalkulasi ulang riskAmount, riskPercent, rMultiple, & rMultipleByEntry (e1/e2) saat Entry, SL, atau TP digeser
 * - Sinkronisasi Plan-Linked Auto-Alerts (termasuk pembaruan label R-multiple TP saat Entry/SL bergeser)
 * - Idempotensi tryRelinkPlanDrawings dan pembersihan duplikat gambar kembar
 * - Orphan cleanup dengan isolasi simbol lintas aset
 * - Transisi Undo / Redo rencana perdagangan
 * - Evaluasi deterministik evaluatePlanMarketStatus pada 5 fase harga
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TradingPlanLifecycle,
  evaluatePlanMarketStatus,
  recalculatePlanRiskAndTargets,
  type TradingPlanHostPort,
  type TradingPlanExecutionContext,
  type PlanUndoTransaction
} from '../src/lib/services/tradingPlanLifecycle';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import type { SavedTradingPlanRecord } from '../src/lib/types/market';

class InMemoryTradingPlanHost implements TradingPlanHostPort {
  public drawings: any[] = [];
  public symbol = 'BTCUSDT';
  public providerId = 'binance';
  public timeframe = '15m';
  public deltaT = 900_000;
  public latestCandleTime = 1_700_000_000_000;
  public hasActiveCanvas = true;

  public vaultRecords: SavedTradingPlanRecord[] = [];
  public createdAlertBatches: Array<{ planId: string; symbol: string; entry: number }> = [];
  public syncedPlans: any[] = [];
  public deletedAlertPlanIds: string[] = [];
  public undoTransactions: PlanUndoTransaction[] = [];
  public stateChangedCount = 0;
  public symbolSwitchHistory: string[] = [];

  private nextId = 1;

  getContext(): TradingPlanExecutionContext {
    return {
      symbol: this.symbol,
      providerId: this.providerId,
      timeframe: this.timeframe,
      deltaT: this.deltaT,
      latestCandleTime: this.latestCandleTime,
      hasActiveCanvas: this.hasActiveCanvas
    };
  }

  createCanvasDrawing(spec: any): any {
    const id = spec.id || `draw_${this.nextId++}`;
    const record = structuredClone({
      ...spec,
      id
    });
    this.drawings.push(record);
    return record;
  }

  getCanvasDrawings(): any[] {
    return this.drawings;
  }

  removeCanvasDrawings(ids: string[]): void {
    const set = new Set(ids);
    this.drawings = this.drawings.filter((d) => !set.has(d.id));
  }

  async ensureSymbolReady(targetSymbol: string): Promise<void> {
    this.symbolSwitchHistory.push(targetSymbol);
    this.symbol = targetSymbol;
  }

  recordUndoAction(tx: PlanUndoTransaction): void {
    this.undoTransactions.push(tx);
  }

  onStateChanged(): void {
    this.stateChangedCount++;
  }

  saveToVault(record: SavedTradingPlanRecord): void {
    this.vaultRecords.push(structuredClone(record));
  }

  addPlanAlerts(plan: any, symbol: string): void {
    this.createdAlertBatches.push({
      planId: plan.id,
      symbol,
      entry: plan.entry
    });
  }

  syncPlanAlertPrices(plan: any): void {
    this.syncedPlans.push(structuredClone(plan));
  }

  deleteAlertsByPlanId(planId: string): void {
    this.deletedAlertPlanIds.push(planId);
  }
}

const DUAL_ENTRY_BEARISH_MD = `
| Parameter | Nilai |
|---|---|
| Bias | Bearish (Short) |
| E1 | 2166.16 (50% Size - FVG LTF) |
| E2 | 2178.00 (50% Size - Extreme OB) |
| Blended Entry | 2172.08 |
| Stop Loss | 2190.00 |
| TP1 | 2135.42 |
| Alasan TP1 | Internal liquidity |
| TP2 | 2106.00 |
| Alasan TP2 | External liquidity |
`;

describe('TradingPlanLifecycle (Deep Module & Dual-Entry Drift Fix)', () => {
  let host: InMemoryTradingPlanHost;
  let lifecycle: TradingPlanLifecycle;

  beforeEach(() => {
    host = new InMemoryTradingPlanHost();
    lifecycle = new TradingPlanLifecycle(host);
  });

  it('memproyeksikan Dual-Entry Plan menjadi Staged Position Boxes dan kotak Entry Zone', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    const res = lifecycle.projectPlan(parsed, {
      planId: 'plan_eth_dual',
      autoCreateAlerts: true
    });

    assert.ok(res, 'Proyeksi harus menghasilkan AppliedPlanResult');
    assert.equal(res.planId, 'plan_eth_dual');

    const posDrawings = host.drawings.filter((d) => d.type === 'position');
    const entryZoneDrawings = host.drawings.filter(
      (d) => d.type === 'box' && d.metadata?.role === 'entry_zone'
    );

    assert.equal(posDrawings.length, 2, 'Harus ada 2 kotak posisi bertingkat (TP1 & TP2)');
    assert.equal(entryZoneDrawings.length, 1, 'Harus ada 1 kotak arsiran Entry Zone');

    const ez = entryZoneDrawings[0];
    assert.equal(ez.anchors[0].price, 2178);
    assert.equal(ez.anchors[1].price, 2166.16);
    assert.ok(ez.text.value.includes('Entry Zone:'), 'Label kotak Entry Zone harus memuat Entry Zone:');
    assert.equal(host.vaultRecords.length, 1, 'Harus otomatis menyimpan ke Trade Plan Vault');
    assert.equal(host.createdAlertBatches.length, 1, 'Harus memicu pembuatan Plan-Linked Auto-Alerts');
  });

  it('menggeser Blended Entry di kanvas akan menggeser E1, E2, dan kotak Entry Zone secara proporsional (Delta-Shift) serta menghitung ulang R-multiple', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    lifecycle.projectPlan(parsed, { planId: 'plan_drift_fix' });

    const stage1 = host.drawings.find(
      (d) => d.type === 'position' && d.metadata?.stageIndex === 1
    );
    assert.ok(stage1);

    // Geser Blended Entry naik sebesar +10.00 poin (dari 2172.08 -> 2182.08)
    stage1.anchors[0].price = 2182.08;

    lifecycle.reconcileCanvasMutation();

    const updatedPlan = lifecycle.getActivePlans()[0];
    assert.ok(updatedPlan);
    assert.equal(updatedPlan.entry, 2182.08, 'Blended Entry harus terbarui ke 2182.08');
    assert.ok(updatedPlan.entries && updatedPlan.entries.length === 2);

    // E1 (2166.16 + 10 = 2176.16) dan E2 (2178.00 + 10 = 2188.00)
    assert.equal(updatedPlan.entries[0].price, 2176.16, 'E1 harus bergeser proporsional +10');
    assert.equal(updatedPlan.entries[1].price, 2188, 'E2 harus bergeser proporsional +10');

    // Periksa risiko baru: Stop Loss 2190.00 - Blended Entry 2182.08 = 7.92
    assert.ok(Math.abs(updatedPlan.riskAmount - 7.92) < 1e-6);

    // Periksa rMultipleByEntry pada TP1 (2135.42):
    // r_e1 = |2135.42 - 2176.16| / |2176.16 - 2190| = 40.74 / 13.84 = 2.94
    // r_e2 = |2135.42 - 2188.00| / |2188.00 - 2190| = 52.58 / 2.00 = 26.29
    const tp1 = updatedPlan.targets[0];
    assert.ok(tp1.rMultipleByEntry, 'rMultipleByEntry harus tetap terdefinisi dan terhitung ulang');
    assert.equal(tp1.rMultipleByEntry.e1, 2.94);
    assert.equal(tp1.rMultipleByEntry.e2, 26.29);

    // Periksa sibling position Stage 2 ikut tersinkronisasi
    const stage2 = host.drawings.find(
      (d) => d.type === 'position' && d.metadata?.stageIndex === 2
    );
    assert.equal(stage2.anchors[0].price, 2182.08, 'Anchor Entry pada Stage 2 harus ikut bergeser');

    // Periksa kotak Entry Zone di kanvas ikut bergeser dan teks labelnya diperbarui
    const entryBox = host.drawings.find(
      (d) => d.type === 'box' && d.metadata?.role === 'entry_zone'
    );
    assert.ok(entryBox);
    assert.equal(entryBox.anchors[0].price, 2188, 'Batas atas Entry Zone harus 2188');
    assert.equal(entryBox.anchors[1].price, 2176.16, 'Batas bawah Entry Zone harus 2176.16');
    assert.ok(
      entryBox.text.value.includes('2176.16') && entryBox.text.value.includes('2188'),
      'Label kotak Entry Zone harus mencerminkan harga E1 & E2 baru'
    );

    // Pastikan alert disinkronkan
    assert.equal(host.syncedPlans.length, 1);
    assert.equal(host.syncedPlans[0].entries[0].price, 2176.16);
  });

  it('menggeser Stop Loss atau TP pada Dual-Entry Plan menghitung ulang rMultipleByEntry untuk E1 dan E2', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    lifecycle.projectPlan(parsed, { planId: 'plan_sl_tp_drag' });

    const stage1 = host.drawings.find(
      (d) => d.type === 'position' && d.metadata?.stageIndex === 1
    );
    // Geser Stop Loss dari 2190 -> 2200
    stage1.anchors[1].price = 2200;
    lifecycle.reconcileCanvasMutation();

    const updatedPlan = lifecycle.getActivePlans()[0];
    assert.equal(updatedPlan.stopLoss, 2200);
    // Risiko E2 terhadap SL 2200 adalah |2178 - 2200| = 22
    assert.equal(updatedPlan.entries?.[1].riskAmount, 22);
    // rMultipleByEntry.e2 untuk TP1 (2135.42): |2135.42 - 2178| / 22 = 42.58 / 22 = 1.9354 -> 1.94
    assert.equal(updatedPlan.targets[0].rMultipleByEntry?.e2, 1.94);
  });

  it('menjalankan tryRelinkPlanDrawings secara idempoten dan menghapus duplikat gambar kembar', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    const projected = lifecycle.projectPlan(parsed, { planId: 'plan_relink' });
    assert.ok(projected);

    // Gandakan salah satu position drawing di kanvas seolah-olah terjadi race condition saat restore
    const stage1Copy = structuredClone(
      host.drawings.find((d) => d.type === 'position' && d.metadata?.stageIndex === 1)
    );
    stage1Copy.id = 'duplicate_stage_1';
    host.drawings.push(stage1Copy);

    const savedPlan = structuredClone(projected.plan);
    lifecycle.resetInMemoryState(false);

    const relinked = lifecycle.tryRelinkPlanDrawings(savedPlan, 'BTCUSDT');
    assert.equal(relinked, true, 'tryRelinkPlanDrawings harus berhasil menautkan gambar yang cocok');
    assert.equal(
      host.drawings.some((d) => d.id === 'duplicate_stage_1'),
      false,
      'Gambar duplikat kembar harus otomatis dibersihkan'
    );
    assert.equal(lifecycle.getActivePlans().length, 1);
  });

  it('membersihkan rencana yatim (orphan cleanup) hanya untuk simbol aktif dan menjaga rencana simbol lain', () => {
    const parsedBtc = parseTradingPlan({
      ...parseTradingPlan(DUAL_ENTRY_BEARISH_MD),
      rawText: DUAL_ENTRY_BEARISH_MD
    }.rawText);
    parsedBtc.symbol = 'BTCUSDT';
    lifecycle.projectPlan(parsedBtc, { planId: 'plan_btc' });

    // Buat rencana kedua pada simbol ETHUSDT
    host.symbol = 'ETHUSDT';
    const parsedEth = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedEth.symbol = 'ETHUSDT';
    lifecycle.projectPlan(parsedEth, { planId: 'plan_eth' });

    // Sekarang simbol aktif di ETHUSDT, dan semua gambar di kanvas dihapus
    host.drawings = [];
    lifecycle.reconcileCanvasMutation();

    const remainingAll = lifecycle.getAllActivePlans();
    assert.equal(remainingAll.length, 1, 'Rencana BTCUSDT tidak boleh terhapus saat berada di ETHUSDT');
    assert.equal(remainingAll[0].id, 'plan_btc');
    assert.ok(host.deletedAlertPlanIds.includes('plan_eth'));
  });

  it('merekonsiliasi transisi Undo dan Redo secara simetris', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    lifecycle.projectPlan(parsed, { planId: 'plan_undo_redo', autoCreateAlerts: true });
    assert.equal(host.undoTransactions.length, 1);
    const tx = host.undoTransactions[0];

    lifecycle.reconcileUndoTransition('undo', tx);
    assert.equal(lifecycle.getActivePlans().length, 0);
    assert.ok(host.deletedAlertPlanIds.includes('plan_undo_redo'));

    lifecycle.reconcileUndoTransition('redo', tx);
    assert.equal(lifecycle.getActivePlans().length, 1);
    assert.equal(host.createdAlertBatches.length, 2);
  });

  it('applyPlan menunggu kesiapan simbol secara deterministik tanpa setTimeout', async () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsed.symbol = 'SOLUSDT';

    const res = await lifecycle.applyPlan(parsed, { planId: 'plan_sol' });
    assert.ok(res);
    assert.deepEqual(host.symbolSwitchHistory, ['SOLUSDT']);
    assert.equal(host.symbol, 'SOLUSDT');
    assert.equal(res.plan.symbol, 'SOLUSDT');
  });

  it('evaluatePlanMarketStatus mengevaluasi ke-5 fase harga secara akurat', () => {
    const parsed = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsed.symbol = 'ETHUSDT';

    // 1. Di dalam Entry Zone (antara E1=2166.16 dan E2=2178.00)
    const inZone = evaluatePlanMarketStatus(parsed, 2170.0, 'ETHUSDT');
    assert.equal(inZone?.phase, 'in_entry_zone');

    // 2. Menunggu trigger / antara Entry & SL (untuk Bearish: di atas E2 2178 tapi di bawah SL 2190)
    const waiting = evaluatePlanMarketStatus(parsed, 2185.0, 'ETHUSDT');
    assert.equal(waiting?.phase, 'waiting_trigger');

    // 3. In Profit menuju TP1 (untuk Bearish: di bawah E1 2166.16 tapi belum sampai TP1 2135.42)
    const inProfit = evaluatePlanMarketStatus(parsed, 2150.0, 'ETHUSDT');
    assert.equal(inProfit?.phase, 'in_profit');

    // 4. Target Reached (di bawah TP1 2135.42)
    const tpReached = evaluatePlanMarketStatus(parsed, 2130.0, 'ETHUSDT');
    assert.equal(tpReached?.phase, 'target_reached');

    // 5. Stopped Out (di atas SL 2190.00)
    const stopped = evaluatePlanMarketStatus(parsed, 2195.0, 'ETHUSDT');
    assert.equal(stopped?.phase, 'stopped_out');

    // 6. Beda simbol menghasilkan null
    const diffSymbol = evaluatePlanMarketStatus(parsed, 2150.0, 'BTCUSDT');
    assert.equal(diffSymbol, null);
  });

  it('toPersistedEnvelope(symbolFilter?) mengisolasi activePlans, planDrawingIds, dan drawingMetadata secara kanonikal per instrumen', () => {
    const parsedBtc = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedBtc.symbol = 'binance:BTCUSDT.P';
    host.symbol = 'BTCUSDT';
    lifecycle.projectPlan(parsedBtc, { planId: 'plan_btc_1' });

    host.symbol = 'ETHUSDT';
    const parsedEth = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedEth.symbol = 'ETHUSDT';
    lifecycle.projectPlan(parsedEth, { planId: 'plan_eth_1' });

    // Tanpa filter mengembalikan seluruh plan lintas instrumen
    const fullEnvelope = lifecycle.toPersistedEnvelope();
    assert.deepEqual(
      fullEnvelope.activePlans.map((p) => p.id).sort(),
      ['plan_btc_1', 'plan_eth_1']
    );

    // Filter BTCUSDT (kanonikal cocok dengan binance:BTCUSDT.P) hanya menyertakan state BTCUSDT
    const btcEnvelope = lifecycle.toPersistedEnvelope('BTCUSDT');
    assert.deepEqual(btcEnvelope.activePlans.map((p) => p.id), ['plan_btc_1']);
    assert.deepEqual(btcEnvelope.planDrawingIds.map(([pid]) => pid), ['plan_btc_1']);
    const btcDrawingIds = new Set(btcEnvelope.planDrawingIds[0][1]);
    assert.ok(btcDrawingIds.size > 0);
    for (const [did, meta] of Object.entries(btcEnvelope.drawingMetadata)) {
      assert.equal(meta?.planId, 'plan_btc_1');
      assert.ok(btcDrawingIds.has(did));
    }

    // Filter ETHUSDT hanya menyertakan state ETHUSDT
    const ethEnvelope = lifecycle.toPersistedEnvelope('ETHUSDT');
    assert.deepEqual(ethEnvelope.activePlans.map((p) => p.id), ['plan_eth_1']);
    assert.deepEqual(ethEnvelope.planDrawingIds.map(([pid]) => pid), ['plan_eth_1']);
    const ethDrawingIds = new Set(ethEnvelope.planDrawingIds[0][1]);
    assert.ok(ethDrawingIds.size > 0);
    for (const [did, meta] of Object.entries(ethEnvelope.drawingMetadata)) {
      assert.equal(meta?.planId, 'plan_eth_1');
      assert.ok(ethDrawingIds.has(did));
    }

    // Metadata non-plan tanpa planId lintas simbol tetap aman, sedangkan metadata terkait plan asing tersaring
    lifecycle.hydrateFromEnvelope({
      drawingMetadata: {
        d_free_note: { role: 'note', text: 'catatan kanvas' },
        d_orphan_eth_meta: { planId: 'plan_eth_1', role: 'entry' }
      }
    });
    const btcAfterHydrate = lifecycle.toPersistedEnvelope('BTCUSDT');
    assert.ok(btcAfterHydrate.drawingMetadata.d_free_note);
    assert.equal(btcAfterHydrate.drawingMetadata.d_orphan_eth_meta, undefined);
  });

  it('reconcileCanvasMutation mengisolasi envelope hasil per simbol dan tidak memicu penulisan Trade Plan Vault saat drag kanvas', () => {
    const parsedBtc = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedBtc.symbol = 'BTCUSDT';
    host.symbol = 'BTCUSDT';
    lifecycle.projectPlan(parsedBtc, { planId: 'plan_btc_vault' });
    const btcDrawings = host.drawings.filter((d) => d.metadata?.planId === 'plan_btc_vault');

    host.symbol = 'ETHUSDT';
    host.drawings = [];
    const parsedEth = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedEth.symbol = 'ETHUSDT';
    lifecycle.projectPlan(parsedEth, { planId: 'plan_eth_vault' });
    assert.equal(host.vaultRecords.length, 2, 'Hanya projectPlan yang boleh menulis ke Trade Plan Vault');

    // edit form dengan skipVaultSave: true tidak boleh menulis ke Vault
    lifecycle.updatePlan(
      'plan_eth_vault',
      { ...parsedEth, stopLoss: 2195 },
      { skipVaultSave: true }
    );
    assert.equal(host.vaultRecords.length, 2, 'updatePlan dengan skipVaultSave: true tidak menulis ke Vault');

    // edit form normal menulis ke Vault
    lifecycle.updatePlan('plan_eth_vault', { ...parsedEth, stopLoss: 2196 });
    assert.equal(host.vaultRecords.length, 3, 'updatePlan tanpa skipVaultSave menulis ke Vault');

    // Drag Stop Loss di kanvas ETHUSDT melalui Bidirectional Sync (reconcileCanvasMutation)
    const ethStage1 = host.drawings.find(
      (d) => d.type === 'position' && d.metadata?.planId === 'plan_eth_vault' && d.metadata?.stageIndex === 1
    );
    assert.ok(ethStage1);
    ethStage1.anchors[1].price = 2205;

    const returnedEnvelope = lifecycle.reconcileCanvasMutation(host.drawings, 'ETHUSDT');
    assert.equal(
      host.vaultRecords.length,
      3,
      'Drag kanvas via reconcileCanvasMutation dilarang menulis ke Trade Plan Vault (ADR-0019)'
    );
    assert.deepEqual(
      returnedEnvelope.activePlans.map((p) => p.id),
      ['plan_eth_vault'],
      'Envelope kembalian reconcileCanvasMutation wajib terisolasi hanya untuk simbol aktif ETHUSDT'
    );
    assert.equal(returnedEnvelope.activePlans[0].stopLoss, 2205);

    // State BTCUSDT tetap utuh di memori TradingPlanLifecycle
    assert.equal(lifecycle.getActivePlans('BTCUSDT').length, 1);
    assert.equal(btcDrawings.length > 0, true);
  });

  it('hydrateFromEnvelope(meta, symbolFilter?) menyaring state plan lintas instrumen saat memulihkan satu sel', () => {
    lifecycle.hydrateFromEnvelope(
      {
        activePlans: [
          {
            id: 'plan_btc_clean',
            symbol: 'BTCUSDT',
            bias: 'LONG',
            entry: 65000,
            stopLoss: 63000,
            targets: [{ price: 68000, label: 'TP1' }],
            reasons: [],
            rawText: ''
          } as any,
          {
            id: 'plan_eth_leaked',
            symbol: 'ETHUSDT',
            bias: 'SHORT',
            entry: 3200,
            stopLoss: 3300,
            targets: [{ price: 3000, label: 'TP1' }],
            reasons: [],
            rawText: ''
          } as any,
          {
            id: 'plan_legacy_no_symbol',
            bias: 'LONG',
            entry: 64000,
            stopLoss: 62000,
            targets: [{ price: 67000, label: 'TP1' }],
            reasons: [],
            rawText: ''
          } as any
        ],
        planDrawingIds: [
          ['plan_btc_clean', ['d_btc_pos']],
          ['plan_eth_leaked', ['d_eth_pos']],
          ['plan_legacy_no_symbol', ['d_leg_pos']]
        ],
        drawingMetadata: {
          d_btc_pos: { planId: 'plan_btc_clean', role: 'position' },
          d_eth_pos: { role: 'position' },
          d_eth_orphan: { planId: 'plan_eth_leaked', role: 'box' },
          d_leg_pos: { role: 'position' }
        }
      },
      'BTCUSDT'
    );

    const allPlans = lifecycle.getAllActivePlans();
    assert.deepEqual(
      allPlans.map((p) => p.id).sort(),
      ['plan_btc_clean', 'plan_legacy_no_symbol']
    );
    const legacyPlan = allPlans.find((p) => p.id === 'plan_legacy_no_symbol');
    assert.equal(legacyPlan?.symbol, 'BTCUSDT', 'Plan warisan tanpa symbol wajib ditandai dengan symbol sel pemulih');

    // Pastikan plan & metadata ETHUSDT tidak bocor ke envelope BTCUSDT maupun ETHUSDT
    const ethEnv = lifecycle.toPersistedEnvelope('ETHUSDT');
    assert.equal(ethEnv.activePlans.length, 0);
    assert.equal(ethEnv.planDrawingIds.length, 0);
    assert.equal(ethEnv.drawingMetadata.d_eth_pos, undefined);
    assert.equal(ethEnv.drawingMetadata.d_eth_orphan, undefined);
    assert.equal(ethEnv.drawingMetadata.d_leg_pos, undefined);
  });

  it('reconcileCanvasMutation menangani sentinel wildcard "*" dan "ALL" secara konsisten serta hydrateFromEnvelope terisolasi dari state memori sebelumnya', () => {
    const parsedBtc = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedBtc.symbol = 'BTCUSDT';
    host.symbol = 'BTCUSDT';
    lifecycle.projectPlan(parsedBtc, { planId: 'plan_btc_wc' });

    const stage1 = host.drawings.find(
      (d) => d.type === 'position' && d.metadata?.planId === 'plan_btc_wc' && d.metadata?.stageIndex === 1
    );
    assert.ok(stage1);
    stage1.anchors[1].price = 2210;

    // Sentinel '*' harus menormalkan curSym ke mode wildcard sehingga Bidirectional Sync tetap memperbarui plan BTCUSDT
    const envWildcard = lifecycle.reconcileCanvasMutation(host.drawings, '*');
    assert.equal(envWildcard.activePlans.length, 1);
    assert.equal(envWildcard.activePlans[0].stopLoss, 2210);

    stage1.anchors[1].price = 2215;
    const envAll = lifecycle.reconcileCanvasMutation(host.drawings, 'ALL');
    assert.equal(envAll.activePlans.length, 1);
    assert.equal(envAll.activePlans[0].stopLoss, 2215);

    // Hydrate envelope BTCUSDT yang berisi metadata terkait plan ETHUSDT yg kebetulan ada di memori tidak boleh meloloskan metadata asing
    const parsedEth = parseTradingPlan(DUAL_ENTRY_BEARISH_MD);
    parsedEth.symbol = 'ETHUSDT';
    host.symbol = 'ETHUSDT';
    lifecycle.projectPlan(parsedEth, { planId: 'plan_eth_existing' });

    lifecycle.hydrateFromEnvelope(
      {
        activePlans: [],
        planDrawingIds: [],
        drawingMetadata: {
          d_leaked_meta_for_eth: { planId: 'plan_eth_existing', role: 'box' }
        }
      },
      'BTCUSDT'
    );
    assert.equal(lifecycle.toPersistedEnvelope('BTCUSDT').drawingMetadata.d_leaked_meta_for_eth, undefined);
  });
});
