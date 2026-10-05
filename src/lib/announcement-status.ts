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
import { isSplitSeasonLeague, splitSeasonLabel } from './season-label';
import { TITLE_SEASON_YEAR } from './title-treatment';

/** Days a "haven't announced" verification stays good. */
export const VERIFIED_FOR_DAYS = 14;

/**
 * Clubs verified on the given date to have published NOTHING for the season
 * TITLE_SEASON_YEAR names. Keyed on the team doc id.
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
 * Whether the "haven't announced" claim may be made for this club today:
 * verified, and today within VERIFIED_FOR_DAYS of the verification (the last
 * good day is the date plus VERIFIED_FOR_DAYS - 1).
 */
export function nothingPublishedVerified(teamId: string, today: string): boolean {
  const on = NOTHING_PUBLISHED[teamId];
  if (!on || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS);
}

/**
 * The line above the schedule. `displayName` is the full club name as the page
 * prints it ("New York Knicks", "Utah Mammoth").
 */
export function announcementLine(teamId: string, displayName: string, today: string): string {
  const season = splitSeasonLabel(TITLE_SEASON_YEAR);
  return nothingPublishedVerified(teamId, today)
    ? `The ${displayName} haven't announced ${season} promotions yet.`
    : `PromoNight hasn't recorded any ${displayName} ${season} promotions yet.`;
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
  teamId: string;
  displayName: string;
  today: string;
}): string | null {
  if (!opts.showSchedule || opts.seasonResolved || !isSplitSeasonLeague(opts.league)) return null;
  return announcementLine(opts.teamId, opts.displayName, opts.today);
}
