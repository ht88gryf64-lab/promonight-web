/**
 * Runs the Shorts sync once, by hand (the social bridge, 2026-11-05): the
 * same code the nightly refresh's site batch runs
 * (src/lib/youtube-shorts-sync.ts), against the YouTube Data API with
 * YOUTUBE_API_KEY and the Firestore map socialVideos/youtube.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/sync-youtube-shorts.ts [--dry-run]
 *
 * --dry-run reads the channel and reports what would change, and writes
 * nothing. The key is never printed. Pages are not revalidated here: the
 * nightly batch does that on production once the branch ships.
 */
import { fetchRecentUploads, promoPagePathsFor, syncYoutubeShorts } from '../src/lib/youtube-shorts-sync';
import { buildShortsMap, diffShortsMap } from '../src/lib/youtube-shorts';
import { readShortsDoc } from '../src/lib/youtube-shorts-store';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.error('YOUTUBE_API_KEY is not set');
    process.exit(2);
  }
  if (dryRun) {
    const before = await readShortsDoc();
    const { uploads, complete } = await fetchRecentUploads(key, (url) => fetch(url));
    const map = buildShortsMap(uploads);
    const withMarker = uploads.filter((u) => u.promoId !== null).length;
    const changed = diffShortsMap(before.byPromo, map);
    const paths = await promoPagePathsFor(changed);
    console.log(JSON.stringify({ dryRun: true, complete, uploadsSeen: uploads.length, uploadsWithPromoMarker: withMarker, promosMatched: Object.keys(map).length, storedBefore: Object.keys(before.byPromo).length, wouldChange: changed.length, upcomingPagesToRefresh: paths }, null, 2));
    return;
  }
  const before = await readShortsDoc();
  const result = await syncYoutubeShorts(key, (url) => fetch(url));
  const paths = await promoPagePathsFor(result.changedPromoIds);
  console.log(JSON.stringify({ dryRun: false, uploadsSeen: result.uploads, promosMatched: Object.keys(result.map).length, storedBefore: Object.keys(before.byPromo).length, changed: result.changedPromoIds.length, upcomingPagesToRefresh: paths }, null, 2));
}

main().catch((e: Error) => {
  console.error(`sync-youtube-shorts failed: ${e.message}`);
  process.exit(1);
});
