import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSpotHeroUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card SpotHero CTA for the team-page PREPARE FOR THE GAME
// cluster. White card, SpotHero-blue (#1271eb, SpotHero's brand blue) border,
// "P" badge, Outfit wordmark, matching the true-brand-color pattern of the
// other cards in the stack (Ticketmaster navy, Expedia purple, Fanatics black).
//
// Same buildSpotHeroUrl as ParkingCTA — venue lat/lng route the user to
// SpotHero's coordinate search through the HasOffers aff_c tracker (aff_id=2427);
// missing coords fall back to spothero.com. Attribution is always active (aff_c +
// aff_id are hardcoded), so affiliate_tracking_active reads true on the click.
//
// LAYOUT:
//  - 'stacked' (default): the full-width white card (unchanged everywhere).
//  - 'inline': an equal-width brand-mark tile for the /promos/today card CTA row
//    (rightmost, after the inline TicketmasterCTA's TM + TN tiles). Never wraps:
//    flex-1 + min-w-0 + overflow-hidden; the "Reserve Parking" descriptor and the
//    arrow are container-query-gated (revealed only when the card is wide enough),
//    so the row fits down to 360px. Needs an `@container/cta` ancestor (the today
//    card row provides one); with none, the compressed form is the safe default.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  /** Venue for the team. When supplied with valid lat/lng, the URL routes
   *  via stadium-area parking search. Fallback below. */
  venue?: Venue | null;
  /** Venue-hub mode: building slug. When set, aff_sub becomes
   *  `${surface}_${venueSlug}` (e.g. web_venue_arrowhead-stadium) — building-
   *  keyed, never tenant-keyed — mirroring the ticket CTA's venueSlug scheme. */
  venueSlug?: string;
  /** Venue-hub mode: coordinate source when there is no team Venue doc (the hub
   *  passes the building's own lat/lng). Takes precedence over `venue`. */
  coords?: { lat: number; lng: number } | null;
  /** 'full' (default) — team-page cluster card.
   *  'compact' — tighter padding for modal stacks / playoff cards. */
  size?: 'full' | 'compact';
  /** 'stacked' (default) — full-width card (unchanged). 'inline' — equal-width
   *  brand-mark tile for the /promos/today card row. */
  layout?: 'stacked' | 'inline';
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

export function SpotHeroCTA({ team, surface, placement, venue, venueSlug, coords, size = 'full', layout = 'stacked' }: Props) {
  // Per-surface sub-ID. Team-page: web_team_page_{teamId}. Venue hub: the
  // building-keyed web_venue_{buildingSlug}. Rides aff_c as aff_sub.
  const subKey = venueSlug ? `${surface}_${venueSlug}` : `${surface}_${team.id}`;
  // Coordinate source: an explicit hub coords override wins, else the team Venue.
  const point = coords ?? (hasCoords(venue) ? { lat: venue.lat, lng: venue.lng } : null);
  const href = point
    ? buildSpotHeroUrl({ latitude: point.lat, longitude: point.lng, subKey })
    : buildSpotHeroUrl({ subKey });

  const inline = layout === 'inline';
  const padding = inline ? 'px-2 py-2.5' : size === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3.5';

  const cardBase =
    'group flex items-center rounded-[14px] bg-white border-[1.5px] border-[#1271eb] shadow-[0_3px_12px_rgba(18,113,235,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(18,113,235,0.22)]';
  const cardClass = inline
    ? `${cardBase} ${padding} min-h-[40px] flex-1 basis-0 min-w-0 justify-center gap-1.5 overflow-hidden`
    : `${cardBase} ${padding} w-full gap-2.5`;

  return (
    <TrackedAffiliateLink
      href={href}
      partner="spothero"
      teamId={team.id}
      sport={team.league}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      ariaLabel="Reserve parking on SpotHero"
      className={cardClass}
    >
      {/* SpotHero "P" badge — SpotHero-blue square, white "P". The brand mark
       *  is the badge itself; reuse it across surfaces in lieu of a logo
       *  image so the prerender stays image-free. */}
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-[#1271eb] shrink-0">
        <span className="font-outfit font-black text-[16px] text-white leading-none">
          P
        </span>
      </span>

      <span
        className="font-outfit font-extrabold text-[15px] text-[#1271eb]"
        style={{ letterSpacing: '-0.2px' }}
      >
        SpotHero
      </span>

      <span
        className={
          inline
            ? 'hidden font-outfit font-semibold text-[14px] text-[#0a0a0a] @[26rem]/cta:inline'
            : 'font-outfit font-semibold text-[14px] text-[#0a0a0a]'
        }
      >
        Reserve Parking
      </span>

      <span
        aria-hidden="true"
        className={
          inline
            ? 'ml-auto hidden text-[#1271eb] text-[17px] leading-none transition-transform group-hover:translate-x-0.5 @[22rem]/cta:inline'
            : 'ml-auto text-[#1271eb] text-[17px] leading-none transition-transform group-hover:translate-x-0.5'
        }
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
