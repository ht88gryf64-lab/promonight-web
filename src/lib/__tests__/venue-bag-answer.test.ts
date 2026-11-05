// CLAIMS VS DATA for the venue bag template (serp-targeting, rulings
// 2026-11-05). Two halves:
//
//   1. Hand-built fixtures that isolate one decision each: eligibility, the
//      title variant and drop order, the prohibition, a missing field producing
//      NO question, unsourced and excluded prose producing nothing.
//   2. Every real building in the published fixture (venue-hubs-published.json,
//      the post-publishedView hubs of 2026-11-05): every quoted string is an
//      exact substring of a sourced field, every title fits, every description
//      is 120 to 155 characters.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../venue-hub';

const load = () => import('../venue-bag-answer');
const SRC = 'https://www.example-arena.com/bag-policy';
const TSRC = 'https://www.example-club.com/guide';

function hub(over: Partial<VenueHub> = {}): VenueHub {
  return {
    slug: 'example-arena', name: 'Example Arena', formerNames: [], city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'x', league: 'NBA', tenantKey: 'x' }],
    parkingLots: [], parkingLotMapUrl: null, officialParkingUrls: [],
    publicTransit: null, rideshareDropoff: null, accessibility: null,
    bagMaxDimensions: { w: 14, h: 6, d: 14, unit: 'in' }, clearBagRequired: false, bagsProhibited: null,
    bagPolicyUrl: SRC,
    bagPolicyNotes: 'Bags may not exceed 14 x 6 x 14 inches. Backpacks are prohibited. Diaper bags are permitted after inspection.',
    tailgating: null, venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null,
    food: null, photoUrl: null, photoAttribution: null, verified: true,
    observedAtByField: {}, fieldStates: {}, tenantOverlays: [],
    sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyNotes: SRC, bagPolicyUrl: SRC },
    ...over,
  } as VenueHub;
}

// ── 1. isolated decisions ───────────────────────────────────────────────────

test('eligibility: a sourced size limit OR a sourced prohibition, verified only', async () => {
  const A = await load();
  assert.equal(A.isBagAnswerEligible(hub()), true);
  assert.equal(A.isBagAnswerEligible(hub({ verified: false })), false, 'unverified buildings stay unchanged');
  assert.equal(A.isBagAnswerEligible(hub({ sources: { bagPolicyNotes: SRC } })), false, 'unsourced dimensions do not qualify');
  const noDims = hub({ bagMaxDimensions: null, bagsProhibited: true, sources: { bagsProhibited: SRC } });
  assert.equal(A.isBagAnswerEligible(noDims), true, 'a sourced prohibition qualifies on its own');
  assert.equal(A.isBagAnswerEligible(hub({ bagMaxDimensions: null, bagsProhibited: true, sources: {} })), false);
  // clearBagRequired is NOT required (ruling 5): united-center's shape.
  assert.equal(A.isBagAnswerEligible(hub({ clearBagRequired: null, sources: { bagMaxDimensions: SRC } })), true);
});

test('title variant: clear only when SOURCED true, prohibited wins', async () => {
  const A = await load();
  // "Example Arena" runs the clear form to 62, so a shorter name shows it whole.
  assert.equal(A.venueBagTitle(hub({ name: 'Ex Arena', clearBagRequired: true })), 'Ex Arena Bag Policy 2026: Clear Bag Size & What\'s Allowed');
  assert.equal(A.venueBagTitle(hub({ clearBagRequired: true })), 'Example Arena Bag Policy 2026: Clear Bag Size');
  assert.equal(A.venueBagTitle(hub()), 'Example Arena Bag Policy 2026: Bag Size & What\'s Allowed');
  // a TRUE clearBagRequired with no source is not a clear-bag claim
  assert.equal(A.venueBagTitle(hub({ clearBagRequired: true, sources: { bagMaxDimensions: SRC } })), 'Example Arena Bag Policy 2026: Bag Size & What\'s Allowed');
  const prohibited = hub({ bagsProhibited: true, clearBagRequired: true, sources: { ...hub().sources, bagsProhibited: SRC } });
  assert.equal(A.venueBagTitle(prohibited), 'Example Arena Bag Policy 2026: No Bags Allowed & Exceptions');
});

test('title drop order: second term, then first term, then the year; the name is never cut', async () => {
  const A = await load();
  const named = (name: string) => A.venueBagTitle(hub({ name }));
  // 24-char name: the full form is 63, so "& What's Allowed" goes.
  assert.equal(named('Twenty Four Character Pk'), 'Twenty Four Character Pk Bag Policy 2026: Bag Size');
  // 36-char name: ": Bag Size" no longer fits either.
  const n36 = 'A Thirty Six Character Building Name';
  assert.equal(n36.length, 36);
  assert.equal(named(n36), `${n36} Bag Policy 2026`);
  // 46-char name: the year goes too.
  const n46 = 'A Forty Six Character Building Name For Tests1';
  assert.equal(n46.length, 46);
  assert.equal(named(n46), `${n46} Bag Policy`);
  // longer than the budget allows: the name stands whole and the title runs over
  const n55 = 'A Building Name So Long That No Candidate Can Ever Fit';
  assert.equal(named(n55), `${n55} Bag Policy`);
});

