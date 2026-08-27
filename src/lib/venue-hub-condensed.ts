// The condensed venue logistics lines for a team or school page: one line per
// field, the practical answer only, verbatim from the hub. Pure: takes the
// VenueHub the caller already holds, returns lines, renders nothing.
//
// THE RULE (CFB content depth, 2026-08-27): a field renders only when it is
// populated AND the hub carries provenance for THAT field in its sources map
// (gates: the tenant overlay's own sources.gatesOpen). Not the index floor,
// not the doc-level verified flag, not the tenant's verified flag. A populated
// field with no source stays silent. "No CFB data goes live before we love
// it", applied per field.
//
// PROVENANCE GRAIN (2026-08-27, audit/cfb-venue-sourcing-report.md section 2):
// venueHubs.sources carries two conventions. Most hubs vouch for a whole
// field with a flat key (sources.tailgating, sources.publicTransit, overlay
// sources.gatesOpen). Others vouch per sub-field with dotted keys
// (sources["tailgating.rules"], ["tailgating.timeWindow"],
// ["publicTransit.notes"], ["publicTransit.lines"], overlay
// ["gatesOpen.ruleText"]): 21 hubs in the 2026-08-27 dump carry at least one,
// the 17 tailgating hubs of report section 2 among them. Both are provenance. A sub-field renders when its
// own dotted key OR its field's flat key is present; a sub-field with neither
// stays silent even when a sibling sub-field is sourced. The data is right at
// the sub-field grain; nothing here writes flat aliases to catch up.
//
// EXCLUSIONS: a field whose stored text an official source contradicts
// (CONDENSED_CONFLICTS) or whose stored text is known stale pending a data
// correction (CONDENSED_HOLDS) stays silent on the school page even when it is
// populated and sourced. Both lists are explicit, keyed by hub slug, with the
// reason per entry, so each can be revisited and deleted.
//
// Text is never paraphrased: gate times and bag dimensions are the stored
// values, prose fields are their first stored sentence (leadSentences), lots
// are their stored names.
import { type VenueHub, leadSentences, dimsString, stripTrailingPeriod } from './venue-hub';

export type CondensedField =
  | 'gates' | 'bag' | 'parking' | 'tailgating' | 'transit' | 'rideshare' | 'accessibility' | 'outsideFood' | 'food' | 'nearby';

export interface CondensedLine {
  key: CondensedField;
  label: string;
  text: string;
  /** Optional official link for the line (bag policy page, lot map, official parking). */
  href: string | null;
  hrefLabel: string | null;
}

export interface CondensedExclusion {
  /** venueHubs doc id. */
  hub: string;
  field: CondensedField;
  /** When set, only this sub-field of the line is withheld (the line's other
   *  sub-fields still render on their own provenance). Absent: the whole line. */
  sub?: 'officialParkingUrls' | 'parkingLotMapUrl' | 'parkingLots' | 'rules' | 'timeWindow' | 'allowed' | 'notes' | 'lines' | 'ruleText';
  /** Why the field is silent, specific enough to re-check without the report. */
  reason: string;
}

/** CONFLICTS (audit/cfb-venue-sourcing-report.md section 4, verified
 *  2026-08-27). The stored text is populated and sourced, and an official page
 *  contradicts it. The rule for conflicts is report-and-hold: the stored text
 *  is not rewritten to match, no source is attached, and the field stays off
 *  the school page. The venue page still renders these fields (it gates on
 *  the doc-level verified flag, not per field). To lift an entry: correct the
 *  data from the official page named here, then delete the entry. */
export const CONDENSED_CONFLICTS: ReadonlyArray<CondensedExclusion> = [
  {
    hub: 'brooks-stadium',
    field: 'tailgating',
    reason: 'Coastal Carolina: rules and the two-hour lot-open window come from the 2020 COVID-season guide (goccusports.com/sports/2020/9/17/CAFgameday); the current 2026 parking page (goccusports.com/sports/2026/8/17/2025-football-parking) and the 2025 Know Before You Go articles contradict both.',
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
    reason: 'Tulane: stored rules are a 2025 capture ("only tailgating location for the 2025 season", Lagniappe/Beaucoup packages); the cited page (tulanegreenwave.com/sports/2019/7/29/tailgating-2019) was rewritten for 2026 with a different season statement and package list.',
  },
  {
    hub: 'kidd-brewer-stadium',
    field: 'parking',
    sub: 'officialParkingUrls',
    reason: 'Appalachian State: the stored officialParkingUrls entry (mountaineersathleticfund.com/yosef-club/renewals/index.html) returns 403; the 2025 fan guide body links the live mountaineersathleticfund.com/yosef-club/index.html#season-tickets-parking instead. Sub-field grain on purpose: lots and a lot map written with their own sources (report section 8) render; the dead link never does.',
  },
];

