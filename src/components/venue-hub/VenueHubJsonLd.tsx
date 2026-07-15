import type { HubFaqItem } from '@/components/hub/HubFaq';

// Place/StadiumOrArena + FAQPage JSON-LD for a venue hub. The FAQ array is the
// same one the page renders, so the copy and the structured data stay identical
// (the FAQ is also where overflow bag-policy text lands).
export function VenueHubJsonLd({
  name,
  url,
  city,
  state,
  lat,
  lng,
  faqs,
}: {
  name: string;
  url: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  faqs: HubFaqItem[];
}) {
  const place: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'StadiumOrArena',
    name,
    url,
  };
  if (city || state) {
    place.address = {
      '@type': 'PostalAddress',
      ...(city ? { addressLocality: city } : {}),
      ...(state ? { addressRegion: state } : {}),
      addressCountry: 'US',
    };
  }
  if (lat !== null && lng !== null) {
    place.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }

  const faqPage =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(place) }}
      />
      {faqPage ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
        />
      ) : null}
    </>
  );
}
