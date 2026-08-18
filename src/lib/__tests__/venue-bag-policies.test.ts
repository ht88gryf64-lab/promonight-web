// /venues/bag-policies invariants. The load-bearing ones: the four grouping
// predicates evaluate in order; the kauffman-stadium hard rule can never be
// silently undone by a data change; null is never rendered as "No"; every
// count derives from the same grouped computation; the conservative clutch
// parser only prints a size it actually parsed.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRow,
  clutchChipFor,
  groupBagPolicyRows,
  deriveBagStats,
  buildBagPolicyFaqs,
  parseClutch,
  SOURCES_CONFLICT_SLUGS,
  type BagPolicyRow,
} from '@/lib/venue-bag-policies';
import { buildBagPolicyJsonLd } from '@/lib/venue-bag-jsonld';

const row = (slug: string, over: Partial<BagPolicyRow> = {}): BagPolicyRow => ({
  slug,
  venueName: slug,
  teamName: 'Team',
  teamColor: null,
  clearBagRequired: null,
  dims: null,
  dimsText: null,
  bagsProhibited: null,
  bagPolicyUrl: null,
  clutch: null,
  sourcesConflict: false,
  ...over,
});

// ── grouping predicates, in order ────────────────────────────────────────────

test('predicates evaluate in order: prohibited beats clear-true beats size-limited', () => {
  assert.equal(classifyRow(row('a', { bagsProhibited: true, clearBagRequired: true, dims: { w: 5, h: 9, d: null, unit: 'in' } })), 'no-bags');
  assert.equal(classifyRow(row('b', { clearBagRequired: true, dims: { w: 12, h: 6, d: 12, unit: 'in' } })), 'clear-required');
  assert.equal(classifyRow(row('c', { clearBagRequired: false, dims: { w: 16, h: 16, d: 8, unit: 'in' } })), 'size-limited');
});

test('null verdicts and false-without-dims land in check-policy, never a verdict group', () => {
  assert.equal(classifyRow(row('null-with-dims', { dims: { w: 10, h: 8, d: 10, unit: 'in' } })), 'check-policy');
  assert.equal(classifyRow(row('false-no-dims', { clearBagRequired: false })), 'check-policy');
  assert.equal(classifyRow(row('nothing')), 'check-policy');
});

// ── the kauffman hard rule, pinned ───────────────────────────────────────────

test('HARD RULE: kauffman-stadium is a sources-conflict slug and demotes to check-policy over ANY stored values', () => {
  assert.ok(SOURCES_CONFLICT_SLUGS.includes('kauffman-stadium'));
  // Even a fully COMPLETE-looking stored row is demoted when the flag is set:
  // a future data change cannot silently promote the building.
  const stored = row('kauffman-stadium', {
    sourcesConflict: true,
    clearBagRequired: null, // the loader nulls these for conflict slugs...
    dims: null,
  });
  assert.equal(classifyRow(stored), 'check-policy');
  // ...and even if a future loader change leaked stored values through, the
  // sourcesConflict flag still wins because it is evaluated first.
  const leaked = row('kauffman-stadium', {
    sourcesConflict: true,
    clearBagRequired: true,
    bagsProhibited: false,
    dims: { w: 12, h: 12, d: 6, unit: 'in' },
  });
  assert.equal(classifyRow(leaked), 'check-policy');
});

// ── counts: one computation, everything derives ──────────────────────────────

function fixtureRows(): BagPolicyRow[] {
  return [
    row('truist', { bagsProhibited: true, clearBagRequired: false, dims: { w: 5, h: 9, d: null, unit: 'in' }, dimsText: '5″ × 9″' }),
    row('clear-a', { clearBagRequired: true, dims: { w: 12, h: 6, d: 12, unit: 'in' }, dimsText: '12″ × 6″ × 12″' }),
    row('clear-b', { clearBagRequired: true, dims: { w: 12, h: 6, d: 12, unit: 'in' }, dimsText: '12″ × 6″ × 12″' }),
    row('size-a', { clearBagRequired: false, dims: { w: 16, h: 16, d: 8, unit: 'in' }, dimsText: '16″ × 16″ × 8″' }),
    row('null-a', { dims: { w: 10, h: 8, d: 10, unit: 'in' }, dimsText: '10″ × 8″ × 10″' }),
    row('kauffman-stadium', { sourcesConflict: true }),
  ];
}

