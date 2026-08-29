// The `venues` corpus stops asserting transit and gate times.
//
// WHY. A 20-doc stratified sample of the generated plan-your-visit batch was
// verified against transit operators on 2026-08-29
// (audit/venues-batch-provenance-audit.md). publicTransit was defective in 16
// of 20, which is 78.9% excluding the blind control. gatesOpen made 17 claims:
// 9 true, 5 FALSE, 3 unverifiable. All 20 sampled strings were byte-identical
// to live Firestore, so that is what was being served.
//
// The defects are GENERATED, not stale, and the distinction decides the remedy.
// At least 11 of the 16 assert something that was never true on any date: an
// unassigned STM route number, UTA lines named by termini when UTA names by
// colour, the Providence Line stopping at a station literally named
// Franklin/Foxboro, a Charlotte station named after the stadium that appears on
// no CATS roster. A re-verification cadence repairs staleness. It cannot repair
// a fact that never had a source to refresh against.
//
// So this is not a per-doc fix. Fixing per doc means rewriting 15 of 19, and
// afterwards nothing in the record distinguishes a rewritten doc from an
// original one, because the corpus carries no provenance at all. The corpus is
// the defect.
//
// WHAT THIS DOES. `gatesOpen` and `publicTransit` are removed from the `Venue`
// type, so the compiler prevents any consumer from reading them and no gate can
// be forgotten at one of the two duplicated mapping sites. Firestore is NOT
// touched: the strings stay exactly as stored, for a future rebuild that
// re-enables them per field, per venue, only where a live-verified operator
// source URL exists, using the pointer-versus-claim gating already shipped for
// venueHubs.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not silence `bagPolicyUrl`. That
// field is a POINTER, not a claim: rendering a link asserts nothing about the
// building, so it gates on reachability. Every live stored bag URL returns 200.
// See BAG_URL_REPOINTS for the seven that resolved onto a page carrying no bag
// policy at all and were repointed at the deeper page the operator publishes.
//
// This module imports nothing on purpose; it is read by both mapping sites.

/** A `nearby` sentence that measures from a transit entity the same doc invented. */
export interface NearbySilence {
  /** `venues` doc id. */
  slug: string;
  reason: string;
}

// Silencing publicTransit alone leaves these standing, because they do not
// merely mention a transit entity, they COUNT FROM one. A fabricated primitive
// propagates into whatever was derived from it.
export const NEARBY_SILENCED: ReadonlyArray<NearbySilence> = [
  {
    slug: 'bank-of-america-stadium',
    reason: 'Places the South End neighbourhood "two to three stops south" along the LYNX Blue Line, counted from the "Bank of America Stadium Station" the same record invents. CATS publishes a complete roster ("CATS has 26 stations") and names all 26; none is at the stadium under any name, and the nearest platform is Brooklyn Village at about 0.46 mi. With no origin station the stop count measures from nothing.',
  },
  {
    slug: 'entertainment-sports-arena',
    reason: 'Locates the neighbourhood "three stops north" on the Green Line, a distance that is only meaningful given this record\'s own transit sentence. That sentence is a near-verbatim paraphrase of the Mystics game-day page, including that page\'s stale phone number, with a Lyft partnership added that appears on neither source. The stop count inherits an origin we cannot stand behind.',
  },
  {
    slug: 'citi-field',
    reason: 'Describes Downtown Flushing as "one stop east on the 7", a claim that reads as a fact about the subway rather than about the neighbourhood. The 7 and the origin are correct here, but the sentence is a derived transit claim published on a surface where every other transit claim has been withdrawn, and leaving it makes the corpus look selectively trustworthy.',
  },
];

const NEARBY = new Set(NEARBY_SILENCED.map((n) => n.slug));

/** True when this doc's `nearby` text must not render. */
export function nearbySilenced(venueSlug: string): boolean {
  return NEARBY.has(venueSlug);
}

/** A bag pointer moved from a hub page to the page that carries the policy. */
export interface BagRepoint {
  url: string;
  replaces: string;
  /** ISO date the replacement was fetched and confirmed to carry a bag policy. */
  verifiedOn: string;
  note: string;
}

