// Shorts on promo pages (the social bridge, 2026-11-05): the PURE half.
//
// The video pipeline ends every YouTube description with a hidden marker,
// `pn:{promoId}` (a 16-hex Firestore promo id) or `pn:game:{gameId}` for a
// game with no promo. The nightly sync (src/lib/youtube-shorts-sync.ts) reads
// the PromoNight channel's recent uploads through the YouTube Data API,
// parses the markers and keeps promoId -> videoId in Firestore
// (socialVideos/youtube); a promo page whose id is in the map renders the
// Short as a click-to-load embed (src/components/promo-page/PromoShort.tsx)
// with VideoObject schema.
//
// No fetch, no Firestore, no env here: the parsing, the map, the diff and
// the URLs, so the tests cover them without a network.

export const PROMONIGHT_CHANNEL_ID = 'UCRU8aBU0662tBrGAHg-OE7Q';

/** A channel's uploads playlist: the channel id with UC swapped for UU. One
 *  playlistItems page (50 videos, descriptions included) costs one quota
 *  unit, against a hundred for a search. */
export function uploadsPlaylistId(channelId: string = PROMONIGHT_CHANNEL_ID): string {
  return `UU${channelId.slice(2)}`;
}

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/playlistItems';
export const PAGE_SIZE = 50;
/** Four pages: the last 200 uploads, a season of Shorts. */
export const MAX_PAGES = 4;

export function playlistItemsUrl(playlistId: string, apiKey: string, pageToken?: string | null): string {
  const q = new URLSearchParams({ part: 'snippet', playlistId, maxResults: String(PAGE_SIZE), key: apiKey });
  if (pageToken) q.set('pageToken', pageToken);
  return `${YOUTUBE_API}?${q.toString()}`;
}

/** The promo marker. `pn:game:{id}` is a game marker, not a promo, and does
 *  not match: the id must be 16 hex characters right after `pn:`. */
const PROMO_MARKER_RE = /(?:^|\s)pn:([a-f0-9]{16})(?=\s|$)/i;

export function promoIdFromDescription(description: string): string | null {
  const m = PROMO_MARKER_RE.exec(description);
  return m ? m[1].toLowerCase() : null;
}

export interface ShortUpload {
  videoId: string;
  title: string;
  publishedAt: string;
  promoId: string | null;
}

/** One upload's record in the map. */
export interface PromoShortVideo {
  videoId: string;
  title: string;
  publishedAt: string;
}

export type ShortsMap = Record<string, PromoShortVideo>;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The uploads on one playlistItems page and the token for the next. Items
 *  without a video id (a deleted or private upload) are skipped. */
export function parsePlaylistPage(json: unknown): { items: ShortUpload[]; nextPageToken: string | null } {
  const page = (json ?? {}) as { items?: unknown[]; nextPageToken?: unknown };
  const items: ShortUpload[] = [];
  for (const raw of Array.isArray(page.items) ? page.items : []) {
    const snippet = ((raw ?? {}) as { snippet?: Record<string, unknown> }).snippet ?? {};
    const resource = (snippet.resourceId ?? {}) as { videoId?: unknown };
    const videoId = str(resource.videoId);
    if (!VIDEO_ID_RE.test(videoId)) continue;
    items.push({
      videoId,
      title: str(snippet.title),
      publishedAt: str(snippet.publishedAt),
      promoId: promoIdFromDescription(str(snippet.description)),
    });
  }
  return { items, nextPageToken: typeof page.nextPageToken === 'string' && page.nextPageToken ? page.nextPageToken : null };
}

/** promoId -> the newest upload that carries it. A re-upload replaces the
 *  older video; uploads without a promo marker contribute nothing. */
export function buildShortsMap(uploads: readonly ShortUpload[]): ShortsMap {
  const map: ShortsMap = {};
  for (const u of uploads) {
    if (!u.promoId) continue;
    const have = map[u.promoId];
    if (have && have.publishedAt >= u.publishedAt) continue;
    map[u.promoId] = { videoId: u.videoId, title: u.title, publishedAt: u.publishedAt };
  }
  return map;
}

/** The promo ids whose video changed: added, replaced or gone. */
export function diffShortsMap(before: ShortsMap, after: ShortsMap): string[] {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const id of ids) {
    if (before[id]?.videoId !== after[id]?.videoId) changed.push(id);
  }
  return changed.sort();
}

export const shortWatchUrl = (videoId: string): string => `https://www.youtube.com/shorts/${videoId}`;
/** The privacy-enhanced player, started by the click that loads it. */
export const shortEmbedUrl = (videoId: string): string => `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
export const shortThumbnailUrl = (videoId: string): string => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/** The embed's box: a 9:16 Short at a fixed size, so the page never shifts
 *  when the player loads. */
export const SHORT_BOX = { width: 236, height: 420 } as const;

/** The VideoObject schema for a page's Short. */
export function shortJsonLd(short: PromoShortVideo, page: { name: string; description: string; url: string }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: short.title || page.name,
    description: page.description,
    thumbnailUrl: [shortThumbnailUrl(short.videoId)],
    uploadDate: short.publishedAt,
    contentUrl: shortWatchUrl(short.videoId),
    embedUrl: shortEmbedUrl(short.videoId).replace('?autoplay=1&', '?'),
    url: page.url,
    publisher: { '@type': 'Organization', name: 'PromoNight' },
  };
}
