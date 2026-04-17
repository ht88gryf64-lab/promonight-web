import type { Team, Promo, PromoType, Venue } from '@/lib/types';
import { generateTeamFAQs } from '@/lib/promo-helpers';

interface JsonLdProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
}

export function JsonLd({ team, promos, venue, promoCounts }: JsonLdProps) {
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

  const faqs = generateTeamFAQs(team, promos, venue, promoCounts);
  const faqSchema = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }
    : null;

  const schemas = [...events, ...(faqSchema ? [faqSchema] : [])];

  if (schemas.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
