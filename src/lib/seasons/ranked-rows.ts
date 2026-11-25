import 'server-only';
import { cache } from 'react';
import { getScoredPromosByItemType, getScoredPromosInDateRange } from '../data';
import { addDaysYmd, siteYmd } from '../site-today';
import type { ScoredPromoWithTeam } from '../types';
import { BEST_PROMO_MIN_ROWS, isBestPromoRow } from '../scoring-weights';
import { PROMO_SCORED_LEAGUES, PROMO_SCORED_LEAGUE_LIST } from '../types';
import { getCurrentSeasonPredicate, getSeasonFinals } from './finals';
import { effectiveEnd, leadInStart, leagueWindows, mostRecentlyEndedWindow, seasonName } from './season-window';

// THE ROWS AND THE YEAR LABEL OF THE SCORE-RANKED PAGES (/best-promos and
// /best-promos/bobbleheads), ruling 2026-11-05 point 4. One loader, wrapped in
// React cache(), so generateMetadata and the page body read the SAME gated rows
// in one fetch and the <title> can never name a year the list does not show.
//
//   Upcoming mode  the season-gated forward window has ENOUGH rows (below).
//                  The label is the calendar year of the rows shown, or the
//                  span "2026-27" when they cross New Year (upcomingLabel).
//   Retrospective  it does not. The rows are the most recently ENDED season
//                  (src/lib/seasons/windows.json), across every scored
//                  league's window for that season, and the label is that
//                  season's name. When no scored league's season has ended
//                  yet (the tail of a table's first season), the rows are the
//                  season in play, from its lead-in to today.
//
// Nothing here reads a hardcoded year or the clock's year: the page flips on
// the first day a scored league's lead-in opens, by data.
//
// WHAT "ENOUGH" MEANS ON /best-promos (2026-11-25). The forward rows are
// giveaways at or above BEST_PROMO_SCORE_FLOOR (isBestPromoRow,
// src/lib/scoring-weights.ts), and the page leaves the retrospective only at
// RANKED_MIN_UPCOMING_ROWS of them. Before this, any one forward row flipped
// the mode: that day the page served three MLS playoff fixtures, typed
// `theme` and scoring 15 to 18, as the best promo nights of 2026.
// /best-promos/bobbleheads reads the same five leagues in upcoming mode and
// lists giveaways only; one forward row is still enough for it, and its
// retrospective is the ended season or nothing (known-issues 126).

// The leagues whose SEASON WINDOWS decide the retrospective, and whose rows
// it lists: the three with a finished season on file. The upcoming list on
// /best-promos is wider (PROMO_SCORED_LEAGUES adds NBA and NHL). An NBA or NHL
// season is never the retrospective's: on a calendar-year label it would put
// the back half of one season and the front half of the next under one name.
export const RANKED_LEAGUES = ['MLB', 'MLS', 'WNBA'] as const;
export const SERVER_FETCH_CAP = 300;
/** /best-promos/bobbleheads fetched up to 500 before the shared loader. */
export const BOBBLEHEAD_FETCH_CAP = 500;
export const SERVER_FETCH_DAYS = 180;
/** Qualifying upcoming rows /best-promos needs before it leaves the retrospective:
 *  the shared minimum of the ranked "best" surfaces (src/lib/scoring-weights.ts). */
export const RANKED_MIN_UPCOMING_ROWS = BEST_PROMO_MIN_ROWS;

/** The mode for a count of qualifying forward rows: upcoming at `minRows` or
 *  more, the retrospective below it. */
export function rankedMode(qualifying: number, minRows: number = RANKED_MIN_UPCOMING_ROWS): 'upcoming' | 'retrospective' {
  return qualifying >= minRows ? 'upcoming' : 'retrospective';
}

export interface RankedRows {
  promos: ScoredPromoWithTeam[];
  retrospective: boolean;
  /** The year the page names. A number for a plain year (the type the page's
   *  JSX children always had, so the RSC payload keeps its shape), a string
   *  for a span such as "2027-28". */
  label: number | string;
  todayYMD: string;
}

function asLabel(s: string): number | string {
  return /^\d{4}$/.test(s) ? Number(s) : s;
}

/** The label of the UPCOMING list: the calendar year its rows fall in, or,
 *  when they cross New Year, the span written the way a season is named
 *  ("2026-27"). On 2026-11-25 the 192 qualifying NBA and NHL rows ran from
 *  November 2026 to April 2027; labelled by the earliest row alone the page
 *  would have been titled 2026 with three rows in four dated 2027. Dates are
 *  YYYY-MM-DD; an empty list has no label. */
export function upcomingLabel(dates: readonly string[]): number | string {
  const years = dates.map((d) => Number(d.slice(0, 4))).filter((y) => Number.isInteger(y) && y > 0);
  if (years.length === 0) return '';
  const first = Math.min(...years);
  const last = Math.max(...years);
  return last === first ? first : `${first}-${String(last % 100).padStart(2, '0')}`;
}

