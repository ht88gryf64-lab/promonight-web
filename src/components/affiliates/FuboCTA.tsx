import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { FUBO_CTA_LABEL, fuboAvailabilityLine, fuboCtaHref, type FuboSurface } from '@/lib/affiliates/fubo';

// "Stream on Fubo" (2026-11-20). Text only: no Fubo logo or wordmark, no
// price, never "free" (src/lib/affiliates/fubo.ts COPY RULES). Always placed
// BELOW the ticket CTA it sits with, never above it. The href is the on-site
// /go/fubo hop; affiliate_click fires on mousedown with partner=fubo before it.
// Renders nothing for a league other than NFL, NBA and NHL, a game with no id,
// or an NFL game on Prime, Netflix or Amazon (fuboCtaHref). The page-level
// AffiliateDisclosure each host page already renders covers it.
//
// Variants, one per host:
//   promo  the promo page CTA column, under "Also on Ticketmaster"
//   tray   a team-page away row's CTA tray, under the ticket card, with its
//          own eyebrow like the tray's other blocks (GET TICKETS, FIND PARKING)
//   today  a /promos/today card, on its own line under the inline CTA row

type Props = {
  league: string;
  gameId: string | null | undefined;
  surface: FuboSurface;
  /** The link's team: the page team on a team page, the host club elsewhere. */
  teamId: string;
  sport: string;
  promoId?: string | null;
  placement: string;
  broadcastNetwork?: string | null;
  variant: 'promo' | 'tray' | 'today';
  /** The host card is dimmed (opacity-70, /promos/today's Tomorrow cards).
   *  The link red composites to 3.22:1 and the faint line to 2.64:1 there
   *  (ux-review round 2, N1); rd-ink composites to 5.89:1, so both use it. */
  dimmed?: boolean;
  /** Promo pages only: page.slug, the subId3 every Impact link there carries. */
  pageSlug?: string | null;
};

const LINK_CLASS: Record<Props['variant'], string> = {
  promo: 'inline-flex min-h-11 items-center font-rd text-[14px] font-medium text-rd-link no-underline hover:underline',
  tray: 'inline-flex min-h-11 items-center gap-1 font-rd text-[14px] font-semibold text-rd-link no-underline hover:underline',
  today: 'inline-flex min-h-11 items-center gap-1 font-rd text-[13px] font-semibold text-rd-link no-underline hover:underline',
};

// The availability line never overlaps the link (ux-review 2026-11-20,
// defect 2: a -mt-2 on the line took the bottom 9px of the 44px hit area).
// The promo wrapper's -mt-2 eats into the CTA column's 10px gap only, so the
// link sits closer to "Also on Ticketmaster" (defect 3) without overlapping it.
const WRAP_CLASS: Record<Props['variant'], string> = {
  promo: '-mt-2 flex flex-col items-center',
  tray: 'flex flex-col items-start gap-1',
  today: 'mt-1 flex flex-wrap items-center gap-x-2',
};

export function FuboCTA({ league, gameId, surface, teamId, sport, promoId = null, placement, broadcastNetwork, variant, dimmed = false, pageSlug = null }: Props) {
  const href = fuboCtaHref({ league, gameId, surface, teamId, broadcastNetwork, pageSlug });
  if (!href) return null;
  const availability = fuboAvailabilityLine(league);
  return (
    <div data-fubo-cta="" className={WRAP_CLASS[variant]}>
      {variant === 'tray' ? (
        // Text only, like the link: no icon or image anywhere in the block.
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-accent-red">Stream the game</span>
      ) : null}
      <TrackedAffiliateLink
        href={href}
        partner="fubo"
        teamId={teamId}
        sport={sport}
        promoId={promoId}
        surface={surface}
        placement={placement}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={dimmed ? LINK_CLASS[variant].replace('text-rd-link', 'text-rd-ink') : LINK_CLASS[variant]}
      >
        {FUBO_CTA_LABEL}
        {variant === 'promo' ? null : <span aria-hidden="true">→</span>}
      </TrackedAffiliateLink>
      {availability ? (
        <p className={`m-0 font-rd text-[12px] leading-[1.4] ${dimmed ? 'text-rd-ink' : 'text-rd-ink-faint'}`}>
          {availability}
        </p>
      ) : null}
    </div>
  );
}
