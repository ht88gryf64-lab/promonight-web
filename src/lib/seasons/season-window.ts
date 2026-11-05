// WHICH PROMOS A RANKED SURFACE MAY SHOW (ruling 2026-11-05).
//
// The scanner ingests next-season promos as soon as clubs publish them: on
// 2026-11-05 the Giants' Mar-Jun 2027 giveaways and the Galaxy's 2027 Sprint
// Season items were live, and 7 of the 8 homepage "best" picks, 17 of 30
// /best-promos rows, the only /best-promos/bobbleheads row and 2 /team-rankings
// teases were next-season rows, ranked as if they were on now. The team pages
// may show them. The ranked surfaces may not, and this module is their single
// eligibility rule:
//
//   A promo is eligible when its date falls inside its league's CURRENT season
//   window. A season is current from LEAD_IN_DAYS before its start through its
//   end, so the season containing today is current, and so is the next one
//   once today is inside its lead-in.
//
// There is deliberately no "is the league in season today" check. MLS was
// still in its 2026 postseason on 2026-11-05, so that check passed every
// Galaxy 2027 row; the promo's own date against its own season is what
// excludes them.
//
// THE WINDOWS live in windows.json, keyed league then season ("2026"; for NHL
// and NBA the season that STARTS in that year, printed "2026-27"). Each entry is an explicit start and end with its source; an
// entry built from unpublished dates says so in `provisional`. The end is
// replaced by the date of the last final game in postseasonBrackets when that
// league's bracket for that season is fully final (finals.ts). Only MLB and
// WNBA ever read a bracket (BRACKET_LEAGUES); MLS uses its fixed end by ruling.
//
// A LEAGUE WITH NO WINDOWS IS EXCLUDED. Failing closed means a league added
// later is hidden from the ranked surfaces until it has windows, never shown
// out of season.
//
// SPRING TRAINING AND PRESEASON ROWS ARE SEASON ROWS (ruling 2026-11-05, point
// 3): a row belongs to a season from its lead-in through its end, so an MLB
// spring-training giveaway in March is a 2027 row, not a row of no season.
//
// THE SEASON A PAGE NAMES (seasonLabel, same ruling). Every season year the
// site prints comes from here, never from a hardcoded constant or the clock's
// year: the season whose lead-in-to-end range contains the date; between
// seasons, the most recently ended one. So the label moves to the next season
// on the first day of its lead-in, by data, with no deploy.
//
// STALENESS IS LOUD. The table has no writer, so it goes stale on the calendar.
// season-gate.test.ts fails on the real clock once today is within
// STALE_WARNING_DAYS of the last entry's end for any league. The fix is a new
// entry for the next season, from the league's published schedule.
//
// PURE AND CLIENT-SAFE: no server-only import, no Firestore, no clock unless
// the caller passes one.
import WINDOWS_JSON from './windows.json';
import { addDaysYmd, siteTodayYmd, siteYmd } from '../site-today';
import type { Bracket } from '../postseason/types';

/** Days before a season's start that its promos become eligible. */
export const LEAD_IN_DAYS = 45;

/** The staleness test fails this many days before a league's last entry ends. */
export const STALE_WARNING_DAYS = 60;

/** The leagues whose season end comes from postseasonBrackets when final.
 *  MLS has a bracket document but ends on its fixed date by ruling. */
export const BRACKET_LEAGUES: readonly string[] = ['MLB', 'WNBA'];

export interface SeasonWindow {
  league: string;
  /** The windows.json key, e.g. "2026". Also the bracket document's season. */
  season: string;
  start: string;
  end: string;
  source: string;
  provisional?: string;
}

export type SeasonTable = Readonly<Record<string, Readonly<Record<string, Omit<SeasonWindow, 'league' | 'season'>>>>>;

/** `${LEAGUE}_${season}` -> the YYYY-MM-DD (Eastern) of that bracket's last
 *  final game, present only for a bracket whose every series is final. */
export type SeasonFinals = ReadonlyMap<string, string>;

/** A ranked surface's eligibility test, bound to one day and one set of finals. */
export type SeasonEligible = (league: string, promoDate: string) => boolean;

export const SEASON_TABLE: SeasonTable = WINDOWS_JSON;

export function finalsKey(league: string, season: string): string {
  return `${league.toUpperCase()}_${season}`;
}

