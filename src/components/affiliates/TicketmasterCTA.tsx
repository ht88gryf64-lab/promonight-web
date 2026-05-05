import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl } from '@/lib/affiliates';
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
  const href = buildTicketmasterUrl({
    teamSlug: team.id,
    ticketmasterSlug: team.ticketmasterSlug,
    ticketmasterAttractionId: team.ticketmasterAttractionId,
    surface,
    promoId,
  });

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

  return (
    <TrackedAffiliateLink
      href={href}
      partner="ticketmaster"
      teamId={team.id}
      sport={team.league}
      promoId={promoId}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex items-center w-full rounded-[14px] bg-white border-[1.5px] border-[#003C71] ${padding} ${cardShadow} transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,60,113,0.22)]`}
    >
      <span
        className={`font-outfit font-extrabold italic lowercase text-[#003C71] ${wordmarkSize}`}
        style={{ letterSpacing: '-0.3px' }}
      >
        ticketmaster
      </span>
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
