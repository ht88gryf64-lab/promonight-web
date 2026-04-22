'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEventHandler } from 'react';
import { track, type AnalyticsSurface } from '@/lib/analytics';

type NextLinkProps = ComponentProps<typeof Link>;

export type TrackedLinkProps = Omit<NextLinkProps, 'onClick'> & {
  ctaId: string;
  ctaLabel: string;
  surface: AnalyticsSurface;
  teamSlug?: string;
  external?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function TrackedLink({
  ctaId,
  ctaLabel,
  surface,
  teamSlug,
  external = false,
  onClick,
  href,
  ...rest
}: TrackedLinkProps) {
  const destination = typeof href === 'string' ? href : href?.toString() ?? '';

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    track('cta_click', {
      surface,
      cta_id: ctaId,
      cta_label: ctaLabel,
      cta_destination: destination,
      team_slug: teamSlug,
    });
    onClick?.(e);
  };

  if (external) {
    return (
      <a
        href={destination}
        onClick={handleClick}
        target="_blank"
        rel="noopener"
        {...(rest as Omit<ComponentProps<'a'>, 'href' | 'onClick'>)}
      />
    );
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
