import Image from 'next/image';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl, buildTicketNetworkLink } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Two-button ticket CTA — Ticketmaster + TicketNetwork. Each button is an
// independent branded white-card link that visually breaks from PromoNight's
// red/dark theme to signal "external destination". Visual spec mirrors the
// CTACluster.jsx mockup hero: white card, 1.5px navy (#003C71) border, brand mark
// (Ticketmaster italic Outfit wordmark in brand navy / TicketNetwork logo), a
// "Get Tickets" descriptor, and a navy tap arrow — matching the SpotHero /
// Fanatics card pattern (brand mark + descriptor + arrow).
//
// TicketNetwork is always commissionable (hardcoded Impact prefix + property
// IDs). Ticketmaster's outbound URL is wrap-resolved by buildTicketmasterUrl when
// NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is set (Production), with graceful
// pre-approval fallback to a bare ticketmaster.com link. Each button is
// null-guarded so a vendor whose link can't be resolved drops cleanly, leaving
// the other.
//
// Both buttons fire `affiliate_click` (PostHog + GA4 dual-emit) via
// TrackedAffiliateLink, with distinct `partner` values ('ticketmaster' /
// 'ticketnetwork') and the page `surface` passed straight through.
//
// ORDER: TicketNetwork leads on every surface (better per-click monetization
// holds the top intercept slot), Ticketmaster second. The order is identical in
// both layouts so the "TN on top" revenue test stays consistent across surfaces.
//
// LAYOUT:
//  - 'stacked' (default): the vertical two-button stack, TicketNetwork on top.
//    Every existing caller is unchanged.
//  - 'inline': a horizontal row of equal-width brand-mark tiles for the
//    /promos/today card CTA row (alongside an inline SpotHeroCTA) — TicketNetwork
//    leftmost, Ticketmaster second. It never wraps: flex-nowrap + min-w-0 +
//    overflow-hidden make wrapping impossible; the "Get Tickets" descriptor and
//    the arrow are container-query-gated (revealed only when the card is wide
//    enough) so three buttons fit down to 360px. Requires an `@container/cta`
//    ancestor (the today card row provides one); with no container, the
//    compressed brand-mark-only form is the safe default.
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
  /** 'stacked' (default) — vertical two-button stack, TicketNetwork-first
   *  (unchanged everywhere). 'inline' — horizontal equal-width brand-mark tiles,
   *  Ticketmaster-first, for the /promos/today card row. */
  layout?: 'stacked' | 'inline';
};

export function TicketmasterCTA({
  team,
  surface,
  placement,
  promoId,
  venueSlug,
  size = 'full',
  layout = 'stacked',
}: Props) {
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

  const inline = layout === 'inline';

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
  const logoHeight = inline ? 15 : size === 'compact' ? 16 : 20;
  const logoWidth = Math.round(logoHeight * (150 / 40));
  // Inter-button gap for the stack — a touch tighter on compact so two cards
  // don't crowd a narrow modal.
  const stackGap = size === 'compact' ? 'gap-2' : 'gap-2.5';

  // Wrapper: vertical stack, or (inline) a horizontal row that takes twice the
  // width of a single sibling tile, so TM + TN + SpotHero read as three roughly
  // equal buttons when the today card lays them out as flex-[2] + flex-1.
  const wrapperClass = inline
    ? 'flex min-w-0 flex-[2] flex-row items-stretch gap-1.5'
    : `flex w-full flex-col ${stackGap}`;

  // Card: shared brand chrome; layout-specific sizing. Inline tiles are
  // equal-width, center-justified, clipping (never wrapping) and >=40px tall.
  const cardBase =
    'group flex items-center rounded-[14px] bg-white border-[1.5px] border-[#003C71] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,60,113,0.22)]';
  const cardClass = inline
    ? `${cardBase} ${cardShadow} min-h-[40px] flex-1 basis-0 min-w-0 justify-center gap-1.5 overflow-hidden px-2 py-1`
    : `${cardBase} ${cardShadow} w-full ${padding}`;
  const arrowClass = inline
    ? `ml-auto hidden text-[#003C71] @[22rem]/cta:inline ${arrowSize} leading-none transition-transform group-hover:translate-x-0.5`
    : `ml-auto text-[#003C71] ${arrowSize} leading-none transition-transform group-hover:translate-x-0.5`;
  // "Get Tickets" descriptor: always shown when stacked; container-gated when
  // inline (revealed only once the card is wide enough for it to fit).
  const descriptorClass = inline
    ? `hidden font-outfit font-bold text-[#0a0a0a] @[26rem]/cta:inline ${ctaSize}`
    : `font-outfit font-bold text-[#0a0a0a] ${ctaSize}`;
  const wordmarkClass = inline
    ? 'font-outfit font-extrabold italic lowercase text-[#003C71] text-[13px]'
    : `font-outfit font-extrabold italic lowercase text-[#003C71] ${wordmarkSize}`;

  const ticketmasterButton = ticketmasterHref ? (
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
      <span className={wordmarkClass} style={{ letterSpacing: '-0.3px' }}>
        ticketmaster
      </span>
      <span className={descriptorClass}>Get Tickets</span>
      <span aria-hidden="true" className={arrowClass}>
        →
      </span>
    </TrackedAffiliateLink>
  ) : null;

  const ticketNetworkButton = ticketNetworkHref ? (
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
        className="shrink-0"
      />
      <span className={descriptorClass}>Get Tickets</span>
      <span aria-hidden="true" className={arrowClass}>
        →
      </span>
    </TrackedAffiliateLink>
  ) : null;

  // TicketNetwork leads on every surface (stacked = top, inline = leftmost):
  // it monetizes better per click (resale commissions dwarf TM's single-game
  // ticket payouts), so it holds the top intercept slot. Keeping the order
  // identical across surfaces keeps the "TN on top" revenue test clean.
  return (
    <div className={wrapperClass}>
      {ticketNetworkButton}
      {ticketmasterButton}
    </div>
  );
}
