/* WEB6 G2 (site-wide honesty pass), rendered (2026-10-05).
 *  - NHL and NBA titles, the JSON-LD WebPage name and the hero subtitle name
 *    "2026-27" from SPLIT_SEASON_START_YEAR; MLB and NFL titles do not move,
 *    including both title experiments.
 *  - The playoffs heading takes its year from the data.
 *  - After a "haven't announced" status line, the promo list leaves out "No
 *    upcoming ... promos scheduled right now". */
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GameContext } from '@/lib/data';
import type { Game, Promo, Team } from '@/lib/types';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T12:00:00Z') });
const emptyQuery: any = {
  where: () => emptyQuery,
  orderBy: () => emptyQuery,
  limit: () => emptyQuery,
  select: () => emptyQuery,
  doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => emptyQuery }),
  get: async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }),
  count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: { collection: () => emptyQuery, collectionGroup: () => emptyQuery } },
});
mock.module(new URL('../fonts.ts', import.meta.url).href, { namedExports: { archivo: { variable: 'font-archivo' } } });

const TODAY = '2026-10-05';
const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const SPURS = mk('san-antonio-spurs', 'NBA', 'San Antonio', 'Spurs');
const PELICANS = mk('new-orleans-pelicans', 'NBA', 'New Orleans', 'Pelicans');
const WILD = mk('minnesota-wild', 'NHL', 'Minnesota', 'Wild');
const BRAVES = mk('atlanta-braves', 'MLB', 'Atlanta', 'Braves');

const promo = (date: string, title: string, over: Partial<Promo> = {}): Promo => ({
  date, time: '', opponent: 'Visitors', type: 'theme', title, description: '', highlight: false, icon: '', recurring: false, ...over,
});
const game = (id: string, league: string, date: string, home: string, away: string, over: Partial<Game> = {}): Game =>
  ({ id, league, date, gameTime: '', gameTimeTz: '', homeTeamSlug: home, awayTeamSlug: away, venueName: 'Arena', status: 'scheduled', season: 2026, seasonType: 'regular', ...over }) as Game;
const ctx = (g: Game, isHome: boolean, opponentTeam: Team | null = null, promos: Promo[] = []): GameContext =>
  ({ game: g, isHome, opponentTeam, opponentVenue: null, promos }) as GameContext;

async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function teamPage(team: Team, promos: Promo[], gameContexts?: GameContext[]) {
  const { splitPromosByDate, countPromosByType, teamDisplayName } = await import('@/lib/promo-helpers');
  const { resolveClaimMode } = await import('@/lib/season-scope');
  const { RedesignTeamPage } = await import('../RedesignTeamPage');
  const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
  const { upcoming } = splitPromosByDate(promos, TODAY);
  return html(
    <StarredTeamsProvider><RedesignTeamPage team={team} coverage={{ teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never} venue={null} promos={promos}
      upcomingPromos={upcoming} upcomingCounts={countPromosByType(upcoming)} claim={resolveClaimMode(promos, team.league, TODAY)}
      displayName={teamDisplayName(team)} gameContexts={gameContexts} today={TODAY} recurringDeals={[]} playoffsActive={false}
      inPlayoffs={false} playoffPromos={[]} playoffRound="" playoffLastUpdated={null} /></StarredTeamsProvider>,
  );
}


describe('NHL and NBA titles name 2026-27', () => {
  test('subtitle, bare title and meta title', async () => {
    const t = await import('@/lib/title-treatment');
    const DET = mk('detroit-red-wings', 'NHL', 'Detroit', 'Red Wings');
    const KNICKS = mk('new-york-knicks', 'NBA', 'New York', 'Knicks');
    assert.equal(t.teamTitleSubtitle(DET), 'Promos & Giveaways 2026-27');
    assert.equal(t.teamBareTitle(KNICKS, 'New York Knicks'), 'New York Knicks Promos & Giveaways 2026-27');
    assert.equal(t.teamMetaTitle(DET, 'Detroit Red Wings'), 'Detroit Red Wings Promos & Giveaways 2026-27');
  });

  test('MLB and NFL titles are unchanged, both experiment arms included', async () => {
    const t = await import('@/lib/title-treatment');
    assert.equal(t.teamTitleSubtitle({ id: 'not-in-an-experiment', league: 'MLB' }), 'Promos & Giveaways 2026');
    const treated = [...t.TREATMENT_SLUGS][0];
    assert.equal(t.teamTitleSubtitle({ id: treated, league: 'MLB' }), 'Giveaways & Theme Nights 2026');
    const nfl = [...t.NFL_SCHEDULE_TITLE_SLUGS][0];
    assert.equal(t.teamMetaTitle({ id: nfl, league: 'NFL' }, 'X'), 'X 2026 Schedule & Giveaways');
    assert.equal(t.teamMetaTitle({ id: 'some-nfl-control', league: 'NFL' }, 'Y'), 'Y Promos & Giveaways 2026');
    for (const lg of ['MLS', 'WNBA']) assert.equal(t.teamTitleSubtitle({ id: 'z', league: lg }), 'Promos & Giveaways 2026', lg);
  });

  test('the rendered hero and the JSON-LD WebPage name say 2026-27 on NHL', async () => {
    const out = await teamPage(WILD, [promo('2026-11-02', 'Night')]);
    assert.match(text(out), /Promos & Giveaways 2026-27/);
    assert.match(out, /"@type":"WebPage"[^}]*"name":"Minnesota Wild Promos & Giveaways 2026-27"|"name":"Minnesota Wild Promos & Giveaways 2026-27"[^}]*"@type":"WebPage"/);
    assert.doesNotMatch(text(out), /Promos & Giveaways 2026(?!-)/);
  });
});

