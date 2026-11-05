// The one place the site builds links to the PromoNight app's store listings
// (app funnel G1, 2026-10-11). Every store href on the site comes from here;
// the old IOS_APP_URL / ANDROID_APP_URL constants in app-download-buttons.tsx
// re-export the bare URLs below.
//
// ATTRIBUTION
// - App Store: campaign parameters only when NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN
//   is set (?pt=<token>&ct=<campaign>&mt=8). Unset, the link is bare. Setting
//   the variable and rebuilding is the whole switch; no code change. The ct is
//   a short fixed token per surface, never a team or a promo
//   (appStoreCampaign).
// - Google Play: an install `referrer` carrying utm_source=web,
//   utm_medium=<surface>, utm_content=<teamId>, utm_campaign=<placement>.
// - A visitor who reaches /download from a promo page's "Remind me" button
//   (surface promo_cta, hotfix 2026-10-31) also carries the promo. Play gets
//   promoId and pageSlug after the team in utm_content, joined by `_` (team
//   ids, slugs and promo ids never contain one, so it splits back into its
//   three parts).
// - Team and promo detail lives in Play's utm_content and in PostHog
//   (app_download_click, web_app_cta_click), never in the App Store ct: App
//   Store Connect hides a campaign under 5 installs, so a per-team or
//   per-promo token would never report (ruling 2026-10-31).
//
// NEXT_PUBLIC_ variables are inlined at build time, so the token is read with
// its literal name inside the function (the client bundle gets the value; the
// tests can set process.env per case).

export const IOS_APP_ID = '6761309246';
export const ANDROID_PACKAGE = 'com.promonight.app';

/** Bare App Store listing, Apple's campaign-link form. */
export const IOS_APP_URL = `https://apps.apple.com/app/apple-store/id${IOS_APP_ID}`;
/** Bare Google Play listing. */
export const ANDROID_APP_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Where a store link sits. Recorded as `surface` on app_download_click. */
export type AppLinkSurface = 'team_cta' | 'promo_cta' | 'download' | 'download_qr';

export type AppLinkOptions = {
  surface: AppLinkSurface;
  /** The team page the link came from. */
  teamId?: string;
  /** Which link on the surface, e.g. which QR code on /download. */
  placement?: string;
  /** On /download: the CTA that sent the visitor there (downloadOrigin). */
  from?: DownloadOrigin;
  /** The promo page the visitor came from, with pageSlug (both or neither). */
  promoId?: string;
  pageSlug?: string;
  /** The session's first-touch UTMs when the visitor came in through the
   *  social bridge (a Short's link, a bio link): the App Store ct becomes
   *  {utm_source}_{utm_campaign} and the Play referrer utm_source and
   *  utm_campaign, in place of the surface tokens (2026-11-05). */
  utm?: StoreUtm | null;
};

/** The UTMs a store link carries: utm_source (always), utm_campaign and
 *  utm_content when the visit had them. */
export type StoreUtm = { source: string; campaign: string | null; content: string | null };

const UTM_VALUE_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const first = (v: unknown): string | undefined => (Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined);

/** The store UTMs in /download's query (DownloadSessionUtm puts the session's
 *  first touch there when the visitor arrived without them). utm_source is
 *  required; every value is checked against a plain token alphabet before it
 *  is copied into a store link. */
export function utmFromParams(params: Record<string, string | string[] | undefined>): StoreUtm | undefined {
  const source = first(params.utm_source);
  if (!source || !UTM_VALUE_RE.test(source)) return undefined;
  const campaign = first(params.utm_campaign);
  const content = first(params.utm_content);
  return {
    source,
    campaign: campaign && UTM_VALUE_RE.test(campaign) ? campaign : null,
    content: content && UTM_VALUE_RE.test(content) ? content : null,
  };
}

/** The App Store ct for a social visit: {utm_source}_{utm_campaign} (the
 *  source alone without a campaign), lowercased, anything outside letters,
 *  digits, `_` and `-` replaced, cut to Apple's 30 characters. */
export function utmCampaignToken(utm: StoreUtm): string {
  const raw = utm.campaign ? `${utm.source}_${utm.campaign}` : utm.source;
  return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, APP_STORE_CAMPAIGN_MAX);
}

/** App Store Connect caps a campaign token at 30 characters. */
export const APP_STORE_CAMPAIGN_MAX = 30;

/** The CTAs that link to /download with a `src`. */
export type DownloadOrigin = 'team_cta' | 'promo_cta';

/** The App Store ct for each surface: short, fixed, no team, no promo
 *  (ruling 2026-10-31). The /download QR codes share the page's token. Every
 *  surface in docs/cta-registry.md that reaches the App Store does so through
 *  one of these (the homepage, about, aggregator and nav buttons all go
 *  through /download). */
export const APP_STORE_CT: Record<AppLinkSurface, string> = {
  promo_cta: 'pc',
  team_cta: 'tc',
  download: 'dl',
  download_qr: 'dl',
};

/** The surface's token; on /download, the token of the CTA that sent the
 *  visitor there, so a promo page's or a team card's installs count under its
 *  own token whichever /download link (button or QR) finished the trip. */
export function appStoreCampaign({ surface, from }: AppLinkOptions): string {
  return APP_STORE_CT[from ?? surface];
}

