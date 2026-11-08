// eBay product images on bobblehead pages (docs/per-promo-pages-v2-spec.md,
// Visuals 6, step 5a, 2026-11-08). The Browse API is called at request time
// with the query the tier 2 search link already builds (src/lib/ebay.ts
// resaleQuery); the page is ISR, so the response lives exactly as long as the
// page's window and is never written anywhere. Up to three listings with
// images come back: image, price, EPN-tagged item link.
//
// THE GUARD. A listing shows only when its title carries a token that names
// THIS product: the player's surname or a specific product word from the
// promo's name. Category nouns never confirm (IMAGE_TOKEN_STOPLIST below:
// "bobblehead", "giveaway", "night", "edition", ...), nor do the club's own
// words, nor years. A promo whose name has no confirming token ("Mystery
// Bobblehead") gets no block, and the API is not called for it.
//
// FAILURE. An API error, a rate limit, a timeout past 800ms or missing
// credentials renders no block; the failure is logged once per page per ISR
// window and the page never throws.
//
// Server only: the client credentials are read here. Never import this from
// a client component or from email code (EPN scope is website-only).
import 'server-only';
import { ebayAffiliateItemUrl, ebayCampId, ebayCustomId, isBobbleheadGiveaway, isEbayResaleActive, resaleQuery } from './ebay';
import { synthPromoId } from './promo-helpers';
import type { Promo } from './types';

export interface EbayListing {
  itemId: string;
  title: string;
  imageUrl: string;
  /** The price as printed: "$24.99" for USD, "24.99 CAD" otherwise. */
  price: string;
  /** The EPN-tagged View Item link. */
  href: string;
}

/** The most the block shows. */
export const EBAY_LISTING_LIMIT = 3;
/** The whole call (token and search) must finish inside this. */
export const EBAY_TIMEOUT_MS = 800;
/** One failure line per page per ISR window (the promo page's revalidate,
 *  src/app/[sport]/[team]/promos/[slug]/page.tsx: 86400s). */
export const EBAY_LOG_WINDOW_MS = 86_400_000;

const BROWSE_SEARCH = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const OAUTH_TOKEN = 'https://api.ebay.com/identity/v1/oauth2/token';
const OAUTH_SCOPE = 'https://api.ebay.com/oauth/api_scope';
/** How many the API is asked for, so the guard has something to filter. */
const SEARCH_LIMIT = 12;

// ── the guard ────────────────────────────────────────────────────────────────

/** Words that describe the KIND of thing and so can never confirm that a
 *  listing is this promo's item. The promo type's own nouns, the giveaway
 *  boilerplate, product modifiers, the leagues and the sports, and the
 *  function words a title carries. Lowercase, singular and plural both. */
export const IMAGE_TOKEN_STOPLIST: ReadonlySet<string> = new Set([
  // the kind
  'bobblehead', 'bobbleheads', 'bobble', 'head', 'heads', 'figure', 'figures', 'figurine', 'figurines', 'statue', 'doll', 'collectible', 'collectibles', 'replica',
  // the giveaway boilerplate
  'giveaway', 'giveaways', 'night', 'nights', 'game', 'games', 'gameday', 'promo', 'promotion', 'promotions', 'sga', 'stadium', 'arena', 'center', 'centre', 'presented', 'sponsored', 'fans', 'fan', 'first', 'free', 'all', 'ticket', 'tickets', 'package', 'holder', 'holders',
  // modifiers that name an edition, not an item
  'edition', 'editions', 'statement', 'limited', 'special', 'exclusive', 'premium', 'official', 'licensed', 'commemorative', 'anniversary', 'celebration', 'tribute', 'legends', 'legend', 'series', 'mini', 'talking', 'singing', 'dancing', 'light', 'up', 'mystery', 'blind', 'box', 'remix', 'hometown', 'alumni', 'retro', 'throwback', 'classic', 'vintage', 'new', 'sealed', 'nib', 'mint', 'rare', 'lot',
  // leagues, sports and the words around them
  'nhl', 'nba', 'mlb', 'nfl', 'mls', 'wnba', 'hockey', 'basketball', 'baseball', 'football', 'soccer', 'team', 'teams', 'club', 'league', 'home', 'season', 'player', 'players', 'coach', 'star', 'stars', 'hall', 'fame', 'hof', 'captain', 'goalie', 'mascot',
  // function words
  'the', 'and', 'of', 'with', 'for', 'from', 'vs', 'at', 'in', 'on', 'to', 'by', 'a', 'an', 'his', 'her', 'their', 'your', 'our',
]);