test('group counts sum to the total and stats mirror the groups the DOM renders', () => {
  const groups = groupBagPolicyRows(fixtureRows());
  const s = deriveBagStats(groups);
  assert.equal(s.total, 6);
  assert.equal(s.perGroup.reduce((n, g) => n + g.count, 0), s.total);
  assert.equal(s.noBags, 1);
  assert.equal(s.clearRequired, 2);
  assert.equal(s.sizeLimited, 1);
  assert.equal(s.checkPolicy, 2); // null-a + the pinned kauffman row
  assert.equal(s.commonClearSize, '12″ × 6″ × 12″'); // mode needs >= 2
  assert.equal(s.commonMaxSize, null); // only one size-limited row: no mode claim
});

test('empty groups are omitted entirely, never rendered as empty headings', () => {
  const groups = groupBagPolicyRows([row('only-null')]);
  assert.deepEqual(groups.map((g) => g.key), ['check-policy']);
});

test('FAQ numbers derive from the same groups and no literal count survives an input change', () => {
  const groups = groupBagPolicyRows(fixtureRows());
  const s = deriveBagStats(groups);
  const faqs = buildBagPolicyFaqs(groups);
  const all = faqs.map((f) => f.answer).join('\n');
  assert.match(all, new RegExp(`${s.clearRequired} of the ${s.total} MLB ballparks require a clear bag`));
  assert.match(all, new RegExp(`${s.sizeLimited} parks allow ordinary soft-sided bags`));
  // Shrink the input: every number tracks.
  const smaller = groupBagPolicyRows(fixtureRows().slice(0, 3));
  const s2 = deriveBagStats(smaller);
  const all2 = buildBagPolicyFaqs(smaller).map((f) => f.answer).join('\n');
  assert.match(all2, new RegExp(`${s2.clearRequired} of the ${s2.total} MLB ballparks`));
});

