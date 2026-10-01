// The computer's bracket: the locked predictedBrackets document, mapped,
// scored against the real bracket, and turned into what the page says. PURE.
//
// THREE SHAPES, ONE DIRECTION.
//   PredictedBracket  the mapper's output. Server only. Holds the series keys
//                     (for the join and nothing else) and the fingerprints.
//   PredictionsView   what the client bracket receives. No series key, no
//                     hash, no slug of the pipeline's: names, seeds, the pick,
//                     its chance, its length, the coin flip, title odds.
//   MethodologyView   what the server-only methodology section receives. The
//                     one place a fingerprint may go (Shared contracts,
//                     exception logged 2026-09-30 by WEB2).
//
// WHY A WHITELIST. The stored document carries operator fields (who wrote
// the seed file, run ids, acks), file paths, git blobs and hashes the page
// must never publish. The mapper copies named fields one at a time and
// never spreads its input, so a field the pipeline adds later is dropped
// until someone names it here.
//
// WHY IT IS STRICT. The page makes claims from this document: that the
// inputs were locked on a day, that the engine code did not change since,
// that a pick had a chance. A document the mapper does not fully understand
// is null, the read that asked throws, and the last good page stands.
import type { Bracket, BracketSeries, PostseasonLeague } from './types';
import { EASTERN, type ClubInfo } from './view';

// ---- The mapped document (server only) ----

export interface PredictedSide {
  slug: string;
  seed: number;
}

export interface PredictedSeries {
  /** The join key to postseasonBrackets. Never leaves the server. */
  seriesKey: string;
  round: string;
  conference: string | null;
  bestOf: number;
  higher: PredictedSide;
  lower: PredictedSide;
  pick: string;
  pickProbability: number;
  modalSeriesLength: number;
  coinFlip: boolean;
}

export interface Fingerprints {
  corpus: string;
  params: string;
  descriptor: string;
  slugMap: string;
  reviewed: string;
}

export interface PredictedBracket {
  league: PostseasonLeague;
  season: number;
  simRuns: number;
  /** When the inputs were frozen, ISO. */
  frozenAt: string;
  /** When the bracket was computed from them, ISO. */
  computedAt: string;
  /** When the bracket was locked, ISO. */
  lockedAt: string;
  champion: string;
  series: PredictedSeries[];
  titleOdds: { slug: string; odds: number }[];
  fingerprints: Fingerprints;
}

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}
function positiveInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
}
const SHA256 = /^[0-9a-f]{64}$/;
function sha(v: unknown): string | null {
  return typeof v === 'string' && SHA256.test(v) ? v : null;
}
/** A stored UTC instant, "2026-09-25T14:24:00.732Z", that names a real
 *  moment. The pipeline writes UTC only. A date that does not exist
 *  ("2026-09-31") would roll over to another day in Date.parse and render
 *  as a date nobody stored, so the parsed instant must give back the same
 *  date and time it was read from. */
function instant(v: unknown): string | null {
  const s = text(v);
  const m = s ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d{1,3})?Z$/.exec(s) : null;
  if (!m) return null;
  const ms = Date.parse(s as string);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms).toISOString();
  return iso.slice(0, m[1].length) === m[1] ? iso : null;
}

/** The pipeline's coin-flip band (predictions/compute.js, COIN_FLIP_LOW and
 *  COIN_FLIP_HIGH): a pick whose chance is between 49.5% and 50.5%. */
export const COIN_FLIP_HIGH = 0.505;

/** The engine's core files, the ones whose identity between the freeze and
 *  the compute the page states (predictions/compute.js CORE_FILES). */
export const CORE_FILES = ['predictions/elo.js', 'predictions/simulate.js', 'predictions/bracket.js'] as const;

function side(v: unknown): PredictedSide | null {
  if (!isObject(v)) return null;
  const slug = text(v.slug);
  const seed = positiveInt(v.seed);
  return slug && seed ? { slug, seed } : null;
}

