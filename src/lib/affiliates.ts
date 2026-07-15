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
import { FANATICS_AD_IDS } from './fanatics-ad-ids';

const SEATGEEK_AID = process.env.NEXT_PUBLIC_SEATGEEK_AID ?? '';
const STUBHUB_RID = process.env.NEXT_PUBLIC_STUBHUB_RID ?? '';
// Impact wrap-link template for Ticketmaster. Placeholder tokens — `{TARGET}`
// receives the URL-encoded destination (Ticketmaster team URL); `{SHARED_ID}`
// receives the surface tag for partner-side reporting. When unset, the
// Ticketmaster CTA falls back to a bare ticketmaster.com link with no
// commission attribution — graceful pre-approval behavior.
const TICKETMASTER_IMPACT_WRAP = process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP ?? '';

export type AffiliatePartner =
  | 'seatgeek'
  | 'stubhub'
  | 'fanatics'
  | 'spothero'
  | 'expedia'
  | 'ticketmaster'
  | 'ticketnetwork';

// ── Ticket vendor (historical sole-vendor switch) ────────────────────────
// The ticket CTA now renders BOTH vendors stacked — Ticketmaster on top,
// TicketNetwork below (see components/affiliates/TicketmasterCTA.tsx) — so this
// constant no longer gates which vendor renders. It is retained as the record
// of the prior single-vendor era and for the /dev/affiliate-check diagnostics
// readout. Both link builders (buildTicketmasterUrl + the env wrap,
// buildTicketNetworkLink) and the per-partner isPartnerActive/buildAffiliateUrl
// cases remain wired and exercised by the stacked CTA.
export const TICKET_VENDOR: 'ticketnetwork' | 'ticketmaster' = 'ticketnetwork';

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
      // The Impact /c/ prefix, account, campaign and adIds are hardcoded
      // constants baked into every Fanatics link (no env var), so the outbound
      // link is always commissionable and tracking is always active (same
      // model as TicketNetwork and Expedia).
      return true;
    case 'spothero':
      // HasOffers aff_c prefix + aff_id=2427 are hardcoded constants (no env
      // var), so the outbound link is always commissionable — same model as
      // Fanatics / Expedia / TicketNetwork.
      return true;
    case 'expedia':
      // Partnerize camref is a hardcoded constant baked into the URL — the
      // outbound link is always commissionable, so tracking is always active.
      return true;
    case 'ticketmaster':
      return TICKETMASTER_IMPACT_WRAP.length > 0;
    case 'ticketnetwork':
      // The Impact tracking prefix + property IDs are hardcoded constants baked
      // into every TicketNetwork link (no env var) — the outbound link is always
      // commissionable, so tracking is always active (same model as Expedia).
      return true;
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

/** @deprecated Fanatics links are fully assembled by `buildFanaticsUrl` at the
 *  call site, where team + surface are known. The Impact `/c/` prefix, adId
 *  and subId1 are already baked in, and re-tagging would corrupt the encoded
 *  `u` param. Retained as a no-op so the `buildAffiliateUrl('fanatics', ...)`
 *  switch case below stays self-evident alongside the other partners. */
export function fanaticsUrl(rawUrl: string, _opts: AffiliateLinkOptions): string {
  return rawUrl;
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
      // Fanatics links are fully assembled by `buildFanaticsUrl` at the call
      // site: the Impact prefix, adId, and subId1 are already baked in. Do
      // NOT re-tag; re-encoding would corrupt the `u` deep-link param.
      return rawUrl;
    case 'spothero':
      // SpotHero links are fully assembled by `buildSpotHeroUrl` (the aff_c
      // tracker with aff_id + aff_sub baked in). Do NOT re-tag; passthrough.
      return rawUrl;
    case 'expedia':
      // The Partnerize tracking template (camref/creativeref/adref) is already
      // baked into the URL by buildExpediaHotelLink — passthrough, do NOT
      // re-tag the way Booking's aid was injected.
      return rawUrl;
    case 'ticketmaster':
      // Ticketmaster URLs are wrap-resolved by `buildTicketmasterUrl` at the
      // call site (where teamSlug + surface are known). Surface tracking
      // rides inside the wrap template's SharedID, not on a query param —
      // there's nothing to tag here, so pass the URL through unchanged.
      return rawUrl;
    case 'ticketnetwork':
      // TicketNetwork links are fully assembled by `buildTicketNetworkLink`
      // at the call site — the Impact prefix, property IDs, and subId1 are
      // already baked in. Do NOT re-tag; pass the URL through unchanged.
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
  /** Venue hub only: building slug, appended to the SharedID so attribution is
   *  per-building (web_venue_{slug}). Omitted by every other surface. */
  venueSlug?: string;
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
    .replace(
      '{SHARED_ID}',
      encodeURIComponent(opts.venueSlug ? `${opts.surface}_${opts.venueSlug}` : opts.surface),
    );
}

