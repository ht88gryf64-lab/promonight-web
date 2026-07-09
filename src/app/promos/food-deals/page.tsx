import type { Metadata } from 'next';
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

const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `${YEAR} Ballpark Food Deals: Discount Concession Nights`,
  description: `Every ${YEAR} food-deal promo across MLB, NBA, NHL, NFL, MLS, and WNBA. Dollar dogs, half-price concessions, and value menus by month with team, date, and opponent. Updated weekly.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/food-deals' },
  openGraph: pageOpenGraph('/promos/food-deals'),
};

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

  const lead = `Every food-deal promotion scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Dollar-dog nights, half-price concessions, and value menus with the team, date, and opponent for each, grouped by month. ${foods.length} food deal${foods.length !== 1 ? 's' : ''} currently tracked across 169 teams.`;

  const faqs = [
    {
      question: `How many ballpark food deals are there in ${YEAR}?`,
      answer: `PromoNight is tracking ${foods.length} food-deal promotion${foods.length !== 1 ? 's' : ''} across the six major pro leagues in ${YEAR}. These include dollar-dog nights, half-price concessions, and themed value menus.`,
    },
    {
      question: 'What counts as a food deal?',
      answer:
        'A food deal is any promotion centered on discounted or free concessions — dollar hot dogs, half-price beer, kids-eat-free nights, and value menus. Themed giveaways and bobbleheads are tracked on their own collection pages.',
    },
    {
      question: 'Can I get food-deal notifications?',
      answer:
        'Yes. The free PromoNight app sends a push the morning of every promo day for the teams you follow, food deals included. Browse the full calendar on any team page.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/food-deals"
        title={`Every Ballpark Food Deal in Pro Sports ${YEAR}`}
        description={lead}
        lastUpdated={todayYMD()}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Food deals"
        title={`EVERY FOOD DEAL IN ${YEAR}`}
        lead={lead}
        lastUpdated={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming food deals are currently tracked. Teams typically announce more through the season."
        accentKey="food"
        collection="food-deals"
      />
    </>
  );
}
