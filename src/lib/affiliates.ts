// Affiliate outbound URL generators with env-var-swappable tracking IDs and
// surface-aware sub-ID tagging. The builders compose a destination URL and
// inject the tracking ID when its env var is set; when the env var is unset
// the URL is left untagged. CTA components are expected to call
// `isPartnerActive(partner)` and skip rendering buttons whose env vars are
// empty — otherwise high-intent traffic would land at the partner with no
// commission attached (the SeatGeek-rejected case). The sub-ID encodes
// ${surface}_${promoId ?? 'none'} so partner reports can slice revenue by
// surface and promo without extra events.

import type { AnalyticsSurface } from './analytics';
import type { Team } from './types';

const SEATGEEK_AID = process.env.NEXT_PUBLIC_SEATGEEK_AID ?? '';
const STUBHUB_RID = process.env.NEXT_PUBLIC_STUBHUB_RID ?? '';
const SPOTHERO_ID = process.env.NEXT_PUBLIC_SPOTHERO_ID ?? '';
const BOOKING_AID = process.env.NEXT_PUBLIC_BOOKING_AID ?? '';
// Impact wrap-link template for Ticketmaster. Placeholder tokens — `{TARGET}`
// receives the URL-encoded destination (Ticketmaster team URL); `{SHARED_ID}`
// receives the surface tag for partner-side reporting. When unset, the
// Ticketmaster CTA falls back to a bare ticketmaster.com link with no
// commission attribution — graceful pre-approval behavior.
const TICKETMASTER_IMPACT_WRAP = process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP ?? '';
// Same wrap pattern for Fanatics. When unset (today), buildFanaticsUrl emits
// a direct fanatics.com URL with the canonical Impact attribution params
// (SSAID + utm + irgwc + sharedid) — confirmed via a real test click that
// returned a tracking pixel response. When set (after Mike confirms deep
// linking works), the URL builder transparently switches to the wrap form.
const FANATICS_IMPACT_WRAP = process.env.NEXT_PUBLIC_FANATICS_IMPACT_WRAP ?? '';

// Fanatics CTA visibility flag. Independent of the URL pattern A/B routing
// above — this only controls whether the team-page cluster renders the
// FanaticsCTA at all. False today because Fanatics' Impact deep linking
// is disabled at the program level: both the wrap and direct-SSAID URLs
// homepage every click instead of resolving to the team-specific page.
// Flip to 'true' once Impact confirms deep linking and the wrap env var
// is set, so the rendered card matches the routing it claims to do.
export const FANATICS_CTA_ENABLED =
  process.env.NEXT_PUBLIC_FANATICS_CTA_ENABLED === 'true';

export type AffiliatePartner =
  | 'seatgeek'
  | 'stubhub'
  | 'fanatics'
  | 'spothero'
  | 'booking'
  | 'ticketmaster';

export type AffiliateLinkOptions = {
  surface: AnalyticsSurface;
  promoId?: string | null;
};

// Returns true when the partner's tracking-ID env var is set, i.e. when
// outbound links carry commissionable tracking params. Buttons render
// regardless of this state — distribution and habit formation outweigh
// commission recoupment during the pre-approval phase, and bare URLs still
// route the user to the right partner. The flag is surfaced on the
// `affiliate_click` PostHog event as `affiliate_tracking_active` so we can
// quantify pre-approval click loss without affecting routing behavior.
export function isPartnerActive(partner: AffiliatePartner): boolean {
  switch (partner) {
    case 'seatgeek':
      return SEATGEEK_AID.length > 0;
    case 'stubhub':
      return STUBHUB_RID.length > 0;
    case 'fanatics':
      // Bridge period: tracking is "active" only once the Impact wrap env
      // var is set. The direct-URL SSAID path also attributes (SSAID is hard-
      // coded in buildFanaticsUrl), but PostHog's affiliate_tracking_active
      // flag flips on confirmed-wrap so the bridge vs wrap-active periods
      // get a clean reporting boundary.
      return FANATICS_IMPACT_WRAP.length > 0;
    case 'spothero':
      return SPOTHERO_ID.length > 0;
    case 'booking':
      return BOOKING_AID.length > 0;
    case 'ticketmaster':
      return TICKETMASTER_IMPACT_WRAP.length > 0;
  }
}

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

/** @deprecated Affiliate program not currently approved. Retained so existing
 *  imports (`buildAffiliateUrl`, legacy callsites) keep type-checking. The
 *  active ticket partner is Ticketmaster — see `buildTicketmasterUrl`. */
export function seatGeekUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  setParam(url, 'aid', SEATGEEK_AID);
  setParam(url, 'sub1', subId(opts));
  return url.toString();
}

/** @deprecated Affiliate program not currently approved. Retained so existing
 *  imports (`buildAffiliateUrl`, legacy callsites) keep type-checking. The
 *  active ticket partner is Ticketmaster — see `buildTicketmasterUrl`. */
