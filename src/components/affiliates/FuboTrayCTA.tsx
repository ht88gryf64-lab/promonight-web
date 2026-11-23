'use client';

import { useSyncExternalStore } from 'react';
import { FuboCTA } from './FuboCTA';
import { fuboGamePlayed, type FuboSurface } from '@/lib/affiliates/fubo';

// The team-page away-row Fubo block, CLIENT ONLY (adversarial review
// 2026-11-22, finding 1). GameExpand is not always lazy: CalendarGrid
// server-renders a hidden GameExpand for every date in its prerender window,
// away dates included when the window holds no home date. Ruling 3 says the
// trays' Fubo link is never in served HTML, and the played check reads the
// clock, which in a server render would differ from the hydrating client the
// day after an ISR render. So this renders nothing on the server and during
// hydration (the server snapshot is false), and only after mount reads the
// clock and renders FuboCTA.

const noop = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

type Props = {
  game: { id: string; league: string; date: string; gameTimeTz?: string | null; broadcast?: { network: string } | null };
  surface: FuboSurface;
  teamId: string;
  sport: string;
  promoId: string | null;
  placement: string;
};

export function FuboTrayCTA({ game, surface, teamId, sport, promoId, placement }: Props) {
  const mounted = useMounted();
  if (!mounted || fuboGamePlayed(game)) return null;
  return (
    <FuboCTA
      league={game.league}
      gameId={game.id}
      surface={surface}
      teamId={teamId}
      sport={sport}
      promoId={promoId}
      placement={placement}
      broadcastNetwork={game.broadcast?.network ?? null}
      variant="tray"
    />
  );
}
