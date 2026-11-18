import type { ReactNode } from 'react';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { AFFILIATE_DISCLOSURE_TEXT } from '@/components/affiliates/AffiliateDisclosure';
import { EventPageLink } from '@/components/events/EventPageLink';
import { ShowtimeGate } from '@/components/events/ShowtimeGate';
import { buildEventTicketLink, buildSpotHeroUrl, eventSubId, eventTicketVendor } from '@/lib/affiliates';
import { cityState, displayVenueName, rendersTransit, spotHeroCovers, type TenantTeamLink, type VenueHub } from '@/lib/venue-hub';
import { parkingLotsModel } from '@/components/venue-hub/venue-logistics';
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
  breadcrumbJsonLd,
  dayTile,
  eventCardPath,
  eventHubPath,
  eventPageHref,
  eventSafeTransitLines,
  eventSafeTransitNote,
  eventShowOf,
  eventStopPath,
  formatClock,
  formatDatesLine,
  formatRange,
  formatRangeWithYear,
  formatShortDay,
  performanceJsonLd,
  showLabel,
  showsPhrase,
  showsBagRule,
  stopDescription,
  stopFaqs,
  stopH1,
  stopTimeline,
  stopTitle,
  stopYear,
  tenantNameWords,
  upcomingPerformances,
  type EventPerformance,
  type EventStop,
} from '@/lib/events/event-pages';

// The tour-stop page (/events/{show}/{venue}, Phase 2, 2026-11-18). Section
// order, spacing, type and CTA shape follow docs/events-monster-jam-mockup.html,
// drawn with the site's rd-* tokens like the per-promo page. Every word comes
// from the stored stop and the venue hub's published view.
//
// THE ARTICLE IS THE AD WRAPPER, exactly as on a promo page: a real <article>
// with page-content, whose direct children are the ad anchors, inside the
// route layout's div.pn-promo-page. All ticket rows sit above the image card.
export const EVENT_PAGE_SURFACE = 'web_event_page' as const;

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

/** Everything the head and the body both need, computed once. */
/** What the Transit card prints for this stop: the hub's lines and note, cut
 *  for an event day (src/lib/events/event-pages.ts eventSafeTransitNote).
 *  Computed once, for the card AND the description. There is no parking list:
 *  the hub's lots were written for the home team's game days, and no filter
 *  made them safe to print for a touring show (ruling 2026-11-18, Phase 2C). */
export function stopTransit(hub: VenueHub, floor: EventFloor, teams: TenantTeamLink[]) {
  const tenantWords = tenantNameWords([...teams.map((t) => t.name), ...hub.tenantOverlays.map((t) => t.displayName ?? '')]);
  // The building's own names are places, not tenants ("Nationals Park").
  const own = [hub.name, displayVenueName(hub.name), ...hub.formerNames];
  const hubTransit = floor.transit && rendersTransit(hub) && hub.publicTransit ? hub.publicTransit : null;
  const lines = hubTransit ? eventSafeTransitLines(hubTransit.lines, tenantWords, own) : [];
  const notes = hubTransit && typeof hubTransit.notes === 'string' ? eventSafeTransitNote(hubTransit.notes, tenantWords, own) : '';
  return lines.length || notes ? { lines, notes } : null;
}

export function eventStopHead(stop: EventStop, hub: VenueHub, floor: EventFloor, now: Date, teams: TenantTeamLink[] = []) {
  const transit = stopTransit(hub, floor, teams);
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
    return `${venueName} prints this for the ${covered.map((g) => formatRange(g.performances[0].date, g.performances[g.performances.length - 1].date)).join(' and ')} shows. It has not published a rule for the other dates on this page.`;
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
    : stopDescription({ showName: show.name, searchCity: stop.searchCity, venueName, dates: upcoming.map((p) => p.date), visitCount: tl.upcoming.length, bagRule: showsBagRule(bag), transit: !!transit, pitParty: pitParty.length > 0 });
  // A removed stop has no card (the card route answers 404 for it).
  const hasCard = !stop.tombstoned;
  const card = { url: `${EVENTS_SITE_URL}${eventCardPath(stop)}`, width: EVENT_CARD_WIDTH, height: EVENT_CARD_HEIGHT, alt: `${show.name}${year ? ` ${year}` : ''} at ${venueName}, ${stop.searchCity}` };
  // A removed stop, or one with nothing upcoming and nothing played, is not indexed.
  const indexable = !stop.tombstoned && (upcoming.length > 0 || !!tl.lastVisit);
  return { show, venueName, tl, upcoming, bag, pitParty, gateTimes, year, canonical, title, description, card, hasCard, indexable, transit, bagScopeNote };
}

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="rd-display m-0 text-[22px] uppercase text-rd-ink">{children}</h2>
);
const Card = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5 rounded-[14px] border border-rd-line bg-rd-card p-3.5">
    <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{label}</span>
    {children}
  </div>
);
const Lead = ({ children }: { children: ReactNode }) => <span className="rd-display text-[20px] leading-[1.1] text-rd-ink">{children}</span>;
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

