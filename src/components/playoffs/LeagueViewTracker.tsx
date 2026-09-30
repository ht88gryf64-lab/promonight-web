'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import { whenSinksReady } from './when-sinks-ready';

/**
 * Sends playoffs_league_view once for the page. Renders nothing. `phase` is
 * what the body rendered.
 *
 * Sent when both analytics sinks can take it, not from a bare mount effect:
 * see when-sinks-ready.ts. The cleanup cancels a send that has not happened
 * yet, so a client-side move to another page inside the wait is not counted
 * against this one.
 */
export function LeagueViewTracker({
  league,
  season,
  phase,
  roundKey,
}: {
  league: string;
  season: number;
  phase: 'active' | 'concluded';
  roundKey: string | null;
}) {
  useEffect(
    () =>
      whenSinksReady(() => {
        track('playoffs_league_view', { surface: 'web_playoffs_league', league, season, phase, round_key: roundKey });
      }),
    [league, season, phase, roundKey],
  );
  return null;
}
