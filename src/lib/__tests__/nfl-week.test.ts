import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Game, PromoWithTeam, Team } from '../types';
import {
  seasonWeekKey,
  weekLabel,
  gameEtYmd,
  buildWeekBuckets,
  selectWeekContext,
  joinPromosToGames,
  clubRegularSeasonCounts,
} from '../nfl-week';

// The (seasonType, week) invariant and the Tuesday fixed-week rollover, as
// tests rather than conventions. NFL preseason weeks 1-4 collide numerically
// with regular-season weeks 1-4, and 17 live promos sit on preseason games, so
// any path that buckets or counts on `week` alone silently inflates regular
// weeks 2-4. These tests pin the behaviors that prevent that.

function game(over: Partial<Game> & Pick<Game, 'id' | 'date'>): Game {
  return {
    league: 'nfl',
    gameTime: '17:00',
    gameTimeTz: 'America/New_York',
    homeTeamSlug: 'home-club',
    awayTeamSlug: 'away-club',
    venueName: 'Stub Stadium',
    status: 'scheduled',
    seasonType: 'regular',
    week: 1,
    ...over,
  };
}

function promo(teamId: string, date: string, title: string): PromoWithTeam {
  return {
    date,
    time: '',
    opponent: '',
    type: 'theme',
    title,
    description: '',
    highlight: false,
    icon: '',
    recurring: false,
    team: { id: teamId, league: 'NFL' } as Team,
  } as PromoWithTeam;
}

describe('seasonWeekKey / weekLabel', () => {
  test('preseason and regular week 2 produce distinct keys — the collision the pair exists for', () => {
    assert.notEqual(seasonWeekKey('preseason', 2), seasonWeekKey('regular', 2));
  });

  test('labels carry the season type so the container can be honest about preseason', () => {
    assert.equal(weekLabel('preseason', 2), 'Preseason Week 2');
    assert.equal(weekLabel('regular', 5), 'Week 5');
  });
});

describe('gameEtYmd', () => {
  test('a TBD placeholder at a Central venue self-corrects the one-day-early stored date', () => {
    // known-issues entry 14: ESPN's 05:00Z placeholder is midnight ET on the
    // TRUE date; the stored venue-local date lands one day early at
    // non-Eastern venues. wk18 bears-at-vikings stores Sat 2027-01-09 for the
    // real Sun 2027-01-10.
    const etDay = gameEtYmd({ date: '2027-01-09', gameTime: '05:00', gameTimeTz: 'America/Chicago' });
    assert.equal(etDay, '2027-01-10');
  });

  test('an Eastern-venue TBD placeholder is already right and stays right', () => {
    const etDay = gameEtYmd({ date: '2027-01-10', gameTime: '05:00', gameTimeTz: 'America/New_York' });
    assert.equal(etDay, '2027-01-10');
  });

  test('a late Pacific Sunday kickoff lands on ET Monday, still inside a Tue-Mon window', () => {
    // 10:20pm PDT Sunday 2026-10-11 = 05:20Z Monday. Venue-local day Sunday,
    // ET day Monday — a one-day skew the Tuesday boundary never straddles.
    const etDay = gameEtYmd({ date: '2026-10-11', gameTime: '05:20', gameTimeTz: 'America/Los_Angeles' });
    assert.equal(etDay, '2026-10-12');
  });

  test('falls back to the stored date when time or venue tz is missing', () => {
    assert.equal(gameEtYmd({ date: '2026-09-09', gameTime: '', gameTimeTz: '' }), '2026-09-09');
    assert.equal(gameEtYmd({ date: '2026-09-09', gameTime: '17:00', gameTimeTz: 'UTC' }), '2026-09-09');
  });

  test('a malformed doc degrades to the stored date instead of throwing — one bad doc must not crash the hub', () => {
    // Intl throws RangeError on a non-IANA tz string and on a non-numeric
    // time; both must be swallowed into the stored-date fallback.
    assert.equal(
      gameEtYmd({ date: '2026-09-09', gameTime: '17:00', gameTimeTz: 'America/Los Angeles' }),
      '2026-09-09',
    );
    assert.equal(
      gameEtYmd({ date: '2026-09-09', gameTime: 'TBD', gameTimeTz: 'America/Chicago' }),
      '2026-09-09',
    );
  });
});

