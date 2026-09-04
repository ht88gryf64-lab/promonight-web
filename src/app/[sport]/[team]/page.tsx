import { OG_IMAGE_ALT } from '@/lib/og';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllTeams,
  getTeamBySlug,
  getTeamPromos,
  getVenueForTeam,
  getPlayoffConfig,
  getPlayoffPromosForTeam,
  getGamesForTeam,
  enrichGamesForTeam,
  getStillAlivePlayoffTeamIds,
} from '@/lib/data';
import type { Promo, PromoType } from '@/lib/types';
import { TeamHero } from '@/components/team-hero';
import { TeamCalendar } from '@/components/team-calendar';
import { ScheduleReleaseVideoCard } from '@/components/ScheduleReleaseVideoCard';
import { PromoList } from '@/components/promo-list';
import { RecurringDealsSection } from '@/components/recurring-deals-section';
import { getRecurringDealsForTeam } from '@/lib/recurring-deals';
import { ZeroPromoFallback } from '@/components/zero-promo-fallback';
import { VenueInfoBlock } from '@/components/venue-info-block';
import { AuthorityStats } from '@/components/authority-stats';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { TeamRelatedAggregators } from '@/components/team-related-aggregators';
import { JsonLd } from '@/components/json-ld';
import { PlayoffSection } from '@/components/playoff-section';
import { countPromosByType, extractPlayoffOpponent, isTicketMechanicRow, isUpcomingPromo, splitPromosByDate, teamDisplayName } from '@/lib/promo-helpers';
import { TeamPageTracker } from '@/components/analytics-events';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { ExpediaCTA } from '@/components/affiliates/ExpediaCTA';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { isRedesignEnabled } from '@/lib/redesign';
import { isTitleTreatmentTeam, teamBareTitle } from '@/lib/title-treatment';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
import { isSeasonScopeLive, resolveClaimMode } from '@/lib/season-scope';
import { RedesignTeamPage } from '@/components/redesign/RedesignTeamPage';

export const revalidate = 86400;

export async function generateStaticParams() {
  const teams = await getAllTeams();
  return teams.map((t) => ({
    sport: t.sportSlug,
    team: t.id,
  }));
}

