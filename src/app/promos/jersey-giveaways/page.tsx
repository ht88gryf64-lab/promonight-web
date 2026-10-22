import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import { getPromosFromDate } from '@/lib/data';
import { isJerseyHubRow } from '@/lib/promo-helpers';
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

export const metadata: Metadata = {
  title: 'Upcoming Jersey, Cap & Hoodie Giveaway Nights',
  description: `Upcoming jersey, cap and apparel giveaways across pro sports. First 10,000 to 25,000 fans only. Arrive early. From official team announcements.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/jersey-giveaways' },
  openGraph: pageOpenGraph('/promos/jersey-giveaways'),
};

export default async function JerseyGiveawaysPage() {
  const all = await getPromosFromDate(todayYMD());
  // GIVEAWAY ROWS ONLY (2026-10-21). The keyword alone listed theme nights and
  // ceremonies on a page titled giveaway nights: 51 of 141 rows on 2026-10-21
  // were type theme ("Caps Holiday Party", "Kopitar Jersey Retirement", "Fourth
  // Wing Ticket Pack"). The keyword still narrows giveaways to apparel. The
  // homepage tiles and team-page hints that link here count with the same
  // predicate.
  const jerseys = all.filter(isJerseyHubRow);

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
  const period = scheduledPeriodPhrase(seasonSpan(jerseys.map((p) => p.date))) || 'on the calendar';
  const lead = `Jersey, cap, hat, jacket, shirt and hoodie giveaways across ${c.leagueList} ${period}. Apparel giveaway nights are typically capped at the first 10,000 to 25,000 fans through the gates, which is why arrival time matters.`;

  const faqs = [
    {
      question: 'What counts as a jersey giveaway?',
      answer:
        'This page lists giveaway nights whose title or description includes jersey, cap, hat, jacket, shirt, or hoodie. That covers replica jerseys, rally caps, hoodie nights, and novelty apparel like Hawaiian shirts. A theme night that includes apparel as part of the night is listed on the theme nights page rather than here.',
    },
    {
      question: 'Are jersey giveaways limited to certain sections?',
      answer:
        'Sometimes. Many teams give out jerseys to all fans through the main gates while reserving premium items (autographed, youth-sized, alternate colorway) for specific tiers. Check the team promo page for that night.',
    },
    {
      question: `How do I track jersey nights for just my team?`,
      answer:
        'Visit your team page from any promo in this list, or download the free PromoNight app to star a team and get a morning-of reminder before an apparel night.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/jersey-giveaways"
        title="Upcoming Jersey & Apparel Giveaways in Pro Sports"
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Apparel giveaways"
        title="UPCOMING JERSEY, HAT & APPAREL GIVEAWAYS"
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
