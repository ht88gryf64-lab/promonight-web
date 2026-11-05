// The bag-policy answer for a venue page (serp-targeting, rulings 2026-11-05).
//
// ONE RULE GOVERNS THIS FILE: render nothing that is not in the sourced layer.
// Every fact the answer block, the Common questions and the FAQPage JSON-LD
// state is either a sourced structured field (bagMaxDimensions,
// clearBagRequired, bagsProhibited) or a sentence QUOTED VERBATIM from sourced
// prose (bagPolicyNotes, a verified tenant's bagPolicyException). A quote is a
// slice of the stored string, never a rewording and never a join of two
// non-adjacent sentences, so "every answer is an exact substring of a sourced
// field" holds by construction and the tests check it anyway.
//
// The hub passed in is the PUBLISHED hub (getVenueHub applies publishedView),
// so an unsourced or excluded claim is already null here. The provenance tests
// below repeat the gate rather than trust it, the way bagCardModel does: the
// surface-escape lesson is that each new render path re-states its gate.
//
// Which buildings get the bag-policy template is isBagAnswerEligible (ruling
// 5): verified, the bag field not excluded, and a sourced size limit OR a
// sourced bagsProhibited. Every other building renders exactly as it did on
// main, title included; the byte-identity test holds that line.

import type { VenueHub } from './venue-hub';
import { dimsString, displayVenueName, SEASON_YEAR, venueHubTopics } from './venue-hub';
import { fieldExcluded, subFieldExcluded, hasProvenance, isReachableUrl } from './venue-field-exclusions';
import { claimSourceUrl, claimSourceReadOn } from './venue-claim';
import { bagFieldHeld } from './venue-bag-holds';

type Hub = VenueHub;

// ── the sourced bag facts ────────────────────────────────────────────────────

export interface SourcedBagFacts {
  /** The size limit, formatted. Null when unsourced, AND null when bags are
   *  prohibited: on a no-bag building the stored dimensions are an exception
   *  size (truist-park stores the 5 x 9 clutch exception), so the page never
   *  labels them the size limit (ruling 6). */
  sizeLimit: string | null;
  /** Sourced dimensions whatever the prohibition says. Eligibility only. */
  dims: string | null;
  prohibited: boolean;
  /** Sourced clearBagRequired, or null. */
  clear: boolean | null;
}

export function sourcedBagFacts(hub: Hub): SourcedBagFacts {
  const s = hub.sources;
  const dims = hasProvenance(s, 'bagMaxDimensions') ? dimsString(hub.bagMaxDimensions) : null;
  const prohibited = hub.bagsProhibited === true && hasProvenance(s, 'bagsProhibited');
  const clear = typeof hub.clearBagRequired === 'boolean' && hasProvenance(s, 'clearBagRequired') ? hub.clearBagRequired : null;
  return { sizeLimit: prohibited ? null : dims, dims, prohibited, clear };
}

/** Ruling 5. Unverified buildings are never eligible. */
export function isBagAnswerEligible(hub: Hub): boolean {
  if (hub.verified !== true || fieldExcluded(hub.slug, 'bag')) return false;
  const f = sourcedBagFacts(hub);
  return f.dims !== null || f.prohibited;
}

// ── title, heading, description ─────────────────────────────────────────────

/** Rendered title ceiling. The bag template is emitted with title.absolute, so
 *  there is no " | PromoNight" suffix and this is the whole rendered string. */
export const VENUE_BAG_TITLE_MAX = 60;

export type BagTitleVariant = 'prohibited' | 'clear' | 'size';

/** Ruling 2: prohibited wins, then a sourced clear-bag requirement, else size. */
export function bagTitleVariant(hub: Hub): BagTitleVariant {
  const f = sourcedBagFacts(hub);
  if (f.prohibited) return 'prohibited';
  return f.clear === true ? 'clear' : 'size';
}

const VARIANT_TERMS: Record<BagTitleVariant, [string, string]> = {
  prohibited: ['No Bags Allowed', 'Exceptions'],
  clear: ['Clear Bag Size', "What's Allowed"],
  size: ['Bag Size', "What's Allowed"],
};

