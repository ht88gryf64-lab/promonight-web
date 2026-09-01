import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonSpan,
  completedHeading,
  completedSubline,
  scheduledPeriodPhrase,
} from '../season-label';

// These labels replaced two independent `const SEASON_YEAR = 2026` literals.
// The constant was not clock-derived, which was deliberate and right, but it
// asserted that a season is a calendar year, which is false for NHL, NBA and
// NFL and for any page whose archive crosses a New Year.
//
// The single-year assertions are the load-bearing ones: 30 MLB and 15 WNBA team
// pages must render byte-identical strings, so these pin the old output exactly.

describe('seasonSpan', () => {
  test('a single calendar year does not span', () => {
    const s = seasonSpan(['2026-04-09', '2026-08-22'])!;
    assert.deepEqual(s.years, [2026]);
    assert.equal(s.spansYears, false);
    assert.equal(s.yearLabel, '2026');
  });

  test('two calendar years span, and the label names both ends', () => {
    const s = seasonSpan(['2025-11-07', '2026-04-09'])!;
    assert.deepEqual(s.years, [2025, 2026]);
    assert.equal(s.spansYears, true);
    assert.equal(s.yearLabel, '2025 to 2026');
    assert.equal(s.monthRangeLabel, 'November 2025 to April 2026');
  });

  test('the month range is built from the string, never from Date', () => {
    // `new Date('2026-04-09')` is UTC midnight and renders as April 8 in every
    // negative-offset zone, which would put the wrong month on the label for
    // any span starting on the first of a month.
    const s = seasonSpan(['2026-04-01', '2026-09-30'])!;
    assert.equal(s.monthRangeLabel, 'April 2026 to September 2026');
  });

  test('one month yields no month range, so the label does not repeat itself', () => {
    assert.equal(seasonSpan(['2026-04-09', '2026-04-22'])!.monthRangeLabel, null);
  });

  test('an empty or malformed set is null, not a guessed year', () => {
    assert.equal(seasonSpan([]), null);
    assert.equal(seasonSpan(['', 'TBD', 'nope']), null);
  });

  test('malformed dates are dropped without taking the valid ones with them', () => {
    const s = seasonSpan(['2026-04-09', 'TBD', ''])!;
    assert.deepEqual(s.years, [2026]);
  });
});

describe('completedHeading and completedSubline', () => {
  test('single year is byte-identical to the old SEASON_YEAR output', () => {
    const s = seasonSpan(['2026-04-09', '2026-08-22']);
    assert.equal(completedHeading(s), 'COMPLETED 2026 PROMOS');
    assert.equal(completedSubline(74, s), '74 completed events this season');
    assert.equal(completedSubline(1, s), '1 completed event this season');
  });

  test('a multi-year archive names its span and stops calling itself one season', () => {
    const s = seasonSpan(['2025-11-07', '2026-04-09']);
    assert.equal(completedHeading(s), 'COMPLETED 2025 TO 2026 PROMOS');
    assert.equal(completedSubline(30, s), '30 completed events, November 2025 to April 2026');
    assert.ok(!completedSubline(30, s).includes('this season'));
  });

  test('the predicate is the data, not the league: an MLS page that crosses a year gets the span label', () => {
    // houston-dynamo carries 13 rows from the 2025 MLS season. A league
    // allowlist would have missed it, which is why there is no league argument.
    const s = seasonSpan(['2025-09-20', '2026-08-01']);
    assert.equal(completedHeading(s), 'COMPLETED 2025 TO 2026 PROMOS');
  });
});

describe('scheduledPeriodPhrase', () => {
  test('single year is byte-identical to the old `in ${SEASON_YEAR}`', () => {
    assert.equal(scheduledPeriodPhrase(seasonSpan(['2026-04-09', '2026-08-22'])), 'in 2026');
  });

  test('Detroit: 2026-10-02 to 2027-04-09 stops claiming 2026', () => {
    const phrase = scheduledPeriodPhrase(seasonSpan(['2026-10-02', '2027-04-09']));
    assert.equal(phrase, 'between October 2026 and April 2027');
    assert.ok(!phrase.includes('in 2026'));
  });

  test('an empty set yields an empty phrase rather than a fabricated year', () => {
    assert.equal(scheduledPeriodPhrase(null), '');
  });
});