/** HOLDS. Not conflicts: a ruling has settled which official source governs,
 *  so the stored text is stale rather than disputed, and a data correction is
 *  queued. The field stays silent until the correction lands; the entry is
 *  deleted with that write. */
export const CONDENSED_HOLDS: ReadonlyArray<CondensedExclusion> = [
  // secu-stadium transit was held here from 2026-08-27 until the Pass 2 write
  // corrected publicTransit.notes to the DOTS window and re-sourced it to
  // transportation.umd.edu (scripts/cfb-venue-data-plan.json).
];

// Texas A&M (kyle-field) tailgating.rvPolicy is unconfirmed (on no 12thman.com
// tailgating page). It needs no entry: the block renders the rules and
// timeWindow sentences only, never grillRules or rvPolicy. If rvPolicy ever
// joins the line, gate kyle-field here first.

const has = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim().length > 0;
const prov = (sources: Record<string, string> | undefined, key: string): boolean => !!sources && has(sources[key]);
/** Provenance for one sub-field: its own dotted key, or the flat key that
 *  vouches for the whole field. */
const subProv = (sources: Record<string, string> | undefined, field: string, sub: string): boolean =>
  prov(sources, `${field}.${sub}`) || prov(sources, field);
const EXCLUSIONS: ReadonlyArray<CondensedExclusion> = [...CONDENSED_CONFLICTS, ...CONDENSED_HOLDS];
/** The whole line is withheld: an entry for this hub and field with no sub. */
const excluded = (hubSlug: string, field: CondensedField): boolean =>
  EXCLUSIONS.some((e) => e.hub === hubSlug && e.field === field && !e.sub);
/** One sub-field is withheld: an entry naming it, or one withholding the whole line. */
const excludedSub = (hubSlug: string, field: CondensedField, sub: NonNullable<CondensedExclusion['sub']>): boolean =>
  EXCLUSIONS.some((e) => e.hub === hubSlug && e.field === field && (!e.sub || e.sub === sub));
/** House rule at render, never in the record: the stored text is the sourced
 *  value and is not edited, but an em dash in served copy is out. A spaced or
 *  bare em dash becomes a comma; one that follows punctuation becomes a space
 *  so no ",," or ".," forms. En dashes stay: they are part of building names
 *  (Rice–Eccles, Vaught–Hemingway). */
export function stripEmDashes(t: string): string {
  return t
    .replace(/([.,;:!?])\s*—\s*/g, '$1 ')
    .replace(/\s*—\s*/g, ', ');
}
// First stored sentence, verbatim. A lead that already ends in a terminator
// keeps it ("Sodexo Live!" stays "Sodexo Live!", never "Sodexo Live!."); one
// that does not (a fragment, or a value stored without its period) gets one.
const sentence = (t: string): string => { const lead = stripEmDashes(leadSentences(t, 1).lead); return /[.!?]$/.test(lead) ? lead : `${stripTrailingPeriod(lead)}.`; };

/** Build the lines for one tenant of a hub. `tenantId` selects the overlay whose
 *  gates rule applies (a shared NFL/CFB building has one per tenant). */
