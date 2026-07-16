import 'server-only';
import { cache } from 'react';
import { db } from './firebase';
import type { Team } from './types';
import { getTeamBySlug } from './data';
import { getCfbSchool } from './cfb/data';
import { toAffiliateTeam } from './cfb/page-extras';

// Read layer for the venue logistics hub (/venues/[slug]). Reads the venueHubs
// collection ONLY. The legacy `venues` collection and getVenueForTeam are
// untouched; the team-page venue block keeps reading `venues`. This is a
// separate surface.

export type League = 'MLB' | 'NBA' | 'NHL' | 'NFL' | 'MLS' | 'WNBA' | 'CFB';

export interface ParkingLot {
  name: string;
  notes: string | null;
}
export interface PublicTransit {
  lines: string[];
  notes: string | null;
}
export interface BagMaxDimensions {
  w: number;
  h: number;
  // Depth is nullable: some buildings publish a two-dimensional limit (e.g. a
  // clutch stated as W x H with no depth). angel-stadium and truist-park carry
  // d:null in Firestore today, so the formatter must omit the depth term rather
  // than render `null"`.
  d: number | null;
  unit: 'in' | 'cm';
}
export interface Tailgating {
  allowed: boolean | null;
  rules: string | null;
  timeWindow: string | null;
  grillRules: string | null;
  rvPolicy: string | null;
}
export interface VenueHubTenantRef {
  teamId: string;
  league: League;
  tenantKey: string;
}
export interface VenueHubGatesOpen {
  ruleText: string | null;
  minutesBefore: number | null;
}
export interface VenueHubTenantOverlay {
  teamId: string;
  league: League;
  displayName: string;
  gatesOpen: VenueHubGatesOpen | null;
  gateVariance: string | null;
  tailgateWindow: string | null;
  bagPolicyException: string | null;
  verified: boolean;
}

export interface VenueHub {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  tenants: VenueHubTenantRef[];
  // building facts
  parkingLots: ParkingLot[];
  parkingLotMapUrl: string | null;
  publicTransit: PublicTransit | null;
  rideshareDropoff: string | null;
  accessibility: string | null;
  bagMaxDimensions: BagMaxDimensions | null;
  clearBagRequired: boolean | null;
  // Affirmative "no bags at all" signal (michigan-stadium's prose no-bag policy).
  // NULL everywhere today; a later data pass sets it true for the genuinely
  // no-bag buildings. It is the ONLY structured trigger for the "NO BAGS ALLOWED"
  // treatment — clearBagRequired:false means "a clear bag is not required", NOT
  // "no bags", and must never drive a no-bag label.
  bagsProhibited: boolean | null;
  bagPolicyUrl: string | null;
  bagPolicyNotes: string | null;
  tailgating: Tailgating | null;
  venueAccessRestrictions: string | null;
  nearby: string | null;
  outsideFoodAllowed: boolean | null;
  outsideFoodRules: string | null;
  food: string | null;
  // Self-hosted hero photo + its attribution line. NULL everywhere today; the
  // photo data-ops pass (Wikimedia Commons, license-verified, downloaded and
  // resized) fills them later. Null renders the charcoal hero, never a broken
  // image.
  photoUrl: string | null;
  photoAttribution: string | null;
  // gate: nothing renders unless verified
  verified: boolean;
  // per-tenant overlays (gate times etc.)
  tenantOverlays: VenueHubTenantOverlay[];
}

