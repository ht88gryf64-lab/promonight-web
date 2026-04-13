import type { MetadataRoute } from 'next';
import { getAllTeams } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const teams = await getAllTeams();

  const teamPages = teams.map((t) => ({
    url: `https://getpromonight.com/${t.sportSlug}/${t.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    {
      url: 'https://getpromonight.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://getpromonight.com/teams',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...teamPages,
    {
      url: 'https://getpromonight.com/privacy',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://getpromonight.com/terms',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
