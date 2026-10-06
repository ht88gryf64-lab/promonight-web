// Honest season labels, league by league (WEB6, 2026-10-05).
//
// RULINGS THESE TESTS HOLD
//  - NHL and NBA: a season spans two calendar years and is named "2026-27".
//    One calendar year is never their season.
//  - The archive of past promos on NHL and NBA reads "LAST SEASON (2025-26)"
//    for last season, and "this season" only over the current season's rows.
//  - In no league does "this season" sit over completed events from an
//    earlier season.
//  - Headline counts, the "All N promotions on record" line and the FAQ count
//    only the season they name.
//  - MLB, NFL, MLS and WNBA output is unchanged on every shape production
//    serves today (every archive there is the current calendar year).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveGroups,
  completedHeading,
  completedSubline,
  currentSeasonLabel,
  isSplitSeasonLeague,
  seasonSpan,
  splitSeasonLabel,
  splitSeasonStartYear,
  SPLIT_SEASON_START_YEAR,
} from '../season-label';
import { resolveClaimMode, resolveSeasonScope, seasonClaimSentence } from '../season-scope';
import { generateTeamFAQs } from '../promo-helpers';
import type { Promo, Team } from '../types';

const TODAY = '2026-10-05';
const promo = (date: string, over: Partial<Promo> = {}): Promo => ({
  date,
  time: '',
  opponent: 'Visitors',
  type: 'theme',
  title: `Night ${date}`,
  description: '',
  highlight: false,
  icon: '',
  recurring: false,
  ...over,
});

describe('the split-season model', () => {
  test('NHL and NBA only, in any case', () => {
    for (const l of ['NHL', 'NBA', 'nhl', 'nba']) assert.equal(isSplitSeasonLeague(l), true, l);
    for (const l of ['MLB', 'NFL', 'MLS', 'WNBA', 'CFB', '', 'mlb']) assert.equal(isSplitSeasonLeague(l), false, l);
    assert.equal(isSplitSeasonLeague(undefined), false);
  });

  test('the year boundary: June 30 is the old season, July 1 the new one', () => {
    assert.equal(splitSeasonStartYear('2026-06-30'), 2025);
    assert.equal(splitSeasonStartYear('2026-07-01'), 2026);
    assert.equal(splitSeasonStartYear('2026-12-31'), 2026);
    assert.equal(splitSeasonStartYear('2027-01-01'), 2026, 'New Year does not change the season');
    assert.equal(splitSeasonStartYear('2027-04-10'), 2026);
    assert.equal(splitSeasonStartYear('2026-04-29'), 2025, 'the Heat shape: April 2026 is 2025-26');
    assert.equal(splitSeasonStartYear('2026-13-01'), null);
    assert.equal(splitSeasonStartYear('not a date'), null);
  });

  test('labels', () => {
    assert.equal(splitSeasonLabel(2026), '2026-27');
    assert.equal(splitSeasonLabel(2025), '2025-26');
    assert.equal(splitSeasonLabel(2099), '2099-00');
    assert.equal(currentSeasonLabel('NHL'), '2026-27');
    assert.equal(currentSeasonLabel('NBA'), '2026-27');
    assert.equal(currentSeasonLabel('MLB'), '2026');
    assert.equal(currentSeasonLabel('NFL'), '2026');
  });
});