export function appStoreUrl(opts: AppLinkOptions): string {
  if (opts.utm) {
    // A social visit: ct names the source and campaign; pt rides along when a
    // provider token is set (APPLE_PROVIDER_TOKEN on the server, which builds
    // every /download link, else the public token). Without one the link
    // still carries ct, as asked (2026-11-05).
    const providerToken = process.env.APPLE_PROVIDER_TOKEN || process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN;
    const q = new URLSearchParams();
    if (providerToken) q.set('pt', providerToken);
    q.set('ct', utmCampaignToken(opts.utm));
    q.set('mt', '8');
    return `${IOS_APP_URL}?${q.toString()}`;
  }
  const token = process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN;
  if (!token) return IOS_APP_URL;
  const q = new URLSearchParams({ pt: token, ct: appStoreCampaign(opts), mt: '8' });
  return `${IOS_APP_URL}?${q.toString()}`;
}

/** The decoded Play install referrer: utm pairs, in a fixed order. */
export function playReferrer({ surface, teamId, placement, promoId, pageSlug, utm }: AppLinkOptions): string {
  if (utm) {
    // A social visit: utm_source and utm_campaign as the visitor carried them
    // (encoded once more into the referrer by playStoreUrl).
    const q = new URLSearchParams({ utm_source: utm.source });
    if (utm.campaign) q.set('utm_campaign', utm.campaign);
    return q.toString();
  }
  const q = new URLSearchParams({ utm_source: 'web', utm_medium: surface });
  const content = [teamId, promoId, pageSlug].filter(Boolean).join('_');
  if (content) q.set('utm_content', content);
  if (placement) q.set('utm_campaign', placement);
  return q.toString();
}

export function playStoreUrl(opts: AppLinkOptions): string {
  return `${ANDROID_APP_URL}&referrer=${encodeURIComponent(playReferrer(opts))}`;
}

/** The visitor's device, for picking a store and for analytics. iPadOS Safari
 *  reports itself as a Mac; a Mac user agent with a touch screen is an iPad. */
export type ClientPlatform = 'ios' | 'android' | 'desktop';

export function detectClientPlatform(userAgent: string, maxTouchPoints = 0): ClientPlatform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function currentClientPlatform(): ClientPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  return detectClientPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/** The team card's desktop link. /download reads the team back out of `src`
 *  (teamFromDownloadSrc) so its store links and QR codes keep the team. */
export function downloadHref(teamId: string): string {
  return `/download?src=team_cta_${teamId}`;
}

/** The promo page's "Remind me" link: the team in `src` as the team card
 *  does, the promo as two separate params /download carries into its store
 *  links (promoFromDownloadParams). */
export function promoDownloadHref(teamId: string, promoId: string, pageSlug: string): string {
  return `/download?${new URLSearchParams({ src: `promo_cta_${teamId}`, promoId, pageSlug }).toString()}`;
}

/** The rel for an app CTA link: `nofollow` on every /download link that
 *  carries a query, merged with whatever rel the link already has
 *  (chore/bot-firewall, 2026-11-02). The team card and the promo page each put
 *  a distinct `?src=` variant on every page (1,535 of them), and all of them
 *  canonicalize to /download, so crawlers have nothing to gain from following
 *  them. The bare /download (nav, footer, buttons) stays followable: it is
 *  the canonical page. Every other href keeps its rel unchanged. */
export function downloadLinkRel(href: string, rel?: string): string | undefined {
  if (!/^\/download\?/.test(href)) return rel;
  const tokens = new Set((rel ?? '').split(/\s+/).filter(Boolean));
  tokens.add('nofollow');
  return [...tokens].join(' ');
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The team id in a /download `src` value, or undefined. Only the team card's
 *  and the promo page's own shapes are accepted, and only a slug: anything
 *  else in the query string is ignored rather than copied into a store link. */
export function teamFromDownloadSrc(src: unknown): string | undefined {
  if (typeof src !== 'string') return undefined;
  const m = /^(?:team_cta|promo_cta)_(.+)$/.exec(src);
  return m && SLUG_RE.test(m[1]) && m[1].length <= 60 ? m[1] : undefined;
}

/** The CTA a /download `src` names, when it is one of the accepted shapes
 *  with a valid team. */
export function downloadOrigin(src: unknown): DownloadOrigin | undefined {
  if (!teamFromDownloadSrc(src)) return undefined;
  return (src as string).startsWith('promo_cta_') ? 'promo_cta' : 'team_cta';
}

/** The promo a /download visit came from: only on a promo_cta `src` with a
 *  team, and only when promoId (letters and digits) and pageSlug (a slug) are
 *  both well formed. Otherwise neither is carried. */
export function promoFromDownloadParams(params: {
  src?: unknown;
  promoId?: unknown;
  pageSlug?: unknown;
}): { promoId: string; pageSlug: string } | undefined {
  const { src, promoId, pageSlug } = params;
  if (typeof src !== 'string' || !src.startsWith('promo_cta_') || !teamFromDownloadSrc(src)) return undefined;
  if (typeof promoId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(promoId)) return undefined;
  if (typeof pageSlug !== 'string' || !SLUG_RE.test(pageSlug) || pageSlug.length > 120) return undefined;
  return { promoId, pageSlug };
}
