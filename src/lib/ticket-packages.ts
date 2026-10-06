// Ticket packages on NHL and NBA team pages (WEB6 addendum, 2026-10-05).
//
// THE RULING. A promo the pipeline marks as requiring a special ticket is not a
// theme night, a giveaway or a food deal. It is something a fan BUYS. So on
// these pages it counts in no headline number, no "All N promotions" line, no
// FAQ answer and no structured data, and it is shown in its own group,
// labelled as what it is.
//
// THE SIGNAL is the stored field `ticketPackageRequired === true`, and only on
// NHL and NBA. Those are the two leagues whose scan runs a package pass that
// judges the row before it is written (the Pacers handling: nba-package-
// classifier.js, nhl-package-classifier.js), so on them the field is a verdict.
// On MLB, MLS and WNBA the same field is the extractor's raw first guess, which
// the pipeline itself refuses to act on (promo-diff.js GATED_DEMOTE_LEAGUES),
// and 40 clubs there carry it on rows that are real free nights. Reading it
// there would hide real promotions, and would move pages that must not move.
//
// THE FIELD NEVER REACHES A PAGE. getTeamPromos notes the flagged rows by
// object identity as it maps them (isTicketPackagePromo in src/lib/data.ts),
// and the route splits the array it read with partitionTicketPackages, in one
// synchronous line after the read. The page receives two arrays of ordinary
// Promo objects, so no new key enters any RSC payload, and a page with no
// package rows receives exactly the array it received before, read with
// exactly the same awaits.
import { isUpcomingPromo } from './promo-helpers';

/** Leagues whose stored ticketPackageRequired is a package-pass verdict. */
const TICKET_PACKAGE_LEAGUES: ReadonlySet<string> = new Set(['NHL', 'NBA']);

export function isTicketPackageLeague(league: string | undefined | null): boolean {
  return TICKET_PACKAGE_LEAGUES.has(String(league ?? '').toUpperCase());
}

/** The stored-field test, one place. Only an explicit true counts. */
export function isTicketPackageDoc(data: { ticketPackageRequired?: unknown } | undefined | null): boolean {
  return data?.ticketPackageRequired === true;
}

export interface TicketPackagePartition<T> {
  /** Everything that counts: the array every count site on the page reads. */
  promos: T[];
  /** Special-ticket rows, shown in their own group and counted nowhere else. */
  ticketPackages: T[];
}

/**
 * Splits a team's visible rows. On a league outside TICKET_PACKAGE_LEAGUES, or
 * when no row is flagged, `promos` is the SAME array that came in (identity,
 * not a copy), so nothing downstream can tell the difference.
 */
export function partitionTicketPackages<T>(
  all: T[],
  isPackage: (p: T) => boolean,
  league: string | undefined | null,
): TicketPackagePartition<T> {
  if (!isTicketPackageLeague(league)) return { promos: all, ticketPackages: [] };
  const ticketPackages = all.filter(isPackage);
  if (ticketPackages.length === 0) return { promos: all, ticketPackages };
  return { promos: all.filter((p) => !isPackage(p)), ticketPackages };
}

/** The packages the group shows: still to come, date order. A package whose
 *  date has passed can no longer be bought, and it was never a promotion. */
export function upcomingTicketPackages<T extends { date: string }>(rows: T[], today: string): T[] {
  return rows.filter((p) => isUpcomingPromo(p, today)).sort((a, b) => a.date.localeCompare(b.date));
}

/** The group heading. */
export function ticketPackagesHeading(n: number): string {
  return `Ticket packages (${n})`;
}

/** The line under the heading: what these are, and why the counts above leave
 *  them out. */
export const TICKET_PACKAGES_SUBLINE =
  'Sold as special tickets, so they are not counted as theme nights, giveaways, food deals or kids events on this page.';

/** The sentence every row carries. */
export const TICKET_PACKAGE_ROW_NOTE = 'Comes with a special ticket. Only fans who buy this package get it.';