/** Lowercase word tokens: letters and digits only, possessives dropped. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The promo name's confirming tokens: three letters or more (or a letter
 *  and digit mix such as "r2" and "d2"), not a bare number, not in the
 *  stoplist, not one of the club's own words (city, nickname, abbreviation).
 *  Empty means nothing can confirm a listing. */
export function productTokens(title: string, team: { city: string; name: string; abbreviation?: string }): string[] {
  // Each club word on its own (never a city + name join: teamDisplayName owns that).
  const club = new Set([...tokenize(team.city), ...tokenize(team.name), ...tokenize(team.abbreviation ?? '')]);
  const out = new Set<string>();
  for (const t of tokenize(title)) {
    const short = t.length < 3 && !(/\d/.test(t) && /[a-z]/.test(t));
    if (short || /^\d+$/.test(t) || IMAGE_TOKEN_STOPLIST.has(t) || club.has(t)) continue;
    out.add(t);
  }
  return [...out];
}

/** What a listing must satisfy: a confirming token, and no year that says
 *  it is another edition. */
export interface ListingGuard {
  tokens: readonly string[];
  /** The promo's year (from its date), or null when the date is unusable. */
  year: number | null;
}

/** The four-digit years a listing title names ("2012-13" names 2012 and
 *  2013; "76ers", "11/18" and "80's" name none). */
export function titleYears(title: string): number[] {
  const out = new Set<number>();
  for (const m of title.matchAll(/\b((?:19|20)\d{2})(?:[-\u2013/](\d{2}))?\b/g)) {
    const y = Number(m[1]);
    out.add(y);
    if (m[2]) out.add(Math.floor(y / 100) * 100 + Number(m[2]));
  }
  return [...out];
}

/** Whether a listing title carries one of the confirming tokens, as a whole
 *  word ("Ovechkin's" confirms "ovechkin"; "Sorokin" never confirms "soro"),
 *  and names no year outside the promo's own (the season spans two, so the
 *  year before and after pass; "2012-13 Julius Erving ... 76ers" against a
 *  2026 giveaway is another edition and is out, ux-review D2, 2026-11-08). */
export function listingConfirmed(listingTitle: string, guard: ListingGuard): boolean {
  if (!guard.tokens.length) return false;
  const words = new Set(tokenize(listingTitle));
  if (!guard.tokens.some((t) => words.has(t))) return false;
  if (guard.year !== null) {
    const years = titleYears(listingTitle);
    if (years.length && !years.some((y) => Math.abs(y - (guard.year as number)) <= 1)) return false;
  }
  return true;
}

// ── the response ─────────────────────────────────────────────────────────────

