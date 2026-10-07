// Which pages show a building's venueHubs facts, so a hub write can refresh
// every one of them. Pure: the route reads the hub and its tenant links, this
// decides the paths, and a test pins the decision.
//
// A WRITTEN HUB IS SHOWN ON MORE THAN ITS OWN PAGE. Since 2026-10-07 the team
// page renders the building's published view (TeamVenueFacts), the CFB school
// page renders its condensed block, the /venues index lists its topics, and the
// MLB bag comparison reads its bag fields. Refreshing /venues/{slug} alone
// would leave the team page saying the old thing for up to 24 hours, which is
// the disagreement this work exists to end.

import { PATH_RE } from './revalidate-paths';

export const SITE = 'https://www.getpromonight.com';
export const HUB_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface HubRevalidationPlan {
  /** Every path to revalidate, deduplicated, each passing PATH_RE. */
  paths: string[];
  /** Absolute URLs worth an IndexNow ping: the venue page when it is
   *  indexable, and the tenant team and school pages. */
  indexNowUrls: string[];
}

export function hubRevalidationPlan(input: {
  slug: string;
  /** Null when no venueHubs doc exists: the page is refreshed so it 404s. */
  hub: { tenants: Array<{ league: string }> } | null;
  indexable: boolean;
  /** resolveTenantTeamLinks(hub): only tenants that resolve to a live page. */
  tenantHrefs: string[];
}): HubRevalidationPlan {
  const venuePath = `/venues/${input.slug}`;
  const paths = new Set<string>([venuePath, '/venues']);
  if (input.hub?.tenants.some((t) => t.league === 'MLB')) paths.add('/venues/bag-policies');
  for (const href of input.tenantHrefs) paths.add(href);
  const out = [...paths].filter((p) => PATH_RE.test(p));
  const indexNowUrls = [
    ...(input.hub && input.indexable ? [`${SITE}${venuePath}`] : []),
    ...input.tenantHrefs.filter((h) => PATH_RE.test(h)).map((h) => `${SITE}${h}`),
  ];
  return { paths: out, indexNowUrls };
}
