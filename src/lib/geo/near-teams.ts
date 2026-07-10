import 'server-only';
import { headers } from 'next/headers';
import type { Team } from '@/lib/types';
import { getTeamVenueCoords, type TeamCoords } from '@/lib/data';
import { getInStateTeamSlugs } from '@/lib/geo/state-to-teams';
import { haversineKm } from '@/lib/geo/distance';

// Re-exported so existing importers/tests keep resolving it from here; the
// implementation now lives in geo/distance.ts (shared with local-promos.ts).
export { haversineKm };

// Geo-aware ordering input for the /follow team picker. Soft signal only: it
// produces an ORDERED list of "near you" team slugs; the caller floats them to
// the top of the picker without ever filtering or hiding any team.
//
// Primary signal: Vercel edge geo lat/long, Haversine distance to each team's
// home venue. Coarse fallback: the visitor's US state (x-vercel-ip-country-
// region) mapped to in-state teams. No geo, or non-US with nothing nearby,
// yields an empty list (the picker renders its default order with no group).

const NEAR_COUNT = 8;
// ~500 miles. Beyond this we treat a team as "not near", so a non-US visitor
// (nearest US venue thousands of km away) gets no "near you" group.
const NEAR_MAX_KM = 800;

// Rank teams by venue distance from the visitor; nearest first, within range,
// capped. Pure; exported for tests.
export function rankNearestTeams(
  visitorLat: number,
  visitorLng: number,
  teams: Team[],
  coords: Map<string, TeamCoords>,
  count = NEAR_COUNT,
  maxKm = NEAR_MAX_KM,
): string[] {
  const ranked: { id: string; km: number }[] = [];
  for (const t of teams) {
    const c = coords.get(t.id);
    if (!c) continue;
    const km = haversineKm(visitorLat, visitorLng, c.lat, c.lng);
    if (km <= maxKm) ranked.push({ id: t.id, km });
  }
  ranked.sort((a, b) => a.km - b.km);
  return ranked.slice(0, count).map((r) => r.id);
}

/**
 * Ordered "near you" team slugs for the current request, read live from the
 * Vercel geo headers. Returns [] when there is no usable geo signal, so the
 * caller can fall back to the default picker order with no group and no error.
 */
export async function getNearTeamIds(teams: Team[]): Promise<string[]> {
  const h = await headers();
  const lat = Number(h.get('x-vercel-ip-latitude'));
  const lng = Number(h.get('x-vercel-ip-longitude'));
  const country = h.get('x-vercel-ip-country');
  const region = h.get('x-vercel-ip-country-region');
  const validIds = new Set(teams.map((t) => t.id));

  // Primary: precise lat/long -> Haversine to venue coords.
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    const coords = await getTeamVenueCoords(teams);
    const near = rankNearestTeams(lat, lng, teams, coords);
    if (near.length > 0) return near;
    // lat/long present but nothing within range (non-US): fall through.
  }

  // Coarse fallback: US state -> in-state teams (already slug-ordered).
  if (country === 'US' && region) {
    const inState = getInStateTeamSlugs(region).filter((id) => validIds.has(id));
    if (inState.length > 0) return inState.slice(0, NEAR_COUNT);
  }

  return [];
}
