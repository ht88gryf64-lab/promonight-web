import type { Metadata } from 'next';
import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { pageOpenGraph } from '@/lib/og';
import {
  getTodayPromos,
  getTomorrowPromos,
  getPromosFromDate,
  getVenueForTeam,
  promoBoardChicagoYMD,
} from '@/lib/data';
import type { Venue } from '@/lib/types';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { AggregatorJsonLd, type AggregatorGroup } from '@/components/aggregator-layout';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { DailyBoardHero } from '@/components/promos-today/DailyBoardHero';
import { TodayLeagueSection } from '@/components/promos-today/TodayLeagueSection';
import { TodayBoardFilter } from '@/components/promos-today/TodayBoardFilter';
import { LeagueDayEmpty } from '@/components/promos-today/LeagueDayEmpty';
import {
  groupPromosByLeague,
  buildAnswerSentence,
  formatBoardDate,
} from '@/components/promos-today/helpers';

// 1h ISR keeps the page cached + cheap; the daily post-midnight cron
// (/api/cron/indexnow-daily) revalidates + warms this path so the rendered date
// is regenerated the moment the Chicago day rolls over and is never stale.
export const revalidate = 3600;

const PAGE_URL = 'https://www.getpromonight.com/promos/today';
const TITLE = 'Sports Promos Today';
const DESCRIPTION =
  'Every sports promotional giveaway happening today across MLB, WNBA, MLS, and the pro leagues in season. Bobblehead nights, theme nights, and giveaways with tickets and parking, updated daily.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: pageOpenGraph('/promos/today'),
};

