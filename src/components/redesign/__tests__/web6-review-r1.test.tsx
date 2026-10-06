/* WEB6 review round 1 fixes, held by tests (2026-10-05).
 *
 *  HIGH  NHL and NBA name their season from SPLIT_SEASON_START_YEAR, never from
 *        the MLB-paced TITLE_SEASON_YEAR, which is bumped mid-NHL/NBA-season.
 *  MED   Neutral-site NHL/NBA games say where they are and offer no parking or
 *        hotels for either club's arena.
 *  MED   The NHL/NBA Games tile says "Scheduled games"; MLB and NFL keep "Games".
 *  MED   The schedule list and Games tile take one NHL/NBA season, regular
 *        season only, while the calendar keeps preseason games (a promo can sit
 *        on one).
 *  MED   "THE FULL SEASON" never heads an NHL/NBA list while games remain.
 *  MED   The meta description names "2026-27" on NHL and NBA.
 *  LOW   An archive row whose date cannot be placed in a season is kept. */
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

describe('HIGH: the NHL/NBA season is its own constant', () => {
  test('SPLIT_SEASON_START_YEAR is a literal 2026, not derived from TITLE_SEASON_YEAR', async () => {
    const src = readFileSync('src/lib/season-label.ts', 'utf8');
    assert.match(src, /export const SPLIT_SEASON_START_YEAR = 2026;/);
  });

  test('every split-season path reads SPLIT_SEASON_START_YEAR, none reads TITLE_SEASON_YEAR', () => {
    const label = readFileSync('src/lib/season-label.ts', 'utf8');
    const scope = readFileSync('src/lib/season-scope.ts', 'utf8');
    const status = readFileSync('src/lib/announcement-status.ts', 'utf8');
    const fallback = readFileSync('src/components/zero-promo-fallback.tsx', 'utf8');
    const months = readFileSync('src/lib/schedule-months.ts', 'utf8');
    assert.match(label, /isSplitSeasonLeague\(league\) \? splitSeasonLabel\(SPLIT_SEASON_START_YEAR\)/);
    assert.match(label, /const isCurrent = startYear === SPLIT_SEASON_START_YEAR;/);
    assert.match(label, /: startYear === SPLIT_SEASON_START_YEAR - 1/);
    assert.match(scope, /splitSeasonStartYear\(p\.date\) === SPLIT_SEASON_START_YEAR\)/);
    assert.match(scope, /buildScope\(inSeason, SPLIT_SEASON_START_YEAR, splitSeasonLabel\(SPLIT_SEASON_START_YEAR\), today\)/);
    assert.match(status, /splitSeasonLabel\(SPLIT_SEASON_START_YEAR\)/);
    assert.doesNotMatch(status, /TITLE_SEASON_YEAR\b(?! names)/);
    assert.match(fallback, /isSplitSeasonLeague\(team\.league\) \? splitSeasonLabel\(SPLIT_SEASON_START_YEAR\)/);
    assert.match(months, /splitSeasonStartYear\(c\.game\.date\) === SPLIT_SEASON_START_YEAR/);
    const archive = label.slice(label.indexOf('export function archiveGroups'));
    assert.doesNotMatch(archive, /TITLE_SEASON_YEAR/);
    const scopeSplit = scope.slice(scope.indexOf('if (isSplitSeasonLeague(league)) {'), scope.indexOf('const span = seasonSpan'));
    assert.doesNotMatch(scopeSplit, /TITLE_SEASON_YEAR/);
  });
});

