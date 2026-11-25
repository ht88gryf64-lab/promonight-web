/* A TEAM PAGE THAT NAMES NEXT SEASON EARLY, RENDERED (2026-11 fix round).
 * The Giants on 2026-11-25: every upcoming row is a 2027 row, so the page
 * names 2027, reads as a partial announcement, keeps its completed 2026 list
 * under its own heading, and opens its calendar on the first promo's month.
 * The Twins (nothing ahead) are the control and name 2026. */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { GameContext } from '@/lib/data';
import type { Game, Promo, Team } from '@/lib/types';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-25T17:00:00Z') });
const emptyQuery: any = {
  where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, select: () => emptyQuery,
  doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => emptyQuery }),
  get: async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }),
  count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: { collection: () => emptyQuery, collectionGroup: () => emptyQuery } },
});
mock.module(new URL('../fonts.ts', import.meta.url).href, { namedExports: { archivo: { variable: 'font-archivo' } } });

const TODAY = '2026-11-25';
const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const GIANTS = mk('san-francisco-giants', 'MLB', 'San Francisco', 'Giants');
const TWINS = mk('minnesota-twins', 'MLB', 'Minnesota', 'Twins');
const promo = (date: string, title: string, over: Partial<Promo> = {}): Promo => ({
  date, time: '', opponent: 'Visitors', type: 'giveaway', title, description: '', highlight: false, icon: '', recurring: false, ...over,
});
const game = (id: string, date: string, home: string): Game =>
  ({ id, league: 'MLB', date, gameTime: '', gameTimeTz: '', homeTeamSlug: home, awayTeamSlug: 'visitors', venueName: 'Park', status: 'completed', season: 2026, seasonType: 'regular' }) as Game;
const ctx = (g: Game): GameContext => ({ game: g, isHome: true, opponentTeam: null, opponentVenue: null, promos: [] }) as GameContext;

// 20 completed 2026 rows, and for the Giants 16 rows of 2027 (enough for the patterns block).
const done = Array.from({ length: 20 }, (_, i) => promo(`2026-0${4 + (i % 6)}-${String(10 + i).padStart(2, '0')}`, `2026 Night ${i + 1}`, { type: i % 2 ? 'theme' : 'giveaway' }));
const ahead = Array.from({ length: 16 }, (_, i) => promo(`2027-0${3 + (i % 3)}-${String(10 + i).padStart(2, '0')}`, `2027 Giveaway ${i + 1}`));
const games2026 = Array.from({ length: 12 }, (_, i) => ctx(game(`g${i}`, `2026-0${4 + (i % 6)}-${String(10 + i).padStart(2, '0')}`, 'x')));

async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function teamPage(team: Team, promos: Promo[]) {
  const { splitPromosByDate, countPromosByType, teamDisplayName } = await import('@/lib/promo-helpers');
  const { resolveClaimMode } = await import('@/lib/season-scope');
  const { RedesignTeamPage } = await import('../RedesignTeamPage');
  const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
  const { upcoming } = splitPromosByDate(promos, TODAY);
  const claim = resolveClaimMode(promos, team.league, TODAY);
  const h = await html(
    <StarredTeamsProvider><RedesignTeamPage team={team} coverage={{ teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never} venue={null} promos={promos}
      upcomingPromos={upcoming} upcomingCounts={countPromosByType(upcoming)} claim={claim}
      displayName={teamDisplayName(team)} gameContexts={games2026} today={TODAY} recurringDeals={[]} playoffsActive={false}
      inPlayoffs={false} playoffPromos={[]} playoffRound="" playoffLastUpdated={null} /></StarredTeamsProvider>,
  );
  return { h, t: text(h), claim };
}

test('FLIPPED (Giants): 2027 in the hero and the list, a partial announcement, the 2026 list under its own heading', async () => {
  const { h, t, claim } = await teamPage(GIANTS, [...done, ...ahead]);
  assert.equal(claim.labelDay, '2027-02-07', 'the label day is the 2027 lead-in');
  assert.match(t, /Giveaways 2027/, 'hero subhead');
  assert.match(t, /16 promotions announced so far for the 2027 season/, 'hero count');
  assert.match(h, /<h2[^>]*>2027 SEASON PROMOS<\/h2>/);
  assert.match(t, /16 events announced so far for the 2027 season/);
  assert.match(h, /<h3[^>]*>COMPLETED 2026 PROMOS<\/h3>/);
  assert.match(t, /20 completed events/);
  // Not a season total: no games tile, no per-game ratio, no share of home dates, no "full schedule".
  assert.doesNotMatch(t, /\d+ Games\b/);
  assert.doesNotMatch(t, /per home game|% of home dates|full schedule below/);
  assert.doesNotMatch(t, /16 promotions in the 2027 season/);
  assert.match(t, /have announced 16 promotional events so far for the 2027 season/);
  // No 2026 claim over the upcoming rows, and no 2027 claim over the completed ones.
  assert.doesNotMatch(t, /UPCOMING PROMOS|2026 SEASON PROMOS|COMPLETED 2027/);
  // The calendar opens on March 2027 (the first upcoming promo), not November 2026.
  assert.match(t, /March 2027/);
  assert.doesNotMatch(t, /November 2026/);
});

test('CONTROL (Twins): nothing ahead, so 2026 everywhere and none of the early wording', async () => {
  const { h, t, claim } = await teamPage(TWINS, done);
  assert.equal(claim.labelDay, undefined);
  assert.match(t, /Giveaways 2026/);
  assert.match(t, /20 promotions in the 2026 season/);
  assert.doesNotMatch(t, /2027|announced so far/);
  assert.match(h, /<h2[^>]*>2026 SEASON PROMOS<\/h2>/);
});

test('one stray 2026 row ahead keeps the page on 2026', async () => {
  const { t, claim } = await teamPage(GIANTS, [...done, promo('2026-12-05', 'Winter Fan Fest'), ...ahead]);
  assert.equal(claim.labelDay, undefined);
  assert.doesNotMatch(t, /2027 SEASON PROMOS|announced so far for the 2027 season/);
});
