import type { ReactNode } from 'react';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { TicketsBlock, type TicketsBlockPlacement } from '@/components/affiliates/TicketsBlock';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';

/**
 * One ticket button for each host club, rendered once per club on the server
 * and handed to the home games rows by club id.
 *
 * One button, not two: the partner that leads the ticket stack. Tagging is
 * the TicketsBlock tagging: the page's surface, a playoffs placement, and
 * the sub-ID the builders compose from the surface and the club.
 */
export function ticketButtons(
  hostIds: readonly string[],
  teams: ReadonlyMap<string, Team>,
  surface: AnalyticsSurface,
  placement: TicketsBlockPlacement,
): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const id of new Set(hostIds)) {
    const team = teams.get(id);
    if (!team) continue;
    out[id] = (
      <div data-tickets-for={id}>
        <TicketmasterCTA team={team} surface={surface} placement={placement} size="compact" primaryOnly />
      </div>
    );
  }
  return out;
}

/**
 * The ticket block for a series' detail: the host of its next game.
 * Keyed by the page's series id. A series with no game ahead, or whose next
 * host is not yet a club, has no entry.
 */
export function seriesTickets(
  series: readonly { id: string; hostTeamId: string | null }[],
  teams: ReadonlyMap<string, Team>,
  surface: AnalyticsSurface,
  placement: TicketsBlockPlacement,
): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const s of series) {
    if (!s.hostTeamId) continue;
    const team = teams.get(s.hostTeamId);
    if (!team) continue;
    out[s.id] = (
      <div data-tickets-for={s.hostTeamId}>
        <TicketsBlock team={team} surface={surface} placement={placement} variant="card" />
      </div>
    );
  }
  return out;
}
