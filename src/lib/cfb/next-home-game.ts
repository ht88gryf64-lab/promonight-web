// Which home game the "Plan your gameday" block on a school page points at.
//
// It is the next UNPLAYED home game, and the `played` filter is the whole
// point. Until 2026-09-09 the selector read
//
//   games.find((g) => g.isHome && !g.neutralSite)
//
// which is the FIRST home game of the season, not the next one. Nothing in it
// ever advanced, so once the opener was in the past every school page kept
// advertising it -- with live ticket CTAs underneath. On 2026-09-09,
// /cfb/ohio-state still read "vs Ball State · SEP 5" and /cfb/nebraska
// "vs Ohio · SEP 5", four days after both games were played.
//
// That bug was INVISIBLE while the sweep was broken, because it looks exactly
// like the stale data it sat behind: the CFB sweep had failed on both its
// scheduled fires and 65 games were still stored as `scheduled`. Closing them
// (pipeline main 24fa268) fixed `played` and left this label unmoved, which is
// how the second, older defect surfaced. A status close was necessary and not
// sufficient.
//
// Neutral-site games are excluded because the block sells parking and hotels
// for the school's OWN venue, which is not where a neutral-site game is played.

export interface NextHomeGameInput {
  isHome: boolean;
  neutralSite: boolean;
  /** True once the game has been played. Set from cfbGames.status === 'completed'. */
  played: boolean;
}

/** The next unplayed, non-neutral home game in schedule order, or null when a
 *  school has none left this season (which renders the block without a label,
 *  never with a stale one). */
export function selectNextHomeGame<T extends NextHomeGameInput>(games: readonly T[]): T | null {
  return games.find((g) => g.isHome && !g.neutralSite && !g.played) ?? null;
}
