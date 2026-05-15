import type { ScoredPromoWithTeam } from '@/lib/types';
import type { SchemaLocation } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';

type Faq = { question: string; answer: string };

type ScoredJsonLdProps = {
  url: string;
  title: string;
  description: string;
  lastUpdated: string;
  faqs: Faq[];
  itemListItems: ScoredPromoWithTeam[];
  // Map<team.id, SchemaLocation> produced by getSchemaLocationsForTeams.
  // Items whose team is absent from this map render WITHOUT the location
  // field (rather than fabricating an address). Should be a rare case once
  // the static fallback in venue-locations.ts covers all 24 venue-doc-less
  // teams; left here as a defense against future drift.
  locationsByTeamId: Map<string, SchemaLocation>;
};

// Site default OG image used as the SportsEvent `image` field for every
// scored promo. Team-specific logos would be more accurate but the Team
// type doesn't carry a logo URL today; using the site default satisfies
// the Rich Results recommended-field warning without introducing a new
// image-resolution path. Replace per-team when a logo source is added.
const DEFAULT_EVENT_IMAGE =
  'https://www.getpromonight.com/og-image.png';

// Emits Article + FAQPage + ItemList JSON-LD as one <script> per entity,
// matching the existing JsonLd.tsx pattern (Google Rich Results Test
// prefers one-tag-per-entity). ItemList is new to this codebase, added
// for the scoring discovery pages.
//
// Each ItemList entry is a SportsEvent carrying location (Place +
// PostalAddress), eventStatus, image, and performer (the home team as
// SportsTeam). organizer is dropped in favor of performer per Rich
// Results guidance for sports events. Description is capped at 280
// characters (Google trims schema descriptions around that length).
export function ScoredJsonLd({
  url,
  title,
  description,
  lastUpdated,
  faqs,
  itemListItems,
  locationsByTeamId,
}: ScoredJsonLdProps) {
  const schemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url,
      dateModified: lastUpdated,
      author: {
        '@type': 'Organization',
        name: 'PromoNight',
        url: 'https://www.getpromonight.com',
      },
      publisher: {
        '@type': 'Organization',
        name: 'PromoNight',
        url: 'https://www.getpromonight.com',
      },
    },
  ];

  if (faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    });
  }

  if (itemListItems.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: itemListItems.length,
      itemListElement: itemListItems.map((p, i) => {
        const teamName = teamDisplayName(p.team);
        const baseDescription = p.description || `${p.title} for ${teamName}.`;
        const fullDescription = `Score ${p.score}. ${baseDescription}`;
        const loc = locationsByTeamId.get(p.team.id);
        // Required by Rich Results when present; omitted entirely when no
        // location data is available rather than fabricated. eventStatus
        // is hardcoded to Scheduled; cancelled / postponed mapping is a
        // future enhancement once the pipeline emits status data.
        const item: Record<string, unknown> = {
          '@type': 'SportsEvent',
          name: p.title,
          startDate: p.date,
          description: fullDescription.slice(0, 280),
          eventStatus: 'https://schema.org/EventScheduled',
          image: DEFAULT_EVENT_IMAGE,
          performer: {
            '@type': 'SportsTeam',
            name: teamName,
          },
        };
        if (loc) {
          item.location = {
            '@type': 'Place',
            name: loc.venueName,
            address: {
              '@type': 'PostalAddress',
              addressLocality: loc.addressLocality,
              addressRegion: loc.addressRegion,
              addressCountry: loc.addressCountry,
            },
          };
        }
        return {
          '@type': 'ListItem',
          position: i + 1,
          item,
        };
      }),
    });
  }

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
