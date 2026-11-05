import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { numberWord } from '@/lib/coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { siteTodayYmd } from '@/lib/site-today';
import { scheduledPeriodPhrase, seasonSpan } from '@/lib/season-label';

export const revalidate = 21600;

// The site's calendar day, America/New_York (src/lib/site-today.ts), the same
// day as the team pages and hubs. It was the server's local day (UTC on
// Vercel) until WEB6 G3 (2026-10-06).
function todayYMD(): string {
  return siteTodayYmd();
}

function monthLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// NO YEAR ON THIS PAGE (season rollover, ruling 2026-11-05, point 1): it lists
// every league, whose seasons do not share a year, so the heading is
// "Upcoming {category}" and any period the copy names comes from the dates of
// the rows on the page (scheduledPeriodPhrase).

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCoverageCounts();
  return {
    title: 'Upcoming Ballpark Food Deals: Discount Concession Nights',
    description: `Upcoming food-deal promos across ${c.leagueList}. Dollar dogs, half-price concessions, and value menus by month with team, date, and opponent. From official team announcements.`,
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
  const period = scheduledPeriodPhrase(seasonSpan(foods.map((p) => p.date))) || 'on the calendar';
  const lead = `Food-deal promotions scheduled across ${c.leagueList} ${period}. Dollar-dog nights, half-price concessions, and value menus with the team, date, and opponent for each, grouped by month. ${foods.length} food deal${foods.length !== 1 ? 's' : ''} currently tracked across ${c.teamCount} teams.`;

  const faqs = [
    {
      question: `How many ballpark food deals are there ${period}?`,
      answer: `PromoNight is tracking ${foods.length} food-deal promotion${foods.length !== 1 ? 's' : ''} across the ${numberWord(c.leagueCount)} major pro leagues ${period}. These include dollar-dog nights, half-price concessions, and themed value menus.`,
    },
    {
      question: 'What counts as a food deal?',
      answer:
        'A food deal is any promotion centered on discounted or free concessions: dollar hot dogs, half-price beer, kids-eat-free nights, and value menus. Themed giveaways and bobbleheads are tracked on their own collection pages.',
    },
    {
      question: 'Can I get food-deal notifications?',
      answer:
        'Yes. The free PromoNight app sends a reminder on the morning of a promo day for the teams you follow, food deals included, and you can browse the full calendar on any team page.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/food-deals"
        title="Upcoming Ballpark Food Deals in Pro Sports"
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Food deals"
        title="UPCOMING FOOD DEALS"
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
