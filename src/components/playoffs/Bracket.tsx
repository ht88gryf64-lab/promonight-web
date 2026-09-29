import type { LeagueView, RoundView } from '@/lib/postseason/view';
import { SeriesCard } from './SeriesCard';
import { CONDENSED, SectionHeading } from './ui';

function Round({ round, current }: { round: RoundView; current: boolean }) {
  const headingId = `round-${round.key}`;
  return (
    <section aria-labelledby={headingId} data-round={round.key} className="mt-9 first:mt-0">
      <SectionHeading id={headingId}>{round.label}</SectionHeading>
      {current && <p className="mt-1.5 text-[12px] uppercase tracking-[0.1em] text-rd-red">Current round</p>}
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        {round.groups.map((group) => (
          <div key={group.conference ?? 'all'} className={round.groups.length === 1 ? 'lg:col-span-2' : undefined}>
            {group.conference && (
              <h3
                className="mb-2 text-[17px] font-bold uppercase tracking-[0.06em] text-rd-ink-soft"
                style={{ fontFamily: CONDENSED }}
              >
                {group.conference}
              </h3>
            )}
            <ul className={`grid gap-2.5 ${round.groups.length === 1 ? 'lg:grid-cols-2' : ''}`}>
              {group.series.map((s) => (
                <SeriesCard key={s.seriesKey} series={s} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The bracket as plain sections: one per round, in the document's order. */
export function Bracket({ view }: { view: LeagueView }) {
  const currentKey = view.phase.kind === 'active' ? view.phase.roundKey : null;
  return (
    <div data-bracket={view.league}>
      {view.rounds.map((r) => (
        <Round key={r.key} round={r} current={r.key === currentKey} />
      ))}
    </div>
  );
}
