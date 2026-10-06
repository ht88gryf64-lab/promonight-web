// THE SITE'S ONE "TODAY" (WEB6 G3, 2026-10-06).
//
// Every surface that decides what is upcoming, what is tonight and what has
// passed reads its calendar day from here, in America/New_York, the zone the
// site already states its times in ("All times are Eastern"). Before this, the
// team pages used the UTC day, the homepage, hubs and aggregators used the
// Chicago day, a few aggregators used the server's local day (UTC on Vercel),
// and My Teams and the calendar ring used the visitor's device. Between 00:00
// and 05:00 UTC those disagree: on the evening of 2026-10-05 the /nhl card
// counted 37 Penguins promotions ahead while the Penguins page counted 36, and
// the arena hub's "Team Calendar" link pointed at a row the team page no
// longer listed as upcoming.
//
// PURE AND CLIENT-SAFE: no server-only import, so client components (the
// calendar ring, My Teams) read the same day as the server render.
//
// CACHED COPIES. This fixes which day each render uses, so pages rendered on
// the same Eastern day agree. It does not make cached copies expire together:
// a team page (24h ISR), /nhl (6h) and a venue hub (24h) rendered on opposite
// sides of Eastern midnight can still disagree until the older copy is
// regenerated. Only /promos/today is refreshed just after midnight (05:10 UTC
// cron); refreshing the others nightly is a separate cost decision.
//
// NOT A RULE FOR GAME DAYS. A game's own calendar day stays where it is played
// or as the schedule states it (src/lib/cfb/clock.ts venueTodayYMD,
// src/lib/nfl-week.ts gameEtYmd). This module is the day the SITE is on.

/** The zone of the site's calendar day. */
export const SITE_TIME_ZONE = 'America/New_York';

const SITE_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The site's calendar day (YYYY-MM-DD) at an instant. */
export function siteYmd(instant: Date): string {
  const parts = SITE_YMD.formatToParts(instant);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Today on the site, YYYY-MM-DD, America/New_York. */
export function siteTodayYmd(now: Date = new Date()): string {
  return siteYmd(now);
}

/** Calendar arithmetic on a YYYY-MM-DD string. Pure day math in UTC, so it is
 *  DST-safe: it never touches a wall clock. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The site's day `days` after today (negative for before). */
export function siteTodayPlusDays(days: number, now: Date = new Date()): string {
  const today = siteTodayYmd(now);
  return days ? addDaysYmd(today, days) : today;
}

/** The last day of the month a YYYY-MM-DD falls in. */
export function endOfMonthYmd(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
