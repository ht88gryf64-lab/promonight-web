import type { Metadata } from 'next';
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
  title: `Every Jersey, Hat & Apparel Giveaway in Pro Sports ${YEAR}`,
  description: `Every jersey, cap, hat, jacket, shirt, and hoodie giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Team, date, and opponent for each apparel night.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/jersey-giveaways' },
};

export default async function JerseyGiveawaysPage() {
  const all = await getPromosFromDate(todayYMD());
  const re = /\b(jersey|jerseys|cap|caps|hat|hats|jacket|jackets|shirt|shirts|hoodie|hoodies)\b/i;
  const jerseys = all.filter((p) => re.test(p.title) || re.test(p.description));

  const byMonth = new Map<string, typeof jerseys>();
  for (const p of jerseys) {
    const key = p.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }

  const groups: AggregatorGroup[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => ({
      label: monthLabel(list[0].date).toUpperCase(),
      promos: list,
    }));

  const lead = `Every jersey, cap, hat, jacket, shirt, and hoodie giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Apparel giveaway nights are typically capped at the first 10,000 to 25,000 fans through the gates, which is why arrival time matters.`;

  const faqs = [
    {
      question: 'What counts as a jersey giveaway?',
      answer:
        'This page pulls every promo whose title or description includes jersey, cap, hat, jacket, shirt, or hoodie. That covers replica jerseys, rally caps, hoodie nights, and novelty apparel like Hawaiian shirts.',
    },
    {
      question: 'Are jersey giveaways limited to certain sections?',
      answer:
        'Sometimes. Many teams give out jerseys to all fans through the main gates while reserving premium items (autographed, youth-sized, alternate colorway) for specific tiers. Check the team promo page for that night.',
    },
    {
      question: `How do I track jersey nights for just my team?`,
      answer:
        'Visit your team page from any promo in this list, or download the PromoNight app to pin a team and get a morning-of push notification for every apparel night.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/jersey-giveaways"
        title={`Every Jersey & Apparel Giveaway in Pro Sports ${YEAR}`}
        description={lead}
        lastUpdated={todayYMD()}
        faqs={faqs}
      />
      <AggregatorPage
        eyebrow="Apparel giveaways"
        title={`EVERY JERSEY, HAT & APPAREL GIVEAWAY`}
        lead={lead}
        lastUpdated={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming jersey or apparel giveaways are currently tracked."
      />
    </>
  );
}
