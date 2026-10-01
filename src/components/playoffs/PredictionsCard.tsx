import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { HubPredictionLine } from '@/lib/postseason/predictions';
import { CONDENSED, LockIcon } from './ui';

// The hub's predictions card: one line per league whose postseason is being
// played and whose computer bracket was locked, each linking to that
// league's predictions section. It carries the champion pick and the record
// and nothing else: no fingerprint, no date, no series.
export function hubPredictionText(l: HubPredictionLine): string {
  return `Computer's champion: ${l.championName} · ${l.record}`;
}

export function PredictionsCard({
  heading,
  headingId,
  lines,
}: {
  heading: string;
  headingId: string;
  lines: readonly HubPredictionLine[];
}) {
  if (lines.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      data-predictions="locked"
      className="mt-12 rounded-[10px] border border-dashed border-rd-line-strong px-4 py-5"
    >
      <div className="flex items-center gap-2 text-rd-ink-soft">
        <LockIcon />
        <h2 id={headingId} className="text-[22px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
          {heading}
        </h2>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {lines.map((l) => {
          const text = hubPredictionText(l);
          return (
            <li key={l.league} data-predictions-league={l.league.toLowerCase()} className="text-[14px] leading-relaxed">
              <TrackedLink
                href={l.href}
                surface="web_playoffs"
                ctaId="playoffs_hub_predictions"
                ctaLabel={text}
                className="font-semibold text-rd-ink underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red"
              >
                {`Computer's champion: ${l.championName} `}
                <span className="whitespace-nowrap">{`· ${l.record}`}</span>
              </TrackedLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
