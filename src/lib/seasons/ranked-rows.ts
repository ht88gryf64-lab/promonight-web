import 'server-only';
import { cache } from 'react';
import { getScoredPromosByItemType, getScoredPromosInDateRange } from '../data';
import { addDaysYmd, siteYmd } from '../site-today';
import type { ScoredPromoWithTeam } from '../types';
import { isBestPromoRow } from '../scoring-weights';
import { getCurrentSeasonPredicate, getSeasonFinals } from './finals';
import { effectiveEnd, leadInStart, leagueWindows, mostRecentlyEndedWindow, seasonName } from './season-window';

// THE ROWS AND THE YEAR LABEL OF THE SCORE-RANKED PAGES (/best-promos and
// /best-promos/bobbleheads), ruling 2026-11-05 point 4. One loader, wrapped in
// React cache(), so generateMetadata and the page body read the SAME gated rows
// in one fetch and the <title> can never name a year the list does not show.
//
//   Upcoming mode  the season-gated forward window has ENOUGH rows (below).
//                  The label is the calendar year of the earliest row shown.
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
// /best-promos/bobbleheads is unchanged: every forward row, and one is enough.

export const RANKED_LEAGUES = ['MLB', 'MLS', 'WNBA'] as const;
export const SERVER_FETCH_CAP = 300;
/** /best-promos/bobbleheads fetched up to 500 before the shared loader. */
export const BOBBLEHEAD_FETCH_CAP = 500;
export const SERVER_FETCH_DAYS = 180;
/** Qualifying upcoming rows /best-promos needs before it leaves the retrospective.
 *  2026-11-25 simulation at the floor of 65: the count fell under 10 on 2026-10-18 and goes from 0 to 71 the day the MLB 2027 lead-in opens, so 10 ends the 25 thin days (1 to 9 rows) of autumn 2026 and costs nothing in spring. */
export const RANKED_MIN_UPCOMING_ROWS = 10;

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

export const loadRankedRows = cache(async (itemType: string | null): Promise<RankedRows> => {
  const now = new Date();
  const todayYMD = siteYmd(now);
  const endYMD = addDaysYmd(todayYMD, SERVER_FETCH_DAYS);
  const gate = await getCurrentSeasonPredicate(now);
  // /best-promos reads the whole gated window and cuts AFTER the floor, so a
  // theme night never takes a qualifying giveaway's slot under the cap.
  const forward = itemType
    ? await getScoredPromosByItemType(todayYMD, endYMD, itemType, BOBBLEHEAD_FETCH_CAP, gate)
    : (await getScoredPromosInDateRange(todayYMD, endYMD, Number.MAX_SAFE_INTEGER, gate)).filter(isBestPromoRow).slice(0, SERVER_FETCH_CAP);
  if (rankedMode(forward.length, itemType ? 1 : RANKED_MIN_UPCOMING_ROWS) === 'upcoming') {
    const earliest = forward.reduce((acc, p) => (p.date < acc ? p.date : acc), forward[0].date);
    return { promos: forward, retrospective: false, label: Number(earliest.slice(0, 4)), todayYMD };
  }
  const range = retrospectiveRange(todayYMD, await getSeasonFinals());
  if (!range) return { promos: [], retrospective: true, label: '', todayYMD };
  const promos = itemType
    ? await getScoredPromosByItemType(range.start, range.end, itemType, BOBBLEHEAD_FETCH_CAP)
    : await getScoredPromosInDateRange(range.start, range.end, SERVER_FETCH_CAP);
  return { promos, retrospective: true, label: asLabel(range.label), todayYMD };
});
