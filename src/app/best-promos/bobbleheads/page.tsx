import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  getAllTeamScores,
  getScoredPromosByItemType,
} from '@/lib/data';
import { BestPromosBrowser } from '@/components/scoring/best-promos-browser';
import { ScoredJsonLd } from '@/components/scoring/scored-jsonld';
import { ScoringPageViewTracker } from '@/components/scoring/scoring-page-view-tracker';

export const revalidate = 86400;

const PAGE_URL = 'https://www.getpromonight.com/best-promos/bobbleheads';
const YEAR = new Date().getFullYear();
const SERVER_FETCH_DAYS = 180;
const SERVER_FETCH_CAP = 500;
const ITEMLIST_SCHEMA_CAP = 50;

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysYMD(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localYMD(d);
}

// Distinct interpolation set vs /best-promos: count is bobblehead-specific
// (~204 in the corpus), top-of-list is the WNBA Mystics duo at 100, item
// type is named in the title. Title leads with "Bobblehead Nights" (not
// "MLB Bobblehead Nights") because the top of the actual list is WNBA;
// MLB dominance is communicated by the list itself rather than the title.
export const metadata: Metadata = {
  title: `Best Bobblehead Nights of ${YEAR}: Ranked Player Figurine Giveaways`,
  description: `Every bobblehead giveaway across MLB, MLS, and WNBA in ${YEAR} ranked 0 to 100 by attendance cap and sponsor. Two Washington Mystics bobblehead nights tied at 100; MLB cluster at 98 follows. Updated weekly.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Best Bobblehead Nights of ${YEAR}`,
    description: `Every bobblehead giveaway across MLB, MLS, and WNBA in ${YEAR}, ranked by score. Updated weekly.`,
    url: PAGE_URL,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight — ranked bobblehead nights',
      },
    ],
  },
};

const FAQS = [
  {
    question: 'What are the highest-rated bobblehead giveaways?',
    answer:
      'Two Washington Mystics bobblehead nights are tied at the top score of 100: the Kiki Iriafen Bobblehead and a second Mystics Bobblehead Giveaway. Both pair a stated attendance cap with a named sponsor and a highlighted-status flag from the team. MLB bobbleheads cluster just behind at 98, led by Arizona Diamondbacks, Atlanta Braves, and Chicago Cubs programs.',
  },
  {
    question: 'Which MLB team gives away the most bobbleheads?',
    answer:
      'MLB clubs run the largest bobblehead programs. The Diamondbacks, Cubs, and Braves consistently lead in announced bobblehead nights per season. Counts shift as teams announce more promos through the year; the live list above sorts by score so the best-rated entries from any team surface first.',
  },
  {
    question: 'When do bobblehead giveaways usually happen?',
    answer:
      'Most MLB bobblehead nights run on weekend home games, especially Saturday evenings and Sunday afternoons. Teams schedule them to drive attendance for series that are not already sellouts. WNBA bobbleheads cluster around marquee dates and rivalry games during the regular season.',
  },
  {
    question: 'Are bobbleheads still given away if you arrive late?',
    answer:
      'Usually no. Bobbleheads are handed out at the stadium gates until the listed quantity runs out, typically the first 10,000 to 25,000 ticketed fans through the entrances. Some teams reserve a small allocation at guest services for fans with specific ticket packages, but the open giveaway runs out fast.',
  },
  {
    question: 'How many bobbleheads does each team give away?',
    answer:
      'Quantities vary by team and event, recorded in the attendance cap field on each card above. MLB programs typically distribute 15,000 to 25,000 bobbleheads per game. WNBA bobbleheads sit around 8,000 to 12,000 to match smaller venue capacities.',
  },
  {
    question: 'Do bobbleheads have to be claimed at the gate?',
    answer:
      'Almost always yes. Bobbleheads are handed out at the stadium entrance to ticketed fans on arrival. A handful of teams will reserve some for redemption at guest services for fans with specific ticket packages; the team promo page lists those exceptions when they exist.',
  },
];

const INLINE_ANSWERS = [
  {
    afterPosition: 14,
    question: 'Why do WNBA bobbleheads score so high?',
    answer:
      'WNBA arenas seat 9,000 to 15,000 fans, so a bobblehead capped at 10,000 covers nearly every ticketed attendee. That near-universal availability combined with a named sponsor and a highlight tier puts both Washington Mystics bobbleheads at 100, ahead of the MLB cluster tied at 98.',
  },
  {
    afterPosition: 29,
    question: 'What separates a 98 score from a 100?',
    answer:
      'Most 98-score bobbleheads miss the sponsor signal. They have attendance caps, recognizable player likenesses, and highlight tiers, but no named "Presented by" partner. Adding a sponsor adds 3 points to the total, which is the difference between the 98 cluster and the 100 leaders.',
  },
  {
    afterPosition: 44,
    question: 'How are recurring bobbleheads tracked?',
    answer:
      'Each calendar date with a bobblehead is one row above. A team that runs three bobblehead nights across the season shows three rows, each scored independently. The team-rankings page rolls those individual scores into a single average via the averagePromoScore field.',
  },
];

export default async function BobbleheadsPage() {
  const now = new Date();
  const todayYMD = localYMD(now);
  const endYMD = addDaysYMD(now, SERVER_FETCH_DAYS);

  const [promos, teamScores] = await Promise.all([
    getScoredPromosByItemType(todayYMD, endYMD, 'bobblehead', SERVER_FETCH_CAP),
    getAllTeamScores(),
  ]);

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
        title={`Best Bobblehead Nights of ${YEAR}`}
        description={`Every bobblehead giveaway across MLB, MLS, and WNBA in ${YEAR}, ranked by score.`}
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
            <Link
              href="/best-promos"
              className="hover:text-white transition-colors"
            >
              Best promos
            </Link>
            <span>/</span>
            <span className="text-text-secondary">Bobbleheads</span>
          </div>

          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Bobbleheads of {YEAR}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            BEST BOBBLEHEAD NIGHTS OF {YEAR}
          </h1>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-3">
            Last updated {lastUpdatedDisplay} · {promos.length} bobbleheads
            ranked
          </p>
          <p className="mt-5 text-text-secondary text-base leading-relaxed max-w-3xl">
            The {promos.length} top-scored bobblehead giveaways of {YEAR} are
            ranked below across MLB, MLS, and WNBA. MLB clubs run the
            majority of bobblehead programs, but the two highest-scoring
            entries are Washington Mystics bobblehead nights tied at 100.
            Every listed event is scored on attendance cap, item value,
            sponsor presence, and highlight tier.
          </p>

          <Suspense fallback={null}>
            <ScoringPageViewTracker
              pageTitle="Best Bobblehead Nights"
              scoreCount={promos.length}
              defaultLeague="All"
              defaultRange="90d"
            />
          </Suspense>

          <div className="mt-10">
            <Suspense fallback={null}>
              <BestPromosBrowser
                initialPromos={promos}
                ticketsPlacement="best_promos_bobbleheads_card"
                trackingSurface="best_promos_bobbleheads"
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
