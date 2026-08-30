// THE PUBLISHED VIEW: gating becomes a property of the VALUE, not of the site
// that renders it.
//
// WHY. Four surface-escape defects in one codebase, each found weeks apart and
// treated as a one-off: a manufactured gate time removed from the venue card
// while an FAQ builder shipped its own copy in FAQPage JSON-LD; a withheld
// tailgate window republished by Plan-your-visit; sub-key exclusions that
// silenced nothing on four surfaces; and a bag chip whose LABEL was ungated
// while its number was, inside a single component. See scanner-framework 6b.7
// (renumbered from 6b.6: another session published a 6b.6 first).
//
// The cause is structural, not clerical. `getVenueHub` handed every consumer
// the raw stored values plus a `sources` map, and each consumer re-derived "may
// I publish this?" at the point of use from five independent inputs. The number
// of places that must agree is fields x consumers, and no cell can see any
// other cell. So gates were authored per SURFACE while fields are read per
// FIELD, and the two coincide only when someone remembers every consumer.
//
// WHAT THIS DOES. Every CLAIM field is null unless its full gate set passes, so
// a chip and an FAQ reading the same property cannot disagree: there is one
// value. A consumer that forgets a gate now under-renders (it sees null) rather
// than over-publishing, which is the direction we want to fail in.
//
// POINTERS ARE NOT CLAIMS. A field whose value IS a link asserts nothing about
// the building, so it gates on reachability plus the exclusion list, never on
// provenance. That distinction is load-bearing and predates this module.
//
// THE INDEX FLOOR IS DELIBERATELY OUTSIDE THIS. `venueHubIsIndexable` reads the
// raw document, so a withheld field still counts toward whether a page is worth
// indexing. That is an indexing decision, not a copy decision.
import {
  fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance, isReachableUrl,
} from './venue-field-exclusions';
import { transitSuppressed } from './venue-transit-suppression';
import type { VenueHub, VenueHubTenantOverlay } from './venue-hub';

/**
 * Consumers permitted to read the UNGATED object, by name.
 *
 * ONE ENTRY, and it is a ruling rather than an oversight. `buildCondensedLogistics`
 * (src/lib/venue-hub-condensed.ts, the CFB school-page block) omits the
 * doc-level and tenant-level `verified` flags on every field. Its own header
 * says so ("Not the index floor, not the doc-level verified flag, not the
 * tenant's verified flag"), CfbSchoolPage repeats it, and
 * venue-hub-condensed.test.ts fixes `verified:false` on BOTH grains and asserts
 * all ten lines still render. A CFB building is verified by having a sourced
 * field, not by a flag nobody sets on that corpus.
 *
 * It still gets per-field provenance and the exclusion lists; only `verified`
 * is waived. Anything added here needs the same standard: a written ruling and
 * a test that locks it.
 */
export const UNGATED_CONSUMERS = ['buildCondensedLogistics'] as const;

/** Claim fields, with the exclusion key each is filed under. */
const CLAIMS: ReadonlyArray<{ field: keyof VenueHub; exclusion: Parameters<typeof fieldExcluded>[1] | null; sub?: string }> = [
  { field: 'publicTransit', exclusion: 'transit' },
  { field: 'parkingLots', exclusion: 'parking', sub: 'parkingLots' },
  { field: 'bagMaxDimensions', exclusion: 'bag' },
  { field: 'clearBagRequired', exclusion: 'bag' },
  { field: 'bagsProhibited', exclusion: 'bag' },
  { field: 'bagPolicyNotes', exclusion: 'bag', sub: 'notes' },
  { field: 'tailgating', exclusion: 'tailgating' },
  { field: 'accessibility', exclusion: 'accessibility' },
  { field: 'nearby', exclusion: 'nearby' },
  { field: 'rideshareDropoff', exclusion: 'rideshare' },
  { field: 'outsideFoodAllowed', exclusion: 'outsideFood' },
  { field: 'outsideFoodRules', exclusion: 'outsideFood' },
  { field: 'food', exclusion: 'food' },
  // No exclusion key exists for this field; provenance and verified still apply.
  { field: 'venueAccessRestrictions', exclusion: null },
];

