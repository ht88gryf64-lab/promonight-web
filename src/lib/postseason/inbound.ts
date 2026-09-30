// What the pages outside /playoffs say about the postseason. PURE.
//
// Four surfaces: a club's team page, a league's hub, the homepage, and the
// page of a park that is hosting. Each builder takes the brackets the gate
// let through and returns plain data, or null when the surface has nothing
// to say. An empty list of leagues, which is what a closed gate gives,
// returns null from every one of them.
//
// Nothing here states more than the bracket does. A club is "alive" because
// the document lists it in a series that is not final, "eliminated" because
// the document names the other club the winner, and a game is at a park
// because the document names the park's club as its host.
//
// NOTHING HERE IS IN THE PRESENT TENSE. The pages these modules sit on are
// regenerated when a bracket changes, but a team page stands for a day and a
// hub for six hours between changes, so "Live" or "in progress" would keep
// being served long after the game ended. A module states a series score
// and a game's scheduled time, both of which stay true; the badge for a game
// in progress belongs to the playoffs pages, which the pipeline revalidates
// and which regenerate every ten minutes besides.
import type { PostseasonLeague } from './types';
import type { HomeGameView, LeagueView, SeriesView, SlotView } from './view';

export interface InboundLeague {
  league: PostseasonLeague;
  /** The league's bracket page, "/playoffs/mlb". */
  href: string;
  view: LeagueView;
}

const allSeries = (view: LeagueView): SeriesView[] => view.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
const seriesHref = (l: InboundLeague, s: SeriesView) => `${l.href}#${s.id}`;
const sideOf = (s: SeriesView, teamId: string): { own: SlotView; other: SlotView } | null =>
  s.higher.teamId === teamId ? { own: s.higher, other: s.lower } : s.lower.teamId === teamId ? { own: s.lower, other: s.higher } : null;
const tally = (own: SlotView, other: SlotView) => `${Math.max(own.wins, other.wins)}-${Math.min(own.wins, other.wins)}`;

/** The next game by its scheduled time: "Game 2 · Wed, Sep 30 · 5:00 PM ET".
 *  A game that has started is still the next game to be played, and its
 *  scheduled time is still a fact; its state is not stated. */
function nextGameLabel(s: SeriesView): string | null {
  if (!s.next) return null;
  if (s.next.state === 'scheduled' || s.next.state === 'live') return `${s.next.title} · ${s.next.when}`;
  return `${s.next.title} · ${s.next.stateLabel}`;
}

// ---- A club's team page ----

interface ClubBase {
  league: PostseasonLeague;
  season: number;
  leagueHref: string;
  /** When the bracket last changed. Every state below is as of then. */
  updatedLabel: string | null;
}

export type ClubPlayoffs =
  /** In a series that is not decided. */
  | (ClubBase & {
      state: 'alive';
      seriesHref: string;
      roundLabel: string;
      /** The other side: a club's nickname, or the slot's own text. */
      opponent: string;
      /** "HOU leads 1-0", "Series tied 1-1". Null before a game is final. */
      scoreLine: string | null;
      /** "Game 2 · Wed, Sep 30 · 5:00 PM ET": the next game to be played,
       *  by its scheduled time, whether or not it has started. */
      nextLabel: string | null;
      /** "Host: Astros · Daikin Park". */
      nextHost: string | null;
    })
  /** Won its last series; the next one has not named it yet. */
  | (ClubBase & { state: 'advanced'; seriesHref: string; roundLabel: string; opponent: string; wonLine: string })
  /** Lost its last series. `leagueActive` says whether anything is left to follow. */
  | (ClubBase & { state: 'eliminated'; leagueActive: boolean; roundLabel: string; opponent: string; lostLine: string })
  /** Won the last round of a finished bracket. */
  | (ClubBase & { state: 'champion'; summary: string });

/**
 * What a club's page says, or null when the club is in no bracket the gate
 * let through.
 *
 * The club's state is read from the LAST series in the document that lists
 * it, which is the furthest round it reached.
 */
export function clubPlayoffs(leagues: readonly InboundLeague[], teamId: string): ClubPlayoffs | null {
  for (const l of leagues) {
    const mine = allSeries(l.view).filter((s) => sideOf(s, teamId) !== null);
    if (mine.length === 0) continue;
    const s = mine[mine.length - 1];
    const { own, other } = sideOf(s, teamId) as { own: SlotView; other: SlotView };
    const base: ClubBase = { league: l.league, season: l.view.season, leagueHref: l.href, updatedLabel: l.view.updatedLabel };

    if (s.status !== 'final') {
      return {
        ...base,
        state: 'alive',
        seriesHref: seriesHref(l, s),
        roundLabel: s.roundLabel,
        opponent: other.label,
        scoreLine: s.scoreLine,
        nextLabel: nextGameLabel(s),
        nextHost: s.next && s.next.hostName ? (s.next.park ? `Host: ${s.next.hostName} · ${s.next.park}` : `Host: ${s.next.hostName}`) : null,
      };
    }
    if (l.view.phase.kind === 'concluded' && l.view.phase.championTeamId === teamId) {
      return { ...base, state: 'champion', summary: l.view.phase.summary };
    }
    if (own.won) {
      return { ...base, state: 'advanced', seriesHref: seriesHref(l, s), roundLabel: s.roundLabel, opponent: other.label, wonLine: `Won the ${s.roundLabel} ${tally(own, other)}` };
    }
    return {
      ...base,
      state: 'eliminated',
      leagueActive: l.view.phase.kind === 'active',
      roundLabel: s.roundLabel,
      opponent: other.label,
      lostLine: `Lost the ${s.roundLabel} ${tally(own, other)}`,
    };
  }
  return null;
}

