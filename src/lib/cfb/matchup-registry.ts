// The curated matchup registry. Static data, no IO, so it can be imported by
// tests and by Firestore-free code paths alike.
//
// The slug is CURATED, not derived. Slugifying rivalry names collides: three
// distinct rivalries are all named "Victory Bell" and three more are all
// "Florida Cup". An explicit registry keeps the URL stable even if a rivalry doc
// is renamed upstream, and keeps the family scoped to the ~30 named high-demand
// rivalries rather than all 212 docs (97 of which are auto-generated
// "SchoolA-SchoolB" pair labels and are permanently out of scope).

export interface MatchupRegistryEntry {
  /** URL slug: /cfb/rivalries/{slug} */
  slug: string;
  /** cfbRivalries doc id. */
  rivalryId: string;
  /** EDITORIAL override for the H1, the title and the rail label.
   *
   *  cfbRivalries.name is a data field: it holds the trophy or the historical
   *  name, which is not always the string anyone searches for. The H1 is a
   *  search target, so when the two disagree the search target wins and the
   *  historical name survives in the trophy block instead of being lost.
   *
   *  This lives in the curated registry rather than in Firestore on purpose.
   *  It is an editorial decision, and the registry is code, so it is outside
   *  the blast radius of the quarantined Phase 2 writer. */
  displayName?: string;
}

/** Build order is search demand, highest first. Every entry was verified in the
 *  Phase 1A audit to resolve against a real cfbRivalries doc. */
export const MATCHUP_REGISTRY: readonly MatchupRegistryEntry[] = [
  { slug: 'iron-bowl', rivalryId: 'alabama--auburn' },
  { slug: 'egg-bowl', rivalryId: 'mississippi-state--ole-miss' },
  { slug: 'apple-cup', rivalryId: 'washington--washington-state' },
  { slug: 'the-game', rivalryId: 'michigan--ohio-state' },
  { slug: 'red-river-rivalry', rivalryId: 'oklahoma--texas' },
  // cfbRivalries.name is "Okefenokee Oar", which is close to unsearched. Ahrefs
  // resolves this matchup's parent topic to "georgia vs florida" at TP 15,000.
  // Not "World's Largest Outdoor Cocktail Party": long, punctuation-heavy and
  // dropping from official use. The oar keeps its place in the trophy block.
  { slug: 'florida-georgia', rivalryId: 'florida--georgia', displayName: 'Florida vs Georgia' },
  { slug: 'magnolia-bowl', rivalryId: 'lsu--ole-miss' },
  { slug: 'palmetto-bowl', rivalryId: 'clemson--south-carolina' },
  { slug: 'sunflower-showdown', rivalryId: 'kansas--kansas-state' },
  { slug: 'third-saturday-in-october', rivalryId: 'alabama--tennessee' },
  { slug: 'lone-star-showdown', rivalryId: 'texas--texas-am' },
  { slug: 'paul-bunyans-axe', rivalryId: 'minnesota--wisconsin' },
  { slug: 'little-brown-jug', rivalryId: 'michigan--minnesota' },
  { slug: 'floyd-of-rosedale', rivalryId: 'iowa--minnesota' },
  { slug: 'old-oaken-bucket', rivalryId: 'indiana--purdue' },
  { slug: 'clean-old-fashioned-hate', rivalryId: 'georgia--georgia-tech' },
  { slug: 'deep-souths-oldest-rivalry', rivalryId: 'auburn--georgia' },
  { slug: 'holy-war', rivalryId: 'byu--utah' },
  { slug: 'big-game', rivalryId: 'california--stanford' },
  // cfbRivalries.name is "Duel in the Desert" while both the trophy and the slug
  // say Territorial Cup. Lead with the trophy, which is the name in use.
  { slug: 'territorial-cup', rivalryId: 'arizona--arizona-state', displayName: 'Territorial Cup' },
  { slug: 'heroes-trophy', rivalryId: 'iowa--nebraska' },
  { slug: 'cy-hawk-trophy', rivalryId: 'iowa--iowa-state' },
  { slug: 'megaphone-trophy', rivalryId: 'michigan-state--notre-dame' },
  { slug: 'legends-trophy', rivalryId: 'notre-dame--stanford' },
  // THREE separate rivalries are named "Victory Bell" in cfbRivalries. Two of
  // them are in this registry, so without an override these pages shipped an
  // identical H1 and competed against each other on one string.
  { slug: 'victory-bell-ucla-usc', rivalryId: 'ucla--usc', displayName: 'UCLA vs USC' },
  { slug: 'victory-bell-duke-unc', rivalryId: 'duke--north-carolina', displayName: 'Duke vs North Carolina' },
  { slug: 'golden-boot', rivalryId: 'arkansas--lsu' },
  { slug: 'commonwealth-cup', rivalryId: 'virginia--virginia-tech' },
  { slug: 'land-of-lincoln-trophy', rivalryId: 'illinois--northwestern' },
  { slug: 'illibuck', rivalryId: 'illinois--ohio-state' },
  { slug: 'farmageddon', rivalryId: 'iowa-state--kansas-state' },
  { slug: 'governors-cup', rivalryId: 'kentucky--louisville' },
] as const;

const BY_RIVALRY_ID = new Map(MATCHUP_REGISTRY.map((e) => [e.rivalryId, e]));

/** The registry entry for a cfbRivalries doc id, or null when that rivalry has
 *  no matchup page.
 *
 *  Resolve through the REGISTRY, never by slugifying the rivalry name: three
 *  rivalries are named "Victory Bell" and three more "Florida Cup", so a derived
 *  slug would point several schools at one wrong page. */
export function matchupEntryForRivalryId(rivalryId: string | null | undefined): MatchupRegistryEntry | null {
  if (!rivalryId) return null;
  return BY_RIVALRY_ID.get(rivalryId) ?? null;
}

/** Convenience for callers that only need the href. */
export function matchupHrefForRivalryId(rivalryId: string | null | undefined): string | null {
  const e = matchupEntryForRivalryId(rivalryId);
  return e ? `/cfb/rivalries/${e.slug}` : null;
}

const BY_SLUG_REG = new Map(MATCHUP_REGISTRY.map((e) => [e.slug, e]));

/** The registry entry for a matchup slug, or null. */
export function matchupEntryForSlug(slug: string | null | undefined): MatchupRegistryEntry | null {
  if (!slug) return null;
  return BY_SLUG_REG.get(slug) ?? null;
}