/** The off-season range: every scored league's window for the most recently
 *  ended season, from the earliest lead-in to the latest end, capped at today. */
export function offSeasonRange(today: string, finals: ReadonlyMap<string, string>): { season: string; label: string; start: string; end: string } | null {
  const ended = mostRecentlyEndedWindow(RANKED_LEAGUES, today, finals);
  if (!ended) return null;
  const same = RANKED_LEAGUES.flatMap((l) => leagueWindows(l)).filter((w) => w.season === ended.season);
  const start = same.reduce((acc, w) => (leadInStart(w) < acc ? leadInStart(w) : acc), leadInStart(ended));
  const lastEnd = same.reduce((acc, w) => (effectiveEnd(w, finals) > acc ? effectiveEnd(w, finals) : acc), effectiveEnd(ended, finals));
  return { season: ended.season, label: seasonName(ended), start, end: lastEnd < today ? lastEnd : today };
}

/** The season in play across the scored leagues, from its earliest lead-in to
 *  today: the retrospective's range when too few rows are ahead and NO scored
 *  league's season has ended (offSeasonRange is null). Null between seasons.
 *  With two seasons in play at once, the one that started first. */
export function inPlayRange(today: string, finals: ReadonlyMap<string, string>): { season: string; label: string; start: string; end: string } | null {
  const playing = RANKED_LEAGUES.flatMap((l) => leagueWindows(l)).filter((w) => leadInStart(w) <= today && today <= effectiveEnd(w, finals));
  if (playing.length === 0) return null;
  const first = playing.reduce((acc, w) => (w.start < acc.start ? w : acc), playing[0]);
  const same = RANKED_LEAGUES.flatMap((l) => leagueWindows(l)).filter((w) => w.season === first.season);
  const start = same.reduce((acc, w) => (leadInStart(w) < acc ? leadInStart(w) : acc), leadInStart(first));
  return { season: first.season, label: seasonName(first), start, end: today };
}

/** The retrospective's range: the most recently ended season, else the season
 *  in play to date, else null (before a table's first lead-in). */
export function retrospectiveRange(today: string, finals: ReadonlyMap<string, string>): { season: string; label: string; start: string; end: string } | null {
  return offSeasonRange(today, finals) ?? inPlayRange(today, finals);
}

/** The leagues a mode's list draws on, as copy: the upcoming list ranks every
 *  league whose promos are scored (PROMO_SCORED_LEAGUE_LIST), the
 *  retrospective the three with a finished season on file (RANKED_LEAGUES).
 *  One helper for both ranked pages, so the head, the capsules and the
 *  JSON-LD cannot name different sets. */
export function rankedLeaguesText(retrospective: boolean): string {
  const list: readonly string[] = retrospective ? RANKED_LEAGUES : PROMO_SCORED_LEAGUE_LIST;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

export const loadRankedRows = cache(async (itemType: string | null): Promise<RankedRows> => {
  const now = new Date();
  const todayYMD = siteYmd(now);
  const endYMD = addDaysYmd(todayYMD, SERVER_FETCH_DAYS);
  const gate = await getCurrentSeasonPredicate(now);
  // /best-promos reads the whole gated window and cuts AFTER the floor, so a
  // theme night never takes a qualifying giveaway's slot under the cap.
  // The bobblehead page reads the same five leagues and lists giveaways only
  // (a bobblehead named in a theme night's description is not a bobblehead
  // giveaway); it has no score floor and no row minimum of its own.
  const forward = itemType
    ? (await getScoredPromosByItemType(todayYMD, endYMD, itemType, Number.MAX_SAFE_INTEGER, gate, PROMO_SCORED_LEAGUES)).filter((p) => p.type === 'giveaway').slice(0, BOBBLEHEAD_FETCH_CAP)
    : (await getScoredPromosInDateRange(todayYMD, endYMD, Number.MAX_SAFE_INTEGER, gate, PROMO_SCORED_LEAGUES)).filter(isBestPromoRow).slice(0, SERVER_FETCH_CAP);
  if (rankedMode(forward.length, itemType ? 1 : RANKED_MIN_UPCOMING_ROWS) === 'upcoming') {
    return { promos: forward, retrospective: false, label: upcomingLabel(forward.map((p) => p.date)), todayYMD };
  }
  // The bobblehead page keeps the range rule it had (ended season or nothing).
  const finals = await getSeasonFinals();
  const range = itemType ? offSeasonRange(todayYMD, finals) : retrospectiveRange(todayYMD, finals);
  if (!range) return { promos: [], retrospective: true, label: '', todayYMD };
  const promos = itemType
    ? await getScoredPromosByItemType(range.start, range.end, itemType, BOBBLEHEAD_FETCH_CAP)
    : await getScoredPromosInDateRange(range.start, range.end, SERVER_FETCH_CAP);
  return { promos, retrospective: true, label: asLabel(range.label), todayYMD };
});
