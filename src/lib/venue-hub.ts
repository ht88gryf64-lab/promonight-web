import { redactClause } from '@/lib/venue-corpus-silence';
import { publishedView } from '@/lib/venue-published-view';
import 'server-only';
import { cache } from 'react';
import { db } from './firebase';
import type { Promo, Team } from './types';
import { getTeamBySlug, getTeamPromos, promoBoardChicagoYMD } from './data';
import { getCfbSchool } from './cfb/data';
import { toAffiliateTeam } from './cfb/page-extras';
import { collectVenueLinksForTeams, type HubVenueLink, type VenueIndexEntry } from './venue-index';
import { transitSuppressed } from './venue-transit-suppression';
import { rendersBag, rendersParking, rendersFood, rendersGates, fieldExcluded, hasProvenance, hasSubProvenance } from './venue-field-exclusions';

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
  /** Per-field provenance URLs on the overlay (gatesOpen, gateVariance,
   *  tailgateWindow, bagPolicyException, parkingPrice). {} when the doc has
   *  none. Read by the condensed logistics block, which renders a field only
   *  when its source is present. */
  sources: Record<string, string>;
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
  /** Official parking info pages (team/venue sites). Harvested + verified like
   *  every other hub fact; rendered as outbound links in the parking lots card. */
  officialParkingUrls: string[];
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
  /** Per-field provenance URLs keyed by field (parkingLots, publicTransit,
   *  tailgating, accessibility, bagPolicyUrl, food, nearby, ...). {} when the
   *  doc has none. The venue page does not read it; the condensed logistics
   *  block on the CFB school page renders a field only when its key is here. */
  sources: Record<string, string>;
  /**
   * The pre-gate object, for the ONE allowlisted consumer.
   *
   * Present only on a hub that has been through publishedView. Reading it is
   * publishing an ungated value, so every caller must appear in
   * UNGATED_CONSUMERS (src/lib/venue-published-view.ts) with a written ruling
   * and a test that locks it. Grep `\.ungated` to enumerate them.
   */
  ungated?: VenueHub;
}

/** Read a building doc + its tenant overlays. Null when the doc is absent. */
/** A doc field that should be a string->URL map. Anything else (absent,
 *  malformed, non-string values) reads as an empty map, never as provenance. */
function stringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  // An INVERTED map ({url: page title} instead of {field: url}) reads as an
  // empty map downstream, and an absent key and a malformed key are
  // indistinguishable there: t-mobile-park lost every fact card that way, on a
  // verified doc, with no error anywhere. Warn so the next one is loud.
  // ANY url-shaped key is wrong, not just a wholly inverted map. The first
  // version of this warning fired only when EVERY key was a URL, which meant a
  // PARTIAL inversion stayed silent, and t-mobile-park's own repaired map, which
  // still carries two leftover URL keys beside its field keys, would not have
  // warned. A field lookup can never hit a URL key, so its presence is always a
  // defect, and the count is what tells you which kind.
  const keys = Object.keys(v as Record<string, unknown>);
  const urlKeys = keys.filter((k) => /^https?:\/\//.test(k));
  if (urlKeys.length > 0) {
    const kind = urlKeys.length === keys.length ? 'FULLY INVERTED' : 'partially inverted';
    console.warn(`[venue-hub] sources map is ${kind}: ${urlKeys.length} of ${keys.length} keys are URLs, and a field lookup can never match them. Keys: ${urlKeys.join(', ')}`);
  }
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 0) { out[k] = val; continue; }
    // A field vouched for by more than one page is stored as an ARRAY of URLs.
    // 45 provenance values in the corpus are shaped that way, almost all of them
    // on MLB buildings. Dropping them made those fields read as UNSOURCED, so the
    // per-field rule withheld facts that are in fact sourced, and it did it
    // silently because an absent key and a malformed key are indistinguishable
    // downstream. Take the first non-empty URL: nothing renders the source, it is
    // only ever tested for presence, so the first is a faithful primary.
    if (Array.isArray(val)) {
      const first = val.find((u): u is string => typeof u === 'string' && u.length > 0);
      if (first) out[k] = first;
    }
  }
  return out;
}

/**
 * The pure document-to-VenueHub mapping, extracted so it can be exercised
 * without Firestore and so an audit measures the SAME code the site renders
 * rather than a replica of it. getVenueHub is now fetch + this + publishedView.
 */
