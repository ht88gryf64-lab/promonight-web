import type { ReactNode } from 'react';
import Link from 'next/link';
import { currentRoundSeries, type HomeGameView, type LeagueView, type SeriesView } from '@/lib/postseason/view';
import type { PostseasonLeague } from '@/lib/postseason/types';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { HomeGames } from './HomeGames';
import { PredictionsCard } from './PredictionsCard';
import { CONDENSED, InProgressBadge } from './ui';

export type HubLeague =
  | { state: 'ok'; league: PostseasonLeague; href: string; view: LeagueView; predictionsLocked: boolean }
  | { state: 'unavailable'; league: PostseasonLeague; href: string };

function seriesNames(s: SeriesView): string {
  return `${s.higher.label} vs ${s.lower.label}`;
}

function Badge({ children, tone }: { children: ReactNode; tone: 'round' | 'done' | 'muted' }) {
  const style =
    tone === 'round'
      ? 'bg-rd-red text-white'
      : tone === 'done'
        ? 'bg-rd-ink text-white'
        : 'border border-rd-line-strong text-rd-ink-soft';
  return (
    <span className={`shrink-0 rounded px-2 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] ${style}`}>{children}</span>
  );
}

function CardShell({
  league,
  href,
  badge,
  linkText,
  updatedLabel = null,
  children,
}: {
  league: string;
  href: string;
  badge: ReactNode;
  linkText: string;
  /** When this league's bracket last changed. Every status on the card is as
   *  of that moment, so the card says so. */
  updatedLabel?: string | null;
  children: ReactNode;
}) {
  return (
    <li data-league-card={league} className="overflow-hidden rounded-[10px] border border-rd-line bg-rd-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="text-[30px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
          <Link href={href} className="hover:text-rd-red">
            {league}
          </Link>
        </h2>
        {badge}
      </div>
      <div className="px-4 pb-3 pt-3">
        {children}
        {updatedLabel && (
          <p data-bracket-updated className="mt-2.5 text-[12px] text-rd-ink-faint">
            Bracket updated {updatedLabel}
          </p>
        )}
      </div>
      <Link
        href={href}
        className="block border-t border-rd-line px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-rd-red hover:text-rd-red-dark"
        style={{ fontFamily: CONDENSED, fontSize: 15 }}
      >
        {linkText}
      </Link>
    </li>
  );
}

function LeagueCard({ entry }: { entry: HubLeague }) {
  if (entry.state === 'unavailable') {
    return (
      <CardShell league={entry.league} href={entry.href} badge={<Badge tone="muted">Not available</Badge>} linkText={`Open the ${entry.league} page`}>
        <p data-bracket-state="unavailable" className="text-[14px] text-rd-ink-soft">
          The {entry.league} bracket is not available right now.
        </p>
      </CardShell>
    );
  }
  const { view } = entry;
  if (view.phase.kind === 'concluded') {
    return (
      <CardShell
        league={entry.league}
        href={entry.href}
        badge={<Badge tone="done">Final</Badge>}
        linkText={`Open the ${entry.league} bracket`}
        updatedLabel={view.updatedLabel}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{view.season} champion</p>
        <p className="mt-0.5 text-[24px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
          <Link href={view.phase.championHref} className="hover:text-rd-red">
            {view.phase.championName}
          </Link>
        </p>
        <p className="mt-0.5 text-[13.5px] text-rd-ink-soft">{view.phase.summary}</p>
      </CardShell>
    );
  }
  const series = currentRoundSeries(view);
  return (
    <CardShell
      league={entry.league}
      href={entry.href}
      badge={<Badge tone="round">{view.phase.roundLabel}</Badge>}
      linkText={`Open the ${entry.league} bracket`}
      updatedLabel={view.updatedLabel}
    >
      <ul className="divide-y divide-rd-line">
        {series.map((s) => (
          <li key={s.seriesKey} data-series={s.seriesKey} className="py-2 first:pt-0 last:pb-0">
            <span className="block text-[15px] font-semibold leading-snug text-rd-ink">{seriesNames(s)}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-rd-ink-soft">
              {s.liveLabel ? <InProgressBadge /> : null}
              <span>{s.liveLabel ? s.next?.title : s.headline}</span>
              {s.liveLabel && s.scoreLine ? <span>{s.scoreLine}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function PlayoffsHub({
  season,
  leagues,
  nextGames,
  tickets,
}: {
  season: number;
  leagues: readonly HubLeague[];
  nextGames: readonly HomeGameView[];
  tickets: Readonly<Record<string, ReactNode>>;
}) {
  const ok = leagues.filter((l): l is Extract<HubLeague, { state: 'ok' }> => l.state === 'ok');
  const active = ok.filter((l) => l.view.phase.kind === 'active');
  const concluded = ok.filter((l) => l.view.phase.kind === 'concluded');
  const unavailable = leagues.filter((l) => l.state === 'unavailable');
  const ordered: HubLeague[] = [...active, ...concluded, ...unavailable];
  // "Nothing is underway" is a claim. It is made only when every league was
  // read and none is playing. An unreadable league proves nothing either way.
  const offseason = active.length === 0 && unavailable.length === 0;
  const predictionsLocked = active.some((l) => l.predictionsLocked);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-9 lg:max-w-5xl">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-rd-red" style={{ fontFamily: CONDENSED }}>
          Postseason {season}
        </p>
        <h1
          className="mt-1.5 font-extrabold uppercase leading-[0.98] text-rd-ink"
          style={{ fontFamily: CONDENSED, fontSize: 'clamp(40px, 10vw, 60px)' }}
        >
          Playoffs
        </h1>
        <p className="mt-2.5 max-w-[52ch] text-[15px] text-rd-ink-soft">
          Every series in the bracket and where it stands, with the home games coming up next and the parks that host them.
        </p>
      </header>

      {offseason && (
        <div data-hub-state="offseason" className="mt-6 rounded-[10px] border border-rd-line bg-rd-card px-4 py-5">
          <p className="text-[22px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
            No postseason is underway
          </p>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-rd-ink-soft">
            A league appears here once its bracket is set. Until then, team pages carry every promotion on the regular-season schedule.
          </p>
        </div>
      )}

      {ordered.length > 0 && (
        <section aria-label="Leagues" className="mt-6">
          <ul className="grid gap-3 lg:grid-cols-2">
            {ordered.map((l) => (
              <LeagueCard key={l.league} entry={l} />
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 && (
        <HomeGames
          id="next-home-games"
          heading="Next home games"
          games={nextGames}
          tickets={tickets}
          showLeague
          empty="No upcoming home game with a confirmed host is listed yet."
        />
      )}

      {predictionsLocked && <PredictionsCard heading="Predictions are locked" headingId="predictions-locked" />}

      <footer className="mt-10 space-y-2 border-t border-rd-line pt-4">
        <p className="text-[12.5px] leading-relaxed text-rd-ink-faint">
          Each bracket shows when it last changed. All times are Eastern (ET). A game marked if necessary is played only when the series is
          still undecided.
        </p>
        <AffiliateDisclosure />
      </footer>
    </div>
  );
}
