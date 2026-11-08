// The date tile's state line (docs/per-promo-pages-v2-spec.md, Visuals 2):
// "Tonight · gates 5:30 PM" when the game is today in the venue's zone and a
// door time is stored, "Tonight" when none is, "Tomorrow", else "In N days"
// however far out (ruling 2026-11-08: never the weekday, which the tile
// already prints). A played date has no state line; the header says so.
// Pure: the caller supplies the instant (the route's one clock read) and the
// zone (the game's, else the building's, else the site's).

import { SITE_TIME_ZONE } from './site-today';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The calendar day of `instant` in `timeZone`, YYYY-MM-DD; the site's zone
 *  when the zone is unknown to the runtime. */
export function ymdInZone(instant: Date, timeZone: string | null | undefined): string {
  const fmt = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  if (timeZone && timeZone.includes('/')) {
    try {
      return fmt(timeZone);
    } catch {
      /* unknown zone: fall through */
    }
  }
  return fmt(SITE_TIME_ZONE);
}

export function daysBetweenYmd(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

export function weekdayName(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export interface DateTileState {
  kind: 'tonight' | 'tomorrow' | 'soon';
  label: string;
}

export function dateTileState(ymd: string, venueToday: string, doors: string | null): DateTileState | null {
  if (!YMD.test(ymd) || !YMD.test(venueToday)) return null;
  const d = daysBetweenYmd(venueToday, ymd);
  if (d < 0) return null;
  if (d === 0) return { kind: 'tonight', label: doors ? `Tonight · gates ${doors}` : 'Tonight' };
  if (d === 1) return { kind: 'tomorrow', label: 'Tomorrow' };
  return { kind: 'soon', label: `In ${d} days` };
}
