'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { inferSurfaceFromPath, track } from '@/lib/analytics';

// Fires page_view on initial load and on every App Router navigation.
// Title is captured after React has updated <head>, so we read it via rAF +
// a short timeout fallback. PostHog autocapture_pageview is disabled so this
// is the single source of truth.
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastFiredKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Scoring discovery pages fire their own extended page_view via
    // ScoringPageViewTracker (carrying score_count + filter state derived
    // from the URL at the moment of mount). Skip the global firing on
    // those routes to avoid double-counting. The scoring pages also
    // suppress the refire-on-searchParams-change semantics this tracker
    // uses; their page_view is once-per-mount, with filter cadence after
    // covered by the score_filter_changed event.
    if (
      pathname.startsWith('/best-promos') ||
      pathname.startsWith('/team-rankings')
    ) {
      return;
    }
    const qs = searchParams?.toString() ?? '';
    const key = qs ? `${pathname}?${qs}` : pathname;
    if (lastFiredKey.current === key) return;
    lastFiredKey.current = key;

    const fire = () => {
      const title = typeof document !== 'undefined' ? document.title : '';
      track('page_view', {
        surface: inferSurfaceFromPath(pathname),
        page_title: title,
      });
    };

    // Defer to let Next.js update <title> metadata before we read it.
    const ric =
      typeof window !== 'undefined' &&
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback;
    if (typeof ric === 'function') {
      ric(fire);
    } else {
      const t = setTimeout(fire, 50);
      return () => clearTimeout(t);
    }
  }, [pathname, searchParams]);

  return null;
}
