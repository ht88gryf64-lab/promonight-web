'use client';

import { usePathname } from 'next/navigation';
import { IconBallFootball, IconChevronRight } from '@tabler/icons-react';
import { inferSurfaceFromPath } from '@/lib/analytics';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';

// Site-wide World Cup announcement strip (Option B): a full-width solid
// brand-red bar at the very top of the body, above the sticky BrandBar. The
// whole bar is the tap target to /world-cup. Client leaf so the cta_click
// surface can be inferred from the live path; its markup still server-renders
// in the initial HTML. The strip's PRESENCE is gated server-side in
// app/layout.tsx via isWorldCupActive(), so it auto-expires after the final.
export function WorldCupAnnouncementBar() {
  const surface = inferSurfaceFromPath(usePathname() ?? '/');
  return (
    <TrackedTapLink
      href="/world-cup"
      trackEvent="cta_click"
      trackProps={{
        surface,
        cta_id: 'announcement_strip',
        cta_label: 'World Cup host-city strip',
        cta_destination: '/world-cup',
      }}
      aria-label="World Cup: find local games and promos in all 11 US host cities"
      className="group block w-full bg-rd-red text-white transition-colors hover:bg-rd-red-dark"
    >
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-center gap-2 px-4">
        <IconBallFootball size={15} stroke={2.25} className="shrink-0" aria-hidden />
        <span className="truncate font-rd text-[12px] font-semibold tracking-[0.01em]">
          <span className="hidden sm:inline">
            Heading to a World Cup city? Find local games and promos in all 11 US host cities
          </span>
          <span className="sm:hidden">World Cup: games and promos in all 11 host cities</span>
        </span>
        <IconChevronRight
          size={15}
          stroke={2.5}
          className="shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </TrackedTapLink>
  );
}
