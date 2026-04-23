/* eslint-disable no-console */
/**
 * Submits a small, hard-coded set of URLs to IndexNow.
 *
 * Spun up after Bing Webmaster Tools flagged 8 team pages as "missing from
 * sitemap" — a stale-cache false positive from the apex→www migration
 * (commit 824fc1a). The sitemap is correct; this script just nudges Bing
 * and ChatGPT Search to re-crawl the flagged URLs rather than waiting for
 * the natural cycle.
 *
 * Usage: npx tsx --env-file=.env.local scripts/indexnow-submit-flagged.ts
 *
 * Requires INDEXNOW_KEY in .env.local.
 */
import { submitToIndexNow } from '../src/lib/indexnow';

const URLS = [
  'https://www.getpromonight.com/mlb/los-angeles-dodgers',
  'https://www.getpromonight.com/mlb/baltimore-orioles',
  'https://www.getpromonight.com/mlb/pittsburgh-pirates',
  'https://www.getpromonight.com/mlb/detroit-tigers',
  'https://www.getpromonight.com/mlb/los-angeles-angels',
  'https://www.getpromonight.com/mlb/chicago-white-sox',
  'https://www.getpromonight.com/mlb/atlanta-braves',
  'https://www.getpromonight.com/nba/denver-nuggets',
];

async function main() {
  console.log(`[indexnow-submit-flagged] submitting ${URLS.length} urls`);
  for (const u of URLS) console.log(`  - ${u}`);
  await submitToIndexNow(URLS);
  console.log('[indexnow-submit-flagged] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