export function toVenueHub(
  slug: string,
  d: FirebaseFirestore.DocumentData,
  tenantOverlays: VenueHubTenantOverlay[],
): VenueHub {
  return {
    // Sub-ID slug: doc.id (the `slug` argument that fetched this doc) is the
    // routing-truth key — the URL, the /venues index and the sitemap all key on
    // it. The stored d.slug field is used only when it MATCHES; a missing or
    // diverging field falls back to doc.id so an affiliate sub-ID can never
    // silently degrade to team-keyed or name a different building than the
    // page URL (audit/affiliate-attribution-audit.md, ranked item 8).
    slug: d.slug === slug ? d.slug : slug,
    name: d.name,
    city: d.city ?? null,
    state: d.state ?? null,
    lat: typeof d.lat === 'number' ? d.lat : null,
    lng: typeof d.lng === 'number' ? d.lng : null,
    capacity: typeof d.capacity === 'number' ? d.capacity : null,
    tenants: Array.isArray(d.tenants) ? d.tenants : [],
    // Clause redactions land HERE, at the one mapper every hub renderer reads,
    // rather than at each render site where one could be missed. The index
    // floor (readIndexFloorFields) deliberately keeps reading the raw doc, so
    // an expired clause never changes whether a page is indexable.
    parkingLots: (Array.isArray(d.parkingLots) ? d.parkingLots : []).map((lot: ParkingLot) =>
      typeof lot?.notes === 'string'
        ? { ...lot, notes: redactClause(slug, 'parkingLots', lot.notes, 'venueHubs') }
        : lot,
    ),
    parkingLotMapUrl: d.parkingLotMapUrl ?? null,
    officialParkingUrls: Array.isArray(d.officialParkingUrls)
      ? d.officialParkingUrls.filter(
          // startsWith alone admits unparseable strings ('http//x', 'http://');
          // URL.canParse keeps a single malformed doc entry from throwing in
          // the render (new URL(u).hostname) and failing the whole SSG build.
          (u: unknown): u is string => typeof u === 'string' && u.startsWith('http') && URL.canParse(u),
        )
      : [],
    publicTransit: d.publicTransit ?? null,
    rideshareDropoff: d.rideshareDropoff ?? null,
    accessibility: redactClause(slug, 'accessibility', d.accessibility, 'venueHubs'),
    bagMaxDimensions: d.bagMaxDimensions ?? null,
    clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
    bagsProhibited: typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null,
    bagPolicyUrl: d.bagPolicyUrl ?? null,
    bagPolicyNotes: d.bagPolicyNotes ?? null,
    tailgating: d.tailgating
      ? {
          ...d.tailgating,
          timeWindow: redactClause(slug, 'tailgating.timeWindow', d.tailgating.timeWindow, 'venueHubs'),
        }
      : null,
    venueAccessRestrictions: d.venueAccessRestrictions ?? null,
    nearby: d.nearby ?? null,
    outsideFoodAllowed: typeof d.outsideFoodAllowed === 'boolean' ? d.outsideFoodAllowed : null,
    outsideFoodRules: redactClause(slug, 'outsideFoodRules', d.outsideFoodRules, 'venueHubs'),
    food: redactClause(slug, 'food', d.food, 'venueHubs'),
    photoUrl: typeof d.photoUrl === 'string' && d.photoUrl ? d.photoUrl : null,
    photoAttribution: typeof d.photoAttribution === 'string' && d.photoAttribution ? d.photoAttribution : null,
    verified: d.verified === true,
    tenantOverlays,
    sources: stringMap(d.sources),
  };
}

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
      sources: stringMap(t.sources),
    };
  });
  // Fetch, map, then GATE. The view is applied here and nowhere else, so a
  // consumer cannot forget it: see src/lib/venue-published-view.ts.
  return publishedView(toVenueHub(slug, d, tenantOverlays));
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
  // A period after a known abbreviation is not a sentence end. Splitting on it
  // truncates the lead mid-clause, and the condensed block renders exactly one
  // lead sentence, so the dropped remainder can be the clause that made the
  // sentence TRUE: /cfb/alabama served "Free Crimson Ride shuttle service to
  // the Quad begins at 6 a.m." from stored text that continues "(11 a.m.
  // kickoff only)". 23 stored prose values are cut this way corpus-wide.
  // Placeholder the abbreviation dots, split, then restore.
  const ABBREV = /\b(a\.m|p\.m|A\.M|P\.M|St|Ave|Blvd|Rd|Dr|Ste|Mt|Ft|No|approx|vs|Jr|Sr|Inc|Co|Corp|U\.S|N\.W|S\.W|N\.E|S\.E|e\.g|i\.e)\.(?=\s|$)/g;
  const DOT = '\u0000';
  const masked = trimmed.replace(ABBREV, (m) => m.replace(/\./g, DOT));
  const sentences = masked
    .split(/(?<=[.!?])\s+(?=["'(A-Z0-9])/)
    .map((x) => x.split(DOT).join('.'))
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

/** Floor fields from a raw building doc, with the same defensive coercions the
 *  full getVenueHub mapper applies. Shared by every reader that computes
 *  indexability from doc data without paying the full-hub mapping cost. */
function readIndexFloorFields(d: FirebaseFirestore.DocumentData): IndexFloorFields {
  return {
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
  /** For the hub/index link sub-line; null when the doc lacks a city. */
  city: string | null;
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
    const indexable = venueHubIsIndexable(readIndexFloorFields(d));
    const link: TeamVenueHubLink = {
      // doc.id, not the stored `slug` field: doc.id is the routing truth
      // (getVenueHub fetches by id, generateStaticParams/sitemap emit ids), so
      // the hub/team-page hrefs can never diverge from the URLs the sitemap
      // and /venues index advertise.
      slug: doc.id,
      displayName: displayVenueName(typeof d.name === 'string' ? d.name : doc.id),
      indexable,
      city: typeof d.city === 'string' ? d.city : null,
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
    if (!venueHubIsIndexable(readIndexFloorFields(d))) continue;
    // updatedAt is a Firestore Timestamp; fall back to now if absent.
    const ts = d.updatedAt;
    const lastModified = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date();
    out.push({ slug: doc.id, lastModified });
  }
  return out;
});

// ── venue inbound links (league hubs + /venues index) ───────────────────────

/** A league's team ids -> their indexable building links, deduped by building
 *  and name-sorted. Costs one venueHubs collection get (~222 docs) per render
 *  pass that was not already paying it: hub pages regenerate on their own ISR
 *  schedule, so React cache() shares the read within a hub render but NOT with
 *  team-page renders. At 6h ISR that is ~4 extra collection gets per hub per
 *  day; do not treat this as free on a high-traffic dynamic path. */
export async function getVenueLinksForTeams(teamIds: string[]): Promise<HubVenueLink[]> {
  const map = await getTeamVenueHubMap();
  return collectVenueLinksForTeams(map, teamIds);
}

/** Every indexable building, shaped for the /venues index page. One collection
 *  pass, cached per render pass like the other readers. Leagues come from the
 *  doc's tenants array, so a shared building carries every hosting league. */
export const getVenueIndexEntries = cache(async (): Promise<VenueIndexEntry[]> => {
  const snap = await db.collection('venueHubs').get();
  const out: VenueIndexEntry[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!venueHubIsIndexable(readIndexFloorFields(d))) continue;
    const tenants: VenueHubTenantRef[] = Array.isArray(d.tenants) ? d.tenants : [];
    const leagues = [...new Set(
      tenants.map((t) => t?.league).filter((l): l is League => typeof l === 'string'),
    )];
    out.push({
      slug: doc.id,
      name: displayVenueName(typeof d.name === 'string' ? d.name : doc.id),
      city: typeof d.city === 'string' ? d.city : null,
      state: typeof d.state === 'string' ? d.state : null,
      leagues,
    });
  }
  return out;
});

/** Per-topic venue coverage counts for the redesigned homepage's gameday
 *  utility grid. Each count = verified buildings whose hub page actually
 *  renders that section: bag/gates/transit mirror the hasBag/hasGates/
 *  hasTransit predicates in buildVenueDescription below, parking mirrors the
 *  narrower hasParkingData gate (see the inline note). If those predicates
 *  change, this must follow. Derived at render, never
 *  hardcoded: one venueHubs collection pass plus one tenants collection-group
 *  pass (gate times live on verified tenant overlays), both cached per render
 *  pass like the other readers. */
export interface VenueUtilityCounts {
  parking: number;
  bag: number;
  transit: number;
  gates: number;
  /** Verified buildings total (the honest "venue guides" population). */
  verifiedTotal: number;
}

export const getVenueUtilityCounts = cache(async (): Promise<VenueUtilityCounts> => {
  const [snap, tSnap] = await Promise.all([
    db.collection('venueHubs').get(),
    db.collectionGroup('tenants').get(),
  ]);

  // Buildings with at least one verified tenant overlay carrying a gates rule.
  // Path-guarded so a same-named subcollection elsewhere can never leak in.
  const gateSlugs = new Set<string>();
  for (const td of tSnap.docs) {
    if (!td.ref.path.startsWith('venueHubs/')) continue;
    const t = td.data();
    if (t.verified === true && t.gatesOpen?.ruleText && hasSubProvenance(stringMap(t.sources), 'gatesOpen', 'ruleText')) {
      gateSlugs.add(td.ref.parent.parent!.id);
    }
  }

  const counts: VenueUtilityCounts = { parking: 0, bag: 0, transit: 0, gates: 0, verifiedTotal: 0 };
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.verified !== true) continue;
    counts.verifiedTotal++;

    // Deliberately the NARROW gate (hasParkingData, VenueHubView.tsx:206):
    // published lot facts or an official lot map. The wider hasParking in
    // buildVenueDescription also counts SpotHero-covered coordinates, but
    // that is affiliate widget coverage, not a parking fact, and it would
    // count buildings whose page shows the "no verified parking details"
    // degrade copy.
    // Same predicates as the page and the description (venue-field-exclusions),
    // because this tile is documented to mirror what the venue page renders.
    const facts = {
      slug: doc.id, sources: stringMap(d.sources),
      bagMaxDimensions: d.bagMaxDimensions ?? null, clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      bagsProhibited: typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null, bagPolicyNotes: d.bagPolicyNotes ?? null,
      bagPolicyUrl: d.bagPolicyUrl ?? null, parkingLots: Array.isArray(d.parkingLots) ? d.parkingLots : [],
      parkingLotMapUrl: d.parkingLotMapUrl ?? null,
      officialParkingUrls: Array.isArray(d.officialParkingUrls) ? d.officialParkingUrls : [], food: d.food ?? null,
    };
    if (rendersParking(facts)) counts.parking++;

    if (rendersBag(facts)) counts.bag++;

    // Suppressed buildings render no transit anywhere, so they must not be
    // counted in the homepage utility tile either.
    const pt = d.publicTransit;
    if (pt && !transitSuppressed(doc.id) && ((pt.lines?.length ?? 0) > 0 || !!pt.notes)) counts.transit++;

    if (gateSlugs.has(doc.id) && !fieldExcluded(doc.id, 'gates')) counts.gates++;
  }
  return counts;
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

// ── tenant -> team-page return links (hub -> team, closes the internal loop) ─
// The forward direction (team -> hub) is getVenueHubForTeam + VenueHubLink. This
// is the reverse: every tenant of a building resolved to its own page so the hub
// links BACK to the teams that play there. Pro tenants resolve to /{sport}/{slug}
// via getTeamBySlug; CFB tenants to /cfb/{slug} via getCfbSchool. A tenant whose
// page does NOT resolve is skipped (no dead links) rather than rendered blind.
export interface TenantTeamLink {
  teamId: string;
  league: League;
  /** /{sportSlug}/{id} for a pro team, /cfb/{id} for a CFB school. */
  href: string;
  /** Team / school display name for the link label. */
  name: string;
  /** CFB pages are gameday/schedule, not promo schedules — drives the framing. */
  isCfb: boolean;
}

export const resolveTenantTeamLinks = cache(async (hub: VenueHub): Promise<TenantTeamLink[]> => {
  const out: TenantTeamLink[] = [];
  const seen = new Set<string>();
  for (const t of hub.tenants) {
    if (!t?.teamId || seen.has(t.teamId)) continue;
    seen.add(t.teamId);
    if (t.league === 'CFB') {
      const school = await getCfbSchool(t.teamId);
      if (school) out.push({ teamId: t.teamId, league: t.league, href: `/cfb/${school.id}`, name: school.name, isCfb: true });
    } else {
      const team = await getTeamBySlug(t.teamId);
      if (team) out.push({ teamId: t.teamId, league: t.league, href: `/${team.sportSlug}/${team.id}`, name: team.name, isCfb: false });
    }
  }
  return out;
});

// ── this-week promos (the PromoNight-native hook on a logistics page) ───────
// PER-TENANT READS ONLY. getTeamPromos is the team page's OWN read
// (teams/{teamId}/promos, orderBy date asc), so every promo object here is the
// exact shape the team page renders, with isVisiblePromo (tombstoned !== true)
// and dedupePromos already applied inside it. Deliberately NOT
// getPromosInDateRange or any other collectionGroup query: those are all-league
// scans, and this runs on 222 SSG building pages, where per-tenant is 1-3 doc
// reads apiece instead.
//
// CFB tenants are skipped rather than read: college pages are gameday/schedule
// and carry no teams/{id}/promos subcollection at all, so the read would always
// come back empty while still costing a round trip on shared NFL/CFB buildings.
export interface VenueHubWeekPromo {
  promo: Promo;
  /** The tenant this promo belongs to. Drives the deep link, the share payload,
   *  and the multi-tenant per-card team marker. */
  team: Team;
  /** Whole days from today to the promo date, 0 = today. Computed here, where
   *  the window anchor already exists, so no surface has to re-derive "today". */
  daysOut: number;
}

/** Window length in days past today, inclusive on both ends. */
const WEEK_PROMO_DAYS = 7;

function daysBetweenYMD(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Every tenant's promos in [today, today+7], merged into ONE date-sorted list.
 *  Empty array when the building has no promos in the window, which is what the
 *  caller conditional-renders on (an off-season arena shows no block at all). */
export const getVenueHubWeekPromos = cache(async (hub: VenueHub): Promise<VenueHubWeekPromo[]> => {
  // Chicago-anchored, the same national "today" boundary the league hubs and the
  // daily board use, so a late-night East-coast visitor never sees the window
  // roll a day early.
  const start = promoBoardChicagoYMD(0);
  const end = promoBoardChicagoYMD(WEEK_PROMO_DAYS);

  const seen = new Set<string>();
  const proTenants = hub.tenants.filter((t) => {
    if (!t?.teamId || t.league === 'CFB' || seen.has(t.teamId)) return false;
    seen.add(t.teamId);
    return true;
  });
  if (proTenants.length === 0) return [];

  const perTenant = await Promise.all(
    proTenants.map(async (t) => {
      const [team, promos] = await Promise.all([getTeamBySlug(t.teamId), getTeamPromos(t.teamId)]);
      if (!team) return [];
      // In-memory window filter: YYYY-MM-DD string compare, the same date math
      // the team page's upcoming/past split and the league hub slates use.
      return promos
        .filter((p) => p.date >= start && p.date <= end)
        .map((promo) => ({ promo, team, daysOut: daysBetweenYMD(start, promo.date) }));
    }),
  );

  const merged = perTenant.flat();
  // Date first (the fan reads the scroller chronologically); team then title
  // only to keep same-day ordering stable across rebuilds.
  merged.sort(
    (a, b) =>
      a.promo.date.localeCompare(b.promo.date) ||
      a.team.id.localeCompare(b.team.id) ||
      a.promo.title.localeCompare(b.promo.title),
  );
  return merged;
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
  // A ZERO is not a dimension. `typeof 0 === 'number'` let a stored d:0 through,
  // so coca-cola-coliseum rendered "16.5cm x 11.5cm x 0cm". Omit a zero depth
  // exactly as null is omitted, and treat a zero width or height as no usable
  // dimensions at all rather than printing "0"".
  if (!dims.w || !dims.h) return null;
  const u = dims.unit === 'cm' ? 'cm' : '"';
  const parts = [dims.w, dims.h];
  if (typeof dims.d === 'number' && dims.d !== 0) parts.push(dims.d);
  return parts.map((n) => `${n}${u}`).join(' x ');
}

// ── gate sentence helpers ───────────────────────────────────────────────────

/** Drop ONE trailing sentence terminator so a template can append its own without
 *  producing "..". The stored data legitimately ends in a period (76 verified
 *  gatesOpen.ruleText values and 46 gateVariance values do), and the CFB write
 *  added more, so the fix belongs in the template and never in Firestore.
 *  Leaves "..." alone, and leaves a closing bracket or quote intact. */
export function stripTrailingPeriod(s: string): string {
  const t = s.trim();
  if (t.endsWith('...')) return t;
  return t.replace(/[.]$/, '');
}

/** Crude suffix trim so "diners" matches "dining" and "gates" matches "gate".
 *  Not a real stemmer, and it does not need to be: it only has to stop a pure
 *  restatement reading as new information because of a plural or a participle. */
function stem(w: string): string {
  return w.replace(/(?:ings?|ers?|es|s)$/, '');
}

/** Numbers carry the facts in gate copy: opening times, gate numbers, tiers.
 *  Kept separate from words and matched exactly, never stemmed. */
function numberTokens(s: string): Set<string> {
  return new Set([...s.toLowerCase().matchAll(/\d+(?:[.:]\d+)?/g)].map((m) => m[0]));
}

function wordTokens(s: string): Set<string> {
  return new Set([...s.toLowerCase().matchAll(/[a-z]{4,}/g)].map((m) => stem(m[0])));
}

/** True when `candidate` adds NO information `existing` does not already carry, so
 *  rendering both back to back would repeat the same sentence. Used for two
 *  separate pairs that both duplicate in the live data: a tenant's gateVariance
 *  against its gatesOpen.ruleText, and a tenant's bagPolicyException against the
 *  building's bagPolicyNotes.
 *
 *  Two tests, and the numeric one is a hard gate:
 *    1. EVERY number in the candidate must already appear in `existing`. One new
 *       figure means a new fact, so the candidate is kept. This is what protects
 *       memorial-stadium-lincoln (student gates at 2.5 hours, band at 45 minutes,
 *       gates 1, 6, 8, 17, 18, 19, 21 closing) and chase-field (Advantage Members'
 *       30-minute early entry, the 20-Year Club).
 *    2. At least 80 percent of its significant words must already appear. A pure
 *       restatement rewords rather than adds, so it clears this easily;
 *       barclays-center's "Crown Club diners may enter two hours before tip-off"
 *       against a ruleText saying "Fans dining in Crown Club may enter two hours
 *       before tip-off" differs only by diners/dining and is caught by the stem.
 *       Measured: it suppresses 11 of 59 gate variances and 9 of 25 bag
 *       exceptions, and the highest-scoring RETAINED gate pair sits at 0.75, so
 *       the 0.80 cutoff falls in a gap rather than through a cluster.
 *
 *  Erring toward KEEPING is deliberate: a repeated sentence reads clumsily, a
 *  dropped one loses a fact a fan may have travelled on. */
const RESTATEMENT_WORD_OVERLAP = 0.8;
export function isRestatement(existing: string, candidate: string): boolean {
  const cNums = numberTokens(candidate);
  const eNums = numberTokens(existing);
  for (const n of cNums) if (!eNums.has(n)) return false;

  const cWords = wordTokens(candidate);
  if (cWords.size === 0) return true;
  const eWords = wordTokens(existing);
  let hit = 0;
  for (const w of cWords) if (eWords.has(w)) hit++;
  return hit / cWords.size >= RESTATEMENT_WORD_OVERLAP;
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

// ── bag copy, generated from the policy data (spec section 6) ───────────────
// Everything a page says about bags derives from `clearBagRequired`, never from a
// template. The FAQ used to hardcode "{venue} requires a clear bag no larger than
// {dims}" for any building with bag data, which asserted a requirement 45
// buildings' own sources did not support, inside FAQPage schema, on the highest
// value query cluster the venue thesis has.
//
// Five cases, keyed on the boolean:
//   true            state the requirement and the dimensions, plus the clutch
//                   exception where a tenant overlay carries one
//   false           state the size limit and what IS permitted, and never use
//                   "clear bag" as a requirement
//   null + dims     the size limit only, silent on clarity in both directions
//   null, no dims,
//   notes present   render the notes, assert no size limit and nothing on clarity
//   no data at all  say the venue has not published a policy, point at the source
//
// Rule 1.7: an event-level override is never the venue policy. The assertion comes
// from the stored baseline boolean; any override lives in the notes as prose.

/** Short one-sentence form for the meta description. Keyed on the same boolean as
 *  the FAQ so the two can never contradict each other on the same page. */
function bagAnswer(hub: VenueHub, dims: string | null): string {
  if (hub.bagsProhibited === true) return 'No bags are permitted inside.';
  if (hub.clearBagRequired === true) return dims ? `A clear bag up to ${dims} is required.` : 'A clear bag is required.';
  if (hub.clearBagRequired === false) {
    return dims ? `Bags up to ${dims} are allowed and do not have to be clear.` : 'A clear bag is not required.';
  }
  // clearBagRequired null. Say NOTHING about clarity in either direction (1.6).
  if (dims) return `Bags up to ${dims} are allowed.`;
  return 'See the full bag policy before you go.';
}

export interface BagFaqAnswers {
  /** Answer to "What size bag can I bring into {venue}?". Null when there is no
   *  bag data at all AND no policy URL, so the question is dropped entirely. */
  size: string | null;
  /** Answer to "Does {venue} require a clear bag?". NULL when clearBagRequired is
   *  null, which omits the question rather than answering it ambiguously. */
  clarity: string | null;
}

type BagFacts = Pick<
  VenueHub,
  'name' | 'bagMaxDimensions' | 'clearBagRequired' | 'bagsProhibited' | 'bagPolicyNotes' | 'bagPolicyUrl'
>;

/** Bag FAQ copy. `tenantExceptions` are the verified tenant overlays'
 *  `bagPolicyException` strings, which is the input for the clutch exception in
 *  the clear-bag-required case and was previously read and never rendered. */
export function bagFaqAnswers(hub: BagFacts, tenantExceptions: string[] = []): BagFaqAnswers {
  const short = displayVenueName(hub.name);
  const dims = dimsString(hub.bagMaxDimensions);
  const notes = hub.bagPolicyNotes?.trim() || null;
  // A tenant exception that merely restates the building's own notes is dropped:
  // on 9 of the 25 buildings that carry both, the overlay is the building policy
  // reworded for one tenant's matchdays, and rendering both put the same clutch
  // and medical carve-out in the answer twice. The information is not lost, it is
  // already in `notes`, which is rendered immediately before it.
  const trimmedExceptions = tenantExceptions.map((e) => e.trim()).filter(Boolean);
  const exception = trimmedExceptions.filter((e) => !(notes && isRestatement(notes, e))).join(' ') || null;
  // Whether an exception EXISTS is a separate question from whether its prose is
  // worth printing again. The clarity answer's "Limited exceptions apply" keys on
  // existence, so suppressing duplicate prose does not silently turn it off.
  const hasException = trimmedExceptions.length > 0;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();

  // DIVISION OF LABOUR between the two answers. `size` is the substantive one and
  // carries the long prose (bagPolicyNotes runs to a 387 char median, 877 max;
  // bagPolicyException to a 192 char median). `clarity` answers a yes/no and stays
  // short. Neither repeats the other's prose: an FAQPage answer has to stand alone
  // in a rich result, but rendering the same 600 character note twice on one page
  // is the duplication defect being fixed in the gate copy on this same branch,
  // and it is no more acceptable here.
  if (hub.bagsProhibited === true) {
    return {
      size: join(`${short} does not permit bags inside.`, notes, exception),
      // Silent when the stored boolean itself claims a clear bag IS required:
      // the two fields then contradict each other, and the page declines to pick
      // a winner rather than asserting either.
      clarity:
        hub.clearBagRequired === true
          ? null
          : `No. ${short} does not permit bags at all, so nothing is carried in, clear or otherwise.`,
    };
  }

  if (hub.clearBagRequired === true) {
    return {
      size: join(`${short} requires a clear bag${dims ? ` no larger than ${dims}` : ''}.`, notes, exception),
      // "Limited exceptions apply" is all the exception text supports without
      // reading it: the stored strings carve out medical, childcare, dietary and
      // clutch cases in varying combinations, so naming any category here would
      // assert something a given building's own source may not say.
      clarity: join(
        `Yes. ${short} enforces a clear bag policy${dims ? `, and a clear bag may be no larger than ${dims}` : ''}.`,
        hasException ? 'Limited exceptions apply.' : null,
      ),
    };
  }

  if (hub.clearBagRequired === false) {
    return {
      size: join(
        dims
          ? `Bags up to ${dims} are allowed at ${short}, and they do not have to be clear.`
          : `${short} does not require a clear bag.`,
        notes,
      ),
      clarity: join(`No. ${short} does not require a clear bag.`, dims ? `Bags up to ${dims} are permitted.` : null),
    };
  }

  // clearBagRequired is null from here down: the source never said either way, so
  // neither does the page. No clarity question is emitted at all.
  if (dims) return { size: join(`Bags up to ${dims} are allowed at ${short}.`, notes), clarity: null };
  if (notes) return { size: notes, clarity: null };
  if (hub.bagPolicyUrl) {
    // Deliberately does NOT say "linked on this page", even though the bag card
    // and its Official bag policy link now DO render in this case (the card is
    // gated on hasBagFaq, see VenueHubView). The reason is no longer the gate, it
    // is that an FAQPage acceptedAnswer can be surfaced detached from the page it
    // came from, so an answer that points at "this page" is false wherever it is
    // read. Same standalone principle as the division of labour noted above.
    return {
      size: `${short} has not published a bag size limit we could verify. Check the venue's official bag policy before you travel.`,
      clarity: null,
    };
  }
  return { size: null, clarity: null };
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

  // These MUST be the predicates the page renders on, not a restatement of
  // them: this string is the <meta name="description"> AND the StadiumOrArena
  // JSON-LD description, so a topic advertised here that the page withholds is
  // an unfalsifiable claim in structured data. Shared from
  // venue-field-exclusions so the three consumers cannot drift.
  const hasBag = verified && rendersBag(hub);
  const hasParking = verified && rendersParking(hub);
  const hasGates = verified && rendersGates(hub.slug, hub.tenantOverlays);
  const hasTransit =
    verified && !transitSuppressed(hub.slug) && !fieldExcluded(hub.slug, 'transit') && !!hub.publicTransit &&
    (((hub.publicTransit.lines?.length ?? 0) > 0 && hasSubProvenance(hub.sources, 'publicTransit', 'lines')) ||
      (!!hub.publicTransit.notes && hasSubProvenance(hub.sources, 'publicTransit', 'notes')));
  const hasFood = verified && rendersFood(hub);
  // Expedia hotels renders for every verified, tenanted building (all 222 have
  // a tenant), so hotels is a covered topic whenever the page is verified.
  const hasHotels = verified;

  let lead: string;
  let leadTopic: 'bag' | 'parking' | 'transit' | null;
  if (hasBag) {
    // bagAnswer MANUFACTURES the sentence, so feed it only facts with their own
    // provenance; otherwise an unsourced boolean becomes a published policy.
    const bagFacts = {
      ...hub,
      bagMaxDimensions: hasProvenance(hub.sources, 'bagMaxDimensions') ? hub.bagMaxDimensions : null,
      clearBagRequired: hasProvenance(hub.sources, 'clearBagRequired') ? hub.clearBagRequired : null,
      bagsProhibited: hasProvenance(hub.sources, 'bagsProhibited') ? hub.bagsProhibited : null,
    };
    lead = `What size bag can you bring into ${short}? ${bagAnswer(bagFacts, dimsString(bagFacts.bagMaxDimensions))}`;
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
    // Held / thin building: no verified facts render, so promise nothing.
    //
    // This used to read "Gameday details verified and updated for the 2026
    // season", which was the exact inverse of the truth. The branch is reached
    // ONLY when every fact predicate above is false, so the sentence asserted
    // verification on, and only on, the 13 buildings that have none. The page
    // body said "We are still confirming gameday details" directly above it.
    // Both consumers carried the claim: this string is the
    // <meta name="description"> (app/venues/[slug]/page.tsx) AND the
    // StadiumOrArena JSON-LD description (VenueHubJsonLd), so noindex did not
    // contain it: a link unfurl and a human reviewer both read it anyway.
    //
    // The replacement names the building and states an absence. It claims
    // nothing about verification, updating, confirmation or currency, and it
    // advertises no topic the held page withholds.
    return `Gameday guide for ${short}${loc ? ` in ${loc}` : ''}. Parking, transit and bag details are not published yet.`.slice(
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
