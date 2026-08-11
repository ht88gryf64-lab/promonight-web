// Which rivalries the school-page rail surfaces, and in what order. Pure and
// Firestore-free so the cap, the ordering and the "never link nowhere" rule are
// unit-testable without standing up the corpus.
//
// The rail exists because the matchup links were landing 1.2 to 2.1 folds down
// on mobile, behind the entire schedule. It is a JUMP, not a second copy of the
// rivalry cards, so it stays deliberately thin: name, date, link.

import { matchupEntryForRivalryId } from '@/lib/cfb/matchup-registry';
import { resolveMatchupDisplayName } from '@/lib/cfb/display-name';

/** Four is the most that reads cleanly on a 390px viewport. Alabama plays 5
 *  rivalries and Auburn 7, so the cap is load-bearing, not theoretical. */
export const RAIL_MAX_CHIPS = 4;

export type RailGameInput = {
  date: string;
  rivalry: { id: string; name: string } | null;
};

export type RailChip = {
  slug: string;
  label: string;
  date: string;
};

/** Rivalries this school plays that HAVE a matchup page, soonest first, deduped
 *  by destination and capped. A rivalry with no page is skipped outright rather
 *  than rendered as a dead chip, which is why the empty array is a normal
 *  result: 41 of the 86 schools return one. */
export function selectRailChips(games: RailGameInput[], max: number = RAIL_MAX_CHIPS): RailChip[] {
  if (max <= 0) return [];
  const seen = new Set<string>();
  const chips: RailChip[] = [];

  // Sort a copy. The caller's array is the rendered schedule and must not move.
  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!g.rivalry) continue;
    const entry = matchupEntryForRivalryId(g.rivalry.id);
    if (!entry) continue;
    if (seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    chips.push({
      slug: entry.slug,
      // Same resolver the matchup page uses for its own H1, so a chip and the
      // page it points at can never disagree about what the rivalry is called.
      label: resolveMatchupDisplayName(entry, g.rivalry.name),
      date: g.date,
    });
    if (chips.length >= max) break;
  }
  return chips;
}
