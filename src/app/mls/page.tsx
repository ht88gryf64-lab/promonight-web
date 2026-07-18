import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import { getLeagueSlate, getLeagueHubStats, getLeagueTeamsGrouped, getLeagueSuperGroups } from '@/lib/data';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { HubHero } from '@/components/hub/HubHero';
import { HubStatBar } from '@/components/hub/HubStatBar';
import { HubThisWeek } from '@/components/hub/HubThisWeek';
import { HubBrowseByType, type HubBrowseTile } from '@/components/hub/HubBrowseByType';
import { HubTeamGrid } from '@/components/hub/HubTeamGrid';
import { HubFaq, type HubFaqItem } from '@/components/hub/HubFaq';

// League hub accent (house palette, mirrors LEAGUE_HUB_REGISTRY MLS entry).
const ACCENT = '#3f7d5a';

// Browse-by-promo-type tiles for the MLS hub: soccer jersey and kit nights, then
// theme nights. Bobbleheads are dropped (soccer clubs give scarves and kits, not
// bobbleheads). Both link to cross-league collection pages that surface MLS today.
const BROWSE_TILES: HubBrowseTile[] = [
  { href: '/promos/soccer-jersey-nights', label: 'Jersey and kit nights', collectionName: 'soccer_jerseys', accentType: 'giveaway' },
  { href: '/promos/theme-nights', label: 'Theme nights', collectionName: 'theme_nights', accentType: 'theme' },
];

// 6h ISR, matching the homepage and the MLB hub. On-demand /api/revalidate stays
// the real freshness path when the pipeline writes new MLS promos.
export const revalidate = 21600;

// Season year is hardcoded, never new Date().getFullYear(): an auto-rolling year
// would flip the copy to 2027 at midnight on Jan 1, before the 2027 data exists.
const YEAR = 2026;
const HUB_URL = 'https://www.getpromonight.com/mls';
const TITLE = `MLS Promotions & Giveaways ${YEAR}`;
const DESCRIPTION = `Every MLS club's ${YEAR} promo schedule in one place: jersey and kit giveaways, scarf nights, theme nights, and more across all 30 clubs, grouped by conference and refreshed through the season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/mls'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What MLS promotions are happening this week?',
    answer:
      'PromoNight tracks every giveaway, scarf night, theme night, and specialty kit announced by all 30 MLS clubs. The this-week rail on this page lists the promotions scheduled at MLS stadiums over the next seven days, and it updates as clubs add dates.',
  },
  {
    question: 'Which MLS clubs give away jerseys and scarves?',
    answer:
      "Scarves, kits, and replica jerseys are the signature MLS giveaways, and most clubs run several across a season. The lineup changes as clubs announce new dates, and every club's current giveaways are listed on its schedule page.",
  },
  {
    question: 'How do I get a giveaway item at an MLS match?',
    answer:
      'Most MLS giveaways go to the first supporters through the gates while supplies last. Arrive when gates open, usually one to two hours before kickoff, and check the club schedule page for the specific giveaway quantity and any ticket requirements.',
  },
  {
    question: 'When does the MLS promotional schedule come out?',
    answer:
      'Clubs publish their MLS promotional schedules before the season opens and keep adding dates through the year. PromoNight refreshes each club schedule as new promotions are announced, so the calendars here stay current rather than being a one-time snapshot.',
  },
  {
    question: 'Are MLS promotions the same at every stadium?',
    answer:
      "No. Each MLS club sets its own promotional calendar, so scarf nights, kit giveaways, and theme nights vary by stadium and by date. Use the conference team grid on this page to open any club's full promotional schedule.",
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

export default async function MlsHubPage() {
  const [slate, stats, conferences] = await Promise.all([
    getLeagueSlate('MLS'),
    getLeagueHubStats('MLS'),
    getLeagueTeamsGrouped('MLS'),
  ]);

  // ItemList source for the CollectionPage JSON-LD: the current MLS slate.
  const jsonLdGroups: AggregatorGroup[] = [{ label: 'This week across MLS', promos: slate }];

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
        eyebrow="MLS League Hub"
        title={`MLS PROMOTIONS ${YEAR}`}
        subtitle="Every jersey giveaway, scarf night, and theme night across all 30 MLS clubs, grouped by conference."
        freshness="Schedules refreshed every 6 hours."
        accent={ACCENT}
      >
        <HubStatBar stats={stats} leagueLabel="MLS" />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="mls_hub" />
      </div>

      <main className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12">
        <HubThisWeek
          slate={slate}
          heading="This week across MLS"
          sectionId="mls-this-week"
          surface="web_mls_hub_this_week"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="mls_hub" />
        <HubBrowseByType
          slate={slate}
          tiles={BROWSE_TILES}
          sectionId="mls-browse-type"
          surface="web_mls_hub_promo_type"
        />
        <HubTeamGrid
          groups={conferences}
          superGroups={getLeagueSuperGroups('MLS')}
          sectionId="mls-browse-team"
          surface="web_mls_hub_team_card"
          collection="mls_hub"
          intro="All 30 MLS clubs by conference. Open any club for its full 2026 promotional schedule."
          selectorLabel="Filter teams by conference"
          allLabel="All clubs"
        />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="mls_hub" />
        <HubFaq faqs={FAQS} sectionId="mls-hub-faq" />
      </main>
    </div>
  );
}