export function stubHubUrl(rawUrl: string, opts: AffiliateLinkOptions): string {
  const url = new URL(rawUrl);
  setParam(url, 'rid', STUBHUB_RID);
  setParam(url, 'sub_id', subId(opts));
  return url.toString();
}

/** @deprecated Fanatics URLs are now wrap-resolved by `buildFanaticsUrl` at
 *  the call site, where team + surface are known. The full URL ships from the
 *  builder with all Impact attribution params embedded — there is nothing
 *  left to tag here, so re-tag is a passthrough. Retained as a no-op so the
 *  `buildAffiliateUrl('fanatics', ...)` switch case below stays self-evident
 *  alongside the other partners. */
export function fanaticsUrl(rawUrl: string, _opts: AffiliateLinkOptions): string {
  return rawUrl;
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
      // Wrap-resolved by buildFanaticsUrl at the call site — passthrough.
      return rawUrl;
    case 'spothero':
      return spotHeroUrl(rawUrl, opts);
    case 'booking':
      return bookingUrl(rawUrl, opts);
    case 'ticketmaster':
      // Ticketmaster URLs are wrap-resolved by `buildTicketmasterUrl` at the
      // call site (where teamSlug + surface are known). Surface tracking
      // rides inside the wrap template's SharedID, not on a query param —
      // there's nothing to tag here, so pass the URL through unchanged.
      return rawUrl;
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

/** @deprecated Affiliate program not currently approved. Restore when
 *  SeatGeek direct brand approval lands. The active ticket partner is
 *  Ticketmaster — see `buildTicketmasterUrl`. */
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
  /** Team slug (Firestore id), e.g. 'toronto-blue-jays'. StubHub's canonical
   *  team-page format is `/{slug}-tickets/category/<id>`, but the numeric
   *  category id is per-team and not easy to source. `/{slug}-schedule/` also
   *  resolves to a real team page on StubHub and works without an id map. */
  teamSlug?: string;
  surface: AnalyticsSurface;
  promoId?: string | null;
};

/** @deprecated Affiliate program not currently approved. Restore when
 *  StubHub direct brand approval lands. The active ticket partner is
 *  Ticketmaster — see `buildTicketmasterUrl`. */
