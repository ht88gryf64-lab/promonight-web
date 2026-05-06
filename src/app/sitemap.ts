import type { MetadataRoute } from 'next';
import { getAllTeams, getPlayoffConfig, getStillAlivePlayoffTeamIds } from '@/lib/data';

const BASE_URL = 'https://www.getpromonight.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [teams, playoffConfig] = await Promise.all([
    getAllTeams(),
    // Fail-closed: if the playoff config read throws, skip the playoff hub
    // entry and fall back to default team lastmod for everyone.
    getPlayoffConfig().catch(() => null),
  ]);

  const now = new Date();
  const playoffsActive = playoffConfig?.playoffsActive === true;
  const playoffUpdatedAt =
    playoffsActive && playoffConfig?.updatedAt
      ? new Date(playoffConfig.updatedAt)
      : null;
  const activePlayoffIds = new Set(
    playoffsActive ? getStillAlivePlayoffTeamIds(playoffConfig!) : [],
  );

  const teamPages = teams.map((t) => {
    // Active playoff team: lastmod = scanner freshness (playoffUpdatedAt).
    // Non-playoff team: lastmod = sitemap generation time (existing behavior).
    //
    // Using playoffUpdatedAt directly (rather than Math.max(now, playoff))
    // because `now` always wins that max — scanner timestamps are in the
    // past. The goal is for Google's lastmod signal to reflect when the
    // page's playoff content actually changed, which is the scanner run,
    // not the sitemap regeneration.
    const teamLastmod =
      activePlayoffIds.has(t.id) && playoffUpdatedAt ? playoffUpdatedAt : now;
    return {
      url: `${BASE_URL}/${t.sportSlug}/${t.id}`,
      lastModified: teamLastmod,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    };
  });

  // Only include the /playoffs hub in the sitemap when playoffs are active.
  // When playoffsActive flips to false, next sitemap regeneration drops it.
  const playoffHubEntries = playoffsActive
    ? [
        {
          url: `${BASE_URL}/playoffs`,
          // Uses scanner freshness rather than sitemap-generation time so
          // Google's lastmod signal reflects real data change cadence.
          lastModified: playoffUpdatedAt ?? now,
          changeFrequency: 'hourly' as const,
          priority: 0.8,
        },
      ]
    : [];

  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/teams`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...playoffHubEntries,
    ...teamPages,
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/promos/this-week`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/promos/bobbleheads`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/promos/jersey-giveaways`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/promos/theme-nights`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/download`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
