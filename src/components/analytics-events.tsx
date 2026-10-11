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
  plainAnchor = false,
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
  /** Render a plain <a> instead of next/link: the link is never prefetched,
   *  and following it is a full page load. For the team-page app card, whose
   *  /download link sits on 169 pages (app funnel G1). Not a next/link
   *  prefetch prop, which src/lib/analytics/__tests__/no-link-prefetch-prop
   *  forbids outright to protect the request counter. */
  plainAnchor?: boolean;
}) {
  const isExternal = /^https?:\/\//.test(href);
  const resolvedTarget = target ?? (isExternal ? '_blank' : undefined);
  const resolvedRel = rel ?? (isExternal ? 'noopener' : undefined);
  const handleClick = () => {
    trackInstallClick({ platform, section, page, teamSlug, ...(surface ? { surface } : {}) });
  };

  if (plainAnchor) {
    return (
      <a href={href} onClick={handleClick} className={className} target={resolvedTarget} rel={resolvedRel}>
        {children}
      </a>
    );
  }
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