// NOT a reachability fix. Every live stored bag URL returns 200; the "7 hard
// 404s" in the sampling pass were against the SEED FILE, and the writer script
// says in its own header that dead links were curl-replaced afterwards, so that
// finding never described production. These seven resolve to a hub or landing
// page that carries no bag policy, which makes the link a dead end rather than
// a broken one. Each replacement was fetched on the date below and confirmed to
// carry actual bag-policy text.
//
// amalie-arena is deliberately absent: its stored URL is reachable, its own
// domain fails to resolve, and the operator's pages are client-rendered so a
// fetch cannot confirm a better target. Contested with no confident source, so
// it is left alone rather than guessed at.
export const BAG_URL_REPOINTS: Readonly<Record<string, BagRepoint>> = {
  'bmo-field': {
    url: 'https://www.bmofield.com/plan-your-visit/bag-policy/',
    replaces: 'https://www.bmofield.com/plan-your-visit',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is the plan-your-visit hub; the operator publishes the policy one level deeper.',
  },
  'geodis-park': {
    url: 'https://geodispark.com/stadium-policies/',
    replaces: 'https://www.nashvillesc.com/geodispark/know-before-you-go',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is a club know-before-you-go page; the venue publishes its own policies page.',
  },
  'allianz-field': {
    url: 'https://www.allianzfield.com/plan-your-visit/policies',
    replaces: 'https://www.mnufc.com/stadium',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is the club stadium landing page, carrying no policy text.',
  },
  'bc-place': {
    url: 'https://www.bcplace.com/clear-bag-policy/',
    replaces: 'https://www.whitecapsfc.com/matchday',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is a club matchday hub with zero bag language; the venue publishes a dedicated clear-bag page.',
  },
  'bank-of-america-stadium': {
    url: 'https://www.bankofamericastadium.com/stadium/clear-bag.html',
    replaces: 'https://www.bankofamericastadium.com/',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is the venue home page; the clear-bag page is linked from its own nav.',
  },
  'american-family-field': {
    url: 'https://www.mlb.com/brewers/ballpark/security',
    replaces: 'https://www.mlb.com/brewers/ballpark/information',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is the ballpark information index, carrying no bag language.',
  },
  'busch-stadium': {
    url: 'https://www.mlb.com/cardinals/ballpark/security',
    replaces: 'https://www.mlb.com/cardinals/ballpark/information',
    verifiedOn: '2026-08-29',
    note: 'Stored URL is the ballpark information index, carrying no bag language.',
  },
};

/**
 * The bag link to publish for this building.
 *
 * Takes precedence over the stored value on purpose. The existing
 * venue-overrides merge is `stored ?? override`, which fills a gap but can
 * never replace a populated value, so it cannot repoint a live dead end.
 */
export function bagPolicyUrlFor(venueSlug: string, stored: string | undefined): string | undefined {
  return BAG_URL_REPOINTS[venueSlug]?.url ?? stored;
}


// ── Cross-class claims, and clauses that expired ────────────────────────────
//
// FIELD-SCOPED SILENCING GATES A FIELD, NOT A CLAIM CLASS. Madison Square
// Garden's parkingInfo ended "Transit is the better call here, since the arena
// sits directly above Penn Station": a transit assertion that survived the
// transit silencing because it lives in the parking field. A sweep of both
// corpora for that shape is in audit/venues-cross-class-claims.md.
//
// A redaction removes ONE clause and leaves the rest of the field standing. It
// is deliberately fail-safe: if the exact clause is no longer present, the
// stored text has drifted and we no longer know what we are editing, so the
// WHOLE field is withheld rather than republished. Silence on drift, never
// publish on drift.

export interface ClauseRedaction {
  /** `venues` or `venueHubs` doc id. */
  slug: string;
  /** The field the clause sits in. */
  field: string;
  /** Exact substring to remove. Must match byte for byte or the field is withheld. */
  clause: string;
  reason: string;
}

export const CLAUSE_REDACTIONS: ReadonlyArray<ClauseRedaction> = [
  {
    slug: 'madison-square-garden',
    field: 'parkingInfo',
    clause: ' Transit is the better call here, since the arena sits directly above Penn Station.',
    reason: 'A transit routing assertion inside the parking field, which is how it survived the corpus-wide transit silencing. The claim happens to be true, but it is the class of claim this site has withdrawn from the venues corpus, and leaving it makes the corpus look selectively trustworthy. The parking advice in the rest of the sentence stands on its own.',
  },
  {
    slug: 'dignity-health-sports-park',
    field: 'parkingLots',
    clause: '; passes were sold out for the 2025 season',
    reason: 'A sold-out notice for a season that has ended, read in the present tense. The pass price, the game count, the AXS purchase route and the matchday walk-up option are all unaffected by its removal.',
  },
  {
    slug: 'milan-puskar-stadium',
    field: 'parkingLots',
    clause: ' (sold out for the 2025 Utah game)',
    reason: 'A sold-out notice for a game that has been played. The lot, its location, single-game availability and the bus/RV prohibition all stand without it.',
  },
  {
    slug: 'kidd-brewer-stadium',
    // Dotted, matching the sub-key convention the provenance maps already use.
    field: 'tailgating.timeWindow',
    clause: ' For the Nov. 6, 2025 game against Georgia Southern the lots opened at 4 p.m.',
    reason: 'A worked example from a game that has been played, frozen into guidance. The general rule and the value\'s own caveat that "tailgating times change with kickoff times as they are announced" are the durable part.',
  },
];

const REDACTIONS = new Map(CLAUSE_REDACTIONS.map((r) => [`${r.slug}\u0000${r.field}`, r]));

/**
 * The text to publish for this field, or null when it must be withheld.
 *
 * Returns the stored text unchanged when no redaction applies. When one does
 * and the clause is present, returns the text without it. When one does and the
 * clause is ABSENT, returns null: the stored value drifted out from under an
 * edit we can no longer verify, and withholding is the safe direction.
 */
export function redactClause(slug: string, field: string, stored: string | null | undefined): string | null {
  const text = typeof stored === 'string' ? stored : null;
  const r = REDACTIONS.get(`${slug}\u0000${field}`);
  if (!r) return text;
  if (text === null) return null;
  if (!text.includes(r.clause)) return null;
  const out = text.replace(r.clause, '').replace(/\s{2,}/g, ' ').trim();
  return out.length > 0 ? out : null;
}
