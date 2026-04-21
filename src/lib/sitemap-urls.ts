import 'server-only';
import sitemap from '@/app/sitemap';

export async function getAllSitemapUrls(): Promise<string[]> {
  const entries = await sitemap();
  return entries.map((e) => e.url);
}
