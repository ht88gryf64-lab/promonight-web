import Link from 'next/link';
import { IconBallFootball, IconStarFilled } from '@tabler/icons-react';
import type { Venue } from '@/lib/types';
import type { WorldCupCityData, WorldCupTeamData } from '@/lib/world-cup-data';
import { categoryFor } from '@/components/redesign/categories';
import { isSoccerJerseyPromo } from '@/lib/soccer-jersey';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { BookingCTA } from '@/components/affiliates/BookingCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { VenueInfoBlock } from '@/components/venue-info-block';

const WC_SURFACE = 'web_world_cup' as const;
const WC_PLACEMENT = 'world_cup_card';

function ymd(date: string): { weekday: string; mon: string; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    mon: dt.toLocaleDateString('en-US', { month: 'short' }),
    day: d,
  };
}

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

// Coords-complete venue for affiliate routing. Prefer the real ballpark venue;
// when a ballpark venue doc is missing, synthesize one from the World Cup venue
// coordinates so parking and hotel CTAs still route geographically.
function routingVenue(team: WorldCupTeamData, fallbackLat: number, fallbackLng: number, fallbackName: string): Venue | null {
  if (team.venue) return team.venue;
  if (!team.team) return null;
  return {
    name: fallbackName,
    address: '',
    team: team.ref.display,
    sport: 'MLB',
    sportIcon: '',
    primaryColor: team.team.primaryColor,
    accentColor: team.team.secondaryColor,
    lat: fallbackLat,
    lng: fallbackLng,
    hasAmenityData: false,
    amenityCount: 0,
    league: 'MLB',
    teamId: team.team.id,
  };
}

function PromoBadge({ type, title, soccer }: { type: 'giveaway' | 'theme' | 'kids' | 'food'; title: string; soccer: boolean }) {
  const { color, label, Icon } = categoryFor(type);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-rd text-[11px] font-semibold ${soccer ? 'ring-1 ring-rd-red' : ''}`}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon size={12} stroke={2.25} className="shrink-0" />
      <span className="truncate">{title}</span>
      {soccer && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-rd-red px-1.5 text-[9px] uppercase tracking-[0.06em] text-white">
          <IconBallFootball size={9} stroke={2.5} /> WC jersey
        </span>
      )}
    </span>
  );
}

function GameRow({ ctx, league }: { ctx: WorldCupTeamData['homeGames'][number]; league?: string }) {
  const { weekday, mon, day } = ymd(ctx.game.date);
  const opponent = ctx.opponentTeam?.name ?? ctx.game.awayTeamSlug;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-11 shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">{weekday}</div>
        <div className="rd-numerals text-lg leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[9px] uppercase tracking-[0.08em] text-rd-ink-faint">{mon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-rd text-sm font-semibold text-rd-ink">vs {opponent}</div>
        {ctx.promos.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ctx.promos.map((p, i) => (
              <PromoBadge key={i} type={p.type} title={p.title} soccer={isSoccerJerseyPromo(p, league)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamGames({ team }: { team: WorldCupTeamData }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <Link
          href={`/mlb/${team.ref.slug}`}
          className="font-rd text-base font-bold text-rd-ink transition-colors hover:text-rd-red"
        >
          {team.ref.display}
        </Link>
        <span className="shrink-0 text-right font-rd text-[11px] text-rd-ink-faint">{team.ref.relationship}</span>
      </div>
      {team.homeGames.length > 0 ? (
        <div className="divide-y divide-rd-line border-t border-rd-line">
          {team.homeGames.map((ctx) => (
            <GameRow key={`${ctx.game.date}-${ctx.game.doubleheaderGame ?? 0}`} ctx={ctx} league={team.team?.league} />
          ))}
        </div>
      ) : (
        <p className="border-t border-rd-line pt-2 font-rd text-[13px] text-rd-ink-soft">
          No {team.ref.display} home games during the World Cup window. They are on the road or in the All-Star break.
        </p>
      )}
    </div>
  );
}

function WorldCupRail({ team, venue }: { team: WorldCupTeamData; venue: Venue | null }) {
  if (!team.team) return null;
  return (
    <div>
      <h4 className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
        Plan your visit
      </h4>
      <div className="flex flex-col gap-2.5">
        <TicketmasterCTA team={team.team} surface={WC_SURFACE} placement={WC_PLACEMENT} size="full" />
        <SpotHeroCTA team={team.team} venue={venue} surface={WC_SURFACE} placement={WC_PLACEMENT} />
        <BookingCTA team={team.team} venue={venue} surface={WC_SURFACE} placement={WC_PLACEMENT} />
        <FanaticsCTA team={team.team} surface={WC_SURFACE} placement={WC_PLACEMENT} />
      </div>
      {team.venue && (
        <div className="mt-6">
          <VenueInfoBlock venue={team.venue} league="MLB" variant="light" />
        </div>
      )}
    </div>
  );
}

export function WorldCupHostCard({ data }: { data: WorldCupCityData }) {
  const { city, teams, hasAnyGames } = data;
  const primary = teams[0];
  const railVenue = routingVenue(primary, city.wcVenueLat, city.wcVenueLng, city.wcVenue);

  return (
    <article id={city.slug} className="scroll-mt-24 overflow-hidden rounded-2xl border border-rd-line bg-rd-card">
      {/* Header */}
      <div className="border-b border-rd-line px-5 py-5 md:px-6">
        <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-red">
          {city.marqueeRound} · {longDate(city.marqueeDate)}
        </p>
        <h3 className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">{city.city}</h3>
        <p className="mt-1.5 font-rd text-sm text-rd-ink-soft">
          {city.wcVenue} · {city.totalMatches} World Cup matches · {city.wcWindow}
        </p>
        {city.roundsNote && (
          <p className="mt-2 font-rd text-[13px] leading-relaxed text-rd-ink-soft">{city.roundsNote}</p>
        )}
      </div>

      {/* Body: games (left) + affiliate rail (right) */}
      <div className="grid gap-6 p-5 md:grid-cols-[1.5fr_1fr] md:p-6">
        <div>
          <p className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
            Games to catch
          </p>

          {hasAnyGames ? (
            <div className="space-y-5">
              {teams.map((team) => (
                <TeamGames key={team.ref.slug} team={team} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-rd-line bg-rd-cream px-4 py-5">
              <p className="font-rd text-sm leading-relaxed text-rd-ink-soft">
                No home games during your trip. The {primary.ref.display} are on the road or in the
                MLB All-Star break across this stretch. Check the team page for the full calendar.
              </p>
              <Link
                href={`/mlb/${primary.ref.slug}`}
                className="mt-2 inline-block font-rd text-[12px] font-semibold uppercase tracking-[0.08em] text-rd-red hover:text-rd-ink"
              >
                {primary.ref.display} schedule
              </Link>
            </div>
          )}

          {/* Special non-MLB event (Philadelphia: MLB All-Star Game). */}
          {city.specialEvent && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-rd-line bg-rd-cream px-4 py-3">
              <IconStarFilled size={16} className="mt-0.5 shrink-0 text-rd-red" />
              <div className="min-w-0">
                <div className="font-rd text-sm font-bold text-rd-ink">
                  {city.specialEvent.label} · {longDate(city.specialEvent.date)}
                </div>
                <div className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
                  {city.specialEvent.venue}. {city.specialEvent.note}
                </div>
              </div>
            </div>
          )}
        </div>

        <WorldCupRail team={primary} venue={railVenue} />
      </div>
    </article>
  );
}
