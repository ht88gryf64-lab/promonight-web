import { CONDENSED } from './ui';

/** Shown when a bracket document is missing or cannot be read. It says what
 *  is true, that the bracket is not available, and guesses at nothing. */
export function BracketUnavailable({ league, season }: { league: string; season: number }) {
  return (
    <div
      role="status"
      data-bracket-state="unavailable"
      className="mt-6 rounded-[10px] border border-dashed border-rd-line-strong bg-rd-card px-4 py-6"
    >
      <p className="text-[22px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
        Bracket not available
      </p>
      <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-rd-ink-soft">
        The {season} {league} bracket is not available right now. No series, scores or game times are shown until it is.
      </p>
    </div>
  );
}
