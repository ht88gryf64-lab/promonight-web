import type { ReactNode } from 'react';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { AFFILIATE_DISCLOSURE_TEXT } from '@/components/affiliates/AffiliateDisclosure';
import { EventPageLink } from '@/components/events/EventPageLink';
import { ShowtimeGate } from '@/components/events/ShowtimeGate';
import { EventCountdown } from '@/components/events/EventCountdown';
import { EVENTS_ACCENT_BG, EVENTS_ACCENT_TEXT, EventHero } from '@/components/events/EventHero';
import { buildEventTicketLink, buildSpotHeroUrl, eventSubId, eventTicketVendor } from '@/lib/affiliates';
import { cityState, displayVenueName, spotHeroCovers, type TenantTeamLink, type VenueHub } from '@/lib/venue-hub';
import { parkingLotsModel, transitRowModel } from '@/components/venue-hub/venue-logistics';
import type { EventFloor, EventStopSummary } from '@/lib/events/event-stops';
import {
  EVENTS_INDEX_PATH,
  EVENTS_NOT_AFFILIATED,
  EVENTS_SITE_URL,
  EVENT_CARD_HEIGHT,
  EVENT_CARD_WIDTH,
  STARTED_LABEL,
  STATUS_LABEL,
  bagBlockFor,
  countdownAt,
  breadcrumbJsonLd,
  dayTile,
  eventCardPath,
  eventHubPath,
  eventPageHref,
  eventShowOf,
  eventStopPath,
  formatClock,
  formatRange,
  formatRangeWithYear,
  formatShortDay,
  performanceJsonLd,
  showLabel,
  showTimeline,
  showsPhrase,
  showsBagRule,
  stopDescription,
  stopFaqs,
  stopH1,
  stopTimeline,
  stopTitle,
  stopYear,
  upcomingPerformances,
  weekdayLong,
  type EventPerformance,
  type EventStop,
} from '@/lib/events/event-pages';

// The tour-stop page (/events/{show}/{venue}, Phase 2, 2026-11-18; restyled
// in Phase 2D). Look and section order follow docs/events-monster-jam-mockup-v2.html,
// drawn with the site's rd-* tokens like the per-promo page. Every word comes
// from the stored stop and the venue hub's published view.
//
// THE ARTICLE IS THE AD WRAPPER, exactly as on a promo page: a real <article>
// with page-content, whose direct children are the ad anchors, inside the
// route layout's div.pn-promo-page. The hero and the showtimes are ONE child,
// so no ad can land between the photo and the tickets.
export const EVENT_PAGE_SURFACE = 'web_event_page' as const;

/** The date line of a "More stops" tile: one visit's range, or the count and the first day. */
function stopTileDates(s: EventStopSummary): string {
  return s.visits.length > 1 ? `${s.visits.length} visits from ${formatRange(s.nextDate, s.nextDate)}` : formatRange(s.nextDate, s.lastDate);
}

export interface EventStopViewProps {
  stop: EventStop;
  hub: VenueHub;
  floor: EventFloor;
  now: Date;
  /** The building's home teams (their pages), for "Also at". */
  teams: TenantTeamLink[];
  /** Other upcoming stops of the show, soonest first. */
  otherStops: EventStopSummary[];
}

/** What the Transit row prints for this stop: the hub's STRUCTURED lines as a
 *  plain list, and a link to the venue guide's own transit row. No notes
 *  prose: a note written around a home game stays on the venue page (ruling
 *  2026-11-18, Phase 2D). The row exists exactly when the venue page prints
 *  its Transit row (one model, transitRowModel), so the link always lands. */
export function stopTransit(hub: VenueHub): { lines: string[]; href: string } | null {
  const m = transitRowModel(hub);
  if (!m.renders) return null;
  const lines = m.linesOk ? (hub.publicTransit?.lines ?? []).filter((l): l is string => typeof l === 'string' && !!l.trim()).map((l) => l.trim()) : [];
  return { lines, href: `/venues/${hub.slug}#transit` };
}

