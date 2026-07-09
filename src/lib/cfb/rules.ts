// Derived-field gates (build spec §4, failure mode #2).
//
// These fields are NEVER extracted from a source — they are computed by rule.
// The spike caught two derived-field hallucinations the extractor rated HIGH:
//   - Notre Dame's North Carolina game falsely flagged conferenceGame=yes
//     (ND is independent → zero conference games).
//   - Notre Dame week numbers off-by-one (the extractor double-counted the bye).
// Both are eliminated by computing, not reading.

// 2026 conference membership — the rule's source of truth. Season-scoped on
// purpose (realignment). Keys are CANONICAL slugs (slugifySchool of the common
// name); normalize opponent slugs via SLUG_ALIASES before lookup. Covers all 86
// source-map schools accurately + their common FBS opponents. UNKNOWN opponents
// fall through gateConferenceGame's safe default (non-conference) — an omission
// under-tags a conference game (transparent in the gate) but never mis-asserts
// one. Extend as new opponents surface. (Same opponent gates differently per
// school: Washington State is Pac-12, a conference game for Boise but not for
// Kansas State — gated by rule, not read from either page.)
export const CONFERENCE_2026: Record<string, string> = {
  // ── SEC (16) ──
  alabama: 'SEC', georgia: 'SEC', lsu: 'SEC', tennessee: 'SEC', texas: 'SEC', oklahoma: 'SEC',
  auburn: 'SEC', florida: 'SEC', 'texas-am': 'SEC', 'ole-miss': 'SEC', 'mississippi-state': 'SEC',
  arkansas: 'SEC', kentucky: 'SEC', 'south-carolina': 'SEC', missouri: 'SEC', vanderbilt: 'SEC',
  // ── Big Ten (18) ──
  'ohio-state': 'Big Ten', michigan: 'Big Ten', 'penn-state': 'Big Ten', oregon: 'Big Ten',
  usc: 'Big Ten', ucla: 'Big Ten', washington: 'Big Ten', wisconsin: 'Big Ten', nebraska: 'Big Ten',
  iowa: 'Big Ten', 'michigan-state': 'Big Ten', minnesota: 'Big Ten', illinois: 'Big Ten',
  indiana: 'Big Ten', maryland: 'Big Ten', rutgers: 'Big Ten', northwestern: 'Big Ten', purdue: 'Big Ten',
  // ── ACC (17) ──
  clemson: 'ACC', 'florida-state': 'ACC', miami: 'ACC', 'north-carolina': 'ACC', 'nc-state': 'ACC',
  virginia: 'ACC', 'virginia-tech': 'ACC', louisville: 'ACC', pittsburgh: 'ACC', duke: 'ACC',
  'wake-forest': 'ACC', 'georgia-tech': 'ACC', 'boston-college': 'ACC', syracuse: 'ACC',
  california: 'ACC', stanford: 'ACC', smu: 'ACC',
  // ── Big 12 (16) ──
  utah: 'Big 12', 'kansas-state': 'Big 12', 'oklahoma-state': 'Big 12', kansas: 'Big 12',
  baylor: 'Big 12', tcu: 'Big 12', 'texas-tech': 'Big 12', 'iowa-state': 'Big 12',
  cincinnati: 'Big 12', ucf: 'Big 12', houston: 'Big 12', byu: 'Big 12', 'west-virginia': 'Big 12',
  arizona: 'Big 12', 'arizona-state': 'Big 12', colorado: 'Big 12',
  // ── Independent ──
  'notre-dame': 'Independent', uconn: 'Independent',
  // ── Pac-12 (rebuilt 2026: WSU/OSU + adds) ──
  'boise-state': 'Pac-12', 'fresno-state': 'Pac-12', 'san-diego-state': 'Pac-12',
  'washington-state': 'Pac-12', 'oregon-state': 'Pac-12', 'utah-state': 'Pac-12',
  'colorado-state': 'Pac-12', 'texas-state': 'Pac-12',
  // ── AAC ──
  memphis: 'AAC', army: 'AAC', navy: 'AAC', tulane: 'AAC', 'south-florida': 'AAC',
  'east-carolina': 'AAC', temple: 'AAC', tulsa: 'AAC', 'north-texas': 'AAC', charlotte: 'AAC',
  'florida-atlantic': 'AAC', uab: 'AAC', rice: 'AAC', utsa: 'AAC',
  // ── Sun Belt ──
  'appalachian-state': 'Sun Belt', 'james-madison': 'Sun Belt', 'coastal-carolina': 'Sun Belt',
  marshall: 'Sun Belt', 'georgia-southern': 'Sun Belt', 'georgia-state': 'Sun Belt', troy: 'Sun Belt',
  'south-alabama': 'Sun Belt', louisiana: 'Sun Belt', 'louisiana-monroe': 'Sun Belt',
  'arkansas-state': 'Sun Belt', 'old-dominion': 'Sun Belt', 'southern-miss': 'Sun Belt',
  // ── Mountain West ──
  'air-force': 'MWC', unlv: 'MWC', 'northern-illinois': 'MWC', wyoming: 'MWC', nevada: 'MWC',
  'new-mexico': 'MWC', 'san-jose-state': 'MWC', hawaii: 'MWC', utep: 'MWC',
  // ── MAC ──
  toledo: 'MAC', akron: 'MAC', 'ball-state': 'MAC', 'bowling-green': 'MAC', buffalo: 'MAC',
  'central-michigan': 'MAC', 'eastern-michigan': 'MAC', 'kent-state': 'MAC', 'miami-oh': 'MAC',
  ohio: 'MAC', 'western-michigan': 'MAC', umass: 'MAC',
  // ── Conference USA ──
  liberty: 'CUSA', 'jacksonville-state': 'CUSA', 'sam-houston': 'CUSA', 'new-mexico-state': 'CUSA',
  'western-kentucky': 'CUSA', 'middle-tennessee': 'CUSA', 'louisiana-tech': 'CUSA', 'kennesaw-state': 'CUSA',
  // ── FCS / common non-FBS (non-conference for any FBS school) ──
  furman: 'FCS', nicholls: 'FCS', 'south-dakota': 'FCS',
};

