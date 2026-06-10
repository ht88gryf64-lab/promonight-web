'use client';

import { usePathname } from 'next/navigation';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { inferCaptureSurface } from '@/lib/follow-surface';

// Site-wide email entry, rendered in the global footer (every page). Because it
// has no fixed surface, it derives one from the current path so a click from a
// team page, the playoffs hub, an aggregator page, or the homepage each
// attributes correctly, matching the surface the per-page in-content CTAs pass
// explicitly. Dark-surface styling: the redesign footer is the one charcoal
// surface, so it uses the brighter on-dark red accent and white text.

const RED_ON_DARK = '#ff5a4d';

export function FollowFooterCTA() {
  const pathname = usePathname();
  const surface = inferCaptureSurface(pathname);

  return (
    <div className="mt-6">
      <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        Free weekly email
      </p>
      <TrackedTapLink
        trackEvent="email_cta_click"
        trackProps={{ surface }}
        href={`/follow?source=${surface}`}
        className="mt-2 inline-flex items-center gap-1.5 font-rd text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: RED_ON_DARK }}
      >
        Get every giveaway in your inbox →
      </TrackedTapLink>
    </div>
  );
}
