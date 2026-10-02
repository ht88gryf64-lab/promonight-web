// "Where things stand": one or two sentences near the top of a league page,
// above the real bracket. PURE. Built from the league view, which is built
// from the bracket document alone: every number here (wins, game numbers,
// dates, times) is the document's. Club names are the web's team records,
// as everywhere else on the page.
//
// FOUR STATES, AND NOTHING ELSE.
//   champion       the last series is final: who won it, against whom, the
//                  series score.
//   round played   a round has a result or a game under way: where every
//                  series of it stands, then the next game with a known
//                  date and time.
//   between rounds the round to play next has not started: its name, and
//                  its first game only when one has a date and a time.
//   anything else  null, and the page renders nothing in its place. A
//                  series the view cannot read straight (final with no
//                  winner, a winner with fewer wins) makes the whole line
//                  null: half a summary would read as all of it.
//
// NO CLOCK WORDS. The page is cached and the bracket's own change stamp sits
// beside this line, so nothing here says today, live, latest, now or
// currently. `now` is used once: to skip a game the feed still lists as
// scheduled after its start, which is a row the feed has not caught up on.
import type { Bracket } from './types';
import { seriesIds, type GameView, type LeagueView, type SeriesView, type SlotView } from './view';

/** Each timed game's start instant, by the page's series id and game
 *  number. A game whose time is TBD, or with no start, has no entry. */
export function gameStarts(bracket: Bracket): Map<string, string> {
  const ids = seriesIds(bracket);
  const out = new Map<string, string>();
  for (const s of bracket.series) {
    for (const g of s.games) if (g.start && !g.startTimeTBD) out.set(`${ids.get(s.seriesKey)}#${g.gameNumber}`, g.start);
  }
  return out;
}

type Club = SlotView & { kind: 'club' };
const isClub = (s: SlotView): s is Club => s.kind === 'club';

/** "the Brewers lead the Cubs 2-1", or null when the series cannot be read
 *  straight. A series with a slot no club fills yet is 'skip'. */
function clause(s: SeriesView): string | null | 'skip' {
  if (!isClub(s.higher) || !isClub(s.lower)) return 'skip';
  const a = s.higher;
  const b = s.lower;
  if (s.status === 'final') {
    const w = a.won ? a : b.won ? b : null;
    if (!w) return null;
    const l = w === a ? b : a;
    if (w.wins <= l.wins) return null;
    return `the ${w.label} beat the ${l.label} ${w.wins}-${l.wins}`;
  }
  if (a.won || b.won) return null;
  if (a.wins === b.wins) {
    return a.wins === 0 ? `the ${a.label} and the ${b.label} have not completed a game` : `the ${a.label} and the ${b.label} are tied ${a.wins}-${b.wins}`;
  }
  const lead = a.wins > b.wins ? a : b;
  const trail = lead === a ? b : a;
  return `the ${lead.label} lead the ${trail.label} ${lead.wins}-${trail.wins}`;
}

const started = (s: SeriesView) => s.status !== 'upcoming' || s.higher.wins + s.lower.wins > 0 || s.games.some((g) => g.state === 'final' || g.state === 'live');

/** A game with a date and a start time, not yet played, not behind `now`. */
function upcomingTimed(g: GameView, startOf: (g: GameView) => string | null, now: Date): boolean {
  if (g.state !== 'scheduled') return false;
  const start = startOf(g);
  return start !== null && Date.parse(start) >= now.getTime();
}

const bySortKey = (x: { g: GameView }, y: { g: GameView }) => (x.g.sortKey < y.g.sortKey ? -1 : x.g.sortKey > y.g.sortKey ? 1 : 0);

/** "Game 4, Cubs at Brewers, Fri, Oct 2, 7:08 PM ET". */
function gameText(g: GameView): string {
  return `${g.title}, ${g.matchup}, ${g.when.replace(' · ', ', ')}${g.ifNecessary ? ' (if necessary)' : ''}`;
}

/**
 * The line, or null. `starts` maps each game, by series id and game number,
 * to its start instant when the document gives a time ("Time TBD" games
 * have none); built by the caller from the same document.
 */
export function standingLine(view: LeagueView, starts: ReadonlyMap<string, string>, now: Date): string | null {
  const startOf = (s: SeriesView) => (g: GameView) => starts.get(`${s.id}#${g.gameNumber}`) ?? null;

  if (view.phase.kind === 'concluded') {
    const last = view.rounds[view.rounds.length - 1];
    const decider = last?.groups.flatMap((g) => g.series);
    if (!decider || decider.length !== 1) return null;
    const s = decider[0];
    if (s.status !== 'final' || !isClub(s.higher) || !isClub(s.lower)) return null;
    const w = s.higher.won ? s.higher : s.lower.won ? s.lower : null;
    if (!w || w.teamId !== view.phase.championTeamId) return null;
    const l = w === s.higher ? s.lower : s.higher;
    if (w.wins <= l.wins) return null;
    return `The ${w.fullName} won the ${view.season} ${last.label}, beating the ${l.fullName} ${w.wins}-${l.wins}.`;
  }

  const at = view.rounds.findIndex((r) => r.key === (view.phase as { roundKey: string }).roundKey);
  if (at < 0) return null;
  const seriesOf = (i: number) => view.rounds[i].groups.flatMap((g) => g.series);

  // The open round and every later round with a series already under way.
  const played = [at, ...view.rounds.map((_, i) => i).filter((i) => i > at && seriesOf(i).some(started))].filter((i) => seriesOf(i).some(started));

  if (played.length === 0) {
    // Between rounds, or before the first: the round to play next.
    const round = view.rounds[at];
    const first = seriesOf(at)
      .flatMap((s) => s.games.filter((g) => upcomingTimed(g, startOf(s), now)).map((g) => ({ s, g })))
      .sort(bySortKey)[0];
    return first ? `Next round: ${round.label}. It opens with ${gameText(first.g)}.` : `Next round: ${round.label}.`;
  }

  const parts: string[] = [];
  const open: { s: SeriesView; g: GameView }[] = [];
  for (const i of played) {
    const clauses: string[] = [];
    for (const s of seriesOf(i)) {
      const c = clause(s);
      if (c === null) return null;
      if (c === 'skip') continue;
      clauses.push(c);
      if (s.status !== 'final') for (const g of s.games) if (upcomingTimed(g, startOf(s), now)) open.push({ s, g });
    }
    if (clauses.length === 0) return null;
    parts.push(`${view.rounds[i].label}: ${clauses.join('; ')}.`);
  }
  open.sort(bySortKey);
  const next = open[0];
  return next ? `${parts.join(' ')} Next game: ${gameText(next.g)}.` : parts.join(' ');
}
