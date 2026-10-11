// The one place the site builds links to the PromoNight app's store listings
// (app funnel G1, 2026-10-11). Every store href on the site comes from here;
// the old IOS_APP_URL / ANDROID_APP_URL constants in app-download-buttons.tsx
// re-export the bare URLs below.
//
// ATTRIBUTION
// - App Store: campaign parameters only when NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN
//   is set (?pt=<token>&ct=<campaign>&mt=8). Unset, the link is bare. Setting
//   the variable and rebuilding is the whole switch; no code change.
// - Google Play: an install `referrer` carrying utm_source=web,
//   utm_medium=<surface>, utm_content=<teamId>, utm_campaign=<placement>.
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
export type AppLinkSurface = 'team_cta' | 'download' | 'download_qr';

export type AppLinkOptions = {
  surface: AppLinkSurface;
  /** The team page the link came from. */
  teamId?: string;
  /** Which link on the surface, e.g. which QR code on /download. */
  placement?: string;
};

/** App Store Connect caps a campaign token at 30 characters. */
export const APP_STORE_CAMPAIGN_MAX = 30;

/** `web_{surface}_{teamId}` (or the placement when there is no team), cut to
 *  30 characters. Across the 169 team ids no two cut tokens collide (checked
 *  2026-10-11); 54 are cut. */
export function appStoreCampaign({ surface, teamId, placement }: AppLinkOptions): string {
  return ['web', surface, teamId ?? placement].filter(Boolean).join('_').slice(0, APP_STORE_CAMPAIGN_MAX);
}

export function appStoreUrl(opts: AppLinkOptions): string {
  const token = process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN;
  if (!token) return IOS_APP_URL;
  const q = new URLSearchParams({ pt: token, ct: appStoreCampaign(opts), mt: '8' });
  return `${IOS_APP_URL}?${q.toString()}`;
}

/** The decoded Play install referrer: utm pairs, in a fixed order. */
export function playReferrer({ surface, teamId, placement }: AppLinkOptions): string {
  const q = new URLSearchParams({ utm_source: 'web', utm_medium: surface });
  if (teamId) q.set('utm_content', teamId);
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

/** The team id in a /download `src` value, or undefined. Only the team card's
 *  own shape is accepted, and only a slug: anything else in the query string
 *  is ignored rather than copied into a store link. */
export function teamFromDownloadSrc(src: unknown): string | undefined {
  if (typeof src !== 'string') return undefined;
  const m = /^team_cta_([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(src);
  return m && m[1].length <= 60 ? m[1] : undefined;
}
