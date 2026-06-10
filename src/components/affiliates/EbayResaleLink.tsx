'use client';

import { IconArrowUpRight } from '@tabler/icons-react';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import {
  buildEbayResaleUrl,
  isBobbleheadGiveaway,
  isEbayResaleActive,
  type EbayResalePlacement,
} from '@/lib/ebay';
import { synthPromoId } from '@/lib/promo-helpers';
import type { Promo } from '@/lib/types';

// "Missed it? Check resale on eBay" — tertiary CTA on completed bobblehead
// giveaway rows. Self-guarding: renders nothing unless the EPN campid is set,
// the promo passes the strict bobblehead predicate, and its date is past.
// Callers therefore only decide WHERE the link may appear, never whether a
// given promo qualifies. The date guard re-checks what the completed-row
// context already implies, so it can only flip the same way on the client as
// it did at render time (promo.date < build-today <= client-today) — no
// hydration mismatch.
export function EbayResaleLink({
  promo,
  teamSlug,
  teamNickname,
  sport,
  placement,
  surface,
  variant = 'light',
}: {
  promo: Pick<Promo, 'date' | 'title' | 'type'>;
  teamSlug: string;
  /** Short brand name for the search query, e.g. "Yankees" (Team.name) — the
   *  display name's city prefix only dilutes eBay relevance ranking. */
  teamNickname: string;
  sport: string;
  placement: EbayResalePlacement;
  surface: AnalyticsSurface;
  variant?: 'light' | 'dark';
}) {
  if (!isEbayResaleActive() || !isBobbleheadGiveaway(promo)) return null;
  if (promo.date >= new Date().toISOString().slice(0, 10)) return null;

  const href = buildEbayResaleUrl({ promo, teamSlug, teamNickname, placement });

  return (
    <TrackedTapLink
      href={href}
      target="_blank"
      rel="sponsored noopener"
      trackEvent="resale_click"
      trackProps={{
        surface,
        partner: 'ebay',
        placement,
        promo_id: synthPromoId(teamSlug, promo),
        team_slug: teamSlug,
        sport: normalizeSport(sport),
        destination_url: href,
      }}
      className={
        variant === 'light'
          ? 'mt-2 inline-flex items-center gap-1 font-rd text-xs font-semibold text-rd-ink-soft underline underline-offset-2 transition-colors hover:text-rd-ink'
          : 'mt-2 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.5px] text-text-secondary underline underline-offset-2 transition-colors hover:text-white'
      }
    >
      Missed it? Check resale on eBay
      <IconArrowUpRight size={12} stroke={2.25} aria-hidden />
    </TrackedTapLink>
  );
}
