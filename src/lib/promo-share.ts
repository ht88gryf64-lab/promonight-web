// Promo page sharing (2026-11-03): the pure half. Share ids, the shared URL,
// the share copy, the landing parse, the address-bar strip and the subId2
// rule. No DOM, no storage, no analytics: the client half lives in
// src/lib/promo-share-session.ts and src/components/promo-page/PromoShare.tsx.
//
// PRIVACY. A share id is 8 random characters and nothing else. It carries no
// user data, is never derived from the distinct_id, and the shared URL holds
// only the share id, the channel and the fixed campaign.

export type PromoShareChannel = 'native' | 'copy' | 'sms' | 'email' | 'x' | 'facebook';

export const PROMO_SHARE_CHANNELS: readonly PromoShareChannel[] = ['native', 'copy', 'sms', 'email', 'x', 'facebook'];

export const SHARE_ID_LENGTH = 8;
export const SHARE_ID_RE = /^[a-z0-9]{8}$/;
const SHARE_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const SHARE_UTM_SOURCE = 'share';
export const SHARE_UTM_CAMPAIGN = 'promo_page';
/** The share id's query parameter. */
export const SHARE_PARAM = 's';

/** A random 8-character share id, [a-z0-9]. Rejection sampling keeps every
 *  character uniform (256 is not a multiple of 36). `rand` is injectable for
 *  tests; it defaults to the platform's CSPRNG. */
export function newShareId(rand: (n: number) => Uint8Array = defaultRandom): string {
  const out: string[] = [];
  const limit = 256 - (256 % SHARE_ID_ALPHABET.length);
  while (out.length < SHARE_ID_LENGTH) {
    for (const b of rand(SHARE_ID_LENGTH * 2)) {
      if (b >= limit) continue;
      out.push(SHARE_ID_ALPHABET[b % SHARE_ID_ALPHABET.length]);
      if (out.length === SHARE_ID_LENGTH) break;
    }
  }
  return out.join('');
}

function defaultRandom(n: number): Uint8Array {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}

/** canonical + utm_source=share&utm_medium={channel}&utm_campaign=promo_page&s={id}.
 *  The canonical carries no query of its own; any it did carry is replaced,
 *  so a share of a shared URL never stacks parameters. */
export function buildShareUrl(canonical: string, channel: PromoShareChannel, shareId: string): string {
  const base = canonical.split('#')[0].split('?')[0];
  return `${base}?utm_source=${SHARE_UTM_SOURCE}&utm_medium=${channel}&utm_campaign=${SHARE_UTM_CAMPAIGN}&${SHARE_PARAM}=${shareId}`;
}

// ── copy (stored fields only) ───────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(ymd: string | null | undefined): { y: number; m: number; d: number; wd: number } | null {
  const x = YMD.exec(ymd ?? '');
  if (!x) return null;
  const y = Number(x[1]);
  const m = Number(x[2]);
  const d = Number(x[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d, wd: t.getUTCDay() };
}

/** "Sun Nov 15". Computed from the stored date alone (UTC), so the server,
 *  the client and every timezone print the same day. '' when not a date. */
export function formatDayMonD(ymd: string | null | undefined): string {
  const p = parts(ymd);
  return p ? `${WEEKDAYS[p.wd]} ${MONTHS[p.m - 1]} ${p.d}` : '';
}

/** "Nov 15". '' when not a date. */
export function formatShareMonD(ymd: string | null | undefined): string {
  const p = parts(ymd);
  return p ? `${MONTHS[p.m - 1]} ${p.d}` : '';
}

export interface PromoShareFacts {
  promoName: string;
  teamName: string;
  /** The display opponent, '' when the row has none. */
  displayOpponent: string;
  /** YYYY-MM-DD of the game the share names (the page's primary row). */
  date: string;
}

/** "{Promo}: {Team} vs {Opponent}, {Day Mon D}" with the missing parts left
 *  out rather than invented: no opponent drops " vs ...", no date drops the
 *  date. Used by the share text and the card's game line. */
export function shareGameLine(f: PromoShareFacts): string {
  const matchup = f.displayOpponent ? `${f.teamName} vs ${f.displayOpponent}` : f.teamName;
  const day = formatDayMonD(f.date);
  return day ? `${matchup}, ${day}` : matchup;
}

