import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { resolveHotelLink, resolveVenueHotelLink } from '@/lib/hotel-link';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Team-page PREPARE-FOR-THE-GAME cluster hotel card. Same card SHAPE as the
// ticket/parking cluster cards, but in the PromoNight promo palette (purple
// accent, NOT a partner brand color) with a small "via Expedia" tag — reads as
// a PromoNight CTA fulfilled by Expedia, not an Expedia ad. Undated venue
// search (the cluster is not tied to one game); fulfilled by Expedia via
// Partnerize. Replaces the old Booking.com card.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  venue?: Venue | null;
  /** Venue-hub mode: building slug. When set, the link is keyed to the BUILDING
   *  (pubref web_venue_{slug}) and the search uses the building overrides below
   *  instead of the team/venue. `team` is still used for the tracking event. */
  venueSlug?: string;
  building?: {
    name: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  /** 'full' (default) — team-page cluster card. 'compact' — modal/playoff. */
  size?: 'full' | 'compact';
};

function BedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v3" />
    </svg>
  );
}

export function ExpediaCTA({ team, surface, placement, venue, venueSlug, building, size = 'full' }: Props) {
  const link =
    venueSlug && building
      ? resolveVenueHotelLink({
          venueSlug,
          venueName: building.name,
          city: building.city,
          lat: building.lat,
          lng: building.lng,
          surface,
        })
      : resolveHotelLink({ team, venue, surface });
  if (!link) return null;

  const padding = size === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3.5';

  return (
    <TrackedAffiliateLink
      href={link.href}
      partner="expedia"
      teamId={team.id}
      sport={team.league}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex items-center gap-2.5 w-full rounded-[14px] bg-white border-[1.5px] border-[#a78bfa] ${padding} shadow-[0_3px_12px_rgba(167,139,250,0.14)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(167,139,250,0.26)]`}
    >
      {/* Purple bed badge — PromoNight promo-palette mark, not a partner logo. */}
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-[#a78bfa] text-white shrink-0">
        <BedIcon />
      </span>

      <span className="flex flex-col items-start leading-tight">
        <span className="font-outfit font-extrabold text-[15px] text-[#1f1830]" style={{ letterSpacing: '-0.3px' }}>
          Find hotels near {link.venueName}
        </span>
        <span className="font-outfit font-medium text-[11px] text-[#6f665a]">2 guests · via Expedia</span>
      </span>

      <span aria-hidden="true" className="ml-auto text-[#a78bfa] text-[17px] leading-none transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </TrackedAffiliateLink>
  );
}
