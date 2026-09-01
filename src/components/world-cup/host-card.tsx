import Link from 'next/link';
import { IconStarFilled, IconMapPin, IconExternalLink } from '@tabler/icons-react';
import type { WorldCupCityData, WorldCupTeamData } from '@/lib/world-cup-data';
import type { WorldCupFanFestival } from '@/data/world-cup-cities';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import { WorldCupGameRows } from './game-rows';

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function TeamGames({ team }: { team: WorldCupTeamData }) {
  return (
    <div>
      {/* Stack the relationship line below the team name on mobile (full width,
          wrapping); inline-right only from sm up, capped so it never bleeds. */}
      <div className="mb-1 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <Link
          href={`/mlb/${team.ref.slug}`}
          className="font-rd text-base font-bold text-rd-ink transition-colors hover:text-rd-red"
        >
          {team.ref.display}
        </Link>
        <span className="font-rd text-[11px] text-rd-ink-faint [overflow-wrap:anywhere] sm:max-w-[55%] sm:text-right">
          {team.ref.relationship}
        </span>
      </div>
      {team.homeGames.length > 0 && team.team ? (
        <WorldCupGameRows games={team.homeGames} team={team.team} />
      ) : (
        <p className="border-t border-rd-line pt-2 font-rd text-[13px] text-rd-ink-soft">
          The {team.ref.display} had no home dates inside the World Cup window. They were on the road or in the All-Star break.
        </p>
      )}
    </div>
  );
}

// Official Fan Festival / fan zones for the city, as they ran. Server-rendered
// so crawlers see the festival content; only the official-link click is a client
// leaf (TrackedLink fires cta_click). The official link is a non-commercial
// FIFA / host-committee URL, never an affiliate partner, which is why it
// survives the retrospective's removal of the commercial surface.
function WhereToWatch({ festival, citySlug }: { festival: WorldCupFanFestival; citySlug: string }) {
  const { headline, admission, officialUrl, venues, distributed, highlights, note } = festival;
  return (
    <div className="border-t border-rd-line px-5 py-5 md:px-6">
      <p className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
        Where the city watched
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

  return (
    <article id={city.slug} className="scroll-mt-24 overflow-hidden rounded-2xl border border-rd-line bg-rd-card">
      {/* Header */}
      <div className="border-b border-rd-line px-5 py-5 md:px-6">
        <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-red">
          {city.marqueeRound} · {longDate(city.marqueeDate)}
        </p>
        <h3 className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">{city.city}</h3>
        <p className="mt-1.5 font-rd text-sm text-rd-ink-soft">
          {city.wcVenue} · {city.totalMatches} World Cup matches · {city.wcWindow}, 2026
        </p>
        {city.roundsNote && (
          <p className="mt-2 font-rd text-[13px] leading-relaxed text-rd-ink-soft">{city.roundsNote}</p>
        )}
      </div>

      {/* Body. The right-hand "Plan your visit" rail is gone: it carried a
          Ticketmaster, SpotHero, Expedia and Fanatics CTA per city, 55 live
          commissionable links across the page, for a tournament that finished
          on 2026-07-19. A retrospective does not sell tickets to a played
          match. Removed here at the emitter rather than inside any shared
          affiliate component, which every other route still uses unchanged. */}
      <div className="p-5 md:p-6">
        <div>
          <p className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
            Ballgames that lined up
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
                No home dates inside the tournament window. The {primary.ref.display} were on the
                road or in the MLB All-Star break across that stretch. The team page carries the
                full calendar.
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
      </div>

      {/* Where to watch the World Cup itself: official Fan Festival / fan zones. */}
      <WhereToWatch festival={city.fanFestival} citySlug={city.slug} />
    </article>
  );
}
