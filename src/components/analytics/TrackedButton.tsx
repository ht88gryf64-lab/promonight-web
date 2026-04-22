'use client';

import type { ButtonHTMLAttributes, MouseEventHandler } from 'react';
import { track, type AnalyticsSurface } from '@/lib/analytics';

export type TrackedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ctaId: string;
  ctaLabel: string;
  surface: AnalyticsSurface;
  teamSlug?: string;
};

export function TrackedButton({
  ctaId,
  ctaLabel,
  surface,
  teamSlug,
  onClick,
  children,
  ...rest
}: TrackedButtonProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    track('cta_click', {
      surface,
      cta_id: ctaId,
      cta_label: ctaLabel,
      team_slug: teamSlug,
    });
    onClick?.(e);
  };

  return (
    <button {...rest} onClick={handleClick}>
      {children}
    </button>
  );
}
