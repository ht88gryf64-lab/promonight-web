import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { archivoHouse } from '@/components/redesign/fonts-house';
import {
  getVenueHub,
  getAllVenueHubSlugs,
  venueHubIsIndexable,
  resolveTicketTeam,
  displayVenueName,
  cityState,
} from '@/lib/venue-hub';
import { VenueHubView } from '@/components/venue-hub/VenueHubView';

// SSG/ISR, same pattern as the team pages. 24h ISR; on-demand revalidate stays
// the real freshness path when the sweep writes new venue facts.
export const revalidate = 86400;

const BASE_URL = 'https://www.getpromonight.com';

export async function generateStaticParams() {
  const slugs = await getAllVenueHubSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hub = await getVenueHub(slug);
  if (!hub) return {};
  const short = displayVenueName(hub.name);
  const loc = cityState(hub);
  const canonical = `${BASE_URL}/venues/${slug}`;
  // INDEXING FLOOR (locked): below the floor the page renders what it has but
  // emits noindex (follow, so outbound links are still crawled).
  const indexable = venueHubIsIndexable(hub);
  return {
    // Title names the queries, not the venue.
    title: `${short} Parking, Bag Policy and Gameday Guide`,
    description: `Bag policy, parking, gate times, transit, and tailgating for ${short}${
      loc ? ` in ${loc}` : ''
    }. Reserve nearby parking and plan your gameday visit.`,
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function VenueHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await getVenueHub(slug);
  if (!hub) notFound();
  const ticketTeam = await resolveTicketTeam(hub);
  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <VenueHubView hub={hub} canonicalUrl={`${BASE_URL}/venues/${slug}`} ticketTeam={ticketTeam} />
    </div>
  );
}
