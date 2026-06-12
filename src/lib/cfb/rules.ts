// Derived-field gates (build spec §4, failure mode #2).
//
// These fields are NEVER extracted from a source — they are computed by rule.
// The spike caught two derived-field hallucinations the extractor rated HIGH:
//   - Notre Dame's North Carolina game falsely flagged conferenceGame=yes
//     (ND is independent → zero conference games).
//   - Notre Dame week numbers off-by-one (the extractor double-counted the bye).
// Both are eliminated by computing, not reading.

// 2026 conference membership — the rule's source of truth. Covers the 4 spike
// schools and every opponent on their 2026 schedules. Season-scoped on purpose
// (Washington State is Pac-12 here, so it is a CONFERENCE game for Boise but a
// NON-conference game for Kansas State — the same opponent, gated correctly by
// rule rather than read from either school's page).
export const CONFERENCE_2026: Record<string, string> = {
  // SEC
  tennessee: 'SEC', texas: 'SEC', auburn: 'SEC', arkansas: 'SEC', alabama: 'SEC',
  'south-carolina': 'SEC', kentucky: 'SEC', 'texas-am': 'SEC', lsu: 'SEC', vanderbilt: 'SEC',
  georgia: 'SEC', oklahoma: 'SEC', florida: 'SEC', 'ole-miss': 'SEC',
  // Big 12
  'kansas-state': 'Big 12', cincinnati: 'Big 12', houston: 'Big 12', kansas: 'Big 12',
  'arizona-state': 'Big 12', colorado: 'Big 12', 'oklahoma-state': 'Big 12', tcu: 'Big 12',
  arizona: 'Big 12', 'iowa-state': 'Big 12', utah: 'Big 12', byu: 'Big 12',
  // Pac-12 (rebuilt, 2026)
  'boise-state': 'Pac-12', 'utah-state': 'Pac-12', 'fresno-state': 'Pac-12',
  'washington-state': 'Pac-12', 'colorado-state': 'Pac-12', 'oregon-state': 'Pac-12',
  'san-diego-state': 'Pac-12',
  // Big Ten
  oregon: 'Big Ten', wisconsin: 'Big Ten', 'michigan-state': 'Big Ten', purdue: 'Big Ten',
  'ohio-state': 'Big Ten', michigan: 'Big Ten', 'penn-state': 'Big Ten', usc: 'Big Ten',
  nebraska: 'Big Ten',
  // ACC
  'georgia-tech': 'ACC', 'north-carolina': 'ACC', stanford: 'ACC', miami: 'ACC',
  'boston-college': 'ACC', smu: 'ACC', syracuse: 'ACC', clemson: 'ACC', 'florida-state': 'ACC',
  // AAC
  tulane: 'AAC', memphis: 'AAC', navy: 'AAC', rice: 'AAC',
  // Other G5 / FCS (non-conference for any Power-4 / Pac-12 school here)
  'kennesaw-state': 'CUSA', 'western-michigan': 'MAC', 'texas-state': 'Sun Belt',
  furman: 'FCS', nicholls: 'FCS', 'south-dakota': 'FCS',
  // Independent
  'notre-dame': 'Independent',
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
