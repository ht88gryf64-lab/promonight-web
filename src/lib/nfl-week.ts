import type { Game, PromoWithTeam } from './types';
import { isRegularSeasonGame } from './types';

// NFL week-bucket machinery for the week-indexed /nfl hub. Pure functions over
// Game[] / PromoWithTeam[] so the bucket math is unit-testable without
// Firestore; the data layer (src/lib/data.ts) composes these with the cached
// league-wide games read.
//
// CADENCE SPEC (authoritative source: promo-pipeline/docs/hub-system-build-spec.md
// §"cadence split", committed there 2026-08-07; restated here because this
// module is where the rollover is implemented): NFL and
// CFB roll their hub week on a FIXED boundary rather than a rolling 7-day
// window. NFL's boundary is TUESDAY: the hub shows week N from Tuesday through
// the following Monday night, so Monday Night Football stays inside the week
// it belongs to, and the rollover is a pure display cutover — no cron, no
// stored state, nothing to advance by hand.
//
// THE (seasonType, week) INVARIANT: NFL preseason weeks are numbered 1-4 and
// collide with regular-season weeks 1-4 (49 preseason docs share the games
// collection with the 272 regular-season docs). Every grouping in this module
// therefore keys on the (seasonType, week) PAIR via seasonWeekKey(); nothing
// may bucket, count, or select on `week` alone. Enforced by the tests in
// __tests__/nfl-week.test.ts, not just by this comment.

export type NflSeasonType = NonNullable<Game['seasonType']>;

export type SeasonWeekKey = `${NflSeasonType}:${number}`;

// The only sanctioned way to build a week-bucket key. Taking seasonType as a
// required first argument is the invariant made structural: call sites cannot
// produce a key from a bare week number.
export function seasonWeekKey(seasonType: NflSeasonType, week: number): SeasonWeekKey {
  return `${seasonType}:${week}`;
}

export function weekLabel(seasonType: NflSeasonType, week: number): string {
  if (seasonType === 'preseason') return `Preseason Week ${week}`;
  if (seasonType === 'postseason') return `Postseason Week ${week}`;
  return `Week ${week}`;
}

// ── ET game-date derivation ────────────────────────────────────────────────
//
// DO NOT derive week windows from the stored `date` field's min/max. `date` is
// the VENUE-LOCAL day, and for timeTbd docs it is derived from ESPN's 05:00Z
// placeholder — which is midnight Eastern on the true game date, i.e. the
// PREVIOUS local day at Central/Mountain/Pacific venues. 10 of the 24 TBD docs
// store a one-day-early date because of this (docs/known-issues.md entry 14).
// Reconstructing the UTC instant from (date, gameTime, gameTimeTz) and reading
// its Eastern day self-corrects: the placeholder instant IS midnight ET on the
// true date, so the ET day is right even where the stored local day is wrong.

const ET = 'America/New_York';

function ymdInZone(instantMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instantMs));
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function utcMs(ymd: string, hhmm: string, dayOffset: number): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d + dayOffset, hh, mm);
}

// Kickoff as a UTC instant. gameTime is HH:MM UTC and `date` is the
// venue-local day of that instant, so the instant is "gameTime UTC on
// whichever UTC date makes the venue-local day equal `date`" — at most one
// day away in either direction (Melbourne inclusive). Returns null when the
// instant cannot be reconstructed: missing fields, gameTimeTz 'UTC' (MLB
// docs, which never reach the NFL bucket path), a non-IANA tz string, or a
// non-numeric time — Intl throws RangeError on those, and one malformed doc
// must degrade to stored-field fallbacks, not crash the whole hub render.
export function gameUtcInstantMs(
  game: Pick<Game, 'date' | 'gameTime' | 'gameTimeTz'>,
): number | null {
  if (!game.gameTime || !game.gameTimeTz || game.gameTimeTz === 'UTC') return null;
  try {
    for (const offset of [0, 1, -1]) {
      const ms = utcMs(game.date, game.gameTime, offset);
      if (!Number.isFinite(ms)) return null;
      if (ymdInZone(ms, game.gameTimeTz) === game.date) return ms;
    }
  } catch {
    return null;
  }
  return null;
}

// Eastern-day of a game's kickoff; stored date when the instant is
// unresolvable. The window math and the remaining-count boundary both key on
// this, never on the raw stored date (the 05:00Z-placeholder hazard above).
export function gameEtYmd(game: Pick<Game, 'date' | 'gameTime' | 'gameTimeTz'>): string {
  const ms = gameUtcInstantMs(game);
  return ms === null ? game.date : ymdInZone(ms, ET);
}

// ── Calendar helpers (pure YYYY-MM-DD arithmetic) ──────────────────────────

export function plusDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

// Most recent Tuesday on or before `ymd` — the fixed week boundary.
function tuesdayOnOrBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const back = (dow - 2 + 7) % 7;
  return plusDaysYmd(ymd, -back);
}

// ── Week buckets ───────────────────────────────────────────────────────────

