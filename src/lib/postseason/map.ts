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
// mapper does not fully understand returns null, and the read that asked
// throws, so no page is rendered from it and the last good page stands. It
// never renders the part it could read: a series with an unknown status,
// shown as if it were known, is a false claim.
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

// ---- Slots ----
//
// A slot is read in two steps. parseSlot reads what is stored. resolveSlot,
// which runs once the series before it in the document are mapped, decides
// what the slot IS:
//
//   1. It names a feeder series and that series is final in this document:
//      the slot is the feeder's winner, a club, with the seed the winner
//      carried in its own slot.
//   2. Else it names two candidate clubs: a placeholder that carries them.
//   3. Else: a placeholder showing the stored label, verbatim.
//
// THE FEEDER KEY NEVER LEAVES THIS FILE. It is read from the
// `feederSeriesKey` FIELD and from nowhere else, used for step 1, and
// dropped. Label text is never read for a feeder: a label is copy, and the
// web does not parse copy for facts.
//
// A stored label that holds a series key is not copy either. The pipeline
// writes one such label itself, "Winner of AL-WC-B", once a feeder is
// decided. It is never shown as written, and it resolves nothing: the slot
// reads "To be decided" until the field, or the feed, names the club.

interface StoredSlot {
  /** What the game rows call this slot: the slug, or the stored label. */
  stored: string;
  slug: string | null;
  label: string | null;
  seed: number | null;
  feeder: string | null;
  candidates: [string, string] | null;
}

function parseSlot(v: unknown): StoredSlot | null {
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
  // Two clubs or none. A malformed pair is not a reason to refuse the
  // document: the slot falls through to its label, which is the behaviour
  // before the pipeline published the pair at all.
  const pair = Array.isArray(v.candidates) ? v.candidates.map(text) : null;
  const pairOk = pair !== null && pair.length === 2 && pair[0] !== null && pair[1] !== null && pair[0] !== pair[1];
  return {
    stored: (slug ?? label) as string,
    slug,
    label,
    seed,
    feeder: slug === null ? text(v.feederSeriesKey) : null,
    candidates: slug === null && pairOk ? [pair![0] as string, pair![1] as string] : null,
  };
}

// The shapes a series key takes. MLB: AL-WC-A, NL-DS-B, AL-CS. WNBA: R1-1v8,
// SF-A. A token is also a key when it is, exactly, a key of this document,
// which is what catches the short ones (WS, F).
const KEY_SHAPES = [/^[A-Z]+-[A-Z]+-[A-Z0-9]+$/, /^[A-Z]+-[A-Z]{2}$/, /^R\d+-\d+v\d+$/, /^[A-Z]{1,3}-[A-Z0-9]$/];
/** What a slot shows when its stored label cannot be shown. */
export const UNDECIDED_LABEL = 'To be decided';

function holdsSeriesKey(label: string, keys: ReadonlySet<string>): boolean {
  return label.split(/[^A-Za-z0-9-]+/).some((t) => t.length > 0 && (keys.has(t) || KEY_SHAPES.some((re) => re.test(t))));
}

/** The label to show: the stored one, verbatim, unless it holds a series
 *  key. Then "To be decided", whatever the key names and whatever state that
 *  series is in. */
function safeLabel(label: string, keys: ReadonlySet<string>): string {
  return holdsSeriesKey(label, keys) ? UNDECIDED_LABEL : label;
}

function resolveSlot(slot: StoredSlot, keys: ReadonlySet<string>, mapped: ReadonlyMap<string, BracketSeries>): BracketSlot {
  if (slot.slug !== null) return { kind: 'club', slug: slot.slug, seed: slot.seed };
  const label = slot.label as string;

  // The feeder, from the field alone. Only a series ALREADY mapped counts,
  // which is every series that comes before this one in the document. A slot
  // cannot be fed by its own series or by a later round.
  const feeder = slot.feeder !== null ? mapped.get(slot.feeder) ?? null : null;

  if (feeder && feeder.status === 'final' && feeder.winnerSide) {
    const winner = feeder[feeder.winnerSide];
    if (winner.kind === 'club') return { kind: 'club', slug: winner.slug, seed: winner.seed };
  }
  return { kind: 'placeholder', label: safeLabel(label, keys), seed: slot.seed, candidates: slot.candidates };
}

/** Does a game row name this slot? A row names a slot by what was stored
 *  for it, or, for a slot resolved to a feeder's winner, by that club. */
function rowNames(row: unknown, stored: StoredSlot, resolved: BracketSlot): boolean {
  const named = text(row);
  if (named === null) return false;
  return named === stored.stored || (resolved.kind === 'club' && named === resolved.slug);
}

function mapGame(
  v: unknown,
  stored: { higher: StoredSlot; lower: StoredSlot },
  resolved: { higher: BracketSlot; lower: BracketSlot },
): BracketGame | null {
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
  if (homeSide !== null && !rowNames(v.home, stored[homeSide], resolved[homeSide])) homeSide = null;

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

function mapSeries(v: unknown, keys: ReadonlySet<string>, mapped: ReadonlyMap<string, BracketSeries>): BracketSeries | null {
  if (!isObject(v)) return null;
  const round = text(v.round);
  const roundLabel = text(v.roundLabel);
  const seriesKey = text(v.seriesKey);
  const bestOf = wholeNumber(v.bestOf);
  if (!round || !roundLabel || !seriesKey || bestOf === null || bestOf === 0) return null;
  if (typeof v.status !== 'string' || !SERIES_STATUSES.includes(v.status as SeriesStatus)) return null;
  const status = v.status as SeriesStatus;

  const storedHigher = parseSlot(v.higher);
  const storedLower = parseSlot(v.lower);
  if (!storedHigher || !storedLower) return null;
  const higher = resolveSlot(storedHigher, keys, mapped);
  const lower = resolveSlot(storedLower, keys, mapped);

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
    const game = mapGame(g, { higher: storedHigher, lower: storedLower }, { higher, lower });
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

  // Every key in the document, known before any slot is read, so a stored
  // label can be checked against them.
  const keys = new Set<string>();
  for (const s of data.series) {
    const key = isObject(s) ? text(s.seriesKey) : null;
    if (key === null || keys.has(key)) return null;
    keys.add(key);
  }

  // In document order: a slot is resolved against the series before it.
  const series: BracketSeries[] = [];
  const mapped = new Map<string, BracketSeries>();
  for (const s of data.series) {
    const one = mapSeries(s, keys, mapped);
    if (!one) return null;
    mapped.set(one.seriesKey, one);
    series.push(one);
  }

  return {
    league: expected.league,
    season: expected.season,
    lastChangedAt: isoOf(data.lastChangedAt),
    series,
  };
}
