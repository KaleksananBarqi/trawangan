/**
 * Generator manifest rilis trawangan (`latest.json` Tauri v2 dan `SHA256SUMS.txt`).
 * Mengumpulkan seluruh biner installer & signature dari job matrix lintas OS tanpa race condition.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RELEASE_DOWNLOAD_BASE = 'https://github.com/KaleksananBarqi/trawangan/releases/download';

const INSTALLER_EXTENSIONS = ['.exe', '.msi', '.dmg', '.app.tar.gz', '.AppImage', '.deb', '.rpm'];

/**
 * @typedef {{ fileName: string; signature: string }} SignedAssetEntry
 * @typedef {{ signature: string; url: string }} PlatformUpdateEntry
 * @typedef {{ version: string; notes: string; pub_date: string; platforms: Record<string, PlatformUpdateEntry> }} LatestManifest
 * @typedef {{ fileName: string; sha256: string }} ChecksumEntry
 */

/**
 * Menentukan kunci platform Tauri v2 (`latest.json`) dari nama file paket dan nama signature-nya.
 * @param {string} fileName
 * @returns {string | null}
 */
export function inferUpdaterPlatformKey(fileName) {
  const lower = fileName.toLowerCase();
  const isArm = lower.includes('aarch64') || lower.includes('arm64');

  if (lower.endsWith('-setup.exe') || lower.endsWith('.nsis.zip')) {
    return isArm ? 'windows-aarch64' : 'windows-x86_64';
  }
  if (lower.endsWith('.msi')) {
    return isArm ? 'windows-aarch64' : 'windows-x86_64';
  }
  if (lower.endsWith('.appimage')) {
    return isArm ? 'linux-aarch64' : 'linux-x86_64';
  }
  if (lower.endsWith('.app.tar.gz')) {
    return isArm || (!lower.includes('x64') && !lower.includes('x86_64'))
      ? 'darwin-aarch64'
      : 'darwin-x86_64';
  }
  return null;
}

/**
 * Memeriksa apakah sebuah berkas merupakan aset installer rilis resmi.
 * @param {string} fileName
 * @returns {boolean}
 */
export function isInstallerAsset(fileName) {
  return INSTALLER_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

/**
 * Menyusun objek `latest.json` standar Tauri v2 dari pasangan signature dan URL unduhan.
 * @param {{ tag: string; notes?: string; pubDate?: string; signedAssets: SignedAssetEntry[] }} params
 * @returns {LatestManifest}
 */
export function buildLatestJson({ tag, notes, pubDate, signedAssets }) {
  const version = String(tag || '').replace(/^v/, '').trim();
  /** @type {Record<string, PlatformUpdateEntry>} */
  const platforms = {};

  // Prioritaskan NSIS setup.exe dibanding .msi jika keduanya bertanda tangan di Windows
  const sorted = [...signedAssets].sort((a, b) => {
    /** @param {string} name */
    const score = (name) => (name.endsWith('-setup.exe') ? 2 : name.endsWith('.msi') ? 1 : 2);
    return score(a.fileName) - score(b.fileName);
  });

  for (const item of sorted) {
    const platformKey = inferUpdaterPlatformKey(item.fileName);
    if (!platformKey) continue;
    platforms[platformKey] = {
      signature: item.signature.trim(),
      url: `${RELEASE_DOWNLOAD_BASE}/${tag}/${item.fileName}`,
    };
  }

  return {
    version,
    notes: notes || '',
    pub_date: pubDate || new Date().toISOString(),
    platforms,
  };
}

/**
 * Memformat daftar checksum SHA-256 ke format standar `sha256sum`.
 * @param {ChecksumEntry[]} entries
 * @returns {string}
 */
export function formatSha256Sums(entries) {
  return entries
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((e) => `${e.sha256}  ${e.fileName}`)
    .join('\n')
    .concat(entries.length > 0 ? '\n' : '');
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  /** @type {string[]} */
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string | undefined>}
 */
function parseCliArgs(argv) {
  /** @type {Record<string, string | undefined>} */
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const tag = args.tag;
  const inputDir = args.input;
  const outputDir = args.output;
  const notesFile = args['notes-file'];

  if (!tag || !inputDir || !outputDir) {
    console.error('Penggunaan: node generate-release-manifests.mjs --tag <vX.Y.Z> --input <dir> --output <dir> [--notes-file <file>]');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const allFiles = walkFiles(inputDir);

  /** @type {Set<string>} */
  const copiedNames = new Set();
  /** @type {string[]} */
  const sigFiles = [];
  /** @type {string[]} */
  const installerPaths = [];

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    if (!isInstallerAsset(fileName) && !fileName.endsWith('.sig')) continue;
    if (copiedNames.has(fileName)) continue;

    const destPath = path.join(outputDir, fileName);
    fs.copyFileSync(filePath, destPath);
    copiedNames.add(fileName);

    if (fileName.endsWith('.sig')) {
      sigFiles.push(destPath);
    } else {
      installerPaths.push(destPath);
    }
  }

  /** @type {SignedAssetEntry[]} */
  const signedAssets = [];
  for (const sigPath of sigFiles) {
    const assetName = path.basename(sigPath, '.sig');
    if (!copiedNames.has(assetName)) continue;
    signedAssets.push({
      fileName: assetName,
      signature: fs.readFileSync(sigPath, 'utf8'),
    });
  }

  const notes = notesFile && fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').trim() : '';
  const latestJson = buildLatestJson({ tag, notes, signedAssets });
  fs.writeFileSync(path.join(outputDir, 'latest.json'), JSON.stringify(latestJson, null, 2) + '\n', 'utf8');

  const checksumEntries = installerPaths.map((filePath) => ({
    fileName: path.basename(filePath),
    sha256: sha256File(filePath),
  }));
  fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'), formatSha256Sums(checksumEntries), 'utf8');

  console.log(`Manifest generated: ${installerPaths.length} installer, ${signedAssets.length} signed updater artifact.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
