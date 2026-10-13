// T32 — TC-PERF-03: initial JS (entry script plus its modulepreload links) must be ≤ 250 KB gzip.
// Run after `npm run build`. Exits 1 when over budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const BUDGET = 250_000; // bytes, gzip

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [
  ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((m) => m[1]);

let total = 0;
for (const ref of refs) {
  const size = gzipSync(readFileSync(join(DIST, ref))).length;
  total += size;
  console.log(`${String(size).padStart(8)} B  ${ref}`);
}
const ok = total <= BUDGET;
console.log(`initial JS gzip: ${total} B (budget ${BUDGET} B) ${ok ? 'PASS' : 'FAIL'}`);
process.exitCode = ok ? 0 : 1;
