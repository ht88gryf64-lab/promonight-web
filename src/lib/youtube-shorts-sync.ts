import 'server-only';
import { getAllTeams } from './data';
import { promoPagePath } from './promo-page-copy';
import { getUpcomingPromoIndex, isPromoPagesLive } from './promo-pages';
import { siteTodayYmd } from './site-today';
import { buildShortsMap, diffShortsMap, MAX_PAGES, parsePlaylistPage, playlistItemsUrl, uploadsPlaylistId, type ShortsMap, type ShortUpload } from './youtube-shorts';
import { readShortsDoc, writeShortsDoc } from './youtube-shorts-store';

// The nightly Shorts sync (the social bridge, 2026-11-05), a loader of the
// site batch of the nightly refresh (src/app/api/cron/nightly-refresh/route.ts
// promoPagesWithNewShorts): reads the channel's recent uploads, rewrites the
// map, and hands the refresh the promo pages whose Short changed, so they are
// revalidated, warmed and verified with the rest of the batch.
//
// The key is YOUTUBE_API_KEY, a read-only Data API key in the environment;
// without it the sync is skipped and the loader returns nothing. The key is
// never logged, and never reaches a response.

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface ShortsSyncResult {
  skipped: 'no_key' | null;
  uploads: number;
  map: ShortsMap;
  changedPromoIds: string[];
}

/** Every upload on the first MAX_PAGES pages of the uploads playlist. A page
 *  that fails ends the walk with what was read: a partial read must never
 *  wipe the map, so the caller keeps the stored map for promos it did not see. */
export async function fetchRecentUploads(apiKey: string, fetcher: Fetcher, playlistId: string = uploadsPlaylistId()): Promise<{ uploads: ShortUpload[]; complete: boolean }> {
  const uploads: ShortUpload[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetcher(playlistItemsUrl(playlistId, apiKey, pageToken));
    if (!res.ok) return { uploads, complete: false };
    const parsed = parsePlaylistPage(await res.json());
    uploads.push(...parsed.items);
    pageToken = parsed.nextPageToken;
    if (!pageToken) break;
  }
  return { uploads, complete: true };
}

/** Reads, merges and writes the map; returns the promo ids whose video
 *  changed. On an incomplete read, promos not seen keep their stored video. */
export async function syncYoutubeShorts(apiKey: string | undefined, fetcher: Fetcher = (url) => fetch(url)): Promise<ShortsSyncResult> {
  const before = await readShortsDoc();
  if (!apiKey) return { skipped: 'no_key', uploads: 0, map: before.byPromo, changedPromoIds: [] };
  const { uploads, complete } = await fetchRecentUploads(apiKey, fetcher);
  const seen = buildShortsMap(uploads);
  const map: ShortsMap = complete ? seen : { ...before.byPromo, ...seen };
  const changedPromoIds = diffShortsMap(before.byPromo, map);
  if (changedPromoIds.length > 0 || before.syncedAt === null) {
    await writeShortsDoc({ byPromo: map, syncedAt: new Date().toISOString(), uploadsSeen: uploads.length });
  }
  return { skipped: null, uploads: uploads.length, map, changedPromoIds };
}

/** The promo page paths of the changed promos that have a page today. */
export async function promoPagePathsFor(promoIds: readonly string[], today: string = siteTodayYmd()): Promise<string[]> {
  if (promoIds.length === 0 || !isPromoPagesLive()) return [];
  const [index, teams] = await Promise.all([getUpcomingPromoIndex(today), getAllTeams()]);
  const sportOf = new Map(teams.map((t) => [t.id, t.sportSlug]));
  const want = new Set(promoIds.map((id) => id.toLowerCase()));
  const out = new Set<string>();
  for (const p of index) {
    const sport = sportOf.get(p.teamId);
    if (sport && want.has(p.promoId.toLowerCase())) out.add(promoPagePath(sport, p.teamId, p.pageSlug));
  }
  return [...out];
}

/** The nightly loader: sync, then the pages to refresh. Any failure is
 *  logged and adds nothing; it can never stop the site batch. */
export async function promoPagesWithNewShorts(): Promise<string[]> {
  try {
    const result = await syncYoutubeShorts(process.env.YOUTUBE_API_KEY);
    if (result.skipped) {
      console.log('[shorts-sync] skipped: YOUTUBE_API_KEY is not set');
      return [];
    }
    const paths = await promoPagePathsFor(result.changedPromoIds);
    console.log(`[shorts-sync] uploads=${result.uploads} mapped=${Object.keys(result.map).length} changed=${result.changedPromoIds.length} pages=${paths.length}`);
    return paths;
  } catch (err) {
    console.error('[shorts-sync] failed', { message: (err as Error)?.message });
    return [];
  }
}