describe('MED: neutral-site NHL/NBA games', () => {
  test('the expand names the venue and offers no arena parking or hotels', async () => {
    const { GameExpand } = await import('../GameExpand');
    const paris = game('nba-2027-01-14-pelicans-at-spurs', 'nba', '2027-01-14', 'san-antonio-spurs', 'new-orleans-pelicans', { venueName: 'Accor Arena', neutralSite: true });
    for (const [team, isHome, opp] of [[SPURS, true, PELICANS], [PELICANS, false, SPURS]] as const) {
      const t = text(await html(<GameExpand dateStr="2027-01-14" contexts={[ctx(paris, isHome, opp)]} team={team} teamName={team.name} />));
      assert.match(t, /Neutral site · Accor Arena/, team.id);
      assert.doesNotMatch(t, /Home game|At (?!Accor)/, team.id);
      assert.doesNotMatch(t, /parking|hotel/i, `${team.id}: no arena parking or hotels`);
    }
  });

  test('control: an ordinary away game does offer parking, so the absence above means something', async () => {
    const { GameExpand } = await import('../GameExpand');
    const away = game('nba-2027-01-20-pelicans-at-spurs', 'nba', '2027-01-20', 'san-antonio-spurs', 'new-orleans-pelicans');
    const t = text(await html(<GameExpand dateStr="2027-01-20" contexts={[ctx(away, false, SPURS)]} team={PELICANS} teamName={PELICANS.name} />));
    assert.match(t, /parking/i);
  });

  test('the schedule row carries the location', async () => {
    const { ScheduleBlock } = await import('../ScheduleBlock');
    const games = [
      ctx(game('a', 'nba', '2027-01-14', 'san-antonio-spurs', 'new-orleans-pelicans', { venueName: 'Accor Arena', neutralSite: true }), true, PELICANS),
      ctx(game('b', 'nba', '2027-01-20', 'san-antonio-spurs', 'new-orleans-pelicans'), true, PELICANS),
    ];
    const t = text(await html(<ScheduleBlock contexts={games} team={SPURS} teamName="San Antonio Spurs" today={TODAY} />));
    assert.match(t, /Neutral site, Accor Arena/);
    assert.equal(t.split('Neutral site').length - 1, 1, 'only the neutral game');
  });
});

describe('the promo slot carries no empty child on a page without packages', () => {
  test('the order-[40] weave item holds exactly one child (no null slot in the RSC payload)', async () => {
    const { RedesignTeamPage } = await import('../RedesignTeamPage');
    const { splitPromosByDate, countPromosByType } = await import('@/lib/promo-helpers');
    const { resolveClaimMode } = await import('@/lib/season-scope');
    const promos = [promo('2026-11-10', 'Educators Night')];
    const { upcoming } = splitPromosByDate(promos, TODAY);
    const tree = RedesignTeamPage({ team: SPURS, coverage: { teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never, venue: null, promos,
      upcomingPromos: upcoming, upcomingCounts: countPromosByType(upcoming), claim: resolveClaimMode(promos, 'NBA', TODAY), displayName: 'San Antonio Spurs',
      today: TODAY, recurringDeals: [], playoffsActive: false, inPlayoffs: false, playoffPromos: [], playoffRound: '', playoffLastUpdated: null });
    const found: any[] = [];
    const walk = (n: any) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object' || !n.props) return;
      if (n.props.className === 'rd-weave-item order-[40]') found.push(n);
      walk(n.props.children);
    };
    walk(tree);
    assert.equal(found.length, 1);
    assert.ok(!Array.isArray(found[0].props.children), 'one child, not an array with a null in it');
  });
});

