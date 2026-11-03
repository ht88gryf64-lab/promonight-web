'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import {
  buildAffiliateUrl,
  isPartnerActive,
  type AffiliatePartner as AffiliateUrlPartner,
} from '@/lib/affiliates';
import {
  trackAffiliateClick,
  type AffiliatePartner,
  type AnalyticsSurface,
} from '@/lib/analytics';
import { withShareSubId2 } from '@/lib/promo-share';
import { useShareSession } from '@/lib/promo-share-session';

export type TrackedAffiliateLinkProps = {
  href: string;
  partner: AffiliatePartner;
  teamId: string;
  sport: string;
  promoId?: string | null;
  surface: AnalyticsSurface;
  placement?: string;
  isHotPromo?: boolean;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  /** Accessible name for the link. Set when the visible content is a brand
   *  mark only (logo/wordmark) with no action text — e.g. the stacked ticket
   *  CTA buttons, which render the partner brand + arrow but no "Get Tickets"
   *  copy. Falls through to the inner content's accessible name when unset. */
  ariaLabel?: string;
  /** Ticket links only: 'event' (the game's own event page) or 'team'.
   *  Sent as ticket_link_level on affiliate_click; omit for other partners. */
  ticketLinkLevel?: 'event' | 'team';
};

// Fires on mousedown (not click) so the event is captured even when the
// browser immediately navigates away and cancels subsequent JS. The outbound
// href must arrive FULLY TAGGED from the partner's typed builder in
// lib/affiliates.ts (subId1 / SharedID / aff_sub / pubref already baked in);
// buildAffiliateUrl below is a documented passthrough for every partner and
// attaches nothing at render time.
export function TrackedAffiliateLink({
  href,
  partner,
  teamId,
  sport,
  promoId = null,
  surface,
  placement,
  isHotPromo = false,
  className,
  children,
  target = '_blank',
  rel = 'noopener sponsored',
  ariaLabel,
  ticketLinkLevel,
}: TrackedAffiliateLinkProps) {
  const builtHref = buildAffiliateUrl(partner as AffiliateUrlPartner, href, {
    surface,
    promoId,
  });
  // SHARED-LINK SESSIONS (2026-11-03). A visit that arrived on a shared promo
  // link adds subId2=share to every Impact link for the rest of the tab's
  // session (src/lib/promo-share-session.ts); subId1 is untouched, so the
  // surface comparison reads exactly as before. A self-open adds nothing.
  // Null on the server and during hydration, so the served HTML never
  // carries subId2 and hydration cannot mismatch.
  const shareSession = useShareSession();
  const taggedHref =
    shareSession && !shareSession.selfOpen ? withShareSubId2(builtHref, partner) : builtHref;
  // True when the partner's tracking-ID env var is set, i.e. the outbound
  // URL is commissionable. False during pre-approval — click still fires.
  const trackingActive = isPartnerActive(partner as AffiliateUrlPartner);

  const handleMouseDown: MouseEventHandler<HTMLAnchorElement> = () => {
    trackAffiliateClick({
      partner,
      team_id: teamId,
      sport,
      promo_id: promoId,
      surface,
      is_hot_promo: promoId ? isHotPromo : false,
      destination_url: taggedHref,
      placement: placement ?? surface,
      affiliate_tracking_active: trackingActive,
      ...(ticketLinkLevel ? { ticket_link_level: ticketLinkLevel } : {}),
      ...(shareSession ? { share_id: shareSession.shareId, share_self_open: shareSession.selfOpen } : {}),
    });
  };

  return (
    <a
      href={taggedHref}
      onMouseDown={handleMouseDown}
      className={className}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
