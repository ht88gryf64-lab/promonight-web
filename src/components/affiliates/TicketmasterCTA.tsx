import Image from 'next/image';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl, buildTicketNetworkLink, TICKET_VENDOR } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card CTA that visually breaks from PromoNight's red/dark
// theme to signal "external destination". Visual spec mirrors the
// CTACluster.jsx mockup hero: white card, 1.5px navy (#003C71) border,
// italic Outfit wordmark in brand navy, weight-700 "Get Tickets" in
// #0a0a0a, navy arrow.
//
// Hero sizing (full): wider padding 16x18, larger shadow, gap-3 for the
// hero placement. Compact tightens padding for modal stacks and playoff
// cards while keeping the same border / wordmark / colors so the brand
// identity is consistent across surfaces.
//
// `surface` rides through the wrap template's SharedID for partner-side
// reporting; per-promo attribution stays on PostHog's affiliate_click event.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  promoId?: string | null;
  /** 'full' (default) — team-page hero / standalone use.
   *  'compact' — tighter padding, fits inside playoff cards / modal stacks. */
  size?: 'full' | 'compact';
};

export function TicketmasterCTA({ team, surface, placement, promoId, size = 'full' }: Props) {
  // Active ticket vendor (TICKET_VENDOR). Both link-builders are kept wired so
  // flipping the flag in affiliates.ts is a one-line rollback to Ticketmaster.
  const vendor = TICKET_VENDOR;

  // subId1 surface segment for TicketNetwork: away-game CTAs attribute to
  // 'web_away_game' (mirrors lib/hotel-link.ts); every other placement uses the
  // page surface. team.id is appended by the builder for cross-partner joins.
  const tnSurface: AnalyticsSurface | 'web_away_game' =
    placement === 'away_game_card' ? 'web_away_game' : surface;

  const href =
    vendor === 'ticketnetwork'
      ? buildTicketNetworkLink({ team, surface: tnSurface })
      : buildTicketmasterUrl({
          teamSlug: team.id,
          ticketmasterSlug: team.ticketmasterSlug,
          ticketmasterAttractionId: team.ticketmasterAttractionId,
          surface,
          promoId,
        });

  // Graceful fallback — never render a broken ticket link (e.g. a team whose
  // TicketNetwork slug can't be resolved). Hide the CTA entirely.
  if (!href) return null;

  const partner = vendor === 'ticketnetwork' ? 'ticketnetwork' : 'ticketmaster';

  // Full = mockup hero spec (px-[18px] py-4 = 16x18, gap-3, shadow 0 4px
  // 16px). Compact tightens for inline placements where the card sits in a
  // dense stack (modal, playoff card).
  const padding = size === 'compact' ? 'px-3.5 py-2.5 gap-2.5' : 'px-[18px] py-4 gap-3';
  const wordmarkSize = size === 'compact' ? 'text-[15px]' : 'text-[17px]';
  const ctaSize = size === 'compact' ? 'text-[14px]' : 'text-[16px]';
  const arrowSize = size === 'compact' ? 'text-[15px]' : 'text-[18px]';
  const cardShadow = size === 'compact'
    ? 'shadow-[0_3px_12px_rgba(0,60,113,0.12)]'
    : 'shadow-[0_4px_16px_rgba(0,60,113,0.12)]';
  // Logo footprint matches the ticketmaster wordmark height; width keeps the
  // asset's native 150x40 aspect ratio (3.75:1) so it isn't distorted.
  const logoHeight = size === 'compact' ? 16 : 20;
  const logoWidth = Math.round(logoHeight * (150 / 40));

  return (
    <TrackedAffiliateLink
      href={href}
      partner={partner}
      teamId={team.id}
      sport={team.league}
      promoId={promoId}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex items-center w-full rounded-[14px] bg-white border-[1.5px] border-[#003C71] ${padding} ${cardShadow} transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,60,113,0.22)]`}
    >
      {vendor === 'ticketnetwork' ? (
        // White-background logo blends into the white card (no recolor/distort).
        <Image
          src="/affiliates/ticketnetwork-logo.png"
          alt="TicketNetwork"
          width={logoWidth}
          height={logoHeight}
        />
      ) : (
        <span
          className={`font-outfit font-extrabold italic lowercase text-[#003C71] ${wordmarkSize}`}
          style={{ letterSpacing: '-0.3px' }}
        >
          ticketmaster
        </span>
      )}
      <span className={`font-outfit font-bold text-[#0a0a0a] ${ctaSize}`}>
        Get Tickets
      </span>
      <span
        aria-hidden="true"
        className={`ml-auto text-[#003C71] ${arrowSize} leading-none transition-transform group-hover:translate-x-0.5`}
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
