// CFB stream schema — the five Firestore collections (build spec §3).
//
// LOCKED DECISIONS (do not "simplify" these away):
// 1. `CfbGame` is FORKED from the repo `Game` type. This file imports NOTHING
//    from ../types. CFB realignment churn / neutral sites / flex-finale quirks
//    stay out of the type the pro pages depend on. The ~20% duplication is the
//    point.
// 2. Conference is season-scoped: `conferenceBySeason` map, never a flat field.
//    (Boise is Pac-12 for 2026, not Mountain West.)
// 3. `CfbTradition` is top-level, not a school subcollection (homepage rail
//    needs cross-school "all whiteouts this week" queries).
// 4. `CfbRivalry` is relational (`schoolIds[]`), persists when dormant, and
//    splits `seriesStartYear` from `trophyCreatedYear` (verify pass caught the
//    conflation).
// 5. `CfbGame.verified` defaults to false and gates production display.

export type CfbEditorialStatus = 'auto' | 'destination';

/** Honest confidence the schedule parser self-assigns. Treated as UNVERIFIED
 *  until the verify pass independently confirms — the rating carries no signal
 *  on its own (build spec §4). */
export type CfbConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NF';

// ── cfbSchools/{schoolId} ────────────────────────────────────────────────────
export interface CfbSchool {
  id: string; // slug: "tennessee", "kansas-state", "notre-dame", "boise-state"
  name: string;
  shortName: string;
  mascot: string;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  colorsSource: string;
  // Season-scoped. Key = season year string. Value = conference name or
  // "Independent". NEVER collapse to a flat `conference` field.
  conferenceBySeason: Record<string, string>;
  venueId: string;
  traditionIds: string[]; // refs into cfbTraditions
  editorialStatus: CfbEditorialStatus; // gates page treatment ("auto" until editorial lands)
  updatedAt: string; // ISO
}

// ── cfbVenues/{venueId} ──────────────────────────────────────────────────────
export interface CfbVenue {
  id: string;
  name: string;
  city: string;
  state: string;
  capacity: number; // CFB needs this; repo Venue has no capacity field
  // Capacity audit trail (backfill pass): populated only when 2 independent
  // sources (Wikipedia infobox + an official athletics/stadium page) corroborate
  // the figure. Same 2-source discipline as rivalry tags — a wrong capacity on a
  // travel page is the venue-panel equivalent of a wrong kickoff.
  capacityVerified?: boolean;
  capacitySources?: string[]; // [wikipediaUrl, officialUrl]
  capacityVerifiedAt?: string; // ISO
  lat: number;
  lng: number;
  // Coordinate audit trail (backfill pass): populated only when 2 independent
  // sources (Wikipedia article coord + OpenStreetMap) agree within tolerance.
  // Wrong stadium coords send Expedia/SpotHero to the wrong place.
  coordsVerified?: boolean;
  coordsSources?: string[]; // [wikipediaUrl, osmUrl]
  coordsVerifiedAt?: string; // ISO
  homeSchoolId: string;
  sharedSchoolIds: string[];
  // Prose, editorial — populated in the editorial pass, not the pipeline.
  tailgating?: string;
  parking?: string;
  transit?: string;
  gatesOpenRule?: string;
  // Verify-gate (decision record §5): the pipeline PROPOSES the venue from the
  // Wikipedia infobox stadium hyperlink; an editor confirms it at destination time.
  // Never trusted for a destination page while false. `proposedFrom` records how
  // it was resolved (season-infobox / program-infobox hyperlink).
  humanConfirmed?: boolean;
  proposedFrom?: string;
  source: string;
  updatedAt: string;
}

// ── cfbGames/{gameId} ────────────────────────────────────────────────────────
// gameId convention: `{season}-w{week}-{homeSchoolId}-{awaySchoolId}`
//   e.g. "2026-w5-tennessee-texas"

export interface CfbKickoff {
  time: string; // 24h "HH:MM" in the stated tz, or "TBD"
  tz: string; // IANA tz of the HOME venue, e.g. "America/Boise". Never convert blind.
  tbd: boolean;
  windowFlex: string | null; // e.g. "3:30-4:30 or 6-8pm" when only a window is announced
}

export interface CfbBroadcast {
  network: string; // or "TBD"
  confirmed: boolean; // false until officially announced
}

export interface CfbThemeDesignation {
  traditionId: string | null; // ref into cfbTraditions (null until editorial seeds it)
  displayName: string; // e.g. "Checker Neyland"
  source: string;
  confidence: CfbConfidence;
  announcedAt: string | null; // ISO date of the official announcement, or null
}

/** The independent-verify trail. Produced ONLY by the verify stage from a
 *  blind re-fetch + diff. Not written by the parser. */
export interface CfbVerification {
  verifiedAt: string; // ISO
  verdict: 'verified' | 'downgraded' | 'flagged-for-human';
  // Per-guard outcome (build spec §4). true = guard passed / no problem.
  guards: {
    timezone: boolean;
    derivedFields: boolean;
    entityConflation: boolean;
    secondSource: boolean;
    citation: boolean;
  };
  flags: string[]; // human-readable mismatch descriptions
  sourcesChecked: string[]; // URLs the verify stage independently fetched
}

export interface CfbGame {
  id: string;
  season: number;
  week: number; // COMPUTED by rule from the schedule (game ordinal by date), never read
  date: string; // YYYY-MM-DD (home-venue local)
  status: 'scheduled' | 'completed' | 'canceled';
  homeSchoolId: string;
  awaySchoolId: string;
  neutralSite: boolean;
  venueId: string;
  kickoff: CfbKickoff;
  broadcast: CfbBroadcast;
  // HARD-GATED by rule, not extracted. null for any independent school.
  conferenceGame: boolean | null;
  rivalryId: string | null;
  themeDesignations: CfbThemeDesignation[];
  // Provenance — REQUIRED on every parser row (build spec §7).
  source: string; // URL the row was extracted from
  confidence: CfbConfidence; // parser self-rating (UNVERIFIED until verify confirms)
  fetchedAt: string; // ISO
  // Verify contract.
  verified: boolean; // false until independent pass confirms; gates production display
  verification: CfbVerification | null;
}

// ── cfbRivalries/{rivalryId} ─────────────────────────────────────────────────
export interface CfbRivalry {
  id: string;
  name: string; // "Sunflower Showdown"
  schoolIds: string[]; // ["kansas-state", "kansas"] — array-contains "rivalries for X"
  trophy: string | null;
  seriesStartYear: number; // SPLIT from trophy creation
  trophyCreatedYear: number | null; // SPLIT — never conflate with seriesStartYear
  dormant: boolean; // persist even when not played in a given season
  narrative?: string; // editorial
  source: string;
  updatedAt: string;
}

// ── cfbTraditions/{traditionId} ──────────────────────────────────────────────
export interface CfbTradition {
  id: string;
  schoolId: string;
  name: string; // "Checker Neyland"
  kind: 'themeGame' | 'rivalry' | 'entrance' | 'other';
  dressCode: string | null;
  narrative?: string; // editorial
  recurring: boolean;
  editoriallySeeded: boolean;
  source: string;
  updatedAt: string;
}

// Firestore collection names (single source of truth for the stream).
export const CFB_COLLECTIONS = {
  schools: 'cfbSchools',
  venues: 'cfbVenues',
  games: 'cfbGames',
  rivalries: 'cfbRivalries',
  traditions: 'cfbTraditions',
} as const;
