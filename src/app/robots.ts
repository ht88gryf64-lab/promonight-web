import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: '*', allow: '/', disallow: '/api/' },
    ],
    sitemap: 'https://www.getpromonight.com/sitemap.xml',
  };
}
