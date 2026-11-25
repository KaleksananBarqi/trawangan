import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  ATTRIBUTION_CATEGORIES,
  TRADEMARK_DISCLAIMER,
  UPSTREAM_ATTRIBUTION_LEDGER,
  getAttributionsByCategory,
  resolveLocalizedAttributionText,
} from '../src/lib/constants/attributions';

const ROOT = process.cwd();

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('Upstream Attribution Ledger & Compliance (ADR-0033)', () => {
  test('UPSTREAM_ATTRIBUTION_LEDGER mencakup seluruh kategori, engine, aset, font, dan sumber data', () => {
    assert.equal(ATTRIBUTION_CATEGORIES.length, 4);
    for (const cat of ATTRIBUTION_CATEGORIES) {
      const items = getAttributionsByCategory(cat.id);
      assert.ok(items.length > 0, `Kategori ${cat.id} tidak boleh kosong`);
    }

    const ids = new Set(UPSTREAM_ATTRIBUTION_LEDGER.map((e) => e.id));
    for (const requiredId of [
      'luxalgo-vela',
      'luxalgo-pinets',
      'acorn-astring',
      'tauri-v2',
      'rust-ecosystem',
      'sqlite-rusqlite',
      'svelte-5',
      'codemirror-6',
      'lucide-icons',
      'web3icons',
      'spothq-crypto-icons',
      'circle-flags',
      'global-stock-logos',
      'ticker-logos-collections',
      'trawangan-original-assets',
      'plus-jakarta-sans',
      'jetbrains-mono',
      'web-audio-synthesizer',
      'coingecko-defillama',
      'exchange-direct-feeds',
      'yahoo-forexfactory',
    ]) {
      assert.ok(ids.has(requiredId), `Entry atribusi wajib tidak ditemukan: ${requiredId}`);
    }

    for (const entry of UPSTREAM_ATTRIBUTION_LEDGER) {
      assert.ok(entry.url.startsWith('https://'), `URL tidak valid untuk ${entry.id}: ${entry.url}`);
      assert.ok(entry.license.trim().length > 0, `Lisensi kosong untuk ${entry.id}`);
      assert.ok(entry.author.trim().length > 0, `Author kosong untuk ${entry.id}`);
      assert.ok(entry.role.jv.trim().length > 0 && entry.role.id.trim().length > 0 && entry.role.en.trim().length > 0);
      assert.ok(!entry.role.jv.includes('\u2014') && !entry.role.id.includes('\u2014') && !entry.role.en.includes('\u2014'));
    }

    assert.equal(resolveLocalizedAttributionText(TRADEMARK_DISCLAIMER, 'jv'), TRADEMARK_DISCLAIMER.jv);
    assert.equal(resolveLocalizedAttributionText(TRADEMARK_DISCLAIMER, 'id'), TRADEMARK_DISCLAIMER.id);
    assert.equal(resolveLocalizedAttributionText(TRADEMARK_DISCLAIMER, 'en'), TRADEMARK_DISCLAIMER.en);

    const tickerEntry = UPSTREAM_ATTRIBUTION_LEDGER.find((e) => e.id === 'ticker-logos-collections');
    assert.ok(tickerEntry, 'Entry ticker-logos-collections wajib ada');
    assert.match(tickerEntry.packageOrScope, /IDX_COMPANY_DOMAINS/);
    assert.match(tickerEntry.role.id, /IDX/i);
  });

  test('NOTICE memuat atribusi trawangan dan notice wajib LuxAlgo Vela serta PineTS AGPL-3.0', () => {
    const notice = readRepoFile('NOTICE');
    assert.match(notice, /Kaleksanan Barqi Aji Massani/);
    assert.match(notice, /Vela \(@luxalgo\/vela\)/);
    assert.match(notice, /https:\/\/velacharts\.dev/);
    assert.match(notice, /AGPL-3\.0-only/);
    assert.match(notice, /web3icons/i);
    assert.match(notice, /circle-flags/i);
    assert.match(notice, /Plus Jakarta Sans/);
    assert.match(notice, /JetBrains Mono/);
    assert.match(notice, /DefiLlama/i);
    assert.match(notice, /CoinGecko/i);
    assert.match(notice, /trawangan Original Vectors/i);
    assert.match(notice, /Web Audio API Procedural Chime Synthesizer/i);
  });

  test('AboutTab.svelte merender Upstream Attribution Ledger & Trademark Disclaimer', () => {
    const about = readRepoFile('src/lib/components/settings/AboutTab.svelte');
    assert.match(about, /UPSTREAM_ATTRIBUTION_LEDGER|ATTRIBUTION_CATEGORIES/);
    assert.match(about, /getAttributionsByCategory/);
    assert.match(about, /TRADEMARK_DISCLAIMER/);
    assert.ok(!about.includes('\u2014'), 'AboutTab.svelte tidak boleh mengandung em-dash (DESIGN.md R-02)');
  });

  test('Ketiga README (jv, id, en) mencantumkan atribusi engine, aset, font, dan data publik', () => {
    for (const file of ['README.md', 'README.id.md', 'README.en.md']) {
      const content = readRepoFile(file);
      assert.match(content, /velacharts\.dev/, `${file} wajib menautkan Vela`);
      assert.match(content, /PineTS/, `${file} wajib menyebut PineTS`);
      assert.match(content, /web3icons/i, `${file} wajib menyebut Web3Icons`);
      assert.match(content, /circle-flags/i, `${file} wajib menyebut Circle Flags`);
      assert.match(content, /global-stock-logos/i, `${file} wajib menyebut Global Stock Logos`);
      assert.match(content, /Plus Jakarta Sans/, `${file} wajib menyebut Plus Jakarta Sans`);
      assert.match(content, /JetBrains Mono/, `${file} wajib menyebut JetBrains Mono`);
      assert.match(content, /DefiLlama/, `${file} wajib menyebut DefiLlama`);
      assert.match(content, /0033-upstream-engine-and-asset-attribution-governance\.md/, `${file} wajib menautkan ADR-0033`);
    }
  });

  test('Landing page (docs/index.html & docs/app.js) memiliki seksi #atribusi terlokalisasi tanpa em-dash', () => {
    const html = readRepoFile('docs/index.html');
    const js = readRepoFile('docs/app.js');
    assert.match(html, /id="atribusi"/);
    assert.match(html, /https:\/\/velacharts\.dev/);
    assert.match(html, /https:\/\/github\.com\/LuxAlgo\/PineTS/);
    assert.match(html, /web3icons/);
    assert.match(html, /circle-flags/);
    assert.match(html, /Plus Jakarta Sans/);
    assert.match(html, /JetBrains Mono/);
    assert.match(html, /DefiLlama/);
    assert.ok(!html.includes('\u2014'), 'docs/index.html tidak boleh mengandung em-dash');

    assert.match(js, /navAttribution/);
    assert.match(js, /attrHeading/);
    assert.match(js, /attrDisclaimerBody/);
    assert.ok(!js.includes('\u2014'), 'docs/app.js tidak boleh mengandung em-dash');
  });

  test('GLOSSARY.md dan ADR-0033 terdokumentasi sesuai standar domain-modeling', () => {
    const glossary = readRepoFile('GLOSSARY.md');
    const adr = readRepoFile('docs/adr/0033-upstream-engine-and-asset-attribution-governance.md');
    assert.match(glossary, /\*\*Upstream Attribution Ledger\*\*/);
    assert.match(adr, /^# 0033\./m);
    assert.ok(!adr.includes('\u2014'), 'ADR-0033 tidak boleh mengandung em-dash');
  });
});
