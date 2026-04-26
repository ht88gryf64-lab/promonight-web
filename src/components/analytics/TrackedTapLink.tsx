'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEventHandler } from 'react';
import { track, type AnalyticsEvent, type EventPropertiesMap } from '@/lib/analytics';

type NextLinkProps = ComponentProps<typeof Link>;

// Generic client-side <Link> that fires a typed analytics event on click.
// Use when the existing <TrackedLink> doesn't fit because it's hardcoded to
// emit `cta_click` — most homepage events (tonight_card_tap, etc.) are their
// own typed event names per the doctrine's event-per-intent convention.
//
// Generic over the event name so trackProps is type-checked against the
// matching EventPropertiesMap entry at the call site. Keeps strips as
// server components by isolating the click handler in this client leaf.
export type TrackedTapLinkProps<E extends AnalyticsEvent> = Omit<NextLinkProps, 'onClick'> & {
  trackEvent: E;
  trackProps: EventPropertiesMap[E];
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function TrackedTapLink<E extends AnalyticsEvent>({
  trackEvent,
  trackProps,
  onClick,
  ...rest
}: TrackedTapLinkProps<E>) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    track(trackEvent, trackProps);
    onClick?.(e);
  };
  return <Link onClick={handleClick} {...rest} />;
}
