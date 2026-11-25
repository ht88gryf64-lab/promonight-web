import Image from 'next/image';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildTicketmasterUrl, buildTicketNetworkLink, isTicketNetworkEventUrl, ticketNetworkLinkLevel } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { TICKET_CTA_LABEL } from '@/lib/ticket-labels';
import { ResaleNote, TicketTestNote } from './AffiliateDisclosure';
import { pickTestTicketLink, ticketTestClickProps, type TicketTestResolution } from '@/lib/ticket-test-link';

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
// ORDER: Ticketmaster leads on every surface, TicketNetwork second (2026-10-07,
// the 2.0 app launch; the app's ticket sheet has the same rule). It replaced
// the "TN on top" revenue order. The order is identical in both layouts.
//
// LAYOUT:
//  - 'stacked' (default): the vertical two-button stack, Ticketmaster on top.
//    Every existing caller is unchanged.
//  - 'inline': a horizontal row of equal-width brand-mark tiles for the
//    /promos/today card CTA row (alongside an inline SpotHeroCTA): Ticketmaster
//    leftmost, TicketNetwork second. It never wraps: flex-nowrap + min-w-0 +
//    overflow-hidden make wrapping impossible; the "Get Tickets" descriptor and
//    the arrow are container-query-gated (revealed only when the card is wide
//    enough) so three buttons fit down to 360px. Requires an `@container/cta`
//    ancestor (the today card row provides one); with no container, the
//    compressed brand-mark-only form is the safe default.
//
// The full {surface}_{id} sub-ID rides through the wrap template's SharedID
// (Ticketmaster) and subId1 (TicketNetwork) for partner-side reporting;
// per-promo attribution stays on PostHog's affiliate_click event.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  promoId?: string | null;
  /** Venue hub only: building slug, threaded into the affiliate subId so ticket
   *  attribution is per-building (web_venue_{slug}). Omitted by every other
   *  surface, whose subId stays unchanged. */
  venueSlug?: string;
  /** Complete sub-ID override, used verbatim for BOTH vendors (TN subId1 and
   *  TM SharedID). Away-game rows pass awayGameSubKey(pageTeamId, opponentId)
   *  computed at the call site; this component derives no away key of its own. */
  subKey?: string;
  /** 'full' (default) — team-page hero / sidebar / standalone use.
   *  'compact' — tighter padding + gap, fits inside playoff cards / modal stacks. */
  size?: 'full' | 'compact';
  /** 'stacked' (default): vertical two-button stack, Ticketmaster-first.
   *  'inline': horizontal equal-width brand-mark tiles, Ticketmaster-first,
   *  for the /promos/today card row. */
  layout?: 'stacked' | 'inline';
  /** Render ONE button instead of two: the partner that leads the stack,
   *  Ticketmaster, or TicketNetwork when the Ticketmaster link cannot be
   *  resolved. For a dense list where every row carries a ticket link (the
   *  playoffs home games). Tagging is unchanged. */
  primaryOnly?: boolean;
  /** The game's TicketNetwork event page (Game.tnEventUrl) when the surface
   *  renders one game. The TicketNetwork button then lands on that event;
   *  without it, on the team performer page as before. Ticketmaster stays
   *  team-level either way. */
  eventUrl?: string | null;
  /** false: no TicketNetwork button, Ticketmaster alone. Set by a caller
   *  whose home club (or, team-level, whose club) is flagged
   *  tnHomeUnavailable (ticketNetworkForGame). Default true. */
  ticketNetwork?: boolean;
  /** TICKET PARTNER TEST (2026-11-25, src/lib/ticket-test.ts). Set only on a
   *  test team's own team page. The stack then becomes ONE card in the same
   *  card style: the team's partner today (StubHub by name, or the
   *  TicketNetwork card as it is), no Ticketmaster card, and the test's one
   *  line under it in place of the resale line. A StubHub day without a
   *  matched StubHub event falls back to the TicketNetwork card (to the
   *  Ticketmaster card for a club TicketNetwork does not list) and the click
   *  says fallback. Absent or null: this component renders exactly as before. */
  ticketTest?: TicketTestResolution | null;
  /** The StubHub event page this card may link (the game's, or the team's next
   *  home game for a team-level card). Read only with ticketTest. */
  stubHubEventUrl?: string | null;
  /** With ticketTest only: this card belongs to no single game (the sidebar
   *  card, the legacy hero, a promo card without a game). BOTH arms then link
   *  the team's next upcoming home game that has a matched event for the arm
   *  (Gate 3 ruling 1): the caller passes that game's StubHub event as
   *  stubHubEventUrl and its TicketNetwork event as eventUrl. An arm with no
   *  such game links the TicketNetwork team performer page and the click
   *  says fallback. */
  teamLevelCard?: boolean;
};

