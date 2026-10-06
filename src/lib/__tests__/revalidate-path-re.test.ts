import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The validator is a module-level constant shared by the route and the nightly
// refresh (src/lib/revalidate-paths.ts, which imports next/cache). Read the
// literal out of the file instead, which also guarantees the test is checking
// the SHIPPED pattern rather than a copy that could drift.
function extractPathRe(file: string): RegExp {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/^(?:export )?const PATH_RE = (\/.*\/);$/m);
  assert.ok(m, `no PATH_RE literal found in ${file}`);
  // eslint-disable-next-line no-eval
  return eval(m![1]) as RegExp;
}

const ROUTE = 'src/lib/revalidate-paths.ts';
const ENDPOINT = 'src/app/api/revalidate/route.ts';
const PIPELINE = '../promonight/promo-pipeline/lib/revalidate-notify.js';

const ACCEPT = [
  '/cfb',
  '/cfb/alabama',
  '/cfb/rivalries',
  '/cfb/rivalries/iron-bowl',
  '/cfb/rivalries/red-river-rivalry',
  '/mlb/los-angeles-dodgers',
  '/venues/acrisure-stadium',
  '/promos/today',
];

const REJECT = [
  '/a/b/c/d',                        // four segments, one past the new ceiling
  '/CFB/Alabama',                    // uppercase
  '/cfb/rivalries/iron-bowl/',       // trailing slash
  '/cfb/rivalries/iron_bowl',        // underscore
  '/cfb/rivalries/iron bowl',        // space
  '/cfb/rivalries/iron-bowl?x=1',    // query string
  '/',                               // bare root, rejected by design
  'cfb/rivalries/iron-bowl',         // no leading slash
  '//cfb',                           // empty first segment
];

test('the endpoint PATH_RE accepts one to three segments', () => {
  const re = extractPathRe(ROUTE);
  for (const p of ACCEPT) assert.equal(re.test(p), true, `${p} should be ACCEPTED`);
});

test('the endpoint PATH_RE still rejects everything it rejected before', () => {
  const re = extractPathRe(ROUTE);
  for (const p of REJECT) assert.equal(re.test(p), false, `${p} should be REJECTED`);
});

test('the pipeline copy is byte-identical to the endpoint pattern', () => {
  // Divergence is the dangerous failure: a narrower client silently drops paths
  // the endpoint would accept, and the only symptom is a warn line in a log.
  const routeSrc = readFileSync(ROUTE, 'utf8').match(/^export const PATH_RE = (\/.*\/);$/m);
  const pipeSrc = readFileSync(PIPELINE, 'utf8').match(/^const PATH_RE = (\/.*\/);$/m);
  assert.ok(routeSrc && pipeSrc);
  assert.equal(pipeSrc![1], routeSrc![1]);
});

test('the pipeline copy behaves identically on every case', () => {
  const a = extractPathRe(ROUTE);
  const b = extractPathRe(PIPELINE);
  for (const p of [...ACCEPT, ...REJECT]) {
    assert.equal(b.test(p), a.test(p), `${p} must be judged the same by both copies`);
  }
});

test('MAX_PATHS is still 100, and the endpoint validates with the shared pattern', () => {
  const src = readFileSync(ENDPOINT, 'utf8');
  assert.match(src, /^const MAX_PATHS = 100;$/m);
  assert.match(src, /import \{ PATH_RE, revalidatePaths \} from '@\/lib\/revalidate-paths';/);
  assert.match(src, /if \(!PATH_RE\.test\(p\)\)/);
});