describe('buildWeekBuckets — the pair invariant', () => {
  test('preseason week 2 and regular week 2 form two buckets, never one', () => {
    const buckets = buildWeekBuckets([
      game({ id: 'pre', date: '2026-08-13', seasonType: 'preseason', week: 2 }),
      game({ id: 'reg', date: '2026-09-17', seasonType: 'regular', week: 2 }),
    ]);
    assert.equal(buckets.length, 2);
    assert.deepEqual(
      buckets.map((b) => b.key),
      ['preseason:2', 'regular:2'],
    );
    assert.equal(buckets[0].games[0].id, 'pre');
    assert.equal(buckets[1].games[0].id, 'reg');
  });

  test('windows are Tuesday-anchored: Thu-Mon games share one Tue..Mon window', () => {
    // Regular wk2 2026: Thu Sep 17 through Mon Sep 21. Tuesday anchor Sep 15.
    const [bucket] = buildWeekBuckets([
      game({ id: 'thu', date: '2026-09-17', week: 2 }),
      game({ id: 'sun', date: '2026-09-20', week: 2 }),
      game({ id: 'mon', date: '2026-09-21', week: 2 }),
    ]);
    assert.equal(bucket.windowStartYmd, '2026-09-15');
    assert.equal(bucket.windowEndYmd, '2026-09-21');
  });

  test('the Wednesday season opener stays inside week 1, not a week of its own', () => {
    // wk1 2026 opens Wed Sep 9 (Kickoff game) before the Thu/Sun/Mon slate.
    const [bucket] = buildWeekBuckets([
      game({ id: 'opener', date: '2026-09-09', week: 1 }),
      game({ id: 'sun', date: '2026-09-13', week: 1 }),
      game({ id: 'mnf', date: '2026-09-14', week: 1 }),
    ]);
    assert.equal(bucket.windowStartYmd, '2026-09-08');
    assert.equal(bucket.windowEndYmd, '2026-09-14');
  });

  test('the wk18 window is anchored on the corrected ET day, not the early stored date', () => {
    // All-TBD wk18: 8 non-Eastern docs store Sat 2027-01-09 for the real Sun
    // 2027-01-10. Anchoring on stored-date min would start the window a week
    // early relative to a corrected Eastern doc; gameEtYmd re-derives Sunday
    // for both, so the window is Tue 2027-01-05 .. Mon 2027-01-11.
    const [bucket] = buildWeekBuckets([
      game({ id: 'ct', date: '2027-01-09', gameTime: '05:00', gameTimeTz: 'America/Chicago', week: 18, timeTbd: true }),
      game({ id: 'et', date: '2027-01-10', gameTime: '05:00', gameTimeTz: 'America/New_York', week: 18, timeTbd: true }),
    ]);
    assert.equal(bucket.windowStartYmd, '2027-01-05');
    assert.equal(bucket.windowEndYmd, '2027-01-11');
  });

  test('bucket games sort by kickoff instant: SNF renders after the afternoon slate, not first', () => {
    // SNF at 8:20pm ET stores gameTime '00:20' (Monday UTC) under the Sunday
    // stored date; a raw string sort would put it above the 1pm games.
    const [bucket] = buildWeekBuckets([
      game({ id: 'snf', date: '2026-10-11', gameTime: '00:20', week: 5 }),
      game({ id: 'early', date: '2026-10-11', gameTime: '17:00', week: 5 }),
      game({ id: 'late', date: '2026-10-11', gameTime: '20:25', week: 5 }),
      game({ id: 'tnf', date: '2026-10-08', gameTime: '00:15', week: 5 }),
    ]);
    assert.deepEqual(
      bucket.games.map((g) => g.id),
      ['tnf', 'early', 'late', 'snf'],
    );
  });

  test('preseason, regular, and postseason week 1 are a three-way split, not one bucket', () => {
    const buckets = buildWeekBuckets([
      game({ id: 'pre', date: '2026-08-06', seasonType: 'preseason', week: 1 }),
      game({ id: 'reg', date: '2026-09-13', seasonType: 'regular', week: 1 }),
      game({ id: 'post', date: '2027-01-16', seasonType: 'postseason', week: 1 }),
    ]);
    assert.deepEqual(
      buckets.map((b) => b.key),
      ['preseason:1', 'regular:1', 'postseason:1'],
    );
    assert.equal(buckets[2].label, 'Postseason Week 1');
  });

  test('empty input yields no buckets and an offseason context — the pre-ingestion state', () => {
    assert.deepEqual(buildWeekBuckets([]), []);
    assert.deepEqual(selectWeekContext([], '2026-08-06'), { mode: 'offseason', bucket: null });
  });

  test('games without week or seasonType (every MLB doc) are skipped, not mis-bucketed', () => {
    const buckets = buildWeekBuckets([
      game({ id: 'mlb', date: '2026-09-17', seasonType: undefined, week: undefined }),
      game({ id: 'reg', date: '2026-09-17', week: 2 }),
    ]);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].games.length, 1);
    assert.equal(buckets[0].games[0].id, 'reg');
  });
});

