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

test('MAX_PATHS is still 100, and the endpoint validates with the shared patterns', () => {
  const src = readFileSync(ENDPOINT, 'utf8');
  assert.match(src, /^const MAX_PATHS = 100;$/m);
  assert.match(src, /import \{ isRevalidatePath, revalidatePaths \} from '@\/lib\/revalidate-paths';/);
  assert.match(src, /if \(!isRevalidatePath\(p\)\)/);
});

// ── Phase 3b: the four-segment promo page path, its own pattern ──────────────
// PATH_RE itself is unchanged (the byte-identity test above still holds), so
// the only four-segment paths let in are /{league}/{team}/promos/{slug}.
const PROMO_PIPELINE = '../promonight/promo-pipeline/lib/promo-pages-notify.js';

function extractPromoPathRe(file: string): RegExp {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/^(?:export )?const PROMO_PATH_RE = (\/.*\/);$/m);
  assert.ok(m, `no PROMO_PATH_RE literal found in ${file}`);
  // eslint-disable-next-line no-eval
  return eval(m![1]) as RegExp;
}

const PROMO_ACCEPT = ['/nhl/minnesota-wild/promos/blaze-orange-hat', '/mlb/los-angeles-dodgers/promos/pride-night-0612', '/nhl/detroit-red-wings/promos/star-wars-night-2025-26'];
const PROMO_REJECT = ['/a/b/c/d', '/nhl/minnesota-wild/promo/blaze-orange-hat', '/nhl/minnesota-wild/promos/', '/nhl/minnesota-wild/promos/Blaze', '/nhl/minnesota-wild/promos/x/y', '/promos/blaze-orange-hat', '/nhl/minnesota-wild/promos/x?y=1'];

test('PROMO_PATH_RE accepts exactly the promo page shape and nothing else four segments long', () => {
  const re = extractPromoPathRe(ROUTE);
  for (const p of PROMO_ACCEPT) assert.equal(re.test(p), true, `${p} should be ACCEPTED`);
  for (const p of [...PROMO_REJECT, ...REJECT]) assert.equal(re.test(p), false, `${p} should be REJECTED`);
  // The three-segment paths are PATH_RE's, not this pattern's.
  for (const p of ACCEPT) assert.equal(re.test(p), false, `${p} is PATH_RE's`);
});

test('the pipeline promo-pages copy is byte-identical and judges every case the same', () => {
  const routeSrc = readFileSync(ROUTE, 'utf8').match(/^export const PROMO_PATH_RE = (\/.*\/);$/m);
  const pipeSrc = readFileSync(PROMO_PIPELINE, 'utf8').match(/^const PROMO_PATH_RE = (\/.*\/);$/m);
  assert.ok(routeSrc && pipeSrc);
  assert.equal(pipeSrc![1], routeSrc![1]);
  const a = extractPromoPathRe(ROUTE);
  const b = extractPromoPathRe(PROMO_PIPELINE);
  for (const p of [...PROMO_ACCEPT, ...PROMO_REJECT, ...ACCEPT, ...REJECT]) assert.equal(b.test(p), a.test(p), p);
});

// ── 2026-10-30, promo pages flip step 4b: the sitemap is the one dotted path ─
// PATH_RE and PROMO_PATH_RE are unchanged (the byte-identity tests above still
// hold); the shared validator adds one exact string, so the nightly refresh and
// the pipeline's weekly staleness run can regenerate the deploy-built sitemap.
test('the shared validator accepts /sitemap.xml exactly, and no other dotted path', async () => {
  const { isRevalidatePath, SITEMAP_PATH } = await import('../revalidate-paths');
  assert.equal(SITEMAP_PATH, '/sitemap.xml');
  assert.equal(isRevalidatePath('/sitemap.xml'), true);
  for (const p of ['/Sitemap.xml', '/sitemap.xml/', '/sitemap.xml?x=1', '/sitemap.xml/x', '/sitemap-0.xml', '/robots.txt', '/ads.txt', 'sitemap.xml', '/promos/today.xml']) assert.equal(isRevalidatePath(p), false, p);
  for (const p of [...ACCEPT, ...PROMO_ACCEPT]) assert.equal(isRevalidatePath(p), true, p);
  for (const p of [...REJECT, ...PROMO_REJECT.filter((x) => x !== '/promos/blaze-orange-hat')]) assert.equal(isRevalidatePath(p), false, p);
});