function mapRound(v: unknown): PredictedSeries | null {
  if (!isObject(v)) return null;
  const seriesKey = text(v.seriesKey);
  const round = text(v.round);
  const bestOf = positiveInt(v.bestOf);
  if (!seriesKey || !round || !bestOf) return null;
  if (v.conference !== null && text(v.conference) === null) return null;
  const higher = side({ slug: v.higher, seed: v.higherSeed });
  const lower = side({ slug: v.lower, seed: v.lowerSeed });
  if (!higher || !lower || higher.slug === lower.slug) return null;
  const pick = text(v.pick);
  if (pick !== higher.slug && pick !== lower.slug) return null;
  // The pick is the side that won the matchup more often, so its chance is at
  // least even. A certain pick is refused upstream by the engine and here.
  const p = v.pickProbability;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;
  const length = positiveInt(v.modalSeriesLength);
  if (!length || length < Math.ceil(bestOf / 2) || length > bestOf) return null;
  // The flag must agree with the chance: "Coin flip" is shown in place of
  // the number, so a flag on a 93% pick would hide a number the page owes.
  if (typeof v.coinFlip !== 'boolean' || v.coinFlip !== (p <= COIN_FLIP_HIGH)) return null;
  return {
    seriesKey,
    round,
    conference: v.conference === null ? null : (v.conference as string),
    bestOf,
    higher,
    lower,
    pick: pick as string,
    pickProbability: p,
    modalSeriesLength: length,
    coinFlip: v.coinFlip,
  };
}

