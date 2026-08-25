import { cache } from 'react';
import { getAllTeams } from '@/lib/data';
import { getAllCfbSchoolIds } from '@/lib/cfb/data';
import { coverageFromTeams, type CoverageCounts } from '@/lib/coverage-counts';

/**
 * Live coverage counts for server code (page bodies, generateMetadata, route
 * handlers). cache()-wrapped so the root layout's metadata, the page, and the
 * footer share one pair of reads per request. Kept apart from the pure module
 * so tests can exercise the derivation without loading firebase-admin.
 *
 * Reads fail loudly, matching the sitemap and llms.txt: a page that renders
 * "0 teams across zero leagues" is worse than a build that stops.
 */
export const getCoverageCounts = cache(async (): Promise<CoverageCounts> => {
  const [teams, cfbIds] = await Promise.all([getAllTeams(), getAllCfbSchoolIds()]);
  return coverageFromTeams(teams, cfbIds.length);
});