export function TicketmasterCTA({
  team,
  surface,
  placement,
  promoId,
  venueSlug,
  subKey,
  size = 'full',
  layout = 'stacked',
  primaryOnly = false,
  eventUrl = null,
  ticketNetwork = true,
  ticketTest = null,
  stubHubEventUrl = null,
  teamLevelCard = false,
}: Props) {
  // Both vendors receive the identical sub-ID: subKey verbatim when the call
  // site provides one (away rows pass the shared awayGameSubKey compound
  // token), else the builders compose {surface}_{venueSlug|team.id}. The old
  // per-vendor divergence (TN flipping to web_away_game while TM kept the page
  // surface) is gone; away keys are never derived here.
  const ticketmasterHref = buildTicketmasterUrl({
    venueSlug,
    subKey,
    teamSlug: team.id,
    ticketmasterSlug: team.ticketmasterSlug,
    ticketmasterAttractionId: team.ticketmasterAttractionId,
    surface,
    promoId,
  });
  const ticketNetworkHref = ticketNetwork ? buildTicketNetworkLink({ team, surface, venueSlug, subKey, eventUrl }) : null;
  const tnLevel = ticketNetworkLinkLevel(eventUrl);

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

  const testLink = ticketTest ? pickTestTicketLink(ticketTest, { stubHubEventUrl, ticketNetwork: ticketNetworkHref, ticketmaster: ticketmasterHref || null, ticketNetworkIsFallback: teamLevelCard && !isTicketNetworkEventUrl(eventUrl) }) : null;
  const testClick = ticketTest && testLink ? ticketTestClickProps(ticketTest, testLink) : undefined;

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
      // The accessible name is the visible text: brand, then the descriptor.
      ariaLabel={`Ticketmaster ${TICKET_CTA_LABEL}`}
      ticketLinkLevel="team"
      {...(testClick ? { ticketTest: testClick } : {})}
      className={cardClass}
    >
      <span className={wordmarkClass} style={{ letterSpacing: '-0.3px' }}>
        ticketmaster
      </span>
      {' '}
      <span className={descriptorClass}>{TICKET_CTA_LABEL}</span>
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
      ariaLabel={`TicketNetwork ${TICKET_CTA_LABEL}`}
      ticketLinkLevel={tnLevel}
      {...(testClick ? { ticketTest: testClick } : {})}
      className={cardClass}
    >
      <Image
        src="/affiliates/ticketnetwork-logo.png"
        alt="TicketNetwork"
        width={logoWidth}
        height={logoHeight}
        className="shrink-0"
      />
      {' '}
      <span className={descriptorClass}>{TICKET_CTA_LABEL}</span>
      <span aria-hidden="true" className={arrowClass}>
        →
      </span>
    </TrackedAffiliateLink>
  ) : null;

  // TICKET PARTNER TEST: one card, the partner the test picked, the test's
  // line under it. The TicketNetwork and Ticketmaster cards are the ones built
  // above, unchanged; the StubHub card is the same card with StubHub's name
  // where the TicketNetwork logo sits (no logo asset, by ruling).
  if (ticketTest) {
    if (!testLink) return null;
    const card =
      testLink.partner === 'stubhub' ? (
        <TrackedAffiliateLink
          href={testLink.href}
          partner="stubhub"
          teamId={team.id}
          sport={team.league}
          promoId={promoId}
          surface={surface}
          placement={placement}
          target="_blank"
          rel="noopener noreferrer sponsored"
          ariaLabel={`StubHub ${TICKET_CTA_LABEL}`}
          ticketLinkLevel="event"
          ticketTest={testClick}
          className={cardClass}
        >
          <span data-ticket-card="stubhub" className={`font-outfit font-extrabold text-[#003C71] ${inline ? 'text-[13px]' : wordmarkSize}`} style={{ letterSpacing: '-0.3px' }}>
            StubHub
          </span>
          {' '}
          <span className={descriptorClass}>{TICKET_CTA_LABEL}</span>
          <span aria-hidden="true" className={arrowClass}>
            →
          </span>
        </TrackedAffiliateLink>
      ) : testLink.partner === 'ticketnetwork' ? (
        ticketNetworkButton
      ) : (
        ticketmasterButton
      );
    return (
      <div className={wrapperClass} data-ticket-test={ticketTest.phase}>
        {card}
        {!inline ? <TicketTestNote className="px-1" /> : null}
      </div>
    );
  }

  // Ticketmaster leads on every surface (stacked = top, inline = leftmost).
  if (primaryOnly) {
    // The same order as the pair: whichever button would have been first.
    const lead = ticketmasterButton ?? ticketNetworkButton;
    return (
      <div className={wrapperClass}>
        {lead}
        {lead === ticketNetworkButton && ticketNetworkButton && !inline ? <ResaleNote className="px-1" /> : null}
      </div>
    );
  }

  // One line under the group when it holds a TicketNetwork button. Stacked
  // only: an inline row belongs to a list of rows, and the list prints the
  // line once (TodayLeagueSection).
  return (
    <div className={wrapperClass}>
      {ticketmasterButton}
      {ticketNetworkButton}
      {ticketNetworkButton && !inline ? <ResaleNote className="px-1" /> : null}
    </div>
  );
}
