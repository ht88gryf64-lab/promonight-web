import Image from 'next/image';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl, buildTicketNetworkLink } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Stacked two-button ticket CTA — Ticketmaster on top, TicketNetwork below.
// Each button is an independent branded white-card link that visually breaks
// from PromoNight's red/dark theme to signal "external destination". Visual
// spec mirrors the CTACluster.jsx mockup hero: white card, 1.5px navy (#003C71)
// border, brand mark (Ticketmaster italic Outfit wordmark in brand navy /
// TicketNetwork logo), a "Get Tickets" descriptor, and a navy tap arrow —
// matching the SpotHero / Fanatics card pattern (brand mark + descriptor +
// arrow).
//
// Ticketmaster leads because it is the better-converting partner; its outbound
// URL is wrap-resolved by buildTicketmasterUrl when NEXT_PUBLIC_TICKETMASTER_-
// IMPACT_WRAP is set (Production), with graceful pre-approval fallback to a bare
// ticketmaster.com link. TicketNetwork is always commissionable (hardcoded
// Impact prefix + property IDs). Each button is null-guarded so a vendor whose
// link can't be resolved drops cleanly, leaving the other.
//
// Both buttons fire `affiliate_click` (PostHog + GA4 dual-emit) via
// TrackedAffiliateLink, with distinct `partner` values ('ticketmaster' /
// 'ticketnetwork') and the page `surface` passed straight through.
//
// Hero sizing (full): wider padding 16x18, larger shadow for the hero
// placement. Compact tightens padding + the inter-button gap for modal stacks
// and playoff cards while keeping the same border / brand marks / colors so the
// brand identity is consistent across surfaces.
//
// `surface` rides through the wrap template's SharedID (Ticketmaster) / subId1
// (TicketNetwork) for partner-side reporting; per-promo attribution stays on
// PostHog's affiliate_click event.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  promoId?: string | null;
  /** Venue hub only: building slug, threaded into the affiliate subId so ticket
   *  attribution is per-building (web_venue_{slug} / web_venue_{slug}_{teamId}).
   *  Omitted by every other surface, whose subId stays unchanged. */
  venueSlug?: string;
  /** 'full' (default) — team-page hero / sidebar / standalone use.
   *  'compact' — tighter padding + gap, fits inside playoff cards / modal stacks. */
  size?: 'full' | 'compact';
};

export function TicketmasterCTA({ team, surface, placement, promoId, venueSlug, size = 'full' }: Props) {
  // subId1 surface segment for TicketNetwork: away-game CTAs attribute to
  // 'web_away_game' (mirrors lib/hotel-link.ts); every other placement uses the
  // page surface. team.id is appended by the builder for cross-partner joins.
  // (Ticketmaster carries the page surface directly via its wrap SharedID.)
  const tnSurface: AnalyticsSurface | 'web_away_game' =
    placement === 'away_game_card' ? 'web_away_game' : surface;

  const ticketmasterHref = buildTicketmasterUrl({
    venueSlug,
    teamSlug: team.id,
    ticketmasterSlug: team.ticketmasterSlug,
    ticketmasterAttractionId: team.ticketmasterAttractionId,
    surface,
    promoId,
  });
  const ticketNetworkHref = buildTicketNetworkLink({ team, surface: tnSurface, venueSlug });

  // Graceful fallback — never render a broken ticket link. If neither vendor
  // resolves, hide the CTA entirely; otherwise render whichever buttons resolve.
  if (!ticketmasterHref && !ticketNetworkHref) return null;

  // Full = mockup hero spec (px-[18px] py-4 = 16x18, gap-3, shadow 0 4px 16px).
  // Compact tightens for inline placements where the stack sits in a dense
  // context (modal, playoff card).
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
  // Inter-button gap for the stack — a touch tighter on compact so two cards
  // don't crowd a narrow modal.
  const stackGap = size === 'compact' ? 'gap-2' : 'gap-2.5';

  const cardClass = `group flex items-center w-full rounded-[14px] bg-white border-[1.5px] border-[#003C71] ${padding} ${cardShadow} transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,60,113,0.22)]`;
  const arrowClass = `ml-auto text-[#003C71] ${arrowSize} leading-none transition-transform group-hover:translate-x-0.5`;

  return (
    <div className={`flex w-full flex-col ${stackGap}`}>
      {/* Ticketmaster — top (better-converting partner). */}
      {ticketmasterHref && (
        <TrackedAffiliateLink
          href={ticketmasterHref}
          partner="ticketmaster"
          teamId={team.id}
          sport={team.league}
          promoId={promoId}
          surface={surface}
          placement={placement}
          target="_blank"
          rel="noopener noreferrer sponsored"
          ariaLabel="Get tickets on Ticketmaster"
          className={cardClass}
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
          <span aria-hidden="true" className={arrowClass}>
            →
          </span>
        </TrackedAffiliateLink>
      )}

      {/* TicketNetwork — below. White-background logo blends into the white
          card (no recolor/distort). */}
      {ticketNetworkHref && (
        <TrackedAffiliateLink
          href={ticketNetworkHref}
          partner="ticketnetwork"
          teamId={team.id}
          sport={team.league}
          promoId={promoId}
          surface={surface}
          placement={placement}
          target="_blank"
          rel="noopener noreferrer sponsored"
          ariaLabel="Get tickets on TicketNetwork"
          className={cardClass}
        >
          <Image
            src="/affiliates/ticketnetwork-logo.png"
            alt="TicketNetwork"
            width={logoWidth}
            height={logoHeight}
          />
          <span className={`font-outfit font-bold text-[#0a0a0a] ${ctaSize}`}>
            Get Tickets
          </span>
          <span aria-hidden="true" className={arrowClass}>
            →
          </span>
        </TrackedAffiliateLink>
      )}
    </div>
  );
}
