// Food and drink stands at a building, from venueHubs/{slug}/vendors (Gate D,
// HANDOFF-venue-data.md "Vendor schema"). Pure: no Firestore here, so the
// mapper and the grouping are testable and the venue page and any audit read
// the same code.
//
// THE RULES ARE THE APP'S, PORTED, NOT RE-DERIVED. promonight-app
// lib/services/vendor_rules.dart decides which stands a screen lists and how
// they group; lib/models/vendor.dart decides how a doc is read. The website
// lists the same stands under the same headings in the same order, so a fan who
// checks both sees one answer.
//
// GATE AT THE MAPPER. A vendor doc carries pipeline bookkeeping (absentStreak,
// manualCuration, curationNote, curatedAt, verifiedAt, updatedAt) and the
// source's own words for a signature claim. None of it renders, so none of it
// leaves toVenueVendor: anything on this object that reaches a client
// component is in the RSC payload whether or not it is shown (CLAUDE.md).

export interface VenueVendorItem {
  name: string;
  dietaryTags: string[];
  isNew: boolean;
}

export interface VenueVendorLocation {
  /** The location text as printed. */
  raw: string;
  /** Section numbers or stand codes as printed ("112", "S108", "9S"). */
  sections: string[];
  level: string | null;
  concourse: string | null;
  standCode: string | null;
}

export interface VenueVendor {
  id: string;
  name: string;
  items: VenueVendorItem[];
  locations: VenueVendorLocation[];
  /** Tags the source puts on the stand itself. Item tags live on the items. */
  dietaryTags: string[];
  isSignature: boolean;
  premiumOnly: boolean | null;
  /** `sourceUrl` first, then `sourceUrls`, each once. */
  sourceUrls: string[];
  /** When the source page was read, ISO 8601. */
  observedAt: string | null;
  tombstoned: boolean;
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => list(v).map(str).filter((s): s is string => s !== null);
const isHttp = (u: string) => /^https?:\/\//.test(u) && URL.canParse(u);

/** One vendor doc, read the way the app reads it (Vendor.fromMap). */
export function toVenueVendor(id: string, d: Record<string, unknown>): VenueVendor {
  const seen = new Set<string>();
  const sourceUrls = [str(d.sourceUrl), ...strs(d.sourceUrls)]
    .filter((u): u is string => u !== null && isHttp(u))
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  return {
    id,
    name: str(d.name) ?? '',
    items: list(d.items)
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && str((e as Record<string, unknown>).name) !== null)
      .map((e) => ({ name: str(e.name)!, dietaryTags: strs(e.dietaryTags), isNew: e.isNew === true })),
    locations: list(d.locations)
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({
        raw: str(e.raw) ?? '',
        sections: strs(e.sections),
        level: str(e.level),
        concourse: str(e.concourse),
        standCode: str(e.standCode),
      })),
    dietaryTags: strs(d.dietaryTags),
    isSignature: d.isSignature === true,
    premiumOnly: typeof d.premiumOnly === 'boolean' ? d.premiumOnly : null,
    sourceUrls,
    observedAt: str(d.observedAt),
    tombstoned: d.tombstoned === true,
  };
}

/** The stands a page may list (vendor_rules.dart visibleVendors): tombstoned
 *  stands are gone, suite and club stands are left out, nameless docs are
 *  dropped. */
export function visibleVendors(vendors: Iterable<VenueVendor>): VenueVendor[] {
  return [...vendors].filter((v) => !v.tombstoned && v.premiumOnly !== true && v.name !== '');
}

/** The stand's tags and every item's, each once, in first-seen order. */
export function allDietaryTags(v: VenueVendor): string[] {
  return [...new Set([...v.dietaryTags, ...v.items.flatMap((i) => i.dietaryTags)])];
}

/** One stand at one of its locations. */
export interface VendorEntry {
  vendor: VenueVendor;
  location: VenueVendorLocation | null;
}

/** "Sections 112, 114 · Main Concourse", the printed text when the sections
 *  are not parsed, or nothing (VendorEntry.where). */
export function vendorWhere(e: VendorEntry): string {
  const l = e.location;
  if (!l) return '';
  const parts: string[] = [];
  if (l.sections.length) parts.push(`${l.sections.length === 1 ? 'Section' : 'Sections'} ${l.sections.join(', ')}`);
  else if (l.standCode) parts.push(`Stand ${l.standCode}`);
  if (l.concourse) parts.push(l.concourse);
  return parts.length ? parts.join(' · ') : l.raw;
}

export interface VendorGroup {
  /** The level as the source names it; null for "By section" and "Other locations". */
  level: string | null;
  title: string;
  entries: VendorEntry[];
}

const LEADING_NUMBER = /\d+/;

/** Sections sort by their number when they have one ("9S" before "112",
 *  "S108" after "108"), else by text; a stand with no section comes last. */
function compareSections(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const ma = LEADING_NUMBER.exec(a)?.[0];
  const mb = LEADING_NUMBER.exec(b)?.[0];
  const na = ma === undefined ? null : Number.parseInt(ma, 10);
  const nb = mb === undefined ? null : Number.parseInt(mb, 10);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  // Dart's String.compareTo: code-unit order, not locale order.
  return a < b ? -1 : a > b ? 1 : 0;
}

function sorted(entries: VendorEntry[]): VendorEntry[] {
  return entries.sort((a, b) => {
    const s = compareSections(a.location?.sections[0], b.location?.sections[0]);
    if (s !== 0) return s;
    const x = a.vendor.name.toLowerCase();
    const y = b.vendor.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Stands grouped by level, then by section and name within a group. A stand
 *  at several locations appears under each. Levels first, in first-seen order;
 *  then stands with a section but no level ("By section"); then stands placed
 *  nowhere ("Other locations"), always last. */
export function groupVendors(vendors: Iterable<VenueVendor>): VendorGroup[] {
  const byLevel = new Map<string, VendorEntry[]>();
  const bySection: VendorEntry[] = [];
  const elsewhere: VendorEntry[] = [];
  for (const vendor of vendors) {
    if (!vendor.locations.length) {
      elsewhere.push({ vendor, location: null });
      continue;
    }
    for (const location of vendor.locations) {
      const entry = { vendor, location };
      if (location.level !== null) {
        if (!byLevel.has(location.level)) byLevel.set(location.level, []);
        byLevel.get(location.level)!.push(entry);
      } else if (location.sections.length) bySection.push(entry);
      else elsewhere.push(entry);
    }
  }
  return [
    ...[...byLevel].map(([level, entries]) => ({ level, title: level, entries: sorted(entries) })),
    ...(bySection.length ? [{ level: null, title: 'By section', entries: sorted(bySection) }] : []),
    ...(elsewhere.length ? [{ level: null, title: 'Other locations', entries: sorted(elsewhere) }] : []),
  ];
}

/** Each page the listed stands came from, once, with the EARLIEST read date of
 *  any stand it vouches for: a date stands for the whole list, so it must not
 *  be later than any part of it. First-seen order. */
export function vendorSources(vendors: VenueVendor[]): Array<{ url: string; observedAt: string | null }> {
  const out = new Map<string, string | null>();
  for (const v of vendors) {
    for (const url of v.sourceUrls) {
      const prev = out.get(url);
      const t = v.observedAt;
      if (!out.has(url)) out.set(url, t);
      else if (t && (!prev || Date.parse(t) < Date.parse(prev))) out.set(url, t);
    }
  }
  return [...out].map(([url, observedAt]) => ({ url, observedAt }));
}

/** "gluten-free" -> "Gluten-free". */
export function dietaryTagLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
