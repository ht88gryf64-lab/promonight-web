'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { inferSurfaceFromPath, track } from '@/lib/analytics';
import { resolveBrowserVariant } from '@/lib/capture/variant';
import { scheduleDeferredPageView } from './page-view-deferral';

// Fires page_view on initial load and on every App Router navigation.
// Title is captured after React has updated <head>, so the emit is deferred
// through scheduleDeferredPageView (idle callback with a 500ms deadline plus
// a pagehide/visibilitychange flush; see page-view-deferral.ts for why the
// deadline and the flush must travel together). PostHog autocapture_pageview
// is disabled so this is the single source of truth.
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
    //
    // Re-key the dedupe ref on the way through. Without this, navigating
    // A -> scoring page -> A found lastFiredKey still holding A's key and
    // the return leg fired nothing, so every such round trip undercounted
    // page_view in both sinks.
    if (
      pathname.startsWith('/best-promos') ||
      pathname.startsWith('/team-rankings')
    ) {
      lastFiredKey.current = null;
      return;
    }
    const qs = searchParams?.toString() ?? '';
    const key = qs ? `${pathname}?${qs}` : pathname;
    if (lastFiredKey.current === key) return;

    const fire = () => {
      // Drop, never mislabel. The App Router applies pushState in an
      // insertion effect at commit, but this effect's cleanup cancels at
      // passive-effect time, after paint. In that gap the deadline or a
      // hidden-transition flush can still run this closure with
      // window.location already moved to the next route, and the row would
      // carry this closure's surface with the new route's path and title.
      if (window.location.pathname !== pathname) return;
      // Claim the key at EMIT time, not at schedule time. A schedule that is
      // cancelled before it fires (StrictMode's dev double-effect, or any
      // same-key effect re-run while the emit is pending) must leave the key
      // unclaimed so the next effect run schedules again; claiming it up
      // front made the cancel-then-early-return sequence permanently drop
      // the view. The scheduler's own latch still caps one emit per schedule.
      lastFiredKey.current = key;
      const title = typeof document !== 'undefined' ? document.title : '';
      track('page_view', {
        surface: inferSurfaceFromPath(pathname),
        page_title: title,
        // Resolved here rather than in the effect body so it shares the fate of
        // the event it labels: if the deferral is cancelled, nothing was read and
        // nothing was written. The value does not depend on the timing, because
        // an arm already in storage is returned unchanged and a browser with no
        // arm yet gets the same coin whenever it is asked.
        variant: resolveBrowserVariant(),
      });
    };

    // The scheduler owns the once-only latch, the 500ms deadline, and the
    // teardown flush. Its cancel function is this effect's cleanup, so an SPA
    // navigation cancels the pending OLD-route emit instead of firing it with
    // the new route's title and path already committed.
    return scheduleDeferredPageView(fire);
  }, [pathname, searchParams]);

  return null;
}
