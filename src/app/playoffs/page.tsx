import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPlayoffPromos,
  getVenueForTeam,
  getPlayoffConfig,
  getPlayoffPromosForTeam,
} from '@/lib/data';
import type {
  PlayoffPromo,
  PlayoffPromoWithTeam,
  Team,
  Venue,
  PlayoffConfig,
} from '@/lib/types';
import { teamDisplayName, roundLabel, extractOpponent } from '@/lib/promo-helpers';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { StarToggle } from '@/components/star-toggle';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { CHAMPIONS, isChampionsCelebrationActive } from '@/lib/champions-data';
import { ChampionsCelebration } from '@/components/champions/champions-celebration';

export const revalidate = 21600;

const PAGE_URL = 'https://www.getpromonight.com/playoffs';
// Launch date for the /playoffs hub. Static anchor for Article.datePublished;
// dateModified refreshes with each scanner run.
const PAGE_PUBLISHED = '2026-04-20T00:00:00-05:00';

export async function generateMetadata(): Promise<Metadata> {
  // Offseason champions mode swaps in champions-focused metadata. Mirrors the
  // page's playoffsActive === false gate and auto-reverts next season.
  const cfg = await getPlayoffConfig().catch(() => null);
  if (cfg && cfg.playoffsActive === false && isChampionsCelebrationActive()) {
    const champTitle = '2026 NBA and NHL Champions: Knicks, Hurricanes';
    const champDescription =
      'Honoring the New York Knicks (2026 NBA Champions) and Carolina ' +
      'Hurricanes (2026 Stanley Cup Champions). Parade details, championship ' +
      'moments, and every playoff giveaway from both runs.';
    return {
      title: champTitle,
      description: champDescription,
      alternates: { canonical: 'https://www.getpromonight.com/playoffs' },
      openGraph: {
        title: `${champTitle} | PromoNight`,
        description: champDescription,
        siteName: 'PromoNight',
        url: 'https://www.getpromonight.com/playoffs',
        type: 'website',
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'PromoNight 2026 NBA and NHL champions',
          },
        ],
      },
    };
  }

  // The root layout's title.template ("%s | PromoNight") appends the brand, so
  // this bare title renders as "Playoff Promos & Giveaways 2026 | PromoNight".
  const title = 'Playoff Promos & Giveaways 2026';
  // OG title is not processed by the layout title.template, so include the
  // "| PromoNight" suffix to match the rendered <title> and brand shared cards.
  const socialTitle = `${title} | PromoNight`;
  const description =
    "Every MLB and NHL playoff promo schedule for 2026. Giveaways, bobbleheads & theme nights across all active playoff teams. See what's on tonight.";
  return {
    title,
    description,
    alternates: {
      canonical: 'https://www.getpromonight.com/playoffs',
    },
    openGraph: {
      title: socialTitle,
      description,
      siteName: 'PromoNight',
      url: 'https://www.getpromonight.com/playoffs',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'PromoNight: Every giveaway, every team',
        },
      ],
    },
  };
}