describe('selectWeekContext — Tuesday rollover', () => {
  const buckets = buildWeekBuckets([
    game({ id: 'pre4', date: '2026-08-27', seasonType: 'preseason', week: 4 }),
    game({ id: 'wk1', date: '2026-09-10', week: 1 }),
    game({ id: 'wk1-mnf', date: '2026-09-14', week: 1 }),
    game({ id: 'wk2', date: '2026-09-17', week: 2 }),
  ]);

  test('Monday Night Football is still its own week — Monday selects week 1', () => {
    const ctx = selectWeekContext(buckets, '2026-09-14');
    assert.equal(ctx.mode, 'current');
    assert.equal(ctx.bucket?.key, 'regular:1');
  });

  test('the very next day, Tuesday, rolls to week 2', () => {
    const ctx = selectWeekContext(buckets, '2026-09-15');
    assert.equal(ctx.mode, 'current');
    assert.equal(ctx.bucket?.key, 'regular:2');
  });

  test('the empty Labor-Day gap week falls back to next-up on regular week 1', () => {
    // Preseason wk4 window ends Mon 2026-08-31; regular wk1 starts Tue
    // 2026-09-08. The Tuesday in between belongs to no bucket.
    const ctx = selectWeekContext(buckets, '2026-09-02');
    assert.equal(ctx.mode, 'next-up');
    assert.equal(ctx.bucket?.key, 'regular:1');
  });

  test('a preseason bucket is selectable and labeled as preseason', () => {
    const ctx = selectWeekContext(buckets, '2026-08-27');
    assert.equal(ctx.mode, 'current');
    assert.equal(ctx.bucket?.key, 'preseason:4');
    assert.equal(ctx.bucket?.label, 'Preseason Week 4');
  });

  test('past the last bucket is offseason, not a stale week', () => {
    const ctx = selectWeekContext(buckets, '2027-03-01');
    assert.equal(ctx.mode, 'offseason');
    assert.equal(ctx.bucket, null);
  });
});