function Tile({ ymd }: { ymd: string }) {
  const d = dayTile(ymd);
  return (
    <div className="flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-[10px] bg-rd-ink text-white">
      <span className="font-rd text-[10px] font-semibold tracking-[0.12em]">{d.weekday}</span>
      <span className="rd-numerals text-[24px] leading-none">{d.day}</span>
      <span className="font-rd text-[10px] font-semibold tracking-[0.12em]">{d.month}</span>
    </div>
  );
}

export function EventStopView({ stop, hub, floor, now, teams, otherStops }: EventStopViewProps) {
  const head = eventStopHead(stop, hub, floor, now, teams);
  const { show, venueName, tl, upcoming, bag, pitParty, gateTimes } = head;
  const provider = eventTicketVendor();
  const hubHref = eventHubPath(stop.show);
  const venueHref = `/venues/${hub.slug}`;
  const place = cityState(hub);
  const ticketUrlFor = (p: EventPerformance) => (p.status === 'onsale' ? buildEventTicketLink({ provider, eventId: p.tnEventId, show: stop.show, venueSlug: stop.venueSlug, surface: EVENT_PAGE_SURFACE }) : null);
  const subKey = eventSubId(EVENT_PAGE_SURFACE, stop.show, stop.venueSlug);
  const parkingHref = !stop.tombstoned && upcoming.length && spotHeroCovers(hub) && hub.lat !== null && hub.lng !== null ? buildSpotHeroUrl({ latitude: hub.lat, longitude: hub.lng, subKey }) : null;
  const eventContext = { show: stop.show, venueSlug: stop.venueSlug };

  const { transit } = head;
  // The venue page's own parking section, when it has one (the same model its card renders from).
  const venueParkingHref = parkingLotsModel(hub) ? `${venueHref}#parking` : null;
  // Parking facts the VENUE printed for this event (eventPolicies on the stop). None is stored today.
  const parkingFacts = stop.parkingFacts.filter((r) => tl.upcoming.some((g) => g.visit.visitId === r.visitId));
  const reEntry = stop.reEntry.filter((r) => tl.upcoming.some((g) => g.visit.visitId === r.visitId));
  const faqs = stop.tombstoned ? [] : stopFaqs({ showName: show.name, searchCity: stop.searchCity, venueName, upcoming, bag, bagScope: bag && bag.kind === 'event-rule' ? bag.rules.map((r) => head.bagScopeNote(r.text)).filter((x): x is string => !!x).join(' ') : '', pitParty, gateTimes });
  const perfOf = (key: string) => upcoming.find((p) => p.key === key);

  const jsonLd: Array<Record<string, unknown>> = [
    breadcrumbJsonLd([{ name: 'Events', path: EVENTS_INDEX_PATH }, { name: show.name, path: hubHref }, { name: venueName, path: eventStopPath(stop.show, stop.venueSlug) }]),
    ...upcoming.map((p) => performanceJsonLd({ showName: show.name, stopUrl: head.canonical, imageUrl: head.card.url, venue: { name: venueName, city: hub.city, state: hub.state, lat: hub.lat, lng: hub.lng }, performance: p, hasTicketLink: !!ticketUrlFor(p) })),
  ];
  const indexLink = eventPageHref({ kind: 'index' }, 'events_hub_list');
  const hubLink = eventPageHref({ kind: 'hub', show: stop.show }, 'events_hub_list');

  return (
    <>
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}
      <article className="page-content mx-auto w-full max-w-[640px] px-4 pb-10 lg:max-w-3xl" data-ad-region="content" data-event-stop={`${stop.show}~${stop.venueSlug}`} style={{ overflowAnchor: 'none' }}>
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 pt-3.5 font-rd text-[12px] text-rd-ink-faint">
          {indexLink ? <EventPageLink href={indexLink.href} linkSurface={indexLink.surface} className="no-underline hover:text-rd-ink">Events</EventPageLink> : <span>Events</span>}
          <span aria-hidden="true">/</span>
          {hubLink ? <EventPageLink href={hubLink.href} linkSurface={hubLink.surface} show={stop.show} className="no-underline hover:text-rd-ink">{show.name}</EventPageLink> : <span>{show.name}</span>}
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-rd-ink-soft">{venueName}</span>
        </nav>

        <header className="flex flex-col gap-2.5 pt-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-white ${stop.tombstoned ? 'bg-rd-ink-soft' : 'bg-rd-red'}`}>{stop.tombstoned ? 'Removed' : 'Live event'}</span>
            {upcoming.length ? <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{`${upcoming.length} ${upcoming.length === 1 ? 'show' : 'shows'}`}</span> : null}
          </div>
          <h1 className="rd-display m-0 text-[40px] uppercase leading-[0.95] tracking-[-0.01em] text-rd-ink">{stopH1(show.name, stop.searchCity, venueName)}</h1>
          <p className="m-0 font-rd text-[15px] leading-[1.45] text-rd-ink-soft">
            {stop.tombstoned ? (
              <strong className="text-rd-ink">This stop has been removed from the schedule.</strong>
            ) : upcoming.length ? (
              <strong className="text-rd-ink">{showsPhrase(upcoming.map((p) => p.date), tl.upcoming.length)}</strong>
            ) : tl.returnsYear ? (
              <strong className="text-rd-ink">{`Returns in ${tl.returnsYear}, dates TBA`}</strong>
            ) : (
              <strong className="text-rd-ink">Dates are not announced.</strong>
            )}
            {place ? (<><br />{place}</>) : null}
          </p>
        </header>

        {!stop.tombstoned && upcoming.length ? (
          <section aria-label="Showtimes and tickets" className="mt-[18px] flex flex-col gap-2">
            <H2>Showtimes</H2>
            {tl.upcoming.map((g) => (
              <div key={g.visit.visitId} className="flex flex-col gap-2" data-visit={g.visit.visitId}>
                {tl.upcoming.length > 1 ? (
                  <h3 className="m-0 mt-1 font-rd text-[12px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{formatRangeWithYear(g.performances[0].date, g.performances[g.performances.length - 1].date)}</h3>
                ) : null}
                {g.performances.map((p) => {
                  const href = ticketUrlFor(p);
                  return (
                    <div key={p.key} data-performance={p.key} className="flex items-center gap-3 rounded-[14px] border border-rd-line bg-rd-card p-2.5">
                      <Tile ymd={p.date} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <time dateTime={p.startsAt} className="rd-display text-[22px] leading-none text-rd-ink">{formatClock(p.startTime)}</time>
                        <span className="font-rd text-[12px] text-rd-ink-faint">{showLabel(p)}</span>
                      </div>
                      {href ? (
                        // The button drops BY THE CLOCK: the server renders it
                        // while the show is upcoming, and the client leaf swaps
                        // it for "Started" at the start instant, without
                        // waiting for the page to be regenerated.
                        <ShowtimeGate startsAt={p.startsAt} started={<span className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-cream px-3.5 font-rd text-[14px] font-medium text-rd-ink-faint">{STARTED_LABEL}<span className="sr-only">: this show has started</span></span>}>
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
                            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-rd-red px-[18px] font-rd text-[15px] font-semibold text-white no-underline hover:brightness-95"
                          >
                            Tickets
                          </TrackedAffiliateLink>
                        </ShowtimeGate>
                      ) : (
                        // No link: the stored status when it is "sold out", else a neutral label that claims nothing about the sale.
                        <span className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-cream px-3.5 font-rd text-[14px] font-medium text-rd-ink-faint">
                          {STATUS_LABEL[p.status]}<span className="sr-only">: no ticket link for this show</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="m-0 mt-0.5 font-rd text-[11px] leading-[1.4] text-rd-ink-faint">{`${AFFILIATE_DISCLOSURE_TEXT} Times are local to the venue.`}</p>
          </section>
        ) : null}

        {parkingHref ? (
          <section className="mt-3 flex gap-2">
            <TrackedAffiliateLink
              href={parkingHref}
              partner="spothero"
              teamId=""
              sport=""
              surface={EVENT_PAGE_SURFACE}
              placement="event_page_parking"
              eventContext={eventContext}
              target="_blank"
              rel="noopener noreferrer sponsored"
              ariaLabel={`Reserve parking near ${venueName} on SpotHero`}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-card font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
            >
              Parking
            </TrackedAffiliateLink>
          </section>
        ) : null}

        {head.hasCard ? (
        <figure className="m-0 mt-4 overflow-hidden rounded-2xl border border-rd-line bg-rd-ink">
          {/* The generated text card: the wordmark, the show and year, the venue, the city and the dates. No photo, no art. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={eventCardPath(stop)} alt={head.card.alt} width={EVENT_CARD_WIDTH} height={EVENT_CARD_HEIGHT} loading="eager" decoding="async" className="block h-auto w-full" />
        </figure>
        ) : null}

        {!stop.tombstoned && (bag || parkingFacts.length || ((parkingHref || venueParkingHref) && upcoming.length) || transit || pitParty.length || gateTimes.length || reEntry.length) ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>Before you go</H2>
            {bag ? (
              <Card label={bag.label}>
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
                  <div className="flex flex-col gap-1.5" data-bag="pointer">
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
              </Card>
            ) : null}

            {/* THE PARKING CARD SLOT: only what the venue printed for this event
                (eventPolicies on the stop), each fact with its source. None is
                stored today, so no card renders. */}
            {parkingFacts.length ? (
              <Card label={`Parking for this event at ${venueName}`}>
                {parkingFacts.map((r, i) => (
                  <div key={i} className="flex flex-col gap-1.5" data-parking="event-fact">
                    <Body>{r.text}</Body>
                    <Source url={r.sourceUrl} observedAt={r.observedAt} />
                  </div>
                ))}
              </Card>
            ) : null}

            {/* In place of a lot list (ruling 2026-11-18): the reserve button, one
                link to the venue page's parking section, and one line. The hub's
                lots were written for the home team's game days and are not
                printed on a stop page. */}
            {upcoming.length && (parkingHref || venueParkingHref) ? (
              <div className="flex flex-col gap-2 rounded-[14px] border border-rd-line bg-rd-card p-3.5" data-parking="links">
                <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">Parking</span>
                <Body>Event-day lots and prices can differ from game days.</Body>
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
                    className="flex h-11 items-center justify-center rounded-xl border border-rd-line-strong bg-rd-card font-rd text-[14px] font-medium text-rd-ink no-underline hover:border-rd-ink"
                  >
                    Reserve parking
                  </TrackedAffiliateLink>
                ) : null}
                {venueParkingHref ? (
                  <EventPageLink href={venueParkingHref} linkSurface="event_to_venue" show={stop.show} venueSlug={stop.venueSlug} data-parking-link="" className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-medium text-rd-link no-underline hover:underline">
                    {`Parking on the ${venueName} guide`}
                  </EventPageLink>
                ) : null}
              </div>
            ) : null}

            {transit ? (
              <Card label="Transit">
                {/* A short list of lines reads as the lead; a long one is body text (Angel Stadium lists three long names). */}
                {transit.lines.length ? (transit.lines.join(', ').length <= 48 ? <Lead>{transit.lines.join(', ')}</Lead> : <Body><strong className="text-rd-ink">{transit.lines.join(', ')}</strong></Body>) : null}
                {transit.notes ? <Body>{transit.notes}</Body> : null}
              </Card>
            ) : null}

            {pitParty.length ? (
              <Card label="Pit Party">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-pit-party="">
                  {pitParty.map((p) => {
                    const perf = perfOf(p.performance)!;
                    return (
                      <li key={`${p.performance}-${p.start}`} className="font-rd text-[14px] leading-[1.45] text-rd-ink-soft">
                        <strong className="text-rd-ink">{`${formatShortDay(perf.date)}, ${formatClock(perf.startTime)} show:`}</strong>{` Pit Party ${formatClock(p.start)} to ${formatClock(p.end)}`}
                      </li>
                    );
                  })}
                </ul>
                <Body>{`Times as listed by ${venueName}. The Pit Party is a separate pass and is not sold through the ticket buttons above.`}</Body>
                {[...new Set(pitParty.map((p) => p.sourceUrl))].map((u) => <Source key={u} url={u} observedAt={pitParty.find((p) => p.sourceUrl === u)!.observedAt} />)}
              </Card>
            ) : null}

            {gateTimes.length ? (
              <Card label="Gates open">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-gate-times="">
                  {gateTimes.map((g) => {
                    const perf = perfOf(g.performance)!;
                    return (
                      <li key={`${g.performance}-${g.opensAt}`} className="font-rd text-[14px] leading-[1.45] text-rd-ink-soft">
                        <strong className="text-rd-ink">{`${formatShortDay(perf.date)}, ${formatClock(perf.startTime)} show:`}</strong>{` gates open at ${formatClock(g.opensAt)}`}
                      </li>
                    );
                  })}
                </ul>
                {[...new Set(gateTimes.map((g) => g.sourceUrl))].map((u) => <Source key={u} url={u} observedAt={gateTimes.find((g) => g.sourceUrl === u)!.observedAt} />)}
              </Card>
            ) : null}

            {reEntry.length ? (
              <Card label="Re-entry">
                {reEntry.map((r, i) => (
                  <div key={i} className="flex flex-col gap-1.5" data-re-entry="">
                    <Body>{r.text}</Body>
                    <Source url={r.sourceUrl} observedAt={r.observedAt} />
                  </div>
                ))}
              </Card>
            ) : null}
          </section>
        ) : null}

        {!stop.tombstoned && tl.lastVisit ? (
          <section className="mt-6 flex flex-col gap-2.5" data-last-visit={tl.lastVisit.visit.visitId}>
            <H2>Last visit</H2>
            <div className="flex flex-col rounded-[14px] border border-rd-line bg-rd-card px-3.5 py-1">
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
          <EventPageLink href={venueHref} linkSurface="event_to_venue" show={stop.show} venueSlug={stop.venueSlug} className="flex items-center justify-between rounded-[14px] border border-rd-line bg-rd-card p-3.5 text-rd-ink no-underline">
            <span className="flex flex-col gap-0.5"><span className="font-rd text-[14px] font-semibold">{`${venueName} guide`}</span><span className="font-rd text-[12px] text-rd-ink-faint">Venue page on PromoNight</span></span>
            <span aria-hidden="true" className="text-rd-ink-faint">›</span>
          </EventPageLink>
          {teams.map((t) => (
            <EventPageLink key={t.teamId} href={t.href} linkSurface="event_to_team" show={stop.show} venueSlug={stop.venueSlug} className="flex items-center justify-between rounded-[14px] border border-rd-line bg-rd-card p-3.5 text-rd-ink no-underline">
              <span className="flex flex-col gap-0.5"><span className="font-rd text-[14px] font-semibold">{t.isCfb ? `${t.name} game days` : `${t.name} promos`}</span><span className="font-rd text-[12px] text-rd-ink-faint">{t.isCfb ? 'Schedule and game day guide' : 'Giveaways and theme nights'}</span></span>
              <span aria-hidden="true" className="text-rd-ink-faint">›</span>
            </EventPageLink>
          ))}
        </section>

        {otherStops.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>{`More ${show.name} stops`}</H2>
            <div className="flex flex-col rounded-[14px] border border-rd-line bg-rd-card px-3.5 py-1">
              {otherStops.slice(0, 5).map((s, i, arr) => {
                const link = eventPageHref({ kind: 'stop', show: s.show, venue: s.venueSlug }, 'events_hub_list');
                if (!link) return null;
                return (
                  <EventPageLink key={s.venueSlug} href={link.href} linkSurface={link.surface} show={s.show} venueSlug={s.venueSlug} className={`flex min-h-11 items-center justify-between gap-3 py-3 text-rd-ink no-underline ${i < arr.length - 1 ? 'border-b border-rd-line' : ''}`}>
                    <span className="font-rd text-[14px] font-semibold">{s.searchCity}</span>
                    <span className="text-right font-rd text-[12px] text-rd-ink-faint">{`${displayVenueName(s.venueName)} · ${s.upcomingCount} ${s.upcomingCount === 1 ? 'show' : 'shows'}`}</span>
                  </EventPageLink>
                );
              })}
            </div>
            {hubLink ? <EventPageLink href={hubLink.href} linkSurface={hubLink.surface} show={stop.show} className="inline-flex min-h-11 items-center self-start font-rd text-[14px] font-semibold text-rd-link no-underline hover:underline">See every stop by month</EventPageLink> : null}
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <H2>Questions</H2>
            <div className="flex flex-col rounded-[14px] border border-rd-line bg-rd-card px-3.5 py-1">
              {faqs.map((f, i) => (
                <div key={f.q} className={`flex flex-col gap-1 py-3 ${i < faqs.length - 1 ? 'border-b border-rd-line' : ''}`}>
                  <h3 className="m-0 font-rd text-[14px] font-semibold text-rd-ink">{f.q}</h3>
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
