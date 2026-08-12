// Per-page meta descriptions for the 32 rivalry matchup pages.
//
// WHY THIS EXISTS: generateMetadata returned only a title, so all 32 inherited
// the root default, which names MLB, NBA, NFL, NHL, MLS and WNBA, mentions no
// college football at all, and ends on bobbleheads. That was the snippet Google
// would show for a college football query.
//
// Pure and Firestore-free: it takes a flat input the route already has, so the
// character budget and both shapes are unit-testable without the corpus.
//
// Two shapes, because half the corpus has no announced kickoff:
//   announced -> date, kickoff and venue lead
//   TBA       -> date and venue lead, and the description SAYS the kickoff is
//                not set rather than quietly omitting it
//
// House rule: no em dashes in user-facing copy. Stadium names legitimately
// contain EN dashes (Bryant-Denny, Vaught-Hemingway, Rice-Eccles); those are the
// buildings' real names and pass through untouched.

/** Google truncates around 160. The brief's window is 140 to 160. */
export const DESC_MAX = 160;
export const DESC_MIN = 140;

export interface MatchupDescriptionInput {
  /** Registry override, else the rivalry name. Same value the H1 and title use. */
  displayName: string;
  /** Both sides, already resolved to display names. An untracked school (Apple
   *  Cup's Washington State) still has a name here, from its id. */
  schoolA: string;
  schoolB: string;
  /** ISO date of the 2026 meeting, or null when the rivalry is dormant. */
  date: string | null;
  /** Rendered kickoff ("3:30 PM ET"), or null when it is not announced. */
  kickoff: string | null;
  /** Clean venue name. Never the raw scraped field. */
  venueName: string | null;
  /** Clean city from CFB_VENUE_CITY or venueHubs. Never the raw scraped field. */
  venueCity: string | null;
}

/** "washington-state" -> "Washington State". The one place this lives, so the
 *  description and the page agree on how an untracked school is named. */
export function prettySchoolId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function longDate(iso: string): string {
  // Noon avoids the UTC rollover that would shift the weekday a day west.
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Alabama vs Auburn in the Iron Bowl", but "Florida vs Georgia" alone when the
 *  display name is already the pairing, and "in The Game" rather than
 *  "in the The Game" when the name carries its own article. */
function matchupPhrase(displayName: string, a: string, b: string): string {
  if (/\bvs\b/i.test(displayName)) return displayName;
  const article = /^the\b/i.test(displayName) ? '' : 'the ';
  return `${a} vs ${b} in ${article}${displayName}`;
}

function venuePhrase(name: string | null, city: string | null): string | null {
  if (!name) return null;
  return city ? `${name} in ${city}` : name;
}

/** The longest candidate that fits the budget. Longest-first rather than the
 *  shortest-that-fits used elsewhere, because an over-short description wastes
 *  the snippet just as surely as an over-long one gets cut.
 *
 *  This NEVER truncates: a mid-word cut reads as broken and would misstate a
 *  fact. Each chain therefore has to end with a tier that always fits, which is
 *  why the last tiers drop the school names and then the venue rather than
 *  shortening any of them. If every tier is over budget the last one is returned
 *  intact, so an over-long description is visible in the audit rather than
 *  silently mangled. */
function longestFit(cands: string[], max: number): string {
  for (const c of cands) if (c.length <= max) return c;
  return cands[cands.length - 1];
}

export function buildMatchupDescription(input: MatchupDescriptionInput): string {
  const { displayName, schoolA, schoolB, date, kickoff, venueName, venueCity } = input;
  const matchup = matchupPhrase(displayName, schoolA, schoolB);
  const place = venuePhrase(venueName, venueCity);
  const when = date ? longDate(date) : null;

  // Dormant rivalry: no 2026 meeting, so claim no date and no venue.
  if (!when) {
    return longestFit(
      [
        `${matchup}. The rivalry has no scheduled 2026 meeting. Series history, past results and how to plan the trip when the game returns.`,
        `${matchup}. No 2026 meeting is scheduled. Series history and how to plan the trip when the game returns.`,
        `${matchup}. No 2026 meeting is scheduled.`,
        `${displayName}. No 2026 meeting is scheduled.`,
      ],
      DESC_MAX,
    );
  }

  if (kickoff) {
    return longestFit(
      [
        `${matchup} is ${when}. Kickoff ${kickoff}${place ? ` at ${place}` : ''}. Tickets, parking, hotels and what to know before you go.`,
        `${matchup} is ${when}. Kickoff ${kickoff}${place ? ` at ${place}` : ''}. Tickets, parking and hotels for the trip.`,
        `${matchup} is ${when}. Kickoff ${kickoff}${place ? ` at ${place}` : ''}. Tickets, parking and hotels.`,
        `${matchup}: ${when}, ${kickoff}${place ? `, ${place}` : ''}. Tickets, parking and hotels.`,
        `${matchup}: ${when}, ${kickoff}${place ? `, ${place}` : ''}.`,
        // Degradation tiers for a pathologically long pairing: drop the school
        // names, then the venue. None of the 32 reaches these.
        `${displayName}: ${when}, ${kickoff}${place ? `, ${place}` : ''}.`,
        `${displayName}: ${when}, ${kickoff}.`,
      ],
      DESC_MAX,
    );
  }

  // Kickoff not announced. State it rather than omitting it, so the description
  // does not read as though we simply failed to list a time.
  return longestFit(
    [
      `${matchup} is ${when}${place ? ` at ${place}` : ''}. Kickoff time is not announced yet. Tickets, parking, hotels and what to know before you go.`,
      `${matchup} is ${when}${place ? ` at ${place}` : ''}. Kickoff time is not announced yet. Tickets, parking and hotels for the trip.`,
      `${matchup} is ${when}${place ? ` at ${place}` : ''}. Kickoff is not announced yet. Tickets, parking and hotels.`,
      // "Kickoff time TBA" is the page's own verbatim wording, and shortening the
      // clause here rather than dropping the value tail is what keeps the long
      // pairings (Clemson vs South Carolina, Virginia vs Virginia Tech) inside
      // the window instead of falling to a bare 132-character stub.
      `${matchup} is ${when}${place ? ` at ${place}` : ''}. Kickoff time TBA. Tickets, parking and hotels.`,
      `${matchup} is ${when}${place ? ` at ${place}` : ''}. Kickoff TBA. Tickets, parking and hotels.`,
      `${matchup}: ${when}${place ? `, ${place}` : ''}. Kickoff TBA. Tickets and parking.`,
      `${matchup}: ${when}${place ? `, ${place}` : ''}. Kickoff not announced yet. Tickets, parking and hotels.`,
      `${matchup}: ${when}${place ? `, ${place}` : ''}. Kickoff not announced yet.`,
      `${displayName}: ${when}${place ? `, ${place}` : ''}. Kickoff not announced yet.`,
      `${displayName}: ${when}. Kickoff not announced yet.`,
    ],
    DESC_MAX,
  );
}
