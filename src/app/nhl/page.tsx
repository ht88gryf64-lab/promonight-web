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

// HELD ROUTE. This page exists on the feature/nhl-hub-held branch and is not
// linked from anywhere: LEAGUE_HUB_REGISTRY keeps NHL live:false, so the nav,
// the footer, the team-page up-links and the sitemap all omit it. That is the
// same pre-flip state /nfl shipped in (79d761b: "Route exists but nothing links
// it"). The enable commit flips the one registry line together with the NHL
// scan workflow, per promo-pipeline docs/nhl-pending-decisions.md entry 6c.

// League hub accent (house palette, mirrors LEAGUE_HUB_REGISTRY NHL entry).
const ACCENT = '#4a4f57';

// Browse-by-promo-type tiles. Only tiles the corpus can fill: on 2026-09-01 the
// 575 upcoming NHL promos were 435 theme, 98 giveaway (23 bobbleheads by title),
// 36 kids, 6 food, and 3 jersey giveaways. Theme nights anchor; bobbleheads
// clear the bar; jerseys and food deals do not and are not invented.
const BROWSE_TILES: HubBrowseTile[] = [
  { href: '/promos/theme-nights', label: 'Theme nights', collectionName: 'theme_nights', accentType: 'theme' },
  { href: '/promos/bobbleheads', label: 'Bobblehead giveaways', collectionName: 'bobbleheads', accentType: 'giveaway' },
  { href: '/promos/this-week', label: 'Everything this week', collectionName: 'hot_this_week', accentType: 'giveaway' },
];

// 6h ISR, matching the other league hubs. On-demand /api/revalidate stays the
// real freshness path when the pipeline writes new NHL promos.
export const revalidate = 21600;

// The NHL season straddles the calendar year, so the label is the two-year
// form. Hardcoded, never derived from the clock: an auto-rolling label would
// flip mid-season before any 2027-28 data exists.
const SEASON = '2026-27';
const HUB_URL = 'https://www.getpromonight.com/nhl';
const TITLE = `NHL Promotions & Giveaways ${SEASON}`;
const DESCRIPTION = `Every NHL club's ${SEASON} promo schedule in one place: theme nights, giveaways, bobblehead nights, and kids days across all 32 teams, grouped by division and refreshed through the season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/nhl'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What NHL promotions are happening this week?',
    answer:
      'PromoNight tracks the theme nights, giveaways and kids days announced by the 32 NHL clubs. The this-week rail on this page lists the promotions scheduled at NHL arenas over the next seven days, and it updates as clubs add dates.',
  },
  {
    question: 'When do NHL teams announce their promotional schedules?',
    answer:
      'Most clubs publish their promotional schedule between July and the start of the regular season, usually alongside single-game ticket sales, and keep adding dates through the winter. A club whose card below shows no upcoming promos has not had its schedule listed here yet.',
  },
  {
    question: 'How do I get a giveaway item at an NHL game?',
    answer:
      'Most NHL giveaways go to the first fans through the gates while supplies last, and some are limited to specific ticket holders or seating areas. Arrive when doors open and check the team schedule page for the giveaway quantity and any ticket requirements.',
  },
  {
    question: 'Are NHL promotions the same at every arena?',
    answer:
      "No. Each NHL club sets its own promotional calendar, so theme nights, giveaways and specialty items vary by arena and by date. Use the division team grid on this page to open any club's full promotional schedule.",
  },
];


export default async function NhlHubPage() {
  const [slate, stats, divisions, today, upcomingCounts] = await Promise.all([
    getLeagueSlate('NHL'),
    getLeagueHubStats('NHL'),
    getLeagueTeamsGrouped('NHL'),
    getLeagueTodayPromos('NHL'),
    getLeagueUpcomingPromoCounts('NHL'),
  ]);
  // Indexable arena guides for this league's clubs (deduped by building).
  // One venueHubs collection get per hub regeneration (see getVenueLinksForTeams).
  const venueLinks = await getVenueLinksForTeams(
    divisions.flatMap((g) => g.teams.map((t) => t.id)),
  );

  // Team-card subtitles: every club gets one, so a zero reads as copy rather
  // than as a missing card or a bare number. See nhlClubCardSubtitle.
  const subtitleByTeamId: Record<string, string> = {};
  for (const [teamId, n] of Object.entries(upcomingCounts)) {
    subtitleByTeamId[teamId] = nhlClubCardSubtitle(n);
  }

  // ItemList source for the CollectionPage JSON-LD: the current NHL slate.
  const jsonLdGroups: AggregatorGroup[] = [{ label: 'This week across the NHL', promos: slate }];

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
        eyebrow="NHL League Hub"
        title={`NHL PROMOTIONS ${SEASON}`}
        subtitle="Theme nights, giveaways, bobbleheads and kids days across the 32 NHL clubs, grouped by division."
        freshness="Rechecked weekly and updated as clubs announce promotions."
        accent={ACCENT}
      >
        <HubStatBar stats={stats} leagueLabel="NHL" />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="nhl_hub" />
      </div>

      <main className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12">
        <HubTodayPromos
          slate={today}
          label="NHL"
          accent={ACCENT}
          sectionId="nhl-today"
          surface="web_nhl_hub"
        />
        <HubThisWeek
          slate={slate}
          heading="This week across the NHL"
          sectionId="nhl-this-week"
          surface="web_nhl_hub_this_week"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="nhl_hub" />
        <HubTeamGrid
          groups={divisions}
          superGroups={getLeagueSuperGroups('NHL')}
          sectionId="nhl-browse-team"
          surface="web_nhl_hub_team_card"
          collection="nhl_hub"
          intro={`All 32 NHL clubs by division. Open any club for its ${SEASON} promotional schedule and the promotions listed so far.`}
          selectorLabel="Filter teams by division"
          allLabel="All divisions"
          subtitleByTeamId={subtitleByTeamId}
        />
        <HubBrowseByType
          slate={slate}
          tiles={BROWSE_TILES}
          sectionId="nhl-browse-type"
          surface="web_nhl_hub_promo_type"
        />
        <HubVenueLinks
          venues={venueLinks}
          heading="NHL arena guides"
          intro="Bag policies, parking, and gate times for the arenas we have verified. The logistics half of the promo trip."
          sectionId="nhl-venue-guides"
          surface="web_nhl_hub_venues"
          placement="league_hub_venue_links"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="nhl_hub" />
        <HubFaq faqs={FAQS} sectionId="nhl-hub-faq" />
      </main>
    </div>
  );
}
