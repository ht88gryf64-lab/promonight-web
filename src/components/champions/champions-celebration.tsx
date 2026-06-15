// Post-season champions celebration block, shown at the top of /playoffs during
// the offseason window (playoffsActive === false AND now < displayUntil).
//
// Mirrors the /world-cup fan-zone pattern: static editorial config drives the
// headers and parade cards, Event JSON-LD is emitted per parade, and the live
// "championship run" promo highlights are joined in from playoffPromos.
//
// Design language: team colors as accents only (top bar, eyebrow, parade-card
// rail), bold display typography for the team name and the "2026 Champions"
// header. No licensed imagery.
import Link from 'next/link';
import type { Champion } from '@/lib/champions-data';
import { buildParadeEventSchema } from '@/lib/champions-data';
import type { PlayoffPromoWithTeam } from '@/lib/types';

const LEAGUE_LABEL: Record<Champion['league'], string> = {
  nba: 'NBA',
  nhl: 'NHL',
};

// Compact category dot colors, matching the redesign light palette used in
// playoff-section.tsx. 'event' and unknowns fall back to neutral ink-faint.
function promoDotColor(type: string): string {
  switch (type) {
    case 'giveaway':
      return '#f97316';
    case 'theme':
      return '#7c3aed';
    case 'food':
      return '#16a34a';
    case 'kids':
      return '#0ea5e9';
    default:
      return '#9a9081';
  }
}

function formatParadeDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  });
  return `${date} · ${time}`;
}

const PROMO_LIMIT = 8;

// Dated promos first (most recent first, i.e. the deepest rounds), then
// recurring/undated. Caps the list so a long run (the Canes carry ~56 docs)
// stays compact; the remainder is summarized as "+N more".
function orderRunPromos(promos: PlayoffPromoWithTeam[]): {
  shown: PlayoffPromoWithTeam[];
  remaining: number;
} {
  const dated = promos
    .filter((p) => p.date)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string));
  const undated = promos.filter((p) => !p.date);
  const ordered = [...dated, ...undated];
  return {
    shown: ordered.slice(0, PROMO_LIMIT),
    remaining: Math.max(0, ordered.length - PROMO_LIMIT),
  };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
}

