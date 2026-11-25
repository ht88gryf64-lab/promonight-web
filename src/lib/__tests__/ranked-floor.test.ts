// THE FLOOR AND THE MINIMUM ROW COUNT OF THE RANKED "BEST" SURFACES
// (2026-11-25): the homepage Best Promos rail and /best-promos.
//
//   - the rail lists giveaways at or above BEST_PROMO_SCORE_FLOOR and nothing
//     else; with none, it returns nothing and HomePageV2 renders no section;
//   - /best-promos leaves the retrospective at exactly
//     RANKED_MIN_UPCOMING_ROWS qualifying rows;
//   - below that, with no ended season, the retrospective is the season in
//     play to date;
//   - /best-promos/bobbleheads is unchanged: one forward row is enough.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PromoWithTeam, ScoredPromoWithTeam } from '../types';
import { BEST_PROMO_SCORE_FLOOR } from '../scoring-weights';

// ── the loader's two reads, replaced; the clock, set per test ──────────────

type Call = { start: string; end: string; limit: number | undefined; gated: boolean; itemType?: string; leagues?: ReadonlySet<string> };
const calls: Call[] = [];
let forwardRows: ScoredPromoWithTeam[] = [];
let pastRows: ScoredPromoWithTeam[] = [];
let finals = new Map<string, string>();

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../data.ts', import.meta.url).href, {
  namedExports: {
    // The real readers sort by score and cut at `limit`; so do these.
    getScoredPromosInDateRange: async (start: string, end: string, limit?: number, eligible?: unknown, leagues?: ReadonlySet<string>) => {
      calls.push({ start, end, limit, gated: !!eligible, leagues });
      return (eligible ? forwardRows : pastRows).slice(0, limit ?? 300);
    },
    getScoredPromosByItemType: async (start: string, end: string, itemType: string, limit?: number, eligible?: unknown, leagues?: ReadonlySet<string>) => {
      calls.push({ start, end, limit, gated: !!eligible, itemType, leagues });
      return (eligible ? forwardRows : pastRows).slice(0, limit ?? 500);
    },
  },
});
mock.module(new URL('../seasons/finals.ts', import.meta.url).href, {
  namedExports: {
    getCurrentSeasonPredicate: async () => () => true,
    getSeasonFinals: async () => finals,
  },
});

const team = (league: string) => ({ id: `${league.toLowerCase()}-club`, league, sportSlug: league.toLowerCase(), city: 'City', name: 'Club' });
let seq = 0;
function row(type: string, score: number, date: string, league = 'MLB'): ScoredPromoWithTeam {
  seq += 1;
  return {
    promoId: `p${seq}`, team: team(league), date, title: `${type} ${score} #${seq}`, type, score,
    scoreBreakdown: { baseType: 40 }, derivedSignals: { itemType: 'generic' }, scoredAt: '',
  } as unknown as ScoredPromoWithTeam;
}
const giveaways = (n: number, score = 80, date = '2027-04-01') => Array.from({ length: n }, () => row('giveaway', score, date));

async function loadAt(today: string, itemType: string | null) {
  calls.length = 0;
  mock.timers.enable({ apis: ['Date'], now: new Date(`${today}T17:00:00Z`) });
  try {
    const { loadRankedRows } = await import('../seasons/ranked-rows');
    return await loadRankedRows(itemType);
  } finally {
    mock.timers.reset();
  }
}

// ── the homepage rail ──────────────────────────────────────────────────────

const always = () => true;

test('rail: nothing passes, nothing is returned', async () => {
  const { pickBestStubPromos } = await import('../../components/redesign/pick-best-stub-promos');
  // The rail of 2026-11-25: three MLS playoff fixtures typed theme, 15 to 18.
  const playoffs = [row('theme', 15, '2026-12-02', 'MLS'), row('theme', 18, '2026-11-27', 'MLS'), row('theme', 18, '2026-12-02', 'MLS')];
  assert.deepEqual(pickBestStubPromos(playoffs as PromoWithTeam[], 8, always), []);
  // Giveaways under the floor do not fill it either.
  assert.deepEqual(pickBestStubPromos([row('giveaway', BEST_PROMO_SCORE_FLOOR - 1, '2027-04-01'), row('giveaway', 40, '2027-04-02')] as PromoWithTeam[], 8, always), []);
  assert.deepEqual(pickBestStubPromos([], 8, always), []);
});

