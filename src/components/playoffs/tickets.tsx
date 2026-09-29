import type { ReactNode } from 'react';
import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import type { TicketsBlockPlacement } from '@/components/affiliates/TicketsBlock';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';

/**
 * Ticket buttons for each host club, rendered once per club on the server
 * and handed to the lists by club id.
 *
 * Tagging is the TicketsBlock tagging: the page's surface, a playoffs
 * placement, and the sub-ID the builders compose from the surface and the
 * club. The inline layout is used because a row of games is a dense context;
 * it needs the `@container/cta` wrapper rendered here.
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
      <div data-tickets-for={id} className="@container/cta flex items-stretch gap-1.5">
        <TicketmasterCTA team={team} surface={surface} placement={placement} layout="inline" />
      </div>
    );
  }
  return out;
}
