'use client';

import { usePathname } from 'next/navigation';
import { inferSurfaceFromPath } from '@/lib/analytics';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';

// "World Cup" BrandBar nav link with a subtle red accent so it stands out from
// the ink-soft links. Client leaf so the cta_click surface tracks the live
// path; rendered only while isWorldCupActive() (gated by BrandBar).
export function WorldCupNavLink({ className }: { className?: string }) {
  const surface = inferSurfaceFromPath(usePathname() ?? '/');
  return (
    <TrackedTapLink
      href="/world-cup"
      trackEvent="cta_click"
      trackProps={{
        surface,
        cta_id: 'nav',
        cta_label: 'World Cup nav link',
        cta_destination: '/world-cup',
      }}
      className={className}
    >
      World Cup
    </TrackedTapLink>
  );
}