describe('the playoffs heading year comes from the data', () => {
  test('playoffYear: latest dated promo, else the scan date, else none', async () => {
    const { playoffYear } = await import('@/components/playoff-section');
    assert.equal(playoffYear([{ date: '2027-04-20' }, { date: '2027-05-02' }], '2027-04-18T10:00:00Z'), 2027);
    assert.equal(playoffYear([{ date: null }], '2027-04-18T10:00:00Z'), 2027);
    assert.equal(playoffYear([{ date: null }], null), null);
    // A leftover row from last spring does not name this spring's playoffs.
    assert.equal(playoffYear([{ date: '2026-04-20' }, { date: '2027-04-22' }], null), 2027);
  });

  test('rendered: "2027 NHL Playoffs" from April 2027 promos; no year when none is known', async () => {
    const { PlayoffSection } = await import('@/components/playoff-section');
    const pp = (date: string | null) => ({ teamId: WILD.id, league: 'NHL', round: 'first_round', title: 'Rally Towel', description: '', date, gameInfo: 'vs Stars', type: 'giveaway', recurring: false, recurringDetail: '', highlight: false, isPlayoff: true, teamName: 'Wild', teamAbbr: 'MIN', source: '', createdAt: '', updatedAt: '' }) as never;
    const a = text(await html(<PlayoffSection team={WILD} promos={[pp('2027-04-24')]} round="first_round" lastUpdated={null} variant="light" />));
    assert.match(a, /2027 NHL Playoffs/);
    assert.match(a, /are in the 2027 first round playoffs/);
    assert.doesNotMatch(a, /2026/);
    const b = text(await html(<PlayoffSection team={WILD} promos={[pp(null)]} round="first_round" lastUpdated={null} variant="light" />));
    assert.match(b, /^ ?NHL Playoffs|[^0-9] NHL Playoffs/);
    assert.doesNotMatch(b, /20\d\d NHL Playoffs/);
  });
});

describe('no "No upcoming ... right now" under a "haven\'t announced" line', () => {
  const KNICKS = mk('new-york-knicks', 'NBA', 'New York', 'Knicks');
  const games = [ctx(game('k1', 'nba', '2026-10-21', 'new-york-knicks', 'boston-celtics'), true, null)];
  const lastSeason = [promo('2026-03-14', 'Old Night')];

  test('verified club with only last season: the status line, then the pointer alone', async () => {
    const t = text(await teamPage(KNICKS, lastSeason, games));
    assert.match(t, /The New York Knicks haven't announced 2026-27 promotions yet \(checked October 5\)\./);
    assert.match(t, /See completed 2025-26 promos below\./);
    assert.doesNotMatch(t, /No upcoming New York Knicks promos scheduled right now/);
  });

  test('unverified club: the "hasn\'t recorded" line keeps the sentence', async () => {
    const SIXERS = mk('philadelphia-76ers', 'NBA', 'Philadelphia', '76ers');
    const g2 = [ctx(game('p1', 'nba', '2026-10-21', 'philadelphia-76ers', 'boston-celtics'), true, null)];
    const t = text(await teamPage(SIXERS, lastSeason, g2));
    assert.match(t, /PromoNight hasn't recorded any Philadelphia 76ers 2026-27 promotions yet\./);
    assert.match(t, /No upcoming Philadelphia 76ers promos scheduled right now\. See completed 2025-26 promos below\./);
  });

  test('statusLineSaysNothingAnnounced matches the line exactly', async () => {
    const { scheduleStatusLine, statusLineSaysNothingAnnounced } = await import('@/lib/announcement-status');
    const base = { league: 'NBA', showSchedule: true, seasonResolved: false, teamId: 'new-york-knicks', displayName: 'New York Knicks', today: TODAY };
    for (const o of [base, { ...base, hasTicketPackages: true }, { ...base, hasOtherPromos: true }, { ...base, teamId: 'philadelphia-76ers' }, { ...base, today: '2026-10-30' }, { ...base, seasonResolved: true }]) {
      const line = scheduleStatusLine(o);
      assert.equal(statusLineSaysNothingAnnounced(o), !!line && /haven't announced/.test(line), JSON.stringify(o));
    }
  });
});

describe('soccer jersey nights: the count sentence agrees with its number', () => {
  test('singular when one row is left', () => {
    const src = readFileSync('src/app/promos/soccer-jersey-nights/page.tsx', 'utf8');
    assert.match(src, /and \$\{total\} \$\{total === 1 \? 'is' : 'are'\} on the upcoming calendar/);
  });
});