/** "{Promo name}: {Team} vs {Opponent}, {Day Mon D}. All the details:" */
export function shareText(f: PromoShareFacts): string {
  return `${f.promoName}: ${shareGameLine(f)}. All the details:`;
}

/** The text and the URL as one string, for the channels that take one body
 *  (SMS, email, X). */
export function shareBody(f: PromoShareFacts, url: string): string {
  return `${shareText(f)} ${url}`;
}

/** "{Promo name} at the {Team} game, {Mon D}" (no date: the date part drops). */
export function shareEmailSubject(f: PromoShareFacts): string {
  const md = formatShareMonD(f.date);
  return `${f.promoName} at the ${f.teamName} game${md ? `, ${md}` : ''}`;
}

export function smsHref(f: PromoShareFacts, url: string): string {
  return `sms:?&body=${encodeURIComponent(shareBody(f, url))}`;
}

export function mailtoHref(f: PromoShareFacts, url: string): string {
  return `mailto:?subject=${encodeURIComponent(shareEmailSubject(f))}&body=${encodeURIComponent(shareBody(f, url))}`;
}

export function xIntentHref(f: PromoShareFacts, url: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(shareText(f))}&url=${encodeURIComponent(url)}`;
}

export function facebookShareHref(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

// ── landing ─────────────────────────────────────────────────────────────────

export interface ShareLanding {
  shareId: string;
  channel: PromoShareChannel;
}

/** A shared-link landing: a well-formed `s` plus utm_source=share. A
 *  malformed id, a foreign utm_source or an unknown channel is not a share
 *  landing (nothing is registered and nothing is stripped). */
export function parseShareLanding(search: string): ShareLanding | null {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return null;
  }
  const shareId = q.get(SHARE_PARAM) ?? '';
  if (!SHARE_ID_RE.test(shareId)) return null;
  if (q.get('utm_source') !== SHARE_UTM_SOURCE) return null;
  const medium = q.get('utm_medium') ?? '';
  if (!(PROMO_SHARE_CHANNELS as readonly string[]).includes(medium)) return null;
  return { shareId, channel: medium as PromoShareChannel };
}

/** The URL with `s` and every utm_* removed; other parameters and the hash
 *  stay. Input and output are path + search + hash (what replaceState takes). */
export function stripShareParams(pathSearchHash: string): string {
  const hashAt = pathSearchHash.indexOf('#');
  const hash = hashAt >= 0 ? pathSearchHash.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? pathSearchHash.slice(0, hashAt) : pathSearchHash;
  const qAt = beforeHash.indexOf('?');
  if (qAt < 0) return pathSearchHash;
  const path = beforeHash.slice(0, qAt);
  const kept = beforeHash
    .slice(qAt + 1)
    .split('&')
    .filter((pair) => {
      if (!pair) return false;
      const key = decodeURIComponentSafe(pair.split('=')[0]).toLowerCase();
      return key !== SHARE_PARAM && !key.startsWith('utm_');
    });
  return `${path}${kept.length ? `?${kept.join('&')}` : ''}${hash}`;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ── subId2 (Impact second slot) ─────────────────────────────────────────────

/** The partners whose outbound links are Impact /c/ tracking links. SpotHero
 *  (HasOffers) and Expedia (in-house) are not Impact and are never touched. */
const IMPACT_PARTNERS = new Set(['ticketnetwork', 'ticketmaster', 'fanatics']);
/** An Impact tracking link: https://{vanity host}/c/{account}/{ad}/{campaign}.
 *  Ticketmaster without its env wrap is a bare ticketmaster.com URL, which
 *  this does not match, so it is left alone. */
const IMPACT_LINK_RE = /^https:\/\/[a-z0-9.-]+\/c\/\d+\/\d+\/\d+(?:[/?#]|$)/i;
export const SHARE_SUBID2 = 'share';

/** The href with subId2=share appended when it is an Impact link of an Impact
 *  partner. subId1 (and Ticketmaster's sharedid) is never read or changed.
 *  Idempotent: a link that already carries a subId2 is returned as is. */
export function withShareSubId2(href: string, partner: string): string {
  if (!IMPACT_PARTNERS.has(partner) || !IMPACT_LINK_RE.test(href)) return href;
  if (/[?&]subId2=/i.test(href)) return href;
  const hashAt = href.indexOf('#');
  const head = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  return `${head}${head.includes('?') ? '&' : '?'}subId2=${SHARE_SUBID2}${hash}`;
}
