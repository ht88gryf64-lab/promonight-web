import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import {
  getLeagueSlate,
  getLeagueHubStats,
  getLeagueTeamsGrouped,
  getLeagueSuperGroups,
  getLeagueTodayPromos,
  getLeagueUpcomingPromoCounts,
} from '@/lib/data';
import { nhlClubCardSubtitle } from '@/lib/nhl-hub';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { HubHero } from '@/components/hub/HubHero';
import { HubStatBar } from '@/components/hub/HubStatBar';
import { HubTodayPromos } from '@/components/hub/HubTodayPromos';
import { HubThisWeek } from '@/components/hub/HubThisWeek';
import { HubBrowseByType, type HubBrowseTile } from '@/components/hub/HubBrowseByType';
import { HubTeamGrid } from '@/components/hub/HubTeamGrid';
import { HubVenueLinks } from '@/components/hub/HubVenueLinks';
import { HubFaq, type HubFaqItem } from '@/components/hub/HubFaq';
import { getVenueLinksForTeams } from '@/lib/venue-hub';
import { splitSeasonLabel, SPLIT_SEASON_START_YEAR } from '@/lib/season-label';

// League hub accent (house palette, mirrors LEAGUE_HUB_REGISTRY NBA entry).
const ACCENT = '#b5642e';

// Browse-by-promo-type tiles. Only tiles the corpus can fill (the NHL rule).
// The NBA corpus was first written on 2026-09-29 (152 rows, ~15 clubs) and its
// type mix has not been counted, so the hub ships the two tiles that hold for
// any slate. Add bobbleheads or jerseys once a count clears the bar; do not
// invent them.
const BROWSE_TILES: HubBrowseTile[] = [
  { href: '/promos/theme-nights', label: 'Theme nights', collectionName: 'theme_nights', accentType: 'theme' },
  { href: '/promos/this-week', label: 'Everything this week', collectionName: 'hot_this_week', accentType: 'giveaway' },
];

// 6h ISR, matching the other league hubs. On-demand /api/revalidate stays the
// real freshness path when the pipeline writes new NBA promos.
export const revalidate = 21600;

// The NBA season straddles the calendar year, so the label is the two-year
// form, from the shared NHL/NBA season constant so the hub cannot drift from
// the team pages at the July 1 bump (known-issues 69). Never from the clock.
const SEASON = splitSeasonLabel(SPLIT_SEASON_START_YEAR);
const HUB_URL = 'https://www.getpromonight.com/nba';
const TITLE = `NBA Promotions & Giveaways ${SEASON}`;
const DESCRIPTION = `Every NBA team's ${SEASON} promo schedule in one place: theme nights, giveaways, and fan nights across all 30 teams, grouped by division and refreshed through the season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/nba'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What NBA promotions are happening this week?',
    answer:
      'PromoNight tracks the theme nights, giveaways and fan nights announced by the 30 NBA teams. The this-week rail on this page lists the promotions scheduled at NBA arenas over the next seven days, and it updates as teams add dates.',
  },
  {
    question: 'When do NBA teams announce their promotional schedules?',
    answer:
      'Most teams publish their promotional schedule in September or October, shortly before the regular season tips off, and keep adding dates through the winter. A team whose card below shows no upcoming promos has not had its schedule listed here yet.',
  },
  {
    question: 'How do I get a giveaway item at an NBA game?',
    answer:
      'Most NBA giveaways go to the first fans through the doors while supplies last, and some are limited to specific ticket holders or seating areas. Arrive when doors open and check the team schedule page for the giveaway quantity and any ticket requirements.',
  },
  {
    question: 'Are NBA promotions the same at every arena?',
    answer:
      "No. Each NBA team sets its own promotional calendar, so theme nights, giveaways and specialty items vary by arena and by date. Use the division team grid on this page to open any team's full promotional schedule.",
  },
];


export default async function NbaHubPage() {
  const [slate, stats, divisions, today, upcomingCounts] = await Promise.all([
    getLeagueSlate('NBA'),
    getLeagueHubStats('NBA'),
    getLeagueTeamsGrouped('NBA'),
    getLeagueTodayPromos('NBA'),
    getLeagueUpcomingPromoCounts('NBA'),
  ]);
  // Indexable arena guides for this league's clubs (deduped by building).
  // One venueHubs collection get per hub regeneration (see getVenueLinksForTeams).
  const venueLinks = await getVenueLinksForTeams(
    divisions.flatMap((g) => g.teams.map((t) => t.id)),
  );

  // Team-card subtitles: every team gets one, so a zero reads as copy rather
  // than as a missing card or a bare number. The NHL helper is league-neutral
  // copy and is reused as is; see nhlClubCardSubtitle for the zero rule.
  const subtitleByTeamId: Record<string, string> = {};
  for (const [teamId, n] of Object.entries(upcomingCounts)) {
    subtitleByTeamId[teamId] = nhlClubCardSubtitle(n);
  }

  // ItemList source for the CollectionPage JSON-LD: the current NBA slate.
  const jsonLdGroups: AggregatorGroup[] = [{ label: 'This week across the NBA', promos: slate }];

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`} data-ad-region="content">
      <AggregatorJsonLd
        url={HUB_URL}
        title={TITLE}
        description={DESCRIPTION}
        faqs={FAQS}
        groups={jsonLdGroups}
      />

      <HubHero
        eyebrow="NBA League Hub"
        title={`NBA PROMOTIONS ${SEASON}`}
        subtitle="Theme nights, giveaways and fan nights across the 30 NBA teams, grouped by division."
        freshness="Rechecked weekly in season and updated as teams announce promotions."
        accent={ACCENT}
      >
        <HubStatBar stats={stats} leagueLabel="NBA" />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="nba_hub" />
      </div>

      <div className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12 page-content">
        <HubTodayPromos
          slate={today}
          label="NBA"
          accent={ACCENT}
          sectionId="nba-today"
          surface="web_nba_hub"
        />
        <HubThisWeek
          slate={slate}
          heading="This week across the NBA"
          sectionId="nba-this-week"
          surface="web_nba_hub_this_week"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="nba_hub" />
        <HubTeamGrid
          groups={divisions}
          superGroups={getLeagueSuperGroups('NBA')}
          sectionId="nba-browse-team"
          surface="web_nba_hub_team_card"
          collection="nba_hub"
          intro={`All 30 NBA teams by division. Open any team for its ${SEASON} promotional schedule and the promotions listed so far.`}
          selectorLabel="Filter teams by division"
          allLabel="All divisions"
          subtitleByTeamId={subtitleByTeamId}
        />
        <HubBrowseByType
          slate={slate}
          tiles={BROWSE_TILES}
          sectionId="nba-browse-type"
          surface="web_nba_hub_promo_type"
        />
        <HubVenueLinks
          adItem="hub-section"
          venues={venueLinks}
          heading="NBA arena guides"
          intro="Bag policies, parking, and gate times for the arenas we have verified. The logistics half of the promo trip."
          sectionId="nba-venue-guides"
          surface="web_nba_hub_venues"
          placement="league_hub_venue_links"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="nba_hub" />
        <HubFaq faqs={FAQS} sectionId="nba-hub-faq" adItem="hub-section" />
      </div>
    </div>
  );
}
