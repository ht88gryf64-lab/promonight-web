// Pure selection/grouping logic for the /venues index page and the league-hub
// venue-guide sections. Deliberately free of 'server-only' and Firestore
// imports so the grouping rules are unit-testable without module mocks; the
// cached Firestore readers that feed these functions live in lib/venue-hub.

export interface VenueIndexEntry {
  /** Building hub slug -> /venues/{slug}. */
  slug: string;
  /** Sponsor-stripped display name (displayVenueName output). */
  name: string;
  city: string | null;
  state: string | null;
  /** Unique tenant leagues, e.g. ['NFL', 'CFB'] for a shared building. */
  leagues: string[];
  /** Topics this building publishes, for the card sub-line. */
  topics: string[];
}

export interface VenueIndexSection {
  league: string;
  heading: string;
  venues: VenueIndexEntry[];
}

// Section order for the /venues index: pro leagues by coverage weight, the
// college block last. A multi-league building (crypto-com-arena hosts NBA, NHL,
// and WNBA tenants) appears once per hosting league section: someone scanning
// "WNBA arena guides" should find Barclays Center there even though it is also
// an NBA arena, and duplicate internal anchors to the same target are harmless.
export const VENUE_INDEX_SECTIONS: ReadonlyArray<{ league: string; heading: string }> = [
  { league: 'MLB', heading: 'MLB ballpark guides' },
  { league: 'NFL', heading: 'NFL stadium guides' },
  { league: 'MLS', heading: 'MLS stadium guides' },
  { league: 'WNBA', heading: 'WNBA arena guides' },
  { league: 'NBA', heading: 'NBA arena guides' },
  { league: 'NHL', heading: 'NHL arena guides' },
  { league: 'CFB', heading: 'College football stadium guides' },
];

// Catch-all so an indexable building whose tenants carry no known league (or no
// tenants at all) still gets its index entry instead of silently vanishing.
const OTHER_SECTION_HEADING = 'More venue guides';

export function groupVenueIndexEntries(entries: VenueIndexEntry[]): VenueIndexSection[] {
  const known = new Set(VENUE_INDEX_SECTIONS.map((s) => s.league));
  const byName = (a: VenueIndexEntry, b: VenueIndexEntry) => a.name.localeCompare(b.name);

  const sections: VenueIndexSection[] = VENUE_INDEX_SECTIONS.map(({ league, heading }) => ({
    league,
    heading,
    venues: entries.filter((e) => e.leagues.includes(league)).sort(byName),
  }));

  const other = entries
    .filter((e) => !e.leagues.some((l) => known.has(l)))
    .sort(byName);
  sections.push({ league: 'OTHER', heading: OTHER_SECTION_HEADING, venues: other });

  return sections.filter((s) => s.venues.length > 0);
}

// ── league hub -> venue links ────────────────────────────────────────────────

/** The slice of TeamVenueHubLink this logic needs (structural, so the real
 *  teamId -> building map from lib/venue-hub satisfies it directly). */
export interface HubVenueLinkSource {
  slug: string;
  displayName: string;
  indexable: boolean;
  city: string | null;
  /** Topics this building publishes, for the card sub-line. */
  topics?: string[];
}

export interface HubVenueLink {
  slug: string;
  name: string;
  city: string | null;
  /** Topics this building publishes, in reading order. Empty when the source
   *  carries none, which the card renders as no sub-line claim at all rather
   *  than the old template listing bag, parking and gates for every building. */
  topics: string[];
}

/** Resolve a league's team ids to their indexable building links, deduped by
 *  building (MetLife appears once for Giants + Jets) and sorted by name.
 *  Below-floor buildings are dropped: same rule as the team-page VenueHubLink,
 *  no dead-end links into noindex hubs. */
export function collectVenueLinksForTeams(
  map: ReadonlyMap<string, HubVenueLinkSource>,
  teamIds: string[],
): HubVenueLink[] {
  const seen = new Set<string>();
  const out: HubVenueLink[] = [];
  for (const id of teamIds) {
    const link = map.get(id);
    if (!link || !link.indexable || seen.has(link.slug)) continue;
    seen.add(link.slug);
    out.push({ slug: link.slug, name: link.displayName, city: link.city, topics: link.topics ?? [] });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ── team page: the old `venues` prose block versus the hub link ──────────────

/** Whether the team page renders the provenance-free `venues` prose block for
 *  this building. It renders only while the building's venueHub is NOT
 *  indexable: once the hub clears the floor (verified + geo + 2 of 3), the hub
 *  is the sourced record and the club page links it instead of repeating
 *  unsourced prose beside it. No data is deleted; a building that drops back
 *  below the floor gets the block back. */
export function rendersVenuesBlock(venue: unknown, hubIndexable: boolean): boolean {
  return venue !== null && venue !== undefined && !hubIndexable;
}