function ChampionBlock({
  champion,
  promos,
}: {
  champion: Champion;
  promos: PlayoffPromoWithTeam[];
}) {
  const { primary, secondary } = champion.teamColors;
  const leagueLabel = LEAGUE_LABEL[champion.league];
  const teamUrl = `/${champion.league}/${champion.teamId}`;
  const { shown, remaining } = orderRunPromos(promos);

  return (
    <article className="overflow-hidden rounded-2xl border border-rd-line bg-rd-card">
      {/* Team-color accent bar */}
      <div
        className="h-1.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${primary} 0%, ${primary} 70%, ${secondary} 100%)`,
        }}
        aria-hidden
      />

      <div className="p-6 md:p-8">
        {/* Header */}
        <p
          className="font-rd text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: primary }}
        >
          {champion.titleYear} {leagueLabel} Champions
        </p>
        <h2 className="rd-display mt-2 text-3xl uppercase leading-[0.95] text-rd-ink md:text-5xl">
          <Link href={teamUrl} className="transition-colors hover:text-rd-red">
            {champion.teamName}
          </Link>
        </h2>
        <p className="mt-3 font-rd text-base font-semibold text-rd-ink md:text-lg">
          {champion.seriesContext}
          <span className="text-rd-ink-faint"> {'·'} </span>
          <span className="text-rd-ink-soft">{champion.seriesResult}</span>
        </p>
        <p className="mt-3 max-w-3xl font-rd text-[15px] leading-relaxed text-rd-ink-soft">
          {champion.framing}
        </p>

        {/* MVP + coach */}
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="font-rd text-[10px] uppercase tracking-[0.14em] text-rd-ink-faint">
              {champion.finalsMVP.award}
            </p>
            <p className="font-rd text-sm font-semibold text-rd-ink">
              {champion.finalsMVP.name}
            </p>
            <p className="font-rd text-[13px] text-rd-ink-soft">
              {champion.finalsMVP.note}
            </p>
          </div>
          <div>
            <p className="font-rd text-[10px] uppercase tracking-[0.14em] text-rd-ink-faint">
              Head Coach
            </p>
            <p className="font-rd text-sm font-semibold text-rd-ink">
              {champion.headCoach}
            </p>
          </div>
        </div>

        {/* Parade card - prominent, dated upcoming event */}
        <div
          className="mt-6 rounded-xl border border-rd-line p-5 md:p-6"
          style={{
            borderLeft: `4px solid ${primary}`,
            backgroundColor: 'var(--color-rd-cream)',
          }}
        >
          <p className="font-rd text-[10px] font-semibold uppercase tracking-[0.16em] text-rd-ink-faint">
            Upcoming celebration
          </p>
          <h3 className="rd-display mt-1 text-xl uppercase text-rd-ink md:text-2xl">
            {champion.parade.name}
          </h3>
          <dl className="mt-3 space-y-1.5 font-rd text-sm text-rd-ink">
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold">When</dt>
              <dd className="text-rd-ink-soft">
                {formatParadeDateTime(champion.parade.startDate)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold">Where</dt>
              <dd className="text-rd-ink-soft">{champion.parade.location}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold">Host</dt>
              <dd className="text-rd-ink-soft">{champion.parade.organizer}</dd>
            </div>
          </dl>
          <p className="mt-3 font-rd text-[14px] leading-relaxed text-rd-ink-soft">
            {champion.parade.description}
          </p>
        </div>

        {/* Promos from the championship run */}
        {shown.length > 0 && (
          <div className="mt-6">
            <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
              Promos from the championship run
            </p>
            <ul className="mt-3 space-y-2">
              {shown.map((p, i) => (
                <li
                  key={`${p.teamId}-${p.date ?? 'rec'}-${p.title}`}
                  className="flex items-baseline gap-3 text-sm"
                >
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: promoDotColor(p.type) }}
                    aria-hidden
                  />
                  <span className="flex-1 leading-snug text-rd-ink">
                    {p.title}
                    {p.description ? (
                      <span className="text-rd-ink-soft">
                        {' · '}
                        {p.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">
                    {p.date
                      ? shortDate(p.date)
                      : p.recurringDetail || 'recurring'}
                  </span>
                </li>
              ))}
              {remaining > 0 && (
                <li className="pl-4 font-rd text-xs text-rd-ink-faint">
                  + {remaining} more from the run
                </li>
              )}
            </ul>
          </div>
        )}

        <Link
          href={teamUrl}
          className="mt-6 inline-block font-rd text-[11px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:text-rd-ink"
        >
          View {champion.teamName} page {'→'}
        </Link>
      </div>
    </article>
  );
}

export function ChampionsCelebration({
  champions,
  promosByTeam,
}: {
  champions: Champion[];
  promosByTeam: Record<string, PlayoffPromoWithTeam[]>;
}) {
  return (
    <>
      {/* Event JSON-LD, one per parade */}
      {champions.map((c) => (
        <script
          key={c.teamId}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildParadeEventSchema(c)),
          }}
        />
      ))}

      {/* Charcoal hero with subtle dual team-color accents */}
      <section
        className="relative overflow-hidden text-white"
        style={{ backgroundColor: '#1d1714' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(110% 80% at 0% 0%, rgba(0,107,182,0.30) 0%, transparent 55%),' +
              'radial-gradient(110% 80% at 100% 0%, rgba(204,0,0,0.28) 0%, transparent 55%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
          <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Offseason {'·'} 2026 Champions
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
            2026 NBA &amp; NHL Champions
          </h1>
          <p className="mt-4 max-w-3xl font-rd text-base leading-relaxed text-white/70 md:text-lg">
            The Knicks and the Hurricanes closed out the 2026 postseason. Parade
            details, championship moments, and every giveaway from both runs are
            below.
          </p>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-5xl space-y-6 px-6">
        {champions.map((c) => (
          <ChampionBlock
            key={c.teamId}
            champion={c}
            promos={promosByTeam[c.teamId] ?? []}
          />
        ))}
      </div>
    </>
  );
}