/** Read a building doc + its tenant overlays. Null when the doc is absent. */
export const getVenueHub = cache(async (slug: string): Promise<VenueHub | null> => {
  const doc = await db.collection('venueHubs').doc(slug).get();
  if (!doc.exists) return null;
  const d = doc.data() ?? {};
  const tSnap = await db.collection('venueHubs').doc(slug).collection('tenants').get();
  const tenantOverlays: VenueHubTenantOverlay[] = tSnap.docs.map((td) => {
    const t = td.data();
    return {
      teamId: t.teamId,
      league: t.league,
      displayName: t.displayName ?? t.teamId,
      gatesOpen: t.gatesOpen ?? null,
      gateVariance: t.gateVariance ?? null,
      tailgateWindow: t.tailgateWindow ?? null,
      bagPolicyException: t.bagPolicyException ?? null,
      verified: t.verified === true,
    };
  });
  return {
    slug: d.slug,
    name: d.name,
    city: d.city ?? null,
    state: d.state ?? null,
    lat: typeof d.lat === 'number' ? d.lat : null,
    lng: typeof d.lng === 'number' ? d.lng : null,
    capacity: typeof d.capacity === 'number' ? d.capacity : null,
    tenants: Array.isArray(d.tenants) ? d.tenants : [],
    parkingLots: Array.isArray(d.parkingLots) ? d.parkingLots : [],
    parkingLotMapUrl: d.parkingLotMapUrl ?? null,
    publicTransit: d.publicTransit ?? null,
    rideshareDropoff: d.rideshareDropoff ?? null,
    accessibility: d.accessibility ?? null,
    bagMaxDimensions: d.bagMaxDimensions ?? null,
    clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
    bagsProhibited: typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null,
    bagPolicyUrl: d.bagPolicyUrl ?? null,
    bagPolicyNotes: d.bagPolicyNotes ?? null,
    tailgating: d.tailgating ?? null,
    venueAccessRestrictions: d.venueAccessRestrictions ?? null,
    nearby: d.nearby ?? null,
    outsideFoodAllowed: typeof d.outsideFoodAllowed === 'boolean' ? d.outsideFoodAllowed : null,
    outsideFoodRules: d.outsideFoodRules ?? null,
    food: d.food ?? null,
    photoUrl: typeof d.photoUrl === 'string' && d.photoUrl ? d.photoUrl : null,
    photoAttribution: typeof d.photoAttribution === 'string' && d.photoAttribution ? d.photoAttribution : null,
    verified: d.verified === true,
    tenantOverlays,
  };
});

// ── display helpers ────────────────────────────────────────────────────────

/** The recognizable venue name for titles/hero: strip a leading sponsor lockup
 * ("GEHA Field at Arrowhead Stadium" -> "Arrowhead Stadium"). Names with no
 * " at " (e.g. "Bank of America Stadium") pass through unchanged. */
export function displayVenueName(name: string): string {
  const idx = name.toLowerCase().lastIndexOf(' at ');
  return idx >= 0 ? name.slice(idx + 4).trim() : name;
}

/** First `max` sentences of a note (for the bag-capsule length budget); the rest
 * is overflow that belongs in the FAQ, never the capsule. Splits only on REAL
 * sentence boundaries: terminal .!? followed by whitespace and a capital or quote.
 * A period between digits ("4.5x6.5") or inside a token is not a boundary, so bag
 * dimensions and clutch sizes are never split apart. */
