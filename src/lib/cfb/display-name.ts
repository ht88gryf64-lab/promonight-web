// What a matchup page LEADS with, and the guard against two pages leading with
// the same string. Pure and Firestore-free so both are unit-testable.

import type { MatchupRegistryEntry } from '@/lib/cfb/matchup-registry';

/** The name a page LEADS with. The editorial override when present, otherwise
 *  the rivalry doc's own name. Drives the H1, the title and the rail label so
 *  all three stay in step. */
export function resolveMatchupDisplayName(
  entry: Pick<MatchupRegistryEntry, 'displayName'> | null | undefined,
  rivalryName: string,
): string {
  return entry?.displayName?.trim() || rivalryName;
}

/** Any display name claimed by more than one slug.
 *
 *  Two pages leading with one string compete against each other, which is
 *  exactly what shipped when both Victory Bell rivalries rendered
 *  "Victory Bell 2026". Pure so it can be unit-tested, and run over live data
 *  at build time by the index loader. */
export function findDisplayNameCollisions(
  rows: Array<{ slug: string; name: string }>,
): Array<{ name: string; slugs: string[] }> {
  const bySeen = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (!bySeen.has(k)) bySeen.set(k, []);
    bySeen.get(k)!.push(r.slug);
  }
  return [...bySeen.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([, slugs]) => ({ name: rows.find((r) => r.slug === slugs[0])!.name, slugs }));
}