test('prohibited: leads with "No bags allowed", the size is never the size limit, no clear line', async () => {
  const A = await load();
  const truistShape = hub({
    bagMaxDimensions: { w: 5, h: 9, d: null, unit: 'in' }, bagsProhibited: true, clearBagRequired: false,
    bagPolicyNotes: 'Bags are not allowed to enter the park. Exceptions may be made for medical bags and clutches no larger than 5 x 9 inches.',
    sources: { ...hub().sources, bagsProhibited: SRC },
  });
  const m = A.bagAnswerModel(truistShape)!;
  assert.equal(m.headline, 'No bags allowed');
  assert.equal(m.sizeLimit, null);
  assert.equal(m.clearLine, null, '"a clear bag is not required" would read as permission on a no-bag building');
  assert.match(m.lead!.text, /5 x 9 inches/, 'the size survives only inside the quoted exception sentence');
  assert.ok(!A.venueBagDescription(truistShape).includes('5" x 9"'), 'the description never labels the exception size');
  assert.ok(A.venueBagDescription(truistShape).startsWith('Example Arena bag policy: no bags allowed inside.'));
});

test('a missing field renders no question for it', async () => {
  const A = await load();
  const topics = (h: VenueHub) => A.bagTopicQuestions(h).flatMap((q) => q.topics);
  // The notes cover backpacks and diaper bags, and nothing else.
  assert.deepEqual(topics(hub()), ['backpack', 'diaper']);
  // Remove the diaper sentence: no diaper question.
  const noDiaper = hub({ bagPolicyNotes: 'Bags may not exceed 14 x 6 x 14 inches. Backpacks are prohibited.' });
  assert.deepEqual(topics(noDiaper), ['backpack']);
  // No notes at all: no topic questions, and no lead quote.
  const noNotes = hub({ bagPolicyNotes: null });
  assert.deepEqual(A.bagTopicQuestions(noNotes), []);
  assert.equal(A.bagAnswerModel(noNotes)!.lead, null);
});

test('unsourced or excluded prose is never quoted', async () => {
  const A = await load();
  const unsourced = hub({ sources: { bagMaxDimensions: SRC } });
  assert.deepEqual(A.bagTopicQuestions(unsourced), [], 'notes without their own provenance are not a source');
  // providence-park's notes are excluded (2016 club page, venue-field-exclusions).
  const excluded = hub({ slug: 'providence-park' });
  assert.deepEqual(A.bagTopicQuestions(excluded), []);
  assert.equal(A.bagAnswerModel(excluded)!.lead, null);
  // A tenant exception needs a verified overlay AND its own source.
  const overlay = { teamId: 'x', league: 'NBA' as const, displayName: 'X', gatesOpen: null, gateVariance: null, tailgateWindow: null, verified: true, sources: {}, observedAtByField: {}, bagPolicyException: 'Camera bags are not permitted.' };
  assert.deepEqual(A.bagTopicQuestions(hub({ bagPolicyNotes: null, tenantOverlays: [overlay] })), []);
  const sourcedOverlay = { ...overlay, sources: { bagPolicyException: TSRC } };
  const q = A.bagTopicQuestions(hub({ bagPolicyNotes: null, tenantOverlays: [sourcedOverlay] }));
  assert.deepEqual(q.map((x) => [x.topics, x.answer, x.sourceUrl]), [[['camera'], 'Camera bags are not permitted.', TSRC]]);
  assert.deepEqual(A.bagTopicQuestions(hub({ bagPolicyNotes: null, tenantOverlays: [{ ...sourcedOverlay, verified: false }] })), []);
});

test('"plastic storage bag" is an approved bag, not bag storage', async () => {
  const A = await load();
  const h = hub({ bagPolicyNotes: 'Fans may bring a one-gallon clear plastic storage bag. Bag lockers are available outside Gate 1 for $10.' });
  const storage = A.bagTopicQuestions(h).find((q) => q.topics.includes('storage'))!;
  assert.equal(storage.answer, 'Bag lockers are available outside Gate 1 for $10.');
});

test('two topics quoting the same sentence share one question', async () => {
  const A = await load();
  const h = hub({ bagPolicyNotes: 'Clutches and purses up to 4.5 x 6.5 inches are allowed.' });
  const q = A.bagTopicQuestions(h);
  assert.equal(q.length, 1);
  assert.deepEqual(q[0].topics, ['clutch', 'purse']);
  assert.equal(q[0].question, 'What is the clutch and purse policy at Example Arena?');
});

