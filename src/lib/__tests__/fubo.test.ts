// The Fubo builder (src/lib/affiliates/fubo.ts) and the /promos/today game id
// join (applyGameDisplay withGameIds, src/lib/promo-game-join.ts).
//
// Rules under test:
//  - the URL is https://www.fubo.tv{path}?irmp=7236189&irad={irad}&sharedid=..&subId1=..
//    with each league's own path and irad;
//  - sharedid is USA_{Sport}_{League}_{Away}-at-{Home} (MLS -vs-), accents
//    stripped, [A-Za-z0-9-] only;
//  - subId1 is {surface}_{team} for the home side and the shared away token
//    (web_away_game_{away}_at_{home}) for the away side;
//  - only NFL, NBA and NHL produce a link; no game id, no link; an NFL game on
//    Prime, Netflix or Amazon, no link; NBA and NHL unguarded;
//  - the copy never says free and carries no price;
//  - the join stamps gameId (and gameNetwork when stored) only with
//    withGameIds and only for exactly one live home game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUBO_AVAILABILITY_LINE,
  FUBO_CTA_LABEL,
  FUBO_LEAGUES,
  buildFuboUrl,
  fuboAvailabilityLine,
  fuboBlockedByBroadcast,
  fuboCtaHref,
  fuboNamePart,
  fuboSharedId,
  fuboSubId1,
  isFuboSurface,
} from '../affiliates/fubo';
import type { Game, PromoWithTeam, Team } from '../types';

test('the URL per league: path, irmp, irad, sharedid, subId1', () => {
  const names = { away: 'Buffalo Bills', home: 'Baltimore Ravens' };
  assert.equal(
    buildFuboUrl({ league: 'nfl', subId1: 'web_today_baltimore-ravens', names }),
    'https://www.fubo.tv/welcome/leagues/191277?irmp=7236189&irad=356362&sharedid=USA_Football_NFL_Buffalo-Bills-at-Baltimore-Ravens&subId1=web_today_baltimore-ravens',
  );
  assert.equal(
    buildFuboUrl({ league: 'nba', subId1: 'x', names: { away: 'LA Clippers', home: 'Minnesota Timberwolves' } }),
    'https://www.fubo.tv/stream/nba/?irmp=7236189&irad=356361&sharedid=USA_Basketball_NBA_LA-Clippers-at-Minnesota-Timberwolves&subId1=x',
  );
  assert.equal(
    buildFuboUrl({ league: 'nhl', subId1: 'x', names: { away: 'Pittsburgh Penguins', home: 'Minnesota Wild' } }),
    'https://www.fubo.tv/stream/nhl/?irmp=7236189&irad=409363&sharedid=USA_Hockey_NHL_Pittsburgh-Penguins-at-Minnesota-Wild&subId1=x',
  );
  assert.equal(fuboSharedId('mls', 'Colorado Rapids', 'Minnesota United'), 'USA_Soccer_MLS_Colorado-Rapids-vs-Minnesota-United');
  assert.equal(fuboSharedId('cfb', 'Michigan', 'Ohio State'), 'USA_Football_NCAAF_Michigan-at-Ohio-State');
  assert.deepEqual(
    Object.fromEntries(Object.entries(FUBO_LEAGUES).map(([k, v]) => [k, [v.path, v.irad]])),
    {
      nfl: ['/welcome/leagues/191277', '356362'],
      nba: ['/stream/nba/', '356361'],
      nhl: ['/stream/nhl/', '409363'],
      mls: ['/welcome/leagues/191274', '356375'],
      cfb: ['/welcome/leagues/191261', '399332'],
    },
  );
});

test('the fallback URL (no game doc) carries no sharedid', () => {
  assert.equal(
    buildFuboUrl({ league: 'nhl', subId1: 'web_promo_page_minnesota-wild', names: null }),
    'https://www.fubo.tv/stream/nhl/?irmp=7236189&irad=409363&subId1=web_promo_page_minnesota-wild',
  );
});

