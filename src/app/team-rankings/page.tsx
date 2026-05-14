import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllTeamScores, getTopPromosPerTeam } from '@/lib/data';
import type { ScoredPromoWithTeam } from '@/lib/types';
import { TeamRankingsList } from '@/components/scoring/team-rankings-list';
import { ScoringPageViewTracker } from '@/components/scoring/scoring-page-view-tracker';
import { teamDisplayName } from '@/lib/promo-helpers';

export const revalidate = 86400;

const PAGE_URL = 'https://www.getpromonight.com/team-rankings';
const YEAR = new Date().getFullYear();

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Three-variable rule: team count, league set, top score / top team name
// are all interpolated below. Distinct from /best-promos and /bobbleheads.
export const metadata: Metadata = {
  title: `Best Sports Promo Schedules of ${YEAR}: Team-by-Team Rankings`,
  description: `All 73 MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. Texas Rangers leads at score 96; Seattle Storm tops WNBA at 94 and Orlando City tops MLS at 85. Each ranking factors variety, highlights, and the share of major giveaways. Updated weekly.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Best Sports Promo Schedules of ${YEAR}`,
    description: `All 73 MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. Updated weekly.`,
    url: PAGE_URL,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight — team promo schedule rankings',
      },
    ],
  },
};

const FAQS = [
  {
    question: 'How are team promo schedules ranked?',
    answer:
      'PromoNight computes a team-level score from five inputs: average promo score across the team\'s schedule, total number of scored promos, count of highlighted promos, schedule variety bonus, and a hot-promo bonus. Teams with deep schedules of high-scoring giveaways rank highest.',
  },
  {
    question: 'Which MLB team has the best promo schedule?',
    answer:
      'Texas Rangers leads MLB and the overall list at 96. Los Angeles Dodgers ranks second at 94, followed by Chicago Cubs at 89 and San Diego Padres at 86. The MLB tier above 90 is concentrated in clubs with deep bobblehead programs and named-sponsor coverage.',
  },
  {
    question: 'Which MLS team has the highest-rated promo schedule?',
    answer:
      'Orlando City leads MLS at 85, followed by FC Dallas at 81 and Portland Timbers at 67. MLS clubs typically score below MLB and WNBA at the top of the table because MLS promo schedules run fewer bobblehead and jersey-giveaway dates per season.',
  },
  {
    question: 'Which WNBA team tops the rankings?',
    answer:
      'Seattle Storm leads WNBA at 94, tied with Los Angeles Dodgers for second overall. WNBA teams score high because their smaller venues make low-cap, high-quality giveaways easier to staff and distribute to most ticketed fans.',
  },
  {
    question: 'Why is my team\'s score the same as last week?',
    answer:
      'Team scores recompute only when at least one of the team\'s promos changes between scans. A team whose schedule is stable from the previous week keeps its prior score and computedAt timestamp. Scrape failures during the weekly run also skip the rescore for that team.',
  },
  {
    question: 'Why are NBA and NHL not on this ranking?',
    answer:
      'The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline this ranking depends on. Those leagues will join in a future release.',
  },
  {
    question: 'What does variety bonus mean?',
    answer:
      'Variety bonus rewards teams whose schedule has multiple promo types rather than running only one. A team with 2 bobbleheads earns less variety bonus than a team with a bobblehead, a jersey, a theme night, and a kids day. The bonus caps at 8 points for teams running all four major types.',
  },
  {
    question: 'How are bonuses applied to the final team score?',
    answer:
      'A team\'s score equals: average promo score, plus variety bonus (max 8 points), plus hot-promo bonus capped at 20 points. A team running 16 or more highlighted promos hits the hot-promo cap; additional highlighted promos do not lift the score further but do strengthen team appeal in the underlying data.',
  },
];

export default async function TeamRankingsPage() {
  const now = new Date();
  const todayYMD = localYMD(now);

  const [teamScores, topPromosMap] = await Promise.all([
    getAllTeamScores(),
    getTopPromosPerTeam(todayYMD),
  ]);

  // Flatten the Map<string, ScoredPromoWithTeam> into a plain Record so it
  // can pass through the server→client component boundary cleanly. Maps
  // don't serialize across the RSC payload.
  const topPromos: Record<string, ScoredPromoWithTeam> = {};
  for (const [teamId, promo] of topPromosMap) {
    topPromos[teamId] = promo;
  }

  const topTeam = teamScores[0];
  const latestComputedAt = teamScores.reduce((acc, t) => {
    if (!t.computedAt) return acc;
    return !acc || t.computedAt > acc ? t.computedAt : acc;
  }, '');
  const lastUpdatedDisplay = latestComputedAt
    ? new Date(latestComputedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

  // ItemList schema with SportsTeam items rather than SportsEvent items.
  // Inline (not via ScoredJsonLd) because the item type differs from the
  // promo pages and adding a generic schema renderer adds little value
  // for just two consumers.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Best Sports Promo Schedules of ${YEAR}: Team-by-Team Rankings`,
    description: `All ${teamScores.length} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength.`,
    url: PAGE_URL,
    dateModified: latestComputedAt || new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PromoNight',
      url: 'https://www.getpromonight.com',
    },
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
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: teamScores.length,
    itemListElement: teamScores.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsTeam',
        name: teamDisplayName(t.team),
        sport: t.league,
        url: `https://www.getpromonight.com/${t.team.sportSlug}/${t.team.id}`,
        description: `Team promo score ${t.teamScore}. ${t.promoCount} promos scored, ${t.highlightCount} highlighted.`.slice(0, 280),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <div className="pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-text-secondary">Team rankings</span>
          </div>

          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Team rankings {YEAR}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            BEST SPORTS PROMO SCHEDULES OF {YEAR}
          </h1>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-3">
            Last updated {lastUpdatedDisplay} · {teamScores.length} teams
            ranked
          </p>
          <p className="mt-5 text-text-secondary text-base leading-relaxed max-w-3xl">
            All {teamScores.length} scored teams across MLB, MLS, and WNBA
            are ranked below by promo schedule strength
            {topTeam
              ? `, with ${teamDisplayName(topTeam.team)} leading at score ${topTeam.teamScore}`
              : ''}
            . Each ranking combines the team&apos;s average promo score, the
            number of highlighted promos, a schedule variety bonus, and a
            hot-promo bonus. Filter by league to compare within MLB, MLS,
            or WNBA only.
          </p>

          <ScoringPageViewTracker
            pageTitle="Team Rankings"
            scoreCount={teamScores.length}
            defaultLeague="All"
          />

          <div className="mt-10">
            <TeamRankingsList
              teamScores={teamScores}
              topPromos={topPromos}
            />
          </div>

          <section className="mt-16 pt-10 border-t border-border-subtle">
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mb-8">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <div className="space-y-6 max-w-3xl">
              {FAQS.map((f, i) => (
                <div key={i}>
                  <h3 className="text-white font-semibold text-base mb-2">
                    {f.question}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {f.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
