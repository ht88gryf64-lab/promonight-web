import { splitPromosByDate, strictBobbleheadGiveaways, teamDisplayName } from '@/lib/promo-helpers';
import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { numberWord } from '@/lib/coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { PastBobbleheadsSection } from '@/components/redesign/PastBobbleheadsSection';
import { siteTodayYmd } from '@/lib/site-today';
import { crossLeagueSeasonLabel, scheduledPeriodPhrase, seasonSpan } from '@/lib/season-label';

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

// The list starts on Jan 1 of the 2026 calendar year: completed bobbleheads feed
// the resale section. Bump with TITLE_SEASON_YEAR's runbook.
const LIST_FROM = '2026-01-01';

// The season label in the title, heading, description and JSON-LD: "2026-27",
// from crossLeagueSeasonLabel() (src/lib/season-label.ts), never the clock.
// This page lists every league, and the NHL and NBA seasons run into 2027, so
// a bare "2026" here was false (ruling 2026-10-06). The label moves with the
// July 1 bump in known-issues 69. The lead names the months the listed rows
// actually span (scheduledPeriodPhrase), not a label.
const SEASON = crossLeagueSeasonLabel();

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCoverageCounts();
  return {
    title: `${SEASON} Bobblehead Giveaways: Player Figurine Nights`,
    description: `${SEASON} bobblehead giveaways across ${c.leagueList}. Player figurines by month with team, date, and opponent. From official team announcements.`,
    alternates: { canonical: 'https://www.getpromonight.com/promos/bobbleheads' },
    openGraph: pageOpenGraph('/promos/bobbleheads'),
  };
}

export default async function BobbleheadsPage() {
  // Fetch the whole season (Jan 1 forward), not just today forward: completed
  // bobbleheads feed the "Earlier this season" resale section while upcoming
  // ones drive the month groups exactly as before.
  const all = await getPromosFromDate(LIST_FROM);
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
  const period = scheduledPeriodPhrase(seasonSpan(bobbleheads.map((p) => p.date))) || `in ${SEASON}`;
  const strictPeriod = scheduledPeriodPhrase(seasonSpan(strict.map((p) => p.date))) || `in ${SEASON}`;
  const lead = `Bobblehead giveaways scheduled across ${c.leagueList} ${period}. Player name, team, date, and opponent for each bobblehead night, grouped by month. Pulled from official team sources, with MLB, WNBA, MLS, and NHL rechecked weekly in season.`;

  const faqs = [
    {
      question: `How many bobblehead giveaways are there ${strictPeriod}?`,
      answer: `PromoNight has ${strictCount} bobblehead giveaway${strictCount !== 1 ? 's' : ''} on record across the ${numberWord(c.leagueCount)} major pro leagues ${strictPeriod}, counting only free gate giveaways whose title names a bobblehead. MLB teams schedule most of them. The list below is wider than that count: it also shows theme nights that include a bobblehead and nights where the figurine comes with a ticket package.`,
    },
    {
      question: 'How do I get a bobblehead at a game?',
      answer:
        'Most bobbleheads go to the first 10,000 to 20,000 fans through the gates. Arrive early, ideally when gates open. Some teams require a specific ticket tier; each promo page in the PromoNight app lists the fine print.',
    },
    {
      question: 'Which team gives away the most bobbleheads?',
      answer: topTeams.length
        ? `On the schedules we have on record, ${topTeams.slice(0, -1).join(', ')}${topTeams.length > 1 ? ' and ' : ''}${topTeams[topTeams.length - 1]} run the most bobblehead giveaways. Counts move through the season as teams announce more, and this answer is recomputed from the schedule rather than fixed.`
        : 'No bobblehead giveaways are on record yet.',
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
        title={`Bobblehead Giveaways in Pro Sports ${SEASON}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Bobbleheads"
        title={`BOBBLEHEADS IN ${SEASON}`}
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
