/* eslint-disable no-console */
// Sports-Reference PENDING-PUBLISH corroborator (decision record §1, §6.1, §7).
//
// The sweep proved SR is render-confirmed reachable via Firecrawl (2025 pages parse
// for all 86) but has 0/86 2026 schedules published this far out — every
// 2026-schedule.html 404s. SR ALSO blocks plain `fetch` (403), so — unlike the
// Wikipedia corroborator, which is a free code fetch — SR can only be reached
// through the Firecrawl layer. That makes an every-run SR probe cost 86 credits to
// confirm a known 404, so SR stays DISABLED by default and is re-probed on the
// in-season cadence. When SR publishes 2026, flip SR_2026_ENABLED: the same code
// lights up an independent domain (a 3rd source, or the 2nd source for the 4 G5
// schools whose Wikipedia 2026 page is not yet created). NOT relied on now.

import { fetchMarkdown, type FirecrawlClient } from './firecrawl-fetch';

// Flip to true only after a re-probe confirms SR has published 2026 schedules.
// Until then run-phase2 never calls SR, so it contributes nothing and never blocks.
export const SR_2026_ENABLED = false;

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export interface SrSchedule {
  url: string;
  fetched: boolean; // Firecrawl returned content
  available: boolean; // content parsed with >=1 row for `season`
  reason: string | null;
  byDate: Map<string, { opp: string; time: string }>;
}

/** Fetch the school's SR schedule page for `season` VIA FIRECRAWL (SR blocks plain
 *  fetch) and parse date+opponent rows from the markdown. opts.client injects a
 *  mock for zero-credit tests. Returns available:false on a 404 (2026 unpublished). */
export async function fetchSrSchedule(
  sportsRefSlug: string,
  opts: { client?: FirecrawlClient; season?: number } = {},
): Promise<SrSchedule> {
  const season = opts.season ?? 2026;
  const url = `https://www.sports-reference.com/cfb/schools/${sportsRefSlug}/${season}-schedule.html`;
  const byDate = new Map<string, { opp: string; time: string }>();
  const res = await fetchMarkdown(url, opts.client ? { client: opts.client } : {});
  if (res.ok === false) return { url, fetched: false, available: false, reason: res.reason, byDate };

  // Parse "Sep 5, 2026 ... Opponent" style rows from the rendered markdown. SR
  // markdown lists each game with the full date; keep only `season` rows.
  for (const line of res.markdown.split('\n')) {
    const dm = line.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (!dm || Number(dm[3]) !== season) continue;
    const mm = MONTHS[dm[1].toLowerCase().slice(0, 3)];
    if (!mm) continue;
    const iso = `${season}-${mm}-${String(parseInt(dm[2], 10)).padStart(2, '0')}`;
    // opponent = first linked/proper-noun token after the date (best-effort; SR
    // 2026 is dormant, so this is validated for real when SR publishes)
    const after = line.slice(dm.index! + dm[0].length);
    const oppM = after.match(/([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,3})/);
    const timeM = line.match(/\b(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\b/i);
    if (!byDate.has(iso)) byDate.set(iso, { opp: oppM ? oppM[1].trim() : '', time: timeM ? timeM[1] : 'TBD' });
  }
  const available = byDate.size > 0;
  return { url, fetched: true, available, reason: available ? null : 'no rows for season', byDate };
}
