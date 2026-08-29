import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { numberWord } from '@/lib/coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';

export const revalidate = 21600;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// HARDCODED SEASON YEAR, never new Date().getFullYear(). This value reaches the
// page title, the meta description and the on-page lead, so an auto-rolling year
// would retitle this page to the next season at midnight on Jan 1 — with no
// deploy, no review, and no food-deal data behind the new number. The page would
// sit in the index advertising a season that does not exist yet.
//
// Bump this deliberately when next-season content is ready. Same rule as
// /best-promos, the team pages, the venue pages and the CFB family.
const YEAR = 2026;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCoverageCounts();
  return {
    title: `${YEAR} Ballpark Food Deals: Discount Concession Nights`,
    description: `${YEAR} food-deal promos across ${c.leagueList}. Dollar dogs, half-price concessions, and value menus by month with team, date, and opponent. From official team announcements.`,
    alternates: { canonical: 'https://www.getpromonight.com/promos/food-deals' },
    openGraph: pageOpenGraph('/promos/food-deals'),
  };
}

export default async function FoodDealsPage() {
  const all = await getPromosFromDate(todayYMD());
  const foods = all.filter((p) => p.type === 'food');

  const byMonth = new Map<string, typeof foods>();
  for (const p of foods) {
    const key = p.date.slice(0, 7); // YYYY-MM
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }

  const groups: AggregatorGroup[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => ({
      label: monthLabel(list[0].date).toUpperCase(),
      promos: list.sort((a, b) => a.date.localeCompare(b.date)),
    }));

  const c = await getCoverageCounts();
  const lead = `Food-deal promotions scheduled across ${c.leagueList} in ${YEAR}. Dollar-dog nights, half-price concessions, and value menus with the team, date, and opponent for each, grouped by month. ${foods.length} food deal${foods.length !== 1 ? 's' : ''} currently tracked across ${c.teamCount} teams.`;

  const faqs = [
    {
      question: `How many ballpark food deals are there in ${YEAR}?`,
      answer: `PromoNight is tracking ${foods.length} food-deal promotion${foods.length !== 1 ? 's' : ''} across the ${numberWord(c.leagueCount)} major pro leagues in ${YEAR}. These include dollar-dog nights, half-price concessions, and themed value menus.`,
    },
    {
      question: 'What counts as a food deal?',
      answer:
        'A food deal is any promotion centered on discounted or free concessions — dollar hot dogs, half-price beer, kids-eat-free nights, and value menus. Themed giveaways and bobbleheads are tracked on their own collection pages.',
    },
    {
      question: 'Can I get food-deal notifications?',
      answer:
        'Yes, with PromoNight Pro, which sends a notification the morning of a promo day for the teams you follow, food deals included. The app is a free download and you can browse the full calendar on any team page.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/food-deals"
        title={`Ballpark Food Deals in Pro Sports ${YEAR}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Food deals"
        title={`FOOD DEALS IN ${YEAR}`}
        lead={lead}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming food deals are currently tracked. Teams typically announce more through the season."
        accentKey="food"
        collection="food-deals"
      />
    </>
  );
}
