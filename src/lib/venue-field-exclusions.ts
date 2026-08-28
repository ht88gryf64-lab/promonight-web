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
  {
    hub: 'kidd-brewer-stadium',
    field: 'parking',
    sub: 'officialParkingUrls',
    reason: 'Appalachian State: the stored officialParkingUrls entry (mountaineersathleticfund.com/yosef-club/renewals/index.html) returns 403; the 2025 fan guide body links the live yosef-club/index.html#season-tickets-parking instead. Sub-field grain on purpose: sourced lots and a lot map still render, the dead link never does.',
  },
];

/** HOLDS. Not conflicts: a ruling settled which official source governs, so the
 *  stored text is stale rather than disputed, and a correction is queued. */
export const FIELD_HOLDS: ReadonlyArray<FieldExclusion> = [
  // secu-stadium transit was held here from 2026-08-27 until the Pass 2 write
  // corrected publicTransit.notes to the DOTS window and re-sourced it.
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
