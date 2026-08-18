import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  getAllTeamScores,
  getSchemaLocationsForTeams,
  getScoredPromosByItemType,
} from '@/lib/data';
import { BestPromosBrowser } from '@/components/scoring/best-promos-browser';
import { ScoredJsonLd } from '@/components/scoring/scored-jsonld';
import { ScoringPageViewTracker } from '@/components/scoring/scoring-page-view-tracker';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from '@/components/redesign/fonts-house';

export const revalidate = 86400;

const PAGE_URL = 'https://www.getpromonight.com/best-promos/bobbleheads';
// Season year is hardcoded deliberately (house SEO-copy rule: never
// getFullYear() in titles or descriptions); bump when next-season content
// is ready so the whole page flips at once.
const SEASON_YEAR = 2026;
const SERVER_FETCH_DAYS = 180;
const SERVER_FETCH_CAP = 500;
// The crawlable default view: the browser mounts with range '90d' and
// server-renders its first PAGE_SIZE (50) cards. ITEMLIST_SCHEMA_CAP and
// DEFAULT_VIEW_DAYS mirror those two values so the ItemList entries are
// exactly the server-rendered cards and every declared count matches the
// served DOM.
const ITEMLIST_SCHEMA_CAP = 50;
const DEFAULT_VIEW_DAYS = 90;

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysYMD(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localYMD(d);
}

// Distinct vs /best-promos via the item-type scope: the title names
// bobbleheads and leads with "Bobblehead Nights" (not "MLB Bobblehead
// Nights") because top scorers shift between leagues as scans land. The
// description states the ranking mechanics only; point-in-time facts
// (which teams lead, tie scores) belong in the live list, not in static
// metadata that ISR never recomputes.
export const metadata: Metadata = {
  title: `Best Bobblehead Nights of ${SEASON_YEAR}: Ranked by Score`,
  description: `Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked 0 to 100 by attendance cap, item value, sponsor presence, and highlight tier. MLB rescored weekly; WNBA and MLS in season.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Best Bobblehead Nights of ${SEASON_YEAR}`,
    description: `Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked by score. MLB rescored weekly; WNBA and MLS in season.`,
    url: PAGE_URL,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight: ranked bobblehead nights',
      },
    ],
  },
};

const FAQS = [
  {
    question: 'What are the highest-rated bobblehead giveaways?',
    answer:
      'The current leaders sit at the top of the ranked list on this page. The highest-rated bobblehead nights pair a stated attendance cap with a named sponsor and a highlighted-status flag from the team; entries missing one of those signals rank just behind.',
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
      'WNBA arenas seat 9,000 to 15,000 fans, so a bobblehead capped at 10,000 covers nearly every ticketed attendee. That near-universal availability combined with a named sponsor and a highlight tier is why WNBA bobbleheads can outscore programs at much larger venues.',
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

  // The ItemList mirrors the browser's server-rendered default view
  // (90-day window, first 50 cards): the schema declares exactly the
  // promos a crawler sees in the prerendered DOM.
  const defaultViewEndYMD = addDaysYMD(now, DEFAULT_VIEW_DAYS);
  const itemListPromos = promos
    .filter((p) => p.date <= defaultViewEndYMD)
    .slice(0, ITEMLIST_SCHEMA_CAP);
  const uniqueTeams = Array.from(
    new Map(itemListPromos.map((p) => [p.team.id, p.team])).values(),
  );
  const locationsByTeamId = await getSchemaLocationsForTeams(uniqueTeams);

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

  if (isRedesignEnabled()) {
    return (
      <>
        <ScoredJsonLd
          url={PAGE_URL}
          title={`Best Bobblehead Nights of ${SEASON_YEAR}`}
          description={`Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked by score.`}
          lastUpdated={latestComputedAt}
          faqs={FAQS}
          itemListItems={itemListPromos}
          locationsByTeamId={locationsByTeamId}
        />
        <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
          <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
            <div aria-hidden className="absolute inset-0 z-0 opacity-70" style={{ backgroundImage: 'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)' }} />
            <div className="relative z-10 mx-auto max-w-4xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
              <div className="mb-5 flex items-center gap-2 font-rd text-xs text-white/45">
                <Link href="/" className="transition-colors hover:text-white/80">Home</Link>
                <span>/</span>
                <Link href="/best-promos" className="transition-colors hover:text-white/80">Best promos</Link>
                <span>/</span>
                <span className="text-white/60">Bobbleheads</span>
              </div>
              <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#ff5a78' }}>Bobbleheads of {SEASON_YEAR}</p>
              <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">BEST BOBBLEHEAD NIGHTS OF {SEASON_YEAR}</h1>
              <p className="mt-3 font-rd text-[11px] uppercase tracking-[0.12em] text-white/45">{lastUpdatedDisplay ? <>Last updated {lastUpdatedDisplay} · </> : null}{promos.length} bobbleheads ranked</p>
            </div>
          </section>

          <div className="mx-auto max-w-4xl px-6 pb-20 pt-10">
            <p className="rounded-2xl border border-rd-line bg-rd-card p-5 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
              The {promos.length} top-scored bobblehead giveaways of {SEASON_YEAR} are ranked below across MLB, MLS, and WNBA. MLB clubs run the majority of bobblehead programs. Every listed event is scored on attendance cap, item value, sponsor presence, and highlight tier.
            </p>

            <Suspense fallback={null}>
              <ScoringPageViewTracker pageTitle="Best Bobblehead Nights" surface="web_best_promos_bobbleheads" scoreCount={promos.length} defaultLeague="All" defaultRange="90d" />
            </Suspense>

            <div className="mt-8">
              <BestPromosBrowser initialPromos={promos} serverTodayYMD={todayYMD} ticketsPlacement="best_promos_bobbleheads_card" trackingSurface="best_promos_bobbleheads" ticketsSurface="web_best_promos_bobbleheads" inlineAnswers={INLINE_ANSWERS} variant="light" />
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
      <ScoredJsonLd
        url={PAGE_URL}
        title={`Best Bobblehead Nights of ${SEASON_YEAR}`}
        description={`Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked by score.`}
        lastUpdated={latestComputedAt}
        faqs={FAQS}
        itemListItems={itemListPromos}
        locationsByTeamId={locationsByTeamId}
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
            Bobbleheads of {SEASON_YEAR}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            BEST BOBBLEHEAD NIGHTS OF {SEASON_YEAR}
          </h1>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-3">
            {lastUpdatedDisplay ? <>Last updated {lastUpdatedDisplay} · </> : null}{promos.length} bobbleheads
            ranked
          </p>
          <p className="mt-5 text-text-secondary text-base leading-relaxed max-w-3xl">
            The {promos.length} top-scored bobblehead giveaways of {SEASON_YEAR} are
            ranked below across MLB, MLS, and WNBA. MLB clubs run the
            majority of bobblehead programs. Every listed event is scored
            on attendance cap, item value, sponsor presence, and highlight
            tier.
          </p>

          <Suspense fallback={null}>
            <ScoringPageViewTracker
              pageTitle="Best Bobblehead Nights"
              surface="web_best_promos_bobbleheads"
              scoreCount={promos.length}
              defaultLeague="All"
              defaultRange="90d"
            />
          </Suspense>

          <div className="mt-10">
            <BestPromosBrowser
              initialPromos={promos}
              serverTodayYMD={todayYMD}
              ticketsPlacement="best_promos_bobbleheads_card"
              trackingSurface="best_promos_bobbleheads"
              ticketsSurface="web_best_promos_bobbleheads"
              inlineAnswers={INLINE_ANSWERS}
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
