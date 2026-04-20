'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { event, trackInstallClick } from '@/lib/analytics';

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
  className,
  children,
  target,
  rel,
}: {
  href: string;
  platform: 'ios' | 'android';
  section: string;
  page: string;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
}) {
  const isExternal = /^https?:\/\//.test(href);
  const resolvedTarget = target ?? (isExternal ? '_blank' : undefined);
  const resolvedRel = rel ?? (isExternal ? 'noopener' : undefined);
  const handleClick = () => {
    trackInstallClick({ platform, section, page });
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

// Observes CTA visibility and fires once
export function TrackedCTA({
  teamSlug,
  children,
}: {
  teamSlug: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!ref.current || fired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          event('cta_scroll_visible', { team_slug: teamSlug });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [teamSlug]);

  return <div ref={ref}>{children}</div>;
}