interface ItemSummary {
  itemId?: unknown;
  title?: unknown;
  image?: { imageUrl?: unknown } | null;
  thumbnailImages?: { imageUrl?: unknown }[] | null;
  price?: { value?: unknown; currency?: unknown } | null;
  itemWebUrl?: unknown;
  itemAffiliateWebUrl?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function formatPrice(value: unknown, currency: unknown): string | null {
  const v = str(value);
  const c = str(currency).toUpperCase();
  if (!v || !/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  if (c === 'USD' || c === '') return `$${n.toFixed(2)}`;
  return `${n.toFixed(2)} ${c}`;
}

/** eBay serves the same image at any of its sizes; 400px is two times the
 *  block's widest tile. */
function imageAt400(url: string): string {
  return url.replace(/\/s-l\d+\.(jpe?g|webp|png)$/i, '/s-l400.$1');
}

/** The confirmed listings with images, in the API's order, at most the
 *  limit; pure, for the tests. `customid` tags a response that came back
 *  without its own affiliate link. */
export function pickListings(summaries: unknown, guard: ListingGuard, customid: string, limit = EBAY_LISTING_LIMIT): EbayListing[] {
  if (!Array.isArray(summaries)) return [];
  const out: EbayListing[] = [];
  const seen = new Set<string>();
  for (const raw of summaries as ItemSummary[]) {
    if (!raw || typeof raw !== 'object') continue;
    const itemId = str(raw.itemId);
    const title = str(raw.title);
    const image = str(raw.image?.imageUrl) || str(raw.thumbnailImages?.[0]?.imageUrl);
    const webUrl = str(raw.itemWebUrl);
    const price = formatPrice(raw.price?.value, raw.price?.currency);
    if (!itemId || !title || !image || !webUrl || !price || seen.has(itemId)) continue;
    if (!/^https:\/\//.test(image) || !/^https:\/\/www\.ebay\.com\//.test(webUrl)) continue;
    if (!listingConfirmed(title, guard)) continue;
    let href = str(raw.itemAffiliateWebUrl);
    if (!/^https:\/\//.test(href)) {
      try {
        href = ebayAffiliateItemUrl(webUrl, customid);
      } catch {
        continue;
      }
    }
    seen.add(itemId);
    out.push({ itemId, title, imageUrl: imageAt400(image), price, href });
    if (out.length >= limit) break;
  }
  return out;
}

// ── the call ─────────────────────────────────────────────────────────────────

let appToken: { value: string; expiresAt: number } | null = null;
const failureLoggedAt = new Map<string, number>();

/** Test seam: forget the cached token and the failure log. */
export function _resetEbayBrowseForTests(): void {
  appToken = null;
  failureLoggedAt.clear();
}

function logFailureOnce(pageKey: string, reason: string, now = Date.now()): void {
  const at = failureLoggedAt.get(pageKey);
  if (at !== undefined && now - at < EBAY_LOG_WINDOW_MS) return;
  failureLoggedAt.set(pageKey, now);
  console.warn(`[ebay-browse] ${pageKey}: no block (${reason})`);
}

class EbayFailure extends Error {}

async function fetchAppToken(clientId: string, clientSecret: string, signal: AbortSignal): Promise<string> {
  const now = Date.now();
  if (appToken && appToken.expiresAt > now) return appToken.value;
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: OAUTH_SCOPE }).toString(),
    signal,
  });
  if (!res.ok) throw new EbayFailure(`token HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  const token = str(body.access_token);
  if (!token) throw new EbayFailure('token missing from response');
  const ttl = typeof body.expires_in === 'number' ? body.expires_in : 7200;
  // Renew a minute early; a token that expires mid-call is a failed call.
  appToken = { value: token, expiresAt: now + Math.max(0, ttl - 60) * 1000 };
  return token;
}

export interface EbayListingsInput {
  promo: Pick<Promo, 'date' | 'title' | 'type'>;
  team: { id: string; city: string; name: string; abbreviation?: string };
  /** Names the page in the failure log (the page path). */
  pageKey: string;
}

/** The query the block runs: the search link's own (src/lib/ebay.ts). */
export function ebayListingsQuery(input: Pick<EbayListingsInput, 'promo' | 'team'>): string {
  return resaleQuery(input.promo, input.team.name);
}

/** Up to three confirmed listings for a bobblehead giveaway, or [] for any
 *  reason at all (not a bobblehead, nothing can confirm, no credentials, an
 *  API error, a rate limit, a timeout). Never throws. */
export async function ebayListingsFor(input: EbayListingsInput): Promise<EbayListing[]> {
  const { promo, team, pageKey } = input;
  if (!isBobbleheadGiveaway(promo)) return [];
  const tokens = productTokens(promo.title, team);
  if (!tokens.length) return [];
  const year = /^\d{4}-\d{2}-\d{2}$/.test(promo.date) ? Number(promo.date.slice(0, 4)) : null;
  const guard: ListingGuard = { tokens, year };
  const clientId = process.env.EBAY_CLIENT_ID ?? '';
  const clientSecret = process.env.EBAY_CLIENT_SECRET ?? '';
  if (!isEbayResaleActive() || !clientId || !clientSecret) {
    logFailureOnce(pageKey, 'missing credentials');
    return [];
  }
  const customid = ebayCustomId('promo_page', synthPromoId(team.id, promo));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EBAY_TIMEOUT_MS);
  try {
    const token = await fetchAppToken(clientId, clientSecret, controller.signal);
    const url = new URL(BROWSE_SEARCH);
    url.searchParams.set('q', ebayListingsQuery(input));
    url.searchParams.set('limit', String(SEARCH_LIMIT));
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-ebay-c-marketplace-id': 'EBAY_US',
        'x-ebay-c-enduserctx': `affiliateCampaignId=${ebayCampId()},affiliateReferenceId=${customid}`,
        accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) appToken = null;
    if (!res.ok) throw new EbayFailure(res.status === 429 ? 'rate limited (429)' : `search HTTP ${res.status}`);
    const body = (await res.json()) as { itemSummaries?: unknown };
    return pickListings(body.itemSummaries, guard, customid);
  } catch (e) {
    const reason = controller.signal.aborted ? `timeout past ${EBAY_TIMEOUT_MS}ms` : e instanceof Error ? e.message : String(e);
    logFailureOnce(pageKey, reason);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