/** Everything the head and the body both need, computed once. */
export function eventStopHead(stop: EventStop, hub: VenueHub, now: Date) {
  const transit = stop.tombstoned ? null : stopTransit(hub);
  const show = eventShowOf(stop.show)!;
  const venueName = displayVenueName(hub.name);
  const tl = stopTimeline(stop, now);
  const upcoming = stop.tombstoned ? [] : upcomingPerformances(tl);
  const visitIds = tl.upcoming.map((g) => g.visit.visitId);
  // The venue's rule for THIS event belongs to the visits on the page: with
  // nothing upcoming no event rule is shown (a past visit's rule is not
  // current), and the block falls to the operator's standing policy.
  const bag = stop.tombstoned ? null : bagBlockFor(stop, venueName, visitIds);
  // The venue's event rule may cover one visit of several. The card and the
  // FAQ answer both say which shows it covers, in the same words.
  const bagScopeNote = (ruleText: string): string | null => {
    const covered = tl.upcoming.filter((g) => stop.bagRules.some((x) => x.visitId === g.visit.visitId && x.text === ruleText));
    if (tl.upcoming.length < 2 || covered.length === tl.upcoming.length || !covered.length) return null;
    const shows = covered.reduce((n, g) => n + g.performances.length, 0);
    const which = `${venueName} prints this for the ${covered.map((g) => formatRange(g.performances[0].date, g.performances[g.performances.length - 1].date)).join(' and ')} ${shows === 1 ? 'show' : 'shows'}.`;
    // "No rule for the other dates" only when some upcoming visit really has none (another visit may carry its own rule).
    const someUncovered = tl.upcoming.some((g) => !stop.bagRules.some((x) => x.visitId === g.visit.visitId));
    return someUncovered ? `${which} It has not published a rule for the other dates on this page.` : which;
  };
  const upKeys = new Set(upcoming.map((p) => p.key));
  const pitParty = stop.pitParty.filter((p) => upKeys.has(p.performance));
  const gateTimes = stop.gateTimes.filter((g) => upKeys.has(g.performance));
  const year = stopYear(stop, tl);
  const canonical = `${EVENTS_SITE_URL}${eventStopPath(stop.show, stop.venueSlug)}`;
  // The head promises dates and tickets only while a show is upcoming.
  const title = stop.tombstoned
    ? `${show.name} ${stop.searchCity} at ${venueName}: removed from the schedule`
    : upcoming.length
      ? stopTitle(show.name, stop.searchCity, year, showsBagRule(bag))
      : `${show.name} ${stop.searchCity} at ${venueName}`;
  const description = stop.tombstoned
    ? `${show.name} at ${venueName} in ${stop.searchCity} has been removed from the schedule.`
    : stopDescription({ showName: show.name, searchCity: stop.searchCity, venueName, dates: upcoming.map((p) => p.date), visitCount: tl.upcoming.length, bagRule: showsBagRule(bag), transit: !!transit && transit.lines.length > 0, pitParty: pitParty.length > 0 });
  // A removed stop has no card (the card route answers 404 for it).
  const hasCard = !stop.tombstoned;
  const card = { url: `${EVENTS_SITE_URL}${eventCardPath(stop)}`, width: EVENT_CARD_WIDTH, height: EVENT_CARD_HEIGHT, alt: `${show.name}${year ? ` ${year}` : ''} at ${venueName}, ${stop.searchCity}` };
  // A removed stop, or one with nothing upcoming and nothing played, is not indexed.
  const indexable = !stop.tombstoned && (upcoming.length > 0 || !!tl.lastVisit);
  // The countdown runs to the FIRST upcoming show, on the venue's calendar. None when nothing is upcoming.
  const firstDate = upcoming.length ? upcoming[0].date : null;
  const countdown = countdownAt(firstDate, now, stop.timezone);
  return { show, venueName, tl, upcoming, bag, pitParty, gateTimes, year, canonical, title, description, card, hasCard, indexable, transit, bagScopeNote, firstDate, countdown };
}

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="rd-display m-0 text-[24px] uppercase leading-[1.05] text-rd-ink">{children}</h2>
);
const Eyebrow = ({ children }: { children: ReactNode }) => <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{children}</span>;
const Lead = ({ children }: { children: ReactNode }) => <span className="font-rd text-[15px] font-semibold leading-[1.3] text-rd-ink">{children}</span>;
const Body = ({ children }: { children: ReactNode }) => <p className="m-0 font-rd text-[14px] leading-[1.45] text-rd-ink-soft">{children}</p>;
const hostOf = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const readDate = (iso: string): string => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''; };
/** "{host} · read {date} · source": a venue-printed fact names its page. */
const Source = ({ url, observedAt }: { url: string; observedAt?: string }) => (
  <span className="font-rd text-[11px] text-rd-ink-faint">
    {hostOf(url)}
    {observedAt && readDate(observedAt) ? ` · read ${readDate(observedAt)} · ` : ' · '}
    <a href={url} target="_blank" rel="noopener nofollow" className="text-rd-link underline underline-offset-2">source</a>
  </span>
);
const ICON = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const ICONS = {
  bags: <svg {...ICON}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  transit: <svg {...ICON}><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M8 13h8M9 17l-2 4M15 17l2 4M9 8h6" /></svg>,
  parking: <svg {...ICON}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" /></svg>,
  reentry: <svg {...ICON}><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /></svg>,
} as const;
/** One row of the Before you go card: an icon, a small label, then the row's own content. */
function Row({ icon, label, last, children, ...rest }: { icon: keyof typeof ICONS; label: string; last: boolean; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className={`flex gap-3 py-3.5 ${last ? '' : 'border-b border-rd-line'}`} {...rest}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-rd-cream text-rd-ink">{ICONS[icon]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Eyebrow>{label}</Eyebrow>
        {children}
      </div>
    </div>
  );
}

