import Link from 'next/link';
import type { GameView, SeriesView, SlotView } from '@/lib/postseason/view';
import { CONDENSED, InProgressBadge } from './ui';

function Seed({ seed }: { seed: number | null }) {
  if (seed === null) return null;
  return (
    <span
      className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded border border-rd-line bg-rd-cream px-1 text-[12px] font-semibold tabular-nums text-rd-ink-soft"
      aria-label={`Seed ${seed}`}
    >
      {seed}
    </span>
  );
}

function Slot({ slot, showWins }: { slot: SlotView; showWins: boolean }) {
  if (slot.kind === 'placeholder') {
    // A slot no club fills yet. Dashed, and the text is the slot's own.
    return (
      <div
        data-slot="placeholder"
        className="flex items-center gap-2.5 rounded-md border border-dashed border-rd-line-strong px-2.5 py-2 text-[14px] text-rd-ink-soft"
      >
        <Seed seed={slot.seed} />
        <span className="min-w-0">{slot.label}</span>
      </div>
    );
  }
  const strong = slot.leads || slot.won;
  return (
    <div data-slot="club" className="flex items-center gap-2.5 px-2.5 py-1.5">
      <Seed seed={slot.seed} />
      <span aria-hidden className="h-5 w-[4px] shrink-0 rounded-sm" style={{ background: slot.color ?? 'var(--color-rd-line)' }} />
      <Link
        href={slot.teamHref as string}
        className={`min-w-0 flex-1 truncate text-[19px] uppercase leading-tight tracking-[0.02em] text-rd-ink hover:text-rd-red ${
          strong ? 'font-extrabold' : 'font-semibold'
        }`}
        style={{ fontFamily: CONDENSED }}
      >
        {slot.label}
      </Link>
      {showWins && (
        <span
          className={`shrink-0 text-[19px] tabular-nums leading-none ${strong ? 'font-extrabold text-rd-ink' : 'font-semibold text-rd-ink-soft'}`}
          style={{ fontFamily: CONDENSED }}
          aria-label={`${slot.wins} ${slot.wins === 1 ? 'win' : 'wins'}`}
        >
          {slot.wins}
        </span>
      )}
    </div>
  );
}

function hostLine(g: GameView): string | null {
  if (!g.hostName) return null;
  return g.park ? `Host: ${g.hostName} · ${g.park}` : `Host: ${g.hostName}`;
}

function GameRow({ g }: { g: GameView }) {
  const host = hostLine(g);
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-x-2 text-[13px] leading-snug">
      <span className="font-bold uppercase text-rd-ink" style={{ fontFamily: CONDENSED, fontSize: 15 }}>
        G{g.gameNumber}
      </span>
      <span className="min-w-0">
        <span className="block text-rd-ink">{g.when}</span>
        {host && <span className="block text-rd-ink-soft">{host}</span>}
        {g.state === 'final' && g.result && <span className="block font-semibold text-rd-ink">Final: {g.result}</span>}
        {g.state === 'live' && (
          <span className="mt-0.5 block">
            <InProgressBadge />
          </span>
        )}
        {g.state !== 'final' && g.state !== 'live' && g.stateLabel !== 'Scheduled' && (
          <span className="block text-rd-ink-faint">{g.stateLabel}</span>
        )}
      </span>
    </li>
  );
}

export function SeriesCard({ series }: { series: SeriesView }) {
  const started = series.status !== 'upcoming';
  const nextHost = series.next ? hostLine(series.next) : null;
  return (
    <li
      data-series={series.id}
      data-series-status={series.status}
      className="overflow-hidden rounded-[10px] border border-rd-line bg-rd-card shadow-sm"
    >
      <div className="px-1.5 pb-3 pt-2.5">
        <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">{series.formatLabel}</span>
          {series.liveLabel && <InProgressBadge />}
        </div>
        <div className="space-y-1">
          <Slot slot={series.higher} showWins={started} />
          <Slot slot={series.lower} showWins={started} />
        </div>
        <div className="mt-2 space-y-0.5 px-2.5">
          {series.scoreLine && <p className="text-[14px] font-semibold text-rd-ink">{series.scoreLine}</p>}
          {series.liveLabel && series.next && (
            <p className="text-[13px] text-rd-ink-soft">
              {series.next.title} in progress{nextHost ? ` · ${nextHost}` : ''}
            </p>
          )}
          {series.nextLabel && (
            <p className="text-[13px] text-rd-ink-soft">
              <span className="font-semibold text-rd-ink">Next:</span> {series.nextLabel}
            </p>
          )}
          {series.nextLabel && nextHost && <p className="text-[13px] text-rd-ink-soft">{nextHost}</p>}
          {!series.scoreLine && !series.liveLabel && !series.nextLabel && (
            <p className="text-[13px] text-rd-ink-soft">{series.headline}</p>
          )}
        </div>
      </div>
      {series.games.length > 0 && (
        <details className="border-t border-rd-line">
          <summary className="cursor-pointer px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-rd-ink-soft">
            All games in this series
          </summary>
          <ol className="space-y-2 px-4 pb-3.5">
            {series.games.map((g) => (
              <GameRow key={g.gameNumber} g={g} />
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
