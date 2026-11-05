import 'server-only';
import { cache } from 'react';
import { db } from './firebase';
import { makeKeyedTtlCache, STATIC_TTL_MS } from './collection-cache';
import type { PromoShortVideo, ShortsMap } from './youtube-shorts';

// The Shorts map in Firestore (the social bridge, 2026-11-05): ONE document,
// socialVideos/youtube, { byPromo: { [promoId]: { videoId, title,
// publishedAt } }, syncedAt, uploadsSeen }. Written by the nightly sync
// (src/lib/youtube-shorts-sync.ts), read by every promo page render through
// the five-minute cache the static collections use, so a page costs no
// extra read in steady state.

export const SHORTS_COLLECTION = 'socialVideos';
export const SHORTS_DOC = 'youtube';

export interface ShortsDoc {
  byPromo: ShortsMap;
  syncedAt: string | null;
  uploadsSeen: number;
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function readMap(data: unknown): ShortsMap {
  const raw = ((data ?? {}) as { byPromo?: unknown }).byPromo;
  if (!raw || typeof raw !== 'object') return {};
  const map: ShortsMap = {};
  for (const [promoId, v] of Object.entries(raw as Record<string, unknown>)) {
    const rec = (v ?? {}) as Record<string, unknown>;
    const videoId = typeof rec.videoId === 'string' ? rec.videoId : '';
    if (!/^[a-f0-9]{16}$/i.test(promoId) || !VIDEO_ID_RE.test(videoId)) continue;
    map[promoId.toLowerCase()] = { videoId, title: typeof rec.title === 'string' ? rec.title : '', publishedAt: typeof rec.publishedAt === 'string' ? rec.publishedAt : '' };
  }
  return map;
}

/** The stored map, as written; empty when nothing was synced yet. */
export async function readShortsDoc(): Promise<ShortsDoc> {
  const snap = await db.collection(SHORTS_COLLECTION).doc(SHORTS_DOC).get();
  const data = snap.exists ? snap.data() : undefined;
  return {
    byPromo: readMap(data),
    syncedAt: typeof data?.syncedAt === 'string' ? data.syncedAt : null,
    uploadsSeen: typeof data?.uploadsSeen === 'number' ? data.uploadsSeen : 0,
  };
}

export async function writeShortsDoc(doc: ShortsDoc): Promise<void> {
  await db.collection(SHORTS_COLLECTION).doc(SHORTS_DOC).set(doc);
}

const shortsCache = makeKeyedTtlCache<ShortsMap>(STATIC_TTL_MS);

/** A preview's fixture: SOCIAL_VIDEOS_FIXTURE, the byPromo map as JSON, laid
 *  over the stored map on every deployment but production, so a preview can
 *  show a page's Short without a write to Firestore. Ignored in production
 *  whatever is set. */
export function fixtureShortsMap(env: Record<string, string | undefined> = process.env): ShortsMap {
  if (env.VERCEL_ENV === 'production' || !env.SOCIAL_VIDEOS_FIXTURE) return {};
  try {
    return readMap({ byPromo: JSON.parse(env.SOCIAL_VIDEOS_FIXTURE) });
  } catch {
    return {};
  }
}

/** The map for the pages: one read per server instance per five minutes.
 *  A read failure is an empty map, never a failed page. */
export const getShortsMap = cache(async (): Promise<ShortsMap> => {
  return shortsCache('youtube', async () => {
    let stored: ShortsMap = {};
    try {
      stored = (await readShortsDoc()).byPromo;
    } catch {
      stored = {};
    }
    return { ...stored, ...fixtureShortsMap() };
  });
});

/** The Short for any of a page's promo ids (a series page has one per date),
 *  the first found in row order. */
export async function getShortForPromos(promoIds: readonly string[]): Promise<PromoShortVideo | null> {
  const map = await getShortsMap();
  for (const id of promoIds) {
    const hit = map[id.toLowerCase()];
    if (hit) return hit;
  }
  return null;
}