test('rail: a theme row never appears, whatever it scores', async () => {
  const { pickBestStubPromos } = await import('../../components/redesign/pick-best-stub-promos');
  const pool = [
    row('theme', 100, '2027-04-01'), row('theme', 83, '2027-04-01'), row('kids', 95, '2027-04-01'), row('food', 90, '2027-04-01'),
    row('giveaway', 65, '2027-04-03'), row('giveaway', 98, '2027-04-02'), row('giveaway', 64, '2027-04-01'),
  ] as PromoWithTeam[];
  // Two giveaways qualify: under the 10-row minimum, so nothing shows at all.
  assert.deepEqual(pickBestStubPromos(pool, 8, always), []);
  // With nine more qualifying giveaways the rail fills, and still holds no
  // theme, kids or food row, however high those score.
  const full = [...pool, ...giveaways(9, 70)] as PromoWithTeam[];
  const picked = pickBestStubPromos(full, 8, always);
  assert.equal(picked.length, 8);
  assert.deepEqual(picked.map((p) => p.score), [98, 70, 70, 70, 70, 70, 70, 70]);
  assert.ok(picked.every((p) => p.type === 'giveaway' && (p.score as number) >= BEST_PROMO_SCORE_FLOOR));
  // The season gate still applies on top of the floor.
  assert.deepEqual(pickBestStubPromos(full, 8, () => false), []);
});

test('rail: nine qualifying rows show nothing, ten show the rail', async () => {
  const { pickBestStubPromos } = await import('../../components/redesign/pick-best-stub-promos');
  assert.deepEqual(pickBestStubPromos(giveaways(9) as PromoWithTeam[], 8, always), [], 'nine: no rail');
  assert.equal(pickBestStubPromos(giveaways(10) as PromoWithTeam[], 8, always).length, 8, 'ten: the rail, cut to its eight cards');
  assert.equal(pickBestStubPromos(giveaways(10) as PromoWithTeam[], 20, always).length, 10);
  // The count is of QUALIFYING rows: under-floor giveaways and themes do not make up the ten.
  const padded = [...giveaways(9), row('giveaway', BEST_PROMO_SCORE_FLOOR - 1, '2027-04-01'), row('theme', 100, '2027-04-01'), row('kids', 90, '2027-04-01')] as PromoWithTeam[];
  assert.deepEqual(pickBestStubPromos(padded, 8, always), []);
  // And it is taken AFTER the season gate: ten qualifying rows of which one is out of season are nine.
  const tenWithOneOut = [...giveaways(9, 80, '2027-04-01'), row('giveaway', 98, '2028-04-01')] as PromoWithTeam[];
  assert.deepEqual(pickBestStubPromos(tenWithOneOut, 8, (_l, d) => d < '2028-01-01'), []);
  // Gated before the cut: an out-of-season 98 never takes an in-season row's card.
  const eleven = [...giveaways(10, 80, '2027-04-01'), row('giveaway', 98, '2028-04-01')] as PromoWithTeam[];
  const picked = pickBestStubPromos(eleven, 8, (_l, d) => d < '2028-01-01');
  assert.equal(picked.length, 8);
  assert.ok(picked.every((p) => p.score === 80));
});

