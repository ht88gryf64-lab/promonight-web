import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MLB_SEASON_SCOPE_START,
  isSeasonComplete,
  isSeasonScopeLive,
  resolveClaimMode,
  resolveSeasonScope,
  seasonClaimSentence,
} from '../season-scope';
import {
  generateTeamFAQs,
  getPromosByType,
  promosInCategory,
  type TeamFaqCoverage,
} from '../promo-helpers';
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

  it('STATE (b): nothing ahead means no forward clause at all', () => {
    // The obvious closer, "all completed", answers an availability question
    // nobody asked and turns a season record into a notice of emptiness. Every
    // MLB page enters this state the day the rollout hold lifts.
    assert.equal(seasonClaimSentence(build(['2026-04-01'])), '1 promotion in the 2026 season');
    assert.equal(
      seasonClaimSentence(build(['2026-04-01', '2026-05-01'])),
      '2 promotions in the 2026 season',
    );
    for (const dates of [['2026-04-01'], ['2026-04-01', '2026-05-01']]) {
      const out = seasonClaimSentence(build(dates));
      for (const banned of ['completed', 'still to come', 'already', 'no ', 'none']) {
        assert.ok(!out.toLowerCase().includes(banned), `"${banned}" leaked into state (b): ${out}`);
      }
    }
  });

  it('isSeasonComplete marks exactly the zero-remaining state', () => {
    assert.equal(isSeasonComplete(build(['2026-04-01'])), true);
    assert.equal(isSeasonComplete(build(['2026-12-01'])), false);
    assert.equal(isSeasonComplete(build(['2026-04-01', '2026-12-01'])), false);
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
      { kind: 'season', scope },
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
      { kind: 'remaining' },
    );
    const answer = faqs[0].answer;
    assert.match(answer, /2 promotional events still to come/);
    assert.doesNotMatch(answer, /season/, 'no season claim without a resolved season');
    // The period comes from the rows, so a New Year crossing is stated honestly.
    assert.match(answer, /between December 2026 and January 2027/);
  });
});

describe('resolveClaimMode', () => {
  const rows = [promo('2026-04-01'), promo('2026-12-01')];

  it('reports held for MLB inside the rollout hold, whatever the rows say', () => {
    assert.deepEqual(resolveClaimMode(rows, 'MLB', '2026-09-30'), { kind: 'held' });
  });

  it('reports season for MLB once the read date passes', () => {
    assert.equal(resolveClaimMode(rows, 'MLB', '2026-10-01').kind, 'season');
  });

  it('reports remaining when the rows cannot support a season claim', () => {
    const multiYear = [promo('2026-12-01'), promo('2027-01-05')];
    assert.deepEqual(resolveClaimMode(multiYear, 'NHL', TODAY), { kind: 'remaining' });
  });

  it('reports season for a resolving non-MLB league today', () => {
    assert.equal(resolveClaimMode(rows, 'WNBA', TODAY).kind, 'season');
  });
});

describe('the hold is total, not partial', () => {
  // The rollout hold exists to protect ctr-diagnostic-sep2026, whose treatment
  // arm is ten MLB team pages. A hold that lets improved prose through still
  // moves the experiment, so 'held' must reproduce the PRE-CHANGE strings.
  const rows = [
    promo('2026-04-01', { type: 'theme' }),
    promo('2026-12-01', { type: 'theme' }),
  ];
  const upcoming = [rows[1]];
  const counts = { giveaway: 0, theme: 1, food: 0, kids: 0 };

  it('held FAQ copy is the pre-change wording, defect included', () => {
    const faqs = generateTeamFAQs(
      team({ league: 'MLB' }), upcoming, null, counts, coverage, undefined, { kind: 'held' },
    );
    const a = faqs[0];
    assert.equal(a.question, 'How many promotional nights do the Testers have in 2026?');
    assert.match(a.answer, /1 promotional events coming up in the 2026 season/);
  });

  it('and the same team ships the new wording once the hold lifts', () => {
    const claim = resolveClaimMode(rows, 'MLB', '2026-10-01');
    const faqs = generateTeamFAQs(
      team({ league: 'MLB' }), upcoming, null, counts, coverage, undefined, claim,
    );
    assert.match(faqs[0].answer, /2 promotional events in the 2026 season/);
    assert.match(faqs[0].question, /in the 2026 season\?$/);
  });

  it('defaults to held, so an un-updated caller ships what it always shipped', () => {
    const withDefault = generateTeamFAQs(team(), upcoming, null, counts, coverage);
    const explicit = generateTeamFAQs(
      team(), upcoming, null, counts, coverage, undefined, { kind: 'held' },
    );
    assert.deepEqual(withDefault, explicit);
  });
});

