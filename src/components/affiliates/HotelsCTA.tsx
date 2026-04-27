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
  /** 'modal-row': polished modal row — eyebrow + primary button only. The
   *  surrounding modal card carries the team/venue context.
   *  'card': descriptor card with team name + sentence + outlined button —
   *  used in the /playoffs PLAN YOUR PLAYOFF TRIP grid where each card needs
   *  team identity.
   *  'section': full team-page section with prose. */
  variant?: 'modal-row' | 'card' | 'section';
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

function BedIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v3" />
    </svg>
  );
}

const buttonBase =
  'flex items-center justify-between gap-2 rounded-xl font-bold transition-all hover:-translate-y-0.5';
const primaryFill =
  'bg-gradient-to-b from-accent-red to-accent-red-dim text-white hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]';

export function HotelsCTA({
  team,
  surface,
  venue,
  city,
  placement = 'team_page_footer',
  variant = 'section',
}: HotelsCTAProps) {
  // Button renders regardless of Booking env state — bare URL fallback
  // routes the user to Booking's coordinate/city search pre-approval.
  // Tracking-active state is surfaced to PostHog via TrackedAffiliateLink.

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

  if (variant === 'modal-row') {
    // flex-col + items-start rather than space-y-2.5 — see ParkingCTA for the
    // inline-flex-link wrapping rationale.
    return (
      <div className="flex flex-col items-start gap-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          <BedIcon />
          Book a hotel
        </span>
        <TrackedAffiliateLink
          href={href}
          partner="booking"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className={`${buttonBase} text-sm px-4 py-2.5 ${primaryFill} w-full sm:w-auto sm:min-w-[200px]`}
        >
          <span>Booking.com</span>
          <span aria-hidden="true" className="text-base leading-none opacity-70">›</span>
        </TrackedAffiliateLink>
      </div>
    );
  }

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