function Tile({ ymd }: { ymd: string }) {
  const d = dayTile(ymd);
  return (
    <div className="flex h-[62px] w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-rd-ink text-white">
      <span className={`font-rd text-[10px] font-semibold tracking-[0.12em] ${EVENTS_ACCENT_TEXT}`}>{d.weekday}</span>
      <span className="rd-numerals text-[28px] leading-none">{d.day}</span>
      <span className="font-rd text-[10px] font-semibold tracking-[0.12em]">{d.month}</span>
    </div>
  );
}
const NO_LINK = 'flex h-12 shrink-0 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-cream px-3.5 font-rd text-[14px] font-medium text-rd-ink-faint';
const DOT: Record<string, string> = { 'pit-open': '#f5c518', 'pit-close': '#8a847a', gates: '#8a847a', show: '#f0857c' };

export function EventStopView({ stop, hub, now, teams, otherStops }: EventStopViewProps) {
  const head = eventStopHead(stop, hub, now);
  const { show, venueName, tl, upcoming, bag, pitParty, gateTimes, transit } = head;
  const provider = eventTicketVendor();
  const hubHref = eventHubPath(stop.show);
  const venueHref = `/venues/${hub.slug}`;
  const place = cityState(hub);
  const ticketUrlFor = (p: EventPerformance) => (p.status === 'onsale' ? buildEventTicketLink({ provider, eventId: p.tnEventId, show: stop.show, venueSlug: stop.venueSlug, surface: EVENT_PAGE_SURFACE }) : null);
  const subKey = eventSubId(EVENT_PAGE_SURFACE, stop.show, stop.venueSlug);
  const parkingHref = !stop.tombstoned && upcoming.length && spotHeroCovers(hub) && hub.lat !== null && hub.lng !== null ? buildSpotHeroUrl({ latitude: hub.lat, longitude: hub.lng, subKey }) : null;
  const eventContext = { show: stop.show, venueSlug: stop.venueSlug };

  // The venue page's own parking section, when it has one (the same model its card renders from).
  const venueParkingHref = parkingLotsModel(hub) ? `${venueHref}#parking` : null;
  // Parking facts the VENUE printed for this event (eventPolicies on the stop). None is stored today.
  const parkingFacts = stop.parkingFacts.filter((r) => tl.upcoming.some((g) => g.visit.visitId === r.visitId));
  const reEntry = stop.reEntry.filter((r) => tl.upcoming.some((g) => g.visit.visitId === r.visitId));
  const faqs = stop.tombstoned ? [] : stopFaqs({ showName: show.name, searchCity: stop.searchCity, venueName, upcoming, bag, bagAnswer: bag && bag.kind === 'event-rule' ? bag.rules.map((r) => [r.text, head.bagScopeNote(r.text)].filter(Boolean).join(' ')).join(' ') : '', pitParty, gateTimes });

  const jsonLd: Array<Record<string, unknown>> = [
    breadcrumbJsonLd([{ name: 'Events', path: EVENTS_INDEX_PATH }, { name: show.name, path: hubHref }, { name: venueName, path: eventStopPath(stop.show, stop.venueSlug) }]),
    ...upcoming.map((p) => performanceJsonLd({ showName: show.name, stopUrl: head.canonical, imageUrl: head.card.url, venue: { name: venueName, city: hub.city, state: hub.state, lat: hub.lat, lng: hub.lng }, performance: p, hasTicketLink: !!ticketUrlFor(p) })),
  ];
  const indexLink = eventPageHref({ kind: 'index' }, 'events_hub_list');
  const hubLink = eventPageHref({ kind: 'hub', show: stop.show }, 'events_hub_list');

  // The hour-by-hour card: one block per upcoming show that has a stored Pit Party or gate time.
  const days = upcoming.map((p) => ({ p, rows: showTimeline(p, pitParty, gateTimes) })).filter((d): d is { p: EventPerformance; rows: NonNullable<ReturnType<typeof showTimeline>> } => !!d.rows);
  const timelineSources = [
    ...[...new Set(pitParty.map((x) => x.sourceUrl))].map((u) => ({ what: 'Pit Party times', url: u, observedAt: pitParty.find((x) => x.sourceUrl === u)!.observedAt })),
    ...[...new Set(gateTimes.map((x) => x.sourceUrl))].map((u) => ({ what: 'Gate times', url: u, observedAt: gateTimes.find((x) => x.sourceUrl === u)!.observedAt })),
  ];
  // "Your Saturday" only when the card's one show is the page's only upcoming show on that weekday;
  // otherwise each block names its own date and showtime (two Saturday shows, or a Saturday in another visit).
  const soleDay = days.length === 1 && upcoming.filter((p) => weekdayLong(p.date) === weekdayLong(days[0].p.date)).length === 1;
  const showParking = upcoming.length > 0 && (!!parkingHref || !!venueParkingHref || parkingFacts.length > 0);
  const rows = stop.tombstoned ? [] : ([bag ? 'bags' : null, transit ? 'transit' : null, showParking ? 'parking' : null, reEntry.length ? 'reentry' : null].filter(Boolean) as string[]);
  const isLast = (k: string) => rows[rows.length - 1] === k;

  return (
    <>
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}
      <article className="page-content mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-ad-region="content" data-event-stop={`${stop.show}~${stop.venueSlug}`} style={{ overflowAnchor: 'none' }}>
        {/* ONE BLOCK: the hero and the showtimes are a single child of the
            article, so no ad anchor exists between the photo and the tickets. */}
        <div data-event-top="">
          <EventHero
            show={stop.show}
            breadcrumb={
              <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pb-2.5 pt-3.5 font-rd text-[12px] text-[#d8d1c4]">
                {indexLink ? <EventPageLink href={indexLink.href} linkSurface={indexLink.surface} className="text-[#d8d1c4] no-underline hover:text-white">Events</EventPageLink> : <span>Events</span>}
                <span aria-hidden="true">/</span>
                {hubLink ? <EventPageLink href={hubLink.href} linkSurface={hubLink.surface} show={stop.show} className="text-[#d8d1c4] no-underline hover:text-white">{show.name}</EventPageLink> : <span>{show.name}</span>}
                <span aria-hidden="true">/</span>
                <span aria-current="page" className="text-white">{venueName}</span>
              </nav>
            }
          >
            <div className="flex min-h-[23px] items-center gap-2">
              <span className={`rounded-md px-2 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] ${stop.tombstoned ? 'bg-[#50483f] text-white' : `${EVENTS_ACCENT_BG} text-rd-ink`}`}>{stop.tombstoned ? 'Removed' : 'Live event'}</span>
              {head.firstDate ? <EventCountdown shows={upcoming.map((p) => ({ date: p.date, startsAt: p.startsAt }))} timeZone={stop.timezone ?? null} initial={head.countdown} className={`font-rd text-[11px] font-semibold uppercase tracking-[0.12em] ${EVENTS_ACCENT_TEXT}`} /> : null}
            </div>
            {/* The mockup's 54px, scaled to the screen below 470px wide: the site's display
                face is wider than the mockup's condensed one, and at a flat 54px
                "MINNEAPOLIS" does not fit a 390px phone and breaks mid-word. At 11.5vw
                every stored city sits on its own line under "MONSTER JAM" from 320 up. */}
            <h1 className="rd-display m-0 text-[min(54px,11.5vw)] uppercase leading-[0.9] tracking-[-0.01em] text-white [overflow-wrap:break-word]">{stopH1(show.name, stop.searchCity)}</h1>
            <p className="m-0 font-rd text-[16px] leading-[1.4] text-[#e9e3d8]">
              <strong className="text-white">{place ? `${venueName}, ${place}` : venueName}</strong>
              <br />
              {stop.tombstoned
                ? 'This stop has been removed from the schedule.'
                : upcoming.length
                  ? showsPhrase(upcoming.map((p) => p.date), tl.upcoming.length)
                  : tl.returnsYear
                    ? `Returns in ${tl.returnsYear}, dates TBA`
                    : 'Dates are not announced.'}
            </p>
          </EventHero>

          {!stop.tombstoned && upcoming.length ? (
            <section aria-label="Showtimes and tickets" className="mt-[18px] flex flex-col gap-2.5">
              <H2>Pick your show</H2>
              {tl.upcoming.map((g) => (
                <div key={g.visit.visitId} className="flex flex-col gap-2.5" data-visit={g.visit.visitId}>
                  {tl.upcoming.length > 1 ? (
                    <h3 className="m-0 mt-1 font-rd text-[12px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{formatRangeWithYear(g.performances[0].date, g.performances[g.performances.length - 1].date)}</h3>
                  ) : null}
                  {g.performances.map((p) => {
                    const href = ticketUrlFor(p);
                    const pit = pitParty.filter((x) => x.performance === p.key);
                    return (
                      <div key={p.key} data-performance={p.key} className="flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3">
                        <div className="flex items-center gap-3">
                          <Tile ymd={p.date} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <time dateTime={p.startsAt} className="rd-display text-[30px] leading-none text-rd-ink">{formatClock(p.startTime)}</time>
                            <span className="font-rd text-[13px] text-rd-ink-faint">{showLabel(p)}</span>
                          </div>
                          {href ? (
                            // The button drops BY THE CLOCK: the server renders it
                            // while the show is upcoming, and the client leaf swaps
                            // it for "Started" at the start instant, without
                            // waiting for the page to be regenerated.
                            <ShowtimeGate startsAt={p.startsAt} started={<span className={NO_LINK}>{STARTED_LABEL}<span className="sr-only">: this show has started</span></span>}>
                              <TrackedAffiliateLink
                                href={href}
                                partner="ticketnetwork"
                                teamId=""
                                sport=""
                                surface={EVENT_PAGE_SURFACE}
                                placement="event_page_performance"
                                ticketLinkLevel="event"
                                eventContext={{ ...eventContext, performanceKey: p.key, provider: provider ?? undefined }}
                                target="_blank"
                                rel="noopener noreferrer sponsored"
                                ariaLabel={`Tickets for ${show.name} at ${venueName}, ${formatShortDay(p.date)} at ${formatClock(p.startTime)}`}
                                className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-rd-red px-5 font-rd text-[16px] font-semibold text-white no-underline hover:brightness-95"
                              >
                                Tickets
                              </TrackedAffiliateLink>
                            </ShowtimeGate>
                          ) : (
                            // No link: the stored status when it is "sold out", else a neutral label that claims nothing about the sale.
                            <span className={NO_LINK}>
                              {STATUS_LABEL[p.status]}<span className="sr-only">: no ticket link for this show</span>
                            </span>
                          )}
                        </div>
                        {/* The venue's stored Pit Party time for THIS show, when it printed one. */}
                        {pit.filter((x, i, arr) => arr.findIndex((y) => y.start === x.start && y.end === x.end) === i).map((x, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-[10px] bg-[#fbf3cf] px-2.5 py-2 text-rd-ink" data-pit-strip={p.key}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                            <span className="font-rd text-[13px] leading-[1.35]"><strong>{`Pit Party ${formatClock(x.start)} to ${formatClock(x.end)}`}</strong>{`, per ${venueName}. Separate pass.`}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <p className="m-0 mt-0.5 font-rd text-[11px] leading-[1.4] text-rd-ink-faint">{`${AFFILIATE_DISCLOSURE_TEXT} Times are local to the venue.`}</p>
            </section>
          ) : null}
        </div>

        {days.length ? (
          <section className="mt-6 flex flex-col gap-2.5" data-event-timeline="">
            <H2>{soleDay ? `Your ${weekdayLong(days[0].p.date)}, hour by hour` : 'Hour by hour'}</H2>
            <div className="flex flex-col gap-4 rounded-2xl bg-rd-ink p-4 text-white">
              {days.map(({ p, rows: entries }) => (
                <div key={p.key} className="flex flex-col" data-timeline-show={p.key}>
                  {!soleDay ? <span className={`mb-2.5 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] ${EVENTS_ACCENT_TEXT}`}>{`${formatShortDay(p.date)}, ${formatClock(p.startTime)} show`}</span> : null}
                  {entries.map((e, i) => (
                    <div key={`${e.kind}-${e.at}-${i}`} className="flex gap-3" data-timeline-entry={e.kind}>
                      <div className="flex w-3.5 flex-col items-center">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: DOT[e.kind] }} />
                        {i < entries.length - 1 ? <span className="w-0.5 flex-1 bg-[#4a443d]" /> : null}
                      </div>
                      <div className={`flex flex-col gap-0.5 ${i < entries.length - 1 ? 'pb-4' : ''}`}>
                        <span className="rd-display text-[22px] leading-none">{formatClock(e.at)}</span>
                        <span className="font-rd text-[14px] text-[#e9e3d8]">{e.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex flex-col gap-1 font-rd text-[11px] leading-[1.4] text-[#d8d1c4]">
                {timelineSources.map((x) => (
                  <span key={`${x.what}-${x.url}`}>
                    {`${x.what} as listed by ${venueName}${readDate(x.observedAt) ? ` · read ${readDate(x.observedAt)}` : ''} · `}
                    <a href={x.url} target="_blank" rel="noopener nofollow" className={`${EVENTS_ACCENT_TEXT} underline underline-offset-2`}>source</a>
                  </span>
                ))}
                <span>The showtime is the one on the ticket listing. The Pit Party is a separate pass and is not sold through the ticket buttons above.</span>
              </div>
            </div>
          </section>
        ) : null}

        {rows.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>Before you go</H2>
            <div className="flex flex-col rounded-2xl border border-rd-line bg-rd-card px-3.5 py-1" data-before-you-go="">
              {bag ? (
                <Row icon="bags" label={bag.label} last={isLast('bags')} data-row="bags">
                  {bag.kind === 'event-rule' ? (
                    bag.rules.map((r, i) => (
                      <div key={i} className="flex flex-col gap-1.5" data-bag="event-rule">
                        <Body>{r.text}</Body>
                        {/* The venue's page may cover one visit of several: say which, never imply the rest. */}
                        {head.bagScopeNote(r.text) ? <Body>{head.bagScopeNote(r.text)}</Body> : null}
                        <Source url={r.sourceUrl} observedAt={r.observedAt} />
                      </div>
                    ))
                  ) : bag.kind === 'pointer' ? (
                    <div className="flex flex-col gap-1" data-bag="pointer">
                      <Body>{bag.text}</Body>
                      <a href={bag.sourceUrl} target="_blank" rel="noopener nofollow" className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-medium text-rd-link underline underline-offset-2">{`${venueName} bag policy page`}</a>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5" data-bag={bag.kind}>
                      <Body>{bag.text}</Body>
                      {bag.kind === 'other-event-rule' ? <Body>{bag.caveat}</Body> : null}
                      <Source url={bag.sourceUrl} observedAt={bag.observedAt} />
                    </div>
                  )}
                </Row>
              ) : null}

              {/* Transit: the hub's structured lines as a plain list and a link
                  to the venue guide's Transit row. No notes prose. A hub with no
                  structured lines shows the link alone. */}
              {transit ? (
                <Row icon="transit" label="Transit" last={isLast('transit')} data-row="transit">
                  {transit.lines.length ? (
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" data-transit-lines="">
                      {transit.lines.map((l) => <li key={l} className="font-rd text-[15px] font-semibold leading-[1.3] text-rd-ink">{l}</li>)}
                    </ul>
                  ) : null}
                  <EventPageLink href={transit.href} linkSurface="event_to_venue" show={stop.show} venueSlug={stop.venueSlug} data-transit-link="" className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-medium text-rd-link no-underline hover:underline">
                    {`Transit on the ${venueName} guide`}
                  </EventPageLink>
                </Row>
              ) : null}

              {/* Parking, as built in Phase 2C: no hub lot is printed. One line,
                  the link to the venue guide's parking section, the reserve
                  button, and (when the venue printed one for this event) its
                  own fact with its source. */}
              {showParking ? (
                <Row icon="parking" label="Parking" last={isLast('parking')} data-row="parking" data-parking="links">
                  <Lead>Event-day lots and prices can differ from game days.</Lead>
                  {parkingFacts.map((r, i) => (
                    <div key={i} className="flex flex-col gap-1.5" data-parking="event-fact">
                      <Body>{r.text}</Body>
                      <Source url={r.sourceUrl} observedAt={r.observedAt} />
                    </div>
                  ))}
                  {venueParkingHref ? (
                    <EventPageLink href={venueParkingHref} linkSurface="event_to_venue" show={stop.show} venueSlug={stop.venueSlug} data-parking-link="" className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-medium text-rd-link no-underline hover:underline">
                      {`Parking on the ${venueName} guide`}
                    </EventPageLink>
                  ) : null}
                  {parkingHref ? (
                    <TrackedAffiliateLink
                      href={parkingHref}
                      partner="spothero"
                      teamId=""
                      sport=""
                      surface={EVENT_PAGE_SURFACE}
                      placement="event_page_parking_block"
                      eventContext={eventContext}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      ariaLabel={`Reserve parking near ${venueName} on SpotHero`}
                      className="flex h-11 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-card font-rd text-[14px] font-semibold text-rd-ink no-underline hover:border-rd-ink"
                    >
                      Reserve parking
                    </TrackedAffiliateLink>
                  ) : null}
                </Row>
              ) : null}

              {reEntry.length ? (
                <Row icon="reentry" label="Re-entry" last={isLast('reentry')} data-row="reentry">
                  {reEntry.map((r, i) => (
                    <div key={i} className="flex flex-col gap-1.5" data-re-entry="">
                      <Body>{r.text}</Body>
                      <Source url={r.sourceUrl} observedAt={r.observedAt} />
                    </div>
                  ))}
                </Row>
              ) : null}
            </div>
          </section>
        ) : null}

        {!stop.tombstoned && tl.lastVisit ? (
          <section className="mt-6 flex flex-col gap-2.5" data-last-visit={tl.lastVisit.visit.visitId}>
            <H2>Last visit</H2>
            <div className="flex flex-col rounded-2xl border border-rd-line bg-rd-card px-3.5 py-1">
              {tl.lastVisit.performances.map((p, i, arr) => (
                <div key={p.key} className={`flex items-center justify-between py-3 font-rd text-[14px] ${i < arr.length - 1 ? 'border-b border-rd-line' : ''}`}>
                  <span className="font-semibold text-rd-ink">{`${formatShortDay(p.date)}, ${p.date.slice(0, 4)}`}</span>
                  <time dateTime={p.startsAt} className="text-rd-ink-faint">{formatClock(p.startTime)}</time>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 flex flex-col gap-2.5">
          <H2>{`Also at ${venueName}`}</H2>
          <div className="grid grid-cols-2 gap-2" data-also-at="">
            <EventPageLink href={venueHref} linkSurface="event_to_venue" show={stop.show} venueSlug={stop.venueSlug} className="flex min-h-[72px] flex-col gap-1 rounded-[14px] border border-rd-line bg-rd-card p-3.5 text-rd-ink no-underline hover:border-rd-ink">
              <span className="rd-display text-[20px] uppercase leading-none [overflow-wrap:anywhere]">Venue guide</span>
              <span className="font-rd text-[12px] leading-[1.35] text-rd-ink-faint">{`${venueName} on PromoNight`}</span>
            </EventPageLink>
            {teams.map((t) => (
              <EventPageLink key={t.teamId} href={t.href} linkSurface="event_to_team" show={stop.show} venueSlug={stop.venueSlug} className="flex min-h-[72px] flex-col gap-1 rounded-[14px] border border-rd-line bg-rd-card p-3.5 text-rd-ink no-underline hover:border-rd-ink">
                <span className="rd-display text-[20px] uppercase leading-none [overflow-wrap:anywhere]">{t.isCfb ? `${t.name} game days` : `${t.name} promos`}</span>
                <span className="font-rd text-[12px] leading-[1.35] text-rd-ink-faint">{t.isCfb ? 'Schedule and game day guide' : 'Giveaways and theme nights'}</span>
              </EventPageLink>
            ))}
          </div>
        </section>

        {otherStops.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>{`More ${show.name} stops`}</H2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-more-stops="">
              {otherStops.slice(0, 6).map((s) => {
                const link = eventPageHref({ kind: 'stop', show: s.show, venue: s.venueSlug }, 'events_hub_list');
                if (!link) return null;
                return (
                  <EventPageLink key={s.venueSlug} href={link.href} linkSurface={link.surface} show={s.show} venueSlug={s.venueSlug} className="flex min-h-[88px] min-w-0 flex-col gap-1 overflow-hidden rounded-[14px] bg-rd-ink p-3 text-white no-underline hover:brightness-110">
                    <span className={`font-rd text-[10px] font-semibold uppercase tracking-[0.12em] ${EVENTS_ACCENT_TEXT}`}>{stopTileDates(s)}</span>
                    <span className="rd-display text-[19px] uppercase leading-[1.05] [overflow-wrap:anywhere]">{s.searchCity}</span>
                    <span className="font-rd text-[12px] leading-[1.35] text-[#d8d1c4]">{`${displayVenueName(s.venueName)} · ${s.upcomingCount} ${s.upcomingCount === 1 ? 'show' : 'shows'}`}</span>
                  </EventPageLink>
                );
              })}
            </div>
            {hubLink ? <EventPageLink href={hubLink.href} linkSurface={hubLink.surface} show={stop.show} className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-semibold text-rd-link no-underline hover:underline">See all stops we cover</EventPageLink> : null}
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>Questions</H2>
            <div className="flex flex-col rounded-2xl border border-rd-line bg-rd-card px-3.5 py-1">
              {faqs.map((f, i) => (
                <div key={f.q} className={`flex flex-col gap-1 py-3 ${i < faqs.length - 1 ? 'border-b border-rd-line' : ''}`}>
                  <h3 className="m-0 font-rd text-[15px] font-semibold text-rd-ink">{f.q}</h3>
                  <p className="m-0 font-rd text-[14px] leading-[1.45] text-rd-ink-soft">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="m-0 mt-7 border-t border-rd-line pt-5 font-rd text-[11px] leading-[1.4] text-rd-ink-faint" data-events-note="">{EVENTS_NOT_AFFILIATED}</p>
      </article>
    </>
  );
}
