// Reads a Lighthouse JSON report and fails when a category falls below its target.
import { readFileSync } from 'node:fs';

const TARGETS = { performance: 0.95, accessibility: 1, 'best-practices': 1, seo: 1 };
// Lighthouse fetches /robots.txt from inside the page, and the strict CSP (connect-src 'none')
// blocks that fetch. The file itself is served; only the audit cannot read it.
const IGNORED_AUDITS = new Set(['robots-txt']);

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let failed = false;
for (const [id, min] of Object.entries(TARGETS)) {
  const category = report.categories[id];
  let score = category?.score ?? 0;
  if (id === 'seo') {
    const weighted = category.auditRefs.filter((a) => a.weight > 0 && !IGNORED_AUDITS.has(a.id));
    score =
      weighted.reduce((sum, a) => sum + (report.audits[a.id].score ?? 0) * a.weight, 0) /
      weighted.reduce((sum, a) => sum + a.weight, 0);
  }
  const ok = score >= min;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: ${Math.round(score * 100)} (min ${Math.round(min * 100)})`);
}
const cls = report.audits['cumulative-layout-shift'].numericValue;
if (cls > 0.05) {
  failed = true;
  console.log(`FAIL cumulative layout shift ${cls.toFixed(3)} (max 0.05)`);
}
process.exit(failed ? 1 : 0);
