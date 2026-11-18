import type { EventStopSummary } from '@/lib/events/event-stops';
import { EVENT_SHOWS, eventPageHref, formatRangeWithYear } from '@/lib/events/event-pages';
import { EventPageLink } from '@/components/events/EventPageLink';

// "Upcoming events at {venue}" on a venue hub (Phase 2, 2026-11-18): the
// touring-show stops at this building with an upcoming performance, each the
// show name (the link, to the stop page) and its dates. Server component; the
// only client leaf is the link. The href and its surface (venue_events_module)
// come from the one helper, so with EVENTS_PAGES_LIVE off this renders
// nothing even if it were handed rows. Renders nothing with zero items.
export function HubUpcomingEvents({ stops, buildingName }: { stops: EventStopSummary[]; buildingName: string }) {
  const rows = stops.flatMap((s) => {
    const link = eventPageHref({ kind: 'stop', show: s.show, venue: s.venueSlug }, 'venue_events_module');
    return link ? [{ s, link }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="upcoming-events-here" className="mx-auto max-w-[1160px] px-3 pt-4 md:px-8 md:pt-6" data-venue-events="">
      <div className="rounded-2xl border border-rd-line bg-rd-card px-4 py-3 md:px-5">
        <h2 id="upcoming-events-here" className="m-0 font-rd text-[13px] font-extrabold uppercase tracking-[0.08em] text-rd-ink-faint">
          {`Upcoming events at ${buildingName}`}
        </h2>
        <ul className="m-0 mt-2 list-none divide-y divide-rd-line p-0">
          {rows.map(({ s, link }) => (
            <li key={`${s.show}~${s.venueSlug}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
              <EventPageLink href={link.href} linkSurface={link.surface} show={s.show} venueSlug={s.venueSlug} className="inline-flex min-h-11 items-center text-sm font-semibold text-rd-ink transition-colors hover:text-rd-red md:text-base">
                {`${EVENT_SHOWS[s.show].name}: dates and tickets`}
              </EventPageLink>
              <span className="font-rd text-xs text-rd-ink-faint">{`${formatRangeWithYear(s.nextDate, s.lastDate)} · ${s.upcomingCount} ${s.upcomingCount === 1 ? 'show' : 'shows'}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
