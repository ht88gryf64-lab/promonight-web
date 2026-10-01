// The PromoNight Predicts line on a club's team page. PURE.
//
// WHAT THE PICK IS. The locked bracket names, for every club in the field,
// the round it goes out in and to whom, or that it wins the title. That is
// the club's last predicted series: picked to lose it, or, in the final round,
// picked to win it. Every earlier predicted series of the club picks it to
// win. The pick line states that and never changes.
//
// WHAT THE STATUS IS. The club's own real series, and nothing else, decide
// the status: the round it is in or went out in, against the round the pick
// names. Another club's result never changes this line, so the page is right
// for exactly as long as the pipeline leaves it alone: the pipeline
// revalidates the page of every club in a series that changed.
//
//   alive      the club is short of the round the pick names, and has not
//              lost. "Pick still alive."
//   decides    the club is in the round the pick names, and the series is
//              not over. "The Division Series decides this pick." When that
//              series already names another club than the one picked: "...
//              The Dream face the Liberty, not the Lynx as picked."
//   correct    out in the round named, to the club named; or picked to win
//              the title and won it.
//   different  out in the round named, to another club. Neither correct nor
//              busted (ruling 4, 2026-10-01): the league page marks that slot
//              against the OTHER club's pick, not this one.
//   busted     out before the round named, or through it.
//
// THE FIRST-SERIES GUARD. The status compares a round in one document with a
// round in the other, which means something only when the club entered the
// two brackets in the same slot. A club whose first predicted series is not
// its first real series gets no line.
//
// NOTHING HERE IS IN THE PRESENT TENSE beyond what the bracket stamp beside
// it covers, and no line says "live", "now" or "today".
import type { PredictedBracket, PredictedSeries } from './predictions';
import type { Bracket, BracketSeries, BracketSlot } from './types';
import type { ClubInfo } from './view';

export type TeamPickKind = 'alive' | 'decides' | 'correct' | 'different' | 'busted';

export interface TeamPickView {
  kind: TeamPickKind;
  /** "PromoNight's pick: Braves to lose the Division Series to the Dodgers." */
  pickLine: string;
  /** "Pick still alive." */
  statusLine: string;
  /** "/playoffs/mlb#predictions". */
  href: string;
}

/** Why a club in the bracket gets no line. A category, never a message. */
export type TeamPickFailure =
  /** The club is in no predicted series. */
  | 'no-team-pick'
  /** The club's first predicted series is not its first real series. */
  | 'first-series-mismatch'
  /** The locked document and the real bracket disagree on something the
   *  line depends on: a pick chain that does not end where it should, a
   *  round the real bracket does not have, or a decided series with a slot
   *  that is not a club. */
  | 'pick-inconsistent'
  /** A club the line names has no team record. */
  | 'no-team-record';

const slugOf = (s: BracketSlot): string | null => (s.kind === 'club' ? s.slug : null);
const lists = (s: BracketSeries, teamId: string) => slugOf(s.higher) === teamId || slugOf(s.lower) === teamId;
const inPredicted = (s: PredictedSeries, teamId: string) => s.higher.slug === teamId || s.lower.slug === teamId;

/** "The Wild Card Series decides", "The Semifinals decide": a label that
 *  ends in a plural takes the plural verb. "Series" is singular. */
export function decidesLine(roundLabel: string): string {
  const plural = /s$/.test(roundLabel) && !/Series$/.test(roundLabel);
  return `The ${roundLabel} ${plural ? 'decide' : 'decides'} this pick.`;
}

/** "2-0": the winner's wins first. */
function tally(s: BracketSeries): string {
  return `${Math.max(s.wins.higher, s.wins.lower)}-${Math.min(s.wins.higher, s.wins.lower)}`;
}

/**
 * The line for one club, or why there is none.
 *
 * `bracket` and `predicted` must already be known to describe the same
 * bracket (assemblePredictions joined them); this function checks only what
 * the line itself depends on. `clubs` holds every club either names.
 */
