import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPlayoffPromos } from '@/lib/data';
import type { PlayoffPromo, Team, PlayoffConfig } from '@/lib/types';

export const revalidate = 3600;

const PAGE_URL = 'https://www.getpromonight.com/playoffs';
// Launch date for the /playoffs hub. Static anchor for Article.datePublished;
// dateModified refreshes with each scanner run.
const PAGE_PUBLISHED = '2026-04-20T00:00:00-05:00';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '2026 NBA and NHL Playoff Promotions',
    description:
      'Every promotional event at 2026 NBA and NHL playoff games. Rally towels, T-shirt giveaways, watch parties, and fan events, updated hourly.',
    alternates: {
      canonical: 'https://www.getpromonight.com/playoffs',
    },
    openGraph: {
      title: '2026 NBA and NHL Playoff Promotions',
      description:
        'Every promotional event at 2026 NBA and NHL playoff games across active teams. Updated hourly.',
      url: 'https://www.getpromonight.com/playoffs',
      type: 'website',
    },
  };
}

const LEAGUE_ICONS: Record<'NBA' | 'NHL', string> = { NBA: '🏀', NHL: '🏒' };

const ROUND_LABELS: Record<string, string> = {
  first_round: 'First Round',
  conference_semifinals: 'Conference Semifinals',
  conference_finals: 'Conference Finals',
  nba_finals: 'NBA Finals',
  stanley_cup_final: 'Stanley Cup Final',
};

