// The page the visitor is on and the page they came from, shared by both
// page_view emitters (PageViewTracker and ScoringPageViewTracker) so every
// page_view carries an explicit page_location and page_referrer.
//
// WHY EXPLICIT. GA4 derives dl/dr itself, and on client-side navigations it
// gets them wrong: measured on production 2026-10-20, our page_view went out
// with dr empty on a card click, dr=/teams on a header click from a team page,
// and dr equal to the page itself after Back; on /teams tab flips dl was the
// URL the visitor had just left. Only Enhanced Measurement's own history
// page_view carried the right referrer. Passing both as event parameters makes
// our row correct on its own, so that duplicate can be switched off without
// losing the referrer.
//
// A "page" is a pathname. A query-only change (the /teams league tabs, a
// /follow footer self-link) is not a new page: it updates the current page's
// URL so the NEXT page's referrer is the URL the visitor actually left, but it
// mints no new entry and no page_view.
//
// ORDER-INDEPENDENT ON PURPOSE. Both emitters call enterPage() for the same
// navigation, and which effect runs first is not fixed: on a hard load each
// sits in its own Suspense boundary and those hydrate in separate commits. The
// first call for a pathname creates the entry and every later call for that
// pathname returns it unchanged, so both see the same referrer. That also
// makes a StrictMode effect re-run harmless.

export type PageEntry = {
  pathname: string;
  /** Full URL as the visitor reached it; kept current across query-only changes. */
  url: string;
  /** URL of the previous page, or document.referrer on the first page of the load. */
  referrer: string;
};

let current: PageEntry | null = null;

/** Pathname equality that tolerates one side being percent-encoded. */
export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const decode = (s: string) => {
    try {
      return decodeURI(s);
    } catch {
      return s;
    }
  };
  return decode(a) === decode(b);
}

/**
 * Registers arrival on `pathname` and returns its entry. Idempotent per
 * pathname: a second call for the page already current returns the same entry,
 * so its referrer is never overwritten with the page's own URL.
 */
export function enterPage(pathname: string, href: string, documentReferrer: string): PageEntry {
  if (current && samePath(current.pathname, pathname)) return current;
  current = {
    pathname,
    url: urlForPage(pathname, href),
    referrer: current ? current.url : documentReferrer,
  };
  return current;
}

/**
 * `href` if it is a URL of `pathname`, else origin + pathname. The two disagree
 * only when the location has already moved on before this page's effect ran
 * (Back pressed before a just-committed page flushed its effects): recording
 * the location there would label this page with the previous page's URL. The
 * page's own query is unknowable at that point, so it is dropped rather than
 * borrowed from the wrong page.
 */
function urlForPage(pathname: string, href: string): string {
  try {
    const u = new URL(href);
    return samePath(u.pathname, pathname) ? href : u.origin + pathname;
  } catch {
    return href;
  }
}

/** Query-only change on the current page: keep its URL current, nothing else. */
export function syncPageUrl(pathname: string, href: string): void {
  if (current && samePath(current.pathname, pathname)) current.url = href;
}

/**
 * What to do with a page's still-pending page_view when PageViewTracker's
 * effect for it is torn down. Left for another pathname: send it now (it is
 * labelled with its own URL, path and title, so sending late is correct).
 * Still on it (StrictMode's dev re-run, or the tracker unmounting with the
 * document): cancel, and let the re-run or the pagehide flush own the emit.
 *
 * The location is the only signal for "left", and it is reliable because
 * Next's HistoryUpdater writes pushState/replaceState from a
 * useInsertionEffect, i.e. in the commit's mutation phase, before passive
 * cleanups run; popstate (Back/Forward) moves it before React renders at all.
 * page-history.test.ts fails if HistoryUpdater stops doing that. If it ever
 * moved the write later, this would read "still here", cancel, and a view
 * the visitor left inside the deadline would be dropped again, silently.
 */
export function settlePendingPageView(
  pending: { flush: () => void; cancel: () => void },
  locationPathname: string,
  pagePathname: string,
): 'flush' | 'cancel' {
  if (samePath(locationPathname, pagePathname)) {
    pending.cancel();
    return 'cancel';
  }
  pending.flush();
  return 'flush';
}

/** Test-only reset of the module state. */
export function resetPageHistoryForTests(): void {
  current = null;
}