export interface NflWeekBucket {
  seasonType: NflSeasonType;
  week: number;
  key: SeasonWeekKey;
  label: string;
  // Tuesday-anchored fixed window, inclusive: windowStartYmd is a Tuesday,
  // windowEndYmd the following Monday. Anchored on the bucket's earliest
  // ET kickoff day, never on stored-date min/max (see gameEtYmd).
  windowStartYmd: string;
  windowEndYmd: string;
  games: Game[];
}

// Groups a league-wide games read into (seasonType, week) buckets, sorted by
// window start. Includes EVERY season type — the hub container deliberately
// follows the spine through preseason (labeled), while quantitative surfaces
// filter with isRegularSeasonGame downstream. Games missing week or seasonType
// (every MLB doc) are skipped: they cannot be bucketed and never reach the NFL
// path with real data.
export function buildWeekBuckets(games: Game[]): NflWeekBucket[] {
  const groups = new Map<SeasonWeekKey, Game[]>();
  for (const g of games) {
    if (typeof g.week !== 'number' || !g.seasonType) continue;
    const key = seasonWeekKey(g.seasonType, g.week);
    const list = groups.get(key);
    if (list) list.push(g);
    else groups.set(key, [g]);
  }
  const buckets: NflWeekBucket[] = [];
  for (const [key, group] of groups) {
    const earliestEt = group.map(gameEtYmd).sort()[0];
    const windowStartYmd = tuesdayOnOrBefore(earliestEt);
    const { seasonType, week } = group[0] as Game & { seasonType: NflSeasonType; week: number };
    // Render order = kickoff order, sorted on the reconstructed UTC instant.
    // Comparing stored date + raw UTC HH:MM strings mis-orders every night
    // game: SNF at 8:20pm ET stores gameTime '00:20' (Monday UTC) under the
    // Sunday stored date and would sort ABOVE the 1pm slate.
    group.sort((a, b) => {
      const am = gameUtcInstantMs(a);
      const bm = gameUtcInstantMs(b);
      if (am !== null && bm !== null && am !== bm) return am - bm;
      return a.date.localeCompare(b.date) || (a.gameTime || '').localeCompare(b.gameTime || '');
    });
    buckets.push({
      seasonType,
      week,
      key,
      label: weekLabel(seasonType, week),
      windowStartYmd,
      windowEndYmd: plusDaysYmd(windowStartYmd, 6),
      games: group,
    });
  }
  buckets.sort((a, b) => a.windowStartYmd.localeCompare(b.windowStartYmd));
  return buckets;
}

// ── Current-week selection ─────────────────────────────────────────────────

export interface NflWeekContext {
  // 'current': today falls inside a bucket's Tue-Mon window.
  // 'next-up': no bucket contains today but one starts later — the offseason
  //   gap and the empty Labor-Day week (Tue Sep 1 .. Mon Sep 7 2026 has zero
  //   NFL games between preseason wk4 and regular wk1), mirroring the CFB
  //   hub's next-up fallback so an empty window never renders a dead end.
  // 'offseason': no bucket contains today and none starts later.
  mode: 'current' | 'next-up' | 'offseason';
  bucket: NflWeekBucket | null;
}

// Content-aware display selection. selectWeekContext is calendar-truth; this
// layer decides what the HERO should be: a current bucket that is THIN — zero
// joined promos AND fewer than 4 games (the Hall-of-Fame week is 1 game,
// 0 promos; every real preseason/regular week has 13-16) — makes a dead hero,
// so the display advances to the next future bucket, preferring one that
// carries promos, presented honestly as next-up. Real weeks are never skipped:
// the games-count guard means a promo-less regular week still renders as
// current (schedule value stands on its own at 13+ games).
export function selectDisplayBucket(
  buckets: NflWeekBucket[],
  promosByGameId: Record<string, unknown[]>,
  todayYmd: string,
): NflWeekContext {
  const joinedCount = (b: NflWeekBucket) =>
    b.games.reduce((n, g) => n + (promosByGameId[g.id]?.length ?? 0), 0);
  const base = selectWeekContext(buckets, todayYmd);
  if (base.mode !== 'current' || !base.bucket) return base;
  if (joinedCount(base.bucket) > 0 || base.bucket.games.length >= 4) return base;
  const future = buckets.filter((b) => b.windowStartYmd > base.bucket!.windowStartYmd);
  const next = future.find((b) => joinedCount(b) > 0) ?? future[0];
  return next ? { mode: 'next-up', bucket: next } : base;
}

export function selectWeekContext(buckets: NflWeekBucket[], todayYmd: string): NflWeekContext {
  for (const b of buckets) {
    if (todayYmd >= b.windowStartYmd && todayYmd <= b.windowEndYmd) {
      return { mode: 'current', bucket: b };
    }
  }
  for (const b of buckets) {
    if (b.windowStartYmd > todayYmd) return { mode: 'next-up', bucket: b };
  }
  return { mode: 'offseason', bucket: null };
}

// ── Promo-to-game join ─────────────────────────────────────────────────────

