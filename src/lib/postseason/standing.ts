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
//                  series of it stands (a series still waiting on an
//                  opponent says so), then the next game.
//   between rounds the round to play next has not started: its name, and
//                  its first game.
//                  A game is named as next only when it is the earliest
//                  unplayed game: timed, ahead of the clock, and with no
//                  unplayed game that is untimed, postponed, suspended or
//                  past its start on its day or before it. Otherwise the
//                  clause is left out rather than name a game that may not
//                  be next.
//   anything else  null, and the page renders nothing in its place. A
//                  series the view cannot read straight (final with no
//                  winner, a winner with fewer wins) makes the whole line
//                  null: half a summary would read as all of it.
//
// NO CLOCK WORDS. The page is cached and the bracket's own change stamp sits
// beside this line, so nothing here says today, live, latest, now or
// currently. `now` is used once: a game the feed still lists as scheduled
// after its start is a row the feed has not caught up on, and it blocks the
// next-game clause on its day.
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

/** Nicknames that are singular in form take a singular verb ("the Liberty
 *  leads"); the rest are plural ("the Brewers lead"). WNBA's, and the NBA's
 *  and NHL's ahead of their pages. */
const SINGULAR = new Set(['Liberty', 'Dream', 'Fever', 'Lynx', 'Mercury', 'Sky', 'Storm', 'Sun', 'Tempo', 'Fire', 'Heat', 'Magic', 'Thunder', 'Jazz', 'Wild', 'Kraken', 'Lightning', 'Avalanche', 'Mammoth']);
const verb = (label: string, plural: string, singular: string) => (SINGULAR.has(label) ? singular : plural);

/** "the Brewers lead the Cubs 2-1", or null when the series cannot be read
 *  straight. A series with one slot no club fills yet says who waits for
 *  whom; with none filled it is 'unset'. */
function clause(s: SeriesView): string | null | 'unset' {
  if (!isClub(s.higher) && !isClub(s.lower)) return 'unset';
  if (!isClub(s.higher) || !isClub(s.lower)) {
    const club = (isClub(s.higher) ? s.higher : s.lower) as Club;
    const slot = isClub(s.higher) ? s.lower : s.higher;
    if (club.wins + slot.wins > 0 || s.status === 'final') return null;
    const whom = slot.label.endsWith(' winner') ? `the ${slot.label}` : 'an opponent';
    return `the ${club.label} ${verb(club.label, 'await', 'awaits')} ${whom}`;
  }
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
  return `the ${lead.label} ${verb(lead.label, 'lead', 'leads')} the ${trail.label} ${lead.wins}-${trail.wins}`;
}

const started = (s: SeriesView) => s.status !== 'upcoming' || s.higher.wins + s.lower.wins > 0 || s.games.some((g) => g.state === 'final' || g.state === 'live');

const UNPLAYED = new Set(['scheduled', 'postponed', 'suspended']);

/**
 * The next game, or null when it cannot be named truthfully.
 *
 * Every unplayed game gets an order key: its Eastern day, then its start
 * instant, with a game that has no time sorting first on its day (it could
 * be earlier). The candidate is the earliest scheduled, timed game ahead of
 * the clock in a `sure` series: the rounds being played, or the round about
 * to open. It is named only when
 *   - every unfinished `sure` series lists a game to play (a series with
 *     none could open first);
 *   - no other unplayed game sorts at or before it: an earlier game, a game
 *     with no time on its day, a game the feed still lists after its start,
 *     a simultaneous start. A `sure` game with no date blocks too; a `later`
 *     round's undated game says nothing about the order;
 *   - no lower-numbered game of its own series is unplayed.
 * `later` series (rounds not started) only ever block.
 */
function nextGame(sure: SeriesView[], later: SeriesView[], startOf: (s: SeriesView) => (g: GameView) => string | null, now: Date): GameView | null {
  type Row = { s: SeriesView; g: GameView; start: string | null; day: string | null; sure: boolean };
  const rows: Row[] = [];
  for (const [list, isSure] of [[sure, true], [later, false]] as const) {
    for (const s of list) {
      if (s.status === 'final') continue;
      const unplayed = s.games.filter((g) => UNPLAYED.has(g.state));
      if (isSure && unplayed.length === 0 && !s.games.some((g) => g.state === 'live')) return null;
      for (const g of unplayed) rows.push({ s, g, start: startOf(s)(g), day: g.day, sure: isSure });
    }
  }
  const ahead = (r: Row) => r.g.state === 'scheduled' && r.start !== null && Date.parse(r.start) >= now.getTime();
  const key = (r: Row) => `${r.day} ${r.start ?? ''}`;
  const next = rows.filter((r) => r.sure && ahead(r)).sort((x, y) => Date.parse(x.start as string) - Date.parse(y.start as string))[0];
  if (!next) return null;
  for (const r of rows) {
    if (r === next) continue;
    if (r.day === null) {
      if (r.sure) return null;
      continue;
    }
    if (key(r) <= key(next)) return null;
    if (r.s === next.s && r.g.gameNumber < next.g.gameNumber) return null;
  }
  return next.g;
}

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

  const after = (from: number, skip: readonly number[]) => view.rounds.flatMap((_, i) => (i >= from && !skip.includes(i) ? seriesOf(i) : []));

  if (played.length === 0) {
    // Between rounds, or before the first: the round to play next.
    const round = view.rounds[at];
    const first = nextGame(seriesOf(at), after(at + 1, []), startOf, now);
    return first ? `Next round: ${round.label}. It opens with ${gameText(first)}.` : `Next round: ${round.label}.`;
  }

  const parts: string[] = [];
  for (const i of played) {
    const clauses: string[] = [];
    let unset = 0;
    for (const s of seriesOf(i)) {
      const c = clause(s);
      if (c === null) return null;
      if (c === 'unset') unset++;
      else clauses.push(c);
    }
    if (clauses.length === 0) return null;
    if (unset > 0) clauses.push(unset === 1 ? 'one matchup is to be set' : `${unset} matchups are to be set`);
    parts.push(`${view.rounds[i].label}: ${clauses.join('; ')}.`);
  }
  const next = nextGame(played.flatMap(seriesOf), after(at, played), startOf, now);
  return next ? `${parts.join(' ')} Next game: ${gameText(next)}.` : parts.join(' ');
}
