import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAppSettings, DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import { translateInstant, getNextLanguage } from '../src/lib/i18n';
import { resolveSubModeTransition, createEmptyPlanFormDraft, buildParsedPlanFromFormDraft } from '../src/lib/services/tradePlanFormService';
import { isRiskAcknowledgementValid } from '../src/lib/services/brokerBridgeService';
import { generateMt5ExpertAdvisorSource } from '../src/lib/data/mt5BridgeAdvisorTemplate';

describe('Next Evolution Suite (ADR-0030, ADR-0031, ADR-0032)', () => {
  it('1. Default settings: bahasa default "jv" (Arekan), onboarding false, dan Broker Bridge OFF', () => {
    assert.equal(DEFAULT_APP_SETTINGS.language, 'jv');
    assert.equal(DEFAULT_APP_SETTINGS.hasCompletedOnboarding, false);
    assert.equal(DEFAULT_APP_SETTINGS.executionBridgeEnabled, false);
    assert.equal(DEFAULT_APP_SETTINGS.executionRiskAccepted, false);

    const normalized = resolveAppSettings({ language: 'invalid' as any });
    assert.equal(normalized.language, 'jv');
    assert.equal(normalized.executionBridgeEnabled, false);
  });

  it('2. Arekan Localization Engine mendukung 3 bahasa (jv, id, en) dan rotasi bahasa', () => {
    assert.equal(getNextLanguage('jv'), 'id');
    assert.equal(getNextLanguage('id'), 'en');
    assert.equal(getNextLanguage('en'), 'jv');

    assert.ok(translateInstant('jv', 'plan.emptyPreviewTitle').includes('Rek'));
    assert.ok(translateInstant('id', 'plan.emptyPreviewTitle').includes('Trade Plan'));
    assert.ok(translateInstant('en', 'plan.emptyPreviewTitle').includes('Trade Plan'));
  });

  it('3. Docked Thesis Preview: resolveSubModeTransition mendukung sub-mode "preview" dan sinkronisasi teks', () => {
    const emptyDraft = createEmptyPlanFormDraft('BTCUSDT');
    const previewPlan = buildParsedPlanFromFormDraft(emptyDraft);
    const md = `| Parameter | Nilai |\n|---|---|\n| Bias | Bullish |\n| Symbol | ETHUSDT |\n| Entry | 3100 |\n| Stop Loss | 3000 |\n| TP1 | 3400 |`;

    const res = resolveSubModeTransition({
      currentSubMode: 'text',
      nextSubMode: 'preview',
      lastEditedSource: 'text',
      textBuffer: md,
      formPreviewPlan: previewPlan,
      currentFormSymbol: 'BTCUSDT',
      activeSymbol: 'BTCUSDT'
    });

    assert.equal(res.nextSubMode, 'preview');
    assert.equal(res.nextFormDraft?.symbol, 'ETHUSDT');
    assert.equal(res.nextFormDraft?.entry, '3100');

    const chartSrc = fs.readFileSync(path.resolve('src/lib/components/Chart.svelte'), 'utf8');
    assert.ok(!chartSrc.includes('<FloatingThesisCard'), 'Chart.svelte tidak boleh lagi merender FloatingThesisCard di atas kanvas');
  });

  it('4. Opt-In Execution Bridge: gerbang risiko, template EA MT5, dan pemisahan tegas dari TradePlanTab', () => {
    assert.equal(isRiskAcknowledgementValid('gas'), true);
    assert.equal(isRiskAcknowledgementValid('SETUJU'), true);
    assert.equal(isRiskAcknowledgementValid('AGREE'), true);
    assert.equal(isRiskAcknowledgementValid('batal'), false);

    const eaCode = generateMt5ExpertAdvisorSource(15555, 'my-local-token');
    assert.ok(eaCode.includes('http://127.0.0.1:15555'));
    assert.ok(eaCode.includes('my-local-token'));
    assert.ok(eaCode.includes('CTrade ExtTrade'));

    const planTabSrc = fs.readFileSync(path.resolve('src/lib/components/TradePlanTab.svelte'), 'utf8');
    assert.ok(!planTabSrc.includes('placeManualBrokerOrder'), 'TradePlanTab wajib terpisah tegas dari eksekusi order broker');
  });

  it('5. Lisensi Apache-2.0 + NOTICE, 3 README, dan Landing Page tanpa nomor versi statis', () => {
    const licenseTxt = fs.readFileSync(path.resolve('LICENSE'), 'utf8');
    const noticeTxt = fs.readFileSync(path.resolve('NOTICE'), 'utf8');
    assert.ok(licenseTxt.includes('Apache License') && licenseTxt.includes('Version 2.0'));
    assert.ok(noticeTxt.includes('MANDATORY ATTRIBUTION NOTICE'));

    assert.ok(fs.existsSync(path.resolve('README.md')));
    assert.ok(fs.existsSync(path.resolve('README.id.md')));
    assert.ok(fs.existsSync(path.resolve('README.en.md')));

    const landingHtml = fs.readFileSync(path.resolve('docs/index.html'), 'utf8');
    assert.ok(!landingHtml.includes('v0.45'), 'Landing page tidak boleh mencantumkan nomor versi statis');
    assert.ok(landingHtml.includes('assets/screenshots/trade-plan.png'));
    assert.ok(landingHtml.includes('assets/screenshots/gesture-draw.png'));
  });

  it('6. Lokalisasi Arekan ($tr), nonce v2 di broker_bridge.rs, dan bebas em-dash (DESIGN.md R-02)', () => {
    const aboutSrc = fs.readFileSync(path.resolve('src/lib/components/settings/AboutTab.svelte'), 'utf8');
    assert.ok(aboutSrc.includes('$tr('), 'AboutTab harus memakai $tr untuk lokalisasi Arekan');

    const bridgeRs = fs.readFileSync(path.resolve('src-tauri/src/broker_bridge.rs'), 'utf8');
    assert.ok(bridgeRs.includes('v2:'), 'broker_bridge.rs harus memakai format enkripsi v2 dengan nonce acak per-write');
    assert.ok(bridgeRs.includes('generate_nonce_16'), 'broker_bridge.rs harus membangkitkan nonce 16-byte acak');

    const filesNoEmDash = [
      'src/lib/i18n/index.ts',
      'src/lib/components/right-dock/OrderExecutionTab.svelte',
      'NOTICE',
      'README.md',
      'README.id.md',
      'README.en.md',
      'docs/index.html',
      'docs/app.js'
    ];
    for (const rel of filesNoEmDash) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert.ok(!content.includes('—'), `${rel} tidak boleh mengandung karakter em-dash (U+2014)`);
    }
  });
});
