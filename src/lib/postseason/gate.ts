// When the Playoffs link shows. PURE.
//
// One rule, used by the nav, the brand bar, the mobile menu and the sitemap:
//
//   ACTIVE           any current-season bracket has a series that is not
//                    final. The link shows.
//   CHAMPION WINDOW  every series in every current-season bracket is final,
//                    and the last of them went final no more than 14 days
//                    ago. The link shows.
//   HIDDEN           anything else: no bracket at all, or the window closed.
//
// "When a series went final" is read from the games, not from the document's
// change stamp. The stamp moves on any rewrite (a restore, a reseed, a feed
// that drops an unplayed row), and each of those would reopen the window. The
// start of the last final game does not move. It is early by the length of
// one game, a few hours against a window of fourteen days.
import type { Bracket } from './types';

export const CHAMPION_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PlayoffsLinkState =
  | { state: 'active' }
  | { state: 'champion_window'; lastFinalAt: string; closesAt: string }
  | { state: 'hidden'; reason: 'no_bracket' | 'window_closed' | 'no_final_time' };

/** The latest instant this bracket can show for a game that ended: the start
 *  of its last final game, or, when no final game carries a start, the
 *  document's change stamp. Null when it has neither. */
function lastFinalInstant(b: Bracket): number | null {
  let latest: number | null = null;
  for (const s of b.series) {
    for (const g of s.games) {
      if (g.status !== 'final' || g.start === null) continue;
      const ms = Date.parse(g.start);
      if (!Number.isNaN(ms) && (latest === null || ms > latest)) latest = ms;
    }
  }
  if (latest !== null) return latest;
  if (b.lastChangedAt === null) return null;
  const stamp = Date.parse(b.lastChangedAt);
  return Number.isNaN(stamp) ? null : stamp;
}

/**
 * `brackets` is every current-season bracket that could be read. A league
 * with no document, or a document the mapper refused, is simply not in the
 * list: it proves nothing, so it opens nothing.
 */
export function playoffsLinkState(brackets: readonly Bracket[], now: Date): PlayoffsLinkState {
  if (brackets.length === 0) return { state: 'hidden', reason: 'no_bracket' };

  const stillPlaying = brackets.some((b) => b.series.some((s) => s.status !== 'final'));
  if (stillPlaying) return { state: 'active' };

  // Every series everywhere is final. The window runs from the LAST of them.
  let last: number | null = null;
  for (const b of brackets) {
    const at = lastFinalInstant(b);
    // A finished bracket that cannot say when it finished cannot open a
    // window measured from that moment.
    if (at === null) return { state: 'hidden', reason: 'no_final_time' };
    if (last === null || at > last) last = at;
  }
  const closes = (last as number) + CHAMPION_WINDOW_DAYS * DAY_MS;
  if (now.getTime() <= closes) {
    return {
      state: 'champion_window',
      lastFinalAt: new Date(last as number).toISOString(),
      closesAt: new Date(closes).toISOString(),
    };
  }
  return { state: 'hidden', reason: 'window_closed' };
}

export function playoffsLinkVisible(brackets: readonly Bracket[], now: Date): boolean {
  return playoffsLinkState(brackets, now).state !== 'hidden';
}
