import type { LeagueView, SeriesView } from '@/lib/postseason/view';
import { CONDENSED, SectionHeading } from './ui';

/**
 * Every decided series, round by round, with the score of every game that
 * was played. All of it is in the document; none of it is elsewhere on the
 * page once the bracket has moved on, because the bracket shows one round
 * at a time on a phone and a series' games sit behind its card.
 *
 * It is also what keeps a finished bracket, or one between rounds, a page:
 * the ad placer sizes what it puts on a page by the article's height, and
 * a bracket with nothing coming up is short without its results. Nothing
 * here is written to fill space: a round with no decided series is not
 * listed, and a league with none gets no section at all.
 */
export function SeriesResults({ view, heading }: { view: LeagueView; heading: string }) {
  const rounds = view.rounds
    .map((r) => ({ label: r.label, key: r.key, series: r.groups.flatMap((g) => g.series.filter((s) => s.status === 'final')) }))
    .filter((r) => r.series.length > 0);
  if (rounds.length === 0) return null;
  return (
    <section aria-labelledby="series-results" data-series-results={rounds.length} className="mt-12">
      <SectionHeading id="series-results">{heading}</SectionHeading>
      {rounds.map((r) => (
        <div key={r.key} data-results-round={r.key} className="mt-5">
          <h3 className="text-[16px] font-bold uppercase tracking-[0.06em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {r.label}
          </h3>
          <ul className="mt-2 grid gap-2.5 lg:grid-cols-2">
            {r.series.map((s) => (
              <Result key={s.id} s={s} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Result({ s }: { s: SeriesView }) {
  const played = s.games.filter((g) => g.state === 'final' && g.result);
  return (
    <li data-result={s.id} className="rounded-[10px] border border-rd-line bg-rd-card p-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">{s.conference ? `${s.conference} · ${s.formatLabel}` : s.formatLabel}</p>
      <a href={`#${s.id}`} className="mt-0.5 block text-[18px] font-bold uppercase leading-tight tracking-[0.02em] text-rd-ink hover:text-rd-red" style={{ fontFamily: CONDENSED }}>
        {s.higher.label} vs {s.lower.label}
      </a>
      {s.scoreLine && <p className="mt-0.5 text-[14px] font-semibold text-rd-ink">{s.scoreLine}</p>}
      {played.length > 0 && (
        <ol className="mt-1.5 space-y-0.5">
          {played.map((g) => (
            <li key={g.gameNumber} data-result-game={g.gameNumber} className="grid grid-cols-[2.25rem_1fr] gap-x-2 text-[13px] leading-snug text-rd-ink-soft">
              <span className="font-bold uppercase text-rd-ink" style={{ fontFamily: CONDENSED, fontSize: 14 }}>
                G{g.gameNumber}
              </span>
              <span>
                <span className="text-rd-ink">{g.result}</span>
                <span className="block text-rd-ink-faint">{g.when}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
