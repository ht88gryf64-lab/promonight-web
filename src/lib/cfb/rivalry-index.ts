// /cfb/rivalries index derivation: the Rivalry Week window, the display order
// and the FAQ. Pure functions over the index rows so the DOM lists, the
// ItemList JSON-LD and every FAQ count read ONE source and cannot drift
// (aggregator plan §4: declared counts must match served DOM counts; no
// hardcoded numbers in copy).

import { cfbSeasonLabel } from './season';
export interface RivalryIndexRow {
  slug: string;
  name: string;
  /** YYYY-MM-DD of the 2026 meeting, or null when the rivalry is dormant. */
  date: string | null;
  matchup: string;
  /** Stadium the 2026 game is played in (campus via the home school, venueHubs
   *  for a neutral site). Plain text on the index, never a link, so it carries
   *  no indexability gate and cannot overstate what the detail page links. */
  venueName: string | null;
  /** cfbRivalries.trophy verbatim; null when the doc has none. Rendered only
   *  when present — never "no trophy", never inferred. */
  trophy: string | null;
  /** Each side's cfbSchools.primaryColor, in schoolIds order. null for an
   *  untracked school or a missing color — the card then renders the single
   *  neutral spine instead of a two-color split. Never inferred. */
  colors: [string | null, string | null];
}

// The 2026 Rivalry Week window. The BOUNDS are the definition (season year
// hardcoded by house rule — bump deliberately for 2027, never getFullYear());
// everything downstream of them — which games qualify, how many, and the
// dates the page names — is derived from live rows at render time.
//
// Thanksgiving week, Thursday to Saturday (ruling 2026-11-10, Gate 1 option
// a). The page never prints these bounds: it prints the first and last
// stored game date inside them (rivalryWeekRange), so a game a verification
// moves moves the copy with it. Big Game (Nov 21 in the 2026 data) sits
// outside the window and stays in the full list.
export const RIVALRY_WEEK_START = '2026-11-26';
export const RIVALRY_WEEK_END = '2026-11-28';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The stored game dates inside the window, distinct and ascending. Null when
 *  no row falls in it: every surface then drops its dates rather than print
 *  the bounds. */
export interface RivalryWeekRange {
  start: string;
  end: string;
  /** Every distinct game day, ascending (start and end included). */
  days: string[];
}

export function rivalryWeekRange(rows: ReadonlyArray<{ date: string | null }>): RivalryWeekRange | null {
  const days = [...new Set(rivalryWeekRows(rows).map((r) => r.date!))].sort();
  if (days.length === 0) return null;
  return { start: days[0], end: days[days.length - 1], days };
}

const ymdParts = (ymd: string) => ({ y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(5, 7)), d: Number(ymd.slice(8, 10)) });
const weekdayOf = (ymd: string) => {
  const { y, m, d } = ymdParts(ymd);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
};
const shortMonth = (ymd: string) => MONTH_NAMES[ymdParts(ymd).m - 1].slice(0, 3);
/** "Saturday, November 28". No zone arithmetic: a YYYY-MM-DD is a calendar day. */
const longDay = (ymd: string) => `${weekdayOf(ymd)}, ${MONTH_NAMES[ymdParts(ymd).m - 1]} ${ymdParts(ymd).d}`;

/** The title and H1 form: "Nov 27-28", "Nov 28", "Nov 30-Dec 1". A plain
 *  hyphen, as the approved title has it (no en or em dash). */
export function rivalryWeekShort(range: RivalryWeekRange): string {
  const a = ymdParts(range.start);
  const b = ymdParts(range.end);
  if (range.start === range.end) return `${shortMonth(range.start)} ${a.d}`;
  if (a.m === b.m) return `${shortMonth(range.start)} ${a.d}-${b.d}`;
  return `${shortMonth(range.start)} ${a.d}-${shortMonth(range.end)} ${b.d}`;
}

/** The sentence form: "Friday, November 27 and Saturday, November 28" for one
 *  or two game days, "Thursday, November 26 to Saturday, November 28" for
 *  three or more. */
export function rivalryWeekLong(range: RivalryWeekRange): string {
  if (range.days.length === 1) return longDay(range.start);
  if (range.days.length === 2) return `${longDay(range.days[0])} and ${longDay(range.days[1])}`;
  return `${longDay(range.start)} to ${longDay(range.end)}`;
}

/** Rivalry Week is over: `today` (YYYY-MM-DD, the site's day) is past the
 *  window's last bound (Gate 3 follow-up, ruling 2026-11-10). */
export function rivalryWeekPast(today: string): boolean {
  return today > RIVALRY_WEEK_END;
}

/** The page's answer sentence, shared by the lede, the meta description and
 *  the FAQ so the three can never name different days. Past tense once
 *  `today` is past the window ("... was Friday, November 27 ..."). */
export function rivalryWeekAnswer(range: RivalryWeekRange, today: string): string {
  return `College football Rivalry Week ${cfbSeasonLabel()} ${rivalryWeekPast(today) ? 'was' : 'is'} ${rivalryWeekLong(range)}.`;
}

/** The H1 (and <title>) in parts, so the page can style the year and the
 *  dates while the textContent stays exactly the title:
 *  "College Football Rivalry Week 2026: Nov 27-28". With no game in the
 *  window there are no dates and the page keeps its index heading. */
