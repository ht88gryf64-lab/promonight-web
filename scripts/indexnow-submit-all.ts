/* eslint-disable no-console */
/**
 * Submits every URL in the sitemap to IndexNow.
 *
 * Use this for the initial kickoff (first time we wire IndexNow up) and as
 * a recovery tool if we suspect Bing/Yandex fell behind. Normal day-to-day
 * updates flow through the deploy hook and the /api/indexnow/submit endpoint
 * called by the promo-pipeline repo.
 *
 * Usage: npx tsx --env-file=.env.local scripts/indexnow-submit-all.ts
 *
 * Requires INDEXNOW_KEY and FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.
 */
import { getAllSitemapUrls } from '../src/lib/sitemap-urls';
import { submitToIndexNow } from '../src/lib/indexnow';

async function main() {
  const urls = await getAllSitemapUrls();
  console.log(`[indexnow-submit-all] read ${urls.length} urls from sitemap`);
  if (urls.length > 0) {
    console.log('[indexnow-submit-all] sample:', urls.slice(0, 3));
  }
  await submitToIndexNow(urls);
  console.log('[indexnow-submit-all] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