export function leadSentences(text: string, max: number): { lead: string; overflow: string } {
  const trimmed = text.trim();
  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=["'(A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lead = sentences.slice(0, max).join(' ').trim();
  const overflow = sentences.slice(max).join(' ').trim();
  return { lead: lead || trimmed, overflow };
}

export function cityState(v: Pick<VenueHub, 'city' | 'state'>): string | null {
  if (v.city && v.state) return `${v.city}, ${v.state}`;
  return v.city || v.state || null;
}

// ── SpotHero coverage gate ───────────────────────────────────────────────────
// SpotHero operates across the entire US and a SUBSET of Canadian metros. A
// building in a city SpotHero doesn't serve would deep-link to an EMPTY
// coordinate search, so the hub must degrade those to the no-inventory state
// rather than ship a dead search page. All 222 venueHubs are US or Canadian
// (no other countries), so the gate is: US buildings are always covered;
// Canadian buildings are covered only in the metros SpotHero lists a live city
// directory for. Verified live 2026-07-15 against spothero.com/city/*-parking:
// Toronto, Vancouver, Ottawa, Winnipeg, Calgary, Edmonton all resolve with
// bookable inventory (Toronto: "Parking From CA$4"); MONTREAL 404s (not served),
// so centre-bell + saputo-stadium degrade to no-data.
const CANADIAN_PROVINCES = new Set([
  'ontario', 'quebec', 'british columbia', 'alberta', 'manitoba', 'saskatchewan',
  'nova scotia', 'new brunswick', 'newfoundland and labrador', 'prince edward island',
]);
const SPOTHERO_CANADA_CITIES = new Set([
  'toronto', 'vancouver', 'ottawa', 'winnipeg', 'calgary', 'edmonton',
]);
export function spotHeroCovers(v: Pick<VenueHub, 'city' | 'state'>): boolean {
  const state = (v.state ?? '').trim().toLowerCase();
  const city = (v.city ?? '').trim().toLowerCase();
  if (CANADIAN_PROVINCES.has(state)) return SPOTHERO_CANADA_CITIES.has(city);
  // Anything not identified as Canadian is a US building — SpotHero's core market.
  return true;
}

// ── indexing floor (locked) ─────────────────────────────────────────────────
// A building enters the sitemap / gets index:true only when it has coordinates
// AND at least two of (bag policy, parking, transit) AND is verified. Below the
// floor the page still renders what it has, but emits noindex.
type IndexFloorFields = Pick<
  VenueHub,
  | 'lat' | 'lng' | 'verified' | 'clearBagRequired' | 'bagMaxDimensions' | 'bagPolicyUrl'
  | 'bagPolicyNotes' | 'parkingLots' | 'parkingLotMapUrl' | 'publicTransit'
>;
export function venueHubIsIndexable(v: IndexFloorFields): boolean {
  const hasGeo = v.lat !== null && v.lng !== null;
  const hasBag = v.clearBagRequired !== null || !!v.bagMaxDimensions || !!v.bagPolicyUrl || !!v.bagPolicyNotes;
  const hasParking = (v.parkingLots?.length ?? 0) > 0 || !!v.parkingLotMapUrl;
  const hasTransit = !!v.publicTransit && ((v.publicTransit.lines?.length ?? 0) > 0 || !!v.publicTransit.notes);
  const twoOfThree = [hasBag, hasParking, hasTransit].filter(Boolean).length >= 2;
  return hasGeo && twoOfThree && v.verified === true;
}

/** All 222 building slugs, for generateStaticParams. */
export const getAllVenueHubSlugs = cache(async (): Promise<string[]> => {
  const snap = await db.collection('venueHubs').get();
  return snap.docs.map((d) => d.id);
});

// ── team -> building routing (team-page logistics block) ─────────────────────

export interface TeamVenueHubLink {
  /** Building hub slug -> /venues/{slug}. */
  slug: string;
  /** Sponsor-stripped building name for the CTA copy. */
  displayName: string;
  /** Above the indexing floor (verified + 2-of-3). The team-page routing block
   *  renders ONLY when this is true — a held building has nothing useful yet, so
   *  no dead-end link into an empty hub. */
  indexable: boolean;
}

/** teamId -> its building hub. The team<->building relationship is the building
 *  doc's `tenants` array (asserted 1:1 team->building at Unit 2); this reads it,
 *  it does NOT re-derive from venue names or coords. Built from the building
 *  docs alone (tenants + all floor fields live on the doc — no per-hub tenants
 *  subcollection read), and cached so the whole 169-page build shares one pass. */
export const getTeamVenueHubMap = cache(async (): Promise<Map<string, TeamVenueHubLink>> => {
  const snap = await db.collection('venueHubs').get();
  const map = new Map<string, TeamVenueHubLink>();
  for (const doc of snap.docs) {
    const d = doc.data();
    const tenants: VenueHubTenantRef[] = Array.isArray(d.tenants) ? d.tenants : [];
    if (tenants.length === 0) continue;
    const indexable = venueHubIsIndexable({
      lat: typeof d.lat === 'number' ? d.lat : null,
      lng: typeof d.lng === 'number' ? d.lng : null,
      verified: d.verified === true,
      clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      bagMaxDimensions: d.bagMaxDimensions ?? null,
      bagPolicyUrl: d.bagPolicyUrl ?? null,
      bagPolicyNotes: d.bagPolicyNotes ?? null,
      parkingLots: Array.isArray(d.parkingLots) ? d.parkingLots : [],
      parkingLotMapUrl: d.parkingLotMapUrl ?? null,
      publicTransit: d.publicTransit ?? null,
    });
    const link: TeamVenueHubLink = {
      slug: d.slug,
      displayName: displayVenueName(d.name),
      indexable,
    };
    for (const t of tenants) {
      if (t?.teamId) map.set(t.teamId, link);
    }
  }
  return map;
});

/** Resolve a single team to its building hub (null when the team is not a
 *  venueHubs tenant). Does NOT floor-gate — the caller renders the routing block
 *  only when the returned link.indexable is true. */
export const getVenueHubForTeam = cache(async (teamId: string): Promise<TeamVenueHubLink | null> => {
  const map = await getTeamVenueHubMap();
  return map.get(teamId) ?? null;
});

export interface VenueHubSitemapEntry {
  slug: string;
  lastModified: Date;
}
/** Indexable buildings only, with an accurate lastmod from the doc's updatedAt. */
export const getIndexableVenueHubSitemapEntries = cache(async (): Promise<VenueHubSitemapEntry[]> => {
  const snap = await db.collection('venueHubs').get();
  const out: VenueHubSitemapEntry[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const fields: IndexFloorFields = {
      lat: typeof d.lat === 'number' ? d.lat : null,
      lng: typeof d.lng === 'number' ? d.lng : null,
      verified: d.verified === true,
      clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      bagMaxDimensions: d.bagMaxDimensions ?? null,
      bagPolicyUrl: d.bagPolicyUrl ?? null,
      bagPolicyNotes: d.bagPolicyNotes ?? null,
      parkingLots: Array.isArray(d.parkingLots) ? d.parkingLots : [],
      parkingLotMapUrl: d.parkingLotMapUrl ?? null,
      publicTransit: d.publicTransit ?? null,
    };
    if (!venueHubIsIndexable(fields)) continue;
    // updatedAt is a Firestore Timestamp; fall back to now if absent.
    const ts = d.updatedAt;
    const lastModified = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date();
    out.push({ slug: doc.id, lastModified });
  }
  return out;
});

// ── ticket CTA team resolution ──────────────────────────────────────────────
// Tickets are building-agnostic (the CTA renders on every hub), but the ticket
// LINK needs a concrete team. Resolve the first tenant that yields one, pro
// tenants first (a shared NFL/CFB building links NFL tickets), CFB via the
// affiliate-team shim so the vendor slugs resolve to the football program.
export const resolveTicketTeam = cache(async (hub: VenueHub): Promise<Team | null> => {
  const ordered = [...hub.tenants].sort((a, b) => Number(a.league === 'CFB') - Number(b.league === 'CFB'));
  for (const t of ordered) {
    if (t.league === 'CFB') {
      const school = await getCfbSchool(t.teamId);
      if (school) return toAffiliateTeam(school, hub.city);
    } else {
      const team = await getTeamBySlug(t.teamId);
      if (team) return team;
    }
  }
  return null;
});

// ── season year (deliberate, never getFullYear) ─────────────────────────────
// Site-wide convention: the season year is a hardcoded named constant, bumped
// deliberately when next-season content is ready — an auto-rolling
// getFullYear() would flip every venue title to "...2027" at midnight on Jan 1
// before any 2027 gameday data exists. Mirrors `SEASON_YEAR` in
// app/teams/page.tsx and `YEAR` in lib/cfb/metadata.ts (both carry the same
// anti-getFullYear note).
export const SEASON_YEAR = 2026;

/** True when every tenant is a CFB program (and there is at least one). Drives
 *  the title's league split: CFB-only buildings lead with tailgating, pro
 *  buildings lead with food. */
export function isCfbOnlyHub(hub: Pick<VenueHub, 'tenants'>): boolean {
  return hub.tenants.length > 0 && hub.tenants.every((t) => t.league === 'CFB');
}

/** Format a bag dimension as "16" x 16" x 8"", omitting the depth term when the
 *  building only publishes a two-dimensional limit (d:null). Returns null when
 *  there are no dimensions. */
export function dimsString(dims: BagMaxDimensions | null): string | null {
  if (!dims) return null;
  const u = dims.unit === 'cm' ? 'cm' : '"';
  const parts = [dims.w, dims.h];
  if (typeof dims.d === 'number') parts.push(dims.d);
  return parts.map((n) => `${n}${u}`).join(' x ');
}

export interface BagCapsule {
  /** Dimension string when the building publishes one (shown as the big figure). */
  dims: string | null;
  /** The big figure to show when there are no dimensions (a word, not a size). */
  bigText: string;
  /** The small caption under the figure. */
  label: string;
}

/** The bag-capsule figure + caption. The caption is the corrected label:
 *   - "NO BAGS ALLOWED"    only when bagsProhibited is affirmatively true
 *   - "CLEAR BAG REQUIRED" when clearBagRequired is true
 *   - "MAX BAG SIZE"       when dimensions are present (bags are allowed)
 *   - "BAG POLICY"         otherwise
 *  clearBagRequired:false ("a clear bag is not required") NEVER produces a
 *  no-bag label — that mapping was the Target Field bug. */
export function bagCapsule(hub: Pick<VenueHub, 'bagMaxDimensions' | 'clearBagRequired' | 'bagsProhibited'>): BagCapsule {
  const dims = dimsString(hub.bagMaxDimensions);
  const prohibited = hub.bagsProhibited === true;
  const label = prohibited
    ? 'NO BAGS ALLOWED'
    : hub.clearBagRequired === true
      ? 'CLEAR BAG REQUIRED'
      : dims
        ? 'MAX BAG SIZE'
        : 'BAG POLICY';
  const bigText = prohibited ? 'No bags' : hub.clearBagRequired === true ? 'Clear bag' : 'Bag policy';
  return { dims, bigText, label };
}

// ── title + description (shared by generateMetadata and the JSON-LD) ─────────
// Both the <title>/<meta> and the StadiumOrArena JSON-LD read from these so the
// rendered copy and the structured data stay byte-identical.

// Head budget BEFORE the " | {year} Gameday Guide" suffix. Long CFB stadium
// names trip this; the guard drops the softest query term rather than truncate
// a name mid-word (two clean terms beat three with the third cut).
const TITLE_HEAD_MAX = 60;

/** SEO title head, league-split, with the long-name guard applied. Returns the
 *  bare value; the root layout's title.template appends " | PromoNight". */
export function venueHubTitle(hub: Pick<VenueHub, 'name' | 'tenants'>): string {
  const short = displayVenueName(hub.name);
  const cfb = isCfbOnlyHub(hub);
  const full = cfb
    ? `${short} Parking, Tailgating & Bag Policy`
    : `${short} Bag Policy, Parking & Food`;
  const dropped = cfb ? `${short} Parking & Bag Policy` : `${short} Bag Policy & Parking`;
  const head = full.length <= TITLE_HEAD_MAX ? full : dropped;
  return `${head} | ${SEASON_YEAR} Gameday Guide`;
}

function bagAnswer(hub: VenueHub, dims: string | null): string {
  if (hub.bagsProhibited === true) return 'No bags are permitted inside.';
  if (hub.clearBagRequired === true) return dims ? `A clear bag up to ${dims} is required.` : 'A clear bag is required.';
  if (dims) return `Single-compartment bags up to ${dims} are allowed.`;
  return 'See the full bag policy before you go.';
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const DESC_MAX = 160;

/** Per-building meta description generated from VERIFIED facts. Leads with the
 *  direct answer to the highest-volume query the building has data for (bag,
 *  then parking, then gates/transit), then appends a compact clause listing the
 *  other sections that actually render, trimmed to the ~155-char target. Never
 *  promises a fact the page does not render. */
export function venueHubDescription(hub: VenueHub): string {
  const short = displayVenueName(hub.name);
  const loc = cityState(hub);
  const verified = hub.verified;
  const dims = dimsString(hub.bagMaxDimensions);

  const hasBag =
    verified &&
    (hub.bagMaxDimensions !== null ||
      hub.clearBagRequired !== null ||
      hub.bagsProhibited === true ||
      !!hub.bagPolicyNotes ||
      !!hub.bagPolicyUrl);
  const hasParking =
    verified &&
    (hub.parkingLots.length > 0 ||
      !!hub.parkingLotMapUrl ||
      (spotHeroCovers(hub) && hub.lat !== null && hub.lng !== null));
  const hasGates = verified && hub.tenantOverlays.some((t) => t.verified && !!t.gatesOpen?.ruleText);
  const hasTransit =
    verified && !!hub.publicTransit && ((hub.publicTransit.lines?.length ?? 0) > 0 || !!hub.publicTransit.notes);
  const hasFood = verified && !!hub.food;
  // Expedia hotels renders for every verified, tenanted building (all 222 have
  // a tenant), so hotels is a covered topic whenever the page is verified.
  const hasHotels = verified;

  let lead: string;
  let leadTopic: 'bag' | 'parking' | 'transit' | null;
  if (hasBag) {
    lead = `What size bag can you bring into ${short}? ${bagAnswer(hub, dims)}`;
    leadTopic = 'bag';
  } else if (hasParking) {
    lead = `Where can you park at ${short}? Reserve nearby parking in advance${
      hub.parkingLotMapUrl ? ' and see the official lot map' : ''
    }.`;
    leadTopic = 'parking';
  } else if (hasGates || hasTransit) {
    lead = `Getting to ${short}: gate times, transit and rideshare in one gameday guide.`;
    leadTopic = 'transit';
  } else {
    // Held / thin building — no verified facts render, so promise nothing.
    return `Plan your visit to ${short}${loc ? ` in ${loc}` : ''}. Gameday details verified and updated for the ${SEASON_YEAR} season.`.slice(
      0,
      DESC_MAX,
    );
  }

  const topics: string[] = [];
  if (hasParking && leadTopic !== 'parking') topics.push('parking');
  if (hasGates && leadTopic !== 'transit') topics.push('gate times');
  if (hasTransit && leadTopic !== 'transit') topics.push('transit');
  if (hasHotels) topics.push('hotels');
  if (hasFood) topics.push('food');

  let out = lead;
  const remaining = [...topics];
  while (remaining.length) {
    const clause = ` Plus ${joinList(remaining)}.`;
    if ((lead + clause).length <= DESC_MAX) {
      out = lead + clause;
      break;
    }
    remaining.pop();
  }
  return out;
}