test('null is never "No": zero clear-required rows drops the clear-bag question instead of answering it', () => {
  const groups = groupBagPolicyRows([row('null-a', { dims: { w: 16, h: 16, d: 8, unit: 'in' }, dimsText: '16″ × 16″ × 8″' })]);
  const faqs = buildBagPolicyFaqs(groups);
  assert.equal(faqs.some((f) => /clear bag/i.test(f.question)), false);
  // And no answer asserts a negative anywhere on a null-verdict corpus.
  for (const f of faqs) {
    assert.equal(/not required|no clear bag|don't need a clear/i.test(f.answer), false, f.answer);
  }
});

// ── the conservative clutch parser, on real stored prose ─────────────────────

test('parseClutch prints a size only when one parses in the clutch clause', () => {
  // citizens-bank-park tenant exception (real stored prose)
  assert.deepEqual(
    parseClutch(['Clutch purses and fanny packs no larger than 5 x 7 inches, plus medical bags and diaper bags, are permitted without being clear.'], '12″ × 6″ × 12″'),
    { kind: 'sized', text: 'up to 5″ × 7″' },
  );
  // dodger-stadium overlay (real stored prose): wristlets/clutches 5"x8"x2"
  assert.deepEqual(
    parseClutch(['Adult and infant diaper bags, and non-clear wristlets/clutches no larger than 5"x8"x2", are permitted despite the clear-bag requirement.'], '12″ × 12″ × 6″'),
    { kind: 'sized', text: 'up to 5″ × 8″ × 2″' },
  );
});

test('parseClutch: an affirmed allowance with no clean size yields the dashed state, not a guess', () => {
  assert.deepEqual(parseClutch(['Small clutches are permitted after inspection.'], null), { kind: 'affirmed' });
});

test('parseClutch: no clutch-class words yields null (diaper/medical exceptions are not clutch chips)', () => {
  assert.equal(parseClutch(['Exceptions to the bag policy are made for diaper bags and medical bags.'], null), null);
});

test('parseClutch: a clutch cap identical to the row cap is not a separate exception (comerica)', () => {
  assert.equal(
    parseClutch(['Single-compartment bags, wallets and clutches smaller than 4" x 6" x 1.5" (with or without a handle or strap) are permitted.'], '4″ × 6″ × 1.5″'),
    null,
  );
});

test('parseClutch: a size in a different sentence does not attach to the clutch words', () => {
  assert.deepEqual(
    parseClutch(['Bags up to 16" x 16" x 8" are allowed. Small clutches are also permitted.'], '16″ × 16″ × 8″'),
    { kind: 'affirmed' },
  );
});

// ── JSON-LD mirrors the DOM ──────────────────────────────────────────────────

test('ItemList mirrors flattened group order exactly and emits no per-venue StadiumOrArena', () => {
  const groups = groupBagPolicyRows(fixtureRows());
  const ordered = groups.flatMap((g) => g.rows);
  const faqs = buildBagPolicyFaqs(groups);
  const schemas = buildBagPolicyJsonLd('T', 'D', ordered, faqs);
  const il = schemas.find((s) => s['@type'] === 'ItemList') as { numberOfItems: number; itemListElement: Array<{ position: number; url: string }> };
  assert.equal(il.numberOfItems, ordered.length);
  assert.deepEqual(il.itemListElement.map((e) => e.url), ordered.map((r) => `https://www.getpromonight.com/venues/${r.slug}`));
  assert.deepEqual(il.itemListElement.map((e) => e.position), ordered.map((_, i) => i + 1));
  assert.equal(schemas.some((s) => s['@type'] === 'StadiumOrArena'), false);
  const fp = schemas.find((s) => s['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
  assert.deepEqual(fp.mainEntity.map((q) => q.name), faqs.map((f) => f.question));
});

test('the revalidate PATH_RE accepts /venues/bag-policies', () => {
  const PATH_RE = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/; // mirror of route.ts:39
  assert.ok(PATH_RE.test('/venues/bag-policies'));
});

// ── review-pinned parser cases, on the REAL loader call shape ────────────────

test('REVIEW PIN comerica: the medical-necessity overlay clause never affirms a clutch; the loader two-prose order yields null', () => {
  const overlay = 'Exceptions to the bag policy include bags, wallets and clutches needed due to medical necessity (diaper bags, breast pumps, oxygen, insulin, epi-pens and other medical devices). Authorized diaper and medical bags must be smaller than 16" x 16" x 8"; guests with any medical bag are recommended to use the designated ADA Lane at any gate, where all bags are inspected upon entry.';
  const notes = 'Single-compartment bags, wallets and clutches smaller than 4" x 6" x 1.5" (with or without a handle or strap) are permitted; bags, purses and clutches larger than 4" x 6" x 1.5" are prohibited, including bags for laptops, tablets, iPads, cameras and binoculars.';
  assert.equal(parseClutch([overlay, notes], '4″ × 6″ × 1.5″'), null);
});

test('REVIEW PIN progressive-field: a sized general-cap clutch clause suppresses the chip even when another clause merely affirms', () => {
  const overlay = 'Manufactured diaper bags, medical bags, fanny packs, and small handheld clutches are permitted despite the general bag restrictions.';
  const notes = 'Fans may bring manufactured diaper bags, medical bags, fanny packs, clutches, and small bags not exceeding 16"x16"x8".';
  assert.equal(parseClutch([overlay, notes], '16″ × 16″ × 8″'), null);
});

test('REVIEW PIN nearest-size binding: the clear-bag figure never attaches to the clutch words', () => {
  // camden-yards (real prose): clutch size follows the clear size in ONE clause
  assert.deepEqual(
    parseClutch(['Permitted: a clear plastic bag no larger than 12" x 6" x 12", a 1-gallon plastic freezer bag, or a fanny pack/clutch purse no larger than 5" x 7".'], '12″ × 6″ × 12″'),
    { kind: 'sized', text: 'up to 5″ × 7″' },
  );
  // guaranteed-rate-field (real prose)
  assert.deepEqual(
    parseClutch(['Permitted bags are clear plastic/vinyl/PVC bags not exceeding 12" x 12" x 6", or small non-clear clutch bags measuring 9" x 5" x 2" or smaller.'], '12″ × 12″ × 6″'),
    { kind: 'sized', text: 'up to 9″ × 5″ × 2″' },
  );
  // tropicana-field (real prose)
  assert.deepEqual(
    parseClutch(['Fans may bring one (1) single-compartment clear bag with handles no larger than 12" x 12" x 6" and/or one (1) non-clear small fanny pack or clutch no larger than 5" x 7".'], '12″ × 12″ × 6″'),
    { kind: 'sized', text: 'up to 5″ × 7″' },
  );
  // nationals-park (real prose): the clutch size sits BEFORE the word
  assert.deepEqual(
    parseClutch(['Any bag larger than a 5" x 7" x 0.75" clutch must be clear plastic, vinyl or PVC and may not exceed 16" x 16" x 8".'], '16″ × 16″ × 8″'),
    { kind: 'sized', text: 'up to 5″ × 7″ × 0.75″' },
  );
});

test('REVIEW PIN chip gate: a bare affirmation renders only under a clear-bag requirement', () => {
  const affirmed = { kind: 'affirmed' } as const;
  assert.deepEqual(clutchChipFor('clear-required', affirmed), affirmed);
  assert.equal(clutchChipFor('size-limited', affirmed), null);
  assert.equal(clutchChipFor('check-policy', affirmed), null);
  assert.equal(clutchChipFor('no-bags', affirmed), null);
  const sized = { kind: 'sized', text: 'up to 5″ × 7″' } as const;
  assert.deepEqual(clutchChipFor('size-limited', sized), sized);
  assert.equal(clutchChipFor('clear-required', null), null);
});
