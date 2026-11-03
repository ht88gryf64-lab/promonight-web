import { cleanText } from '@/lib/social-feed/text';
import type { PromoCardRow } from '@/lib/promo-pages';
import { badgeLabel, quantityLine, seriesLine } from '@/lib/promo-page-copy';
import { teamDisplayName } from '@/lib/promo-helpers';
import { formatDayMonD } from '@/lib/promo-share';

// The share card's words (2026-11-03), from the stored row only. Kept out of
// the route file (a route may export only its handlers) and out of the
// drawing (src/lib/share-card-render.tsx), which takes finished strings.

/** "Giveaway · First 10,000", the page's badge and its quantity line. */
export function shareBadge(row: PromoCardRow['row']): string {
  if (row.tombstoned) return 'Removed';
  const q = quantityLine(row);
  return [badgeLabel(row), q ? q.replace(/\s+fans$/, '') : null].filter(Boolean).join(' \u00b7 ');
}

/** The card's game line as matchup and day: "Dallas Stars vs Panthers" and
 *  "Sun Nov 15" (drawn "{lead} · {tail}" when it fits); a series is the team
 *  and its run ("3 home games · Oct 29 to Dec 11, 2026"). Missing parts drop
 *  rather than being invented. */
export function shareCardGame(found: PromoCardRow): { lead: string; tail: string } {
  const { team, row, seriesDates } = found;
  const teamName = cleanText(teamDisplayName(team));
  if (seriesDates.length > 1) return { lead: teamName, tail: seriesLine(seriesDates) };
  const opponent = cleanText(row.displayOpponent);
  return { lead: opponent ? `${teamName} vs ${opponent}` : teamName, tail: formatDayMonD(row.date) };
}