describe('season scope by league', () => {
  test('NHL: a 2026-27 season straddling New Year is ONE season, counted alone', () => {
    const rows = [promo('2025-11-02'), promo('2026-03-14'), promo('2026-10-02'), promo('2026-12-31'), promo('2027-01-01'), promo('2027-04-10')];
    const scope = resolveSeasonScope(rows, 'NHL', TODAY)!;
    assert.equal(scope.label, '2026-27');
    assert.equal(scope.year, 2026);
    assert.equal(scope.total, 4, 'the two 2025-26 rows are not counted');
    assert.equal(scope.completedCount, 1, 'the Oct 2 row is this season, completed');
    assert.equal(scope.upcomingCount, 3);
    assert.equal(seasonClaimSentence(scope), '4 promotions in the 2026-27 season, 3 still to come');
  });

  test('NBA: rows from Jan to Apr 2026 only (Heat, Raptors, Wizards) are no season claim at all', () => {
    const heat = [promo('2026-04-22'), promo('2026-04-29')];
    assert.equal(resolveSeasonScope(heat, 'NBA', TODAY), null);
    assert.deepEqual(resolveClaimMode(heat, 'NBA', TODAY), { kind: 'remaining' });
  });

  test('NBA: a club with 2026-27 rows and last season in the archive', () => {
    const rows = [promo('2025-12-10'), promo('2026-03-03'), promo('2026-10-24'), promo('2027-02-01')];
    const scope = resolveSeasonScope(rows, 'NBA', TODAY)!;
    assert.equal(scope.label, '2026-27');
    assert.equal(scope.total, 2);
  });

  test('MLB, WNBA, MLS: a 2026 calendar-year season resolves with the plain label', () => {
    const rows = [promo('2026-04-01'), promo('2026-09-20')];
    for (const l of ['MLB', 'WNBA', 'MLS']) {
      const scope = resolveSeasonScope(rows, l, TODAY)!;
      assert.equal(scope.label, '2026', l);
      assert.equal(String(scope.year), scope.label, `${l}: the label is the year, so the copy cannot move`);
      assert.equal(seasonClaimSentence(scope), '2 promotions in the 2026 season');
    }
  });

  test('NFL: unchanged, a calendar-year league here (its single-year rows resolve, a crossing archive falls back)', () => {
    assert.equal(resolveSeasonScope([promo('2026-09-13'), promo('2026-12-20')], 'NFL', TODAY)!.label, '2026');
    assert.equal(resolveSeasonScope([promo('2026-09-13'), promo('2027-01-03')], 'NFL', TODAY), null);
  });
});

describe('archive headings', () => {
  test('NHL/NBA: current season first, then LAST SEASON (2025-26), then older seasons by label', () => {
    const dates = ['2026-10-04', '2026-10-02', '2026-04-11', '2025-11-01', '2025-04-05'];
    const g = archiveGroups(dates);
    assert.deepEqual(g.map((x) => x.heading), ['COMPLETED 2026-27 PROMOS', 'LAST SEASON (2025-26)', '2024-25 SEASON']);
    assert.deepEqual(g.map((x) => x.subline), [
      '2 completed events this season',
      '2 completed events, November 2025 to April 2026',
      '1 completed event',
    ]);
    assert.deepEqual(g.map((x) => x.indexes), [[0, 1], [2, 3], [4]], 'input order kept inside a season');
  });

  test('NHL/NBA: "this season" never sits over a past season', () => {
    const g = archiveGroups(['2026-04-29', '2026-04-22', '2025-10-30']);
    assert.equal(g.length, 1);
    assert.equal(g[0].heading, 'LAST SEASON (2025-26)');
    assert.ok(!g[0].subline.includes('this season'));
    for (const x of g) if (!x.isCurrent) assert.ok(!x.subline.includes('this season'));
  });

  test('the current season only, mid-season: the existing wording for the named season', () => {
    const g = archiveGroups(['2026-10-04']);
    assert.deepEqual(g.map((x) => [x.heading, x.subline]), [['COMPLETED 2026-27 PROMOS', '1 completed event this season']]);
  });

  test('calendar-year leagues: the current-year archive is unchanged, byte for byte', () => {
    const s = seasonSpan(['2026-04-09', '2026-09-27'])!;
    assert.equal(completedHeading(s), 'COMPLETED 2026 PROMOS');
    assert.equal(completedSubline(74, s), '74 completed events this season');
    assert.equal(completedSubline(1, s), '1 completed event this season');
  });

  test('calendar-year leagues: an archive of an EARLIER single year no longer says "this season"', () => {
    const s = seasonSpan(['2025-04-09', '2025-09-27'])!;
    assert.equal(completedHeading(s), 'COMPLETED 2025 PROMOS');
    assert.equal(completedSubline(12, s), '12 completed events, April 2025 to September 2025');
    const one = seasonSpan(['2025-08-01'])!;
    assert.equal(completedSubline(1, one), '1 completed event');
  });
});

