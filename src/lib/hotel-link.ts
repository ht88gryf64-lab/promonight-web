// Shared resolver for the Expedia hotel CTA. Both hotel CTA components
// (HotelsCTA dark variants + the rebranded team-page cluster card) call this so
// the venue->params mapping, coords/city fallback, dating rule, and pubref
// scheme live in exactly one place.
//
// Rules (build spec / Phase 2 decisions):
// - venueName = venue.name (fallback to team name when no venue doc).
// - city = VENUE_CITY_OVERRIDES[team.id] ?? team.city.
// - coords present  -> latLong included (precise stadium-area search).
//   coords absent    -> city-level search (latLong omitted). Preserves the
//   ~26% of teams that have no coords; only HIDES (returns null) when there is
//   neither coords NOR a resolvable city.
// - gameDate present -> dated search (checkIn = gameDate, checkOut = +1 day)
//   and pubref = web_away_game_{slug}.
//   gameDate absent   -> undated search, pubref = {surface}_{slug}.

import type { Team, Venue } from './types';
import type { AnalyticsSurface } from './analytics';
import { buildExpediaHotelLink, nextDayISO } from './affiliates';
import { VENUE_CITY_OVERRIDES } from './venue-cities';

export interface HotelLinkInput {
  team: Team;
  venue?: Venue | null;
  surface: AnalyticsSurface;
  /** Away-game date (YYYY-MM-DD). Present only on away-game rows. */
  gameDate?: string | null;
}

export interface HotelLink {
  href: string;
  /** For the user-facing label, e.g. "Find hotels near {venueName}". */
  venueName: string;
  city: string;
  hasCoords: boolean;
  dated: boolean;
  checkIn: string | null;
  checkOut: string | null;
}

function coordsOk(v: Venue | null | undefined): v is Venue {
  if (!v) return false;
  const { lat, lng } = v;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

/** Returns null ONLY when there is neither coords nor a resolvable city, so the
 *  CTA can hide rather than render a broken button. (team.city is ~always
 *  present, so this is defensive.) */
export function resolveHotelLink(input: HotelLinkInput): HotelLink | null {
  const { team, venue, surface, gameDate } = input;
  const hasCoords = coordsOk(venue);
  const city = VENUE_CITY_OVERRIDES[team.id] ?? team.city ?? '';
  if (!hasCoords && !city) return null;

  const venueName = venue?.name || `${team.city} ${team.name}`;
  const dated = Boolean(gameDate);
  const checkIn = gameDate ?? null;
  const checkOut = gameDate ? nextDayISO(gameDate) : null;
  const pubref = gameDate ? `web_away_game_${team.id}` : `${surface}_${team.id}`;

  const href = buildExpediaHotelLink({
    venueName,
    city,
    lat: hasCoords ? venue!.lat : null,
    lng: hasCoords ? venue!.lng : null,
    checkIn,
    checkOut,
    pubref,
  });

  return { href, venueName, city, hasCoords, dated, checkIn, checkOut };
}
