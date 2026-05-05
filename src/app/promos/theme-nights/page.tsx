import type { Metadata } from 'next';
import { getPromosFromDate } from '@/lib/data';
import { AggregatorPage, AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import type { PromoWithTeam } from '@/lib/types';

export const revalidate = 21600;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const YEAR = new Date().getFullYear();

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
  title: `${YEAR} Theme Nights: Star Wars, Heritage & Fireworks`,
  description: `Every ${YEAR} theme night across pro sports by category: Star Wars, heritage, fireworks, faith and community, and pop culture tie-ins. Updated weekly.`,
  alternates: { canonical: 'https://www.getpromonight.com/promos/theme-nights' },
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

  const lead = `Every theme night scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Grouped by theme category, from Star Wars nights and fireworks spectaculars to heritage and community celebrations. ${themes.length} theme nights currently tracked across 167 teams.`;

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
        'Yes. PromoNight Pro sends a push notification the morning of a promo day for every team you follow. It is $5.99 per season for a single sport or $9.99 per year for all sports.',
    },
  ];

  return (
    <>
      <AggregatorJsonLd
        url="https://www.getpromonight.com/promos/theme-nights"
        title={`Every Theme Night in Pro Sports ${YEAR}`}
        description={lead}
        lastUpdated={todayYMD()}
        faqs={faqs}
      />
      <AggregatorPage
        eyebrow="Theme nights"
        title={`EVERY THEME NIGHT IN ${YEAR}`}
        lead={lead}
        lastUpdated={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        groups={groups}
        faqs={faqs}
        emptyMessage="No upcoming theme nights are currently tracked."
      />
    </>
  );
}
