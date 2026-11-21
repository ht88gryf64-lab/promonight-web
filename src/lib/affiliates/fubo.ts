// Fubo streaming CTA (Impact campaign 5119, publisher 7236189; build
// 2026-11-20, docs/cta-registry.md "Fubo"). One table, one URL builder, one
// on-site hop.
//
// THE HOP. A "Stream on Fubo" link never points at fubo.tv. It points at our
// own /go/fubo/{league}/{gameId}?s={surface}&t={teamId}
// (src/app/go/fubo/[league]/[gameId]/route.ts), which reads the game doc for
// the two club names and answers 307 with the outbound URL built here. Fubo's
// terms allow a same-domain out-redirect; a redirect off any other domain is
// never used. affiliate_click fires in the browser on mousedown, before the
// hop, exactly as for every other partner (TrackedAffiliateLink).
//
// THE URL.
//   https://www.fubo.tv{path}?irmp=7236189&irad={irad}&sharedid={sharedid}&subId1={subId1}
//   sharedid  USA_{Sport}_{League}_{Away}-at-{Home} (MLS: -vs-), club display
//             names with accents stripped, spaces as hyphens, [A-Za-z0-9-] only.
//   subId1    {surface}_{team.id}, or on an away row the shared awayGameSubKey
//             token the other partners on that row carry (ruling 7, Gate 1).
//
// LEAGUES. MLS and CFB stay in the table but are not live (ruling 5): MLS has
// no games spine, so no gameId exists, and no CFB surface is in scope. MLB and
// WNBA are not in the table at all.
//
// COPY RULES (brief, Gate 1). The label is text only, never the Fubo logo or
// wordmark. Never "free Fubo" or anything implying Fubo is free ("7-day free
// trial" is the only free wording allowed). No price strings. NFL, NBA and NHL
// carry "Availability varies by market."

import { awayGameSubKey, subIdToken, tnSubId } from '../affiliates';
import { ymdInZone } from '../promo-date-tile';

export const FUBO_ORIGIN = 'https://www.fubo.tv';
export const FUBO_PUBLISHER_ID = '7236189';

export type FuboLeague = 'nfl' | 'nba' | 'nhl' | 'mls' | 'cfb';

type FuboLeagueEntry = { path: string; irad: string; sport: string; label: string; joiner: 'at' | 'vs' };

export const FUBO_LEAGUES: Readonly<Record<FuboLeague, FuboLeagueEntry>> = {
  nfl: { path: '/welcome/leagues/191277', irad: '356362', sport: 'Football', label: 'NFL', joiner: 'at' },
  nba: { path: '/stream/nba/', irad: '356361', sport: 'Basketball', label: 'NBA', joiner: 'at' },
  nhl: { path: '/stream/nhl/', irad: '409363', sport: 'Hockey', label: 'NHL', joiner: 'at' },
  mls: { path: '/welcome/leagues/191274', irad: '356375', sport: 'Soccer', label: 'MLS', joiner: 'vs' },
  cfb: { path: '/welcome/leagues/191261', irad: '399332', sport: 'Football', label: 'NCAAF', joiner: 'at' },
};

/** The leagues that render a Fubo CTA (ruling 5): NFL, NBA, NHL. */
export const FUBO_LIVE_LEAGUES: readonly FuboLeague[] = ['nfl', 'nba', 'nhl'];

/** The live league for a league string ('nfl', 'NFL'), or null. */
export function fuboLiveLeague(league: string | null | undefined): FuboLeague | null {
  const l = (league ?? '').toLowerCase();
  return (FUBO_LIVE_LEAGUES as readonly string[]).includes(l) ? (l as FuboLeague) : null;
}

/** The surfaces a Fubo link may carry, and so the only ?s= values the hop
 *  accepts. Team-page away rows (schedule list and calendar/list modal), the
 *  promo page and /promos/today. */
export const FUBO_SURFACES = ['web_team_page', 'web_team_page_promolist', 'web_promo_page', 'web_today'] as const;
export type FuboSurface = (typeof FUBO_SURFACES)[number];

export function isFuboSurface(s: unknown): s is FuboSurface {
  return typeof s === 'string' && (FUBO_SURFACES as readonly string[]).includes(s);
}

