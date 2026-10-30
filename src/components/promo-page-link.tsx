'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEventHandler } from 'react';
import { track, type AnalyticsSurface } from '@/lib/analytics';

// The anchor every inbound surface renders around a promo name (Phase 3c).
// A client leaf so the server-rendered surfaces (the aggregator rows, the
// venue block, the ribbon) stay server components; it fires promo_link_click
// {surface, team_slug, promo_id} and otherwise is a plain next/link. The
// href comes from the one helper (src/lib/promo-page-href.ts promoPageHref);
// the children are the promo title, which is what the rule asks of the
// anchor text.
export type PromoPageLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & {
  href: string;
  surface: AnalyticsSurface;
  teamSlug: string;
  promoId: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function PromoPageLink({ href, surface, teamSlug, promoId, onClick, children, ...rest }: PromoPageLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    track('promo_link_click', { surface, team_slug: teamSlug, promo_id: promoId, destination_url: href });
    onClick?.(e);
  };
  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
