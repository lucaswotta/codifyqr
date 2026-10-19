// Fails when the code needed for the first paint grows past the budget (gzip, KB).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 80;
const dist = process.argv[2] ?? 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const gz = (file) => gzipSync(readFileSync(join(dist, file))).length;
const local = (url) => url.replace(/^.*?\/assets\//, 'assets/');

const files = new Set(['index.html']);
for (const m of html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+\.(?:js|css))"/g)) files.add(local(m[1]));

// The entry chunk statically imports shared chunks; the active language loads right after boot.
const entry = [...files].find((f) => f.endsWith('.js') && f.includes('index-'));
const entrySource = readFileSync(join(dist, entry), 'utf8');
for (const m of entrySource.matchAll(/from\s*["'`]\.\/([^"'`]+\.js)["'`]/g)) files.add(`assets/${m[1]}`);

const locales = [...entrySource.matchAll(/["'`]\.\/((?:en|pt-BR|es)-[^"'`]+\.js)["'`]/g)].map((m) => `assets/${m[1]}`);
if (locales.length !== 3) throw new Error(`Expected 3 language chunks, found ${locales.length}`);
const biggestLocale = Math.max(...locales.map(gz));

// Fonts referenced by the stylesheet are part of the first paint.
const css = [...files].find((f) => f.endsWith('.css'));
for (const m of readFileSync(join(dist, css), 'utf8').matchAll(/url\(([^)]*\.woff2)\)/g))
  files.add(local(m[1].replace(/["']/g, '').replace(/^\.?\//, '/')));

let total = biggestLocale;
for (const f of files) {
  const size = gz(f);
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(6)} KB  ${f}`);
}
console.log(`${(biggestLocale / 1024).toFixed(1).padStart(6)} KB  largest language file`);
console.log(`${(total / 1024).toFixed(1).padStart(6)} KB  first load, gzip (budget ${BUDGET_KB} KB)`);
if (total / 1024 > BUDGET_KB) {
  console.error('Over budget.');
  process.exit(1);
}
