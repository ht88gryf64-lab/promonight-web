'use client';

import Link from 'next/link';
import {
  trackAffiliateClick,
  type AffiliatePartner,
  type AffiliateSurface,
} from '@/lib/analytics';

export function TrackedAffiliateLink({
  href,
  partner,
  teamId,
  sport,
  promoId = null,
  surface,
  isHotPromo = false,
  className,
  children,
  target = '_blank',
  rel = 'noopener sponsored',
}: {
  href: string;
  partner: AffiliatePartner;
  teamId: string;
  sport: string;
  promoId?: string | null;
  surface: AffiliateSurface;
  isHotPromo?: boolean;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
}) {
  const handleClick = () => {
    trackAffiliateClick({
      partner,
      team_id: teamId,
      sport,
      promo_id: promoId,
      surface,
      is_hot_promo: promoId ? isHotPromo : false,
    });
  };

  return (
    <Link href={href} onClick={handleClick} className={className} target={target} rel={rel}>
      {children}
    </Link>
  );
}
