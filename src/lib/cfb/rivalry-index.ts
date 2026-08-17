// /cfb/rivalries index derivation: the Rivalry Week window, the display order
// and the FAQ. Pure functions over the index rows so the DOM lists, the
// ItemList JSON-LD and every FAQ count read ONE source and cannot drift
// (aggregator plan §4: declared counts must match served DOM counts; no
// hardcoded numbers in copy).

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
}

// The 2026 Rivalry Week window. The BOUNDS are the definition (season year
// hardcoded by house rule — bump deliberately for 2027, never getFullYear());
// everything downstream of them — which games qualify, how many — is derived
// from live rows at render time.
export const RIVALRY_WEEK_START = '2026-11-21';
export const RIVALRY_WEEK_END = '2026-11-29';

/** Dated rows soonest-first, then undated. THE display order: the full DOM
 *  list and the ItemList JSON-LD both consume this exact array. */
export function orderedIndexRows(rows: RivalryIndexRow[]): RivalryIndexRow[] {
  const dated = rows.filter((r) => r.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = rows.filter((r) => !r.date);
  return [...dated, ...undated];
}

/** The Rivalry Week subset in date order. Bounds inclusive; string comparison
 *  is exact on YYYY-MM-DD. */
export function rivalryWeekRows(rows: RivalryIndexRow[]): RivalryIndexRow[] {
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
export function buildRivalryIndexFaqs(rows: RivalryIndexRow[]): RivalryFaq[] {
  const total = rows.length;
  const dated = rows.filter((r) => r.date).length;
  const week = rivalryWeekRows(rows).length;
  const trophies = rows.filter((r) => r.trophy).length;

  const faqs: RivalryFaq[] = [];
  if (total > 0) {
    faqs.push({
      question: 'How many college football rivalries does this page track for 2026?',
      answer: `This page tracks ${total} named college football rivalries. ${dated} of them have a scheduled 2026 meeting, and every rivalry links to a page with the date, the stadium and how to plan the trip.`,
    });
  }
  if (week > 0) {
    faqs.push({
      question: 'When is college football Rivalry Week in 2026?',
      answer: `Rivalry Week is the final weekend of the regular season. ${week} of the ${total} rivalries tracked here are played between November 21 and November 29, 2026, most of them over Thanksgiving weekend.`,
    });
  }
  if (trophies > 0) {
    faqs.push({
      question: 'How many of these rivalries play for a trophy?',
      answer: `${trophies} of the ${total} rivalries listed here play for a named trophy. Series history and trophy details are on each rivalry page.`,
    });
  }
  faqs.push({
    question: 'Where can I find kickoff times and TV channels for these games?',
    answer: 'Each rivalry page shows the kickoff time and the network once they are officially announced. Until then the page lists the kickoff as TBA rather than a guess.',
  });
  return faqs;
}
