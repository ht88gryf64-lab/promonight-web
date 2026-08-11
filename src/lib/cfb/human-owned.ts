// Human-owned fields on cfbGames.
//
// The Phase 2 writer (scripts/cfb/run-phase2.ts) rebuilds cfbGames from the
// parser with a bare set(), and the full-run path wipes the collection first.
// Both are correct for machine-owned fields: the parser is the source of truth
// for dates, kickoffs, broadcast and corroboration, and a re-run should replace
// them wholesale.
//
// Two fields are not machine-derivable. A human decides them and no schedule
// page can rebuild them:
//   tombstoned           a redundant duplicate doc, hidden rather than deleted
//   neutralVenueHubSlug  the venueHubs building a neutral-site game is played in
//
// The writer carries these forward across a rebuild using an ALLOWLIST, not
// { merge: true }. Merge would preserve every stale machine field forever and
// turn the writer into an append-only store; naming the human-owned fields keeps
// everything else machine-owned and freely overwritable.

/** Fields a human decides. Never emitted by the parser, never re-derivable. */
export const HUMAN_OWNED_FIELDS = ['tombstoned', 'neutralVenueHubSlug'] as const;

export type HumanOwnedField = (typeof HUMAN_OWNED_FIELDS)[number];

/** Machine-derived fields whose LOSS is a silent, high-blast-radius failure.
 *
 *  These are NOT preserved. They are machine-owned, and carrying a stale value
 *  forward would be worse than losing it: a rivalryId that no longer reflects
 *  the parse is a lie, whereas a null one is merely absent. So the writer does
 *  not protect them. It TRIPWIRES on them, naming every doc where the field is
 *  about to go from populated to null, so the loss is seen rather than papered
 *  over.
 *
 *  rivalryId earns its place because the entire /cfb/rivalries family keys on
 *  it: getMatchupPage finds a matchup's game by rivalryId, so nulling it on a
 *  doc silently empties the corresponding matchup page. A scoped run-phase2 run
 *  was observed nulling it on 5 of 14 notre-dame docs, two of which back
 *  registry pages. */
export const MACHINE_OWNED_CRITICAL = ['rivalryId'] as const;

/** Fields in MACHINE_OWNED_CRITICAL that are populated on `existing` and null or
 *  absent on `incoming`. Empty when nothing is being lost. */
export function findCriticalLosses(
  existing: Record<string, unknown> | undefined | null,
  incoming: Record<string, unknown>,
): Array<{ field: string; was: unknown }> {
  if (!existing) return [];
  const out: Array<{ field: string; was: unknown }> = [];
  for (const f of MACHINE_OWNED_CRITICAL) {
    const had = existing[f] !== null && existing[f] !== undefined;
    const has = incoming[f] !== null && incoming[f] !== undefined;
    if (had && !has) out.push({ field: f, was: existing[f] });
  }
  return out;
}

/** Visibility predicate for a tombstoned game. This is an app-code array filter
 *  ONLY: absent and false are visible, only true is hidden. It is never used as
 *  a Firestore inequality, which would drop field-absent docs and break the
 *  "absent = visible" rule. Mirrors isVisiblePromo (src/lib/promo-helpers.ts). */
export const isVisibleGame = (g: { tombstoned?: boolean }): boolean => g.tombstoned !== true;

/** The human-owned fields actually present on a stored doc. Absent fields are
 *  omitted entirely so a spread never writes undefined into Firestore. */
export function pickHumanOwned(existing: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!existing) return {};
  const out: Record<string, unknown> = {};
  for (const f of HUMAN_OWNED_FIELDS) {
    if (existing[f] !== undefined) out[f] = existing[f];
  }
  return out;
}
