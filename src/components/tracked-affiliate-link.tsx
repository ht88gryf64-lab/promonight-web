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
};

// Fires on mousedown (not click) so the event is captured even when the
// browser immediately navigates away and cancels subsequent JS. The outbound
// href is tagged at render time with the affiliate sub-ID format
// ${surface}_${promoId ?? 'none'}.
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
}: TrackedAffiliateLinkProps) {
  const taggedHref = buildAffiliateUrl(partner as AffiliateUrlPartner, href, {
    surface,
    promoId,
  });
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
    });
  };

  return (
    <a
      href={taggedHref}
      onMouseDown={handleMouseDown}
      className={className}
      target={target}
      rel={rel}
    >
      {children}
    </a>
  );
}
