import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
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

// The season label in the title, heading, description and JSON-LD: "2026-27",
// from crossLeagueSeasonLabel() (src/lib/season-label.ts), never the clock.
// This page lists every league, and the NHL and NBA seasons run into 2027, so
// a bare "2026" here was false (ruling 2026-10-06). The label moves with the
// July 1 bump in known-issues 69. The lead names the months the listed rows
// actually span (scheduledPeriodPhrase), not a label.
const SEASON = crossLeagueSeasonLabel();

export const metadata: Metadata = {
  title: `${SEASON} Jersey, Cap & Hoodie Giveaway Nights`,
  description: `${SEASON} jersey, cap and apparel giveaways across pro sports. First 10,000 to 25,000 fans only. Arrive early. From official team announcements.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/jersey-giveaways' },
  openGraph: pageOpenGraph('/promos/jersey-giveaways'),
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

  const c = await getCoverageCounts();
  const period = scheduledPeriodPhrase(seasonSpan(jerseys.map((p) => p.date))) || `in ${SEASON}`;
  const lead = `Jersey, cap, hat, jacket, shirt and hoodie giveaways across ${c.leagueList} ${period}. Apparel giveaway nights are typically capped at the first 10,000 to 25,000 fans through the gates, which is why arrival time matters.`;

  const faqs = [
    {
      question: 'What counts as a jersey giveaway?',
      answer:
        'This page pulls any promo whose title or description includes jersey, cap, hat, jacket, shirt, or hoodie. That covers replica jerseys, rally caps, hoodie nights, and novelty apparel like Hawaiian shirts.',
    },
    {
      question: 'Are jersey giveaways limited to certain sections?',
      answer:
        'Sometimes. Many teams give out jerseys to all fans through the main gates while reserving premium items (autographed, youth-sized, alternate colorway) for specific tiers. Check the team promo page for that night.',
    },
    {
      question: `How do I track jersey nights for just my team?`,
      answer:
        'Visit your team page from any promo in this list, or download the PromoNight app to pin a team, and add PromoNight Pro for a morning-of reminder before an apparel night.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/jersey-giveaways"
        title={`Jersey & Apparel Giveaways in Pro Sports ${SEASON}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Apparel giveaways"
        title={`JERSEY, HAT & APPAREL GIVEAWAYS IN ${SEASON}`}
        lead={lead}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming jersey or apparel giveaways are currently tracked."
        accentKey="giveaway"
        collection="jersey-giveaways"
        afterIntro={
          <Link
            href="/promos/soccer-jersey-nights"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-rd-line-strong px-4 py-2 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-ink hover:text-rd-ink"
          >
            See soccer jersey nights
            <IconChevronRight size={14} stroke={2.5} aria-hidden />
          </Link>
        }
      />
    </>
  );
}
