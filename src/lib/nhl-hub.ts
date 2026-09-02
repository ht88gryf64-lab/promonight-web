// NHL hub helpers. Pure, so the card copy is testable without Firestore.

// Team-card subtitle on the /nhl hub. The count is upcoming visible promos
// (today onward) from getLeagueUpcomingPromoCounts, which is the one number a
// fan can act on and the one the site can back without a season definition
// (the web repo has no NHL season window; the season straddles the calendar
// year, so "this season" would need a spine join the way NFL does it).
//
// ZERO IS COPY, NEVER A NUMBER. A card must not read "0 promos": on a hub
// where 14 of 32 clubs are at zero today (9 waiting on their slate, 5 withheld
// by the scanner), a wall of zeros reads as a broken page rather than as
// information. The zero line says what the site has, not what the club has
// done ("not announced yet" would be a claim about the club that the data
// cannot back; four of the nine pending clubs published between the last scan
// and 2026-09-01). Pending and withheld clubs get the same line, because a fan
// does not care why.
export function nhlClubCardSubtitle(upcoming: number): string {
  if (upcoming <= 0) return 'No upcoming promos listed yet';
  return upcoming === 1 ? '1 upcoming promo' : `${upcoming} upcoming promos`;
}
