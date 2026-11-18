import type { ReactNode } from 'react';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { EventPageLink } from '@/components/events/EventPageLink';
import { displayVenueName } from '@/lib/venue-hub';
import type { EventStopSummary } from '@/lib/events/event-stops';
import {
  EVENTS_INDEX_PATH,
  EVENTS_NOT_AFFILIATED,
  breadcrumbJsonLd,
  eventHubPath,
  eventPageHref,
  formatRangeWithYear,
  monthLabel,
  type EventShow,
} from '@/lib/events/event-pages';

// The show hub (/events/{show}) and the index (/events), Phase 2, 2026-11-18.
// Lists only: every row is a stored stop at a venue PromoNight covers, with
// its dates, linking to the stop page and to the venue page. No ticket links
// here (the buttons live on the stop pages), so no affiliate disclosure.
// Neither page carries the pn-promo-page wrapper: that is the stop page's.

const Shell = ({ children }: { children: ReactNode }) => (
  <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
    {/* A div, not a <main>: the root layout renders the page's one <main>. */}
    <div className="mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-events-list="">{children}</div>
  </div>
);
const Note = () => <p className="m-0 mt-7 border-t border-rd-line pt-5 font-rd text-[11px] leading-[1.4] text-rd-ink-faint" data-events-note="">{EVENTS_NOT_AFFILIATED}</p>;
// One visit: its range. Several: never one continuous range (it would read as a run of weeks).
const datesOf = (s: EventStopSummary) => (s.visitStarts.length > 1 ? `${s.visitStarts.length} visits, ${formatRangeWithYear(s.nextDate, s.nextDate)} to ${formatRangeWithYear(s.lastDate, s.lastDate)}` : formatRangeWithYear(s.nextDate, s.lastDate));
const showsOf = (n: number) => `${n} ${n === 1 ? 'show' : 'shows'}`;

function StopRow({ s, last }: { s: EventStopSummary; last: boolean }) {
  const link = eventPageHref({ kind: 'stop', show: s.show, venue: s.venueSlug }, 'events_hub_list');
  if (!link) return null;
  const venueName = displayVenueName(s.venueName);
  return (
    <li className={`flex flex-col gap-1 py-3 ${last ? '' : 'border-b border-rd-line'}`} data-stop={s.venueSlug}>
      <EventPageLink href={link.href} linkSurface={link.surface} show={s.show} venueSlug={s.venueSlug} className="flex min-h-11 items-center justify-between gap-3 text-rd-ink no-underline">
        <span className="flex flex-col gap-0.5">
          <span className="font-rd text-[15px] font-semibold">{`${s.searchCity}: ${datesOf(s)}`}</span>
          <span className="font-rd text-[12px] text-rd-ink-faint">{`${venueName} · ${showsOf(s.upcomingCount)}`}</span>
        </span>
        <span aria-hidden="true" className="text-rd-ink-faint">›</span>
      </EventPageLink>
      <EventPageLink href={`/venues/${s.hubId}`} linkSurface="event_to_venue" show={s.show} venueSlug={s.venueSlug} className="inline-flex min-h-11 items-center self-start font-rd text-[13px] font-medium text-rd-link no-underline hover:underline">
        {`${venueName} venue guide`}
      </EventPageLink>
    </li>
  );
}