// ── TicketNetwork (Impact) ───────────────────────────────────────────────
// Active ticket vendor when TICKET_VENDOR === 'ticketnetwork'. Unlike
// Ticketmaster (whose Impact wrap template is injected via an env var),
// TicketNetwork's Impact tracking link is a FIXED prefix + constant property
// IDs — there is NO env var and NO render-time re-tag (buildAffiliateUrl passes
// 'ticketnetwork' through unchanged). The tracked link wraps a TicketNetwork
// performer landing page as the `u` query param.
//
// Final structure — byte-identical to the validated reference (Twins,
// web_team_page surface):
//   https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=<ENCODED_LANDING>&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_team_page_minnesota-twins
// Built as a raw string (NOT URLSearchParams) so the param order and the single
// encodeURIComponent of the landing URL stay byte-exact.
const TICKETNETWORK = {
  prefix: 'https://ticketnetwork.lusg.net/c/7236189/120057/2322',
  // Same value rides both partnerpropertyid and MediaPartnerPropertyId.
  partnerPropertyId: '8313917',
  performerHost: 'https://www.ticketnetwork.com',
  defaultPath: '/e/performers/',
} as const;

// Landing-page overrides, keyed by PromoNight team.id. Default rule:
// `${performerHost}/e/performers/${team.id}-tickets`. An entry overrides the
// slug and/or the path segment when TicketNetwork lists a team differently.
// Populate from audit/validate-ticketnetwork-links.ts, which HTTP-checks the
// default-rule landing for every team and flags any that need an override.
const TICKETNETWORK_OVERRIDES: Record<string, { slug?: string; path?: string }> = {
  // The Athletics are listed as 'athletics' under /performers/ (no /e/ segment).
  'oakland-athletics': { slug: 'athletics', path: '/performers/' },
};

// Resolves the TicketNetwork performer landing page (the decoded `u` target)
// for a team, applying any override. Returns null when no slug resolves so
// callers never emit a broken ticket link. Exported for the validate-on-build
// script, which HTTP-checks these landing URLs.
export function ticketNetworkLandingUrl(team: Pick<Team, 'id' | 'ticketNetworkSlug'>): string | null {
  const override = TICKETNETWORK_OVERRIDES[team.id];
  // Slug precedence mirrors ticketmasterSlug: an explicit ticketNetworkSlug on
  // the Team (e.g. a CFB school's full football slug) wins over the id-based
  // default, so a short id like "minnesota" resolves the TN performer
  // "minnesota-golden-gophers" instead of the ambiguous "minnesota".
  const slug = team.ticketNetworkSlug ?? override?.slug ?? team.id;
  if (!slug) return null;
  const path = override?.path ?? TICKETNETWORK.defaultPath;
  return `${TICKETNETWORK.performerHost}${path}${slug}-tickets`;
}

export type TicketNetworkLinkOpts = {
  team: Pick<Team, 'id' | 'ticketNetworkSlug'>;
  /** Venue hub only: building slug, inserted before team.id so subId1 is
   *  web_venue_{slug}_{teamId}. Omitted by every other surface. */
  venueSlug?: string;
  /** subId1 surface segment, already including the `web_` prefix
   *  (e.g. 'web_team_page'). Away-game CTAs pass 'web_away_game' so attribution
   *  matches the Expedia pubref convention (see lib/hotel-link.ts). */
  surface: AnalyticsSurface | 'web_away_game';
};

