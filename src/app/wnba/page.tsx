import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import { getLeagueSlate, getLeagueHubStats, getLeagueTeamsGrouped, getLeagueSuperGroups, getLeagueTodayPromos } from '@/lib/data';
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
import { HubFaq, type HubFaqItem } from '@/components/hub/HubFaq';

// League hub accent (house palette, mirrors LEAGUE_HUB_REGISTRY WNBA entry).
const ACCENT = '#c9581f';

// Browse-by-promo-type tiles for the WNBA hub: theme nights, jersey giveaways,
// bobbleheads (all cross-league collection pages that already surface WNBA promos).
const BROWSE_TILES: HubBrowseTile[] = [
  { href: '/promos/theme-nights', label: 'Theme nights', collectionName: 'theme_nights', accentType: 'theme' },
  { href: '/promos/jersey-giveaways', label: 'Jersey giveaways', collectionName: 'jerseys', accentType: 'giveaway' },
  { href: '/promos/bobbleheads', label: 'Bobblehead giveaways', collectionName: 'bobbleheads', accentType: 'giveaway' },
];

// 6h ISR, matching the homepage and the MLB hub. On-demand /api/revalidate stays
// the real freshness path when the pipeline writes new WNBA promos.
export const revalidate = 21600;

// Season year is hardcoded, never new Date().getFullYear(): an auto-rolling year
// would flip the copy to 2027 at midnight on Jan 1, before the 2027 data exists.
const YEAR = 2026;
const HUB_URL = 'https://www.getpromonight.com/wnba';
const TITLE = `WNBA Promotions & Giveaways ${YEAR}`;
const DESCRIPTION = `Every WNBA team's ${YEAR} promo schedule in one place: theme nights, jersey giveaways, bobblehead nights, and more across all 15 teams, grouped by conference and refreshed through the season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/wnba'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What WNBA promotions are happening this week?',
    answer:
      'PromoNight tracks every giveaway, theme night, and bobblehead announced by all 15 WNBA teams. The this-week rail on this page lists the promotions scheduled at WNBA arenas over the next seven days, and it updates as teams add dates.',
  },
  {
    question: 'Which WNBA teams give away bobbleheads?',
    answer:
      "Bobblehead nights are a staple of the WNBA promotional calendar, usually built around a team's star. The lineup shifts through the season as teams announce new dates, and every team's current bobblehead giveaways are listed on its schedule page.",
  },
  {
    question: 'How do I get a giveaway item at a WNBA game?',
    answer:
      'Most WNBA giveaways go to the first fans through the gates while supplies last. Arrive when doors open, usually about 90 minutes before tip-off, and check the team schedule page for the specific giveaway quantity and any ticket requirements.',
  },
  {
    question: 'When does the WNBA promotional schedule come out?',
    answer:
      'Teams publish their WNBA promotional schedules before the season opens in May and keep adding dates through the summer. PromoNight refreshes each team schedule as new promotions are announced, so the calendars here stay current rather than being a one-time snapshot.',
  },
  {
    question: 'Are WNBA promotions the same at every arena?',
    answer:
      "No. Each WNBA team sets its own promotional calendar, so theme nights, giveaways, and specialty jerseys vary by arena and by date. Use the conference team grid on this page to open any team's full promotional schedule.",
  },
];

// Chicago-anchored YMD for the schema dateModified, matching the slate anchor.
function todayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default async function WnbaHubPage() {
  const [slate, stats, conferences, today] = await Promise.all([
    getLeagueSlate('WNBA'),
    getLeagueHubStats('WNBA'),
    getLeagueTeamsGrouped('WNBA'),
    getLeagueTodayPromos('WNBA'),
  ]);

  // ItemList source for the CollectionPage JSON-LD: the current WNBA slate.
  const jsonLdGroups: AggregatorGroup[] = [{ label: 'This week across WNBA', promos: slate }];

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <AggregatorJsonLd
        url={HUB_URL}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={todayYMD()}
        faqs={FAQS}
        groups={jsonLdGroups}
      />

      <HubHero
        eyebrow="WNBA League Hub"
        title={`WNBA PROMOTIONS ${YEAR}`}
        subtitle="Every theme night, jersey giveaway, and bobblehead across all 15 WNBA teams, grouped by conference."
        freshness="Schedules refreshed every 6 hours."
        accent={ACCENT}
      >
        <HubStatBar stats={stats} leagueLabel="WNBA" />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="wnba_hub" />
      </div>

      <main className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12">
        <HubTodayPromos
          slate={today}
          label="WNBA"
          accent={ACCENT}
          sectionId="wnba-today"
          surface="web_wnba_hub"
        />
        <HubThisWeek
          slate={slate}
          heading="This week across WNBA"
          sectionId="wnba-this-week"
          surface="web_wnba_hub_this_week"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="wnba_hub" />
        <HubBrowseByType
          slate={slate}
          tiles={BROWSE_TILES}
          sectionId="wnba-browse-type"
          surface="web_wnba_hub_promo_type"
        />
        <HubTeamGrid
          groups={conferences}
          superGroups={getLeagueSuperGroups('WNBA')}
          sectionId="wnba-browse-team"
          surface="web_wnba_hub_team_card"
          collection="wnba_hub"
          intro="All 15 WNBA teams by conference. Open any team for its full 2026 promotional schedule."
          selectorLabel="Filter teams by conference"
          allLabel="All teams"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="wnba_hub" />
        <HubFaq faqs={FAQS} sectionId="wnba-hub-faq" />
      </main>
    </div>
  );
}
