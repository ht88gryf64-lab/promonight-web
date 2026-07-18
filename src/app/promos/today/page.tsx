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
import { TomorrowSection } from '@/components/promos-today/TomorrowSection';
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

      <main className="mx-auto max-w-5xl space-y-10 px-4 pb-16 pt-8 sm:px-6">
        {hasToday &&
          todayGroups.map((g) => (
            <TodayLeagueSection
              key={g.league}
              group={g}
              venueByTeam={venueByTeam}
              surface="web_today"
            />
          ))}

        <TomorrowSection
          dateLabel={formatBoardDate(tomorrowYMD)}
          groups={tomorrowGroups}
          venueByTeam={venueByTeam}
          hasPromos={hasTomorrow}
          // Dim tomorrow only when today carried promos (today stays the hero).
          // When today is empty, tomorrow is the primary content at full prominence.
          dimmed={hasToday}
          soonestDateLabel={soonestDateLabel}
        />

        {/* Cross-link to the 7-day view (Mockup A footer). */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-rd-line bg-rd-card p-5">
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