describe('MED: the Games tile and the schedule population', () => {
  const nba = [
    ctx(game('pre', 'nba', '2026-10-08', 'san-antonio-spurs', 'new-orleans-pelicans', { seasonType: 'preseason' }), true, PELICANS),
    ctx(game('r1', 'nba', '2026-10-23', 'san-antonio-spurs', 'new-orleans-pelicans'), true, PELICANS),
    ctx(game('r2', 'nba', '2027-04-10', 'new-orleans-pelicans', 'san-antonio-spurs'), false, PELICANS),
    ctx(game('next', 'nba', '2027-10-22', 'san-antonio-spurs', 'new-orleans-pelicans', { season: 2027 }), true, PELICANS),
  ];

  test('regularSeasonContexts: NHL/NBA preseason and another season out, MLB untouched', async () => {
    const { regularSeasonContexts } = await import('@/lib/schedule-months');
    assert.deepEqual(regularSeasonContexts(nba, TODAY).map((c) => c.game.id), ['r1', 'r2']);
    const mlb = [ctx(game('m', 'mlb', '2026-09-01', 'atlanta-braves', 'x', { seasonType: undefined, season: undefined }), true)];
    assert.equal(regularSeasonContexts(mlb, TODAY).length, 1);
  });

  test('NBA hero: "2 Scheduled games" (the regular season of the named season only)', async () => {
    const t = text(await teamPage(SPURS, [], nba));
    assert.match(t, /2 Scheduled games/);
    assert.doesNotMatch(t, /\d+ Games\b/);
  });

  test('MLB hero keeps "Games"', async () => {
    const mlb = [ctx(game('m1', 'mlb', '2026-09-01', 'atlanta-braves', 'x', { seasonType: undefined, season: undefined }), true)];
    const t = text(await teamPage(BRAVES, [], mlb));
    assert.match(t, /1 Games/);
    assert.doesNotMatch(t, /Scheduled games/);
  });

  test('a promo on a preseason date keeps its calendar cell', async () => {
    const pride = promo('2026-10-08', 'Pride Night');
    const withPromo = nba.map((c) => (c.game.id === 'pre' ? { ...c, promos: [pride] } : c));
    const out = await teamPage(SPURS, [pride], withPromo);
    assert.match(text(out), /Pride Night/);
    const { readFileSync: rf } = await import('node:fs');
    assert.match(rf('src/lib/data.ts', 'utf8'), /\.filter\(\(g\) => isRegularSeasonGame\(g\) \|\| \(keepPreseason && g\.seasonType === 'preseason'\)\)/);
  });
});

describe('MED: "THE FULL SEASON" waits for the last game', () => {
  test('NHL: every 2026-27 promo past but games ahead: "Coming up", no full-season claim', async () => {
    const { PromoList } = await import('@/components/promo-list');
    const promos = [promo('2026-10-02', 'Opening Night')];
    const games = [ctx(game('g', 'nhl', '2026-10-12', 'minnesota-wild', 'x'), true)];
    const render = (gc?: GameContext[]) =>
      html(<PromoList promos={promos} teamSlug={WILD.id} teamName="Minnesota Wild" league="NHL" sport="nhl" variant="light" showAppPitch={false} seasonScoped scopeLive team={WILD} gameContexts={gc} />);
    const ahead = text(await render(games));
    assert.match(ahead, /Coming up UPCOMING PROMOS/);
    assert.doesNotMatch(ahead, /THE FULL SEASON|SEASON PROMOS|on record for the/i);
    assert.match(ahead, /No upcoming Minnesota Wild promos scheduled right now\. See completed 2026-27 promos below\./);
    // No game left: the season-complete wording returns.
    const over = text(await render([ctx(game('g', 'nhl', '2026-10-01', 'minnesota-wild', 'x'), true)]));
    assert.match(over, /2026-27 SEASON PROMOS/);
  });
});

describe('MED: the meta description names 2026-27 on NHL and NBA', () => {
  test('fallback and closer use the season word; MLB keeps the number', () => {
    const src = readFileSync('src/app/[sport]/[team]/page.tsx', 'utf8');
    assert.match(src, /const seasonWord: string \| number = isSplitSeasonLeague\(team\.league\) \? currentSeasonLabel\(team\.league\) : year;/);
    assert.equal(src.match(/\$\{displayName\} \$\{seasonWord\} promotional schedule/g)?.length, 2);
    assert.match(src, /const closer = ` See the full \$\{seasonWord\} schedule at PromoNight\.`;/);
    assert.doesNotMatch(src, /\$\{displayName\} \$\{year\} promotional schedule/);
  });
});

