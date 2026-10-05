// Year labels for a set of promo dates.
//
// WHY. src/components/promo-list.tsx carried `const SEASON_YEAR = 2026`, and
// src/components/authority-stats.tsx carried its own copy. The comment above
// each correctly rejected getFullYear() (a clock-derived label flips to the
// next season at midnight on Jan 1, months before that season's data exists),
// but the replacement baked in a second assumption: that a season IS a calendar
// year. That holds for MLB, MLS and WNBA. It is false for NHL, NBA and NFL.
//
// Measured on 2026-09-01, Detroit Red Wings:
//
//   heading   "COMPLETED 2026 PROMOS   30 completed events this season"
//   truth     past 30 rows = { 2025: 16, 2026: 14 }
//   upcoming  85 rows = { 2026: 47, 2027: 38 }, 2026-10-02 to 2027-04-09
//   prose     "85 promotional events scheduled across 41 NHL home games in 2026"
//
// N was right, and matched live Firestore on 9 of 9 probed teams. Every word
// around it was wrong.
//
// THE PREDICATE IS THE DATA, NOT THE LEAGUE. It is tempting to branch on
// league, and that would be a bug: houston-dynamo is MLS, nominally a
// single-calendar-year league, and carries 13 rows from the 2025 season that
// the same constant mislabels. What matters is whether the population in hand
// spans more than one calendar year, which is a question about the rows, not
// about the sport.
//
// NO SEASON MODEL IS INVENTED HERE. There is no season concept anywhere in
// src/, and guessing one (an NHL season "is" October to April) would be a new
// assumption in the same shape as the one this replaces. These labels state the
// span the data actually covers and nothing more.
//
// EXCEPT NHL AND NBA, BY RULING (WEB6, 2026-10-05). For those two leagues a
// season is a fact, not a guess: it runs from autumn to the following June and
// both leagues name it with two years ("2026-27"). Treating one calendar year as
// the season put Jan to Apr 2026 rows from the finished 2025-26 season on the
// Heat, Raptors and Wizards pages as "the 2026 season", in the hero counts, the
// list and the FAQ, and labelled last season's archive "this season" on 16
// pages. The split-season helpers below are the whole model: a row belongs to
// the season that starts in the calendar year of its date when the date is on
// or after July 1, and to the season that started the year before otherwise.
// July 1 sits between the last Finals game (June) and the first preseason game
// (late September) in both leagues, so no real game straddles it.
import { TITLE_SEASON_YEAR } from './title-treatment';

/** Leagues whose season spans two calendar years and is named "2026-27". */
const SPLIT_SEASON_LEAGUES = new Set(['NHL', 'NBA']);

/** True for NHL and NBA, in any case ('NHL', 'nhl'). */
export function isSplitSeasonLeague(league: string | null | undefined): boolean {
  return typeof league === 'string' && SPLIT_SEASON_LEAGUES.has(league.toUpperCase());
}

/** First month (1-based) of a split season. July 1 opens the season. */
const SPLIT_SEASON_FIRST_MONTH = 7;

/**
 * The calendar year a split season STARTS in, for a YYYY-MM-DD date:
 * 2026-10-06 and 2027-04-10 are both 2026 (the 2026-27 season); 2026-04-10 is
 * 2025 (the 2025-26 season). Null for a malformed date.
 */
export function splitSeasonStartYear(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return month >= SPLIT_SEASON_FIRST_MONTH ? year : year - 1;
}

/** "2026-27" for 2026, "2099-00" for 2099. */
export function splitSeasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * The season label a page names for its league: "2026-27" on NHL and NBA, the
 * plain TITLE_SEASON_YEAR everywhere else. Hardcoded through TITLE_SEASON_YEAR,
 * never derived from the clock (see title-treatment.ts).
 */
export function currentSeasonLabel(league: string | null | undefined): string {
  return isSplitSeasonLeague(league) ? splitSeasonLabel(TITLE_SEASON_YEAR) : String(TITLE_SEASON_YEAR);
}