/** Every window for one league, in start order. Empty for an unknown league. */
export function leagueWindows(league: string, table: SeasonTable = SEASON_TABLE): SeasonWindow[] {
  const L = typeof league === 'string' ? league.toUpperCase() : '';
  const seasons = table[L];
  if (!seasons) return [];
  return Object.entries(seasons)
    .map(([season, w]) => ({ league: L, season, ...w }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** The window's end: the bracket's last final game when one is known for a
 *  BRACKET_LEAGUES league, the fixed end otherwise. */
export function effectiveEnd(w: SeasonWindow, finals: SeasonFinals): string {
  if (!BRACKET_LEAGUES.includes(w.league)) return w.end;
  return finals.get(finalsKey(w.league, w.season)) ?? w.end;
}

/** The first day a season's rows count: LEAD_IN_DAYS before its start. */
export function leadInStart(w: Pick<SeasonWindow, 'start'>): string {
  return addDaysYmd(w.start, -LEAD_IN_DAYS);
}

/** The league's current seasons on `today`: every window whose lead-in has
 *  opened and whose end has not passed. Usually one; none between seasons. */
export function currentSeasonWindows(
  league: string,
  today: string,
  finals: SeasonFinals = new Map(),
  table: SeasonTable = SEASON_TABLE,
): SeasonWindow[] {
  return leagueWindows(league, table).filter(
    (w) => leadInStart(w) <= today && today <= effectiveEnd(w, finals),
  );
}

/** The ruling itself: the promo's date is inside a current season of its league. */
export function isInCurrentSeason(
  league: string,
  promoDate: string,
  today: string,
  finals: SeasonFinals = new Map(),
  table: SeasonTable = SEASON_TABLE,
): boolean {
  if (typeof promoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(promoDate)) return false;
  return currentSeasonWindows(league, today, finals, table).some(
    (w) => leadInStart(w) <= promoDate && promoDate <= effectiveEnd(w, finals),
  );
}

/** isInCurrentSeason bound to one day: what the ranked readers take. */
export function currentSeasonPredicate(
  today: string,
  finals: SeasonFinals = new Map(),
  table: SeasonTable = SEASON_TABLE,
): SeasonEligible {
  return (league, promoDate) => isInCurrentSeason(league, promoDate, today, finals, table);
}

// ── The season a page names ──────────────────────────────────────────────

/** Leagues whose season spans two calendar years and is named "2026-27". */
const SPLIT_SEASON_LEAGUES = new Set(['NHL', 'NBA']);

/** The season a dated row belongs to: the window whose lead-in-to-end range
 *  contains it (fixed ends: a label never waits on a bracket). Null when the
 *  date sits between seasons or the league has no windows. */
export function seasonOfDate(league: string, ymd: string, table: SeasonTable = SEASON_TABLE): SeasonWindow | null {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return leagueWindows(league, table).find((w) => leadInStart(w) <= ymd && ymd <= w.end) ?? null;
}

/**
 * The season a page names on `today`: the season whose lead-in-to-end range
 * contains today (during a lead-in, the NEXT season, ruling point 3); between
 * seasons, the most recently ended one; before a league's first window, that
 * window. THROWS for a league with no windows: a page naming a season for a
 * league the table does not know is a bug to surface, not a label to guess.
 */
export function labeledSeason(league: string, today: string = siteTodayYmd(), table: SeasonTable = SEASON_TABLE): SeasonWindow {
  const ws = leagueWindows(league, table);
  if (ws.length === 0) throw new Error(`[seasons] no windows for league "${league}" (src/lib/seasons/windows.json)`);
  const current = ws.filter((w) => leadInStart(w) <= today && today <= w.end);
  if (current.length > 0) return current[current.length - 1];
  const ended = ws.filter((w) => w.end < today);
  return ended.length > 0 ? ended[ended.length - 1] : ws[0];
}

/** The printed name of a season: its key, except "2026" on NHL and NBA reads
 *  "2026-27". A key already written as a span ("2027-28") prints as is. */
export function seasonName(w: Pick<SeasonWindow, 'league' | 'season'>): string {
  if (SPLIT_SEASON_LEAGUES.has(w.league) && /^\d{4}$/.test(w.season)) {
    const y = Number(w.season);
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  }
  return w.season;
}

/** "2026", "2026-27": the season a page for this league names on `today`. */
export function seasonLabel(league: string, today: string = siteTodayYmd(), table: SeasonTable = SEASON_TABLE): string {
  return seasonName(labeledSeason(league, today, table));
}

/** The calendar year the named season starts in (2026 for "2026-27"). */
export function seasonStartYear(league: string, today: string = siteTodayYmd(), table: SeasonTable = SEASON_TABLE): number {
  return Number(labeledSeason(league, today, table).season.slice(0, 4));
}

/** The most recently ENDED window across the given leagues on `today` (the
 *  off-season range of the ranked pages, ruling point 4): null when none has
 *  ended. Fixed ends, or a bracket final when supplied. */
export function mostRecentlyEndedWindow(
  leagues: readonly string[],
  today: string,
  finals: SeasonFinals = new Map(),
  table: SeasonTable = SEASON_TABLE,
): SeasonWindow | null {
  let best: SeasonWindow | null = null;
  for (const l of leagues) {
    for (const w of leagueWindows(l, table)) {
      const end = effectiveEnd(w, finals);
      if (end < today && (!best || end > effectiveEnd(best, finals))) best = w;
    }
  }
  return best;
}

/** The Eastern day of a bracket's last final game, or null while any series
 *  is unfinished. The game's official date wins; an undated game falls back
 *  to the Eastern day of its start, since an 8 PM Eastern start is stored as
 *  the next day in UTC. A final game with neither makes the whole answer null
 *  (the fixed end applies): it could be the last game, and taking an earlier
 *  game's day would end the season early. */
export function bracketFinalYmd(bracket: Pick<Bracket, 'series'>): string | null {
  if (bracket.series.length === 0) return null;
  if (!bracket.series.every((s) => s.status === 'final')) return null;
  let last: string | null = null;
  for (const s of bracket.series) {
    for (const g of s.games) {
      if (g.status !== 'final') continue;
      let day = g.date;
      if (!day && g.start) {
        const ms = Date.parse(g.start);
        if (!Number.isNaN(ms)) day = siteYmd(new Date(ms));
      }
      if (!day) return null;
      if (last === null || day > last) last = day;
    }
  }
  return last;
}
