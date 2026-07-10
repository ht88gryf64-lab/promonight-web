import type { TeamCoords } from '@/lib/data';
import type { DigestPromo } from '@/lib/digest';
import { haversineKm } from '@/lib/geo/distance';

// Local-relevance engine for the empty-window digest. Given an anchor point, a
// promo is "local" when its team's HOME VENUE is within LOCAL_RADIUS_KM of the
// anchor (a promo happens at its team's stadium). Pure and dependency-free at
// runtime (only the Haversine util + types), so it is importable from the cron,
// the email builder, and read-only scripts alike.

// ~150 km. Tight enough that "around {city}" means the same metro / nearby
// markets, not a whole region.
export const LOCAL_RADIUS_KM = 150;

export type AnchorSource = 'stored-geo' | 'team-proxy' | 'none';

export interface LocalAnchor {
  source: AnchorSource;
  lat: number | null;
  lng: number | null;
  city: string | null;
}

// The three cascade levels as they RESOLVE (i.e. what actually produced the
// body): stored-geo / team-proxy only when that level yielded >=1 local promo,
// otherwise national-fallback.
export type CascadeLevel = 'stored-geo' | 'team-proxy' | 'national-fallback';

// Stored subscriber geo captured at signup (PART 1). All optional: records that
// predate geo capture simply have none, which drops the cascade to team-proxy.
export interface StoredGeo {
  geoCity?: string | null;
  geoRegion?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
}

// Best available human city label per team for the "Happening around {city}"
// heading: the venue's parsed locality when we have it (e.g. Minneapolis for the
// Twins), else the team's own city field, which for most leagues is the metro
// (Dallas, Los Angeles). Some co-tenant / name-mismatch venues have no parsed
// locality, so the team.city fallback keeps the heading from going blank.
export function buildTeamCityMap(
  teams: ReadonlyArray<{ id: string; city: string }>,
  venueLocalities: Map<string, { addressLocality?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) {
    const locality = venueLocalities.get(t.id)?.addressLocality;
    map.set(t.id, locality && locality.length > 0 ? locality : t.city);
  }
  return map;
}

export function hasValidCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

// Promos whose team's home venue is within maxKm of (lat,lng). Order preserved
// (windowPromos arrives date-sorted). A promo whose team has no resolvable venue
// coords is simply not counted as local.
export function promosWithinKm(
  lat: number,
  lng: number,
  promos: DigestPromo[],
  coords: Map<string, TeamCoords>,
  maxKm: number = LOCAL_RADIUS_KM,
): DigestPromo[] {
  return promos.filter((p) => {
    const c = coords.get(p.teamId);
    if (!c) return false;
    return haversineKm(lat, lng, c.lat, c.lng) <= maxKm;
  });
}

export interface ResolvedLocal {
  anchor: LocalAnchor;
  localPromos: DigestPromo[];
  // Convenience: the level that actually produced content. national-fallback
  // whenever localPromos is empty (no anchor, or an anchor with nothing near).
  level: CascadeLevel;
}

/**
 * Resolve the empty-window anchor via the three-level cascade and return the
 * local promos it surfaces:
 *
 *   1. stored-geo   the subscriber's captured signup geo, if valid
 *   2. team-proxy   the followed team whose home market has the MOST promos in
 *                   the window (so the local section leads with the market that
 *                   actually has content); its venue city labels the section
 *   3. none         no stored geo and no followed team has venue coords
 *
 * `level` collapses to 'national-fallback' whenever the resolved anchor has zero
 * local promos, since the email then renders the national hot-promos body.
 */
export function resolveLocalAnchor(opts: {
  stored: StoredGeo | null | undefined;
  followedTeamIds: string[];
  windowPromos: DigestPromo[];
  coords: Map<string, TeamCoords>;
  cityByTeamId: Map<string, string>;
}): ResolvedLocal {
  const { stored, followedTeamIds, windowPromos, coords, cityByTeamId } = opts;

  // Level 1: stored subscriber geo.
  if (stored && hasValidCoords(stored.geoLat, stored.geoLng)) {
    const lat = stored.geoLat as number;
    const lng = stored.geoLng as number;
    const localPromos = promosWithinKm(lat, lng, windowPromos, coords);
    const anchor: LocalAnchor = { source: 'stored-geo', lat, lng, city: stored.geoCity ?? null };
    return { anchor, localPromos, level: localPromos.length > 0 ? 'stored-geo' : 'national-fallback' };
  }

  // Level 2: team-market proxy. Consider every followed team with venue coords
  // and pick the market with the most nearby promos (deterministic: ties keep
  // the earlier-followed team). This maximizes the chance the local section has
  // content and picks the city the subscriber most plausibly cares about.
  let best: { lat: number; lng: number; city: string | null; localPromos: DigestPromo[] } | null = null;
  for (const id of followedTeamIds) {
    const c = coords.get(id);
    if (!c) continue;
    const localPromos = promosWithinKm(c.lat, c.lng, windowPromos, coords);
    if (!best || localPromos.length > best.localPromos.length) {
      best = { lat: c.lat, lng: c.lng, city: cityByTeamId.get(id) ?? null, localPromos };
    }
  }
  if (best) {
    const anchor: LocalAnchor = { source: 'team-proxy', lat: best.lat, lng: best.lng, city: best.city };
    return { anchor, localPromos: best.localPromos, level: best.localPromos.length > 0 ? 'team-proxy' : 'national-fallback' };
  }

  // Level 3: no anchor at all.
  return {
    anchor: { source: 'none', lat: null, lng: null, city: null },
    localPromos: [],
    level: 'national-fallback',
  };
}
