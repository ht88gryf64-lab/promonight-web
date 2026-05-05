import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSpotHeroUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card SpotHero CTA for the team-page PREPARE FOR THE GAME
// cluster. Visual spec mirrors the CTACluster.jsx mockup: white card,
// orange (#F37021) border, "P" badge, Outfit wordmark.
//
// Same buildSpotHeroUrl as ParkingCTA — venue lat/lng route the user to
// SpotHero's coordinate search; missing coords fall back to spothero.com
// homepage. Pre-approval clicks still route correctly, just without the
// CJ Affiliate pid/sid params (TrackedAffiliateLink emits the
// affiliate_tracking_active flag for PostHog reporting).

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  /** Venue for the team. When supplied with valid lat/lng, the URL routes
   *  via stadium-area parking search. Fallback below. */
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

export function SpotHeroCTA({ team, surface, placement, venue, size = 'full' }: Props) {
  const href = hasCoords(venue)
    ? buildSpotHeroUrl({ latitude: venue.lat, longitude: venue.lng, surface })
    : buildSpotHeroUrl({ surface });

  const padding = size === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3.5';

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
      className={`group flex items-center gap-2.5 w-full rounded-[14px] bg-white border-[1.5px] border-[#F37021] ${padding} shadow-[0_3px_12px_rgba(243,112,33,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(243,112,33,0.22)]`}
    >
      {/* SpotHero "P" badge — orange square, white "P". The brand mark
       *  is the badge itself; reuse it across surfaces in lieu of a logo
       *  image so the prerender stays image-free. */}
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-[#F37021] shrink-0">
        <span className="font-outfit font-black text-[16px] text-white leading-none">
          P
        </span>
      </span>

      <span
        className="font-outfit font-extrabold text-[15px] text-[#F37021]"
        style={{ letterSpacing: '-0.2px' }}
      >
        SpotHero
      </span>

      <span className="font-outfit font-semibold text-[14px] text-[#0a0a0a]">
        Reserve Parking
      </span>

      <span
        aria-hidden="true"
        className="ml-auto text-[#F37021] text-[17px] leading-none transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
