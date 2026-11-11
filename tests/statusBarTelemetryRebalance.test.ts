// Pengujian struktural dan kontrak telemetri StatusBar (Tiket #168, bagian dari Spec #164)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const statusBarPath = path.resolve(process.cwd(), 'src/lib/components/StatusBar.svelte');
const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');

function readStatusBarSource(): string {
  return fs.readFileSync(statusBarPath, 'utf8');
}

function readPageSource(): string {
  return fs.readFileSync(pagePath, 'utf8');
}

/**
 * Mengekstrak blok `<div class="{className}">...</div>` secara utuh
 * dengan melacak kedalaman tag `<div>` agar nested tag tidak memotong hasil.
 */
function extractClusterBlock(source: string, className: string): string {
  const startPattern = new RegExp(`<div\\s+class="${className}">`);
  const startMatch = startPattern.exec(source);
  assert.ok(startMatch, `StatusBar harus memiliki <div class="${className}">`);

  const startIdx = startMatch.index;
  const tagRegex = /<\/?div\b[^>]*>/g;
  tagRegex.lastIndex = startIdx;

  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(source)) !== null) {
    if (match[0].startsWith('</div')) {
      depth--;
      if (depth === 0) {
        return source.slice(startIdx, tagRegex.lastIndex);
      }
    } else if (!match[0].endsWith('/>')) {
      depth++;
    }
  }

  assert.fail(`Tag penutup </div> untuk .${className} tidak ditemukan`);
}

