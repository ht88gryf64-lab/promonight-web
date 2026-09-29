// The whitelisting mapper for postseasonBrackets documents. PURE.
//
// WHY A WHITELIST. A server component that hands a document to a client
// component serializes every field into the page, rendered or not (see
// CLAUDE.md and audit/rsc-payload-field-sweep.md). The stored bracket carries
// operatorLog, source, runId, seeds (with an author name), three hashes and
// the unplaced list. This mapper copies named fields one at a time and never
// spreads its input, so a field the pipeline adds tomorrow is dropped until
// someone names it here.
//
// WHY IT IS STRICT. The page states facts about real games. A document the
// mapper does not fully understand returns null and the page renders "bracket
// not available". It never renders the part it could read: a series with an
// unknown status, shown as if it were known, is a false claim.
import type {
  Bracket,
  BracketGame,
  BracketSeries,
  BracketSlot,
  GameStatus,
  PostseasonLeague,
  SeriesStatus,
  Side,
} from './types';

const SERIES_STATUSES: readonly SeriesStatus[] = ['upcoming', 'live', 'final'];
const GAME_STATUSES: readonly GameStatus[] = [
  'scheduled',
  'live',
  'suspended',
  'postponed',
  'cancelled',
  'final',
];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}
function wholeNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}
function side(v: unknown): Side | null {
  return v === 'higher' || v === 'lower' ? v : null;
}

