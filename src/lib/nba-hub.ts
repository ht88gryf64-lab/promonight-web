// NBA hub helpers. Pure, so they are testable without Firestore.

// NBA division -> conference band on the /nba team grid. Northwest, Pacific and
// Southwest are Western; Atlantic, Central and Southeast are Eastern. Matched by
// name rather than a closed list so a team doc that ever carries the conference
// ('Western') instead of the division still lands in the right band; any string
// the grid does not know is appended as its own group by getLeagueTeamsGrouped,
// never dropped.
export function nbaConferenceOf(division: string): 'Eastern' | 'Western' {
  return /west|pacific/i.test(division) ? 'Western' : 'Eastern';
}
