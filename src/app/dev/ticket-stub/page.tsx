import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllTeams, getPromoCount, getPromosFromDate } from '@/lib/data';
import type { PromoWithTeam } from '@/lib/types';
import { relLuminance } from '@/lib/chip-contrast';
import { pickHeroBuckets } from '@/components/tonight-strip';
import { pickBestStubPromos } from '@/components/redesign/pick-best-stub-promos';
import { HomeHero } from '@/components/redesign/HomeHero';
import { buildHomeCategoryTiles } from '@/components/redesign/home-category-tiles';
import { HomeCategoryGrid } from '@/components/redesign/HomeCategoryGrid';
import { deriveLeagueOrder } from '@/components/redesign/derive-league-order';
import { GamedayUtilityGrid } from '@/components/redesign/GamedayUtilityGrid';
import { AppDownloadBlock } from '@/components/redesign/AppDownloadBlock';
import { FollowCTA } from '@/components/follow/FollowCTA';
import { FounderBlock } from '@/components/redesign/FounderBlock';
import { getVenueUtilityCounts } from '@/lib/venue-hub';
import { TeamGrid } from '@/components/team-grid';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { TicketStubPreview } from './preview-client';

// Dev-only preview of the ticket-stub promo card at real data density.
// Gates on VERCEL_ENV (not NODE_ENV, unlike dev/ad-slots): Vercel preview
// deployments build with NODE_ENV=production, and this page exists precisely
// to be reviewed on a preview URL. Production serves 404.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const revalidate = 0;

function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Curate a review set from live data, deterministically: two promos per type
// (longest titles first, one team each), plus the darkest- and lightest-color
// teams in the future corpus, plus a guaranteed HOT promo. No hardcoded teams.
function curate(all: PromoWithTeam[]): PromoWithTeam[] {
  const picked: PromoWithTeam[] = [];
  const usedTeams = new Set<string>();
  const key = (p: PromoWithTeam) => `${p.team.id}::${p.date}::${p.title}`;
  const usedKeys = new Set<string>();
  const add = (p: PromoWithTeam | undefined) => {
    if (!p || usedKeys.has(key(p))) return;
    usedKeys.add(key(p));
    usedTeams.add(p.team.id);
    picked.push(p);
  };

  for (const type of ['giveaway', 'theme', 'food', 'kids'] as const) {
    const pool = all
      .filter((p) => p.type === type)
      .sort((a, b) => b.title.length - a.title.length);
    add(pool.find((p) => !usedTeams.has(p.team.id)));
    add(pool.find((p) => !usedKeys.has(key(p)) && !usedTeams.has(p.team.id)));
  }

  const byLum = [...all].sort(
    (a, b) => relLuminance(a.team.primaryColor ?? '#000000') - relLuminance(b.team.primaryColor ?? '#000000'),
  );
  add(byLum[0]);
  add(byLum[byLum.length - 1]);
  if (!picked.some((p) => p.highlight)) add(all.find((p) => p.highlight));

  return picked.sort((a, b) => a.date.localeCompare(b.date));
}

