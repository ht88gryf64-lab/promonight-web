import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildBookingUrl } from '@/lib/affiliates';
import { VENUE_CITY_OVERRIDES } from '@/lib/venue-cities';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card Booking.com CTA for the team-page PREPARE FOR THE
// GAME cluster. Visual spec mirrors the CTACluster.jsx mockup: white card,
// navy (#003580) border, navy circular badge with yellow "B." inside,
// Outfit wordmark.
//
// Same buildBookingUrl + city/coords resolution as HotelsCTA — venue
// lat/lng for stadium-area search, fallback to VENUE_CITY_OVERRIDES then
// team.city. Card text stays generic ("Find Hotels") per brief: venue
// context lives in the section H2 ("AT TARGET FIELD"), not in the card.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  /** Venue for the team. When supplied with valid lat/lng, the URL routes
   *  via Booking's coordinate search (5-10 mi radius). Fallback below. */
  venue?: Venue | null;
  /** 'full' (default) — team-page cluster card.
   *  'compact' — tighter padding for modal stacks / playoff cards. */
  size?: 'full' | 'compact';
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

export function BookingCTA({ team, surface, placement, venue, size = 'full' }: Props) {
  const href = hasCoords(venue)
    ? buildBookingUrl({ latitude: venue.lat, longitude: venue.lng, surface })
    : buildBookingUrl({
        location: VENUE_CITY_OVERRIDES[team.id] ?? team.city,
        surface,
      });

  const padding = size === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3.5';

  return (
    <TrackedAffiliateLink
      href={href}
      partner="booking"
      teamId={team.id}
      sport={team.league}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex items-center gap-2.5 w-full rounded-[14px] bg-white border-[1.5px] border-[#003580] ${padding} shadow-[0_3px_12px_rgba(0,53,128,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(0,53,128,0.22)]`}
    >
      {/* Booking.com signature dot — navy circle, yellow "B." inside.
       *  Standalone glyph in lieu of a logo image; kept inline so the
       *  prerendered HTML doesn't depend on a remote asset. */}
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-[#003580] shrink-0">
        <span className="font-outfit font-black text-[14px] text-[#FEBA02] leading-none">
          B.
        </span>
      </span>

      <span
        className="font-outfit font-extrabold text-[15px] text-[#003580]"
        style={{ letterSpacing: '-0.3px' }}
      >
        Booking.com
      </span>

      <span className="font-outfit font-semibold text-[14px] text-[#0a0a0a]">
        Find Hotels
      </span>

      <span
        aria-hidden="true"
        className="ml-auto text-[#003580] text-[17px] leading-none transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
