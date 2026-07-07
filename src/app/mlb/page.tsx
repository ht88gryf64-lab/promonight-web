import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import { getMlbSlate, getMlbHubStats, getMlbTeamsByDivision } from '@/lib/data';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { HubHero } from '@/components/hub/HubHero';
import { HubStatBar } from '@/components/hub/HubStatBar';
import { HubThisWeek } from '@/components/hub/HubThisWeek';
import { HubBrowseByType } from '@/components/hub/HubBrowseByType';
import { HubTeamGrid } from '@/components/hub/HubTeamGrid';
import { HubFaq, type HubFaqItem } from '@/components/hub/HubFaq';

// 6h ISR, matching the homepage and aggregator pages. On-demand /api/revalidate
// stays the real freshness path when the pipeline writes new MLB promos.
export const revalidate = 21600;

// Season year is hardcoded, never new Date().getFullYear(): an auto-rolling year
// would flip the copy to 2027 at midnight on Jan 1, before the 2027 data exists.
const YEAR = 2026;
const HUB_URL = 'https://www.getpromonight.com/mlb';
const TITLE = `MLB Promotions & Giveaways ${YEAR}`;
const DESCRIPTION = `Every MLB team's ${YEAR} promo schedule in one place: bobblehead nights, jersey giveaways, theme nights, and food deals across all 30 clubs, grouped by division and refreshed through the season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: pageOpenGraph('/mlb'),
};

const FAQS: HubFaqItem[] = [
  {
    question: 'What MLB promotions are happening this week?',
    answer:
      'PromoNight tracks every giveaway, bobblehead night, theme night, and food deal announced by all 30 MLB teams. The this-week rail on this page lists the promotions scheduled at MLB ballparks over the next seven days, and it updates as teams add dates.',
  },
  {
    question: 'Which MLB teams give away the most bobbleheads?',
    answer:
      'Bobblehead nights are the most common MLB giveaway. The Dodgers, Giants, and Guardians consistently run some of the largest bobblehead programs, though the counts shift through the season as teams announce more promotions after Opening Day.',
  },
  {
    question: 'How do I get a giveaway item at an MLB game?',
    answer:
      'Most MLB giveaways go to the first fans through the gates, often the first 10,000 to 25,000, while supplies last. Arrive when gates open, usually 90 minutes to two hours before first pitch. Each team schedule page lists the specific ticket type and quantity details.',
  },
  {
    question: 'When does the MLB promotional schedule come out?',
    answer:
      'Teams publish their MLB promotional schedules before the season and keep adding dates through the summer. PromoNight refreshes each team schedule as new promotions are announced, so the calendars here stay current rather than being a one-time snapshot.',
  },
  {
    question: 'Are MLB promotions the same at every ballpark?',
    answer:
      'No. Each MLB team sets its own promotional calendar, so giveaways, theme nights, and food deals vary by ballpark and by date. Use the division team grid on this page to open any club full promotional schedule.',
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

export default async function MlbHubPage() {
  const [slate, stats, divisions] = await Promise.all([
    getMlbSlate(),
    getMlbHubStats(),
    getMlbTeamsByDivision(),
  ]);

  // ItemList source for the CollectionPage JSON-LD: the current MLB slate.
  const jsonLdGroups: AggregatorGroup[] = [{ label: 'This week across MLB', promos: slate }];

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
        eyebrow="MLB League Hub"
        title={`MLB PROMOTIONS ${YEAR}`}
        subtitle="Every giveaway, bobblehead night, theme night, and food deal across all 30 MLB clubs, grouped by division."
        freshness="Schedules refreshed every 6 hours."
      >
        <HubStatBar stats={stats} />
      </HubHero>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="mlb_hub" />
      </div>

      <main className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12">
        <HubThisWeek slate={slate} />
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="mlb_hub" />
        <HubBrowseByType slate={slate} />
        <HubTeamGrid groups={divisions} />
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="mlb_hub" />
        <HubFaq faqs={FAQS} />
      </main>
    </div>
  );
}
