import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildBookingUrl } from '@/lib/affiliates';
import { VENUE_CITY_OVERRIDES } from '@/lib/venue-cities';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { teamDisplayName } from '@/lib/promo-helpers';

type HotelsCTAProps = {
  team: Team;
  surface: AnalyticsSurface;
  /** Venue for the team. When supplied with valid lat/lng, Booking routes via
   *  coordinates (stadium-area search, ~5-10 mi radius). Fallback below. */
  venue?: Venue | null;
  /** Optional explicit city. Overrides VENUE_CITY_OVERRIDES and team.city.
   *  Rarely needed now that coordinates are primary. */
  city?: string;
  placement?: string;
  variant?: 'card' | 'section';
};

function hasCoords(v: Venue | null | undefined): v is Venue {
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

export function HotelsCTA({
  team,
  surface,
  venue,
  city,
  placement = 'team_page_footer',
  variant = 'section',
}: HotelsCTAProps) {
  // Preferred: venue coordinates (exact stadium-area search).
  // Fallback: explicit prop > VENUE_CITY_OVERRIDES > team.city (brand city).
  const useCoords = hasCoords(venue);
  const fallbackCity = city ?? VENUE_CITY_OVERRIDES[team.id] ?? team.city;
  // Label: when routing by coords, name the venue so users see what's being
  // searched ("near Rogers Centre"). When falling back to city, name the city.
  const destinationLabel = useCoords
    ? (venue!.name || `${teamDisplayName(team)} stadium`)
    : fallbackCity;
  const linkPreposition = useCoords ? 'near' : 'in';

  const href = useCoords
    ? buildBookingUrl({
        latitude: venue!.lat,
        longitude: venue!.lng,
        surface,
        promoId: null,
      })
    : buildBookingUrl({
        location: fallbackCity,
        surface,
        promoId: null,
      });

  if (variant === 'card') {
    return (
      <div className="bg-bg-card border border-border-subtle rounded-xl p-5">
        <h3 className="font-display text-lg tracking-[0.5px] mb-1">
          {teamDisplayName(team)}
        </h3>
        <p className="text-text-secondary text-xs mb-4">
          Traveling for a {team.name} game? Find a hotel {linkPreposition} {destinationLabel}.
        </p>
        <TrackedAffiliateLink
          href={href}
          partner="booking"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-bg-card border border-border-subtle text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all hover:-translate-y-0.5 hover:border-border-hover"
        >
          Find Hotels {linkPreposition} {destinationLabel} →
        </TrackedAffiliateLink>
      </div>
    );
  }

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          Visiting fans
        </span>
        <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 mb-3">
          PLAN YOUR TRIP
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-5 max-w-xl">
          Traveling to see the {teamDisplayName(team)}? Find a hotel {linkPreposition} {destinationLabel} and stay near the action.
        </p>
        <TrackedAffiliateLink
          href={href}
          partner="booking"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
        >
          Find Hotels {linkPreposition} {destinationLabel}
        </TrackedAffiliateLink>
      </div>
    </section>
  );
}
