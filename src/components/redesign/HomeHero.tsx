import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { BRAND_TAGLINE } from '@/lib/brand';

// Redesign hero. Began as a variant of the inline hero in the retired
// RedesignHomePage
// per the design target (docs/homepage-redesign-target.html): the tonight
// cards move OUT of the hero into their own StubRail section below, the old
// h1 becomes the eyebrow, and the clock-stamp line (known-issues entry 21) is
// replaced by the stats row. League-agnostic by construction: every number on
// this surface arrives as a prop the caller derived from data. There is no
// hardcoded league count, team count, or league name anywhere in this file,
// so an August (MLB-heavy) and a December (NFL/NHL/NBA) corpus render the
// same structure with different numbers.
//
// CTAs are plain Links for now; their analytics events are named at wiring
// time alongside the StubRail see-all events (same decision, one sweep).

export interface HomeHeroStat {
  /** Preformatted display value (caller applies toLocaleString etc.). */
  value: string;
  label: string;
}

export interface HomeHeroProps {
  /** Pro team count, derived from getAllTeams().length (CFB is a separate
   *  stream and is not counted, matching the existing teamCount prop). */
  teamCount: number;
  /** Distinct leagues among those teams, derived — never hardcoded. */
  leagueCount: number;
  /** Stats row, rendered in order. Caller derives every value; a stat whose
   *  underlying count can hit zero should be chosen (or swapped) at wiring
   *  time rather than rendering "0" here. */
  stats: HomeHeroStat[];
}

// Charcoal hero base, matching the team-page hero (the value the previous
// homepage called HERO_INK before it was retired).
const HERO_INK = '#1d1714';

export function HomeHero({ teamCount, leagueCount, stats }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: HERO_INK }}>
      <div
        aria-hidden
        className="absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(120% 80% at 100% 0%, rgba(218,45,32,0.18) 0%, transparent 60%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-14 pt-16 md:pb-20 md:pt-24">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          <span className="h-1.5 w-1.5 rounded-full bg-rd-red" aria-hidden />
          {BRAND_TAGLINE}
        </p>
        <h1 className="rd-display mt-4 max-w-3xl text-4xl uppercase leading-[0.95] text-white md:text-6xl">
          Find the games worth going to.
        </h1>
        <p className="mt-5 max-w-2xl font-rd text-lg text-white/70">
          Every giveaway, theme night, food deal and family event across {teamCount} teams in{' '}
          {leagueCount} leagues, pulled from official team sources.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/promos/today"
            className="inline-flex items-center gap-2 rounded-full bg-rd-red px-6 py-3 font-rd text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            See today&apos;s promos
            <IconArrowRight size={16} stroke={2.5} />
          </Link>
          <Link
            href="/teams"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 font-rd text-sm font-semibold text-white/85 transition-colors hover:border-white/50 hover:text-white"
          >
            Find your team
          </Link>
        </div>

        {stats.length > 0 && (
          <dl className="mt-12 flex flex-wrap">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`pr-8 ${i < stats.length - 1 ? 'mr-8 border-r border-white/10' : ''}`}
              >
                <dd className="font-rd text-[32px] font-bold leading-none text-white">{s.value}</dd>
                <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
