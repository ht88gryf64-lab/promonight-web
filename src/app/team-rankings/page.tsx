import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getAllTeamScores, getTopPromosPerTeam } from '@/lib/data';
import type { ScoredPromoWithTeam } from '@/lib/types';
import { TeamRankingsList } from '@/components/scoring/team-rankings-list';
import { ScoringPageViewTracker } from '@/components/scoring/scoring-page-view-tracker';
import { teamDisplayName } from '@/lib/promo-helpers';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from '@/components/redesign/fonts-house';

export const revalidate = 86400;

const PAGE_URL = 'https://www.getpromonight.com/team-rankings';
// Hardcoded season year in SEO copy per house rule (never getFullYear();
// bump deliberately when next-season content is ready).
const YEAR = 2026;

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Team count is DERIVED from teamScores at metadata time so it can never
// contradict the rendered list. Leader names and scores are deliberately NOT
// in the meta: a derived leader drifts every scoring run, and a frozen one
// goes false the same way the pre-rescore copy did.
export async function generateMetadata(): Promise<Metadata> {
  const teamCount = (await getAllTeamScores()).length;
  return {
    title: `Best Sports Promo Schedules of ${YEAR}: Team Rankings`,
    description: `All ${teamCount} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. Each ranking factors variety, highlights, and the share of major giveaways. MLB rescored weekly; WNBA and MLS in season.`,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: `Best Sports Promo Schedules of ${YEAR}`,
      description: `All ${teamCount} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. MLB rescored weekly; WNBA and MLS in season.`,
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
}

const FAQS = [
  {
    question: 'How are team promo schedules ranked?',
    answer:
      'PromoNight computes a team-level score from five inputs: average promo score across the team\'s schedule, total number of scored promos, count of highlighted promos, schedule variety bonus, and a hot-promo bonus. Teams with deep schedules of high-scoring giveaways rank highest.',
  },
  {
    question: 'Which MLB team has the best promo schedule?',
    answer:
      'The current MLB leader sits at the top of the live table above. The top MLB tier is concentrated in clubs with deep bobblehead programs and named-sponsor coverage.',
  },
  {
    question: 'Which MLS team has the highest-rated promo schedule?',
    answer:
      'The current MLS leader is shown in the live table above, filterable by league. MLS clubs typically score below MLB and WNBA at the top of the table because MLS promo schedules run fewer bobblehead and jersey-giveaway dates per season.',
  },
  {
    question: 'Which WNBA team tops the rankings?',
    answer:
      'The current WNBA leader is shown in the live table above, filterable by league. WNBA teams score high because their smaller venues make low-cap, high-quality giveaways easier to staff and distribute to most ticketed fans.',
  },
  {
    question: 'Why is my team\'s score the same as last week?',
    answer:
      'Scores are recomputed in a full league sweep with each league\'s weekly scan: MLB year-round, WNBA and MLS in season. Scoring is deterministic, so a team whose schedule has not changed gets the same score back after a sweep; the Last updated date reflects the most recent sweep, not a change in your team\'s number.',
  },
  {
    question: 'Why are NBA and NHL not on this ranking?',
    answer:
      'The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline this ranking depends on. Those leagues will join in a future release.',
  },
  {
    question: 'What does variety bonus mean?',
    answer:
      'Variety bonus rewards teams whose schedule has multiple promo types rather than running only one. A team with 2 bobbleheads earns less variety bonus than a team with a bobblehead, a jersey, a theme night, and a kids day. It pays 3 points for two types, 8 for three, and 15 for all four. A type counts once the team has at least one promo of that type scoring 30 or higher.',
  },
  {
    question: 'How are bonuses applied to the final team score?',
    answer:
      'A team\'s score equals its total promo score divided by its home-game count, times 1.5, plus a variety bonus of up to 15 points, plus a hot-promo bonus of 2 points per highlighted promo capped at 20. Recurring promos are excluded. A team running 10 or more highlighted promos hits the hot-promo cap; additional highlighted promos do not lift the score further but do strengthen team appeal in the underlying data. Team scores are not on a 0 to 100 scale and can exceed 100.',
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
  // Real stamp only: no render-clock fallback (docs/known-issues.md entry 17).
  // Null hides the visible Last-updated line rather than asserting today.
  const lastUpdatedDisplay = latestComputedAt
    ? new Date(latestComputedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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
    ...(latestComputedAt ? { dateModified: latestComputedAt } : {}),
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
        // Scope is explicit because this is structured data. promoCount and
        // highlightCount are both computed by scoreTeam over the SAME
        // non-recurring lifetime array, so one scope word covers both, and
        // "of them" pins the highlight figure to that same population rather
        // than leaving it readable as a separate current-state number.
        description: `Team promo score ${t.teamScore}. ${t.promoCount} all-time promos scored, ${t.highlightCount} of them highlighted.`.slice(0, 280),
      },
    })),
  };

  const Schemas = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
    </>
  );

  if (isRedesignEnabled()) {
    return (
      <>
        {Schemas}
        <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
          <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
            <div aria-hidden className="absolute inset-0 z-0 opacity-70" style={{ backgroundImage: 'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)' }} />
            <div className="relative z-10 mx-auto max-w-4xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
              <div className="mb-5 flex items-center gap-2 font-rd text-xs text-white/45">
                <Link href="/" className="transition-colors hover:text-white/80">Home</Link>
                <span>/</span>
                <span className="text-white/60">Team rankings</span>
              </div>
              <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#ff5a78' }}>Team rankings {YEAR}</p>
              <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">BEST SPORTS PROMO SCHEDULES OF {YEAR}</h1>
              <p className="mt-3 font-rd text-[11px] uppercase tracking-[0.12em] text-white/45">{lastUpdatedDisplay ? <>Last updated {lastUpdatedDisplay} · </> : null}{teamScores.length} teams ranked</p>
            </div>
          </section>

          <div className="mx-auto max-w-4xl px-6 pb-20 pt-10">
            <p className="rounded-2xl border border-rd-line bg-rd-card p-5 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
              All {teamScores.length} scored teams across MLB, MLS, and WNBA are ranked below by promo schedule strength
              {topTeam ? `, with ${teamDisplayName(topTeam.team)} leading at score ${topTeam.teamScore}` : ''}. Each ranking combines the team&apos;s average promo score, the number of highlighted promos, a schedule variety bonus, and a hot-promo bonus. Filter by league to compare within MLB, MLS, or WNBA only.
            </p>

            <Suspense fallback={null}>
              <ScoringPageViewTracker pageTitle="Team Rankings" scoreCount={teamScores.length} defaultLeague="All" />
            </Suspense>

            <div className="mt-8">
              {/* No Suspense wrapper here on purpose. TeamRankingsList owns its
                  own boundary around the null-rendering param reader, so a
                  boundary at this level would be redundant AND harmful: it
                  re-triggers a client-side render of the whole list after
                  hydration, leaving a duplicate hidden copy of every row in
                  the DOM. See known-issues entry 33. */}
              <TeamRankingsList teamScores={teamScores} topPromos={topPromos} variant="light" />
            </div>

            <section className="mt-16">
              <h2 className="rd-display mb-8 text-3xl uppercase text-rd-ink md:text-4xl">FREQUENTLY ASKED QUESTIONS</h2>
              <div className="max-w-3xl space-y-6">
                {FAQS.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-rd text-base font-semibold text-rd-ink">{f.question}</h3>
                    <p className="mt-1.5 font-rd text-sm leading-relaxed text-rd-ink-soft">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {Schemas}

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
            {lastUpdatedDisplay ? <>Last updated {lastUpdatedDisplay} · </> : null}{teamScores.length} teams
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

          <Suspense fallback={null}>
            <ScoringPageViewTracker
              pageTitle="Team Rankings"
              scoreCount={teamScores.length}
              defaultLeague="All"
            />
          </Suspense>

          <div className="mt-10">
            {/* No Suspense wrapper: see the note on the gate-on branch above. */}
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
