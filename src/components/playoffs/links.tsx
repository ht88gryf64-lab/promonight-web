'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { track, normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import type { ParkPage } from '@/lib/postseason/view';

/**
 * A park name that links to the park's page on this site.
 *
 * Fires venue_hub_click, the event every other link into a venue page fires,
 * with this page as the surface. On mousedown, like the others, so it lands
 * even when the navigation tears the page down first. A real link in the
 * server HTML: the wrapper adds the handler and nothing else.
 */
export function ParkLink({
  page,
  teamId,
  league,
  surface,
  placement,
  className,
  children,
}: {
  page: ParkPage;
  teamId: string;
  league: string;
  surface: AnalyticsSurface;
  placement: string;
  className?: string;
  children: ReactNode;
}) {
  const fire = () => {
    track('venue_hub_click', {
      surface,
      team_slug: teamId,
      sport: normalizeSport(league),
      placement,
      building_slug: page.buildingSlug,
      building_name: page.buildingName,
      destination_url: page.href,
    });
  };
  return (
    <Link href={page.href} onMouseDown={fire} data-park-link={page.buildingSlug} className={className}>
      {children}
    </Link>
  );
}
