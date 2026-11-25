'use client';

// TICKET PARTNER TEST (2026-11-25): how the server's resolution reaches the
// ticket cards inside client trees (the schedule rows, the calendar and the
// promo modal build their cards in the browser).
//
// The SERVER resolves the team's partner and phase on its one clock read
// (resolveTicketTest in the team page route) and hands the result to
// TicketTestProvider. Nothing here reads a clock or calls the resolver, so a
// card can never flip on a visitor's own date.
//
// NO PROVIDER, NO TEST. Only a test team's own team page mounts the provider.
// The homepage modal reuses the same game expand without one, so its cards
// render exactly as before (Gate 0 ruling 2), and so does every other page.
import { createContext, useContext, type ReactNode } from 'react';
import type { TicketTestResolution } from '@/lib/ticket-test';
import { TicketsBlock, type TicketsBlockProps } from './TicketsBlock';

export interface TicketTestPageValue {
  test: TicketTestResolution;
  /** The team's next home game's StubHub event page, for a card that belongs
   *  to no single game. Null when the team has none matched. */
  teamStubHubEventUrl: string | null;
}

const TicketTestCtx = createContext<TicketTestPageValue | null>(null);

export function TicketTestProvider({ value, children }: { value: TicketTestPageValue | null; children: ReactNode }) {
  return <TicketTestCtx.Provider value={value}>{children}</TicketTestCtx.Provider>;
}

/** TicketsBlock for the game expand: on a test team's page it follows the page
 *  team's partner (away rows included, by ruling 3); anywhere else it is
 *  TicketsBlock with the props it was given. `gameStubHubEventUrl` is the
 *  row's own game (Game.shEventUrl); a block that belongs to no game passes
 *  `teamLevel` and gets the team's next home game. */
export function GameTicketsBlock({ gameStubHubEventUrl = null, teamLevel = false, ...props }: TicketsBlockProps & { gameStubHubEventUrl?: string | null; teamLevel?: boolean }) {
  const page = useContext(TicketTestCtx);
  if (!page) return <TicketsBlock {...props} />;
  return <TicketsBlock {...props} ticketTest={page.test} stubHubEventUrl={teamLevel ? page.teamStubHubEventUrl : gameStubHubEventUrl} />;
}