export interface SeasonSpan {
  /** Distinct calendar years present, ascending. */
  years: number[];
  /** True when the rows cross a calendar-year boundary. */
  spansYears: boolean;
  /** "2026" for one year, "2025 to 2026" for a span. */
  yearLabel: string;
  /** "November 2025 to April 2026". Null when there is only one month. */
  monthRangeLabel: string | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Month name plus year for a YYYY-MM-DD string, without going through Date:
 *  a bare `new Date('2026-04-09')` parses as UTC midnight and renders as the
 *  previous day in every negative-offset zone. */
function monthYear(ymd: string): string {
  const [y, m] = ymd.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * The calendar-year span of a set of YYYY-MM-DD dates. Null for an empty set,
 * which callers use to fall back to their existing copy rather than render a
 * label over nothing.
 */
export function seasonSpan(dates: readonly string[]): SeasonSpan | null {
  const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (valid.length === 0) return null;
  const years = [...new Set(valid.map((d) => Number(d.slice(0, 4))))].sort((a, b) => a - b);
  const sorted = [...valid].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spansYears = years.length > 1;
  return {
    years,
    spansYears,
    yearLabel: spansYears ? `${years[0]} to ${years[years.length - 1]}` : String(years[0]),
    monthRangeLabel:
      monthYear(first) === monthYear(last) ? null : `${monthYear(first)} to ${monthYear(last)}`,
  };
}

/**
 * Heading for the completed-promos archive.
 *
 * Single-year output is byte-identical to the old SEASON_YEAR string, which is
 * the point: 30 MLB and 15 WNBA team pages must not move.
 */
export function completedHeading(span: SeasonSpan | null): string {
  if (!span) return 'COMPLETED PROMOS';
  return `COMPLETED ${span.yearLabel.toUpperCase()} PROMOS`;
}

/**
 * The line under that heading, for a calendar-year league.
 *
 * "this season" is said ONLY for a single-year archive of the CURRENT season,
 * TITLE_SEASON_YEAR. Every MLB, NFL, MLS and WNBA archive on production
 * 2026-10-05 is exactly that, so their output is unchanged. A single-year
 * archive of an earlier year (a club whose only rows are from 2025) is not
 * "this season" by any reckoning, so it states its count and its months
 * instead (ruling, WEB6 2026-10-05: never "this season" for completed
 * past-season events, in any league). A multi-year archive was already
 * dropping the phrase. Split-season leagues do not come here: their archive
 * is grouped by season in promo-list.tsx with archiveGroups().
 */
export function completedSubline(count: number, span: SeasonSpan | null): string {
  const events = count === 1 ? 'event' : 'events';
  if (!span) return `${count} completed ${events} this season`;
  if (!span.spansYears && span.years[0] === TITLE_SEASON_YEAR) return `${count} completed ${events} this season`;
  return span.monthRangeLabel
    ? `${count} completed ${events}, ${span.monthRangeLabel}`
    : `${count} completed ${events}`;
}

/** One season's block of a split-season archive. */
export interface ArchiveGroup {
  /** The season's start year, e.g. 2025 for 2025-26. */
  startYear: number;
  /** "2025-26". */
  label: string;
  /** True for the season the page names (TITLE_SEASON_YEAR). */
  isCurrent: boolean;
  /** "COMPLETED 2026-27 PROMOS", "LAST SEASON (2025-26)", "2024-25 SEASON". */
  heading: string;
  /** "3 completed events this season" / "22 completed events, October 2025 to April 2026". */
  subline: string;
  /** Indexes into the input array, input order preserved. */
  indexes: number[];
}

/**
 * Group a split-season league's completed rows by season, current season
 * first, then newest to oldest. Only the current season's block says "this
 * season"; the season before it is headed "LAST SEASON (2025-26)" and every
 * older one by its label. Rows with a malformed date fall into no group (the
 * same rows splitPromosByDate already keeps out of `past`).
 */
export function archiveGroups(dates: readonly string[]): ArchiveGroup[] {
  const bySeason = new Map<number, number[]>();
  dates.forEach((d, i) => {
    const y = splitSeasonStartYear(d);
    if (y === null) return;
    const list = bySeason.get(y) ?? [];
    list.push(i);
    bySeason.set(y, list);
  });
  return [...bySeason.keys()]
    .sort((a, b) => b - a)
    .map((startYear) => {
      const indexes = bySeason.get(startYear)!;
      const label = splitSeasonLabel(startYear);
      const isCurrent = startYear === TITLE_SEASON_YEAR;
      const n = indexes.length;
      const events = n === 1 ? 'event' : 'events';
      const span = seasonSpan(indexes.map((i) => dates[i]));
      const heading = isCurrent
        ? `COMPLETED ${label} PROMOS`
        : startYear === TITLE_SEASON_YEAR - 1
          ? `LAST SEASON (${label})`
          : `${label} SEASON`;
      const subline = isCurrent
        ? `${n} completed ${events} this season`
        : span?.monthRangeLabel
          ? `${n} completed ${events}, ${span.monthRangeLabel}`
          : `${n} completed ${events}`;
      return { startYear, label, isCurrent, heading, subline, indexes };
    });
}

/**
 * The time phrase inside the authority prose, e.g. "in 2026" or "between
 * October 2026 and April 2027". Single-year output is byte-identical to the old
 * `in ${SEASON_YEAR}`.
 */
export function scheduledPeriodPhrase(span: SeasonSpan | null): string {
  if (!span) return '';
  if (!span.spansYears || !span.monthRangeLabel) return `in ${span.yearLabel}`;
  return `between ${span.monthRangeLabel.replace(' to ', ' and ')}`;
}

/**
 * The period phrase for a population that is NOT season-resolved, e.g.
 * " between October 2026 and April 2027" for a club whose remaining rows cross
 * a New Year. Leading space included so callers append it without a separator;
 * empty string when the rows carry no usable dates.
 *
 * Sibling of scheduledPeriodPhrase, and separate from it because this one is
 * appended to a clause that has already named its population ("still to come")
 * rather than opening one.
 */
export function remainingPeriodPhrase(dates: readonly string[]): string {
  const span = seasonSpan(dates);
  if (!span) return '';
  if (!span.spansYears || !span.monthRangeLabel) return ` in ${span.yearLabel}`;
  return ` between ${span.monthRangeLabel.replace(' to ', ' and ')}`;
}
