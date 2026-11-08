// robots.txt, written by hand so the line order is ours (chore/bot-firewall,
// 2026-11-02). Served by src/app/robots.txt/route.ts.
//
// Why not app/robots.ts: Next's metadata serializer writes every Allow line
// before every Disallow line, so a group read `Allow: /` first. Crawlers that
// apply RFC 9309 longest-match precedence still read it correctly, but a
// first-match parser stops at `Allow: /` and never sees `Disallow: /api/`.
// In this order both kinds of parser reach the same verdicts:
//
//   Allow: /api/promo-card/   the promo pages' Event JSON-LD image
//   Allow: /api/share-card/   the promo pages' og:image and twitter:image
//   Disallow: /api/           everything else under /api/
//   Allow: /                  every page, /ads.txt and /app-ads.txt
//
// Every group carries the same three lines. A crawler obeys only its most
// specific group, so a named group with `Allow: /` alone let that crawler into
// /api/ even though `*` disallowed it; ClaudeBot and PerplexityBot were
// crawling /api/ for that reason.

// Every image route a page names in og:image, twitter:image or JSON-LD needs
// an Allow here: Twitterbot and the other card fetchers obey robots.txt for
// the image too (fix/robots-share-card, 2026-11-04). The live guard
// "every page image is allowed" in scripts/live/team-pages.live.test.ts
// catches a new one.
export const ROBOTS_GROUP_LINES = [
  'Allow: /api/promo-card/',
  'Allow: /api/share-card/',
  'Disallow: /api/',
  'Allow: /',
] as const;

export const ROBOTS_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Google-Extended',
  'ClaudeBot',
  'Applebot-Extended',
  '*',
] as const;

export const ROBOTS_SITEMAP = 'https://www.getpromonight.com/sitemap.xml';
/** The index (archive pass, step 6, 2026-11-08): /sitemap.xml plus
 *  /sitemap-past.xml, the played promo pages inside the index window. */
export const ROBOTS_SITEMAP_INDEX = 'https://www.getpromonight.com/sitemap-index.xml';

export function robotsTxt(): string {
  const groups = ROBOTS_AGENTS.map((ua) => [`User-Agent: ${ua}`, ...ROBOTS_GROUP_LINES].join('\n'));
  return `${groups.join('\n\n')}\n\nSitemap: ${ROBOTS_SITEMAP}\nSitemap: ${ROBOTS_SITEMAP_INDEX}\n`;
}
