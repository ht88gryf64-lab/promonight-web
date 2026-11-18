'use client';

import { useEffect, useState, type ReactNode } from 'react';

// "A performance past its start time loses its button BY THE CLOCK."
// The stop page is ISR (an hour), so the server HTML can show a Tickets
// button for a show that started since the page was rendered. This leaf
// closes that gap in the browser: it renders the server's state unchanged
// (so hydration cannot mismatch), then, once mounted, swaps to `started` at
// the show's start instant, or at once when that instant has already passed.
// The next regeneration then moves the row to "Last visit" on the server.
export function ShowtimeGate({ startsAt, children, started }: { startsAt: string; children: ReactNode; started: ReactNode }) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const at = Date.parse(startsAt);
    if (!Number.isFinite(at)) return;
    const wait = at - Date.now();
    if (wait <= 0) { setPast(true); return; }
    // setTimeout holds at most about 24.8 days; a later show re-arms on the next visit.
    if (wait > 2_000_000_000) return;
    const t = setTimeout(() => setPast(true), wait);
    return () => clearTimeout(t);
  }, [startsAt]);
  return <>{past ? started : children}</>;
}
