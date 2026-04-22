// Affiliate outbound URL generators with env-var-swappable tracking IDs and
// surface-aware sub-ID tagging. Every builder returns a working direct URL
// when the partner's env var is unset — the tracking ID simply doesn't get
// injected, so clicks still land at the right destination (unpaid) until
// programs approve. The sub-ID encodes ${surface}_${promoId ?? 'none'} so
// partner reports can slice revenue by surface and promo without extra events.

import type { AnalyticsSurface } from './analytics';

const SEATGEEK_AID = process.env.NEXT_PUBLIC_SEATGEEK_AID ?? '';
const STUBHUB_RID = process.env.NEXT_PUBLIC_STUBHUB_RID ?? '';
const FANATICS_ID = process.env.NEXT_PUBLIC_FANATICS_ID ?? '';
const SPOTHERO_ID = process.env.NEXT_PUBLIC_SPOTHERO_ID ?? '';
const BOOKING_AID = process.env.NEXT_PUBLIC_BOOKING_AID ?? '';

export type AffiliatePartner =
  | 'seatgeek'
  | 'stubhub'
  | 'fanatics'
  | 'spothero'
  | 'booking';

export type AffiliateLinkOptions = {
  surface: AnalyticsSurface;
  promoId?: string | null;
};

function subId(opts: AffiliateLinkOptions): string {
  return `${opts.surface}_${opts.promoId ?? 'none'}`;
}

function setParam(url: URL, key: string, value: string): void {
  if (!value) return;
  url.searchParams.set(key, value);
}

// ── Raw-URL tagging helpers ──────────────────────────────────────────────
// Used by <TrackedAffiliateLink>, which accepts a pre-built outbound URL and
// re-tags it at render time. Idempotent with the typed builders below.

export function seatGeekUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  setParam(url, 'aid', SEATGEEK_AID);
  setParam(url, 'sub1', subId(opts));
  return url.toString();
}

export function stubHubUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  setParam(url, 'rid', STUBHUB_RID);
  setParam(url, 'sub_id', subId(opts));
  return url.toString();
}

export function fanaticsUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  // Fanatics runs on Impact; subId1 is the standard passthrough param.
  setParam(url, 'clickref', FANATICS_ID);
  setParam(url, 'subId1', subId(opts));
  return url.toString();
}

export function spotHeroUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  // SpotHero runs on CJ Affiliate; pid is the partner ID, sid is the passthrough.
  setParam(url, 'pid', SPOTHERO_ID);
  setParam(url, 'sid', subId(opts));
  return url.toString();
}

export function bookingUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  setParam(url, 'aid', BOOKING_AID);
  setParam(url, 'label', subId(opts));
  return url.toString();
}

export function buildAffiliateUrl(
  partner: AffiliatePartner,
  rawUrl: string,
  opts: AffiliateLinkOptions,
): string {
  switch (partner) {
    case 'seatgeek':
      return seatGeekUrl(rawUrl, opts);
    case 'stubhub':
      return stubHubUrl(rawUrl, opts);
    case 'fanatics':
      return fanaticsUrl(rawUrl, opts);
    case 'spothero':
      return spotHeroUrl(rawUrl, opts);
    case 'booking':
      return bookingUrl(rawUrl, opts);
  }
}

// ── Typed builders — CTA components call these ───────────────────────────
// These compose a complete outbound URL from the minimum data each partner
// needs, then apply the tracking params via the helpers above.

export type SeatGeekOpts = {
  team?: string; // team slug: 'minnesota-twins', 'boston-celtics'
  event?: string; // optional SeatGeek event slug; overrides team if present
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildSeatGeekUrl(opts: SeatGeekOpts): string {
  const base = 'https://seatgeek.com';
  const path = opts.event
    ? `/${encodeURIComponent(opts.event)}`
    : opts.team
      ? `/${encodeURIComponent(opts.team)}-tickets`
      : '';
  return seatGeekUrl(`${base}${path}`, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type StubHubOpts = {
  team?: string; // display name e.g. 'Minnesota Twins'
  event?: string; // optional event URL/path
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildStubHubUrl(opts: StubHubOpts): string {
  // StubHub's canonical team pages are slug-based and brittle across sports;
  // the search endpoint is deterministic and returns the team page as the
  // top hit for any real team name.
  const query = opts.event || opts.team || '';
  const base = `https://www.stubhub.com/find/s/?q=${encodeURIComponent(query)}`;
  return stubHubUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type FanaticsOpts = {
  team: string; // display name e.g. 'Minnesota Twins'
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildFanaticsUrl(opts: FanaticsOpts): string {
  // Fanatics search returns the team hub as the top result and handles every
  // team across the six supported leagues consistently.
  const base = `https://www.fanatics.com/search?query=${encodeURIComponent(opts.team)}`;
  return fanaticsUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type SpotHeroOpts = {
  venue: string; // venue name, used as search destination
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildSpotHeroUrl(opts: SpotHeroOpts): string {
  const base = `https://spothero.com/search?destination=${encodeURIComponent(opts.venue)}`;
  return spotHeroUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type BookingOpts = {
  location: string; // city name, Booking.com searches fuzzy on this
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildBookingUrl(opts: BookingOpts): string {
  const base = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(opts.location)}`;
  return bookingUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}
