import type { SeriesView, SlotView } from '@/lib/postseason/view';
import { CONDENSED, InProgressBadge } from './ui';

// The card for one series, as it sits in the bracket. Presentational: it has
// no state and no handler of its own, and it holds no link, because the
// whole card is the link to its series (see BracketExplorer). Club links
// live in the series detail.

function Seed({ seed }: { seed: number | null }) {
  if (seed === null) return null;
  return (
    <span className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded border border-rd-line bg-rd-cream px-1 text-[12px] font-semibold tabular-nums text-rd-ink-soft">
      <span className="sr-only">Seed </span>
      {seed}
    </span>
  );
}

function Slot({ slot, showWins }: { slot: SlotView; showWins: boolean }) {
  if (slot.kind === 'placeholder') {
    // A slot no club fills yet. Dashed, and the text is the slot's own.
    return (
      <span
        data-slot="placeholder"
        className="flex items-center gap-2.5 rounded-md border border-dashed border-rd-line-strong px-2.5 py-2 text-[14px] text-rd-ink-soft"
      >
        <Seed seed={slot.seed} />
        <span className="min-w-0">{slot.label}</span>
      </span>
    );
  }
  const strong = slot.leads || slot.won;
  return (
    <span data-slot="club" className="flex items-center gap-2.5 px-2.5 py-1.5">
      <Seed seed={slot.seed} />
      <span aria-hidden className="h-5 w-[4px] shrink-0 rounded-sm" style={{ background: slot.color ?? 'var(--color-rd-line)' }} />
      <span
        className={`min-w-0 flex-1 truncate text-[19px] uppercase leading-tight tracking-[0.02em] text-rd-ink ${
          strong ? 'font-extrabold' : 'font-semibold'
        }`}
        style={{ fontFamily: CONDENSED }}
      >
        {slot.label}
      </span>
      {showWins && (
        <span
          className={`shrink-0 text-[19px] tabular-nums leading-none ${strong ? 'font-extrabold text-rd-ink' : 'font-semibold text-rd-ink-soft'}`}
          style={{ fontFamily: CONDENSED }}
        >
          {slot.wins}
          <span className="sr-only"> {slot.wins === 1 ? 'win' : 'wins'}</span>
        </span>
      )}
    </span>
  );
}

export function hostLine(g: { hostName: string | null; park: string | null }): string | null {
  if (!g.hostName) return null;
  return g.park ? `Host: ${g.hostName} · ${g.park}` : `Host: ${g.hostName}`;
}

export function SeriesCardBody({ series }: { series: SeriesView }) {
  const started = series.status !== 'upcoming';
  const nextHost = series.next ? hostLine(series.next) : null;
  return (
    <span className="block px-1.5 pb-3 pt-2.5">
      <span className="flex items-center justify-between gap-2 px-2.5 pb-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">{series.formatLabel}</span>
        {series.liveLabel && <InProgressBadge />}
      </span>
      <span className="block space-y-1">
        <Slot slot={series.higher} showWins={started} />
        <Slot slot={series.lower} showWins={started} />
      </span>
      <span className="mt-2 block space-y-0.5 px-2.5">
        {series.scoreLine && <span className="block text-[14px] font-semibold text-rd-ink">{series.scoreLine}</span>}
        {series.liveLabel && series.next && (
          <span className="block text-[13px] text-rd-ink-soft">
            {series.next.title} in progress{nextHost ? ` · ${nextHost}` : ''}
          </span>
        )}
        {series.nextLabel && (
          <span className="block text-[13px] text-rd-ink-soft">
            <span className="font-semibold text-rd-ink">Next:</span> {series.nextLabel}
          </span>
        )}
        {series.nextLabel && nextHost && <span className="block text-[13px] text-rd-ink-soft">{nextHost}</span>}
        {!series.scoreLine && !series.liveLabel && !series.nextLabel && (
          <span className="block text-[13px] text-rd-ink-soft">{series.headline}</span>
        )}
      </span>
    </span>
  );
}
