import type { Metadata } from 'next';
import Link from 'next/link';
import { IconBallFootball, IconChevronRight } from '@tabler/icons-react';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, type AggregatorGroup } from '@/components/aggregator-layout';
import { isSoccerJerseyPromo } from '@/lib/soccer-jersey';
import { teamDisplayName } from '@/lib/promo-helpers';
import type { PromoWithTeam } from '@/lib/types';

const PAGE_URL = 'https://www.getpromonight.com/promos/soccer-jersey-nights';

// World Cup window, for the intro count and the cross-link callout copy.
const WC_START = '2026-06-11';
const WC_END = '2026-07-19';

export const revalidate = 21600;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function longDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export const metadata: Metadata = {
  title: 'Soccer Jersey Nights 2026: MLB, WNBA & MLS Giveaways',
  description:
    'Every upcoming soccer jersey night across pro sports in 2026. MLB, WNBA, and MLS games giving away soccer-style jerseys, many during the World Cup. Dates, teams, and how to get one.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Soccer Jersey Nights 2026: MLB, WNBA & MLS Giveaways',
    description:
      'Every upcoming soccer jersey giveaway across MLB, WNBA, and MLS in 2026, many during the World Cup.',
    url: PAGE_URL,
    siteName: 'PromoNight',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight soccer jersey nights guide',
      },
    ],
  },
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'What is a soccer jersey night?',
    answer:
      'A soccer jersey night is a pro sports game where the giveaway is a soccer-style jersey rather than the usual baseball or basketball jersey. In 2026 many MLB, WNBA, and MLS teams are running them as a tie-in with the World Cup, which the United States co-hosts from June 11 to July 19.',
  },
  {
    question: 'Which MLB teams have soccer jersey giveaways in 2026?',
    answer:
      'A large share of the league is in. Confirmed MLB soccer jersey nights include the Yankees, Mets, Dodgers, Red Sox, Cubs, Braves, Astros, Mariners, Giants, Orioles, Blue Jays, Diamondbacks, Rockies, Nationals, Pirates, and Cardinals. The full upcoming list, with dates, is above and updates as more are announced.',
  },
  {
    question: 'When are the soccer jersey nights during the World Cup?',
    answer:
      'Most of them. Nearly every soccer jersey night on the calendar falls between June 11 and July 19, 2026, the World Cup window, since teams are timing the giveaway to the tournament. A handful of WNBA and MLS dates land later in the season. Check each row for the exact date.',
  },
  {
    question: 'How do I get the soccer jersey at the game?',
    answer:
      'Soccer jersey nights, like other apparel giveaways, are typically limited to the first 10,000 to 25,000 fans through the gates, so arrival time matters. Open the team page from any row for gate times and details, or use the PromoNight app for a morning-of reminder.',
  },
];

export default async function SoccerJerseyNightsPage() {
  const all = await getPromosFromDate(todayYMD());
  const hits = all.filter((p) => isSoccerJerseyPromo(p, p.team.league));

  // Group by month (sibling pattern). getPromosFromDate returns date-ascending,
  // so the World Cup-window months (June, July) sort to the top naturally.
  const byMonth = new Map<string, PromoWithTeam[]>();
  for (const p of hits) {
    const key = p.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }
  const groups: AggregatorGroup[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => ({ label: monthLabel(list[0].date).toUpperCase(), promos: list }));

  const total = hits.length;
  const wcCount = hits.filter((p) => p.date >= WC_START && p.date <= WC_END).length;
  const updatedLong = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const updatedIso = new Date().toISOString();

  const lead =
    `A soccer jersey night is a pro sports game where the giveaway is a soccer-style jersey, and ${total} are on the upcoming calendar across MLB, WNBA, and MLS in 2026, ${wcCount} of them during the World Cup. ` +
    'United States teams are timing these giveaways to the tournament the country co-hosts from June 11 to July 19. Arrive early: apparel nights are usually capped at the first 10,000 to 25,000 fans.';

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Soccer Jersey Nights 2026',
    description:
      'Every upcoming soccer jersey giveaway across MLB, WNBA, and MLS in 2026, many during the World Cup.',
    url: PAGE_URL,
    dateModified: updatedIso,
    isPartOf: { '@type': 'WebSite', name: 'PromoNight', url: 'https://www.getpromonight.com' },
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Soccer Jersey Nights 2026',
    numberOfItems: total,
    itemListElement: hits.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${p.title} (${teamDisplayName(p.team)}, ${longDate(p.date)})`,
      url: `https://www.getpromonight.com/${p.team.sportSlug}/${p.team.id}`,
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const worldCupCallout = (
    <Link
      href="/world-cup"
      className="group mt-6 flex items-center gap-4 rounded-2xl border border-rd-line bg-rd-card p-5 transition-colors hover:border-rd-line-strong"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: '#f973161f' }}
      >
        <IconBallFootball size={22} stroke={2} style={{ color: '#f97316' }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-rd text-sm font-semibold text-rd-ink">
          {wcCount} of these land during the World Cup
        </div>
        <div className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
          See the host-city fan guide: local games and promos in all 11 US host cities.
        </div>
      </div>
      <IconChevronRight
        size={18}
        stroke={2.25}
        className="shrink-0 text-rd-ink-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <AggregatorPage
        eyebrow="Soccer jersey giveaways"
        title="Soccer Jersey Nights"
        lead={lead}
        lastUpdated={updatedLong}
        groups={groups}
        faqs={FAQS}
        emptyMessage="No upcoming soccer jersey nights are currently tracked. Check back as teams announce World Cup tie-ins."
        accentKey="giveaway"
        collection="soccer-jersey-nights"
        afterIntro={worldCupCallout}
      />
    </>
  );
}
