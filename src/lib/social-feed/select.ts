// Item selection for the social RSS feed (/feeds/social.xml).
//
// Pure over its inputs so it is unit-testable: the Firestore reads are
// injected as loaders (see feed.ts for the production wiring).
//
// Pass 1: scored promos (the /best-promos source), score desc.
// Pass 2: only when pass 1 yields fewer than FEED_CAP items after caps.
//   Unscored promos across all leagues, date asc, giveaway before theme,
//   promoId asc. Scoring covers MLB / MLS / WNBA only, so from the end of the
//   MLB regular season until spring this pass carries the feed.
// Both passes: giveaway and theme only, dated, not tombstoned, inside the
// window [today, today + 7] in America/Chicago, inclusive.
// Caps run across the combined list in order: max 2 per team, max 2 per
// derivedSignals.itemType where that is a real category (null and 'generic'
// are exempt; unscored promos carry no itemType), total 25. Duplicates by
// feed key (team + promoId), and by team + date + title, are dropped.

import { cleanText } from './text';

export const FEED_TIME_ZONE = 'America/Chicago';
export const FEED_WINDOW_DAYS = 7;
export const FEED_CAP = 25;
export const PER_TEAM_CAP = 2;
export const PER_ITEM_TYPE_CAP = 2;
const CAP_EXEMPT_ITEM_TYPES = new Set(['generic']);
const FEED_TYPES = new Set(['giveaway', 'theme']);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
// Allowed shape for each half of a feed key (teamId and promoId). An item
// whose card would 404 never enters the feed.
export const PROMO_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Promo doc ids are not unique across teams (legacy ids like "p10" or
// "2026-09-24-fan-appreciation-night" exist under several teams), so the feed
// keys every item by team and promo: guid, utm_content and the image path.
// "~" cannot occur in a teamId, so a key splits on its first "~".
export const FEED_KEY_SEPARATOR = '~';

export function feedKey(teamId: string, promoId: string): string {
  return `${teamId}${FEED_KEY_SEPARATOR}${promoId}`;
}

export function parseFeedKey(key: string): { teamId: string; promoId: string } | null {
  const at = key.indexOf(FEED_KEY_SEPARATOR);
  if (at < 0) return null;
  const teamId = key.slice(0, at);
  const promoId = key.slice(at + 1);
  if (!PROMO_ID.test(teamId) || !PROMO_ID.test(promoId)) return null;
  return { teamId, promoId };
}

export interface FeedCandidate {
  promoId: string;
  teamId: string;
  date: string | null | undefined;
  title: string;
  type: string;
  score?: number | null;
  itemType?: string | null;
  tombstoned?: boolean;
}

export interface FeedWindow {
  start: string;
  end: string;
}

export interface FeedSelection<T extends FeedCandidate> {
  items: T[];
  // Items [0, pass1Count) came from pass 1, the rest from pass 2.
  pass1Count: number;
  usedFallback: boolean;
  window: FeedWindow;
}

const centralYmdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEED_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function centralYMD(now: Date): string {
  return centralYmdFormat.format(now);
}

export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function feedWindow(now: Date): FeedWindow {
  const start = centralYMD(now);
  return { start, end: addDaysYMD(start, FEED_WINDOW_DAYS) };
}

function isEligible(c: FeedCandidate, w: FeedWindow): boolean {
  if (c.tombstoned === true) return false;
  if (!PROMO_ID.test(c.promoId) || !PROMO_ID.test(c.teamId)) return false;
  if (typeof c.date !== 'string' || !YMD.test(c.date)) return false;
  if (c.date < w.start || c.date > w.end) return false;
  if (!FEED_TYPES.has(c.type)) return false;
  return cleanText(c.title) !== '';
}

const isScored = (c: FeedCandidate) => typeof c.score === 'number' && Number.isFinite(c.score);

export function orderPass1<T extends FeedCandidate>(scored: T[], w: FeedWindow): T[] {
  return scored
    .filter((c) => isScored(c) && isEligible(c, w))
    .sort(
      (a, b) =>
        (b.score as number) - (a.score as number) ||
        (a.date as string).localeCompare(b.date as string) ||
        a.promoId.localeCompare(b.promoId),
    );
}

const TYPE_RANK: Record<string, number> = { giveaway: 0, theme: 1 };

// `pass1Keys` is the feed key of every row the pass-1 source returned. Pass 2 takes the rest,
// including a doc that carries a score but was left out of the scored reader
// (no scoreBreakdown/derivedSignals, or a league outside SCORED_LEAGUES).
// Pass-2 rows are unranked, so their score and itemType are cleared: ordering
// ignores them and the itemType cap exempts them.
export function orderPass2<T extends FeedCandidate>(unscored: T[], w: FeedWindow, pass1Keys?: ReadonlySet<string>): T[] {
  return unscored
    .filter((c) => (pass1Keys ? !pass1Keys.has(feedKey(c.teamId, c.promoId)) : !isScored(c)) && isEligible(c, w))
    .map((c) => ({ ...c, score: null, itemType: null }))
    .sort(
      (a, b) =>
        (a.date as string).localeCompare(b.date as string) ||
        TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
        a.promoId.localeCompare(b.promoId),
    );
}

function cappedItemType(c: FeedCandidate): string | null {
  if (!isScored(c)) return null;
  const t = typeof c.itemType === 'string' ? c.itemType.trim().toLowerCase() : '';
  if (!t || CAP_EXEMPT_ITEM_TYPES.has(t)) return null;
  return t;
}

// Walks an already-ordered list, keeping each item that fits every cap.
export function applyCaps<T extends FeedCandidate>(ordered: T[]): T[] {
  const out: T[] = [];
  const keys = new Set<string>();
  const contentKeys = new Set<string>();
  const perTeam = new Map<string, number>();
  const perItemType = new Map<string, number>();
  for (const c of ordered) {
    if (out.length >= FEED_CAP) break;
    const key = feedKey(c.teamId, c.promoId);
    if (keys.has(key)) continue;
    const contentKey = `${c.teamId}::${c.date}::${cleanText(c.title).toLowerCase()}`;
    if (contentKeys.has(contentKey)) continue;
    if ((perTeam.get(c.teamId) ?? 0) >= PER_TEAM_CAP) continue;
    const itemType = cappedItemType(c);
    if (itemType && (perItemType.get(itemType) ?? 0) >= PER_ITEM_TYPE_CAP) continue;
    keys.add(key);
    contentKeys.add(contentKey);
    perTeam.set(c.teamId, (perTeam.get(c.teamId) ?? 0) + 1);
    if (itemType) perItemType.set(itemType, (perItemType.get(itemType) ?? 0) + 1);
    out.push(c);
  }
  return out;
}

export async function selectFeedItems<T extends FeedCandidate>(opts: {
  now: Date;
  loadScored: (w: FeedWindow) => Promise<T[]>;
  loadUnscored: (w: FeedWindow) => Promise<T[]>;
}): Promise<FeedSelection<T>> {
  const window = feedWindow(opts.now);
  const scored = await opts.loadScored(window);
  const pass1 = orderPass1(scored, window);
  const pass1Items = applyCaps(pass1);
  if (pass1Items.length >= FEED_CAP) {
    return { items: pass1Items, pass1Count: pass1Items.length, usedFallback: false, window };
  }
  const pass1Keys = new Set(scored.map((c) => feedKey(c.teamId, c.promoId)));
  const pass2 = orderPass2(await opts.loadUnscored(window), window, pass1Keys);
  // Pass-1 items lead the combined list, so re-running the caps over it keeps
  // them unchanged and lets pass 2 fill only what the caps still allow.
  const items = applyCaps([...pass1Items, ...pass2]);
  return { items, pass1Count: pass1Items.length, usedFallback: true, window };
}