describe('FAQ counts only the season it names', () => {
  const team = { id: 'detroit-red-wings', league: 'NHL', city: 'Detroit', name: 'Red Wings', abbreviation: 'DET', sportSlug: 'nhl', primaryColor: 0, secondaryColor: 0, division: 'Atlantic' } as unknown as Team;
  const coverage = { teamCount: 169, leagueList: 'MLB, NBA, NFL, NHL, MLS, and WNBA', appLeagueList: 'MLB, NBA, NHL, and MLS' } as never;

  test('NHL: the count answer names 2026-27 and counts its rows only', () => {
    const rows = [promo('2026-03-14', { type: 'giveaway' }), promo('2026-10-08', { type: 'theme' }), promo('2027-01-08', { type: 'kids', title: 'Kids Day' })];
    const upcoming = rows.filter((p) => p.date >= TODAY);
    const claim = resolveClaimMode(rows, 'NHL', TODAY);
    const faqs = generateTeamFAQs(team, upcoming, null, { giveaway: 0, theme: 1, food: 0, kids: 1 }, coverage, undefined, claim);
    const count = faqs.find((f) => /How many promotional nights/.test(f.question))!;
    assert.equal(count.question, 'How many promotional nights do the Red Wings have in the 2026-27 season?');
    assert.match(count.answer, /have 2 promotional events in the 2026-27 season/);
    const kids = faqs.find((f) => /kids and family events/.test(f.question))!;
    assert.equal(kids.question, 'When are Red Wings kids and family events in the 2026-27 season?');
    for (const f of faqs) assert.doesNotMatch(`${f.question} ${f.answer}`, /\b2026 season\b/, f.question);
  });

  test('NBA, last season only: no season count is published at all', () => {
    const heat = { ...team, id: 'miami-heat', league: 'NBA', name: 'Heat', city: 'Miami', sportSlug: 'nba' } as unknown as Team;
    const rows = [promo('2026-04-22'), promo('2026-04-29')];
    const claim = resolveClaimMode(rows, 'NBA', TODAY);
    const faqs = generateTeamFAQs(heat, [], null, { giveaway: 0, theme: 0, food: 0, kids: 0 }, coverage, undefined, claim);
    for (const f of faqs) assert.doesNotMatch(`${f.question} ${f.answer}`, /2026 season|2 theme nights|promotional events in the/, f.question);
  });
});

describe('the NHL/NBA season constant is current (known-issues 69)', () => {
  // Reads the REAL clock on purpose: this is the alarm for the July bump. Under
  // `npm run test:future` the Date global is shifted a year ahead, which would
  // fail it a year early; performance.timeOrigin + performance.now() is the
  // unshifted wall clock, so the test can tell and skips itself there.
  const wall = performance.timeOrigin + performance.now();
  const shifted = Math.abs(Date.now() - wall) > 86_400_000;
  test('fails from June 1 of the year the season ends: bump SPLIT_SEASON_START_YEAR', { skip: shifted ? 'clock shifted (test:future); this guard reads the real date' : false }, () => {
    const due = Date.UTC(SPLIT_SEASON_START_YEAR + 1, 5, 1);
    assert.ok(
      wall < due,
      `SPLIT_SEASON_START_YEAR is ${SPLIT_SEASON_START_YEAR} and the ${splitSeasonLabel(SPLIT_SEASON_START_YEAR)} season ends this summer: bump it before July 1 (docs/known-issues.md entry 69)`,
    );
  });
});