describe('defects found in adversarial review, pinned', () => {
  const venue = null;
  const counts = (o: Partial<Record<'giveaway' | 'theme' | 'food' | 'kids', number>> = {}) =>
    ({ giveaway: 0, theme: 0, food: 0, kids: 0, ...o });

  it('a count and its list agree about membership, isGiveaway cross-count included', () => {
    // A kids-typed row flagged isGiveaway is counted as a giveaway. If the
    // giveaway LIST used strict type membership it would be empty, and the
    // section would report the category finished while the kids section on the
    // same page listed the very same row as still to come.
    const row = promo('2026-12-01', { type: 'kids', isGiveaway: true, title: 'Kids Backpack' });
    const scope = resolveSeasonScope([row], 'WNBA', TODAY)!;
    assert.equal(scope.counts.giveaway, 1, 'counted as a giveaway');
    assert.equal(scope.counts.kids, 1, 'and still counted as kids');
    assert.equal(promosInCategory(scope.upcoming, 'giveaway').length, 1, 'and LISTED as a giveaway');
    assert.equal(promosInCategory(scope.upcoming, 'kids').length, 1);
    // The strict helper is what disagreed; it is kept for callers that want it.
    assert.equal(getPromosByType(scope.upcoming, 'giveaway').length, 0);
  });

  it('the season guard sees the same rows the counts do', () => {
    // A malformed date must not be counted into a season it was not allowed to
    // push into the multi-year fallback.
    const rows = [promo('2026-05-01'), promo('not-a-date')];
    const scope = resolveSeasonScope(rows, 'WNBA', TODAY)!;
    assert.equal(scope.total, 1, 'the malformed row is excluded from the count');
  });

  it('the best-giveaway answer stamps the promo year, not the page year', () => {
    // 29 of 32 NHL clubs carry rows on both sides of a New Year, and
    // formatDateReadable prints no year, so a 2027 giveaway was being announced
    // as the best giveaway night "in 2026" inside FAQPage schema.
    const jan2027 = promo('2027-01-15', { title: 'Winter Bobblehead' });
    const faqs = generateTeamFAQs(
      team({ league: 'NHL' }), [jan2027], venue, counts({ giveaway: 1 }), coverage,
      undefined, { kind: 'remaining' },
    );
    const best = faqs.find((f) => /best .* giveaway night/.test(f.question))!;
    assert.match(best.question, /in 2027\?$/);
    assert.match(best.answer, /giveaway in 2027 is Winter Bobblehead/);
    assert.doesNotMatch(best.answer, /2026/);
  });

  it('the kids FAQ does not restate its own section H2 with a different number', () => {
    const rows = [
      promo('2026-04-01', { type: 'kids' }),
      promo('2026-05-01', { type: 'kids' }),
      promo('2026-12-01', { type: 'kids' }),
    ];
    const scope = resolveSeasonScope(rows, 'WNBA', TODAY)!;
    const faqs = generateTeamFAQs(
      team(), scope.upcoming, venue, counts({ kids: 1 }), coverage,
      undefined, { kind: 'season', scope },
    );
    const kids = faqs.find((f) => /kids and family events/.test(f.question))!;
    // The number matches the section, which publishes the season count.
    assert.match(kids.answer, /3 kids and family events/);
    assert.match(kids.answer, /1 is still to come/);
    // And the question is no longer byte-identical to the section H2.
    assert.notEqual(kids.question, 'When are Testers kids and family events in 2026?');
  });

  it('never emits "1 promotional events" or a dangling "including ."', () => {
    const scope = resolveSeasonScope([promo('2026-12-01')], 'WNBA', TODAY)!;
    const faqs = generateTeamFAQs(
      team(), scope.upcoming, venue, counts({ giveaway: 1 }), coverage,
      undefined, { kind: 'season', scope },
    );
    assert.match(faqs[0].answer, /have 1 promotional event in the 2026 season/);
    assert.doesNotMatch(faqs[0].answer, /1 promotional events/);
    assert.doesNotMatch(faqs[0].answer, /including \./);
    assert.doesNotMatch(faqs[0].answer, /\s\s/, 'no double space from an omitted clause');
  });

  it('the gating disclosure has a shape for every degenerate count', () => {
    const gated = (n: number, total: number) => {
      const rows = Array.from({ length: total }, (_, i) =>
        promo(`2026-12-${String(i + 1).padStart(2, '0')}`, {
          title: `G${i}`,
          description: i < n ? 'Included with the ticket package.' : '',
        }),
      );
      return resolveSeasonScope(rows, 'WNBA', TODAY)!.gatedDisclosure;
    };
    assert.equal(gated(0, 3), null);
    assert.equal(gated(1, 1), 'The only giveaway that season requires a ticket package.');
    assert.equal(gated(3, 3), 'All 3 giveaways require a ticket package.');
    assert.equal(gated(1, 3), '1 of the 3 giveaways requires a ticket package.');
    assert.equal(gated(2, 3), '2 of the 3 giveaways require a ticket package.');
  });
});

describe('state (b) reads as a record, not an empty page', () => {
  const rows = [promo('2026-04-01'), promo('2026-05-01', { type: 'theme' })];
  const scope = resolveSeasonScope(rows, 'WNBA', TODAY)!;

  it('the FAQ answer states the season and stops', () => {
    const faqs = generateTeamFAQs(
      team(), [], null, { giveaway: 0, theme: 0, food: 0, kids: 0 }, coverage,
      undefined, { kind: 'season', scope },
    );
    const a = faqs[0].answer;
    assert.match(a, /have 2 promotional events in the 2026 season, including 1 giveaway night, 1 theme night\./);
    assert.doesNotMatch(a, /already taken place|still to come|all completed/);
    assert.doesNotMatch(a, /\s\s/, 'the removed clause must not leave a double space');
    assert.doesNotMatch(a, /\.\s*\./, 'nor a doubled period');
  });
});