const LEAGUE_ICONS: Record<'NBA' | 'NHL', string> = { NBA: '🏀', NHL: '🏒' };

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
    answer:
      'Each team section above lists the giveaways scheduled for their home playoff games, with dates shown when known. Scroll to your team, or open the team page for the full calendar. The list refreshes within an hour of the latest scanner update.',
  });

  const rallyTeams: string[] = [];
  // Tight regex: matches "rally towel" as a phrase OR the standalone word
  // "towel" (word boundaries), not the bare word "rally" (which matches too
  // many non-towel events like pre-playoff rallies and pep rallies).
  const rallyTowelRe = /rally towel|\btowel\b/i;
  for (const league of ['NBA', 'NHL'] as const) {
    for (const { team, promos } of byLeague[league]) {
      const hasTowel = promos.some(
        (p) => rallyTowelRe.test(p.title) || rallyTowelRe.test(p.description),
      );
      if (hasTowel) rallyTeams.push(teamDisplayName(team));
    }
  }
  if (rallyTeams.length > 0) {
    // Show the full list when 10 or fewer (avoids an awkward "and 1 more"
    // tail); otherwise truncate at 8 with an "and X more" suffix.
    const limit = rallyTeams.length <= 10 ? rallyTeams.length : 8;
    const list = rallyTeams.slice(0, limit).join(', ');
    const more = rallyTeams.length > limit ? `, and ${rallyTeams.length - limit} more` : '';
    faqs.push({
      question: 'Which teams are giving out rally towels in Round 1?',
      answer: `${rallyTeams.length} active playoff team${rallyTeams.length !== 1 ? 's have' : ' has'} rally towel giveaways scheduled during Round 1: ${list}${more}. Sponsor partners and game-by-game designs vary by team.`,
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
  // Pool all promos with their team.
  const all: { promo: PlayoffPromo; team: Team }[] = [];
  for (const league of ['NBA', 'NHL'] as const) {
    for (const group of byLeague[league]) {
      for (const promo of group.promos) {
        all.push({ promo, team: group.team });
      }
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // (a) highlight + dated today-or-future, soonest first. Avoids picking a
  //     past event (e.g. Cavs "Playoffs Tipoff Party" on Apr 14) as the lead
  //     example once the playoffs are underway.
  const upcomingHighlights = all
    .filter(
      (x) =>
        x.promo.highlight &&
        x.promo.date &&
        (x.promo.date as string).slice(0, 10) >= today,
    )
    .sort((a, b) =>
      (a.promo.date as string).localeCompare(b.promo.date as string),
    );
  if (upcomingHighlights.length > 0) {
    return {
      title: upcomingHighlights[0].promo.title,
      teamName: upcomingHighlights[0].team.name,
    };
  }

  // (b) any highlight regardless of date (covers recurring marquee promos).
  const anyHighlight = all.find((x) => x.promo.highlight);
  if (anyHighlight) {
    return {
      title: anyHighlight.promo.title,
      teamName: anyHighlight.team.name,
    };
  }

  // (c) first giveaway-typed promo (most clickable category).
  const firstGiveaway = all.find((x) => x.promo.type === 'giveaway');
  if (firstGiveaway) {
    return {
      title: firstGiveaway.promo.title,
      teamName: firstGiveaway.team.name,
    };
  }

  // (d) any dated promo — last-resort fallback.
  const firstDated = all.find((x) => !!x.promo.date);
  if (firstDated) {
    return {
      title: firstDated.promo.title,
      teamName: firstDated.team.name,
    };
  }

  return null;
}

export default async function PlayoffsPage() {
  const { config, byLeague, totalPromos, totalTeams } = await getAllPlayoffPromos();

  if (!config) {
    notFound();
  }

  // Offseason: when playoffs are inactive, /playoffs hosts the champions
  // celebration (auto-hiding at CHAMPIONS_DISPLAY_UNTIL) and an offseason
  // placeholder instead of 404ing. The live-playoffs hub below only renders
  // while playoffsActive is true (returns next spring).
  if (!config.playoffsActive) {
    return <PlayoffsOffseason />;
  }

  const nbaGroups = config.nbaActive ? byLeague.NBA : [];
  const nhlGroups = config.nhlActive ? byLeague.NHL : [];
  const example = pickHighlightExample(byLeague);

  // Venue lookup for parking CTAs. Fetched once per ISR revalidate (1h).
  // Missing venues fall back gracefully inside <ParkingCTA />.
  const activeTeams = [
    ...nbaGroups.map((g) => g.team),
    ...nhlGroups.map((g) => g.team),
  ];
  const venueEntries = await Promise.all(
    activeTeams.map(async (t) => [t.id, await getVenueForTeam(t.id)] as const),
  );
  const venuesByTeamId = new Map<string, Venue | null>(venueEntries);
  const lastUpdated = formatFullTimestamp(
    config.lastScanDate ?? config.updatedAt,
  );
  const lastModifiedIso =
    config.lastScanDate ?? config.updatedAt ?? PAGE_PUBLISHED;
  const liveDuringLabel =
    config.nbaRound === config.nhlRound
      ? `Live during ${roundLabel(config.nbaRound)}`
      : 'Live during the playoffs';

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

  if (isRedesignEnabled()) {
    return (
      <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
          <div aria-hidden className="absolute inset-0 z-0 opacity-70" style={{ backgroundImage: 'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)' }} />
          <div className="relative z-10 mx-auto max-w-5xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
            <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#ff5a78' }}>{liveDuringLabel}</p>
            <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">2026 NBA AND NHL PLAYOFF PROMOTIONS</h1>
            <p className="mt-4 max-w-3xl font-rd text-base leading-relaxed text-white/70 md:text-lg">
              The 2026 NBA and NHL playoffs feature {totalPromos} promotional events across {totalTeams} teams
              {example ? `, including "${example.title}" for the ${example.teamName}` : ''}
              . Every scheduled giveaway, watch party, and rally towel is listed below. Updated hourly from official team sources.
            </p>
            <p className="mt-6 font-rd text-[11px] uppercase tracking-[0.12em] text-white/45">Last updated: {lastUpdated}</p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
          <div className="mb-2">
            <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="playoffs_hub" />
          </div>

          {nbaGroups.length > 0 && (
            <LeagueSection league="NBA" roundCode={config.nbaRound} groups={nbaGroups} venuesByTeamId={venuesByTeamId} light />
          )}

          <div className="my-8">
            <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="playoffs_hub" />
          </div>

          {nhlGroups.length > 0 && (
            <LeagueSection league="NHL" roundCode={config.nhlRound} groups={nhlGroups} venuesByTeamId={venuesByTeamId} light />
          )}

          <div className="my-8">
            <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="playoffs_hub" />
          </div>

          {nbaGroups.length === 0 && nhlGroups.length === 0 && (
            <p className="py-16 text-center text-rd-ink-soft">No playoff promotions scheduled yet. Check back soon.</p>
          )}

          {activeTeams.length > 0 && (
            <section className="mt-16 border-t border-rd-line pt-10">
              <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">Visiting fans</span>
              <h2 className="rd-display mb-3 mt-1 text-3xl uppercase text-rd-ink md:text-4xl">PLAN YOUR PLAYOFF TRIP</h2>
              <p className="mb-8 max-w-3xl font-rd text-sm leading-relaxed text-rd-ink-soft md:text-base">
                Traveling for a playoff game? Find a hotel in any active team&apos;s city.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeTeams.map((t) => (
                  <HotelsCTA key={t.id} team={t} venue={venuesByTeamId.get(t.id) ?? null} surface="web_playoffs" placement="playoffs_hub" variant="card" />
                ))}
              </div>
            </section>
          )}

          <div className="my-8">
            <AdSlot config={AD_SLOTS.IN_CONTENT_3} pageType="playoffs_hub" />
          </div>
          <div className="my-8">
            <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="playoffs_hub" />
          </div>

          <section className="mt-16 border-t border-rd-line pt-10">
            <h2 className="rd-display mb-8 text-3xl uppercase text-rd-ink md:text-4xl">FREQUENTLY ASKED QUESTIONS</h2>
            <div className="max-w-3xl space-y-6">
              {faqs.map((f, i) => (
                <div key={i}>
                  <h3 className="font-rd text-base font-semibold text-rd-ink">{f.question}</h3>
                  <p className="mt-1.5 font-rd text-sm leading-relaxed text-rd-ink-soft">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 border-t border-rd-line pt-6">
            <AffiliateDisclosure />
          </section>

          <div className="mt-6">
            <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="playoffs_hub" />
          </div>
        </div>
      </div>
    );
  }

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
            {liveDuringLabel}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2 mb-6">
            2026 NBA AND NHL PLAYOFF PROMOTIONS
          </h1>
          <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-3xl">
            The 2026 NBA and NHL playoffs feature {totalPromos} promotional events across {totalTeams} teams
            {example
              ? `, including "${example.title}" for the ${example.teamName}`
              : ''}
            . Every scheduled giveaway, watch party, and rally towel is listed below. Updated hourly from official team sources.
          </p>
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-6">
            Last updated: {lastUpdated}
          </p>
        </header>

        <div className="my-6">
          <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="playoffs_hub" />
        </div>

        {nbaGroups.length > 0 && (
          <LeagueSection
            league="NBA"
            roundCode={config.nbaRound}
            groups={nbaGroups}
            venuesByTeamId={venuesByTeamId}
          />
        )}

        <div className="my-8">
          <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="playoffs_hub" />
        </div>

        {nhlGroups.length > 0 && (
          <LeagueSection
            league="NHL"
            roundCode={config.nhlRound}
            groups={nhlGroups}
            venuesByTeamId={venuesByTeamId}
          />
        )}

        <div className="my-8">
          <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType="playoffs_hub" />
        </div>

        {nbaGroups.length === 0 && nhlGroups.length === 0 && (
          <p className="text-text-secondary text-center py-16">
            No playoff promotions scheduled yet. Check back soon.
          </p>
        )}

        {activeTeams.length > 0 && (
          <section className="mt-16 pt-10 border-t border-border-subtle">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Visiting fans
            </span>
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mb-3 mt-1">
              PLAN YOUR PLAYOFF TRIP
            </h2>
            <p className="text-text-secondary text-sm md:text-base leading-relaxed max-w-3xl mb-8">
              Traveling for a playoff game? Find a hotel in any active team&apos;s city.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTeams.map((t) => (
                <HotelsCTA
                  key={t.id}
                  team={t}
                  venue={venuesByTeamId.get(t.id) ?? null}
                  surface="web_playoffs"
                  placement="playoffs_hub"
                  variant="card"
                />
              ))}
            </div>
          </section>
        )}

        <div className="my-8">
          <AdSlot config={AD_SLOTS.IN_CONTENT_3} pageType="playoffs_hub" />
        </div>

        <div className="my-8">
          <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="playoffs_hub" />
        </div>

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

        <section className="mt-12 pt-6 border-t border-border-subtle">
          <AffiliateDisclosure />
        </section>

        <div className="mt-6">
          <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="playoffs_hub" />
        </div>
      </div>
    </div>
  );
}

function LeagueSection({
  league,
  roundCode,
  groups,
  venuesByTeamId,
  light = false,
}: {
  league: 'NBA' | 'NHL';
  roundCode: string;
  groups: { team: Team; promos: PlayoffPromo[] }[];
  venuesByTeamId: Map<string, Venue | null>;
  light?: boolean;
}) {
  if (light) {
    return (
      <section className="mt-12 border-t border-rd-line pt-10">
        <div className="mb-8">
          <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            {LEAGUE_ICONS[league]} {league}
          </span>
          <h2 className="rd-display mt-1 text-3xl uppercase text-rd-ink md:text-4xl">{roundLabel(roundCode)}</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <TeamCard key={g.team.id} team={g.team} promos={g.promos} venue={venuesByTeamId.get(g.team.id) ?? null} light />
          ))}
        </div>
      </section>
    );
  }

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
          <TeamCard
            key={g.team.id}
            team={g.team}
            promos={g.promos}
            venue={venuesByTeamId.get(g.team.id) ?? null}
          />
        ))}
      </div>
    </section>
  );
}

