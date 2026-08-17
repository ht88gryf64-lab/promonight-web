// The /cfb/rivalries index derivations: display order, the Rivalry Week window
// and the FAQ. The invariant under test is the aggregator plan §4 rule — every
// count is DERIVED from the rows the DOM renders, never hardcoded, and a
// question whose count would be zero is omitted rather than shipped hollow.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderedIndexRows,
  rivalryWeekRows,
  buildRivalryIndexFaqs,
  RIVALRY_WEEK_START,
  RIVALRY_WEEK_END,
  type RivalryIndexRow,
} from '@/lib/cfb/rivalry-index';

const row = (slug: string, date: string | null, extra: Partial<RivalryIndexRow> = {}): RivalryIndexRow => ({
  slug,
  name: slug,
  date,
  matchup: 'A vs B',
  venueName: null,
  trophy: null,
  ...extra,
});

test('orderedIndexRows: dated rows soonest first, undated appended after', () => {
  const out = orderedIndexRows([
    row('late', '2026-11-28'),
    row('dormant-a', null),
    row('early', '2026-09-05'),
    row('mid', '2026-10-17'),
    row('dormant-b', null),
  ]);
  assert.deepEqual(out.map((r) => r.slug), ['early', 'mid', 'late', 'dormant-a', 'dormant-b']);
});

test('rivalryWeekRows: bounds are inclusive on both ends', () => {
  const out = rivalryWeekRows([
    row('start-edge', RIVALRY_WEEK_START),
    row('end-edge', RIVALRY_WEEK_END),
    row('day-before', '2026-11-20'),
    row('day-after', '2026-11-30'),
    row('dormant', null),
    row('mid-window', '2026-11-27'),
  ]);
  assert.deepEqual(out.map((r) => r.slug), ['start-edge', 'mid-window', 'end-edge']);
});

test('rivalryWeekRows: empty input and no-window input both return empty', () => {
  assert.deepEqual(rivalryWeekRows([]), []);
  assert.deepEqual(rivalryWeekRows([row('october', '2026-10-10'), row('dormant', null)]), []);
});

test('FAQ counts derive from the rows, not from constants', () => {
  const rows = [
    row('a', '2026-11-28', { trophy: 'Some Trophy' }),
    row('b', '2026-11-27', { trophy: 'Other Trophy' }),
    row('c', '2026-10-10'),
    row('d', null),
    row('e', null),
  ];
  const faqs = buildRivalryIndexFaqs(rows);
  const all = faqs.map((f) => `${f.question} ${f.answer}`).join('\n');
  // total 5, dated 3, rivalry week 2, trophies 2 — every number in the copy.
  assert.match(faqs[0].answer, /tracks 5 named/);
  assert.match(faqs[0].answer, /3 of them have a scheduled 2026 meeting/);
  assert.match(all, /2 of the 5 rivalries tracked here are played between November 21 and November 29/);
  assert.match(all, /2 of the 5 rivalries listed here play for a named trophy/);
});

test('FAQ omits the Rivalry Week question when no game falls in the window', () => {
  const faqs = buildRivalryIndexFaqs([row('a', '2026-10-10'), row('b', null)]);
  assert.equal(faqs.some((f) => /Rivalry Week/i.test(f.question)), false);
});

test('FAQ omits the trophy question when no row carries a trophy', () => {
  const faqs = buildRivalryIndexFaqs([row('a', '2026-11-28'), row('b', '2026-11-27')]);
  assert.equal(faqs.some((f) => /trophy/i.test(f.question)), false);
});

test('FAQ always includes the kickoff/TV answer and it promises TBA, not a guess', () => {
  const faqs = buildRivalryIndexFaqs([]);
  const kickoff = faqs.find((f) => /kickoff/i.test(f.question));
  assert.ok(kickoff);
  assert.match(kickoff!.answer, /TBA/);
  assert.match(kickoff!.answer, /officially announced/);
});

test('no FAQ copy contains an em dash (house rule for user-facing copy)', () => {
  const rows = [row('a', '2026-11-28', { trophy: 'T' }), row('b', null)];
  for (const f of buildRivalryIndexFaqs(rows)) {
    assert.equal(/—/.test(f.question + f.answer), false);
  }
});