// ---- A league's hub, and the homepage ----

export interface LeagueCardSeries {
  id: string;
  href: string;
  /** "Astros vs White Sox". */
  names: string;
  /** One line: the series score, else the next game's scheduled time. */
  status: string;
}

export interface LeagueCard {
  league: PostseasonLeague;
  season: number;
  href: string;
  roundLabel: string;
  series: LeagueCardSeries[];
  updatedLabel: string | null;
}

/** The card for one league, or null unless that league's postseason is
 *  being played. A finished bracket gets no card: nothing is left to follow. */
export function leagueCard(leagues: readonly InboundLeague[], league: string): LeagueCard | null {
  const l = leagues.find((x) => x.league === league);
  if (!l || l.view.phase.kind !== 'active') return null;
  const key = l.view.phase.roundKey;
  const round = l.view.rounds.find((r) => r.key === key);
  if (!round) return null;
  return {
    league: l.league,
    season: l.view.season,
    href: l.href,
    roundLabel: l.view.phase.roundLabel,
    series: round.groups.flatMap((g) =>
      g.series.map((s) => ({
        id: s.id,
        href: seriesHref(l, s),
        names: `${s.higher.label} vs ${s.lower.label}`,
        // Never the series headline: that is the playoffs page's line, and
        // while a game is being played it says so.
        status: s.scoreLine ?? nextGameLabel(s) ?? (s.higher.kind === 'placeholder' || s.lower.kind === 'placeholder' ? 'Matchup to be decided' : 'No games listed'),
      })),
    ),
    updatedLabel: l.view.updatedLabel,
  };
}

export interface HomeLeague {
  league: PostseasonLeague;
  href: string;
  roundLabel: string;
}

/** The leagues whose postseason is being played, for the homepage. Null
 *  when there is none. */
export function homePlayoffs(leagues: readonly InboundLeague[]): { season: number; leagues: HomeLeague[] } | null {
  const active = leagues.flatMap((l) => (l.view.phase.kind === 'active' ? [{ league: l.league, href: l.href, roundLabel: l.view.phase.roundLabel, season: l.view.season }] : []));
  if (active.length === 0) return null;
  return { season: active[0].season, leagues: active.map(({ league, href, roundLabel }) => ({ league, href, roundLabel })) };
}

// ---- The page of a park that is hosting ----

export interface VenueGame {
  key: string;
  league: PostseasonLeague;
  href: string;
  matchup: string;
  roundLabel: string;
  gameTitle: string;
  when: string;
  ifNecessary: boolean;
}

export interface VenueGames {
  games: VenueGame[];
  /** One stamp per league listed, in the order the leagues appear. */
  updated: { league: PostseasonLeague; updatedLabel: string }[];
}

/**
 * The postseason games still to be played at a building, given the clubs
 * that play there. Null when there is none, which covers a building whose
 * club is not in a bracket, one whose club is out, and one whose club has no
 * home game left.
 *
 * A game is "here" because the bracket names one of the building's clubs as
 * its host. The bracket names no building.
 */
export function venueGames(leagues: readonly InboundLeague[], tenantTeamIds: readonly string[]): VenueGames | null {
  const tenants = new Set(tenantTeamIds);
  const games: (VenueGame & { sortKey: string })[] = [];
  const updated: VenueGames['updated'] = [];
  for (const l of leagues) {
    if (l.view.phase.kind !== 'active') continue;
    const here = l.view.homeGames.filter((g: HomeGameView) => tenants.has(g.hostTeamId));
    if (here.length === 0) continue;
    if (l.view.updatedLabel) updated.push({ league: l.league, updatedLabel: l.view.updatedLabel });
    for (const g of here) {
      games.push({
        key: g.key,
        league: g.league,
        href: `${l.href}#${g.seriesId}`,
        matchup: g.matchup,
        roundLabel: g.roundLabel,
        gameTitle: g.gameTitle,
        when: g.when,
        ifNecessary: g.ifNecessary,
        sortKey: g.sortKey,
      });
    }
  }
  if (games.length === 0) return null;
  games.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.key < b.key ? -1 : 1));
  return { games: games.map(({ sortKey: _drop, ...g }) => g), updated };
}