/** Candidates in the ruled drop order: the second term, then the first, then
 *  the year. The venue name is never shortened and nothing is cut mid-word,
 *  because every candidate is a whole-phrase assembly. */
export function venueBagTitleCandidates(hub: Hub): string[] {
  const v = displayVenueName(hub.name);
  const [a, b] = VARIANT_TERMS[bagTitleVariant(hub)];
  return [
    `${v} Bag Policy ${SEASON_YEAR}: ${a} & ${b}`,
    `${v} Bag Policy ${SEASON_YEAR}: ${a}`,
    `${v} Bag Policy ${SEASON_YEAR}`,
    `${v} Bag Policy`,
  ];
}

/** The first candidate that fits; the last one when none does (the venue name
 *  alone is longer than the budget allows, which is reported, not cut). */
export function venueBagTitle(hub: Hub): string {
  const c = venueBagTitleCandidates(hub);
  return c.find((t) => t.length <= VENUE_BAG_TITLE_MAX) ?? c[c.length - 1];
}

/** H1: "{Venue} Bag Policy", keeping the renamed-building suffix the H1 has
 *  carried since the 2026-10-07 former-names ruling. */
export function venueBagHeading(hub: Pick<Hub, 'name' | 'formerNames'>): string {
  const former = hub.formerNames?.[0];
  const base = `${displayVenueName(hub.name)} Bag Policy`;
  return former ? `${base} (formerly ${former})` : base;
}

export const VENUE_BAG_DESC_MIN = 120;
export const VENUE_BAG_DESC_MAX = 155;

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The lead sentence: the size limit (or the prohibition), stated from the
 *  sourced fields only. The clear-bag clause appears only when sourced. */
export function bagLeadSentence(hub: Hub): string {
  const v = displayVenueName(hub.name);
  const f = sourcedBagFacts(hub);
  if (f.prohibited) return `${v} bag policy: no bags allowed inside.`;
  const lim = f.sizeLimit as string;
  if (f.clear === true) return `${v} bag policy: clear bags up to ${lim} are required.`;
  if (f.clear === false) return `${v} bag policy: bags up to ${lim} are allowed and do not have to be clear.`;
  return `${v} bag policy: bags up to ${lim} are allowed.`;
}

/**
 * Meta description for an eligible building: leads with the size limit, 120 to
 * 155 characters, and every clause is either a sourced fact or a section the
 * page renders. Clauses are added whole or not at all, so nothing is cut
 * mid-word. Pads toward the floor only with clauses that are true of the page.
 */
