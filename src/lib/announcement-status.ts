// The one line above the NHL and NBA schedule on a page with no promos for the
// season it names (WEB6, 2026-10-05).
//
// TWO SENTENCES, AND THE DIFFERENCE IS A CLAIM ABOUT A REAL ORGANIZATION.
//
//   "The New York Knicks haven't announced 2026-27 promotions yet."
//       says the CLUB has published nothing. Made only for a club whose own
//       promo surfaces AND news index were checked on the date below and held
//       nothing for 2026-27.
//   "PromoNight hasn't recorded any Golden State Warriors 2026-27 promotions yet."
//       says only that WE have none. The default, and the only safe wording
//       for a club we have not checked, or one that has published and we have
//       not picked it up yet.
//
// The second case is not hypothetical. Of the 18 NHL and NBA clubs with no
// 2026-27 rows on 2026-10-05, five HAD published: Warriors (article 09-30,
// group theme nights page updated 10-05), Celtics (specialty nights and
// bobbleheads, 09-30), Spurs (theme night schedule), Wild (promotional nights
// page, first night Oct 12) and, by secondary report only, Raptors. Saying
// "haven't announced" on any of them would have been false the day it shipped.
//
// THE CLAIM EXPIRES. A club can publish any day, and nothing here would know.
// So a verification holds for VERIFIED_FOR_DAYS after its date and then the
// page falls back to the safe sentence on its own, at render. Re-verifying is
// a dated edit to this table, with the evidence saved beside the previous
// pass (audit-archive/web6-announce/ for this one).
import { isSplitSeasonLeague, splitSeasonLabel, SPLIT_SEASON_START_YEAR } from './season-label';

/** Days a "haven't announced" verification stays good. */
export const VERIFIED_FOR_DAYS = 14;

/** The team page's ISR window, in days (revalidate = 86400 in the route). The
 *  render-time window stops one day early so a page that is requested again
 *  within the day never carries the undated claim past VERIFIED_FOR_DAYS. That
 *  is all it guarantees: ISR here is stale-while-revalidate, so a quiet page can
 *  be served long after, until its next request regenerates it. The sentence
 *  carries its check date for exactly that case (announcementLine). */
const SERVED_STALE_DAYS = 1;

/**
 * Clubs verified on the given date to have published NOTHING for the season
 * SPLIT_SEASON_START_YEAR names. Keyed on the team doc id.
 *
 * Evidence, 2026-10-05 (curl and one Firecrawl scrape; files in
 * ~/promonight/audit-archive/web6-announce/ and season-g0/):
 *   NBA: no 2026-27 promo, theme, giveaway, bobblehead or specialty article in
 *        the club's nba.com news sitemap, and no promo page in its base sitemap
 *        or the configured page serving no 2026-27 dates:
 *        new-york-knicks (theme-nights filter empty; statement-nights now
 *        redirects to /tickets/single), washington-wizards (promo pages still
 *        serve the 2023-24 slate), utah-jazz, brooklyn-nets,
 *        portland-trail-blazers, milwaukee-bucks, oklahoma-city-thunder.
 *   NHL: toronto-maple-leafs (culture hub lists 2025-26 only, slugs end -26),
 *        vancouver-canucks (community-nights still the 2025.26 slate),
 *        utah-hockey-club (no promo page; news lists only the Oct 1 opener).
 *        No promo article on the club's nhl.com news page.
 */
export const NOTHING_PUBLISHED: Readonly<Record<string, string>> = {
  'new-york-knicks': '2026-10-05',
  'washington-wizards': '2026-10-05',
  'utah-jazz': '2026-10-05',
  'brooklyn-nets': '2026-10-05',
  'portland-trail-blazers': '2026-10-05',
  'milwaukee-bucks': '2026-10-05',
  'oklahoma-city-thunder': '2026-10-05',
  'toronto-maple-leafs': '2026-10-05',
  'vancouver-canucks': '2026-10-05',
  'utah-hockey-club': '2026-10-05',
};

/** YYYY-MM-DD plus n days, without a clock or a zone. */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Whether the "haven't announced" claim may be RENDERED for this club today:
 * verified, and today early enough that the page, served for up to
 * SERVED_STALE_DAYS after this render, still sits within VERIFIED_FOR_DAYS of
 * the verification. The last render day is the date plus VERIFIED_FOR_DAYS -
 * SERVED_STALE_DAYS - 1; the last day a visitor can see it is one day later.
 */
export function nothingPublishedVerified(teamId: string, today: string): boolean {
  const on = NOTHING_PUBLISHED[teamId];
  if (!on || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS - SERVED_STALE_DAYS);
}

/**
 * The line above the schedule. `displayName` is the full club name as the page
 * prints it ("New York Knicks", "Utah Mammoth").
 */
export function announcementLine(
  teamId: string,
  displayName: string,
  today: string,
  opts: { hasTicketPackages?: boolean } = {},
): string {
  const season = splitSeasonLabel(SPLIT_SEASON_START_YEAR);
  // A club whose page lists special-ticket packages HAS published something
  // for the season, so "haven't announced" would sit above its own "Ticket
  // packages (N)" group. Only the sentence about our record is safe there.
  return nothingPublishedVerified(teamId, today) && !opts.hasTicketPackages
    ? `The ${displayName} haven't announced ${season} promotions yet (checked ${checkedLabel(NOTHING_PUBLISHED[teamId])}).`
    : `PromoNight hasn't recorded any ${displayName} ${season} promotions yet.`;
}

/** "October 5" for "2026-10-05". The check date rides in the sentence so the
 *  claim stays true as a dated statement however long a cached page is served
 *  (review round 2: ISR here is stale-while-revalidate, so a page can be served
 *  long after the window closes, until its next request regenerates it). */
function checkedLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/**
 * The page-level rule: the line shows only on an NHL or NBA page that is
 * showing the schedule AND has no rows for the season it names. A page whose
 * season resolved has promos for that season, and "hasn't recorded any" would
 * be false on it. Null everywhere else.
 */
export function scheduleStatusLine(opts: {
  league: string;
  showSchedule: boolean;
  seasonResolved: boolean;
  /** The page lists special-ticket packages for the season. */
  hasTicketPackages?: boolean;
  teamId: string;
  displayName: string;
  today: string;
}): string | null {
  if (!opts.showSchedule || opts.seasonResolved || !isSplitSeasonLeague(opts.league)) return null;
  return announcementLine(opts.teamId, opts.displayName, opts.today, { hasTicketPackages: opts.hasTicketPackages });
}
