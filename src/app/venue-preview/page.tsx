import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getVenueHub, displayVenueName } from '@/lib/venue-hub';
import { VenueHubView } from '@/components/venue-hub/VenueHubView';

// TEMPORARY preview route for Phase 1 (N=1). Renders ONE building so the hub
// component can be reviewed before /venues/[slug] routing is built. noindex, and
// deleted once the real route lands.
const PREVIEW_SLUG = 'arrowhead-stadium';
// The eventual canonical home of this building, used for the JSON-LD url.
const CANONICAL = `https://www.getpromonight.com/venues/${PREVIEW_SLUG}`;

export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  const hub = await getVenueHub(PREVIEW_SLUG);
  const short = hub ? displayVenueName(hub.name) : 'Venue';
  return {
    // Title names the queries, not the venue.
    title: `${short} Parking, Bag Policy and Gameday Guide`,
    robots: { index: false, follow: false },
  };
}

export default async function VenuePreviewPage() {
  const hub = await getVenueHub(PREVIEW_SLUG);
  if (!hub) notFound();
  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <VenueHubView hub={hub} canonicalUrl={CANONICAL} />
    </div>
  );
}
