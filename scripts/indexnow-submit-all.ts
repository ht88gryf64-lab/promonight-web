/* eslint-disable no-console */
/**
 * Submits every URL in the live production sitemap to IndexNow.
 *
 * Use this for the initial kickoff and as a recovery tool if we suspect
 * Bing/Yandex fell behind. Normal day-to-day flow is the deploy hook plus
 * the /api/indexnow/submit endpoint called by the promo-pipeline repo.
 *
 * We fetch the deployed sitemap over HTTP rather than importing
 * src/app/sitemap.ts because that module (via @/lib/firebase) pulls in
 * `server-only`, which throws outside the Next.js runtime.
 *
 * Usage: npx tsx --env-file=.env.local scripts/indexnow-submit-all.ts
 *
 * Requires INDEXNOW_KEY in .env.local. Does NOT need Firebase creds.
 */
import { submitToIndexNow } from '../src/lib/indexnow';

const SITEMAP_URL = 'https://www.getpromonight.com/sitemap.xml';

async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    throw new Error(`sitemap fetch failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const urls: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

async function main() {
  const urls = await fetchSitemapUrls();
  console.log(`[indexnow-submit-all] read ${urls.length} urls from ${SITEMAP_URL}`);
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
