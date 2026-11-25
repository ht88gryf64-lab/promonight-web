'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { track, type ThisWeekCardTapProperties } from '@/lib/analytics';
import { utmTriplet } from '@/lib/utm-capture';

// The anchor around a promo title on a league hub (the today module and the
// this-week rail). A client leaf so the hub components stay server components.
//
// It fires the hub's own tap event, this_week_card_tap, as the cards always
// did, and, WHEN THE LINK GOES TO A PROMO PAGE, promo_link_click as well: the
// inbound event every surface that links into a promo page shares
// (PromoPageLink; src/components/scoring/scored-promo-card.tsx fires the same
// pair). Without it a hub click would be missing from the promo pages'
// inbound read. A link that falls back to the team-page row fires the tap
// event alone: it is not a link into a promo page.
export type HubPromoLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & {
  href: string;
  /** True when `href` is the promo's own page (promoPageHref), false for the team-page row. */
  toPromoPage: boolean;
  tap: ThisWeekCardTapProperties;
};

export function HubPromoLink({ href, toPromoPage, tap, children, ...rest }: HubPromoLinkProps) {
  const handleClick = () => {
    track('this_week_card_tap', tap);
    if (toPromoPage) {
      track('promo_link_click', { surface: tap.surface, team_slug: tap.team_id, promo_id: tap.promo_id, destination_url: href, ...utmTriplet() });
    }
  };
  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
