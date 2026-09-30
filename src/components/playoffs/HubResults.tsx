import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { LeagueView, SeriesView } from '@/lib/postseason/view';
import type { PostseasonLeague } from '@/lib/postseason/types';
import { CONDENSED, SectionHeading } from './ui';

const SURFACE = 'web_playoffs' as const;

/**
 * Each league's decided series so far, one line each, linking to the series
 * on the league page. All of it is in the documents. A league with no
 * decided series is not listed; with none in any league there is no section.
 */
export function HubResults({ leagues, heading }: { leagues: readonly { league: PostseasonLeague; href: string; view: LeagueView }[]; heading: string }) {
  const listed = leagues
    .map((l) => ({ ...l, series: l.view.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.filter((s) => s.status === 'final'))) }))
    .filter((l) => l.series.length > 0);
  if (listed.length === 0) return null;
  return (
    <section aria-labelledby="hub-results" data-hub-results={listed.length} className="mt-12">
      <SectionHeading id="hub-results">{heading}</SectionHeading>
      {listed.map((l) => (
        <div key={l.league} data-results-league={l.league} className="mt-5">
          <h3 className="text-[16px] font-bold uppercase tracking-[0.06em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {l.league}
          </h3>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {l.series.map((s) => (
              <Line key={s.id} s={s} href={`${l.href}#${s.id}`} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Line({ s, href }: { s: SeriesView; href: string }) {
  return (
    <li data-result={s.id} className="border-t border-rd-line py-2">
      <TrackedLink href={href} surface={SURFACE} ctaId="playoffs_result_series" ctaLabel={`${s.higher.label} vs ${s.lower.label}`} className="group block">
        <span className="block text-[15px] font-semibold leading-snug text-rd-ink group-hover:text-rd-red">
          {s.higher.label} vs {s.lower.label}
        </span>
        <span className="mt-0.5 block text-[13px] text-rd-ink-soft">
          {s.roundLabel}
          {s.scoreLine ? ` · ${s.scoreLine}` : ''}
        </span>
      </TrackedLink>
    </li>
  );
}
