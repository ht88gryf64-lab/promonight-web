// Fixtures for the ScheduleBlock tests. Plain data, no Firestore.
//
// The NFL slate is deliberately awkward: a bye week, flex-pending TBD kickoffs,
// an international game, away rows with and without an opponent doc, and one
// game whose status is 'canceled'. Every one of those is a branch the month
// sections must never reach, which is what the byte-identity golden proves.
import type { GameContext } from '@/lib/data';
import type { Game, Team } from '@/lib/types';

export const team = (id: string, league: 'NFL' | 'MLB', name: string, city: string): Team => ({
  id,
  city,
  name,
  abbreviation: name.slice(0, 3).toUpperCase(),
  primaryColor: '#123456',
  secondaryColor: '#654321',
  league,
  sportSlug: league.toLowerCase(),
  division: league === 'NFL' ? 'NFC North' : 'NL East',
});

export const LIONS = team('detroit-lions', 'NFL', 'Lions', 'Detroit');
const PACKERS = team('green-bay-packers', 'NFL', 'Packers', 'Green Bay');
const BEARS = team('chicago-bears', 'NFL', 'Bears', 'Chicago');

const nflGame = (week: number, date: string, home: boolean, opp: string, extra: Partial<Game> = {}): Game => ({
  id: `nfl-${date}-${home ? opp : 'detroit-lions'}-at-${home ? 'detroit-lions' : opp}`,
  league: 'nfl',
  date,
  gameTime: '17:00',
  gameTimeTz: 'America/Detroit',
  gameTimeZoneAbbrev: 'EDT',
  homeTeamSlug: home ? 'detroit-lions' : opp,
  awayTeamSlug: home ? opp : 'detroit-lions',
  venueName: home ? 'Ford Field' : `${opp} Stadium`,
  status: 'scheduled',
  season: 2026,
  seasonType: 'regular',
  week,
  ...extra,
});

const ctx = (game: Game, isHome: boolean, opponentTeam: Team | null): GameContext => ({
  game,
  isHome,
  opponentTeam,
  opponentVenue: null,
  promos: [],
});

/** 17 games over 18 weeks: bye in week 8, TBD flex in 16-18, one London game. */
export const NFL_CONTEXTS: GameContext[] = (() => {
  const out: GameContext[] = [];
  let day = Date.UTC(2026, 8, 13); // Sun 2026-09-13
  for (let w = 1; w <= 18; w++, day += 7 * 86_400_000) {
    if (w === 8) continue;
    const date = new Date(day).toISOString().slice(0, 10);
    const home = w % 2 === 1;
    const oppTeam = w % 3 === 0 ? BEARS : w === 5 ? null : PACKERS;
    const opp = oppTeam ? oppTeam.id : 'unknown-club';
    const extra: Partial<Game> = {};
    if (w >= 16) { extra.timeTbd = true; extra.gameTime = '05:00'; }
    if (w === 6) { extra.isInternational = true; extra.internationalLocation = 'London'; extra.venueName = 'Tottenham Hotspur Stadium'; }
    if (w === 11) extra.status = 'canceled';
    if (w === 12) extra.status = 'completed';
    out.push(ctx(nflGame(w, date, home, opp, extra), home, oppTeam));
  }
  return out;
})();

export const BRAVES = team('atlanta-braves', 'MLB', 'Braves', 'Atlanta');
const PHILLIES = team('philadelphia-phillies', 'MLB', 'Phillies', 'Philadelphia');
const METS = team('new-york-mets', 'MLB', 'Mets', 'New York');

let pk = 800000;
export const mlbGame = (date: string, home: boolean, opp: Team, extra: Partial<Game> = {}): Game => ({
  id: `mlb-${date}-${home ? opp.id : 'atlanta-braves'}-at-${home ? 'atlanta-braves' : opp.id}${extra.doubleheaderGame ? `-g${extra.doubleheaderGame}` : ''}`,
  league: 'mlb',
  date,
  gameTime: '23:20',
  gameTimeTz: 'America/New_York',
  gameTimeZoneAbbrev: 'EDT',
  homeTeamSlug: home ? 'atlanta-braves' : opp.id,
  awayTeamSlug: home ? opp.id : 'atlanta-braves',
  venueName: home ? 'Truist Park' : `${opp.name} Park`,
  status: 'completed',
  mlbGameId: ++pk,
  ...extra,
});

export const mlbCtx = (game: Game, opp: Team): GameContext =>
  ctx(game, game.homeTeamSlug === 'atlanta-braves', opp);

export { PHILLIES, METS };
