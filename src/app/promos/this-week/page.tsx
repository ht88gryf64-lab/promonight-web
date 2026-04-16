import type { Metadata } from 'next';
import { getPromosInDateRange } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';

export const revalidate = 3600;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plusDays(baseYMD: string, days: number): string {
  const [y, m, d] = baseYMD.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export const metadata: Metadata = {
  title: 'Promos This Week — MLB, NBA, NHL, NFL, MLS, WNBA Promotional Events',
  description:
    'Every hot promotional event across pro sports this week: giveaways, theme nights, bobbleheads, and food deals at all 167 teams.',
  alternates: { canonical: 'https://www.getpromonight.com/promos/this-week' },
};

export default async function ThisWeekPage() {
  const start = todayYMD();
  const end = plusDays(start, 7);
  const promos = await getPromosInDateRange(start, end);
  const hot = promos.filter((p) => p.highlight);

  const byDate = new Map<string, typeof hot>();
  for (const p of hot) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }

  const groups: AggregatorGroup[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      label: formatLongDate(date),
      promos: list,
    }));

  const lastUpdated = todayYMD();

  const lead = `Every highlighted promotional event across MLB, NBA, NHL, NFL, MLS, and WNBA in the next seven days. Giveaways, theme nights, bobbleheads, and food deals at all 167 teams, grouped by day. Updated daily based on the live PromoNight database.`;

  const faqs = [
    {
      question: 'What counts as a "hot" promo?',
      answer:
        'Hot promos are the most anticipated events of the week: major bobblehead giveaways, jersey giveaways, themed celebrations, and rare collectibles. Every team flags its marquee dates; PromoNight surfaces them here.',
    },
    {
      question: 'How often is this page updated?',
      answer:
        'The list regenerates daily. Promos roll off automatically after their game date so the page always reflects the next seven days.',
    },
    {
      question: 'How do I see promos for just my team?',
      answer:
        'Visit the team page directly from any promo in the list, or browse all 167 teams from the PromoNight app. The app offers push notifications the morning of a promo day.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/this-week"
        title="Promos This Week Across Pro Sports"
        description={lead}
        lastUpdated={lastUpdated}
        faqs={faqs}
      />
      <AggregatorPage
        eyebrow="This week"
        title="HOT PROMOS THIS WEEK"
        lead={lead}
        lastUpdated={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        groups={groups}
        faqs={faqs}
        emptyMessage="No hot promos scheduled in the next seven days. Check back tomorrow as new events are added."
      />
    </>
  );
}