// Assembles the full tracked TicketNetwork link. Returns null when the landing
// page can't be resolved (graceful fallback — the CTA must not render a broken
// <a>). subId1 uses team.id (matches analytics team_slug + the Expedia pubref
// for cross-partner joinability) even when the landing slug is overridden.
export function buildTicketNetworkLink(opts: TicketNetworkLinkOpts): string | null {
  const landing = ticketNetworkLandingUrl(opts.team);
  if (!landing) return null;
  return (
    `${TICKETNETWORK.prefix}?u=${encodeURIComponent(landing)}` +
    `&partnerpropertyid=${TICKETNETWORK.partnerPropertyId}` +
    // Venue hub keys on the BUILDING, not the tenant: a hub does not know which
    // tenant a fan arrived from, and a shared building has no single answer, so
    // the subId is web_venue_{slug} with NO team suffix. Team-keyed attribution
    // (surface_team.id) is for the team-page block, where the team is known.
    `&MediaPartnerPropertyId=${TICKETNETWORK.partnerPropertyId}` +
    `&subId1=${opts.venueSlug ? `${opts.surface}_${opts.venueSlug}` : `${opts.surface}_${opts.team.id}`}`
  );
}

// ── Fanatics (Impact) ────────────────────────────────────────────────────
// Same model as TicketNetwork above: a FIXED Impact `/c/` prefix with constant
// account + campaign ids, NO env var, and NO render-time re-tag
// (buildAffiliateUrl passes 'fanatics' through unchanged). The canonical team
// store URL rides as the `u` deep-link param.
//
// Links previously pointed straight at www.fanatics.com, which fired PostHog
// `affiliate_click` but logged nothing in Impact: the click never crossed an
// Impact redirect, so no irclickid was ever minted. Routing through `/c/`
// is what makes the click attributable.
//
// Only the adId segment varies per team; see FANATICS_AD_IDS. Teams with no
// mapped adId use genericAdId, which deep-links and attributes identically.
//
// Final structure, byte-identical to the validated reference (Twins,
// web_team_page surface):
//   https://fanatics.93n6tx.net/c/7236189/618882/9663?subId1=web_team_page_minnesota-twins&u=<ENCODED_DESTINATION>
// Built as a raw string (NOT URLSearchParams) so the single encodeURIComponent
// of the destination stays byte-exact: the store paths contain '+' catalog
// separators that MUST survive as %2B, and URLSearchParams would emit '+' for
// spaces and re-encode the '%' of an already-encoded value.
const FANATICS = {
  origin: 'https://fanatics.93n6tx.net',
  account: '7236189',
  campaignId: '9663',
  // Used when a team has no entry in FANATICS_AD_IDS: Impact's generic
  // Fanatics tracking link. Deep-links via `u` exactly like the per-team ads.
  genericAdId: '586570',
  storeOrigin: 'https://www.fanatics.com',
} as const;

// Session-scoped params that Fanatics and Impact append to a URL as you browse.
// They are meaningless (and actively harmful) baked into a stored destination:
// a stale irclickid inside `u` can misattribute the click to whoever earned it
// originally. Today all 169 stored fanaticsUrl values are clean; this strip is
// defense-in-depth against a future copy-paste out of a live browsing session.
const FANATICS_RUNTIME_PARAMS = ['_ref', 'irclickid', 'irgwc', 'afsrc', '_s', 'ssaid'];

/** Strips session tracking params from a stored destination. Matching is
 *  case-insensitive (SSAID ships uppercase); `utm_*` is stripped by prefix.
 *  A destination with no query string is returned untouched, so the common
 *  case stays byte-identical to what Firestore holds. Unparseable input is
 *  passed through rather than dropped, on the grounds that a broken link beats
 *  no link at all. */