/** Lowercase, hyphenate, strip punctuation. "Texas A&M" -> "texas-am". */
export function slugifySchool(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[.'']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * conferenceGame gate. NEVER read from a source.
 * - null when EITHER school is independent (an independent plays zero
 *   conference games — Notre Dame).
 * - true when both schools share a (non-independent) conference for the season.
 * - false otherwise (cross-conference, or opponent not in the membership table
 *   → treated as non-conference).
 */
export function gateConferenceGame(
  homeSchoolId: string,
  awaySchoolId: string,
  table: Record<string, string> = CONFERENCE_2026,
): boolean | null {
  const home = table[homeSchoolId];
  const away = table[awaySchoolId];
  if (home === 'Independent' || away === 'Independent') return null;
  if (!home || !away) return false; // unknown opponent → non-conference
  return home === away;
}

/**
 * Compute week numbers for one school's season. Week = the team's game ordinal
 * by date (1..N). Byes are NOT games, so they never consume a week number —
 * which is exactly what stops the off-by-one the extractor produced by
 * double-counting Notre Dame's bye. Deterministic and bye-robust.
 *
 * Input: games with a `date` (YYYY-MM-DD). Returns the same array, sorted by
 * date, each annotated with `week`.
 */
export function computeWeeks<T extends { date: string }>(games: T[]): (T & { week: number })[] {
  return [...games]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((g, i) => ({ ...g, week: i + 1 }));
}

/** Convenience: is this school independent for the season? */
export function isIndependent(schoolId: string, table: Record<string, string> = CONFERENCE_2026): boolean {
  return table[schoolId] === 'Independent';
}