describe('LOW: an archive row with an unplaceable date is kept', () => {
  test('archiveGroups puts it in a last group of its own', async () => {
    const { archiveGroups } = await import('@/lib/season-label');
    const g = archiveGroups(['2026-10-02', '2026-1-05', '2026-04-11']);
    assert.deepEqual(g.map((x) => [x.heading, x.indexes]), [
      ['COMPLETED 2026-27 PROMOS', [0]],
      ['LAST SEASON (2025-26)', [2]],
      ['OTHER COMPLETED PROMOS', [1]],
    ]);
    assert.equal(g[2].subline, '1 completed event');
  });
});

/* ---- Review round 2 ---- */

describe('round 2: the status line beside ticket packages', () => {
  test('a verified club whose page lists packages gets the safe sentence, on the page', async () => {
    const { RedesignTeamPage } = await import('../RedesignTeamPage');
    const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
    const KNICKS = mk('new-york-knicks', 'NBA', 'New York', 'Knicks');
    const games = [ctx(game('k1', 'nba', '2026-10-21', 'new-york-knicks', 'boston-celtics'), true, null)];
    const pk = [promo('2026-11-02', 'Knicks Hoodie Package')];
    const out = text(await html(
      <StarredTeamsProvider><RedesignTeamPage team={KNICKS} coverage={{ teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never} venue={null} promos={[]}
        upcomingPromos={[]} upcomingCounts={{ giveaway: 0, theme: 0, food: 0, kids: 0 }} claim={{ kind: 'remaining' }} displayName="New York Knicks"
        gameContexts={games} today={TODAY} recurringDeals={[]} playoffsActive={false} inPlayoffs={false} playoffPromos={[]} playoffRound=""
        playoffLastUpdated={null} ticketPackages={pk} /></StarredTeamsProvider>,
    ));
    assert.match(out, /Ticket packages \(1\)/);
    assert.doesNotMatch(out, /haven't announced/);
    assert.match(out, /PromoNight hasn't recorded any New York Knicks 2026-27 promotions yet\./);
  });
});

describe('round 2: /teams counts what the team page counts', () => {
  test('the /teams upcoming count goes through the same split', () => {
    const src = readFileSync('src/app/teams/page.tsx', 'utf8');
    assert.match(src, /const \{ promos \} = partitionTicketPackages\(await getTeamPromos\(t\.id\), isTicketPackagePromo, t\.league\);\n\s+promoCounts\[t\.id\] = promos\.filter/);
  });
});

describe('round 2: no rivals block on NHL or NBA', () => {
  test('NHL/NBA with game contexts render no "Around the division"; the gate is in the source', async () => {
    const DET = mk('detroit-red-wings', 'NHL', 'Detroit', 'Red Wings');
    const CHI = { ...mk('chicago-blackhawks', 'NHL', 'Chicago', 'Blackhawks'), division: 'Test' } as Team;
    const games = [ctx(game('d1', 'nhl', '2026-10-21', 'detroit-red-wings', 'chicago-blackhawks'), true, CHI)];
    const out = await teamPage(DET, [promo('2026-11-02', 'Night')], games);
    assert.doesNotMatch(text(out), /Around the division/i);
    assert.match(readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8'), /const rivals = isSplitSeasonLeague\(team\.league\) \? \[\] : getDivisionRivals\(team, gameContexts\);/);
  });
});

describe('round 2: "still playing" looks at the named season only', () => {
  test('a 2027-28 game ahead does not hold the 2026-27 full-season heading off', async () => {
    const { PromoList } = await import('@/components/promo-list');
    const render = (gc: GameContext[]) =>
      html(<PromoList promos={[promo('2026-10-02', 'Opening Night')]} teamSlug={WILD.id} teamName="Minnesota Wild" league="NHL" sport="nhl" variant="light" showAppPitch={false} seasonScoped scopeLive team={WILD} gameContexts={gc} />);
    const next = text(await render([ctx(game('n', 'nhl', '2027-10-12', 'minnesota-wild', 'x', { season: 2027 }), true)]));
    assert.match(next, /2026-27 SEASON PROMOS/);
  });
});

/* ---- Review round 3 ---- */

describe('round 3: no status line beside playoff promos or every-game deals', () => {
  test('scheduleStatusLine is null when the page shows other promotions', async () => {
    const { scheduleStatusLine } = await import('@/lib/announcement-status');
    const base = { league: 'NHL', showSchedule: true, seasonResolved: false, teamId: 'toronto-maple-leafs', displayName: 'Toronto Maple Leafs', today: TODAY };
    assert.ok(scheduleStatusLine(base));
    assert.equal(scheduleStatusLine({ ...base, hasOtherPromos: true }), null);
    assert.match(readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8'), /hasOtherPromos: \(inPlayoffs && playoffPromos\.length > 0\) \|\| recurringDeals\.length > 0,/);
  });
});

describe('round 3: deep links into the package group', () => {
  test('PromoArrivalHighlight opens the package details, and no other details', () => {
    const src = readFileSync('src/components/redesign/PromoArrivalHighlight.tsx', 'utf8');
    assert.match(src, /el\.closest<HTMLDetailsElement>\('details\[data-ticket-packages\]'\)/);
    assert.match(src, /if \(packages && !packages\.open\) packages\.open = true;/);
  });

  test('a packages-only page mounts the arrival effect in the group', async () => {
    const { TicketPackageList } = await import('../TicketPackageList');
    const { createElement } = await import('react');
    const el = TicketPackageList({ packages: [promo('2026-11-02', 'Hoodie Package')], arrivalHighlight: true }) as any;
    const kids = ([] as any[]).concat(el.props.children);
    assert.ok(kids.some((k) => k && k.type && k.type.name === 'PromoArrivalHighlight'));
    const off = TicketPackageList({ packages: [promo('2026-11-02', 'Hoodie Package')] }) as any;
    assert.ok(!([] as any[]).concat(off.props.children).some((k) => k && k.type && k.type.name === 'PromoArrivalHighlight'));
    void createElement;
  });
});

/* ---- Review round 5 ---- */

describe('round 5: the archive pointer never prints the unplaced group label', () => {
  test('only unplaceable past rows: "See completed promos below.", not "other promos"', async () => {
    const { PromoList } = await import('@/components/promo-list');
    const t = text(await html(<PromoList promos={[promo('2026-1-05', 'Odd Date Night')]} teamSlug={WILD.id} teamName="Minnesota Wild" league="NHL" sport="nhl" variant="light" showAppPitch={false} seasonScoped={false} scopeLive team={WILD} />));
    assert.match(t, /See completed promos below\./);
    assert.doesNotMatch(t, /completed other promos/);
  });
});

/* ---- Review round 6 ---- */

describe('round 6: the dark archive subline never prints the unplaced group label', () => {
  test('two groups, one unplaceable: "with no season date", not "the other season"', async () => {
    const { PromoList } = await import('@/components/promo-list');
    const t = text(await html(<PromoList promos={[promo('2026-04-11', 'Old Night'), promo('2026-1-05', 'Odd Date Night')]} teamSlug={WILD.id} teamName="Minnesota Wild" league="NHL" sport="nhl" />));
    assert.match(t, /1 in the 2025-26 season, 1 with no season date/);
    assert.doesNotMatch(t, /other season/);
  });
});

/* ---- Review round 7 ---- */

describe('round 7: label sites the harness did not pin', () => {
  test('the FAQ "schedule on this page holds" sentence names the 2026-27 season on NHL', async () => {
    const { generateTeamFAQs } = await import('@/lib/promo-helpers');
    const { resolveClaimMode } = await import('@/lib/season-scope');
    const rows = Array.from({ length: 12 }, (_, i) => promo(`2026-11-${String(i + 1).padStart(2, '0')}`, `Night ${i}`));
    const claim = resolveClaimMode(rows, 'NHL', TODAY);
    const faqs = generateTeamFAQs(WILD, rows, null, { giveaway: 0, theme: 12, food: 0, kids: 0 }, { teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never, undefined, claim);
    const all = faqs.map((f) => f.answer).join(' ');
    assert.match(all, /The 2026-27 schedule on this page holds 12 events, 12 of them still to come\./);
    assert.doesNotMatch(all, /The 2026 schedule/);
  });

  test('a preseason game says so in its expand', async () => {
    const { GameExpand } = await import('../GameExpand');
    const pre = game('pre', 'nba', '2026-10-08', 'san-antonio-spurs', 'new-orleans-pelicans', { seasonType: 'preseason' });
    const t = text(await html(<GameExpand dateStr="2026-10-08" contexts={[ctx(pre, true, PELICANS)]} team={SPURS} teamName="Spurs" />));
    assert.match(t, /· Preseason/);
  });

  test('upcoming packages come out in date order whatever order they arrive in', async () => {
    const { upcomingTicketPackages } = await import('@/lib/ticket-packages');
    const out = upcomingTicketPackages([promo('2027-03-01', 'B'), promo('2026-11-01', 'A'), promo('2026-01-01', 'Past')], TODAY);
    assert.deepEqual(out.map((p) => p.title), ['A', 'B']);
  });

  test('NHL/NBA pages give the capture sheet no game contexts, as before WEB6', () => {
    assert.match(readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8'), /<CaptureTriggerHost pageType="team_page" team=\{team\} gameContexts=\{isSplitSeasonLeague\(team\.league\) \? undefined : gameContexts\} \/>/);
  });
});

/* ---- Review round 8 ---- */

describe('round 8: TeamContentSections names the two-year season on NHL/NBA', () => {
  const DET = mk('detroit-red-wings', 'NHL', 'Detroit', 'Red Wings');
  test('season mode: every question heading and the app plug say 2026-27', async () => {
    const { TeamContentSections } = await import('@/components/team-content-sections');
    const { resolveClaimMode } = await import('@/lib/season-scope');
    const { countPromosByType } = await import('@/lib/promo-helpers');
    const rows = [promo('2026-10-20', 'Hat Night', { type: 'giveaway' }), promo('2026-11-02', 'Pride Night'), promo('2027-01-10', 'Kids Day', { type: 'kids' })];
    const t = text(await html(<TeamContentSections team={DET} promos={rows} venue={null} promoCounts={countPromosByType(rows)} claim={resolveClaimMode(rows, 'NHL', TODAY)} variant="light" />));
    assert.match(t, /in 2026-27\?/);
    assert.doesNotMatch(t, /in 2026\?/);
    assert.doesNotMatch(t, /\b2026 calendar\b/);
  });

  test('remaining mode (no season rows): the plug says the 2026-27 calendar', async () => {
    const { TeamContentSections } = await import('@/components/team-content-sections');
    const KNICKS = mk('new-york-knicks', 'NBA', 'New York', 'Knicks');
    const t = text(await html(<TeamContentSections team={KNICKS} promos={[]} venue={null} promoCounts={{ giveaway: 0, theme: 0, food: 0, kids: 0 }} claim={{ kind: 'remaining' }} variant="light" />));
    assert.match(t, /2026-27 calendar/);
    assert.doesNotMatch(t, /\b2026 calendar\b/);
  });

  test('the remaining-mode kids FAQ question names 2026-27 on NHL/NBA', async () => {
    const { generateTeamFAQs } = await import('@/lib/promo-helpers');
    const kids = [promo('2026-11-02', 'Kids Day', { type: 'kids' })];
    const faqs = generateTeamFAQs(DET, kids, null, { giveaway: 0, theme: 0, food: 0, kids: 1 }, { teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never, undefined, { kind: 'remaining' });
    const q = faqs.find((f) => /kids and family events/.test(f.question))!;
    assert.equal(q.question, 'When are Red Wings kids and family events in 2026-27?');
  });
});
