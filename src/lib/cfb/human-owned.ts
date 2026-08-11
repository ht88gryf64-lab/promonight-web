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
