import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card CTA that visually breaks from PromoNight's red/dark theme
// to signal "external destination". The lowercase italic wordmark in
// Ticketmaster's brand blue (#024BAA) approximates the official mark; once
// Matt has Impact dashboard access, the official wordmark asset from
// Content > Assets can swap in via a single <Image> tweak.
//
// Single-source ticket CTA — replaces the previous SeatGeek+StubHub pair.
// `surface` rides through the wrap template's SharedID for partner-side
// reporting; per-promo attribution stays on PostHog's affiliate_click event.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  promoId?: string | null;
  /** 'full' (default) — wider button, fits team-page hero / standalone use.
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

  const padding =
    size === 'compact' ? 'px-4 py-2.5 text-sm' : 'px-5 py-3.5 text-[15px]';

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
      className={`group flex items-center justify-between gap-3 w-full rounded-md bg-white text-[#0a0a0a] border border-[#024BAA] ${padding} font-semibold transition-all hover:bg-[#f0f6ff] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(2,75,170,0.25)]`}
    >
      <span className="flex items-baseline gap-2.5">
        <span
          className="italic font-bold tracking-tight text-[#024BAA] lowercase"
          style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
        >
          ticketmaster
        </span>
        <span className="text-[#0a0a0a]">Get Tickets</span>
      </span>
      <span
        aria-hidden="true"
        className="text-[#024BAA] text-base leading-none transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
