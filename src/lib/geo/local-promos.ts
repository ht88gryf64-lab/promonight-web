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

// Best human city label per team for the "Happening around {city}" heading.
// League-aware because team.city and the venue's locality disagree in opposite
// directions per league:
//   - MLB team.city is often a STATE (Minnesota, Texas, Arizona), so the venue
//     locality (Minneapolis, Arlington, Phoenix) reads better.
//   - NFL / NBA / MLS / NHL / WNBA team.city is the recognizable METRO (Los
//     Angeles, New York), while the venue often sits in a suburb (Inglewood,
//     Harrison, East Rutherford), so team.city reads better.
// So MLB prefers the venue locality and every other league prefers team.city;
// each falls back to the other when its preferred value is missing, which keeps
// the heading from ever going blank. The ~150km promo search is unaffected: it
// always uses the real venue coordinates, this only changes the display label.
export function buildTeamCityMap(
  teams: ReadonlyArray<{ id: string; city: string; league?: string }>,
  venueLocalities: Map<string, { addressLocality?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) {
    const venueCity =
      typeof venueLocalities.get(t.id)?.addressLocality === 'string' &&
      (venueLocalities.get(t.id)?.addressLocality?.length ?? 0) > 0
        ? (venueLocalities.get(t.id)?.addressLocality as string)
        : null;
    const teamCity = t.city && t.city.length > 0 ? t.city : null;
    const label = t.league === 'MLB' ? venueCity ?? teamCity : teamCity ?? venueCity;
    if (label) map.set(t.id, label);
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
 * local promos it surfaces. Each level is tried only if the previous one found
 * NOTHING nearby, so a stored geo that happens to be quiet does not shortcut
 * past a followed-team market that has content:
 *
 *   1. stored-geo   the subscriber's captured signup geo, if valid AND it has
 *                   >=1 nearby promo
 *   2. team-proxy   else the followed team whose home market has the MOST promos
 *                   in the window (leads the local section with the market that
 *                   actually has content), if that market has >=1
 *   3. national     else no local section: the email renders the national
 *                   hot-promos body. The reported anchor is the most specific
 *                   one tried (stored geo preferred) purely for dry-run context.
 */
export function resolveLocalAnchor(opts: {
  stored: StoredGeo | null | undefined;
  followedTeamIds: string[];
  windowPromos: DigestPromo[];
  coords: Map<string, TeamCoords>;
  cityByTeamId: Map<string, string>;
}): ResolvedLocal {
  const { stored, followedTeamIds, windowPromos, coords, cityByTeamId } = opts;

  // Level 1: stored subscriber geo. Use it only when it actually surfaces nearby
  // promos; if it is present but empty, remember the anchor and fall through to
  // the team proxy before giving up to national.
  let storedAnchor: LocalAnchor | null = null;
  if (stored && hasValidCoords(stored.geoLat, stored.geoLng)) {
    const lat = stored.geoLat as number;
    const lng = stored.geoLng as number;
    const localPromos = promosWithinKm(lat, lng, windowPromos, coords);
    storedAnchor = { source: 'stored-geo', lat, lng, city: stored.geoCity ?? null };
    if (localPromos.length > 0) return { anchor: storedAnchor, localPromos, level: 'stored-geo' };
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
  if (best && best.localPromos.length > 0) {
    const anchor: LocalAnchor = { source: 'team-proxy', lat: best.lat, lng: best.lng, city: best.city };
    return { anchor, localPromos: best.localPromos, level: 'team-proxy' };
  }

  // Level 3: national fallback. Neither anchor surfaced anything, so there is no
  // local section. Report the most specific anchor we tried (stored geo first,
  // else the team market) so the dry-run keeps context.
  const fallbackAnchor: LocalAnchor =
    storedAnchor ??
    (best
      ? { source: 'team-proxy', lat: best.lat, lng: best.lng, city: best.city }
      : { source: 'none', lat: null, lng: null, city: null });
  return { anchor: fallbackAnchor, localPromos: [], level: 'national-fallback' };
}
