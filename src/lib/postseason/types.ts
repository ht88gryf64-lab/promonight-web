// The bracket as the web holds it. Types only: safe to import from a client
// component, and everything here is what a client component may receive.
//
// This is NOT the stored document. The stored document also carries
// operatorLog, source, runId, seeds, three hashes and the unplaced list, none
// of which has a field here, so none of them can be passed along by accident.
// The mapper in ./map.ts is the only thing that builds these values.

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
  /** The feed's own label for the slot, stored verbatim. */
  label: string;
  seed: number | null;
  /** The series whose winner fills this slot, when the pipeline publishes it. */
  feederSeriesKey: string | null;
  /** The two clubs that can still fill the slot, when the pipeline publishes
   *  them. Both present or null: a half-populated pair is dropped whole. */
  candidates: [string, string] | null;
}

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
