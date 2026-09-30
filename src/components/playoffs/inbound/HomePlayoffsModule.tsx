import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { HomeLeague } from '@/lib/postseason/inbound';

const SURFACE = 'web_home' as const;

/**
 * The playoffs module on the homepage: each league whose postseason is being
 * played, the round it is in, and a link to its bracket. Server-rendered.
 *
 * It states the round and nothing faster than that. The homepage is
 * regenerated every six hours and cannot be revalidated on demand, so a
 * score or a game time here would be out of date for most of its life.
 */
export function HomePlayoffsModule({ season, leagues }: { season: number; leagues: readonly HomeLeague[] }) {
  const headingId = 'home-playoffs';
  return (
    <div className="mx-auto mb-10 max-w-5xl">
      <section
        aria-labelledby={headingId}
        data-playoffs-module="home"
        data-playoffs-state="active"
        className="rounded-[14px] border border-rd-line bg-rd-card p-5 shadow-[0_1px_3px_rgba(33,29,24,0.06)]"
        style={{ borderLeft: '3px solid var(--color-rd-red)' }}
      >
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">Postseason {season}</p>
            <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink md:text-3xl">
              Playoffs
            </h2>
          </div>
          <TrackedLink
            href="/playoffs"
            surface={SURFACE}
            ctaId="playoffs_module_hub"
            ctaLabel="All playoff brackets"
            className="font-rd text-sm font-semibold text-rd-red underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red-dark"
          >
            All playoff brackets
          </TrackedLink>
        </div>
        <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {leagues.map((l) => (
            <li key={l.league} data-league={l.league} className="border-t border-rd-line py-2.5">
              <TrackedLink href={l.href} surface={SURFACE} ctaId="playoffs_module_league" ctaLabel={`Open the ${l.league} bracket`} className="group block">
                <span className="rd-display block text-xl uppercase text-rd-ink group-hover:text-rd-red">{l.league}</span>
                <span className="mt-0.5 block font-rd text-[13.5px] text-rd-ink-soft">{l.roundLabel}</span>
                <span className="mt-0.5 block font-rd text-[13px] font-semibold text-rd-red">Open the {l.league} bracket</span>
              </TrackedLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