test('rail: the leagues are named, NBA and NHL are in and an unlisted league is out', async () => {
  const { pickBestStubPromos } = await import('../../components/redesign/pick-best-stub-promos');
  const { PROMO_SCORED_LEAGUES, PROMO_SCORED_LEAGUE_LIST, SCORED_LEAGUES } = await import('../types');
  assert.deepEqual([...PROMO_SCORED_LEAGUE_LIST], ['MLB', 'MLS', 'WNBA', 'NBA', 'NHL']);
  assert.deepEqual([...SCORED_LEAGUES], ['MLB', 'MLS', 'WNBA'], 'the team-score set is unchanged');
  const tenFrom = (league: string) => Array.from({ length: 10 }, () => row('giveaway', 90, '2027-01-15', league)) as PromoWithTeam[];
  for (const league of PROMO_SCORED_LEAGUE_LIST) assert.equal(pickBestStubPromos(tenFrom(league), 8, always).length, 8, league);
  // A score on a row of a league outside the set does not put it on the rail.
  for (const league of ['NFL', 'CFB']) assert.deepEqual(pickBestStubPromos(tenFrom(league), 8, always), [], league);
  assert.equal(PROMO_SCORED_LEAGUES.has('NFL'), false);
  // Mixed: the NFL rows neither show nor count toward the ten.
  assert.deepEqual(pickBestStubPromos([...tenFrom('NFL'), ...tenFrom('NBA').slice(0, 9)], 8, always), []);
  const mixed = pickBestStubPromos([...tenFrom('NFL'), ...tenFrom('NHL'), ...tenFrom('NBA')], 8, always);
  assert.ok(mixed.every((p) => p.team.league === 'NHL' || p.team.league === 'NBA'));
});

test('rail: an empty rail renders no section, heading, lede or link', () => {
  const src = readFileSync(new URL('../../components/redesign/HomePageV2.tsx', import.meta.url), 'utf-8');
  // The whole <section> sits inside the guard, with the lede and the link.
  const m = src.match(/\{bestPromos\.length > 0 && \(\s*<section className="px-6 py-4">([\s\S]*?)<\/section>\s*\)\}/);
  assert.ok(m, 'the Best Promos section is rendered only when the rail has rows');
  assert.match(m![1], /heading="Best Promos"/);
  assert.match(m![1], /lede="The giveaways fans line up early for\."/);
  assert.match(m![1], /seeAllHref="\/best-promos"/);
  assert.equal(src.match(/heading="Best Promos"/g)?.length, 1, 'and there is no second copy outside it');
});

// ── /best-promos: the mode ─────────────────────────────────────────────────

test('rankedMode flips at exactly the minimum', async () => {
  const { rankedMode, RANKED_MIN_UPCOMING_ROWS } = await import('../seasons/ranked-rows');
  assert.equal(RANKED_MIN_UPCOMING_ROWS, 10);
  assert.equal(rankedMode(0), 'retrospective');
  assert.equal(rankedMode(9), 'retrospective');
  assert.equal(rankedMode(10), 'upcoming');
  assert.equal(rankedMode(11), 'upcoming');
  assert.equal(rankedMode(1, 1), 'upcoming', 'the bobblehead page keeps its one-row rule');
  assert.equal(rankedMode(0, 1), 'retrospective');
});

test('/best-promos: 9 qualifying rows stay in the retrospective, 10 leave it', async () => {
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [row('giveaway', 98, '2026-07-04'), row('theme', 45, '2026-06-01')];
  // Rows that must not count: themes of any score, giveaways under the floor.
  const noise = [row('theme', 100, '2027-04-01'), row('theme', 18, '2027-04-01'), row('kids', 90, '2027-04-01'), row('giveaway', 64, '2027-04-01'), row('giveaway', 40, '2027-04-01')];

  forwardRows = [...noise, ...giveaways(9)];
  const nine = await loadAt('2027-02-10', null);
  assert.equal(nine.retrospective, true, '9 qualifying rows (14 forward rows in all): still the retrospective');
  assert.equal(nine.label, 2026);
  assert.deepEqual(nine.promos, pastRows, 'the retrospective rows are the ended season, every type, unfiltered');

  forwardRows = [...noise, ...giveaways(10)];
  const ten = await loadAt('2027-02-10', null);
  assert.equal(ten.retrospective, false, 'the tenth qualifying row flips it');
  assert.equal(ten.promos.length, 10);
  assert.ok(ten.promos.every((p) => p.type === 'giveaway' && p.score >= BEST_PROMO_SCORE_FLOOR), 'upcoming mode lists qualifying giveaways only');
  assert.equal(ten.label, 2027, 'one calendar year: that year');
  // The forward read asks for every promo-scored league; the past read does not.
  const { PROMO_SCORED_LEAGUES } = await import('../types');
  assert.equal(calls.find((c) => c.gated)!.leagues, PROMO_SCORED_LEAGUES);
  forwardRows = giveaways(9);
  await loadAt('2027-02-10', null);
  assert.equal(calls.find((c) => !c.gated)!.leagues, undefined, 'the retrospective stays on the default three leagues');
});

