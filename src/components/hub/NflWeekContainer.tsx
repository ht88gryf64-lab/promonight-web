import type { Team, Game, PromoWithTeam } from '@/lib/types';
import type { NflWeekSlate } from '@/lib/data';
import { splitPrimetime, gameEtYmd } from '@/lib/nfl-week';
import { formatGameTime } from '@/lib/format-game-time';
import { categoryFor } from '@/components/redesign/categories';
import { promoAnchorId, synthPromoId } from '@/lib/promo-helpers';
import { normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { IconChevronRight, IconMoonStars } from '@tabler/icons-react';

// The week-indexed This Week container for /nfl. One container holds the WHOLE
// week (label truth: a fan scanning This Week always finds every game), with
// primetime games grouped into a labeled subsection inside it — the approved
// shape, chosen because clubs promote primetime at their base rate (24 observed
// vs 23.4 expected) and the subsection eliminates the mislabeled-partition
// problem instead of renaming around it. A week with no primetime home game
// simply has no subsection.
//
// LINK ARCHITECTURE (ruled): per-noun anchors, never competing buttons. The
// matchup noun links the HOME team page (/{sportSlug}/{homeTeamId}); the venue
// noun links the building hub (/venues/{slug}) and DEGRADES TO PLAIN TEXT when
// the building is below the venue-index floor (4 NFL buildings today) — the
// same link-when-live pattern as the team-page eyebrow; never a dead anchor.
// Joined promos render beneath the row as deep links to the team page's own
// promo anchor (#promo-..., PromoArrivalHighlight handles arrival).
//
// NO AFFILIATE CTAs ON ROWS — text and links only. ScheduleRow's lazy-mount
// reasoning applies verbatim: an always-present tray swamps the crawlable body
// of the page and this surface's job is routing, not conversion.
//
// Server component; every anchor is SSR-crawlable. Events fire via the
// TrackedTapLink client leaf: game_tap on the matchup, venue_hub_click on the
// venue, this_week_card_tap on promo deep links.

/** Serializable venue-link subset for a game row (from getTeamVenueHubMap,
 *  keyed by HOME team slug; absent when the club has no building doc). */
export interface RowVenueLink {
  slug: string;
  displayName: string;
  indexable: boolean;
}

function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function formatDayLabel(ymd: string): string {
  return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatWindow(startYmd: string, endYmd: string): string {
  const f = (ymd: string) =>
    new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(startYmd)} – ${f(endYmd)}`;
}

function GameRow({
  game,
  home,
  away,
  venue,
  promos,
  surface,
  todayYmd,
  utcTodayYmd,
  showNetwork,
}: {
  game: Game;
  home: Team | undefined;
  away: Team | undefined;
  venue: RowVenueLink | undefined;
  promos: PromoWithTeam[];
  surface: AnalyticsSurface;
  todayYmd: string;
  utcTodayYmd: string;
  showNetwork: boolean;
}) {
  // Display day: the stored venue-local date, EXCEPT for TBD docs, where the
  // stored date is derived from ESPN's 05:00Z placeholder and lands one day
  // early at non-Eastern venues — gameEtYmd self-corrects those (known-issues
  // entry 14). Kickoff renders venue-local, "not yet set" discipline for TBD.
  const dayYmd = game.timeTbd ? gameEtYmd(game) : game.date;
  const kickoff = game.timeTbd
    ? 'Kickoff TBD'
    : formatGameTime(game.gameTimeTz, game.gameTime, game.date);
  const matchupLabel = `${away?.name ?? game.awayTeamSlug} at ${home?.name ?? game.homeTeamSlug}`;
  const venueName = venue?.displayName || game.venueName;

  return (
    <li className="rounded-2xl border border-rd-line bg-rd-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {home ? (
          <TrackedTapLink
            href={`/${home.sportSlug}/${home.id}`}
            aria-label={`${matchupLabel}: ${home.city} ${home.name} promotions and schedule`}
            trackEvent="game_tap"
            trackProps={{
              surface,
              team_slug: home.id,
              sport: normalizeSport(home.league),
              game_id: game.id,
              is_home: true,
              has_promo: promos.length > 0,
              opponent_slug: game.awayTeamSlug,
              placement: 'nfl_week_game_row',
            }}
            className="font-rd text-[15.5px] font-semibold text-rd-ink hover:text-rd-red"
          >
            {matchupLabel}
          </TrackedTapLink>
        ) : (
          <span className="font-rd text-[15.5px] font-semibold text-rd-ink">{matchupLabel}</span>
        )}
        <span className="font-rd text-[12.5px] text-rd-ink-soft">
          {formatDayLabel(dayYmd)} · {kickoff}
          {showNetwork && game.broadcast?.network ? (
            <span className="text-rd-ink-faint"> · {game.broadcast.network}</span>
          ) : null}
        </span>
      </div>

      <div className="mt-1 font-rd text-[13px] text-rd-ink-soft">
        {venue && venue.indexable ? (
          <TrackedTapLink
            href={`/venues/${venue.slug}`}
            aria-label={`${venue.displayName} bag policy, parking and gameday guide`}
            trackEvent="venue_hub_click"
            trackProps={{
              surface,
              placement: 'nfl_week_game_row',
              building_slug: venue.slug,
              building_name: venue.displayName,
              destination_url: `/venues/${venue.slug}`,
            }}
            className="font-semibold text-rd-red hover:underline"
          >
            {venueName} ›
          </TrackedTapLink>
        ) : (
          // Below the indexing floor (or no building doc): plain text, never a
          // dead anchor — the link-when-live pattern from the team-page eyebrow.
          <span>{venueName}</span>
        )}
      </div>

      {promos.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-rd-line pt-2">
          {promos.map((p) => {
            const cat = categoryFor(p.type);
            // The #promo- fragment only resolves for UPCOMING promos: the team
            // page assigns anchor ids on its upcoming split only (UTC-day
            // boundary, promo-list.tsx), and past promos render unanchored in
            // "Already happened". The week window holds already-played games
            // Fri-Mon, so a past-dated promo here degrades to plain text —
            // never a dead fragment, and no negative days_out events. The
            // boundary mirrors the team page's (UTC), not the hub's Chicago
            // anchor, because the DESTINATION decides whether the anchor
            // exists.
            const isPast = p.date < utcTodayYmd;
            return (
              <li key={synthPromoId(p.team.id, p)}>
                {isPast ? (
                  <span className="inline-flex items-center gap-1.5 font-rd text-[13px] text-rd-ink-faint">
                    <cat.Icon size={13} stroke={2.25} style={{ color: cat.color }} aria-hidden />
                    <span>{p.title}</span>
                  </span>
                ) : (
                  <TrackedTapLink
                    href={`/${p.team.sportSlug}/${p.team.id}#promo-${promoAnchorId(p)}`}
                    trackEvent="this_week_card_tap"
                    trackProps={{
                      surface,
                      team_id: p.team.id,
                      sport: normalizeSport(p.team.league),
                      promo_id: synthPromoId(p.team.id, p),
                      promo_type: p.type,
                      is_highlight: p.highlight,
                      days_out: daysBetween(todayYmd, p.date),
                    }}
                    className="group inline-flex items-center gap-1.5 font-rd text-[13px] text-rd-ink-soft hover:text-rd-red"
                  >
                    <cat.Icon size={13} stroke={2.25} style={{ color: cat.color }} aria-hidden />
                    <span className="group-hover:underline">{p.title}</span>
                    <IconChevronRight size={13} stroke={2} aria-hidden className="text-rd-line-strong" />
                  </TrackedTapLink>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export function NflWeekContainer({
  slate,
  teamsById,
  venueByTeam,
  sectionId,
  surface,
  primetimeSurface,
}: {
  slate: NflWeekSlate;
  /** Every NFL team keyed by slug (for matchup names + hrefs). */
  teamsById: Record<string, Team>;
  /** Home-team slug -> building hub link (absent = no doc; indexable gates the anchor). */
  venueByTeam: Record<string, RowVenueLink>;
  /** DOM id / aria-labelledby anchor, e.g. "nfl-this-week". */
  sectionId: string;
  /** Container surface (web_nfl_hub_this_week). */
  surface: AnalyticsSurface;
  /** Primetime subsection surface (web_nfl_hub_primetime). */
  primetimeSurface: AnalyticsSurface;
}) {
  const bucket = slate.context.bucket;
  // Offseason: nothing to render — the page owns any zero-state copy.
  if (!bucket) return null;

  const { primetime, rest } = splitPrimetime(bucket);
  const todayYmd = chicagoTodayYMD();
  // UTC day, matching the team page's upcoming/past promo split — see the
  // deep-link degrade in GameRow.
  const utcTodayYmd = new Date().toISOString().slice(0, 10);
  const heading =
    slate.context.mode === 'next-up' ? `Next up: ${bucket.label}` : `${bucket.label} across the NFL`;

  const rowFor = (g: Game, rowSurface: AnalyticsSurface, showNetwork: boolean) => (
    <GameRow
      key={g.id}
      game={g}
      home={teamsById[g.homeTeamSlug]}
      away={teamsById[g.awayTeamSlug]}
      venue={venueByTeam[g.homeTeamSlug]}
      promos={slate.promosByGameId[g.id] ?? []}
      surface={rowSurface}
      todayYmd={todayYmd}
      utcTodayYmd={utcTodayYmd}
      showNetwork={showNetwork}
    />
  );

  return (
    <section aria-labelledby={sectionId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
          {heading}
        </h2>
        <span className="font-rd text-[13px] text-rd-ink-faint">
          {formatWindow(bucket.windowStartYmd, bucket.windowEndYmd)}
        </span>
      </div>
      {slate.context.mode === 'next-up' ? (
        <p className="mt-2 font-rd text-[14px] text-rd-ink-soft">
          No NFL games this week. Here is the next slate.
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">{rest.map((g) => rowFor(g, surface, false))}</ul>

      {primetime.length > 0 ? (
        <div className="mt-8">
          <h3 className="flex items-center gap-2 rd-display text-lg text-rd-ink">
            <IconMoonStars size={19} stroke={2} aria-hidden className="text-rd-red" />
            Primetime
          </h3>
          <p className="mt-1 font-rd text-[13px] text-rd-ink-soft">
            Night kickoffs change the logistics: gate times, parking windows and last-train
            questions. Every guide is one tap away.
          </p>
          <ul className="mt-4 space-y-3">{primetime.map((g) => rowFor(g, primetimeSurface, true))}</ul>
        </div>
      ) : null}
    </section>
  );
}
