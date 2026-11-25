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

type Call = { start: string; end: string; limit: number | undefined; gated: boolean; itemType?: string };
const calls: Call[] = [];
let forwardRows: ScoredPromoWithTeam[] = [];
let pastRows: ScoredPromoWithTeam[] = [];
let finals = new Map<string, string>();

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../data.ts', import.meta.url).href, {
  namedExports: {
    // The real readers sort by score and cut at `limit`; so do these.
    getScoredPromosInDateRange: async (start: string, end: string, limit?: number, eligible?: unknown) => {
      calls.push({ start, end, limit, gated: !!eligible });
      return (eligible ? forwardRows : pastRows).slice(0, limit ?? 300);
    },
    getScoredPromosByItemType: async (start: string, end: string, itemType: string, limit?: number, eligible?: unknown) => {
      calls.push({ start, end, limit, gated: !!eligible, itemType });
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
  const picked = pickBestStubPromos(pool, 8, always);
  assert.deepEqual(picked.map((p) => [p.type, p.score]), [['giveaway', 98], ['giveaway', 65]]);
  assert.ok(picked.every((p) => p.type === 'giveaway' && (p.score as number) >= BEST_PROMO_SCORE_FLOOR));
  // The season gate still applies on top of the floor.
  assert.deepEqual(pickBestStubPromos(pool, 8, () => false), []);
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
  assert.equal(ten.label, 2027, 'the year of the earliest row shown');
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

test('/best-promos/bobbleheads is unchanged: one forward row is enough, and no floor is applied', async () => {
  finals = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);
  pastRows = [row('giveaway', 98, '2026-07-04')];
  forwardRows = [row('theme', 45, '2027-04-01')];
  const one = await loadAt('2027-02-10', 'bobblehead');
  assert.equal(one.retrospective, false);
  assert.deepEqual(one.promos, forwardRows, 'the row is passed through as before');
  assert.equal(calls[0].itemType, 'bobblehead');
  assert.equal(calls[0].limit, 500);
  forwardRows = [];
  assert.equal((await loadAt('2027-02-10', 'bobblehead')).retrospective, true);
  // Its retrospective range is the ended season or nothing, as before: with
  // no ended season it does NOT take the in-play fallback /best-promos has.
  finals = new Map();
  pastRows = [row('giveaway', 98, '2026-05-18')];
  const early = await loadAt('2026-10-18', 'bobblehead');
  assert.deepEqual([early.retrospective, early.promos.length, early.label], [true, 0, '']);
  assert.equal(calls.some((c) => !c.gated), false, 'no past read is made');
});