export function buildStubHubUrl(opts: StubHubOpts): string {
  const base = opts.teamSlug
    ? `https://www.stubhub.com/${encodeURIComponent(opts.teamSlug)}-schedule/`
    : 'https://www.stubhub.com/';
  return stubHubUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type TicketmasterOpts = {
  /** PromoNight team slug (Firestore doc id), e.g. 'minnesota-twins'. */
  teamSlug: string;
  /** Ticketmaster URL slug. Set on the Team via Firestore for all 167 teams
   *  by scripts/populate-ticketmaster-fields.ts. Equals teamSlug for most
   *  teams; differs for a handful (e.g. lafc → 'los-angeles-football-club'). */
  ticketmasterSlug?: string;
  /** Ticketmaster URL artist id — the numeric segment after `/artist/`. Set
   *  on the Team via Firestore alongside ticketmasterSlug. When both are
   *  present the builder emits the canonical `/artist/{id}` URL form which
   *  resolves directly without redirect; when missing it falls back to the
   *  legacy `{slug}-tickets` form (which Ticketmaster redirects). */
  ticketmasterAttractionId?: string;
  surface: AnalyticsSurface;
  /** Promo id is accepted for parity with the other typed builders but the
   *  Ticketmaster wrap template only carries one passthrough slot — surface
   *  takes precedence; promo-level attribution rides PostHog's
   *  `affiliate_click` event, not the wrap. */
  promoId?: string | null;
};

// Builds the outbound Ticketmaster URL. When NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP
// is unset (pre-approval / wrap-not-yet-issued), returns a bare team URL —
// click still routes the user to the right place, just without commission
// attribution. When set, the destination URL is folded into the Impact wrap
// template and the surface name rides as SharedID for partner-side reporting.
//
// URL form selection (in priority order):
//   1. Canonical: `/{ticketmasterSlug}-tickets/artist/{ticketmasterAttractionId}`
//      — resolves directly without redirect. Used once both fields are
//      populated on the Team via Firestore (the populate script does this
//      for all 167 teams from scripts/ticketmaster-team-mapping.json).
//   2. Slug-only:  `/{ticketmasterSlug}-tickets` — fallback for any team
//      missing the artist id. Ticketmaster's slug → artist redirect handles it.
//   3. Internal slug: `/{teamSlug}-tickets` — last-ditch fallback for teams
//      that haven't been through the populate script. Same redirect path as #2.
export function buildTicketmasterUrl(opts: TicketmasterOpts): string {
  let directUrl: string;
  if (opts.ticketmasterSlug && opts.ticketmasterAttractionId) {
    directUrl = `https://www.ticketmaster.com/${encodeURIComponent(opts.ticketmasterSlug)}-tickets/artist/${encodeURIComponent(opts.ticketmasterAttractionId)}`;
  } else {
    const slug = opts.ticketmasterSlug ?? opts.teamSlug;
    directUrl = `https://www.ticketmaster.com/${encodeURIComponent(slug)}-tickets`;
  }

  if (!TICKETMASTER_IMPACT_WRAP) {
    return directUrl;
  }

  return TICKETMASTER_IMPACT_WRAP
    .replace('{TARGET}', encodeURIComponent(directUrl))
    .replace('{SHARED_ID}', encodeURIComponent(opts.surface));
}

// FanaticsOpts intentionally narrow: team's id + league are all the URL
// builder needs. Surface rides as Impact's `sharedid` (direct path) or
// {SHARED_ID} (wrap path) for partner-side reporting. promoId is dropped
// because the Impact direct-attribution shape exposes one passthrough slot
// and surface-level slicing is what affiliate reporting needs at this stage.
// Per-promo attribution still rides PostHog's affiliate_click event.
export interface FanaticsOpts {
  team: Pick<Team, 'id' | 'league'>;
  surface: AnalyticsSurface;
}

// Returns the outbound Fanatics URL.
//
// Pattern A (NEXT_PUBLIC_FANATICS_IMPACT_WRAP set): wrap the destination
// through Impact's tracking domain, with {TARGET} and {SHARED_ID} swapped in.
// This is the preferred shape once Mike confirms deep linking works on
// the wrap.
//
// Pattern B (env unset, today's bridge state): emit a direct fanatics.com
// URL with the canonical Impact attribution params (SSAID + utm + irgwc
// + sharedid). Confirmed via a real test click that returned a tracking
// pixel response — commission still attributes through this path.
export function buildFanaticsUrl(opts: FanaticsOpts): string {
  const fanaticsPath = `/${opts.team.league.toLowerCase()}/${opts.team.id}`;
  const directUrl = `https://www.fanatics.com${fanaticsPath}`;

  if (FANATICS_IMPACT_WRAP) {
    return FANATICS_IMPACT_WRAP
      .replace('{TARGET}', encodeURIComponent(directUrl))
      .replace('{SHARED_ID}', encodeURIComponent(opts.surface));
  }

  const params = new URLSearchParams({
    utm_source: 'Impact',
    utm_medium: 'affiliates',
    _s: 'afl_impact',
    afsrc: '1',
    irgwc: '1',
    SSAID: '7236189',
    sharedid: opts.surface,
  });
  return `${directUrl}?${params.toString()}`;
}

export type SpotHeroOpts = {
  /** Preferred — venue coordinates. SpotHero's /search?lat=&lng= endpoint
   *  resolves to a list of stadium-area parking garages. */
  latitude?: number;
  longitude?: number;
  /** Retained for call-site compatibility but unused: SpotHero's
   *  ?destination=<name> query crashes their servers (real 500) and the
   *  canonical /destination/<city>/<venue>-parking path requires a per-team
   *  venue-slug map we don't maintain. When only a name is supplied we fall
   *  back to the SpotHero homepage rather than ship a 500-ing link. */
  venue?: string;
  surface: AnalyticsSurface;
  promoId?: string | null;
};

export function buildSpotHeroUrl(opts: SpotHeroOpts): string {
  const base = hasValidCoords(opts.latitude, opts.longitude)
    ? `https://spothero.com/search?lat=${opts.latitude}&lng=${opts.longitude}`
    : 'https://spothero.com/';
  return spotHeroUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}

export type BookingOpts = {
  /** Preferred: exact venue coordinates. Booking's coordinate search radiates
   *  ~5-10 mi from the point — ideal for stadium-area hotel searches and
   *  immune to the brand-city-vs-stadium-city string-matching problem. */
  latitude?: number;
  longitude?: number;
  /** Fallback when coordinates aren't available. Free-form city/region query. */
  location?: string;
  surface: AnalyticsSurface;
  promoId?: string | null;
};

function hasValidCoords(lat: number | undefined, lng: number | undefined): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

export function buildBookingUrl(opts: BookingOpts): string {
  let base: string;
  if (hasValidCoords(opts.latitude, opts.longitude)) {
    base = `https://www.booking.com/searchresults.html?latitude=${opts.latitude}&longitude=${opts.longitude}`;
  } else if (opts.location && opts.location.trim().length > 0) {
    base = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(opts.location)}`;
  } else {
    // Neither lat/lng nor location — land on Booking homepage; still tag so
    // partner attribution works if the visitor converts.
    base = 'https://www.booking.com/';
  }
  return bookingUrl(base, {
    surface: opts.surface,
    promoId: opts.promoId,
  });
}
