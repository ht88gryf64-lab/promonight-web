// Per-claim provenance: what a row shows, where the claim came from, and when
// that field was last verified.
//
// WHY THIS IS ITS OWN MODULE. Before wave 2 a venue page printed facts with no
// visible way to check them, and a hub-level "verified" flag that said nothing
// about WHICH fact was checked or WHEN. The pipeline now writes two per-field
// maps (`fieldStates`, `verifiedAtByField`), and everything a page says about a
// single claim derives from them here, so the bag card, the parking card and
// the transit row cannot drift into three different answers to the same
// question.
//
// A legacy doc carries neither map. That reads as "no opinion": `claimState`
// returns null and every pre-existing provenance gate stays in charge, which is
// what keeps 160-odd buildings written before this change rendering unchanged.

import type { VenueFieldState, VenueHub } from './venue-hub';

/** The hub fields this module answers for. Pointer fields are not claims. */
export type ClaimField =
  | 'parkingLots'
  | 'rideshareDropoff'
  | 'publicTransit'
  | 'bagMaxDimensions'
  | 'clearBagRequired'
  | 'bagsProhibited'
  | 'bagPolicyNotes'
  | 'accessibility'
  | 'food'
  | 'nearby';

type ClaimFacts = Pick<VenueHub, 'sources' | 'fieldStates' | 'verifiedAtByField'>;

/** The pipeline's state for a field, or null when the doc carries no state map
 *  (written before wave 2) or no entry for this field. Null is not a state: it
 *  means the older provenance gates decide, exactly as they did before. */
export function claimState(hub: ClaimFacts, field: ClaimField): VenueFieldState | null {
  return hub.fieldStates?.[field] ?? null;
}

/** The URL that carries this claim. `sources` admits a sub-keyed entry
 *  (`publicTransit.lines`) and an array of pages for a claim two operator pages
 *  share; the link takes the first, because one working link is the point. */
export function claimSourceUrl(hub: ClaimFacts, field: ClaimField): string | null {
  const s = hub.sources ?? {};
  const raw: unknown =
    s[field] ?? s[`${field}.notes`] ?? s[`${field}.lines`] ?? s[`${field}.ruleText`] ?? null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string' || !first.startsWith('http') || !URL.canParse(first)) return null;
  return first;
}

/** The host a reader will land on, for the link text. */
export function claimSourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** "Sep 3, 2026" for this field's own verification stamp, or null when the doc
 *  carries no per-field date. Never falls back to the doc-level `verifiedAt`:
 *  a date copied across fields is the claim this map exists to stop. */
export function claimVerifiedOn(hub: ClaimFacts, field: ClaimField): string | null {
  const iso = hub.verifiedAtByField?.[field];
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(t));
}

/** Reason copy for the two states that render a pointer instead of a claim.
 *  Fixed strings: the readings behind a conflict are provenance, not page copy,
 *  and a reader needs the fact that there is no answer, not the argument. */
export const CLAIM_STATE_REASON: Record<'operator-conflict' | 'no-operator-page', string> = {
  'operator-conflict': 'The operator publishes conflicting answers.',
  'no-operator-page': 'No official policy page found.',
};

export interface ClaimRow {
  /** Show the claim itself. */
  show: boolean;
  /** Reason text to print in place of the claim, when there is one. */
  reason: string | null;
  /** Source URL for the row, claim or reason alike. */
  sourceUrl: string | null;
  /** Formatted per-field verification date, for a shown claim. */
  verifiedOn: string | null;
}

/**
 * One decision for one field. `fallbackShow` is the caller's pre-existing gate
 * (provenance, reachability, exclusions), which still applies: the state map can
 * only take a row away or explain its absence, never grant one a gate refused.
 */
export function claimRow(hub: ClaimFacts, field: ClaimField, fallbackShow: boolean): ClaimRow {
  const state = claimState(hub, field);
  const sourceUrl = claimSourceUrl(hub, field);
  if (state === 'held') return { show: false, reason: null, sourceUrl: null, verifiedOn: null };
  if (state === 'operator-conflict' || state === 'no-operator-page') {
    return {
      show: false,
      reason: CLAIM_STATE_REASON[state],
      // A conflict keeps its pointer so a reader can go read the operator; a
      // missing page has none to keep.
      sourceUrl: state === 'operator-conflict' ? sourceUrl : null,
      verifiedOn: null,
    };
  }
  if (!fallbackShow) return { show: false, reason: null, sourceUrl: null, verifiedOn: null };
  return { show: true, reason: null, sourceUrl, verifiedOn: claimVerifiedOn(hub, field) };
}
