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
 * The line under that heading.
 *
 * "this season" is kept for a single-year archive, unchanged. It is dropped for
 * a multi-year one, because that archive is not one season by the page's own
 * reckoning and saying so was the second half of the same false claim.
 */
export function completedSubline(count: number, span: SeasonSpan | null): string {
  const events = count === 1 ? 'event' : 'events';
  if (!span || !span.spansYears) return `${count} completed ${events} this season`;
  return span.monthRangeLabel
    ? `${count} completed ${events}, ${span.monthRangeLabel}`
    : `${count} completed ${events}`;
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
