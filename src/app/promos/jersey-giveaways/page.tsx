import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
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
// deploy, no review, and no jersey-giveaway data behind the new number. The page would
// sit in the index advertising a season that does not exist yet.
//
// Bump this deliberately when next-season content is ready. Same rule as
// /best-promos, the team pages, the venue pages and the CFB family.
const YEAR = 2026;

export const metadata: Metadata = {
  title: `${YEAR} Jersey, Cap & Hoodie Giveaway Nights`,
  description: `${YEAR} jersey, cap and apparel giveaways across pro sports. First 10,000 to 25,000 fans only. Arrive early. From official team announcements.`,
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
  const lead = `Jersey, cap, hat, jacket, shirt and hoodie giveaways across ${c.leagueList} in ${YEAR}. Apparel giveaway nights are typically capped at the first 10,000 to 25,000 fans through the gates, which is why arrival time matters.`;

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
        title={`Jersey & Apparel Giveaways in Pro Sports ${YEAR}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Apparel giveaways"
        title={`JERSEY, HAT & APPAREL GIVEAWAYS`}
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
