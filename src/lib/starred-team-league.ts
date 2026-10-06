// The league of a starred team, for the My Teams route (WEB6 G2).
//
// FAIL CLOSED. The package rule (src/lib/ticket-packages.ts) applies only when
// the league is known to be NHL or NBA. If the cached teams lookup misses or
// throws, the team doc is read directly; if that fails too the error reaches
// the route's per-team catch, which returns nothing for that team and logs,
// rather than listing its special-ticket rows as promotions (review rounds 2
// and 3). Lookups are injectable so both failure paths are tested.
import { db } from './firebase';
import { getTeamBySlug } from './data';

type Lookup = (slug: string) => Promise<{ league: string } | null>;
type ReadDoc = (slug: string) => Promise<{ league?: unknown } | undefined>;

const readTeamDoc: ReadDoc = async (slug) => (await db.collection('teams').doc(slug).get()).data();

export async function starredTeamLeague(
  slug: string,
  lookup: Lookup = getTeamBySlug,
  readDoc: ReadDoc = readTeamDoc,
): Promise<string> {
  const team = await lookup(slug).catch(() => null);
  if (team) return team.league;
  return String((await readDoc(slug))?.league ?? '');
}
