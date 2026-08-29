import { splitPromosByDate, strictBobbleheadGiveaways, teamDisplayName } from '@/lib/promo-helpers';
import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { numberWord } from '@/lib/coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { PastBobbleheadsSection } from '@/components/redesign/PastBobbleheadsSection';

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

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCoverageCounts();
  return {
    title: `${YEAR} Bobblehead Giveaways: Player Figurine Nights`,
    description: `Every ${YEAR} bobblehead giveaway across ${c.leagueList}. Player figurines by month with team, date, and opponent. From official team announcements.`,
    alternates: { canonical: 'https://www.getpromonight.com/promos/bobbleheads' },
    openGraph: pageOpenGraph('/promos/bobbleheads'),
  };
}

export default async function BobbleheadsPage() {
  // Fetch the whole season (Jan 1 forward), not just today forward: completed
  // bobbleheads feed the "Earlier this season" resale section while upcoming
  // ones drive the month groups exactly as before.
  const all = await getPromosFromDate(`${YEAR}-01-01`);
  const re = /bobblehead/i;
  const bobbleheads = all.filter((p) => re.test(p.title) || re.test(p.description));
  // The LIST above stays deliberately loose — a theme night whose description
  // names a bobblehead is still worth showing a fan. Every published NUMBER,
  // though, comes from the strict population, because "347 bobblehead
  // giveaways" was counting description-only mentions and purchase-gated ticket
  // packages as giveaways.
  const strict = strictBobbleheadGiveaways(all);
  const strictCount = strict.length;
  const byTeam = new Map<string, number>();
  for (const p of strict) {
    const name = teamDisplayName(p.team);
    byTeam.set(name, (byTeam.get(name) ?? 0) + 1);
  }
  const topTeams = [...byTeam.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);
  const today = todayYMD();
  const { upcoming, past } = splitPromosByDate(bobbleheads, today);

  const byMonth = new Map<string, typeof bobbleheads>();
  for (const p of upcoming) {
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

  const c = await getCoverageCounts();
  const lead = `Every bobblehead giveaway scheduled across ${c.leagueList} in ${YEAR}. Player name, team, date, and opponent for each bobblehead night, grouped by month. Pulled from official team sources, with MLB, WNBA, and MLS rechecked weekly in season.`;

  const faqs = [
    {
      question: `How many bobblehead giveaways are there in ${YEAR}?`,
      answer: `PromoNight has ${strictCount} bobblehead giveaway${strictCount !== 1 ? 's' : ''} on record across the ${numberWord(c.leagueCount)} major pro leagues in ${YEAR}, counting only free gate giveaways whose title names a bobblehead. MLB teams schedule most of them. The list below is wider than that count: it also shows theme nights that include a bobblehead and nights where the figurine comes with a ticket package.`,
    },
    {
      question: 'How do I get a bobblehead at a game?',
      answer:
        'Most bobbleheads go to the first 10,000 to 20,000 fans through the gates. Arrive early, ideally when gates open. Some teams require a specific ticket tier; each promo page in the PromoNight app lists the fine print.',
    },
    {
      question: 'Which team gives away the most bobbleheads?',
      answer: topTeams.length
        ? `On the ${YEAR} schedules we have on record, ${topTeams.slice(0, -1).join(', ')}${topTeams.length > 1 ? ' and ' : ''}${topTeams[topTeams.length - 1]} run the most bobblehead giveaways. Counts move through the season as teams announce more, and this answer is recomputed from the schedule rather than fixed.`
        : `No ${YEAR} bobblehead giveaways are on record yet.`,
    },
    {
      question: 'What if I miss a bobblehead giveaway?',
      // NO CLAIM ABOUT THE RESALE MARKET. We hold zero resale observations —
      // src/lib/ebay.ts builds an eBay SEARCH URL and stores nothing — so the
      // old answer ("most show up on eBay within days, often the same night")
      // asserted market behaviour this system has never measured. What is left
      // is only what is true: we link, the reader looks.
      answer:
        "Completed bobblehead nights stay listed on this page and on each team's schedule page, with a link through to current eBay listings for that giveaway so you can see what is available. We do not track resale prices, so check the listings for what a given bobblehead is going for.",
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/bobbleheads"
        title={`Every Bobblehead Giveaway in Pro Sports ${YEAR}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Bobbleheads"
        title={`EVERY BOBBLEHEAD IN ${YEAR}`}
        lead={lead}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming bobblehead nights are currently tracked. Teams typically announce more through the season."
        accentKey="giveaway"
        collection="bobbleheads"
        afterList={past.length > 0 ? <PastBobbleheadsSection promos={past} /> : undefined}
      />
    </>
  );
}
