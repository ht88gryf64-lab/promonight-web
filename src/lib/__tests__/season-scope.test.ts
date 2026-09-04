import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MLB_SEASON_SCOPE_START,
  isSeasonScopeLive,
  resolveSeasonScope,
  seasonClaimSentence,
} from '../season-scope';
import { generateTeamFAQs, type TeamFaqCoverage } from '../promo-helpers';
import type { Promo, Team } from '../types';

const promo = (date: string, over: Partial<Promo> = {}): Promo => ({
  date,
  time: '',
  opponent: '',
  type: 'giveaway',
  title: 'Bobblehead',
  description: '',
  highlight: false,
  icon: '',
  recurring: false,
  ...over,
});

const team = (over: Partial<Team> = {}): Team =>
  ({
    id: 'test-team',
    name: 'Testers',
    city: 'Testville',
    league: 'WNBA',
    sportSlug: 'wnba',
    primaryColor: '#000000',
    ...over,
  }) as Team;

const coverage: TeamFaqCoverage = {
  teamCount: 169,
  leagueList: 'MLB, NBA, NFL, NHL, MLS and WNBA',
  appLeagueList: 'MLB, MLS and NBA',
};

const TODAY = '2026-09-04';

describe('isSeasonScopeLive', () => {
  it('holds MLB until the ctr-diagnostic read date and ships every other league', () => {
    assert.equal(isSeasonScopeLive('MLB', '2026-09-30'), false);
    assert.equal(isSeasonScopeLive('MLB', MLB_SEASON_SCOPE_START), true);
    assert.equal(isSeasonScopeLive('MLB', '2026-10-02'), true);
    for (const league of ['NFL', 'NHL', 'MLS', 'WNBA', 'NBA']) {
      assert.equal(isSeasonScopeLive(league, '2026-09-04'), true, league);
    }
  });
});

describe('resolveSeasonScope', () => {
  it('resolves a single-2026-year archive and splits it', () => {
    const rows = [
      promo('2026-04-10'),
      promo('2026-05-11', { type: 'theme' }),
      promo('2026-12-20'),
    ];
    const scope = resolveSeasonScope(rows, 'WNBA', TODAY);
    assert.ok(scope);
    assert.equal(scope.year, 2026);
    assert.equal(scope.total, 3);
    assert.equal(scope.completedCount, 2);
    assert.equal(scope.upcomingCount, 1);
    assert.equal(scope.counts.giveaway, 2);
    assert.equal(scope.counts.theme, 1);
    // past is most-recent-first, matching the archive render order
    assert.deepEqual(
      scope.past.map((p) => p.date),
      ['2026-05-11', '2026-04-10'],
    );
  });

  it('REFUSES a multi-year archive rather than summing across season boundaries', () => {
    // The Detroit Red Wings shape: a finished 2025-26 season plus the 2026-27
    // season ahead. Summing them describes no season at all.
    const rows = [promo('2025-11-02'), promo('2026-03-14'), promo('2027-01-08')];
    assert.equal(resolveSeasonScope(rows, 'NHL', TODAY), null);
  });

  it('refuses a single-year archive whose year is not the page title year', () => {
    // Four NBA clubs carry only 2025 rows under a page titled 2026.
    assert.equal(resolveSeasonScope([promo('2025-10-04')], 'NBA', TODAY), null);
  });

  it('refuses MLB before the rollout date and resolves it after', () => {
    const rows = [promo('2026-04-01'), promo('2026-09-20')];
    assert.equal(resolveSeasonScope(rows, 'MLB', '2026-09-30'), null);
    assert.ok(resolveSeasonScope(rows, 'MLB', '2026-10-01'));
  });

  it('refuses an empty or wholly dateless archive', () => {
    assert.equal(resolveSeasonScope([], 'WNBA', TODAY), null);
    assert.equal(
      resolveSeasonScope([promo('' as unknown as string)], 'WNBA', TODAY),
      null,
    );
  });

  it('counts purchase-gated giveaways in the total and discloses them', () => {
    const rows = [
      promo('2026-06-01', { title: 'Free Bobblehead' }),
      promo('2026-06-02', {
        title: 'Heritage Jersey',
        description: 'Included with the ticket package.',
      }),
    ];
    const scope = resolveSeasonScope(rows, 'WNBA', TODAY);
    assert.ok(scope);
    assert.equal(scope.counts.giveaway, 2, 'count is broad');
    assert.equal(scope.gatedGiveawayCount, 1);
    assert.equal(
      scope.gatedDisclosure,
      '1 of the 2 giveaways requires a ticket package.',
      'label is precise',
    );
  });

  it('carries no disclosure when nothing is gated', () => {
    const scope = resolveSeasonScope([promo('2026-06-01')], 'WNBA', TODAY);
    assert.equal(scope?.gatedDisclosure, null);
  });
});

describe('seasonClaimSentence', () => {
  const build = (dates: string[]) => resolveSeasonScope(dates.map((d) => promo(d)), 'WNBA', TODAY)!;

  it('states both halves so neither number stands alone', () => {
    assert.equal(
      seasonClaimSentence(build(['2026-04-01', '2026-12-01'])),
      '2 promotions in the 2026 season, 1 still to come',
    );
  });

  it('says all completed when nothing is ahead', () => {
    assert.equal(
      seasonClaimSentence(build(['2026-04-01'])),
      '1 promotion in the 2026 season, all completed',
    );
  });

  it('says all still to come when nothing has happened', () => {
    assert.equal(
      seasonClaimSentence(build(['2026-12-01', '2026-12-02'])),
      '2 promotions in the 2026 season, all still to come',
    );
  });
});

describe('generateTeamFAQs scope labelling', () => {
  const rows = [promo('2026-04-01'), promo('2026-05-01'), promo('2026-12-01')];

  it('names the season and both numbers when the season resolves', () => {
    const scope = resolveSeasonScope(rows, 'WNBA', TODAY)!;
    const upcoming = scope.upcoming;
    const faqs = generateTeamFAQs(
      team(),
      upcoming,
      null,
      { giveaway: 1, theme: 0, food: 0, kids: 0 },
      coverage,
      undefined,
      scope,
    );
    const answer = faqs[0].answer;
    assert.match(answer, /3 promotional events in the 2026 season/);
    assert.match(answer, /1 is still to come/);
    assert.doesNotMatch(
      answer,
      /1 promotional events (?:coming up|in the)/,
      'the upcoming count must never wear the season noun',
    );
  });

  it('drops the season noun entirely on the fallback path', () => {
    const upcoming = [promo('2026-12-01'), promo('2027-01-05')];
    const faqs = generateTeamFAQs(
      team({ league: 'NHL' }),
      upcoming,
      null,
      { giveaway: 2, theme: 0, food: 0, kids: 0 },
      coverage,
      undefined,
      null,
    );
    const answer = faqs[0].answer;
    assert.match(answer, /2 promotional events still to come/);
    assert.doesNotMatch(answer, /season/, 'no season claim without a resolved season');
    // The period comes from the rows, so a New Year crossing is stated honestly.
    assert.match(answer, /between December 2026 and January 2027/);
  });
});