test('/best-promos: upcoming rows that cross New Year are labelled like a season, "2026-27"', async () => {
  const { upcomingLabel } = await import('../seasons/ranked-rows');
  assert.equal(upcomingLabel(['2026-12-01', '2026-11-27']), 2026);
  assert.equal(upcomingLabel(['2027-04-01']), 2027);
  assert.equal(upcomingLabel(['2026-12-01', '2027-01-05', '2027-04-11']), '2026-27');
  assert.equal(upcomingLabel(['2027-01-05', '2026-12-01']), '2026-27', 'order does not matter');
  assert.equal(upcomingLabel(['2099-12-31', '2100-01-01']), '2099-00');
  assert.equal(upcomingLabel([]), '');
  // Through the loader, on the rows of 2026-11-25: NBA and NHL, November to April.
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [row('giveaway', 98, '2026-07-04')];
  forwardRows = [...Array.from({ length: 4 }, () => row('giveaway', 98, '2026-12-01', 'NBA')), ...Array.from({ length: 8 }, () => row('giveaway', 95, '2027-02-12', 'NHL'))];
  const got = await loadAt('2026-11-25', null);
  assert.equal(got.retrospective, false);
  assert.equal(got.label, '2026-27');
  // Before New Year is crossed by any row, the plain year.
  forwardRows = Array.from({ length: 12 }, () => row('giveaway', 98, '2026-12-01', 'NBA'));
  assert.equal((await loadAt('2026-11-25', null)).label, 2026);
  // The page prints the one label in the title, the og title, the H1 and the JSON-LD title.
  const page = readFileSync(new URL('../../app/best-promos/page.tsx', import.meta.url), 'utf-8');
  assert.match(page, /title: `Best Sports Promo Nights of \$\{label\}: Score-Ranked Giveaways`/);
  assert.match(page, /title: `Best Sports Promo Nights of \$\{label\}`/);
  assert.ok((page.match(/BEST SPORTS PROMO NIGHTS OF \{label\}/g)?.length ?? 0) >= 1);
  assert.doesNotMatch(page, /Number\(label\)|label \+ 1/);
});

test('/best-promos: the league copy follows the mode, and the stamp reads the rows', () => {
  const page = readFileSync(new URL('../../app/best-promos/page.tsx', import.meta.url), 'utf-8');
  // No league list is typed into a sentence that upcoming mode prints.
  assert.equal(page.match(/MLB, MLS, and WNBA/g), null, 'no typed league list is left on the page');
  assert.match(page, /across the same leagues, with its own ranked list/);
  assert.doesNotMatch(page, /MLB rescored weekly|MLB year-round, WNBA and MLS in season/);
  // The upcoming list does not promise a 100 at the top (on 2026-11-25 its best row was 98),
  // and its meta description does not promise theme nights, which it cannot list.
  assert.equal(page.match(/ranked below, highest score first/g)?.length, 2);
  assert.doesNotMatch(page, /ranked below from 100 down/);
  assert.match(page, /retrospective \? 'Bobbleheads, jerseys, and theme nights' : 'Bobbleheads, jerseys, and other giveaways'/);
  // One helper names the leagues for both ranked pages.
  const loader = readFileSync(new URL('../seasons/ranked-rows.ts', import.meta.url), 'utf-8');
  assert.match(loader, /retrospective \? RANKED_LEAGUES : PROMO_SCORED_LEAGUE_LIST/);
  const bobble = readFileSync(new URL('../../app/best-promos/bobbleheads/page.tsx', import.meta.url), 'utf-8');
  for (const src of [page, bobble]) assert.match(src, /rankedLeaguesText\(retrospective\)/);
  assert.equal(bobble.match(/MLB, MLS, and WNBA/g), null);
  assert.doesNotMatch(bobble, /MLB rescored weekly|the three leagues/);
  assert.match(bobble, /const latestComputedAt = latestRowScoredAt \|\| latestTeamComputedAt;/);
  // "Scores last computed" comes from the listed rows' scoredAt before any team-score stamp.
  assert.match(page, /const latestComputedAt = latestRowScoredAt \|\| latestTeamComputedAt;/);
  assert.match(page, /promos\.reduce\(\(acc, p\) => \(p\.scoredAt && p\.scoredAt > acc \? p\.scoredAt : acc\), ''\)/);
});

