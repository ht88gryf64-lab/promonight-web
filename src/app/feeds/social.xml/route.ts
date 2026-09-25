import { buildSocialRss } from '@/lib/social-feed/rss';
import { getFeedRssItems } from '@/lib/social-feed/feed';

// Public RSS 2.0 feed for social automation (Vista Social RSS import). Not in
// the sitemap and noindex: it exists for the importer, not for search.
// Regenerates hourly; "today" for the 7-day window is computed in Central time
// at each regeneration.
export const revalidate = 3600;

export async function GET() {
  const now = new Date();
  const { items } = await getFeedRssItems(now);
  return new Response(buildSocialRss(items, now), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
