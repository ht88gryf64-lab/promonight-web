// RENDER-LEVEL BAG HOLDS (fix/venue-bag-holds, ruling 2026-11-05).
//
// Specific stored bag values that the pre-merge review of serp-targeting found
// wrong or unsupported, withheld from every surface until the pipeline corrects
// them. Each entry names the building, the field, why, and the ops-ticket item
// that carries the fix (docs/ops-tickets/venue-bag-data-2026-11.md). To lift an
// entry: correct the stored value per that item, then delete the entry.
//
// WHERE IT APPLIES. To the RAW document, at the two places a bag value enters
// the site: toVenueHub (src/lib/venue-hub.ts), which every venue, team, promo,
// NFL-hub and CFB surface reads, the CFB "ungated" view included; and
// bagRowFromDoc (src/lib/venue-bag-policies.ts), the MLB aggregator. Applying it
// at a render site instead would be the surface-escape failure: the next render
// path would not inherit it. A held field reads as absent, so every existing
// gate (eligibility, chip, FAQ, description, title) decides as if the pipeline
// had never written it.
//
// Imports nothing on purpose, like venue-field-exclusions.ts.

const TICKET = 'docs/ops-tickets/venue-bag-data-2026-11.md';

/** The stored fields a hold can withhold, plus one presentation hold. */
export type BagHoldField =
  | 'bagMaxDimensions'
  | 'clearBagRequired'
  | 'bagPolicyNotes'
  /** The source link under the bag-storage Common question only. The answer
   *  and the venue's official bag-policy link stay. */
  | 'storageAnswerLink';

export interface BagHold {
  /** venueHubs doc id. */
  hub: string;
  field: BagHoldField;
  reason: string;
  /** The ops-ticket item that carries the correction. */
  ticket: string;
}

export const BAG_HOLDS: ReadonlyArray<BagHold> = [
  {
    hub: 'q2-stadium',
    field: 'bagMaxDimensions',
    reason: 'The building bans bags ("Q2 Stadium prohibits all bags ... including clear bags"); the stored 8 x 5 x 1 is the clutch exemption size, and with bagsProhibited not set it rendered as "Max bag size" and a MAX BAG chip.',
    ticket: `${TICKET} item 6.1`,
  },
  {
    hub: 'nationwide-arena',
    field: 'bagMaxDimensions',
    reason: 'The building bans bags ("Bags are generally not permitted ... clutches no larger than 8x5x1 are exceptions"); the stored 8 x 5 x 1 is the exception size and rendered as the size limit.',
    ticket: `${TICKET} item 6.1`,
  },
  {
    hub: 'audi-field',
    field: 'clearBagRequired',
    reason: 'Stored false, but the cited page (dcunited.com/matchday/bags) never states whether a clear bag is required. Rule 1.6: a page silent on clarity is null.',
    ticket: `${TICKET} item 6.2`,
  },
  {
    hub: 'footprint-center',
    field: 'clearBagRequired',
    reason: 'Stored false, but the current Mortgage Matchup Center policies page carries no clear-bag term. Rule 1.6: a page silent on clarity is null.',
    ticket: `${TICKET} item 6.2`,
  },
  {
    hub: 'truist-park',
    field: 'bagPolicyNotes',
    reason: 'The notes carry the extractor\'s own reasoning as policy text: "(opaque clutches are permitted, so clear bags are not strictly required)".',
    ticket: `${TICKET} item 6.4`,
  },
  {
    hub: 'gainbridge-fieldhouse',
    field: 'bagPolicyNotes',
    reason: 'The notes carry the extractor\'s own reasoning as policy text: "there is no clear-bag requirement stated."',
    ticket: `${TICKET} item 6.4`,
  },
  {
    hub: 't-mobile-park',
    field: 'storageAnswerLink',
    reason: 'The storage sentence cites mlb.com/mariners/ballpark/gate-bag-policy-faq, which carries neither "16" nor "storage"; the sentence comes from /ballpark/information/guide (rule 2.2).',
    ticket: `${TICKET} item 6.5`,
  },
];

export function bagFieldHeld(hubSlug: string, field: BagHoldField): boolean {
  return BAG_HOLDS.some((h) => h.hub === hubSlug && h.field === field);
}

const DOC_FIELDS: ReadonlyArray<Exclude<BagHoldField, 'storageAnswerLink'>> = ['bagMaxDimensions', 'clearBagRequired', 'bagPolicyNotes'];

/**
 * The raw document with every held field removed, value AND provenance, so no
 * gate downstream can see either. The same object comes back untouched when the
 * building has no hold, which is what keeps every other building byte-identical.
 */
export function withBagHolds<T extends Record<string, unknown>>(hubSlug: string, d: T): T {
  const held = DOC_FIELDS.filter((f) => bagFieldHeld(hubSlug, f));
  if (!held.length) return d;
  const out: Record<string, unknown> = { ...d };
  const sources = d.sources && typeof d.sources === 'object' && !Array.isArray(d.sources) ? { ...(d.sources as Record<string, unknown>) } : d.sources;
  const observed = d.observedAtByField && typeof d.observedAtByField === 'object' ? { ...(d.observedAtByField as Record<string, unknown>) } : d.observedAtByField;
  for (const f of held) {
    out[f] = null;
    if (sources && typeof sources === 'object') {
      for (const k of Object.keys(sources)) if (k === f || k.startsWith(`${f}.`)) delete (sources as Record<string, unknown>)[k];
    }
    if (observed && typeof observed === 'object') delete (observed as Record<string, unknown>)[f];
  }
  out.sources = sources;
  out.observedAtByField = observed;
  return out as T;
}
