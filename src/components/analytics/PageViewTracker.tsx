'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { inferSurfaceFromPath, track } from '@/lib/analytics';
import { resolveBrowserVariant } from '@/lib/capture/variant';
import { scheduleDeferredPageView } from './page-view-deferral';
import { enterPage, samePath, syncPageUrl } from './page-history';

// Fires page_view on initial load and on every App Router navigation that
// changes the PATHNAME. A query-only change is not a page view: the /teams
// league tabs (replaceState to ?league=) used to fire one per click, and on
// /teams that was most of the page's page_view volume. The one in-site
// navigation that changes only the query is a /follow footer self-link, and
// that is excluded by ruling (2026-10-20), not by accident.
//
// Every page_view carries page_location and page_referrer explicitly (see
// page-history.ts for why GA4's own dl/dr cannot be trusted here). Title is
// captured after React has updated <head>, so the emit is deferred through
// scheduleDeferredPageView (idle callback with a 500ms deadline plus a
// pagehide/visibilitychange flush). PostHog autocapture_pageview is disabled
// so this is the single source of truth.
export function PageViewTracker() {
  const pathname = usePathname();
  // Read only to keep the current page's URL fresh for the next referrer (a
  // /teams?league=NBA visitor who clicks a card came from that URL, not from
  // bare /teams). It never fires page_view. It also keeps this component
  // inside the layout's Suspense bailout exactly as before, so the served
  // HTML of every page is unchanged.
  const searchParams = useSearchParams();
  const lastFiredPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Registered on every route, scoring routes included, so the page after a
    // scoring page still gets the right referrer.
    const page = enterPage(pathname, window.location.href, document.referrer);

    // Scoring discovery pages fire their own extended page_view via
    // ScoringPageViewTracker (carrying score_count + filter state derived
    // from the URL at the moment of mount). Skip the global firing on
    // those routes to avoid double-counting.
    //
    // Re-key the dedupe ref on the way through. Without this, navigating
    // A -> scoring page -> A found lastFiredPath still holding A and the
    // return leg fired nothing.
    if (
      pathname.startsWith('/best-promos') ||
      pathname.startsWith('/team-rankings')
    ) {
      lastFiredPath.current = null;
      return;
    }
    if (lastFiredPath.current === pathname) return;

    // Everything the row says about the page is fixed here, at arrival, so a
    // late emit (the visitor left inside the deadline) is still labelled with
    // the page it belongs to rather than with wherever the router is now.
    const pageLocation = page.url;
    const pageReferrer = page.referrer;
    const pagePath = (() => {
      const u = new URL(pageLocation);
      return u.pathname + u.search;
    })();
    const onThisPage = () => samePath(window.location.pathname, pathname);

    // This page's title as last seen while the location was still this page.
    // The router moves location and <title> to the next route in the same
    // synchronous commit, and a MutationObserver callback runs only after that
    // commit, so a title change observed while location still matches belongs
    // to this page. It covers a title that lands after arrival (streamed
    // metadata) and is what a flush after navigation reports.
    let titleSeen = onThisPage() ? document.title : '';
    const titleObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            if (onThisPage()) titleSeen = document.title;
          });
    titleObserver?.observe(document.head, { subtree: true, childList: true, characterData: true });

    const fire = () => {
      titleObserver?.disconnect();
      // Claim the path at EMIT time, not at schedule time. A schedule that is
      // cancelled before it fires (StrictMode's dev double-effect) must leave
      // the path unclaimed so the re-run schedules again. The scheduler's own
      // latch still caps one emit per schedule.
      lastFiredPath.current = pathname;
      track('page_view', {
        surface: inferSurfaceFromPath(pathname),
        page_title: onThisPage() ? document.title : titleSeen,
        page_location: pageLocation,
        page_referrer: pageReferrer,
        page_path: pagePath,
        // Resolved here rather than in the effect body so it shares the fate of
        // the event it labels: if the deferral is cancelled, nothing was read and
        // nothing was written. The value does not depend on the timing, because
        // an arm already in storage is returned unchanged and a browser with no
        // arm yet gets the same coin whenever it is asked.
        variant: resolveBrowserVariant(),
      });
    };

    const pending = scheduleDeferredPageView(fire);
    return () => {
      titleObserver?.disconnect();
      // Left for another pathname before the deadline: send this page's view
      // now, labelled as this page. Still on it (an effect re-run, or the
      // tracker unmounting with the document): cancel, and let the re-run or
      // the pagehide flush own the emit.
      if (onThisPage()) pending.cancel();
      else pending.flush();
    };
  }, [pathname]);

  useEffect(() => {
    syncPageUrl(window.location.pathname, window.location.href);
  }, [searchParams]);

  return null;
}