/** A Firestore Timestamp as an ISO instant, or null. */
function timestampIso(v: unknown): string | null {
  if (!isObject(v) || typeof (v as { toDate?: unknown }).toDate !== 'function') return null;
  try {
    const d = (v as { toDate: () => unknown }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * The stored predictedBrackets document as a PredictedBracket, or null.
 *
 * Refused, among other things, when: the league or season is not the one
 * asked for; the document was never locked; any engine core file differs
 * between the freeze and the compute (the page says the code was unchanged);
 * a fingerprint is not a SHA-256; the inputs were not frozen before the
 * bracket was computed; the champion is not the pick of the last series.
 */
export function mapPredictedDoc(data: unknown, expected: { league: PostseasonLeague; season: number }): PredictedBracket | null {
  if (!isObject(data)) return null;
  if (data.league !== expected.league || data.season !== expected.season) return null;
  if (data.target !== 'lock') return null;
  const lockedAt = timestampIso(data.lockedAt);
  const simRuns = positiveInt(data.simRuns);
  const computedAt = instant(data.computedAt);
  if (!lockedAt || !simRuns || !computedAt || Date.parse(computedAt) > Date.parse(lockedAt)) return null;

  const prov = data.provenance;
  if (!isObject(prov)) return null;
  const frozenAt = instant(prov.frozenAt);
  if (!frozenAt || Date.parse(frozenAt) >= Date.parse(computedAt)) return null;
  if (!text(prov.engineCommitAtFreeze)) return null;
  // Exactly the three core files, each identical at the freeze and the
  // compute. The page says that code did not change; it says nothing about
  // the engine's other files, which did not exist at the freeze.
  if (!Array.isArray(prov.coreFiles) || prov.coreFiles.length !== CORE_FILES.length) return null;
  const seen = new Set<string>();
  for (const f of prov.coreFiles) {
    if (!isObject(f) || f.identical !== true) return null;
    const path = text(f.path);
    if (!path || !(CORE_FILES as readonly string[]).includes(path) || seen.has(path)) return null;
    seen.add(path);
    const a = text(f.blobAtFreeze);
    if (!a || a !== f.blobAtCompute) return null;
  }

  const fingerprints: Partial<Fingerprints> = {
    corpus: sha(prov.corpusSha256) ?? undefined,
    params: sha(prov.paramsSha256) ?? undefined,
    descriptor: sha(prov.descriptorSha256) ?? undefined,
    slugMap: sha(prov.slugMapSha256) ?? undefined,
    reviewed: sha(data.reviewedSha256) ?? undefined,
  };
  if (Object.values(fingerprints).some((v) => v === undefined)) return null;

  if (!Array.isArray(data.rounds) || data.rounds.length === 0) return null;
  const series: PredictedSeries[] = [];
  const keys = new Set<string>();
  for (const r of data.rounds) {
    const s = mapRound(r);
    if (!s || keys.has(s.seriesKey)) return null;
    keys.add(s.seriesKey);
    series.push(s);
  }

  const champion = text(data.champion);
  const last = series[series.length - 1];
  if (!champion || series.filter((s) => s.round === last.round).length !== 1 || last.pick !== champion) return null;

  // Title odds name each club of this bracket once, and no other club.
  const clubsHere = new Set(series.flatMap((s) => [s.higher.slug, s.lower.slug]));
  if (!Array.isArray(data.titleOdds) || data.titleOdds.length === 0) return null;
  const titleOdds: { slug: string; odds: number }[] = [];
  for (const o of data.titleOdds) {
    if (!isObject(o)) return null;
    const slug = text(o.slug);
    const odds = o.odds;
    if (!slug || typeof odds !== 'number' || !Number.isFinite(odds) || odds < 0 || odds > 1) return null;
    if (!clubsHere.has(slug) || titleOdds.some((t) => t.slug === slug)) return null;
    titleOdds.push({ slug, odds });
  }
  titleOdds.sort((a, b) => b.odds - a.odds);

  return {
    league: expected.league,
    season: expected.season,
    simRuns,
    frozenAt,
    computedAt,
    lockedAt,
    champion,
    series,
    titleOdds,
    fingerprints: fingerprints as Fingerprints,
  };
}

// ---- The lock, pinned ----
//
// The five fingerprints the page may show, as they were locked. The four
// input hashes are the pipeline's predictions/frozen/pins.json (the frozen
// predictionInputs documents); the reviewed sha256 is the one Matt verified
// with shasum before each lock (COORDINATION.md, PREDICT G4 lines,
// 2026-09-30 16:22 CT). A document whose fingerprints are not these is not
// the bracket that was locked, whatever else it says, and is not shown. A
// new season adds a block; a league and season with no block shows nothing.
export const LOCKED_FINGERPRINTS: Readonly<Record<string, Fingerprints>> = {
  WNBA_2026: {
    corpus: 'e4bcaddb1f2acebf37ece2f2c8f32d136609bd93469a30c8e5da104a6bd17a8d',
    params: 'f953e58fabed3c981231b1b52761b9c22fcc3c1d4274abcac80749856ff61433',
    descriptor: '71c1700f4e5626ad049e3af83f4064efd6d2ee2255e3abceee59a16d723c6321',
    slugMap: 'b5d2e82a40cbebcca98ef745634e986c64235e851e84b46047b94ceddf1f3c26',
    reviewed: '9062bcca0613db2b716200c652fc416b08f786af6781d242fb17d62bf9f862fd',
  },
  MLB_2026: {
    corpus: '32d46402d4f94a155e99294f9dd9c613d1c76dd36d0e29a81210abbb99a6689f',
    params: '76829cfc6a376250e26082bb24c06327c13e70c6a7ddf14cbb08019d3155278a',
    descriptor: 'fb2ec31873f2791f88ca5eb4dc7743a6d84bf184cb11e5081ab3e138ecf3286a',
    slugMap: '29df25c91e18ef143c7bff5426b7a97635464d291934e39e94f903a5583a1568',
    reviewed: 'f0af727db7948eacab36ece31471ded74fbcd59e78f15f4d6cdfdd3e079a79d0',
  },
};

/** Are the document's five fingerprints exactly the locked ones? */
export function fingerprintsMatchLock(p: PredictedBracket): boolean {
  const want = LOCKED_FINGERPRINTS[`${p.league}_${p.season}`];
  if (!want) return false;
  return (Object.keys(want) as (keyof Fingerprints)[]).every((k) => p.fingerprints[k] === want[k]);
}

// ---- Scoring (NCAA rule) ----
//
// A pick is CORRECT when its team is the real winner of the same slot, and
// BUSTED when the real slot went the other way or the picked team was
// already knocked out in an earlier round. Otherwise it is ALIVE.
//
// Only a slot whose real series is final COUNTS toward "X for Y". A pick
// busted early is marked at once but counts only when its own slot is
// decided. A coin flip is a pick like any other.
//
// A predicted matchup that can no longer happen is DIMMED. Dimming says
// nothing about the pick: the picked team may still be alive and win the
// slot against someone else.

export type PickOutcome = 'correct' | 'busted' | 'alive';

export interface ScoredSeries {
  predicted: PredictedSeries;
  real: BracketSeries;
  outcome: PickOutcome;
  /** The real series is final. Only these count toward X for Y. */
  decided: boolean;
  /** The predicted matchup can no longer happen. */
  dimmed: boolean;
  realWinner: string | null;
}

export type ChampionStatus = 'won' | 'alive' | 'out';

export interface Scorecard {
  correct: number;
  decided: number;
  alive: number;
  champion: { slug: string; status: ChampionStatus };
}

function clubSlug(s: BracketSeries['higher']): string | null {
  return s.kind === 'club' ? s.slug : null;
}

/** Every club that lost a final series in the real bracket. */
export function eliminatedClubs(bracket: Bracket): Set<string> {
  const out = new Set<string>();
  for (const s of bracket.series) {
    if (s.status !== 'final' || !s.winnerSide) continue;
    const loser = clubSlug(s.winnerSide === 'higher' ? s.lower : s.higher);
    if (loser) out.add(loser);
  }
  return out;
}

/**
 * Each predicted series against its real slot, in the predicted document's
 * order. Null when the two do not describe the same bracket: a predicted
 * key with no real series, a real series with no prediction, or a round
 * that disagrees.
 */
export function scorePredictions(bracket: Bracket, predicted: PredictedBracket): ScoredSeries[] | null {
  if (bracket.league !== predicted.league || bracket.season !== predicted.season) return null;
  const byKey = new Map(bracket.series.map((s) => [s.seriesKey, s]));
  if (byKey.size !== predicted.series.length) return null;
  const out: ScoredSeries[] = [];
  const eliminated = eliminatedClubs(bracket);
  for (const p of predicted.series) {
    const real = byKey.get(p.seriesKey);
    if (!real || real.round !== p.round || real.conference !== p.conference || real.bestOf !== p.bestOf) return null;
    const decided = real.status === 'final' && real.winnerSide !== null;
    const realWinner = decided ? clubSlug(real[real.winnerSide!]) : null;
    let outcome: PickOutcome;
    if (decided) outcome = realWinner === p.pick ? 'correct' : 'busted';
    else outcome = eliminated.has(p.pick) ? 'busted' : 'alive';

    const predictedPair = [p.higher.slug, p.lower.slug];
    const realClubs = [clubSlug(real.higher), clubSlug(real.lower)].filter((s): s is string => s !== null);
    let dimmed: boolean;
    if (decided) {
      // It happened only if the real pair is the predicted pair.
      dimmed = !(realClubs.length === 2 && predictedPair.every((s) => realClubs.includes(s)));
    } else {
      dimmed = predictedPair.some((s) => eliminated.has(s)) || realClubs.some((s) => !predictedPair.includes(s));
    }
    out.push({ predicted: p, real, outcome, decided, dimmed, realWinner });
  }
  return out;
}

export function scorecard(scored: readonly ScoredSeries[], predicted: PredictedBracket, bracket: Bracket): Scorecard {
  const counted = scored.filter((s) => s.decided);
  const last = scored[scored.length - 1];
  let status: ChampionStatus;
  if (last.decided) status = last.realWinner === predicted.champion ? 'won' : 'out';
  else status = eliminatedClubs(bracket).has(predicted.champion) ? 'out' : 'alive';
  return {
    correct: counted.filter((s) => s.outcome === 'correct').length,
    decided: counted.length,
    alive: scored.filter((s) => s.outcome === 'alive').length,
    champion: { slug: predicted.champion, status },
  };
}

// ---- What the page says ----

export interface PickSideView {
  /** Nickname. */
  label: string;
  fullName: string;
  abbreviation: string;
  seed: number;
  color: string;
  picked: boolean;
}

export interface PickSeriesView {
  /** The card's own element id: "pick-first_round-1". */
  id: string;
  /** The page's id for the real series ("first_round-1"), for analytics. */
  seriesId: string;
  round: string;
  roundLabel: string;
  conference: string | null;
  formatLabel: string;
  higher: PickSideView;
  lower: PickSideView;
  pickName: string;
  pickLabel: string;
  /** "in 6". */
  lengthLabel: string;
  /** "72%", or "Coin flip". */
  chanceLabel: string;
  coinFlip: boolean;
  outcome: PickOutcome;
  decided: boolean;
  dimmed: boolean;
  /** "New York Liberty won 2-0", once the real series is final. */
  resultLine: string | null;
  /** A line about a pick that is out, or a matchup that cannot happen. */
  note: string | null;
}

export interface PickRoundView {
  key: string;
  label: string;
  shortLabel: string | null;
  groups: { conference: string | null; series: PickSeriesView[] }[];
}

export interface ScorecardView {
  correct: number;
  decided: number;
  alive: number;
  /** "The computer is 1 for 1", or the line for nothing decided yet. */
  recordLine: string;
  /** "6 picks still alive". */
  aliveLine: string;
  championName: string;
  championStatus: ChampionStatus;
  /** "Golden State Valkyries, still alive". */
  championLine: string;
}

export interface TitleOddsRow {
  name: string;
  oddsLabel: string;
}

/** Everything the client bracket and the scorecard receive. Plain data. No
 *  series key and no fingerprint: neither has a field here. */
export interface PredictionsView {
  rounds: PickRoundView[];
  scorecard: ScorecardView;
  titleOdds: TitleOddsRow[];
}

/** The one line per league on the hub card. */
export interface HubPredictionLine {
  league: PostseasonLeague;
  href: string;
  championName: string;
  /** "1 for 1", or "no series decided yet". */
  record: string;
}

export const TITLE_ODDS_ROWS = 8;

/** "72%". */
export function percent(p: number): string {
  const n = Math.round(p * 100);
  if (n < 1) return 'Under 1%';
  // Never "100%": the mapper refuses a certain pick, and a rounded one is not.
  if (n > 99) return 'Over 99%';
  return `${n}%`;
}

export function recordText(correct: number, decided: number): string {
  return decided === 0 ? 'no series decided yet' : `${correct} for ${decided}`;
}

const CHAMPION_STATUS: Record<ChampionStatus, string> = {
  won: 'won the title',
  alive: 'still alive',
  out: 'eliminated',
};

/** Round labels and order come from the real bracket's view, so the pills
 *  of the two brackets name the same rounds the same way. */
export interface RoundLabel {
  key: string;
  label: string;
  shortLabel: string | null;
}

/**
 * The predictions as the page shows them. Null when a club the document
 * names has no team record on the web.
 *
 * `seriesIds` is the real view's id for each series key (see seriesIds in
 * ./view.ts); the card ids are built from it, never from the key.
 */
export function buildPredictionsView(
  scored: readonly ScoredSeries[],
  card: Scorecard,
  predicted: PredictedBracket,
  clubs: ReadonlyMap<string, ClubInfo>,
  seriesIds: ReadonlyMap<string, string>,
  roundLabels: readonly RoundLabel[],
): PredictionsView | null {
  const name = (slug: string) => clubs.get(slug) ?? null;
  const rounds: PickRoundView[] = [];
  for (const r of roundLabels) rounds.push({ key: r.key, label: r.label, shortLabel: r.shortLabel, groups: [] });
  const byRound = new Map(rounds.map((r) => [r.key, r]));

  for (const s of scored) {
    const p = s.predicted;
    const hi = name(p.higher.slug);
    const lo = name(p.lower.slug);
    const seriesId = seriesIds.get(p.seriesKey);
    const round = byRound.get(p.round);
    if (!hi || !lo || !seriesId || !round) return null;
    const sideView = (c: ClubInfo, seed: number): PickSideView => ({
      label: c.name,
      fullName: `${c.city} ${c.name}`,
      abbreviation: c.abbreviation,
      seed,
      color: c.primaryColor,
      picked: c.id === p.pick,
    });
    const higher = sideView(hi, p.higher.seed);
    const lower = sideView(lo, p.lower.seed);
    const picked = higher.picked ? higher : lower;

    let resultLine: string | null = null;
    if (s.decided && s.realWinner) {
      const w = name(s.realWinner);
      if (!w) return null;
      const a = Math.max(s.real.wins.higher, s.real.wins.lower);
      const b = Math.min(s.real.wins.higher, s.real.wins.lower);
      resultLine = `${w.city} ${w.name} won ${a}-${b}`;
    }
    let note: string | null = null;
    if (!s.decided && s.outcome === 'busted') note = `${picked.fullName} are out.`;
    else if (s.dimmed && !s.decided) note = 'This matchup can no longer happen.';
    else if (s.dimmed) note = 'This matchup did not happen.';

    const view: PickSeriesView = {
      id: `pick-${seriesId}`,
      seriesId,
      round: p.round,
      roundLabel: round.label,
      conference: p.conference,
      formatLabel: `Best of ${p.bestOf}`,
      higher,
      lower,
      pickName: picked.fullName,
      pickLabel: picked.label,
      lengthLabel: `in ${p.modalSeriesLength}`,
      chanceLabel: p.coinFlip ? 'Coin flip' : percent(p.pickProbability),
      coinFlip: p.coinFlip,
      outcome: s.outcome,
      decided: s.decided,
      dimmed: s.dimmed,
      resultLine,
      note,
    };
    let group = round.groups.find((g) => g.conference === p.conference);
    if (!group) {
      group = { conference: p.conference, series: [] };
      round.groups.push(group);
    }
    group.series.push(view);
  }
  // Same order inside each group as the real bracket: by the page id.
  for (const r of rounds) for (const g of r.groups) g.series.sort((a, b) => seriesOrder(a.seriesId) - seriesOrder(b.seriesId));

  const champ = name(card.champion.slug);
  if (!champ) return null;
  const championName = `${champ.city} ${champ.name}`;
  const titleOdds: TitleOddsRow[] = [];
  for (const o of predicted.titleOdds.slice(0, TITLE_ODDS_ROWS)) {
    const c = name(o.slug);
    if (!c) return null;
    titleOdds.push({ name: `${c.city} ${c.name}`, oddsLabel: percent(o.odds) });
  }

  return {
    rounds: rounds.filter((r) => r.groups.length > 0),
    scorecard: {
      correct: card.correct,
      decided: card.decided,
      alive: card.alive,
      recordLine: card.decided === 0 ? 'No series decided yet' : `The computer is ${card.correct} for ${card.decided}`,
      aliveLine: `${card.alive} ${card.alive === 1 ? 'pick' : 'picks'} still alive`,
      championName,
      championStatus: card.champion.status,
      championLine: `${championName}, ${CHAMPION_STATUS[card.champion.status]}`,
    },
    titleOdds,
  };
}

function seriesOrder(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isFinite(n) ? n : 0;
}

/** The computer's bracket for a league, as its three readers need it: the
 *  client bracket and scorecard, the server-only methodology section, and
 *  the hub's one line. Built in ./data.ts; handed by the page to server
 *  components only, which pass each reader its own part. */
export interface LeaguePredictions {
  view: PredictionsView;
  methodology: MethodologyView;
  hub: HubPredictionLine;
}

/** Every club the predictions and the real bracket name: the clubs the
 *  page has to look up before it can build the view. */
export function predictionSlugs(bracket: Bracket, predicted: PredictedBracket): string[] {
  const out = new Set<string>();
  for (const s of predicted.series) {
    out.add(s.higher.slug);
    out.add(s.lower.slug);
  }
  for (const o of predicted.titleOdds) out.add(o.slug);
  for (const s of bracket.series) for (const x of [s.higher, s.lower]) if (x.kind === 'club') out.add(x.slug);
  return [...out];
}

/** Why assembly could not build the predictions. */
export type AssemblyFailure = { unavailable: 'no-join' | 'no-team-record' };

/**
 * The predictions for a page, from the mapped documents and the web's own
 * team records. A failure (the section is hidden) when the two documents do
 * not describe the same bracket, or a club has no team record.
 *
 * `seriesIds` and `rounds` come from the real bracket and its view, so the
 * predicted cards carry the real page ids and the pills read the same.
 */
export function assemblePredictions(
  bracket: Bracket,
  predicted: PredictedBracket,
  clubs: ReadonlyMap<string, ClubInfo>,
  seriesIds: ReadonlyMap<string, string>,
  rounds: readonly RoundLabel[],
): LeaguePredictions | AssemblyFailure {
  const scored = scorePredictions(bracket, predicted);
  if (!scored) return { unavailable: 'no-join' };
  const card = scorecard(scored, predicted, bracket);
  const view = buildPredictionsView(scored, card, predicted, clubs, seriesIds, rounds);
  if (!view) return { unavailable: 'no-team-record' };
  return {
    view,
    methodology: buildMethodologyView(predicted, bracket),
    hub: {
      league: predicted.league,
      href: `/playoffs/${predicted.league.toLowerCase()}#predictions`,
      championName: view.scorecard.championName,
      record: recordText(card.correct, card.decided),
    },
  };
}

// ---- Methodology (server only) ----

/** The 2025 backtest, run with the same settings. Stated by the PREDICT
 *  session's G0; these are the only accuracy claims the page makes. */
export const BACKTEST_2025: Record<PostseasonLeague, { right: number; of: number; champion: boolean }> = {
  WNBA: { right: 5, of: 7, champion: true },
  MLB: { right: 5, of: 11, champion: false },
};

export interface FingerprintRow {
  label: string;
  value: string;
}

export interface MethodologyView {
  league: PostseasonLeague;
  /** "10,000". */
  simRuns: string;
  /** "September 25, 2026", the Eastern day the inputs were frozen. */
  lockedOn: string;
  /** True only when every game in the real bracket starts after the freeze. */
  lockedBeforeGame1: boolean;
  /** "September 30, 2026", the Eastern day the bracket was computed. */
  computedOn: string;
  /** The Eastern day the bracket was locked. "At lock" on the page means
   *  this moment, never the input freeze. */
  bracketLockedOn: string;
  backtest: string;
  fingerprints: FingerprintRow[];
}

/** "September 28, 2026", the Eastern calendar day of an instant. */
export function easternLongDate(iso: string): string {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, year: 'numeric', month: 'long', day: 'numeric' }).formatToParts(new Date(iso))) {
    out[p.type] = p.value;
  }
  return `${out.month} ${out.day}, ${out.year}`;
}

