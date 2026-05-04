// Build script: extracts Latin-alphabet trigram tables from franc-min and emits
// a JSON file plus a JS-literal that gets pasted into yulaf.user.js between
// the `// ── BEGIN trigram-tables ──` / `// ── END trigram-tables ──` markers.
//
// Run: node tools/build-trigrams.mjs
//
// Output:
//   - tools/trigrams.generated.json   (checked in)
//   - prints a JS literal to stdout for copy/paste
//
// The trigram statistics are derived from franc-min (MIT,
// https://github.com/wooorm/franc). franc-min is a dev-only dependency; the
// userscript itself stays single-file and dependency-free at runtime.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { data } from 'franc-min/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ISO 639-3 (franc) -> ISO 639-1 (yulaf)
const TARGETS = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  tur: 'tr',
  por: 'pt',
  ita: 'it',
  nld: 'nl',
};

const Latin = data.Latin;
const tables = {};
for (const [iso3, iso2] of Object.entries(TARGETS)) {
  const raw = Latin[iso3];
  if (!raw) throw new Error(`franc-min/data.js missing Latin.${iso3}`);
  // Each entry is a 3-char trigram. Order = frequency rank (0 = most frequent).
  tables[iso2] = raw.split('|');
  if (tables[iso2].length !== 300) {
    throw new Error(`expected 300 trigrams for ${iso3}, got ${tables[iso2].length}`);
  }
}

const jsonOut = resolve(__dirname, 'trigrams.generated.json');
writeFileSync(jsonOut, JSON.stringify(tables, null, 2) + '\n', 'utf8');
process.stderr.write(`wrote ${jsonOut}\n`);

// Print a JS literal suitable for pasting between marker comments.
const literal = [
  '  // ── BEGIN trigram-tables ──',
  '  // Trigram data derived from franc-min (MIT, https://github.com/wooorm/franc).',
  '  // Regenerate with: node tools/build-trigrams.mjs',
  '  const TRIGRAM_TABLES = {',
  ...Object.entries(tables).map(([code, list]) => {
    const arr = list.map((t) => JSON.stringify(t)).join(',');
    return `    ${code}: [${arr}],`;
  }),
  '  };',
  '  // ── END trigram-tables ──',
].join('\n');

process.stdout.write(literal + '\n');

// If invoked with --inline, splice the literal into yulaf.user.js between markers.
if (process.argv.includes('--inline')) {
  const userscriptPath = resolve(repoRoot, 'yulaf.user.js');
  const src = readFileSync(userscriptPath, 'utf8');
  const beginMarker = '  // ── BEGIN trigram-tables ──';
  const endMarker = '  // ── END trigram-tables ──';
  const begin = src.indexOf(beginMarker);
  const end = src.indexOf(endMarker);
  if (begin < 0 || end < 0) {
    throw new Error(
      'yulaf.user.js missing trigram-tables marker comments — cannot splice inline.'
    );
  }
  const next = src.slice(0, begin) + literal + src.slice(end + endMarker.length);
  writeFileSync(userscriptPath, next, 'utf8');
  process.stderr.write(`spliced trigram tables into ${userscriptPath}\n`);
}
