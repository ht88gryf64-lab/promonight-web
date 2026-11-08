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
// Order is the venue page's: the bag capsule, then the Getting-in rows (gates,
// transit), then the parking card. On the 2026-11-08 corpus no building or
// overlay carries a read time for transit or gates (scripts/audit-before-you-go.ts),
// so those two rows exist in code and render on no page until the pipeline
// writes one; bag and parking are what pages show today.
import { type VenueHub, type VenueHubTenantOverlay, dimsString } from './venue-hub';
import { claimPointerUrl, claimSourceHost, claimSourceUrl, formatReadOn, type ClaimField } from './venue-claim';
import { hasSubProvenance, isReachableUrl } from './venue-field-exclusions';
import { sentence, stripEmDashes } from './venue-hub-condensed';
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
  if (prohibitedAt) return row('bag', 'Bags are not allowed.', prohibitedAt, claimLink(hub, 'bagsProhibited'));
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

function gatesRow(hub: VenueHub, teamId: string): BeforeYouGoRow | null {
  // This team's overlay only (a shared building has one gate rule per tenant),
  // out of the published set: verified, sourced, not excluded.
  const t: VenueHubTenantOverlay | undefined = hub.tenantOverlays.find((o) => o.teamId === teamId);
  const rule = t?.gatesOpen?.ruleText;
  if (!t || !has(rule)) return null;
  const at = renderedReadTime(t.fieldStates, t.observedAtByField, 'gatesOpen', 'ruleText');
  if (!at) return null;
  const src = t.sources.gatesOpen ?? t.sources['gatesOpen.ruleText'] ?? null;
  return row('gates', sentence(rule), at, isReachableUrl(src) ? src : null);
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

/** The rows for one tenant of a published hub, in the venue page's order.
 *  Empty when no field is in state `rendered` with a read time: the block then
 *  renders nothing. */
export function beforeYouGoRows(hub: VenueHub, teamId: string): BeforeYouGoRow[] {
  const byKey: Record<BeforeYouGoKey, BeforeYouGoRow | null> = {
    bag: bagRow(hub),
    gates: gatesRow(hub, teamId),
    transit: transitRow(hub),
    parking: parkingRow(hub),
  };
  return BEFORE_YOU_GO_ORDER.map((k) => byKey[k]).filter((r): r is BeforeYouGoRow => r !== null);
}