function easternYmdOf(iso: string): string {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))) {
    out[p.type] = p.value;
  }
  return `${out.year}-${out.month}-${out.day}`;
}

/**
 * Were the inputs frozen before Game 1? Proven from the real bracket: every
 * game with a start time starts after the freeze, and every game with only a
 * date is on a later Eastern day. A bracket with no dated game proves
 * nothing, and the answer is false.
 */
export function frozenBeforeFirstGame(bracket: Bracket, frozenAt: string): boolean {
  const t = Date.parse(frozenAt);
  const day = easternYmdOf(frozenAt);
  let dated = 0;
  for (const s of bracket.series) {
    for (const g of s.games) {
      if (g.start) {
        dated++;
        if (Date.parse(g.start) <= t) return false;
      } else if (g.date) {
        dated++;
        if (g.date <= day) return false;
      }
    }
  }
  return dated > 0;
}

export function buildMethodologyView(predicted: PredictedBracket, bracket: Bracket): MethodologyView {
  const bt = BACKTEST_2025[predicted.league];
  const f = predicted.fingerprints;
  return {
    league: predicted.league,
    simRuns: predicted.simRuns.toLocaleString('en-US'),
    lockedOn: easternLongDate(predicted.frozenAt),
    lockedBeforeGame1: frozenBeforeFirstGame(bracket, predicted.frozenAt),
    computedOn: easternLongDate(predicted.computedAt),
    bracketLockedOn: easternLongDate(predicted.lockedAt),
    backtest: `Run on the 2025 ${predicted.league} postseason with the same settings, the computer called ${bt.right} of ${bt.of} series and ${
      bt.champion ? 'got the champion right' : 'got the champion wrong'
    }.`,
    fingerprints: [
      { label: 'Regular-season results', value: f.corpus },
      { label: 'Model settings', value: f.params },
      { label: 'Bracket format', value: f.descriptor },
      { label: 'Team identifiers', value: f.slugMap },
      { label: 'Published bracket', value: f.reviewed },
    ],
  };
}
