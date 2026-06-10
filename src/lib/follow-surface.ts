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
export function coerceCaptureSurface(value: unknown): CaptureSurface {
  return isCaptureSurface(value) ? value : 'web_other';
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
