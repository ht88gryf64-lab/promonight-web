// The sitemap index (archive pass, step 6, 2026-11-08): the live sitemap
// (/sitemap.xml, upcoming pages, team pages, hubs, the archive pages) and the
// played promo pages inside the index window (/sitemap-past.xml). robots.txt
// names both the index and /sitemap.xml itself, so a crawler that reads only
// one Sitemap line still finds the live set.
export const revalidate = 86400;

const BASE_URL = 'https://www.getpromonight.com';

export async function GET(): Promise<Response> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${BASE_URL}/sitemap.xml</loc></sitemap>\n  <sitemap><loc>${BASE_URL}/sitemap-past.xml</loc></sitemap>\n</sitemapindex>\n`;
  return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
