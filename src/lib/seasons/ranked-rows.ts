import 'server-only';
import { cache } from 'react';
import { getScoredPromosByItemType, getScoredPromosInDateRange } from '../data';
import { addDaysYmd, siteYmd } from '../site-today';
import type { ScoredPromoWithTeam } from '../types';
import { getCurrentSeasonPredicate, getSeasonFinals } from './finals';
import { effectiveEnd, leadInStart, leagueWindows, mostRecentlyEndedWindow, seasonName } from './season-window';

// THE ROWS AND THE YEAR LABEL OF THE SCORE-RANKED PAGES (/best-promos and
// /best-promos/bobbleheads), ruling 2026-11-05 point 4. One loader, wrapped in
// React cache(), so generateMetadata and the page body read the SAME gated rows
// in one fetch and the <title> can never name a year the list does not show.
//
//   Upcoming mode  the season-gated forward window has rows. The label is the
//                  calendar year of the earliest row shown.
//   Off-season     the forward window is empty. The rows are the most recently
//                  ENDED season (src/lib/seasons/windows.json), across every
//                  scored league's window for that season, and the label is
//                  that season's name.
//
// Nothing here reads a hardcoded year or the clock's year: the page flips on
// the first day a scored league's lead-in opens, by data.

export const RANKED_LEAGUES = ['MLB', 'MLS', 'WNBA'] as const;
export const SERVER_FETCH_CAP = 300;
/** /best-promos/bobbleheads fetched up to 500 before the shared loader. */
export const BOBBLEHEAD_FETCH_CAP = 500;
export const SERVER_FETCH_DAYS = 180;

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

export const loadRankedRows = cache(async (itemType: string | null): Promise<RankedRows> => {
  const now = new Date();
  const todayYMD = siteYmd(now);
  const endYMD = addDaysYmd(todayYMD, SERVER_FETCH_DAYS);
  const gate = await getCurrentSeasonPredicate(now);
  const forward = itemType
    ? await getScoredPromosByItemType(todayYMD, endYMD, itemType, BOBBLEHEAD_FETCH_CAP, gate)
    : await getScoredPromosInDateRange(todayYMD, endYMD, SERVER_FETCH_CAP, gate);
  if (forward.length > 0) {
    const earliest = forward.reduce((acc, p) => (p.date < acc ? p.date : acc), forward[0].date);
    return { promos: forward, retrospective: false, label: Number(earliest.slice(0, 4)), todayYMD };
  }
  const range = offSeasonRange(todayYMD, await getSeasonFinals());
  if (!range) return { promos: [], retrospective: true, label: '', todayYMD };
  const promos = itemType
    ? await getScoredPromosByItemType(range.start, range.end, itemType, BOBBLEHEAD_FETCH_CAP)
    : await getScoredPromosInDateRange(range.start, range.end, SERVER_FETCH_CAP);
  return { promos, retrospective: true, label: asLabel(range.label), todayYMD };
});
