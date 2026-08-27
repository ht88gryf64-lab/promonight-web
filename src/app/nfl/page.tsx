import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import {
  getNflWeekSlate,
  getNflClubCounts,
  getLeagueTeamsGrouped,
  getLeagueSuperGroups,
  getLeagueTodayPromos,
  getAllTeams,
} from '@/lib/data';
import { clubCardSubtitle, splitPrimetime } from '@/lib/nfl-week';
import type { LeagueHubStats } from '@/lib/data';
import type { Team } from '@/lib/types';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { HubHero } from '@/components/hub/HubHero';
import { HubStatBar } from '@/components/hub/HubStatBar';
import { HubTodayPromos } from '@/components/hub/HubTodayPromos';
import { NflWeekContainer, type RowVenueLink, type PrimetimeLogistics } from '@/components/hub/NflWeekContainer';
import { HubBrowseByType, type HubBrowseTile } from '@/components/hub/HubBrowseByType';
import { HubTeamGrid } from '@/components/hub/HubTeamGrid';
import { HubVenueLinks } from '@/components/hub/HubVenueLinks';
import { HubFaq, type HubFaqItem } from '@/components/hub/HubFaq';
import { getVenueLinksForTeams, getTeamVenueHubMap, getVenueHub } from '@/lib/venue-hub';
import { transitSuppressed } from '@/lib/venue-transit-suppression';

// League hub accent (house palette, mirrors LEAGUE_HUB_REGISTRY NFL entry).
const ACCENT = '#5f6b57';

// Browse-by-promo-type tiles — the SECONDARY control on this hub (rendered
// below the team grid, unlike the MLB/WNBA/MLS placement above it). The NFL
// corpus is theme-dominant (90 of 106 regular-season promos), so theme-nights
// is the anchor tile and the set stays at two: tiles the corpus cannot fill do
// not get invented. Promote by moving this block up if a corpus re-poll
// roughly doubles the giveaway count.
const BROWSE_TILES: HubBrowseTile[] = [
  { href: '/promos/theme-nights', label: 'Theme nights', collectionName: 'theme_nights', accentType: 'theme' },
  { href: '/promos/this-week', label: 'Everything this week', collectionName: 'hot_this_week', accentType: 'giveaway' },
];

// 6h ISR, matching the other league hubs. On-demand /api/revalidate stays the
// real freshness path when the pipeline writes new NFL promos.
export const revalidate = 21600;

// Season year is hardcoded, never new Date().getFullYear(): an auto-rolling
// year would flip the copy to 2027 at midnight on Jan 1, mid-playoffs, before
// any 2027 data exists.
const YEAR = 2026;
const HUB_URL = 'https://www.getpromonight.com/nfl';
const TITLE = `NFL Promotions & Giveaways ${YEAR}`;
const DESCRIPTION = `Every NFL club's ${YEAR} promo schedule, week by week: theme nights, giveaways, and kids days across all 32 teams, plus stadium guides for each week's home slate.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/nfl'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What NFL promotions are happening this week?',
    answer:
      'PromoNight organizes NFL promotions by week, the way the league plays: the container on this page shows the current week from Tuesday through Monday night, so Monday Night Football stays with its own week. Each game row lists the promos announced for that date and links the stadium guide for gameday logistics.',
  },
  {
    question: 'When do NFL teams announce their promotional schedules?',
    answer:
      `Most clubs publish theme nights and giveaways in waves from late summer through the season, and some announce game by game. Every team page carries the club's full 18-week schedule even before its promotions are published.`,
  },
  {
    question: 'Are primetime NFL games different for fans attending in person?',
    answer:
      'The football is the same, but the logistics are not: night kickoffs move gate times, tighten parking windows, and raise last-train questions that a 1pm game never asks. The Primetime section on this page groups each week’s night games with their stadium guides for exactly that reason.',
  },
  {
    question: 'Do NFL stadiums allow bags?',
    answer:
      'Every NFL stadium enforces the league clear-bag policy, with per-stadium details on approved sizes and exceptions. The stadium guides linked from this page list the bag policy, parking, and transit options we have verified for each building.',
  },
];