export function teamPick(
  bracket: Bracket,
  predicted: PredictedBracket,
  teamId: string,
  clubs: ReadonlyMap<string, ClubInfo>,
): TeamPickView | TeamPickFailure {
  // Rounds in the real document's order, which is the bracket's order.
  const rank = new Map<string, number>();
  for (const s of bracket.series) if (!rank.has(s.round)) rank.set(s.round, rank.size);
  const lastRank = rank.size - 1;
  const rankOf = (round: string) => rank.get(round) ?? -1;

  const realByKey = new Map(bracket.series.map((s) => [s.seriesKey, s]));
  const real = bracket.series.filter((s) => lists(s, teamId));
  // In the locked document's own order, which is the engine's round order.
  // The real document must order the club's rounds the same way, and must
  // end in one final series, the locked document's last: a reordered real
  // document would otherwise name the wrong round as the final.
  const mine = predicted.series.filter((s) => inPredicted(s, teamId));
  if (mine.length === 0) return 'no-team-pick';
  if (mine.some((s) => rankOf(s.round) < 0)) return 'pick-inconsistent';
  for (let i = 1; i < mine.length; i++) if (rankOf(mine[i].round) <= rankOf(mine[i - 1].round)) return 'pick-inconsistent';
  const finals = bracket.series.filter((s) => rankOf(s.round) === lastRank);
  if (finals.length !== 1 || finals[0].seriesKey !== predicted.series[predicted.series.length - 1]?.seriesKey) return 'pick-inconsistent';
  if (real.length === 0 || real[0].seriesKey !== mine[0].seriesKey) return 'first-series-mismatch';

  // The chain: picked to win every series but the last.
  for (const s of mine.slice(0, -1)) if (s.pick !== teamId) return 'pick-inconsistent';
  const exit = mine[mine.length - 1];
  const exitRank = rankOf(exit.round);
  const toWinTitle = exit.pick === teamId;
  if (toWinTitle !== (predicted.champion === teamId)) return 'pick-inconsistent';
  if (toWinTitle && exitRank !== lastRank) return 'pick-inconsistent';

  const name = (slug: string) => clubs.get(slug)?.name ?? null;
  const team = name(teamId);
  if (!team) return 'no-team-record';
  const exitSeries = realByKey.get(exit.seriesKey);
  if (!exitSeries) return 'pick-inconsistent';
  const finalLabel = finals[0].roundLabel;

  let pickLine: string;
  let pickedOpponent: string | null = null;
  let pickedName: string | null = null;
  if (toWinTitle) {
    pickLine = `PromoNight's pick: ${team} to win the ${finalLabel}.`;
  } else {
    pickedOpponent = exit.pick;
    pickedName = name(pickedOpponent);
    if (!pickedName) return 'no-team-record';
    pickLine = `PromoNight's pick: ${team} to lose the ${exitSeries.roundLabel} to the ${pickedName}.`;
  }

  const href = `/playoffs/${bracket.league.toLowerCase()}#predictions`;
  const out = (kind: TeamPickKind, statusLine: string): TeamPickView => ({ kind, pickLine, statusLine, href });

  // The club's furthest real series, as the module above the line reads it.
  const last = real[real.length - 1];
  const lastRankReal = rankOf(last.round);
  /** The other club in a decided series of this club, and who won. Null
   *  unless the series is final with two clubs and a score a series can end
   *  on: the winner at the clinching number, the loser short of it. The line
   *  states that score. */
  const decided = (s: BracketSeries): { other: string; won: boolean } | null => {
    if (s.status !== 'final' || !s.winnerSide) return null;
    const hi = slugOf(s.higher);
    const lo = slugOf(s.lower);
    if (!hi || !lo) return null;
    const need = Math.ceil(s.bestOf / 2);
    const loserSide = s.winnerSide === 'higher' ? 'lower' : 'higher';
    if (s.wins[s.winnerSide] !== need || s.wins[loserSide] >= need || s.wins[loserSide] < 0) return null;
    const other = hi === teamId ? lo : hi;
    return { other, won: slugOf(s[s.winnerSide]) === teamId };
  };
  const champion = last.status === 'final' && lastRankReal === lastRank && decided(last)?.won === true;

  /** Went further than picked: through the series the pick has it lose. */
  const further = (): TeamPickView | TeamPickFailure => {
    if (champion) return out('busted', `Pick busted: the ${team} went further than picked and won the ${finalLabel}.`);
    const through = real.find((s) => rankOf(s.round) === exitRank);
    const d = through ? decided(through) : null;
    if (!through || !d || !d.won) return 'pick-inconsistent';
    const opp = name(d.other);
    if (!opp) return 'no-team-record';
    return out('busted', `Pick busted: the ${team} went further than picked, beating the ${opp} ${tally(through)} in the ${through.roundLabel}.`);
  };

  if (last.status !== 'final') {
    if (lastRankReal < exitRank) return out('alive', 'Pick still alive.');
    if (lastRankReal === exitRank) {
      // The club's own series already names another club than the one the
      // pick line names (ruling 2026-10-01). A slot still a placeholder names
      // nobody, and a title pick's line names no opponent: both keep the
      // plain line.
      const otherSlot = slugOf(last.higher) === teamId ? last.lower : last.higher;
      const actual = slugOf(otherSlot);
      if (!toWinTitle && actual !== null && actual !== pickedOpponent) {
        const a = name(actual);
        if (!a) return 'no-team-record';
        return out('decides', `${decidesLine(last.roundLabel)} The ${team} face the ${a}, not the ${pickedName} as picked.`);
      }
      return out('decides', decidesLine(last.roundLabel));
    }
    return further();
  }

  const d = decided(last);
  if (!d) return 'pick-inconsistent';
  if (d.won) {
    if (champion) {
      return toWinTitle ? out('correct', `Pick correct: the ${team} won the ${finalLabel}.`) : further();
    }
    // Won a round short of the final; the next series may not name it yet.
    return lastRankReal < exitRank ? out('alive', 'Pick still alive.') : further();
  }

  // Lost its last series.
  const opp = name(d.other);
  if (!opp) return 'no-team-record';
  if (lastRankReal < exitRank) {
    return out('busted', `Pick busted: the ${team} went out earlier than picked, losing to the ${opp} ${tally(last)} in the ${last.roundLabel}.`);
  }
  if (lastRankReal > exitRank) return further();
  if (toWinTitle) {
    // Picked to win the final, lost it (ruling 2026-10-01).
    return out('busted', `Pick busted: the ${team} lost the ${last.roundLabel} to the ${opp} ${tally(last)}.`);
  }
  if (d.other === pickedOpponent) {
    return out('correct', `Pick correct: the ${opp} beat the ${team} ${tally(last)} in the ${last.roundLabel}.`);
  }
  return out('different', `Right round, different opponent: the ${team} lost to the ${opp} ${tally(last)} in the ${last.roundLabel}. PromoNight picked the ${pickedName}.`);
}
