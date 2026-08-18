// JSON-LD for /venues/bag-policies. Pure builder per the rivalry-jsonld
// precedent: one script per entity, CollectionPage + ItemList + FAQPage, and
// the rows argument MUST be the exact flattened group order the DOM renders so
// numberOfItems and item order can never diverge from the served list.
//
// Deliberately NO per-venue StadiumOrArena entities: each /venues/[slug] page
// already owns its building's StadiumOrArena + FAQPage (VenueHubJsonLd), and
// restating them here would duplicate-claim. ListItem pointers only.

import type { BagFaq, BagPolicyRow } from '@/lib/venue-bag-policies';

const BASE = 'https://www.getpromonight.com';

type Schema = Record<string, unknown>;

export function buildBagPolicyJsonLd(
  title: string,
  description: string,
  orderedRows: BagPolicyRow[],
  faqs: BagFaq[],
): Schema[] {
  const url = `${BASE}/venues/bag-policies`;
  const schemas: Schema[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url,
      isPartOf: { '@type': 'WebSite', name: 'PromoNight', url: BASE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: orderedRows.length,
      itemListElement: orderedRows.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${r.venueName} bag policy`,
        url: `${BASE}/venues/${r.slug}`,
      })),
    },
  ];
  if (faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return schemas;
}
