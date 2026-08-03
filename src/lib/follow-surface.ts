// Capture-funnel surface vocabulary. Isomorphic on purpose: this is the ONE
// place that defines the entry-context surface strings shared by the email
// funnel analytics (client) and the stored subscriber `source` field (server).
// Keeping it free of `server-only` / `'use client'` lets both sides import the
// same union, so an `email_cta_click` surface joins cleanly to the
// `subscribers.source` it eventually writes.
//
// These are deliberately distinct from analytics' broader `AnalyticsSurface`
// enum (web_home / web_playoffs / web_best_promos / ...). The capture funnel is
// its own thing with its own dashboards; reusing the page-identity enum would
// muddy both. The string values match the source examples in the spec exactly.

export const CAPTURE_SURFACES = [
  'web_team_page',
  'web_homepage',
  'web_playoffs_hub',
  'web_aggregator',
  // The engagement-triggered capture sheet. ONE value for the whole feature:
  // which page it fired on is an analytics dimension (page_type, carried on the
  // capture_prompt_* events and on newsletter_signup), not a stored source tag,
  // so the team-page sheet and the aggregator sheet share this.
  //
  // LOAD-BEARING SINCE THE A/B WAS DROPPED. This value is now the entire
  // separation between "the sheet converted someone" and "a static CTA
  // converted someone", which is the comparison the experiment used to make.
  // Exactly one thing may write it: CaptureCard's submit. See ENTRY_SURFACES
  // below for the boundary that keeps that true.
  'web_engagement_capture',
  // Fallback for entry points that can't resolve a more specific surface (the
  // global footer CTA on a route none of the above match). Never the seed for
  // a primary placement; only a safety net so a stray click still records.
  'web_other',
] as const;

export type CaptureSurface = (typeof CAPTURE_SURFACES)[number];

export function isCaptureSurface(value: unknown): value is CaptureSurface {
  return (
    typeof value === 'string' &&
    (CAPTURE_SURFACES as readonly string[]).includes(value)
  );
}

// Coerce an untrusted value (query param, request body) to a known surface,
// falling back to web_other rather than throwing; a bad surface should never
// block a signup or a CTA render.
//
// USED BY /api/subscribe, which must keep accepting web_engagement_capture:
// that is the request the capture sheet itself makes. The narrower
// coerceEntrySurface below is for the /follow query param, which must not.
export function coerceCaptureSurface(value: unknown): CaptureSurface {
  return isCaptureSurface(value) ? value : 'web_other';
}

// Surfaces a visitor may arrive at /follow claiming to be. Every surface except
// the capture sheet's.
//
// WHY THE SHEET IS EXCLUDED. The sheet never links to /follow: it collects the
// address inline and POSTs /api/subscribe itself (CaptureCard.tsx). So
// `?source=web_engagement_capture` on /follow is never something this app
// produced — it is a hand-typed or copied URL — and honouring it would write the
// sheet's tag onto a signup the sheet had nothing to do with.
//
// That matters more than it looks. With the A/B dropped, source is the whole
// comparison: web_engagement_capture against the static-CTA surfaces, in the
// PostHog signups read AND in the Firestore confirm-rate read, where there is no
// page_type to disambiguate and no arm to fall back on. A forged tag is a
// silent, directional contamination of the one number the sheet is judged by.
// Cheaper to make it unreachable than to caveat it.
export const ENTRY_SURFACES: readonly CaptureSurface[] = CAPTURE_SURFACES.filter(
  (s) => s !== 'web_engagement_capture',
);

// Coerce the /follow `?source=` query param. Same fallback as
// coerceCaptureSurface, one fewer accepted value: a forged
// web_engagement_capture lands on web_other, which is the honest label for a
// /follow entry that cannot be attributed.
export function coerceEntrySurface(value: unknown): CaptureSurface {
  return isCaptureSurface(value) && value !== 'web_engagement_capture' ? value : 'web_other';
}

// Derive the surface from a pathname. Used by the site-wide footer CTA, which
// renders on every route and therefore can't be handed a fixed surface. Mirrors
// the route → surface mapping the per-page CTAs pass explicitly.
export function inferCaptureSurface(pathname: string | null | undefined): CaptureSurface {
  if (!pathname || pathname === '/') return 'web_homepage';
  if (pathname.startsWith('/playoffs')) return 'web_playoffs_hub';
  if (pathname.startsWith('/promos') || pathname.startsWith('/best-promos')) {
    return 'web_aggregator';
  }
  // Team routes are exactly `/{sport}/{team}` with a known sport slug.
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments.length === 2 &&
    ['mlb', 'nba', 'nfl', 'nhl', 'mls', 'wnba'].includes(segments[0].toLowerCase())
  ) {
    return 'web_team_page';
  }
  return 'web_other';
}
