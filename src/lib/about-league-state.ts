// WHERE EACH LEAGUE STANDS TODAY, for the one sentence on /about that says so.
// Pure: the season windows and the upcoming promo rows in, a sentence out.
//
// The sentence used to be typed: "MLB, MLS and WNBA carry a full season, and
// NHL and NBA teams are posting theirs now. Most of the NFL is still waiting
// on team announcements." It was true on 2026-10-16 and false six weeks
// later, and the page's freshness lock could not see it: that lock fires when
// the COPY changes, not when the calendar does. So the state is derived, per
// render, and the words cannot outlive the facts.

import { LEAGUE_ORDER } from './types';
import { leadInStart, leagueWindows, nextSeasonNotYetOpen, seasonOfDate } from './seasons/season-window';

export interface AboutLeagueState {
  /** Leagues with a season in play today (start through end), in LEAGUE_ORDER. */
  inSeason: string[];
  /** Leagues inside the lead-in to their next season. */
  opening: string[];
  /** Leagues between seasons: the last one has ended and the next has not opened. */
  finished: string[];
  /** Teams in the in-season and opening leagues, and how many of them have a promotion listed ahead. */
  activeTeams: number;
  activeTeamsAhead: number;
  /** Clubs in the finished leagues that have already published a promotion for the next season. */
  finishedClubsNextSeason: number;
}

export function resolveAboutLeagueState(
  today: string,
  teams: ReadonlyArray<{ id: string; league: string }>,
  /** Upcoming visible promotions (dated today or later), one entry per row. */
  upcoming: ReadonlyArray<{ teamId: string; league: string; date: string }>,
  leagues: readonly string[] = LEAGUE_ORDER,
): AboutLeagueState {
  const inSeason: string[] = [];
  const opening: string[] = [];
  const finished: string[] = [];
  for (const league of leagues) {
    const ws = leagueWindows(league);
    if (ws.length === 0) continue;
    if (ws.some((w) => w.start <= today && today <= w.end)) inSeason.push(league);
    else if (ws.some((w) => leadInStart(w) <= today && today < w.start)) opening.push(league);
    else if (ws.some((w) => w.end < today)) finished.push(league);
  }
  const active = new Set([...inSeason, ...opening]);
  const activeTeamIds = new Set(teams.filter((t) => active.has(t.league)).map((t) => t.id));
  const ahead = new Set(upcoming.filter((p) => activeTeamIds.has(p.teamId) && p.date >= today).map((p) => p.teamId));
  const nextClubs = new Set<string>();
  for (const league of finished) {
    const next = nextSeasonNotYetOpen(league, today);
    if (!next) continue;
    for (const p of upcoming) {
      if (p.league === league && seasonOfDate(league, p.date)?.season === next.season) nextClubs.add(p.teamId);
    }
  }
  return { inSeason, opening, finished, activeTeams: activeTeamIds.size, activeTeamsAhead: ahead.size, finishedClubsNextSeason: nextClubs.size };
}

const list = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** The sentence(s). Empty when no league has a window on file. Each clause is
 *  printed only when its group is non-empty, and every number is counted. */
export function aboutLeagueStateSentence(s: AboutLeagueState): string {
  const out: string[] = [];
  const active = [...s.inSeason, ...s.opening];
  if (active.length > 0) {
    const where = s.opening.length === 0 ? 'in season' : s.inSeason.length === 0 ? 'about to start a season' : 'in season or about to start one';
    out.push(`${list(active)} ${active.length === 1 ? 'is' : 'are'} ${where}: ${s.activeTeamsAhead} of the ${s.activeTeams} teams there have promotions listed ahead.`);
  }
  if (s.finished.length > 0) {
    const one = s.finished.length === 1;
    out.push(`${list(s.finished)} ${one ? 'has' : 'have'} finished ${one ? 'its' : 'their'} season, and ${one ? 'its' : 'their'} team pages carry the record of it.`);
    if (s.finishedClubsNextSeason > 0) {
      out.push(`${s.finishedClubsNextSeason} ${s.finishedClubsNextSeason === 1 ? 'club there has' : 'clubs there have'} already published promotions for next season.`);
    }
  }
  return out.join(' ');
}