export function venueBagDescription(hub: Hub): string {
  const lead = bagLeadSentence(hub);
  const topicNouns = bagTopicQuestions(hub).flatMap((q) => q.topics.map((t) => TOPIC_BY_KEY[t].noun));
  const t = venueHubTopics(hub);
  const sections = [
    ...(t.parking ? ['parking'] : []),
    ...(t.gates ? ['gate times'] : []),
    ...(t.transit ? ['transit'] : []),
    'hotels',
    ...(t.food ? ['food'] : []),
  ];
  const parts: Array<() => string | null> = [
    () => {
      // Drop nouns from the end until the clause fits.
      for (let n = topicNouns.length; n >= 1; n--) {
        // "Covers", not "quoted from the published policy": the quotes are
        // slices of OUR stored notes, which are the extractor's wording of the
        // source, not the operator's own text (pre-merge review 2026-11-05).
        // What is true by construction is that the page answers these.
        const clause = ` Covers ${joinList(topicNouns.slice(0, n))} rules.`;
        if ((out + clause).length <= VENUE_BAG_DESC_MAX) return clause;
      }
      return null;
    },
    () => {
      for (let n = sections.length; n >= 1; n--) {
        const clause = ` Plus ${joinList(sections.slice(0, n))}.`;
        if ((out + clause).length <= VENUE_BAG_DESC_MAX) return clause;
      }
      return null;
    },
  ];
  let out = lead;
  for (const p of parts) {
    const c = p();
    if (c) out += c;
  }
  // Floor padding, true on every eligible page: the answer block links its
  // source, and the FAQ section always carries at least the size question.
  const fillers = [' Source linked on the page.', ' Common questions answered.'];
  for (const f of fillers) {
    if (out.length >= VENUE_BAG_DESC_MIN) break;
    if ((out + f).length <= VENUE_BAG_DESC_MAX) out += f;
  }
  return out;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ── verbatim quoting ─────────────────────────────────────────────────────────

export interface Span { start: number; end: number }

/**
 * Sentence spans as OFFSETS into the original string, so a quote is
 * `text.slice(start, end)` and is an exact substring by construction. Same
 * boundary rule as leadSentences (terminal .!? then whitespace then a capital,
 * digit, quote or bracket), with the same abbreviation guard, so "4.5x6.5" and
 * "a.m." never split.
 */
export function sentenceSpans(text: string): Span[] {
  const ABBREV = /\b(a\.m|p\.m|A\.M|P\.M|St|Ave|Blvd|Rd|Dr|Ste|Mt|Ft|No|approx|vs|Jr|Sr|Inc|Co|Corp|U\.S|N\.W|S\.W|N\.E|S\.E|e\.g|i\.e|[NSEW])\.(?=\s|$)/g;
  // Same-length mask, so offsets in the masked string are offsets in `text`.
  const masked = text.replace(ABBREV, (m) => m.replace(/\./g, '\u0000'));
  const spans: Span[] = [];
  const boundary = /(?<=[.!?])\s+(?=["'(A-Z0-9])/g;
  let start = 0;
  for (const m of masked.matchAll(boundary)) {
    spans.push({ start, end: m.index! });
    start = m.index! + m[0].length;
  }
  spans.push({ start, end: text.length });
  // Trim each span to its non-whitespace extent.
  return spans
    .map(({ start: s, end: e }) => {
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      return { start: s, end: e };
    })
    .filter((sp) => sp.end > sp.start);
}

export type ProseField = 'bagPolicyNotes' | 'bagPolicyException';

export interface SourcedProse {
  field: ProseField;
  /** The stored string, untouched. */
  text: string;
  sourceUrl: string;
  /** For a tenant exception: the overlay's teamId. */
  teamId?: string;
  /** Per-field read date, ISO, when the harvest recorded one. */
  observedAt?: string;
}

/** The sourced bag prose this building publishes, building notes first. */
export function sourcedBagProse(hub: Hub): SourcedProse[] {
  const out: SourcedProse[] = [];
  const notes = hub.bagPolicyNotes;
  const notesUrl = claimSourceUrl(hub, 'bagPolicyNotes');
  if (
    typeof notes === 'string' && notes.trim() &&
    hasProvenance(hub.sources, 'bagPolicyNotes') && notesUrl &&
    !fieldExcluded(hub.slug, 'bag') && !subFieldExcluded(hub.slug, 'bag', 'notes')
  ) {
    out.push({ field: 'bagPolicyNotes', text: notes, sourceUrl: notesUrl, observedAt: hub.observedAtByField?.bagPolicyNotes });
  }
  for (const t of hub.tenantOverlays ?? []) {
    const exc = t.bagPolicyException;
    const url = t.sources?.bagPolicyException;
    if (t.verified === true && typeof exc === 'string' && exc.trim() && isReachableUrl(url) && !fieldExcluded(hub.slug, 'bag')) {
      out.push({ field: 'bagPolicyException', text: exc, sourceUrl: url, teamId: t.teamId, observedAt: t.observedAtByField?.bagPolicyException });
    }
  }
  return out;
}

export interface Quote {
  text: string;
  sourceUrl: string;
  field: ProseField;
  teamId?: string;
  /** Offsets into the source string, for the substring test. */
  start: number;
  end: number;
}

/** The first sentence matching `re` in the first prose field that has one,
 *  extended by the NEXT sentence only when it matches too (an adjacent pair is
 *  still one contiguous slice). Null when no sentence matches anywhere. */
export function quoteMatching(prose: SourcedProse[], re: RegExp, maxSentences = 2): Quote | null {
  for (const p of prose) {
    const spans = sentenceSpans(p.text);
    const i = spans.findIndex((sp) => re.test(p.text.slice(sp.start, sp.end)));
    if (i < 0) continue;
    let j = i;
    while (j + 1 < spans.length && j + 1 - i < maxSentences && re.test(p.text.slice(spans[j + 1].start, spans[j + 1].end))) j++;
    const start = spans[i].start;
    const end = spans[j].end;
    return { text: p.text.slice(start, end), sourceUrl: p.sourceUrl, field: p.field, teamId: p.teamId, start, end };
  }
  return null;
}

/** The first `n` sentences of the building notes, verbatim. */
export function leadQuote(prose: SourcedProse[], n = 2): Quote | null {
  const p = prose.find((x) => x.field === 'bagPolicyNotes');
  if (!p) return null;
  const spans = sentenceSpans(p.text).slice(0, n);
  if (!spans.length) return null;
  const start = spans[0].start;
  const end = spans[spans.length - 1].end;
  return { text: p.text.slice(start, end), sourceUrl: p.sourceUrl, field: p.field, start, end };
}

// ── topic questions (ruling 3) ───────────────────────────────────────────────

export type BagTopic = 'clutch' | 'purse' | 'backpack' | 'diaper' | 'medical' | 'camera' | 'storage';

export const BAG_TOPICS: ReadonlyArray<{ key: BagTopic; noun: string; re: RegExp }> = [
  { key: 'clutch', noun: 'clutch', re: /\b(clutch(es)?|wristlets?)\b/i },
  // "clutch purse" is a clutch: matched on its own it filed seven buildings'
  // clutch sentence under a purse question that reads as permitting purses.
  { key: 'purse', noun: 'purse', re: /(?<!clutch[- ])\b(purses?|handbags?)\b/i },
  { key: 'backpack', noun: 'backpack', re: /\bback-?\s?packs?\b/i },
  { key: 'diaper', noun: 'diaper bag', re: /\bdiaper/i },
  { key: 'medical', noun: 'medical bag', re: /\bmedical\b/i },
  { key: 'camera', noun: 'camera', re: /\bcameras?\b/i },
  // "Storage" alone is not the topic: "one-gallon clear plastic storage bag" is
  // an APPROVED BAG on nine buildings and "storage features" is a seat-cushion
  // rule. Measured on the 2026-11-05 fixture, both read as storage answers
  // under the bare word. A possessive before "Locker" is a shop name
  // (kidd-brewer-stadium's "Yosef's Locker" sells clear bags), not storage.
  // Bare "store" is a shop too (energizer-park's "team store shopping bag"),
  // so only the verb forms count, and a "bag-check line" is a screening line
  // (donald-w-reynolds-razorback-stadium), not a place to leave a bag.
  { key: 'storage', noun: 'bag storage', re: /\bstorage\b(?!\s+(bags?|features)\b)|(?<!['\u2019]s )\b(lockers?|coat check|bag valet)\b|\bbag[- ]check\b(?![- ]line)|\b(be|are|is) stored\b|\bstore (it|them|your|their|bags?|items)\b|\b(may|can) be checked\b/i },
];
const TOPIC_BY_KEY = Object.fromEntries(BAG_TOPICS.map((t) => [t.key, t])) as Record<BagTopic, (typeof BAG_TOPICS)[number]>;

export interface BagTopicQuestion {
  topics: BagTopic[];
  question: string;
  answer: string;
  /** Absent when a hold withdraws the link (venue-bag-holds, storageAnswerLink). */
  sourceUrl?: string;
  quote: Quote;
}

/**
 * One question per topic a sourced sentence covers. Two topics whose quote is
 * the SAME slice share one question ("What is the clutch and purse policy at
 * X?") rather than printing one sentence twice. A topic with no matching
 * sentence gets no question.
 */
export function bagTopicQuestions(hub: Hub): BagTopicQuestion[] {
  if (!isBagAnswerEligible(hub)) return [];
  const v = displayVenueName(hub.name);
  const prose = sourcedBagProse(hub);
  const groups: Array<{ topics: BagTopic[]; quote: Quote }> = [];
  for (const t of BAG_TOPICS) {
    // ONE sentence per topic. Extending to an adjacent matching sentence
    // pulled bc-place's "Bicycles can be stored at the Bike Valet" into its
    // bag-storage answer.
    const q = quoteMatching(prose, t.re, 1);
    if (!q) continue;
    const same = groups.find((g) => g.quote.text === q.text && g.quote.sourceUrl === q.sourceUrl);
    if (same) same.topics.push(t.key);
    else groups.push({ topics: [t.key], quote: q });
  }
  return groups.map((g) => {
    const question =
      g.topics.length === 1 && g.topics[0] === 'storage'
        ? `Is there bag storage at ${v}?`
        : `What is the ${joinList(g.topics.map((k) => TOPIC_BY_KEY[k].noun))} policy at ${v}?`;
    // t-mobile-park: the storage sentence cites a page that does not carry it.
    const linkHeld = g.topics.includes('storage') && bagFieldHeld(hub.slug, 'storageAnswerLink');
    return { topics: g.topics, question, answer: g.quote.text, sourceUrl: linkHeld ? undefined : g.quote.sourceUrl, quote: g.quote };
  });
}

// ── the answer block model ───────────────────────────────────────────────────

export interface BagAnswerModel {
  /** "No bags allowed", or the size limit line. */
  headline: string;
  sizeLimit: string | null;
  /** Rendered only when clearBagRequired is sourced, and not on a no-bag
   *  building, where "a clear bag is not required" would read as permission. */
  clearLine: string | null;
  /** First sentences of the building notes, verbatim. */
  lead: Quote | null;
  /** The clutch sentence, verbatim, when it is not already inside `lead`. */
  clutch: Quote | null;
  /** "Nov 3, 2026" from a bag field's observedAtByField; never verifiedAt. */
  lastVerified: string | null;
  /** The page carrying the block's facts. */
  sourceUrl: string | null;
}

export function bagAnswerModel(hub: Hub): BagAnswerModel | null {
  if (!isBagAnswerEligible(hub)) return null;
  const f = sourcedBagFacts(hub);
  const prose = sourcedBagProse(hub);
  const lead = leadQuote(prose, 2);
  const clutchQ = quoteMatching(prose, TOPIC_BY_KEY.clutch.re, 1);
  const clutch =
    clutchQ && !(lead && clutchQ.field === lead.field && clutchQ.start >= lead.start && clutchQ.end <= lead.end) ? clutchQ : null;
  const headline = f.prohibited ? 'No bags allowed' : `Max bag size: ${f.sizeLimit}`;
  const clearLine = f.prohibited || f.clear === null ? null : f.clear ? 'Clear bag required.' : 'A clear bag is not required.';
  // Date of a field the block actually shows, in display order.
  const shown: Array<Parameters<typeof claimSourceReadOn>[1]> = [
    ...(lead ? (['bagPolicyNotes'] as const) : []),
    ...(f.sizeLimit ? (['bagMaxDimensions'] as const) : []),
    ...(f.prohibited ? (['bagsProhibited'] as const) : []),
    ...(clearLine ? (['clearBagRequired'] as const) : []),
  ];
  let lastVerified: string | null = null;
  for (const field of shown) {
    lastVerified = claimSourceReadOn(hub, field);
    if (lastVerified) break;
  }
  const sourceUrl =
    lead?.sourceUrl ??
    (f.sizeLimit ? claimSourceUrl(hub, 'bagMaxDimensions') : null) ??
    (f.prohibited ? claimSourceUrl(hub, 'bagsProhibited') : null) ??
    claimSourceUrl(hub, 'clearBagRequired');
  return { headline, sizeLimit: f.sizeLimit, clearLine, lead, clutch, lastVerified, sourceUrl };
}