/** A Firestore Timestamp, or a Date, as an ISO string. Anything else is null. */
function isoOf(v: unknown): string | null {
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (isObject(v) && typeof (v as { toDate?: unknown }).toDate === 'function') {
    try {
      d = (v as { toDate: () => Date }).toDate();
    } catch {
      d = null;
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** An instant string as the feed wrote it, normalized to ISO. MLB writes
 *  seconds ("2026-09-29T21:00:00Z"), ESPN does not ("2026-09-27T18:00Z"). */
function instantOf(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  // A bare date would parse as midnight UTC and render as the evening before
  // in ET. Only a full instant with a zone is a start time.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function mapSlot(v: unknown): BracketSlot | null {
  if (!isObject(v)) return null;
  const slug = text(v.slug);
  const label = text(v.placeholder);
  // Exactly one of the two. A slot that is both, or neither, is not a slot.
  if ((slug === null) === (label === null)) return null;
  let seed: number | null = null;
  if (v.seed !== null && v.seed !== undefined) {
    seed = wholeNumber(v.seed);
    if (seed === null || seed === 0) return null;
  }
  if (slug !== null) return { kind: 'club', slug, seed };

  // The feeder pair is optional and all-or-nothing. A malformed pair is not a
  // reason to refuse the document: the stored label still renders, which is
  // the behaviour before the pipeline published the pair at all.
  //
  // feederSeriesKey is CONSUMED here and never emitted. It is a key, not
  // copy. With no candidates beside it the slot shows its stored label,
  // whether or not the key is present.
  const feeder = text(v.feederSeriesKey);
  const pair = Array.isArray(v.candidates) ? v.candidates.map(text) : null;
  const pairOk =
    feeder !== null &&
    pair !== null &&
    pair.length === 2 &&
    pair[0] !== null &&
    pair[1] !== null &&
    pair[0] !== pair[1];
  return {
    kind: 'placeholder',
    label: label as string,
    seed,
    candidates: pairOk ? [pair![0] as string, pair![1] as string] : null,
  };
}

/** What a game row names for a slot: the slug, or the placeholder label. */
function slotName(slot: BracketSlot): string {
  return slot.kind === 'club' ? slot.slug : slot.label;
}

function mapGame(v: unknown, higher: BracketSlot, lower: BracketSlot): BracketGame | null {
  if (!isObject(v)) return null;
  const gameNumber = wholeNumber(v.gameNumber);
  if (gameNumber === null || gameNumber === 0) return null;
  if (typeof v.status !== 'string' || !GAME_STATUSES.includes(v.status as GameStatus)) return null;
  const status = v.status as GameStatus;

  const date = text(v.date);
  if (date !== null && !YMD.test(date)) return null;

  // The host is read from homeSide and then checked against the row's own
  // `home`. When the two disagree the row is kept and the host is dropped, so
  // the page names no park and sells no ticket for a host it cannot confirm.
  let homeSide = side(v.homeSide);
  if (homeSide !== null) {
    const named = slotName(homeSide === 'higher' ? higher : lower);
    if (text(v.home) !== named) homeSide = null;
  }

  const score = (s: unknown): number | null => (s === null || s === undefined ? null : wholeNumber(s));
  const winnerSide = status === 'final' ? side(v.winnerSide) : null;
  // A final game with no winner is a result the page cannot state.
  if (status === 'final' && winnerSide === null) return null;

  return {
    gameNumber,
    date,
    start: instantOf(v.start),
    startTimeTBD: v.startTimeTBD === true,
    homeSide,
    status,
    homeScore: score(v.homeScore),
    awayScore: score(v.awayScore),
    winnerSide,
    ifNecessary: v.ifNecessary === true,
  };
}

function mapSeries(v: unknown): BracketSeries | null {
  if (!isObject(v)) return null;
  const round = text(v.round);
  const roundLabel = text(v.roundLabel);
  const seriesKey = text(v.seriesKey);
  const bestOf = wholeNumber(v.bestOf);
  if (!round || !roundLabel || !seriesKey || bestOf === null || bestOf === 0) return null;
  if (typeof v.status !== 'string' || !SERIES_STATUSES.includes(v.status as SeriesStatus)) return null;
  const status = v.status as SeriesStatus;

  const higher = mapSlot(v.higher);
  const lower = mapSlot(v.lower);
  if (!higher || !lower) return null;

  if (!isObject(v.wins)) return null;
  const winsHigher = wholeNumber(v.wins.higher);
  const winsLower = wholeNumber(v.wins.lower);
  if (winsHigher === null || winsLower === null) return null;

  // The stored winner is a slug. It must be one of the two clubs in the
  // series, and it must be present exactly when the series is final.
  const winner = v.winner === null || v.winner === undefined ? null : text(v.winner);
  if (v.winner !== null && v.winner !== undefined && winner === null) return null;
  let winnerSide: Side | null = null;
  if (winner !== null) {
    if (higher.kind === 'club' && higher.slug === winner) winnerSide = 'higher';
    else if (lower.kind === 'club' && lower.slug === winner) winnerSide = 'lower';
    else return null;
  }
  if ((status === 'final') !== (winnerSide !== null)) return null;

  if (!Array.isArray(v.games)) return null;
  const games: BracketGame[] = [];
  const seen = new Set<number>();
  for (const g of v.games) {
    const game = mapGame(g, higher, lower);
    if (!game || seen.has(game.gameNumber)) return null;
    seen.add(game.gameNumber);
    games.push(game);
  }
  games.sort((a, b) => a.gameNumber - b.gameNumber);

  return {
    round,
    roundLabel,
    shortLabel: text(v.shortLabel),
    seriesKey,
    conference: text(v.conference),
    bestOf,
    higher,
    lower,
    wins: { higher: winsHigher, lower: winsLower },
    status,
    winnerSide,
    games,
  };
}

/**
 * The stored document as a Bracket, or null when it is not one.
 *
 * `expected` is the league and season the caller asked for. A document that
 * names a different league or season is refused: it is the wrong document, and
 * rendering it under this page's heading would be a false claim.
 *
 * `unplaced` is never read. It holds what the feed showed that the pipeline
 * could not place, and it is outside every guard the pipeline runs.
 */
export function mapBracketDoc(
  data: unknown,
  expected: { league: PostseasonLeague; season: number },
): Bracket | null {
  if (!isObject(data)) return null;
  if (data.league !== expected.league) return null;
  if (data.season !== expected.season) return null;
  if (!Array.isArray(data.series) || data.series.length === 0) return null;

  const series: BracketSeries[] = [];
  const keys = new Set<string>();
  for (const s of data.series) {
    const mapped = mapSeries(s);
    if (!mapped || keys.has(mapped.seriesKey)) return null;
    keys.add(mapped.seriesKey);
    series.push(mapped);
  }

  return {
    league: expected.league,
    season: expected.season,
    lastChangedAt: isoOf(data.lastChangedAt),
    series,
  };
}
