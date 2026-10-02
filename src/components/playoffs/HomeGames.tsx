import type { ReactNode } from 'react';
import type { AnalyticsSurface } from '@/lib/analytics';
import type { HomeGameView, HomeGamesWindow } from '@/lib/postseason/view';
import { ParkLink } from './links';
import { ShowAll } from './ShowAll';
import { CONDENSED, SectionHeading } from './ui';

function Row({
  g,
  ticket,
  showLeague,
  surface,
}: {
  g: HomeGameView;
  ticket: ReactNode;
  showLeague: boolean;
  surface: AnalyticsSurface;
}) {
  return (
    <li data-home-game={g.key} className="rounded-[10px] border border-rd-line bg-rd-card p-3.5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[19px] font-bold uppercase leading-tight tracking-[0.02em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
          {g.matchup}
        </span>
        {showLeague && (
          <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">{g.league}</span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-rd-ink-soft">
        {g.roundLabel} · {g.gameTitle}
        {g.ifNecessary ? ' · If necessary' : ''}
      </p>
      <p className="mt-0.5 text-[13.5px] text-rd-ink">{g.when}</p>
      {g.promo && (
        <p data-game-promo={g.promo.type} className="text-[13.5px] text-rd-ink">
          <span aria-hidden="true">{g.promo.icon} </span>
          {g.promo.title}
        </p>
      )}
      {g.park && (
        <p className="text-[13px] text-rd-ink-soft">
          {g.parkPage ? (
            <ParkLink
              page={g.parkPage}
              teamId={g.hostTeamId}
              league={g.league}
              surface={surface}
              placement="playoffs_home_games"
              className="underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red"
            >
              {g.park}
            </ParkLink>
          ) : (
            g.park
          )}
        </p>
      )}
      {ticket ? <div className="mt-2.5">{ticket}</div> : null}
    </li>
  );
}

/**
 * Upcoming playoff games, each with its host: the next three days first, at most eight rows, one
 * ticket button a row. "Show all" reveals the rest of the week.
 *
 * `tickets` maps a host club id to its ticket button, already rendered by
 * the page. This component never sees a team record.
 */
export function HomeGames({
  id,
  heading,
  games,
  tickets,
  surface,
  showLeague = false,
  empty,
}: {
  id: string;
  heading: string;
  games: HomeGamesWindow;
  tickets: Readonly<Record<string, ReactNode>>;
  surface: AnalyticsSurface;
  showLeague?: boolean;
  empty: string;
}) {
  const rows = (list: readonly HomeGameView[]) =>
    list.map((g) => <Row key={g.key} g={g} ticket={tickets[g.hostTeamId] ?? null} showLeague={showLeague} surface={surface} />);
  return (
    <section aria-labelledby={id} data-home-games={id} className="mt-12">
      <SectionHeading id={id}>{heading}</SectionHeading>
      {games.primary.length === 0 ? (
        <p className="mt-3 text-[14px] text-rd-ink-soft">{empty}</p>
      ) : (
        <ul data-home-games-list="primary" className="mt-3 grid gap-2.5 lg:grid-cols-2">
          {rows(games.primary)}
        </ul>
      )}
      {games.rest.length > 0 && (
        <ShowAll id={`${id}-more`} label={`Show ${games.rest.length} more ${games.rest.length === 1 ? 'game' : 'games'}`}>
          <ul data-home-games-list="rest" className="grid gap-2.5 lg:grid-cols-2">
            {rows(games.rest)}
          </ul>
        </ShowAll>
      )}
    </section>
  );
}
