// Redesign v2 preview gate.
//
// The team-page redesign is additive and gated: when the gate is OFF the page
// renders exactly as it does today; when ON it renders the new template. The
// gate is true on every non-production Vercel environment (preview deploys and
// local dev) OR when the production launch flag is explicitly set. Default in
// production with no flag is false.
//
// `NEXT_PUBLIC_REDESIGN_V2` is the production launch switch flipped later — do
// NOT set it here. It is NEXT_PUBLIC and carries no secret.

/**
 * Server-side gate. Reads the server-only `VERCEL_ENV`. Use this in Server
 * Components (the team page template branch).
 */
export function isRedesignEnabled(): boolean {
  return (
    process.env.VERCEL_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_REDESIGN_V2 === 'true'
  );
}

/**
 * Client-side equivalent. Reads `NEXT_PUBLIC_VERCEL_ENV` — mirrored from
 * `VERCEL_ENV` in next.config.ts — so the client computes the SAME result as
 * the server. This is what the global Nav/Footer use to self-suppress on team
 * routes, keeping client suppression in lock-step with the server template
 * branch (no double chrome, no hydration drift).
 *
 * Locally and on previews `NEXT_PUBLIC_VERCEL_ENV` is '' (or not 'production'),
 * so this returns true — matching the server's `VERCEL_ENV !== 'production'`.
 */
export function isRedesignEnabledClient(): boolean {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_REDESIGN_V2 === 'true'
  );
}

// Sport slugs that form a team route: `/{sport}/{team}`. Used by the chrome
// suppression so the global Nav/Footer only hide on actual team pages and
// nowhere else.
const TEAM_ROUTE_SPORTS = new Set(['mlb', 'nba', 'nfl', 'nhl', 'mls', 'wnba']);

/**
 * True when `pathname` is a team route (`/{sport}/{team}`, exactly two
 * segments with a known sport slug). Conservative: anything else returns
 * false so non-team routes are never touched.
 */
export function isTeamRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  return TEAM_ROUTE_SPORTS.has(segments[0].toLowerCase());
}