describe('Tiket #168: StatusBar Simplification and Left-Cluster Live Telemetry Rebalance', () => {
  describe('1. Pembersihan Badge Statis Dekoratif, Ikon Mati, dan Dead CSS', () => {
    test('menghapus tiga badge statis dekoratif di sisi kiri (Engine: NATIVE_SYS_X64, SQLite Local ACTIVE, Pine Script v6 Runtime Ready)', () => {
      const source = readStatusBarSource();
      assert.doesNotMatch(
        source,
        /Engine:\s*NATIVE_SYS_X64/,
        'StatusBar tidak boleh lagi menampilkan badge statis Engine: NATIVE_SYS_X64'
      );
      assert.doesNotMatch(
        source,
        /SQLite Local ACTIVE/,
        'StatusBar tidak boleh lagi menampilkan badge statis SQLite Local ACTIVE'
      );
      assert.doesNotMatch(
        source,
        /Pine Script v6 Runtime Ready/,
        'StatusBar tidak boleh lagi menampilkan badge statis Pine Script v6 Runtime Ready'
      );
    });

    test('menghapus impor ikon Lucide yang tidak terpakai (Cpu, Database, Activity)', () => {
      const source = readStatusBarSource();
      const lucideImportMatch = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]@lucide\/svelte['"]/);
      assert.ok(lucideImportMatch, 'StatusBar harus mengimpor ikon dari @lucide/svelte');
      const importedIcons = lucideImportMatch[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      assert.ok(!importedIcons.includes('Cpu'), 'Ikon Cpu harus dihapus dari impor @lucide/svelte');
      assert.ok(!importedIcons.includes('Database'), 'Ikon Database harus dihapus dari impor @lucide/svelte');
      assert.ok(!importedIcons.includes('Activity'), 'Ikon Activity harus dihapus dari impor @lucide/svelte');
    });

    test('menghapus dead CSS rules (.live-pip, @keyframes pulse, .font-bold, .text-cyan)', () => {
      const source = readStatusBarSource();
      assert.doesNotMatch(source, /class="[^"]*live-pip[^"]*"/, 'Markup .live-pip harus dihapus');
      assert.doesNotMatch(source, /\.live-pip\s*\{/, 'CSS .live-pip harus dihapus');
      assert.doesNotMatch(source, /@keyframes\s+pulse\b/, 'CSS @keyframes pulse harus dihapus');
      assert.doesNotMatch(source, /\.font-bold\s*\{/, 'CSS .font-bold yang tidak terpakai harus dihapus');
      assert.doesNotMatch(source, /\.text-cyan\s*\{/, 'CSS .text-cyan yang tidak terpakai harus dihapus');
    });
  });

  describe('2. Relokasi Telemetri Live ke Kluster Kiri (.left-cluster)', () => {
    test('.left-cluster menampilkan FPS, Ping / Feed Connection Guard + DELAYED 15M, dan RAM di sebelah pill Update kondisional', () => {
      const source = readStatusBarSource();
      const leftCluster = extractClusterBlock(source, 'left-cluster');

      // Pill Update kondisional tetap dipertahankan di sisi kiri
      assert.match(leftCluster, /updateState\.status === 'available'/, 'Pill Update kondisional harus berada di .left-cluster');
      assert.match(leftCluster, /class="pill-badge badge-update"/, 'Badge Update harus berada di .left-cluster');

      // Pill telemetri live berpindah ke .left-cluster
      assert.match(leftCluster, /\{telemetry\.fps\}\s*FPS/, 'Metric FPS harus berada di .left-cluster');
      assert.match(leftCluster, /FEED BLOCKED/, 'Status Feed Connection Guard FEED BLOCKED harus berada di .left-cluster');
      assert.match(leftCluster, /FEED STALLED/, 'Status Feed Connection Guard FEED STALLED harus berada di .left-cluster');
      assert.match(leftCluster, /\{telemetry\.latencyMs\}ms/, 'Metric Ping latencyMs harus berada di .left-cluster');
      assert.match(leftCluster, /OFFLINE/, 'Status OFFLINE harus berada di .left-cluster');
      assert.match(leftCluster, /DELAYED 15M/, 'Badge DELAYED 15M untuk Yahoo Finance harus berada di .left-cluster');
      assert.match(leftCluster, /RAM:\s*\{telemetry\.memoryMb\.toFixed\(1\)\}MB/, 'Metric RAM harus berada di .left-cluster');

      // Urutan: Update -> FPS -> Ping -> RAM
      const updateIdx = leftCluster.indexOf('badge-update');
      const fpsIdx = leftCluster.indexOf('{telemetry.fps}');
      const pingIdx = leftCluster.indexOf('FEED BLOCKED');
      const ramIdx = leftCluster.indexOf('RAM:');
      assert.ok(updateIdx < fpsIdx && fpsIdx < pingIdx && pingIdx < ramIdx, 'Urutan pill di .left-cluster harus Update -> FPS -> Ping -> RAM');
    });
  });

  describe('3. Pelestarian Kluster Kanan (.right-cluster), Polling Telemetri, dan Wiring +page.svelte', () => {
    test('.right-cluster tidak lagi memuat telemetri FPS/Ping/RAM serta dimulai langsung dengan .clocks-cluster', () => {
      const source = readStatusBarSource();
      const rightCluster = extractClusterBlock(source, 'right-cluster');

      assert.doesNotMatch(rightCluster, /\{telemetry\.fps\}\s*FPS/, 'FPS tidak boleh lagi berada di .right-cluster');
      assert.doesNotMatch(rightCluster, /FEED BLOCKED/, 'Status Ping/Feed Guard tidak boleh lagi berada di .right-cluster');
      assert.doesNotMatch(rightCluster, /DELAYED 15M/, 'Badge DELAYED 15M tidak boleh lagi berada di .right-cluster');
      assert.doesNotMatch(rightCluster, /RAM:\s*\{telemetry\.memoryMb/, 'Metric RAM tidak boleh lagi berada di .right-cluster');

      // Pastikan tidak ada divider yatim di awal .right-cluster sebelum .clocks-cluster
      assert.match(
        rightCluster,
        /^<div class="right-cluster">\s*(?:<!--[\s\S]*?-->\s*)*<div class="clocks-cluster">/,
        'Elemen pertama di dalam .right-cluster harus langsung .clocks-cluster tanpa divider yatim di depan'
      );
    });

    test('.right-cluster mempertahankan Local Clock, World Clocks, Buy Me Coffee, dan Terminal Logs [CTRL+`]', () => {
      const source = readStatusBarSource();
      const rightCluster = extractClusterBlock(source, 'right-cluster');

      assert.match(rightCluster, /\{localClock\.time\}\s*\{localClock\.tzLabel\}/, 'Local Clock harus tetap berada di .right-cluster');
      assert.match(rightCluster, /class="world-clocks-desktop"/, 'World Clocks desktop harus tetap berada di .right-cluster');
      assert.match(rightCluster, /class="world-clocks-mobile"/, 'World Clocks mobile popover harus tetap berada di .right-cluster');
      assert.match(rightCluster, /World Clocks \(\{worldClocks\.length\}\)/, 'Label World Clocks harus tetap berada di .right-cluster');
      assert.match(
        rightCluster,
        /openExternalUrl\(['"]https:\/\/saweria\.co\/arthex1204['"]\)/,
        'Tombol Buy Me Coffee harus tetap memanggil openExternalUrl di .right-cluster'
      );
      assert.match(rightCluster, /Buy Me Coffee/, 'Teks tombol Buy Me Coffee harus tetap ada di .right-cluster');
      assert.match(rightCluster, /onclick=\{onToggleConsole\}/, 'Tombol Terminal Logs harus tetap terhubung ke onToggleConsole');
      assert.match(rightCluster, /Terminal Logs \[CTRL\+\`\]/, 'Teks Terminal Logs [CTRL+`] harus tetap ada di .right-cluster');
    });

    test('StatusBar mempertahankan lifecycle subscription telemetri, update, feed, dan wiring props dari +page.svelte', () => {
      const source = readStatusBarSource();
      const pageSource = readPageSource();

      assert.match(source, /telemetryService\.subscribe\(/, 'StatusBar harus tetap subscribe ke telemetryService');
      assert.match(source, /updateService\.subscribe\(/, 'StatusBar harus tetap subscribe ke updateService');
      assert.match(source, /marketFeed\.onConnectionChange\(/, 'StatusBar harus tetap subscribe ke marketFeed.onConnectionChange');
      assert.match(source, /onDestroy\(\(\) => \{[\s\S]*?unsubTelemetry[\s\S]*?unsubUpdate[\s\S]*?unsubFeed/, 'StatusBar harus membersihkan seluruh subscription di onDestroy');

      assert.match(
        pageSource,
        /<StatusBar[\s\S]*?isConsoleOpen=\{isConsoleDrawerOpen\}[\s\S]*?settings=\{appSettings\}[\s\S]*?onSelectTimezone=[\s\S]*?onToggleConsole=[\s\S]*?onOpenAbout=/,
        '+page.svelte harus tetap meneruskan seluruh props StatusBar tanpa regresi'
      );
    });
  });
});