export function rivalryIndexHeading(rows: ReadonlyArray<{ date: string | null }>): { lead: string; season: string; dates: string | null } {
  const range = rivalryWeekRange(rows);
  if (!range) return { lead: 'College Football Rivalries', season: cfbSeasonLabel(), dates: null };
  return { lead: 'College Football Rivalry Week', season: cfbSeasonLabel(), dates: rivalryWeekShort(range) };
}

export function headingText(h: { lead: string; season: string; dates: string | null }): string {
  return h.dates ? `${h.lead} ${h.season}: ${h.dates}` : `${h.lead} ${h.season}`;
}

/** Dated rows soonest-first, then undated. THE display order: the full DOM
 *  list and the ItemList JSON-LD both consume this exact array. */
export function orderedIndexRows(rows: RivalryIndexRow[]): RivalryIndexRow[] {
  const dated = rows.filter((r) => r.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = rows.filter((r) => !r.date);
  return [...dated, ...undated];
}

/** The Rivalry Week subset in date order. Bounds inclusive; string comparison
 *  is exact on YYYY-MM-DD. */
export function rivalryWeekRows<T extends { date: string | null }>(rows: ReadonlyArray<T>): T[] {
  return rows
    .filter((r) => r.date && r.date >= RIVALRY_WEEK_START && r.date <= RIVALRY_WEEK_END)
    .sort((a, b) => a.date!.localeCompare(b.date!));
}

export interface RivalryFaq {
  question: string;
  answer: string;
}

/** FAQ with every count derived from the rows the DOM renders. A question whose
 *  count would be zero is omitted rather than shipped with a hollow claim. */
export function buildRivalryIndexFaqs(rows: RivalryIndexRow[], today: string): RivalryFaq[] {
  const total = rows.length;
  const dated = rows.filter((r) => r.date).length;
  const week = rivalryWeekRows(rows).length;
  const trophies = rows.filter((r) => r.trophy).length;

  const faqs: RivalryFaq[] = [];
  if (total > 0) {
    faqs.push({
      question: `How many college football rivalries does this page track for ${cfbSeasonLabel()}?`,
      answer: `This page tracks ${total} named college football rivalries. ${dated} of them have a scheduled ${cfbSeasonLabel()} meeting, and every rivalry links to a page with the date, the stadium and how to plan the trip.`,
    });
  }
  const range = rivalryWeekRange(rows);
  if (week > 0 && range) {
    faqs.push({
      question: `When is college football Rivalry Week in ${cfbSeasonLabel()}?`,
      answer: `${rivalryWeekAnswer(range, today)} ${week} of the ${total} rivalries tracked here ${rivalryWeekPast(today) ? 'were' : 'are'} played ${range.days.length === 1 ? 'that day' : 'on those days'}.`,
    });
  }
  if (trophies > 0) {
    faqs.push({
      question: 'How many of these rivalries play for a trophy?',
      answer: `${trophies} of the ${total} rivalries listed here play for a named trophy. Each rivalry page shows the year the series began, and the trophy where there is one.`,
    });
  }
  faqs.push({
    question: 'Where can I find kickoff times and TV channels for these games?',
    answer: 'Each rivalry page shows the kickoff time and the network once they are officially announced. Until then the page lists the kickoff as TBA rather than a guess.',
  });
  return faqs;
}

// ── presentational grouping (visual pass) ────────────────────────────────────
// Groups are PRESENTATIONAL ONLY: they partition the exact arrays the DOM
// already renders, so total row count, order within a group, and the ItemList
// (which reads the ungrouped ordered array) cannot change. Header counts are
// group lengths — derived, never hardcoded.

export interface RowGroup {
  /** Stable key (YYYY-MM-DD for days, YYYY-MM for months, 'unscheduled'). */
  key: string;
  /** Header label, e.g. "Friday" / "November". */
  label: string;
  /** Header sub-label, e.g. "Nov 27" for a day; '' for months. */
  subLabel: string;
  rows: RivalryIndexRow[];
}

function fmt(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', opts);
}

/** Rivalry Week rows partitioned by calendar day, in the order rivalryWeekRows
 *  returns them. Concatenating group rows reproduces the input exactly. */
export function groupRivalryWeekByDay(rows: RivalryIndexRow[]): RowGroup[] {
  const week = rivalryWeekRows(rows);
  const groups: RowGroup[] = [];
  for (const r of week) {
    const last = groups[groups.length - 1];
    if (last && last.key === r.date) {
      last.rows.push(r);
    } else {
      groups.push({
        key: r.date!,
        // Mockup day-label shape: "Sat, Nov 21".
        label: fmt(r.date!, { weekday: 'short' }),
        subLabel: fmt(r.date!, { month: 'short', day: 'numeric' }),
        rows: [r],
      });
    }
  }
  return groups;
}

/** The FULL ordered list partitioned by month (undated rows last under one
 *  'unscheduled' group). Consumes orderedIndexRows' exact output, so
 *  concatenating group rows is byte-identical to the ungrouped list the
 *  ItemList JSON-LD reads. */
export function groupIndexByMonth(orderedRows: RivalryIndexRow[]): RowGroup[] {
  const groups: RowGroup[] = [];
  for (const r of orderedRows) {
    const key = r.date ? r.date.slice(0, 7) : 'unscheduled';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(r);
    } else {
      groups.push({
        key,
        label: r.date ? fmt(r.date, { month: 'long' }) : 'Not scheduled',
        subLabel: '',
        rows: [r],
      });
    }
  }
  return groups;
}