describe('joinPromosToGames', () => {
  test('joins on (home team, date) and surfaces spine drift instead of dropping it', () => {
    const games = [game({ id: 'g1', date: '2026-09-17', homeTeamSlug: 'chicago-bears', week: 2 })];
    const joined = joinPromosToGames(games, [
      promo('chicago-bears', '2026-09-17', 'Bobblehead Night'),
      promo('chicago-bears', '2026-09-17', 'Theme Night'),
      promo('chicago-bears', '2026-09-24', 'Wrong Week'),
      promo('seattle-seahawks', '2026-09-17', 'Wrong Club'),
    ]);
    assert.equal(joined.byGameId['g1'].length, 2);
    assert.deepEqual(
      joined.unmatched.map((p) => p.title),
      ['Wrong Week', 'Wrong Club'],
    );
  });

  test('a phantom twin sharing (home team, date) attaches promos to the FIRST game, deterministically', () => {
    // Impossible in a real schedule; possible after a re-ingest strands a
    // duplicate (known-issues entry 14). First-wins keeps the attachment
    // stable regardless of how the twin sorts relative to the original.
    const games = [
      game({ id: 'real', date: '2026-12-26', homeTeamSlug: 'minnesota-vikings', week: 16 }),
      game({ id: 'phantom', date: '2026-12-26', homeTeamSlug: 'minnesota-vikings', week: 16 }),
    ];
    const joined = joinPromosToGames(games, [promo('minnesota-vikings', '2026-12-26', 'Holiday Night')]);
    assert.deepEqual(Object.keys(joined.byGameId), ['real']);
    assert.equal(joined.unmatched.length, 0);
  });
});

describe('clubRegularSeasonCounts — quantitative surfaces stay regular-season-only', () => {
  test('a preseason promo joins a preseason game and is excluded from every count', () => {
    // The live shape: bears carry 19 promos of which 2 sit on preseason home
    // games. The card must say 17, and 9 home games — never 19 or 12.
    const games = [
      game({ id: 'pre', date: '2026-08-15', homeTeamSlug: 'chicago-bears', seasonType: 'preseason', week: 2 }),
      game({ id: 'reg1', date: '2026-09-17', homeTeamSlug: 'chicago-bears', week: 2 }),
      game({ id: 'reg2', date: '2026-12-25', homeTeamSlug: 'chicago-bears', week: 16 }),
    ];
    const counts = clubRegularSeasonCounts(
      games,
      [
        promo('chicago-bears', '2026-08-15', 'Kids Game'),
        promo('chicago-bears', '2026-09-17', 'Bobblehead Night'),
        promo('chicago-bears', '2026-12-25', 'Holiday Giveaway'),
      ],
      '2026-10-01',
    );
    const bears = counts['chicago-bears'];
    assert.equal(bears.homeGames, 2);
    assert.equal(bears.homeGamesRemaining, 1);
    assert.equal(bears.promos, 2);
    assert.equal(bears.promosRemaining, 1);
  });

  test('a one-day-early TBD doc still counts as remaining on its true game day', () => {
    // wk18 bears-at-vikings stores Sat 2027-01-09 (placeholder-derived) for
    // the real Sun 2027-01-10. On Sunday, before kickoff, the stored-date
    // comparison would already have dropped it from every remaining count.
    const tbd = game({
      id: 'wk18',
      date: '2027-01-09',
      gameTime: '05:00',
      gameTimeTz: 'America/Chicago',
      homeTeamSlug: 'minnesota-vikings',
      week: 18,
      timeTbd: true,
    });
    const counts = clubRegularSeasonCounts(
      [tbd],
      [promo('minnesota-vikings', '2027-01-09', 'Finale Giveaway')],
      '2027-01-10',
    );
    assert.equal(counts['minnesota-vikings'].homeGamesRemaining, 1);
    assert.equal(counts['minnesota-vikings'].promosRemaining, 1);
  });

  test('a club with games but no promos still gets a row — the 19 schedule-only clubs', () => {
    const counts = clubRegularSeasonCounts(
      [game({ id: 'g', date: '2026-09-20', homeTeamSlug: 'green-bay-packers', week: 2 })],
      [],
      '2026-08-06',
    );
    assert.deepEqual(counts['green-bay-packers'], {
      homeGames: 1,
      homeGamesRemaining: 1,
      promos: 0,
      promosRemaining: 0,
    });
  });
});