export default async function TicketStubPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  const todayYMD = chicagoTodayYMD();
  const [allFuture, allTeams, promoCount, venueCounts] = await Promise.all([
    getPromosFromDate(todayYMD),
    getAllTeams(),
    getPromoCount(),
    getVenueUtilityCounts(),
  ]);
  const promos = curate(allFuture);
  // Real tonight bucket via the exact picker the homepage uses; allFuture is
  // a superset of the homepage's 14-day window and the picker only matches
  // dates inside its own sets, so no new query pattern is introduced.
  const tonight = pickHeroBuckets(allFuture, todayYMD).tonight;
  // Server-side pick so only the top N serialize to the client.
  const best = pickBestStubPromos(allFuture, 8);

  // Hero numbers, every one derived (the league-agnostic standing constraint):
  // teams from the teams collection, leagues from the distinct league values
  // on those teams (CFB is a separate stream, matching the existing teamCount
  // convention), corpus count from getPromoCount. Fourth stat: verified venue
  // guides — season-stable (venue logistics do not expire with a season), so
  // the stats row never shows a zero in a winter corpus. Final stat choice
  // stays a wiring decision; this exercises the slot with the December-proof
  // pick.
  const leagueCount = new Set(allTeams.map((t) => t.league)).size;

  // League NAMES for the founder prose, ordered by how many teams each league
  // contributes (alphabetical tiebreak). Derived, so no hardcoded league list
  // decides the sentence, and season-stable because teams do not leave a
  // league in the offseason.
  const teamsPerLeague = new Map<string, number>();
  for (const t of allTeams) teamsPerLeague.set(t.league, (teamsPerLeague.get(t.league) ?? 0) + 1);
  const leagueNames = [...teamsPerLeague.keys()].sort(
    (a, b) => (teamsPerLeague.get(b) ?? 0) - (teamsPerLeague.get(a) ?? 0) || a.localeCompare(b),
  );

  // Team finder inputs: derived tab order plus a minimal replica of the
  // homepage's rankTeamsByFuturePromos (count upcoming promos per team, sort
  // descending) — enough for the preview to show real ordering and counts.
  const leagueOrder = deriveLeagueOrder(allFuture);
  const teamPromoCounts: Record<string, number> = {};
  for (const t of allTeams) teamPromoCounts[t.id] = 0;
  for (const p of allFuture) {
    if (teamPromoCounts[p.team.id] !== undefined) teamPromoCounts[p.team.id]++;
  }
  const teamsForGrid = [...allTeams].sort(
    (a, b) => (teamPromoCounts[b.id] ?? 0) - (teamPromoCounts[a.id] ?? 0),
  );
  const heroStats = [
    { value: promoCount.toLocaleString(), label: 'Promos tracked' },
    { value: String(allTeams.length), label: 'Teams' },
    { value: String(leagueCount), label: 'Leagues' },
    { value: String(venueCounts.verifiedTotal), label: 'Venue guides' },
  ];

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen bg-rd-cream`}>
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
          HERO · replaces the inline hero at RedesignHomePage.tsx:104-167 · tonight cards move to
          the rail below · no clock stamp (entry 21) · all numbers derived
        </p>
      </div>
      <HomeHero teamCount={allTeams.length} leagueCount={leagueCount} stats={heroStats} />
      <TicketStubPreview promos={promos} tonight={tonight} best={best} />

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            CATEGORY GRID · 7 tiles, one per real aggregator route · counts mirror each
            destination&apos;s own filter · zero-count tiles drop, all-zero hides the section
          </p>
          <HomeCategoryGrid tiles={buildHomeCategoryTiles(allFuture, todayYMD)} />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            TEAM FINDER · existing TeamGrid (light), one additive prop: leagueOrder derived from
            upcoming inventory instead of the fixed LEAGUE_ORDER · derived order today:{' '}
            {leagueOrder.join(' ')}
          </p>
          <div className="mb-4">
            <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
              Find Your Team
            </h2>
            <p className="mt-2 max-w-md font-rd text-sm text-rd-ink-soft">
              Full promo calendars for all {allTeams.length} teams.
            </p>
          </div>
          <TeamGrid
            teams={teamsForGrid}
            promoCounts={teamPromoCounts}
            limitOnAll={12}
            countLabel="upcoming"
            surface="homepage"
            variant="light"
            leagueOrder={leagueOrder}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            GAMEDAY UTILITY GRID · 4 cards mirroring the venue-hub render gates · counts derived
            from Firestore each render · internal links to /venues only (per-topic anchors do not
            exist; per-league anchors would break league-agnosticism) · season-independent
          </p>
          <GamedayUtilityGrid counts={venueCounts} />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            APP BLOCK · real App Store review as visual content only · NO Review,
            AggregateRating, or SoftwareApplication schema · store links reuse
            AppDownloadButtons unchanged (section=homepage_app_block)
          </p>
          <AppDownloadBlock />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            NEWSLETTER · existing FollowCTA, one additive presentation prop (layout=split) · no
            form: the design target has no input element anywhere, so FollowForm and
            TeamStarPicker stay out of scope · same destination, same single event
          </p>
          <FollowCTA surface="web_homepage" layout="split" />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-rd-line-strong p-6">
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
            FOUNDER · new light-only component, IndieDeveloperBlock untouched so the dark path
            stays byte-stable · larger tilted portrait · byline plus /about link · NO Person
            schema (that stays on /about) · team and league facts derived: {leagueNames.join(' ')}
          </p>
          <FounderBlock teamCount={allTeams.length} leagues={leagueNames} />
        </div>
      </div>
    </div>
  );
}