export function stripFanaticsRuntimeParams(rawUrl: string): string {
  // Short-circuit the common case. Every stored fanaticsUrl is query-less, and
  // round-tripping through URL would silently normalize it (a bare origin gains
  // a trailing slash, hosts lowercase, default ports vanish). Returning early
  // makes "byte-identical" a property of the code, not an accident of the data.
  if (!rawUrl.includes('?')) return rawUrl;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  // Snapshot the keys: deleting while iterating searchParams skips entries.
  for (const key of [...url.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (k.startsWith('utm_') || FANATICS_RUNTIME_PARAMS.includes(k)) {
      url.searchParams.delete(key);
    }
  }
  // Drop the '?' that URL leaves behind once the last param is deleted.
  if ([...url.searchParams.keys()].length === 0) url.search = '';
  return url.toString();
}

// FanaticsOpts: the canonical team-store URL lives on the Team document as
// `fanaticsUrl` (populated by scripts/migrate-fanatics-path-to-url.ts).
// `fanaticsPath` is the legacy root-relative form, accepted as a fallback
// for one deploy cycle. `id` selects the per-team adId and rides subId1 for
// cross-partner joins. The FanaticsCTA component gates render on a populated
// URL/path. When both are missing the card doesn't show at all (this is what
// omits the 86 CFB schools, whose adapter never sets either field), so this
// builder's empty case is a defensive last resort.
export interface FanaticsOpts {
  team: Pick<Team, 'id' | 'fanaticsUrl' | 'fanaticsPath'>;
  surface: AnalyticsSurface;
}

// Assembles the full tracked Fanatics link.
//
// Source precedence: prefer the fully-qualified `fanaticsUrl`. Fall back to
// `'https://www.fanatics.com' + fanaticsPath` for any team doc not yet
// migrated. TODO(fanatics-url-cleanup): drop the fanaticsPath fallback once
// production has baked and the field is gone from the team docs.
//
// subId1 mirrors buildTicketNetworkLink exactly (`${surface}_${team.id}`), so
// Fanatics and TicketNetwork revenue joins on the same key in Impact reports.
// Per-promo attribution stays on PostHog's affiliate_click event.
export function buildFanaticsUrl(opts: FanaticsOpts): string {
  const rawUrl =
    opts.team.fanaticsUrl ??
    (opts.team.fanaticsPath ? `${FANATICS.storeOrigin}${opts.team.fanaticsPath}` : '');
  // Defensive: caller (FanaticsCTA) is expected to gate render on a populated
  // URL/path, so an empty rawUrl here means a logic bug upstream. Land on the
  // store homepage rather than emit a 404-ing URL, still through Impact so
  // the click is attributed even in the bug case.
  const destination = stripFanaticsRuntimeParams(rawUrl || FANATICS.storeOrigin);
  const adId = FANATICS_AD_IDS[opts.team.id] ?? FANATICS.genericAdId;

  return (
    `${FANATICS.origin}/c/${FANATICS.account}/${adId}/${FANATICS.campaignId}` +
    `?subId1=${opts.surface}_${opts.team.id}` +
    `&u=${encodeURIComponent(destination)}`
  );
}

export type SpotHeroOpts = {
  /** Preferred — venue coordinates. SpotHero's /search?lat=&lng= endpoint
   *  resolves to a list of stadium-area parking garages. Absent -> homepage. */
  latitude?: number;
  longitude?: number;
  /** Per-surface sub-ID, e.g. "web_team_page_minnesota-twins" or
   *  "web_venue_arrowhead-stadium". Rides aff_c as `aff_sub`, which the HasOffers
   *  tracker records as the ~secondary_publisher / per-surface breakdown field.
   *  Confirmed live via the aff_c format=json echo: aff_sub populates it;
   *  aff_sub2/aff_sub3/sub_aff do NOT. */
  subKey: string;
};

// SpotHero attribution runs on HasOffers (aff_id=2427), NOT CJ. The outbound link
// is the aff_c click tracker over HTTPS, which sets the affiliate session cookie
// and 302s via `url=` to the coordinate search. The old CJ pid/sid builder shipped
// with pid UNSET, so every SpotHero click across the site was unattributed; this
// replaces it. The aff_c prefix + aff_id are hardcoded constants (always
// commissionable), same model as Fanatics / Expedia / TicketNetwork.
const SPOTHERO_AFF_C = 'https://tracking.spothero.com/aff_c';
export function buildSpotHeroUrl(opts: SpotHeroOpts): string {
  const destination = hasValidCoords(opts.latitude, opts.longitude)
    ? `https://spothero.com/search?lat=${opts.latitude}&lng=${opts.longitude}`
    : 'https://spothero.com/';
  const params = new URLSearchParams({
    offer_id: '1',
    aff_id: '2427',
    aff_sub: opts.subKey,
    url: destination,
  });
  return `${SPOTHERO_AFF_C}?${params.toString()}`;
}

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

// ── Expedia (Partnerize) hotel deep links ────────────────────────────────────
// Expedia runs on Partnerize. The whole tracking template is baked into the
// wrapper URL — there is NO env var and NO render-time re-tag (buildAffiliateUrl
// passes 'expedia' through unchanged). The wrapper wraps a DOUBLE-encoded
// Expedia Hotel-Search URL as `landingPage`: the inner URL is encoded once
// (space->%20, comma->%2C), then the entire inner URL is encoded AGAIN
// (%20->%2520, %2C->%252C). Confirmed-working reference structure:
//   https://www.expedia.com/affiliate?siteid=1&landingPage=<DOUBLE_ENCODED>&camref=1011l5KcC9&creativeref=1100l68075&adref=PZPbSQWcB2
const EXPEDIA = {
  // www, not apex: the apex /affiliate path 301-redirects to www, so building
  // with www removes a redirect hop on every hotel CTA. All tracking params
  // (camref/creativeref/adref/pubref) are unchanged and survive identically.
  base: 'https://www.expedia.com/affiliate',
  siteid: '1',
  camref: '1011l5KcC9',
  creativeref: '1100l68075',
  adref: 'PZPbSQWcB2',
  hotelSearch: 'https://www.expedia.com/Hotel-Search',
} as const;

export type ExpediaHotelLinkOpts = {
  venueName: string;
  city: string;
  /** latLong is included ONLY when both coords are finite & nonzero. */
  lat?: number | null;
  lng?: number | null;
  /** YYYY-MM-DD. Both required for a dated search; omit both for undated. */
  checkIn?: string | null;
  checkOut?: string | null;
  /** Partnerize sub-tracking, e.g. "web_away_game_minnesota-twins". */
  pubref: string;
};

/** Add one calendar day to a YYYY-MM-DD date (UTC, off-by-one safe). */
export function nextDayISO(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildExpediaHotelLink(opts: ExpediaHotelLinkOpts): string {
  const coords = hasValidCoords(opts.lat ?? undefined, opts.lng ?? undefined);
  const dated = Boolean(opts.checkIn && opts.checkOut);

  // Inner Hotel-Search params, each value encoded ONCE. encodeURIComponent
  // yields space->%20 and comma->%2C (NOT URLSearchParams' '+').
  const inner: Array<[string, string]> = [['destination', `${opts.venueName}, ${opts.city}`]];
  if (coords) inner.push(['latLong', `${opts.lat},${opts.lng}`]);
  if (dated) {
    inner.push(['startDate', opts.checkIn!], ['endDate', opts.checkOut!], ['d1', opts.checkIn!], ['d2', opts.checkOut!]);
  }
  inner.push(
    ['flexibility', '0_DAY'],
    ['adults', '2'],
    ['rooms', '1'],
    ['sort', 'RECOMMENDED'],
    ['categorySearch', 'hotels_option'],
    ['useRewards', 'false'],
  );
  const innerUrl = `${EXPEDIA.hotelSearch}?${inner.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;

  // Wrapper. landingPage = the inner URL encoded AGAIN (the required double
  // encode). Built as a string (NOT URLSearchParams) so the already-encoded
  // landingPage is not re-encoded a third time and the param order stays
  // byte-identical to the confirmed reference.
  return (
    `${EXPEDIA.base}?siteid=${EXPEDIA.siteid}` +
    `&landingPage=${encodeURIComponent(innerUrl)}` +
    `&camref=${EXPEDIA.camref}` +
    `&creativeref=${EXPEDIA.creativeref}` +
    `&adref=${EXPEDIA.adref}` +
    `&pubref=${encodeURIComponent(opts.pubref)}`
  );
}