export default async function NflHubPage() {
  const [slate, counts, divisions, today, teams, venueMap] = await Promise.all([
    getNflWeekSlate(),
    getNflClubCounts(),
    getLeagueTeamsGrouped('NFL'),
    getLeagueTodayPromos('NFL'),
    getAllTeams(),
    getTeamVenueHubMap(),
  ]);
  // Indexable stadium guides for the league's clubs (deduped by building).
  const venueLinks = await getVenueLinksForTeams(
    divisions.flatMap((g) => g.teams.map((t) => t.id)),
  );

  const teamsById: Record<string, Team> = {};
  for (const t of teams) {
    if (t.league === 'NFL') teamsById[t.id] = t;
  }
  // Serializable venue-link subset for the game rows, keyed by team slug.
  const venueByTeam: Record<string, RowVenueLink> = {};
  for (const [teamId, link] of venueMap) {
    if (teamsById[teamId]) {
      venueByTeam[teamId] = { slug: link.slug, displayName: link.displayName, indexable: link.indexable };
    }
  }
  // Team-card subtitles: regular-season promo count where promos exist, honest
  // home-game count where they do not.
  const subtitleByTeamId: Record<string, string> = {};
  for (const [teamId, c] of Object.entries(counts)) {
    subtitleByTeamId[teamId] = clubCardSubtitle(c);
  }

  const weekPromos = Object.values(slate.promosByGameId).flat();
  // WINDOW UNIFICATION: the stat bar reads the SAME bucket the container
  // displays, never the rolling 7-day slate — two components must not report
  // different weeks. Score-derived stats stay null (no NFL scoring by ruling);
  // the count is omitted (0 -> stat hidden) when the display is next-up,
  // because "this week" must not count next week's promos.
  const stats: LeagueHubStats = {
    totalPromos: null,
    teamsWithPromosThisWeek:
      slate.context.mode === 'current' ? new Set(weekPromos.map((p) => p.team.id)).size : 0,
    avgPerTeam: null,
  };
  // Verified primetime logistics: building facts + the home club's VERIFIED
  // tenant overlay only. Absent parts are omitted; a gate time is never
  // invented.
  const logisticsByGameId: Record<string, PrimetimeLogistics> = {};
  if (slate.context.bucket) {
    const { primetime } = splitPrimetime(slate.context.bucket);
    for (const g of primetime) {
      const link = venueByTeam[g.homeTeamSlug];
      if (!link) continue;
      const hub = await getVenueHub(link.slug);
      if (!hub) continue;
      const overlay = hub.tenantOverlays.find(
        (t) => t.teamId === g.homeTeamSlug && t.verified && t.gatesOpen?.ruleText,
      );
      const lotNote = hub.parkingLots.find((l) => /open/i.test(l.notes ?? ''))?.notes ?? undefined;
      const entry: PrimetimeLogistics = {};
      if (overlay?.gatesOpen?.ruleText) entry.gateText = overlay.gatesOpen.ruleText;
      if (lotNote) entry.lotText = lotNote;
      if (!transitSuppressed(hub.slug) && hub.publicTransit?.lines?.[0]) entry.transitText = hub.publicTransit.lines[0];
      if (entry.gateText || entry.lotText || entry.transitText) logisticsByGameId[g.id] = entry;
    }
  }
  const jsonLdGroups: AggregatorGroup[] = [
    { label: slate.context.bucket ? `${slate.context.bucket.label} across the NFL` : 'NFL promotions', promos: weekPromos },
  ];
  const offseason = slate.context.mode === 'offseason';

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <AggregatorJsonLd
        url={HUB_URL}
        title={TITLE}
        description={DESCRIPTION}
        faqs={FAQS}
        groups={jsonLdGroups}
      />

      <HubHero
        eyebrow="NFL League Hub"
        title={`NFL PROMOTIONS ${YEAR}`}
        subtitle="Theme nights, giveaways, and kids days across all 32 clubs, organized by NFL week with the stadium guide one tap from every game."
        freshness="From official club announcements."
        accent={ACCENT}
      >
        <HubStatBar stats={stats} leagueLabel="NFL" />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="nfl_hub" />
      </div>

      <main className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12">
        <HubTodayPromos
          slate={today}
          label="NFL"
          accent={ACCENT}
          sectionId="nfl-today"
          surface="web_nfl_hub"
        />
        {offseason ? (
          // Deliberate offseason state: honest past tense, no claim about a
          // season that has not been scheduled. The moment a new season's spine
          // is ingested, buckets exist again and NflWeekContainer's next-up
          // mode takes this block's place automatically.
          <section aria-labelledby="nfl-offseason">
            <h2 id="nfl-offseason" className="rd-display text-2xl text-rd-ink md:text-3xl">
              The NFL season has wrapped
            </h2>
            <p className="mt-2 max-w-2xl font-rd text-[15px] text-rd-ink-soft">
              Every club&rsquo;s team page keeps its full promotional history, and the stadium
              guides below cover parking, bag policy, and gameday logistics for each building.
            </p>
          </section>
        ) : (
          <NflWeekContainer
            slate={slate}
            teamsById={teamsById}
            venueByTeam={venueByTeam}
            logisticsByGameId={logisticsByGameId}
            sectionId="nfl-this-week"
            surface="web_nfl_hub_this_week"
            primetimeSurface="web_nfl_hub_primetime"
          />
        )}
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="nfl_hub" />
        <HubTeamGrid
          groups={divisions}
          superGroups={getLeagueSuperGroups('NFL')}
          sectionId="nfl-browse-team"
          surface="web_nfl_hub_team_card"
          collection="nfl_hub"
          intro="All 32 NFL clubs by division. Open any team for its full 2026 schedule and every promotion announced so far."
          selectorLabel="Filter teams by division"
          allLabel="All divisions"
          subtitleByTeamId={subtitleByTeamId}
        />
        <HubBrowseByType
          slate={weekPromos}
          tiles={BROWSE_TILES}
          sectionId="nfl-browse-type"
          surface="web_nfl_hub_promo_type"
        />
        <HubVenueLinks
          venues={venueLinks}
          heading="NFL stadium guides"
          intro="Bag policies, parking, and gate times for the stadiums we have verified. The logistics half of the gameday trip."
          sectionId="nfl-venue-guides"
          surface="web_nfl_hub_venues"
          placement="league_hub_venue_links"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="nfl_hub" />
        <HubFaq faqs={FAQS} sectionId="nfl-hub-faq" />
      </main>
    </div>
  );
}
