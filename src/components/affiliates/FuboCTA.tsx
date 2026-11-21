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
//   tray   a team-page away row's CTA tray, under the ticket card
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
};

const LINK_CLASS: Record<Props['variant'], string> = {
  promo: 'inline-flex min-h-11 items-center font-rd text-[14px] font-medium text-rd-link no-underline hover:underline',
  tray: 'inline-flex min-h-11 items-center gap-1 font-rd text-[14px] font-semibold text-rd-link no-underline hover:underline',
  today: 'inline-flex min-h-11 items-center gap-1 font-rd text-[13px] font-semibold text-rd-link no-underline hover:underline',
};

const WRAP_CLASS: Record<Props['variant'], string> = {
  promo: 'flex flex-col items-center',
  tray: 'flex flex-col items-start',
  today: 'mt-1 flex flex-wrap items-center gap-x-2',
};

export function FuboCTA({ league, gameId, surface, teamId, sport, promoId = null, placement, broadcastNetwork, variant }: Props) {
  const href = fuboCtaHref({ league, gameId, surface, teamId, broadcastNetwork });
  if (!href) return null;
  const availability = fuboAvailabilityLine(league);
  return (
    <div data-fubo-cta="" className={WRAP_CLASS[variant]}>
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
        className={LINK_CLASS[variant]}
      >
        {FUBO_CTA_LABEL}
        {variant === 'promo' ? null : <span aria-hidden="true">→</span>}
      </TrackedAffiliateLink>
      {availability ? (
        <p className={`m-0 font-rd text-[12px] leading-[1.4] text-rd-ink-faint${variant === 'promo' ? ' -mt-2' : variant === 'tray' ? ' -mt-2' : ''}`}>
          {availability}
        </p>
      ) : null}
    </div>
  );
}
