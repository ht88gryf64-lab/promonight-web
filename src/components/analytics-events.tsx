'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { event, trackInstallClick } from '@/lib/analytics';
import type { AppLinkSurface } from '@/lib/app-link';

// Fires team_page_view once on mount
export function TeamPageTracker({
  teamSlug,
  sport,
  teamName,
  promoCount,
}: {
  teamSlug: string;
  sport: string;
  teamName: string;
  promoCount: number;
}) {
  useEffect(() => {
    event('team_page_view', {
      team_slug: teamSlug,
      sport,
      team_name: teamName,
      promo_count: promoCount,
    });
  }, [teamSlug, sport, teamName, promoCount]);

  return null;
}

// Tracks app store clicks with section/page context
export function TrackedAppLink({
  href,
  platform,
  section,
  page,
  teamSlug,
  className,
  children,
  target,
  rel,
  surface,
}: {
  href: string;
  /** The destination store; 'unknown' for a link to /download. */
  platform: 'ios' | 'android' | 'unknown';
  section: string;
  page: string;
  teamSlug?: string;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
  /** For links built by src/lib/app-link.ts; otherwise inferred from the path. */
  surface?: AppLinkSurface;
}) {
  const isExternal = /^https?:\/\//.test(href);
  const resolvedTarget = target ?? (isExternal ? '_blank' : undefined);
  const resolvedRel = rel ?? (isExternal ? 'noopener' : undefined);
  const handleClick = () => {
    trackInstallClick({ platform, section, page, teamSlug, ...(surface ? { surface } : {}) });
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      target={resolvedTarget}
      rel={resolvedRel}
    >
      {children}
    </Link>
  );
}