test('"Last verified" prints only a bag field observedAt date, never the doc-level date', async () => {
  const A = await load();
  assert.equal(A.bagAnswerModel(hub())!.lastVerified, null);
  const dated = hub({ observedAtByField: { bagMaxDimensions: '2026-10-07T14:31:11.166Z' } });
  assert.equal(A.bagAnswerModel(dated)!.lastVerified, 'Oct 7, 2026');
  // a date on a field the block does not show is not borrowed
  const other = hub({ observedAtByField: { parkingLots: '2026-10-07T14:31:11.166Z' } });
  assert.equal(A.bagAnswerModel(other)!.lastVerified, null);
});

test('sentence spans never split a dimension or an abbreviation', async () => {
  const A = await load();
  const t = 'Clutches up to 4.5x6.5 in. are fine. Gates open at 6 p.m. Sharp. Lockers cost $10.';
  const parts = A.sentenceSpans(t).map((s) => t.slice(s.start, s.end));
  assert.ok(parts.every((p) => t.includes(p)));
  assert.ok(parts.some((p) => p.includes('4.5x6.5')), 'the dimension stays whole');
  assert.ok(parts.some((p) => p.includes('6 p.m. Sharp.')), 'a.m./p.m. is not a boundary');
});

// ── 2. every real building ─────────────────────────────────────────────────

const HUBS: VenueHub[] = JSON.parse(
  readFileSync(new URL('../../components/venue-hub/__tests__/fixtures/venue-hubs-published.json', import.meta.url), 'utf8'),
);

test('REAL DATA: eligibility counts and title variants (2026-11-05)', async () => {
  const A = await load();
  const elig = HUBS.filter(A.isBagAnswerEligible);
  assert.equal(HUBS.length, 223);
  assert.equal(elig.length, 164);
  const v: Record<string, number> = {};
  for (const h of elig) v[A.bagTitleVariant(h)] = (v[A.bagTitleVariant(h)] ?? 0) + 1;
  assert.deepEqual(v, { clear: 91, size: 72, prohibited: 1 });
  assert.ok(!elig.some((h) => !h.verified), 'no unverified building is eligible');
  for (const s of ['united-center', 'yankee-stadium', 'ball-arena', 'truist-park', 'wrigley-field', 'chase-center', 'target-center']) {
    assert.ok(elig.some((h) => h.slug === s), `${s} is eligible`);
  }
  assert.ok(!elig.some((h) => h.slug === 'spectrum-center'), 'spectrum-center is unverified and stays unchanged');
});

test('REAL DATA: every quoted string is an exact substring of a sourced field', async () => {
  const A = await load();
  let checked = 0;
  for (const h of HUBS.filter(A.isBagAnswerEligible)) {
    // The sourced fields, read straight off the hub rather than through the
    // module under test: the notes when they carry their own provenance, and
    // each verified overlay's exception when it carries its own.
    const sourced: string[] = [];
    if (h.bagPolicyNotes && h.sources.bagPolicyNotes && h.slug !== 'providence-park') sourced.push(h.bagPolicyNotes);
    for (const t of h.tenantOverlays) if (t.verified && t.bagPolicyException && t.sources.bagPolicyException) sourced.push(t.bagPolicyException);
    const m = A.bagAnswerModel(h)!;
    const quotes = [m.lead?.text, m.clutch?.text, ...A.bagTopicQuestions(h).map((q) => q.answer)].filter((x): x is string => !!x);
    for (const q of quotes) {
      checked++;
      assert.ok(sourced.some((f) => f.includes(q)), `${h.slug}: not a substring of a sourced field: ${q}`);
    }
    for (const q of A.bagTopicQuestions(h)) {
      assert.ok(Object.values(h.sources).includes(q.sourceUrl) || h.tenantOverlays.some((t) => t.sources.bagPolicyException === q.sourceUrl), `${h.slug}: the link is the field's own source`);
    }
  }
  // Measured 2026-11-05; the Gate 2 report quotes this number.
  assert.equal(checked, 474);
});

test('REAL DATA: every bag title fits 60 and every description is 120 to 155', async () => {
  const A = await load();
  for (const h of HUBS.filter(A.isBagAnswerEligible)) {
    const t = A.venueBagTitle(h);
    assert.ok(t.length <= 60, `${h.slug} title is ${t.length}: ${t}`);
    assert.ok(A.venueBagTitleCandidates(h).includes(t), `${h.slug}: a whole candidate, never a cut`);
    const d = A.venueBagDescription(h);
    assert.ok(d.length >= 120 && d.length <= 155, `${h.slug} description is ${d.length}: ${d}`);
    assert.ok(d.startsWith(A.bagLeadSentence(h)), `${h.slug}: the description leads with the size limit`);
    for (const s of [t, d, A.venueBagHeading(h)]) assert.ok(!s.includes('—'), `${h.slug}: no em dash`);
  }
});