test('name parts: accents stripped, spaces as hyphens, [A-Za-z0-9-] only', () => {
  assert.equal(fuboNamePart('St. Louis Blues'), 'St-Louis-Blues');
  assert.equal(fuboNamePart('Montréal Canadiens'), 'Montreal-Canadiens');
  assert.equal(fuboNamePart("  Hawai'i  Rainbow  Warriors "), 'Hawaii-Rainbow-Warriors');
  assert.equal(fuboNamePart('Texas A&M'), 'Texas-AM');
  assert.equal(fuboNamePart('Utah Hockey Club - Mammoth'), 'Utah-Hockey-Club-Mammoth');
  for (const s of [fuboSharedId('nhl', 'St. Louis Blues', 'Montréal Canadiens'), fuboSharedId('nfl', 'Texas A&M', "Hawai'i")]) {
    assert.match(s, /^USA_[A-Za-z]+_[A-Z]+_[A-Za-z0-9-]+$/, s);
  }
});

test('subId1: {surface}_{team} for the home side, the shared away token for the away side (ruling 7)', () => {
  const game = { homeTeamSlug: 'baltimore-ravens', awayTeamSlug: 'buffalo-bills' };
  assert.equal(fuboSubId1('web_today', 'baltimore-ravens', game), 'web_today_baltimore-ravens');
  assert.equal(fuboSubId1('web_promo_page', 'baltimore-ravens', game), 'web_promo_page_baltimore-ravens');
  assert.equal(fuboSubId1('web_team_page', 'buffalo-bills', game), 'web_away_game_buffalo-bills_at_baltimore-ravens');
  assert.equal(fuboSubId1('web_team_page_promolist', 'buffalo-bills', game), 'web_away_game_buffalo-bills_at_baltimore-ravens');
});

