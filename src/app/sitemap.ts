import type { MetadataRoute } from 'next';
import { getAllTeams, getPlayoffConfig, getStillAlivePlayoffTeamIds } from '@/lib/data';
import { getAllCfbSchoolIds } from '@/lib/cfb/data';
import { isCfbHubLive, getLeagueHub } from '@/lib/league-hubs';
import { getIndexableVenueHubSitemapEntries } from '@/lib/venue-hub';

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

  // CFB vertical: the /cfb hub + 86 team pages. Gated on the SAME
  // LEAGUE_HUB_REGISTRY live flag as the nav (so the sitemap follows go-live),
  // and fail-closed on a read error like the playoff hub. Flows to the IndexNow
  // deploy hook automatically (getAllSitemapUrls -> sitemap()).
  const cfbLive = isCfbHubLive();
  const cfbSchoolIds = cfbLive ? await getAllCfbSchoolIds().catch(() => []) : [];
  const cfbHubEntries = cfbLive
    ? [
        {
          url: `${BASE_URL}/cfb`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.9,
        },
      ]
    : [];
  const cfbTeamPages = cfbSchoolIds.map((id) => ({
    url: `${BASE_URL}/cfb/${id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // WNBA + MLS league hubs. Gated on the SAME LEAGUE_HUB_REGISTRY live flag as
  // the nav (so the sitemap follows go-live), mirroring the CFB pattern above.
  // Fail-closed: a hub URL is emitted only once its route ships (live flips true),
  // so there is never a sitemap entry pointing at a route that does not exist.
  // Daily changefreq like /mlb: both run a daily promo cadence and their
  // this-week rail turns over each day. Team pages for these leagues already flow
  // through teamPages above (every getAllTeams doc, any league).
  const leagueHubEntries = (['WNBA', 'MLS'] as const)
    .map((lg) => getLeagueHub(lg))
    .filter((hub): hub is NonNullable<typeof hub> => hub?.live === true)
    .map((hub) => ({
      url: `${BASE_URL}${hub.href}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }));

  // Venue logistics hubs (/venues/[slug]). Only buildings that clear the indexing
  // floor (lat/lng + two of bag/parking/transit + verified) are listed; the rest
  // render but stay noindex and out of the sitemap. lastmod is the doc's real
  // updatedAt, not sitemap-generation time. Fail-closed on a read error. Flows to
  // the IndexNow deploy hook automatically (getAllSitemapUrls -> sitemap()).
  const venueEntries = await getIndexableVenueHubSitemapEntries().catch(() => []);
  const venuePages = venueEntries.map((v) => ({
    url: `${BASE_URL}/venues/${v.slug}`,
    lastModified: v.lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

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
    {
      // MLB league hub. Daily changefreq because MLB promos run a daily cadence
      // and the hub's this-week rail turns over each day; hub-tier priority.
      url: `${BASE_URL}/mlb`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...cfbHubEntries,
    ...leagueHubEntries,
    ...playoffHubEntries,
    ...teamPages,
    ...cfbTeamPages,
    ...venuePages,
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
      url: `${BASE_URL}/promos/soccer-jersey-nights`,
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
      url: `${BASE_URL}/promos/food-deals`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Scoring discovery pages (promo-pipeline PR #19 surfaced to web).
    // /best-promos and /team-rankings are hub-tier pages at 0.9; the
    // bobbleheads sub-page is 0.8 since it's a narrower slice of the
    // same data. changefreq matches the weekly pipeline cadence.
    {
      url: `${BASE_URL}/best-promos`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/best-promos/bobbleheads`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/team-rankings`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      // World Cup host-city travel hub. Hub-tier 0.9; weekly is fine since the
      // editorial city map is static and the MLB game/promo overlay revalidates
      // on the page itself (6h ISR). The IndexNow deploy hook submits this URL
      // automatically on each successful Production deploy.
      url: `${BASE_URL}/world-cup`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      // Email-capture funnel entry. Indexable conversion hub; weekly is fine
      // since the page copy is static.
      url: `${BASE_URL}/follow`,
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
