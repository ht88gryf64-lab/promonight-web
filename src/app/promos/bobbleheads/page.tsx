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
  title: `${YEAR} Bobblehead Giveaway Schedule — Pro Sports Player Figurine Nights`,
  description: `Every ${YEAR} bobblehead giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA. Player figurine nights grouped by month with team, date, and opponent. Updated weekly.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/bobbleheads' },
};

export default async function BobbleheadsPage() {
  const all = await getPromosFromDate(todayYMD());
  const re = /bobblehead/i;
  const bobbleheads = all.filter((p) => re.test(p.title) || re.test(p.description));

  const byMonth = new Map<string, typeof bobbleheads>();
  for (const p of bobbleheads) {
    const key = p.date.slice(0, 7); // YYYY-MM
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

  const lead = `Every bobblehead giveaway scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Player name, team, date, and opponent for each bobblehead night, grouped by month. Pulled from official team sources and refreshed throughout the season.`;

  const faqs = [
    {
      question: `How many bobblehead giveaways are there in ${YEAR}?`,
      answer: `PromoNight is tracking ${bobbleheads.length} bobblehead giveaway${bobbleheads.length !== 1 ? 's' : ''} across the six major pro leagues in ${YEAR}. MLB teams schedule the majority, with smaller counts in NBA, NHL, and WNBA.`,
    },
    {
      question: 'How do I get a bobblehead at a game?',
      answer:
        'Most bobbleheads go to the first 10,000 to 20,000 fans through the gates. Arrive early, ideally when gates open. Some teams require a specific ticket tier; each promo page in the PromoNight app lists the fine print.',
    },
    {
      question: 'Which team gives away the most bobbleheads?',
      answer:
        'MLB teams typically lead; the Dodgers, Giants, and Guardians are consistently among the most active bobblehead programs. Counts vary season to season as teams announce more promos after opening day.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/bobbleheads"
        title={`Every Bobblehead Giveaway in Pro Sports ${YEAR}`}
        description={lead}
        lastUpdated={todayYMD()}
        faqs={faqs}
      />
      <AggregatorPage
        eyebrow="Bobbleheads"
        title={`EVERY BOBBLEHEAD IN ${YEAR}`}
        lead={lead}
        lastUpdated={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming bobblehead nights are currently tracked. Teams typically announce more through the season."
      />
    </>
  );
}
