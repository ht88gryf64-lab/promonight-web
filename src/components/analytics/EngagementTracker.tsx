'use client';

import { useEffect, useRef } from 'react';
import { normalizeSport, track } from '@/lib/analytics';

// Fires team_page_engaged exactly once per page view when the user has been
// on the page at least 30s AND scrolled past 25% of the document. The two
// thresholds are ANDed — either alone isn't a credible signal of engagement.
export function EngagementTracker({
  teamSlug,
  sport,
}: {
  teamSlug: string;
  sport: string;
}) {
  const firedRef = useRef(false);
  const thirtySecondsReachedRef = useRef(false);
  const twentyFivePctReachedRef = useRef(false);

  useEffect(() => {
    const maybeFire = (scrollPct: number) => {
      if (firedRef.current) return;
      if (!thirtySecondsReachedRef.current) return;
      if (!twentyFivePctReachedRef.current) return;
      firedRef.current = true;
      track('team_page_engaged', {
        surface: 'web_team_page',
        team_slug: teamSlug,
        sport: normalizeSport(sport),
        scroll_depth_pct: Math.min(100, Math.round(scrollPct)),
      });
    };

    const computeScrollPct = () => {
      const doc = document.documentElement;
      const viewportBottom = window.scrollY + window.innerHeight;
      const total = doc.scrollHeight;
      if (total <= 0) return 0;
      return (viewportBottom / total) * 100;
    };

    const onScroll = () => {
      const pct = computeScrollPct();
      if (pct >= 25) twentyFivePctReachedRef.current = true;
      maybeFire(pct);
    };

    // Scroll listener runs passive to avoid blocking scrolling on mobile.
    window.addEventListener('scroll', onScroll, { passive: true });
    // Check once at mount in case the page is short enough that 25% is already visible.
    onScroll();

    const timerId = window.setTimeout(() => {
      thirtySecondsReachedRef.current = true;
      maybeFire(computeScrollPct());
    }, 30_000);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timerId);
    };
  }, [teamSlug, sport]);

  return null;
}
