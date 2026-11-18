'use client';

import { useEffect, useState } from 'react';
import { countdownAt, firstUpcomingDate } from '@/lib/events/event-pages';

// "94 days away", counted to the first upcoming show in the venue's zone.
// The server prints the label for its own clock (`initial`), so hydration
// cannot mismatch; once mounted this leaf recomputes it from the browser's
// clock, in the VENUE's zone, and again each minute, so a page served from an
// hours-old render never shows yesterday's number to a reader. The stop page
// is also regenerated hourly and by the nightly refresh, which bounds how
// stale the served HTML itself can be. When the day has passed it renders
// nothing (the page's next regeneration moves the show to "Last visit").
export function EventCountdown({ shows, timeZone, initial, className }: { shows: Array<{ date: string; startsAt: string }>; timeZone: string | null; initial: string | null; className?: string }) {
  const [label, setLabel] = useState<string | null>(initial);
  const key = shows.map((s) => s.startsAt).join('|');
  useEffect(() => {
    // WHICH show is first is decided by the clock too: once the first show has
    // started, the count runs to the next one (the server's choice is an hour old at most, but can be older on an idle page).
    const tick = () => { const now = new Date(); setLabel(countdownAt(firstUpcomingDate(shows, now), now, timeZone)); };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeZone]);
  // The element stays in place when the label goes, so nothing shifts.
  return <span className={className} data-event-countdown="">{label ?? ''}</span>;
}
