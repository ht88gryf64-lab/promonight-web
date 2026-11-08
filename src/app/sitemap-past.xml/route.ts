import { getPastPromoSitemap } from '@/lib/promo-pages';
import { siteTodayYmd } from '@/lib/site-today';

// The played promo pages still inside the index window (the current and the
// previous season, archive pass, step 6, 2026-11-08), one URL per page, in
// their own sitemap file so /sitemap.xml, its revalidate hook and the live
// battery's tripwires over it are unchanged: every URL there is still an
// upcoming page linked from its team page. Referenced from
// /sitemap-index.xml. Rebuilt once a day; a page leaves this file the day
// it leaves the window, which is also the day its robots meta turns noindex.
export const revalidate = 86400;

const BASE_URL = 'https://www.getpromonight.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(): Promise<Response> {
  const { pages } = await getPastPromoSitemap(siteTodayYmd());
  const urls = pages
    .map((e) => `  <url><loc>${esc(`${BASE_URL}${e.path}`)}</loc>${e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : ''}<changefreq>yearly</changefreq><priority>0.4</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