/** "Availability varies by market." on NFL, NBA and NHL; nothing elsewhere. */
export const FUBO_AVAILABILITY_LINE = 'Availability varies by market.';
export function fuboAvailabilityLine(league: string): string | null {
  return ['nfl', 'nba', 'nhl'].includes(league.toLowerCase()) ? FUBO_AVAILABILITY_LINE : null;
}

/** The CTA label. Text only; see COPY RULES above. */
export const FUBO_CTA_LABEL = 'Stream on Fubo';

// NFL GUARD (ruling 8). A game whose stored broadcast names Prime, Netflix or
// Amazon is not on Fubo: no CTA. NBA and NHL docs carry no broadcast field,
// so they are unguarded (deferred).
const NFL_NOT_ON_FUBO_RE = /prime|netflix|amazon/i;
export function fuboBlockedByBroadcast(league: string, network: string | null | undefined): boolean {
  return league.toLowerCase() === 'nfl' && !!network && NFL_NOT_ON_FUBO_RE.test(network);
}

// PLAYED GAMES (ux-review 2026-11-20, defect 1). A game doc's status is not
// a played signal: the NHL docs read 'scheduled' for every game, before and
// after it is played. A game is played when its date is before today in its
// own zone (the site's zone when the doc has none). The game's own day still
// counts: it may be on now.
export function fuboGamePlayed(game: { date: string; gameTimeTz?: string | null }, now: Date = new Date()): boolean {
  return game.date < ymdInZone(now, game.gameTimeTz);
}

/** One club name as a sharedid part: accents stripped, whitespace as hyphens,
 *  [A-Za-z0-9-] only, no doubled or edge hyphens. "St. Louis Blues" is
 *  St-Louis-Blues, "Montréal Canadiens" Montreal-Canadiens. */
export function fuboNamePart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** USA_{Sport}_{League}_{Away}-at-{Home}; MLS joins with -vs-. */
export function fuboSharedId(league: FuboLeague, awayName: string, homeName: string): string {
  const e = FUBO_LEAGUES[league];
  return `USA_${e.sport}_${e.label}_${fuboNamePart(awayName)}-${e.joiner}-${fuboNamePart(homeName)}`;
}

/** subId1: the away-row token when the link's team is the game's away side,
 *  else {surface}_{teamId}. Cleaned like every other Impact sub ID. */
export function fuboSubId1(
  surface: FuboSurface,
  teamId: string,
  game: { homeTeamSlug: string; awayTeamSlug: string },
): string {
  if (teamId === game.awayTeamSlug) return subIdToken(awayGameSubKey(teamId, game.homeTeamSlug));
  return tnSubId(surface, teamId);
}

export type FuboUrlOpts = {
  league: FuboLeague;
  subId1: string;
  /** Both club display names. Null only on the hop's fallback (the game doc
   *  could not be read): the league landing, still tagged, with no sharedid. */
  names: { away: string; home: string } | null;
};

/** The outbound fubo.tv URL. Only the hop route calls this. */
export function buildFuboUrl(opts: FuboUrlOpts): string {
  const e = FUBO_LEAGUES[opts.league];
  const shared = opts.names ? `&sharedid=${encodeURIComponent(fuboSharedId(opts.league, opts.names.away, opts.names.home))}` : '';
  return `${FUBO_ORIGIN}${e.path}?irmp=${FUBO_PUBLISHER_ID}&irad=${e.irad}${shared}&subId1=${encodeURIComponent(opts.subId1)}`;
}

/** The on-site hop every Fubo CTA links to. */
export function fuboGoPath(opts: { league: FuboLeague; gameId: string; surface: FuboSurface; teamId: string }): string {
  return (
    `/go/fubo/${opts.league}/${encodeURIComponent(opts.gameId)}` +
    `?s=${encodeURIComponent(opts.surface)}&t=${encodeURIComponent(opts.teamId)}`
  );
}

/** The hop for one game, or null when no CTA renders: not a live league, no
 *  game id, or an NFL game on Prime, Netflix or Amazon. */
export function fuboCtaHref(opts: {
  league: string;
  gameId: string | null | undefined;
  surface: FuboSurface;
  teamId: string;
  broadcastNetwork?: string | null;
}): string | null {
  const league = fuboLiveLeague(opts.league);
  if (!league || !opts.gameId || !opts.teamId) return null;
  if (fuboBlockedByBroadcast(league, opts.broadcastNetwork)) return null;
  return fuboGoPath({ league, gameId: opts.gameId, surface: opts.surface, teamId: opts.teamId });
}
