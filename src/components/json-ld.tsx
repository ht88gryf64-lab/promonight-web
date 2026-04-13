import type { Team, Promo, Venue } from '@/lib/types';

interface JsonLdProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
}

export function JsonLd({ team, promos, venue }: JsonLdProps) {
  const today = new Date().toISOString().split('T')[0];
  const upcomingPromos = promos.filter((p) => p.date >= today);

  const events = upcomingPromos.map((promo) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: promo.title,
    startDate: promo.date,
    description: promo.description || `${promo.title} at ${venue?.name || 'the stadium'}`,
    location: venue
      ? {
          '@type': 'Place',
          name: venue.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: venue.address,
          },
        }
      : undefined,
    organizer: {
      '@type': 'SportsTeam',
      name: `${team.city} ${team.name}`,
    },
  }));

  if (events.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(events) }}
    />
  );
}