test('league chips: the default three always, NBA and NHL only when the rows hold them', async () => {
  const { leagueFilterOptions, LEAGUE_FILTER_VALUES } = await import('../../components/scoring/league-filter');
  const values = (s?: ReadonlySet<string>) => leagueFilterOptions(s).map((o) => o.value);
  assert.deepEqual([...LEAGUE_FILTER_VALUES], ['All', 'MLB', 'MLS', 'WNBA'], '/team-rankings keeps its closed set');
  assert.deepEqual(values(), ['All', 'MLB', 'MLS', 'WNBA']);
  assert.deepEqual(values(new Set(['MLB'])), ['All', 'MLB', 'MLS', 'WNBA'], 'a list without NBA or NHL shows the chips it always did');
  assert.deepEqual(values(new Set(['NBA', 'NHL'])), ['All', 'MLB', 'MLS', 'WNBA', 'NBA', 'NHL']);
  assert.deepEqual(values(new Set(['NHL', 'MLS'])), ['All', 'MLB', 'MLS', 'WNBA', 'NHL']);
});

test('/best-promos: the floor through the loader, 64 does not count and 65 does', async () => {
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [row('giveaway', 98, '2026-07-04')];
  forwardRows = [...giveaways(9, BEST_PROMO_SCORE_FLOOR), row('giveaway', BEST_PROMO_SCORE_FLOOR - 1, '2027-04-01')];
  assert.equal((await loadAt('2027-02-10', null)).retrospective, true, 'nine at the floor and one a point under: nine qualify');
  forwardRows = giveaways(10, BEST_PROMO_SCORE_FLOOR);
  const atFloor = await loadAt('2027-02-10', null);
  assert.equal(atFloor.retrospective, false, 'ten at exactly the floor qualify');
  assert.equal(atFloor.promos.length, 10);
});

test('/best-promos: the floor is applied before the cap, on an uncapped gated read', async () => {
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [];
  // 320 theme rows outscore the giveaways; a read capped at 300 would return
  // themes alone and the page would wrongly fall back to the retrospective.
  forwardRows = [...Array.from({ length: 320 }, () => row('theme', 83, '2027-04-01')), ...giveaways(12, 70)];
  const got = await loadAt('2027-02-10', null);
  assert.equal(got.retrospective, false);
  assert.equal(got.promos.length, 12);
  const forward = calls.find((c) => c.gated)!;
  assert.equal(forward.limit, Number.MAX_SAFE_INTEGER);
  // And the page still serves at most SERVER_FETCH_CAP rows.
  const { SERVER_FETCH_CAP } = await import('../seasons/ranked-rows');
  forwardRows = giveaways(SERVER_FETCH_CAP + 25);
  assert.equal((await loadAt('2027-02-10', null)).promos.length, SERVER_FETCH_CAP);
});