/** Pointer fields: reachability plus exclusions, never provenance. */
const POINTERS: ReadonlyArray<{ field: keyof VenueHub; exclusion: Parameters<typeof fieldExcluded>[1]; sub?: string }> = [
  { field: 'bagPolicyUrl', exclusion: 'bag' },
  { field: 'parkingLotMapUrl', exclusion: 'parking', sub: 'parkingLotMapUrl' },
  { field: 'officialParkingUrls', exclusion: 'parking', sub: 'officialParkingUrls' },
];

// Sub-fields of `tailgating` that a surface actually renders. rvPolicy is
// DELIBERATELY absent: it was ruled non-rendering during the CFB sourcing pass
// (Texas A&M rules/timeWindow/grillRules render, rvPolicy does not), and two
// hubs, gerald-j-ford-stadium and joan-c-edwards-stadium, carry a tailgating
// object whose ONLY populated sub-field is rvPolicy. Treating that object as
// non-empty would have published a Tailgating row on two buildings that show
// none today, which is the view over-publishing rather than matching. Caught by
// diffing the view against production across all 223 hubs.
const TAILGATE_RENDERED = ['allowed', 'rules', 'timeWindow', 'grillRules'] as const;

const empty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'rvPolicy' in (v as object)) {
    const t = v as Record<string, unknown>;
    return !TAILGATE_RENDERED.some((k) => t[k] !== null && t[k] !== undefined && t[k] !== '');
  }
  return false;
};

/**
 * Provenance for a field, accepting the dotted sub-key form.
 *
 * NOTE ON THE SOURCES SHAPE. 45 provenance values in this corpus are stored as
 * ARRAYS of URLs. `stringMap` in venue-hub.ts collapses each to its first URL
 * BEFORE the hub object is built, so by the time a hub reaches this module the
 * map is already flat. A view that re-read the raw document here would score
 * those 45 as unsourced and silently withdraw 45 true claims, which is exactly
 * the failure this module exists to prevent, pointed the other way.
 */
function sourced(hub: VenueHub, field: string, sub?: string): boolean {
  if (hasProvenance(hub.sources, field)) return true;
  if (sub && hasSubProvenance(hub.sources, field, sub as never)) return true;
  // A sub-keyed field may vouch for itself under any of its own sub-keys.
  return Object.keys(hub.sources ?? {}).some((k) => k.startsWith(`${field}.`));
}

/** The tenant overlays whose gate rule may be published. */
export function publishedOverlays(hub: VenueHub): VenueHubTenantOverlay[] {
  if (!hub.verified || fieldExcluded(hub.slug, 'gates')) return [];
  return (hub.tenantOverlays ?? []).filter(
    (t) => t.verified === true && !empty(t.gatesOpen?.ruleText)
      && hasSubProvenance(t.sources, 'gatesOpen', 'ruleText'),
  );
}

/**
 * Null every claim and pointer that has not earned publication.
 *
 * Applied once, in getVenueHub, so no consumer can under-gate. The pre-gate
 * object stays reachable as `hub.ungated` for the one allowlisted consumer.
 */
export function publishedView(hub: VenueHub): VenueHub {
  const out = { ...hub } as Record<string, unknown>;
  const ok = hub.verified === true;

  for (const { field, exclusion, sub } of CLAIMS) {
    const v = hub[field];
    if (empty(v)) { out[field as string] = Array.isArray(v) ? [] : null; continue; }
    const excluded = exclusion ? fieldExcluded(hub.slug, exclusion) : false;
    const subOff = exclusion && sub ? subFieldExcluded(hub.slug, exclusion, sub as never) : false;
    const suppressed = field === 'publicTransit' && transitSuppressed(hub.slug);
    if (!ok || excluded || subOff || suppressed || !sourced(hub, field as string, sub)) {
      out[field as string] = Array.isArray(v) ? [] : null;
    }
  }

  for (const { field, exclusion, sub } of POINTERS) {
    const v = hub[field];
    const excluded = fieldExcluded(hub.slug, exclusion)
      || (sub ? subFieldExcluded(hub.slug, exclusion, sub as never) : false);
    if (Array.isArray(v)) {
      out[field as string] = !ok || excluded ? [] : v.filter(isReachableUrl);
    } else {
      out[field as string] = !ok || excluded || !isReachableUrl(v) ? null : v;
    }
  }

  out.tenantOverlays = publishedOverlays(hub);
  // The escape hatch, named so a reader can find every caller by grepping it.
  out.ungated = hub;
  return out as unknown as VenueHub;
}