function roundLabel(code: string): string {
  return ROUND_LABELS[code] ?? code.replace(/_/g, ' ');
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullTimestamp(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function extractOpponent(gameInfo: string): string | null {
  const m = gameInfo.match(/\bvs\.?\s+([A-Z][^(,]+?)(?:\s*\(|$)/);
  return m ? m[1].trim().replace(/[.,]$/, '') : null;
}

function buildFaqs(
  config: PlayoffConfig,
  byLeague: Record<'NBA' | 'NHL', { team: Team; promos: PlayoffPromo[] }[]>,
  totalPromos: number,
  totalTeams: number,
): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];

  if (config.nbaActive) {
    faqs.push({
      question: 'When do the 2026 NBA playoffs start?',
      answer:
        'The 2026 NBA Playoffs began April 18, 2026, with the First Round. The full bracket runs through the NBA Finals in June. Every active team has home-game promotions scheduled during their series.',
    });
  }
  if (config.nhlActive) {
    faqs.push({
      question: 'When do the 2026 NHL playoffs start?',
      answer:
        'The 2026 Stanley Cup Playoffs began April 18, 2026, with the First Round. The Stanley Cup Final is scheduled for June. Most active teams have rally towels or themed giveaways for every home playoff game.',
    });
  }

  faqs.push({
    question: 'What giveaways are at playoff games tonight?',
    answer: `PromoNight tracks ${totalPromos} scheduled playoff promotion${totalPromos !== 1 ? 's' : ''} across ${totalTeams} active teams. Each team section above lists the specific giveaways, watch parties, and fan events currently scheduled for their home playoff games. This page refreshes within an hour of the latest scanner update.`,
  });

  const rallyTeams: string[] = [];
  for (const league of ['NBA', 'NHL'] as const) {
    for (const { team, promos } of byLeague[league]) {
      const hasRally = promos.some((p) =>
        /rally towel|rally|towel/i.test(p.title) ||
        /rally towel|rally|towel/i.test(p.description),
      );
      if (hasRally) rallyTeams.push(`${team.city} ${team.name}`);
    }
  }
  if (rallyTeams.length > 0) {
    const list = rallyTeams.slice(0, 8).join(', ');
    const more = rallyTeams.length > 8 ? `, and ${rallyTeams.length - 8} more` : '';
    faqs.push({
      question: 'Which teams are giving out rally towels in Round 1?',
      answer: `${rallyTeams.length} active playoff team${rallyTeams.length !== 1 ? 's have' : ' has'} rally towel giveaways scheduled during Round 1: ${list}${more}. Specific sponsor partners and game-by-game designs vary by team.`,
    });
  }

  faqs.push({
    question: 'How do I find playoff promotions for my team?',
    answer:
      'Click any team name above to open that team\'s full promo page on PromoNight. Each team page shows the regular-season calendar plus a pinned playoff section with all scheduled giveaways, watch parties, and fan events. The PromoNight iOS and Android apps also push notifications before each game.',
  });

  return faqs;
}

function countWords(...strings: (string | undefined)[]): number {
  return strings
    .filter((s): s is string => !!s)
    .reduce((acc, s) => acc + s.trim().split(/\s+/).length, 0);
}

function pickHighlightExample(
  byLeague: Record<'NBA' | 'NHL', { team: Team; promos: PlayoffPromo[] }[]>,
): { title: string; teamName: string } | null {
  for (const league of ['NBA', 'NHL'] as const) {
    for (const group of byLeague[league]) {
      const hot = group.promos.find((p) => p.highlight && p.date);
      if (hot) return { title: hot.title, teamName: group.team.name };
    }
  }
  for (const league of ['NBA', 'NHL'] as const) {
    for (const group of byLeague[league]) {
      const hot = group.promos.find((p) => p.highlight);
      if (hot) return { title: hot.title, teamName: group.team.name };
    }
  }
  return null;
}

export default async function PlayoffsPage() {
  const { config, byLeague, totalPromos, totalTeams } = await getAllPlayoffPromos();

  if (!config || !config.playoffsActive) {
    notFound();
  }

  const nbaGroups = config.nbaActive ? byLeague.NBA : [];
  const nhlGroups = config.nhlActive ? byLeague.NHL : [];
  const example = pickHighlightExample(byLeague);
  const lastUpdated = formatFullTimestamp(
    config.lastScanDate ?? config.updatedAt,
  );
  const lastModifiedIso =
    config.lastScanDate ?? config.updatedAt ?? PAGE_PUBLISHED;

  const faqs = buildFaqs(config, byLeague, totalPromos, totalTeams);
  const headline = '2026 NBA and NHL Playoff Promotions';
  const description = `Every promotional event at 2026 NBA and NHL playoff games: ${totalPromos} scheduled giveaways, watch parties, and fan events across ${totalTeams} active teams. Updated hourly.`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished: PAGE_PUBLISHED,
    dateModified: lastModifiedIso,
    author: {
      '@type': 'Organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.getpromonight.com/icon.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': PAGE_URL,
    },
    url: PAGE_URL,
    wordCount: countWords(
      headline,
      description,
      ...faqs.flatMap((f) => [f.question, f.answer]),
    ),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return (
    <div className="pt-24 pb-20 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Live during Round 1
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2 mb-6">
            2026 NBA AND NHL PLAYOFF PROMOTIONS
          </h1>
          <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-3xl">
            The 2026 NBA and NHL playoffs feature {totalPromos} promotional events across {totalTeams} teams
            {example
              ? `, including "${example.title}" for the ${example.teamName}`
              : ''}
            . Every giveaway, watch party, and rally towel currently scheduled is listed below, updated hourly from official team sources.
          </p>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-6">
            Last updated: {lastUpdated}
          </p>
        </header>

        {nbaGroups.length > 0 && (
          <LeagueSection
            league="NBA"
            roundCode={config.nbaRound}
            groups={nbaGroups}
          />
        )}

        {nhlGroups.length > 0 && (
          <LeagueSection
            league="NHL"
            roundCode={config.nhlRound}
            groups={nhlGroups}
          />
        )}

        {nbaGroups.length === 0 && nhlGroups.length === 0 && (
          <p className="text-text-secondary text-center py-16">
            No playoff promotions scheduled yet. Check back soon.
          </p>
        )}

        <section className="mt-16 pt-10 border-t border-border-subtle">
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mb-8">
            FREQUENTLY ASKED QUESTIONS
          </h2>
          <div className="space-y-6 max-w-3xl">
            {faqs.map((f, i) => (
              <div key={i}>
                <h3 className="text-white font-semibold text-base mb-2">{f.question}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LeagueSection({
  league,
  roundCode,
  groups,
}: {
  league: 'NBA' | 'NHL';
  roundCode: string;
  groups: { team: Team; promos: PlayoffPromo[] }[];
}) {
  return (
    <section className="mt-12 pt-10 border-t border-border-subtle">
      <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mb-8">
        <span className="mr-3" aria-hidden>
          {LEAGUE_ICONS[league]}
        </span>
        {league} · {roundLabel(roundCode)}
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <TeamCard key={g.team.id} team={g.team} promos={g.promos} />
        ))}
      </div>
    </section>
  );
}

function TeamCard({ team, promos }: { team: Team; promos: PlayoffPromo[] }) {
  const opponent = promos
    .map((p) => extractOpponent(p.gameInfo))
    .find((o): o is string => !!o);
  const visible = promos.slice(0, 4);
  const remaining = Math.max(0, promos.length - visible.length);
  const teamUrl = `/${team.sportSlug}/${team.id}`;

  return (
    <article className="bg-bg-card border border-border-subtle rounded-xl p-5 md:p-6 flex flex-col">
      <div className="mb-4">
        <h3 className="font-display text-xl md:text-2xl tracking-[0.5px]">
          <Link href={teamUrl} className="hover:text-accent-red transition-colors">
            {team.city} {team.name}
          </Link>
        </h3>
        {opponent && (
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-1">
            vs {opponent}
          </p>
        )}
      </div>

      <ul className="space-y-2 flex-1">
        {visible.map((p, i) => (
          <li key={i} className="flex items-baseline gap-3 text-sm">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: promoTypeColor(p.type) }}
              aria-hidden
            />
            <span className="text-white flex-1 leading-snug">{p.title}</span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-text-muted whitespace-nowrap shrink-0">
              {p.date
                ? formatShortDate(p.date)
                : p.recurring
                  ? 'recurring'
                  : ''}
            </span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-xs text-text-muted pl-4">
            + {remaining} more
          </li>
        )}
      </ul>

      <div className="mt-5 pt-4 border-t border-border-subtle">
        <Link
          href={teamUrl}
          className="font-mono text-[11px] tracking-[0.08em] uppercase text-accent-red hover:text-white transition-colors"
        >
          View full {team.name} promotions →
        </Link>
      </div>
    </article>
  );
}

function promoTypeColor(type: string): string {
  switch (type) {
    case 'giveaway':
      return 'var(--color-promo-giveaway)';
    case 'theme':
      return 'var(--color-promo-theme)';
    case 'food':
      return 'var(--color-promo-food)';
    default:
      return 'var(--color-text-muted)';
  }
}