export function EventHubView({ show, stops, year }: { show: EventShow; stops: EventStopSummary[]; year: number | null }) {
  // A stop is listed under EVERY month one of its visits starts in, so a
  // building with four weekends is found in each of their months.
  const months = [...new Set(stops.flatMap((s) => s.visitStarts.map((d) => d.slice(0, 7))))].sort();
  const indexLink = eventPageHref({ kind: 'index' }, 'events_hub_list');
  const total = stops.reduce((n, s) => n + s.upcomingCount, 0);
  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([{ name: 'Events', path: EVENTS_INDEX_PATH }, { name: show.name, path: eventHubPath(show.slug) }])).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pt-3.5 font-rd text-[12px] text-rd-ink-faint">
        {indexLink ? <EventPageLink href={indexLink.href} linkSurface={indexLink.surface} className="no-underline hover:text-rd-ink">Events</EventPageLink> : <span>Events</span>}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-rd-ink-soft">{show.name}</span>
      </nav>
      <header className="flex flex-col gap-2.5 pt-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-rd-red px-2 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Live event</span>
          {stops.length ? <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{`${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ${showsOf(total)}`}</span> : null}
        </div>
        <h1 className="rd-display m-0 text-[40px] uppercase leading-[0.95] tracking-[-0.01em] text-rd-ink">{`${show.name}${year ? ` ${year}` : ''} dates and venue guides`}</h1>
        <p className="m-0 font-rd text-[15px] leading-[1.45] text-rd-ink-soft">
          {`This page lists ${show.name} stops at venues PromoNight covers. It is not the full tour schedule. Each stop page has the showtimes, a ticket link for every show, and what the venue says about bags, parking and transit.`}
        </p>
      </header>
      {stops.length ? (
        months.map((ym) => {
          const rows = stops.filter((s) => s.visitStarts.some((d) => d.slice(0, 7) === ym));
          return (
            <section key={ym} className="mt-6 flex flex-col gap-2.5" data-month={ym}>
              <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">{monthLabel(ym)}</h2>
              <ul className="m-0 flex list-none flex-col rounded-[14px] border border-rd-line bg-rd-card px-3.5 py-1">
                {rows.map((s, i) => <StopRow key={s.venueSlug} s={s} last={i === rows.length - 1} />)}
              </ul>
            </section>
          );
        })
      ) : (
        <p className="m-0 mt-6 font-rd text-[15px] leading-[1.45] text-rd-ink-soft">No upcoming stops are listed right now.</p>
      )}
      <Note />
    </Shell>
  );
}

export function EventsIndexView({ shows, next }: { shows: Array<{ show: EventShow; stops: number; performances: number; first: string | null; last: string | null }>; next: EventStopSummary[] }) {
  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([{ name: 'Events', path: EVENTS_INDEX_PATH }])).replace(/</g, '\\u003c') }} />
      <header className="flex flex-col gap-2.5 pt-6">
        <h1 className="rd-display m-0 text-[40px] uppercase leading-[0.95] tracking-[-0.01em] text-rd-ink">Events at venues we cover</h1>
        <p className="m-0 font-rd text-[15px] leading-[1.45] text-rd-ink-soft">
          Touring shows at the stadiums and arenas PromoNight already covers: showtimes, a ticket link for every show, and the venue&apos;s own bag, parking and transit details.
        </p>
      </header>
      <section className="mt-6 flex flex-col gap-2.5">
        <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">Shows</h2>
        {shows.map(({ show, stops, performances, first, last }) => {
          const link = eventPageHref({ kind: 'hub', show: show.slug }, 'events_hub_list');
          if (!link) return null;
          return (
            <EventPageLink key={show.slug} href={link.href} linkSurface={link.surface} show={show.slug} className="flex items-center justify-between gap-3 rounded-[14px] border border-rd-line bg-rd-card p-3.5 text-rd-ink no-underline" data-show={show.slug}>
              <span className="flex flex-col gap-0.5">
                <span className="rd-display text-[22px] uppercase leading-none">{show.name}</span>
                <span className="font-rd text-[13px] text-rd-ink-faint">
                  {stops ? `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${showsOf(performances)}${first && last ? ` · ${formatRangeWithYear(first, last)}` : ''}` : 'No upcoming stops listed'}
                </span>
              </span>
              <span aria-hidden="true" className="text-rd-ink-faint">›</span>
            </EventPageLink>
          );
        })}
      </section>
      {next.length ? (
        <section className="mt-6 flex flex-col gap-2.5">
          <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">Next stops</h2>
          <ul className="m-0 flex list-none flex-col rounded-[14px] border border-rd-line bg-rd-card px-3.5 py-1">
            {next.map((s, i) => <StopRow key={`${s.show}~${s.venueSlug}`} s={s} last={i === next.length - 1} />)}
          </ul>
          {shows.filter((x) => x.stops > next.filter((n) => n.show === x.show.slug).length).map(({ show, stops }) => {
            const link = eventPageHref({ kind: 'hub', show: show.slug }, 'events_hub_list');
            return link ? <EventPageLink key={show.slug} href={link.href} linkSurface={link.surface} show={show.slug} className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-semibold text-rd-link no-underline hover:underline">{`See all ${stops} ${show.name} stops by month`}</EventPageLink> : null;
          })}
        </section>
      ) : null}
      <Note />
    </Shell>
  );
}