export function buildCondensedLogistics(hub: VenueHub, tenantId: string): CondensedLine[] {
  const s = hub.sources ?? {};
  const lines: CondensedLine[] = [];

  // Gates: the tenant's own overlay, its own provenance (gatesOpen.ruleText or gatesOpen).
  const overlay = hub.tenantOverlays.find((t) => t.teamId === tenantId);
  if (overlay?.gatesOpen && has(overlay.gatesOpen.ruleText) && subProv(overlay.sources, 'gatesOpen', 'ruleText') && !excluded(hub.slug, 'gates')) {
    lines.push({ key: 'gates', label: 'Gates', text: sentence(overlay.gatesOpen.ruleText), href: null, hrefLabel: null });
  }

  // Bag policy: the stored dimensions verbatim, or the stored boolean, or the
  // first sentence of the notes. Each fact needs its own key present.
  if (!excluded(hub.slug, 'bag')) {
    const dims = dimsString(hub.bagMaxDimensions);
    let text: string | null = null;
    if (dims && prov(s, 'bagMaxDimensions')) text = `${hub.clearBagRequired === true && prov(s, 'clearBagRequired') ? 'Clear bag' : 'Max bag'} ${dims}.`;
    else if (hub.bagsProhibited === true && prov(s, 'bagsProhibited')) text = 'Bags are not allowed.';
    else if (typeof hub.clearBagRequired === 'boolean' && prov(s, 'clearBagRequired')) text = hub.clearBagRequired ? 'Clear bag required.' : 'Clear bag not required.';
    else if (has(hub.bagPolicyNotes) && prov(s, 'bagPolicyNotes')) text = sentence(hub.bagPolicyNotes);
    const href = has(hub.bagPolicyUrl) && prov(s, 'bagPolicyUrl') ? hub.bagPolicyUrl : null;
    if (text || href) lines.push({ key: 'bag', label: 'Bag policy', text: text ?? 'See the official bag policy.', href, hrefLabel: href ? 'Official bag policy' : null });
  }

  // Parking: lot names only with sources.parkingLots; each link only with its own key.
  if (!excluded(hub.slug, 'parking')) {
    const lots = prov(s, 'parkingLots') ? hub.parkingLots.map((l) => l.name).filter(has).slice(0, 4).map(stripEmDashes) : [];
    const mapHref = has(hub.parkingLotMapUrl) && prov(s, 'parkingLotMapUrl') ? hub.parkingLotMapUrl : null;
    const officialHref = !mapHref && hub.officialParkingUrls.length > 0 && prov(s, 'officialParkingUrls') && !excludedSub(hub.slug, 'parking', 'officialParkingUrls') ? hub.officialParkingUrls[0] : null;
    const href = mapHref ?? officialHref;
    const text = lots.length ? `Lots: ${lots.join(', ')}.` : href ? 'See the official parking page.' : null;
    if (text) lines.push({ key: 'parking', label: 'Parking', text, href, hrefLabel: href ? (mapHref ? 'Official lot map' : 'Official parking') : null });
  }

  // Tailgating: the allowed flag, the first sentence of the rules and of the
  // window, each on its own provenance. A false flag is terminal: sourced, it
  // renders "Not permitted."; unsourced, the line stays silent, so a lot-open
  // window can never be presented under a prohibition. grillRules and
  // rvPolicy do not render here; they are venue-page depth.
  if (hub.tailgating && !excluded(hub.slug, 'tailgating')) {
    const tg = hub.tailgating;
    const allowedOk = typeof tg.allowed === 'boolean' && subProv(s, 'tailgating', 'allowed');
    const parts: string[] = [];
    if (tg.allowed === false) {
      if (allowedOk) parts.push('Not permitted.');
    } else {
      if (has(tg.rules) && subProv(s, 'tailgating', 'rules')) parts.push(sentence(tg.rules));
      else if (tg.allowed === true && allowedOk) parts.push('Permitted.');
      if (has(tg.timeWindow) && subProv(s, 'tailgating', 'timeWindow')) parts.push(sentence(tg.timeWindow));
    }
    if (parts.length) lines.push({ key: 'tailgating', label: 'Tailgating', text: parts.join(' '), href: null, hrefLabel: null });
  }

  // Transit: first sentence of the notes plus the named lines, each on its own provenance.
  if (hub.publicTransit && !excluded(hub.slug, 'transit')) {
    const pt = hub.publicTransit;
    const parts: string[] = [];
    if (has(pt.notes) && subProv(s, 'publicTransit', 'notes')) parts.push(sentence(pt.notes));
    if (Array.isArray(pt.lines) && pt.lines.length && subProv(s, 'publicTransit', 'lines')) parts.push(`Lines: ${pt.lines.map(stripEmDashes).join(', ')}.`);
    if (parts.length) lines.push({ key: 'transit', label: 'Transit', text: parts.join(' '), href: null, hrefLabel: null });
  }

  if (has(hub.rideshareDropoff) && prov(s, 'rideshareDropoff') && !excluded(hub.slug, 'rideshare')) lines.push({ key: 'rideshare', label: 'Rideshare', text: sentence(hub.rideshareDropoff), href: null, hrefLabel: null });
  if (has(hub.accessibility) && prov(s, 'accessibility') && !excluded(hub.slug, 'accessibility')) lines.push({ key: 'accessibility', label: 'Accessibility', text: sentence(hub.accessibility), href: null, hrefLabel: null });

  // Outside food: the stored boolean, else the first sentence of the rules.
  if (!excluded(hub.slug, 'outsideFood')) {
    if (typeof hub.outsideFoodAllowed === 'boolean' && (prov(s, 'outsideFoodAllowed') || prov(s, 'outsideFoodRules'))) {
      lines.push({ key: 'outsideFood', label: 'Outside food', text: hub.outsideFoodAllowed ? 'Outside food is allowed.' : 'No outside food or drink.', href: null, hrefLabel: null });
    } else if (has(hub.outsideFoodRules) && prov(s, 'outsideFoodRules')) {
      lines.push({ key: 'outsideFood', label: 'Outside food', text: sentence(hub.outsideFoodRules), href: null, hrefLabel: null });
    }
  }

  if (has(hub.food) && prov(s, 'food') && !excluded(hub.slug, 'food')) lines.push({ key: 'food', label: 'Concessions', text: sentence(hub.food), href: null, hrefLabel: null });
  if (has(hub.nearby) && prov(s, 'nearby') && !excluded(hub.slug, 'nearby')) lines.push({ key: 'nearby', label: 'Nearby', text: sentence(hub.nearby), href: null, hrefLabel: null });

  return lines;
}

/** The block renders only with at least this many lines; below it the page
 *  keeps the guide link and nothing else. */
export const CONDENSED_MIN_FIELDS = 3;
