import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Team, Game, PromoWithTeam } from '@/lib/types';
import type { NflWeekSlate } from '@/lib/data';
import { splitPrimetime, gameEtYmd } from '@/lib/nfl-week';
import { rivalryBlockColors } from '@/lib/cfb/hub-theme';
import { formatGameTime } from '@/lib/format-game-time';
import { normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';

// Partition rails for /nfl (supersedes the subsection shape by explicit
// ruling): Rail 1 "This week" holds every game EXCEPT primetime; Rail 2
// "Primetime" holds the night games, ADJACENT with no module between — that
// adjacency is the accepted mitigation for the label risk of excluding
// primetime from a rail named "This week". A week with no primetime home game
// renders rail 1 only; preseason buckets return a structurally empty
// primetime group (splitPrimetime).
//
// CARD TREATMENT lifted from the CFB WeekCard/DiagonalFill pair
// (src/components/cfb/hub/blocks.tsx): diagonal 62/38 split with the HOME
// wedge LEFT (dominant — the matchup anchor points at the home page and only
// the home club's promos can land on the game), two stacked primary→secondary
// fades, the §14b seam hairline when the primaries sit too close in luminance
// (rivalryBlockColors returns `divider` — this is what keeps Raiders-at-
// Steelers-class pairings readable; no contrast fallback exists by ruling),
// and the bottom-heavy scrim. NOTE THE DELIBERATE DIVERGENCE: the TITLE reads
// natural order "Broncos at Chiefs" (away first) while the WEDGES are
// home-left — title order and wedge order disagree by design, per ruling;
// this is not a bug. Cards are dark islands on the cream page, same as CFB.
//
// Light-theme adaptations (ruled): section headings use the redesign's ink
// heading scale, never CFB's amber mono caps; the on-card meta line tone is
// under comparison (META_TONE) — amber vs a muted white — reported at the
// gate before this merges.
//
// Anchors, per-noun as ruled: corner names → their team pages (CFB pattern),
// serif-italic title → HOME team page (game_tap), venue line → venue hub
// (venue_hub_click), degrading to plain text where the building is below the
// venue-index floor (exactly one club today: Bills/Highmark). No nesting —
// every anchor is an absolute or flow sibling. No affiliate CTAs on cards.

const SERIF = 'Georgia, serif'; // CFB serif var is not loaded on this page; Georgia is its stack fallback
const MONO = 'var(--font-mono), ui-monospace, monospace';
const AMBER = '#FFB71E';
const MUTED = 'rgba(255,255,255,0.72)';
// Meta-line tone: MUTED won the on-preview comparison (2026-08-07, ruled
// lean confirmed): amber pulled the eye to the least important line and
// imported CFB's accent into the light system; muted keeps the card's
// hierarchy title-first. AMBER retained here only as the comparison record.
const META_TONE: 'amber' | 'muted' = 'muted';

export interface RowVenueLink {
  slug: string;
  displayName: string;
  indexable: boolean;
}

/** Verified logistics facts for a primetime card's bottom line. Assembled by
 *  the page from venueHubs building + verified tenant overlays; every part is
 *  optional and the line renders only the parts that exist — a gate time is
 *  never invented. */
export interface PrimetimeLogistics {
  gateText?: string;
  lotText?: string;
  transitText?: string;
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

function formatDayLabel(ymd: string): string {
  return new Date(ymd + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

function formatWindow(startYmd: string, endYmd: string): string {
  const f = (ymd: string) =>
    new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(startYmd).toUpperCase()} – ${f(endYmd).toUpperCase()}`;
}

// The CFB DiagonalFill, home-left. `divider` fires on close primary luminance
// (the black-on-black seam mechanism, carried over unchanged).
function DiagonalFill({ home, away }: { home: Team; away: Team }) {
  const { pa, pb, sa, sb, divider } = rivalryBlockColors(home, away);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${pb} 0%, ${pb} 45%, ${sb} 112%)` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${pa} 0%, ${pa} 45%, ${sa} 112%)`,
          clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0 100%)',
        }}
      />
      {divider && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, transparent 49.5%, rgba(255,255,255,0.5) 49.7%, rgba(255,255,255,0.5) 50.3%, transparent 50.5%)',
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.88) 100%)',
        }}
      />
    </>
  );
}

function CornerName({ team, side }: { team: Team; side: 'left' | 'right' }) {
  return (
    <Link
      href={`/${team.sportSlug}/${team.id}`}
      className="absolute top-3 z-10 text-[10px] font-bold uppercase text-white hover:underline sm:text-[11px]"
      style={{ fontFamily: MONO, textShadow: '0 1px 4px #000', [side]: 14 } as CSSProperties}
    >
      {team.name}
    </Link>
  );
}

function NflGameCard({
  game,
  home,
  away,
  venue,
  promoCount,
  surface,
  wide,
  logistics,
  metaAmber,
}: {
  game: Game;
  home: Team;
  away: Team;
  venue: RowVenueLink | undefined;
  promoCount: number;
  surface: AnalyticsSurface;
  wide: boolean;
  logistics?: PrimetimeLogistics;
  metaAmber: boolean;
}) {
  const dayYmd = game.timeTbd ? gameEtYmd(game) : game.date;
  const kickoff = game.timeTbd
    ? 'KICKOFF TBD'
    : formatGameTime(game.gameTimeTz, game.gameTime, game.date).toUpperCase();
  const metaColor = metaAmber ? AMBER : MUTED;
  const venueName = venue?.displayName || game.venueName;
  const logisticsParts = wide
    ? [logistics?.gateText, logistics?.lotText, logistics?.transitText, game.broadcast?.network]
        .filter((s): s is string => !!s && s.length > 0)
    : [];

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border border-white/10 ${
        wide ? 'h-[170px] min-w-[360px] sm:min-w-[400px]' : 'h-[150px] min-w-[280px]'
      }`}
    >
      <DiagonalFill home={home} away={away} />
      <CornerName team={home} side="left" />
      <CornerName team={away} side="right" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-3.5">
        <div
          className="text-[9px] font-bold tracking-wider"
          style={{ fontFamily: MONO, color: metaColor, textShadow: '0 1px 3px #000' }}
        >
          {formatDayLabel(dayYmd)} · {kickoff}
          {promoCount > 0
            ? ` · ${promoCount} ${promoCount === 1 ? 'PROMO' : 'PROMOS'}`
            : ''}
        </div>
        <TrackedTapLink
          href={`/${home.sportSlug}/${home.id}`}
          aria-label={`${away.name} at ${home.name}: ${home.city} ${home.name} promotions and schedule`}
          trackEvent="game_tap"
          trackProps={{
            surface,
            team_slug: home.id,
            sport: normalizeSport(home.league),
            game_id: game.id,
            is_home: true,
            has_promo: promoCount > 0,
            opponent_slug: game.awayTeamSlug,
            placement: 'nfl_week_game_card',
          }}
          className="mt-1 block italic text-white hover:underline"
          style={{ fontFamily: SERIF, fontSize: wide ? 22 : 19, lineHeight: 1.05, textShadow: '0 1px 4px #000' }}
        >
          {away.name} at {home.name}
        </TrackedTapLink>
        {venue && venue.indexable ? (
          <TrackedTapLink
            href={`/venues/${venue.slug}`}
            aria-label={`${venue.displayName} bag policy, parking and gameday guide`}
            trackEvent="venue_hub_click"
            trackProps={{
              surface,
              placement: 'nfl_week_game_card',
              building_slug: venue.slug,
              building_name: venue.displayName,
              destination_url: `/venues/${venue.slug}`,
            }}
            className="mt-1 inline-block text-[11px] font-semibold text-white/85 underline-offset-2 hover:underline"
            style={{ textShadow: '0 1px 3px #000' }}
          >
            {venueName} ›
          </TrackedTapLink>
        ) : (
          <div className="mt-1 text-[11px] text-white/70" style={{ textShadow: '0 1px 3px #000' }}>
            {venueName}
          </div>
        )}
        {logisticsParts.length > 0 ? (
          <div
            className="mt-1.5 text-[9px] tracking-wide text-white/75"
            style={{ fontFamily: MONO, textShadow: '0 1px 3px #000' }}
          >
            {logisticsParts.join(' · ')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RailHeading({ id, title, label }: { id: string; title: string; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="rd-display text-2xl text-rd-ink md:text-3xl">
        {title}
      </h2>
      <span
        className="text-[12px] tracking-[0.06em] text-rd-ink-faint"
        style={{ fontFamily: MONO }}
      >
        {label}
      </span>
    </div>
  );
}

export function NflWeekContainer({
  slate,
  teamsById,
  venueByTeam,
  logisticsByGameId,
  sectionId,
  surface,
  primetimeSurface,
}: {
  slate: NflWeekSlate;
  teamsById: Record<string, Team>;
  venueByTeam: Record<string, RowVenueLink>;
  /** Verified primetime logistics per game id (absent parts omitted, never invented). */
  logisticsByGameId: Record<string, PrimetimeLogistics>;
  sectionId: string;
  surface: AnalyticsSurface;
  primetimeSurface: AnalyticsSurface;
}) {
  const bucket = slate.context.bucket;
  if (!bucket) return null;

  const { primetime, rest } = splitPrimetime(bucket);
  void chicagoTodayYMD; // retained for parity with sibling hub components

  const cardFor = (g: Game, cardSurface: AnalyticsSurface, wide: boolean) => {
    const home = teamsById[g.homeTeamSlug];
    const away = teamsById[g.awayTeamSlug];
    if (!home || !away) return null;
    const metaAmber = META_TONE === 'amber';
    return (
      <NflGameCard
        key={g.id}
        game={g}
        home={home}
        away={away}
        venue={venueByTeam[g.homeTeamSlug]}
        promoCount={slate.promosByGameId[g.id]?.length ?? 0}
        surface={cardSurface}
        wide={wide}
        logistics={logisticsByGameId[g.id]}
        metaAmber={metaAmber}
      />
    );
  };

  const weekLabelText = `${bucket.label.toUpperCase()} · ${formatWindow(bucket.windowStartYmd, bucket.windowEndYmd)}`;

  return (
    <section aria-labelledby={sectionId}>
      <RailHeading
        id={sectionId}
        title={slate.context.mode === 'next-up' ? 'Next up' : 'This week'}
        label={weekLabelText}
      />
      {slate.context.mode === 'next-up' ? (
        <p className="mt-2 font-rd text-[14px] text-rd-ink-soft">
          No NFL games this week. Here is the next slate.
        </p>
      ) : null}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {rest.map((g) => cardFor(g, surface, false))}
      </div>

      {primetime.length > 0 ? (
        <div className="mt-8">
          <RailHeading
            id={`${sectionId}-primetime`}
            title="Primetime"
            label="NIGHT GAMES · GATES, LOTS AND TRANSIT RUN LATER"
          />
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {primetime.map((g) => cardFor(g, primetimeSurface, true))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