function TeamCard({
  team,
  promos,
  venue,
  light = false,
}: {
  team: Team;
  promos: PlayoffPromo[];
  venue: Venue | null;
  light?: boolean;
}) {
  // Opponent label = the LATEST dated promo's opponent (the current-round
  // matchup), not the earliest. Promos may span multiple rounds; sort dated
  // promos newest-first and take the first parseable opponent. Fall back to
  // any promo (covers recurring-only sets) so behavior is otherwise unchanged.
  const opponent =
    [...promos]
      .filter((p) => p.date)
      .sort((a, b) => (b.date as string).localeCompare(a.date as string))
      .map((p) => extractOpponent(p.gameInfo))
      .find((o): o is string => !!o) ??
    promos
      .map((p) => extractOpponent(p.gameInfo))
      .find((o): o is string => !!o);
  const visible = promos.slice(0, 4);
  const remaining = Math.max(0, promos.length - visible.length);
  const teamUrl = `/${team.sportSlug}/${team.id}`;

  if (light) {
    return (
      <article className="relative flex flex-col overflow-hidden rounded-2xl border border-rd-line bg-rd-card">
        <div className="h-1 w-full" style={{ backgroundColor: team.primaryColor }} aria-hidden />
        <div className="flex flex-1 flex-col p-5 md:p-6">
          <div className="mb-4 pr-12">
            <h3 className="rd-display text-xl uppercase text-rd-ink md:text-2xl">
              <Link href={teamUrl} className="transition-colors hover:text-rd-red">{teamDisplayName(team)}</Link>
            </h3>
            {opponent && (
              <p className="mt-1 font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">vs {opponent}</p>
            )}
          </div>
          <div className="absolute right-4 top-5 md:right-5 md:top-6">
            <StarToggle teamSlug={team.id} teamName={teamDisplayName(team)} league={team.league} sport={team.sportSlug} placement="playoffs_hub_team_card" surface="light" />
          </div>

          <ul className="flex-1 space-y-2">
            {visible.map((p, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: promoTypeColor(p.type) }} aria-hidden />
                <span className="flex-1 leading-snug text-rd-ink">{p.title}</span>
                <span className="shrink-0 whitespace-nowrap font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">
                  {p.date ? formatShortDate(p.date) : p.recurring ? 'recurring' : ''}
                </span>
              </li>
            ))}
            {remaining > 0 && <li className="pl-4 text-xs text-rd-ink-faint">+ {remaining} more</li>}
          </ul>

          <div className="mt-5 space-y-5 border-t border-rd-line pt-4">
            <TicketsBlock team={team} surface="web_playoffs" placement="playoffs_hub" variant="card" />
            <ParkingCTA team={team} venue={venue} surface="web_playoffs" placement="playoffs_hub" compact tone="secondary" />
            <Link href={teamUrl} className="block pt-1 font-rd text-[11px] uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:text-rd-ink">
              View full {team.name} promotions →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="relative bg-bg-card border border-border-subtle rounded-xl p-5 md:p-6 flex flex-col">
      <div className="mb-4 pr-12">
        <h3 className="font-display text-xl md:text-2xl tracking-[0.5px]">
          <Link href={teamUrl} className="hover:text-accent-red transition-colors">
            {teamDisplayName(team)}
          </Link>
        </h3>
        {opponent && (
          <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mt-1">
            vs {opponent}
          </p>
        )}
      </div>
      <div className="absolute top-4 right-4 md:top-5 md:right-5">
        <StarToggle
          teamSlug={team.id}
          teamName={teamDisplayName(team)}
          league={team.league}
          sport={team.sportSlug}
          placement="playoffs_hub_team_card"
          surface="dark"
        />
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

      <div className="mt-5 pt-4 border-t border-border-subtle space-y-5">
        {/* Tickets is the primary CTA per playoff team (Phase 2.3 deviation:
         *  /playoffs gets ~40% of site traffic and audit elevates tickets
         *  from secondary to primary on this surface). Parking renders
         *  secondary (outlined) so two filled-red buttons don't compete on
         *  the same card. */}
        <TicketsBlock
          team={team}
          surface="web_playoffs"
          placement="playoffs_hub"
          variant="card"
        />
        <ParkingCTA
          team={team}
          venue={venue}
          surface="web_playoffs"
          placement="playoffs_hub"
          compact
          tone="secondary"
        />
        <Link
          href={teamUrl}
          className="block font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors pt-1"
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

// Offseason view: champions celebration (while inside the displayUntil window)
// plus an offseason placeholder. Rendered in place of the live hub whenever
// playoffsActive is false. Uses the light redesign surface, which is the live
// design site-wide.
async function PlayoffsOffseason() {
  const showChampions = isChampionsCelebrationActive();

  // Championship-run promo highlights. getPlayoffPromosForTeam is NOT gated on
  // playoffsActive, so the historical run docs still resolve in the offseason.
  const promosByTeam: Record<string, PlayoffPromoWithTeam[]> = {};
  if (showChampions) {
    const entries = await Promise.all(
      CHAMPIONS.map(
        async (c) =>
          [c.teamId, await getPlayoffPromosForTeam(c.teamId)] as const,
      ),
    );
    for (const [id, promos] of entries) promosByTeam[id] = promos;
  }

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      {showChampions && (
        <ChampionsCelebration
          champions={CHAMPIONS}
          promosByTeam={promosByTeam}
        />
      )}

      <div className="mx-auto max-w-5xl px-6 pb-20 pt-12">
        <section className="rounded-2xl border border-rd-line bg-rd-card p-6 md:p-8">
          <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            Offseason
          </span>
          <h2 className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">
            Playoffs return in October with MLB
          </h2>
          <p className="mt-2 max-w-3xl font-rd text-[15px] leading-relaxed text-rd-ink-soft">
            The 2026 NBA and NHL playoffs are complete. Postseason promo coverage
            picks back up in October when the MLB playoffs begin, and returns for
            the NBA and NHL next spring. In the meantime, browse giveaways and
            theme nights across every team.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl border border-rd-line-strong px-4 py-2.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-ink hover:text-rd-ink"
          >
            Browse all promos →
          </Link>
        </section>
      </div>
    </div>
  );
}
