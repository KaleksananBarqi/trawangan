/**
 * Helper untuk mengekstrak catatan rilis versi tertentu dari CHANGELOG.md.
 * Digunakan oleh GitHub Actions CI/CD dan alur rilis lokal.
 */
const fs = require('fs');
const path = require('path');

function extractChangelog(targetVersion) {
  const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    return '';
  }

  const cleanVersion = String(targetVersion || '').trim().replace(/^v/, '');
  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const startIdx = lines.findIndex((l) => l.startsWith(`## [${cleanVersion}]`));
  if (startIdx === -1) {
    return '';
  }

  const notes = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## [')) {
      break;
    }
    notes.push(line);
  }

  // Bersihkan pemisah '---' trailing dan whitespace di awal/akhir
  return notes
    .join('\n')
    .replace(/\n---\s*$/, '')
    .trim();
}

if (require.main === module) {
  let ver = process.argv[2];
  if (!ver) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
      );
      ver = pkg.version;
    } catch {
      ver = '';
    }
  }
  const result = extractChangelog(ver);
  process.stdout.write(result);
}

module.exports = { extractChangelog };
