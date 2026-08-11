// The rivalry matchup family: /cfb/rivalries/{slug}.
//
// Ahrefs resolves trophy names to MATCHUPS, not trophies ("the game" ->
// "michigan vs ohio state", TP 78,000), so the matchup is the canonical unit and
// the rivalry name is the head term. Schedule-intent queries are unwinnable
// against Google's own sports panel, which is why this family exists separately
// from /cfb/{school}.
//
// The slug is CURATED, not derived. Slugifying rivalry names collides: three
// distinct rivalries are all named "Victory Bell" and three more are all
// "Florida Cup". An explicit registry keeps the URL stable even if a rivalry doc
// is renamed upstream, and keeps the family scoped to the ~30 named
// high-demand rivalries rather than all 212 docs (97 of which are auto-generated
// "SchoolA-SchoolB" pair labels and are permanently out of scope).

import { cache } from 'react';
import type { CfbGame, CfbRivalry, CfbSchool, CfbVenue } from '@/lib/cfb/types';
import { getCfbCorpus } from '@/lib/cfb/data';

export interface MatchupRegistryEntry {
  /** URL slug: /cfb/rivalries/{slug} */
  slug: string;
  /** cfbRivalries doc id. */
  rivalryId: string;
}

/** Build order is search demand, highest first. Every entry was verified in the
 *  Phase 1A audit to resolve against a real cfbRivalries doc. */
export const MATCHUP_REGISTRY: readonly MatchupRegistryEntry[] = [
  { slug: 'iron-bowl', rivalryId: 'alabama--auburn' },
  { slug: 'egg-bowl', rivalryId: 'mississippi-state--ole-miss' },
  { slug: 'apple-cup', rivalryId: 'washington--washington-state' },
  { slug: 'the-game', rivalryId: 'michigan--ohio-state' },
  { slug: 'red-river-rivalry', rivalryId: 'oklahoma--texas' },
  { slug: 'florida-georgia', rivalryId: 'florida--georgia' },
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
  { slug: 'territorial-cup', rivalryId: 'arizona--arizona-state' },
  { slug: 'heroes-trophy', rivalryId: 'iowa--nebraska' },
  { slug: 'cy-hawk-trophy', rivalryId: 'iowa--iowa-state' },
  { slug: 'megaphone-trophy', rivalryId: 'michigan-state--notre-dame' },
  { slug: 'legends-trophy', rivalryId: 'notre-dame--stanford' },
  { slug: 'victory-bell-ucla-usc', rivalryId: 'ucla--usc' },
  { slug: 'victory-bell-duke-unc', rivalryId: 'duke--north-carolina' },
  { slug: 'golden-boot', rivalryId: 'arkansas--lsu' },
  { slug: 'commonwealth-cup', rivalryId: 'virginia--virginia-tech' },
  { slug: 'land-of-lincoln-trophy', rivalryId: 'illinois--northwestern' },
  { slug: 'illibuck', rivalryId: 'illinois--ohio-state' },
  { slug: 'farmageddon', rivalryId: 'iowa-state--kansas-state' },
  { slug: 'governors-cup', rivalryId: 'kentucky--louisville' },
] as const;

const BY_SLUG = new Map(MATCHUP_REGISTRY.map((e) => [e.slug, e]));

/** Registry slugs. Static and cheap: no Firestore read. */
export function getAllMatchupSlugs(): string[] {
  return MATCHUP_REGISTRY.map((e) => e.slug);
}

export function matchupSlugForRivalryId(rivalryId: string): string | null {
  return MATCHUP_REGISTRY.find((e) => e.rivalryId === rivalryId)?.slug ?? null;
}

export interface MatchupPage {
  slug: string;
  rivalry: CfbRivalry & { id: string };
  /** The 2026 meeting, or null when the rivalry is dormant this season. */
  game: (CfbGame & { id: string }) | null;
  /** Both sides, in registry pair order. null when the school is not one of the
   *  86 tracked cfbSchools (Apple Cup's washington-state, for example). A null
   *  side renders as plain text: no link, no spear, no lifted color. */
  schools: [(CfbSchool & { id: string }) | null, (CfbSchool & { id: string }) | null];
  /** Campus venue for a non-neutral game, resolved from the home school. */
  venue: (CfbVenue & { id: string }) | null;
  /** venueHubs doc id for a neutral-site game. NOT a cfbVenues id. */
  neutralVenueHubSlug: string | null;
}

/** Full payload for one matchup, or null when the slug is not in the registry
 *  or its rivalry doc has gone missing. Callers 404 on null. */
export const getMatchupPage = cache(async (slug: string): Promise<MatchupPage | null> => {
  const entry = BY_SLUG.get(slug);
  if (!entry) return null;

  const { schools, venues, rivalries, games } = await getCfbCorpus();

  const rivalry = rivalries.find((r) => r.id === entry.rivalryId);
  if (!rivalry) return null;

  const [aId, bId] = rivalry.schoolIds;
  const schoolById = new Map(schools.map((s) => [s.id, s]));

  // loadGames already drops tombstoned docs, so this cannot pick a redundant one.
  const game = games.find((g) => g.data.rivalryId === entry.rivalryId) ?? null;

  const homeSchool = game ? schoolById.get(game.data.homeSchoolId) ?? null : null;
  const venue = game && !game.data.neutralSite && homeSchool?.venueId
    ? venues.find((v) => v.id === homeSchool.venueId) ?? null
    : null;

  return {
    slug,
    rivalry,
    game: game ? { ...game.data, id: game.docId } : null,
    schools: [schoolById.get(aId) ?? null, schoolById.get(bId) ?? null],
    venue,
    neutralVenueHubSlug: game?.data.neutralVenueHubSlug ?? null,
  };
});
