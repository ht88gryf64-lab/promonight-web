import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { AnalyticsSurface } from '@/lib/analytics';
import type { LeagueCard } from '@/lib/postseason/inbound';
import { InProgressBadge } from '../ui';

/**
 * The playoffs card at the top of a league's hub, while that league's
 * postseason is being played. Server-rendered. It sits inside the hub's
 * page-content wrapper and is a plain section: no aside, no ad of its own.
 */
export function LeaguePlayoffsCard({ card, surface }: { card: LeagueCard; surface: AnalyticsSurface }) {
  const headingId = 'league-playoffs';
  return (
    <section
      aria-labelledby={headingId}
      data-playoffs-module="league"
      data-playoffs-state="active"
      className="rounded-[14px] border border-rd-line bg-rd-card p-5 shadow-[0_1px_3px_rgba(33,29,24,0.06)]"
      style={{ borderLeft: '3px solid var(--color-rd-red)' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            {card.season} {card.league} Playoffs
          </p>
          <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">
            {card.roundLabel}
          </h2>
        </div>
        <TrackedLink
          href={card.href}
          surface={surface}
          ctaId="playoffs_module_league"
          ctaLabel={`Open the ${card.league} bracket`}
          className="font-rd text-sm font-semibold text-rd-red underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red-dark"
        >
          Open the {card.league} bracket
        </TrackedLink>
      </div>
      <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
        {card.series.map((s) => (
          <li key={s.id} data-series={s.id} className="border-t border-rd-line py-2">
            <TrackedLink href={s.href} surface={surface} ctaId="playoffs_module_series" ctaLabel={s.names} className="group block">
              <span className="block font-rd text-[15px] font-semibold leading-snug text-rd-ink group-hover:text-rd-red">{s.names}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-rd text-[13px] text-rd-ink-soft">
                {s.inProgress ? <InProgressBadge /> : null}
                <span>{s.status}</span>
              </span>
            </TrackedLink>
          </li>
        ))}
      </ul>
      {card.updatedLabel && (
        <p data-bracket-updated className="mt-2 font-rd text-[12px] text-rd-ink-faint">
          {`Bracket updated ${card.updatedLabel}`}
        </p>
      )}
    </section>
  );
}
