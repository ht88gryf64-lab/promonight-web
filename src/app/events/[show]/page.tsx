import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventHubView } from '@/components/events/EventListViews';
import { getUpcomingStopSummaries } from '@/lib/events/event-stops';
import { EVENTS_SITE_URL, eventHubPath, eventShowOf, hubTitle, isEventsPagesLive } from '@/lib/events/event-pages';

// /events/{show} (Phase 2, 2026-11-18): the show hub, every upcoming stop by
// month. It must exist as its own route: without it the path would fall to
// /[sport]/[team]. An unknown show is a 404, as is every show while
// EVENTS_PAGES_LIVE is not "true".
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ show: string }[]> {
  return [];
}

type Params = Promise<{ show: string }>;

async function load(params: Params) {
  const { show: slug } = await params;
  const show = eventShowOf(slug);
  if (!show) return null;
  const stops = await getUpcomingStopSummaries(show.slug, new Date());
  const lastYear = stops.map((s) => s.lastDate).sort().pop()?.slice(0, 4);
  return { show, stops, year: lastYear ? Number(lastYear) : null };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!isEventsPagesLive()) return {};
  const r = await load(params);
  if (!r) return {};
  const title = hubTitle(r.show.name, r.year);
  const description = `${r.show.name}${r.year ? ` ${r.year}` : ''} stops at venues PromoNight covers, by month: dates, a ticket link for every show, and each venue's bag, parking and transit details.`;
  const canonical = `${EVENTS_SITE_URL}${eventHubPath(r.show.slug)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', siteName: 'PromoNight', url: canonical, title: `${title} | PromoNight`, description },
    robots: r.stops.length ? undefined : { index: false, follow: true },
  };
}

export default async function EventHubPage({ params }: { params: Params }) {
  if (!isEventsPagesLive()) notFound();
  const r = await load(params);
  if (!r) notFound();
  return <EventHubView show={r.show} stops={r.stops} year={r.year} />;
}
