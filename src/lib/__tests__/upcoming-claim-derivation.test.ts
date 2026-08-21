import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countPromosByType,
  generateTeamFAQs,
  isUpcomingPromo,
  splitPromosByDate,
} from '../promo-helpers';
import type { Promo, Team, Venue } from '../types';

// The rule under test: a count that reaches DOM, schema, or FAQ text is a CLAIM,
// and a claim may only describe promos a visitor can still attend.
//
// The bug these lock down shipped on 137 of 144 populated team pages. Counts were
// derived from the all-time promo array while the promo list alone filtered by
// date, so a club whose season had finished rendered a hero advertising promos
// and a list directly beneath it saying none were scheduled. The same numbers
// reached FAQPage structured data, which asserted a finished season in the
// present tense and named a "most anticipated" giveaway that had already passed.

const TODAY = '2026-08-21';

function promo(date: string, type: Promo['type'], title: string, extra: Partial<Promo> = {}): Promo {
  return {
    date,
    type,
    title,
    description: '',
    opponent: '',
    icon: '',
    highlight: false,
    ...extra,
  } as Promo;
}

const TEAM = { id: 'boston-bruins', city: 'Boston', name: 'Bruins', league: 'NHL' } as Team;
const VENUE = { name: 'TD Garden', address: '100 Legends Way, Boston, MA' } as Venue;

// A club whose season has finished: a real archive, nothing ahead.
const PAST_ONLY: Promo[] = [
  promo('2026-01-15', 'giveaway', 'Zdeno Chara Bobblehead'),
  promo('2026-03-07', 'theme', 'Women In Sports Night'),
  promo('2026-04-03', 'kids', 'Kids Backpack Giveaway'),
  promo('2026-02-10', 'food', 'Dollar Dog Night'),
];

// A club mid-season: both populations non-empty.
const MIXED: Promo[] = [
  ...PAST_ONLY,
  promo('2026-10-04', 'giveaway', 'Opening Night Puck'),
  promo('2026-11-11', 'theme', 'Military Appreciation Night'),
];

test('splitPromosByDate is the single predicate and agrees with isUpcomingPromo', () => {
  const { upcoming, past } = splitPromosByDate(MIXED, TODAY);
  assert.equal(upcoming.length, 2);
  assert.equal(past.length, 4);
  for (const p of upcoming) assert.ok(isUpcomingPromo(p, TODAY));
  for (const p of past) assert.ok(!isUpcomingPromo(p, TODAY));
  // past comes back most-recent-first, the order the archive renders in
  assert.equal(past[0].date, '2026-04-03');
});

test('a finished season yields zero upcoming counts while the archive is still countable', () => {
  const { upcoming, past } = splitPromosByDate(PAST_ONLY, TODAY);
  const upcomingCounts = countPromosByType(upcoming);
  const allTimeCounts = countPromosByType(PAST_ONLY);

  // What the hero, chips and FAQ may claim: nothing.
  assert.deepEqual(upcomingCounts, { giveaway: 0, theme: 0, kids: 0, food: 0 });
  // What a surface labelled COMPLETED may describe: the real archive.
  assert.deepEqual(allTimeCounts, { giveaway: 1, theme: 1, kids: 1, food: 1 });
  assert.equal(past.length, 4);
});

test('the isGiveaway cross-count survives, and only on the population it is given', () => {
  const kidsGate = promo('2026-10-04', 'kids', 'Kids Cap Giveaway', { isGiveaway: true });
  const counts = countPromosByType([kidsGate]);
  assert.equal(counts.kids, 1, 'stays in the kids list');
  assert.equal(counts.giveaway, 1, 'and is counted as the gate giveaway it is');

  // The same promo in the past contributes to neither upcoming bucket.
  const pastGate = promo('2026-01-04', 'kids', 'Kids Cap Giveaway', { isGiveaway: true });
  const { upcoming } = splitPromosByDate([pastGate], TODAY);
  assert.deepEqual(countPromosByType(upcoming), { giveaway: 0, theme: 0, kids: 0, food: 0 });
});

test('FAQ emits no promo claim at all for a finished season', () => {
  const { upcoming } = splitPromosByDate(PAST_ONLY, TODAY);
  const faqs = generateTeamFAQs(TEAM, upcoming, VENUE, countPromosByType(upcoming), 169);
  const joined = faqs.map((f) => `${f.question} ${f.answer}`).join(' ');

  // The four count-bearing slots must not appear.
  assert.ok(!/promotional events coming up/.test(joined), 'no remaining-count answer');
  assert.ok(!/most anticipated/.test(joined), 'no best-giveaway answer about a past event');
  assert.ok(!/kids and family event/.test(joined), 'no kids answer');
  assert.ok(!/current schedule reflects/.test(joined), 'no schedule-size answer');

  // And specifically: no past promo may be named anywhere in the output.
  for (const p of PAST_ONLY) {
    assert.ok(!joined.includes(p.title), `must not name the past promo ${p.title}`);
  }

  // The evergreen slots still ship, so the page keeps a real FAQ.
  assert.ok(faqs.length > 0, 'evergreen FAQ answers still emit');
});

test('FAQ counts and names describe only the upcoming half mid-season', () => {
  const { upcoming } = splitPromosByDate(MIXED, TODAY);
  const faqs = generateTeamFAQs(TEAM, upcoming, VENUE, countPromosByType(upcoming), 169);
  const joined = faqs.map((f) => `${f.question} ${f.answer}`).join(' ');

  assert.ok(/2 promotional events coming up/.test(joined), 'counts the upcoming half, not all six');
  assert.ok(joined.includes('Opening Night Puck'), 'names an upcoming giveaway');
  assert.ok(!joined.includes('Zdeno Chara Bobblehead'), 'never names the passed giveaway');
});

test('passing the all-time array would reintroduce the bug, which is why the split is the caller contract', () => {
  // Documents the failure mode rather than permitting it: this is what the old
  // call site did, and it is why the parameter is named upcomingPromos.
  const faqs = generateTeamFAQs(TEAM, PAST_ONLY, VENUE, countPromosByType(PAST_ONLY), 169);
  const joined = faqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert.ok(
    /most anticipated/.test(joined) && joined.includes('Zdeno Chara Bobblehead'),
    'all-time input still produces the false claim, so callers must split first',
  );
});

test('a dateless promo belongs to neither population and never crashes the sort', () => {
  // Recurring deals and the date-in-image clubs store date=null while the type
  // says string. This threw TypeError on null.localeCompare during a real
  // production build, so it is locked down here rather than rediscovered.
  const dateless = { date: null, type: 'food', title: 'Dollar Dog Every Tuesday' } as unknown as Promo;
  const { upcoming, past } = splitPromosByDate([...MIXED, dateless], TODAY);

  assert.ok(!upcoming.some((p) => p.title === dateless.title), 'not claimable as upcoming');
  assert.ok(!past.some((p) => p.title === dateless.title), 'not part of the dated archive');
  assert.equal(upcoming.length + past.length, MIXED.length, 'the dated promos are unaffected');
  assert.deepEqual(countPromosByType(upcoming), { giveaway: 1, theme: 1, kids: 0, food: 0 });
});
