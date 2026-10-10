import type { Metadata } from 'next';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { pageOpenGraph } from '@/lib/og';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import type { PromoWithTeam } from '@/lib/types';
import { siteTodayYmd } from '@/lib/site-today';
import { crossLeagueSeasonLabel, scheduledPeriodPhrase, seasonSpan } from '@/lib/season-label';

export const revalidate = 21600;

// The site's calendar day, America/New_York (src/lib/site-today.ts), the same
// day as the team pages and hubs. It was the server's local day (UTC on
// Vercel) until WEB6 G3 (2026-10-06).
function todayYMD(): string {
  return siteTodayYmd();
}

// The season label in the title, heading, description and JSON-LD: "2026-27",
// from crossLeagueSeasonLabel() (src/lib/season-label.ts), never the clock.
// This page lists every league, and the NHL and NBA seasons run into 2027, so
// a bare "2026" here was false (ruling 2026-10-06). The label moves with the
// July 1 bump in known-issues 69. The lead names the months the listed rows
// actually span (scheduledPeriodPhrase), not a label.
const SEASON = crossLeagueSeasonLabel();

interface ThemeCategory {
  label: string;
  match: (p: PromoWithTeam) => boolean;
}

const CATEGORIES: ThemeCategory[] = [
  {
    label: 'STAR WARS NIGHTS',
    match: (p) => /star\s*wars|jedi|mandalorian|yoda/i.test(`${p.title} ${p.description}`),
  },
  {
    label: 'HERITAGE & CULTURAL NIGHTS',
    match: (p) =>
      /heritage|latino|hispanic|asian|african\s*american|pride|irish|italian|jewish|indigenous|native american|juneteenth/i.test(
        `${p.title} ${p.description}`,
      ),
  },
  {
    label: 'FIREWORKS & POSTGAME CONCERTS',
    match: (p) =>
      /fireworks|postgame concert|post-game concert|pyro|light show/i.test(
        `${p.title} ${p.description}`,
      ),
  },
  {
    label: 'POP CULTURE & FRANCHISE NIGHTS',
    match: (p) =>
      /harry potter|marvel|avengers|dc comics|batman|superman|pokemon|pokémon|anime|disney|pixar|simpsons/i.test(
        `${p.title} ${p.description}`,
      ),
  },
  {
    label: 'FAITH & COMMUNITY NIGHTS',
    match: (p) =>
      /faith|church|bible|community|military|first responders|teacher|nurse|veteran/i.test(
        `${p.title} ${p.description}`,
      ),
  },
];

export const metadata: Metadata = {
  title: `${SEASON} Theme Nights: Star Wars, Heritage & Fireworks`,
  description: `${SEASON} theme nights across pro sports by category: Star Wars, heritage, fireworks, faith and community, and pop culture tie-ins. From official team announcements.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/theme-nights' },
  openGraph: pageOpenGraph('/promos/theme-nights'),
};

function formatDateParts(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default async function ThemeNightsPage() {
  const all = await getPromosFromDate(todayYMD());
  const themes = all.filter((p) => p.type === 'theme');

  const categorized: { cat: ThemeCategory; list: PromoWithTeam[] }[] = CATEGORIES.map((cat) => ({
    cat,
    list: themes.filter((p) => cat.match(p)),
  }));

  const taken = new Set<PromoWithTeam>();
  for (const entry of categorized) {
    for (const p of entry.list) taken.add(p);
  }

  const uncategorized = themes.filter((p) => !taken.has(p));

  const groups: AggregatorGroup[] = [];
  for (const entry of categorized) {
    if (entry.list.length === 0) continue;
    const sorted = entry.list.sort((a, b) => a.date.localeCompare(b.date));
    groups.push({ label: entry.cat.label, promos: sorted });
  }
  if (uncategorized.length > 0) {
    groups.push({
      label: 'OTHER THEME NIGHTS',
      promos: uncategorized.sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  const c = await getCoverageCounts();
  const period = scheduledPeriodPhrase(seasonSpan(themes.map((p) => p.date))) || `in ${SEASON}`;
  const lead = `Theme nights scheduled across ${c.leagueList} ${period}. Grouped by theme category, from Star Wars nights and fireworks spectaculars to heritage and community celebrations. ${themes.length} theme nights currently tracked across ${c.teamCount} teams.`;

  const faqs = [
    {
      question: 'How are theme nights categorized?',
      answer:
        'Theme nights are grouped by recognizable franchise or cultural moment: Star Wars, heritage, fireworks, pop culture, and community nights. Promos that do not match a category appear under "Other theme nights."',
    },
    {
      question: 'Do theme nights include a giveaway?',
      answer:
        'Sometimes. Many theme nights pair with a themed giveaway (a Star Wars bobblehead, a heritage-themed jersey) but others are purely pregame activations and themed entertainment. The team promo page lists the specifics.',
    },
    {
      question: 'Can I get theme-night notifications?',
      answer:
        'Yes. The free PromoNight app schedules a reminder on your device for the morning of a promo day for the teams you follow.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/theme-nights"
        title={`Theme Nights in Pro Sports ${SEASON}`}
        description={lead}
        faqs={faqs}
        groups={groups}
      />
      <AggregatorPage
        eyebrow="Theme nights"
        title={`THEME NIGHTS IN ${SEASON}`}
        lead={lead}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming theme nights are currently tracked."
        accentKey="theme"
        collection="theme-nights"
      />
    </>
  );
}
