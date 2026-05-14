import type { ScoredPromoWithTeam } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';

type Faq = { question: string; answer: string };

type ScoredJsonLdProps = {
  url: string;
  title: string;
  description: string;
  lastUpdated: string;
  faqs: Faq[];
  itemListItems: ScoredPromoWithTeam[];
};

// Emits Article + FAQPage + ItemList JSON-LD as one <script> per entity,
// matching the existing JsonLd.tsx pattern (Google Rich Results Test prefers
// one-tag-per-entity). ItemList is new to this codebase, added for the
// scoring discovery pages.
//
// Each ItemList entry is a SportsEvent rather than a bare Event so the
// schema can carry team + venue context. Description is capped at 280
// characters (Twitter-era convention; Google trims schema descriptions
// around that length).
export function ScoredJsonLd({
  url,
  title,
  description,
  lastUpdated,
  faqs,
  itemListItems,
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
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'SportsEvent',
            name: p.title,
            startDate: p.date,
            description: fullDescription.slice(0, 280),
            organizer: {
              '@type': 'SportsTeam',
              name: teamName,
            },
          },
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
