'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { inferSurfaceFromPath, track, type AnalyticsSurface } from '@/lib/analytics';
import type { EventLinkSurface, EventOutSurface } from '@/lib/events/event-pages';

// The anchor for every link INTO /events (href and surface from the one
// helper, src/lib/events/event-pages.ts eventPageHref) and every link OUT of
// /events to a venue, team or promo page (event_to_venue, event_to_team). A
// client leaf so the surfaces around it stay server components. It fires
// event_link_click {surface: the page clicked on, link_surface: the
// placement, destination_url} and otherwise is a plain next/link.
export type EventPageLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & {
  href: string;
  linkSurface: EventLinkSurface | EventOutSurface;
  show?: string | null;
  venueSlug?: string | null;
  /** The surface of the page the link sits on, when the path alone does not
   *  say it: a venue page is web_venue, which no path rule infers (its CTAs
   *  name their surface themselves). Omitted, the path decides. */
  pageSurface?: AnalyticsSurface;
};

export function EventPageLink({ href, linkSurface, show, venueSlug, pageSurface, children, ...rest }: EventPageLinkProps) {
  const handleClick = () => {
    track('event_link_click', {
      surface: pageSurface ?? inferSurfaceFromPath(window.location.pathname),
      link_surface: linkSurface,
      destination_url: href,
      ...(show ? { show } : {}),
      ...(venueSlug ? { venue_slug: venueSlug } : {}),
    });
  };
  return (
    <Link href={href} onClick={handleClick} data-event-link={linkSurface} {...rest}>
      {children}
    </Link>
  );
}
