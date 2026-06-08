import Link from 'next/link';
import { IconStarFilled, IconMapPin, IconExternalLink } from '@tabler/icons-react';
import type { Venue } from '@/lib/types';
import type { WorldCupCityData, WorldCupTeamData } from '@/lib/world-cup-data';
import type { WorldCupFanFestival } from '@/data/world-cup-cities';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { BookingCTA } from '@/components/affiliates/BookingCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { VenueInfoBlock } from '@/components/venue-info-block';
import { WorldCupGameRows } from './game-rows';

const WC_SURFACE = 'web_world_cup' as const;
const WC_PLACEMENT = 'world_cup_card';

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

function TeamGames({ team, citySlug }: { team: WorldCupTeamData; citySlug: string }) {
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
      {team.homeGames.length > 0 && team.team ? (
        <WorldCupGameRows
          games={team.homeGames}
          team={team.team}
          teamSlug={team.ref.slug}
          teamName={team.team.name}
          citySlug={citySlug}
        />
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

// Official Fan Festival / fan zones for the city. Server-rendered so crawlers
// see the festival content; only the official-link click is a client leaf
// (TrackedLink fires cta_click). No new affiliate CTAs — the official link is
// a non-commercial FIFA / host-committee URL, not an affiliate partner.
function WhereToWatch({ festival, citySlug }: { festival: WorldCupFanFestival; citySlug: string }) {
  const { headline, admission, officialUrl, venues, distributed, highlights, note } = festival;
  return (
    <div className="border-t border-rd-line px-5 py-5 md:px-6">
      <p className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
        Where to watch
      </p>
      <div className="rounded-xl border border-rd-line bg-rd-cream px-4 py-4">
        <h4 className="font-rd text-sm font-bold text-rd-ink [overflow-wrap:anywhere]">{headline}</h4>

        {venues && venues.length > 0 && (
          <ul className="mt-2.5 space-y-2">
            {venues.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <IconMapPin size={14} stroke={2} className="mt-0.5 shrink-0 text-rd-red" />
                <div className="min-w-0">
                  <div className="font-rd text-[13px] font-semibold text-rd-ink [overflow-wrap:anywhere]">{v.name}</div>
                  <div className="font-rd text-[12px] text-rd-ink-soft [overflow-wrap:anywhere]">{v.dates}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {distributed && highlights && highlights.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {highlights.map((h, i) => (
              <span
                key={i}
                className="inline-flex max-w-full items-center rounded-full bg-rd-card px-2.5 py-0.5 font-rd text-[11px] text-rd-ink-soft ring-1 ring-rd-line [overflow-wrap:anywhere]"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 font-rd text-[12px] leading-relaxed text-rd-ink-soft [overflow-wrap:anywhere]">
          <span className="font-semibold text-rd-ink">Admission:</span> {admission}
        </p>
        {note && (
          <p className="mt-1.5 font-rd text-[12px] leading-relaxed text-rd-ink-faint [overflow-wrap:anywhere]">{note}</p>
        )}

        <TrackedLink
          href={officialUrl}
          external
          ctaId={`world_cup_fanfest:${citySlug}`}
          ctaLabel={headline}
          surface="web_world_cup"
          className="mt-3 inline-flex items-center gap-1 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] text-rd-red transition-colors hover:text-rd-ink"
        >
          Official fan festival site
          <IconExternalLink size={13} stroke={2} className="shrink-0" />
        </TrackedLink>
      </div>
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
                <TeamGames key={team.ref.slug} team={team} citySlug={city.slug} />
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

      {/* Where to watch the World Cup itself: official Fan Festival / fan zones. */}
      <WhereToWatch festival={city.fanFestival} citySlug={city.slug} />
    </article>
  );
}
