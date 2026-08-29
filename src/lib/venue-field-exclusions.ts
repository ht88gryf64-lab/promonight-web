// Fields withheld from BOTH renderers, and the per-field provenance test they
// share. Imports nothing on purpose: the venue page, the CFB condensed block
// and their tests all read it, so it must be free of `server-only` and of any
// dependency direction, exactly like venue-transit-suppression.ts.
//
// WHY THIS MODULE EXISTS. These lists were private to venue-hub-condensed.ts,
// which meant a field withheld from a school page for cause was still published
// on the building's own venue page: the conflicting Tulane, Kansas and Miami
// tailgating text, and two gate rules with no provenance at all. The cause does
// not change with the surface, so neither should the withholding.

export interface FieldExclusion {
  /** venueHubs doc id. */
  hub: string;
  /** The rendered field the entry withholds. */
  field: 'gates' | 'bag' | 'parking' | 'tailgating' | 'transit' | 'rideshare' | 'accessibility' | 'outsideFood' | 'food' | 'nearby';
  /** When set, only this sub-field is withheld; the rest of the line stands. */
  sub?: 'officialParkingUrls' | 'parkingLotMapUrl' | 'parkingLots' | 'rules' | 'timeWindow' | 'allowed' | 'notes' | 'lines' | 'ruleText';
  /** Why, specific enough to re-check without the report. */
  reason: string;
}

/** CONFLICTS (audit/cfb-venue-sourcing-report.md section 4, verified
 *  2026-08-27). The stored text is populated and sourced, and an official page
 *  contradicts it. Report-and-hold: the text is not rewritten, no source is
 *  attached, and the field renders on no surface. To lift an entry, correct the
 *  data from the official page named here, then delete the entry. */
export const FIELD_CONFLICTS: ReadonlyArray<FieldExclusion> = [
  {
    hub: 'brooks-stadium',
    field: 'tailgating',
    reason: 'Coastal Carolina: rules and the two-hour lot-open window come from the 2020 COVID-season guide (goccusports.com/sports/2020/9/17/CAFgameday); the current 2026 parking page and the 2025 Know Before You Go articles contradict both.',
  },
  {
    hub: 'david-booth-kansas-memorial-stadium',
    field: 'tailgating',
    reason: 'Kansas: the permitted-lot list on the cited 704G page is superseded (policy.ku.edu removed lots 33 and 50 in 2016; parking.ku.edu says tailgating is prohibited in lots 34 and 61).',
  },
  {
    hub: 'hard-rock-stadium',
    field: 'tailgating',
    reason: 'Miami: stored rules say blue/orange pass holders park where they wish in the first hour; hardrockstadium.com/stadium-policy (2026-08-11) and faq-items/tailgating-guidelines say orange only and never mention blue.',
  },
  {
    hub: 'yulman-stadium',
    field: 'tailgating',
    reason: 'Tulane: stored rules are a 2025 capture ("only tailgating location for the 2025 season", Lagniappe/Beaucoup packages); the cited page was rewritten for 2026 with a different season statement and package list.',
  },
  // kidd-brewer-stadium / parking / officialParkingUrls was here from
  // 2026-08-27 until 2026-08-28. It named a 403 URL that the Pass 2 write
  // replaced with the live yosef-club/index.html#season-tickets-parking, so the
  // condition it described stopped existing and the entry only hid a good link.
  // Lifting an entry when its data is corrected is the documented close, and it
  // is the step that got missed: the test covering it asserted the mechanism
  // against a fixture still holding the dead URL, so it stayed green.
  // secu-stadium transit was held here from 2026-08-27 until the Pass 2 write
  // corrected publicTransit.notes to the DOTS window and re-sourced it.
  // ── Added 2026-08-29, expired-claims pass (audit/venues-dated-claims.md).
  // Not contradicted by a source: these name a season or cite a guide that has
  // passed, while reading in the present tense on a page loaded today. Same
  // failure as a stale fact, reached by the clock rather than by a rename, and
  // it survives a source-URL check because every cited page still loads.
  {
    hub: 'allegacy-federal-credit-union-stadium',
    field: 'parking',
    sub: 'parkingLots',
    reason: 'Wake Forest: the entire stored lot value is "Not available for the 2025 season". A lot listing whose only content is a past season\'s unavailability tells a 2026 fan nothing true, and there is no 2026 replacement on hand.',
  },
  {
    hub: 'chase-center',
    field: 'parking',
    sub: 'parkingLots',
    reason: 'Chase Center: two lots read "Purchasable on site per Mar 2024 event-day guide" and a third is "Listed as currently closed" on the authority of that same 2024 guide, with an address taken from a January 2022 guide. A lot described as currently closed on two-year-old evidence is the sharpest instance in the set.',
  },
  {
    hub: 'albertsons-stadium',
    field: 'tailgating',
    reason: 'Boise State: sourced to a 2023 game-day guide, describing a named sponsor fan zone and its opening time. The hub is already transit-suppressed, but that entry is publicTransit-scoped and does not reach tailgating.',
  },
  {
    hub: 'providence-park',
    field: 'bag',
    sub: 'notes',
    reason: 'Providence Park: the stored bag rules come from a 2016 club page. Bag policies are among the most frequently revised venue rules, and a ten-year-old one should not be published as current.',
  },
  {
    hub: 'sanford-stadium',
    field: 'accessibility',
    reason: 'Georgia: 2021 source, and it routes disabled patrons to specific box offices and a phone number with the instruction that accessible seating "is no longer exchanged at the gates". Wrong operational detail carries a sharper cost here than in most fields.',
  },
];

