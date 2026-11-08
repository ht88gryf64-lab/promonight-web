// The Before you go row builder: the hub-reading half of
// src/lib/before-you-go.ts, where the rule is stated. Server side only (it
// reaches the hub loader's module graph through venue-hub).
//
// Takes the PUBLISHED hub (getVenueHub), never the ungated object, so the
// doc-level verified flag, per-field provenance, the exclusion lists and
// transit suppression have already nulled what may not be published; this
// module adds the state and the date on top. Text is never paraphrased:
// stored dimensions and lot names verbatim, prose as its first stored
// sentence, exactly as the condensed block prints them.
//
// Provenance rows come in the venue page's order: the bag capsule, then the
// Getting-in rows (gates, transit), then the parking card. On the 2026-11-08
// corpus no building or overlay carries a read time for transit or gates
// (scripts/audit-before-you-go.ts), so those two provenance rows exist in code
// and render on no page until the pipeline writes one; bag and parking are
// what pages show today. Transit and gates still reach the block through the
// union (below) wherever the quick facts card showed them.
import { type VenueHub, type VenueHubTenantOverlay, dimsString } from './venue-hub';
import { claimPointerUrl, claimSourceHost, claimSourceUrl, formatReadOn, type ClaimField } from './venue-claim';
import { hasSubProvenance, isReachableUrl } from './venue-field-exclusions';
import { sentence, stripEmDashes, type CondensedLine } from './venue-hub-condensed';
import { BEFORE_YOU_GO_LABELS, BEFORE_YOU_GO_ORDER, renderedReadTime, type BeforeYouGoKey, type BeforeYouGoRow } from './before-you-go';

const has = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

function row(key: BeforeYouGoKey, text: string, observedAt: string, sourceUrl: string | null): BeforeYouGoRow | null {
  const observedOn = formatReadOn(observedAt);
  if (!observedOn) return null;
  return { key, label: BEFORE_YOU_GO_LABELS[key], text, observedAt, observedOn, sourceUrl, sourceHost: sourceUrl ? claimSourceHost(sourceUrl) : null };
}

/** A building claim's link: the provenance record's URL for the field, else
 *  the class pointer the published view kept (the bag policy page, the
 *  official parking page). */
function claimLink(hub: VenueHub, field: ClaimField): string | null {
  return claimSourceUrl(hub, field) ?? claimPointerUrl(hub, field);
}

function bagRow(hub: VenueHub): BeforeYouGoRow | null {
  const { fieldStates: st, observedAtByField: ob } = hub;
  // A prohibition decides first (ruling 2026-11-05, item 6): on a no-bag
  // building the stored dimensions are the exception size, not a limit.
  const prohibitedAt = hub.bagsProhibited === true ? renderedReadTime(st, ob, 'bagsProhibited') : null;
  if (prohibitedAt) {
    // Ruling 2026-11-08 (pipeline EXTRACTION-RULES 1.8): a no-bag building that
    // allows clutches stores the clutch size, and the row names it. Two numbers
    // when only two are stored (dimsString omits a missing depth). The size needs
    // its own rendered state and read time; the row carries the OLDER of the two
    // reads, because a joint claim is only as current as its stalest leg.
    const exception = dimsString(hub.bagMaxDimensions);
    const exceptionAt = exception ? renderedReadTime(st, ob, 'bagMaxDimensions') : null;
    if (exception && exceptionAt) {
      const at = Date.parse(exceptionAt) < Date.parse(prohibitedAt) ? exceptionAt : prohibitedAt;
      return row('bag', `No bags, except clutches up to ${exception}.`, at, claimLink(hub, 'bagsProhibited'));
    }
    return row('bag', 'Bags are not allowed.', prohibitedAt, claimLink(hub, 'bagsProhibited'));
  }
  const dims = dimsString(hub.bagMaxDimensions);
  const dimsAt = dims ? renderedReadTime(st, ob, 'bagMaxDimensions') : null;
  if (dims && dimsAt) {
    // "Clear bag" only when that claim is itself rendered and dated; the size
    // alone otherwise (bridgestone-arena's clear-bag answer is in conflict).
    const clear = hub.clearBagRequired === true && !!renderedReadTime(st, ob, 'clearBagRequired');
    return row('bag', `${clear ? 'Clear bag' : 'Max bag'} ${dims}.`, dimsAt, claimLink(hub, 'bagMaxDimensions'));
  }
  const clearAt = typeof hub.clearBagRequired === 'boolean' ? renderedReadTime(st, ob, 'clearBagRequired') : null;
  if (clearAt) return row('bag', hub.clearBagRequired ? 'Clear bag required.' : 'Clear bag not required.', clearAt, claimLink(hub, 'clearBagRequired'));
  const notesAt = has(hub.bagPolicyNotes) ? renderedReadTime(st, ob, 'bagPolicyNotes') : null;
  if (notesAt) return row('bag', sentence(hub.bagPolicyNotes!), notesAt, claimLink(hub, 'bagPolicyNotes'));
  return null;
}

/** This team's overlay (a shared building has one gate rule per tenant), out
 *  of the published set: verified, sourced, not excluded. */
function overlayFor(hub: VenueHub, teamId: string): VenueHubTenantOverlay | undefined {
  return hub.tenantOverlays.find((o) => o.teamId === teamId);
}

function gateSourceUrl(t: VenueHubTenantOverlay | undefined): string | null {
  const src = t?.sources.gatesOpen ?? t?.sources['gatesOpen.ruleText'] ?? null;
  return isReachableUrl(src) ? src : null;
}

