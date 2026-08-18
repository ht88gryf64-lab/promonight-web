import type { MetadataRoute } from 'next';
import { getAllTeams, getPlayoffConfig, getStillAlivePlayoffTeamIds } from '@/lib/data';
import { getIndexableCfbSchoolIds } from '@/lib/cfb/data';
import { getAllMatchupSlugs } from '@/lib/cfb/matchups';
import { isCfbHubLive, LEAGUE_HUBS } from '@/lib/league-hubs';
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

  // CFB team pages (the /cfb hub entry itself comes from the registry loop
  // below). Gated on the SAME LEAGUE_HUB_REGISTRY live flag as the nav (so the
  // sitemap follows go-live). Flows to the IndexNow deploy hook automatically
  // (getAllSitemapUrls -> sitemap()).
  //
  // FAIL LOUDLY, same treatment as the venueHubs read below: this used to be
  // `.catch(() => [])`, which on any Firestore error served a complete-looking
  // sitemap silently missing all 86 CFB team pages (and the IndexNow hook
  // skipped them too). A single collection read cannot partially succeed, so
  // the honest outcomes are the full CFB set or a failed render (build failure
  // at deploy time; the deployed sitemap.xml is static and cannot break at
  // runtime), never a silent hole.
  // Indexable ids only: the same cfbSchoolBelowIndexFloor predicate the page
  // uses for its robots noindex, so a below-floor stub (washington-state: one
  // game, no venue doc) is never sitemap-listed or IndexNow-pushed while it
  // serves noindex.
  const cfbLive = isCfbHubLive();
  const cfbSchoolIds = cfbLive
    ? await getIndexableCfbSchoolIds().catch((err) => {
        console.error('[sitemap] cfbSchools read failed; refusing to serve a sitemap missing the CFB set', err);
        throw err;
      })
    : [];
  const cfbTeamPages = cfbSchoolIds.map((id) => ({
    url: `${BASE_URL}/cfb/${id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // CFB rivalry matchup pages (/cfb/rivalries/[slug]). Gated on the SAME
  // isCfbHubLive() flag as the school block above, so the whole CFB surface
  // appears and disappears together.
  //
  // No fail-loud branch is needed here and none is possible: the slug set is a
  // curated static registry (src/lib/cfb/matchups.ts), not a Firestore read, so
  // there is no partial-success mode to guard against. If the registry is
  // empty the family is simply absent, which is a code change, not a silent
  // data hole.
  //
  // These URLs auto-propagate to IndexNow through getAllSitemapUrls
  // (src/lib/sitemap-urls.ts), and src/lib/indexnow.ts hard-throws on any host
  // that is not www.getpromonight.com, so BASE_URL has to stay the www apex.
  const cfbMatchupPages = cfbLive
    ? [
        {
          url: `${BASE_URL}/cfb/rivalries`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        },
        ...getAllMatchupSlugs().map((slug) => ({
          url: `${BASE_URL}/cfb/rivalries/${slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        })),
      ]
    : [];

  // League hubs, from the registry — every live hub, one loop. Gated on the
  // SAME LEAGUE_HUB_REGISTRY live flag as the nav, so the sitemap follows
  // go-live and a hub URL is never emitted for a route that does not exist.
  // This loop replaces the per-league special cases (an /mlb literal, a
  // WNBA/MLS tuple, a CFB hub-entry branch) whose failure mode was silent:
  // flipping a new hub live lit the nav and every team-page up-link while the
  // hub URL stayed out of the sitemap AND out of the IndexNow deploy hook,
  // which walks this same function. NFL — and NBA/NHL behind it — now reach
  // both with no sitemap edit. Per-hub cadence comes from the registry (CFB
  // weekly; default daily — promo-cadence hubs turn their this-week rail over
  // each day). Team pages for every pro league already flow through teamPages
  // above (every getAllTeams doc, any league); CFB team pages have their own
  // fail-loud branch below.
  const leagueHubEntries = LEAGUE_HUBS.map((hub) => ({
    url: `${BASE_URL}${hub.href}`,
    lastModified: now,
    changeFrequency: hub.sitemapChangeFrequency ?? ('daily' as const),
    priority: 0.9,
  }));

  // Venue logistics hubs (/venues/[slug]). Only buildings that clear the indexing
  // floor (lat/lng + two of bag/parking/transit + verified) are listed; the rest
  // render but stay noindex and out of the sitemap. lastmod is the doc's real
  // updatedAt, not sitemap-generation time. Flows to the IndexNow deploy hook
  // automatically (getAllSitemapUrls -> sitemap()).
  //
  // FAIL LOUDLY. This read used to be `.catch(() => [])`, which on any Firestore
  // error served a complete-looking sitemap silently missing all 150+ venue URLs
  // (and the IndexNow hook, walking this same function, skipped them too). The
  // set comes from a single collection get, so partial success is impossible:
  // the honest outcomes are the full venue set or a failed render (build fails /
  // the previously generated sitemap keeps serving), never a silent hole.
  const venueEntries = await getIndexableVenueHubSitemapEntries().catch((err) => {
    console.error('[sitemap] venueHubs read failed; refusing to serve a sitemap missing the venue set', err);
    throw err;
  });
  const venuePages = venueEntries.map((v) => ({
    url: `${BASE_URL}/venues/${v.slug}`,
    lastModified: v.lastModified,
    changeFrequency: 'weekly' as const,
    // 0.8 as of the inbound-links slice: venue pages now carry real internal
    // signal (league hubs + /venues index + footer path), same tier as teams.
    priority: 0.8,
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
      // /venues index: directory page over every indexable building, linked
      // sitewide from the footer. 0.8 (not hub-tier 0.9) until it earns signal.
      url: `${BASE_URL}/venues`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...leagueHubEntries,
    ...playoffHubEntries,
    ...teamPages,
    ...cfbTeamPages,
    ...cfbMatchupPages,
    ...venuePages,
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      // Daily "today" board. Highest-freshness promo hub: the daily cron
      // (/api/cron/indexnow-daily) revalidates + re-pings it as the Chicago day
      // rolls over, and its whole value is same-day accuracy.
      url: `${BASE_URL}/promos/today`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
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
