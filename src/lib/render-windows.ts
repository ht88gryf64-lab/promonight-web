// Two slicing rules that decide what reaches the SERVER-RENDERED HTML on a team
// page. Both are pure and live here, outside their 'use client' consumers, so
// they can be tested as arithmetic rather than through a DOM render. Both got
// their own defect during the season-scope change and neither had coverage.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcMs(ymd: string): number | null {
  if (!YMD_RE.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export interface PrerenderWindowOptions {
  /** Every game date on the schedule, with whether that date is a home date. */
  days: readonly { date: string; isHome: boolean }[];
  /** Today as YYYY-MM-DD. */
  today: string;
  windowDays: number;
  max: number;
  /** Prefer home dates. A TRIM, never a blackout; see below. */
  homeOnly: boolean;
}

/**
 * Which game dates get a prerendered detail block.
 *
 * The window exists so crawlers see a schedule without the page carrying a
 * detail block for all 163 games. `homeOnly` was added because away blocks
 * carry the OPPONENT's promos, and on the Dodgers page they occupied roughly
 * 430 of the 1,090 extractable text lines that precede that team's own promo
 * list.
 *
 * THE FLOOR IS THE SUBTLE PART. Filtering to home dates unconditionally would
 * leave a club on a long road trip, or one whose next home date is 31+ days
 * out, with ZERO prerendered detail: a blackout, not a trim, and the opposite
 * of the window's purpose. So when the window contains no home date, every date
 * in it is kept. Away days that fall out of the window still expand on click
 * through the lazy-mount branch, and the click still fires game_tap and
 * away_game_expanded either way.
 */
export function prerenderWindowDates({
  days,
  today,
  windowDays,
  max,
  homeOnly,
}: PrerenderWindowOptions): Set<string> {
  const startMs = utcMs(today);
  if (startMs === null) return new Set();
  const endMs = startMs + windowDays * 86_400_000;

  const inWindow: string[] = [];
  const homeInWindow: string[] = [];
  for (const day of days) {
    const ms = utcMs(day.date);
    if (ms === null || ms < startMs || ms > endMs) continue;
    inWindow.push(day.date);
    if (day.isHome) homeInWindow.push(day.date);
  }

  const chosen = homeOnly && homeInWindow.length > 0 ? homeInWindow : inWindow;
  return new Set([...chosen].sort().slice(0, max));
}

export interface CompletedSplit<T> {
  /** Lifted resale rows. The ONLY server-rendered rows carrying the eBay CTA. */
  resale: T[];
  /** Extra server-rendered rows, added only on a season-scoped page. No CTA. */
  ssr: T[];
  /** Everything else, behind the expander, count in the button label. */
  collapsed: T[];
}

/**
 * Partition the completed archive into what is server-rendered and what is not.
 *
 * The three groups are a PARTITION of `past`: every row appears exactly once,
 * in original order within its group. That property is the whole point, because
 * the earlier version of this slicing silently handed the `ssr` rows a resale
 * slot as well, taking the server-rendered affiliate surface from a documented
 * three to as many as eleven.
 *
 * `ssrCount` is 0 unless the page published a season count. Completed rows are
 * otherwise client-mounted to keep data-rich pages under Bing's 1 MB HTML
 * ceiling, and that constraint is unchanged.
 */
export function splitCompletedForRender<T>(
  past: readonly T[],
  isResaleCandidate: (row: T) => boolean,
  resaleLift: number,
  ssrCount: number,
): CompletedSplit<T> {
  const resale = past.filter(isResaleCandidate).slice(0, resaleLift);
  const rest = resale.length > 0 ? past.filter((p) => !resale.includes(p)) : [...past];
  const ssr = rest.slice(0, Math.max(0, ssrCount));
  return { resale, ssr, collapsed: rest.slice(ssr.length) };
}
