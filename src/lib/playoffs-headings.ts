/**
 * Which tag the /playoffs offseason section's lead heading takes.
 *
 * Its own module, with no Firestore or server-only imports, so the rule can be
 * unit-tested. Importing it from src/app/playoffs/page.tsx would drag in
 * src/lib/data.ts and therefore `server-only`, which throws outside a server
 * component and takes the whole test file with it.
 *
 * THE INVARIANT: exactly one h1 on the offseason view, and ChampionsCelebration
 * owns it whenever it mounts. Before 2026-09-01 the page served none, because
 * the offseason early return sits above the live hub's heading and the highest
 * heading in main was an h2. Promoting it unconditionally would have traded
 * that for two h1s every time the champions window is open, which is a defect
 * that would not have surfaced until next June.
 */
export function offseasonHeadingTag(showChampions: boolean): 'h1' | 'h2' {
  return showChampions ? 'h2' : 'h1';
}
