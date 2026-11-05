// THE COLLEGE FOOTBALL SEASON THE CFB PAGES NAME (season rollover, ruling
// 2026-11-05): from src/lib/seasons/windows.json, never a hardcoded 2026 and
// never the clock's year. The CFB season runs from Week 0 in late August to
// the CFP title game in January, so a calendar year would flip every title on
// January 1 while the 2026 bowls are still being played.
import { labeledSeason, seasonLabel } from '../seasons/season-window';
import { siteTodayYmd } from '../site-today';

/** "2026": the season every CFB title, heading and FAQ names on `today`. */
export function cfbSeasonLabel(today: string = siteTodayYmd()): string {
  return seasonLabel('CFB', today);
}

/**
 * A school's conference for the season the pages name. The school docs key
 * conferences by season ("2026"); when the named season has no entry yet (the
 * next season's lead-in opens before realignment data is written), the latest
 * earlier season's conference is used rather than printing nothing.
 */
export function conferenceForNamedSeason(
  bySeason: Readonly<Record<string, string>> | null | undefined,
  today: string = siteTodayYmd(),
): string | undefined {
  if (!bySeason) return undefined;
  const key = labeledSeason('CFB', today).season;
  if (bySeason[key]) return bySeason[key];
  const earlier = Object.keys(bySeason).filter((k) => k <= key && bySeason[k]).sort();
  return earlier.length > 0 ? bySeason[earlier[earlier.length - 1]] : undefined;
}