/** HOLDS. Not conflicts: a ruling settled which official source governs, so the
 *  stored text is stale rather than disputed, and a correction is queued. */
export const FIELD_HOLDS: ReadonlyArray<FieldExclusion> = [
];

const ALL: ReadonlyArray<FieldExclusion> = [...FIELD_CONFLICTS, ...FIELD_HOLDS];

/** The whole field is withheld: an entry for this hub and field with no sub. */
export function fieldExcluded(hubSlug: string, field: FieldExclusion['field']): boolean {
  return ALL.some((e) => e.hub === hubSlug && e.field === field && !e.sub);
}

/** One sub-field is withheld: an entry naming it, or one withholding the field. */
export function subFieldExcluded(hubSlug: string, field: FieldExclusion['field'], sub: NonNullable<FieldExclusion['sub']>): boolean {
  return ALL.some((e) => e.hub === hubSlug && e.field === field && (!e.sub || e.sub === sub));
}

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

/** POINTERS vs CLAIMS. A field whose value IS a link (officialParkingUrls,
 *  parkingLotMapUrl, bagPolicyUrl) asserts nothing about the building: it says
 *  "the operator publishes this here". Rendering it cannot be wrong about a
 *  gate time or a bag size, so provenance for it is a category error, and
 *  requiring one withheld 55 working links from live pages. A pointer gates on
 *  REACHABILITY, meaning a well-formed http(s) URL, plus the exclusion list,
 *  which is where a link KNOWN to be dead is named (kidd-brewer-stadium's 403).
 *  Everything else is a claim and keeps its per-field provenance. */
export function isReachableUrl(u: unknown): u is string {
  return typeof u === 'string' && /^https?:\/\//.test(u) && URL.canParse(u);
}

/** Provenance for one field: its key is present in the hub's sources map. */
export function hasProvenance(sources: Record<string, string> | undefined, key: string): boolean {
  return !!sources && nonEmpty(sources[key]);
}

/** Provenance for one sub-field: its own dotted key, or the flat key that
 *  vouches for the whole field. Both conventions are real in the data. */
export function hasSubProvenance(sources: Record<string, string> | undefined, field: string, sub: string): boolean {
  return hasProvenance(sources, `${field}.${sub}`) || hasProvenance(sources, field);
}


/** The minimal shape the render predicates need. Works on a mapped VenueHub and
 *  on a raw doc alike, so the description, the homepage counts and the page
 *  cannot drift apart by restating the rule three times. */
export interface RenderFacts {
  slug: string;
  sources: Record<string, string>;
  bagMaxDimensions?: unknown;
  clearBagRequired?: boolean | null;
  bagsProhibited?: boolean | null;
  bagPolicyNotes?: string | null;
  bagPolicyUrl?: string | null;
  parkingLots?: Array<{ name?: string; notes?: string | null }>;
  parkingLotMapUrl?: string | null;
  officialParkingUrls?: string[];
  food?: string | null;
}
const present = (v: unknown) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim());

/** A bag CLAIM with its own provenance, or the policy-page POINTER. */
export function rendersBag(f: RenderFacts): boolean {
  if (fieldExcluded(f.slug, 'bag')) return false;
  const claim =
    (present(f.bagMaxDimensions) && hasProvenance(f.sources, 'bagMaxDimensions')) ||
    (typeof f.clearBagRequired === 'boolean' && hasProvenance(f.sources, 'clearBagRequired')) ||
    (f.bagsProhibited === true && hasProvenance(f.sources, 'bagsProhibited')) ||
    (present(f.bagPolicyNotes) && hasProvenance(f.sources, 'bagPolicyNotes'));
  return claim || isReachableUrl(f.bagPolicyUrl);
}

/** Sourced lot prose (a claim), or either parking POINTER. */
export function rendersParking(f: RenderFacts): boolean {
  if (fieldExcluded(f.slug, 'parking')) return false;
  const lots =
    (f.parkingLots ?? []).some((l) => present(l.notes)) &&
    hasProvenance(f.sources, 'parkingLots') &&
    !subFieldExcluded(f.slug, 'parking', 'parkingLots');
  const links =
    (f.officialParkingUrls ?? []).some(isReachableUrl) && !subFieldExcluded(f.slug, 'parking', 'officialParkingUrls');
  return lots || links || isReachableUrl(f.parkingLotMapUrl);
}

export function rendersFood(f: RenderFacts): boolean {
  return !fieldExcluded(f.slug, 'food') && present(f.food) && hasProvenance(f.sources, 'food');
}

/** A gate rule renders only from an overlay that is verified AND sourced. */
export function rendersGates(slug: string, overlays: Array<{ verified?: boolean; gatesOpen?: { ruleText?: string | null } | null; sources?: Record<string, string> }>): boolean {
  if (fieldExcluded(slug, 'gates')) return false;
  return overlays.some(
    (t) => t.verified === true && present(t.gatesOpen?.ruleText) && hasSubProvenance(t.sources, 'gatesOpen', 'ruleText'),
  );
}