// Trim a string back to the last word boundary at or before `max` so a long
// {team}+{venue} description never cuts a word in half when it overflows the
// meta-description budget. Returns the string unchanged when it already fits.
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string; team: string }>;
}): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) return {};

  const [venue, promos] = await Promise.all([
    getVenueForTeam(team.id),
    getTeamPromos(team.id),
  ]);

  // Hardcoded, NOT new Date().getFullYear(): an auto-rolling year would flip
  // every title to "...2027" at midnight on Jan 1 — before the 2027 promo data
  // exists and before the season starts — misleading users and search engines.
  // Bumping the season year is a deliberate edit made when 2027 content is ready.
  const year = 2026;
  const displayName = teamDisplayName(team);

  // The root layout's title.template ("%s | PromoNight") appends the brand to
  // every string title, so this bare value renders as
  // `${displayName} Promos & Giveaways ${year} | PromoNight`, the 60-char SEO
  // target. Do NOT add "| PromoNight" here or it doubles.
  //
  // The string itself now comes from src/lib/title-treatment.ts, the single
  // flip point for the ctr-diagnostic-sep2026 experiment: ten MLB teams render
  // "{Display Name} Giveaways & Theme Nights 2026" instead, everything else is
  // byte-identical to the line this replaced. Four of the ten treatment titles
  // knowingly exceed 60 rendered characters; see the length note in that file.
  const title = teamBareTitle(team, displayName);

  // OG/Twitter titles are NOT processed by the layout title.template, so spell
  // the "| PromoNight" suffix out here to match the rendered <title> byte-for-
  // byte and keep the brand on shared social cards.
  const socialTitle = `${title} | PromoNight`;

  // Meta description: front-load the next upcoming promos so the Google
  // snippet stays fresh on every ISR revalidation. Built from getTeamPromos
  // (date-ascending). Capped at 160 chars to fit Google's snippet width; the
  // "See the full schedule" closer
  // is appended only when it fits, and a promo is dropped rather than cut
  // mid-title (two clean names beat three with the third truncated). `year`
  // stays hardcoded (never getFullYear()) — same rationale as the title above.
  // Falls back to an evergreen sentence when there are no upcoming promos (or,
  // defensively, when not even the first promo fits the budget).
  const DESC_MAX = 160;
  const todayStr = new Date().toISOString().split('T')[0];
  // The snippet is the ONE surface the ctr-diagnostic-sep2026 read measures
  // directly, and the rows this filter removes are all on los-angeles-dodgers,
  // which is in the treatment arm. So the exclusion rides the same league gate
  // as everything else in this change: MLB snippets do not move until the read
  // date. Without this the meta description of the highest-impression page on
  // the site would change mid-experiment.
  const scopeLive = isSeasonScopeLive(team.league, todayStr);
  const keepForDesc = (p: Promo) => (scopeLive ? !isTicketMechanicRow(p) : true);
  const monthDay = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

  // League-aware freshness tail: only MLB, WNBA, MLS and NHL have a weekly
  // scan cron (seasonal for the latter three; NHL joined 2026-09-02 with the
  // hub enable), so only they may claim a recheck cadence. NBA and NFL state
  // provenance instead.
  const freshnessTail = ['MLB', 'WNBA', 'MLS', 'NHL'].includes(team.league)
    ? 'Rechecked weekly in season.'
    : 'From official team announcements.';
  const fallbackDescription = venue
    ? `${displayName} ${year} promotional schedule - bobbleheads, giveaways, theme nights, and food deals at ${venue.name}. ${freshnessTail}`
    : `${displayName} ${year} promotional schedule - bobbleheads, giveaways, theme nights, and food deals. ${freshnessTail}`;

  // CTR diagnostic (ctr-diagnostic-sep2026, see src/lib/title-treatment.ts).
  // A treatment title promises "Theme Nights", so the snippet under it has to
  // deliver one: the next DATED upcoming theme night is named ahead of the
  // aggregate promo list. Read live from the promo array on every ISR
  // revalidation, so there is no hardcoded promo name and no freshness claim
  // that is not backed by a real promo date. Null for every control team, and
  // null for a treatment team with no upcoming theme night, in which case the
  // description below stays byte-identical to control. The explicit string
  // test on `date` keeps the dateless recurring-deal rows out: a promo with no
  // date cannot be named as "next".
  const nextThemeNight = isTitleTreatmentTeam(team)
    ? promos
        .filter(
          (p) =>
            p.type === 'theme' &&
            typeof p.date === 'string' &&
            p.date !== '' &&
            // "Early Entry" is typed `theme`, so without this the snippet under a
            // title promising THEME NIGHTS could read "Next theme night: Early
            // Entry", which promises an event and delivers a door time.
            keepForDesc(p) &&
            isUpcomingPromo(p, todayStr),
        )
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    : null;

  const upcomingForDesc = promos
    .filter((p) => isUpcomingPromo(p, todayStr))
    // Ticket mechanics are dropped from the SNIPPET only; they stay in the
    // on-page list and in every count. See TICKET_MECHANIC_TITLES.
    .filter(keepForDesc)
    .sort((a, b) => a.date.localeCompare(b.date))
    // The named theme night is dropped from the list it leads, so the same
    // promo is never printed twice in one 160-char snippet. Reference
    // identity, not a date/title match: nextThemeNight came out of this very
    // array. No-op when nextThemeNight is null, which is every control team.
    .filter((p) => p !== nextThemeNight)
    .slice(0, 3);

  const closer = ` See the full ${year} schedule at PromoNight.`;
  // Same rule as the promo entries below: an item that cannot fit the budget
  // whole is dropped, never truncated mid-title.
  const rawLead = nextThemeNight
    ? `Next ${displayName} theme night: ${nextThemeNight.title} on ${monthDay(nextThemeNight.date)}.`
    : '';
  const lead = rawLead.length <= DESC_MAX ? rawLead : '';

  let rawDescription = fallbackDescription;
  // A real dated theme night beats the evergreen fallback sentence even when
  // no promo list survives the budget, so seed the description with the lead
  // before the list is attempted rather than losing it to the fallback.
  if (lead) {
    rawDescription =
      (lead + closer).length <= DESC_MAX ? lead + closer : lead;
  }
  if (upcomingForDesc.length > 0) {
    const prefix = lead
      ? `${lead} More upcoming promos: `
      : `Upcoming ${displayName} promos: `;
    const fits: string[] = [];
    let len = prefix.length;
    for (const p of upcomingForDesc) {
      const entry = `${monthDay(p.date)} - ${p.title}`;
      const sep = fits.length === 0 ? '' : ', ';
      // +1 reserves the period that closes the promo list; a promo that would
      // push past DESC_MAX is dropped, not truncated mid-title.
      if (len + sep.length + entry.length + 1 > DESC_MAX) break;
      fits.push(entry);
      len += sep.length + entry.length;
    }
    if (fits.length > 0) {
      const listBody = `${prefix}${fits.join(', ')}.`;
      rawDescription =
        (listBody + closer).length <= DESC_MAX ? listBody + closer : listBody;
    }
  }
  const description = truncateAtWord(rawDescription, DESC_MAX);

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.getpromonight.com/${team.sportSlug}/${team.id}`,
    },
    openGraph: {
      title: socialTitle,
      description,
      siteName: 'PromoNight',
      url: `https://www.getpromonight.com/${team.sportSlug}/${team.id}`,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: OG_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@promo_night_app',
      creator: '@promo_night_app',
      title: socialTitle,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ sport: string; team: string }>;
}) {
  const { sport, team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);

  if (!team || team.sportSlug !== sport) {
    notFound();
  }

  // TEMPORARY: skip playoff config lookup entirely for MLB teams. MLB
  // playoffs are not yet supported by the scanner pipeline, so there is
  // nothing for them in appConfig/playoffs — saves one Firestore read
  // per MLB team-page revalidation. Remove this guard when MLB joins.
  const shouldCheckPlayoffs = team.league !== 'MLB';

  // getCoverageCounts joins the existing parallel fetch purely to derive the
  // team count and league list that reach the FAQ answers and their FAQPage
  // schema. Issued alongside the reads already in flight, so it adds no
  // latency. It replaces hardcoded literals that had already gone stale.
  const [promos, venue, playoffConfig, coverage] = await Promise.all([
    getTeamPromos(team.id),
    getVenueForTeam(team.id),
    shouldCheckPlayoffs ? getPlayoffConfig() : Promise.resolve(null),
    getCoverageCounts(),
  ]);

  const inPlayoffs =
    !!playoffConfig?.playoffsActive &&
    getStillAlivePlayoffTeamIds(playoffConfig).includes(team.id);
  const playoffPromos = inPlayoffs
    ? await getPlayoffPromosForTeam(team.id)
    : [];
  const playoffRound = inPlayoffs
    ? team.league === 'NBA'
      ? playoffConfig!.nbaRound
      : team.league === 'NHL'
        ? playoffConfig!.nhlRound
        : ''
    : '';

  const playoffContext = inPlayoffs && playoffPromos.length > 0
    ? {
        promos: playoffPromos,
        round: playoffRound,
        opponent: extractPlayoffOpponent(playoffPromos),
      }
    : undefined;

  // ── The one derivation. Two populations, one split, one counting function ──
  //
  // upcomingCounts is the CLAIM CURRENCY. It feeds the hero stat row, the FAQ
  // generator (and therefore the FAQPage schema), the SEO content sections, the
  // category chips, and the zero-state routing gate. A number in any of those
  // places asserts something to a reader or a crawler, and may only describe
  // promos a visitor can still attend.
  //
  // There is deliberately NO allTimeCounts variable here. The only surface that
  // describes the archive is the COMPLETED heading inside PromoList, which
  // derives its own count from the same split applied to the array it already
  // receives. Computing a second archive total at this level would create a
  // number with no consumer, sitting one prop-drill away from any claim surface
  // a future change might wire it into. That is how the original bug happened.
  //
  // Before this, every count on the page was all-time while the promo list alone
  // filtered by date, so 137 of 144 populated pages advertised a number the list
  // directly beneath it contradicted.
  const { upcoming: upcomingPromos } = splitPromosByDate(promos);
  const upcomingCounts = countPromosByType(upcomingPromos);

  // ── The second derivation, and the reason the paragraph above is now wrong ──
  //
  // The note above was written when every count on the page had to be upcoming,
  // and it was right about the bug it closed. It was wrong about the rule. The
  // rule is LABEL MATCHES POPULATION (see promo-helpers.ts), and the narrow
  // version of it produced the mirror defect: upcoming-only counts published
  // under the words "the 2026 season" on 142 of 169 pages, so on 2026-09-04 this
  // page said 19 where the season held 98.
  //
  // seasonScope is therefore a SECOND population, deliberately, and it is null
  // whenever the rows cannot support a season claim (multi-year archive, wrong
  // year, MLB before the rollout date). Consumers take one or the other and
  // print the matching noun; nobody may print a number from one under the
  // other's label.
  //
  // upcomingCounts is NOT retired. It still drives the layout gates in
  // RedesignTeamPage, which are not claims and must not move.
  const claimMode = resolveClaimMode(promos, team.league);

  const displayName = teamDisplayName(team);
  const recurringDeals = await getRecurringDealsForTeam(team.id);

  // MLB + NFL today: full schedule overlays onto the calendar. Other leagues
  // fall through to the legacy promo-only rendering inside TeamCalendar.
  const games = await getGamesForTeam(team.id, team.sportSlug);
  const gameContexts = games.length > 0
    ? await enrichGamesForTeam(team.id, games, promos)
    : undefined;

  // Preview-gated redesign. Gate ON (every non-production Vercel env + local
  // dev, or the NEXT_PUBLIC_REDESIGN_V2 launch flag) renders the new template
  // from the SAME data fetched above. Gate OFF renders the live template below,
  // unchanged. The data fetching is identical on both paths.
  if (isRedesignEnabled()) {
    return (
      <RedesignTeamPage
        team={team}
        coverage={coverage}
        venue={venue}
        promos={promos}
        upcomingPromos={upcomingPromos}
        upcomingCounts={upcomingCounts}
        claim={claimMode}
        displayName={displayName}
        gameContexts={gameContexts}
        recurringDeals={recurringDeals}
        playoffsActive={!!playoffConfig?.playoffsActive}
        inPlayoffs={inPlayoffs}
        playoffPromos={playoffPromos}
        playoffRound={playoffRound}
        playoffLastUpdated={playoffConfig?.lastScanDate ?? null}
        playoffContext={playoffContext}
      />
    );
  }

  return (
    <>
      <JsonLd
        team={team}
        upcomingPromos={upcomingPromos}
        venue={venue}
        upcomingCounts={upcomingCounts}
        coverage={coverage}
        playoffPromos={inPlayoffs ? playoffPromos : undefined}
        playoffContext={playoffContext}
        claim={claimMode}
      />
      <TeamPageTracker
        teamSlug={team.id}
        sport={team.league}
        teamName={displayName}
        promoCount={promos.length}
      />
      <EngagementTracker teamSlug={team.id} sport={team.league} />

      <section className="px-6 pt-24 pb-2">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="team_page" />
      </section>

      <TeamHero
        team={team}
        venue={venue}
        promoCount={upcomingPromos.length}
        promoCounts={upcomingCounts}
      />

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.TEAM_PAGE_AFTER_HERO} pageType="team_page" />
      </section>

      {inPlayoffs && playoffPromos.length > 0 && (
        <PlayoffSection
          team={team}
          promos={playoffPromos}
          round={playoffRound}
          lastUpdated={playoffConfig!.lastScanDate}
        />
      )}

      {/* GET TICKETS hero — hand-rolled section so the section H2 picks up
       *  the new Outfit hero typography (TicketsBlock kept for /playoffs and
       *  the team-calendar modal where the existing display-font H2 reads
       *  fine). */}
      <section className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Get tickets
            </span>
            <h2 className="font-outfit font-black text-[22px] tracking-[-0.5px] text-white mt-1.5">
              {displayName.toUpperCase()} TICKETS
            </h2>
          </div>
          <div className="max-w-md">
            <TicketmasterCTA
              team={team}
              surface="web_team_page"
              placement="team_page_hero"
              size="full"
            />
          </div>
        </div>
      </section>

      {/* PREPARE FOR THE GAME cluster — Fanatics, SpotHero, Expedia. The
       *  branded cards replace the previous red-gradient inline parking CTA
       *  + footer "PLAN YOUR TRIP" + footer "SHOP OFFICIAL GEAR" sections.
       *  AT line is omitted when venue is null (no fabricated stadium
       *  fallback). Cluster placement = "team_page_prepare" gives PostHog a
       *  clean filter for cluster CTR vs the hero CTR. */}
      <section className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Prepare for the game
            </span>
            {venue && (
              <h2 className="font-outfit font-black text-[22px] tracking-[-0.5px] text-white mt-1.5 mb-1">
                AT {venue.name.toUpperCase()}
              </h2>
            )}
            <p className="font-sans text-[13px] text-[#888] leading-[1.5] mt-2">
              Going to the game? Reserve parking, book a hotel, or grab fan gear.
            </p>
          </div>
          <div className="max-w-md flex flex-col gap-2.5">
            {/* FanaticsCTA self-gates on team.fanaticsUrl presence (legacy
             *  team.fanaticsPath accepted as a fallback) — returns null for
             *  any team without a populated canonical URL (zero teams after
             *  the migration, but defense-in-depth for future Firestore docs
             *  added before coverage catches up). Naive URLs like
             *  fanatics.com/{league}/{slug} 404, so unpopulated teams must
             *  not render. */}
            <FanaticsCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
            />
            <SpotHeroCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
              venue={venue}
            />
            <ExpediaCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
              venue={venue}
            />
          </div>
        </div>
      </section>

      {venue && <VenueInfoBlock venue={venue} league={team.league} />}

      {/* NFL-only: official team schedule release video. Render gate is
       *  field presence on the team doc; MLB / NBA / NHL / MLS / WNBA
       *  Team docs never carry scheduleReleaseVideo so they skip this
       *  card naturally. Defensive league check belt-and-braces. */}
      {team.league === 'NFL' && team.scheduleReleaseVideo && (
        <ScheduleReleaseVideoCard video={team.scheduleReleaseVideo} teamSlug={team.id} />
      )}

      <TeamCalendar
        promos={promos}
        teamName={displayName}
        teamSlug={team.id}
        sport={team.league}
        team={team}
        gameContexts={gameContexts}
      />

      <RecurringDealsSection
        team={team}
        deals={recurringDeals}
        venueName={venue?.name ?? null}
      />

      <AuthorityStats
        team={team}
        promos={upcomingPromos}
        promoCounts={upcomingCounts}
        claim={claimMode}
        venue={venue}
        teamName={displayName}
      />

      {/* The fallback REPLACES the list only when there is nothing to show at
          all. A team with no upcoming promos but a real completed season keeps
          its list, because PromoList renders the archive under its own
          explicitly past heading and hiding it would make the page thinner
          than the data warrants. */}
      {promos.length === 0 ? (
        <ZeroPromoFallback team={team} venue={venue} teamName={displayName} />
      ) : (
        <PromoList
          league={team.league}
          promos={promos}
          teamSlug={team.id}
          teamName={displayName}
          teamNickname={team.name}
          sport={team.sportSlug}
          primaryColor={team.primaryColor}
          venueName={venue?.name ?? null}
        />
      )}

      <TeamRelatedAggregators promos={upcomingPromos} />

      <TeamContentSections
        team={team}
        promos={upcomingPromos}
        venue={venue}
        promoCounts={upcomingCounts}
        claim={claimMode}
      />

      <TeamFAQ
        team={team}
        upcomingPromos={upcomingPromos}
        venue={venue}
        upcomingCounts={upcomingCounts}
        coverage={coverage}
        playoffContext={playoffContext}
        claim={claimMode}
      />

      <section className="px-6 py-6 border-t border-border-subtle">
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="team_page" />
      </section>

      <section className="px-6 py-6 border-t border-border-subtle">
        <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="team_page" />
      </section>

      <section className="py-6 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <AffiliateDisclosure />
        </div>
      </section>

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="team_page" />
      </section>
    </>
  );
}
