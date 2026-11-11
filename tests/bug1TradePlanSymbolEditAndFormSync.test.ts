import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSymbolSuggestionList,
  normalizeInstrumentToken,
} from '../src/lib/services/instrumentIdentity';
import {
  normalizePlanSymbolToken,
  resolveCanonicalPlanSymbol,
  parseTradingPlan,
} from '../src/lib/services/planParserService';
import {
  buildParsedPlanFromFormDraft,
  createEmptyPlanFormDraft,
  createSampleMarkdownPlan,
  finalizePlanFromTabSubmission,
  resolveSubModeTransition,
  resolveTradePlanCommitAction,
} from '../src/lib/services/tradePlanFormService';

describe('Bug 1 Regression: Trade Plan Symbol Flexibility (Form, Text & Edit Branch)', () => {
  it('1. normalizePlanSymbolToken dan resolveCanonicalPlanSymbol menangani format slash, prefix bursa, short base, & Yahoo', () => {
    assert.equal(normalizePlanSymbolToken('ETH/USDT'), 'ETHUSDT');
    assert.equal(normalizePlanSymbolToken('binance:SOL/USDT.P'), 'SOLUSDT.P');
    assert.equal(normalizePlanSymbolToken('eth-usdt'), 'ETHUSDT');
    assert.equal(normalizePlanSymbolToken('BBCA.JK'), 'BBCA.JK');
    assert.equal(normalizePlanSymbolToken('GC=F'), 'GC=F');
    assert.equal(normalizePlanSymbolToken('^GSPC'), '^GSPC');

    // Short base mewarisi quote dari fallback aktif
    assert.equal(resolveCanonicalPlanSymbol('eth', 'BTCUSDT'), 'ETHUSDT');
    assert.equal(resolveCanonicalPlanSymbol('sol', 'BTCIDR'), 'SOLIDR');
    assert.equal(resolveCanonicalPlanSymbol('ETHUSDT', 'BTCUSDT'), 'ETHUSDT');
    assert.equal(resolveCanonicalPlanSymbol('QQQ', 'BTCUSDT'), 'QQQ');
    assert.equal(resolveCanonicalPlanSymbol('', 'ETHUSDT'), 'ETHUSDT');
  });

  it('2. parseTradingPlan membaca baris Symbol berformat slash / prefix bursa tanpa terpotong', () => {
    const slashPlanText = `
| Parameter | Nilai |
| --- | --- |
| Symbol | binance:ETH/USDT |
| Bias | Bullish |
| Entry | 3100 |
| Stop Loss | 3000 |
| TP1 | 3350 |
`;
    const parsedSlash = parseTradingPlan(slashPlanText);
    assert.equal(parsedSlash.symbol, 'ETHUSDT');
    assert.equal(parsedSlash.validation.valid, true);

    const perpPlanText = `Pair: bybit:SOL/USDT.P
Bias: Short
Entry: 185
SL: 192
TP1: 170`;
    const parsedPerp = parseTradingPlan(perpPlanText);
    assert.equal(parsedPerp.symbol, 'SOLUSDT.P');
  });

  it('3. resolveSubModeTransition: Form kosong -> Teks tidak menyuntikkan "| Symbol | BTCUSDT |", namun Form terisi tetap menyinkronkan simbol', () => {
    const emptyBtcDraft = createEmptyPlanFormDraft('BTCUSDT');
    const emptyPreview = buildParsedPlanFromFormDraft(emptyBtcDraft);

    // Skenario A: Form kosong di chart BTCUSDT -> buka tab Teks kosong
    const emptyToText = resolveSubModeTransition({
      currentSubMode: 'form',
      nextSubMode: 'text',
      lastEditedSource: 'form',
      textBuffer: '',
      formPreviewPlan: emptyPreview,
      currentFormSymbol: 'BTCUSDT',
      activeSymbol: 'BTCUSDT',
    });
    assert.equal(emptyToText.nextSubMode, 'text');
    assert.equal(
      emptyToText.nextTextBuffer,
      undefined,
      'Form kosong tidak boleh menyisipkan template BTCUSDT ke textBuffer'
    );

    // Skenario B: Form sudah diisi user untuk ETH -> buka tab Teks -> menyinkronkan simbol ETHUSDT
    const ethDraft = createEmptyPlanFormDraft('eth');
    ethDraft.bias = 'bullish';
    ethDraft.entry = '3000';
    ethDraft.stopLoss = '2900';
    ethDraft.targets = [{ id: 'tp1', label: 'TP1', price: '3300', reason: '' }];
    const ethPreview = buildParsedPlanFromFormDraft(ethDraft);

    const filledToText = resolveSubModeTransition({
      currentSubMode: 'form',
      nextSubMode: 'text',
      lastEditedSource: 'form',
      textBuffer: '',
      formPreviewPlan: ethPreview,
      currentFormSymbol: 'eth',
      activeSymbol: 'BTCUSDT',
    });
    assert.ok(filledToText.nextTextBuffer?.includes('| Symbol | ETHUSDT |'));

    // Skenario C: Paste/tulis plan ETH/USDT di Teks lalu pindah ke Form (meski chart aktif BTCUSDT)
    const pastedEthText = `| Symbol | ETH/USDT |\n| Bias | Bearish |\n| Entry | 3200 |\n| Stop Loss | 3300 |\n| TP1 | 2900 |`;
    const textToForm = resolveSubModeTransition({
      currentSubMode: 'text',
      nextSubMode: 'form',
      lastEditedSource: 'text',
      textBuffer: pastedEthText,
      formPreviewPlan: emptyPreview,
      currentFormSymbol: 'BTCUSDT',
      activeSymbol: 'BTCUSDT',
    });
    assert.equal(textToForm.nextFormDraft?.symbol, 'ETHUSDT');
    assert.equal(textToForm.nextFormDraft?.entry, '3200');
  });

  it('4. resolveTradePlanCommitAction melepas edit pin BTCUSDT jika user mengganti simbol ke ETHUSDT', () => {
    const branchAction = resolveTradePlanCommitAction({
      subMode: 'form',
      activeSymbol: 'BTCUSDT',
      draftFormSymbol: 'ETH/USDT',
      editingPlan: { id: 'plan_btc_old', symbol: 'BTCUSDT' },
      activePlans: [
        { id: 'plan_btc_old', symbol: 'BTCUSDT' },
        { id: 'plan_eth_existing', symbol: 'ETHUSDT' }
      ],
    });
    assert.equal(branchAction.mode, 'apply');
    assert.equal(branchAction.isSymbolChangedWhileEditing, true);
    assert.equal(branchAction.targetSymbol, 'ETHUSDT');
    assert.equal(branchAction.planId, undefined);
    assert.equal(branchAction.replaceExistingOnSymbol, false);

    const sameCoinAction = resolveTradePlanCommitAction({
      subMode: 'form',
      activeSymbol: 'BTCUSDT',
      draftFormSymbol: 'BTCUSDT',
      editingPlan: { id: 'plan_btc_old', symbol: 'BTCUSDT.P' },
      activePlans: [{ id: 'plan_btc_old', symbol: 'BTCUSDT.P' }],
    });
    assert.equal(sameCoinAction.mode, 'update');
    assert.equal(sameCoinAction.isSymbolChangedWhileEditing, false);
    assert.equal(sameCoinAction.planId, 'plan_btc_old');

    const textBranchAction = resolveTradePlanCommitAction({
      subMode: 'text',
      activeSymbol: 'BTCUSDT',
      textPreviewSymbol: 'SOL',
      editingPlan: { id: 'plan_btc_old', symbol: 'BTCUSDT' },
      activePlans: [{ id: 'plan_btc_old', symbol: 'BTCUSDT' }],
    });
    assert.equal(textBranchAction.mode, 'apply');
    assert.equal(textBranchAction.isSymbolChangedWhileEditing, true);
    assert.equal(textBranchAction.targetSymbol, 'SOLUSDT');

    const newReplaceAction = resolveTradePlanCommitAction({
      subMode: 'form',
      activeSymbol: 'BTCUSDT',
      draftFormSymbol: 'ETHUSDT',
      editingPlan: null,
      activePlans: [{ id: 'plan_eth_existing', symbol: 'ETHUSDT' }],
      stackAsAdditional: false,
    });
    assert.equal(newReplaceAction.mode, 'apply');
    assert.equal(newReplaceAction.isSymbolChangedWhileEditing, false);
    assert.equal(newReplaceAction.isDifferentFromActiveChart, true);
    assert.equal(newReplaceAction.replaceExistingOnSymbol, true);

    const alignedNewAction = resolveTradePlanCommitAction({
      subMode: 'form',
      activeSymbol: 'BTCUSDT',
      draftFormSymbol: 'BTCUSDT.P',
      editingPlan: null,
      activePlans: [],
    });
    assert.equal(alignedNewAction.mode, 'apply');
    assert.equal(alignedNewAction.isDifferentFromActiveChart, false);
  });

  it('6. SSOT buildSymbolSuggestionList & normalizeInstrumentToken membuang header dan menduplikasi secara bersih', () => {
    assert.equal(normalizeInstrumentToken('binance:ETH/USDT.P'), 'ETHUSDT.P');
    const suggestions = buildSymbolSuggestionList(
      ['BTCUSDT', 'binance:ETH/USDT'],
      ['###GROUP', '#SECTION', 'ETHUSDT', 'sol_usdt', 'SOLUSDT']
    );
    assert.deepEqual(suggestions, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('5. finalizePlanFromTabSubmission & createSampleMarkdownPlan menghormati simbol non-BTC', () => {
    const sampleEth = createSampleMarkdownPlan('eth');
    assert.ok(sampleEth.includes('|Symbol|ETHUSDT|'));
    assert.equal(parseTradingPlan(sampleEth).symbol, 'ETHUSDT');

    const draft = createEmptyPlanFormDraft('sol/usdt');
    draft.bias = 'bullish';
    draft.entry = '150';
    draft.stopLoss = '140';
    draft.targets = [{ id: 'tp1', label: 'TP1', price: '180', reason: '' }];
    const preview = buildParsedPlanFromFormDraft(draft);

    const submitted = finalizePlanFromTabSubmission({
      subMode: 'form',
      textBuffer: '',
      effectiveFormDraft: draft,
      previewPlan: preview,
      activeSymbol: 'BTCUSDT',
    });
    assert.equal(submitted.plan.symbol, 'SOLUSDT');
    assert.ok(submitted.plan.rawText.includes('| Symbol | SOLUSDT |'));
  });
});