function gatesRow(hub: VenueHub, teamId: string): BeforeYouGoRow | null {
  const t = overlayFor(hub, teamId);
  const rule = t?.gatesOpen?.ruleText;
  if (!t || !has(rule)) return null;
  const at = renderedReadTime(t.fieldStates, t.observedAtByField, 'gatesOpen', 'ruleText');
  if (!at) return null;
  return row('gates', sentence(rule), at, gateSourceUrl(t));
}

function transitRow(hub: VenueHub): BeforeYouGoRow | null {
  const pt = hub.publicTransit;
  if (!pt) return null;
  const { fieldStates: st, observedAtByField: ob } = hub;
  const at = renderedReadTime(st, ob, 'publicTransit', 'notes') ?? renderedReadTime(st, ob, 'publicTransit', 'lines');
  if (!at) return null;
  // Each part on its own provenance, as the condensed block prints them.
  const parts: string[] = [];
  if (has(pt.notes) && hasSubProvenance(hub.sources, 'publicTransit', 'notes')) parts.push(sentence(pt.notes));
  if (Array.isArray(pt.lines) && pt.lines.length && hasSubProvenance(hub.sources, 'publicTransit', 'lines')) parts.push(`Lines: ${pt.lines.map(stripEmDashes).join(', ')}.`);
  if (!parts.length) return null;
  return row('transit', parts.join(' '), at, claimSourceUrl(hub, 'publicTransit'));
}

function parkingRow(hub: VenueHub): BeforeYouGoRow | null {
  const lots = hub.parkingLots.map((l) => l.name).filter(has).slice(0, 4).map(stripEmDashes);
  if (!lots.length) return null;
  const at = renderedReadTime(hub.fieldStates, hub.observedAtByField, 'parkingLots');
  if (!at) return null;
  return row('parking', `Lots: ${lots.join(', ')}.`, at, claimLink(hub, 'parkingLots'));
}

/** The PROVENANCE rows for one tenant of a published hub, in the venue page's
 *  order. Empty when no field is in state `rendered` with a read time. */
export function beforeYouGoRows(hub: VenueHub, teamId: string): BeforeYouGoRow[] {
  const byKey: Record<(typeof BEFORE_YOU_GO_ORDER)[number], BeforeYouGoRow | null> = {
    bag: bagRow(hub),
    gates: gatesRow(hub, teamId),
    transit: transitRow(hub),
    parking: parkingRow(hub),
  };
  return BEFORE_YOU_GO_ORDER.map((k) => byKey[k]).filter((r): r is BeforeYouGoRow => r !== null);
}

/** The classes the quick facts card prints that the block can carry. The
 *  card's other condensed keys (tailgating, rideshare, ...) are not on it. */
const UNION_KEYS: ReadonlySet<string> = new Set<BeforeYouGoKey>(['bag', 'gates', 'transit', 'parking', 'outsideFood']);

/** A union row's operator link when the card's line had none: the provenance
 *  record's URL for the class, else its pointer. The card itself linked only
 *  the bag policy page and the lot map; a row here that a reader cannot
 *  check is still a row a reader cannot check, so the record's URL stands in. */
function unionLink(hub: VenueHub, teamId: string, key: BeforeYouGoKey): string | null {
  switch (key) {
    case 'bag':
      return claimSourceUrl(hub, 'bagsProhibited') ?? claimSourceUrl(hub, 'bagMaxDimensions') ?? claimSourceUrl(hub, 'clearBagRequired') ?? claimSourceUrl(hub, 'bagPolicyNotes') ?? claimPointerUrl(hub, 'bagMaxDimensions');
    case 'parking':
      return claimLink(hub, 'parkingLots');
    case 'transit':
      return claimSourceUrl(hub, 'publicTransit');
    case 'gates':
      return gateSourceUrl(overlayFor(hub, teamId));
    case 'outsideFood': {
      const s = hub.sources ?? {};
      const u = s.outsideFoodAllowed ?? s.outsideFoodRules ?? null;
      return isReachableUrl(u) ? u : null;
    }
  }
}

/**
 * THE UNION (ruling 2026-11-08): the block's rows. The provenance rows first,
 * in their order; then every class the quick facts card would have shown for
 * this building (`quickFacts`, the card's own lines) that is not already
 * present, as an undated row with the operator link. A class in both uses the
 * provenance row only. Empty when there is no provenance row at all: the view
 * then falls back to the card itself.
 */
export function beforeYouGoUnion(hub: VenueHub, teamId: string, quickFacts: readonly CondensedLine[]): BeforeYouGoRow[] {
  const provenance = beforeYouGoRows(hub, teamId);
  if (!provenance.length) return [];
  const present = new Set<string>(provenance.map((r) => r.key));
  const extra: BeforeYouGoRow[] = [];
  for (const l of quickFacts) {
    if (!UNION_KEYS.has(l.key) || present.has(l.key)) continue;
    const key = l.key as BeforeYouGoKey;
    present.add(key);
    const sourceUrl = (isReachableUrl(l.href) ? l.href : null) ?? unionLink(hub, teamId, key);
    extra.push({ key, label: l.label, text: l.text, observedAt: null, observedOn: null, sourceUrl, sourceHost: sourceUrl ? claimSourceHost(sourceUrl) : null });
  }
  return [...provenance, ...extra];
}
