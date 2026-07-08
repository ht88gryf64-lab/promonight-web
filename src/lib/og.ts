import type { Metadata } from 'next';

// Shared Open Graph helpers. The root layout sets openGraph.url to the homepage,
// and Next.js does NOT deep-merge openGraph: a child that defines no openGraph
// inherits the root's wholesale, so its og:url wrongly resolves to "/". Pages
// that DO define a partial openGraph (e.g. without images) instead lose the
// inherited image. pageOpenGraph() returns a complete openGraph whose url
// matches the page's canonical and that always carries the default card.
// og:title and og:description fall back to the page's title/description.

const SITE_URL = 'https://www.getpromonight.com';

// Default social card. Hyphen, not em dash, per the house no-em-dash rule.
export const DEFAULT_OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'PromoNight - every giveaway, every team',
} as const;

/** Complete openGraph for a page at `path` (leading slash, e.g. "/about"). */
export function pageOpenGraph(path: string): NonNullable<Metadata['openGraph']> {
  return {
    type: 'website',
    siteName: 'PromoNight',
    url: `${SITE_URL}${path}`,
    images: [DEFAULT_OG_IMAGE],
  };
}
