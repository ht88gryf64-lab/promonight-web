import type { Team, Promo, PromoType, Venue, PlayoffPromo } from '@/lib/types';
import { generateTeamFAQs, teamDisplayName, type PlayoffFAQContext } from '@/lib/promo-helpers';

interface JsonLdProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
  playoffPromos?: PlayoffPromo[];
  playoffContext?: PlayoffFAQContext;
}

function buildPlace(venue: Venue | null) {
  if (!venue) return undefined;
  return {
    '@type': 'Place',
    name: venue.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
    },
  };
}

export function JsonLd({
  team,
  promos,
  venue,
  promoCounts,
  playoffPromos,
  playoffContext,
}: JsonLdProps) {
  const today = new Date().toISOString().split('T')[0];
  const upcomingPromos = promos.filter((p) => p.date >= today);

  const teamUrl = `https://www.getpromonight.com/${team.sportSlug}/${team.id}`;

  const events = upcomingPromos.map((promo) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: promo.title,
    startDate: promo.date,
    description: promo.description || `${promo.title} at ${venue?.name || 'the stadium'}`,
    location: buildPlace(venue),
    organizer: {
      '@type': 'SportsTeam',
      name: teamDisplayName(team),
    },
  }));

  // Playoff Events — only for dated promos. Recurring (date=null) get no Event schema.
  // startDate is emitted date-only (YYYY-MM-DD). Upstream Firestore values store a
  // noon placeholder (scanner uses `new Date(dateStr + "T12:00:00")` with no TZ, so
  // the hour portion is an artifact of whatever machine wrote the doc — UTC on CI,
  // CDT on dev boxes). Date-only is honest and still valid ISO-8601.
  const playoffEvents = (playoffPromos ?? [])
    .filter((p) => !!p.date)
    .map((promo) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: promo.title,
      startDate: (promo.date as string).slice(0, 10),
      description:
        promo.description ||
        `${promo.title}${venue ? ` at ${venue.name}` : ''}`,
      location: buildPlace(venue),
      organizer: {
        '@type': 'SportsTeam',
        name: teamDisplayName(team),
      },
      offers: {
        '@type': 'Offer',
        url: teamUrl,
      },
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    }));

  const faqs = generateTeamFAQs(team, promos, venue, promoCounts, playoffContext);
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

  const schemas = [
    ...events,
    ...playoffEvents,
    ...(faqSchema ? [faqSchema] : []),
  ];

  if (schemas.length === 0) return null;

  // Emit one <script> per entity (Google Rich Results Test's code-paste parser
  // doesn't accept bare JSON arrays; one-tag-per-entity also matches Google's
  // documented preferred format).
  return (
    <>
      {schemas.map((s, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
