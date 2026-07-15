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
  d: number;
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
  bagPolicyUrl: string | null;
  bagPolicyNotes: string | null;
  tailgating: Tailgating | null;
  venueAccessRestrictions: string | null;
  nearby: string | null;
  outsideFoodAllowed: boolean | null;
  outsideFoodRules: string | null;
  food: string | null;
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
    bagPolicyUrl: d.bagPolicyUrl ?? null,
    bagPolicyNotes: d.bagPolicyNotes ?? null,
    tailgating: d.tailgating ?? null,
    venueAccessRestrictions: d.venueAccessRestrictions ?? null,
    nearby: d.nearby ?? null,
    outsideFoodAllowed: typeof d.outsideFoodAllowed === 'boolean' ? d.outsideFoodAllowed : null,
    outsideFoodRules: d.outsideFoodRules ?? null,
    food: d.food ?? null,
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
