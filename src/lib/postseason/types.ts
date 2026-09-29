// The bracket as the web holds it on the server. Types only.
//
// This is NOT the stored document. The stored document also carries
// operatorLog, source, runId, seeds, three hashes and the unplaced list, none
// of which has a field here, so none of them can be passed along by accident.
// The mapper in ./map.ts is the only thing that builds these values.
//
// It is not what a page renders either. A Bracket still holds the pipeline's
// series keys ("AL-WC-B"), which are keys and not copy. The view in
// ./view.ts is what reaches markup, and it carries no series key at all.

export type PostseasonLeague = 'MLB' | 'WNBA';

export type SeriesStatus = 'upcoming' | 'live' | 'final';

export type GameStatus =
  | 'scheduled'
  | 'live'
  | 'suspended'
  | 'postponed'
  | 'cancelled'
  | 'final';

export type Side = 'higher' | 'lower';

export interface ClubSlot {
  kind: 'club';
  slug: string;
  seed: number | null;
}

export interface PlaceholderSlot {
  kind: 'placeholder';
  /** The text to show for the slot. It is the stored label, verbatim, unless
   *  the stored label held a series key: a key is never text, so the mapper
   *  replaces such a label before it gets here (see ./map.ts). */
  label: string;
  seed: number | null;
  /** The two clubs that can still fill the slot, when the document names
   *  exactly two. Null otherwise. */
  candidates: [string, string] | null;
}

// There is no field for the feeder series key, on purpose. The mapper reads
// it, uses it, and drops it: a slot whose feeder is already decided comes out
// of the mapper as a ClubSlot holding the winner, and any other slot comes
// out with no trace of the key. What is not on the type cannot be serialized.

export type BracketSlot = ClubSlot | PlaceholderSlot;

export interface BracketGame {
  gameNumber: number;
  /** Official date, YYYY-MM-DD. The only date to show when the time is TBD. */
  date: string | null;
  /** Start instant, ISO 8601. Null when absent or unparseable. */
  start: string | null;
  startTimeTBD: boolean;
  /** Which side hosts. Null when the row does not agree with its series. */
  homeSide: Side | null;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  winnerSide: Side | null;
  ifNecessary: boolean;
}

export interface BracketSeries {
  round: string;
  /** Full round label from the pipeline's format file. */
  roundLabel: string;
  /** Short round label, when the pipeline publishes one. */
  shortLabel: string | null;
  seriesKey: string;
  conference: string | null;
  bestOf: number;
  higher: BracketSlot;
  lower: BracketSlot;
  wins: { higher: number; lower: number };
  status: SeriesStatus;
  winnerSide: Side | null;
  games: BracketGame[];
}

export interface Bracket {
  league: PostseasonLeague;
  season: number;
  /** When the bracket last changed, ISO 8601. */
  lastChangedAt: string | null;
  series: BracketSeries[];
}

export type BracketRead =
  | { state: 'ok'; bracket: Bracket }
  /** No document for this league and season. */
  | { state: 'missing' }
  /** The read failed, or the document is not in the shape the web understands. */
  | { state: 'unavailable' };
