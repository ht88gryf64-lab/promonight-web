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

const has = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim().length > 0;
const prov = (sources: Record<string, string> | undefined, key: string): boolean => !!sources && has(sources[key]);
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

  // Gates: the tenant's own overlay, its own provenance.
  const overlay = hub.tenantOverlays.find((t) => t.teamId === tenantId);
  if (overlay?.gatesOpen && has(overlay.gatesOpen.ruleText) && prov(overlay.sources, 'gatesOpen')) {
    lines.push({ key: 'gates', label: 'Gates', text: sentence(overlay.gatesOpen.ruleText), href: null, hrefLabel: null });
  }

  // Bag policy: the stored dimensions verbatim, or the stored boolean, or the
  // first sentence of the notes. Each fact needs its own key present.
  {
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
  {
    const lots = prov(s, 'parkingLots') ? hub.parkingLots.map((l) => l.name).filter(has).slice(0, 4).map(stripEmDashes) : [];
    const mapHref = has(hub.parkingLotMapUrl) && prov(s, 'parkingLotMapUrl') ? hub.parkingLotMapUrl : null;
    const officialHref = !mapHref && hub.officialParkingUrls.length > 0 && prov(s, 'officialParkingUrls') ? hub.officialParkingUrls[0] : null;
    const href = mapHref ?? officialHref;
    const text = lots.length ? `Lots: ${lots.join(', ')}.` : href ? 'See the official parking page.' : null;
    if (text) lines.push({ key: 'parking', label: 'Parking', text, href, hrefLabel: href ? (mapHref ? 'Official lot map' : 'Official parking') : null });
  }

  // Tailgating: allowed flag plus the first sentence of the rules and the window.
  if (hub.tailgating && prov(s, 'tailgating')) {
    const tg = hub.tailgating;
    const parts: string[] = [];
    if (tg.allowed === false) parts.push('Not permitted.');
    else {
      if (has(tg.rules)) parts.push(sentence(tg.rules));
      else if (tg.allowed === true) parts.push('Permitted.');
      if (has(tg.timeWindow)) parts.push(sentence(tg.timeWindow));
    }
    if (parts.length) lines.push({ key: 'tailgating', label: 'Tailgating', text: parts.join(' '), href: null, hrefLabel: null });
  }

  // Transit: first sentence of the notes plus the named lines.
  if (hub.publicTransit && prov(s, 'publicTransit')) {
    const pt = hub.publicTransit;
    const parts: string[] = [];
    if (has(pt.notes)) parts.push(sentence(pt.notes));
    if (pt.lines.length) parts.push(`Lines: ${pt.lines.map(stripEmDashes).join(', ')}.`);
    if (parts.length) lines.push({ key: 'transit', label: 'Transit', text: parts.join(' '), href: null, hrefLabel: null });
  }

  if (has(hub.rideshareDropoff) && prov(s, 'rideshareDropoff')) lines.push({ key: 'rideshare', label: 'Rideshare', text: sentence(hub.rideshareDropoff), href: null, hrefLabel: null });
  if (has(hub.accessibility) && prov(s, 'accessibility')) lines.push({ key: 'accessibility', label: 'Accessibility', text: sentence(hub.accessibility), href: null, hrefLabel: null });

  // Outside food: the stored boolean, else the first sentence of the rules.
  if (typeof hub.outsideFoodAllowed === 'boolean' && (prov(s, 'outsideFoodAllowed') || prov(s, 'outsideFoodRules'))) {
    lines.push({ key: 'outsideFood', label: 'Outside food', text: hub.outsideFoodAllowed ? 'Outside food is allowed.' : 'No outside food or drink.', href: null, hrefLabel: null });
  } else if (has(hub.outsideFoodRules) && prov(s, 'outsideFoodRules')) {
    lines.push({ key: 'outsideFood', label: 'Outside food', text: sentence(hub.outsideFoodRules), href: null, hrefLabel: null });
  }

  if (has(hub.food) && prov(s, 'food')) lines.push({ key: 'food', label: 'Concessions', text: sentence(hub.food), href: null, hrefLabel: null });
  if (has(hub.nearby) && prov(s, 'nearby')) lines.push({ key: 'nearby', label: 'Nearby', text: sentence(hub.nearby), href: null, hrefLabel: null });

  return lines;
}

/** The block renders only with at least this many lines; below it the page
 *  keeps the guide link and nothing else. */
export const CONDENSED_MIN_FIELDS = 3;
