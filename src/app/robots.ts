import type { MetadataRoute } from 'next';

// Every group carries the same /api/ rules (chore/bot-firewall, 2026-11-02).
// A crawler obeys only its most specific group (RFC 9309), so a named group
// with `Allow: /` alone let that crawler into /api/ even though `*` disallowed
// it; ClaudeBot and PerplexityBot were crawling /api/ for that reason.
//
// /api/promo-card/ is the promo pages' image (og:image and the Event JSON-LD
// image, see cardImagePath), so it stays crawlable in every group. The longer
// Allow wins over `Disallow: /api/` under longest-match precedence.
const API_RULES = {
  allow: ['/', '/api/promo-card/'],
  disallow: '/api/',
};

const NAMED_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Google-Extended',
  'ClaudeBot',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...NAMED_AGENTS.map((userAgent) => ({ userAgent, ...API_RULES })),
      { userAgent: '*', ...API_RULES },
    ],
    sitemap: 'https://www.getpromonight.com/sitemap.xml',
  };
}
