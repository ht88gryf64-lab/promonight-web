'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { track } from '@/lib/analytics';
import { utmTriplet } from '@/lib/utm-capture';

// One eBay listing on a bobblehead's page (step 5a, 2026-11-08): a plain
// external anchor, rel=sponsored because it is an affiliate link, that fires
// promo_link_click with surface web_promo_page_ebay and destination 'ebay'
// (the same event the inbound promo links fire, split by those two fields).
// A client leaf so the page stays a server component.
export const EBAY_LISTING_SURFACE = 'web_promo_page_ebay' as const;

export function EbayListingLink({ href, teamSlug, promoId, title, className, children }: { href: string; teamSlug: string; promoId: string; title: string; className?: string; children: ReactNode }) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = () => {
    track('promo_link_click', { surface: EBAY_LISTING_SURFACE, team_slug: teamSlug, promo_id: promoId, destination_url: href, destination: 'ebay', ...utmTriplet() });
  };
  return (
    <a href={href} target="_blank" rel="sponsored noopener" title={title} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