test('fallback: too few rows and NO ended season, the season in play to date', async () => {
  const { inPlayRange, offSeasonRange, retrospectiveRange } = await import('../seasons/ranked-rows');
  // 2026-10-18: the day the qualifying count first fell under 10. MLB, WNBA
  // and MLS 2026 are all still running and the table holds no earlier season.
  const none = new Map<string, string>();
  assert.equal(offSeasonRange('2026-10-18', none), null, 'nothing has ended');
  // Earliest 2026 lead-in across the scored leagues is MLS (2026-02-21 less 45 days).
  const inPlay = { season: '2026', label: '2026', start: '2026-01-07', end: '2026-10-18' };
  assert.deepEqual(inPlayRange('2026-10-18', none), inPlay);
  assert.deepEqual(retrospectiveRange('2026-10-18', none), inPlay);
  // An ended season wins over the one in play (2026-11-25: MLS still running).
  const real = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  assert.deepEqual(retrospectiveRange('2026-11-25', real), offSeasonRange('2026-11-25', real));
  assert.equal(retrospectiveRange('2026-11-25', real)?.end, '2026-11-25');
  // Between seasons with nothing in play: null from inPlayRange, and the ended season stands.
  assert.equal(inPlayRange('2026-12-25', real), null);
  assert.equal(retrospectiveRange('2026-12-25', real)?.season, '2026');
  // Before the table's first lead-in: nothing at all.
  assert.equal(retrospectiveRange('2025-12-01', none), null);

  // Through the loader: 9 qualifying rows on that day.
  finals = none;
  forwardRows = giveaways(9, 80, '2026-10-25');
  pastRows = [row('giveaway', 98, '2026-05-18'), row('giveaway', 95, '2026-08-01'), row('theme', 30, '2026-04-01')];
  const got = await loadAt('2026-10-18', null);
  assert.equal(got.retrospective, true);
  assert.equal(got.label, 2026, 'under the label of the season in play');
  assert.deepEqual(got.promos, pastRows);
  const past = calls.find((c) => !c.gated)!;
  assert.deepEqual([past.start, past.end], ['2026-01-07', '2026-10-18'], 'lead-in to today');
});

test('/best-promos/bobbleheads: five leagues and giveaways only in upcoming mode, one row is enough, its retrospective as before', async () => {
  const { PROMO_SCORED_LEAGUES } = await import('../types');
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [row('giveaway', 98, '2026-07-04')];
  // One qualifying row is enough (no ten-row minimum on this page), and it
  // may score under the main page's floor: a 60-point bobblehead giveaway lists.
  const lowGiveaway = row('giveaway', 60, '2027-01-15', 'NHL');
  forwardRows = [row('theme', 70, '2027-01-10', 'NHL'), lowGiveaway, row('kids', 90, '2027-01-12', 'NBA')];
  const one = await loadAt('2026-11-25', 'bobblehead');
  assert.equal(one.retrospective, false);
  assert.deepEqual(one.promos, [lowGiveaway], 'a bobblehead named on a theme or kids night is not a bobblehead giveaway');
  assert.equal(calls[0].itemType, 'bobblehead');
  assert.equal(calls[0].leagues, PROMO_SCORED_LEAGUES, 'the forward read names the five promo-scored leagues');
  assert.equal(calls[0].limit, Number.MAX_SAFE_INTEGER, 'cut after the giveaway filter');
  // The label rule is the shared one: rows crossing New Year read "2026-27".
  forwardRows = [row('giveaway', 98, '2026-12-01', 'NBA'), row('giveaway', 95, '2027-02-12', 'NHL')];
  assert.equal((await loadAt('2026-11-25', 'bobblehead')).label, '2026-27');
  // Only non-giveaway rows ahead: nothing to list, so the retrospective.
  forwardRows = [row('theme', 70, '2027-01-10', 'NHL')];
  const none = await loadAt('2026-11-25', 'bobblehead');
  assert.equal(none.retrospective, true);
  assert.deepEqual(none.promos, pastRows);
  assert.equal(calls.find((c) => !c.gated)!.leagues, undefined, 'the retrospective read stays on the default three leagues');
  // Its retrospective range is the ended season or nothing, as before: with
  // no ended season it does NOT take the in-play fallback /best-promos has.
  finals = new Map();
  forwardRows = [];
  pastRows = [row('giveaway', 98, '2026-05-18')];
  const early = await loadAt('2026-10-18', 'bobblehead');
  assert.deepEqual([early.retrospective, early.promos.length, early.label], [true, 0, '']);
  assert.equal(calls.some((c) => !c.gated), false, 'no past read is made');
});
