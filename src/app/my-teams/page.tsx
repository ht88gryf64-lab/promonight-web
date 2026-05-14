import type { Metadata } from 'next';
import { getAllTeams } from '@/lib/data';
import { MyTeamsView } from '@/components/my-teams-view';

// Personalization destination. Starred list lives in localStorage, so the
// page itself has no useful indexable content for an anonymous crawler — but
// we keep follow=true so any internal links inside the page still propagate
// crawl signal.
export const metadata: Metadata = {
  title: 'Your Teams',
  description:
    'Your personalized promo calendar across every starred pro sports team.',
  robots: { index: false, follow: true },
};

export const revalidate = 3600;

export default async function MyTeamsPage() {
  // All 167 teams pass through the server boundary so the client view can
  // resolve team metadata (color, name, sport) for both featured-state
  // suggestions and starred-list rendering without a second round-trip.
  const teams = await getAllTeams();
  return <MyTeamsView teams={teams} />;
}