// The spine join: promo docs store no gameId, so a promo attaches to its game
// by (parent team slug == homeTeamSlug, promo.date == game.date) — the same
// join enrichGamesForTeam uses, verified to resolve 123/123 live NFL promos
// uniquely. Promos that match no supplied game are returned in `unmatched`
// rather than silently dropped, so spine drift surfaces.
export function joinPromosToGames(
  games: Game[],
  promos: PromoWithTeam[],
): { byGameId: Record<string, PromoWithTeam[]>; unmatched: PromoWithTeam[] } {
  const gameByKey = new Map<string, Game>();
  // First-wins on a (homeTeamSlug, date) collision. A real NFL schedule never
  // duplicates the pair; a collision means a phantom twin from a re-ingest
  // (docs/known-issues.md entry 14). Keeping the first of the sorted input is
  // deterministic — promos attach to exactly one twin until the reconcile
  // sweep removes the stray — where Map.set's silent last-wins would flip the
  // attachment depending on input order.
  for (const g of games) {
    const key = `${g.homeTeamSlug}::${g.date}`;
    if (!gameByKey.has(key)) gameByKey.set(key, g);
  }
  const byGameId: Record<string, PromoWithTeam[]> = {};
  const unmatched: PromoWithTeam[] = [];
  for (const p of promos) {
    const game = gameByKey.get(`${p.team.id}::${p.date}`);
    if (!game) {
      unmatched.push(p);
      continue;
    }
    (byGameId[game.id] ??= []).push(p);
  }
  return { byGameId, unmatched };
}

// ── Primetime subsection split ─────────────────────────────────────────────

// Splits a bucket's games for the week container: `rest` renders as the main
// slate, `primetime` as the labeled Primetime subsection inside the same
// container (the approved shape: This Week stays the complete container, so a
// fan scanning for the Sunday night game finds it inside, under its label).
// REGULAR SEASON ONLY: preseason buckets return everything in `rest` — 19 of
// the 22 preseason primetime flags are Friday-afternoon NFL Net airings, so a
// preseason "Primetime" subsection would be noise wearing a label. Order is
// preserved from bucket.games (kickoff-instant sorted).
export function splitPrimetime(bucket: NflWeekBucket): { primetime: Game[]; rest: Game[] } {
  if (bucket.seasonType !== 'regular') return { primetime: [], rest: bucket.games };
  const primetime: Game[] = [];
  const rest: Game[] = [];
  for (const g of bucket.games) {
    (g.broadcast?.isPrimetime === true ? primetime : rest).push(g);
  }
  return { primetime, rest };
}

// ── Per-club regular-season counts ─────────────────────────────────────────

export interface NflClubCounts {
  // Season-total and from-today regular-season HOME games.
  homeGames: number;
  homeGamesRemaining: number;
  // Promos are counted ONLY when they join to a regular-season home game —
  // the (seasonType, week) invariant applied to counting: a preseason-dated
  // promo joins a preseason game and is excluded here, keeping every
  // quantitative surface on the honest regular-season corpus.
  promos: number;
  promosRemaining: number;
}

// Team-card subtitle for the hub grid: promo count where promos exist, honest
// home-game count where they do not ("9 home games" is correct in August and
// matches what the team page says — never an apology). Counts are the
// regular-season-only numbers from clubRegularSeasonCounts, so a
// preseason-joined promo can never inflate a card.
export function clubCardSubtitle(c: NflClubCounts): string {
  if (c.promos > 0) return c.promos === 1 ? '1 promo this season' : `${c.promos} promos this season`;
  return c.homeGames === 1 ? '1 home game' : `${c.homeGames} home games`;
}

export function clubRegularSeasonCounts(
  games: Game[],
  promos: PromoWithTeam[],
  todayYmd: string,
): Record<string, NflClubCounts> {
  const counts: Record<string, NflClubCounts> = {};
  const ensure = (slug: string) =>
    (counts[slug] ??= { homeGames: 0, homeGamesRemaining: 0, promos: 0, promosRemaining: 0 });
  const regular = games.filter(isRegularSeasonGame);
  // The remaining boundary compares the game's ET day, never the stored
  // venue-local date: the 10 one-day-early TBD docs would otherwise drop out
  // of "remaining" all day on their true game day. Day granularity means a
  // late Pacific Sunday game (ET day Monday) counts one extra morning after
  // it finishes — accepted noise; the stored-date version is wrong for a
  // whole game day on real week-18 docs.
  for (const g of regular) {
    const c = ensure(g.homeTeamSlug);
    c.homeGames += 1;
    if (gameEtYmd(g) >= todayYmd) c.homeGamesRemaining += 1;
  }
  const { byGameId } = joinPromosToGames(regular, promos);
  const gameById = new Map(regular.map((g) => [g.id, g]));
  for (const [gameId, joined] of Object.entries(byGameId)) {
    const game = gameById.get(gameId)!;
    const c = ensure(game.homeTeamSlug);
    c.promos += joined.length;
    if (gameEtYmd(game) >= todayYmd) c.promosRemaining += joined.length;
  }
  return counts;
}
