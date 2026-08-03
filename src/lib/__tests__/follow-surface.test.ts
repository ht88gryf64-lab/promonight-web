// The capture-funnel source vocabulary.
//
// WHY THIS FILE EXISTS NOW. The engagement capture sheet's A/B was dropped
// before it was read; the sheet renders for every qualifying visitor and the
// comparison it would have made is carried entirely by these tags instead. So
// "web_engagement_capture means the sheet and nothing else" stopped being a
// naming convention and became the measurement. The tests below guard the
// properties that claim depends on, because every way of breaking it is silent:
// a forged tag, a duplicated value, or a path-inferred CTA that starts
// answering web_engagement_capture would all produce a believable number rather
// than an error.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';

import {
  CAPTURE_SURFACES,
  ENTRY_SURFACES,
  coerceCaptureSurface,
  coerceEntrySurface,
  inferCaptureSurface,
  isCaptureSurface,
  type CaptureSurface,
} from '../follow-surface';

// ── The vocabulary itself ───────────────────────────────────────────────────

test('every surface value is distinct', () => {
  // A duplicated literal would type-check, and would silently merge two
  // placements into one row of a signups-by-source read.
  assert.strictEqual(
    new Set(CAPTURE_SURFACES).size,
    CAPTURE_SURFACES.length,
    'a duplicate would fold two entry points into one tag',
  );
});

test('the sheet has a tag and it is not shared with any CTA surface', () => {
  assert.ok(CAPTURE_SURFACES.includes('web_engagement_capture'));
  // The four static-CTA surfaces the read compares the sheet against.
  for (const s of ['web_team_page', 'web_homepage', 'web_aggregator', 'web_playoffs_hub'] as const) {
    assert.ok(CAPTURE_SURFACES.includes(s), `${s} missing from the vocabulary`);
    assert.notStrictEqual(s, 'web_engagement_capture' as CaptureSurface);
  }
});

// ── The /follow entry boundary ──────────────────────────────────────────────

test('the sheet surface cannot arrive through the /follow query param', () => {
  // THE LOAD-BEARING ONE. The sheet never links to /follow, so this value in a
  // ?source= param is always spurious; honouring it would write the sheet's tag
  // onto a signup the sheet had nothing to do with, in Firestore as well as
  // PostHog, where the confirm-rate read has no page_type to disambiguate.
  assert.strictEqual(coerceEntrySurface('web_engagement_capture'), 'web_other');
  assert.ok(!ENTRY_SURFACES.includes('web_engagement_capture'));
});

test('the entry boundary still accepts every legitimate CTA surface', () => {
  // The exclusion must cost nothing else: every surface a real CTA links with
  // has to survive the round trip, or the tag it writes is the one thing the
  // read cannot recover.
  for (const s of ENTRY_SURFACES) {
    assert.strictEqual(coerceEntrySurface(s), s, `${s} was rejected at the entry boundary`);
  }
  assert.strictEqual(
    ENTRY_SURFACES.length,
    CAPTURE_SURFACES.length - 1,
    'exactly one surface is excluded from entry, and it is the sheet',
  );
});

test('the API boundary DOES accept the sheet surface', () => {
  // /api/subscribe must keep taking it: that request is the sheet's own submit.
  // Narrowing this instead of the query param would silently unlabel every
  // sheet conversion.
  assert.strictEqual(coerceCaptureSurface('web_engagement_capture'), 'web_engagement_capture');
});

test('both coercions reject junk rather than throwing', () => {
  for (const junk of [undefined, null, '', 'WEB_TEAM_PAGE', 'web_team_page ', 42, {}, []]) {
    assert.strictEqual(coerceCaptureSurface(junk), 'web_other');
    assert.strictEqual(coerceEntrySurface(junk), 'web_other');
  }
  assert.strictEqual(isCaptureSurface('web_nonsense'), false);
});

// ── Path inference (the global footer CTA) ──────────────────────────────────

test('path inference never answers with the sheet surface', () => {
  // The footer renders on every route and infers its own surface. If inference
  // ever reached web_engagement_capture, a footer click would be indistinguish-
  // able from a sheet conversion and the whole comparison would collapse
  // quietly. Exhaustive over the app's real routes plus adversarial input.
  const paths = [
    null,
    undefined,
    '',
    '/',
    '/mlb',
    '/mlb/minnesota-twins',
    '/wnba',
    '/wnba/minnesota-lynx',
    '/mls',
    '/nba/boston-celtics',
    '/nfl/green-bay-packers',
    '/nhl/minnesota-wild',
    '/cfb',
    '/cfb/alabama',
    '/playoffs',
    '/promos/today',
    '/promos/bobbleheads',
    '/best-promos',
    '/teams',
    '/my-teams',
    '/venues/target-field',
    '/follow',
    '/world-cup',
    '/team-rankings',
    '/about',
    // Adversarial: a path that merely contains the string.
    '/venues/web_engagement_capture',
  ];
  for (const p of paths) {
    const inferred = inferCaptureSurface(p);
    assert.notStrictEqual(
      inferred,
      'web_engagement_capture',
      `${p} inferred the sheet's own surface`,
    );
    assert.ok(isCaptureSurface(inferred), `${p} inferred a value outside the vocabulary`);
  }
});

test('path inference maps the routes it claims to map', () => {
  const cases: Array<[string | null, CaptureSurface]> = [
    [null, 'web_homepage'],
    ['/', 'web_homepage'],
    ['/playoffs', 'web_playoffs_hub'],
    ['/promos/today', 'web_aggregator'],
    ['/best-promos', 'web_aggregator'],
    ['/mlb/minnesota-twins', 'web_team_page'],
    ['/wnba/minnesota-lynx', 'web_team_page'],
    ['/mls/minnesota-united', 'web_team_page'],
  ];
  for (const [path, expected] of cases) {
    assert.strictEqual(inferCaptureSurface(path), expected, `${path}`);
  }
});

test('the league hubs and CFB fall to web_other, which is a KNOWN gap', () => {
  // Documented rather than asserted-as-correct. /mlb, /wnba and /mls are one
  // segment so they miss the two-segment team-page rule, and inferCaptureSurface
  // has no 'cfb' in its sport list, so all 86 CFB school pages miss it too.
  // None of those routes has an in-content CTA or a capture sheet: they import
  // AggregatorJsonLd from aggregator-layout, not AggregatorPage, so the global
  // footer is their ONLY capture entry, and it labels every one of them
  // web_other.
  //
  // So the gap is not two entry points disagreeing on one page. It is a real
  // chunk of the site whose only signup path is untagged. It does not affect
  // the sheet-vs-static-CTA read (web_other is on the static side either way);
  // it does dilute any per-source breakdown.
  //
  // The fix is NOT adding 'cfb' to the sport list, which would fold 86
  // sheet-less pages into web_team_page, the sheet's own comparison group. It
  // is new surfaces. This test exists so the gap is visible in the suite rather
  // than discovered in a dashboard; if inference is ever fixed, it SHOULD fail
  // and be updated to the new mapping.
  assert.strictEqual(inferCaptureSurface('/mlb'), 'web_other');
  assert.strictEqual(inferCaptureSurface('/wnba'), 'web_other');
  assert.strictEqual(inferCaptureSurface('/mls'), 'web_other');
  assert.strictEqual(inferCaptureSurface('/cfb/alabama'), 'web_other');
});