export default async function PromosTodayPage() {
  const todayYMD = promoBoardChicagoYMD(0);
  const tomorrowYMD = promoBoardChicagoYMD(1);

  const [today, tomorrow] = await Promise.all([getTodayPromos(), getTomorrowPromos()]);

  const hasToday = today.length > 0;
  const hasTomorrow = tomorrow.length > 0;

  // Venues for today + tomorrow (eyebrow name + SpotHero coords). Distinct teams
  // only; ISR-cached so the handful of reads are amortized across the hour.
  const distinctTeamIds = [...new Set([...today, ...tomorrow].map((p) => p.team.id))];
  const venueEntries = await Promise.all(
    distinctTeamIds.map(async (id) => [id, await getVenueForTeam(id)] as const),
  );
  const venueByTeam = new Map<string, Venue | null>(venueEntries);

  const todayGroups = groupPromosByLeague(today);
  const tomorrowGroups = groupPromosByLeague(tomorrow);
  const todayByLeague = new Map(todayGroups.map((g) => [g.league, g]));
  const tomorrowByLeague = new Map(tomorrowGroups.map((g) => [g.league, g]));

  // Filter pill set: the UNION of today's and tomorrow's leagues, deduped and in
  // registry order. Derived by re-grouping the already-fetched promos (no extra
  // query). Season-aware by construction: a league appears the moment one of its
  // promos is dated today or tomorrow, with no code change.
  const filterLeagues = groupPromosByLeague([...today, ...tomorrow]).map((g) => ({
    league: g.league,
    label: g.label,
    accent: g.accent,
  }));

  // Soonest upcoming date strictly after tomorrow — only needed for the pointer
  // line when tomorrow is also empty, so it is fetched lazily.
  let soonestDateLabel: string | null = null;
  if (!hasTomorrow) {
    const upcoming = await getPromosFromDate(todayYMD);
    const soonest = upcoming.find((p) => p.date > tomorrowYMD) ?? null;
    soonestDateLabel = soonest ? formatBoardDate(soonest.date) : null;
  }

  const answer = hasToday
    ? buildAnswerSentence(today)
    : hasTomorrow
      ? "No sports promotional giveaways today. Here is what is on tomorrow."
      : soonestDateLabel
        ? `No sports promotional giveaways today or tomorrow. The next one is ${soonestDateLabel}.`
        : 'No sports promotional giveaways scheduled right now. Check back as teams add dates.';

  // JSON-LD ItemList: today's promos, or tomorrow's when today is empty, so the
  // list is never empty. dateModified = today (Chicago), advancing on each daily
  // regeneration.
  const jsonLdGroups: AggregatorGroup[] = [
    { label: 'Sports promos today', promos: hasToday ? today : tomorrow },
  ];

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <AggregatorJsonLd
        url={PAGE_URL}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={todayYMD}
        faqs={[]}
        groups={jsonLdGroups}
      />

      <DailyBoardHero dateLabel={formatBoardDate(todayYMD)} answer={answer} />

      <div className="mx-auto max-w-5xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="promo_collection" />
      </div>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        {filterLeagues.length === 0 ? (
          // Both days empty. The hero already answers honestly; keep the page
          // useful with a pointer to the soonest date + the 7-day view.
          <p className="font-rd text-[14px] leading-relaxed text-rd-ink-soft">
            {soonestDateLabel
              ? `No promos scheduled today or tomorrow. Next up: ${soonestDateLabel}. `
              : 'No promos scheduled right now. '}
            <Link href="/promos/this-week" className="font-semibold text-rd-red hover:underline">
              See the full week &rarr;
            </Link>
          </p>
        ) : (
          <TodayBoardFilter leagues={filterLeagues} surface="web_today">
            {/* TODAY — one wrapper per pill-set league: its cards, or a "no
                [league] promos today" placeholder (hidden until that league is
                filtered) so filtering never yields a blank day. */}
            {filterLeagues.map((L) => {
              const g = todayByLeague.get(L.league);
              return g ? (
                <div key={`t-${L.league}`} data-filter-league={L.league} data-filter-empty="false">
                  <TodayLeagueSection group={g} venueByTeam={venueByTeam} surface="web_today" />
                </div>
              ) : (
                <div
                  key={`t-${L.league}`}
                  data-filter-league={L.league}
                  data-filter-empty="true"
                  className="hidden"
                >
                  <LeagueDayEmpty label={L.label} accent={L.accent} day="today" />
                </div>
              );
            })}

            {/* TOMORROW — same per-league treatment, dimmed when today has promos
                (today stays the hero); full prominence when today is empty. */}
            <section className="border-t border-rd-line pt-8">
              <div className="mb-1 font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
                Tomorrow
              </div>
              <h2 className="rd-display text-xl text-rd-ink md:text-2xl">
                {formatBoardDate(tomorrowYMD)}
              </h2>
              <div className="mt-5 flex flex-col gap-8">
                {filterLeagues.map((L) => {
                  const g = tomorrowByLeague.get(L.league);
                  return g ? (
                    <div key={`m-${L.league}`} data-filter-league={L.league} data-filter-empty="false">
                      <TodayLeagueSection
                        group={g}
                        venueByTeam={venueByTeam}
                        surface="web_today"
                        dimmed={hasToday}
                      />
                    </div>
                  ) : (
                    <div
                      key={`m-${L.league}`}
                      data-filter-league={L.league}
                      data-filter-empty="true"
                      className="hidden"
                    >
                      <LeagueDayEmpty label={L.label} accent={L.accent} day="tomorrow" />
                    </div>
                  );
                })}
                {!hasTomorrow && (
                  <p
                    data-filter-pointer
                    className="font-rd text-[14px] leading-relaxed text-rd-ink-soft"
                  >
                    {soonestDateLabel
                      ? `No promos scheduled tomorrow. Next up: ${soonestDateLabel}. `
                      : 'No promos scheduled tomorrow. '}
                    <Link href="/promos/this-week" className="font-semibold text-rd-red hover:underline">
                      See the full week &rarr;
                    </Link>
                  </p>
                )}
              </div>
            </section>
          </TodayBoardFilter>
        )}

        {/* Cross-link to the 7-day view (Mockup A footer). */}
        <div className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-rd-line bg-rd-card p-5">
          <div>
            <div className="rd-display text-lg text-rd-ink">Planning ahead?</div>
            <p className="font-rd text-[13px] text-rd-ink-soft">
              See every promo coming in the next 7 days.
            </p>
          </div>
          <Link
            href="/promos/this-week"
            className="inline-flex shrink-0 items-center gap-1 font-rd text-sm font-bold text-rd-red hover:underline"
          >
            This Week
            <IconArrowRight size={15} stroke={2} />
          </Link>
        </div>
      </main>
    </div>
  );
}
