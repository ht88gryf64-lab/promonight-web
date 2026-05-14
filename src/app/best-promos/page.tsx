import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  getAllTeamScores,
  getScoredPromosInDateRange,
} from '@/lib/data';
import { BestPromosBrowser } from '@/components/scoring/best-promos-browser';
import { ScoredJsonLd } from '@/components/scoring/scored-jsonld';
import { ScoringPageViewTracker } from '@/components/scoring/scoring-page-view-tracker';

// Server-side fetch runs once per ISR revalidate window. The scoring
// pipeline writes weekly (Tuesday scan); daily revalidate is cheap
// insurance against any out-of-band rescore landing mid-week.
export const revalidate = 86400;

const PAGE_URL = 'https://www.getpromonight.com/best-promos';
const YEAR = new Date().getFullYear();
const SERVER_FETCH_CAP = 300;
const SERVER_FETCH_DAYS = 180;
const ITEMLIST_SCHEMA_CAP = 50;

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysYMD(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localYMD(d);
}

// Metadata interpolates four distinct variables (count, league set, year,
// top score) per the three-variable rule so the title and description
// can't collide with /best-promos/bobbleheads or /team-rankings.
export const metadata: Metadata = {
  title: `Best Sports Promo Nights of ${YEAR}: ${SERVER_FETCH_CAP} Top-Rated Giveaways`,
  description: `Score-ranked list of ${SERVER_FETCH_CAP} top promotional events across MLB, MLS, and WNBA in ${YEAR}. Bobbleheads, jerseys, and theme nights ranked 0 to 100 by attendance cap, item value, sponsor presence, and highlight tier. Top score 100. Updated weekly.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Best Sports Promo Nights of ${YEAR}`,
    description: `Score-ranked list of ${SERVER_FETCH_CAP} top promotional events across MLB, MLS, and WNBA. Updated weekly.`,
    url: PAGE_URL,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight — score-ranked sports promos',
      },
    ],
  },
};

const FAQS = [
  {
    question: 'How does PromoNight rank promos?',
    answer:
      'Every scored promo gets a 0 to 100 total built from five components: type (giveaway, theme, food, kids), item desirability (bobbleheads and jerseys outscore towels), attendance cap presence, highlight tier, and sponsor presence. The list above sorts by this total descending, with the soonest date as a tiebreaker.',
  },
  {
    question: 'What makes a promo score 100?',
    answer:
      'A 100 score requires a giveaway with a desirable collectible item (typically a bobblehead), a stated attendance cap, a highlighted status from the team, and a named sponsor. As of the most recent scan, two Washington Mystics bobblehead nights are tied at 100.',
  },
  {
    question: 'Why is my favorite team not at the top?',
    answer:
      'The list ranks by score, not team identity. A team running mostly food deals and theme nights will rank below teams with high-cap bobblehead programs. Filter by league above to see how teams in your league cluster, or visit the team page for the full schedule.',
  },
  {
    question: 'Why are NBA and NHL not included?',
    answer:
      'The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline that this ranking depends on. Those leagues will join in a future release.',
  },
  {
    question: 'How often does this list update?',
    answer:
      'The scoring pipeline runs every Tuesday at 15:00 UTC. Newly announced promos appear within a week. Team scores and per-promo scores can shift between scans as teams announce more events and the variety bonus adjusts.',
  },
  {
    question: 'What does the "Presented by" line on a card mean?',
    answer:
      'It names the sponsor underwriting the promo, typically a local business or national brand. A named sponsor adds 3 points to the total score because sponsorship correlates with a more produced fan-facing event.',
  },
  {
    question: 'Can I see only bobblehead nights?',
    answer:
      'Yes. Visit /best-promos/bobbleheads for the same ranking filtered to derivedSignals.itemType equal to "bobblehead". That page surfaces 204 bobblehead promos across the three scored leagues, with two WNBA 100s and an MLB cluster at 98 leading.',
  },
];

// Three question-based H2-with-answer blocks injected every 15 cards in
// the visible list. Self-contained answer capsules so AI bots can quote
// them without surrounding context.
const INLINE_ANSWERS = [
  {
    afterPosition: 14,
    question: 'What gives a promo a perfect 100 score?',
    answer:
      'The two bobbleheads tied at 100 share four signals: a stated attendance cap under 15,000, a named sponsor, highlighted status from the team, and a recognizable player likeness in the item type. Most MLB bobbleheads cluster at 98 because they hit three of the four.',
  },
  {
    afterPosition: 29,
    question: 'Which teams have the highest-rated promos?',
    answer:
      'Texas Rangers leads team-level scoring at 96, followed by Los Angeles Dodgers and Seattle Storm tied at 94. Team-level scores roll up average promo score, schedule variety, and highlight share across the entire team\'s season.',
  },
  {
    afterPosition: 44,
    question: 'How are bobbleheads and jerseys ranked?',
    answer:
      'Bobbleheads earn 30 points in the item-type component, jerseys earn 20, t-shirts earn 15, towels earn 10. Layering on a low attendance cap, a named sponsor, and a highlight tier pushes the total well above other giveaways.',
  },
];

export default async function BestPromosPage() {
  const now = new Date();
  const todayYMD = localYMD(now);
  const endYMD = addDaysYMD(now, SERVER_FETCH_DAYS);

  const [promos, teamScores] = await Promise.all([
    getScoredPromosInDateRange(todayYMD, endYMD, SERVER_FETCH_CAP),
    getAllTeamScores(),
  ]);

  // Latest computedAt across all teamScores is the canonical "last
  // scored" stamp for the page. Falls back to today if the collection is
  // empty for some reason (which it shouldn't be in production).
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

  return (
    <>
      <ScoredJsonLd
        url={PAGE_URL}
        title={`Best Sports Promo Nights of ${YEAR}`}
        description={`Score-ranked list of ${promos.length} top promotional events across MLB, MLS, and WNBA in ${YEAR}.`}
        lastUpdated={latestComputedAt || new Date().toISOString()}
        faqs={FAQS}
        itemListItems={promos.slice(0, ITEMLIST_SCHEMA_CAP)}
      />

      <div className="pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-text-secondary">Best promos</span>
          </div>

          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Best of {YEAR}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            BEST SPORTS PROMO NIGHTS OF {YEAR}
          </h1>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-3">
            Last updated {lastUpdatedDisplay} · {promos.length} promos ranked
          </p>
          <p className="mt-5 text-text-secondary text-base leading-relaxed max-w-3xl">
            The {promos.length} best-scored sports promo nights of {YEAR} are
            ranked below from 100 down. Every entry pulls from official MLB,
            MLS, and WNBA team-promotion announcements and is scored 0 to 100
            on attendance cap, item value, sponsor presence, and highlight
            tier. The list refreshes weekly with each Tuesday scan.
          </p>

          {/* useSearchParams inside both children requires a Suspense
              boundary during prerender; matches the layout-level pattern
              already in place for PageViewTracker. */}
          <Suspense fallback={null}>
            <ScoringPageViewTracker
              pageTitle="Best Sports Promo Nights"
              scoreCount={promos.length}
              defaultLeague="All"
              defaultRange="90d"
            />
          </Suspense>

          <div className="mt-10">
            <Suspense fallback={null}>
              <BestPromosBrowser
                initialPromos={promos}
                ticketsPlacement="best_promos_card"
                trackingSurface="best_promos"
                inlineAnswers={INLINE_ANSWERS}
              />
            </Suspense>
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