test('the CTA href: NFL, NBA, NHL only; a game id required; the NFL broadcast guard', () => {
  const base = { gameId: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', surface: 'web_today' as const, teamId: 'baltimore-ravens' };
  assert.equal(
    fuboCtaHref({ ...base, league: 'nfl' }),
    '/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_today&t=baltimore-ravens',
  );
  assert.ok(fuboCtaHref({ ...base, league: 'NBA' })?.startsWith('/go/fubo/nba/'), 'league is case-folded');
  assert.ok(fuboCtaHref({ ...base, league: 'nhl' })?.startsWith('/go/fubo/nhl/'));
  for (const league of ['mls', 'cfb', 'mlb', 'wnba', '']) assert.equal(fuboCtaHref({ ...base, league }), null, league);
  assert.equal(fuboCtaHref({ ...base, league: 'nfl', gameId: null }), null);
  assert.equal(fuboCtaHref({ ...base, league: 'nfl', gameId: '' }), null);
  for (const network of ['Prime Video', 'prime video', 'Netflix', 'Amazon Prime', 'NBC/Peacock/Prime']) {
    assert.equal(fuboCtaHref({ ...base, league: 'nfl', broadcastNetwork: network }), null, network);
    assert.equal(fuboBlockedByBroadcast('nfl', network), true, network);
  }
  for (const network of ['CBS', 'FOX', 'NBC', 'ESPN/ABC', null, undefined]) {
    assert.ok(fuboCtaHref({ ...base, league: 'nfl', broadcastNetwork: network }), String(network));
  }
  // NBA and NHL are unguarded (ruling 8).
  assert.ok(fuboCtaHref({ ...base, league: 'nba', broadcastNetwork: 'Prime Video' }));
  assert.ok(fuboCtaHref({ ...base, league: 'nhl', broadcastNetwork: 'Netflix' }));
});

test('the surface allowlist', () => {
  for (const s of ['web_team_page', 'web_team_page_promolist', 'web_promo_page', 'web_today']) assert.ok(isFuboSurface(s), s);
  for (const s of ['web_home_tonight', 'web_home', 'web_venue', 'web_other', '', null, 'web_today_x']) assert.ok(!isFuboSurface(s), String(s));
});

test('copy: text label, availability line on NFL/NBA/NHL only, never free, no price', () => {
  assert.equal(FUBO_CTA_LABEL, 'Stream on Fubo');
  assert.equal(FUBO_AVAILABILITY_LINE, 'Availability varies by market.');
  for (const l of ['nfl', 'nba', 'nhl', 'NFL']) assert.equal(fuboAvailabilityLine(l), FUBO_AVAILABILITY_LINE, l);
  for (const l of ['mls', 'cfb']) assert.equal(fuboAvailabilityLine(l), null, l);
  for (const copy of [FUBO_CTA_LABEL, FUBO_AVAILABILITY_LINE]) {
    assert.ok(!/free/i.test(copy), copy);
    assert.ok(!/[$€£]|\d+\.\d\d|\/mo\b|per month/i.test(copy), copy);
  }
});

// ── the /promos/today join ───────────────────────────────────────────────

function team(id: string, name: string, league: string): Team {
  return { id, name, city: 'City', league, sportSlug: league.toLowerCase() } as unknown as Team;
}
const RAVENS = team('baltimore-ravens', 'Ravens', 'NFL');
const BILLS = team('buffalo-bills', 'Bills', 'NFL');
const WILD = team('minnesota-wild', 'Wild', 'NHL');
const PENS = team('pittsburgh-penguins', 'Penguins', 'NHL');
const TEAMS = new Map([RAVENS, BILLS, WILD, PENS].map((t) => [t.id, t]));
const game = (over: Partial<Game>): Game => ({ id: 'g', league: 'nfl', date: '2026-11-22', gameTime: '18:00', gameTimeTz: 'America/New_York', homeTeamSlug: RAVENS.id, awayTeamSlug: BILLS.id, venueName: 'M&T Bank Stadium', status: 'scheduled', ...over });
const promo = (t: Team, date: string, over: Partial<PromoWithTeam> = {}): PromoWithTeam =>
  ({ date, time: '1:00 PM', opponent: 'Bills', type: 'giveaway', title: 'Towel', description: '', highlight: false, icon: '', recurring: false, team: t, ...over }) as PromoWithTeam;

test('join: withGameIds stamps gameId and gameNetwork from the one home game, even when both slots are stored', async () => {
  const { applyGameDisplay, buildGameIndex } = await import('../promo-game-join');
  const index = buildGameIndex([
    game({ id: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', broadcast: { network: 'CBS', isPrimetime: false } }),
    game({ id: 'nhl-a', league: 'nhl', date: '2026-11-22', homeTeamSlug: WILD.id, awayTeamSlug: PENS.id }),
    game({ id: 'nhl-b', league: 'nhl', date: '2026-11-23', homeTeamSlug: WILD.id, awayTeamSlug: PENS.id, doubleheaderGame: 1 }),
    game({ id: 'nhl-c', league: 'nhl', date: '2026-11-23', homeTeamSlug: WILD.id, awayTeamSlug: PENS.id, doubleheaderGame: 2 }),
    game({ id: 'nhl-d', league: 'nhl', date: '2026-11-24', homeTeamSlug: WILD.id, awayTeamSlug: PENS.id, status: 'postponed' }),
  ]);
  const ravens = promo(RAVENS, '2026-11-22');
  const wild = promo(WILD, '2026-11-22', { time: '', opponent: '' });
  const dh = promo(WILD, '2026-11-23');
  const postponed = promo(WILD, '2026-11-24');
  applyGameDisplay([ravens, wild, dh, postponed], index, TEAMS, { withGameIds: true });
  assert.equal(ravens.gameId, 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', 'stored slots do not skip the id');
  assert.equal(ravens.gameNetwork, 'CBS');
  assert.equal(ravens.displayTime, '1:00 PM', 'stored still wins');
  assert.equal(wild.gameId, 'nhl-a');
  assert.equal(wild.gameNetwork, undefined, 'no broadcast stored, no key');
  assert.equal(wild.displayOpponent, 'Penguins');
  assert.equal(dh.gameId, undefined, 'a doubleheader is never guessed');
  assert.equal(postponed.gameId, undefined, 'a postponed game is no game');
});

test('join: without withGameIds nothing new is stamped (every other loader unchanged)', async () => {
  const { applyGameDisplay, buildGameIndex } = await import('../promo-game-join');
  const index = buildGameIndex([game({ id: 'nfl-x', broadcast: { network: 'CBS', isPrimetime: false } })]);
  const stored = promo(RAVENS, '2026-11-22');
  const empty = promo(RAVENS, '2026-11-22', { time: '', opponent: '' });
  applyGameDisplay([stored, empty], index, TEAMS);
  for (const p of [stored, empty]) {
    assert.ok(!('gameId' in p), 'no gameId key');
    assert.ok(!('gameNetwork' in p), 'no gameNetwork key');
  }
  assert.equal(empty.displayOpponent, 'Bills');
});
