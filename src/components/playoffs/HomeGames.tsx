import type { ReactNode } from 'react';
import type { HomeGameView } from '@/lib/postseason/view';
import { CONDENSED, SectionHeading } from './ui';

/**
 * Upcoming home games with a ticket link each.
 *
 * `tickets` maps a host club id to its ticket buttons, already rendered by
 * the page. This component never sees a team record, so nothing on one can
 * ride along into a client component later.
 */
export function HomeGames({
  id,
  heading,
  games,
  tickets,
  showLeague = false,
  empty,
}: {
  id: string;
  heading: string;
  games: readonly HomeGameView[];
  tickets: Readonly<Record<string, ReactNode>>;
  showLeague?: boolean;
  empty: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <SectionHeading id={id}>{heading}</SectionHeading>
      {games.length === 0 ? (
        <p className="mt-3 text-[14px] text-rd-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
          {games.map((g) => (
            <li key={g.key} data-home-game={g.key} className="rounded-[10px] border border-rd-line bg-rd-card p-3.5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 text-[19px] font-bold uppercase leading-tight tracking-[0.02em] text-rd-ink"
                  style={{ fontFamily: CONDENSED }}
                >
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
              {g.park && <p className="text-[13px] text-rd-ink-soft">{g.park}</p>}
              {tickets[g.hostTeamId] ? <div className="mt-2.5">{tickets[g.hostTeamId]}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
